#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_file: bool,
}

#[tauri::command]
fn read_directory(dir_path: String) -> Vec<DirEntry> {
    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(&dir_path) {
        for entry in read_dir.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    entries.push(DirEntry {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: entry.path().to_string_lossy().to_string(),
                        is_file: true,
                    });
                }
            }
        }
    }
    entries
}

#[tauri::command]
fn check_path_exists(dir_path: String) -> bool {
    let path = Path::new(&dir_path);
    path.exists() && path.is_dir()
}

#[tauri::command]
fn join_path(base: String, part: String) -> String {
    Path::new(&base)
        .join(&part)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn read_file_bytes(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_directory,
            check_path_exists,
            join_path,
            read_file_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BitBeat");
}
