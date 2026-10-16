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
    }
};

if (typeof window !== 'undefined') {
    window.SafeStorage = SafeStorage;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SafeStorage };
}
