// Package webapp embeds the built React client so the API host serves the app
// itself at / instead of a landing page.
//
// The files come from `npm run build:backend` in web_app, which copies dist/
// next to this package before `go build` runs - go:embed reads the source tree,
// not the running filesystem.
package webapp

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:dist
var distFS embed.FS

// content is dist/ stripped of its leading directory, or nil when no build has
// been embedded yet (a bare clone), which is when the caller falls back to the
// landing page.
var content fs.FS

func init() {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return
	}
	content = sub
}

// Available reports whether a built client is embedded.
func Available() bool { return content != nil }

// Handler serves the embedded static files with correct content types.
func Handler() http.Handler {
	return http.FileServer(http.FS(content))
}

// Has reports whether path names a real embedded file, so unmatched client-side
// routes can fall through to index.html instead of returning a file 404.
func Has(path string) bool {
	if !Available() || path == "" {
		return false
	}
	_, err := fs.Stat(content, path)
	return err == nil
}

// Index returns the app shell for a client-side route.
func Index() []byte {
	body, err := fs.ReadFile(content, "index.html")
	if err != nil {
		return []byte("<!doctype html><title>Zukaping</title>")
	}
	return body
}
