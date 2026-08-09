package handlers

import (
	"context"
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

// enrichUsers loads user summaries for a set of user IDs and returns a map keyed by hex ID.
func enrichUsers(ctx context.Context, ids []primitive.ObjectID) map[string]gin.H {
	out := make(map[string]gin.H)
	if len(ids) == 0 {
		return out
	}

	cursor, err := database.DB.Collection("users").Find(ctx, bson.M{"_id": bson.M{"$in": ids}}, options.Find().SetProjection(bson.M{
		"passwordHash": 0, "googleId": 0, "blockedUsers": 0, "profile_images": 0,
	}))
	if err != nil {
		return out
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		return out
	}
	for _, u := range users {
		out[u.ID.Hex()] = userSummary(u)
	}
	return out
}

// AdminListPosts lists all posts with author info.
// Query params: search, category, limit, skip.
func AdminListPosts(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit, skip := parsePagingParams(c)

	filter := bson.M{}
	if q := c.Query("search"); q != "" {
		filter["content"] = bson.M{"$regex": escapeRegex(q), "$options": "i"}
	}
	if cat := c.Query("category"); cat != "" {
		filter["category"] = cat
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	postsColl := database.DB.Collection("posts")

	total, _ := postsColl.CountDocuments(ctx, filter)
	cursor, err := postsColl.Find(ctx, filter, options.Find().SetSort(bson.M{"createdAt": -1}).SetSkip(int64(skip)).SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch posts"})
		return
	}
	defer cursor.Close(ctx)

	var posts []models.Post
	if err := cursor.All(ctx, &posts); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode posts"})
		return
	}

	userIDs := make([]primitive.ObjectID, 0, len(posts))
	for _, p := range posts {
		userIDs = append(userIDs, p.UserID)
	}
	users := enrichUsers(ctx, userIDs)

	results := make([]gin.H, 0, len(posts))
	for _, p := range posts {
		u := users[p.UserID.Hex()]
		results = append(results, gin.H{
			"id":        p.ID.Hex(),
			"content":   p.Content,
			"media":     p.Media,
			"category":  p.Category,
			"createdAt": p.CreatedAt,
			"user":      u,
		})
	}

	c.JSON(http.StatusOK, gin.H{"posts": results, "total": total})
}

// AdminDeletePost deletes a single post.
func AdminDeletePost(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	postID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := database.DB.Collection("posts").DeleteOne(ctx, bson.M{"_id": postID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete post"})
		return
	}
	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	logAdminAction(c, "delete_post", "post", postID.Hex(), "")
	c.JSON(http.StatusOK, gin.H{"message": "Post deleted", "id": postID.Hex()})
}

// AdminListMessages lists recent messages, optionally filtered by chat.
// Query params: chatId, senderId, search, limit, skip.
func AdminListMessages(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit, skip := parsePagingParams(c)

	filter := bson.M{}
	if chatID := c.Query("chatId"); chatID != "" {
		if oid, err := primitive.ObjectIDFromHex(chatID); err == nil {
			filter["chatId"] = oid
		}
	}
	if senderID := c.Query("senderId"); senderID != "" {
		if oid, err := primitive.ObjectIDFromHex(senderID); err == nil {
			filter["senderId"] = oid
		}
	}
	if q := c.Query("search"); q != "" {
		filter["content"] = bson.M{"$regex": escapeRegex(q), "$options": "i"}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	messagesColl := database.DB.Collection("messages")

	total, _ := messagesColl.CountDocuments(ctx, filter)
	cursor, err := messagesColl.Find(ctx, filter, options.Find().SetSort(bson.M{"createdAt": -1}).SetSkip(int64(skip)).SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}
	defer cursor.Close(ctx)

	var messages []models.Message
	if err := cursor.All(ctx, &messages); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode messages"})
		return
	}

	userIDs := make([]primitive.ObjectID, 0, len(messages))
	for _, m := range messages {
		userIDs = append(userIDs, m.SenderID)
	}
	users := enrichUsers(ctx, userIDs)

	results := make([]gin.H, 0, len(messages))
	for _, m := range messages {
		results = append(results, gin.H{
			"id":        m.ID.Hex(),
			"chatId":    m.ChatID.Hex(),
			"senderId":  m.SenderID.Hex(),
			"content":   m.Content,
			"type":      m.Type,
			"isRead":    m.IsRead,
			"createdAt": m.CreatedAt,
			"sender":    users[m.SenderID.Hex()],
		})
	}

	c.JSON(http.StatusOK, gin.H{"messages": results, "total": total})
}

// AdminDeleteMessage deletes a single message.
func AdminDeleteMessage(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	msgID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	res, err := database.DB.Collection("messages").DeleteOne(ctx, bson.M{"_id": msgID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
		return
	}
	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	logAdminAction(c, "delete_message", "message", msgID.Hex(), "")
	c.JSON(http.StatusOK, gin.H{"message": "Message deleted", "id": msgID.Hex()})
}

// AdminListChats lists chats (direct and groups) with participant summaries.
// Query params: limit, skip.
func AdminListChats(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit, skip := parsePagingParams(c)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	chatsColl := database.DB.Collection("chats")

	total, _ := chatsColl.CountDocuments(ctx, bson.M{})
	cursor, err := chatsColl.Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"lastMessageAt": -1}).SetSkip(int64(skip)).SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chats"})
		return
	}
	defer cursor.Close(ctx)

	var chats []models.Chat
	if err := cursor.All(ctx, &chats); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode chats"})
		return
	}

	// Collect participant IDs
	ids := make([]primitive.ObjectID, 0)
	for _, ch := range chats {
		ids = append(ids, ch.Participants...)
	}
	users := enrichUsers(ctx, ids)

	results := make([]gin.H, 0, len(chats))
	for _, ch := range chats {
		participants := make([]gin.H, 0, len(ch.Participants))
		for _, pid := range ch.Participants {
			if u, ok := users[pid.Hex()]; ok {
				participants = append(participants, gin.H{"id": pid.Hex(), "username": u["username"], "avatar": u["avatar"]})
			}
		}
		results = append(results, gin.H{
			"id":              ch.ID.Hex(),
			"isGroup":         ch.IsGroup,
			"groupName":       ch.GroupName,
			"groupAvatar":     ch.GroupAvatar,
			"participantCount": len(ch.Participants),
			"participants":    participants,
			"lastMessageAt":   ch.LastMessageAt,
			"createdAt":       ch.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"chats": results, "total": total})
}

// AdminGetChat returns a single chat with its messages.
func AdminGetChat(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	chatID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chat id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var chat models.Chat
	if err := database.DB.Collection("chats").FindOne(ctx, bson.M{"_id": chatID}).Decode(&chat); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	users := enrichUsers(ctx, chat.Participants)
	participants := make([]gin.H, 0, len(chat.Participants))
	for _, pid := range chat.Participants {
		if u, ok := users[pid.Hex()]; ok {
			participants = append(participants, u)
		}
	}

	msgCursor, err := database.DB.Collection("messages").Find(ctx, bson.M{"chatId": chatID}, options.Find().SetSort(bson.M{"createdAt": -1}).SetLimit(100))
	messages := []gin.H{}
	if err == nil {
		defer msgCursor.Close(ctx)
		var msgs []models.Message
		if err := msgCursor.All(ctx, &msgs); err == nil {
			senders := enrichUsers(ctx, func() []primitive.ObjectID {
				ids := make([]primitive.ObjectID, 0, len(msgs))
				for _, m := range msgs {
					ids = append(ids, m.SenderID)
				}
				return ids
			}())
			for _, m := range msgs {
				messages = append(messages, gin.H{
					"id":        m.ID.Hex(),
					"content":   m.Content,
					"type":      m.Type,
					"createdAt": m.CreatedAt,
					"sender":    senders[m.SenderID.Hex()],
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"chat": gin.H{
			"id":              chat.ID.Hex(),
			"isGroup":         chat.IsGroup,
			"groupName":       chat.GroupName,
			"groupAvatar":     chat.GroupAvatar,
			"participantCount": len(chat.Participants),
			"participants":    participants,
			"lastMessageAt":   chat.LastMessageAt,
			"createdAt":       chat.CreatedAt,
		},
		"messages": messages,
	})
}

// AdminDeleteChat deletes a chat and all of its messages.
func AdminDeleteChat(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	chatID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chat id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	res, err := database.DB.Collection("chats").DeleteOne(ctx, bson.M{"_id": chatID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete chat"})
		return
	}
	if res.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}
	_, _ = database.DB.Collection("messages").DeleteMany(ctx, bson.M{"chatId": chatID})

	logAdminAction(c, "delete_chat", "chat", chatID.Hex(), "")
	c.JSON(http.StatusOK, gin.H{"message": "Chat deleted", "id": chatID.Hex()})
}

// AdminListRooms lists all rooms.
func AdminListRooms(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit, skip := parsePagingParams(c)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	roomsColl := database.DB.Collection("rooms")

	total, _ := roomsColl.CountDocuments(ctx, bson.M{})
	cursor, err := roomsColl.Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"current_members": -1}).SetSkip(int64(skip)).SetLimit(int64(limit)))
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

	results := make([]gin.H, 0, len(rooms))
	for _, r := range rooms {
		results = append(results, gin.H{
			"id":             r.ID.Hex(),
			"name":           r.Name,
			"description":    r.Description,
			"category":       r.Category,
			"currentMembers": r.CurrentMembers,
			"maxMembers":     r.MaxMembers,
			"isTrending":     r.IsTrending,
			"tags":           r.Tags,
			"createdAt":      r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"rooms": results, "total": total})
}

// AdminListFavorites lists the most recent favorites (engagements).
func AdminListFavorites(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit, skip := parsePagingParams(c)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	favoritesColl := database.DB.Collection("favorites")

	total, _ := favoritesColl.CountDocuments(ctx, bson.M{})
	cursor, err := favoritesColl.Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"createdAt": -1}).SetSkip(int64(skip)).SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch favorites"})
		return
	}
	defer cursor.Close(ctx)

	var favorites []models.Favorite
	if err := cursor.All(ctx, &favorites); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode favorites"})
		return
	}

	ids := make([]primitive.ObjectID, 0, len(favorites)*2)
	for _, f := range favorites {
		ids = append(ids, f.UserID, f.TargetUserID)
	}
	users := enrichUsers(ctx, ids)

	results := make([]gin.H, 0, len(favorites))
	for _, f := range favorites {
		from := users[f.UserID.Hex()]
		to := users[f.TargetUserID.Hex()]
		results = append(results, gin.H{
			"id":        f.ID.Hex(),
			"fromUser":  from,
			"toUser":    to,
			"createdAt": f.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"favorites": results, "total": total})
}

// AdminListPurchases lists content purchases.
func AdminListPurchases(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit, skip := parsePagingParams(c)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	purchasesColl := database.DB.Collection("content_purchases")

	filter := bson.M{}
	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}

	total, _ := purchasesColl.CountDocuments(ctx, filter)
	cursor, err := purchasesColl.Find(ctx, filter, options.Find().SetSort(bson.M{"created_at": -1}).SetSkip(int64(skip)).SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch purchases"})
		return
	}
	defer cursor.Close(ctx)

	var purchases []models.ContentPurchase
	if err := cursor.All(ctx, &purchases); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode purchases"})
		return
	}

	ids := make([]primitive.ObjectID, 0, len(purchases)*2)
	for _, p := range purchases {
		ids = append(ids, p.BuyerID, p.CreatorID)
	}
	users := enrichUsers(ctx, ids)

	results := make([]gin.H, 0, len(purchases))
	for _, p := range purchases {
		results = append(results, gin.H{
			"id":        p.ID.Hex(),
			"buyer":     users[p.BuyerID.Hex()],
			"creator":   users[p.CreatorID.Hex()],
			"imageId":   p.ImageID.Hex(),
			"price":     p.Price,
			"currency":  p.Currency,
			"status":    p.Status,
			"createdAt": p.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"purchases": results, "total": total})
}

func parsePagingParams(c *gin.Context) (int, int) {
	limit := 25
	if l, err := parseIntQuery(c.Query("limit")); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	skip := 0
	if s, err := parseIntQuery(c.Query("skip")); err == nil && s >= 0 {
		skip = s
	}
	return limit, skip
}
