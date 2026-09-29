/**
 * 设置模块
 * 默认打开的页面（观看状态筛选）等本地偏好， localStorage 持久化
 */

const DEFAULT_STATUS_KEY = 'anime-record-default-status';

// 可选的默认页面（全部 + 各观看状态）
const DEFAULT_STATUS_VALUES = ['all', ...Object.values(STATUS)];
const DEFAULT_STATUS_LABELS = {
    all: '全部',
    [STATUS.WANT_TO_WATCH]: '想看',
    [STATUS.WATCHING]: '在看',
    [STATUS.WATCHED]: '看过',
    [STATUS.ON_HOLD]: '搁置',
    [STATUS.DROPPED]: '抛弃'
};

/**
 * 读取默认打开的页面，无有效存储时回退到「在看」
 * @returns {string} 状态筛选值
 */
function loadDefaultStatus() {
    try {
        const v = localStorage.getItem(DEFAULT_STATUS_KEY);
        return DEFAULT_STATUS_VALUES.includes(v) ? v : STATUS.WATCHING;
    } catch (e) {
        return STATUS.WATCHING;
    }
}

/**
 * 把状态筛选按钮切换为存储的默认页面（启动时调用，需在首次 refreshCards 之前）
 */
function applyDefaultStatusFilter() {
    const value = loadDefaultStatus();
    const btn = document.querySelector(`.filter-btn[data-status="${value}"]`);
    if (!btn) return;

    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

/**
 * 保存默认打开的页面
 * @param {string} value
 */
function setDefaultStatus(value) {
    if (!DEFAULT_STATUS_VALUES.includes(value)) return;

    try {
        localStorage.setItem(DEFAULT_STATUS_KEY, value);
    } catch (e) {
        console.warn('保存设置失败:', e);
        return;
    }
    syncDefaultStatusOptions();
}

/**
 * 同步设置弹窗内选项胶囊的选中态与提示文案
 */
function syncDefaultStatusOptions() {
    const value = loadDefaultStatus();

    document.querySelectorAll('#default-status-options .option-chip').forEach(btn => {
        const selected = btn.dataset.value === value;
        btn.classList.toggle('selected', selected);
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    const hint = document.getElementById('default-status-hint');
    if (hint) {
        hint.textContent = `打开页面时默认展示「${DEFAULT_STATUS_LABELS[value] || value}」分类`;
    }
}

/**
 * 打开设置弹窗
 */
function openSettingsModal() {
    syncDefaultStatusOptions();
    document.getElementById('settings-overlay').classList.remove('hidden');
}

/**
 * 关闭设置弹窗
 */
function closeSettingsModal() {
    document.getElementById('settings-overlay').classList.add('hidden');
}
