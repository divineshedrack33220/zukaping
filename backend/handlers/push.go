package handlers

import (
    "context"
    "encoding/json"
    "log"
    "net/http"
    "os"
    "time"

    "coded/database"

    "github.com/gin-gonic/gin"
    "github.com/SherClockHolmes/webpush-go"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

// InitVAPIDKeys initializes VAPID keys from environment or generates new ones
func InitVAPIDKeys() {
    // Initialize VAPID keys if not set in environment
    if os.Getenv("VAPID_PUBLIC_KEY") == "" || os.Getenv("VAPID_PRIVATE_KEY") == "" {
        publicKey, privateKey, err := webpush.GenerateVAPIDKeys()
        if err != nil {
            log.Printf("Failed to generate VAPID keys: %v", err)
            return
        }
        
        // Store in environment (for development only)
        os.Setenv("VAPID_PUBLIC_KEY", publicKey)
        vapidPrivateKey = privateKey
        
        log.Println("⚠️  Generated new VAPID keys - for production, set these as environment variables:")
        log.Printf("   VAPID_PUBLIC_KEY: %s", publicKey)
        log.Printf("   VAPID_PRIVATE_KEY: %s", privateKey)
    } else {
        vapidPrivateKey = os.Getenv("VAPID_PRIVATE_KEY")
        log.Println("✅ VAPID keys loaded from environment")
    }
}

func GetVapidPublicKey(c *gin.Context) {
    publicKey := os.Getenv("VAPID_PUBLIC_KEY")
    if publicKey == "" {
        c.JSON(http.StatusOK, gin.H{
            "error":   "VAPID public key not configured",
            "message": "Contact administrator",
        })
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "publicKey": publicKey,
        "message":   "VAPID public key retrieved successfully",
    })
}

func SubscribePush(c *gin.Context) {
    var req struct {
        Endpoint string `json:"endpoint" binding:"required"`
        Keys     struct {
            P256dh string `json:"p256dh" binding:"required"`
            Auth   string `json:"auth" binding:"required"`
        } `json:"keys" binding:"required"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    userIDStr := c.GetString("userId")
    userID, err := primitive.ObjectIDFromHex(userIDStr)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    subsColl := database.Client.Database("coded").Collection("subscriptions")

    pushSub := PushSubscription{
        ID:        primitive.NewObjectID(),
        UserID:    userID,
        Endpoint:  req.Endpoint,
        CreatedAt: time.Now().Unix(),
    }
    pushSub.Keys.P256dh = req.Keys.P256dh
    pushSub.Keys.Auth = req.Keys.Auth

    // Upsert: update if exists, insert if not
    _, err = subsColl.UpdateOne(
        ctx,
        bson.M{"userId": userID},
        bson.M{"$set": pushSub},
        options.Update().SetUpsert(true),
    )

    if err != nil {
        log.Printf("Failed to save subscription: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save subscription"})
        return
    }

    log.Printf("Push subscription saved for user: %s", userID.Hex())
    c.JSON(http.StatusOK, gin.H{
        "message": "Push subscription saved successfully",
        "userId":  userID.Hex(),
    })
}

// Helper function to send push notification
func SendPushNotification(userID primitive.ObjectID, title, body, icon string) {
    go func() {
        defer func() {
            if r := recover(); r != nil {
                log.Printf("Panic in push notification: %v", r)
            }
        }()

        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()

        subsColl := database.Client.Database("coded").Collection("subscriptions")

        var sub PushSubscription
        err := subsColl.FindOne(ctx, bson.M{"userId": userID}).Decode(&sub)
        if err == mongo.ErrNoDocuments {
            log.Printf("No push subscription found for user: %s", userID.Hex())
            return
        }
        if err != nil {
            log.Printf("Failed to find subscription for user %s: %v", userID.Hex(), err)
            return
        }

        // Create webpush subscription from our stored data
        webpushSub := &webpush.Subscription{
            Endpoint: sub.Endpoint,
            Keys: webpush.Keys{
                P256dh: sub.Keys.P256dh,
                Auth:   sub.Keys.Auth,
            },
        }

        payload := map[string]interface{}{
            "title": title,
            "body":  body,
            "icon":  icon,
            "data": map[string]interface{}{
                "url":       "/chats.html",
                "timestamp": time.Now().Unix(),
            },
        }

        payloadBytes, err := json.Marshal(payload)
        if err != nil {
            log.Printf("Failed to marshal push payload: %v", err)
            return
        }

        // Send push
        resp, err := webpush.SendNotification(payloadBytes, webpushSub, &webpush.Options{
            Subscriber:      "mailto:admin@coded.com",
            VAPIDPrivateKey: vapidPrivateKey,
            TTL:             30,
        })

        if err != nil {
            log.Printf("Failed to send push notification to user %s: %v", userID.Hex(), err)

            // If subscription is invalid (410), delete it
            if resp != nil && resp.StatusCode == 410 {
                log.Printf("Push subscription expired for user %s, deleting...", userID.Hex())
                _, delErr := subsColl.DeleteOne(ctx, bson.M{"userId": userID})
                if delErr != nil {
                    log.Printf("Failed to delete expired subscription: %v", delErr)
                }
            }
            return
        }

        log.Printf("Push notification sent successfully to user: %s", userID.Hex())
        if resp != nil {
            resp.Body.Close()
        }
    }()
}

// BroadcastPushNotification sends a push notification to every subscribed user.
func BroadcastPushNotification(title, body string) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic in broadcast push notification: %v", r)
			}
		}()

		if database.Client == nil {
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		subsColl := database.Client.Database("coded").Collection("subscriptions")

		cursor, err := subsColl.Find(ctx, bson.M{})
		if err != nil {
			log.Printf("Failed to list subscriptions for broadcast: %v", err)
			return
		}
		defer cursor.Close(ctx)

		var subs []PushSubscription
		if err := cursor.All(ctx, &subs); err != nil {
			log.Printf("Failed to decode subscriptions for broadcast: %v", err)
			return
		}

		payload := map[string]interface{}{
			"title": title,
			"body":  body,
			"icon":  "",
			"data": map[string]interface{}{
				"url":       "/",
				"timestamp": time.Now().Unix(),
			},
		}
		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			return
		}

		sent, expired := 0, 0
		for _, sub := range subs {
			if sub.Endpoint == "" {
				continue
			}
			webpushSub := &webpush.Subscription{
				Endpoint: sub.Endpoint,
				Keys: webpush.Keys{
					P256dh: sub.Keys.P256dh,
					Auth:   sub.Keys.Auth,
				},
			}

			resp, err := webpush.SendNotification(payloadBytes, webpushSub, &webpush.Options{
				Subscriber:      "mailto:admin@coded.com",
				VAPIDPrivateKey: vapidPrivateKey,
				TTL:             60,
			})
			if err != nil {
				if resp != nil && resp.StatusCode == 410 {
					expired++
					_, _ = subsColl.DeleteOne(ctx, bson.M{"_id": sub.ID})
				}
				continue
			}
			if resp != nil {
				resp.Body.Close()
			}
			sent++
		}

		log.Printf("Broadcast push complete: %d sent, %d expired", sent, expired)
	}()
}

// SendMessagePush sends push notification for new messages
func SendMessagePush(senderID, receiverID primitive.ObjectID, messageContent string, senderName string) {
    if senderName == "" {
        senderName = "Someone"
    }

    title := senderName + " sent a message"
    body := messageContent

    // Truncate long messages
    if len(body) > 100 {
        body = body[:100] + "..."
    }

    SendPushNotification(receiverID, title, body, "")
}

// SendMatchPush sends push notification for new matches
func SendMatchPush(userID primitive.ObjectID, matchedUserName string) {
    title := "New match! 🎉"
    body := "You matched with " + matchedUserName
    SendPushNotification(userID, title, body, "")
}

// SendPostAcceptedPush sends push notification when someone accepts your post
func SendPostAcceptedPush(userID primitive.ObjectID, acceptorName string) {
    title := "Request accepted! 🤝"
    body := acceptorName + " accepted your request"
    SendPushNotification(userID, title, body, "")
}

// SendNewChatPush sends push notification for new chat creation
func SendNewChatPush(userID primitive.ObjectID, chatPartnerName string) {
    title := "New chat started 💬"
    body := "You started a chat with " + chatPartnerName
    SendPushNotification(userID, title, body, "")
}
