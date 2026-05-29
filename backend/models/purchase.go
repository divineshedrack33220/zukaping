package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ContentPurchase struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	BuyerID   primitive.ObjectID `bson:"buyer_id" json:"buyer_id"`
	CreatorID primitive.ObjectID `bson:"creator_id" json:"creator_id"`
	ImageID   primitive.ObjectID `bson:"image_id" json:"image_id"`
	Price     float64            `bson:"price" json:"price"`
	Currency  string             `bson:"currency" json:"currency"`
	Status    string             `bson:"status" json:"status"` // "pending", "completed", "failed"
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}
