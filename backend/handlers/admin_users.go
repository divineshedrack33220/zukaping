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

// userSummary strips sensitive fields before returning user data to the admin UI.
func userSummary(u models.User) gin.H {
	complete := isProfileComplete(u)
	return gin.H{
		"id":            u.ID.Hex(),
		"email":         u.Email,
		"username":      u.Username,
		"name":          u.Name,
		"avatar":        u.Avatar,
		"bio":           u.Bio,
		"gender":        u.Gender,
		"status":        u.Status,
		"role":          u.Role,
		"authProvider":  u.AuthProvider,
		"isSuspended":   u.IsSuspended,
		"complete":      complete,
		"createdAt":     u.CreatedAt,
		"lastSeen":      u.LastSeen,
		"birthDate":     u.BirthDate,
		"photos":        len(u.Photos),
		"interestedIn":  u.InterestedIn,
		"referralCode":  u.ReferralCode,
	}
}

// AdminListUsers returns a paginated, filterable list of all users.
// Query params: search, complete (true/false), suspended (true/false),
// provider (email/google), role (admin/user), sort (createdAt|lastSeen|username),
// limit, skip.
func AdminListUsers(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	limit := 25
	if l, err := parseIntQuery(c.Query("limit")); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	skip := 0
	if s, err := parseIntQuery(c.Query("skip")); err == nil && s >= 0 {
		skip = s
	}

	conditions := []bson.M{}
	if q := c.Query("search"); q != "" {
		escaped := escapeRegex(q)
		conditions = append(conditions, bson.M{
			"$or": []bson.M{
				{"email": bson.M{"$regex": escaped, "$options": "i"}},
				{"username": bson.M{"$regex": escaped, "$options": "i"}},
				{"name": bson.M{"$regex": escaped, "$options": "i"}},
			},
		})
	}
	if v := c.Query("complete"); v == "true" || v == "false" {
		if v == "true" {
			conditions = append(conditions, completeProfileFilter())
		} else {
			conditions = append(conditions, bson.M{"$nor": []bson.M{completeProfileFilter()}})
		}
	}
	if v := c.Query("suspended"); v == "true" || v == "false" {
		conditions = append(conditions, bson.M{"isSuspended": v == "true"})
	}
	if v := c.Query("provider"); v != "" {
		conditions = append(conditions, bson.M{"authProvider": v})
	}
	if v := c.Query("role"); v != "" {
		conditions = append(conditions, bson.M{"role": v})
	}

	filter := bson.M{}
	if len(conditions) > 0 {
		filter = bson.M{"$and": conditions}
	}

	dir := int64(-1)
	if c.Query("order") == "asc" {
		dir = 1
	}
	sort := bson.M{"createdAt": dir}
	switch c.Query("sort") {
	case "lastSeen":
		sort = bson.M{"lastSeen": dir}
	case "username":
		sort = bson.M{"username": dir}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	usersColl := database.DB.Collection("users")

	total, _ := usersColl.CountDocuments(ctx, filter)

	opts := options.Find().SetSort(sort).SetSkip(int64(skip)).SetLimit(int64(limit))
	cursor, err := usersColl.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode users"})
		return
	}

	results := make([]gin.H, 0, len(users))
	for _, u := range users {
		results = append(results, userSummary(u))
	}

	c.JSON(http.StatusOK, gin.H{
		"users": results,
		"total": total,
		"limit": limit,
		"skip":  skip,
	})
}

// AdminGetUser returns full details for a single user including activity counts.
func AdminGetUser(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db := database.DB
	usersColl := db.Collection("users")

	var user models.User
	if err := usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	postsCount, _ := db.Collection("posts").CountDocuments(ctx, bson.M{"userId": userID})
	favoritesSent, _ := db.Collection("favorites").CountDocuments(ctx, bson.M{"userId": userID})
	favoritesReceived, _ := db.Collection("favorites").CountDocuments(ctx, bson.M{"targetUserId": userID})
	chatsCount, _ := db.Collection("chats").CountDocuments(ctx, bson.M{"participants": userID})
	messagesSent, _ := db.Collection("messages").CountDocuments(ctx, bson.M{"senderId": userID})
	purchasesBought, _ := db.Collection("content_purchases").CountDocuments(ctx, bson.M{"buyer_id": userID})
	purchasesSold, _ := db.Collection("content_purchases").CountDocuments(ctx, bson.M{"creator_id": userID})
	roomMemberships, _ := db.Collection("room_memberships").CountDocuments(ctx, bson.M{"user_id": userID, "is_active": true})

	summary := userSummary(user)
	summary["activity"] = gin.H{
		"posts":              postsCount,
		"favoritesSent":      favoritesSent,
		"favoritesReceived":  favoritesReceived,
		"chats":              chatsCount,
		"messagesSent":       messagesSent,
		"purchasesBought":    purchasesBought,
		"purchasesSold":      purchasesSold,
		"activeRoomMemberships": roomMemberships,
	}

	c.JSON(http.StatusOK, summary)
}

type AdminUserStatusRequest struct {
	Suspended *bool `json:"suspended"`
}

// AdminUpdateUserStatus suspends or activates a user account.
func AdminUpdateUserStatus(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	// Prevent self-suspension.
	actingID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))
	if actingID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot suspend your own account"})
		return
	}

	var req AdminUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Suspended == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "suspended (boolean) is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.DB.Collection("users")

	var user models.User
	if err := usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if _, err := usersColl.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$set": bson.M{"isSuspended": *req.Suspended},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user status"})
		return
	}

	action := "activate_user"
	if *req.Suspended {
		action = "suspend_user"
	}
	logAdminAction(c, action, "user", userID.Hex(), "email="+user.Email)

	logger.WithContext(c).Info().Str("userId", userID.Hex()).Bool("suspended", *req.Suspended).Msg("Admin updated user status")

	c.JSON(http.StatusOK, gin.H{
		"message":   "User status updated",
		"id":        userID.Hex(),
		"suspended": *req.Suspended,
	})
}

type AdminUserRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=user admin"`
}

// AdminUpdateUserRole promotes or demotes a user's admin role.
func AdminUpdateUserRole(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	actingID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))
	if actingID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot change your own role"})
		return
	}

	var req AdminUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role (user|admin) is required"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.DB.Collection("users")

	var user models.User
	if err := usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if _, err := usersColl.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{
		"$set": bson.M{"role": req.Role},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	logAdminAction(c, "update_role", "user", userID.Hex(), "role="+req.Role)

	c.JSON(http.StatusOK, gin.H{
		"message": "User role updated",
		"id":      userID.Hex(),
		"role":    req.Role,
	})
}

// AdminDeleteUser permanently deletes a user and their related data.
func AdminDeleteUser(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	userID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	actingID, _ := primitive.ObjectIDFromHex(c.GetString("userId"))
	if actingID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot delete your own account"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	db := database.DB
	usersColl := db.Collection("users")

	var user models.User
	if err := usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// Remove the user and their dependent data.
	_, _ = usersColl.DeleteOne(ctx, bson.M{"_id": userID})
	_, _ = db.Collection("posts").DeleteMany(ctx, bson.M{"userId": userID})
	_, _ = db.Collection("favorites").DeleteMany(ctx, bson.M{"$or": []bson.M{{"userId": userID}, {"targetUserId": userID}}})
	_, _ = db.Collection("messages").DeleteMany(ctx, bson.M{"senderId": userID})
	_, _ = db.Collection("content_purchases").DeleteMany(ctx, bson.M{"$or": []bson.M{{"buyer_id": userID}, {"creator_id": userID}}})
	_, _ = db.Collection("room_memberships").DeleteMany(ctx, bson.M{"user_id": userID})
	_, _ = db.Collection("admin_audit_logs").DeleteMany(ctx, bson.M{"adminId": userID})
	// Remove the user from chat participants.
	_, _ = db.Collection("chats").UpdateMany(ctx, bson.M{"participants": userID}, bson.M{"$pull": bson.M{"participants": userID}})

	logAdminAction(c, "delete_user", "user", userID.Hex(), "email="+user.Email)

	logger.WithContext(c).Info().Str("userId", userID.Hex()).Msg("Admin deleted user")

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted",
		"id":      userID.Hex(),
	})
}
