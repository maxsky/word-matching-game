export class SQLiteHandler {
    db;

    constructor(db) {
        this.db = db;
    }

    /**
     * 从数据库获取设置
     *
     * @param key 设置名
     * @returns {Array|string}
     */
    async getSettingFromDB(key) {
        try {
            const value = await this.db.select('SELECT value FROM settings WHERE key_name = $1', [key]);

            console.log(`getSettingFromDB: Setting '${key}' loaded, value: '${value}'`);

            return value;
        } catch (e) {
            console.error(`getSettingFromDB: Setting '${key}' load failed:`, e);

            return null;
        }
    }

    /**
     * 存储设置到数据库
     *
     * @param {string} key 设置名
     * @param {string} value 设置值
     *
     * @returns {void}
     */
    async saveSettingToDB(key, value) {
        try {
            await this.db.execute(
                'INSERT OR REPLACE INTO settings (key_name, value) VALUES ($1, $2);',
                [key, value]
            );

            console.log(`saveSettingToDB: Setting '${key}' and value '${value}' saved.`);

            if (key === 'gamesPlayed') {
                gamesPlayed = parseInt(value, 10);
            } else if (key === 'highScore') {
                highScore = parseInt(value, 10);
            } else if (key === 'pairCount') {
                pairCount = parseInt(value, 10);
            }
        } catch (e) {
            console.error(`saveSettingToDB: '${key}' and '${value}' save failed:`, e);

            displayMessage(`保存设置失败: ${e}`, 'error');
        }
    }

    /**
     * 从数据库加载单词
     *
     * @returns {Array}
     */
    async loadWordsFromDB() {
        try {
            const words = await this.db.select('SELECT english, chinese FROM words ORDER BY english;');

            console.log(`loadWordsFromDB: Words loaded, total: ${words.length}.`);

            return words;
        } catch (e) {
            console.error('loadWordsFromDB: Error loading words:', e);

            displayMessage('加载单词失败，请尝试重新启动应用。', 'error');

            return [];
        }
    }

    /**
     * 新增单词
     *
     * @param english 单词
     * @param chinese 中文
     * @returns {void}
     */
    async saveWordToDB(english, chinese) {
        try {
            await this.db.execute(
                'INSERT OR REPLACE INTO words (english, chinese) VALUES ($1, $2);',
                [english, chinese]
            );

            this.loadWordsFromDB();

            console.log(`saveWordToDB: Word '${english}' saved to database.`);
        } catch (e) {
            console.error(`saveWordToDB: Saving word '${english}' to database failed: `, e);

            displayMessage('保存单词失败，请检查输入或重新启动应用。', 'error');
        }
    }

    /**
     * 删除单词
     *
     * @param english 英文单词
     * @returns {void}
     */
    async deleteWordFromDB(english) {
        try {
            await this.db.execute(
                'DELETE FROM words WHERE english = $1;',
                [english]
            );

            this.loadWordsFromDB();

            console.log(`deleteWordFromDB: Word '${english}' deleted from database.`);
        } catch (e) {
            console.error(`deleteWordFromDB: Deleting word '${english}' from database failed:`, e);

            displayMessage('删除单词失败，请尝试重新启动应用。', 'error');
        }
    }
}
