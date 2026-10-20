/**
 * =====================================================================
 * 体重记录 - 历史表格视图模块 (Table View)
 * 负责体重历史记录列表的渲染、格式化与交互操作委托
 * =====================================================================
 */
(function (global) {
    const ICONS = {
        trendUp:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6"/><path d="m6 11 6-6 6 6"/></svg>',
        trendDown:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v13"/><path d="m6 12 6 6 6-6"/></svg>',
        flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
        dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h8"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>',
        list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="3.6" cy="6" r="1.3"/><circle cx="3.6" cy="12" r="1.3"/><circle cx="3.6" cy="18" r="1.3"/></svg>'
    };

    /**
     * 渲染历史数据表格
     * @param {Array<{id: string, date: string, weight: number}>} records
     */
    function renderTable(records) {
        const wrap = document.getElementById('tableWrap');
        if (!wrap) return;

        if (records.length === 0) {
            wrap.innerHTML = `
                <div class="empty">
                    <div class="empty-icon" aria-hidden="true">${ICONS.list}</div>
                    <p>暂无记录，快来添加第一条吧！</p>
                </div>`;
            return;
        }

        // 倒序构建行（最新在最前）
        let html = `<table><thead><tr>
            <th>日期</th><th>体重 (kg)</th><th>变化</th><th class="col-action">操作</th>
        </tr></thead><tbody>`;

        for (let i = records.length - 1; i >= 0; i--) {
            const r = records[i];
            let changeHtml = `<span class="weight-change flat">${ICONS.dash}<span>—</span></span>`;
            if (i > 0) {
                const prev = records[i - 1].weight;
                const diff = r.weight - prev;
                if (Math.abs(diff) < 0.05) {
                    changeHtml = `<span class="weight-change flat">${ICONS.flat}<span>0.0</span></span>`;
                } else if (diff > 0) {
                    changeHtml = `<span class="weight-change up">${ICONS.trendUp}<span>+${diff.toFixed(1)}</span></span>`;
                } else {
                    changeHtml = `<span class="weight-change down">${ICONS.trendDown}<span>${diff.toFixed(1)}</span></span>`;
                }
            }

            const dateDisplay = new Date(r.date + 'T00:00:00').toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
            });

            const safeId = typeof escapeAttr !== 'undefined' ? escapeAttr(r.id) : r.id;
            const safeDate = typeof escapeHtml !== 'undefined' ? escapeHtml(dateDisplay) : dateDisplay;

            html += `<tr>
                <td class="col-date">${safeDate}</td>
                <td class="col-weight">${r.weight.toFixed(1)}</td>
                <td>${changeHtml}</td>
                <td class="col-action">
                    <button class="row-delete" data-action="delete" data-id="${safeId}" title="删除该条记录" aria-label="删除该条记录">${ICONS.trash}</button>
                </td>
            </tr>`;
        }

        html += '</tbody></table>';
        wrap.innerHTML = html;
    }

    /**
     * 初始化表格操作事件委托
     * @param {(id: string) => void} onDelete
     */
    function initTableEvents(onDelete) {
        const wrap = document.getElementById('tableWrap');
        if (!wrap) return;
        wrap.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="delete"]');
            if (btn && btn.dataset.id && typeof onDelete === 'function') {
                onDelete(btn.dataset.id);
            }
        });
    }

    global.WeightTableView = {
        ICONS,
        renderTable,
        initTableEvents
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.WeightTableView;
    }
})(typeof window !== 'undefined' ? window : this);
