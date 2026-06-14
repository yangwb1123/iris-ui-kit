package main

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

// Validates the custom asset handler end-to-end against the real embedded CMS
// builds: it serves the selected framework's index.html with the window.irisNative
// shim, serves that framework's hashed assets, switches frameworks, and SPA-falls
// back unknown routes. (No GUI needed — exercises the exact serving logic the
// Wails AssetServer uses at runtime.)
func newHandler(t *testing.T, fw string) (*assetHandler, *App) {
	t.Helper()
	dist, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		t.Fatalf("embed sub: %v", err)
	}
	app := NewApp(fw)
	return &assetHandler{app: app, root: dist}, app
}

func get(h http.Handler, path string) (*httptest.ResponseRecorder, string) {
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
	return rr, rr.Body.String()
}

func TestServesEachFrameworkWithBridge(t *testing.T) {
	// react uses <div id="root">, the others differ; just require a mount node
	// + the injected shim + the correct framework identity.
	mount := regexp.MustCompile(`id="(root|app)"`)
	for _, fw := range []string{"react", "vue", "solid", "svelte"} {
		h, _ := newHandler(t, fw)
		rr, body := get(h, "/")
		if rr.Code != 200 {
			t.Fatalf("%s: GET / = %d", fw, rr.Code)
		}
		if !strings.Contains(body, "window.irisNative") {
			t.Fatalf("%s: irisNative shim not injected", fw)
		}
		if !strings.Contains(body, "framework:'"+fw+"'") {
			t.Fatalf("%s: wrong framework identity in shim", fw)
		}
		if !mount.MatchString(body) {
			t.Fatalf("%s: no mount node in served index.html", fw)
		}
		// the shim must come BEFORE the app's module script
		if i, j := strings.Index(body, "window.irisNative"), strings.Index(body, `type="module"`); i < 0 || (j >= 0 && i > j) {
			t.Fatalf("%s: shim not injected before module script", fw)
		}
		// the hashed JS asset the page references must serve 200
		if m := regexp.MustCompile(`(?:src|href)="(/assets/[^"]+)"`).FindStringSubmatch(body); m != nil {
			ar, _ := get(h, m[1])
			if ar.Code != 200 {
				t.Fatalf("%s: asset %s = %d", fw, m[1], ar.Code)
			}
		}
	}
}

func TestSwitchFrameworkChangesServedBuild(t *testing.T) {
	h, app := newHandler(t, "react")
	_, react := get(h, "/")
	if !strings.Contains(react, "framework:'react'") {
		t.Fatal("expected react first")
	}
	// SetFramework reloads the live window; in the test just flip the field the
	// handler reads (same package) to assert the handler now serves svelte.
	app.mu.Lock()
	app.current = "svelte"
	app.mu.Unlock()
	_, svelte := get(h, "/")
	if !strings.Contains(svelte, "framework:'svelte'") {
		t.Fatal("handler did not switch to svelte")
	}
}

func TestSpaFallback(t *testing.T) {
	h, _ := newHandler(t, "react")
	rr, body := get(h, "/some/deep/unknown/route")
	if rr.Code != 200 || !strings.Contains(body, "window.irisNative") {
		t.Fatalf("SPA fallback failed: %d", rr.Code)
	}
}
