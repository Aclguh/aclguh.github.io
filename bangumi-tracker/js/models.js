/**
 * 数据模型与常量定义
 */

// 观看状态常量
const STATUS = {
    WANT_TO_WATCH: 'want_to_watch',
    WATCHING: 'watching',
    WATCHED: 'watched',
    ON_HOLD: 'on_hold',
    DROPPED: 'dropped'
};

// 状态中文映射
const STATUS_LABELS = {
    [STATUS.WANT_TO_WATCH]: '想看',
    [STATUS.WATCHING]: '在看',
    [STATUS.WATCHED]: '看过',
    [STATUS.ON_HOLD]: '搁置',
    [STATUS.DROPPED]: '抛弃'
};

// 状态排序权重
const STATUS_ORDER = {
    [STATUS.WATCHING]: 1,
    [STATUS.WANT_TO_WATCH]: 2,
    [STATUS.ON_HOLD]: 3,
    [STATUS.WATCHED]: 4,
    [STATUS.DROPPED]: 5
};

// 状态颜色映射
const STATUS_COLORS = {
    [STATUS.WANT_TO_WATCH]: '#3498db',
    [STATUS.WATCHING]: '#27ae60',
    [STATUS.WATCHED]: '#e67e22',
    [STATUS.ON_HOLD]: '#95a5a6',
    [STATUS.DROPPED]: '#e74c3c'
};

// 季度常量
const SEASONS = ['winter', 'spring', 'summer', 'fall'];
const SEASON_LABELS = {
    winter: '冬',
    spring: '春',
    summer: '夏',
    fall: '秋'
};
const SEASON_LABELS_FULL = {
    winter: '冬季',
    spring: '春季',
    summer: '夏季',
    fall: '秋季'
};

// 预设标签
const PRESET_TAGS = [
    '奇幻', '冒险', '战斗', '热血', '搞笑', '日常',
    '恋爱', '校园', '科幻', '机战', '悬疑', '推理',
    '治愈', '致郁', '异世界', '穿越', '运动', '音乐',
    '美食', '职场', '历史', '战争', '恐怖', '魔法'
];

// 排序选项
const SORT_OPTIONS = {
    DATE_ADDED_DESC: 'date_added_desc',
    DATE_ADDED_ASC: 'date_added_asc',
    RATING_DESC: 'rating_desc',
    RATING_ASC: 'rating_asc',
    TITLE_ZH_ASC: 'title_zh_asc',
    TITLE_ZH_DESC: 'title_zh_desc',
    YEAR_DESC: 'year_desc',
    YEAR_ASC: 'year_asc',
    EPISODES_LEFT: 'episodes_left'
};

const SORT_LABELS = {
    [SORT_OPTIONS.DATE_ADDED_DESC]: '最近添加',
    [SORT_OPTIONS.DATE_ADDED_ASC]: '最早添加',
    [SORT_OPTIONS.RATING_DESC]: '评分从高到低',
    [SORT_OPTIONS.RATING_ASC]: '评分从低到高',
    [SORT_OPTIONS.TITLE_ZH_ASC]: '名称 A-Z',
    [SORT_OPTIONS.TITLE_ZH_DESC]: '名称 Z-A',
    [SORT_OPTIONS.YEAR_DESC]: '年份从新到旧',
    [SORT_OPTIONS.YEAR_ASC]: '年份从旧到新',
    [SORT_OPTIONS.EPISODES_LEFT]: '剩余集数'
};

// 数据版本
const DATA_VERSION = 1;

/**
 * 生成唯一 ID
 * 优先使用 crypto.randomUUID()，降级使用时间戳+随机数
 */
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * 创建空白记录模板
 * @returns {Object} 空记录
 */
function createEmptyRecord() {
    const now = new Date().toISOString();
    return {
        id: generateId(),
        titleZh: '',
        titleJa: '',
        coverUrl: '',
        status: STATUS.WANT_TO_WATCH,
        rating: 0,
        episodesWatched: 0,
        episodesTotal: 0,
        tags: [],
        notes: '',
        startDate: '',
        endDate: '',
        year: new Date().getFullYear(),
        season: '',
        createdAt: now,
        updatedAt: now
    };
}

/**
 * 验证记录是否有效
 * @param {Object} record
 * @returns {string|null} 错误信息，null 表示有效
 */
function validateRecord(record) {
    if (!record.titleZh || !record.titleZh.trim()) {
        return '请输入番剧名称';
    }
    if (record.rating < 0 || record.rating > 10) {
        return '评分应在 0-10 之间';
    }
    if (record.episodesWatched < 0 || record.episodesTotal < 0) {
        return '集数不能为负数';
    }
    if (record.episodesWatched > record.episodesTotal && record.episodesTotal > 0) {
        return '已看集数不能超过总集数';
    }
    return null;
}
