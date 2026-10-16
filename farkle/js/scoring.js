'use strict';
/**
 * Farkle 骰子计分规则引擎
 * 负责顺子、三同/四同/五同/六同、散点 1 和 5、特殊徽章组合（切口、绞架、天眼）、以及万能鬼牌（魔鬼头/小丑）的校验与计分
 */

/**
 * 基础纯数值计分核心
 * @param {number[]} values
 * @param {Object} [fx]
 * @returns {{ score: number, valid: boolean }}
 */
function scoreValuesRaw(values, fx) {
    if (!values || values.length === 0) return { score: 0, valid: false };
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);

    // 大顺子 1-2-3-4-5-6 (1500分)
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return { score: 1500, valid: true };
    }

    // 小顺子 1-2-3-4-5 (500分)
    if (values.length === 5) {
        if (counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1) {
            return { score: 500, valid: true };
        }
        // 小顺子 2-3-4-5-6 (750分)
        if (counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1 && counts[6] === 1) {
            return { score: 750, valid: true };
        }
    }

    let score = 0;
    for (let v = 1; v <= 6; v++) {
        if (counts[v] >= 3) {
            const base = v === 1 ? (fx && fx.emperor ? 3000 : 1000) : v * 100;
            score += base * Math.pow(2, counts[v] - 3);
            counts[v] = 0;
        }
    }

    // 徽章特殊组合：三同结算后，剩余骰子继续配对
    if (fx) {
        while (fx.eye && counts[1] > 0 && counts[3] > 0 && counts[5] > 0) {
            counts[1]--; counts[3]--; counts[5]--; score += fx.eye;
        }
        while (fx.gallows && counts[4] > 0 && counts[5] > 0 && counts[6] > 0) {
            counts[4]--; counts[5]--; counts[6]--; score += fx.gallows;
        }
        while (fx.cut && counts[3] > 0 && counts[5] > 0) {
            counts[3]--; counts[5]--; score += fx.cut;
        }
    }

    for (let v = 1; v <= 6; v++) {
        const c = counts[v];
        if (c > 0) {
            if (v === 1) score += c * 100;
            else if (v === 5) score += c * 50;
            else return { score: 0, valid: false };
        }
    }
    return { score, valid: score > 0 };
}

/**
 * 校验一组骰面是否全部参与计分，支持万能鬼牌（Joker），返回 { score, valid }
 * @param {Array<number|{value: number, isJoker?: boolean}>} values - 骰子点数数组
 * @param {Object} [fx] - 徽章附加规则 { cut:75, gallows:150, eye:250, emperor:true }
 * @returns {{ score: number, valid: boolean, bestValues?: number[], hasJoker?: boolean }}
 */
function scoreValues(values, fx) {
    if (!values || values.length === 0) return { score: 0, valid: false };
    const jokerIndices = [];
    const baseNums = values.map((item, idx) => {
        if (typeof item === 'object' && item !== null) {
            if (item.isJoker) jokerIndices.push(idx);
            return item.value;
        }
        return item;
    });

    if (jokerIndices.length === 0) {
        return scoreValuesRaw(baseNums, fx);
    }

    let best = { score: 0, valid: false, bestValues: baseNums, hasJoker: true };
    const candidates = [1, 5, 6, 2, 3, 4];

    function search(jIdx, currentNums) {
        if (jIdx === jokerIndices.length) {
            const res = scoreValuesRaw(currentNums, fx);
            if (res.valid && res.score > best.score) {
                best = { score: res.score, valid: true, bestValues: [...currentNums], hasJoker: true };
            }
            return;
        }
        const targetPos = jokerIndices[jIdx];
        for (const face of candidates) {
            currentNums[targetPos] = face;
            search(jIdx + 1, currentNums);
        }
    }

    search(0, [...baseNums]);
    return best;
}

/**
 * 一次掷骰是否存在任何可计分的骰子（纯数值）
 * @param {number[]} values
 * @param {Object} [fx]
 * @returns {boolean}
 */
function hasAnyScoreRaw(values, fx) {
    if (!values || values.length === 0) return false;
    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) return true;
    if (values.length === 5 && counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1) return true;
    if (values.length === 5 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1 && counts[6] === 1) return true;
    if (counts[1] > 0 || counts[5] > 0 || counts.some(c => c >= 3)) return true;
    return !!(fx && ((fx.eye && counts[1] && counts[3] && counts[5]) ||
                     (fx.gallows && counts[4] && counts[5] && counts[6]) ||
                     (fx.cut && counts[3] && counts[5])));
}

/**
 * 一次掷骰是否存在任何可计分的骰子（含 Joker 判定）
 * @param {Array<number|{value: number, isJoker?: boolean}>} values
 * @param {Object} [fx]
 * @returns {boolean}
 */
function hasAnyScore(values, fx) {
    if (!values || values.length === 0) return false;
    const hasJoker = values.some(item => typeof item === 'object' && item !== null && item.isJoker);
    if (hasJoker) return true; // 万能牌至少可作为点数 1 计 100 分
    const nums = values.map(v => (typeof v === 'object' && v !== null ? v.value : v));
    return hasAnyScoreRaw(nums, fx);
}

/**
 * 把一次掷骰的可计分骰子拆成「组合」（顺子 / 三同及以上 / 徽章组合）与「单颗」（1、5）
 * @param {Array<number|{value: number, isJoker?: boolean}>} rawValues
 * @param {Object} [fx]
 * @returns {Array<{ indices: number[], quick: boolean }>}
 */
function takeGroups(rawValues, fx) {
    let values = rawValues.map(v => (typeof v === 'object' && v !== null ? v.value : v));
    const scored = scoreValues(rawValues, fx);
    if (scored.bestValues) values = scored.bestValues;

    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return [{ indices: values.map((_, i) => i), quick: true }];
    }
    if (values.length === 5) {
        if (counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1) {
            return [{ indices: values.map((_, i) => i), quick: true }];
        }
        if (counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1 && counts[6] === 1) {
            return [{ indices: values.map((_, i) => i), quick: true }];
        }
    }
    const used = values.map(() => false);
    const grabAll = v => {
        const idx = [];
        values.forEach((val, i) => { if (val === v && !used[i]) { used[i] = true; idx.push(i); } });
        return idx;
    };
    const grabOne = v => {
        const i = values.findIndex((val, j) => val === v && !used[j]);
        if (i >= 0) used[i] = true;
        return i;
    };
    const groups = [];
    for (let v = 1; v <= 6; v++) {
        if (counts[v] >= 3) {
            counts[v] = 0;
            groups.push({ indices: grabAll(v), quick: true });
        }
    }
    if (fx) {
        const takeForm = need => {
            while (need.every(v => counts[v] > 0)) {
                need.forEach(v => counts[v]--);
                const idx = need.map(grabOne).filter(i => i >= 0);
                if (idx.length === need.length) groups.push({ indices: idx, quick: true });
            }
        };
        if (fx.eye) takeForm([1, 3, 5]);
        if (fx.gallows) takeForm([4, 5, 6]);
        if (fx.cut) takeForm([3, 5]);
    }
    values.forEach((val, i) => {
        if (!used[i] && (val === 1 || val === 5)) groups.push({ indices: [i], quick: false });
    });
    return groups;
}

/**
 * 计分来源描述
 * @param {Array<number|{value: number, isJoker?: boolean}>} rawValues
 * @param {Object} [fx]
 * @returns {string}
 */
function scoreDetail(rawValues, fx) {
    let values = rawValues.map(v => (typeof v === 'object' && v !== null ? v.value : v));
    const scored = scoreValues(rawValues, fx);
    let jokerSuffix = '';
    if (scored.hasJoker) {
        values = scored.bestValues;
        jokerSuffix = '（含万能鬼牌）';
    }

    const counts = [0, 0, 0, 0, 0, 0, 0];
    values.forEach(v => counts[v]++);
    if (values.length === 6 && counts.slice(1).every(c => c === 1)) {
        return '顺子1-6 1500' + jokerSuffix;
    }
    if (values.length === 5 && counts[1] === 1 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1) {
        return '顺子1-5 500' + jokerSuffix;
    }
    if (values.length === 5 && counts[2] === 1 && counts[3] === 1 && counts[4] === 1 && counts[5] === 1 && counts[6] === 1) {
        return '顺子2-6 750' + jokerSuffix;
    }
    const names = { 3: '三同', 4: '四同', 5: '五同', 6: '六同' };
    const parts = [];
    for (let v = 1; v <= 6; v++) {
        if (counts[v] >= 3) {
            const emperor = v === 1 && fx && fx.emperor;
            const base = v === 1 ? (emperor ? 3000 : 1000) : v * 100;
            parts.push(`${names[counts[v]]}${v} ${base * Math.pow(2, counts[v] - 3)}${emperor ? '（皇帝）' : ''}`);
            counts[v] = 0;
        }
    }
    if (fx) {
        while (fx.eye && counts[1] > 0 && counts[3] > 0 && counts[5] > 0) {
            counts[1]--; counts[3]--; counts[5]--; parts.push(`天眼 ${fx.eye}`);
        }
        while (fx.gallows && counts[4] > 0 && counts[5] > 0 && counts[6] > 0) {
            counts[4]--; counts[5]--; counts[6]--; parts.push(`绞架 ${fx.gallows}`);
        }
        while (fx.cut && counts[3] > 0 && counts[5] > 0) {
            counts[3]--; counts[5]--; parts.push(`切口 ${fx.cut}`);
        }
    }
    for (let v = 1; v <= 6; v++) {
        const c = counts[v];
        if (c > 0 && (v === 1 || v === 5)) {
            const unit = v === 1 ? 100 : 50;
            parts.push(c === 1 ? `单${v} ${unit}` : `${v}×${c} ${unit * c}`);
        }
    }
    return (parts.join(' ＋ ') || '无得分') + jokerSuffix;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { scoreValues, hasAnyScore, takeGroups, scoreDetail };
}
