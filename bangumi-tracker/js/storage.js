/**
 * localStorage 数据持久层
 * 负责数据的存取、版本管理
 */

const STORAGE_KEY = 'bangumi-records';
const VERSION_KEY = 'bangumi-version';

/**
 * 从 localStorage 加载所有记录
 * @returns {Array} 记录数组
 */
function loadRecords() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];

        const records = JSON.parse(data);
        if (!Array.isArray(records)) return [];

        // 确保每条记录有完整的字段
        return records.map(normalizeRecord);
    } catch (e) {
        console.error('加载数据失败:', e);
        return [];
    }
}

/**
 * 规范化记录，补充缺失字段
 */
function normalizeRecord(record) {
    const template = createEmptyRecord();
    // 保留已有 id 和时间戳
    if (record.id) template.id = record.id;
    if (record.createdAt) template.createdAt = record.createdAt;
    if (record.updatedAt) template.updatedAt = record.updatedAt;

    const normalized = { ...template, ...record };
    // 确保 tags 是数组
    if (!Array.isArray(normalized.tags)) {
        normalized.tags = [];
    }
    return normalized;
}

/**
 * 保存所有记录到 localStorage
 * @param {Array} records
 * @returns {boolean} 是否保存成功
 */
function saveRecords(records) {
    try {
        const data = JSON.stringify(records);
        localStorage.setItem(STORAGE_KEY, data);
        localStorage.setItem(VERSION_KEY, DATA_VERSION.toString());
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.error('localStorage 空间不足！请考虑删除一些封面 URL 较长的记录或导出数据后清理。');
            alert('存储空间不足！请导出数据备份后清理部分记录，或删除一些较长的封面图片 URL。');
        } else {
            console.error('保存数据失败:', e);
        }
        return false;
    }
}

/**
 * 添加单条记录
 * @param {Object} record
 * @returns {Object|null} 添加成功返回记录，失败返回 null
 */
function addRecord(record) {
    const records = loadRecords();
    const newRecord = {
        ...createEmptyRecord(),
        ...record,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    records.push(newRecord);
    if (saveRecords(records)) {
        return newRecord;
    }
    return null;
}

/**
 * 更新单条记录
 * @param {string} id
 * @param {Object} data
 * @returns {Object|null} 更新成功返回记录，失败返回 null
 */
function updateRecord(id, data) {
    const records = loadRecords();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;

    records[index] = {
        ...records[index],
        ...data,
        id: records[index].id, // 不可变 ID
        createdAt: records[index].createdAt, // 不可变创建时间
        updatedAt: new Date().toISOString()
    };
    if (saveRecords(records)) {
        return records[index];
    }
    return null;
}

/**
 * 删除单条记录
 * @param {string} id
 * @returns {boolean}
 */
function deleteRecord(id) {
    const records = loadRecords();
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) return false;
    return saveRecords(filtered);
}

/**
 * 获取单条记录
 * @param {string} id
 * @returns {Object|null}
 */
function getRecord(id) {
    const records = loadRecords();
    return records.find(r => r.id === id) || null;
}

/**
 * 检查数据版本，执行迁移
 */
function checkVersion() {
    const version = localStorage.getItem(VERSION_KEY);
    if (!version || parseInt(version) < DATA_VERSION) {
        // 未来版本迁移逻辑可以在这里添加
        localStorage.setItem(VERSION_KEY, DATA_VERSION.toString());
    }
}

/**
 * 获取存储使用情况
 * @returns {Object} { used: bytes, total: bytes, percent: number }
 */
function getStorageUsage() {
    let used = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            used += localStorage[key].length + key.length;
        }
    }
    // localStorage 通常限制 5MB
    const total = 5 * 1024 * 1024;
    return {
        used: used * 2, // UTF-16 编码，每个字符 2 字节
        total: total,
        percent: ((used * 2) / total * 100).toFixed(2)
    };
}
