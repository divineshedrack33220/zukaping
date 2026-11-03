package seerbit

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"testing"
)

func signedBody(t *testing.T, secret string) []byte {
	t.Helper()
	t.Setenv("SEERBIT_SECRET_KEY", secret)
	return []byte(`{"notificationItems":[{"eventId":"evt-1","eventType":"transaction"}]}`)
}

func TestVerifyWebhookSignature(t *testing.T) {
	secret := "unit-test-secret-not-a-real-key"
	body := signedBody(t, secret)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	good := fmt.Sprintf("sha256=%x", mac.Sum(nil))

	if !VerifyWebhookSignature(body, good) {
		t.Error("a correctly signed body must be accepted")
	}
	if VerifyWebhookSignature([]byte(`{"notificationItems":[]}`), good) {
		t.Error("a tampered body must be rejected")
	}
	if VerifyWebhookSignature(body, "sha256="+"00") {
		t.Error("a wrong digest must be rejected")
	}
	if VerifyWebhookSignature(body, "") {
		t.Error("a missing signature must be rejected")
	}
	if VerifyWebhookSignature(body, good+"deadbeef") {
		t.Error("a padded digest must be rejected")
	}
	t.Setenv("SEERBIT_SECRET_KEY", "")
	if VerifyWebhookSignature(body, good) {
		t.Error("without a secret nothing can be trusted")
	}
}

const pendingFixture = `{"status":"SUCCESS","data":{"code":"S20","message":"Transaction is pending","payments":{"amount":700,"gatewayCode":"S20","mode":"TEST","country":"NG","currency":"NGN","paymentReference":"zkq1793704905"},"customers":{"customerName":"Probe Test","customerEmail":"p@example.com"}}}`

const settledFixture = `{"status":"SUCCESS","data":{"code":"00","message":"Payment successful","payments":{"amount":700,"gatewayCode":"00","mode":"TEST","currency":"NGN","paymentReference":"zkq1793704905"}}}`

const shortPaidFixture = `{"status":"SUCCESS","data":{"code":"00","message":"Payment successful","payments":{"amount":350,"gatewayCode":"00","currency":"NGN","paymentReference":"zkq1793704905"}}}`

func decode(t *testing.T, raw string) *Payment {
	t.Helper()
	var env Envelope
	if err := json.Unmarshal([]byte(raw), &env); err != nil {
		t.Fatalf("fixture no longer matches the provider shape: %v", err)
	}
	return env.payment("ignored")
}

func TestPaymentStatus(t *testing.T) {
	if p := decode(t, pendingFixture); p.Status != "pending" || p.Code != "S20" {
		t.Errorf("pending fixture decoded as %s/%s", p.Code, p.Status)
	} else if p.Amount != 700 || p.Mode != "TEST" {
		t.Errorf("pending fixture lost amount or mode: %+v", p)
	} else if p.Reference != "zkq1793704905" {
		t.Errorf("reference not read from the body: %q", p.Reference)
	}
	if p := decode(t, settledFixture); p.Status != "settled" {
		t.Errorf("settled fixture decoded as %s/%s", p.Code, p.Status)
	}
	if Settled(decode(t, pendingFixture), 700, "NGN") {
		t.Error("a pending payment must never unlock content")
	}
	if !Settled(decode(t, settledFixture), 700, "NGN") {
		t.Error("a matching settled payment should unlock content")
	}
	if Settled(decode(t, shortPaidFixture), 700, "NGN") {
		t.Error("a short payment must not unlock content")
	}
	if Settled(decode(t, settledFixture), 700, "KES") {
		t.Error("a currency mismatch must not unlock content")
	}
	if Settled(nil, 700, "NGN") {
		t.Error("nil must not settle")
	}
}
