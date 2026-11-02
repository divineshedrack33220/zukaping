package cloudinary

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	cld "github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

// ErrNotConfigured means no Cloudinary credentials are present in the
// environment, so uploads cannot proceed.
var ErrNotConfigured = errors.New("cloudinary: no credentials in environment")

// ClientFromEnv builds a Cloudinary client from whichever credential shape is
// present. CLOUDINARY_URL is preferred; otherwise the CLOUDINARY_CLOUD_NAME /
// CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET triple that render.yaml provisions
// is used.
func ClientFromEnv() (*cld.Cloudinary, error) {
	if raw := strings.TrimSpace(os.Getenv("CLOUDINARY_URL")); raw != "" {
		return cld.NewFromURL(raw)
	}

	cloud := strings.TrimSpace(os.Getenv("CLOUDINARY_CLOUD_NAME"))
	key := strings.TrimSpace(os.Getenv("CLOUDINARY_API_KEY"))
	secret := strings.TrimSpace(os.Getenv("CLOUDINARY_API_SECRET"))

	if cloud == "" || key == "" || secret == "" {
		return nil, ErrNotConfigured
	}
	return cld.NewFromParams(cloud, key, secret)
}

// IsConfigured reports whether uploads can work at all, for startup logging and
// for the /api/health response.
func IsConfigured() bool {
	client, err := ClientFromEnv()
	return err == nil && client != nil
}

// UploadFile pushes file to Cloudinary and returns the secure URL.
//
// The SDK only reports transport problems through err: a rejected request
// (bad key, wrong cloud name, invalid signature) comes back as a nil-error
// result whose SecureURL is empty and whose Error.Message explains why. Left
// unchecked, handlers answered 200 with {"url":""} and the clients silently
// dropped an empty URL, so every credential mistake looked like a mystery.
func UploadFile(ctx context.Context, client *cld.Cloudinary, file io.Reader, params uploader.UploadParams) (string, error) {
	result, err := client.Upload.Upload(ctx, file, params)
	if err != nil {
		return "", fmt.Errorf("cloudinary upload failed: %w", err)
	}
	if result == nil {
		return "", errors.New("cloudinary: empty upload response")
	}
	if result.Error.Message != "" {
		return "", fmt.Errorf("cloudinary rejected the upload: %s", result.Error.Message)
	}
	if result.SecureURL == "" {
		return "", errors.New("cloudinary returned no asset URL")
	}
	return result.SecureURL, nil
}

// ConfigError renders a single-line description safe for logs (never the secret).
func ConfigError(err error) string {
	if errors.Is(err, ErrNotConfigured) {
		return "Cloudinary is not configured: set CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME with CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET"
	}
	return fmt.Sprintf("Cloudinary configuration failed: %v", err)
}
