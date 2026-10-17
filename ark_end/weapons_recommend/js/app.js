// 武器数据由 shared/data/weapons.js 统一提供
if (typeof weaponsData === 'undefined' && typeof require !== 'undefined') {
    try {
        var { weaponsData } = require('../../../shared/data/weapons.js');
    } catch (e) {}
}

// 五个内置预设
const defaultPresets = [
    {
        id: 'hub',
        name: '枢纽区',
        additional: ['攻击', '灼热', '电磁', '寒冷', '自然', '源石技艺', '充能', '法术'],
        skill: ['强攻', '压制', '追袭', '粉碎', '巧技', '迸发', '流转', '效益']
    },
    {
        id: 'source_stone',
        name: '源石研究园',
        additional: ['攻击', '物理', '电磁', '寒冷', '自然', '暴击', '充能', '法术'],
        skill: ['压制', '追袭', '昂扬', '巧技', '附术', '医疗', '切骨', '效益']
    },
    {
        id: 'mining',
        name: '矿脉源区',
        additional: ['生命', '物理', '灼热', '寒冷', '自然', '暴击', '源石技艺', '治疗'],
        skill: ['强攻', '压制', '巧技', '残暴', '附术', '迸发', '夜幕', '效益']
    },
    {
        id: 'energy',
        name: '供能高地',
        additional: ['攻击', '生命', '物理', '灼热', '自然', '暴击', '源石技艺', '治疗'],
        skill: ['追袭', '粉碎', '昂扬', '残暴', '附术', '医疗', '切骨', '流转']
    },
    {
        id: 'wuling',
        name: '武陵城',
        additional: ['攻击', '生命', '电磁', '寒冷', '暴击', '充能', '法术', '治疗'],
        skill: ['强攻', '粉碎', '残暴', '医疗', '切骨', '迸发', '夜幕', '流转']
    }
];

const uniqueValues = {
    basic: [...new Set(weaponsData.map((w) => w.basic))],
    additional: [...new Set(weaponsData.map((w) => w.additional))],
    skill: [...new Set(weaponsData.map((w) => w.skill).concat(['强攻']))]
};

// 初始化下拉框
function initSelectOptions() {
    const basicSel = document.getElementById('comboBasic');
    const addSel = document.getElementById('comboAdditional');
    const skillSel = document.getElementById('comboSkill');
    if (!basicSel || !addSel || !skillSel) return;

    const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s == null ? '' : s);
    const escA = typeof escapeAttr === 'function' ? escapeAttr : (s) => String(s == null ? '' : s);

    basicSel.innerHTML =
        '<option value="">选择基础属性</option>' +
        uniqueValues.basic.map((v) => `<option value="${escA(v)}">${esc(v)}</option>`).join('');
    addSel.innerHTML =
        '<option value="">选择附加属性</option>' +
        uniqueValues.additional.map((v) => `<option value="${escA(v)}">${esc(v)}</option>`).join('');
    skillSel.innerHTML =
        '<option value="">选择技能属性</option>' +
        uniqueValues.skill.map((v) => `<option value="${escA(v)}">${esc(v)}</option>`).join('');
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSelectOptions);
    } else {
        initSelectOptions();
    }
}

function validateInput() {
    const basic = document.getElementById('comboBasic').value;
    const additional = document.getElementById('comboAdditional').value;
    const skill = document.getElementById('comboSkill').value;

    const btn = document.getElementById('simulateBtn');
    const valid = basic && additional && skill;

    btn.disabled = !valid;
    btn.textContent = valid ? '开始计算' : '请输入完整的目标三属性组合';
}

// 纯函数：根据目标三属性与副本预设，计算最优推荐
function findBestRecommendation(target, presets, weapons) {
    if (!target || !target.basic || !target.additional || !target.skill) return null;
    const pList = Array.isArray(presets) ? presets : defaultPresets;
    const dataList = Array.isArray(weapons) ? weapons : typeof weaponsData !== 'undefined' ? weaponsData : [];

    const results = pList
        .map((preset) => {
            const pool = dataList.filter(
                (w) => preset.additional.includes(w.additional) && preset.skill.includes(w.skill)
            );

            // 检查是否存在完美匹配（三属性全中）
            const perfectMatches = pool.filter(
                (w) => w.basic === target.basic && w.additional === target.additional && w.skill === target.skill
            );

            if (perfectMatches.length === 0) {
                return {
                    preset: preset,
                    valid: false
                };
            }

            // 寻找最优筛选组合（包含至少2个目标属性的最大覆盖）
            const optimal = findOptimal(pool, target, preset);

            return {
                preset: preset,
                pool: pool,
                valid: true,
                perfectMatches: perfectMatches,
                optimal: optimal,
                resultWeapons: optimal ? getFilteredWeapons(pool, optimal) : []
            };
        })
        .filter((r) => r.valid);

    if (results.length === 0) return null;

    return results.reduce((best, current) => {
        return current.resultWeapons.length > best.resultWeapons.length ? current : best;
    });
}

function runSimulation() {
    const target = {
        basic: document.getElementById('comboBasic').value,
        additional: document.getElementById('comboAdditional').value,
        skill: document.getElementById('comboSkill').value
    };

    const bestResult = findBestRecommendation(target, defaultPresets, weaponsData);
    if (!bestResult) {
        showNoResult(target);
        return;
    }

    showResult(bestResult, target);
}

function findOptimal(pool, target, preset) {
    const allBasics = uniqueValues.basic;
    let best = null;
    let maxCount = -1;

    const countMatch = (basics, otherType, otherVal) => {
        let m = 0;
        if (basics.includes(target.basic)) m++;
        if (otherType === 'additional' && otherVal === target.additional) m++;
        if (otherType === 'skill' && otherVal === target.skill) m++;
        return m;
    };

    ['additional', 'skill'].forEach((otherType) => {
        const otherValues = otherType === 'additional' ? preset.additional : preset.skill;

        otherValues.forEach((otherVal) => {
            for (let len = 0; len <= 3; len++) {
                let combinations;
                if (len === 0) {
                    combinations = [[]];
                } else {
                    combinations = getCombinations(allBasics, len);
                }

                combinations.forEach((basics) => {
                    if (countMatch(basics, otherType, otherVal) >= 2) {
                        const count = countWeapons(pool, basics, otherType, otherVal);
                        if (count > maxCount) {
                            maxCount = count;
                            best = { basic: basics, other: { type: otherType, value: otherVal } };
                        }
                    }
                });
            }
        });
    });

    return best;
}

function getCombinations(arr, len) {
    if (len === 1) return arr.map((v) => [v]);
    const result = [];
    for (let i = 0; i <= arr.length - len; i++) {
        const rest = getCombinations(arr.slice(i + 1), len - 1);
        rest.forEach((r) => result.push([arr[i], ...r]));
    }
    return result;
}

function countWeapons(pool, basics, otherType, otherVal) {
    return pool.filter((w) => {
        const matchBasic = basics.length === 0 || basics.includes(w.basic);
        const matchOther = otherType === 'additional' ? w.additional === otherVal : w.skill === otherVal;
        return matchBasic && matchOther;
    }).length;
}

function getFilteredWeapons(pool, combo) {
    return pool.filter((w) => {
        const matchBasic = combo.basic.length === 0 || combo.basic.includes(w.basic);
        const matchOther =
            combo.other.type === 'additional' ? w.additional === combo.other.value : w.skill === combo.other.value;
        return matchBasic && matchOther;
    });
}

function showNoResult(target) {
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s == null ? '' : s);
    const panel = document.getElementById('resultPanel');
    panel.className = 'result-panel show error';
    panel.innerHTML = `
        <div class="no-result">
            <h3>未找到符合条件的预设</h3>
            <p>五个预设区域中均不存在同时满足以下条件的武器：<br>
            基础：${esc(target.basic)} | 附加：${esc(target.additional)} | 技能：${esc(target.skill)}</p>
        </div>
    `;
}

function showResult(result, target) {
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s == null ? '' : s);
    const panel = document.getElementById('resultPanel');
    panel.className = 'result-panel show';

    const weapons = result.resultWeapons;
    const combo = result.optimal;

    // 构建筛选组合描述文本
    let comboText = '';
    if (combo.basic.length > 0) {
        comboText += combo.basic.map(esc).join('、') + '（基础）';
    }
    if (combo.other.type === 'additional') {
        if (comboText) comboText += ' + ';
        comboText += esc(combo.other.value) + '（附加）';
    } else {
        if (comboText) comboText += ' + ';
        comboText += esc(combo.other.value) + '（技能）';
    }

    let html = `
        <div class="result-text">
            在 <span class="highlight">${esc(result.preset.name)}</span> 使用以下筛选组合可以获得
            <span class="number">${weapons.length}</span> 种武器的基质：
            <span class="combo">${comboText}</span>
        </div>

        <div class="weapons-list">
            <div class="weapons-title">${esc(result.preset.name)} 武器基质列表（共${weapons.length}种）</div>
            <div class="weapons-grid">
    `;

    html += weapons
        .map((w) => {
            const stars = '★'.repeat(w.star) + '☆'.repeat(6 - w.star);
            const isPerfect =
                w.basic === target.basic && w.additional === target.additional && w.skill === target.skill;
            const badge = isPerfect ? '<div class="perfect-badge">PERFECT</div>' : '';
            const cardClass = isPerfect ? 'weapon-card perfect' : 'weapon-card';

            return `
            <div class="${cardClass}">
                ${badge}
                <div class="weapon-header">
                    <div class="weapon-name">${esc(w.name)}</div>
                    <span class="weapon-type">${esc(w.type)}</span>
                </div>
                <div style="margin-bottom: 8px; font-size: 0.9rem;">${stars
                    .split('')
                    .map((s) => `<span class="star ${s === '☆' ? 'empty' : ''}">${s}</span>`)
                    .join('')}</div>
                <div class="weapon-attrs">
                    <span class="weapon-attr basic ${w.basic === target.basic ? 'target' : ''}">${esc(w.basic)}</span>
                    <span class="weapon-attr additional ${w.additional === target.additional ? 'target' : ''}">${esc(w.additional)}</span>
                    <span class="weapon-attr skill ${w.skill === target.skill ? 'target' : ''}">${esc(w.skill)}</span>
                </div>
            </div>
        `;
        })
        .join('');

    html += `
            </div>
        </div>
    `;

    panel.innerHTML = html;
    panel.scrollIntoView({ behavior: 'smooth' });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        defaultPresets,
        findBestRecommendation,
        findOptimal,
        getFilteredWeapons
    };
}
