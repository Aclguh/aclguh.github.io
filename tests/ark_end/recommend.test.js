const { describe, it, expect } = require('../test-utils.js');
const { weaponsData } = require('../../shared/data/weapons.js');
const {
    defaultPresets,
    findBestRecommendation,
    getFilteredWeapons
} = require('../../ark_end/weapons_recommend/js/app.js');

describe('ArkEnd Weapon Matrix Recommendation Module', () => {
    describe('defaultPresets 配置完整性', () => {
        it('包含五个预设区域且定义完整', () => {
            expect(defaultPresets.length).toBe(5);
            defaultPresets.forEach((p) => {
                expect(typeof p.id).toBe('string');
                expect(typeof p.name).toBe('string');
                expect(Array.isArray(p.additional)).toBe(true);
                expect(Array.isArray(p.skill)).toBe(true);
                expect(p.additional.length).toBeGreaterThan(0);
                expect(p.skill.length).toBeGreaterThan(0);
            });
        });
    });

    describe('findBestRecommendation 核心推荐算法', () => {
        it('输入存在的完美匹配武器（如“骑士精神”：意志/生命/医疗），应返回最优预设及覆盖列表', () => {
            const target = { basic: '意志', additional: '生命', skill: '医疗' };
            const best = findBestRecommendation(target, defaultPresets, weaponsData);

            expect(best).not.toBeNull();
            expect(best.valid).toBe(true);
            expect(best.perfectMatches.length).toBeGreaterThan(0);
            expect(best.resultWeapons.length).toBeGreaterThan(0);
            // 结果中必须包含目标武器
            const names = best.resultWeapons.map((w) => w.name);
            expect(names).toContain('骑士精神');
        });

        it('输入真实武器“破碎君王”（力量/暴击/粉碎），应能找到最优匹配方案', () => {
            const target = { basic: '力量', additional: '暴击', skill: '粉碎' };
            const best = findBestRecommendation(target, defaultPresets, weaponsData);

            expect(best).not.toBeNull();
            expect(best.resultWeapons.map((w) => w.name)).toContain('破碎君王');
        });

        it('当五个预设均不存在完美匹配三属性时，应返回 null', () => {
            const target = { basic: '虚构基础', additional: '虚构附加', skill: '虚构技能' };
            const best = findBestRecommendation(target, defaultPresets, weaponsData);
            expect(best).toBeNull();
        });

        it('参数不完整时安全返回 null', () => {
            expect(findBestRecommendation(null, defaultPresets, weaponsData)).toBeNull();
            expect(findBestRecommendation({}, defaultPresets, weaponsData)).toBeNull();
            expect(findBestRecommendation({ basic: '力量' }, defaultPresets, weaponsData)).toBeNull();
        });
    });

    describe('getFilteredWeapons 组合过滤', () => {
        it('根据最优 combo 准确筛选武器池', () => {
            const pool = [
                { name: 'W1', basic: '力量', additional: '物理', skill: '强攻' },
                { name: 'W2', basic: '力量', additional: '法术', skill: '强攻' },
                { name: 'W3', basic: '敏捷', additional: '物理', skill: '强攻' }
            ];
            const combo = { basic: ['力量'], other: { type: 'additional', value: '物理' } };
            const filtered = getFilteredWeapons(pool, combo);
            expect(filtered.length).toBe(1);
            expect(filtered[0].name).toBe('W1');
        });
    });
});
