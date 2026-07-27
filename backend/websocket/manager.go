package websocket

import (
    "encoding/json"
    "log"
    "net/http"
    "os"
    "strings"
    "sync"
    "time"

    "coded/middleware"
    "coded/pkg/metrics"

    "github.com/golang-jwt/jwt/v5"
    "github.com/gorilla/websocket"
)

const (
    MaxReadLimit      = 64 * 1024 // 64KB
    MaxConnections    = 10000
    PingInterval      = 30 * time.Second
    PongTimeout       = 60 * time.Second
    WriteTimeout      = 10 * time.Second
)

type Manager struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    register   chan *Client
    unregister chan *Client
    mu         sync.RWMutex
}

type Client struct {
    conn         *websocket.Conn
    userID       string
    send         chan []byte
    manager      *Manager
    subscribedChats map[string]bool
}

func NewManager() *Manager {
    return &Manager{
        clients:    make(map[*Client]bool),
        broadcast:  make(chan []byte),
        register:   make(chan *Client),
        unregister: make(chan *Client),
    }
}

func (m *Manager) Start() {
    for {
        select {
        case client := <-m.register:
            m.mu.Lock()
            m.clients[client] = true
            count := len(m.clients)
            m.mu.Unlock()
            metrics.IncWSConnections(1)
            log.Printf("✅ WebSocket client registered. Total clients: %d", count)

        case client := <-m.unregister:
            m.mu.Lock()
            if _, ok := m.clients[client]; ok {
                delete(m.clients, client)
                close(client.send)
            }
            count := len(m.clients)
            m.mu.Unlock()
            metrics.IncWSConnections(-1)
            log.Printf("❌ WebSocket client unregistered. Total clients: %d", count)

        case message := <-m.broadcast:
            m.mu.RLock()
            clientsToBroadcast := make([]*Client, 0, len(m.clients))
            for client := range m.clients {
                clientsToBroadcast = append(clientsToBroadcast, client)
            }
            m.mu.RUnlock()

            for _, client := range clientsToBroadcast {
                select {
                case client.send <- message:
                default:
                    m.mu.Lock()
                    if _, ok := m.clients[client]; ok {
                        close(client.send)
                        delete(m.clients, client)
                    }
                    m.mu.Unlock()
                }
            }
        }
    }
}

// sendToUsers sends a message only to specific connected users by their userID
func (m *Manager) sendToUsers(userIDs []string, data []byte) {
    m.mu.RLock()
    defer m.mu.RUnlock()

    userIDSet := make(map[string]bool, len(userIDs))
    for _, id := range userIDs {
        userIDSet[id] = true
    }

    for client := range m.clients {
        if userIDSet[client.userID] {
            select {
            case client.send <- data:
            default:
                // Client buffer full, skip
            }
        }
    }
}

// sendToChatParticipants looks up chat participants from the database and sends only to them
func (m *Manager) sendToChatParticipants(chatID string, data []byte) {
    participantIDs := getChatParticipantIDs(chatID)
    if len(participantIDs) == 0 {
        return
    }
    m.sendToUsers(participantIDs, data)
}

// BroadcastChatMessage sends a message to chat participants only (privacy-safe)
func (m *Manager) BroadcastChatMessage(chatID string, message map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "new_message",
        "payload": message,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket message: %v", err)
        return
    }

    metrics.IncWSMessages("new_message", "outbound")
    m.sendToChatParticipants(chatID, msg)
}

// BroadcastNewMessage sends to ALL clients (for global events like new posts)
func (m *Manager) BroadcastNewMessage(message map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "new_message",
        "payload": message,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket message: %v", err)
        return
    }

    metrics.IncWSMessages("new_message", "outbound")
    m.broadcast <- msg
}

func (m *Manager) BroadcastNewRequest(requestData map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "new_request",
        "payload": requestData,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket request: %v", err)
        return
    }

    metrics.IncWSMessages("new_request", "outbound")
    m.broadcast <- msg
}

func (m *Manager) BroadcastRequestUpdate(updateData map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "request_update",
        "payload": updateData,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket request update: %v", err)
        return
    }

    metrics.IncWSMessages("request_update", "outbound")
    m.broadcast <- msg
}

func (m *Manager) BroadcastChatCreated(chatData map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "chat_created",
        "payload": chatData,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket message: %v", err)
        return
    }

    // Send only to participants
    if participants, ok := chatData["participants"].([]string); ok {
        m.sendToUsers(participants, msg)
    } else {
        m.broadcast <- msg
    }
    metrics.IncWSMessages("chat_created", "outbound")
}

func (m *Manager) BroadcastMessageRead(payload map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "message_read",
        "payload": payload,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket message: %v", err)
        return
    }

    // Send only to chat participants
    if chatID, ok := payload["chatId"].(string); ok {
        m.sendToChatParticipants(chatID, msg)
    }
    metrics.IncWSMessages("message_read", "outbound")
}

func (m *Manager) BroadcastTypingStart(payload map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "typing_start",
        "payload": payload,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket message: %v", err)
        return
    }

    if chatID, ok := payload["chatId"].(string); ok {
        m.sendToChatParticipants(chatID, msg)
    }
    metrics.IncWSMessages("typing_start", "outbound")
}

func (m *Manager) BroadcastTypingEnd(payload map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "typing_end",
        "payload": payload,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket message: %v", err)
        return
    }

    if chatID, ok := payload["chatId"].(string); ok {
        m.sendToChatParticipants(chatID, msg)
    }
    metrics.IncWSMessages("typing_end", "outbound")
}

func (m *Manager) BroadcastMessageReaction(payload map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "message_reaction",
        "payload": payload,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket message: %v", err)
        return
    }

    if chatID, ok := payload["chatId"].(string); ok {
        m.sendToChatParticipants(chatID, msg)
    }
    metrics.IncWSMessages("message_reaction", "outbound")
}

func (m *Manager) BroadcastRoomUpdate(payload map[string]interface{}) {
    data := map[string]interface{}{
        "type":    "room_update",
        "payload": payload,
    }

    msg, err := json.Marshal(data)
    if err != nil {
        log.Printf("❌ Error marshaling WebSocket room update: %v", err)
        return
    }

    // Send to chat participants if chatId is available
    if chatID, ok := payload["chatId"].(string); ok {
        m.sendToChatParticipants(chatID, msg)
    } else {
        m.broadcast <- msg
    }
    metrics.IncWSMessages("room_update", "outbound")
}

func (m *Manager) GetConnectedUsers() int {
    m.mu.RLock()
    defer m.mu.RUnlock()
    return len(m.clients)
}

// Shutdown gracefully closes all client connections
func (m *Manager) Shutdown() {
    m.mu.Lock()
    defer m.mu.Unlock()
    for client := range m.clients {
        close(client.send)
        client.conn.Close()
        delete(m.clients, client)
    }
}

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        origin := r.Header.Get("Origin")
        if origin == "" {
            return true // Allow non-browser clients (curl, mobile)
        }

        allowedOrigins := []string{
            "https://zukaping.app",
            "https://app.zukaping.app",
            "https://lemon16.app",
            "https://app.lemon16.app",
        }

        if envOrigins := os.Getenv("ALLOWED_ORIGINS"); envOrigins != "" {
            allowedOrigins = append(allowedOrigins, strings.Split(envOrigins, ",")...)
        }

        // Allow localhost for development
        if strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:") {
            return true
        }

        for _, allowed := range allowedOrigins {
            if origin == allowed {
                return true
            }
        }
        return false
    },
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
}

func WebSocketHandler(manager *Manager) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        tokenString := r.URL.Query().Get("token")
        if tokenString == "" {
            http.Error(w, "Token required", http.StatusUnauthorized)
            return
        }

        // Validate JWT token
        claims := &middleware.Claims{}
        token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, jwt.ErrSignatureInvalid
            }
            return middleware.GetJWTSecret(), nil
        })

        if err != nil || !token.Valid {
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }

        userID := claims.UserID

        // Check max connections
        manager.mu.RLock()
        currentCount := len(manager.clients)
        manager.mu.RUnlock()
        if currentCount >= MaxConnections {
            http.Error(w, "Server at capacity", http.StatusServiceUnavailable)
            return
        }

        conn, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
            log.Printf("❌ WebSocket upgrade failed: %v", err)
            return
        }

        client := &Client{
            conn:            conn,
            userID:          userID,
            send:            make(chan []byte, 256),
            manager:         manager,
            subscribedChats: make(map[string]bool),
        }

        manager.register <- client

        // Send connection success message
        welcomeMsg := map[string]interface{}{
            "type": "connected",
            "payload": map[string]interface{}{
                "userId":  userID,
                "message": "WebSocket connected successfully",
                "time":    time.Now().Unix(),
            },
        }
        msg, _ := json.Marshal(welcomeMsg)
        client.send <- msg

        // Start goroutines for this client
        go client.writePump()
        go client.readPump()
    }
}

func (c *Client) readPump() {
    defer func() {
        c.manager.unregister <- c
        c.conn.Close()
    }()

    c.conn.SetReadLimit(MaxReadLimit)
    c.conn.SetReadDeadline(time.Now().Add(PongTimeout))
    c.conn.SetPongHandler(func(string) error {
        c.conn.SetReadDeadline(time.Now().Add(PongTimeout))
        return nil
    })

    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
                log.Printf("❌ WebSocket read error: %v", err)
            }
            break
        }

        var data map[string]interface{}
        if err := json.Unmarshal(message, &data); err != nil {
            continue
        }

        metrics.IncWSMessages(getStr(data["type"]), "inbound")

        // Handle different message types
        switch data["type"] {
        case "subscribe":
            c.handleSubscribe(data)
        case "subscribe_chat":
            c.handleSubscribeChat(data)
        case "typing_start":
            c.handleTypingStart(data)
        case "typing_end":
            c.handleTypingEnd(data)
        case "message_read":
            c.handleMessageRead(data)
        case "ping":
            c.sendPong()
        }
    }
}

func (c *Client) writePump() {
    ticker := time.NewTicker(PingInterval)
    defer func() {
        ticker.Stop()
        c.conn.Close()
    }()

    for {
        select {
        case message, ok := <-c.send:
            c.conn.SetWriteDeadline(time.Now().Add(WriteTimeout))
            if !ok {
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }

            w, err := c.conn.NextWriter(websocket.TextMessage)
            if err != nil {
                return
            }
            w.Write(message)

            if err := w.Close(); err != nil {
                return
            }

        case <-ticker.C:
            c.conn.SetWriteDeadline(time.Now().Add(WriteTimeout))
            if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}

func (c *Client) handleSubscribe(data map[string]interface{}) {
    channel, ok := data["channel"].(string)
    if !ok {
        return
    }

    response := map[string]interface{}{
        "type": "subscribed",
        "payload": map[string]interface{}{
            "channel": channel,
            "userId":  c.userID,
            "time":    time.Now().Unix(),
        },
    }

    msg, err := json.Marshal(response)
    if err != nil {
        return
    }

    c.send <- msg
}

func (c *Client) handleSubscribeChat(data map[string]interface{}) {
    payload, ok := data["payload"].(map[string]interface{})
    if !ok {
        return
    }

    chatID, ok := payload["chatId"].(string)
    if !ok {
        return
    }

    // Track subscription locally
    c.subscribedChats[chatID] = true

    response := map[string]interface{}{
        "type": "chat_subscribed",
        "payload": map[string]interface{}{
            "chatId": chatID,
            "userId": c.userID,
        },
    }

    msg, err := json.Marshal(response)
    if err != nil {
        return
    }

    c.send <- msg
}

func (c *Client) handleTypingStart(data map[string]interface{}) {
    if payload, ok := data["payload"].(map[string]interface{}); ok {
        chatID, _ := payload["chatId"].(string)
        if chatID == "" {
            return
        }

        typingData := map[string]interface{}{
            "type": "typing_start",
            "payload": map[string]interface{}{
                "chatId":    chatID,
                "userId":    c.userID,
                "timestamp": time.Now().Unix(),
            },
        }

        msg, err := json.Marshal(typingData)
        if err != nil {
            return
        }

        // Send only to chat participants
        c.manager.sendToChatParticipants(chatID, msg)
    }
}

func (c *Client) handleTypingEnd(data map[string]interface{}) {
    if payload, ok := data["payload"].(map[string]interface{}); ok {
        chatID, _ := payload["chatId"].(string)
        if chatID == "" {
            return
        }

        typingData := map[string]interface{}{
            "type": "typing_end",
            "payload": map[string]interface{}{
                "chatId":    chatID,
                "userId":    c.userID,
                "timestamp": time.Now().Unix(),
            },
        }

        msg, err := json.Marshal(typingData)
        if err != nil {
            return
        }

        c.manager.sendToChatParticipants(chatID, msg)
    }
}

func (c *Client) handleMessageRead(data map[string]interface{}) {
    if payload, ok := data["payload"].(map[string]interface{}); ok {
        chatID, _ := payload["chatId"].(string)
        if chatID == "" {
            return
        }

        readData := map[string]interface{}{
            "type": "message_read",
            "payload": map[string]interface{}{
                "chatId":     chatID,
                "userId":     c.userID,
                "messageIds": payload["messageIds"],
                "timestamp":  time.Now().Unix(),
            },
        }

        msg, err := json.Marshal(readData)
        if err != nil {
            return
        }

        c.manager.sendToChatParticipants(chatID, msg)
    }
}

func (c *Client) sendPong() {
    response := map[string]interface{}{
        "type": "pong",
        "payload": map[string]interface{}{
            "time": time.Now().Unix(),
        },
    }

    msg, err := json.Marshal(response)
    if err != nil {
        return
    }

    c.send <- msg
}

func getStr(v interface{}) string {
    if s, ok := v.(string); ok {
        return s
    }
    return "unknown"
}
