'use strict';

/* =====================================================================
 * Farkle 状态管理与存储模块
 * 职责：对局状态机、玩家与AI得分、投掷/锁定骰子、徽章附加规则、存储持久化
 * ===================================================================== */

/* global SafeStorage, DICE_LIST */

const STORAGE_KEY_USE_DEFAULT = 'farkle_use_default_dice';
const STORAGE_KEY_DEFAULT_DICE = 'farkle_default_dice';

function loadStoredUseDefault() {
    if (typeof SafeStorage !== 'undefined') {
        const val = SafeStorage.getItem(STORAGE_KEY_USE_DEFAULT);
        return val !== null ? val === 'true' : true;
    }
    return true;
}

function saveStoredUseDefault(val) {
    if (typeof SafeStorage !== 'undefined') {
        SafeStorage.setItem(STORAGE_KEY_USE_DEFAULT, String(val));
    }
}

function loadStoredDefaultDice() {
    if (typeof SafeStorage !== 'undefined') {
        const arr = SafeStorage.get(STORAGE_KEY_DEFAULT_DICE);
        if (Array.isArray(arr) && arr.length === 6) return arr;
    }
    return ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary'];
}

function saveStoredDefaultDice(arr) {
    if (typeof SafeStorage !== 'undefined') {
        SafeStorage.set(STORAGE_KEY_DEFAULT_DICE, arr);
    }
}

/**
 * NPC 骰子生成：
 * 规则：随机选择其他骰子，最多不超过两颗；大多数情况下为全默认普通骰。
 * 概率设计：80% 几率 0 颗特殊骰（全普通骰），15% 几率 1 颗特殊骰，5% 几率 2 颗特殊骰。
 */
function generateAiDice() {
    const r = Math.random();
    let specialCount;
    if (r < 0.8) {
        specialCount = 0;
    } else if (r < 0.95) {
        specialCount = 1;
    } else {
        specialCount = 2;
    }
    const pool = typeof DICE_LIST !== 'undefined' ? DICE_LIST : [];
    const specialPool = pool.filter((d) => d.id !== 'ordinary');
    const dice = [];
    for (let i = 0; i < specialCount; i++) {
        if (specialPool.length > 0) {
            const pick = specialPool[Math.floor(Math.random() * specialPool.length)];
            dice.push(pick.id);
        }
    }
    while (dice.length < 6) {
        dice.push('ordinary');
    }
    // 洗牌打乱位置
    for (let i = dice.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dice[i], dice[j]] = [dice[j], dice[i]];
    }
    return dice;
}

/* ── 核心对局状态 ───────────────────────── */
const state = {
    target: 1500,
    phase: 'setup', // setup | await-roll | select | busy | ai | bust-choice | pre-bank | over
    current: 'me', // me | ai
    scores: { me: 0, ai: 0 },
    turnPoints: 0,
    nextId: 1,
    badges: { me: null, ai: null }, // 开局时各佩戴一枚（可能被防御抵消：cancelled）
    warlordArmed: { me: false, ai: false },
    lastCollect: null, // {who, score, doubled} 上一次掷骰收起的分数（分身徽章用）
    targeting: null, // 点化/重掷的选取状态
    useDefaultDice: loadStoredUseDefault(),
    defaultDice: loadStoredDefaultDice(),
    playerDice: loadStoredDefaultDice(),
    aiDice: ['ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary', 'ordinary']
};

// 每个玩家的徽章附加计分规则（切口/绞架/天眼/皇帝）
function fxFor(who) {
    const b = state.badges[who];
    if (!b || b.cancelled) return null;
    if (b.type === 'formation') return { [b.formation]: b.value };
    if (b.type === 'emperor') return { emperor: true };
    return null;
}

// 已显示（计分浮动提示结束后才更新）
const shown = { me: 0, ai: 0 };
// 每个面板在下一次该方掷骰前清空
const pendingReset = { me: false, ai: false };

if (typeof window !== 'undefined') {
    window.STORAGE_KEY_USE_DEFAULT = STORAGE_KEY_USE_DEFAULT;
    window.STORAGE_KEY_DEFAULT_DICE = STORAGE_KEY_DEFAULT_DICE;
    window.loadStoredUseDefault = loadStoredUseDefault;
    window.saveStoredUseDefault = saveStoredUseDefault;
    window.loadStoredDefaultDice = loadStoredDefaultDice;
    window.saveStoredDefaultDice = saveStoredDefaultDice;
    window.generateAiDice = generateAiDice;
    window.state = state;
    window.shown = shown;
    window.pendingReset = pendingReset;
    window.fxFor = fxFor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORAGE_KEY_USE_DEFAULT,
        STORAGE_KEY_DEFAULT_DICE,
        loadStoredUseDefault,
        saveStoredUseDefault,
        loadStoredDefaultDice,
        saveStoredDefaultDice,
        generateAiDice,
        state,
        shown,
        pendingReset,
        fxFor
    };
}
