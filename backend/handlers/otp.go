package handlers

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"net/http"
	"regexp"
	"time"

	"coded/database"
	"coded/middleware"
	"coded/models"
	"coded/pkg/email"
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

const (
	otpTTL         = 10 * time.Minute
	otpMaxAttempts = 5
)

type RequestOTPRequest struct {
	Email string `json:"email" binding:"required,email" validate:"email"`
}

type ResetPasswordRequest struct {
	Email    string `json:"email" binding:"required,email" validate:"email"`
	Code     string `json:"code" binding:"required,len=6,numeric"`
	Password string `json:"password" binding:"required,min=8" validate:"strongpassword"`
}

type otpDoc struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Email     string             `bson:"email"`
	CodeHash  string             `bson:"codeHash"`
	Attempts  int                `bson:"attempts"`
	CreatedAt time.Time          `bson:"createdAt"`
	ExpiresAt time.Time          `bson:"expiresAt"`
}

// findUserByEmail mirrors Login's lookup: signup stores a lowercased address but
// mobile accounts kept their original capitalisation.
func findUserByEmail(ctx context.Context, coll *mongo.Collection, addr string) (models.User, error) {
	var user models.User
	err := coll.FindOne(ctx, bson.M{"email": addr}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		err = coll.FindOne(ctx, bson.M{
			"email": bson.M{
				"$regex":   "^" + regexp.QuoteMeta(addr) + "$",
				"$options": "i",
			},
		}).Decode(&user)
	}
	return user, err
}

func sixDigitCode() (string, error) {
	code := make([]byte, 6)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		code[i] = byte(int('0') + int(n.Int64()))
	}
	return string(code), nil
}

// RequestOTP emails a single-use code that lets the holder set a new password.
// It answers the same way whether or not the address has an account, so the
// endpoint cannot be used to enumerate users.
func RequestOTP(c *gin.Context) {
	log := logger.WithContext(c)

	var req RequestOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
		return
	}
	if err := validation.ValidateStruct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}
	req.Email = validation.SanitizeEmail(req.Email)

	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Service temporarily unavailable"})
		return
	}
	if !email.IsConfigured() {
		log.Error().Msg("Reset code requested but RESEND_API_KEY is not set")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Email delivery is not configured",
			"message": "The server cannot send codes right now. Please try again later.",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")
	user, err := findUserByEmail(ctx, usersColl, req.Email)
	generic := gin.H{
		"message":          "If that email has a Zukaping account, a 6-digit code is on its way.",
		"expiresInSeconds": int(otpTTL.Seconds()),
	}
	if err == mongo.ErrNoDocuments {
		log.Warn().Str("email", req.Email).Msg("Reset code requested for unknown email")
		c.JSON(http.StatusOK, generic)
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("Database error looking up user for reset")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	code, err := sixDigitCode()
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate reset code")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	// Only the hash is stored, so a database read cannot hand out live codes.
	hashed, err := bcrypt.GenerateFromPassword([]byte(code), 10)
	if err != nil {
		log.Error().Err(err).Msg("Failed to hash reset code")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	otps := database.Client.Database("coded").Collection("otps")
	if _, err := otps.DeleteMany(ctx, bson.M{"email": user.Email}); err != nil {
		log.Error().Err(err).Msg("Failed to clear previous reset codes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	doc := otpDoc{
		Email:     user.Email,
		CodeHash:  string(hashed),
		Attempts:  0,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(otpTTL),
	}
	if _, err := otps.InsertOne(ctx, doc); err != nil {
		log.Error().Err(err).Msg("Failed to store reset code")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if err := email.SendPasswordOTP(ctx, user.Email, code); err != nil {
		// A code that never reached an inbox must not linger as a valid secret.
		otps.DeleteMany(ctx, bson.M{"email": user.Email})
		log.Error().Err(err).Msg("Resend rejected the reset code email")
		c.JSON(http.StatusBadGateway, gin.H{
			"error":   "Could not send the code",
			"message": "Email delivery failed. Please try again in a moment.",
		})
		return
	}

	log.Info().Str("userId", user.ID.Hex()).Msg("Reset code emailed")
	c.JSON(http.StatusOK, generic)
}

// ResetPasswordWithOTP swaps the password for a holder of a valid code and signs
// them straight in. Accounts created through Google have no password at all, so
// this is also how they can set one.
func ResetPasswordWithOTP(c *gin.Context) {
	log := logger.WithContext(c)

	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data", "details": err.Error()})
		return
	}
	if err := validation.ValidateStruct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}
	req.Email = validation.SanitizeEmail(req.Email)

	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Service temporarily unavailable"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")
	user, err := findUserByEmail(ctx, usersColl, req.Email)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired code"})
			return
		}
		log.Error().Err(err).Msg("Database error during reset")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	otps := database.Client.Database("coded").Collection("otps")
	filter := bson.M{"email": user.Email, "expiresAt": bson.M{"$gt": time.Now()}}

	var doc otpDoc
	err = otps.FindOne(ctx, filter, options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}})).Decode(&doc)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired code"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(doc.CodeHash), []byte(req.Code)) != nil {
		_, _ = otps.UpdateOne(ctx, bson.M{"_id": doc.ID}, bson.M{"$inc": bson.M{"attempts": 1}})
		if doc.Attempts+1 >= otpMaxAttempts {
			_, _ = otps.DeleteMany(ctx, bson.M{"email": user.Email})
			log.Warn().Str("userId", user.ID.Hex()).Msg("Reset code invalidated after too many attempts")
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired code"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		log.Error().Err(err).Msg("Failed to hash new password")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	hashed := string(hashedPassword)

	_, err = usersColl.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"passwordHash": hashed, "lastSeen": time.Now().Unix()},
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to store new password")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Single use: once consumed, no further request can reuse the code.
	_, _ = otps.DeleteMany(ctx, bson.M{"email": user.Email})

	expirationTime := time.Now().Add(7 * 24 * time.Hour)
	claims := &middleware.Claims{
		UserID: user.ID.Hex(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate token after reset")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	log.Info().Str("userId", user.ID.Hex()).Msg("Password reset with code")
	c.JSON(http.StatusOK, gin.H{
		"message": "Password updated",
		"token":   tokenString,
		"userId":  user.ID.Hex(),
		"email":   user.Email,
		"expires": expirationTime.Unix(),
	})
}
