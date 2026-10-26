/**
 * =====================================================================
 * 体重记录 - 核心应用控制器 (App Controller)
 * 调度数据层、图表视图、历史表格视图与用户操作
 * =====================================================================
 */

/* ── 主题与全局配置 ── */
let THEME = typeof WeightChartConfig !== 'undefined' ? WeightChartConfig.readTheme() : {};

/* ── 悬停参考线 ── */
let hoverGuides = typeof WeightStorage !== 'undefined' ? WeightStorage.loadHoverGuides() : true;

function setHoverGuides(on) {
    hoverGuides = !!on;
    if (typeof WeightStorage !== 'undefined') WeightStorage.saveHoverGuides(hoverGuides);
    renderAll();
}

function syncHoverGuides() {
    const box = document.getElementById('hoverGuidesToggle');
    if (box) box.checked = hoverGuides;
}

/* ── 浮层提示卡片透明度 ── */
const DEFAULT_TOOLTIP_OPACITY = 94;
let tooltipOpacity =
    typeof WeightStorage !== 'undefined'
        ? WeightStorage.loadTooltipOpacity(DEFAULT_TOOLTIP_OPACITY)
        : DEFAULT_TOOLTIP_OPACITY;

function getTooltipBg() {
    const alpha = (tooltipOpacity / 100).toFixed(2);
    return `rgba(31, 36, 48, ${alpha})`;
}

function setTooltipOpacity(val) {
    const num = Math.min(100, Math.max(20, parseInt(val, 10) || DEFAULT_TOOLTIP_OPACITY));
    tooltipOpacity = num;
    if (typeof WeightStorage !== 'undefined') WeightStorage.saveTooltipOpacity(num);
    syncTooltipOpacity();
    const chart = typeof WeightChartConfig !== 'undefined' ? WeightChartConfig.getChart() : null;
    if (chart && chart.options && chart.options.plugins && chart.options.plugins.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = getTooltipBg();
        chart.update('none');
    }
}

function syncTooltipOpacity() {
    const slider = document.getElementById('tooltipOpacitySlider');
    const label = document.getElementById('tooltipOpacityValue');
    if (slider) {
        slider.value = tooltipOpacity;
        const min = parseInt(slider.min, 10) || 20;
        const max = parseInt(slider.max, 10) || 100;
        const pct = ((tooltipOpacity - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--border-strong) ${pct}%, var(--border-strong) 100%)`;
    }
    if (label) {
        label.textContent = `${tooltipOpacity}%`;
    }
}

/* ── BMI 显示设置 ── */
let bmiEnabled = typeof WeightStorage !== 'undefined' ? WeightStorage.loadBmiEnabled() : false;
let bmiHeight = typeof WeightStorage !== 'undefined' ? WeightStorage.loadBmiHeight() : null;

function setBmiDisplay(on) {
    bmiEnabled = !!on;
    if (typeof WeightStorage !== 'undefined') WeightStorage.saveBmiEnabled(bmiEnabled);
    syncBmiSettings();
    renderAll();
}

function setBmiHeight(value) {
    const v = parseFloat(value);
    bmiHeight = isNaN(v) ? null : v;
    if (typeof WeightStorage !== 'undefined') WeightStorage.saveBmiHeight(bmiHeight);
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
    if (!grid) return;
    const valid = bmiEnabled && bmiHeight != null && bmiHeight >= 40 && bmiHeight <= 250;
    grid.classList.toggle('bmi-on', valid);
    if (!valid) return;

    const h2 = (bmiHeight / 100) ** 2;
    const rangeEl = document.getElementById('statBmiRange');
    if (rangeEl) {
        rangeEl.textContent = `该身高正常范围 ${(18.5 * h2).toFixed(1)} - ${(24 * h2).toFixed(1)} kg`;
    }

    const valueEl = document.getElementById('statBmiValue');
    const badgeEl = document.getElementById('statBmiBadge');
    if (!records.length) {
        if (valueEl) valueEl.textContent = '--';
        if (badgeEl) {
            badgeEl.textContent = '--';
            badgeEl.className = 'bmi-badge';
        }
        return;
    }
    const bmi = records[records.length - 1].weight / h2;
    let cls = 'bmi-normal',
        label = '正常';
    if (bmi < 18.5) {
        cls = 'bmi-thin';
        label = '偏瘦';
    } else if (bmi >= 28) {
        cls = 'bmi-fat';
        label = '肥胖';
    } else if (bmi >= 24) {
        cls = 'bmi-over';
        label = '超重';
    }
    if (valueEl) valueEl.textContent = bmi.toFixed(1);
    if (badgeEl) {
        badgeEl.textContent = label;
        badgeEl.className = 'bmi-badge ' + cls;
    }
}

/* ── 数据持久化代理 ── */
function loadRecords() {
    return typeof WeightStorage !== 'undefined' ? WeightStorage.loadRecords() : [];
}

function saveRecords(records) {
    records.sort((a, b) => a.date.localeCompare(b.date));
    return typeof WeightStorage !== 'undefined' ? WeightStorage.saveRecords(records) : false;
}

/* ── Toast 提示 ── */
let toastTimer;
function showToast(msg, type = 'info') {
    if (typeof Toast !== 'undefined') {
        Toast.show(msg, type);
        return;
    }
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

function markError(input) {
    input.classList.add('is-error');
    input.addEventListener('input', function handler() {
        input.classList.remove('is-error');
        input.removeEventListener('input', handler);
    });
    input.focus();
}

function getToday() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/* ── 时间段过滤 ── */
let customRange = null;

function computeDefaultRange(records) {
    if (!records.length) return { start: '', end: '' };
    let start = records[0].date,
        end = records[0].date;
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
    return records.filter((r) => {
        if (range.start && r.date < range.start) return false;
        if (range.end && r.date > range.end) return false;
        return true;
    });
}

function syncRangeInputs(range) {
    const s = document.getElementById('rangeStart');
    const e = document.getElementById('rangeEnd');
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

/* ── 趋势图颜色与风格 ── */
const LINE_COLOR_VALUES = ['default', 'clear', 'red', 'green', 'blue'];
const LINE_COLOR_HINTS = {
    default: '跟随当前主题色绘制趋势线',
    clear: '清晰变化：上升线段为红色，下降为绿色',
    red: '以固定红色绘制趋势线',
    green: '以固定绿色绘制趋势线',
    blue: '以固定蓝色绘制趋势线'
};

let lineColorMode = typeof WeightStorage !== 'undefined' ? WeightStorage.loadLineColor() : 'default';

function setLineColor(mode) {
    if (!LINE_COLOR_VALUES.includes(mode)) return;
    lineColorMode = mode;
    if (typeof WeightStorage !== 'undefined') WeightStorage.saveLineColor(mode);
    syncLineColorOptions();
    renderAll();
}

function syncOptionGroup(containerId, value) {
    document.querySelectorAll(`#${containerId} .option-chip`).forEach((btn) => {
        const selected = btn.dataset.value === value;
        btn.classList.toggle('selected', selected);
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
}

function syncLineColorOptions() {
    syncOptionGroup('lineColorOptions', lineColorMode);
    const hint = document.getElementById('lineColorHint');
    if (hint) {
        hint.textContent =
            lineStyle === 'kline'
                ? 'K线图采用外汇专属红升蓝降配色；切回曲线/折线时此颜色生效'
                : LINE_COLOR_HINTS[lineColorMode];
    }
}

const LINE_STYLE_VALUES = ['smooth', 'sharp', 'kline'];
const LINE_STYLE_HINTS = {
    smooth: '点与点之间用圆滑曲线过渡',
    sharp: '点与点之间用直线连接，走势更直观',
    kline: '外汇走势K线风格：红色上升，淡蓝色下降，直观反映每日波动'
};

let lineStyle = typeof WeightStorage !== 'undefined' ? WeightStorage.loadLineStyle() : 'smooth';

function setLineStyle(mode) {
    if (!LINE_STYLE_VALUES.includes(mode)) return;
    lineStyle = mode;
    if (typeof WeightStorage !== 'undefined') WeightStorage.saveLineStyle(mode);
    syncLineStyleOptions();
    syncLineColorOptions();
    renderAll();
}

function syncLineStyleOptions() {
    syncOptionGroup('lineStyleOptions', lineStyle);
    const hint = document.getElementById('lineStyleHint');
    if (hint) hint.textContent = LINE_STYLE_HINTS[lineStyle];
}

const DATE_AXIS_VALUES = ['real', 'equal'];
const DATE_AXIS_HINTS = {
    real: '按真实日期间距绘制，缺失日期自然拉开',
    equal: '每条记录等距排列，缺失日期不拉伸'
};

let dateAxisMode = typeof WeightStorage !== 'undefined' ? WeightStorage.loadDateAxis() : 'real';

function setDateAxisMode(mode) {
    if (!DATE_AXIS_VALUES.includes(mode)) return;
    dateAxisMode = mode;
    if (typeof WeightStorage !== 'undefined') WeightStorage.saveDateAxis(mode);
    syncDateAxisOptions();
    renderAll();
}

function syncDateAxisOptions() {
    syncOptionGroup('dateAxisOptions', dateAxisMode);
    const hint = document.getElementById('dateAxisHint');
    if (hint) hint.textContent = DATE_AXIS_HINTS[dateAxisMode];
}

/* ── 设置弹窗 ── */
function openSettings() {
    syncLineColorOptions();
    syncLineStyleOptions();
    syncDateAxisOptions();
    syncHoverGuides();
    syncTooltipOpacity();
    syncBmiSettings();
    document.getElementById('settingsModal').classList.add('open');
    document.body.classList.add('modal-open');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('open');
    document.body.classList.remove('modal-open');
}

/* ── 全屏控制 ── */
function scheduleChartRerender() {
    requestAnimationFrame(() => renderAll());
    setTimeout(() => renderAll(), 250);
}

function syncChartRotation() {
    const card = document.getElementById('chartCard');
    if (!card || !card.classList.contains('fullscreen')) return;
    const rotate = window.innerHeight > window.innerWidth;
    card.style.setProperty('--fs-rot-w', window.innerHeight + 'px');
    card.style.setProperty('--fs-rot-h', window.innerWidth + 'px');
    card.classList.toggle('rotated', rotate);
}

function toggleChartFullscreen() {
    const card = document.getElementById('chartCard');
    if (!card) return;
    const active = card.classList.toggle('fullscreen');
    if (active) syncChartRotation();
    else card.classList.remove('rotated');
    document.body.classList.toggle('modal-open', active);
    scheduleChartRerender();
}

/* ── 统计信息渲染 ── */
function renderStats(records) {
    const count = records.length;
    document.getElementById('statCount').textContent = count;
    renderBmiPanel(records);

    if (count === 0) {
        ['statCurrent', 'statAvg', 'statMin', 'statMax', 'statTrend', 'statSpan', 'statDaily'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });
        const t = document.getElementById('statTrend');
        if (t) t.className = 'stat-value';
        const tl = document.getElementById('statTrendLabel');
        if (tl) tl.textContent = '总变化';
        const d = document.getElementById('statDaily');
        if (d) d.className = 'stat-value';
        return;
    }

    const weights = records.map((r) => r.weight);
    const latest = weights[weights.length - 1];
    const avg = weights.reduce((a, b) => a + b, 0) / count;
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const first = weights[0];
    const delta = latest - first;

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

/* ── 全局渲染调度 ── */
function renderAll() {
    const allRecords = loadRecords();
    const range = getEffectiveRange(allRecords);
    syncRangeInputs(range);
    const records = filterByRange(allRecords, range);
    renderStats(records);

    if (typeof WeightChartConfig !== 'undefined') {
        WeightChartConfig.renderChart(records, {
            theme: THEME,
            lineColorMode,
            lineStyle,
            dateAxisMode,
            hoverGuides,
            tooltipOpacity,
            allRecords
        });
    }

    if (typeof WeightTableView !== 'undefined') {
        WeightTableView.renderTable(records);
    }
}

/* ── 业务操作 ── */
function addRecord() {
    const dateInput = document.getElementById('dateInput');
    const weightInput = document.getElementById('weightInput');
    const date = dateInput.value;
    const weight = parseFloat(weightInput.value);

    if (!date) {
        showToast('请选择日期');
        markError(dateInput);
        return;
    }
    if (isNaN(weight) || weight < 20 || weight > 300) {
        showToast('请输入有效体重（20-300 kg）');
        markError(weightInput);
        return;
    }

    const records = loadRecords();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const existingIdx = records.findIndex((r) => r.date === date);
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

    if (
        customRange &&
        ((customRange.start && date < customRange.start) || (customRange.end && date > customRange.end))
    ) {
        customRange = null;
    }

    renderAll();
}

async function deleteRecord(id) {
    let ok;
    if (typeof Modal !== 'undefined' && Modal.confirm) {
        ok = await Modal.confirm({
            title: '删除记录',
            message: '确定要删除这条体重记录吗？',
            danger: true
        });
    } else {
        ok = confirm('确定要删除这条记录吗？');
    }
    if (!ok) return;

    let records = loadRecords();
    records = records.filter((r) => r.id !== id);
    saveRecords(records);
    showToast('记录已删除', 'info');
    renderAll();
}

async function clearAll() {
    let ok;
    if (typeof Modal !== 'undefined' && Modal.confirm) {
        ok = await Modal.confirm({
            title: '清空全部记录',
            message: '确定要清空全部记录吗？此操作不可恢复。',
            danger: true
        });
    } else {
        ok = confirm('确定要清空全部记录吗？此操作不可恢复。');
    }
    if (!ok) return;

    if (typeof WeightStorage !== 'undefined') {
        WeightStorage.clearRecords();
    }
    customRange = null;
    showToast('全部记录已清空', 'success');
    renderAll();
}

function exportCSV() {
    const records = loadRecords();
    if (records.length === 0) {
        showToast('暂无数据可导出');
        return;
    }

    let csv = '日期,体重(kg)\n';
    records.forEach((r) => {
        csv += `${r.date},${r.weight.toFixed(1)}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `体重记录_${getToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
}

function importCSV() {
    const input = document.getElementById('csvFileInput');
    if (input) input.click();
}

function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const parsed =
            typeof WeightCalc !== 'undefined' ? WeightCalc.parseWeightCSV(text) : { records: [], skipped: 0 };
        if (parsed.records.length === 0) {
            showToast('CSV 文件格式不正确或未包含有效记录');
            return;
        }

        const records = loadRecords();
        const existingMap = new Map(records.map((r) => [r.date, r]));
        let added = 0,
            updated = 0;

        for (let i = 0; i < parsed.records.length; i++) {
            const { date, weight } = parsed.records[i];
            if (existingMap.has(date)) {
                existingMap.get(date).weight = weight;
                updated++;
            } else {
                const id = 'imp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '_' + i;
                const newRec = { id, date, weight };
                records.push(newRec);
                existingMap.set(date, newRec);
                added++;
            }
        }

        saveRecords(records);
        const parts = [];
        if (added > 0) parts.push(`新增 ${added} 条`);
        if (updated > 0) parts.push(`更新 ${updated} 条`);
        if (parsed.skipped > 0) parts.push(`跳过 ${parsed.skipped} 条`);
        if (added > 0 || updated > 0) customRange = null;
        showToast(parts.length > 0 ? '导入完成：' + parts.join('，') : '没有有效数据可导入');
        renderAll();
    };

    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
}

/* ── DOM 初始化与绑定 ── */
if (typeof WeightTableView !== 'undefined') {
    WeightTableView.initTableEvents(deleteRecord);
}
if (typeof WeightChartConfig !== 'undefined') {
    WeightChartConfig.initChartPointerRotationFix();
}

const dateInputEl = document.getElementById('dateInput');
if (dateInputEl) dateInputEl.value = getToday();

const rangeStartEl = document.getElementById('rangeStart');
const rangeEndEl = document.getElementById('rangeEnd');
if (rangeStartEl) rangeStartEl.addEventListener('change', onRangeChange);
if (rangeEndEl) rangeEndEl.addEventListener('change', onRangeChange);

const settingsToggleBtn = document.getElementById('settings-toggle');
if (settingsToggleBtn) settingsToggleBtn.addEventListener('click', openSettings);

const addRecordBtn = document.getElementById('btn-add-record');
if (addRecordBtn) addRecordBtn.addEventListener('click', addRecord);

const chartFsBtn = document.getElementById('btn-chart-fs');
if (chartFsBtn) chartFsBtn.addEventListener('click', toggleChartFullscreen);

const importCsvBtn = document.getElementById('btn-import-csv');
if (importCsvBtn) importCsvBtn.addEventListener('click', importCSV);

const exportCsvBtn = document.getElementById('btn-export-csv');
if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);

const clearAllBtn = document.getElementById('btn-clear-all');
if (clearAllBtn) clearAllBtn.addEventListener('click', clearAll);

const csvFileInputEl = document.getElementById('csvFileInput');
if (csvFileInputEl) csvFileInputEl.addEventListener('change', handleCSVFile);

const closeSettingsBtn = document.getElementById('btn-close-settings');
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

const resetRangeBtn = document.getElementById('btn-reset-range');
if (resetRangeBtn) resetRangeBtn.addEventListener('click', resetRange);

const hoverGuidesToggleEl = document.getElementById('hoverGuidesToggle');
if (hoverGuidesToggleEl) {
    hoverGuidesToggleEl.addEventListener('change', (e) => setHoverGuides(e.target.checked));
}

const tooltipOpacitySliderEl = document.getElementById('tooltipOpacitySlider');
if (tooltipOpacitySliderEl) {
    tooltipOpacitySliderEl.addEventListener('input', (e) => setTooltipOpacity(e.target.value));
}

const bmiToggleEl = document.getElementById('bmiToggle');
if (bmiToggleEl) {
    bmiToggleEl.addEventListener('change', (e) => setBmiDisplay(e.target.checked));
}

// 颜色、样式、日期轴单选选项委托
const lineColorOptionsEl = document.getElementById('lineColorOptions');
if (lineColorOptionsEl) {
    lineColorOptionsEl.addEventListener('click', (e) => {
        const chip = e.target.closest('.option-chip');
        if (chip && chip.dataset.value) setLineColor(chip.dataset.value);
    });
}

const lineStyleOptionsEl = document.getElementById('lineStyleOptions');
if (lineStyleOptionsEl) {
    lineStyleOptionsEl.addEventListener('click', (e) => {
        const chip = e.target.closest('.option-chip');
        if (chip && chip.dataset.value) setLineStyle(chip.dataset.value);
    });
}

const dateAxisOptionsEl = document.getElementById('dateAxisOptions');
if (dateAxisOptionsEl) {
    dateAxisOptionsEl.addEventListener('click', (e) => {
        const chip = e.target.closest('.option-chip');
        if (chip && chip.dataset.value) setDateAxisMode(chip.dataset.value);
    });
}

const settingsModalEl = document.getElementById('settingsModal');
if (settingsModalEl) {
    settingsModalEl.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeSettings();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const chartCard = document.getElementById('chartCard');
    if (chartCard && chartCard.classList.contains('fullscreen')) {
        toggleChartFullscreen();
        return;
    }
    closeSettings();
});

let chartFsResizeTimer = 0;
window.addEventListener('resize', () => {
    const card = document.getElementById('chartCard');
    if (!card || !card.classList.contains('fullscreen')) return;
    syncChartRotation();
    clearTimeout(chartFsResizeTimer);
    chartFsResizeTimer = setTimeout(scheduleChartRerender, 150);
});

syncLineColorOptions();
syncLineStyleOptions();
syncDateAxisOptions();
syncHoverGuides();
syncTooltipOpacity();
syncBmiSettings();

const bmiHeightEl = document.getElementById('bmiHeight');
if (bmiHeightEl) {
    bmiHeightEl.addEventListener('input', (e) => setBmiHeight(e.target.value));
}

const weightInputEl = document.getElementById('weightInput');
if (weightInputEl) {
    weightInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addRecord();
    });
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const wi = document.getElementById('weightInput');
        if (wi) wi.focus();
    }
});

renderAll();

document.addEventListener('themechange', () => {
    if (typeof WeightChartConfig !== 'undefined') {
        THEME = WeightChartConfig.readTheme();
    }
    syncTooltipOpacity();
    renderAll();
});
