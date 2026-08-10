package models

import "go.mongodb.org/mongo-driver/bson/primitive"

// Report is a user-flagged piece of content or a user account awaiting moderation.
type Report struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ReporterID primitive.ObjectID `bson:"reporterId" json:"reporterId"`
	TargetType string             `bson:"targetType" json:"targetType"` // "user", "post", "message", "chat", "room"
	TargetID   primitive.ObjectID `bson:"targetId" json:"targetId"`
	Reason     string             `bson:"reason" json:"reason"`
	Details    string             `bson:"details,omitempty" json:"details,omitempty"`
	Status     string             `bson:"status" json:"status"` // "open", "resolved", "dismissed"
	Resolution string             `bson:"resolution,omitempty" json:"resolution,omitempty"`
	ResolvedBy primitive.ObjectID `bson:"resolvedBy,omitempty" json:"resolvedBy,omitempty"`
	ResolvedAt int64              `bson:"resolvedAt,omitempty" json:"resolvedAt,omitempty"`
	CreatedAt  int64              `bson:"createdAt" json:"createdAt"`
}

// Announcement is a broadcast message pushed to users via web push.
type Announcement struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title     string             `bson:"title" json:"title"`
	Body      string             `bson:"body" json:"body"`
	Audience  string             `bson:"audience" json:"audience"` // "all"
	CreatedBy primitive.ObjectID `bson:"createdBy" json:"createdBy"`
	SentCount int                `bson:"sentCount,omitempty" json:"sentCount,omitempty"`
	CreatedAt int64              `bson:"createdAt" json:"createdAt"`
}
