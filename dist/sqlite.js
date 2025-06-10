// 导入 Tauri API
const {invoke} = window.__TAURI__.core;
const command = 'plugin:sql|execute';

/**
 * 加载指定键名的设置值。
 * @param {string} key 设置的键名
 * @returns {Promise<string|null>} 设置的值 (字符串类型)，如果不存在则返回 null。
 */
export function loadSettingFromDB(key) {
    try {
        // 调用 Rust 后端的 load_setting 命令
        const value = invoke(command, {
            db: 'sqlite',
            sql: 'SELECT value FROM settings WHERE key_name = ?',
            values: [key]
        });

        console.log(`设置 '${key}' 从后端加载: ${value}`);

        return value;
    } catch (e) {
        console.error(`从 Rust 后端加载设置 '${key}' 失败:`, e);
        return null;
    }
}

/**
 * 从 Rust 后端加载所有单词对。
 * @returns {Promise<Array<{english: string, chinese: string}>>}
 */
export function loadWordsFromDB() {
    try {
        const words = invoke(command, {
            db: 'sqlite',
            sql: 'SELECT english, chinese FROM words ORDER BY english;'
        });

        console.log(words);

        // 更新界面
        if (typeof updateStats === 'function') {
            updateStats();
        }
        if (typeof renderWordList === 'function') {
            renderWordList();
        }

        console.log(`单词已从后端加载。总数: ${words.length} 个.`);

        return words;
    } catch (e) {
        console.error('从 Rust 后端加载单词失败:', e);
        if (typeof displayMessage === 'function') {
            displayMessage('加载单词失败，请尝试重新启动应用。', 'error');
        }
        return [];
    }
}

/**
 * 通过 Rust 后端保存或更新单词对。
 * @param {string} english 英语单词
 * @param {string} chinese 对应的中文意思
 * @returns {Promise<void>}
 */
export async function saveWordToDB(english, chinese) {
    try {
        // 调用 Rust 后端的 save_word 命令
        await window.__TAURI__.invoke('save_word', {english, chinese});
        await loadWordsFromDB(); // 保存后重新加载单词以更新界面
        console.log(`单词 '${english}' 已保存/更新到后端.`);
    } catch (e) {
        console.error('保存单词到后端失败:', e);
        if (typeof displayMessage === 'function') {
            displayMessage('保存单词失败，请检查输入或重新启动应用。', 'error');
        }
        throw e; // 抛出错误以便调用者捕获
    }
}

/**
 * 通过 Rust 后端删除指定英语单词的单词对。
 * @param {string} english 要删除的英语单词
 * @returns {Promise<void>}
 */
export async function deleteWordFromDB(english) {
    try {
        // 调用 Rust 后端的 delete_word 命令
        await window.__TAURI__.invoke('delete_word', {english});
        await loadWordsFromDB(); // 删除后重新加载单词以更新界面
        console.log(`单词 '${english}' 已从后端删除.`);
    } catch (e) {
        console.error('从后端删除单词失败:', e);
        if (typeof displayMessage === 'function') {
            displayMessage('删除单词失败，请尝试重新启动应用。', 'error');
        }
        throw e;
    }
}


/**
 * 通过 Rust 后端保存游戏设置。
 * @param {string} key 设置的键名
 * @param {any} value 设置的值
 * @returns {Promise<void>}
 */
export async function saveSettingToDB(key, value) {
    try {
        // 调用 Rust 后端的 save_setting 命令
        await window.__TAURI__.invoke('save_setting', {key, value: String(value)});
        console.log(`设置 '${key}' 已保存到后端: ${value}`);
        // 更新全局变量（如果需要）
        if (key === 'gamesPlayed' && typeof gamesPlayed !== 'undefined') {
            gamesPlayed = parseInt(value, 10);
        } else if (key === 'highScore' && typeof highScore !== 'undefined') {
            highScore = parseInt(value, 10);
        } else if (key === 'pairCount' && typeof pairCount !== 'undefined') {
            pairCount = parseInt(value, 10);
        }
    } catch (e) {
        console.error(`保存设置 '${key}' 到后端失败:`, e);
        if (typeof displayMessage === 'function') {
            displayMessage(`保存设置失败: ${e}`, 'error');
        }
        throw e;
    }
}
