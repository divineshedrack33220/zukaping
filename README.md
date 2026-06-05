<div align="center">
  
  # 🍋 Zukaping
  
  **A Modern, Real-Time Social Discovery & Chat Application**
  
  [![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev/)
  [![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![Gin Framework](https://img.shields.io/badge/Gin-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://gin-gonic.com/)
  
  [Features](#sparkles-features) • [Tech Stack](#hammer_and_wrench-tech-stack) • [Getting Started](#rocket-getting-started) • [Architecture](#triangular_ruler-architecture)
</div>

---

## 📖 Overview

Zukaping is a full-stack, real-time social application built to connect people. Whether you're looking for friends nearby, matching based on interests, or engaging in live text and group chats, Zukaping provides a seamless, lightning-fast experience across Android, iOS, and the Web. 

The platform features a highly optimized **Go/Gin backend** communicating over WebSockets for zero-latency messaging, paired with a beautiful, glassmorphism-inspired **Flutter front-end**.

## ✨ Features

- **🔐 Secure Authentication:** JWT-based auth with support for Google Sign-In and standard Email/Password.
- **📍 Location-Based Discovery:** Find and match with users nearby using geospatial queries.
- **💬 Real-Time Chat Engine:** 1-on-1 and Group messaging powered by highly concurrent Go WebSockets.
- **📸 Dynamic Profiles:** Customizable user profiles, photo galleries, and interest tags.
- **🔔 Push Notifications:** Integrated VAPID-based push notifications so you never miss a message.
- **🎨 Premium UI/UX:** A state-of-the-art Flutter UI featuring glassmorphism, fluid animations, and responsive layouts.
- **🗑️ Account Management:** Full data autonomy, including secure account deletion and cache invalidation.

## 🔨 Tech Stack

### Frontend (Mobile & Web)
- **Framework:** [Flutter](https://flutter.dev/) (Dart)
- **State Management:** Provider / Local setState
- **Local Storage:** SharedPreferences
- **Networking:** HTTP (REST API) & WebSockets (`web_socket_channel`)
- **Assets:** CachedNetworkImage, Custom SVG Icons

### Backend (API & WebSockets)
- **Language:** [Go (Golang)](https://go.dev/)
- **Framework:** [Gin Web Framework](https://gin-gonic.com/)
- **Database:** [MongoDB](https://www.mongodb.com/) (using the official `mongo-driver`)
- **Real-Time:** Native Go WebSockets (`gorilla/websocket`)
- **Security:** `golang-jwt` for tokens, `bcrypt` for password hashing

### Infrastructure & Deployment
- **Database Hosting:** MongoDB Atlas
- **Backend Hosting:** Render / Heroku
- **Frontend Hosting:** Vercel / Firebase Hosting (Web), Google Play Store (Android)

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (v3.0+)
- [Go](https://go.dev/doc/install) (v1.19+)
- [MongoDB](https://www.mongodb.com/try/download/community) (Local or Atlas Cluster)

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
go mod download

# Set up your environment variables
cp .env.example .env
# Edit .env and add your MONGODB_URI and JWT_SECRET

# Run the Go server
go run main.go
```
*The backend will start running on `http://localhost:10000`.*

### 2. Mobile / Web App Setup

```bash
# Navigate to the mobile app directory
cd mobile_app

# Get Flutter packages
flutter pub get

# Run on your connected device or web browser
flutter run -d chrome
# or 
flutter run -d android
```

---

## 📐 Architecture

Zukaping uses a scalable, decoupled architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ZUKAPING ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     HTTPS/WSS      ┌──────────────┐     MongoDB      ┌──────────────┐
│   CLIENT     │ ◄────────────────► │   BACKEND    │ ◄──────────────► │  DATABASE    │
│  (Flutter)   │   REST + WebSocket │   (Go/Gin)   │   mongo-driver   │  (MongoDB)   │
└──────────────┘                    └──────────────┘                  └──────────────┘
       │                                  │                                  │
       │                                  │                                  │
       ▼                                  ▼                                  ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│ • State Mgmt     │            │ • API Layer      │            │ • Users          │
│   (setState/     │            │   - Auth         │            │ • Chats          │
│   Provider)      │            │   - Profile      │            │ • Messages       │
│ • SharedPrefs    │            │   - Feed/Posts   │            │ • Posts          │
│ • Cached Images  │            │   - Favorites    │            │ • Favorites      │
│ • WebSocket      │            │   - Chats        │            │ • Rooms          │
│   Service        │            │   - Rooms        │            │ • Purchases      │
└──────────────────┘            │ • WebSocket Hub  │            │ • Geospatial     │
                                │   - Presence     │            │   Indexes        │
                                │   - Broadcast    │            └──────────────────┘
                                │   - Typing/Read  │
                                │ • Background     │
                                │   Workers        │
                                └──────────────────┘
```

### 1. Client Layer (Flutter)
- **State Management:** Local `setState` + `Provider` for theme/notifications
- **Persistence:** `SharedPreferences` for JWT tokens, user cache, feed/chat/message caches
- **Networking:** `http` package for REST, `web_socket_channel` for real-time events
- **Offline-First:** Caches feed, chats, messages, favorites, nearby users for instant loads
- **UI:** Material 3 + glassmorphism, custom animations, shimmer loading

### 2. API Layer (Go/Gin)
- **REST Endpoints:** Organized by domain (auth, users, posts, chats, favorites, rooms, exclusive content)
- **Auth Middleware:** JWT validation (HS256), extracts `userId` into request context
- **CORS:** Configured for localhost, Render, and custom origins
- **Rate Limiting:** Optional middleware for abuse prevention
- **File Upload:** Multipart handling for profile/room images

### 3. Real-Time Layer (WebSocket Hub)
```
┌──────────────────────────────────────────────────────────────┐
│                    WEBSOCKET MANAGER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Register   │  │ Broadcast   │  │ Unregister  │  Channels │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│         │              │              │                        │
│         ▼              ▼              ▼                        │
│  ┌─────────────────────────────────────────────┐              │
│  │            CLIENT REGISTRY                   │              │
│  │  map[userID] -> *Client (conn, send chan)   │              │
│  └─────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

**Message Types:**
| Type | Direction | Payload | Purpose |
|------|-----------|---------|---------|
| `new_message` | Server→Client | `{chatId, message}` | Instant message delivery |
| `new_request` | Server→Client | `{post}` | New nearby post notification |
| `request_update` | Server→Client | `{post}` | Post status changes |
| `chat_created` | Server→Client | `{chat}` | New 1-on-1/group chat |
| `message_read` | Server→Client | `{chatId, messageIds, userId}` | Read receipts |
| `typing_start/end` | Bidirectional | `{chatId, userId}` | Typing indicators |
| `message_reaction` | Server→Client | `{messageId, reactions}` | Emoji reactions |
| `user_status_update` | Server→Client | `{userId, status, isOnline}` | Presence |
| `room_update` | Server→Client | `{roomId, ...}` | Room state changes |
| `subscribe_chat` | Client→Server | `{chatId}` | Join chat room |
| `ping/pong` | Bidirectional | `{time}` | Keep-alive |

### 4. Data Layer (MongoDB)
**Collections & Indexes:**
```javascript
// users
{ email: 1 } unique
{ username: 1 } unique
{ location: "2dsphere" }          // Geospatial for nearby queries
{ status: 1, updatedAt: -1 }      // Status + recency
{ isOnline: 1, lastSeen: -1 }     // Presence

// chats
{ participants: 1 }               // User's chats
{ isGroup: 1, updatedAt: -1 }     // Group listing
{ "participantsProfiles._id": 1 } // Participant lookup

// messages
{ chatId: 1, createdAt: -1 }      // Chat history pagination
{ senderId: 1, createdAt: -1 }    // User's sent messages

// posts
{ createdAt: -1 }                 // Feed ordering
{ userId: 1, createdAt: -1 }      // User's posts
{ location: "2dsphere" }          // Nearby posts
{ expiresAt: 1 }                  // TTL index for auto-expiry

// favorites
{ userId: 1, targetUserId: 1 } unique
{ userId: 1 }                     // User's favorites

// rooms
{ isActive: 1, createdAt: -1 }    // Active rooms
{ "members.userId": 1 }           // User's rooms

// purchases
{ userId: 1, imageId: 1 } unique  // Unlock records
{ imageId: 1 }                    // Content purchasers
```

**Background Workers:**
- **Post Cleanup:** Deletes posts older than 50 days (runs every 12h)
- **Room Auto-Leave:** Removes inactive members after 7 days (runs periodically)

---

## 📁 Project Structure

```
lemon16/
├── backend/
│   ├── main.go                    # Entry point, DB init, WS hub, server
│   ├── database/
│   │   └── database.go            # MongoDB connection & collections
│   ├── handlers/                  # HTTP request handlers
│   │   ├── auth.go                # Signup, login, JWT issuance
│   │   ├── user.go                # Profile, status, nearby, search
│   │   ├── post.go                # Posts/feed CRUD
│   │   ├── chat.go                # Chat CRUD, group admin
│   │   ├── message.go             # Messages, typing, reactions, read
│   │   ├── favorite.go            # Favorites toggle
│   │   ├── room.go                # Room discovery, join/leave
│   │   ├── content.go             # Exclusive images, pay-to-unlock
│   │   ├── google_auth.go         # Google OAuth flow
│   │   ├── push.go                # VAPID push subscriptions
│   │   └── common.go              # Health, test endpoints
│   ├── middleware/
│   │   ├── auth.go                # JWT validation middleware
│   │   └── ratelimit.go           # Rate limiting
│   ├── models/                    # Data structures
│   │   ├── user.go, chat.go, message.go, post.go, room.go, ...
│   ├── routes/
│   │   └── routes.go              # Gin router, CORS, endpoint mapping
│   └── websocket/
│       └── manager.go             # WS hub, client registry, broadcast
│
├── mobile_app/
│   ├── lib/
│   │   ├── main.dart              # App entry, theme, routing
│   │   ├── models/                # Dart models (User, Chat, Message, Post, Room)
│   │   ├── screens/               # UI screens
│   │   │   ├── feed_screen.dart       # Main feed with story bar, radar
│   │   │   ├── chat_screen.dart       # 1-on-1/group chat
│   │   │   ├── room_chat_screen.dart  # Room chat
│   │   │   ├── profile_screen.dart    # Profile view/edit
│   │   │   ├── login/signup/onboarding
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── api_service.dart       # REST client, server failover
│   │   │   ├── websocket_service.dart # WS connection, reconnection
│   │   │   ├── notification_service.dart # Local notifications
│   │   │   ├── theme_service.dart     # Dark/light mode
│   │   │   └── sound_service.dart     # Message sounds
│   │   ├── widgets/               # Reusable UI components
│   │   └── utils/helpers.dart     # JWT decode, base64url utils
│   └── pubspec.yaml               # Dependencies
```

---

## 🔐 Authentication Flow

```
┌─────────────┐     Email/Password      ┌─────────────┐
│   Client    │ ──────────────────────► │   Backend   │
└─────────────┘                         └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Validate   │
                                        │  + Hash pwd │
                                        └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Create JWT │◄── HS256 (JWT_SECRET)
                                        │  (userId,   │
                                        │   exp: 7d)  │
                                        └─────────────┘
                                               │
                    JWT Token (Bearer) ◄───────┘
                                               │
┌─────────────┐     WS Connect (token)  ┌─────────────┐
│   Client    │ ──────────────────────► │   Backend   │
└─────────────┘                         └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Validate   │
                                        │  JWT on WS  │
                                        │  handshake  │
                                        └─────────────┘
                                               │
                                        Register client
                                        in WS Manager
```

---

## 🌐 Server Failover Strategy (Client)

```dart
// ApiService.initActiveUrl() - Called on app startup
1. Candidate URLs: [local, zukaping.onrender.com, lemon16.onrender.com]
2. Ping /health with 1.5s timeout
3. First 200 OK → set as _activeBaseUrl
4. If none: retry production with 4s timeout
5. Fallback: local (debug) / first production (release)

// Automatic failover on request failure
ApiService.switchServer() → toggles to next production URL
```

---

## 🔔 Push Notifications

- **VAPID Keys:** Generated at startup, public key served via `/api/vapid-public-key`
- **Subscription:** Client sends endpoint + keys to `/api/subscribe`
- **Delivery:** Server uses `webpush-go` to send encrypted payloads
- **Triggers:** New message, new request, mention, group invite

---

## 📦 Deployment

### Backend (Render/Heroku)
```bash
# Build
go build -o server main.go

# Environment Variables
PORT=8080
GIN_MODE=release
MONGODB_URI=mongodb+srv://...
JWT_SECRET=super-secure-random-string
ALLOWED_ORIGINS=https://your-frontend.com
VAPID_PRIVATE_KEY=...
VAPID_PUBLIC_KEY=...
```

### Frontend (Vercel/Firebase)
```bash
flutter build web --release
# Deploy build/web/ to Vercel/Firebase
```

### Android
```bash
flutter build apk --release
# Upload build/app/outputs/flutter-apk/app-release.apk to Play Console
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/divineshedrack33220/zukaping/issues).

## 📄 License

This project is licensed under the MIT License.