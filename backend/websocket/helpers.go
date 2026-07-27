package websocket

import (
    "context"
    "log"
    "time"

    "coded/database"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

// getChatParticipantIDs returns the list of participant user IDs for a given chat ID.
func getChatParticipantIDs(chatID string) []string {
    if database.Client == nil {
        return nil
    }

    oid, err := primitive.ObjectIDFromHex(chatID)
    if err != nil {
        return nil
    }

    ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
    defer cancel()

    chatsColl := database.DB.Collection("chats")
    var result struct {
        Participants []primitive.ObjectID `bson:"participants"`
    }

    err = chatsColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&result)
    if err != nil {
        log.Printf("WS: failed to fetch chat participants for %s: %v", chatID, err)
        return nil
    }

    ids := make([]string, 0, len(result.Participants))
    for _, p := range result.Participants {
        ids = append(ids, p.Hex())
    }
    return ids
}
