package handlers

import (
	"context"
	"net/http"
	"time"

	"coded/database"
	"coded/models"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// isProfileComplete reports whether a user has a fully completed profile.
func isProfileComplete(u models.User) bool {
	return u.Name != "" &&
		u.Gender != "" &&
		u.Bio != "" &&
		u.BirthDate != 0 &&
		len(u.Photos) > 0
}

// completeProfileFilter is a MongoDB filter for users with a completed profile.
func completeProfileFilter() bson.M {
	return bson.M{
		"$and": []bson.M{
			{"name": bson.M{"$ne": ""}},
			{"gender": bson.M{"$ne": ""}},
			{"bio": bson.M{"$ne": ""}},
			{"birthDate": bson.M{"$ne": 0}},
			{"photos.0": bson.M{"$exists": true}},
		},
	}
}

// AdminGetOverview returns high-level platform statistics.
func AdminGetOverview(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	db := database.DB
	now := time.Now().Unix()

	usersColl := db.Collection("users")
	postsColl := db.Collection("posts")
	messagesColl := db.Collection("messages")
	favoritesColl := db.Collection("favorites")
	chatsColl := db.Collection("chats")
	roomsColl := db.Collection("rooms")
	membershipsColl := db.Collection("room_memberships")
	purchasesColl := db.Collection("content_purchases")

	totalUsers, _ := usersColl.CountDocuments(ctx, bson.M{})
	totalAdmins, _ := usersColl.CountDocuments(ctx, bson.M{"role": "admin"})
	totalSuspended, _ := usersColl.CountDocuments(ctx, bson.M{"isSuspended": true})

	totalComplete, _ := usersColl.CountDocuments(ctx, completeProfileFilter())
	totalIncomplete := totalUsers - totalComplete

	startToday := startOfDayUnix(now)
	start7d := now - 7*86400
	start30d := now - 30*86400
	activeWindow := now - 300 // 5 minutes

	newToday, _ := usersColl.CountDocuments(ctx, bson.M{"createdAt": bson.M{"$gte": startToday}})
	new7d, _ := usersColl.CountDocuments(ctx, bson.M{"createdAt": bson.M{"$gte": start7d}})
	new30d, _ := usersColl.CountDocuments(ctx, bson.M{"createdAt": bson.M{"$gte": start30d}})
	activeNow, _ := usersColl.CountDocuments(ctx, bson.M{"lastSeen": bson.M{"$gte": activeWindow}})
	activeToday, _ := usersColl.CountDocuments(ctx, bson.M{"lastSeen": bson.M{"$gte": startToday}})

	totalPosts, _ := postsColl.CountDocuments(ctx, bson.M{})
	postsToday, _ := postsColl.CountDocuments(ctx, bson.M{"createdAt": bson.M{"$gte": startToday}})

	totalMessages, _ := messagesColl.CountDocuments(ctx, bson.M{})
	messagesToday, _ := messagesColl.CountDocuments(ctx, bson.M{"createdAt": bson.M{"$gte": startToday}})

	totalFavorites, _ := favoritesColl.CountDocuments(ctx, bson.M{})
	favoritesToday, _ := favoritesColl.CountDocuments(ctx, bson.M{"createdAt": bson.M{"$gte": startToday}})

	totalChats, _ := chatsColl.CountDocuments(ctx, bson.M{})

	totalRooms, _ := roomsColl.CountDocuments(ctx, bson.M{})
	totalRoomMembers, _ := membershipsColl.CountDocuments(ctx, bson.M{"is_active": true})

	totalPurchases, _ := purchasesColl.CountDocuments(ctx, bson.M{})
	completedPurchases, _ := purchasesColl.CountDocuments(ctx, bson.M{"status": "completed"})

	// Revenue from completed purchases.
	revenueCursor, err := purchasesColl.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"status": "completed"}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: nil},
			{Key: "total", Value: bson.M{"$sum": "$price"}},
		}}},
	})
	var totalRevenue float64
	if err == nil {
		var rev []bson.M
		if err := revenueCursor.All(ctx, &rev); err == nil && len(rev) > 0 {
			if v, ok := rev[0]["total"].(float64); ok {
				totalRevenue = v
			}
		}
		revenueCursor.Close(ctx)
	}

	c.JSON(http.StatusOK, gin.H{
		"users": gin.H{
			"total":      totalUsers,
			"complete":   totalComplete,
			"incomplete": totalIncomplete,
			"suspended":  totalSuspended,
			"admins":     totalAdmins,
			"newToday":   newToday,
			"new7d":      new7d,
			"new30d":     new30d,
			"activeNow":  activeNow,
			"activeToday": activeToday,
		},
		"content": gin.H{
			"posts":         totalPosts,
			"postsToday":    postsToday,
			"messages":      totalMessages,
			"messagesToday": messagesToday,
		},
		"engagement": gin.H{
			"favorites":         totalFavorites,
			"favoritesToday":    favoritesToday,
			"chats":             totalChats,
			"rooms":             totalRooms,
			"roomMembers":       totalRoomMembers,
		},
		"commerce": gin.H{
			"purchases": totalPurchases,
			"completed": completedPurchases,
			"revenue":   totalRevenue,
		},
	})
}

// AdminGetTrends returns per-day counts for signups, posts, messages and favorites.
// Accepts ?days=7 or ?days=30 (default 7).
func AdminGetTrends(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	days := 7
	if d, err := parseIntQuery(c.Query("days")); err == nil && (d == 7 || d == 30) {
		days = d
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	db := database.DB
	now := time.Now().Unix()
	start := startOfDayUnix(now) - int64(days-1)*86400

	labels := make([]int64, 0, days)
	for i := 0; i < days; i++ {
		labels = append(labels, start+int64(i)*86400)
	}

	signups := dailySeries(ctx, db.Collection("users"), "createdAt", start, labels)
	posts := dailySeries(ctx, db.Collection("posts"), "createdAt", start, labels)
	messages := dailySeries(ctx, db.Collection("messages"), "createdAt", start, labels)
	favorites := dailySeries(ctx, db.Collection("favorites"), "createdAt", start, labels)

	c.JSON(http.StatusOK, gin.H{
		"days":      days,
		"startDate": start,
		"signups":   signups,
		"posts":     posts,
		"messages":  messages,
		"favorites": favorites,
	})
}

// dailySeries counts documents grouped by day (start-of-day unix seconds).
func dailySeries(ctx context.Context, coll *mongo.Collection, timeField string, start int64, labels []int64) []int64 {
	out := make([]int64, len(labels))
	idx := make(map[int64]int, len(labels))
	for i, l := range labels {
		idx[l] = i
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{timeField: bson.M{"$gte": start}}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: bson.M{"$subtract": bson.A{"$" + timeField, bson.M{"$mod": bson.A{"$" + timeField, 86400}}}}},
			{Key: "count", Value: bson.M{"$sum": 1}},
		}}},
	}

	cursor, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		zerolog.Ctx(ctx).Error().Err(err).Msg("daily series aggregation failed")
		return out
	}
	defer cursor.Close(ctx)

	var rows []bson.M
	if err := cursor.All(ctx, &rows); err != nil {
		return out
	}

	for _, r := range rows {
		day, ok := r["_id"].(int64)
		if !ok {
			if v, isFloat := r["_id"].(float64); isFloat {
				day = int64(v)
			} else {
				continue
			}
		}
		if i, exists := idx[day]; exists {
			if v, ok := r["count"].(int32); ok {
				out[i] = int64(v)
			} else if v, ok := r["count"].(int64); ok {
				out[i] = v
			}
		}
	}

	return out
}

func startOfDayUnix(ts int64) int64 {
	return ts - (ts % 86400)
}
