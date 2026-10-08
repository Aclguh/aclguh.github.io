const { describe, it, expect } = require('../test-utils.js');
const { STATUS, WEEK } = require('../../anime-record/js/models.js');
const { countRecordsByWeek, getStatusFilteredRecords } = require('../../anime-record/js/ui.js');

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
});
