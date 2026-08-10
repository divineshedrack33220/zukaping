package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"coded/database"
	"coded/models"
	"coded/pkg/logger"
	"coded/pkg/validation"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

type AdminCreateAdminRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Name     string `json:"name" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
}

// AdminCreateAdmin creates a new administrator account.
func AdminCreateAdmin(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	var req AdminCreateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email, name and password (min 8 chars) are required"})
		return
	}
	req.Email = validation.SanitizeEmail(req.Email)
	req.Name = validation.SanitizeString(req.Name)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.DB.Collection("users")

	var existing models.User
	err := usersColl.FindOne(ctx, bson.M{"email": req.Email}).Decode(&existing)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "A user with this email already exists"})
		return
	}
	if err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	hashed, herr := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if herr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}
	hashedStr := string(hashed)

	admin := models.User{
		ID:           primitive.NewObjectID(),
		Email:        req.Email,
		PasswordHash: &hashedStr,
		AuthProvider: "email",
		Role:         "admin",
		IsSuspended:  false,
		CreatedAt:    time.Now().Unix(),
		LastSeen:     time.Now().Unix(),
		Username:     "admin_" + primitive.NewObjectID().Hex()[:8],
		Name:         req.Name,
		Avatar:       "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
		Status:       "offline",
		InterestedIn: []string{},
		Photos:       []string{},
	}

	if _, ierr := usersColl.InsertOne(ctx, admin); ierr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create admin"})
		return
	}

	logAdminAction(c, "create_admin", "user", admin.ID.Hex(), "email="+req.Email)
	logger.WithContext(c).Info().Str("email", req.Email).Msg("Admin created another admin")

	c.JSON(http.StatusCreated, gin.H{
		"message": "Admin account created",
		"id":      admin.ID.Hex(),
		"email":   admin.Email,
		"name":    admin.Name,
	})
}

// AdminRemoveAdmin demotes an administrator back to a regular user.
// Protects the acting admin and ensures at least one admin remains.
func AdminRemoveAdmin(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	actingID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))
	if actingID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot remove your own admin access"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.DB.Collection("users")

	var user models.User
	if err := usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if user.Role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This user is not an admin"})
		return
	}

	adminCount, _ := usersColl.CountDocuments(ctx, bson.M{"role": "admin"})
	if adminCount <= 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove the last remaining administrator"})
		return
	}

	if _, err := usersColl.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$set": bson.M{"role": "user"},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	logAdminAction(c, "remove_admin", "user", userID.Hex(), "email="+user.Email)
	logger.WithContext(c).Info().Str("email", user.Email).Msg("Admin removed another admin")

	c.JSON(http.StatusOK, gin.H{
		"message": "Admin access removed",
		"id":      userID.Hex(),
		"role":    "user",
	})
}

type AdminUpdateUserRequest struct {
	Name        *string  `json:"name"`
	Username    *string  `json:"username"`
	Bio         *string  `json:"bio"`
	Gender      *string  `json:"gender"`
	Status      *string  `json:"status"`
	Avatar      *string  `json:"avatar"`
	BirthDate   *int64   `json:"birthDate"`
	Password    *string  `json:"password"`
	InterestedIn []string `json:"interestedIn"`
}

// AdminUpdateUser edits a user's profile fields.
func AdminUpdateUser(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	var req AdminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.DB.Collection("users")

	var user models.User
	if err := usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	set := bson.M{}
	if req.Name != nil {
		set["name"] = validation.SanitizeString(*req.Name)
	}
	if req.Username != nil {
		username := validation.SanitizeString(*req.Username)
		if username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Username cannot be empty"})
			return
		}
		dup := usersColl.FindOne(ctx, bson.M{"username": username, "_id": bson.M{"$ne": userID}})
		var dummy models.User
		if dup.Decode(&dummy) == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
			return
		}
		set["username"] = username
	}
	if req.Bio != nil {
		set["bio"] = validation.SanitizeString(*req.Bio)
	}
	if req.Gender != nil {
		set["gender"] = validation.SanitizeString(*req.Gender)
	}
	if req.Status != nil {
		set["status"] = validation.SanitizeString(*req.Status)
	}
	if req.Avatar != nil {
		set["avatar"] = strings.TrimSpace(*req.Avatar)
	}
	if req.BirthDate != nil {
		set["birthDate"] = *req.BirthDate
	}
	if req.Password != nil && *req.Password != "" {
		if len(*req.Password) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 8 characters"})
			return
		}
		hashed, herr := bcrypt.GenerateFromPassword([]byte(*req.Password), 12)
		if herr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		hashedStr := string(hashed)
		set["passwordHash"] = hashedStr
	}
	if req.InterestedIn != nil {
		set["interestedIn"] = req.InterestedIn
	}

	if len(set) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	if _, err := usersColl.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$set": set}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	logAdminAction(c, "update_user", "user", userID.Hex(), "email="+user.Email+" fields="+joinKeys(set))

	c.JSON(http.StatusOK, gin.H{
		"message": "User updated",
		"id":      userID.Hex(),
	})
}

func joinKeys(m bson.M) string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return strings.Join(keys, ",")
}

type AdminAnnouncementRequest struct {
	Title string `json:"title" binding:"required"`
	Body  string `json:"body" binding:"required"`
}

// AdminSendAnnouncement pushes a notification to every subscribed user
// and records it in the announcements collection.
func AdminSendAnnouncement(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	var req AdminAnnouncementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and body are required"})
		return
	}

	adminID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	subsColl := database.DB.Collection("subscriptions")
	total, _ := subsColl.CountDocuments(ctx, bson.M{})

	announcement := models.Announcement{
		ID:        primitive.NewObjectID(),
		Title:     req.Title,
		Body:      req.Body,
		Audience:  "all",
		CreatedBy: adminID,
		SentCount: int(total),
		CreatedAt: time.Now().Unix(),
	}
	if _, err := database.DB.Collection("announcements").InsertOne(ctx, announcement); err != nil {
		logger.WithContext(c).Error().Err(err).Msg("Failed to store announcement")
	}

	// Broadcast to all push subscribers in the background.
	BroadcastPushNotification(req.Title, req.Body)

	logAdminAction(c, "send_announcement", "announcement", announcement.ID.Hex(), "title="+req.Title)

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Announcement sent",
		"id":         announcement.ID.Hex(),
		"recipients": total,
	})
}

// AdminListAnnouncements returns the history of sent announcements.
func AdminListAnnouncements(c *gin.Context) {
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
	if q := c.Query("search"); q != "" {
		rx := bson.M{"$regex": escapeRegex(q), "$options": "i"}
		filter["$or"] = bson.A{
			bson.M{"title": rx},
			bson.M{"body": rx},
		}
	}

	cursor, err := database.DB.Collection("announcements").Find(ctx, filter,
		options.Find().SetSort(sortSpec(c, map[string][]string{
			"createdAt": {"createdAt"},
			"title":     {"title"},
		}, bson.D{{Key: "createdAt", Value: -1}})).SetSkip(int64(skip)).SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch announcements"})
		return
	}
	defer cursor.Close(ctx)

	var announcements []models.Announcement
	if err := cursor.All(ctx, &announcements); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode announcements"})
		return
	}

	total, _ := database.DB.Collection("announcements").CountDocuments(ctx, filter)

	c.JSON(http.StatusOK, gin.H{"announcements": announcements, "total": total})
}
