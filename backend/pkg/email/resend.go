// Package email sends transactional mail through Resend's HTTP API.
package email

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// ErrNotConfigured means RESEND_API_KEY is absent, so no mail can be sent.
var ErrNotConfigured = errors.New("email: RESEND_API_KEY is not set")

const resendURL = "https://api.resend.com/emails"

// IsConfigured is used by startup logging and /api/health.
func IsConfigured() bool {
	return strings.TrimSpace(os.Getenv("RESEND_API_KEY")) != ""
}

// FromAddress is the sender shown in the inbox. zukaping.com is verified in the
// Resend dashboard, so any address at that domain can send; Resend's sandbox
// address would only ever deliver to the account owner.
func FromAddress() string {
	if from := strings.TrimSpace(os.Getenv("RESEND_FROM")); from != "" {
		return from
	}
	return "Zukaping <no-reply@zukaping.com>"
}

type message struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Text    string   `json:"text"`
	Html    string   `json:"html"`
}

func send(ctx context.Context, msg message) error {
	apiKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	if apiKey == "" {
		return ErrNotConfigured
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("email: failed to encode message: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("email: failed to build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("email: Resend request failed: %w", err)
	}
	defer resp.Body.Close()

	// Resend answers 2xx for both single and batch sends; anything else carries
	// a JSON error, but never the API key, so the snippet is safe to surface.
	snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("email: Resend rejected the send (HTTP %d): %s", resp.StatusCode, strings.TrimSpace(string(snippet)))
	}
	return nil
}

// SendPasswordOTP emails a six-digit sign-in code valid for ten minutes.
func SendPasswordOTP(ctx context.Context, to, code string) error {
	subject := "Your Zukaping reset code"
	text := fmt.Sprintf("Your Zukaping reset code is %s. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.", code)
	html := fmt.Sprintf(
		`<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px">`+
			`<h2 style="margin:0 0 16px;color:#0f172a">Reset your password</h2>`+
			`<p style="margin:0 0 16px;color:#475569">Use this code to finish resetting your Zukaping password. It expires in 10 minutes.</p>`+
			`<p style="margin:0 0 20px;font-size:32px;letter-spacing:8px;font-weight:700;color:#026AFD">%s</p>`+
			`<p style="margin:0;color:#94a3b8;font-size:13px">If you did not request this, you can ignore this email — your password will not change.</p>`+
			`</div>`,
		code,
	)

	return send(ctx, message{
		From:    FromAddress(),
		To:      []string{to},
		Subject: subject,
		Text:    text,
		Html:    html,
	})
}
