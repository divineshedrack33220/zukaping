package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"coded/database"
	"coded/handlers"
	"coded/pkg/logger"
	"coded/routes"
	"coded/websocket"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
)

var cloudinaryClient *cloudinary.Cloudinary

func getCloudinaryClient() *cloudinary.Cloudinary {
	return cloudinaryClient
}

func validateEnv() {
	required := []string{
		"JWT_SECRET",
		"MONGODB_URI",
	}

	for _, env := range required {
		if os.Getenv(env) == "" {
			logger.Logger.Fatal().Str("env", env).Msg("Required environment variable not set")
		}
	}

	if os.Getenv("GIN_MODE") == "release" {
		if len(os.Getenv("JWT_SECRET")) < 32 {
			logger.Logger.Fatal().Msg("JWT_SECRET must be at least 32 characters in production")
		}
	}
}


func main() {
	_ = godotenv.Load()

	debug := os.Getenv("GIN_MODE") != "release"
	logger.Init("zukaping", debug)

	logger.Logger.Info().Msg("🚀 Starting backend...")

	validateEnv()

	// Initialize VAPID keys for push notifications
	handlers.InitVAPIDKeys()

	// Initialize Cloudinary once at startup
	if cloudinaryURL := os.Getenv("CLOUDINARY_URL"); cloudinaryURL != "" {
		cld, err := cloudinary.NewFromURL(cloudinaryURL)
		if err != nil {
			logger.Logger.Error().Err(err).Msg("Failed to initialize Cloudinary")
		} else {
			cloudinaryClient = cld
			logger.Logger.Info().Msg("Cloudinary initialized successfully")
		}
	}

	// ---------------- DB CONNECTION (NON-BLOCKING) ----------------
	logger.Logger.Info().Msg("🔌 Connecting to MongoDB...")
	var dbConnected bool

	for i := 1; i <= 3; i++ {
		if err := database.ConnectDB(); err != nil {
			logger.Logger.Error().Err(err).Int("attempt", i).Msg("DB connection failed")
			time.Sleep(2 * time.Second)
		} else {
			// Check if client is actually connected (not degraded mode)
			if database.Client != nil {
				dbConnected = true
				break
			}
			logger.Logger.Warn().Msg("DB connected but client is nil (degraded mode)")
			dbConnected = false
			break
		}
	}

	if dbConnected && database.Client != nil {
		logger.Logger.Info().Msg("✅ MongoDB connected")

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := database.Client.Ping(ctx, nil); err != nil {
			logger.Logger.Warn().Err(err).Msg("MongoDB ping failed")
		}

		// Clean up chats with duplicate/empty participants to fix unique index
		go cleanupDuplicateChats()

		// Start background DB cleanup worker for old posts (older than 50 days)
		go startPostCleanupWorker()

		// Start background room inactivity cleanup worker (7 days inactivity auto-leave)
		handlers.StartAutoLeaveWorker()
	} else {
		logger.Logger.Warn().Msg("Running WITHOUT MongoDB (degraded mode)")
	}

	// ---------------- WEBSOCKET ----------------
	wsManager := websocket.NewManager()
	go wsManager.Start()
	handlers.SetWebSocketManager(wsManager)

	// ---------------- GIN MODE ----------------
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// ---------------- ROUTER ----------------
	router := routes.SetupRouter()

	// Log DB status for monitoring
	logger.Logger.Info().Bool("connected", dbConnected).Msg("Database connection status")

	// Add logging middleware
	router.Use(logger.LoggerMiddleware())

	// WebSocket endpoint
	router.GET("/ws", func(c *gin.Context) {
		websocket.WebSocketHandler(wsManager)(c.Writer, c.Request)
	})


	// ---------------- PORT ----------------
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         "0.0.0.0:" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// ---------------- START SERVER ----------------
	go func() {
		logger.Logger.Info().Str("port", port).Msg("🌐 Running on port")
		logger.Logger.Info().Str("url", "http://localhost:"+port+"/api").Msg("📍 API Base URL")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Logger.Fatal().Err(err).Msg("Server crash")
		}
	}()

	logger.Logger.Info().Msg("✅ Server started successfully")

	// ---------------- GRACEFUL SHUTDOWN ----------------
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	<-quit
	logger.Logger.Info().Msg("🛑 Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Logger.Error().Err(err).Msg("Forced shutdown")
	}

	// Gracefully shutdown WebSocket connections
	wsManager.Shutdown()

	if database.Client != nil {
		_ = database.Client.Disconnect(ctx)
	}

	logger.Logger.Info().Msg("👋 Server stopped")
}

// startPostCleanupWorker starts a background worker that regularly deletes posts older than 50 days
func startPostCleanupWorker() {
	logger.Logger.Info().Msg("Post cleanup worker initialized (deletes posts older than 50 days)")
	
	// Run cleanup once immediately on startup
	runPostCleanup()
	
	// Run cleanup every 12 hours
	ticker := time.NewTicker(12 * time.Hour)
	for range ticker.C {
		runPostCleanup()
	}
}

// runPostCleanup executes the database query to delete old posts
func runPostCleanup() {
	if database.Client == nil {
		return
	}
	
	logger.Logger.Info().Msg("Running scheduled database cleanup for posts older than 50 days...")
	
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	postsColl := database.Client.Database("coded").Collection("posts")
	
	// 50 days = 50 * 24 * 3600 seconds = 4,320,000 seconds
	cutoffTime := time.Now().Unix() - 4320000
	
	filter := bson.M{
		"createdAt": bson.M{"$lt": cutoffTime},
	}
	
	res, err := postsColl.DeleteMany(ctx, filter)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Error during post cleanup")
		return
	}
	
	if res.DeletedCount > 0 {
		logger.Logger.Info().Int64("deleted", res.DeletedCount).Msg("Deleted posts older than 50 days")
	} else {
		logger.Logger.Info().Msg("Cleanup complete: No posts older than 50 days found")
	}
}

// cleanupDuplicateChats removes chats with empty/undefined participants to fix unique index
func cleanupDuplicateChats() {
	if database.Client == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	chatsColl := database.Client.Database("coded").Collection("chats")

	// Remove chats with empty participants array
	filter := bson.M{
		"$or": []bson.M{
			{"participants": bson.M{"$size": 0}},
			{"participants": bson.M{"$exists": false}},
			{"participants": nil},
		},
	}

	res, err := chatsColl.DeleteMany(ctx, filter)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Error cleaning up duplicate chats")
		return
	}

	if res.DeletedCount > 0 {
		logger.Logger.Info().Int64("deleted", res.DeletedCount).Msg("Cleaned up chats with empty participants")
	}
}