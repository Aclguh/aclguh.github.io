/**
 * localStorage 数据持久层
 * 负责课表数据、上课时间配置、周次、学期日期与视图偏好的存取
 */

const STORAGE_KEY = 'class-schedule-data';
const WEEK_KEY = 'class-schedule-current-week';
const SEMESTER_DATE_KEY = 'class-schedule-semester-start';
const TIME_SLOTS_KEY = 'class-schedule-time-slots';
const VIEW_MODE_KEY = 'class-schedule-view-mode';

/** 总周数上限 */
const MAX_WEEKS = 30;
/** 节数（时间段）上限 */
const MAX_SLOTS = 20;

/** 默认上课时间配置（首次使用或配置损坏时的回退值） */
const DEFAULT_TIME_SLOTS = [
    { label: '第一大节', start: '08:30', end: '10:05' },
    { label: '第二大节', start: '10:25', end: '12:00' },
    { label: '第三大节', start: '12:20', end: '13:50' },
    { label: '第四大节', start: '14:00', end: '15:35' },
    { label: '第五大节', start: '15:55', end: '17:30' },
    { label: '第六大节', start: '19:00', end: '21:25' },
];

/**
 * 生成一个只有名称、没有时间的默认节次
 * @param {number} n - 节次序号（1 基）
 * @returns {{label:string, start:string, end:string}}
 */
function makeDefaultSlot(n) {
    return { label: '第' + n + '节', start: '', end: '' };
}

/**
 * 深拷贝节次配置数组
 * @param {Array} slots
 * @returns {Array}
 */
function cloneSlots(slots) {
    return slots.map(function (s) {
        return { label: s.label, start: s.start || '', end: s.end || '' };
    });
}

/**
 * 加载上课时间配置（缺失或损坏时返回默认配置）
 * @returns {Array<{label:string, start:string, end:string}>}
 */
function loadTimeSlots() {
    try {
        var raw = localStorage.getItem(TIME_SLOTS_KEY);
        if (!raw) return cloneSlots(DEFAULT_TIME_SLOTS);

        var arr = JSON.parse(raw);
        if (!Array.isArray(arr) || arr.length === 0) return cloneSlots(DEFAULT_TIME_SLOTS);

        var slots = [];
        for (var i = 0; i < arr.length && i < MAX_SLOTS; i++) {
            var s = arr[i] || {};
            slots.push({
                label: String(s.label || '').trim() || ('第' + (i + 1) + '节'),
                start: typeof s.start === 'string' ? s.start : '',
                end: typeof s.end === 'string' ? s.end : ''
            });
        }
        return slots;
    } catch (e) {
        console.error('加载上课时间配置失败:', e);
        return cloneSlots(DEFAULT_TIME_SLOTS);
    }
}

/**
 * 保存上课时间配置
 * @param {Array} slots
 * @returns {boolean}
 */
function saveTimeSlots(slots) {
    try {
        localStorage.setItem(TIME_SLOTS_KEY, JSON.stringify(slots));
        return true;
    } catch (e) {
        console.error('保存上课时间配置失败:', e);
        return false;
    }
}

/**
 * 将时间配置扩展到指定节数（不足时用默认节次补齐）
 * @param {number} count - 目标节数
 * @returns {Array} 扩展后的最新配置
 */
function expandTimeSlotsTo(count) {
    var slots = loadTimeSlots();
    while (slots.length < count && slots.length < MAX_SLOTS) {
        slots.push(makeDefaultSlot(slots.length + 1));
    }
    saveTimeSlots(slots);
    return slots;
}

/**
 * 获取"渲染用"节次配置：
 * 当课程数据引用了比当前配置更多的节次时（例如删过配置后导入的旧数据），
 * 自动用默认节次补齐，保证所有课程都能显示
 * @param {Object|null} data - 课表数据
 * @returns {Array}
 */
function getRenderSlots(data) {
    var slots = loadTimeSlots();
    var needed = 0;

    if (data && data.courses) {
        for (var i = 0; i < data.courses.length; i++) {
            var s = data.courses[i].timeSlot;
            if (typeof s === 'number' && s + 1 > needed) needed = s + 1;
        }
    }

    while (slots.length < needed && slots.length < MAX_SLOTS) {
        slots.push(makeDefaultSlot(slots.length + 1));
    }
    return slots;
}

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
        return (week > 0 && week <= MAX_WEEKS) ? week : 1;
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
 * 加载视图模式（'grid' 周课表网格 / 'day' 按天视图）
 * 未手动设置过时，窄屏默认按天视图、宽屏默认网格视图
 * @returns {string}
 */
function loadViewMode() {
    try {
        var v = localStorage.getItem(VIEW_MODE_KEY);
        if (v === 'grid' || v === 'day') return v;
    } catch (e) {}
    if (typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia('(max-width: 767px)').matches) {
        return 'day';
    }
    return 'grid';
}

/**
 * 保存视图模式
 * @param {string} mode - 'grid' | 'day'
 */
function saveViewMode(mode) {
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch (e) {}
}

/**
 * 清空课表数据（保留时间配置与视图偏好，避免重复设置）
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
