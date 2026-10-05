/**
 * 终末地武器库与基质数据（单一事实来源 SSOT）
 */

const weaponsData = [
    { name: "骑士精神", basic: "意志", additional: "生命", skill: "医疗", type: "施术单元", star: 6 },
    { name: "遗忘", basic: "智识", additional: "法术", skill: "夜幕", type: "施术单元", star: 6 },
    { name: "爆破单元", basic: "主能力", additional: "源石技艺", skill: "迸发", type: "施术单元", star: 6 },
    { name: "作品：蚀迹", basic: "意志", additional: "自然", skill: "压制", type: "施术单元", star: 6 },
    { name: "沧溟星梦", basic: "智识", additional: "治疗", skill: "附术", type: "施术单元", star: 6 },
    { name: "使命必达", basic: "意志", additional: "充能", skill: "追袭", type: "施术单元", star: 6 },
    { name: "O.B.J.术识", basic: "智识", additional: "源石技艺", skill: "追袭", type: "施术单元", star: 5 },
    { name: "布道自由", basic: "意志", additional: "治疗", skill: "医疗", type: "施术单元", star: 5 },
    { name: "迷失荒野", basic: "智识", additional: "电磁", skill: "附术", type: "施术单元", star: 5 },
    { name: "莫奈何", basic: "意志", additional: "充能", skill: "昂扬", type: "施术单元", star: 5 },
    { name: "悼亡诗", basic: "智识", additional: "攻击", skill: "夜幕", type: "施术单元", star: 5 },
    { name: "同类相食", basic: "主能力", additional: "法术", skill: "附术", type: "手铳", star: 6 },
    { name: "楔子", basic: "主能力", additional: "暴击", skill: "附术", type: "手铳", star: 6 },
    { name: "领航者", basic: "主能力", additional: "充能", skill: "附术", type: "手铳", star: 6 },
    { name: "艺术暴君", basic: "智识", additional: "暴击", skill: "切骨", type: "手铳", star: 6 },
    { name: "理性告别", basic: "力量", additional: "灼热", skill: "追袭", type: "手铳", star: 5 },
    { name: "O.B.J.迅极", basic: "敏捷", additional: "充能", skill: "迸发", type: "手铳", star: 5 },
    { name: "作品：众生", basic: "敏捷", additional: "法术", skill: "附术", type: "手铳", star: 5 },
    { name: "J.E.T.", basic: "意志", additional: "攻击", skill: "压制", type: "长柄武器", star: 6 },
    { name: "骁勇", basic: "敏捷", additional: "物理", skill: "巧技", type: "长柄武器", star: 6 },
    { name: "负山", basic: "敏捷", additional: "物理", skill: "效益", type: "长柄武器", star: 6 },
    { name: "向心之引", basic: "意志", additional: "电磁", skill: "压制", type: "长柄武器", star: 5 },
    { name: "O.B.J.尖峰", basic: "意志", additional: "物理", skill: "附术", type: "长柄武器", star: 5 },
    { name: "嵌合正义", basic: "力量", additional: "充能", skill: "残暴", type: "长柄武器", star: 5 },
    { name: "破碎君王", basic: "力量", additional: "暴击", skill: "粉碎", type: "双手剑", star: 6 },
    { name: "昔日精品", basic: "意志", additional: "生命", skill: "效益", type: "双手剑", star: 6 },
    { name: "典范", basic: "主能力", additional: "攻击", skill: "压制", type: "双手剑", star: 6 },
    { name: "赫拉芬格", basic: "力量", additional: "攻击", skill: "迸发", type: "双手剑", star: 6 },
    { name: "大雷斑", basic: "力量", additional: "生命", skill: "医疗", type: "双手剑", star: 6 },
    { name: "O.B.J.重荷", basic: "力量", additional: "生命", skill: "效益", type: "双手剑", star: 5 },
    { name: "终点之声", basic: "力量", additional: "生命", skill: "医疗", type: "双手剑", star: 5 },
    { name: "古渠", basic: "力量", additional: "源石技艺", skill: "残暴", type: "双手剑", star: 5 },
    { name: "探骊", basic: "力量", additional: "充能", skill: "迸发", type: "双手剑", star: 5 },
    { name: "白夜新星", basic: "主能力", additional: "源石技艺", skill: "附术", type: "单手剑", star: 6 },
    { name: "显赫声名", basic: "敏捷", additional: "物理", skill: "残暴", type: "单手剑", star: 6 },
    { name: "热熔切割器", basic: "意志", additional: "攻击", skill: "流转", type: "单手剑", star: 6 },
    { name: "扶摇", basic: "主能力", additional: "暴击", skill: "夜幕", type: "单手剑", star: 6 },
    { name: "黯色火炬", basic: "智识", additional: "灼热", skill: "附术", type: "单手剑", star: 6 },
    { name: "熔铸火焰", basic: "智识", additional: "攻击", skill: "夜幕", type: "单手剑", star: 6 },
    { name: "不知归", basic: "意志", additional: "攻击", skill: "流转", type: "单手剑", star: 6 },
    { name: "宏愿", basic: "敏捷", additional: "攻击", skill: "附术", type: "单手剑", star: 6 },
    { name: "仰止", basic: "敏捷", additional: "物理", skill: "夜幕", type: "单手剑", star: 5 },
    { name: "O.B.J.轻芒", basic: "敏捷", additional: "攻击", skill: "流转", type: "单手剑", star: 5 },
    { name: "十二问", basic: "敏捷", additional: "攻击", skill: "附术", type: "单手剑", star: 5 },
    { name: "逐鳞3.0", basic: "力量", additional: "寒冷", skill: "压制", type: "单手剑", star: 5 },
    { name: "坚城铸造者", basic: "智识", additional: "充能", skill: "昂扬", type: "单手剑", star: 5 },
    { name: "钢铁余音", basic: "敏捷", additional: "物理", skill: "巧技", type: "单手剑", star: 5 }
];

if (typeof window !== 'undefined') {
    window.weaponsData = weaponsData;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { weaponsData };
}
