package database

import (
    "context"
    "log"
    "os"
    "time"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

var (
    Client *mongo.Client
    DB     *mongo.Database
)

func ConnectDB() error {
    mongoURI := os.Getenv("MONGODB_URI")
    if mongoURI == "" {
        mongoURI = "mongodb://localhost:27017"
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    clientOptions := options.Client().ApplyURI(mongoURI)
    client, err := mongo.Connect(ctx, clientOptions)
    if err != nil {
        return err
    }

    // Ping the database
    err = client.Ping(ctx, nil)
    if err != nil {
        return err
    }

    Client = client
    DB = client.Database("coded")
    
    log.Println("Connected to MongoDB successfully")
    
    // Create indexes
    CreateIndexes()
    
    return nil
}

func GetCollection(collectionName string) *mongo.Collection {
    return DB.Collection(collectionName)
}

func CreateIndexes() {
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // Users collection indexes
    usersColl := DB.Collection("users")
    usersIndexes := []mongo.IndexModel{
        {
            Keys:    bson.D{{Key: "email", Value: 1}},
            Options: options.Index().SetUnique(true),
        },
        {
            Keys:    bson.D{{Key: "username", Value: 1}},
            Options: options.Index().SetUnique(true).SetSparse(true),
        },
        {
            Keys: bson.D{{Key: "location", Value: "2dsphere"}},
        },
        {
            Keys: bson.D{{Key: "lastSeen", Value: -1}},
        },
    }

    // Chats collection indexes - FIXED: Use unique name to avoid conflict
    chatsColl := DB.Collection("chats")
    chatsIndexes := []mongo.IndexModel{
        {
            Keys:    bson.D{{Key: "participants", Value: 1}},
            Options: options.Index().SetUnique(true).SetName("unique_participants"),
        },
        {
            Keys: bson.D{{Key: "lastMessageAt", Value: -1}},
        },
    }

    // Messages collection indexes
    messagesColl := DB.Collection("messages")
    messagesIndexes := []mongo.IndexModel{
        {
            Keys: bson.D{{Key: "chatId", Value: 1}, {Key: "createdAt", Value: -1}},
        },
        {
            Keys: bson.D{{Key: "senderId", Value: 1}},
        },
        {
            Keys: bson.D{{Key: "createdAt", Value: -1}},
        },
    }

    // Favorites collection indexes
    favoritesColl := DB.Collection("favorites")
    favoritesIndexes := []mongo.IndexModel{
        {
            Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "targetUserId", Value: 1}},
            Options: options.Index().SetUnique(true),
        },
        {
            Keys: bson.D{{Key: "createdAt", Value: -1}},
        },
    }

    // Posts collection indexes
    postsColl := DB.Collection("posts")
    postsIndexes := []mongo.IndexModel{
        {
            Keys: bson.D{{Key: "userId", Value: 1}},
        },
        {
            Keys: bson.D{{Key: "createdAt", Value: -1}},
        },
        {
            Keys: bson.D{{Key: "category", Value: 1}},
        },
    }

    // Create all indexes
    if _, err := usersColl.Indexes().CreateMany(ctx, usersIndexes); err != nil {
        log.Printf("Error creating users indexes: %v", err)
    }

    if _, err := chatsColl.Indexes().CreateMany(ctx, chatsIndexes); err != nil {
        log.Printf("Error creating chats indexes: %v", err)
    }

    if _, err := messagesColl.Indexes().CreateMany(ctx, messagesIndexes); err != nil {
        log.Printf("Error creating messages indexes: %v", err)
    }

    if _, err := favoritesColl.Indexes().CreateMany(ctx, favoritesIndexes); err != nil {
        log.Printf("Error creating favorites indexes: %v", err)
    }

    if _, err := postsColl.Indexes().CreateMany(ctx, postsIndexes); err != nil {
        log.Printf("Error creating posts indexes: %v", err)
    }

    // Rooms indexes
    roomsColl := DB.Collection("rooms")
    roomsIndexes := []mongo.IndexModel{
        {
            Keys: bson.D{{Key: "category", Value: 1}},
        },
        {
            Keys: bson.D{{Key: "is_trending", Value: 1}},
        },
    }
    if _, err := roomsColl.Indexes().CreateMany(ctx, roomsIndexes); err != nil {
        log.Printf("Error creating rooms indexes: %v", err)
    }

    // Room memberships unique index
    membershipsColl := DB.Collection("room_memberships")
    membershipsIndexes := []mongo.IndexModel{
        {
            Keys:    bson.D{{Key: "room_id", Value: 1}, {Key: "user_id", Value: 1}},
            Options: options.Index().SetUnique(true),
        },
        {
            Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "is_active", Value: 1}},
        },
    }
    if _, err := membershipsColl.Indexes().CreateMany(ctx, membershipsIndexes); err != nil {
        log.Printf("Error creating room memberships indexes: %v", err)
    }

    // Content purchases unique index
    purchasesColl := DB.Collection("content_purchases")
    purchasesIndexes := []mongo.IndexModel{
        {
            Keys:    bson.D{{Key: "buyer_id", Value: 1}, {Key: "image_id", Value: 1}},
            Options: options.Index().SetUnique(true),
        },
    }
    if _, err := purchasesColl.Indexes().CreateMany(ctx, purchasesIndexes); err != nil {
        log.Printf("Error creating content purchases indexes: %v", err)
    }

    log.Println("Database indexes created successfully")

    // Run Room Seeder
    SeedRooms(ctx)
}

// SeedRooms seeds the 10 pre-seeded rooms if they do not exist and maps them to chats
func SeedRooms(ctx context.Context) {
    roomsColl := DB.Collection("rooms")
    chatsColl := DB.Collection("chats")

    count, err := roomsColl.CountDocuments(ctx, bson.M{})
    if err != nil {
        log.Printf("❌ Failed to check room count: %v", err)
        return
    }

    if count > 0 {
        log.Println("🌳 Rooms are already seeded.")
        return
    }

    log.Println("🌱 Seeding pre-defined system rooms...")

    preSeeded := []bson.M{
        {
            "name":        "Club house",
            "description": "The ultimate party spot for late-night music, vibes, and premium networking.",
            "avatar_url":  "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=150",
            "category":    "social",
            "max_members": 50,
            "tags":        bson.A{"nightlife", "hangout"},
        },
        {
            "name":        "Home alone",
            "description": "Chill hangout room for people looking for comfortable conversation and friendly company.",
            "avatar_url":  "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=150",
            "category":    "social",
            "max_members": 30,
            "tags":        bson.A{"chill", "company"},
        },
        {
            "name":        "Bored & horney",
            "description": "A place for spicy midnight dating talks, flirtatious banters, and match finding (18+ only).",
            "avatar_url":  "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=150",
            "category":    "dating",
            "max_members": 40,
            "tags":        bson.A{"18+", "casual"},
            "is_trending": true,
        },
        {
            "name":        "Remote jobs",
            "description": "Professional network for remote developers, designers, and digital nomads seeking advice.",
            "avatar_url":  "https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?w=150",
            "category":    "professional",
            "max_members": 100,
            "tags":        bson.A{"work", "networking"},
        },
        {
            "name":        "Late night vibe",
            "description": "For those awake in the dead of night. Share stories, music, and cozy late-night conversations.",
            "avatar_url":  "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=150",
            "category":    "social",
            "max_members": 50,
            "tags":        bson.A{"night", "chat"},
        },
        {
            "name":        "Vibes",
            "description": "Pure positive energy. Share your favorite music, art, and good vibes with other beautiful souls.",
            "avatar_url":  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150",
            "category":    "social",
            "max_members": 50,
            "tags":        bson.A{"music", "mood"},
            "is_trending": true,
        },
        {
            "name":        "Truth or dare",
            "description": "Ready to play? Let's have a dynamic session of spicy party games. Choose wisely!",
            "avatar_url":  "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=150",
            "category":    "games",
            "max_members": 30,
            "tags":        bson.A{"party", "spicy"},
        },
        {
            "name":        "Business & networking",
            "description": "Elevate your career. Network with developers, business owners, and startup founders.",
            "avatar_url":  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=150",
            "category":    "professional",
            "max_members": 80,
            "tags":        bson.A{"career", "connect"},
        },
        {
            "name":        "Relationship & cruise",
            "description": "Dating, matchmaking, serious relationships, and general fun/banter.",
            "avatar_url":  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
            "category":    "dating",
            "max_members": 40,
            "tags":        bson.A{"serious", "match"},
        },
        {
            "name":        "Adult Class",
            "description": "Advanced educational talks, mature learning, lifestyle advice, and deep sharing (18+).",
            "avatar_url":  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=150",
            "category":    "education",
            "max_members": 60,
            "tags":        bson.A{"18+", "learning"},
        },
    }

    for _, r := range preSeeded {
        roomID := primitive.NewObjectID()
        r["_id"] = roomID
        r["current_members"] = 0
        r["created_by"] = "system"
        r["created_at"] = time.Now()
        if r["is_trending"] == nil {
            r["is_trending"] = false
        }

        // Insert Room
        _, err = roomsColl.InsertOne(ctx, r)
        if err != nil {
            log.Printf("❌ Failed to seed room %s: %v", r["name"], err)
            continue
        }

        // Create Mirror Chat document with same ObjectID in 'chats' collection
        mirrorChat := bson.M{
            "_id":              roomID,
            "participants":     primitive.A{}, // no joined participants initially
            "lastMessageAt":    time.Now().Unix(),
            "createdAt":        time.Now().Unix(),
            "isGroup":          true,
            "groupName":        r["name"],
            "groupAvatar":      r["avatar_url"],
            "groupDescription": r["description"],
            "adminIds":         primitive.A{},
            "inviteCode":       "",
        }

        _, err = chatsColl.InsertOne(ctx, mirrorChat)
        if err != nil {
            log.Printf("❌ Failed to seed mirror Chat for room %s: %v", r["name"], err)
        }
    }

    log.Println("✅ Successfully seeded 10 system rooms and mirror chats!")
}