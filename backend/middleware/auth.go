package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"coded/database"
	"coded/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Claims struct {
	UserID string `json:"userId"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func GetJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		panic("JWT_SECRET environment variable is not set")
	}
	return []byte(secret)
}

func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip middleware for OPTIONS requests (CORS preflight)
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// Try to get token from Authorization header only (no query param for REST)
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Authentication required",
				"message": "No authorization token provided",
			})
			c.Abort()
			return
		}

		// Check if it's a Bearer token
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Invalid authorization header",
				"message": "Format should be: Bearer <token>",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse and validate the token
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// Validate the alg is what we expect
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return GetJWTSecret(), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Invalid token",
				"message": "Token validation failed",
			})
			c.Abort()
			return
		}

		if !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "Invalid token",
				"message": "Token is not valid",
			})
			c.Abort()
			return
		}

		// Token is valid, set userId in context
		c.Set("userId", claims.UserID)

		// Load the user from the database to enforce suspension and know the role.
		if database.Client != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			userID, err := primitive.ObjectIDFromHex(claims.UserID)
			if err == nil {
				var user models.User
				uerr := database.DB.Collection("users").FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
				if uerr == mongo.ErrNoDocuments {
					cancel()
					c.JSON(http.StatusUnauthorized, gin.H{
						"error":   "Account not found",
						"message": "Your account no longer exists",
					})
					c.Abort()
					return
				}
				if uerr == nil {
					if user.IsSuspended {
						cancel()
						c.JSON(http.StatusForbidden, gin.H{
							"error":   "Account suspended",
							"message": "Your account has been suspended. Contact support for assistance.",
						})
						c.Abort()
						return
					}
					role := user.Role
					if role == "" {
						role = "user"
					}
					c.Set("userRole", role)
				}
			}
			cancel()
		}

		// Continue to the next handler
		c.Next()
	}
}
