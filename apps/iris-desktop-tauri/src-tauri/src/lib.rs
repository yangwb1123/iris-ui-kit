use tauri::Manager;

/// Open a file picker and return the selected file path.
#[tauri::command]
async fn pick_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "linux")]
    {
        Ok(rfd::FileDialog::new().pick_file().map(|p| p.to_string_lossy().to_string()))
    }
    #[cfg(not(target_os = "linux"))]
    {
        let path = app
            .dialog()
            .file()
            .blocking_pick_file();
        Ok(path.map(|p| p.to_string_lossy().to_string()))
    }
}

/// Read a text file from disk.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Write text content to a file.
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

/// Get the OS data directory for Iris Desktop.
#[tauri::command]
fn app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            pick_file,
            read_text_file,
            write_text_file,
            app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
