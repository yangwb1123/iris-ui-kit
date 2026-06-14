// Tauri desktop shell — hosts all four Iris UI CMS demos (React/Vue/Solid/Svelte)
// in one window, switchable live via a native "Framework" menu. The four CMS
// builds are embedded (rust-embed) and served by a custom `iris://` URI scheme
// that returns the currently-selected framework's files (so absolute /assets/…
// paths resolve) with a window.irisNative shim injected into index.html. That
// shim wires @iris-ui/core's save/clipboard bridges to native Tauri commands.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use rust_embed::RustEmbed;
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;

#[derive(RustEmbed)]
#[folder = "../dist/"]
struct Assets;

struct AppState {
    current: Mutex<String>,
}

const FRAMEWORKS: [(&str, &str); 4] = [
    ("react", "React"),
    ("vue", "Vue"),
    ("solid", "Solid"),
    ("svelte", "Svelte"),
];

fn built(fw: &str) -> bool {
    Assets::get(&format!("{fw}/index.html")).is_some()
}

/// Resolve a request to bytes + content-type for framework `fw`, injecting the
/// window.irisNative shim into index.html and SPA-falling back unknown routes.
/// Shared by the `iris://` protocol handler and the unit tests.
fn serve_asset(fw: &str, req_path: &str) -> Option<(Vec<u8>, String)> {
    let mut path = req_path.trim_start_matches('/').to_string();
    if path.is_empty() {
        path = "index.html".to_string();
    }
    let full = format!("{fw}/{path}");
    let (data, served) = match Assets::get(&full) {
        Some(a) => (a.data.into_owned(), full),
        None => {
            let idx = format!("{fw}/index.html");
            let a = Assets::get(&idx)?;
            (a.data.into_owned(), idx)
        }
    };
    if served.ends_with("index.html") {
        let html = inject_bridge(&String::from_utf8_lossy(&data), fw);
        Some((html.into_bytes(), "text/html; charset=utf-8".to_string()))
    } else {
        let ctype = mime_guess::from_path(&served)
            .first_or_octet_stream()
            .to_string();
        Some((data, ctype))
    }
}

fn inject_bridge(html: &str, fw: &str) -> String {
    let shim = format!(
        "<script>window.irisNative={{platform:'tauri',framework:'{fw}',\
         saveFile:function(f){{return window.__TAURI__.core.invoke('save_file',{{filename:f.filename,content:f.content}});}},\
         writeClipboard:function(t){{return window.__TAURI__.core.invoke('write_clipboard',{{text:t}});}}}};</script>"
    );
    if let Some(i) = html.find("<script type=\"module\"") {
        format!("{}{}{}", &html[..i], shim, &html[i..])
    } else if let Some(i) = html.find("</head>") {
        format!("{}{}{}", &html[..i], shim, &html[i..])
    } else {
        format!("{shim}{html}")
    }
}

#[tauri::command]
async fn save_file(app: tauri::AppHandle, filename: String, content: String) -> bool {
    let picked = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .blocking_save_file();
    match picked.and_then(|p| p.into_path().ok()) {
        Some(path) => std::fs::write(path, content).is_ok(),
        None => false,
    }
}

#[tauri::command]
fn write_clipboard(app: tauri::AppHandle, text: String) -> bool {
    app.clipboard().write_text(text).is_ok()
}

fn set_current(app: &tauri::AppHandle, fw: &str) {
    if let Some(state) = app.try_state::<AppState>() {
        *state.current.lock().unwrap() = fw.to_string();
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.eval("window.location.reload()");
    }
}

fn main() {
    let initial = std::env::var("IRIS_FW")
        .ok()
        .filter(|f| built(f))
        .or_else(|| {
            FRAMEWORKS
                .iter()
                .map(|(f, _)| f.to_string())
                .find(|f| built(f))
        })
        .unwrap_or_else(|| "react".to_string());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            current: Mutex::new(initial),
        })
        .register_uri_scheme_protocol("iris", |ctx, request| {
            let app = ctx.app_handle();
            let fw = app
                .state::<AppState>()
                .current
                .lock()
                .unwrap()
                .clone();
            match serve_asset(&fw, request.uri().path()) {
                Some((body, ctype)) => tauri::http::Response::builder()
                    .header("Content-Type", ctype)
                    .body(body)
                    .unwrap(),
                None => tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .invoke_handler(tauri::generate_handler![save_file, write_clipboard])
        .setup(|app| {
            // Native "Framework" menu to switch the hosted CMS live.
            let mut sub = SubmenuBuilder::new(app, "Framework");
            for (fw, label) in FRAMEWORKS {
                if built(fw) {
                    sub = sub.text(format!("fw:{fw}"), label);
                }
            }
            let submenu = sub.build()?;
            let menu = MenuBuilder::new(app).item(&submenu).build()?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                if let Some(fw) = event.id().as_ref().strip_prefix("fw:") {
                    set_current(app, fw);
                }
            });

            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::CustomProtocol("iris://localhost/".parse().unwrap()),
            )
            .title("Iris CMS — Tauri desktop shell")
            .inner_size(1320.0, 860.0)
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serves_each_framework_with_injected_bridge() {
        for (fw, _) in FRAMEWORKS {
            if !built(fw) {
                continue;
            }
            let (body, ctype) = serve_asset(fw, "/").expect("index served");
            let html = String::from_utf8_lossy(&body);
            assert!(ctype.starts_with("text/html"), "{fw}: wrong content-type");
            assert!(html.contains("window.irisNative"), "{fw}: no shim");
            assert!(
                html.contains(&format!("framework:'{fw}'")),
                "{fw}: wrong fw identity"
            );
            // shim must precede the app's module script
            if let Some(j) = html.find("type=\"module\"") {
                let i = html.find("window.irisNative").unwrap();
                assert!(i < j, "{fw}: shim not before module script");
            }
            // a referenced hashed asset must resolve
            if let Some(start) = html.find("/assets/") {
                let rest = &html[start..];
                let end = rest.find('"').unwrap();
                let asset = &rest[..end];
                let (abytes, _) = serve_asset(fw, asset).expect("asset served");
                assert!(!abytes.is_empty(), "{fw}: empty asset {asset}");
            }
        }
    }

    #[test]
    fn spa_fallback_returns_index() {
        let fw = FRAMEWORKS.iter().map(|(f, _)| *f).find(|f| built(f));
        if let Some(fw) = fw {
            let (body, ctype) = serve_asset(fw, "/deep/unknown/route").expect("fallback");
            assert!(ctype.starts_with("text/html"));
            assert!(String::from_utf8_lossy(&body).contains("window.irisNative"));
        }
    }
}
