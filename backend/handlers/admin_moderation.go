package handlers

import (
	"context"
	"net/http"
	"time"

	"coded/database"
	"coded/models"
	"coded/pkg/logger"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AdminListReports lists user-flagged content.
// Query params: status (open|resolved|dismissed), targetType, limit, skip.
func AdminListReports(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit, skip := parsePagingParams(c)

	filter := bson.M{}
	if status := c.Query("status"); status != "" {
		filter["status"] = status
	}
	if targetType := c.Query("targetType"); targetType != "" {
		filter["targetType"] = targetType
	}
	if q := c.Query("search"); q != "" {
		rx := bson.M{"$regex": escapeRegex(q), "$options": "i"}
		filter["$or"] = bson.A{
			bson.M{"reason": rx},
			bson.M{"details": rx},
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	reportsColl := database.DB.Collection("reports")

	total, _ := reportsColl.CountDocuments(ctx, filter)
	cursor, err := reportsColl.Find(ctx, filter,
		options.Find().SetSort(sortSpec(c, map[string][]string{
			"createdAt": {"createdAt"},
		}, bson.D{{Key: "createdAt", Value: -1}})).SetSkip(int64(skip)).SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reports"})
		return
	}
	defer cursor.Close(ctx)

	var reports []models.Report
	if err := cursor.All(ctx, &reports); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode reports"})
		return
	}

	reporterIDs := make([]primitive.ObjectID, 0, len(reports))
	for _, r := range reports {
		reporterIDs = append(reporterIDs, r.ReporterID)
	}
	users := enrichUsers(ctx, reporterIDs)

	results := make([]gin.H, 0, len(reports))
	for _, r := range reports {
		results = append(results, gin.H{
			"id":         r.ID.Hex(),
			"reporter":   users[r.ReporterID.Hex()],
			"targetType": r.TargetType,
			"targetId":   r.TargetID.Hex(),
			"reason":     r.Reason,
			"details":    r.Details,
			"status":     r.Status,
			"resolution": r.Resolution,
			"createdAt":  r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"reports": results, "total": total, "limit": limit, "skip": skip})
}

type AdminReportStatusRequest struct {
	Status     string `json:"status" binding:"required,oneof=resolved dismissed"`
	Resolution string `json:"resolution"`
}

// AdminUpdateReport resolves or dismisses a report.
func AdminUpdateReport(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	reportID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report id"})
		return
	}

	var req AdminReportStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status (resolved|dismissed) is required"})
		return
	}

	adminID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	reportsColl := database.DB.Collection("reports")

	var report models.Report
	if err := reportsColl.FindOne(ctx, bson.M{"_id": reportID}).Decode(&report); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if _, err := reportsColl.UpdateOne(ctx, bson.M{"_id": reportID}, bson.M{
		"$set": bson.M{
			"status":     req.Status,
			"resolution": req.Resolution,
			"resolvedBy": adminID,
			"resolvedAt": time.Now().Unix(),
		},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update report"})
		return
	}

	logAdminAction(c, req.Status+"_report", "report", reportID.Hex(),
		"targetType="+report.TargetType+" targetId="+report.TargetID.Hex())

	c.JSON(http.StatusOK, gin.H{"message": "Report updated", "id": reportID.Hex(), "status": req.Status})
}

type AdminRoomUpdateRequest struct {
	Name        *string   `json:"name"`
	Description *string   `json:"description"`
	AvatarURL   *string   `json:"avatarUrl"`
	Category    *string   `json:"category"`
	MaxMembers  *int      `json:"maxMembers"`
	IsTrending  *bool     `json:"isTrending"`
	Tags        *[]string `json:"tags"`
}

// AdminUpdateRoom edits a room's configuration.
func AdminUpdateRoom(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	roomID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room id"})
		return
	}

	var req AdminRoomUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	roomsColl := database.DB.Collection("rooms")

	var room models.Room
	if err := roomsColl.FindOne(ctx, bson.M{"_id": roomID}).Decode(&room); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	set := bson.M{}
	if req.Name != nil {
		set["name"] = *req.Name
	}
	if req.Description != nil {
		set["description"] = *req.Description
	}
	if req.AvatarURL != nil {
		set["avatar_url"] = *req.AvatarURL
	}
	if req.Category != nil {
		set["category"] = *req.Category
	}
	if req.MaxMembers != nil {
		if *req.MaxMembers < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "maxMembers must be at least 1"})
			return
		}
		set["max_members"] = *req.MaxMembers
	}
	if req.IsTrending != nil {
		set["is_trending"] = *req.IsTrending
	}
	if req.Tags != nil {
		set["tags"] = *req.Tags
	}

	if len(set) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	if _, err := roomsColl.UpdateOne(ctx, bson.M{"_id": roomID}, bson.M{"$set": set}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room"})
		return
	}

	// Mirror changes onto the group chat with the same ID.
	chatSet := bson.M{}
	if req.Name != nil {
		chatSet["groupName"] = *req.Name
	}
	if req.Description != nil {
		chatSet["groupDescription"] = *req.Description
	}
	if req.AvatarURL != nil {
		chatSet["groupAvatar"] = *req.AvatarURL
	}
	if len(chatSet) > 0 {
		_, _ = database.DB.Collection("chats").UpdateOne(ctx, bson.M{"_id": roomID}, bson.M{"$set": chatSet})
	}

	logAdminAction(c, "update_room", "room", roomID.Hex(), "name="+room.Name)

	c.JSON(http.StatusOK, gin.H{"message": "Room updated", "id": roomID.Hex()})
}

// AdminDeleteRoom deletes a room, its memberships, mirror chat and messages.
func AdminDeleteRoom(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	roomID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	roomsColl := database.DB.Collection("rooms")

	var room models.Room
	if err := roomsColl.FindOne(ctx, bson.M{"_id": roomID}).Decode(&room); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	_, _ = roomsColl.DeleteOne(ctx, bson.M{"_id": roomID})
	_, _ = database.DB.Collection("room_memberships").DeleteMany(ctx, bson.M{"room_id": roomID})
	_, _ = database.DB.Collection("messages").DeleteMany(ctx, bson.M{"chatId": roomID})
	_, _ = database.DB.Collection("chats").DeleteOne(ctx, bson.M{"_id": roomID})

	logAdminAction(c, "delete_room", "room", roomID.Hex(), "name="+room.Name)
	logger.WithContext(c).Info().Str("roomId", roomID.Hex()).Msg("Admin deleted room")

	c.JSON(http.StatusOK, gin.H{"message": "Room deleted", "id": roomID.Hex()})
}
