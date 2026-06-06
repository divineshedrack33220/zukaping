package handlers

import (
    "context"
    "time"

    "coded/database"
    "coded/websocket"
    "github.com/gin-gonic/gin"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

// Global variables used across handlers
var (
    fallbackAvatar   = "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
    vapidPrivateKey  string
    wsManager        *websocket.Manager
)

// PushSubscription struct for database storage
type PushSubscription struct {
    ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
    UserID    primitive.ObjectID `bson:"userId" json:"userId"`
    Endpoint  string             `bson:"endpoint" json:"endpoint"`
    Keys      struct {
        P256dh string `bson:"p256dh" json:"p256dh"`
        Auth   string `bson:"auth" json:"auth"`
    } `bson:"keys" json:"keys"`
    CreatedAt int64 `bson:"createdAt" json:"createdAt"`
}

// SetWebSocketManager sets the global WebSocket manager
func SetWebSocketManager(manager *websocket.Manager) {
    wsManager = manager
}

// ReadinessCheck checks if the service is ready to handle requests
func ReadinessCheck(c *gin.Context) {
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    defer cancel()

    // Check database connection
    if database.Client == nil {
        c.JSON(503, gin.H{
            "status": "not ready",
            "checks": gin.H{
                "database": "disconnected",
            },
        })
        return
    }

    if err := database.Client.Ping(ctx, nil); err != nil {
        c.JSON(503, gin.H{
            "status": "not ready",
            "checks": gin.H{
                "database": "unhealthy",
                "error":    err.Error(),
            },
        })
        return
    }

    c.JSON(200, gin.H{
        "status": "ready",
        "checks": gin.H{
            "database": "healthy",
        },
    })
}
