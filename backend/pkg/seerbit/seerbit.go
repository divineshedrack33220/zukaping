// Package seerbit charges money through Seerbit's hosted checkout and reads the
// result back from its query API.
//
// The provider contract was confirmed against their sandbox on 2026-11-02:
// POST /api/v2/encrypt/keys turns "secret.public" into a bearer token,
// POST /api/v2/payments returns data.payments.redirectLink to send the payer to,
// and GET /api/v3/payments/query/{reference} is the only trustworthy answer —
// the browser coming back to callbackUrl proves nothing.
package seerbit

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ErrNotConfigured means the keys are absent, so nothing can be charged.
var ErrNotConfigured = errors.New("seerbit: SEERBIT_SECRET_KEY / SEERBIT_PUBLIC_KEY are not set")

const defaultBaseURL = "https://seerbitapi.com"

// CodeSettled is Seerbit's "this payment is complete" code on the query call.
// A pending one answers S20, and the init call answers 00 for a mere
// "transaction created", so 00 only means anything on a query response.
const CodeSettled = "00"

func IsConfigured() bool {
	return strings.TrimSpace(os.Getenv("SEERBIT_SECRET_KEY")) != "" &&
		strings.TrimSpace(os.Getenv("SEERBIT_PUBLIC_KEY")) != ""
}

func PublicKey() string { return strings.TrimSpace(os.Getenv("SEERBIT_PUBLIC_KEY")) }

func BaseURL() string {
	if u := strings.TrimRight(strings.TrimSpace(os.Getenv("SEERBIT_BASE_URL")), "/"); u != "" {
		return u
	}
	return defaultBaseURL
}

// Payment is what the caller needs about one transaction, from either endpoint.
type Payment struct {
	Reference   string  `json:"reference"`
	RedirectURL string  `json:"redirect_url"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Code        string  `json:"code"`
	Message     string  `json:"message"`
	Mode        string  `json:"mode"`
	Status      string  `json:"status"` // settled, pending, failed
	PayerEmail  string  `json:"-"`
	PayerName   string  `json:"-"`
	ImageID     string  `json:"-"`
	BuyerID     string  `json:"-"`
	CreatorID   string  `json:"-"`
}

// InitRequest describes the charge to open.
type InitRequest struct {
	Amount      float64
	Currency    string
	Country     string
	Reference   string
	Email       string
	FullName    string
	Description string
	CallbackURL string
}

type initBody struct {
	PublicKey   string  `json:"publicKey"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Country     string  `json:"country"`
	PaymentRef  string  `json:"paymentReference"`
	Email       string  `json:"email"`
	FullName    string  `json:"fullName"`
	Description string  `json:"description,omitempty"`
	CallbackURL string  `json:"callbackUrl,omitempty"`
}

// Envelope is the shape both endpoints return: {status, data:{code, message, ...}}.
type Envelope struct {
	Status string `json:"status"`
	Data   struct {
		Code     string `json:"code"`
		Message  string `json:"message"`
		Payments *struct {
			PaymentReference string  `json:"paymentReference"`
			RedirectLink     string  `json:"redirectLink"`
			Amount           float64 `json:"amount"`
			Currency         string  `json:"currency"`
			Mode             string  `json:"mode"`
			GatewayCode      string  `json:"gatewayCode"`
			GatewayMessage   string  `json:"gatewayMessage"`
			PaymentStatus    string  `json:"paymentStatus"`
		} `json:"payments"`
		Customers *struct {
			CustomerName  string `json:"customerName"`
			CustomerEmail string `json:"customerEmail"`
		} `json:"customers"`
	} `json:"data"`
}

func (e *Envelope) payment(ref string) *Payment {
	p := &Payment{Reference: ref, Code: e.Data.Code, Message: e.Data.Message}
	if q := e.Data.Payments; q != nil {
		if q.PaymentReference != "" {
			p.Reference = q.PaymentReference
		}
		p.RedirectURL = q.RedirectLink
		p.Amount = q.Amount
		p.Currency = q.Currency
		p.Mode = q.Mode
		if q.GatewayCode != "" {
			p.Code = q.GatewayCode
		}
		if q.GatewayMessage != "" {
			p.Message = q.GatewayMessage
		}
	}
	if c := e.Data.Customers; c != nil {
		p.PayerName = c.CustomerName
		p.PayerEmail = c.CustomerEmail
	}
	switch p.Code {
	case CodeSettled:
		p.Status = "settled"
	case "S20", "":
		p.Status = "pending"
	default:
		p.Status = "failed"
	}
	return p
}

// Settled confirms the provider says paid AND that it is the amount we asked for.
// A gateway that reports success on a short-paid transaction must not unlock.
func Settled(p *Payment, wantAmount float64, wantCurrency string) bool {
	if p == nil || p.Code != CodeSettled {
		return false
	}
	if p.Amount != wantAmount {
		return false
	}
	if wantCurrency != "" && !strings.EqualFold(p.Currency, wantCurrency) {
		return false
	}
	return true
}

var (
	tokenMu     sync.Mutex
	tokenCache  string
	tokenExpiry time.Time
)

// accessToken trades the key pair for a bearer token and reuses it until it is
// about to expire. The provider does not document the lifetime, so 25 minutes is
// a conservative guess and a 401 simply forces a fresh one.
func accessToken(ctx context.Context) (string, error) {
	tokenMu.Lock()
	defer tokenMu.Unlock()

	if !IsConfigured() {
		return "", ErrNotConfigured
	}
	if tokenCache != "" && time.Until(tokenExpiry) > 0 {
		return tokenCache, nil
	}

	body, _ := json.Marshal(map[string]string{
		"key": strings.TrimSpace(os.Getenv("SEERBIT_SECRET_KEY")) + "." + PublicKey(),
	})

	var out struct {
		Status string `json:"status"`
		Data   struct {
			Code            string `json:"code"`
			Message         string `json:"message"`
			EncryptedSecKey struct {
				EncryptedKey string `json:"encryptedKey"`
			} `json:"EncryptedSecKey"`
		} `json:"data"`
	}
	if err := doJSON(ctx, http.MethodPost, BaseURL()+"/api/v2/encrypt/keys", "", body, &out); err != nil {
		return "", err
	}
	if out.Data.EncryptedSecKey.EncryptedKey == "" {
		return "", fmt.Errorf("seerbit: no access token in response (%s %s)", out.Data.Code, out.Data.Message)
	}
	tokenCache = out.Data.EncryptedSecKey.EncryptedKey
	tokenExpiry = time.Now().Add(25 * time.Minute)
	return tokenCache, nil
}

// Init opens a transaction and returns where to send the payer.
func Init(ctx context.Context, req InitRequest) (*Payment, error) {
	if !IsConfigured() {
		return nil, ErrNotConfigured
	}
	if req.Currency == "" {
		req.Currency = "NGN"
	}
	if req.Country == "" {
		req.Country = "NG"
	}
	token, err := accessToken(ctx)
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(initBody{
		PublicKey:   PublicKey(),
		Amount:      req.Amount,
		Currency:    req.Currency,
		Country:     req.Country,
		PaymentRef:  req.Reference,
		Email:       req.Email,
		FullName:    req.FullName,
		Description: req.Description,
		CallbackURL: req.CallbackURL,
	})

	var env Envelope
	// A rejected token is usually a stale cache, so drop it and try once more.
	for attempt := 0; attempt < 2; attempt++ {
		err = doJSON(ctx, http.MethodPost, BaseURL()+"/api/v2/payments", token, body, &env)
		if err == errUnauthorized {
			tokenMu.Lock()
			tokenCache = ""
			tokenMu.Unlock()
			if token, err = accessToken(ctx); err != nil {
				return nil, err
			}
			continue
		}
		break
	}
	if err != nil {
		return nil, err
	}
	p := env.payment(req.Reference)
	if p.RedirectURL == "" {
		return nil, fmt.Errorf("seerbit: payment init returned no redirect link (%s %s)", p.Code, p.Message)
	}
	// The create response's code only says the request was accepted - in test mode
	// it answers "00" before anybody has paid. Nothing here may look settled.
	p.Status = "pending"
	return p, nil
}

// Query asks the provider what actually happened to a reference.
func Query(ctx context.Context, reference string) (*Payment, error) {
	if !IsConfigured() {
		return nil, ErrNotConfigured
	}
	token, err := accessToken(ctx)
	if err != nil {
		return nil, err
	}
	var env Envelope
	if err := doJSON(ctx, http.MethodGet, BaseURL()+"/api/v3/payments/query/"+reference, token, nil, &env); err != nil {
		return nil, err
	}
	return env.payment(reference), nil
}

var errUnauthorized = errors.New("seerbit: unauthorized")

func doJSON(ctx context.Context, method, url, bearer string, body []byte, out interface{}) error {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("seerbit: %s request failed: %w", method, err)
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return err
	}
	if res.StatusCode == http.StatusUnauthorized {
		return errUnauthorized
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return fmt.Errorf("seerbit: %s returned %d: %s", method, res.StatusCode, snippet(raw))
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("seerbit: unreadable response: %w", err)
	}
	return nil
}

// VerifyWebhook proves the body came from Seerbit: HMAC-SHA256 of the raw bytes
// keyed with the secret key, sent as "X-Webhook-Signature: sha256=<hex>".
// Parsing first and verifying later would let a crafted body through, so callers
// must hand over exactly the bytes they received.
func VerifyWebhookSignature(rawBody []byte, header string) bool {
	secret := strings.TrimSpace(os.Getenv("SEERBIT_SECRET_KEY"))
	if secret == "" || len(rawBody) == 0 || header == "" {
		return false
	}
	provided := strings.TrimPrefix(strings.TrimSpace(header), "sha256=")
	provided = strings.ToLower(strings.TrimSpace(provided))

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	expected := fmt.Sprintf("%x", mac.Sum(nil))

	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

func snippet(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 200 {
		return s[:200] + "…"
	}
	return s
}
