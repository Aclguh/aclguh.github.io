/**
 * 体重记录 - 核心计算、统计与数据处理算法
 * 纯算法模块：支持 Node.js 单元测试与浏览器环境
 */

/**
 * 计算 BMI 及健康分级
 * @param {number} weight - 体重 (kg)
 * @param {number} heightCm - 身高 (cm)
 * @returns {{ bmi: number, category: string, label: string }|null}
 */
function calcBMI(weight, heightCm) {
    if (!weight || !heightCm || weight <= 0 || heightCm <= 0) return null;
    const heightM = heightCm / 100;
    const bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));

    let category;
    let label;

    if (bmi < 18.5) {
        category = 'underweight';
        label = '偏瘦';
    } else if (bmi < 24.0) {
        category = 'normal';
        label = '正常';
    } else if (bmi < 28.0) {
        category = 'overweight';
        label = '超重';
    } else {
        category = 'obese';
        label = '肥胖';
    }

    return { bmi, category, label };
}

/**
 * 记录按日期升序排列
 * @param {Array<{date: string, weight: number}>} records
 * @returns {Array}
 */
function sortRecordsAsc(records) {
    return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 根据有效起止日期过滤记录
 * @param {Array<{date: string, weight: number}>} records
 * @param {{start: string, end: string}|null} range
 * @returns {Array}
 */
function filterRecordsByRange(records, range) {
    if (!range || (!range.start && !range.end)) return records;
    return records.filter((r) => {
        if (range.start && r.date < range.start) return false;
        if (range.end && r.date > range.end) return false;
        return true;
    });
}

/**
 * 计算总体统计指标
 * @param {Array<{date: string, weight: number}>} records - 当前筛选区间内的记录
 * @returns {{count: number, current: number|null, min: number|null, max: number|null, avg: number|null, totalDiff: number|null}}
 */
function calculateStats(records) {
    if (!records || records.length === 0) {
        return { count: 0, current: null, min: null, max: null, avg: null, totalDiff: null };
    }

    const sorted = sortRecordsAsc(records);
    const weights = sorted.map((r) => r.weight);
    const count = weights.length;

    let sum = 0;
    let min = weights[0];
    let max = weights[0];

    for (let i = 0; i < count; i++) {
        const w = weights[i];
        sum += w;
        if (w < min) min = w;
        if (w > max) max = w;
    }

    const current = weights[count - 1];
    const initial = weights[0];
    const avg = parseFloat((sum / count).toFixed(1));
    const totalDiff = parseFloat((current - initial).toFixed(1));

    return {
        count,
        current,
        min: parseFloat(min.toFixed(1)),
        max: parseFloat(max.toFixed(1)),
        avg,
        totalDiff
    };
}

/**
 * 将平铺日期记录聚合成 K 线 (OHLC) 周期柱
 * @param {Array<{date: string, weight: number}>} records
 * @param {'week'|'month'} period
 * @returns {Array<{label: string, open: number, high: number, low: number, close: number, count: number}>}
 */
function aggregateKLineData(records, period = 'week') {
    if (!records || records.length === 0) return [];
    const sorted = sortRecordsAsc(records);

    const groups = new Map();

    for (const r of sorted) {
        let key;
        if (period === 'month') {
            key = r.date.slice(0, 7); // YYYY-MM
        } else {
            // 周聚合：以周一为起点
            const d = new Date(r.date + 'T00:00:00');
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            key = monday.toISOString().slice(0, 10);
        }

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(r.weight);
    }

    const result = [];
    for (const [key, weights] of groups.entries()) {
        const open = weights[0];
        const close = weights[weights.length - 1];
        let high = weights[0];
        let low = weights[0];

        for (const w of weights) {
            if (w > high) high = w;
            if (w < low) low = w;
        }

        result.push({
            label: key,
            open: parseFloat(open.toFixed(1)),
            high: parseFloat(high.toFixed(1)),
            low: parseFloat(low.toFixed(1)),
            close: parseFloat(close.toFixed(1)),
            count: weights.length
        });
    }

    return result;
}

/**
 * 严格安全的 CSV 文本解析
 * @param {string} text - 原始文本内容
 * @returns {{ records: Array<{date: string, weight: number}>, added: number, skipped: number }}
 */
function parseWeightCSV(text) {
    if (!text || typeof text !== 'string') return { records: [], added: 0, skipped: 0 };

    // Strip BOM
    let clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const lines = clean.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return { records: [], added: 0, skipped: 0 };

    let startIdx = 0;
    const firstLine = lines[0].trim();
    if (firstLine.includes('日期') || firstLine.toLowerCase().includes('date')) {
        startIdx = 1;
    }

    const records = [];
    let skipped = 0;

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length < 2) {
            skipped++;
            continue;
        }

        const date = parts[0].trim().replace(/['"]/g, '');
        const weight = parseFloat(parts[1].trim());

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(weight) || weight < 20 || weight > 300) {
            skipped++;
            continue;
        }

        records.push({ date, weight });
    }

    return { records, added: records.length, skipped };
}

const WeightCalc = {
    calcBMI,
    sortRecordsAsc,
    filterRecordsByRange,
    calculateStats,
    aggregateKLineData,
    parseWeightCSV
};

if (typeof window !== 'undefined') {
    window.WeightCalc = WeightCalc;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeightCalc;
}
