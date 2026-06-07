/**
 * localStorage 数据持久层
 * 负责课表数据的存取
 */

const STORAGE_KEY = 'class-schedule-data';
const WEEK_KEY = 'class-schedule-current-week';

/**
 * 加载课表数据
 * @returns {Object|null} 课表数据对象，无数据返回 null
 */
function loadSchedule() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);

        // 基本验证
        if (!data.courses || !Array.isArray(data.courses)) {
            return null;
        }

        return data;
    } catch (e) {
        console.error('加载课表数据失败:', e);
        return null;
    }
}

/**
 * 保存课表数据
 * @param {Object} data - 课表数据
 * @returns {boolean} 是否保存成功
 */
function saveSchedule(data) {
    try {
        const json = JSON.stringify(data);
        localStorage.setItem(STORAGE_KEY, json);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.error('localStorage 空间不足！');
            alert('存储空间不足！请清理浏览器数据后重试。');
        } else {
            console.error('保存课表数据失败:', e);
        }
        return false;
    }
}

/**
 * 加载当前周次
 * @returns {number} 当前周次，默认 1
 */
function loadCurrentWeek() {
    try {
        const raw = localStorage.getItem(WEEK_KEY);
        const week = parseInt(raw);
        return (week > 0 && week <= 30) ? week : 1;
    } catch (e) {
        return 1;
    }
}

/**
 * 保存当前周次
 * @param {number} week
 */
function saveCurrentWeek(week) {
    try {
        localStorage.setItem(WEEK_KEY, week.toString());
    } catch (e) {
        console.error('保存周次失败:', e);
    }
}

/**
 * 清空所有课表数据
 */
function clearSchedule() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WEEK_KEY);
}

/**
 * 检查是否有已保存的课表数据
 * @returns {boolean}
 */
function hasSchedule() {
    return localStorage.getItem(STORAGE_KEY) !== null;
}
