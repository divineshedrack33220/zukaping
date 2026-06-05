# Zukaping

A modern, real-time social discovery and chat application built with Flutter and Go.

[![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat&logo=flutter&logoColor=white)](https://flutter.dev/)
[![Go](https://img.shields.io/badge/Go-00ADD8?style=flat&logo=go&logoColor=white)](https://go.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Gin](https://img.shields.io/badge/Gin-00ADD8?style=flat&logo=go&logoColor=white)](https://gin-gonic.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Overview

Zukaping connects people through location-based discovery and real-time messaging. Built as a full-stack application with a Flutter frontend (Android, iOS, Web) and a Go/Gin backend with WebSocket support for instant messaging.

**Key capabilities:**
- Real-time 1-on-1 and group chat
- Location-based user discovery
- JWT authentication with Google OAuth
- Push notifications (VAPID)
- Exclusive content with pay-to-unlock
- Offline-first caching

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Flutter 3.x (Dart) |
| **State** | `setState` + `Provider` |
| **Storage** | `SharedPreferences` |
| **Networking** | `http` + `web_socket_channel` |
| **Backend** | Go 1.21+ / Gin |
| **Database** | MongoDB (mongo-driver) |
| **Real-time** | `gorilla/websocket` |
| **Auth** | `golang-jwt` (HS256), `bcrypt` |
| **Push** | `webpush-go` (VAPID) |

---

## Architecture

```
┌─────────────┐     HTTPS/WSS      ┌─────────────┐     MongoDB      ┌─────────────┐
│   Client    │ ◄────────────────► │   Backend   │ ◄──────────────► │  Database   │
│  (Flutter)  │   REST + WebSocket │   (Go/Gin)  │   mongo-driver   │  (MongoDB)  │
└─────────────┘                    └─────────────┘                  └─────────────┘
```

### Client Layer (Flutter)
- **State:** Local `setState` + `Provider` for theme/notifications
- **Persistence:** `SharedPreferences` for tokens, cached feeds/chats/messages
- **Networking:** `http` for REST, `web_socket_channel` for real-time
- **Offline-first:** Instant cached loads with background sync

### API Layer (Go/Gin)
- **REST endpoints** organized by domain (auth, users, posts, chats, favorites, rooms, content)
- **JWT middleware** (HS256) extracts `userId` into request context
- **CORS** configured for localhost, Render, and custom origins
- **Multipart** file upload for images

### Real-Time Layer (WebSocket Hub)
Central `Manager` with per-client goroutines:
- **Registry:** `map[*Client]bool` with `userID` tracking
- **Broadcast:** Fan-out to all connected clients
- **Message types:** `new_message`, `new_request`, `typing_start/end`, `message_read`, `message_reaction`, `user_status_update`, `room_update`, `subscribe_chat`, `ping/pong`

### Data Layer (MongoDB)
| Collection | Key Indexes |
|------------|-------------|
| `users` | `email` (unique), `location` (2dsphere), `status+updatedAt` |
| `chats` | `participants`, `isGroup+updatedAt` |
| `messages` | `chatId+createdAt`, `senderId+createdAt` |
| `posts` | `createdAt`, `location` (2dsphere), `expiresAt` (TTL) |
| `favorites` | `userId+targetUserId` (unique) |
| `rooms` | `isActive+createdAt`, `members.userId` |
| `purchases` | `userId+imageId` (unique) |

**Background workers:** Post cleanup (50-day TTL, every 12h), Room auto-leave (7-day inactivity).

---

## Project Structure

```
lemon16/
├── backend/
│   ├── main.go                    # Entry point, DB, WS hub, HTTP server
│   ├── database/database.go       # MongoDB connection
│   ├── handlers/                  # HTTP handlers by domain
│   │   ├── auth.go, user.go, post.go, chat.go, message.go
│   │   ├── favorite.go, room.go, content.go, google_auth.go, push.go
│   ├── middleware/
│   │   ├── auth.go, ratelimit.go
│   ├── models/                    # Go structs (User, Chat, Message, Post, Room...)
│   ├── routes/routes.go           # Gin router, CORS, endpoint map
│   └── websocket/manager.go       # WS hub, client registry, broadcast
│
├── mobile_app/
│   ├── lib/
│   │   ├── main.dart              # App entry, theme, routing
│   │   ├── models/                # Dart models
│   │   ├── screens/               # UI screens (feed, chat, profile, auth...)
│   │   ├── services/
│   │   │   ├── api_service.dart       # REST client, failover
│   │   │   ├── websocket_service.dart # WS connection, reconnection
│   │   │   ├── notification_service.dart
│   │   │   ├── theme_service.dart
│   │   │   └── sound_service.dart
│   │   ├── widgets/               # Reusable components
│   │   └── utils/helpers.dart     # JWT decode, base64url utils
│   └── pubspec.yaml
```

---

## Getting Started

### Prerequisites
- Flutter SDK 3.0+
- Go 1.19+
- MongoDB (local or Atlas)

### Backend

```bash
cd backend
go mod download
cp .env.example .env   # Add MONGODB_URI, JWT_SECRET
go run main.go
# Runs on http://localhost:8080
```

### Frontend

```bash
cd mobile_app
flutter pub get
flutter run -d chrome   # or -d android / -d ios
```

---

## Environment Variables

### Backend (`.env`)
```env
PORT=8080
GIN_MODE=release
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secure-random-string
ALLOWED_ORIGINS=https://your-frontend.com
VAPID_PRIVATE_KEY=...
VAPID_PUBLIC_KEY=...
```

### Frontend
Configure `API_URL` at build time:
```bash
flutter build web --dart-define=API_URL=https://your-backend.com/api
```

---

## Authentication Flow

```
Client                    Backend
  │                          │
  ├─ POST /api/login ──────► │
  │                          ├─ Validate credentials
  │                          ├─ Create JWT (HS256, 7d expiry)
  │ ◄─ { token, userId }────┤
  │                          │
  ├─ WS /ws?token=... ─────► │
  │                          ├─ Validate JWT on handshake
  │                          └─ Register client in WS Manager
```

---

## Server Failover (Client-Side)

`ApiService.initActiveUrl()` runs at startup:
1. Candidates: `[local, zukaping.onrender.com, lemon16.onrender.com]`
2. Ping `/health` with 1.5s timeout
3. First 200 OK → active server
4. Fallback: retry production with 4s timeout
5. `switchServer()` toggles to next production URL on failure

---

## Push Notifications

- VAPID keys generated at startup
- Public key via `GET /api/vapid-public-key`
- Client subscribes via `POST /api/subscribe`
- Server sends via `webpush-go` on: new message, new request, mention, group invite

---

## Deployment

### Backend (Render/Heroku/Fly.io)
```bash
go build -o server main.go
# Set env vars, run ./server
```

### Frontend Web (Vercel/Firebase/Netlify)
```bash
flutter build web --release --dart-define=API_URL=https://api.yourapp.com/api
# Deploy build/web/
```

### Android
```bash
flutter build apk --release
# Upload build/app/outputs/flutter-apk/app-release.apk
```

### iOS
```bash
flutter build ios --release
# Open Runner.xcworkspace in Xcode, archive & upload
```

---

## API Reference

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signup` | Register |
| `POST` | `/api/login` | Login |
| `POST` | `/api/google-auth` | Google OAuth |
| `GET` | `/api/vapid-public-key` | Push public key |
| `GET` | `/api/health` | Health check |

### Protected (Bearer token required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me` | Current user profile |
| `PUT` | `/api/me` | Update profile |
| `GET` | `/api/feed` | Nearby posts |
| `POST` | `/api/post` | Create post |
| `GET` | `/api/chats` | User's chats |
| `POST` | `/api/chats` | Create chat |
| `GET` | `/api/messages/:id` | Chat messages |
| `POST` | `/api/message` | Send message |
| `GET` | `/api/users/nearby` | Nearby users |
| `POST` | `/api/favorite` | Toggle favorite |
| `GET` | `/api/rooms` | List rooms |
| `POST` | `/api/rooms/:id/join` | Join room |

### WebSocket
Connect: `wss://your-backend.com/ws?token=<JWT>`

Send: `{"type": "subscribe_chat", "payload": {"chatId": "..."}}`

Receive: `{"type": "new_message", "payload": {...}}`

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Architecture Flow Diagrams

### 1. System Overview

```mermaid
graph TB
    subgraph Client["📱 Client Layer (Flutter)"]
        UI[UI Screens]
        State[State Management\nsetState + Provider]
        Cache[SharedPreferences Cache]
        HTTP[HTTP Client\napi_service.dart]
        WS[WebSocket Client\nwebsocket_service.dart]
        Notif[Notifications\nnotification_service.dart]
    end

    subgraph Backend["🖥️ Backend Layer (Go/Gin)"]
        Router[Gin Router\nroutes.go]
        AuthMW[JWT Middleware\nauth.go]
        Handlers[Domain Handlers]
        WSManager[WS Manager\nmanager.go]
        ClientRegistry[Client Registry]
        Broadcast[Broadcast Channel]
    end

    subgraph Database["🗄️ Data Layer (MongoDB)"]
        Users[(users)]
        Chats[(chats)]
        Messages[(messages)]
        Posts[(posts)]
        Favorites[(favorites)]
        Rooms[(rooms)]
        Purchases[(purchases)]
    end

    UI --> State
    State --> Cache
    State --> HTTP
    State --> WS
    State --> Notif
    
    HTTP -->|REST| Router
    WS -->|WSS| Router
    
    Router --> AuthMW
    AuthMW --> Handlers
    Router --> WSManager
    
    WSManager --> ClientRegistry
    WSManager --> Broadcast
    Handlers -->|mongo-driver| Database
    WSManager --> Handlers
    
    Handlers --> Users
    Handlers --> Chats
    Handlers --> Messages
    Handlers --> Posts
    Handlers --> Favorites
    Handlers --> Rooms
    Handlers --> Purchases
```

---

### 2. Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant B as Backend
    participant DB as MongoDB
    
    Note over C,B: Email/Password Login
    C->>B: POST /api/login {email, password}
    B->>DB: Find user by email
    DB-->>B: User document
    B->>B: bcrypt.CompareHashAndPassword()
    alt Valid credentials
        B->>B: Generate JWT (HS256, userId, exp=7d)
        B-->>C: {token, userId}
        C->>C: Store token in SharedPreferences
        C->>B: WS Connect /ws?token=JWT
        B->>B: Validate JWT on handshake
        B->>WSManager: Register client
        WSManager-->>C: {type: "connected", payload: {userId}}
    else Invalid credentials
        B-->>C: 401 {error: "Invalid email or password"}
    end
    
    Note over C,B: Google OAuth
    C->>Google: Sign in → idToken
    C->>B: POST /api/google-auth {credential: idToken}
    B->>Google: Verify idToken
    Google-->>B: User info (email, name, picture)
    B->>DB: Find or create user
    DB-->>B: User document
    B->>B: Generate JWT
    B-->>C: {token, userId, isNewUser}
```

---

### 3. Real-Time Messaging Flow

```mermaid
sequenceDiagram
    participant A as User A
    participant WS as WS Manager
    participant B as User B
    participant H as Handlers
    participant DB as MongoDB
    
    Note over A,B: Send Message
    A->>WS: {type: "message", payload: {chatId, content}}
    WS->>H: Forward to SendMessage handler
    H->>DB: Insert message
    DB-->>H: Message with _id
    H->>WS: BroadcastNewMessage(message)
    WS->>A: {type: "new_message", payload: message}
    WS->>B: {type: "new_message", payload: message}
    B->>WS: {type: "message_read", payload: {chatId, messageIds}}
    WS->>A: {type: "message_read", payload: {chatId, messageIds, userId: B}}
    
    Note over A,B: Typing Indicators
    A->>WS: {type: "typing_start", payload: {chatId}}
    WS->>B: {type: "typing_start", payload: {chatId, userId: A}}
    A->>WS: {type: "typing_end", payload: {chatId}}
    WS->>B: {type: "typing_end", payload: {chatId, userId: A}}
    
    Note over A,B: Reactions
    A->>WS: {type: "react", payload: {messageId, emoji}}
    WS->>H: Update message reactions
    H->>DB: Update message
    WS->>A: {type: "message_reaction", payload: {messageId, reactions}}
    WS->>B: {type: "message_reaction", payload: {messageId, reactions}}
```

---

### 4. Feed & Discovery Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as ApiService
    participant B as Backend
    participant DB as MongoDB
    
    Note over C,DB: Load Feed (with offline cache)
    C->>A: getFeed()
    A->>Cache: Check cached_feed
    alt Cache hit
        Cache-->>A: Cached posts
        A-->>C: Cached posts (instant)
    end
    A->>B: GET /api/feed
    B->>DB: Find nearby posts (geospatial)
    DB-->>B: Posts with distance
    B-->>A: Posts JSON
    A->>Cache: Save to cached_feed
    A-->>C: Fresh posts
    
    Note over C,DB: Nearby Users
    C->>A: getNearbyUsers(lat, lng)
    A->>B: GET /api/users/nearby?lat=x&lng=y
    B->>DB: GeoNear query (2dsphere)
    DB-->>B: Users with distance
    B-->>A: Users JSON
    A-->>C: Nearby users
    
    Note over C,DB: Create Post
    C->>A: createPost(data)
    A->>B: POST /api/post
    B->>DB: Insert post with location
    DB-->>B: Post document
    B->>WS: BroadcastNewRequest(post)
    WS->>Nearby: {type: "new_request", payload: post}
```

---

### 5. Chat Creation & Group Management

```mermaid
sequenceDiagram
    participant A as User A
    participant B as User B
    participant WS as WS Manager
    participant H as Handlers
    participant DB as MongoDB
    
    Note over A,B: 1-on-1 Chat
    A->>H: POST /api/chats {participants: [B]}
    H->>DB: Find existing chat
    alt Chat exists
        DB-->>H: Existing chat
    else New chat
        H->>DB: Insert chat
        DB-->>H: New chat
        H->>WS: BroadcastChatCreated(chat)
        WS->>A: {type: "chat_created", payload: chat}
        WS->>B: {type: "chat_created", payload: chat}
    end
    H-->>A: Chat
    
    Note over A,B: Group Chat
    A->>H: POST /api/chats {participants: [...], isGroup: true, groupName}
    H->>DB: Insert group chat
    DB-->>H: Group chat
    H->>WS: BroadcastChatCreated(chat)
    WS->>All: {type: "chat_created", payload: chat}
    
    Note over A,B: Group Admin Actions
    A->>H: POST /api/chats/:id/admin {targetUserId}
    H->>DB: Update adminIds
    H->>WS: BroadcastRoomUpdate({chatId, adminIds})
    WS->>All: {type: "room_update", payload: {...}}
```

---

### 6. WebSocket Connection Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connecting: WS Connect\n/ws?token=JWT
    Connecting --> Authenticated: JWT Valid
    Connecting --> Disconnected: JWT Invalid / Timeout
    
    Authenticated --> Registered: Manager.register(client)
    Registered --> Active: Welcome message sent
    
    Active --> Subscribed: subscribe_chat {chatId}
    Subscribed --> Active: Chat subscription confirmed
    
    Active --> Typing: typing_start {chatId}
    Typing --> Active: typing_end {chatId} / timeout
    
    Active --> Receiving: new_message broadcast
    Receiving --> Active: Message delivered
    
    Active --> Disconnected: Network error / Close
    Disconnected --> Reconnecting: Auto-reconnect (5s)
    Reconnecting --> Connecting: Retry connection
    
    Disconnected --> [*]: App terminate / Logout
```

---

### 7. Server Failover (Client-Side)

```mermaid
flowchart TD
    Start[App Startup] --> Init[ApiService.initActiveUrl]
    Init --> Cand[Candidates: local, zukaping, lemon16]
    Cand --> Ping[Ping /health 1.5s timeout]
    Ping --> OK{200 OK?}
    OK -->|Yes| Active[Set _activeBaseUrl / Return]
    OK -->|No| Next[Next candidate]
    Next --> Ping
    
    Active --> Runtime[Normal Operation]
    Runtime --> Request[API Request]
    Request --> Fail{Request Failed?}
    Fail -->|No| Runtime
    Fail -->|Yes| Switch[switchServer]
    Switch --> Toggle[Toggle to next production URL]
    Toggle --> Retry[Retry Request]
    Retry --> Runtime
    
    Ping -.->|All fail| LongPing[Longer ping 4s timeout]
    LongPing --> LongOK{200 OK?}
    LongOK -->|Yes| Active
    LongOK -->|No| Default[Default: local/debug or first/production]
    Default --> Active
```

---

### 8. Push Notification Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant B as Backend
    participant V as VAPID
    participant P as Push Service\n(FCM/APNs)
    participant DB as MongoDB
    
    Note over C,B: Subscription
    C->>B: GET /api/vapid-public-key
    B-->>C: VAPID public key
    C->>C: Generate push subscription
    C->>B: POST /api/subscribe {endpoint, keys}
    B->>DB: Save subscription
    
    Note over C,B: Trigger (New Message)
    UserX->>B: Send message to UserY
    B->>DB: Check UserY subscriptions
    DB-->>B: Push subscriptions
    B->>V: Sign payload with VAPID private key
    V->>P: Encrypted push
    P->>C: Display notification
    C->>B: App opens → mark read
```

---

### 9. Data Models Relationship

```mermaid
erDiagram
    USERS ||--o{ CHATS : participates
    USERS ||--o{ MESSAGES : sends
    USERS ||--o{ POSTS : creates
    USERS ||--o{ FAVORITES : favorites
    USERS ||--o{ FAVORITES : favorited_by
    USERS ||--o{ ROOMS : joins
    USERS ||--o{ PURCHASES : purchases
    
    CHATS ||--o{ MESSAGES : contains
    CHATS ||--o{ USERS : participants
    CHATS {
        string id PK
        bool isGroup
        string groupName
        string groupAvatar
        string groupDescription
        array adminIds
        array participants
        datetime updatedAt
    }
    
    MESSAGES {
        string id PK
        string chatId FK
        string senderId FK
        string content
        string type
        map reactions
        string replyToId
        datetime createdAt
        bool isRead
    }
    
    POSTS {
        string id PK
        string userId FK
        string content
        array media
        point location
        datetime createdAt
        datetime expiresAt
    }
    
    FAVORITES {
        string userId FK
        string targetUserId FK
        datetime createdAt
    }
    
    ROOMS {
        string id PK
        string name
        string description
        string avatarUrl
        int maxMembers
        bool isActive
        array members
        datetime createdAt
    }
    
    PURCHASES {
        string userId FK
        string imageId
        number price
        string currency
        datetime createdAt
    }
    
    USERS {
        string id PK
        string email UK
        string username UK
        string name
        string avatar
        array photos
        string bio
        point location
        string status
        bool isOnline
        datetime lastSeen
        array interests
    }
```

---

### 10. Background Workers

```mermaid
graph LR
    subgraph Workers["Background Workers (Go)"]
        PC[Post Cleanup\nEvery 12h]
        RL[Room Auto-Leave\nPeriodic]
    end
    
    subgraph DB["MongoDB"]
        Posts[(posts)]
        Rooms[(rooms)]
    end
    
    PC -->|Delete posts\ncreatedAt < now-50d| Posts
    RL -->|Remove members\ninactive > 7d| Rooms
    
    style PC fill:#f9f,stroke:#333
    style RL fill:#bbf,stroke:#333
```

---

## Support

- **Issues:** [GitHub Issues](https://github.com/divineshedrack33220/zukaping/issues)
- **Discussions:** [GitHub Discussions](https://github.com/divineshedrack33220/zukaping/discussions)