// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
// 导入 State

// *** 关键修正：导入 tauri_plugin_sql 的正确类型 ***
use tauri_plugin_sql::{
    Plugin,
    Builder, // 用于插件本身的初始化
    Migration,
    MigrationKind,
};

// 定义单词结构，用于序列化和反序列化
#[derive(Debug, Serialize, Deserialize, Clone)]
struct WordPair {
    english: String,
    chinese: String,
}

// 移除 get_db_client 函数，因为我们将直接通过 State 访问数据库

// 定义数据库迁移（用于创建表）
fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_words_and_settings_tables",
        sql: "CREATE TABLE IF NOT EXISTS words (
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

// Tauri 命令：初始化数据库（应用迁移并插入默认数据）
// *** 关键修正：接收 tauri::State<Sqlite> 参数 ***
#[tauri::command]
async fn init_db(db: State<'_, Sqlite>) -> Result<(), String> {
    // 应用数据库迁移
    db.run_migrations(&get_migrations())
        .await
        .map_err(|e| format!("数据库迁移失败: {}", e))?;

    // 检查并插入默认数据（如果单词表为空）
    // select 方法现在返回 Result<Vec<Value>, Error>
    let count_result: Vec<serde_json::Value> = db
        .select("SELECT COUNT(*) as count FROM words", &[])
        .await
        .map_err(|e| format!("查询单词数量失败: {}", e))?;

    let count: i64 = count_result
        .get(0)
        .and_then(|row| row.get("count"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    if count == 0 {
        let default_words = vec![
            WordPair {
                english: "hello".to_string(),
                chinese: "你好".to_string(),
            },
            WordPair {
                english: "world".to_string(),
                chinese: "世界".to_string(),
            },
            WordPair {
                english: "apple".to_string(),
                chinese: "苹果".to_string(),
            },
            WordPair {
                english: "banana".to_string(),
                chinese: "香蕉".to_string(),
            },
            WordPair {
                english: "cat".to_string(),
                chinese: "猫".to_string(),
            },
            WordPair {
                english: "dog".to_string(),
                chinese: "狗".to_string(),
            },
            WordPair {
                english: "book".to_string(),
                chinese: "书".to_string(),
            },
            WordPair {
                english: "computer".to_string(),
                chinese: "电脑".to_string(),
            },
            WordPair {
                english: "sun".to_string(),
                chinese: "太阳".to_string(),
            },
            WordPair {
                english: "moon".to_string(),
                chinese: "月亮".to_string(),
            },
        ];
        for word_pair in default_words {
            // execute 方法现在返回 Result<ExecResult, Error>
            db.execute(
                "INSERT INTO words (english, chinese) VALUES ($1, $2)",
                &[&word_pair.english, &word_pair.chinese],
            )
            .await
            .map_err(|e| format!("插入默认单词失败: {}", e))?;
        }
        println!("Default words inserted.");
    }
    Ok(())
}

// Tauri 命令：从数据库加载所有单词
// *** 关键修正：接收 tauri::State<Sqlite> 参数 ***
#[tauri::command]
async fn load_words(db: State<'_, Sqlite>) -> Result<Vec<WordPair>, String> {
    // select 方法现在返回 Result<Vec<Value>, Error>
    let rows: Vec<serde_json::Value> = db
        .select("SELECT english, chinese FROM words ORDER BY english", &[])
        .await
        .map_err(|e| format!("查询单词失败: {}", e))?;

    let word_pairs: Vec<WordPair> = rows
        .into_iter()
        .filter_map(|row| {
            // 从 serde_json::Value 中提取
            if let (Some(english_value), Some(chinese_value)) =
                (row.get("english"), row.get("chinese"))
            {
                if let (Some(english), Some(chinese)) =
                    (english_value.as_str(), chinese_value.as_str())
                {
                    Some(WordPair {
                        english: english.to_string(),
                        chinese: chinese.to_string(),
                    })
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect();

    Ok(word_pairs)
}

// Tauri 命令：保存或更新单词
// *** 关键修正：接收 tauri::State<Sqlite> 参数 ***
#[tauri::command]
async fn save_word(db: State<'_, Sqlite>, english: String, chinese: String) -> Result<(), String> {
    db.execute(
        "INSERT OR REPLACE INTO words (english, chinese) VALUES ($1, $2)",
        &[&english, &chinese],
    )
    .await
    .map_err(|e| format!("保存单词失败: {}", e))?;

    Ok(())
}

// Tauri 命令：删除单词
// *** 关键修正：接收 tauri::State<Sqlite> 参数 ***
#[tauri::command]
async fn delete_word(db: State<'_, Sqlite>, english: String) -> Result<(), String> {
    db.execute("DELETE FROM words WHERE english = $1", &[&english])
        .await
        .map_err(|e| format!("删除单词失败: {}", e))?;

    Ok(())
}

// Tauri 命令：加载设置
// *** 关键修正：接收 tauri::State<Sqlite> 参数 ***
#[tauri::command]
async fn load_setting(db: State<'_, Sqlite>, key: String) -> Result<Option<String>, String> {
    let result: Vec<serde_json::Value> = db
        .select("SELECT value FROM settings WHERE key = $1", &[&key])
        .await
        .map_err(|e| format!("查询设置失败: {}", e))?;

    if let Some(row) = result.get(0) {
        Ok(row
            .get("value")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()))
    } else {
        Ok(None)
    }
}

// Tauri 命令：保存设置
// *** 关键修正：接收 tauri::State<Sqlite> 参数 ***
#[tauri::command]
async fn save_setting(db: State<'_, Sqlite>, key: String, value: String) -> Result<(), String> {
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
        &[&key, &value],
    )
    .await
    .map_err(|e| format!("保存设置失败: {}", e))?;

    Ok(())
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
