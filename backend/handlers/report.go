package handlers

import (
	"context"
	"net/http"
	"time"

	"coded/database"
	"coded/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var validReportTargets = map[string]bool{
	"user":    true,
	"post":    true,
	"message": true,
	"chat":    true,
	"room":    true,
}

type ReportRequest struct {
	TargetType string `json:"targetType" binding:"required"`
	TargetID   string `json:"targetId" binding:"required"`
	Reason     string `json:"reason" binding:"required"`
	Details    string `json:"details"`
}

// SubmitReport lets an authenticated user flag content or another user for review.
func SubmitReport(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	reporterID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))

	var req ReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "targetType, targetId and reason are required"})
		return
	}

	if !validReportTargets[req.TargetType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "targetType must be one of user, post, message, chat, room"})
		return
	}

	targetID, err := primitive.ObjectIDFromHex(req.TargetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid targetId"})
		return
	}

	if len(req.Reason) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Reason is too long (max 200 chars)"})
		return
	}
	if len(req.Details) > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Details are too long (max 1000 chars)"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	reportsColl := database.DB.Collection("reports")

	report := models.Report{
		ID:         primitive.NewObjectID(),
		ReporterID: reporterID,
		TargetType: req.TargetType,
		TargetID:   targetID,
		Reason:     req.Reason,
		Details:    req.Details,
		Status:     "open",
		CreatedAt:  time.Now().Unix(),
	}

	if _, err := reportsColl.InsertOne(ctx, report); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit report"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Report submitted. Our moderation team will review it.",
		"id":      report.ID.Hex(),
	})
}
