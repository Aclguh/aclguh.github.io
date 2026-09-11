/**
 * UI 渲染模块
 * 负责统计概览、卡片列表、Toast 消息等所有 UI 更新
 */

// 当前分页状态
let currentPage = 0;
const PAGE_SIZE = 20;

/**
 * 渲染统计概览栏
 */
function renderStats(records) {
    const container = document.getElementById('stats-bar');
    const total = records.length;
    const byStatus = {};

    for (const r of records) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    const statuses = [
        { key: STATUS.WANT_TO_WATCH, color: STATUS_COLORS[STATUS.WANT_TO_WATCH], label: '想看' },
        { key: STATUS.WATCHING, color: STATUS_COLORS[STATUS.WATCHING], label: '在看' },
        { key: STATUS.WATCHED, color: STATUS_COLORS[STATUS.WATCHED], label: '看过' },
        { key: STATUS.ON_HOLD, color: STATUS_COLORS[STATUS.ON_HOLD], label: '搁置' },
        { key: STATUS.DROPPED, color: STATUS_COLORS[STATUS.DROPPED], label: '抛弃' },
    ];

    let html = `
        <div class="stat-item">
            <span class="stat-num">${total}</span>
            <span>总计</span>
        </div>
        <div class="stat-divider"></div>
    `;

    for (const s of statuses) {
        const count = byStatus[s.key] || 0;
        html += `
            <div class="stat-item">
                <span class="stat-dot" style="background:${s.color}"></span>
                <span>${s.label}</span>
                <span class="stat-num">${count}</span>
            </div>
        `;
    }

    container.innerHTML = html;

    // 更新筛选按钮上的计数
    updateFilterCounts(byStatus);
}

/**
 * 更新筛选按钮上的计数
 */
function updateFilterCounts(byStatus) {
    const allBtn = document.querySelector('[data-status="all"] .filter-count');
    if (allBtn) allBtn.textContent = '';

    for (const status of Object.values(STATUS)) {
        const btn = document.querySelector(`[data-status="${status}"] .filter-count`);
        if (btn) {
            const count = byStatus[status] || 0;
            btn.textContent = count > 0 ? count : '';
        }
    }
}

/**
 * 渲染番剧卡片列表
 * @param {Array} records - 完整的记录数组（已筛选排序）
 */
function renderCards(records) {
    const grid = document.getElementById('anime-grid');
    const emptyState = document.getElementById('empty-state');
    const loadMore = document.getElementById('load-more');

    currentPage = 0;

    if (records.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        loadMore.classList.add('hidden');

        // 根据是否有数据来源判断是初始状态还是筛选结果为空
        const allRecords = loadRecords();
        const emptyMsg = document.getElementById('empty-message');
        if (allRecords.length === 0) {
            emptyMsg.textContent = '点击「添加番剧」开始记录你的追番之旅吧！';
        } else {
            emptyMsg.textContent = '没有找到符合条件的番剧，试试调整筛选条件吧！';
        }
        return;
    }

    emptyState.classList.add('hidden');

    const page = records.slice(0, PAGE_SIZE);
    grid.innerHTML = page.map(record => createCardHTML(record)).join('');

    if (records.length > PAGE_SIZE) {
        loadMore.classList.remove('hidden');
    } else {
        loadMore.classList.add('hidden');
    }
}

/**
 * 生成单张卡片的 HTML
 */
function createCardHTML(record) {
    const statusLabel = STATUS_LABELS[record.status] || '';
    const statusColor = STATUS_COLORS[record.status] || '#999';

    // 集数显示
    let episodeInfo;
    if (record.episodesTotal > 0) {
        const remaining = record.episodesTotal - record.episodesWatched;
        episodeInfo = `<span class="ep-watched">${record.episodesWatched}</span><span class="ep-divider">/</span><span>${record.episodesTotal}</span>`;
        if (record.status === STATUS.WATCHED || remaining <= 0) {
            episodeInfo = `<span>已完成 ${record.episodesTotal} 集</span>`;
        } else if (remaining > 0) {
            episodeInfo += `<span class="ep-divider" style="margin-left:4px">剩${remaining}集</span>`;
        }
    } else if (record.episodesWatched > 0) {
        episodeInfo = `<span class="ep-watched">已看 ${record.episodesWatched} 集</span>`;
    } else {
        episodeInfo = '';
    }

    // +1集按钮
    const isCompleted = record.status === STATUS.WATCHED ||
        (record.episodesTotal > 0 && record.episodesWatched >= record.episodesTotal);
    const epBtnDisabled = isCompleted ? 'completed' : '';
    const epBtnText = isCompleted ? '✓ 已追完' : '+1集';

    return `
        <div class="anime-card" data-id="${record.id}" data-status="${record.status}">
            <div class="card-top">
                <span class="card-status-badge" style="background:${statusColor}">${statusLabel}</span>
            </div>
            <div class="card-body">
                <div class="card-title" title="${escapeHTML(record.titleZh)}">${escapeHTML(record.titleZh) || '<span style="color:var(--color-text-muted)">未命名番剧</span>'}</div>
                ${record.titleJa ? `<div class="card-title-ja" title="${escapeHTML(record.titleJa)}">${escapeHTML(record.titleJa)}</div>` : ''}
                ${episodeInfo ? `<div class="card-episodes">${episodeInfo}</div>` : ''}
            </div>
            <div class="card-footer">
                <div class="card-actions">
                    <button class="card-action-btn edit" data-action="edit" data-id="${record.id}" title="编辑">✎</button>
                    <button class="card-action-btn delete" data-action="delete" data-id="${record.id}" title="删除">🗑</button>
                </div>
                <div class="card-footer-right">
                    ${createUpdatedHTML(record)}
                    <button class="card-ep-btn ${epBtnDisabled}" data-action="ep-plus" data-id="${record.id}" ${isCompleted ? 'disabled' : ''} title="${isCompleted ? '已追完' : '集数+1'}">${epBtnText}</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 生成「最后修改时间」标签的 HTML（显示在 +1集 按钮左侧）
 * @param {Object} record
 * @returns {string} HTML 字符串，无有效时间时返回空串
 */
function createUpdatedHTML(record) {
    const label = formatUpdatedAt(record.updatedAt);
    if (!label) return '';

    return `<span class="card-updated" data-updated="${escapeHTML(record.updatedAt)}" title="最后修改：${formatFullDateTime(record.updatedAt)}">${label}</span>`;
}

/**
 * 把时间格式化为相对描述
 *   1 分钟内          → 刚刚
 *   1 小时内          → N分钟前
 *   1 天内            → N小时前
 *   3 天内            → N天前
 *   超过 3 天         → 具体日期
 * @param {string} isoString - ISO 时间字符串
 * @returns {string} 相对时间描述
 */
function formatUpdatedAt(isoString) {
    if (!isoString) return '';

    const time = new Date(isoString).getTime();
    if (Number.isNaN(time)) return '';

    const MINUTE = 60 * 1000;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;

    // 时钟偏差导致的「未来时间」按刚刚处理
    const diff = Math.max(0, Date.now() - time);

    if (diff < MINUTE) return '刚刚';
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分钟前`;
    if (diff < DAY) return `${Math.floor(diff / HOUR)}小时前`;
    if (diff < 3 * DAY) return `${Math.floor(diff / DAY)}天前`;

    return formatShortDate(new Date(time));
}

/**
 * 格式化为简短日期（同年省略年份）
 * @param {Date} date
 * @returns {string} 例：3月5日 / 2023年3月5日
 */
function formatShortDate(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return y === new Date().getFullYear() ? `${m}月${d}日` : `${y}年${m}月${d}日`;
}

/**
 * 格式化为完整时间（用于悬停提示）
 * @param {string} isoString
 * @returns {string} 例：2024-03-05 14:30
 */
function formatFullDateTime(isoString) {
    if (!isoString) return '';

    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 刷新页面上所有「最后修改时间」标签
 * （相对时间会随时间推移而变化，需定时重算）
 */
function refreshUpdatedLabels() {
    document.querySelectorAll('.card-updated[data-updated]').forEach(el => {
        const label = formatUpdatedAt(el.dataset.updated);
        if (label && el.textContent !== label) {
            el.textContent = label;
        }
    });
}

/**
 * 加载更多卡片
 */
function loadMoreCards() {
    const grid = document.getElementById('anime-grid');
    const loadMore = document.getElementById('load-more');
    const records = getFilteredAndSortedRecords();

    const start = currentPage * PAGE_SIZE;
    const page = records.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
        loadMore.classList.add('hidden');
        return;
    }

    const fragment = document.createDocumentFragment();
    const temp = document.createElement('div');
    temp.innerHTML = page.map(record => createCardHTML(record)).join('');

    while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
    }

    grid.appendChild(fragment);
    currentPage++;

    if (start + PAGE_SIZE >= records.length) {
        loadMore.classList.add('hidden');
    }
}

/**
 * 刷新整个列表（筛选后重新渲染）
 */
function refreshCards() {
    const records = getFilteredAndSortedRecords();
    renderCards(records);
    renderStats(loadRecords());
}

/**
 * 获取筛选和排序后的记录
 */
function getFilteredAndSortedRecords() {
    let records = loadRecords();
    const statusFilter = document.querySelector('.filter-btn.active')?.dataset.status || STATUS.WATCHING;
    const searchQuery = document.getElementById('search-input').value.trim().toLowerCase();
    const sortBy = document.getElementById('sort-select').value;

    // 筛选
    if (statusFilter !== 'all') {
        records = records.filter(r => r.status === statusFilter);
    }
    if (searchQuery) {
        records = records.filter(r => {
            return (r.titleZh && r.titleZh.toLowerCase().includes(searchQuery)) ||
                   (r.titleJa && r.titleJa.toLowerCase().includes(searchQuery)) ||
                   (r.notes && r.notes.toLowerCase().includes(searchQuery)) ||
                   (r.tags && r.tags.some(t => t.toLowerCase().includes(searchQuery)));
        });
    }

    // 排序
    if (sortBy) {
        records = sortRecords(records, sortBy);
    }

    return records;
}

/**
 * 排序记录
 */
function sortRecords(records, sortBy) {
    const sorted = [...records];

    switch (sortBy) {
        case SORT_OPTIONS.DATE_ADDED_DESC:
            sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case SORT_OPTIONS.DATE_ADDED_ASC:
            sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case SORT_OPTIONS.TITLE_ZH_ASC:
            sorted.sort((a, b) => (a.titleZh || '').localeCompare(b.titleZh || '', 'zh'));
            break;
        case SORT_OPTIONS.TITLE_ZH_DESC:
            sorted.sort((a, b) => (b.titleZh || '').localeCompare(a.titleZh || '', 'zh'));
            break;
        case SORT_OPTIONS.EPISODES_LEFT:
            sorted.sort((a, b) => {
                const leftA = a.episodesTotal > 0 ? Math.max(0, a.episodesTotal - a.episodesWatched) : Infinity;
                const leftB = b.episodesTotal > 0 ? Math.max(0, b.episodesTotal - b.episodesWatched) : Infinity;
                return leftA - leftB;
            });
            break;
        default:
            // 默认：状态排序 + 创建时间倒序
            sorted.sort((a, b) => {
                const orderA = STATUS_ORDER[a.status] || 99;
                const orderB = STATUS_ORDER[b.status] || 99;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
            break;
    }

    return sorted;
}

/**
 * 显示 Toast 消息
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }, duration);
}

/**
 * 显示确认对话框
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-overlay');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;

        overlay.classList.remove('hidden');

        function cleanup() {
            overlay.classList.add('hidden');
            document.getElementById('confirm-ok').removeEventListener('click', onOk);
            document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeydown);
        }

        function onOk() {
            cleanup();
            resolve(true);
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }

        function onKeydown(e) {
            if (e.key === 'Escape') {
                onCancel();
            } else if (e.key === 'Enter') {
                onOk();
            }
        }

        document.getElementById('confirm-ok').addEventListener('click', onOk);
        document.getElementById('confirm-cancel').addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeydown);
        document.getElementById('confirm-ok').focus();
    });
}

/**
 * HTML 转义
 */
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
