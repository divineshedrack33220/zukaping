package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Room struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name           string             `bson:"name" json:"name"`
	Description    string             `bson:"description" json:"description"`
	AvatarURL      string             `bson:"avatar_url" json:"avatar_url"`
	Category       string             `bson:"category" json:"category"` // e.g., "social", "dating", "jobs"
	MaxMembers     int                `bson:"max_members" json:"max_members"`
	CurrentMembers int                `bson:"current_members" json:"current_members"`
	CreatedBy      string             `bson:"created_by" json:"created_by"` // "system" for all
	IsTrending     bool               `bson:"is_trending" json:"is_trending"`
	Tags           []string           `bson:"tags" json:"tags"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
}

type RoomMembership struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RoomID   primitive.ObjectID `bson:"room_id" json:"room_id"`
	UserID   primitive.ObjectID `bson:"user_id" json:"user_id"`
	JoinedAt time.Time          `bson:"joined_at" json:"joined_at"`
	IsActive bool               `bson:"is_active" json:"is_active"`
}
