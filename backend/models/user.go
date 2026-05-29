package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ProfileImage struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	URL          string             `bson:"url" json:"url"`
	ThumbnailURL string             `bson:"thumbnail_url" json:"thumbnail_url"`
	IsExclusive  bool               `bson:"is_exclusive" json:"is_exclusive"`
	Price        float64            `bson:"price" json:"price"`
	Currency     string             `bson:"currency" json:"currency"`
	BlurHash     string             `bson:"blur_hash" json:"blur_hash"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
}

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash *string            `bson:"passwordHash,omitempty" json:"-"`
	AuthProvider string             `bson:"authProvider" json:"authProvider"`
	GoogleID     *string            `bson:"googleId,omitempty" json:"-"`
	CreatedAt    int64              `bson:"createdAt" json:"createdAt"`
	
	// Profile fields
	Username     string   `bson:"username" json:"username"`
	Name         string   `bson:"name" json:"name"`
	Avatar       string   `bson:"avatar" json:"avatar"`
	Bio          string   `bson:"bio" json:"bio"`
	Gender       string   `bson:"gender" json:"gender"`
	InterestedIn []string `bson:"interestedIn" json:"interestedIn"`
	Photos       []string `bson:"photos" json:"photos"`
	Status       string   `bson:"status" json:"status"`
	
	Latitude     *float64 `bson:"latitude,omitempty" json:"latitude,omitempty"`
	Longitude    *float64 `bson:"longitude,omitempty" json:"longitude,omitempty"`
	
	BirthDate    int64 `bson:"birthDate" json:"birthDate"`
	LastSeen     int64 `bson:"lastSeen" json:"lastSeen"`
	
	// NEW: Referral system
	ReferralCode string `bson:"referralCode,omitempty" json:"referralCode"`

	// Privacy
	BlockedUsers []primitive.ObjectID `bson:"blockedUsers,omitempty" json:"blockedUsers,omitempty"`

	// Exclusive content
	ProfileImages []ProfileImage `bson:"profile_images,omitempty" json:"profile_images,omitempty"`
}