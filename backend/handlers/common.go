package handlers

import (
    "coded/websocket"
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
