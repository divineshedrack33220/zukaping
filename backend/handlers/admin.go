package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"coded/database"
	"coded/middleware"
	"coded/models"
	"coded/pkg/logger"
	"coded/pkg/validation"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AdminLogin authenticates an administrator and returns a JWT carrying the admin role.
func AdminLogin(c *gin.Context) {
	log := logger.WithContext(c)

	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request data",
			"details": err.Error(),
		})
		return
	}
	req.Email = validation.SanitizeEmail(req.Email)

	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.DB.Collection("users")

	var user models.User
	err := usersColl.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if err == mongo.ErrNoDocuments || (user.PasswordHash == nil) {
		log.Warn().Str("email", req.Email).Msg("Admin login: user not found or no password")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("Admin login: database error")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	role := user.Role
	if role == "" {
		role = "user"
	}
	if role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Administrator access required"})
		return
	}
	if user.IsSuspended {
		c.JSON(http.StatusForbidden, gin.H{"error": "This administrator account is suspended"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		log.Warn().Str("email", req.Email).Msg("Admin login: invalid password")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Update last seen
	usersColl.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{"lastSeen": time.Now().Unix()}})

	// Generate admin JWT with role claim
	expirationTime := time.Now().Add(12 * time.Hour)
	claims := &middleware.Claims{
		UserID: user.ID.Hex(),
		Role:   "admin",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Error().Err(err).Msg("Admin login: failed to sign token")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	log.Info().Str("email", user.Email).Msg("Admin login successful")

	c.JSON(http.StatusOK, gin.H{
		"token":   tokenString,
		"expires": expirationTime.Unix(),
		"admin": gin.H{
			"id":    user.ID.Hex(),
			"email": user.Email,
			"name":  user.Name,
		},
	})
}

// getAdminContext extracts the admin ID and email from the request context.
func getAdminContext(c *gin.Context) (primitive.ObjectID, string) {
	userID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))
	email := c.GetString("adminEmail")
	return userID, email
}

// logAdminAction records an administrative action to the audit log collection.
func logAdminAction(c *gin.Context, action, targetType, targetID, details string) {
	if database.Client == nil {
		return
	}

	adminID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))

	// Resolve admin email when not already in context.
	adminEmail := c.GetString("adminEmail")
	if adminEmail == "" {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		var u models.User
		err := database.DB.Collection("users").FindOne(ctx, bson.M{"_id": adminID}).Decode(&u)
		if err == nil {
			adminEmail = u.Email
			c.Set("adminEmail", adminEmail)
		}
		cancel()
	}

	entry := models.AdminAuditLog{
		ID:         primitive.NewObjectID(),
		AdminID:    adminID,
		AdminEmail: adminEmail,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Details:    details,
		IPAddress:  c.ClientIP(),
		CreatedAt:  time.Now().UTC(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if _, err := database.DB.Collection("admin_audit_logs").InsertOne(ctx, entry); err != nil {
		logger.WithContext(c).Error().Err(err).Msg("Failed to write admin audit log")
	}
}

// AdminGetAuditLogs lists recent admin actions.
func AdminGetAuditLogs(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit := 50
	skip := 0
	if l, err := parseIntQuery(c.Query("limit")); err == nil && l > 0 && l <= 200 {
		limit = l
	}
	if s, err := parseIntQuery(c.Query("skip")); err == nil && s >= 0 {
		skip = s
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{}
	if action := c.Query("action"); action != "" {
		filter["action"] = action
	}
	if adminID := c.Query("adminId"); adminID != "" {
		if oid, err := primitive.ObjectIDFromHex(adminID); err == nil {
			filter["adminId"] = oid
		}
	}

	opts := options.Find().SetSort(bson.M{"createdAt": -1}).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := database.DB.Collection("admin_audit_logs").Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}
	defer cursor.Close(ctx)

	var logs []models.AdminAuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode audit logs"})
		return
	}

	total, _ := database.DB.Collection("admin_audit_logs").CountDocuments(ctx, filter)

	c.JSON(http.StatusOK, gin.H{"logs": logs, "total": total})
}

func parseIntQuery(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}
