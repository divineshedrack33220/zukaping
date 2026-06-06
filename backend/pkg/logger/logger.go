package logger

import (
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var (
	Logger zerolog.Logger
)

func Init(serviceName string, debug bool) {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	if debug {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	}

	output := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: time.RFC3339,
		NoColor:    false,
	}

	Logger = zerolog.New(output).
		With().
		Timestamp().
		Str("service", serviceName).
		Logger()

	log.Logger = Logger
}

func WithContext(c *gin.Context) *zerolog.Logger {
	requestID := c.GetString("request_id")
	if requestID == "" {
		requestID = uuid.New().String()
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
	}

	logger := Logger.With().
		Str("request_id", requestID).
		Str("method", c.Request.Method).
		Str("path", c.Request.URL.Path).
		Str("ip", c.ClientIP()).
		Logger()

	return &logger
}

func WithRequestID(requestID string) *zerolog.Logger {
	logger := Logger.With().Str("request_id", requestID).Logger()
	return &logger
}

func WithFields(fields map[string]interface{}) *zerolog.Logger {
	ctx := Logger.With()
	for k, v := range fields {
		ctx = ctx.Interface(k, v)
	}
	logger := ctx.Logger()
	return &logger
}

func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		logger := WithContext(c)
		
		if len(c.Errors) > 0 {
			for _, e := range c.Errors {
				logger.Error().Err(e.Err).Msg("Request error")
			}
		} else {
			logger.Info().
				Int("status", status).
				Dur("latency", latency).
				Str("latency_human", latency.String()).
				Msg("Request completed")
		}
	}
}