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
)

func GetChatList(c *gin.Context) {
    userIDStr := c.GetString("userId")
    userID, err := primitive.ObjectIDFromHex(userIDStr)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    chatsColl := database.Client.Database("coded").Collection("chats")

    // Build pipeline step by step to avoid nested bson.D issues
    matchStage := bson.D{{Key: "$match", Value: bson.D{{Key: "participants", Value: userID}}}}
    sortStage := bson.D{{Key: "$sort", Value: bson.D{{Key: "lastMessageAt", Value: -1}}}}
    
    lookupStage := bson.D{{Key: "$lookup", Value: bson.D{
        {Key: "from", Value: "users"},
        {Key: "localField", Value: "participants"},
        {Key: "foreignField", Value: "_id"},
        {Key: "as", Value: "participantsProfiles"},
    }}}
    
    // Build filter condition
    filterCond := bson.D{{Key: "$filter", Value: bson.D{
        {Key: "input", Value: "$participantsProfiles"},
        {Key: "as", Value: "p"},
        {Key: "cond", Value: bson.D{{Key: "$ne", Value: bson.A{"$$p._id", userID}}}},
    }}}
    
    addFieldsStage := bson.D{{Key: "$addFields", Value: bson.D{
        {Key: "partner", Value: bson.D{
            {Key: "$arrayElemAt", Value: bson.A{filterCond, 0}},
        }},
    }}}
    
    projectStage := bson.D{{Key: "$project", Value: bson.D{
        {Key: "id", Value: "$_id"},
        {Key: "lastMessage", Value: 1},
        {Key: "lastMessageAt", Value: 1},
        {Key: "partner", Value: bson.D{
            {Key: "id", Value: "$partner._id"},
            {Key: "name", Value: "$partner.name"},
            {Key: "avatar", Value: "$partner.avatar"},
            {Key: "status", Value: "$partner.status"},
        }},
    }}}

    pipeline := mongo.Pipeline{matchStage, sortStage, lookupStage, addFieldsStage, projectStage}

    cursor, err := chatsColl.Aggregate(ctx, pipeline)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chats"})
        return
    }
    defer cursor.Close(ctx)

    var results []bson.M
    if err := cursor.All(ctx, &results); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode chats"})
        return
    }

    // Ensure partner is always a valid object with fallback values
    response := make([]map[string]interface{}, len(results))
    for i, r := range results {
        partnerRaw := r["partner"]
        partnerMap := map[string]interface{}{
            "id":     "",
            "name":   "Unknown",
            "avatar": fallbackAvatar,
            "status": "offline",
        }

        if p, ok := partnerRaw.(bson.M); ok && p != nil {
            if id, _ := p["_id"].(primitive.ObjectID); id != primitive.NilObjectID {
                partnerMap["id"] = id.Hex()
            }
            if name, _ := p["name"].(string); name != "" {
                partnerMap["name"] = name
            }
            if avatar, _ := p["avatar"].(string); avatar != "" {
                partnerMap["avatar"] = avatar
            }
            if status, _ := p["status"].(string); status != "" {
                partnerMap["status"] = status
            }
        }

        response[i] = map[string]interface{}{
            "id":            r["id"],
            "lastMessage":   r["lastMessage"],
            "lastMessageAt": r["lastMessageAt"],
            "partner":       partnerMap,
        }
    }

    c.JSON(http.StatusOK, response)
}

func CreateChat(c *gin.Context) {
    var req struct {
        Participants []string `json:"participants" binding:"required,min=1"`
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

    var participantIDs []primitive.ObjectID
    participantIDs = append(participantIDs, userID)

    for _, p := range req.Participants {
        pID, err := primitive.ObjectIDFromHex(p)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid participant ID"})
            return
        }
        if pID != userID {
            participantIDs = append(participantIDs, pID)
        }
    }

    if len(participantIDs) < 2 {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Chat must have at least two participants"})
        return
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    chatsColl := database.Client.Database("coded").Collection("chats")

    filter := bson.M{
        "participants": bson.M{
            "$all":  participantIDs,
            "$size": len(participantIDs),
        },
    }

    var existingChat models.Chat
    err = chatsColl.FindOne(ctx, filter).Decode(&existingChat)
    if err == nil {
        c.JSON(http.StatusOK, gin.H{
            "id": existingChat.ID.Hex(),
        })
        return
    }
    if err != mongo.ErrNoDocuments {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
        return
    }

    newChat := models.Chat{
        ID:            primitive.NewObjectID(),
        Participants:  participantIDs,
        LastMessageAt: time.Now().Unix(),
        CreatedAt:     time.Now().Unix(),
    }

    _, err = chatsColl.InsertOne(ctx, newChat)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create chat"})
        return
    }

    // Get partner info for WebSocket broadcast
    usersColl := database.Client.Database("coded").Collection("users")
    var partner models.User
    for _, participantID := range participantIDs {
        if participantID != userID {
            usersColl.FindOne(ctx, bson.M{"_id": participantID}).Decode(&partner)
            break
        }
    }

    // Prepare chat data for WebSocket broadcast
    chatData := map[string]interface{}{
        "id":            newChat.ID.Hex(),
        "lastMessageAt": newChat.LastMessageAt,
        "partner": map[string]interface{}{
            "id":     partner.ID.Hex(),
            "name":   partner.Name,
            "avatar": partner.Avatar,
            "status": partner.Status,
        },
    }

    // Broadcast new chat creation via WebSocket
    if wsManager != nil {
        wsManager.BroadcastChatCreated(chatData)
    }

    c.JSON(http.StatusCreated, gin.H{
        "id":   newChat.ID.Hex(),
        "chat": chatData,
    })
}

func GetChat(c *gin.Context) {
    chatIDStr := c.Param("id")
    chatID, err := primitive.ObjectIDFromHex(chatIDStr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid chat ID"})
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

    chatsColl := database.Client.Database("coded").Collection("chats")

    // Build pipeline step by step
    matchStage := bson.D{{Key: "$match", Value: bson.D{
        {Key: "_id", Value: chatID},
        {Key: "participants", Value: userID},
    }}}
    
    lookupStage := bson.D{{Key: "$lookup", Value: bson.D{
        {Key: "from", Value: "users"},
        {Key: "localField", Value: "participants"},
        {Key: "foreignField", Value: "_id"},
        {Key: "as", Value: "participantsProfiles"},
    }}}
    
    filterCond := bson.D{{Key: "$filter", Value: bson.D{
        {Key: "input", Value: "$participantsProfiles"},
        {Key: "as", Value: "p"},
        {Key: "cond", Value: bson.D{{Key: "$ne", Value: bson.A{"$$p._id", userID}}}},
    }}}
    
    addFieldsStage := bson.D{{Key: "$addFields", Value: bson.D{
        {Key: "partner", Value: bson.D{
            {Key: "$arrayElemAt", Value: bson.A{filterCond, 0}},
        }},
    }}}
    
    projectStage := bson.D{{Key: "$project", Value: bson.D{
        {Key: "id", Value: "$_id"},
        {Key: "lastMessage", Value: 1},
        {Key: "lastMessageAt", Value: 1},
        {Key: "partner", Value: bson.D{
            {Key: "id", Value: "$partner._id"},
            {Key: "name", Value: "$partner.name"},
            {Key: "avatar", Value: "$partner.avatar"},
            {Key: "status", Value: "$partner.status"},
        }},
    }}}

    pipeline := mongo.Pipeline{matchStage, lookupStage, addFieldsStage, projectStage}

    cursor, err := chatsColl.Aggregate(ctx, pipeline)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chat"})
        return
    }
    defer cursor.Close(ctx)

    if !cursor.Next(ctx) {
        c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found or access denied"})
        return
    }

    var result bson.M
    if err := cursor.Decode(&result); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode chat"})
        return
    }

    // Apply fallback for partner
    partnerRaw := result["partner"]
    partnerMap := map[string]interface{}{
        "id":     "",
        "name":   "Unknown",
        "avatar": fallbackAvatar,
        "status": "offline",
    }

    if p, ok := partnerRaw.(bson.M); ok && p != nil {
        if id, _ := p["_id"].(primitive.ObjectID); id != primitive.NilObjectID {
            partnerMap["id"] = id.Hex()
        }
        if name, _ := p["name"].(string); name != "" {
            partnerMap["name"] = name
        }
        if avatar, _ := p["avatar"].(string); avatar != "" {
            partnerMap["avatar"] = avatar
        }
        if status, _ := p["status"].(string); status != "" {
            partnerMap["status"] = status
        }
    }

    result["partner"] = partnerMap

    c.JSON(http.StatusOK, result)
}