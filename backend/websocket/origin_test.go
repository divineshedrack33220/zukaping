package websocket

import (
	"net/http/httptest"
	"testing"
)

func checkOrigin(t *testing.T, origin, host string) bool {
	t.Helper()
	r := httptest.NewRequest("GET", "/ws", nil)
	r.Host = host
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	return upgrader.CheckOrigin(r)
}

func TestCheckOrigin(t *testing.T) {
	cases := []struct {
		origin, host string
		want         bool
	}{
		{"", "zukaping-backend.onrender.com", true},
		{"https://app.zukaping.com", "app.zukaping.com", true},
		{"https://zukaping-backend.onrender.com", "zukaping-backend.onrender.com", true},
		{"https://zukaping.com", "zukaping-backend.onrender.com", true},
		{"https://evil.example", "app.zukaping.com", false},
		{"https://evil.example", "zukaping-backend.onrender.com", false},
		{"http://localhost:3000", "127.0.0.1:8080", true},
	}
	for _, c := range cases {
		if got := checkOrigin(t, c.origin, c.host); got != c.want {
			t.Errorf("origin %q host %q: got %v want %v", c.origin, c.host, got, c.want)
		}
	}
}
