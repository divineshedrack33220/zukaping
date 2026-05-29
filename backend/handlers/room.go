package handlers

import (
	"context"
	"log"
	"net/http"
	"time"

	"coded/database"
	"coded/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ListRooms lists all available rooms for discovery
func ListRooms(c *gin.Context) {
	userIDStr := c.GetString("userId")
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	category := c.Query("category")
	trending := c.Query("trending")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	roomsColl := database.Client.Database("coded").Collection("rooms")
	membershipsColl := database.Client.Database("coded").Collection("room_memberships")

	// Build filter query
	filter := bson.M{}
	if category != "" {
		filter["category"] = category
	}
	if trending == "true" {
		filter["is_trending"] = true
	}

	// Fetch all matching rooms
	cursor, err := roomsColl.Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}
	defer cursor.Close(ctx)

	var rooms []models.Room
	if err := cursor.All(ctx, &rooms); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode rooms"})
		return
	}

	// Fetch user's active memberships
	memCursor, err := membershipsColl.Find(ctx, bson.M{"user_id": userID, "is_active": true})
	joinedRooms := make(map[primitive.ObjectID]bool)
	if err == nil {
		var memberships []models.RoomMembership
		if err := memCursor.All(ctx, &memberships); err == nil {
			for _, m := range memberships {
				joinedRooms[m.RoomID] = true
			}
		}
		memCursor.Close(ctx)
	}

	// Map to response format including is_joined
	response := make([]map[string]interface{}, len(rooms))
	for i, room := range rooms {
		isJoined := joinedRooms[room.ID]
		isFull := room.CurrentMembers >= room.MaxMembers

		response[i] = map[string]interface{}{
			"id":              room.ID.Hex(),
			"name":            room.Name,
			"description":     room.Description,
			"avatar_url":      room.AvatarURL,
			"category":        room.Category,
			"max_members":     room.MaxMembers,
			"current_members": room.CurrentMembers,
			"created_by":      room.CreatedBy,
			"is_trending":     room.IsTrending,
			"tags":            room.Tags,
			"is_joined":       isJoined,
			"is_full":         isFull,
			"created_at":      room.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"rooms": response,
		"total": len(response),
	})
}

// GetRoomDetails returns detailed room info including last 3 messages as a preview
func GetRoomDetails(c *gin.Context) {
	roomIDStr := c.Param("id")
	roomID, err := primitive.ObjectIDFromHex(roomIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
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

	roomsColl := database.Client.Database("coded").Collection("rooms")
	membershipsColl := database.Client.Database("coded").Collection("room_memberships")
	messagesColl := database.Client.Database("coded").Collection("messages")

	// Get room details
	var room models.Room
	err = roomsColl.FindOne(ctx, bson.M{"_id": roomID}).Decode(&room)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	// Check if user is active member
	var membership models.RoomMembership
	isJoined := false
	err = membershipsColl.FindOne(ctx, bson.M{"room_id": roomID, "user_id": userID, "is_active": true}).Decode(&membership)
	if err == nil {
		isJoined = true
	}

	// Fetch last 3 messages for preview (aggregate to join sender name)
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{{Key: "chatId", Value: roomID}}}},
		{{Key: "$sort", Value: bson.D{{Key: "createdAt", Value: -1}}}},
		{{Key: "$limit", Value: 3}},
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: "users"},
			{Key: "localField", Value: "senderId"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "senderProfile"},
		}}},
		{{Key: "$unwind", Value: bson.D{
			{Key: "path", Value: "$senderProfile"},
			{Key: "preserveNullAndEmptyArrays", Value: true},
		}}},
	}

	cursor, err := messagesColl.Aggregate(ctx, pipeline)
	var previewMessages []map[string]interface{}
	if err == nil {
		var rawMessages []bson.M
		if err := cursor.All(ctx, &rawMessages); err == nil {
			// Reverse order to make it chronological (oldest to newest)
			for i := len(rawMessages) - 1; i >= 0; i-- {
				m := rawMessages[i]
				senderName := "System"
				if profile, ok := m["senderProfile"].(bson.M); ok && profile != nil {
					if name, ok := profile["name"].(string); ok {
						senderName = name
					}
				} else if m["type"] == "system" {
					senderName = "System"
				}

				// Safe-cast _id
				msgIDStr := ""
				if oid, ok := m["_id"].(primitive.ObjectID); ok {
					msgIDStr = oid.Hex()
				}

				previewMessages = append(previewMessages, map[string]interface{}{
					"id":          msgIDStr,
					"sender_name": senderName,
					"content":     m["content"],
					"type":        m["type"],
					"created_at":  m["createdAt"],
				})
			}
		}
		cursor.Close(ctx)
	}

	isFull := room.CurrentMembers >= room.MaxMembers

	c.JSON(http.StatusOK, gin.H{
		"room": map[string]interface{}{
			"id":              room.ID.Hex(),
			"name":            room.Name,
			"description":     room.Description,
			"avatar_url":      room.AvatarURL,
			"category":        room.Category,
			"max_members":     room.MaxMembers,
			"current_members": room.CurrentMembers,
			"created_by":      room.CreatedBy,
			"is_trending":     room.IsTrending,
			"tags":            room.Tags,
			"is_joined":       isJoined,
			"is_full":         isFull,
			"created_at":      room.CreatedAt,
		},
		"preview_messages": previewMessages,
		"member_count":     room.CurrentMembers,
		"is_joined":        isJoined,
	})
}

// JoinRoom lets an authenticated user join a public room
func JoinRoom(c *gin.Context) {
	roomIDStr := c.Param("id")
	roomID, err := primitive.ObjectIDFromHex(roomIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	userIDStr := c.GetString("userId")
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	roomsColl := database.Client.Database("coded").Collection("rooms")
	chatsColl := database.Client.Database("coded").Collection("chats")
	membershipsColl := database.Client.Database("coded").Collection("room_memberships")
	usersColl := database.Client.Database("coded").Collection("users")

	// Get the User details (to send a "joined" system message)
	var currentUser models.User
	err = usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&currentUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve user profile"})
		return
	}

	// Verify room exists
	var room models.Room
	err = roomsColl.FindOne(ctx, bson.M{"_id": roomID}).Decode(&room)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	// Verify existing membership
	var existingMembership models.RoomMembership
	err = membershipsColl.FindOne(ctx, bson.M{"room_id": roomID, "user_id": userID}).Decode(&existingMembership)
	
	if err == nil && existingMembership.IsActive {
		// User is already an active member
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"room_id":   roomID.Hex(),
			"message":   "Already a member of this room",
			"joined_at": existingMembership.JoinedAt,
		})
		return
	}

	// Check user total active joined rooms (limit of 5)
	activeCount, countErr := membershipsColl.CountDocuments(ctx, bson.M{"user_id": userID, "is_active": true})
	if countErr == nil && activeCount >= 5 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Room limit reached. You can join at most 5 rooms at a time.",
		})
		return
	}

	// Check capacity
	if room.CurrentMembers >= room.MaxMembers {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room is full. Capacity reached."})
		return
	}

	joinedAt := time.Now()

	// Update or Insert membership
	if err == mongo.ErrNoDocuments {
		// Create new membership
		newMembership := models.RoomMembership{
			ID:       primitive.NewObjectID(),
			RoomID:   roomID,
			UserID:   userID,
			JoinedAt: joinedAt,
			IsActive: true,
		}
		_, err = membershipsColl.InsertOne(ctx, newMembership)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create membership"})
			return
		}
	} else {
		// Update existing deactivated membership
		_, err = membershipsColl.UpdateOne(
			ctx,
			bson.M{"_id": existingMembership.ID},
			bson.M{"$set": bson.M{"is_active": true, "joined_at": joinedAt}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update membership"})
			return
		}
	}

	// Atomically increment current members count
	_, err = roomsColl.UpdateOne(ctx, bson.M{"_id": roomID}, bson.M{"$inc": bson.M{"current_members": 1}})
	if err != nil {
		log.Printf("⚠️ Failed to increment current_members: %v", err)
	}

	// Add user to the mirror Chat participants
	_, err = chatsColl.UpdateOne(
		ctx,
		bson.M{"_id": roomID},
		bson.M{
			"$addToSet": bson.M{"participants": userID},
			"$set":      bson.M{"lastMessageAt": time.Now().Unix()},
		},
	)
	if err != nil {
		log.Printf("⚠️ Failed to update mirror chat participants: %v", err)
	}

	// Create and insert system message for user joined
	systemMsg := models.Message{
		ID:        primitive.NewObjectID(),
		ChatID:    roomID,
		SenderID:  primitive.NilObjectID, // Nil for system messages
		Content:   currentUser.Name + " joined",
		Type:      "system",
		IsRead:    false,
		CreatedAt: time.Now().Unix(),
	}
	messagesColl := database.Client.Database("coded").Collection("messages")
	_, _ = messagesColl.InsertOne(ctx, systemMsg)

	// Broadcast member count update over WebSocket
	if wsManager != nil {
		// Broadcast presence/member count change
		wsManager.BroadcastRoomUpdate(map[string]interface{}{
			"roomId":         roomID.Hex(),
			"currentMembers": room.CurrentMembers + 1,
			"isTrending":     room.IsTrending || (room.CurrentMembers+1) >= 10,
		})

		// Broadcast standard new system message to active listeners
		wsManager.BroadcastNewMessage(map[string]interface{}{
			"id":        systemMsg.ID.Hex(),
			"chatId":    systemMsg.ChatID.Hex(),
			"senderId":  systemMsg.SenderID.Hex(),
			"sender": map[string]interface{}{
				"id":     "",
				"name":   "System",
				"avatar": fallbackAvatar,
			},
			"content":   systemMsg.Content,
			"type":      systemMsg.Type,
			"isRead":    systemMsg.IsRead,
			"createdAt": systemMsg.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"room_id":   roomID.Hex(),
		"joined_at": joinedAt,
	})
}

// LeaveRoom lets an authenticated user leave a joined room
func LeaveRoom(c *gin.Context) {
	roomIDStr := c.Param("id")
	roomID, err := primitive.ObjectIDFromHex(roomIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	userIDStr := c.GetString("userId")
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	roomsColl := database.Client.Database("coded").Collection("rooms")
	chatsColl := database.Client.Database("coded").Collection("chats")
	membershipsColl := database.Client.Database("coded").Collection("room_memberships")
	usersColl := database.Client.Database("coded").Collection("users")

	// Get User details
	var currentUser models.User
	err = usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&currentUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve user profile"})
		return
	}

	// Verify membership exists and is active
	var membership models.RoomMembership
	err = membershipsColl.FindOne(ctx, bson.M{"room_id": roomID, "user_id": userID, "is_active": true}).Decode(&membership)
	if err == nil {
		// Set membership to inactive
		_, err = membershipsColl.UpdateOne(
			ctx,
			bson.M{"_id": membership.ID},
			bson.M{"$set": bson.M{"is_active": false}},
		)
		if err != nil {
			log.Printf("⚠️ Failed to deactivate membership: %v", err)
		}
	} else {
		log.Printf("⚠️ No active room membership found for room %s and user %s, proceeding with graceful participants cleanup...", roomID.Hex(), userID.Hex())
	}

	// Decrement room current members atomically (cap at 0 minimum)
	var room models.Room
	newCount := 0
	if err := roomsColl.FindOne(ctx, bson.M{"_id": roomID}).Decode(&room); err == nil {
		newCount = room.CurrentMembers - 1
		if newCount < 0 {
			newCount = 0
		}
		if _, updateErr := roomsColl.UpdateOne(ctx, bson.M{"_id": roomID}, bson.M{"$set": bson.M{"current_members": newCount}}); updateErr != nil {
			log.Printf("⚠️ Failed to decrement current_members: %v", updateErr)
		}
	}

	// Remove user from mirror Chat participants
	_, err = chatsColl.UpdateOne(
		ctx,
		bson.M{"_id": roomID},
		bson.M{
			"$pull": bson.M{"participants": userID},
			"$set":  bson.M{"lastMessageAt": time.Now().Unix()},
		},
	)
	if err != nil {
		log.Printf("⚠️ Failed to update mirror chat participants: %v", err)
	}

	// Insert "left" system message
	systemMsg := models.Message{
		ID:        primitive.NewObjectID(),
		ChatID:    roomID,
		SenderID:  primitive.NilObjectID,
		Content:   currentUser.Name + " left",
		Type:      "system",
		IsRead:    false,
		CreatedAt: time.Now().Unix(),
	}
	messagesColl := database.Client.Database("coded").Collection("messages")
	_, _ = messagesColl.InsertOne(ctx, systemMsg)

	// Broadcast updates over WebSocket
	if wsManager != nil {
		wsManager.BroadcastRoomUpdate(map[string]interface{}{
			"roomId":         roomID.Hex(),
			"currentMembers": newCount, // use the validated, safe decremented count
			"isTrending":     room.IsTrending,
		})

		wsManager.BroadcastNewMessage(map[string]interface{}{
			"id":        systemMsg.ID.Hex(),
			"chatId":    systemMsg.ChatID.Hex(),
			"senderId":  systemMsg.SenderID.Hex(),
			"sender": map[string]interface{}{
				"id":     "",
				"name":   "System",
				"avatar": fallbackAvatar,
			},
			"content":   systemMsg.Content,
			"type":      systemMsg.Type,
			"isRead":    systemMsg.IsRead,
			"createdAt": systemMsg.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Successfully left the room",
	})
}

// StartAutoLeaveWorker runs a background job that regularly soft-removes inactive members from rooms
func StartAutoLeaveWorker() {
	log.Println("🧹 Auto-leave room inactivity worker initialized (checks every 24 hours)")
	
	// Run cleanup once on startup
	runInactivityCleanup()
	
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			runInactivityCleanup()
		}
	}()
}

func runInactivityCleanup() {
	log.Println("🧹 Running scheduled room inactivity cleanup (inactive for 7 days)...")
	ctx, cancel := context.WithTimeout(context.Background(), 2 * time.Minute)
	defer cancel()

	membershipsColl := database.Client.Database("coded").Collection("room_memberships")
	messagesColl := database.Client.Database("coded").Collection("messages")
	chatsColl := database.Client.Database("coded").Collection("chats")
	roomsColl := database.Client.Database("coded").Collection("rooms")

	// Find all active memberships
	cursor, err := membershipsColl.Find(ctx, bson.M{"is_active": true})
	if err != nil {
		log.Printf("❌ Failed to query memberships: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var memberships []models.RoomMembership
	if err := cursor.All(ctx, &memberships); err != nil {
		log.Printf("❌ Failed to decode memberships: %v", err)
		return
	}

	now := time.Now().Unix()
	sevenDaysAgo := now - (7 * 24 * 3600) // 7 days in seconds

	for _, m := range memberships {
		// Find last message sent by this user in this room
		var lastMsg models.Message
		opts := options.FindOne().SetSort(bson.M{"createdAt": -1})
		err := messagesColl.FindOne(ctx, bson.M{
			"chatId":   m.RoomID,
			"senderId": m.UserID,
		}, opts).Decode(&lastMsg)

		shouldDeactivate := false

		if err == mongo.ErrNoDocuments {
			// No messages sent by user. Check if joined more than 7 days ago
			if m.JoinedAt.Unix() < sevenDaysAgo {
				shouldDeactivate = true
			}
		} else if err == nil {
			// User has sent messages, check if last sent is more than 7 days ago
			if lastMsg.CreatedAt < sevenDaysAgo {
				shouldDeactivate = true
			}
		}

		if shouldDeactivate {
			log.Printf("🧹 Deactivating inactive membership for user %s in room %s", m.UserID.Hex(), m.RoomID.Hex())

			// Deactivate membership
			_, err = membershipsColl.UpdateOne(ctx, bson.M{"_id": m.ID}, bson.M{"$set": bson.M{"is_active": false}})
			if err != nil {
				continue
			}

			// Remove user from mirror Chat participants
			_, _ = chatsColl.UpdateOne(ctx, bson.M{"_id": m.RoomID}, bson.M{"$pull": bson.M{"participants": m.UserID}})

			// Decrement room count
			var room models.Room
			if err = roomsColl.FindOne(ctx, bson.M{"_id": m.RoomID}).Decode(&room); err == nil {
				newCount := room.CurrentMembers - 1
				if newCount < 0 {
					newCount = 0
				}
				_, _ = roomsColl.UpdateOne(ctx, bson.M{"_id": m.RoomID}, bson.M{"$set": bson.M{"current_members": newCount}})
			}

			// Insert system left message
			usersColl := database.Client.Database("coded").Collection("users")
			var user models.User
			if err = usersColl.FindOne(ctx, bson.M{"_id": m.UserID}).Decode(&user); err == nil {
				systemMsg := models.Message{
					ID:        primitive.NewObjectID(),
					ChatID:    m.RoomID,
					SenderID:  primitive.NilObjectID,
					Content:   user.Name + " left due to inactivity",
					Type:      "system",
					IsRead:    false,
					CreatedAt: time.Now().Unix(),
				}
				_, _ = messagesColl.InsertOne(ctx, systemMsg)
			}
		}
	}
	log.Println("🧹 Room inactivity cleanup complete.")
}
