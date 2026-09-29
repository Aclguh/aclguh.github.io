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
        grid: v('--chart-grid') || '#eceef5',
        up: v('--danger') || '#ef4444',
        down: v('--success') || '#10b981',
        blue: v('--chart-blue') || '#3b82f6'
    };
}

function hexToRgba(hex, alpha) {
    const m = hex.replace('#', '');
    const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

let THEME = readTheme();

/* ============================================
   悬停参考线：经过当前悬停点、垂直于两条坐标轴的虚线
   （设置弹窗内可开关，本地持久化）
   ============================================ */
const HOVER_GUIDES_KEY = 'weight_hover_guides';

let hoverGuides = (() => {
    try { return localStorage.getItem(HOVER_GUIDES_KEY) !== 'off'; } catch { return true; }
})();

function setHoverGuides(on) {
    hoverGuides = !!on;
    try { localStorage.setItem(HOVER_GUIDES_KEY, on ? 'on' : 'off'); } catch (e) {}
    renderAll();
}

function syncHoverGuides() {
    const box = document.getElementById('hoverGuidesToggle');
    if (box) box.checked = hoverGuides;
}

/* ============================================
   BMI 显示（设置弹窗内开关 + 身高，本地持久化）
   BMI 采用中国成人标准：偏瘦 <18.5，正常 18.5-24，超重 24-28，肥胖 ≥28
   ============================================ */
const BMI_ENABLED_KEY = 'weight_bmi_enabled';
const BMI_HEIGHT_KEY = 'weight_bmi_height';

let bmiEnabled = (() => {
    try { return localStorage.getItem(BMI_ENABLED_KEY) === 'on'; } catch { return false; }
})();

let bmiHeight = (() => {
    try {
        const v = parseFloat(localStorage.getItem(BMI_HEIGHT_KEY));
        return isNaN(v) ? null : v;
    } catch { return null; }
})();

function setBmiDisplay(on) {
    bmiEnabled = !!on;
    try { localStorage.setItem(BMI_ENABLED_KEY, on ? 'on' : 'off'); } catch (e) {}
    syncBmiSettings();
    renderAll();
}

function setBmiHeight(value) {
    const v = parseFloat(value);
    bmiHeight = isNaN(v) ? null : v;
    try {
        if (bmiHeight == null) localStorage.removeItem(BMI_HEIGHT_KEY);
        else localStorage.setItem(BMI_HEIGHT_KEY, String(bmiHeight));
    } catch (e) {}
    renderAll();
}

function syncBmiSettings() {
    const box = document.getElementById('bmiToggle');
    if (box) box.checked = bmiEnabled;
    const sec = document.getElementById('bmiHeightSection');
    if (sec) sec.classList.toggle('bmi-height-hidden', !bmiEnabled);
    const input = document.getElementById('bmiHeight');
    if (input && document.activeElement !== input) {
        input.value = bmiHeight == null ? '' : String(bmiHeight);
    }
}

function renderBmiPanel(records) {
    const grid = document.getElementById('statsGrid');
    const valid = bmiEnabled && bmiHeight != null && bmiHeight >= 40 && bmiHeight <= 250;
    grid.classList.toggle('bmi-on', valid);
    if (!valid) return;

    const h2 = (bmiHeight / 100) ** 2;
    document.getElementById('statBmiRange').textContent =
        `该身高正常范围 ${(18.5 * h2).toFixed(1)} - ${(24 * h2).toFixed(1)} kg`;

    const valueEl = document.getElementById('statBmiValue');
    const badgeEl = document.getElementById('statBmiBadge');
    if (!records.length) {
        valueEl.textContent = '--';
        badgeEl.textContent = '--';
        badgeEl.className = 'bmi-badge';
        return;
    }
    const bmi = records[records.length - 1].weight / h2;
    let cls = 'bmi-normal', label = '正常';
    if (bmi < 18.5) { cls = 'bmi-thin'; label = '偏瘦'; }
    else if (bmi >= 28) { cls = 'bmi-fat'; label = '肥胖'; }
    else if (bmi >= 24) { cls = 'bmi-over'; label = '超重'; }
    valueEl.textContent = bmi.toFixed(1);
    badgeEl.textContent = label;
    badgeEl.className = 'bmi-badge ' + cls;
}

const hoverGuidesPlugin = {
    id: 'hoverGuides',
    afterDatasetsDraw(chart) {
        if (!hoverGuides) return;
        const els = chart.tooltip ? chart.tooltip.getActiveElements() : [];
        if (!els.length) return;
        const el = els[0].element;
        const { left, right, top, bottom } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = THEME.muted;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(el.x, top);
        ctx.lineTo(el.x, bottom);
        ctx.moveTo(left, el.y);
        ctx.lineTo(right, el.y);
        ctx.stroke();
        ctx.restore();
    }
};

/* ============================================
   提示框定位：框体避开悬停点（caretPadding 14px 间距），
   并在四个象限中选出对走线遮挡最小的位置——
   对每个候选象限计算该横跨区间内走线的纵向范围，
   以走线与框体的重叠深度 + 图区溢出量打分，低谷/高峰处自动让位
   ============================================ */
// 线段在 [xa, xb] 区间内的纵向范围（走线按数据点线性插值近似）
function curveRangeInSpan(pts, xa, xb) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        if (Math.max(a.x, b.x) < xa || Math.min(a.x, b.x) > xb) continue;
        const t1 = b.x === a.x ? 0 : (Math.max(Math.min(a.x, b.x), xa) - a.x) / (b.x - a.x);
        const t2 = b.x === a.x ? 1 : (Math.min(Math.max(a.x, b.x), xb) - a.x) / (b.x - a.x);
        const y1 = a.y + (b.y - a.y) * t1;
        const y2 = a.y + (b.y - a.y) * t2;
        min = Math.min(min, y1, y2);
        max = Math.max(max, y1, y2);
    }
    return min === Infinity ? null : { min, max };
}

Chart.Tooltip.positioners.nearPoint = function (items, eventPosition) {
    if (!items.length) return false;
    const el = items[0].element;
    const chart = this.chart;
    const area = chart.chartArea;
    const meta = chart.getDatasetMeta(chart.data.datasets.length - 1);
    const pts = meta && meta.data ? meta.data.map(d => d.getProps(['x', 'y'], true)) : [];

    const pad = 15;                 // 提示框与悬停点的间距（caretSize + caretPadding / cornerRadius + caretSize）
    const estW = 140, estH = 76;    // 提示框估算尺寸
    // 四个候选象限（xAlign left = 锚点在框左缘即框向右延伸，bottom = 框在点上方）：
    // 横跨区间 xa/xb 与纵向区间 yTop/yBot 用于评估走线遮挡
    const cand = [
        { xAlign: 'left',  yAlign: 'bottom', xa: el.x + pad,        xb: el.x + pad + estW,  yTop: el.y - pad - estH, yBot: el.y - pad,      prefer: 0 },
        { xAlign: 'left',  yAlign: 'top',    xa: el.x + pad,        xb: el.x + pad + estW,  yTop: el.y + pad,        yBot: el.y + pad + estH, prefer: 1 },
        { xAlign: 'right', yAlign: 'bottom', xa: el.x - pad - estW, xb: el.x - pad,         yTop: el.y - pad - estH, yBot: el.y - pad,      prefer: 2 },
        { xAlign: 'right', yAlign: 'top',    xa: el.x - pad - estW, xb: el.x - pad,         yTop: el.y + pad,        yBot: el.y + pad + estH, prefer: 3 },
    ];

    let best = cand[0];
    let bestScore = Infinity;
    for (const c of cand) {
        // 超出图区的溢出量
        const overflow = Math.max(0, c.xb - area.right) + Math.max(0, area.left - c.xa)
            + Math.max(0, c.yBot - area.bottom) + Math.max(0, area.top - c.yTop);
        // 走线与框体纵向区间的重叠深度（遮挡程度）
        const range = curveRangeInSpan(pts, c.xa, c.xb);
        let intr = 0;
        if (range) {
            intr = Math.max(0, Math.min(range.max, c.yBot) - Math.max(range.min, c.yTop));
        }
        const score = intr + overflow * 3 + c.prefer * 0.5;
        if (score < bestScore) {
            bestScore = score;
            best = c;
        }
    }
    return { x: el.x, y: el.y, xAlign: best.xAlign, yAlign: best.yAlign };
};

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

/* ============================================
   趋势图走线颜色（设置弹窗内选择，本地持久化）
   default 主题默认 / clear 清晰变化（升红降绿）/ red / green / blue
   ============================================ */
const LINE_COLOR_KEY = 'weight_line_color';
const LINE_COLOR_VALUES = ['default', 'clear', 'red', 'green', 'blue'];
const LINE_COLOR_HINTS = {
    default: '跟随当前主题色绘制趋势线',
    clear: '清晰变化：上升线段为红色，下降为绿色',
    red: '以固定红色绘制趋势线',
    green: '以固定绿色绘制趋势线',
    blue: '以固定蓝色绘制趋势线'
};

let lineColorMode = (() => {
    try {
        const v = localStorage.getItem(LINE_COLOR_KEY);
        return LINE_COLOR_VALUES.includes(v) ? v : 'default';
    } catch { return 'default'; }
})();

function getLineColor() {
    switch (lineColorMode) {
        case 'red': return THEME.up;
        case 'green': return THEME.down;
        case 'blue': return THEME.blue;
        default: return THEME.accent;
    }
}

function setLineColor(mode) {
    if (!LINE_COLOR_VALUES.includes(mode)) return;
    lineColorMode = mode;
    try { localStorage.setItem(LINE_COLOR_KEY, mode); } catch (e) {}
    syncLineColorOptions();
    renderAll();
}

function syncOptionGroup(containerId, value) {
    document.querySelectorAll(`#${containerId} .option-chip`).forEach(btn => {
        const selected = btn.dataset.value === value;
        btn.classList.toggle('selected', selected);
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
}

function syncLineColorOptions() {
    syncOptionGroup('lineColorOptions', lineColorMode);
    const hint = document.getElementById('lineColorHint');
    if (hint) hint.textContent = LINE_COLOR_HINTS[lineColorMode];
}

/* ============================================
   趋势图走线风格（设置弹窗内选择，本地持久化）
   smooth 平滑曲线 / sharp 尖锐折线
   ============================================ */
const LINE_STYLE_KEY = 'weight_line_style';
const LINE_STYLE_VALUES = ['smooth', 'sharp'];
const LINE_STYLE_HINTS = {
    smooth: '点与点之间用圆滑曲线过渡',
    sharp: '点与点之间用直线连接，走势更直观'
};

let lineStyle = (() => {
    try {
        const v = localStorage.getItem(LINE_STYLE_KEY);
        return LINE_STYLE_VALUES.includes(v) ? v : 'smooth';
    } catch { return 'smooth'; }
})();

function setLineStyle(mode) {
    if (!LINE_STYLE_VALUES.includes(mode)) return;
    lineStyle = mode;
    try { localStorage.setItem(LINE_STYLE_KEY, mode); } catch (e) {}
    syncLineStyleOptions();
    renderAll();
}

function syncLineStyleOptions() {
    syncOptionGroup('lineStyleOptions', lineStyle);
    const hint = document.getElementById('lineStyleHint');
    if (hint) hint.textContent = LINE_STYLE_HINTS[lineStyle];
}

/* ============================================
   日期轴间距（设置弹窗内选择，本地持久化）
   real 按真实日期间距 / equal 每条记录等距
   ============================================ */
const DATE_AXIS_KEY = 'weight_date_axis';
const DATE_AXIS_VALUES = ['real', 'equal'];
const DATE_AXIS_HINTS = {
    real: '按真实日期间距绘制，缺失日期自然拉开',
    equal: '每条记录等距排列，缺失日期不拉伸'
};

let dateAxisMode = (() => {
    try {
        const v = localStorage.getItem(DATE_AXIS_KEY);
        return DATE_AXIS_VALUES.includes(v) ? v : 'real';
    } catch { return 'real'; }
})();

function setDateAxisMode(mode) {
    if (!DATE_AXIS_VALUES.includes(mode)) return;
    dateAxisMode = mode;
    try { localStorage.setItem(DATE_AXIS_KEY, mode); } catch (e) {}
    syncDateAxisOptions();
    renderAll();
}

function syncDateAxisOptions() {
    syncOptionGroup('dateAxisOptions', dateAxisMode);
    const hint = document.getElementById('dateAxisHint');
    if (hint) hint.textContent = DATE_AXIS_HINTS[dateAxisMode];
}

/* ============================================
   设置弹窗
   ============================================ */
function openSettings() {
    syncLineColorOptions();
    syncLineStyleOptions();
    syncDateAxisOptions();
    syncHoverGuides();
    syncBmiSettings();
    document.getElementById('settingsModal').classList.add('open');
    document.body.classList.add('modal-open');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('open');
    document.body.classList.remove('modal-open');
}

/* ============================================
   趋势图全屏放大 / 缩小
   浮层式全屏：卡片铺满浏览器视口，不进入系统全屏
   ============================================ */
function toggleChartFullscreen() {
    const card = document.getElementById('chartCard');
    const active = card.classList.toggle('fullscreen');
    // 全屏时锁定页面滚动（与设置弹窗共用同一锁）
    document.body.classList.toggle('modal-open', active);
    // 渐变填充按渲染时的画布高度生成，尺寸变化后需重绘：
    // 下一帧先绘一次，再补一次延迟重绘兜底
    requestAnimationFrame(() => renderAll());
    setTimeout(() => renderAll(), 250);
}

// --- Render: Stats ---
function renderStats(records) {
    const count = records.length;
    document.getElementById('statCount').textContent = count;
    renderBmiPanel(records);

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
    // 用 Chart.getChart 兜底销毁：若上次渲染中途出错，chartInstance 未必指向画布上的残留实例
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    if (chartInstance === existing) chartInstance = null;

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

    // 横轴：real 按真实日期间距（缺失日期自然拉开），equal 每条记录等距
    const data = records.map(r => r.weight);
    const points = records.map((r, i) => ({
        x: dateAxisMode === 'real' ? new Date(r.date + 'T00:00:00').getTime() : i,
        y: r.weight
    }));

    // 横轴范围取首末数据点，前后各留 4% 边距；仅一条时各留半步（半天 / 半格）
    const DAY = 86400000;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const xPad = lastX > firstX ? (lastX - firstX) * 0.04 : (dateAxisMode === 'real' ? DAY / 2 : 0.5);

    // 刻度：真实日期模式按天数跨度选步长，等距模式按记录数选步长，均控制在约 9 个以内
    const axisTicks = (() => {
        if (dateAxisMode === 'real') {
            const spanDays = Math.round((lastX - firstX) / DAY);
            const steps = [1, 2, 5, 10, 14, 30, 60, 120];
            const stepDays = steps.find(s => spanDays / s <= 9) ?? 365;
            const ticks = [];
            for (let t = firstX; t <= lastX; t += stepDays * DAY) ticks.push(t);
            return ticks;
        }
        const step = Math.max(1, Math.ceil(data.length / 9));
        const ticks = [];
        for (let i = 0; i < data.length; i += step) ticks.push(i);
        return ticks;
    })();

    // 刻度文字：等距模式的刻度值是记录下标，需查回对应日期
    const tickLabel = v => {
        const d = dateAxisMode === 'real'
            ? new Date(v)
            : new Date(records[Math.round(v)].date + 'T00:00:00');
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    };

    // 走线颜色：清晰变化模式按线段升降着色（升红降绿），
    // 填充需按段分色，故主数据集不做单色渐变，由下方补充的双色填充数据集实现
    const isClear = lineColorMode === 'clear';
    const lineColor = getLineColor();
    const useFill = !isClear;
    const chartTension = lineStyle === 'sharp' ? 0 : 0.35;

    // 渐变填充（与走线颜色一致）
    const gradient = useFill
        ? (() => {
            const g = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 340);
            g.addColorStop(0, hexToRgba(lineColor, 0.28));
            g.addColorStop(1, hexToRgba(lineColor, 0.01));
            return g;
        })()
        : 'transparent';

    const dataset = {
        label: '体重 (kg)',
        data: points,
        borderColor: lineColor,
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointBackgroundColor: THEME.surface,
        pointBorderColor: lineColor,
        pointBorderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderColor: THEME.surface,
        pointHitRadius: 16,
        // 尖锐折线模式不做曲线过渡，其余保持平滑
        tension: chartTension,
        fill: useFill,
    };

    let datasets = [dataset];
    if (isClear) {
        dataset.segment = {
            // 与数据点描边、下方淡色块同一判定阈值，三处颜色保持一致
            borderColor: seg => {
                const d = seg.p1.parsed.y - seg.p0.parsed.y;
                if (d > 0.05) return THEME.up;
                if (d < -0.05) return THEME.down;
                return THEME.muted;
            }
        };
        // 数据点描边与其相邻线段同色（首点及持平为中性灰）
        dataset.pointBorderColor = data.map((w, i) => {
            if (i === 0 || Math.abs(w - data[i - 1]) < 0.05) return THEME.muted;
            return w > data[i - 1] ? THEME.up : THEME.down;
        });
        // 悬浮高亮数据点同样按当天较前一日的变化着色（升红 / 降绿 / 持平灰）
        dataset.pointHoverBackgroundColor = dataset.pointBorderColor;

        // 走线下方淡色块：上升段淡红、下降段淡绿、持平段（±0.05 内）淡灰，
        // 与线段三色一一对应。
        // Chart.js 单个数据集只能有一种填充色，且同一数据集内相邻区段共用
        // 端点无法留出空隙，升/降交替时填充区会互相叠色；
        // 因此按「连续同向线段」逐段拆成独立隐藏数据集，fill: 'origin' 只铺各自区域
        const segColor = { up: THEME.up, down: THEME.down, flat: THEME.muted };
        const fillRuns = [];
        let curRun = null;
        for (let i = 0; i + 1 < data.length; i++) {
            const d = data[i + 1] - data[i];
            const cls = d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat';
            if (curRun && curRun.cls === cls && curRun.to === i) {
                curRun.to = i + 1;
            } else {
                curRun = { cls, from: i, to: i + 1 };
                fillRuns.push(curRun);
            }
        }
        const fillGradient = color => {
            const g = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 340);
            g.addColorStop(0, hexToRgba(color, 0.28));
            g.addColorStop(1, hexToRgba(color, 0.01));
            return g;
        };
        const fillDataset = run => {
            // 线性轴 + 对象格式下空隙须用 {x, y: null} 表示，裸 null 会在解析时报错
            const arr = points.map(p => ({ x: p.x, y: null }));
            for (let i = run.from; i <= run.to; i++) arr[i] = points[i];
            return {
                label: '',
                data: arr,
                borderColor: 'transparent',
                backgroundColor: fillGradient(segColor[run.cls]),
                borderWidth: 0,
                pointRadius: 0,
                pointHitRadius: 0,
                pointHoverRadius: 0,
                pointHoverBackgroundColor: 'transparent',
                pointHoverBorderColor: 'transparent',
                tension: chartTension,
                fill: 'origin',
                spanGaps: false,
            };
        };
        // 填充层在前、走线在后绘制，保证线与数据点在最上层
        datasets = [...fillRuns.map(fillDataset), dataset];
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        // 悬停参考线插件：绘制经过悬停点的十字虚线
        plugins: [hoverGuidesPlugin],
        data: {
            datasets,
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
                    caretPadding: 10,
                    displayColors: false,
                    // 只提示主走线数据集，隐藏的填充数据集不参与
                    filter: item => item.datasetIndex === datasets.length - 1,
                    // 自定义定位器：提示框避开走线与十字虚线（见 nearPoint 注册处）
                    position: 'nearPoint',
                    callbacks: {
                        // 线性轴下标题取悬停点对应的日期（等距模式的刻度值是记录下标）
                        title: items => {
                            const it = items[0];
                            if (!it || !it.parsed || it.parsed.x == null) return '';
                            const d = dateAxisMode === 'real'
                                ? new Date(it.parsed.x)
                                : new Date(records[Math.round(it.parsed.x)].date + 'T00:00:00');
                            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
                        },
                        label: ctx => `${ctx.parsed.y} kg`,
                    }
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    min: firstX - xPad,
                    max: lastX + xPad,
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        font: { size: 12 },
                        color: THEME.muted,
                        callback: tickLabel
                    },
                    afterBuildTicks: scale => {
                        scale.ticks = axisTicks.map(v => ({ value: v }));
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

// 设置弹窗：点击遮罩空白处关闭
document.getElementById('settingsModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettings();
});

// Esc：优先退出趋势图全屏，其次关闭设置弹窗
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('chartCard').classList.contains('fullscreen')) {
        toggleChartFullscreen();
        return;
    }
    closeSettings();
});

// 初始化走线颜色、风格、日期轴间距、悬停参考线与 BMI 显示的状态
syncLineColorOptions();
syncLineStyleOptions();
syncDateAxisOptions();
syncHoverGuides();
syncBmiSettings();

// 身高输入：实时刷新 BMI 面板
document.getElementById('bmiHeight').addEventListener('input', e => setBmiHeight(e.target.value));

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
