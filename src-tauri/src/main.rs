// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::plugin::Plugin;
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

// 定义单词结构，用于序列化和反序列化
#[derive(Debug, Serialize, Deserialize, Clone)]
struct WordPair {
    english: String,
    chinese: String,
}

// 定义数据库迁移（用于创建表）
fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_words_and_settings_tables",
        sql: "
        CREATE TABLE IF NOT EXISTS words (
            english TEXT PRIMARY KEY,
            chinese TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        ",
        kind: MigrationKind::Up,
    }]
}

fn main() {
    tauri::Builder::default()
        .plugin(Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            init_db,
            load_words,
            save_word,
            delete_word,
            load_setting,
            save_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
