package validation

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/go-playground/validator/v10"
)

var (
	validate    *validator.Validate
	emailRegex  = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,30}$`)
)

func init() {
	validate = validator.New()
	validate.RegisterValidation("strongpassword", validateStrongPassword)
	validate.RegisterValidation("username", validateUsername)
	validate.RegisterValidation("sanitized", validateSanitized)
}

// ValidateStruct validates a struct using validator tags
func ValidateStruct(s interface{}) error {
	return validate.Struct(s)
}

// SanitizeString removes potentially dangerous characters
func SanitizeString(input string) string {
	// Remove null bytes and control characters
	result := strings.Map(func(r rune) rune {
		if r == '\x00' || (r < 32 && r != '\n' && r != '\r' && r != '\t') {
			return -1
		}
		return r
	}, input)
	return strings.TrimSpace(result)
}

// validateStrongPassword checks password strength
func validateStrongPassword(fl validator.FieldLevel) bool {
	password := fl.Field().String()
	if len(password) < 8 {
		return false
	}

	var (
		hasUpper   = false
		hasLower   = false
		hasNumber  = false
		hasSpecial = false
	)

	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsNumber(r):
			hasNumber = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}

	return hasUpper && hasLower && hasNumber && hasSpecial
}

// validateUsername checks username format
func validateUsername(fl validator.FieldLevel) bool {
	username := fl.Field().String()
	return usernameRegex.MatchString(username)
}

// validateSanitized checks if string contains only safe characters
func validateSanitized(fl validator.FieldLevel) bool {
	input := fl.Field().String()
	// Allow alphanumeric, spaces, basic punctuation
	safeRegex := regexp.MustCompile(`^[a-zA-Z0-9\s\-_.,!?@#$%&*()+={}\[\]|\\:;"'<>/]*$`)
	return safeRegex.MatchString(input)
}

// ValidateEmail validates email format
func ValidateEmail(email string) bool {
	return emailRegex.MatchString(email)
}

// SanitizeEmail normalizes email
func SanitizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}