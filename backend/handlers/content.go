package handlers

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"coded/database"
	"coded/models"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// UploadProfileImage handles uploading a profile image and adding it to the user's ProfileImages array
func UploadProfileImage(c *gin.Context) {
	userIDStr := c.GetString("userId")
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form data"})
		return
	}

	photoFile, _, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No photo file provided"})
		return
	}
	defer photoFile.Close()

	cld, err := cloudinary.NewFromURL(os.Getenv("CLOUDINARY_URL"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cloudinary configuration error"})
		return
	}

	imageID := primitive.NewObjectID()
	uploadParams := uploader.UploadParams{
		Folder:         "coded/profile_images",
		PublicID:       userID.Hex() + "_" + imageID.Hex(),
		Transformation: "c_limit,w_800,h_800,q_auto",
	}

	uploadResult, err := cld.Upload.Upload(ctx, photoFile, uploadParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload photo to Cloudinary"})
		return
	}

	newImage := models.ProfileImage{
		ID:           imageID,
		URL:          uploadResult.SecureURL,
		ThumbnailURL: uploadResult.SecureURL,
		IsExclusive:  false,
		Price:        0,
		Currency:     "NGN",
		BlurHash:     "LEHV6nWB2yk8pyo0adR*.7kCMdnj", // premium standard placeholder blurhash
		CreatedAt:    time.Now(),
	}

	usersColl := database.Client.Database("coded").Collection("users")

	// Atomically push to profile_images and photos (for backward compatibility)
	_, err = usersColl.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{
			"$push": bson.M{
				"profile_images": newImage,
				"photos":         newImage.URL,
			},
		},
	)
	if err != nil {
		log.Printf("[UploadProfileImage] DB Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile images in database"})
		return
	}

	c.JSON(http.StatusOK, newImage)
}

// UpdateProfileImage updates exclusive toggle, price, and currency for a specific image
func UpdateProfileImage(c *gin.Context) {
	userIDStr := c.GetString("userId")
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	imageIDStr := c.Param("id")
	imageID, err := primitive.ObjectIDFromHex(imageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid image ID"})
		return
	}

	var req struct {
		IsExclusive bool    `json:"is_exclusive"`
		Price       float64 `json:"price"`
		Currency    string  `json:"currency"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request data"})
		return
	}

	if req.Currency == "" {
		req.Currency = "NGN"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")

	// Update specific element inside the profile_images array
	_, err = usersColl.UpdateOne(
		ctx,
		bson.M{"_id": userID, "profile_images._id": imageID},
		bson.M{
			"$set": bson.M{
				"profile_images.$.is_exclusive": req.IsExclusive,
				"profile_images.$.price":        req.Price,
				"profile_images.$.currency":     req.Currency,
			},
		},
	)

	if err != nil {
		log.Printf("[UpdateProfileImage] DB Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile image status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Image updated successfully",
		"id":           imageIDStr,
		"is_exclusive": req.IsExclusive,
		"price":        req.Price,
		"currency":     req.Currency,
	})
}

// DeleteProfileImage removes a profile image from the user's ProfileImages and Photos lists
func DeleteProfileImage(c *gin.Context) {
	userIDStr := c.GetString("userId")
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	imageIDStr := c.Param("id")
	imageID, err := primitive.ObjectIDFromHex(imageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid image ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")

	// Get the image first to find its URL (needed to pull from 'photos')
	var user models.User
	err = usersColl.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var imageURL string
	for _, img := range user.ProfileImages {
		if img.ID == imageID {
			imageURL = img.URL
			break
		}
	}

	if imageURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Image not found on your profile"})
		return
	}

	// Remove from profile_images array and pull the URL from photos array
	_, err = usersColl.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{
			"$pull": bson.M{
				"profile_images": bson.M{"_id": imageID},
				"photos":         imageURL,
			},
		},
	)

	if err != nil {
		log.Printf("[DeleteProfileImage] DB Error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete profile image"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Image deleted successfully", "id": imageIDStr})
}

// GetUserProfile fetches a comprehensive user profile with images that include an is_unlocked flag
func GetUserProfile(c *gin.Context) {
	targetIDStr := c.Param("id")
	targetID, err := primitive.ObjectIDFromHex(targetIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid profile ID"})
		return
	}

	viewerIDStr := c.GetString("userId")
	viewerID, err := primitive.ObjectIDFromHex(viewerIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid viewer ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")
	purchasesColl := database.Client.Database("coded").Collection("content_purchases")

	var targetUser models.User
	err = usersColl.FindOne(ctx, bson.M{"_id": targetID}).Decode(&targetUser)
	if err == mongo.ErrNoDocuments {
		c.JSON(http.StatusNotFound, gin.H{"error": "User profile not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	isOwner := viewerID == targetID

	// Map profile images to response format, verifying unlock status
	var imagesList []map[string]interface{}
	for _, img := range targetUser.ProfileImages {
		isUnlocked := false
		if isOwner || !img.IsExclusive {
			isUnlocked = true
		} else {
			// Check if buyer has completed purchase for this image
			count, err := purchasesColl.CountDocuments(
				ctx,
				bson.M{
					"buyer_id":   viewerID,
					"image_id":   img.ID,
					"status":     "completed",
				},
			)
			if err == nil && count > 0 {
				isUnlocked = true
			}
		}

		imagesList = append(imagesList, map[string]interface{}{
			"id":            img.ID.Hex(),
			"url":           img.URL,
			"thumbnail_url": img.ThumbnailURL,
			"is_exclusive":  img.IsExclusive,
			"price":         img.Price,
			"currency":      img.Currency,
			"blur_hash":     img.BlurHash,
			"is_unlocked":   isUnlocked,
			"created_at":    img.CreatedAt,
		})
	}

	// Calculate age based on birthDate timestamp (in milliseconds or seconds)
	age := 0
	if targetUser.BirthDate > 0 {
		var birthTime time.Time
		if targetUser.BirthDate > 2000000000 {
			// Milliseconds
			birthTime = time.Unix(targetUser.BirthDate/1000, 0)
		} else {
			// Seconds
			birthTime = time.Unix(targetUser.BirthDate, 0)
		}
		years := time.Since(birthTime).Hours() / 24 / 365
		age = int(years)
	}

	c.JSON(http.StatusOK, gin.H{
		"id":             targetUser.ID.Hex(),
		"name":           targetUser.Name,
		"username":       targetUser.Username,
		"avatar":         targetUser.Avatar,
		"bio":            targetUser.Bio,
		"gender":         targetUser.Gender,
		"interestedIn":   targetUser.InterestedIn,
		"photos":         targetUser.Photos,
		"status":         targetUser.Status,
		"birthDate":      targetUser.BirthDate,
		"age":            age,
		"lastSeen":       targetUser.LastSeen,
		"profile_images": imagesList,
	})
}

// UnlockContent processes content purchases (saves acompleted mock purchase for testing)
func UnlockContent(c *gin.Context) {
	buyerIDStr := c.GetString("userId")
	buyerID, err := primitive.ObjectIDFromHex(buyerIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	imageIDStr := c.Param("image_id")
	imageID, err := primitive.ObjectIDFromHex(imageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid image ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")
	purchasesColl := database.Client.Database("coded").Collection("content_purchases")

	// Find the creator and image details
	var creator models.User
	err = usersColl.FindOne(ctx, bson.M{"profile_images._id": imageID}).Decode(&creator)
	if err == mongo.ErrNoDocuments {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exclusive content not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	var targetImage models.ProfileImage
	for _, img := range creator.ProfileImages {
		if img.ID == imageID {
			targetImage = img
			break
		}
	}

	// Create content purchase record
	purchase := models.ContentPurchase{
		ID:        primitive.NewObjectID(),
		BuyerID:   buyerID,
		CreatorID: creator.ID,
		ImageID:   imageID,
		Price:     targetImage.Price,
		Currency:  targetImage.Currency,
		Status:    "completed", // Instantly completed mock purchase for premium testing!
		CreatedAt: time.Now(),
	}

	// Insert purchase. If already bought, ignore duplicate index error
	_, err = purchasesColl.InsertOne(ctx, purchase)
	if err != nil && !mongo.IsDuplicateKeyError(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record content unlock"})
		return
	}

	// Return completed response — the purchase record is immediately status "completed"
	c.JSON(http.StatusOK, gin.H{
		"status":  "completed",
		"message": "Content unlocked successfully.",
	})
}

// CheckUnlockStatus returns whether a user has unlocked a specific image
func CheckUnlockStatus(c *gin.Context) {
	buyerIDStr := c.GetString("userId")
	buyerID, err := primitive.ObjectIDFromHex(buyerIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return
	}

	imageIDStr := c.Param("image_id")
	imageID, err := primitive.ObjectIDFromHex(imageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid image ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersColl := database.Client.Database("coded").Collection("users")
	purchasesColl := database.Client.Database("coded").Collection("content_purchases")

	// Find the image creator
	var creator models.User
	err = usersColl.FindOne(ctx, bson.M{"profile_images._id": imageID}).Decode(&creator)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"unlocked": false})
		return
	}

	if creator.ID == buyerID {
		c.JSON(http.StatusOK, gin.H{"unlocked": true})
		return
	}

	count, err := purchasesColl.CountDocuments(
		ctx,
		bson.M{
			"buyer_id": buyerID,
			"image_id": imageID,
			"status":   "completed",
		},
	)

	unlocked := err == nil && count > 0
	c.JSON(http.StatusOK, gin.H{"unlocked": unlocked})
}
