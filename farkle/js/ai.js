/**
 * 天国骰子 - AI 启发式决策算法模块
 * 负责评估是否继续掷骰、挑选最优得分组合、徽章技能使用决策
 */

/**
 * 评估 AI 是否应当继续掷骰（还是收手记分）
 * @param {number} remaining - 场上剩余未计分骰子数 (0-6，0代表热骰可重新掷全部6颗)
 * @param {number} turnPoints - 本回合已累计点数
 * @param {number} [myTotal=0] - AI 当前总分
 * @param {number} [targetScore=8000] - 获胜目标分
 * @returns {boolean}
 */
function aiShouldContinue(remaining, turnPoints, myTotal = 0, targetScore = 8000) {
    // 热骰（6颗骰子全部计分）：免费再掷整组，必须继续
    if (remaining === 0) return true;

    // 如果加上当前回合分已达到获胜目标，立即稳妥收手
    if (myTotal + turnPoints >= targetScore) return false;

    // 场上剩余骰子多（>=3颗），爆骰概率较低，继续搏收益
    if (remaining >= 3) return true;

    // 剩余 1~2 颗骰子，爆骰风险极高；当本回合分数达到 350 分门槛时选择稳妥收手
    return turnPoints < 350;
}

/**
 * AI 点化徽章目标判定：寻找能否牺牲一颗无用骰子补全某点数的三同
 * @param {Array<number>} values - 当前骰子点数列表
 * @returns {{ dieIdx: number, to: number }|null}
 */
function aiTransmuteTarget(values) {
    if (!values || values.length === 0) return null;
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const nums = values.map((v) => (typeof v === 'object' && v !== null ? v.value : v));
    nums.forEach((v) => {
        if (v >= 1 && v <= 6) counts[v]++;
    });

    // 优先补全高价值三同 (1 > 5 > 6 > 4 > 3 > 2)
    const to = [1, 5, 6, 4, 3, 2].find((v) => counts[v] === 2);
    if (to === undefined) return null;

    // 寻找无用骰子作为被点化对象（非三同、非单1、非单5的散牌）
    const dieIdx = nums.findIndex((v) => [2, 3, 4, 6].includes(v) && counts[v] < 3 && v !== to);
    if (dieIdx < 0) return null;

    return { dieIdx, to };
}

/**
 * AI 是否使用好运/交换类重掷徽章
 * @param {Object} badge
 * @param {number} turnPoints
 * @param {Array<number>} takenValues
 * @param {Array<Object>} groups
 * @returns {boolean}
 */
function aiShouldUseReroll(badge, turnPoints, takenValues, groups) {
    if (!badge || badge.cancelled || badge.uses <= 0) return false;
    // 回合分嘴上还是 0 且只能收到单张 5 时，赌一次重掷
    return (
        turnPoints === 0 &&
        takenValues.length > 0 &&
        takenValues.length <= (badge.dice || 1) &&
        groups.every((g) => !g.quick) &&
        takenValues.every((v) => v === 5)
    );
}

/**
 * AI 爆骰后是否触发复活徽章
 * @param {number} lostPoints - 本回合爆掉的分数
 * @returns {boolean}
 */
function aiShouldResurrect(lostPoints) {
    // 只有本回合损失大于等于 250 分时才值得消耗复活徽章
    return lostPoints >= 250;
}

const FarkleAI = {
    aiShouldContinue,
    aiTransmuteTarget,
    aiShouldUseReroll,
    aiShouldResurrect
};

if (typeof window !== 'undefined') {
    window.FarkleAI = FarkleAI;
    window.aiShouldContinue = aiShouldContinue;
    window.aiTransmuteTarget = aiTransmuteTarget;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FarkleAI;
}
