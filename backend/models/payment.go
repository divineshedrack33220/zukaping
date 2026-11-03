package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Payment is one attempted charge. It outlives the gateway session so a payer who
// closes the tab can still be reconciled, and so a webhook replay can be deduped.
type Payment struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	ImageID   primitive.ObjectID `bson:"image_id" json:"image_id"`
	CreatorID primitive.ObjectID `bson:"creator_id" json:"creator_id"`

	Amount   float64 `bson:"amount" json:"amount"`
	Currency string  `bson:"currency" json:"currency"`
	Country  string  `bson:"country" json:"country"`

	// Reference is ours, sent to the gateway as paymentReference and used to
	// query the outcome. It is never generated from user input.
	Reference string `bson:"reference" json:"reference"`

	Status string `bson:"status" json:"status"` // initiated, settled, failed

	Provider        string   `bson:"provider" json:"provider"` // "seerbit"
	RedirectURL     string   `bson:"redirect_url,omitempty" json:"redirect_url,omitempty"`
	GatewayCode     string   `bson:"gateway_code,omitempty" json:"gateway_code,omitempty"`
	GatewayMessage  string   `bson:"gateway_message,omitempty" json:"gateway_message,omitempty"`
	ProviderMode    string   `bson:"provider_mode,omitempty" json:"provider_mode,omitempty"`
	PayerEmail      string   `bson:"payer_email,omitempty" json:"payer_email,omitempty"`
	PayerName       string   `bson:"payer_name,omitempty" json:"payer_name,omitempty"`
	ProcessedEvents []string `bson:"processed_events,omitempty" json:"-"`

	CreatedAt time.Time  `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time  `bson:"updated_at" json:"updated_at"`
	SettledAt *time.Time `bson:"settled_at,omitempty" json:"settled_at,omitempty"`
}
