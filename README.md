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
1. **Client Layer:** Flutter app manages UI state and maintains a persistent WebSocket connection for live events.
2. **API Layer:** Go/Gin handles stateless HTTP REST requests (Auth, Profile Updates, Feed Generation).
3. **Real-Time Layer:** A custom Go WebSocket Hub manages client connections, broadcasts messages, and handles presence (online/offline status).
4. **Data Layer:** MongoDB efficiently stores users, chats, messages, and geospatial index data for fast location-based queries.

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/divineshedrack33220/zukaping/issues).

## 📄 License
This project is licensed under the MIT License.
