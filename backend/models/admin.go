package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AdminAuditLog records every administrative action for accountability.
type AdminAuditLog struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	AdminID     primitive.ObjectID `bson:"adminId" json:"adminId"`
	AdminEmail  string             `bson:"adminEmail" json:"adminEmail"`
	Action      string             `bson:"action" json:"action"` // e.g. "suspend_user", "delete_post"
	TargetType  string             `bson:"targetType" json:"targetType"`
	TargetID    string             `bson:"targetId" json:"targetId"`
	Details     string             `bson:"details,omitempty" json:"details,omitempty"`
	IPAddress   string             `bson:"ipAddress,omitempty" json:"ipAddress,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
}
