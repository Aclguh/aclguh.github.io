/**
 * UI 渲染模块
 * 负责统计概览、卡片列表、Toast 消息等所有 UI 更新
 */

// 当前分页状态
let currentPage = 0;
const PAGE_SIZE = 20;

// 当前选中的周几筛选（'' 表示不筛选）
let activeWeekFilter = '';

/* ============================================
   内联 SVG 图标（不依赖任何图标字体 / emoji）
   ============================================ */
const ICONS = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5z"/><path d="m3 14 9 5 9-5"/></svg>'
};

/** 图标 + 文案 的按钮内容 */
function iconLabel(icon, text) {
    return `${ICONS[icon] || ''}<span>${text}</span>`;
}

/**
 * 渲染统计概览栏
 */
function renderStats(records) {
    const container = document.getElementById('stats-bar');
    const total = records.length;
    const byStatus = {};
    let episodesWatchedTotal = 0;

    for (const r of records) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        const watched = parseInt(r.episodesWatched, 10);
        if (watched > 0) episodesWatchedTotal += watched;
    }

    const statuses = [
        { key: STATUS.WANT_TO_WATCH, label: '想看' },
        { key: STATUS.WATCHING, label: '在看' },
        { key: STATUS.WATCHED, label: '看过' },
        { key: STATUS.ON_HOLD, label: '搁置' },
        { key: STATUS.DROPPED, label: '抛弃' }
    ];

    let html = `
        <div class="stat-item total">
            <span class="stat-num">${total}</span>
            <span class="stat-label">共收录</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item episodes">
            <span class="stat-ep-num">${episodesWatchedTotal}</span>
            <span class="stat-label">集已观看</span>
        </div>
        <div class="stat-divider"></div>
    `;

    for (const s of statuses) {
        const count = byStatus[s.key] || 0;
        const color = STATUS_COLORS[s.key];
        html += `
            <div class="stat-item" style="--stat-color:${color}">
                <span class="stat-dot"></span>
                <span class="stat-label">${s.label}</span>
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
 * 生成状态标记的 HTML
 * @param {Object} record
 */
function createStatusBadgeHTML(record) {
    const statusLabel = STATUS_LABELS[record.status] || '';
    const statusColor = STATUS_COLORS[record.status] || '#999';
    return `<span class="badge badge-status" style="--badge-color:${statusColor}"><i class="badge-dot"></i>${statusLabel}</span>`;
}

/**
 * 生成「周几」标记的 HTML
 * 未设置周几时返回空串（不显示标记）
 * @param {Object} record
 */
function createWeekBadgeHTML(record) {
    const label = WEEK_LABELS[record.week];
    if (!label) return '';

    const [bg, fg] = WEEK_COLORS[record.week] || ['#f1f1f1', '#666'];
    return `<span class="badge badge-week" style="--badge-bg:${bg};--badge-fg:${fg}" title="更新频率：${WEEK_LABELS_FULL[record.week] || label}">
        <span class="badge-icon">${ICONS.calendar}</span>${label}
    </span>`;
}

/**
 * 生成标记区（状态 + 周几）的 HTML
 */
function createBadgesHTML(record) {
    return createStatusBadgeHTML(record) + createWeekBadgeHTML(record);
}

/**
 * 生成集数信息的 HTML（不含外层容器）
 * @param {Object} record
 * @returns {string} 无集数信息时返回空串
 */
function createEpisodeInfoHTML(record) {
    if (record.episodesTotal > 0) {
        const remaining = record.episodesTotal - record.episodesWatched;
        if (record.status === STATUS.WATCHED || remaining <= 0) {
            return `<span class="ep-done">${ICONS.check}已完成 ${record.episodesTotal} 集</span>`;
        }
        return `
            <span class="ep-progress">
                <span class="ep-watched">${record.episodesWatched}</span>
                <span class="ep-sep">/</span>
                <span class="ep-total">${record.episodesTotal}</span>
            </span>
            <span class="ep-remain">剩 ${remaining} 集</span>
        `;
    }

    if (record.episodesWatched > 0) {
        return `<span class="ep-progress"><span class="ep-watched">已看 ${record.episodesWatched} 集</span></span>`;
    }

    return '';
}

/**
 * 生成 +1集 按钮的 HTML
 */
function createEpButtonHTML(record) {
    const isCompleted = record.status === STATUS.WATCHED ||
        (record.episodesTotal > 0 && record.episodesWatched >= record.episodesTotal);

    const label = isCompleted
        ? `${ICONS.check}<span>已追完</span>`
        : '<span>+1 集</span>';

    return `<button class="card-ep-btn ${isCompleted ? 'completed' : ''}" data-action="ep-plus" data-id="${record.id}"
        ${isCompleted ? 'disabled' : ''} title="${isCompleted ? '已追完' : '已看集数 +1'}">${label}</button>`;
}

/**
 * 生成单张卡片的 HTML
 */
function createCardHTML(record) {
    const statusColor = STATUS_COLORS[record.status] || '#999';
    const episodeInfo = createEpisodeInfoHTML(record);

    return `
        <article class="anime-card" data-id="${record.id}" data-status="${record.status}" data-week="${record.week || ''}" style="--card-accent:${statusColor}">
            <div class="card-body">
                <div class="card-tags">${createBadgesHTML(record)}</div>
                <div class="card-title" title="${escapeHTML(record.titleZh)}">${escapeHTML(record.titleZh) || '<span class="card-title-empty">未命名番剧</span>'}</div>
                ${record.titleJa ? `<div class="card-title-ja" title="${escapeHTML(record.titleJa)}">${escapeHTML(record.titleJa)}</div>` : ''}
                ${episodeInfo ? `<div class="card-episodes">${episodeInfo}</div>` : `<div class="card-episodes empty">尚未开始观看</div>`}
            </div>
            <div class="card-footer">
                <div class="card-actions">
                    <button class="card-action-btn edit" data-action="edit" data-id="${record.id}" title="编辑记录" aria-label="编辑记录">
                        ${ICONS.edit}<span class="card-action-text">编辑</span>
                    </button>
                    <button class="card-action-btn delete" data-action="delete" data-id="${record.id}" title="删除记录" aria-label="删除记录">
                        ${ICONS.trash}
                    </button>
                </div>
                <div class="card-footer-right">
                    ${createUpdatedHTML(record)}
                    ${createEpButtonHTML(record)}
                </div>
            </div>
        </article>
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
 * 渲染「更新日」筛选栏
 * 只显示数据库中实际存在的周几，避免空档位占位
 */
function renderWeekFilter() {
    const container = document.getElementById('week-filter');
    if (!container) return;

    const records = loadRecords();
    const counts = {};
    for (const r of records) {
        if (r.week && WEEK_LABELS[r.week]) {
            counts[r.week] = (counts[r.week] || 0) + 1;
        }
    }

    // 当前筛选的周几已无对应记录时自动回到「全部」
    if (activeWeekFilter && !counts[activeWeekFilter]) {
        activeWeekFilter = '';
    }

    const hasAny = WEEK_ORDER.some(key => counts[key]);

    if (!hasAny) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');

    let html = `
        <span class="week-filter-label">${ICONS.calendar}更新日</span>
        <div class="week-chips">
            <button class="week-chip ${activeWeekFilter === '' ? 'active' : ''}" data-week="">全部</button>
    `;

    for (const key of WEEK_ORDER) {
        const count = counts[key] || 0;
        if (count === 0) continue;
        const [bg, fg] = WEEK_COLORS[key];
        html += `
            <button class="week-chip ${activeWeekFilter === key ? 'active' : ''}" data-week="${key}" style="--chip-bg:${bg};--chip-fg:${fg}">
                <span class="week-chip-dot"></span>${WEEK_LABELS[key]}<span class="week-chip-count">${count}</span>
            </button>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * 刷新整个列表（筛选后重新渲染）
 */
function refreshCards() {
    const records = getFilteredAndSortedRecords();
    renderCards(records);
    renderStats(loadRecords());
    renderWeekFilter();
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
    if (activeWeekFilter) {
        records = records.filter(r => (r.week || '') === activeWeekFilter);
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
