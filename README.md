# 英语单词配对游戏

## 架构

依赖系统浏览器环境，Windows 下需安装 `Microsoft Edge WebView2`

- Rust: `1.87.0`
- Tauri: `2.5.1`
- Tauri 构建 tauri-build: `2.2.0`
- Tauri 插件 tauri-plugin-sql: `2.2.0`

## 命令

调试运行

```bash
yarn tauri dev
# 或
npm run tauri dev
```

编译

```bash
yarn tauri build
# 或
npm run tauri build
```

## 运行

将 `words.base.db` 重命名为 `words.db`，放到可执行文件如：`word-matching-game.exe` 相同文件夹下运行即可
