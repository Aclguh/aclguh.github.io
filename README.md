# Aclguh's Workspace (aclguh.github.io)

个人纯前端工具箱与微游戏集合，基于 GitHub Pages 静态托管，具备现代化工程规范、原生零依赖单元测试与 PWA 离线支持。

🔗 **线上访问入口**：[https://aclguh.github.io](https://aclguh.github.io)

---

## 🛠️ 工具与游戏列表

### 活跃小工具与游戏
1. **[看番记录网页](anime-record/index.html)**：追番进度管理、多维筛选标签、触摸长按拖拽排序、JSON 数据导入导出。
2. **[体重记录网页](weightRecord/index.html)**：体重与 BMI 追踪、多区间统计、趋势折线图与 K 线图（内置 Chart.js 本地容灾）。
3. **[舒尔特方格](schulte-grid/index.html)**：专注力训练，支持 3~7 阶自选网格与历史成绩榜单。
4. **[天国骰子](farkle/index.html)**：《天国：拯救》酒馆骰子算法复刻、徽章机制与人机智能对战。

### 其他实用工具与游戏
5. **[课程表](class-schedule/index.html)**：高校周课表与日课表视图，支持 CSV 模板导入与智能节次渲染。
6. **[小番茄图片混淆](imageObfuscation/index.html)**：基于 Gilbert 空间填充曲线的像素级混淆与逆变换（已集成 Web Worker 多线程计算）。
7. **[本格将棋](shogi/index.html)**：日本将棋规则引擎、持驹打入、成金判定与 Minimax 搜索 AI。
8. **[经典斗地主](doudizhu/index.html)**：三人斗地主单机对战、标准牌型状态机与启发式出牌 AI。
9. **[终末地武器库](ark_end/all_weapons/index.html)**：终末地武器属性与基质多条件过滤查询。
10. **[终末地基质刷取推荐](ark_end/weapons_recommend/index.html)**：副本刷取收益方案与武器匹配推荐。

---

## 🏗️ 架构与公共层 (`shared/`)

项目采用轻量多页静态架构（MPA），所有核心公共能力统一抽象于 `shared/` 目录：
- **`shared/js/security.js`**：统一防 XSS 与 HTML/属性安全转义器 (`escapeHtml`, `escapeAttr`)。
- **`shared/js/storage.js`**：`SafeStorage` 本地存储包装器，解决隐私模式与 `QuotaExceededError` 配额溢出。
- **`shared/js/theme.js`**：统一深浅色主题管理器，支持系统偏好监听与跨页面同步。
- **`shared/data/weapons.js`**：终末地武器单一真实数据源（SSOT），消除多页面冗余。
- **`shared/vendor/`**：第三方核心库本地化镜像（Chart.js 等），杜绝外链 CDN 单点故障。

---

## 🧪 自动化测试

项目基于 Node.js 原生测试体系构建了零依赖的自动化测试网：

```bash
# 运行全部 50 个单元测试
npm test

# 运行代码测试覆盖率
npm run test:coverage
```

测试套件涵盖：
- `tests/shared/security.test.js`：安全转义与属性注入防御
- `tests/shared/storage.test.js`：SafeStorage 存取与容错
- `tests/farkle/scoring.test.js`：天国骰子点数与徽章计分引擎
- `tests/doudizhu/cards.test.js`：斗地主牌型识别与压牌规则
- `tests/class-schedule/parser.test.js`：课程表 CSV 解析与单双周规则
- `tests/shogi/engine.test.js`：将棋走法生成、二步禁手与 AI 搜索

---

## 🚀 持续集成 (CI/CD)

- 仓库配置了 GitHub Actions 流水线（`.github/workflows/ci.yml`），在每次代码提交与 PR 时自动执行所有单元测试。
- 全站配置了 `manifest.json` 与 Service Worker（`sw.js`），支持 Stale-While-Revalidate 静态资源加速与无网离线访问。

