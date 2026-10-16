/**
 * localStorage 数据持久层
 * 负责课表数据、上课时间配置、周次、学期日期与视图偏好的存取
 * 接入 SafeStorage 保证异常安全与跨端降级
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
    { label: '第六大节', start: '19:00', end: '21:25' }
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
        let raw = null;
        if (typeof SafeStorage !== 'undefined') {
            raw = SafeStorage.getItem(TIME_SLOTS_KEY);
        } else if (typeof localStorage !== 'undefined') {
            raw = localStorage.getItem(TIME_SLOTS_KEY);
        }
        if (!raw) return cloneSlots(DEFAULT_TIME_SLOTS);

        const arr = JSON.parse(raw);
        if (!Array.isArray(arr) || arr.length === 0) return cloneSlots(DEFAULT_TIME_SLOTS);

        const slots = [];
        for (let i = 0; i < arr.length && i < MAX_SLOTS; i++) {
            const s = arr[i] || {};
            slots.push({
                label: String(s.label || '').trim() || '第' + (i + 1) + '节',
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
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.setItem(TIME_SLOTS_KEY, JSON.stringify(slots));
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(TIME_SLOTS_KEY, JSON.stringify(slots));
            return true;
        }
        return false;
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
    const slots = loadTimeSlots();
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
    const slots = loadTimeSlots();
    let needed = 0;

    if (data && data.courses) {
        for (let i = 0; i < data.courses.length; i++) {
            const s = data.courses[i].timeSlot;
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
        let data = null;
        if (typeof SafeStorage !== 'undefined') {
            data = SafeStorage.get(STORAGE_KEY, null);
        } else if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(STORAGE_KEY);
            data = raw ? JSON.parse(raw) : null;
        }
        if (!data || !data.courses || !Array.isArray(data.courses)) return null;
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
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.set(STORAGE_KEY, data);
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        }
        return false;
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
        const raw =
            typeof SafeStorage !== 'undefined'
                ? SafeStorage.getItem(WEEK_KEY)
                : typeof localStorage !== 'undefined'
                  ? localStorage.getItem(WEEK_KEY)
                  : null;
        const week = parseInt(raw, 10);
        return week > 0 && week <= MAX_WEEKS ? week : 1;
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
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(WEEK_KEY, week.toString());
        } else if (typeof localStorage !== 'undefined') {
            localStorage.setItem(WEEK_KEY, week.toString());
        }
    } catch (e) {}
}

/**
 * 加载开学日期（学期第一周的周一）
 * @returns {string|null} 'YYYY-MM-DD' 或 null
 */
function loadSemesterStart() {
    try {
        return typeof SafeStorage !== 'undefined'
            ? SafeStorage.getItem(SEMESTER_DATE_KEY)
            : typeof localStorage !== 'undefined'
              ? localStorage.getItem(SEMESTER_DATE_KEY)
              : null;
    } catch (e) {
        return null;
    }
}

/**
 * 保存开学日期
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
function saveSemesterStart(dateStr) {
    try {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(SEMESTER_DATE_KEY, dateStr);
        } else if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SEMESTER_DATE_KEY, dateStr);
        }
    } catch (e) {}
}

/**
 * 加载视图模式（'grid' 周课表网格 / 'day' 按天视图）
 * 未手动设置过时，窄屏默认按天视图、宽屏默认网格视图
 * @returns {string}
 */
function loadViewMode() {
    try {
        const v =
            typeof SafeStorage !== 'undefined'
                ? SafeStorage.getItem(VIEW_MODE_KEY)
                : typeof localStorage !== 'undefined'
                  ? localStorage.getItem(VIEW_MODE_KEY)
                  : null;
        if (v === 'grid' || v === 'day') return v;
    } catch (e) {}
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches) {
        return 'day';
    }
    return 'grid';
}

/**
 * 保存视图模式
 * @param {string} mode - 'grid' | 'day'
 */
function saveViewMode(mode) {
    try {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(VIEW_MODE_KEY, mode);
        } else if (typeof localStorage !== 'undefined') {
            localStorage.setItem(VIEW_MODE_KEY, mode);
        }
    } catch (e) {}
}

/**
 * 清空课表数据（保留时间配置与视图偏好，避免重复设置）
 */
function clearSchedule() {
    if (typeof SafeStorage !== 'undefined') {
        SafeStorage.remove(STORAGE_KEY);
        SafeStorage.remove(WEEK_KEY);
        SafeStorage.remove(SEMESTER_DATE_KEY);
    } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(WEEK_KEY);
        localStorage.removeItem(SEMESTER_DATE_KEY);
    }
}

/**
 * 检查是否有已保存的数据
 * @returns {boolean}
 */
function hasSchedule() {
    if (typeof SafeStorage !== 'undefined') {
        return SafeStorage.has(STORAGE_KEY);
    }
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORAGE_KEY,
        WEEK_KEY,
        SEMESTER_DATE_KEY,
        TIME_SLOTS_KEY,
        VIEW_MODE_KEY,
        MAX_WEEKS,
        MAX_SLOTS,
        DEFAULT_TIME_SLOTS,
        makeDefaultSlot,
        cloneSlots,
        loadTimeSlots,
        saveTimeSlots,
        expandTimeSlotsTo,
        getRenderSlots,
        loadSchedule,
        saveSchedule,
        loadCurrentWeek,
        saveCurrentWeek,
        loadSemesterStart,
        saveSemesterStart,
        loadViewMode,
        saveViewMode,
        clearSchedule,
        hasSchedule
    };
}
