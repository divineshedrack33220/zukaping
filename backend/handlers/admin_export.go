package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"coded/database"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var exportableEntities = map[string]bool{
	"users":     true,
	"posts":     true,
	"chats":     true,
	"messages":  true,
	"rooms":     true,
	"favorites": true,
	"purchases": true,
	"audit-logs": true,
	"reports":   true,
}

// AdminExport dumps a collection as CSV or JSON for reporting/backup.
// Usage: GET /api/admin/export/:entity?format=csv|json
func AdminExport(c *gin.Context) {
	if database.Client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Database unavailable"})
		return
	}

	entity := c.Param("entity")
	if !exportableEntities[entity] {
		c.JSON(http.StatusNotFound, gin.H{"error": "Unknown export entity"})
		return
	}

	format := c.DefaultQuery("format", "csv")
	if format != "csv" && format != "json" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "format must be csv or json"})
		return
	}

	limit := 10000
	if l, err := parseIntQuery(c.Query("limit")); err == nil && l > 0 && l <= 50000 {
		limit = l
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	collectionName := entity
	if entity == "audit-logs" {
		collectionName = "admin_audit_logs"
	}

	coll := database.DB.Collection(collectionName)

	projection := bson.M{}
	if entity == "users" {
		projection = bson.M{"passwordHash": 0, "googleId": 0, "blockedUsers": 0, "profile_images": 0}
	}

	cursor, err := coll.Find(ctx, bson.M{}, options.Find().SetProjection(projection).SetLimit(int64(limit)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch data"})
		return
	}
	defer cursor.Close(ctx)

	var rawDocs []bson.M
	if err := cursor.All(ctx, &rawDocs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode data"})
		return
	}

	// Convert ObjectIDs to strings for clean output.
	docs := make([]map[string]interface{}, 0, len(rawDocs))
	for _, d := range rawDocs {
		docs = append(docs, flattenDoc(d))
	}

	filename := fmt.Sprintf("%s-%s.%s", entity, time.Now().Format("20060102-150405"), format)
	c.Header("Content-Disposition", "attachment; filename="+filename)

	if format == "json" {
		c.Data(http.StatusOK, "application/json", mustMarshal(gin.H{"entity": entity, "count": len(docs), "data": docs}))
		return
	}

	if len(docs) == 0 {
		c.Data(http.StatusOK, "text/csv", []byte("No data"))
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	writeCSV(c, docs)
}

// flattenDoc renders nested values (ObjectIDs, sub-documents) as strings.
func flattenDoc(d bson.M) map[string]interface{} {
	out := make(map[string]interface{}, len(d))
	for k, v := range d {
		switch t := v.(type) {
		case nil:
			out[k] = ""
		case string, bool, float64:
			out[k] = t
		case int32:
			out[k] = int64(t)
		case int64:
			out[k] = t
		case float32:
			out[k] = float64(t)
		default:
			b, _ := json.Marshal(t)
			out[k] = string(b)
		}
	}
	return out
}

func writeCSV(c *gin.Context, docs []map[string]interface{}) {
	// Determine column order (union of keys, deterministic).
	seen := make(map[string]bool)
	var headers []string
	for _, d := range docs {
		for k := range d {
			if !seen[k] {
				seen[k] = true
				headers = append(headers, k)
			}
		}
	}

	w := csv.NewWriter(c.Writer)
	_ = w.Write(headers)
	for _, d := range docs {
		row := make([]string, 0, len(headers))
		for _, h := range headers {
			row = append(row, csvValue(d[h]))
		}
		_ = w.Write(row)
	}
	w.Flush()
}

func csvValue(v interface{}) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case bool:
		return strconv.FormatBool(t)
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case int64:
		return strconv.FormatInt(t, 10)
	case json.Number:
		return t.String()
	default:
		return fmt.Sprintf("%v", t)
	}
}

func mustMarshal(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return b
}
