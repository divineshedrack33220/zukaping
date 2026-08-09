package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AdminAuthMiddleware requires an authenticated user with role "admin".
// It must be used after JWTAuthMiddleware (which loads userRole into context).
func AdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		role, _ := c.Get("userRole")
		if role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Forbidden",
				"message": "Administrator access required",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
