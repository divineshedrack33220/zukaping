package metrics

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	WSConnectionsActive = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "ws_connections_active",
			Help: "Number of active WebSocket connections",
		},
	)

	WSMessagesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ws_messages_total",
			Help: "Total number of WebSocket messages",
		},
		[]string{"type", "direction"},
	)

	DBActionsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "db_actions_total",
			Help: "Total number of database actions",
		},
		[]string{"collection", "action", "status"},
	)

	DBQueryDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "db_query_duration_seconds",
			Help:    "Database query latency in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"collection", "action"},
	)

	AuthAttemptsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_attempts_total",
			Help: "Total number of authentication attempts",
		},
		[]string{"type", "status"},
	)

	RateLimitExceeded = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "rate_limit_exceeded_total",
			Help: "Total number of rate limit exceeded events",
		},
	)
)

// Middleware returns a Gin middleware for collecting HTTP metrics
func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = "unknown"
		}

		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		HTTPRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		HTTPRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
	}
}

func IncHTTPRequests(method, path string, status int) {
	HTTPRequestsTotal.WithLabelValues(method, path, strconv.Itoa(status)).Inc()
}

func ObserveHTTPDuration(method, path string, duration float64) {
	HTTPRequestDuration.WithLabelValues(method, path).Observe(duration)
}

func IncWSConnections(delta float64) {
	WSConnectionsActive.Add(delta)
}

func IncWSMessages(msgType, direction string) {
	WSMessagesTotal.WithLabelValues(msgType, direction).Inc()
}

func IncDBActions(collection, action, status string) {
	DBActionsTotal.WithLabelValues(collection, action, status).Inc()
}

func ObserveDBDuration(collection, action string, duration float64) {
	DBQueryDuration.WithLabelValues(collection, action).Observe(duration)
}

func IncAuthAttempts(authType, status string) {
	AuthAttemptsTotal.WithLabelValues(authType, status).Inc()
}

func IncRateLimitExceeded() {
	RateLimitExceeded.Inc()
}