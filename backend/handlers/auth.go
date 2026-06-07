package handlers

import (
	"context"
	"net/http"
	"os"
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
	"golang.org/x/crypto/bcrypt"
)

type SignupRequest struct {
	Email      string `json:"email" binding:"required,email" validate:"email"`
	Password   string `json:"password" binding:"required,min=8" validate:"strongpassword"`
	InviteCode string `json:"inviteCode" validate:"omitempty,alphanum"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email" validate:"email"`
	Password string `json:"password" binding:"required" validate:"required"`
}

func Signup(c *gin.Context) {
	log := logger.WithContext(c)
	log.Info().Msg("POST /api/signup received")
	
	var req SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("Bad request")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	// Additional validation with custom validators
	if err := validation.ValidateStruct(&req); err != nil {
		log.Warn().Err(err).Msg("Validation failed")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	// Sanitize inputs
	req.Email = validation.SanitizeEmail(req.Email)
	req.InviteCode = validation.SanitizeString(req.InviteCode)

	log.Info().Str("email", req.Email).Msg("Signup attempt")

	// Check if database is available
	if database.Client == nil {
		log.Error().Msg("Database unavailable - running in degraded mode")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Service temporarily unavailable",
			"message": "Database connection not available. Please try again later.",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")

	// Check if user already exists
	var existingUser models.User
	err := usersColl.FindOne(ctx, bson.M{"email": req.Email}).Decode(&existingUser)
	if err == nil {
		log.Warn().Str("email", req.Email).Msg("Email already in use")
		c.JSON(http.StatusConflict, gin.H{
			"error":   "Email already registered",
			"message": "Please use a different email or login instead",
		})
		return
	}
	if err != mongo.ErrNoDocuments {
		log.Error().Err(err).Msg("Database error checking email")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Database error",
			"message": "Please try again later",
		})
		return
	}

	// Hash password with cost 12
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		log.Error().Err(err).Msg("Failed to hash password")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Server error",
			"message": "Failed to process password",
		})
		return
	}
	hashed := string(hashedPassword)

	// Create new user
	user := models.User{
		ID:           primitive.NewObjectID(),
		Email:        req.Email,
		PasswordHash: &hashed,
		AuthProvider: "email",
		CreatedAt:    time.Now().Unix(),
		LastSeen:     time.Now().Unix(),
		Username:     "user_" + primitive.NewObjectID().Hex()[:8],
		Name:         "",
		Avatar:       "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
		Bio:          "",
		Gender:       "",
		InterestedIn: []string{},
		Photos:       []string{},
		Status:       "offline",
		BirthDate:    0,
	}

	// Insert user
	_, err = usersColl.InsertOne(ctx, user)
	if err != nil {
		log.Error().Err(err).Msg("Failed to insert user")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Database error",
			"message": "Failed to create user account",
		})
		return
	}

	if req.InviteCode != "" {
		chatsColl := database.Client.Database("coded").Collection("chats")
		_, chatErr := chatsColl.UpdateOne(ctx,
			bson.M{"inviteCode": req.InviteCode, "isGroup": true},
			bson.M{"$addToSet": bson.M{"participants": user.ID}},
		)
		if chatErr != nil {
			log.Warn().Err(chatErr).Str("inviteCode", req.InviteCode).Msg("Failed to auto-join group")
		} else {
			log.Info().Str("email", user.Email).Str("inviteCode", req.InviteCode).Msg("User auto-joined group")
		}
	}

	log.Info().Str("email", req.Email).Str("userId", user.ID.Hex()).Msg("User created")

	// Generate JWT token
	expirationTime := time.Now().Add(7 * 24 * time.Hour)
	claims := &middleware.Claims{
		UserID: user.ID.Hex(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal().Msg("JWT_SECRET not configured")
	}
	
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate token")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Server error",
			"message": "Failed to generate authentication token",
		})
		return
	}

	log.Info().Str("email", req.Email).Msg("Signup completed successfully")

	c.JSON(http.StatusCreated, gin.H{
		"message":  "User created successfully",
		"token":    tokenString,
		"userId":   user.ID.Hex(),
		"email":    user.Email,
		"username": user.Username,
	})
}

func Login(c *gin.Context) {
	log := logger.WithContext(c)
	log.Info().Msg("POST /api/login received")
	
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("Bad request")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request data",
			"details": err.Error(),
		})
		return
	}

	// Additional validation
	if err := validation.ValidateStruct(&req); err != nil {
		log.Warn().Err(err).Msg("Validation failed")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	// Sanitize email
	req.Email = validation.SanitizeEmail(req.Email)

	log.Info().Str("email", req.Email).Msg("Login attempt")

	// Check if database is available
	if database.Client == nil {
		log.Error().Msg("Database unavailable - running in degraded mode")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Service temporarily unavailable",
			"message": "Database connection not available. Please try again later.",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")

	// Find user by email
	var user models.User
	err := usersColl.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		log.Warn().Str("email", req.Email).Msg("User not found")
		// Use same error message for security (don't reveal if email exists)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Authentication failed",
			"message": "Invalid email or password",
		})
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("Database error")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Database error",
			"message": "Please try again later",
		})
		return
	}

	log.Info().Str("email", req.Email).Str("userId", user.ID.Hex()).Msg("User found")

	// Check password
	if user.PasswordHash == nil {
		log.Warn().Str("email", req.Email).Msg("No password hash for user")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Authentication failed",
			"message": "Invalid email or password",
		})
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password))
	if err != nil {
		log.Warn().Str("email", req.Email).Msg("Invalid password")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "Authentication failed",
			"message": "Invalid email or password",
		})
		return
	}

	log.Info().Str("email", req.Email).Msg("Password correct")

	// Update last seen time
	usersColl.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$set": bson.M{"lastSeen": time.Now().Unix()},
	})

	// Generate JWT token
	expirationTime := time.Now().Add(7 * 24 * time.Hour)
	claims := &middleware.Claims{
		UserID: user.ID.Hex(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal().Msg("JWT_SECRET not configured")
	}
	
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate token")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Server error",
			"message": "Failed to generate authentication token",
		})
		return
	}

	log.Info().Str("email", req.Email).Msg("Login successful")

	c.JSON(http.StatusOK, gin.H{
		"token":    tokenString,
		"userId":   user.ID.Hex(),
		"email":    user.Email,
		"username": user.Username,
		"avatar":   user.Avatar,
		"message":  "Login successful",
		"expires":  expirationTime.Unix(),
	})
}

// Add this test endpoint to verify handlers are working
func TestHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "Handlers are working correctly",
		"time":    time.Now().Unix(),
	})
}