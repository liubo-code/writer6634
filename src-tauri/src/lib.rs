use std::{fs, path::PathBuf};

#[tauri::command]
fn choose_data_directory() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("选择伏线的本地保存位置")
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn ensure_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<Option<String>, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn local_path_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

#[tauri::command]
fn rename_local_path(from: String, to: String) -> Result<(), String> {
    let from = PathBuf::from(from);
    let to = PathBuf::from(to);
    if !from.exists() {
        return Ok(());
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(from, to).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            choose_data_directory,
            ensure_directory,
            write_text_file,
            read_text_file,
            local_path_exists,
            rename_local_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fuxian desktop");
}
