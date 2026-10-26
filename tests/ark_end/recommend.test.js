const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');
const { weaponsData } = require('../../shared/data/weapons.js');
const {
    defaultPresets,
    findBestRecommendation,
    findOptimal,
    getFilteredWeapons,
    getRecommendUniqueValues,
    validateInput,
    runSimulation,
    showNoResult,
    showResult,
    initSelectOptions
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

    describe('getRecommendUniqueValues & findOptimal', () => {
        it('正确去重提取推荐下拉属性选项', () => {
            const vals = getRecommendUniqueValues(weaponsData);
            expect(vals.basic.length).toBeGreaterThan(0);
            expect(vals.additional.length).toBeGreaterThan(0);
            expect(vals.skill.length).toBeGreaterThan(0);
            expect(vals.skill).toContain('强攻');
        });

        it('处理空列表', () => {
            const vals = getRecommendUniqueValues(null);
            expect(vals.basic.length).toBe(0);
            expect(vals.additional.length).toBe(0);
            expect(vals.skill).toEqual(['强攻']);
        });

        it('findOptimal 处理非法输入安全返回 null', () => {
            expect(findOptimal(null, null, null)).toBeNull();
            expect(findOptimal(weaponsData, null, defaultPresets[0])).toBeNull();
        });
    });

    describe('UI 与交互逻辑', () => {
        let mockElements;
        const origDocument = global.document;

        beforeEach(() => {
            mockElements = {
                comboBasic: { id: 'comboBasic', value: '', innerHTML: '' },
                comboAdditional: { id: 'comboAdditional', value: '', innerHTML: '' },
                comboSkill: { id: 'comboSkill', value: '', innerHTML: '' },
                simulateBtn: { id: 'simulateBtn', disabled: true, textContent: '' },
                resultPanel: { id: 'resultPanel', className: '', innerHTML: '', scrollIntoView() {} }
            };

            global.document = {
                getElementById: (id) => mockElements[id] || null,
                addEventListener: () => {}
            };
        });

        afterEach(() => {
            global.document = origDocument;
        });

        it('initSelectOptions 填充下拉框选项', () => {
            initSelectOptions();
            expect(mockElements.comboBasic.innerHTML).toContain('选择基础属性');
            expect(mockElements.comboAdditional.innerHTML).toContain('选择附加属性');
            expect(mockElements.comboSkill.innerHTML).toContain('选择技能属性');
        });

        it('validateInput 校验属性完整性并控制按钮状态', () => {
            mockElements.comboBasic.value = '力量';
            validateInput();
            expect(mockElements.simulateBtn.disabled).toBe(true);

            mockElements.comboAdditional.value = '暴击';
            mockElements.comboSkill.value = '粉碎';
            validateInput();
            expect(mockElements.simulateBtn.disabled).toBe(false);
            expect(mockElements.simulateBtn.textContent).toBe('开始计算');
        });

        it('showNoResult 渲染无匹配错误提示', () => {
            showNoResult({ basic: '未知1', additional: '未知2', skill: '未知3' });
            expect(mockElements.resultPanel.className).toContain('error');
            expect(mockElements.resultPanel.innerHTML).toContain('未找到符合条件的预设');
        });

        it('showResult 渲染推荐结果卡片', () => {
            const target = { basic: '力量', additional: '暴击', skill: '粉碎' };
            const best = findBestRecommendation(target, defaultPresets, weaponsData);
            showResult(best, target);
            expect(mockElements.resultPanel.className).toBe('result-panel show');
            expect(mockElements.resultPanel.innerHTML).toContain('破碎君王');
        });

        it('runSimulation 执行完整模拟流程', () => {
            mockElements.comboBasic.value = '力量';
            mockElements.comboAdditional.value = '暴击';
            mockElements.comboSkill.value = '粉碎';
            runSimulation();
            expect(mockElements.resultPanel.innerHTML).toContain('破碎君王');

            mockElements.comboBasic.value = '未知';
            runSimulation();
            expect(mockElements.resultPanel.className).toContain('error');
        });
    });
});
