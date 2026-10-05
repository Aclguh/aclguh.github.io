/**
 * LocalStorage 安全持久化工具封装
 * 提供 QuotaExceededError 容错与无痕模式兼容
 */

const SafeStorage = {
    /**
     * 获取存储数据
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
     * 设置存储数据
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
    }
};

if (typeof window !== 'undefined') {
    window.SafeStorage = SafeStorage;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SafeStorage };
}
