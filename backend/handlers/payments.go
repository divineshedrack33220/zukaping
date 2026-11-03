package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode"

	"coded/database"
	"coded/models"
	"coded/pkg/seerbit"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const paymentsProvider = "seerbit"

func paymentsColl() *mongo.Collection {
	return database.Client.Database("coded").Collection("payments")
}

func purchasesColl() *mongo.Collection {
	return database.Client.Database("coded").Collection("content_purchases")
}

// newPaymentReference is ours, not the payer's: it is the only key both the query
// endpoint and the webhook agree on, so it must be unguessable and unique.
func newPaymentReference() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("zk%d", time.Now().UnixNano())
	}
	return "zk" + hex.EncodeToString(buf)
}

// publicOrigin rebuilds the URL the payer should fly back to. Seerbit only ever
// needs an absolute address, and behind Render the scheme and host live in headers.
func publicOrigin(c *gin.Context) string {
	scheme := "https"
	if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if c.Request.TLS == nil && strings.HasPrefix(c.Request.Host, "localhost") {
		scheme = "http"
	}
	return scheme + "://" + c.Request.Host
}

// exclusiveImage locates the creator that owns a profile image.
func exclusiveImage(ctx context.Context, imageID primitive.ObjectID) (models.User, models.ProfileImage, error) {
	var creator models.User
	err := database.Client.Database("coded").Collection("users").
		FindOne(ctx, bson.M{"profile_images._id": imageID}).Decode(&creator)
	if err != nil {
		return creator, models.ProfileImage{}, err
	}
	for _, img := range creator.ProfileImages {
		if img.ID == imageID {
			return creator, img, nil
		}
	}
	return creator, models.ProfileImage{}, mongo.ErrNoDocuments
}

// settlePayment records the paid unlock once. Both the return-from-checkout path
// and the webhook call it, and a second call must not double-charge or double-write.
func settlePayment(ctx context.Context, payment bson.M, charge *seerbit.Payment) error {
	buyerID, _ := primitive.ObjectIDFromHex(documentString(payment, "user_id"))
	imageID, _ := primitive.ObjectIDFromHex(documentString(payment, "image_id"))
	creatorID, _ := primitive.ObjectIDFromHex(documentString(payment, "creator_id"))
	price := documentFloat(payment, "amount")
	currency := documentString(payment, "currency")

	if buyerID.IsZero() || imageID.IsZero() {
		return errors.New("payment record is missing its buyer or image")
	}

	settledAt := time.Now()
	set := bson.M{
		"status":     "settled",
		"settled_at": settledAt,
		"updated_at": settledAt,
	}
	// The gateway answer that authorised the unlock is kept next to the money it
	// approved, so a later dispute has something to read.
	if charge != nil {
		set["gateway_code"] = charge.Code
		set["gateway_message"] = charge.Message
		set["provider_mode"] = charge.Mode
	}
	_, err := paymentsColl().UpdateOne(ctx, bson.M{"_id": payment["_id"]}, bson.M{"$set": set})
	if err != nil {
		return err
	}

	purchase := models.ContentPurchase{
		ID:        primitive.NewObjectID(),
		BuyerID:   buyerID,
		CreatorID: creatorID,
		ImageID:   imageID,
		Price:     price,
		Currency:  currency,
		Status:    "completed",
		CreatedAt: settledAt,
	}
	if _, err := purchasesColl().InsertOne(ctx, purchase); err != nil && !mongo.IsDuplicateKeyError(err) {
		return err
	}
	return nil
}

// gatewayPayerName gives the provider the name shape it insists on: Seerbit rejects
// digits in a full name and rejects a single word with no surname, while a profile
// saved from a phone often holds exactly that.
func gatewayPayerName(candidates ...string) string {
	seen := make(map[string]bool)
	var words []string
	for _, candidate := range candidates {
		for _, word := range strings.Fields(sanitizePayerName(candidate)) {
			key := strings.ToLower(word)
			if seen[key] {
				continue
			}
			seen[key] = true
			words = append(words, word)
		}
	}
	switch len(words) {
	case 0:
		return "Zukaping Customer"
	case 1:
		return words[0] + " Customer"
	default:
		return words[0] + " " + words[1]
	}
}

func sanitizePayerName(raw string) string {
	var b strings.Builder
	for _, r := range strings.TrimSpace(raw) {
		switch r {
		case '.', '-', '\'', ' ':
			b.WriteRune(r)
		default:
			// Marks are kept separate from letters because a combining accent is
			// its own category, and Igbo and Yoruba names rely on them.
			if unicode.IsLetter(r) || unicode.IsMark(r) {
				b.WriteRune(r)
			}
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func documentString(doc bson.M, key string) string {
	v, ok := doc[key]
	if !ok {
		return ""
	}
	if oid, ok := v.(primitive.ObjectID); ok {
		return oid.Hex()
	}
	return fmt.Sprintf("%v", v)
}

func documentFloat(doc bson.M, key string) float64 {
	switch v := doc[key].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	default:
		return 0
	}
}

// StartPayment opens a Seerbit transaction for one exclusive image and hands back
// the hosted checkout URL. The client navigates there; nothing is unlocked yet.
func StartPayment(c *gin.Context) {
	if !seerbit.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Payments are not configured on this server"})
		return
	}

	var body struct {
		ImageID string `json:"imageId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "imageId is required"})
		return
	}
	imageID, err := primitive.ObjectIDFromHex(strings.TrimSpace(body.ImageID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid image ID"})
		return
	}

	buyerID, err := primitive.ObjectIDFromHex(c.GetString("userId"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	var buyer models.User
	if err := database.Client.Database("coded").Collection("users").
		FindOne(ctx, bson.M{"_id": buyerID}).Decode(&buyer); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Your account could not be loaded"})
		return
	}

	creator, img, err := exclusiveImage(ctx, imageID)
	if err == mongo.ErrNoDocuments {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exclusive content not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if creator.ID == buyerID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot buy your own content"})
		return
	}
	if !img.IsExclusive || img.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This content is not for sale"})
		return
	}

	paid, err := purchasesColl().CountDocuments(ctx, bson.M{
		"buyer_id": buyerID, "image_id": imageID, "status": "completed",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if paid > 0 {
		c.JSON(http.StatusOK, gin.H{"status": "already_unlocked", "unlocked": true})
		return
	}

	currency := img.Currency
	if currency == "" {
		currency = "NGN"
	}
	reference := newPaymentReference()
	name := gatewayPayerName(buyer.Name, buyer.Username)

	charge, err := seerbit.Init(ctx, seerbit.InitRequest{
		Amount:      img.Price,
		Currency:    currency,
		Country:     "NG",
		Reference:   reference,
		Email:       buyer.Email,
		FullName:    name,
		Description: "Unlock exclusive content on Zukaping",
		// Back to the very profile the payer was looking at, with the reference
		// so the page can ask the gateway what happened.
		CallbackURL: publicOrigin(c) + "/view-profile/" + creator.ID.Hex() + "?payment=" + reference,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Could not start the payment: " + err.Error()})
		return
	}

	now := time.Now()
	record := models.Payment{
		ID:          primitive.NewObjectID(),
		UserID:      buyerID,
		ImageID:     imageID,
		CreatorID:   creator.ID,
		Amount:      img.Price,
		Currency:    currency,
		Country:     "NG",
		Reference:   reference,
		Status:      "initiated",
		Provider:    paymentsProvider,
		RedirectURL: charge.RedirectURL,
		PayerEmail:  buyer.Email,
		PayerName:   name,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if _, err := paymentsColl().InsertOne(ctx, record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record the payment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "initiated",
		"reference":   reference,
		"redirectUrl": charge.RedirectURL,
		"amount":      img.Price,
		"currency":    currency,
	})
}

// verifyPayment asks the provider what happened and unlocks if it says paid.
func verifyPayment(ctx context.Context, reference string) (bson.M, bool, error) {
	var payment bson.M
	err := paymentsColl().FindOne(ctx, bson.M{"reference": reference}).Decode(&payment)
	if err != nil {
		return nil, false, err
	}
	if documentString(payment, "status") == "settled" {
		return payment, true, nil
	}

	charge, err := seerbit.Query(ctx, reference)
	if err != nil {
		return payment, false, err
	}
	if !seerbit.Settled(charge, documentFloat(payment, "amount"), documentString(payment, "currency")) {
		_, _ = paymentsColl().UpdateOne(ctx, bson.M{"_id": payment["_id"]}, bson.M{"$set": bson.M{
			"gateway_code":    charge.Code,
			"gateway_message": charge.Message,
			"provider_mode":   charge.Mode,
			"updated_at":      time.Now(),
		}})
		return payment, false, nil
	}
	if err := settlePayment(ctx, payment, charge); err != nil {
		return payment, false, err
	}
	payment["status"] = "settled"
	return payment, true, nil
}

// PaymentStatus reports one payment to the client that opened it.
func PaymentStatus(c *gin.Context) {
	buyerID, err := primitive.ObjectIDFromHex(c.GetString("userId"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}
	reference := strings.TrimSpace(c.Param("reference"))
	if reference == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown payment"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	filter := bson.M{"reference": reference, "user_id": buyerID}
	var payment bson.M
	if err := paymentsColl().FindOne(ctx, filter).Decode(&payment); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	_, settled, err := verifyPayment(ctx, reference)
	status := documentString(payment, "status")
	if err != nil && status != "settled" {
		status = "pending"
	}
	if settled {
		status = "settled"
	}
	c.JSON(http.StatusOK, gin.H{"status": status, "unlocked": settled, "reference": reference})
}

// ReconcilePayments settles anything the payer finished while our tab was closed.
// Without registered webhooks this is what makes a paid unlock stick.
func ReconcilePayments(c *gin.Context) {
	if !seerbit.IsConfigured() {
		c.JSON(http.StatusOK, gin.H{"settled": 0, "checked": 0})
		return
	}
	buyerID, err := primitive.ObjectIDFromHex(c.GetString("userId"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Anything older than a day is abandoned; the gateway session has expired.
	since := time.Now().Add(-24 * time.Hour)
	cursor, err := paymentsColl().Find(ctx, bson.M{
		"user_id":    buyerID,
		"status":     "initiated",
		"created_at": bson.M{"$gte": since},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer cursor.Close(ctx)

	var pending []bson.M
	if err := cursor.All(ctx, &pending); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	settled := 0
	for _, payment := range pending {
		if _, ok, err := verifyPayment(ctx, documentString(payment, "reference")); err == nil && ok {
			settled++
		}
	}
	c.JSON(http.StatusOK, gin.H{"checked": len(pending), "settled": settled})
}

// SeerbitWebhook is the push channel. It is registered in the Seerbit dashboard,
// so it must stay safe to call at any rate: the signature decides trust, and the
// stored event ids make a replay do nothing.
func SeerbitWebhook(c *gin.Context) {
	raw, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unreadable body"})
		return
	}
	if !seerbit.VerifyWebhookSignature(raw, c.GetHeader("X-Webhook-Signature")) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	var payload struct {
		NotificationItems []struct {
			EventID   string `json:"eventId"`
			EventType string `json:"eventType"`
			Data      bson.M `json:"data"`
		} `json:"notificationItems"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		// Acknowledged anyway: a body we cannot parse will never become parseable,
		// and retrying it forever only hides the real problem in their logs.
		ackWebhook(c)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	for _, item := range payload.NotificationItems {
		reference := firstString(item.Data, "paymentReference", "reference", "merchantReference", "trxRef", "externalReference")
		if reference == "" {
			continue
		}
		if item.EventID != "" {
			count, err := paymentsColl().CountDocuments(ctx, bson.M{
				"reference":        reference,
				"processed_events": item.EventID,
			})
			if err == nil && count > 0 {
				continue
			}
		}
		if _, _, err := verifyPayment(ctx, reference); err != nil {
			continue
		}
		if item.EventID != "" {
			_, _ = paymentsColl().UpdateOne(ctx, bson.M{"reference": reference},
				bson.M{"$addToSet": bson.M{"processed_events": item.EventID}})
		}
	}

	ackWebhook(c)
}

// ackWebhook answers in the exact shape that stops Seerbit retrying.
func ackWebhook(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"ackReference": c.GetHeader("X-Expected-Ack-Reference"),
		"status":       "processed",
	})
}

func firstString(doc bson.M, keys ...string) string {
	for _, k := range keys {
		if v, ok := doc[k]; ok {
			if s := strings.TrimSpace(fmt.Sprintf("%v", v)); s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}
