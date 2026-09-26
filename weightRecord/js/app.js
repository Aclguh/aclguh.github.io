const STORAGE_KEY = 'weight_records';

/* ============================================
   内联 SVG 图标（不依赖任何图标字体 / emoji）
   ============================================ */
const ICONS = {
    trendUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6"/><path d="m6 11 6-6 6 6"/></svg>',
    trendDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v13"/><path d="m6 12 6 6 6-6"/></svg>',
    flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h8"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5M14 11v5"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="3.6" cy="6" r="1.3"/><circle cx="3.6" cy="12" r="1.3"/><circle cx="3.6" cy="18" r="1.3"/></svg>'
};

/* ============================================
   设计 token（实时读取 CSS 变量，跟随深浅色主题）
   ============================================ */
function readTheme() {
    const s = getComputedStyle(document.documentElement);
    const v = name => s.getPropertyValue(name).trim();
    return {
        accent: v('--accent') || '#5b6ef5',
        surface: v('--surface') || '#ffffff',
        muted: v('--text-3') || '#98a0b3',
        grid: v('--chart-grid') || '#eceef5'
    };
}

function hexToRgba(hex, alpha) {
    const m = hex.replace('#', '');
    const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

let THEME = readTheme();

// --- Data Layer ---
function loadRecords() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveRecords(records) {
    records.sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// --- Toast ---
let toastTimer;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/**
 * 标记输入框为错误状态（下次输入自动清除）
 */
function markError(input) {
    input.classList.add('is-error');
    input.addEventListener('input', function handler() {
        input.classList.remove('is-error');
        input.removeEventListener('input', handler);
    });
    input.focus();
}

// --- Format ---
function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getToday() {
    // 使用访问页面的系统本地时间（而非 UTC），
    // 避免在东八区凌晨时 toISOString() 取到前一天的日期
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/* ============================================
   时间段过滤（仅用于临时查看，不写入 localStorage）
   customRange 为 null 时使用默认范围：第一条 → 最新一条记录
   ============================================ */
let customRange = null; // { start: 'YYYY-MM-DD'|'', end: 'YYYY-MM-DD'|'' }

function computeDefaultRange(records) {
    if (!records.length) return { start: '', end: '' };
    let start = records[0].date, end = records[0].date;
    for (const r of records) {
        if (r.date < start) start = r.date;
        if (r.date > end) end = r.date;
    }
    return { start, end };
}

function getEffectiveRange(records) {
    return customRange ? customRange : computeDefaultRange(records);
}

function filterByRange(records, range) {
    return records.filter(r => {
        if (range.start && r.date < range.start) return false;
        if (range.end && r.date > range.end) return false;
        return true;
    });
}

function syncRangeInputs(range) {
    const s = document.getElementById('rangeStart');
    const e = document.getElementById('rangeEnd');
    // 不覆盖用户正在编辑的输入框
    if (s && document.activeElement !== s) s.value = range.start || '';
    if (e && document.activeElement !== e) e.value = range.end || '';
}

function onRangeChange() {
    customRange = {
        start: document.getElementById('rangeStart').value,
        end: document.getElementById('rangeEnd').value
    };
    renderAll();
}

function resetRange() {
    customRange = null;
    renderAll();
    showToast('已恢复默认时间段');
}

// --- Render: Stats ---
function renderStats(records) {
    const count = records.length;
    document.getElementById('statCount').textContent = count;

    if (count === 0) {
        ['statCurrent', 'statAvg', 'statMin', 'statMax', 'statTrend', 'statSpan', 'statDaily'].forEach(id => {
            document.getElementById(id).textContent = '--';
        });
        document.getElementById('statTrend').className = 'stat-value';
        document.getElementById('statTrendLabel').textContent = '总变化';
        document.getElementById('statDaily').className = 'stat-value';
        return;
    }

    const weights = records.map(r => r.weight);
    const latest = weights[weights.length - 1];
    const avg = weights.reduce((a, b) => a + b, 0) / count;
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const first = weights[0];
    const delta = latest - first;

    // 时间跨度（天）：首末记录的日历天数差
    const firstDate = new Date(records[0].date + 'T00:00:00');
    const lastDate = new Date(records[records.length - 1].date + 'T00:00:00');
    const spanDays = Math.round((lastDate - firstDate) / 86400000);

    document.getElementById('statCurrent').textContent = latest.toFixed(1);
    document.getElementById('statAvg').textContent = avg.toFixed(1);
    document.getElementById('statMin').textContent = min.toFixed(1);
    document.getElementById('statMax').textContent = max.toFixed(1);
    document.getElementById('statSpan').textContent = spanDays;

    const trendEl = document.getElementById('statTrend');
    const trendLabel = document.getElementById('statTrendLabel');
    if (delta > 0.05) {
        trendEl.textContent = `+${delta.toFixed(1)}`;
        trendEl.className = 'stat-value stat-trend-up';
        trendLabel.textContent = '累计增加';
    } else if (delta < -0.05) {
        trendEl.textContent = delta.toFixed(1);
        trendEl.className = 'stat-value stat-trend-down';
        trendLabel.textContent = '累计减少';
    } else {
        trendEl.textContent = '0.0';
        trendEl.className = 'stat-value stat-trend-flat';
        trendLabel.textContent = '基本持平';
    }

    // 平均每天变化（kg/天）= 总变化 / 时间跨度
    const dailyEl = document.getElementById('statDaily');
    if (spanDays > 0) {
        const perDay = delta / spanDays;
        if (Math.abs(perDay) < 0.005) {
            dailyEl.textContent = '0.00';
            dailyEl.className = 'stat-value stat-trend-flat';
        } else if (perDay > 0) {
            dailyEl.textContent = `+${perDay.toFixed(2)}`;
            dailyEl.className = 'stat-value stat-trend-up';
        } else {
            dailyEl.textContent = perDay.toFixed(2);
            dailyEl.className = 'stat-value stat-trend-down';
        }
    } else {
        dailyEl.textContent = '--';
        dailyEl.className = 'stat-value stat-trend-flat';
    }
}

// --- Render: Chart ---
let chartInstance = null;
function renderChart(records) {
    const canvas = document.getElementById('weightChart');
    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    if (records.length === 0) {
        // 空数据占位：仅显示提示文案，不画坐标轴
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: '暂无数据',
                        color: THEME.muted,
                        font: { size: 15, weight: '600' }
                    }
                },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
        return;
    }

    const labels = records.map(r => formatDate(r.date));
    const data = records.map(r => r.weight);

    // 渐变填充（与主题色一致）
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 340);
    gradient.addColorStop(0, hexToRgba(THEME.accent, 0.28));
    gradient.addColorStop(1, hexToRgba(THEME.accent, 0.01));

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '体重 (kg)',
                data,
                borderColor: THEME.accent,
                backgroundColor: gradient,
                borderWidth: 2.5,
                pointBackgroundColor: THEME.surface,
                pointBorderColor: THEME.accent,
                pointBorderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: THEME.accent,
                pointHoverBorderColor: THEME.surface,
                pointHitRadius: 16,
                tension: 0.35,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(31,36,48,0.94)',
                    titleFont: { size: 13 },
                    bodyFont: { size: 15, weight: '700' },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        label: ctx => `${ctx.parsed.y} kg`,
                    }
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        font: { size: 12 },
                        color: THEME.muted,
                        maxRotation: 45,
                    }
                },
                y: {
                    grid: { color: THEME.grid },
                    border: { display: false },
                    ticks: {
                        font: { size: 12 },
                        color: THEME.muted,
                        maxTicksLimit: 6,
                        callback: v => v + ' kg',
                    },
                    // 数据上下留出余量，曲线不贴边
                    suggestedMin: Math.floor((Math.min(...data) - 2) / 5) * 5,
                    suggestedMax: Math.ceil((Math.max(...data) + 2) / 5) * 5,
                }
            }
        }
    });
}

// --- Render: Table ---
function renderTable(records) {
    const wrap = document.getElementById('tableWrap');

    if (records.length === 0) {
        wrap.innerHTML = `
            <div class="empty">
                <div class="empty-icon" aria-hidden="true">${ICONS.list}</div>
                <p>暂无记录，快来添加第一条吧！</p>
            </div>`;
        return;
    }

    // Build rows from newest to oldest
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
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
        });

        html += `<tr>
            <td class="col-date">${dateDisplay}</td>
            <td class="col-weight">${r.weight.toFixed(1)}</td>
            <td>${changeHtml}</td>
            <td class="col-action">
                <button class="row-delete" onclick="deleteRecord('${r.id}')" title="删除该条记录" aria-label="删除该条记录">${ICONS.trash}</button>
            </td>
        </tr>`;
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;
}

// --- Render All ---
function renderAll() {
    const allRecords = loadRecords();
    const range = getEffectiveRange(allRecords);
    syncRangeInputs(range);
    const records = filterByRange(allRecords, range);
    renderStats(records);
    renderChart(records);
    renderTable(records);
}

// --- Actions ---
function addRecord() {
    const dateInput = document.getElementById('dateInput');
    const weightInput = document.getElementById('weightInput');
    const date = dateInput.value;
    const weight = parseFloat(weightInput.value);

    if (!date) { showToast('请选择日期'); markError(dateInput); return; }
    if (isNaN(weight) || weight < 20 || weight > 300) {
        showToast('请输入有效体重（20-300 kg）');
        markError(weightInput);
        return;
    }

    const records = loadRecords();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // If same date exists, replace it (one record per day)
    const existingIdx = records.findIndex(r => r.date === date);
    if (existingIdx >= 0) {
        records[existingIdx].weight = weight;
        showToast('已更新当天记录');
    } else {
        records.push({ id, date, weight });
        showToast('记录已添加');
    }

    saveRecords(records);
    weightInput.value = '';
    dateInput.value = getToday();

    // 若新记录落在当前自定义时间段之外，恢复默认范围以便看到它
    if (customRange &&
        ((customRange.start && date < customRange.start) ||
         (customRange.end && date > customRange.end))) {
        customRange = null;
    }

    renderAll();
}

function deleteRecord(id) {
    if (!confirm('确定要删除这条记录吗？')) return;
    let records = loadRecords();
    records = records.filter(r => r.id !== id);
    saveRecords(records);
    showToast('记录已删除');
    renderAll();
}

function clearAll() {
    if (!confirm('确定要清空全部记录吗？此操作不可恢复。')) return;
    localStorage.removeItem(STORAGE_KEY);
    customRange = null;
    showToast('全部记录已清空');
    renderAll();
}

function exportCSV() {
    const records = loadRecords();
    if (records.length === 0) {
        showToast('暂无数据可导出');
        return;
    }

    let csv = '日期,体重(kg)\n';
    records.forEach(r => {
        csv += `${r.date},${r.weight.toFixed(1)}\n`;
    });

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `体重记录_${getToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
}

function importCSV() {
    document.getElementById('csvFileInput').click();
}

function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        let text = e.target.result;

        // Strip BOM if present
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) {
            showToast('CSV 文件格式不正确或为空');
            return;
        }

        // Detect header: first line should contain "日期" or "date"
        let startIdx = 0;
        const firstLine = lines[0].trim();
        if (firstLine.includes('日期') || firstLine.toLowerCase().includes('date')) {
            startIdx = 1;
        }

        const records = loadRecords();
        const existingMap = new Map(records.map(r => [r.date, r]));
        let added = 0, updated = 0, skipped = 0;

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Support both comma and tab separators
            const parts = line.includes('\t') ? line.split('\t') : line.split(',');
            if (parts.length < 2) { skipped++; continue; }

            const date = parts[0].trim();
            const weight = parseFloat(parts[1].trim());

            // Validate
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; continue; }
            if (isNaN(weight) || weight < 20 || weight > 300) { skipped++; continue; }

            if (existingMap.has(date)) {
                existingMap.get(date).weight = weight;
                updated++;
            } else {
                const id = 'imp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '_' + i;
                records.push({ id, date, weight });
                existingMap.set(date, records[records.length - 1]);
                added++;
            }
        }

        saveRecords(records);
        const parts = [];
        if (added > 0) parts.push(`新增 ${added} 条`);
        if (updated > 0) parts.push(`更新 ${updated} 条`);
        if (skipped > 0) parts.push(`跳过 ${skipped} 条`);
        // 导入到新数据后恢复默认范围，确保导入结果可见
        if (added > 0 || updated > 0) customRange = null;
        showToast(parts.length > 0 ? '导入完成：' + parts.join('，') : '没有有效数据可导入');
        renderAll();
    };

    reader.readAsText(file, 'UTF-8');
    // Reset input so the same file can be re-imported
    event.target.value = '';
}

// --- Init ---
document.getElementById('dateInput').value = getToday();

// 自定义时间段：起止日期变化即刷新视图
document.getElementById('rangeStart').addEventListener('change', onRangeChange);
document.getElementById('rangeEnd').addEventListener('change', onRangeChange);

// Listen for Enter key on weight input
document.getElementById('weightInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addRecord();
});

// Keyboard shortcut: Ctrl+S to add
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        document.getElementById('weightInput').focus();
    }
});

renderAll();

// 深浅色切换后重读主题色并重绘（含图表）
document.addEventListener('themechange', () => {
    THEME = readTheme();
    renderAll();
});
