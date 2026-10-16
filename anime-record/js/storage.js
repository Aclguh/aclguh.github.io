/**
 * localStorage 数据持久层
 * 接入 SafeStorage 安全封装，负责数据的存取、版本管理与墓碑机制
 */

const STORAGE_KEY = 'anime-record-records';
const VERSION_KEY = 'anime-record-version';

// 旧版本（bangumi-tracker 时期）的存储键，仅用于一次性迁移
const LEGACY_STORAGE_KEY = 'bangumi-records';
const LEGACY_VERSION_KEY = 'bangumi-version';

/**
 * 一次性迁移：把旧存储键下的数据搬到新键，保留用户已有记录
 */
function migrateLegacyStorage() {
    try {
        if (typeof SafeStorage === 'undefined') return;
        const legacy = SafeStorage.getItem(LEGACY_STORAGE_KEY);
        if (!legacy || SafeStorage.has(STORAGE_KEY)) return;

        SafeStorage.setItem(STORAGE_KEY, legacy);
        const legacyVersion = SafeStorage.getItem(LEGACY_VERSION_KEY);
        if (legacyVersion) {
            SafeStorage.setItem(VERSION_KEY, legacyVersion);
        }
        SafeStorage.remove(LEGACY_STORAGE_KEY);
        SafeStorage.remove(LEGACY_VERSION_KEY);
    } catch (e) {
        console.warn('旧数据迁移失败:', e);
    }
}

migrateLegacyStorage();

/**
 * 从存储加载所有记录
 * @returns {Array} 记录数组
 */
function loadRecords() {
    try {
        const records = typeof SafeStorage !== 'undefined' ? SafeStorage.get(STORAGE_KEY, []) : [];
        if (!Array.isArray(records)) return [];
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
    if (record.id) template.id = record.id;
    if (record.createdAt) template.createdAt = record.createdAt;
    if (record.updatedAt) template.updatedAt = record.updatedAt;

    const normalized = { ...template, ...record };
    if (!Array.isArray(normalized.tags)) {
        normalized.tags = [];
    }
    if (!record.updatedAt && normalized.createdAt) {
        normalized.updatedAt = normalized.createdAt;
    }
    return normalized;
}

/**
 * 保存所有记录到存储
 * @param {Array} records
 * @returns {boolean} 是否保存成功
 */
function saveRecords(records) {
    if (typeof SafeStorage !== 'undefined') {
        const ok = SafeStorage.set(STORAGE_KEY, records);
        if (ok) {
            SafeStorage.setItem(VERSION_KEY, DATA_VERSION.toString());
            return true;
        }
        console.error('存储空间不足或写入失败！请导出数据备份后清理部分记录。');
        if (typeof showToast === 'function') {
            showToast('存储空间不足或写入失败，请及时导出备份！', 'error');
        }
        return false;
    }
    return false;
}

/**
 * 添加单条记录
 * @param {Object} recordData - 记录数据
 * @returns {Object|null} 新建的记录，失败返回 null
 */
function addRecord(recordData) {
    const records = loadRecords();
    const newRecord = {
        ...createEmptyRecord(),
        ...recordData,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    records.unshift(newRecord);
    if (saveRecords(records)) {
        clearDeletedTombstone(newRecord.id);
        return newRecord;
    }
    return null;
}

/**
 * 更新记录
 * @param {string} id - 记录 ID
 * @param {Object} updateData - 要更新的字段
 * @returns {Object|null} 更新后的记录，未找到或失败返回 null
 */
function updateRecord(id, updateData) {
    const records = loadRecords();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) return null;

    const updated = {
        ...records[index],
        ...updateData,
        id: records[index].id,
        createdAt: records[index].createdAt,
        updatedAt: new Date().toISOString()
    };

    records[index] = updated;
    if (saveRecords(records)) {
        clearDeletedTombstone(id);
        return updated;
    }
    return null;
}

/**
 * 删除记录
 * @param {string} id - 记录 ID
 * @returns {boolean} 是否成功
 */
function deleteRecord(id) {
    const records = loadRecords();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) return false;

    records.splice(index, 1);
    if (saveRecords(records)) {
        recordDeletedTombstone(id);
        return true;
    }
    return false;
}

/* ============================================
 * 墓碑（已删除记录标记）管理
 * ============================================ */
const TOMBSTONES_KEY = 'anime-record-tombstones';

function getTombstones() {
    if (typeof SafeStorage !== 'undefined') {
        return SafeStorage.get(TOMBSTONES_KEY, {});
    }
    return {};
}

function saveTombstones(tombstones) {
    if (typeof SafeStorage !== 'undefined') {
        SafeStorage.set(TOMBSTONES_KEY, tombstones);
    }
}

function recordDeletedTombstone(id) {
    const tombstones = getTombstones();
    tombstones[id] = new Date().toISOString();
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
    for (const k in tombstones) {
        if (new Date(tombstones[k]).getTime() < cutoff) {
            delete tombstones[k];
        }
    }
    saveTombstones(tombstones);
}

function clearDeletedTombstone(id) {
    const tombstones = getTombstones();
    if (tombstones[id]) {
        delete tombstones[id];
        saveTombstones(tombstones);
    }
}

function getRecord(id) {
    const records = loadRecords();
    return records.find((r) => r.id === id) || null;
}

function checkVersion() {
    if (typeof SafeStorage === 'undefined') return;
    const version = SafeStorage.getItem(VERSION_KEY);
    if (!version || parseInt(version) < DATA_VERSION) {
        SafeStorage.setItem(VERSION_KEY, DATA_VERSION.toString());
    }
}

function getStorageUsage() {
    let used = 0;
    if (typeof localStorage !== 'undefined') {
        for (let key in localStorage) {
            if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
                used += (localStorage[key] || '').length + key.length;
            }
        }
    }
    const total = 5 * 1024 * 1024;
    return {
        used: used * 2,
        total: total,
        percent: (((used * 2) / total) * 100).toFixed(2)
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORAGE_KEY,
        VERSION_KEY,
        TOMBSTONES_KEY,
        loadRecords,
        saveRecords,
        addRecord,
        updateRecord,
        deleteRecord,
        getRecord,
        normalizeRecord,
        getTombstones,
        saveTombstones,
        recordDeletedTombstone,
        clearDeletedTombstone
    };
}
