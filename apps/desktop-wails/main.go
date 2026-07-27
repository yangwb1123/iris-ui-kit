// Wails desktop shell — hosts all four Iris UI CMS demos (React/Vue/Solid/Svelte)
// in one window, switchable live via a native "Framework" menu. The four CMS
// builds are embedded under frontend/dist/<fw>; a custom asset handler serves
// the currently-selected one from the root (so the CMS's absolute /assets/…
// paths resolve) and injects a window.irisNative shim that wires the
// @iris-ui-kit/core save/clipboard bridges to Wails (native Save dialog + clipboard).
package main

import (
	"embed"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// framework order = menu order = accelerator order (Cmd/Ctrl+1..4).
var frameworks = []struct{ fw, label string }{
	{"react", "React"},
	{"vue", "Vue"},
	{"solid", "Solid"},
	{"svelte", "Svelte"},
}

// assetHandler serves files from frontend/dist/<current-framework>/, injecting
// the window.irisNative shim into index.html and falling back to it (SPA).
type assetHandler struct {
	app  *App
	root fs.FS // the embedded frontend/dist
}

func (h *assetHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	fw := h.app.currentFW()
	reqPath := strings.TrimPrefix(r.URL.Path, "/")
	if reqPath == "" {
		reqPath = "index.html"
	}
	full := fw + "/" + reqPath
	data, err := fs.ReadFile(h.root, full)
	if err != nil {
		// SPA fallback to the framework's index.html.
		full = fw + "/index.html"
		data, err = fs.ReadFile(h.root, full)
		if err != nil {
			http.NotFound(w, r)
			return
		}
	}
	if strings.HasSuffix(full, "index.html") {
		data = injectBridge(data, fw)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	} else if ct := mime.TypeByExtension(path.Ext(full)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	_, _ = w.Write(data)
}

// injectBridge inserts a window.irisNative definition before the app's module
// script so @iris-ui-kit/core's registerDesktopBridges() finds it. saveFile uses the
// bound Go method; writeClipboard uses the Wails JS runtime.
func injectBridge(html []byte, fw string) []byte {
	shim := `<script>window.irisNative={platform:'wails',framework:'` + fw +
		`',saveFile:function(f){return window.go.main.App.SaveFile(f.filename,f.content);},` +
		`writeClipboard:function(t){return window.runtime.ClipboardSetText(t);}};</script>`
	s := string(html)
	if i := strings.Index(s, "<script type=\"module\""); i >= 0 {
		s = s[:i] + shim + s[i:]
	} else if i := strings.Index(s, "</head>"); i >= 0 {
		s = s[:i] + shim + s[i:]
	}
	return []byte(s)
}

func main() {
	dist, _ := fs.Sub(assets, "frontend/dist")
	built := func(fw string) bool {
		_, err := fs.Stat(dist, fw+"/index.html")
		return err == nil
	}

	// Initial framework = IRIS_FW if its build is embedded, else the first built.
	initial := ""
	if env := strings.TrimSpace(os.Getenv("IRIS_FW")); env != "" && built(env) {
		initial = env
	} else {
		for _, f := range frameworks {
			if built(f.fw) {
				initial = f.fw
				break
			}
		}
	}
	if initial == "" {
		initial = "react"
	}

	app := NewApp(initial)

	// Native "Framework" menu (Cmd/Ctrl+1..4) to switch the hosted CMS live.
	appMenu := menu.NewMenu()
	fwMenu := appMenu.AddSubmenu("Framework")
	for i, f := range frameworks {
		if !built(f.fw) {
			continue
		}
		f := f
		fwMenu.AddText(f.label, keys.CmdOrCtrl(string(rune('1'+i))), func(_ *menu.CallbackData) {
			app.SetFramework(f.fw)
		})
	}

	err := wails.Run(&options.App{
		Title:            "Iris CMS — Wails desktop shell",
		Width:            1320,
		Height:           860,
		Menu:             appMenu,
		BackgroundColour: &options.RGBA{R: 11, G: 11, B: 16, A: 1},
		OnStartup:        app.startup,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: &assetHandler{app: app, root: dist},
		},
		Bind: []interface{}{app},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}
