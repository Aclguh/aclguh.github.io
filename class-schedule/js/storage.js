/**
 * localStorage 数据持久层
 * 负责课表数据和开学日期的存取
 */

const STORAGE_KEY = 'class-schedule-data';
const WEEK_KEY = 'class-schedule-current-week';
const SEMESTER_DATE_KEY = 'class-schedule-semester-start';

/**
 * 加载课表数据
 * @returns {Object|null}
 */
function loadSchedule() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data.courses || !Array.isArray(data.courses)) return null;
        return data;
    } catch (e) {
        console.error('加载课表数据失败:', e);
        return null;
    }
}

/**
 * 保存课表数据
 * @param {Object} data
 * @returns {boolean}
 */
function saveSchedule(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            alert('存储空间不足！请清理浏览器数据后重试。');
        } else {
            console.error('保存课表数据失败:', e);
        }
        return false;
    }
}

/**
 * 加载当前周次
 * @returns {number}
 */
function loadCurrentWeek() {
    try {
        const raw = localStorage.getItem(WEEK_KEY);
        const week = parseInt(raw);
        return (week > 0 && week <= 30) ? week : 1;
    } catch (e) { return 1; }
}

/**
 * 保存当前周次
 * @param {number} week
 */
function saveCurrentWeek(week) {
    try { localStorage.setItem(WEEK_KEY, week.toString()); } catch (e) {}
}

/**
 * 加载开学日期（学期第一周的周一）
 * @returns {string|null} 'YYYY-MM-DD' 或 null
 */
function loadSemesterStart() {
    try {
        const val = localStorage.getItem(SEMESTER_DATE_KEY);
        return val || null;
    } catch (e) { return null; }
}

/**
 * 保存开学日期
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
function saveSemesterStart(dateStr) {
    try { localStorage.setItem(SEMESTER_DATE_KEY, dateStr); } catch (e) {}
}

/**
 * 清空所有数据
 */
function clearSchedule() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WEEK_KEY);
    localStorage.removeItem(SEMESTER_DATE_KEY);
}

/**
 * 检查是否有已保存的数据
 * @returns {boolean}
 */
function hasSchedule() {
    return localStorage.getItem(STORAGE_KEY) !== null;
}
