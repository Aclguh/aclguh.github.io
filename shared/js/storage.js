/**
 * LocalStorage 安全持久化工具封装
 * 提供 QuotaExceededError 容错、无痕模式兼容与命名空间隔离
 */

const SafeStorage = {
    /**
     * 获取存储数据（JSON反序列化）
     * @param {string} key
     * @param {*} defaultValue
     * @returns {*}
     */
    get(key, defaultValue = null) {
        try {
            if (typeof localStorage === 'undefined') return defaultValue;
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return defaultValue;
            return JSON.parse(raw);
        } catch (e) {
            console.warn(`[SafeStorage] 读取 ${key} 失败:`, e);
            return defaultValue;
        }
    },

    /**
     * 设置存储数据（JSON序列化）
     * @param {string} key
     * @param {*} value
     * @returns {boolean} 是否成功
     */
    set(key, value) {
        try {
            if (typeof localStorage === 'undefined') return false;
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            this._broadcast(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.error(`[SafeStorage] LocalStorage 存储配额超限! key: ${key}`);
            } else {
                console.warn(`[SafeStorage] 写入 ${key} 失败:`, e);
            }
            return false;
        }
    },

    /**
     * 获取原始字符串值
     * @param {string} key
     * @param {string|null} defaultValue
     * @returns {string|null}
     */
    getItem(key, defaultValue = null) {
        try {
            if (typeof localStorage === 'undefined') return defaultValue;
            const val = localStorage.getItem(key);
            return val !== null ? val : defaultValue;
        } catch (e) {
            console.warn(`[SafeStorage] getItem ${key} 失败:`, e);
            return defaultValue;
        }
    },

    /**
     * 保存原始字符串值
     * @param {string} key
     * @param {string} value
     * @returns {boolean}
     */
    setItem(key, value) {
        try {
            if (typeof localStorage === 'undefined') return false;
            localStorage.setItem(key, String(value));
            this._broadcast(key, value);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.error(`[SafeStorage] LocalStorage 存储配额超限! key: ${key}`);
            } else {
                console.warn(`[SafeStorage] setItem ${key} 失败:`, e);
            }
            return false;
        }
    },

    /**
     * 判断键是否存在
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        try {
            if (typeof localStorage === 'undefined') return false;
            return localStorage.getItem(key) !== null;
        } catch (e) {
            return false;
        }
    },

    /**
     * 移除键值
     * @param {string} key
     */
    remove(key) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
                this._broadcast(key, null);
            }
        } catch (e) {
            console.warn(`[SafeStorage] 移除 ${key} 失败:`, e);
        }
    },

    /**
     * 清空存储
     */
    clear() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            }
        } catch (e) {}
    },

    /**
     * 创建带前缀的独立命名空间实例
     * @param {string} prefix - 前缀，如 'farkle_' 或 'anime-record:'
     * @returns {Object} 带有同样 API 的独立存储空间
     */
    createNamespace(prefix) {
        return {
            get: (k, def) => SafeStorage.get(prefix + k, def),
            set: (k, v) => SafeStorage.set(prefix + k, v),
            getItem: (k, def) => SafeStorage.getItem(prefix + k, def),
            setItem: (k, v) => SafeStorage.setItem(prefix + k, v),
            has: (k) => SafeStorage.has(prefix + k),
            remove: (k) => SafeStorage.remove(prefix + k)
        };
    },

    /**
     * 生成安全随机唯一 ID
     * @param {string} [prefix='']
     * @returns {string}
     */
    generateId(prefix = '') {
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        return prefix ? `${prefix}_${id}` : id;
    },

    /**
     * 注册 Schema 版本与迁移函数
     * @param {string} key
     * @param {{ version: number, migrate: Function }} config
     */
    defineSchema(key, config) {
        if (!config || typeof config.version !== 'number' || typeof config.migrate !== 'function') {
            return;
        }
        const versionKey = `__schema_ver_${key}`;
        const currentVersion = parseInt(this.getItem(versionKey, '0'), 10);
        if (currentVersion < config.version) {
            const currentData = this.get(key, null);
            if (currentData !== null) {
                try {
                    const migrated = config.migrate(currentData, currentVersion);
                    this.set(key, migrated);
                } catch (e) {
                    console.warn(`[SafeStorage] Schema 迁移失败: key=${key}`, e);
                }
            }
            this.setItem(versionKey, String(config.version));
        }
    },

    /**
     * 全站数据打包导出
     * @returns {Object} 备份对象
     */
    exportAll() {
        if (typeof localStorage === 'undefined') return { timestamp: new Date().toISOString(), data: {} };
        const backup = {
            version: 1,
            exportedAt: new Date().toISOString(),
            origin: typeof location !== 'undefined' ? location.origin : 'https://aclguh.github.io',
            data: {}
        };
        if (typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) backup.data[key] = localStorage.getItem(key);
            }
        } else {
            for (const key of Object.keys(localStorage)) {
                if (typeof localStorage[key] !== 'function') {
                    backup.data[key] =
                        typeof localStorage.getItem === 'function' ? localStorage.getItem(key) : localStorage[key];
                }
            }
        }
        return backup;
    },

    /**
     * 全站数据恢复导入
     * @param {Object} backupObj
     * @param {'merge'|'replace'} [mode='merge']
     * @returns {boolean} 是否导入成功
     */
    importAll(backupObj, mode = 'merge') {
        if (!backupObj || !backupObj.data || typeof backupObj.data !== 'object') {
            return false;
        }
        if (typeof localStorage === 'undefined') return false;

        if (mode === 'replace') {
            localStorage.clear();
        }
        for (const [k, v] of Object.entries(backupObj.data)) {
            if (v !== null && v !== undefined) {
                localStorage.setItem(k, String(v));
            }
        }
        return true;
    },

    _subscribers: [],
    _channel: null,

    _getChannel() {
        if (!this._channel && typeof BroadcastChannel !== 'undefined') {
            try {
                this._channel = new BroadcastChannel('safe-storage-sync');
                if (typeof this._channel.unref === 'function') {
                    this._channel.unref();
                }
                this._channel.onmessage = (event) => {
                    if (event.data && event.data.key) {
                        this._notify(event.data.key, event.data.value);
                    }
                };
            } catch (_) {
                this._channel = null;
            }
        }
        return this._channel;
    },

    _notify(key, value) {
        for (const cb of this._subscribers) {
            try {
                cb(key, value);
            } catch (err) {
                console.warn('[SafeStorage] onChange 回调异常:', err);
            }
        }
    },

    _broadcast(key, value) {
        this._notify(key, value);
        const ch = this._getChannel();
        if (ch) {
            try {
                ch.postMessage({ key, value });
            } catch (_) {}
        }
    },

    /**
     * 订阅本地存储变更（支持同页与跨标签页同步）
     * @param {Function} callback - (key, value) => void
     * @returns {Function} 取消订阅函数
     */
    onChange(callback) {
        if (typeof callback !== 'function') return () => {};
        this._getChannel();
        this._subscribers.push(callback);
        return () => {
            const idx = this._subscribers.indexOf(callback);
            if (idx >= 0) this._subscribers.splice(idx, 1);
        };
    }
};

if (typeof window !== 'undefined') {
    window.SafeStorage = SafeStorage;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SafeStorage };
}
