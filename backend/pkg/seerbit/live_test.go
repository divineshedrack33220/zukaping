package seerbit

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/joho/godotenv"
)

// TestLiveGateway is the only proof that the endpoints, the encrypted token and the
// request shape match what Seerbit really accepts. It opens a TEST charge under a
// throwaway reference and reads it back: no database row, no money, no customer.
//
// Run it with SEERBIT_LIVE_TEST=1 so nothing in a build or CI reaches the network.
func TestLiveGateway(t *testing.T) {
	if os.Getenv("SEERBIT_LIVE_TEST") != "1" {
		t.Skip("set SEERBIT_LIVE_TEST=1 to call the real gateway")
	}
	_ = godotenv.Load(filepath.Join("..", "..", ".env"))
	if !IsConfigured() {
		t.Fatal("SEERBIT_SECRET_KEY and SEERBIT_PUBLIC_KEY are both required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	reference := "zktest" + time.Now().Format("060102150405")
	charge, err := Init(ctx, InitRequest{
		Amount:      700,
		Currency:    "NGN",
		Country:     "NG",
		Reference:   reference,
		Email:       "payments-test@zukaping.com",
		FullName:    "Zukaping integration test",
		Description: "Zukaping payment integration check",
		CallbackURL: "https://zukaping.com/feed",
	})
	if err != nil {
		t.Fatalf("init: %v", err)
	}
	t.Logf("created: code=%s status=%s mode=%s amount=%.0f %s", charge.Code, charge.Status, charge.Mode, charge.Amount, charge.Currency)
	if !strings.Contains(charge.RedirectURL, "checkout.seerbitapi.com") {
		t.Fatalf("checkout link is not on the expected host: %s", snippet([]byte(charge.RedirectURL)))
	}

	seen, err := Query(ctx, reference)
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	t.Logf("queried: code=%s status=%s mode=%s settled=%v", seen.Code, seen.Status, seen.Mode, Settled(seen, 700, "NGN"))
	if Settled(seen, 700, "NGN") {
		t.Fatal("a charge nobody paid is reported as settled")
	}
}
