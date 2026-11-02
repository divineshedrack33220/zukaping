package middleware

import (
    "net/http"
    "sync"
    "time"

    "coded/pkg/metrics"

    "github.com/gin-gonic/gin"
)

type IPRateLimiter struct {
    mu       sync.Mutex
    requests map[string][]time.Time
    limit    int
    window   time.Duration
}

func NewIPRateLimiter(limit int, window time.Duration) *IPRateLimiter {
    return &IPRateLimiter{
        requests: make(map[string][]time.Time),
        limit:    limit,
        window:   window,
    }
}

func (rl *IPRateLimiter) Allow(ip string) bool {
    rl.mu.Lock()
    defer rl.mu.Unlock()

    now := time.Now()
    cutoff := now.Add(-rl.window)

    // Clean old requests
    requests := rl.requests[ip]
    i := 0
    for ; i < len(requests); i++ {
        if requests[i].After(cutoff) {
            break
        }
    }
    requests = requests[i:]

    // Check if under limit
    if len(requests) >= rl.limit {
        return false
    }

    // Add current request
    rl.requests[ip] = append(requests, now)
    return true
}

var (
    ipLimiter        = NewIPRateLimiter(60, time.Minute)
    loginLimiter     = NewIPRateLimiter(10, time.Minute)
    signupLimiter    = NewIPRateLimiter(5, time.Minute)
    adminLoginLimiter = NewIPRateLimiter(5, time.Minute)
    // Codes cost money to send, so requests are throttled far harder than login.
    otpRequestLimiter = NewIPRateLimiter(3, 5*time.Minute)
    otpVerifyLimiter  = NewIPRateLimiter(10, time.Minute)
)

func RateLimitMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        if !ipLimiter.Allow(ip) {
            metrics.IncRateLimitExceeded()
            c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests"})
            c.Abort()
            return
        }
        c.Next()
    }
}

func LoginRateLimitMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        if !loginLimiter.Allow(ip) {
            metrics.IncRateLimitExceeded()
            c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many login attempts, please try again later"})
            c.Abort()
            return
        }
        c.Next()
    }
}

func SignupRateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !signupLimiter.Allow(ip) {
			metrics.IncRateLimitExceeded()
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many signup attempts, please try again later"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func AdminLoginRateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !adminLoginLimiter.Allow(ip) {
			metrics.IncRateLimitExceeded()
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many login attempts, please try again later"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func OTPRequestRateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !otpRequestLimiter.Allow(ip) {
			metrics.IncRateLimitExceeded()
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many code requests, please try again in a few minutes"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func OTPVerifyRateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !otpVerifyLimiter.Allow(ip) {
			metrics.IncRateLimitExceeded()
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many code attempts, please try again later"})
			c.Abort()
			return
		}
		c.Next()
	}
}
