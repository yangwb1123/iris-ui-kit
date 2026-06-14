package main

import (
	"context"
	"os"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App holds the Wails context and the currently-hosted framework. The custom
// asset handler (main.go) reads `current` to decide which CMS build to serve.
type App struct {
	ctx     context.Context
	mu      sync.RWMutex
	current string
}

func NewApp(initial string) *App {
	return &App{current: initial}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) currentFW() string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.current
}

// SaveFile routes an @iris-ui/core file-save through the native Save dialog.
// Bound to the frontend as window.go.main.App.SaveFile; returns true when saved.
func (a *App) SaveFile(filename string, content string) bool {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: filename,
	})
	if err != nil || path == "" {
		return false
	}
	return os.WriteFile(path, []byte(content), 0o644) == nil
}

// SetFramework switches the hosted CMS framework and reloads the window so the
// asset handler serves the newly-selected build from its root.
func (a *App) SetFramework(fw string) {
	a.mu.Lock()
	a.current = fw
	a.mu.Unlock()
	runtime.WindowReloadApp(a.ctx)
}
