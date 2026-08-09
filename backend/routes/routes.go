package routes

import (
    "embed"
    "io/fs"
    "net/http"
    "os"
    "strings"
    "time"

    "coded/handlers"
    "coded/middleware"
    "coded/pkg/logger"
    "coded/pkg/metrics"

    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

//go:embed index.html
var landingPageHTML string

//go:embed admin/index.html admin/admin.css admin/admin.js
var adminFS embed.FS

func mustRead(fsys embed.FS, path string) []byte {
    b, err := fs.ReadFile(fsys, path)
    if err != nil {
        return []byte("resource not found")
    }
    return b
}

func SetupRouter() *gin.Engine {
    router := gin.New()
    router.Use(gin.Recovery())

    // CORS MUST be first to handle OPTIONS preflight requests
    allowOrigins := []string{
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "https://zukaping.app",
        "https://app.zukaping.app",
        "https://lemon16.app",
        "https://app.lemon16.app",
    }
    
    if envOrigins := os.Getenv("ALLOWED_ORIGINS"); envOrigins != "" {
        allowOrigins = append(allowOrigins, strings.Split(envOrigins, ",")...)
    }

    originMap := make(map[string]bool)
    for _, o := range allowOrigins {
        originMap[o] = true
    }

    // CORS middleware - must be first
    router.Use(func(c *gin.Context) {
        origin := c.Request.Header.Get("Origin")
        
        // Always allow local development origins, even if the backend is running in release mode.
        // Flutter web dev servers use random localhost ports, so hard-coding the port is brittle.
        if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:") {
            c.Header("Access-Control-Allow-Origin", origin)
            c.Header("Access-Control-Allow-Credentials", "true")
            c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
            c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, Accept, X-Requested-With, X-Request-ID")
            c.Header("Access-Control-Expose-Headers", "Content-Length, Content-Type, X-Request-ID")
            c.Header("Access-Control-Max-Age", "43200")
            
            if c.Request.Method == "OPTIONS" {
                c.AbortWithStatus(204)
                return
            }
        } else if originMap[origin] {
            c.Header("Access-Control-Allow-Origin", origin)
            c.Header("Access-Control-Allow-Credentials", "true")
            c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
            c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, Accept, X-Requested-With, X-Request-ID")
            c.Header("Access-Control-Expose-Headers", "Content-Length, Content-Type, X-Request-ID")
            c.Header("Access-Control-Max-Age", "43200")
            
            if c.Request.Method == "OPTIONS" {
                c.AbortWithStatus(204)
                return
            }
        }
        
        c.Next()
    })

    // Add Request-ID middleware
    router.Use(logger.RequestIDMiddleware())

    // Add metrics middleware
    router.Use(metrics.Middleware())

    // Prometheus metrics endpoint
    router.GET("/metrics", gin.WrapH(promhttp.Handler()))

    // Serve landing page at root
    router.GET("/", func(c *gin.Context) {
        c.Data(200, "text/html; charset=utf-8", []byte(landingPageHTML))
    })

    // Serve APK download route
    router.GET("/download", func(c *gin.Context) {
        apkPaths := []string{
            "app-release.apk",
            "app.apk",
            "../mobile_app/build/app/outputs/flutter-apk/app-release.apk",
            "mobile_app/build/app/outputs/flutter-apk/app-release.apk",
        }
        for _, path := range apkPaths {
            if _, err := os.Stat(path); err == nil {
                c.FileAttachment(path, "zukaping.apk")
                return
            }
        }
        
        c.Header("Content-Description", "File Transfer")
        c.Header("Content-Disposition", "attachment; filename=zukaping-placeholder.apk")
        c.Header("Content-Type", "application/vnd.android.package-archive")
        c.Header("Content-Transfer-Encoding", "binary")
        c.Data(200, "application/vnd.android.package-archive", []byte{0x50, 0x4B, 0x05, 0x06})
    })

    // Health check endpoints
    router.GET("/health/live", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "alive"})
    })
    router.GET("/health/ready", handlers.ReadinessCheck)

    router.GET("/api/health", func(c *gin.Context) {
        c.JSON(200, gin.H{
            "status":  "ok",
            "message": "Coded API is running",
            "time":    time.Now().Unix(),
            "ws":      "WebSocket available at /ws",
            "google":  "Google OAuth available",
        })
    })

    // Public routes (no auth required) — rate limited
    public := router.Group("/api")
    public.Use(middleware.RateLimitMiddleware())
    public.POST("/signup", middleware.SignupRateLimitMiddleware(), handlers.Signup)
    public.POST("/login", middleware.LoginRateLimitMiddleware(), handlers.Login)
    public.GET("/vapid-public-key", handlers.GetVapidPublicKey)
    public.GET("/groups/invite/:code", handlers.GetGroupInfoByInviteCode)

    // Google OAuth routes
    public.GET("/google/auth-url", handlers.GetGoogleAuthURL)
    public.GET("/google/callback", handlers.GoogleOAuthCallback)
    public.POST("/google-auth", handlers.GoogleAuthWithCredential)

    // Admin login (public but rate limited)
    public.POST("/admin/login", middleware.AdminLoginRateLimitMiddleware(), handlers.AdminLogin)

    // Protected routes group
    protected := router.Group("/api")
    protected.Use(middleware.JWTAuthMiddleware())

    // Profile
    protected.GET("/me", handlers.GetMyProfile)
    protected.PUT("/me", handlers.UpdateMyProfile)
    protected.DELETE("/me", handlers.DeleteMyProfile)
    protected.GET("/user/:id", handlers.GetUser)
    protected.PUT("/me/status", handlers.UpdateUserStatus)
    protected.POST("/block", handlers.BlockUser)

    // Users
    protected.GET("/users/nearby", handlers.GetNearbyUsers)
    protected.GET("/users/search", handlers.SearchUsers)

    // Posts
    protected.POST("/post", handlers.CreatePost)
    protected.GET("/feed", handlers.GetFeed)
    protected.GET("/user/:id/posts", handlers.GetUserPosts)
    protected.GET("/my/posts", handlers.GetMyPosts)

    // Favorites
    protected.POST("/favorite", handlers.AddFavorite)
    protected.DELETE("/favorite", handlers.RemoveFavorite)
    protected.GET("/favorites", handlers.GetFavorites)

    // Matches
    protected.GET("/matches", handlers.GetMatches)

    // Exclusive Content & Pay-to-Unlock
    protected.POST("/users/me/images", handlers.UploadProfileImage)
    protected.PATCH("/users/me/images/:id", handlers.UpdateProfileImage)
    protected.DELETE("/users/me/images/:id", handlers.DeleteProfileImage)
    protected.GET("/users/:id/profile", handlers.GetUserProfile)
    protected.POST("/content/:image_id/unlock", handlers.UnlockContent)
    protected.GET("/content/:image_id/status", handlers.CheckUnlockStatus)

    // Chats
    protected.GET("/chats", handlers.GetChatList)
    protected.POST("/chats", handlers.CreateChat)
    protected.GET("/chats/:id", handlers.GetChat)
    protected.PUT("/chats/:id", handlers.UpdateGroupChat)
    protected.POST("/chats/:id/admin", handlers.PromoteToAdmin)
    protected.DELETE("/chats/:id/participants/:userId", handlers.RemoveGroupMember)
    protected.POST("/chats/:id/invite", handlers.GenerateGroupInviteCode)
    protected.POST("/groups/join", handlers.JoinGroupByInviteCode)
    protected.POST("/chats/:id/participants", handlers.AddGroupMember)

    // Messages
    protected.POST("/message", handlers.SendMessage)
    protected.GET("/messages/:id", handlers.GetMessages)
    protected.POST("/messages/:id/read", handlers.MarkAsRead)
    protected.POST("/typing", handlers.SendTypingIndicator)
    protected.POST("/messages/:id/react", handlers.ReactToMessage)

    // Photo upload
    protected.POST("/upload-photo", handlers.UploadPhoto)

    // Referral
    protected.GET("/me/referral", handlers.GetReferral)

    // Push subscriptions
    protected.POST("/subscribe", handlers.SubscribePush)

    // Rooms discovery & join routes
    protected.GET("/rooms", handlers.ListRooms)
    protected.GET("/rooms/:id", handlers.GetRoomDetails)
    protected.POST("/rooms/:id/join", handlers.JoinRoom)
    protected.DELETE("/rooms/:id/leave", handlers.LeaveRoom)

    // -------- ADMIN API --------
    admin := router.Group("/api/admin")
    admin.Use(middleware.JWTAuthMiddleware())
    admin.Use(middleware.AdminAuthMiddleware())

    // Audit log
    admin.GET("/audit-logs", handlers.AdminGetAuditLogs)

    // Statistics & analytics
    admin.GET("/stats/overview", handlers.AdminGetOverview)
    admin.GET("/stats/trends", handlers.AdminGetTrends)

    // User management
    admin.GET("/users", handlers.AdminListUsers)
    admin.GET("/users/:id", handlers.AdminGetUser)
    admin.PATCH("/users/:id/status", handlers.AdminUpdateUserStatus)
    admin.PATCH("/users/:id/role", handlers.AdminUpdateUserRole)
    admin.DELETE("/users/:id", handlers.AdminDeleteUser)

    // Content moderation
    admin.GET("/posts", handlers.AdminListPosts)
    admin.DELETE("/posts/:id", handlers.AdminDeletePost)
    admin.GET("/messages", handlers.AdminListMessages)
    admin.DELETE("/messages/:id", handlers.AdminDeleteMessage)
    admin.GET("/chats", handlers.AdminListChats)
    admin.GET("/chats/:id", handlers.AdminGetChat)
    admin.DELETE("/chats/:id", handlers.AdminDeleteChat)
    admin.GET("/rooms", handlers.AdminListRooms)

    // Engagement & commerce
    admin.GET("/favorites", handlers.AdminListFavorites)
    admin.GET("/purchases", handlers.AdminListPurchases)

    // Serve the admin dashboard SPA
    adminSub, err := fs.Sub(adminFS, "admin")
    if err == nil {
        adminHandler := http.StripPrefix("/admin", http.FileServer(http.FS(adminSub)))
        router.GET("/admin", func(c *gin.Context) {
            c.Redirect(302, "/admin/")
        })
        router.GET("/admin/*filepath", func(c *gin.Context) {
            // SPA: serve index.html for hash-routed paths
            p := c.Param("filepath")
            if p == "/" || p == "" {
                c.Data(200, "text/html; charset=utf-8", mustRead(adminFS, "admin/index.html"))
                return
            }
            if strings.HasSuffix(p, ".css") || strings.HasSuffix(p, ".js") {
                adminHandler.ServeHTTP(c.Writer, c.Request)
                return
            }
            c.Data(200, "text/html; charset=utf-8", mustRead(adminFS, "admin/index.html"))
        })
    }

    // Add a catch-all for undefined API routes
    router.NoRoute(func(c *gin.Context) {
        // If it's an API route, return JSON 404
        if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
            c.JSON(404, gin.H{
                "error":   "Endpoint not found",
                "path":    c.Request.URL.Path,
                "message": "Check the API documentation for available endpoints",
            })
            return
        }
        // For WebSocket routes
        if c.Request.URL.Path == "/ws" {
            c.JSON(404, gin.H{
                "error":   "WebSocket endpoint not found",
                "path":    c.Request.URL.Path,
            })
            return
        }
        // For non-API routes, let Gin handle it
        c.Next()
    })

    return router
}
