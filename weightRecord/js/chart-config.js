/**
 * =====================================================================
 * 体重记录 - 图表引擎与渲染配置模块 (Chart Config & Engine)
 * 封装 Chart.js 插件、悬停参考线、外汇 K 线图扩展、全屏手势换算与渲染逻辑
 * =====================================================================
 */
(function (global) {
    let chartInstance = null;

    /**
     * 设计 token（实时读取 CSS 变量，跟随深浅色主题）
     */
    function readTheme() {
        if (typeof document === 'undefined') {
            return {
                accent: '#5b6ef5',
                surface: '#ffffff',
                muted: '#98a0b3',
                grid: '#eceef5',
                up: '#ef4444',
                down: '#10b981',
                blue: '#3b82f6',
                klineUp: '#ef4444',
                klineUpBorder: '#dc2626',
                klineDown: '#38bdf8',
                klineDownBorder: '#0284c7'
            };
        }
        const s = getComputedStyle(document.documentElement);
        const v = (name) => s.getPropertyValue(name).trim();
        return {
            accent: v('--accent') || '#5b6ef5',
            surface: v('--surface') || '#ffffff',
            muted: v('--text-3') || '#98a0b3',
            grid: v('--chart-grid') || '#eceef5',
            up: v('--danger') || '#ef4444',
            down: v('--success') || '#10b981',
            blue: v('--chart-blue') || '#3b82f6',
            klineUp: v('--kline-up') || '#ef4444',
            klineUpBorder: v('--kline-up-border') || '#dc2626',
            klineDown: v('--kline-down') || '#38bdf8',
            klineDownBorder: v('--kline-down-border') || '#0284c7'
        };
    }

    function hexToRgba(hex, alpha) {
        const m = hex.replace('#', '');
        const full =
            m.length === 3
                ? m
                      .split('')
                      .map((c) => c + c)
                      .join('')
                : m;
        const n = parseInt(full, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }

    /**
     * 外汇走势 K 线图风格插件（简称 k线图）
     * 红色上升（阳线），淡蓝色下降（阴线），持平中性灰（十字星）
     */
    const klinePlugin = {
        id: 'klinePlugin',
        afterDatasetsDraw(chart) {
            const opts = chart.options._weightOptions || {};
            if (opts.lineStyle !== 'kline') return;
            const records = chart.data._records;
            if (!records || !records.length) return;

            const mainMeta = chart.getDatasetMeta(chart.data.datasets.length - 1);
            if (!mainMeta || !mainMeta.data || !mainMeta.data.length) return;

            const points = chart.data.datasets[chart.data.datasets.length - 1].data;
            const ctx = chart.ctx;
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            const { left, right, top, bottom } = chart.chartArea;

            const activeEls = chart.tooltip ? chart.tooltip.getActiveElements() : [];
            const activeIdx = activeEls.length ? activeEls[0].index : -1;

            const count = records.length;
            let candleWidth = 12;
            if (count > 1) {
                let minDx = Infinity;
                for (let i = 1; i < count; i++) {
                    const px0 = xScale.getPixelForValue(points[i - 1].x);
                    const px1 = xScale.getPixelForValue(points[i].x);
                    const dx = Math.abs(px1 - px0);
                    if (dx > 0 && dx < minDx) minDx = dx;
                }
                if (minDx !== Infinity) {
                    candleWidth = Math.max(2, Math.min(16, minDx * 0.58));
                }
            } else {
                candleWidth = 14;
            }

            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, right - left, bottom - top);
            ctx.clip();

            const allRecords = chart.data._allRecords || [];
            const theme = opts.theme || readTheme();

            for (let i = 0; i < count; i++) {
                const r = records[i];
                const px = xScale.getPixelForValue(points[i].x);
                if (px < left - candleWidth || px > right + candleWidth) continue;

                const curW = r.weight;
                let prevW = curW;
                if (i > 0) {
                    prevW = records[i - 1].weight;
                } else if (allRecords.length > 0) {
                    const fullIdx = allRecords.findIndex((item) => item.id === r.id);
                    if (fullIdx > 0) prevW = allRecords[fullIdx - 1].weight;
                }

                const diff = curW - prevW;
                const isUp = diff > 0.05;
                const isDown = diff < -0.05;
                const isFlat = !isUp && !isDown;

                let fillColor, strokeColor;
                if (isUp) {
                    fillColor = theme.klineUp;
                    strokeColor = theme.klineUpBorder;
                } else if (isDown) {
                    fillColor = theme.klineDown;
                    strokeColor = theme.klineDownBorder;
                } else {
                    fillColor = theme.muted;
                    strokeColor = theme.muted;
                }

                const bodyTopW = Math.max(curW, prevW);
                const bodyBottomW = Math.min(curW, prevW);

                let wickUpW = 0.12;
                let wickDownW = 0.12;
                if (isUp) {
                    const nextW = i < count - 1 ? records[i + 1].weight : curW;
                    wickUpW = curW >= nextW ? 0.18 : 0.1;
                    wickDownW = 0.08;
                } else if (isDown) {
                    const nextW = i < count - 1 ? records[i + 1].weight : curW;
                    wickDownW = curW <= nextW ? 0.18 : 0.1;
                    wickUpW = 0.08;
                }

                const highW = bodyTopW + wickUpW;
                const lowW = bodyBottomW - wickDownW;

                const yHigh = yScale.getPixelForValue(highW);
                const yLow = yScale.getPixelForValue(lowW);
                const yOpen = yScale.getPixelForValue(prevW);
                const yClose = yScale.getPixelForValue(curW);

                const isHovered = i === activeIdx;

                // 1. 上下影线 (Wicks)
                ctx.beginPath();
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = isHovered ? 2 : 1.5;
                const wickX = Math.round(px) + 0.5;
                ctx.moveTo(wickX, yHigh);
                ctx.lineTo(wickX, yLow);
                ctx.stroke();

                // 2. 实体蜡烛 (Body)
                const bTop = Math.min(yOpen, yClose);
                const bBottom = Math.max(yOpen, yClose);
                const bHeight = Math.max(bBottom - bTop, 2.5);
                const bLeft = px - candleWidth / 2;

                if (isFlat) {
                    ctx.beginPath();
                    ctx.moveTo(bLeft, yClose);
                    ctx.lineTo(bLeft + candleWidth, yClose);
                    ctx.lineWidth = isHovered ? 2.5 : 2;
                    ctx.strokeStyle = strokeColor;
                    ctx.stroke();
                } else {
                    ctx.fillStyle = fillColor;
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = isHovered ? 1.8 : 1;
                    ctx.beginPath();
                    const rRadius = Math.min(1.5, candleWidth / 4, bHeight / 2);
                    if (ctx.roundRect) {
                        ctx.roundRect(bLeft, bTop, candleWidth, bHeight, rRadius);
                    } else {
                        ctx.rect(bLeft, bTop, candleWidth, bHeight);
                    }
                    ctx.fill();
                    ctx.stroke();
                }

                // 3. 悬停反馈 (Hover)
                if (isHovered) {
                    ctx.save();
                    ctx.strokeStyle = isUp
                        ? 'rgba(239, 68, 68, 0.45)'
                        : isDown
                          ? 'rgba(56, 189, 248, 0.5)'
                          : 'rgba(152, 160, 179, 0.45)';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(bLeft - 2, bTop - 2, candleWidth + 4, bHeight + 4);

                    // 在当日收盘体重对应坐标处绘制实心指示圆点
                    ctx.beginPath();
                    ctx.arc(px, yClose, 3.5, 0, Math.PI * 2);
                    ctx.fillStyle = theme.surface;
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = strokeColor;
                    ctx.stroke();
                    ctx.restore();
                }
            }

            ctx.restore();
        }
    };

    /**
     * 悬停十字参考线插件
     */
    const hoverGuidesPlugin = {
        id: 'hoverGuides',
        afterDatasetsDraw(chart) {
            const opts = chart.options._weightOptions || {};
            if (!opts.hoverGuides) return;
            const els = chart.tooltip ? chart.tooltip.getActiveElements() : [];
            if (!els.length) return;
            const el = els[0].element;
            const { left, right, top, bottom } = chart.chartArea;
            const ctx = chart.ctx;
            const theme = opts.theme || readTheme();
            ctx.save();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = theme.muted;
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

    function curveRangeInSpan(pts, xa, xb) {
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i + 1 < pts.length; i++) {
            const a = pts[i],
                b = pts[i + 1];
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

    function registerChartNearPointPositioner() {
        if (typeof Chart === 'undefined' || !Chart.Tooltip || !Chart.Tooltip.positioners) return;
        if (Chart.Tooltip.positioners.nearPoint) return;
        Chart.Tooltip.positioners.nearPoint = function (items) {
            if (!items.length) return false;
            const el = items[0].element;
            const chart = this.chart;
            const area = chart.chartArea;
            const meta = chart.getDatasetMeta(chart.data.datasets.length - 1);
            const pts = meta && meta.data ? meta.data.map((d) => d.getProps(['x', 'y'], true)) : [];

            const opts = chart.options._weightOptions || {};
            const isKline = opts.lineStyle === 'kline';
            const pad = 15;
            const estW = isKline ? 165 : 140,
                estH = isKline ? 95 : 76;

            const cand = [
                {
                    xAlign: 'left',
                    yAlign: 'bottom',
                    xa: el.x + pad,
                    xb: el.x + pad + estW,
                    yTop: el.y - pad - estH,
                    yBot: el.y - pad,
                    prefer: 0
                },
                {
                    xAlign: 'left',
                    yAlign: 'top',
                    xa: el.x + pad,
                    xb: el.x + pad + estW,
                    yTop: el.y + pad,
                    yBot: el.y + pad + estH,
                    prefer: 1
                },
                {
                    xAlign: 'right',
                    yAlign: 'bottom',
                    xa: el.x - pad - estW,
                    xb: el.x - pad,
                    yTop: el.y - pad - estH,
                    yBot: el.y - pad,
                    prefer: 2
                },
                {
                    xAlign: 'right',
                    yAlign: 'top',
                    xa: el.x - pad - estW,
                    xb: el.x - pad,
                    yTop: el.y + pad,
                    yBot: el.y + pad + estH,
                    prefer: 3
                }
            ];

            let best = cand[0];
            let bestScore = Infinity;
            for (const c of cand) {
                const overflow =
                    Math.max(0, c.xb - area.right) +
                    Math.max(0, area.left - c.xa) +
                    Math.max(0, c.yBot - area.bottom) +
                    Math.max(0, area.top - c.yTop);
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
    }

    /**
     * 旋转全屏下的指针坐标换算
     */
    function initChartPointerRotationFix() {
        if (typeof document === 'undefined') return;
        const card = document.getElementById('chartCard');
        const canvas = document.getElementById('weightChart');
        if (!card || !canvas) return;

        const TYPES = [
            'mousemove',
            'mousedown',
            'mouseup',
            'click',
            'mouseout',
            'mouseenter',
            'mouseleave',
            'touchstart',
            'touchmove',
            'touchend',
            'touchcancel',
            'pointerdown',
            'pointermove',
            'pointerup',
            'pointercancel'
        ];

        const toLocal = (cx, cy) => {
            const rect = canvas.getBoundingClientRect();
            return { x: cy - rect.top, y: rect.right - cx };
        };

        const fixTouchList = (list) =>
            Array.from(list, (t) => {
                const p = toLocal(t.clientX, t.clientY);
                return {
                    identifier: t.identifier,
                    clientX: t.clientX,
                    clientY: t.clientY,
                    offsetX: p.x,
                    offsetY: p.y
                };
            });

        TYPES.forEach((type) =>
            card.addEventListener(
                type,
                (e) => {
                    if (!card.classList.contains('rotated') || e.target !== canvas) return;
                    if (e.touches || e.changedTouches) {
                        if (e.touches) Object.defineProperty(e, 'touches', { value: fixTouchList(e.touches) });
                        if (e.changedTouches)
                            Object.defineProperty(e, 'changedTouches', { value: fixTouchList(e.changedTouches) });
                        if (e.targetTouches)
                            Object.defineProperty(e, 'targetTouches', { value: fixTouchList(e.targetTouches) });
                    } else {
                        const p = toLocal(e.clientX, e.clientY);
                        Object.defineProperty(e, 'offsetX', { value: p.x });
                        Object.defineProperty(e, 'offsetY', { value: p.y });
                    }
                },
                true
            )
        );
    }

    /**
     * 渲染/重绘图表
     * @param {Array<{id: string, date: string, weight: number}>} records
     * @param {Object} options
     */
    function renderChart(records, options = {}) {
        const canvas = document.getElementById('weightChart');
        if (!canvas || typeof Chart === 'undefined') return null;
        registerChartNearPointPositioner();
        const ctx = canvas.getContext('2d');
        const card = document.getElementById('chartCard');
        const rotatedFs = card && card.classList.contains('rotated');

        const finishChartSize = (chart) => {
            if (!rotatedFs) return;
            chart.stop();
            chart.resize(canvas.clientWidth, canvas.clientHeight);
        };

        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
        if (chartInstance === existing) chartInstance = null;

        const theme = options.theme || readTheme();
        const lineColorMode = options.lineColorMode || 'default';
        const lineStyle = options.lineStyle || 'smooth';
        const dateAxisMode = options.dateAxisMode || 'real';
        const hoverGuides = options.hoverGuides !== false;
        const tooltipOpacity = options.tooltipOpacity ?? 94;
        const allRecords = options.allRecords || [];

        const tooltipBg = `rgba(31, 36, 48, ${(tooltipOpacity / 100).toFixed(2)})`;

        if (records.length === 0) {
            chartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [] },
                options: {
                    responsive: !rotatedFs,
                    maintainAspectRatio: false,
                    _weightOptions: { theme, lineStyle, hoverGuides },
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: '暂无数据',
                            color: theme.muted,
                            font: { size: 15, weight: '600' }
                        }
                    },
                    scales: { x: { display: false }, y: { display: false } }
                }
            });
            finishChartSize(chartInstance);
            return chartInstance;
        }

        const data = records.map((r) => r.weight);
        const points = records.map((r, i) => ({
            x: dateAxisMode === 'real' ? new Date(r.date + 'T00:00:00').getTime() : i,
            y: r.weight
        }));

        const DAY = 86400000;
        const firstX = points[0].x;
        const lastX = points[points.length - 1].x;
        const minPadVal = dateAxisMode === 'real' ? DAY * 0.5 : 0.4;
        const xPad =
            lastX > firstX ? Math.max((lastX - firstX) * 0.04, minPadVal) : dateAxisMode === 'real' ? DAY / 2 : 0.5;

        const axisTicks = (() => {
            if (dateAxisMode === 'real') {
                const spanDays = Math.round((lastX - firstX) / DAY);
                const steps = [1, 2, 5, 10, 14, 30, 60, 120];
                const stepDays = steps.find((s) => spanDays / s <= 9) ?? 365;
                const ticks = [];
                for (let t = firstX; t <= lastX; t += stepDays * DAY) ticks.push(t);
                return ticks;
            }
            const step = Math.max(1, Math.ceil(data.length / 9));
            const ticks = [];
            for (let i = 0; i < data.length; i += step) ticks.push(i);
            return ticks;
        })();

        const tickLabel = (v) => {
            const d = dateAxisMode === 'real' ? new Date(v) : new Date(records[Math.round(v)].date + 'T00:00:00');
            return `${d.getMonth() + 1}月${d.getDate()}日`;
        };

        const isClear = lineColorMode === 'clear';
        const isKline = lineStyle === 'kline';

        let lineColor = theme.accent;
        if (lineColorMode === 'red') lineColor = theme.up;
        else if (lineColorMode === 'green') lineColor = theme.down;
        else if (lineColorMode === 'blue') lineColor = theme.blue;

        const useFill = !isClear && !isKline;
        const chartTension = lineStyle === 'sharp' ? 0 : 0.35;

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
            borderColor: isKline ? 'transparent' : lineColor,
            backgroundColor: isKline ? 'transparent' : gradient,
            borderWidth: isKline ? 0 : 2.5,
            pointBackgroundColor: theme.surface,
            pointBorderColor: isKline ? 'transparent' : lineColor,
            pointBorderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: isKline ? 0 : 6,
            pointHoverBackgroundColor: lineColor,
            pointHoverBorderColor: theme.surface,
            pointHitRadius: 16,
            tension: chartTension,
            fill: useFill
        };

        let datasets = [dataset];
        if (isClear && !isKline) {
            dataset.segment = {
                borderColor: (seg) => {
                    const d = seg.p1.parsed.y - seg.p0.parsed.y;
                    if (d > 0.05) return theme.up;
                    if (d < -0.05) return theme.down;
                    return theme.muted;
                }
            };
            dataset.pointBorderColor = data.map((w, i) => {
                if (i === 0 || Math.abs(w - data[i - 1]) < 0.05) return theme.muted;
                return w > data[i - 1] ? theme.up : theme.down;
            });
            dataset.pointHoverBackgroundColor = dataset.pointBorderColor;

            const segColor = { up: theme.up, down: theme.down, flat: theme.muted };
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
            const fillGradient = (color) => {
                const g = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 340);
                g.addColorStop(0, hexToRgba(color, 0.28));
                g.addColorStop(1, hexToRgba(color, 0.01));
                return g;
            };
            const fillDataset = (run) => {
                const arr = points.map((p) => ({ x: p.x, y: null }));
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
                    spanGaps: false
                };
            };
            datasets = [...fillRuns.map(fillDataset), dataset];
        }

        chartInstance = new Chart(ctx, {
            type: 'line',
            plugins: [klinePlugin, hoverGuidesPlugin],
            data: {
                datasets,
                _records: records,
                _allRecords: allRecords
            },
            options: {
                responsive: !rotatedFs,
                maintainAspectRatio: false,
                _weightOptions: { theme, lineStyle, hoverGuides },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleFont: { size: 13 },
                        bodyFont: { size: 14, weight: '600' },
                        padding: 12,
                        cornerRadius: 10,
                        caretPadding: 10,
                        displayColors: false,
                        filter: (item) => item.datasetIndex === datasets.length - 1,
                        position: 'nearPoint',
                        callbacks: {
                            title: (items) => {
                                const it = items[0];
                                if (!it || !it.parsed || it.parsed.x == null) return '';
                                const d =
                                    dateAxisMode === 'real'
                                        ? new Date(it.parsed.x)
                                        : new Date(records[Math.round(it.parsed.x)].date + 'T00:00:00');
                                return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
                            },
                            label: (itemCtx) => {
                                if (lineStyle !== 'kline') return `${itemCtx.parsed.y} kg`;
                                const idx = itemCtx.dataIndex;
                                const r = records[idx];
                                let prevW = null;
                                if (idx > 0) {
                                    prevW = records[idx - 1].weight;
                                } else {
                                    const fullIdx = allRecords.findIndex((item) => item.id === r.id);
                                    if (fullIdx > 0) prevW = allRecords[fullIdx - 1].weight;
                                }
                                if (prevW == null) {
                                    return [`体重: ${r.weight.toFixed(1)} kg`, `走势: 初始基准`];
                                }
                                const diff = r.weight - prevW;
                                if (Math.abs(diff) < 0.05) {
                                    return [
                                        `体重: ${r.weight.toFixed(1)} kg`,
                                        `较前日: 持平 (±0.0 kg)`,
                                        `前日: ${prevW.toFixed(1)} kg`
                                    ];
                                }
                                const sign = diff > 0 ? '+' : '';
                                const dir = diff > 0 ? '上升' : '下降';
                                return [
                                    `体重: ${r.weight.toFixed(1)} kg`,
                                    `较前日: ${dir} ${sign}${diff.toFixed(1)} kg`,
                                    `前日: ${prevW.toFixed(1)} kg`
                                ];
                            }
                        }
                    }
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
                            color: theme.muted,
                            callback: tickLabel
                        },
                        afterBuildTicks: (scale) => {
                            scale.ticks = axisTicks.map((v) => ({ value: v }));
                        }
                    },
                    y: {
                        grid: { color: theme.grid },
                        border: { display: false },
                        ticks: {
                            font: { size: 12 },
                            color: theme.muted,
                            maxTicksLimit: 6,
                            callback: (v) => v + ' kg'
                        },
                        suggestedMin: Math.floor((Math.min(...data) - 2) / 5) * 5,
                        suggestedMax: Math.ceil((Math.max(...data) + 2) / 5) * 5
                    }
                }
            }
        });
        finishChartSize(chartInstance);
        return chartInstance;
    }

    function getChart() {
        return chartInstance;
    }

    global.WeightChartConfig = {
        readTheme,
        hexToRgba,
        klinePlugin,
        hoverGuidesPlugin,
        registerChartNearPointPositioner,
        initChartPointerRotationFix,
        renderChart,
        getChart
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.WeightChartConfig;
    }
})(typeof window !== 'undefined' ? window : this);
