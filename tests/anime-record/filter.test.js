const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');
const { STATUS, WEEK, AIR_STATUS, SORT_OPTIONS } = require('../../anime-record/js/models.js');
const {
    countRecordsByWeek,
    getStatusFilteredRecords,
    getActiveWeekFilter,
    setActiveWeekFilter,
    renderWeekFilter,
    formatUpdatedAt,
    formatShortDate,
    formatFullDateTime,
    sortRecords,
    createBadgesHTML,
    createEpisodeInfoHTML,
    createEpButtonHTML,
    createCardHTML,
    escapeHTML,
    renderStats,
    renderCards,
    getFilteredAndSortedRecords,
    iconLabel
} = require('../../anime-record/js/ui.js');

describe('Anime Record Filter Module', () => {
    const mockRecords = [
        { id: '1', titleZh: '番剧A', status: STATUS.WATCHED, week: WEEK.MON },
        { id: '2', titleZh: '番剧B', status: STATUS.WATCHED, week: WEEK.MON },
        { id: '3', titleZh: '番剧C', status: STATUS.WATCHING, week: WEEK.TUE },
        { id: '4', titleZh: '番剧D', status: STATUS.WANT_TO_WATCH, week: WEEK.FRI },
        { id: '5', titleZh: '番剧E', status: STATUS.WATCHING, week: '' }
    ];

    describe('countRecordsByWeek', () => {
        it('正确统计包含有效 week 的记录数量', () => {
            const counts = countRecordsByWeek(mockRecords);
            expect(counts[WEEK.MON]).toBe(2);
            expect(counts[WEEK.TUE]).toBe(1);
            expect(counts[WEEK.FRI]).toBe(1);
            expect(counts[WEEK.WED]).toBe(undefined);
        });

        it('空列表返回空对象', () => {
            const counts = countRecordsByWeek([]);
            expect(Object.keys(counts).length).toBe(0);
        });
    });

    describe('getStatusFilteredRecords & 顶部筛选与更新日联动', () => {
        it('全部状态下：应包含所有记录并统计全部周几', () => {
            const records = getStatusFilteredRecords(mockRecords, 'all');
            expect(records.length).toBe(5);

            const counts = countRecordsByWeek(records);
            expect(counts[WEEK.MON]).toBe(2);
            expect(counts[WEEK.TUE]).toBe(1);
            expect(counts[WEEK.FRI]).toBe(1);
        });

        it('在看状态下：全部番剧有两部是周一但都是看过的，在看界面不应统计周一（不显示周一）', () => {
            const watchingRecords = getStatusFilteredRecords(mockRecords, STATUS.WATCHING);
            expect(watchingRecords.length).toBe(2);

            const counts = countRecordsByWeek(watchingRecords);
            // 周一全部为看过，在看状态下周一计数应不存在（不显示周一2）
            expect(counts[WEEK.MON]).toBe(undefined);
            // 仅显示在看的周二
            expect(counts[WEEK.TUE]).toBe(1);
        });

        it('看过状态下：应统计周一为 2，且不包含周二与周五', () => {
            const watchedRecords = getStatusFilteredRecords(mockRecords, STATUS.WATCHED);
            expect(watchedRecords.length).toBe(2);

            const counts = countRecordsByWeek(watchedRecords);
            expect(counts[WEEK.MON]).toBe(2);
            expect(counts[WEEK.TUE]).toBe(undefined);
            expect(counts[WEEK.FRI]).toBe(undefined);
        });

        it('想看状态下：应统计周五为 1，不显示周一和周二', () => {
            const wantRecords = getStatusFilteredRecords(mockRecords, STATUS.WANT_TO_WATCH);
            expect(wantRecords.length).toBe(1);

            const counts = countRecordsByWeek(wantRecords);
            expect(counts[WEEK.MON]).toBe(undefined);
            expect(counts[WEEK.TUE]).toBe(undefined);
            expect(counts[WEEK.FRI]).toBe(1);
        });

        it('搁置状态下无记录：更新日统计应为空', () => {
            const holdRecords = getStatusFilteredRecords(mockRecords, STATUS.ON_HOLD);
            expect(holdRecords.length).toBe(0);

            const counts = countRecordsByWeek(holdRecords);
            expect(Object.keys(counts).length).toBe(0);
        });
    });

    describe('activeWeekFilter 状态管理', () => {
        it('正确获取与设置选中的周几筛选', () => {
            setActiveWeekFilter(WEEK.MON);
            expect(getActiveWeekFilter()).toBe(WEEK.MON);
            setActiveWeekFilter('');
            expect(getActiveWeekFilter()).toBe('');
            setActiveWeekFilter(null);
            expect(getActiveWeekFilter()).toBe('');
        });
    });

    describe('formatUpdatedAt 与日期格式化', () => {
        it('空值或非法时间安全返回空串', () => {
            expect(formatUpdatedAt('')).toBe('');
            expect(formatUpdatedAt(null)).toBe('');
            expect(formatUpdatedAt('invalid-date')).toBe('');
        });

        it('1分钟内返回刚刚', () => {
            const nowIso = new Date().toISOString();
            expect(formatUpdatedAt(nowIso)).toBe('刚刚');
        });

        it('未来时间按时钟偏差处理为刚刚', () => {
            const future = new Date(Date.now() + 10000).toISOString();
            expect(formatUpdatedAt(future)).toBe('刚刚');
        });

        it('半小时前返回具体分钟前', () => {
            const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            expect(formatUpdatedAt(halfHourAgo)).toBe('30分钟前');
        });

        it('3小时前返回具体小时前', () => {
            const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
            expect(formatUpdatedAt(threeHoursAgo)).toBe('3小时前');
        });

        it('2天前返回具体天前', () => {
            const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
            expect(formatUpdatedAt(twoDaysAgo)).toBe('2天前');
        });

        it('formatShortDate 与 formatFullDateTime 正确输出', () => {
            const d = new Date('2026-05-20T13:14:00Z');
            expect(formatShortDate(d)).toContain('5月20日');
            expect(formatFullDateTime('2026-05-20T13:14:00Z')).toContain('2026');
            expect(formatFullDateTime(null)).toBe('');
        });
    });

    describe('sortRecords 记录排序', () => {
        const recordsToSort = [
            { id: '1', titleZh: 'B番剧', createdAt: '2026-01-01', episodesWatched: 5, episodesTotal: 12 },
            { id: '2', titleZh: 'A番剧', createdAt: '2026-02-01', episodesWatched: 12, episodesTotal: 12 },
            { id: '3', titleZh: 'C番剧', createdAt: '2026-01-15', episodesWatched: 0, episodesTotal: 12 }
        ];

        it('按创建时间降序排序', () => {
            const res = sortRecords(recordsToSort, SORT_OPTIONS.DATE_ADDED_DESC);
            expect(res[0].id).toBe('2');
            expect(res[1].id).toBe('3');
            expect(res[2].id).toBe('1');
        });

        it('按中文标题升序排序', () => {
            const res = sortRecords(recordsToSort, SORT_OPTIONS.TITLE_ZH_ASC);
            expect(res[0].id).toBe('2'); // A番剧
            expect(res[1].id).toBe('1'); // B番剧
            expect(res[2].id).toBe('3'); // C番剧
        });

        it('按剩余未看集数排序', () => {
            const res = sortRecords(recordsToSort, SORT_OPTIONS.EPISODES_LEFT);
            expect(res[0].id).toBe('2'); // 剩0集
            expect(res[1].id).toBe('1'); // 剩7集
            expect(res[2].id).toBe('3'); // 剩12集
        });
    });

    describe('HTML 模板生成 (createBadgesHTML, createCardHTML 等)', () => {
        const sampleRecord = {
            id: 'rec-1',
            titleZh: '进击的巨人<Final>',
            titleJa: '進撃の巨人',
            status: STATUS.WATCHING,
            week: WEEK.SUN,
            airStatus: AIR_STATUS.AIRING,
            episodesWatched: 10,
            episodesTotal: 12,
            updatedAt: new Date().toISOString()
        };

        it('createBadgesHTML 生成正确的状态徽章', () => {
            const html = createBadgesHTML(sampleRecord);
            expect(html).toContain('badge');
            expect(html).toContain('周日');
            expect(html).toContain('正在更新');
        });

        it('createEpisodeInfoHTML 生成集数进度', () => {
            const html = createEpisodeInfoHTML(sampleRecord);
            expect(html).toContain('10');
            expect(html).toContain('12');
            expect(html).toContain('剩 2 集');
        });

        it('createEpButtonHTML 为追完状态渲染已追完', () => {
            const completed = { ...sampleRecord, status: STATUS.WATCHED, episodesWatched: 12 };
            const btnHtml = createEpButtonHTML(completed);
            expect(btnHtml).toContain('completed');
            expect(btnHtml).toContain('disabled');
        });

        it('createCardHTML 生成包含安全转义的卡片 HTML', () => {
            const cardHtml = createCardHTML(sampleRecord);
            expect(cardHtml).toContain('rec-1');
            expect(cardHtml).toContain('进击的巨人&lt;Final&gt;');
            expect(cardHtml).toContain('進撃の巨人');
            expect(cardHtml).toContain('data-action="edit"');
            expect(cardHtml).toContain('data-action="delete"');
        });

        it('escapeHTML 内部转义逻辑验证', () => {
            expect(escapeHTML('<script>"\'&')).toBe('&lt;script&gt;&quot;&#39;&amp;');
            expect(escapeHTML(null)).toBe('');
        });
    });

    describe('UI 渲染与统计 (renderStats, renderCards, getFilteredAndSortedRecords)', () => {
        let mockElements;
        const origDocument = global.document;

        const testRecord = {
            id: 'rec-1',
            titleZh: '进击的巨人<Final>',
            titleJa: '進撃の巨人',
            status: STATUS.WATCHING,
            week: WEEK.SUN,
            airStatus: AIR_STATUS.AIRING,
            episodesWatched: 10,
            episodesTotal: 12,
            updatedAt: new Date().toISOString()
        };

        function makeElement(id) {
            const classList = new Set();
            return {
                id,
                value: '',
                innerHTML: '',
                textContent: '',
                dataset: {},
                classList: {
                    add: (c) => classList.add(c),
                    remove: (c) => classList.delete(c),
                    contains: (c) => classList.has(c)
                }
            };
        }

        beforeEach(() => {
            mockElements = {
                'stats-bar': makeElement('stats-bar'),
                'anime-grid': makeElement('anime-grid'),
                'empty-state': makeElement('empty-state'),
                'empty-message': makeElement('empty-message'),
                'load-more': makeElement('load-more'),
                'search-input': makeElement('search-input'),
                'sort-select': makeElement('sort-select'),
                'week-filter': makeElement('week-filter')
            };

            global.document = {
                getElementById: (id) => mockElements[id] || null,
                querySelector: () => makeElement('mock-btn')
            };
        });

        afterEach(() => {
            global.document = origDocument;
        });

        it('iconLabel 生成包含图标与文本的 HTML', () => {
            const res = iconLabel('calendar', '测试日历');
            expect(res).toContain('测试日历');
            expect(res).toContain('<svg');
        });

        it('renderStats 渲染统计概览并更新计数', () => {
            renderStats([testRecord]);
            expect(mockElements['stats-bar'].innerHTML).toContain('共收录');
            expect(mockElements['stats-bar'].innerHTML).toContain('集已观看');
        });

        it('renderCards 正常渲染非空卡片列表与隐藏空状态', () => {
            renderCards([testRecord]);
            expect(mockElements['anime-grid'].innerHTML).toContain('rec-1');
            expect(mockElements['empty-state'].classList.contains('hidden')).toBe(true);
        });

        it('renderCards 渲染空列表时展示空提示', () => {
            renderCards([]);
            expect(mockElements['anime-grid'].innerHTML).toBe('');
            expect(mockElements['empty-state'].classList.contains('hidden')).toBe(false);
        });

        it('getFilteredAndSortedRecords 支持关键词过滤', () => {
            mockElements['search-input'].value = '巨人';
            const records = getFilteredAndSortedRecords();
            expect(Array.isArray(records)).toBe(true);
        });

        it('renderWeekFilter 渲染星期过滤组件', () => {
            renderWeekFilter();
            expect(mockElements['week-filter']).toBeDefined();
        });
    });
});
