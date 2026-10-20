const { describe, it, expect } = require('../test-utils.js');
const {
    parseCSVLine,
    parseWeekString,
    assignColors,
    generateId,
    COURSE_COLORS,
    parseCSVContent,
    extractSemesterInfo,
    parseCourseRows,
    parseCellContent,
    isCourseNameLine,
    calculateTotalWeeks
} = require('../../class-schedule/js/parser.js');

describe('Class Schedule Parser', () => {
    describe('parseCSVLine', () => {
        it('parses unquoted comma-separated line', () => {
            const line = '高等数学,张三,1,1,1-16,J1-101';
            const fields = parseCSVLine(line);
            expect(fields).toEqual(['高等数学', '张三', '1', '1', '1-16', 'J1-101']);
        });

        it('parses quoted fields with commas inside', () => {
            const line = '计算机组成原理,王五,3,2,"1,3,5,7,9",J3-C302';
            const fields = parseCSVLine(line);
            expect(fields).toEqual(['计算机组成原理', '王五', '3', '2', '1,3,5,7,9', 'J3-C302']);
        });

        it('handles escaped quotes within quoted field', () => {
            const line = '"He said ""hello""",teacher,1,1,1-10,room';
            const fields = parseCSVLine(line);
            expect(fields[0]).toBe('He said "hello"');
        });
    });

    describe('parseWeekString', () => {
        it('parses simple range', () => {
            const weeks = parseWeekString('1-5');
            expect(weeks).toEqual([1, 2, 3, 4, 5]);
        });

        it('parses comma-separated weeks', () => {
            const weeks = parseWeekString('1, 3, 5, 8');
            expect(weeks).toEqual([1, 3, 5, 8]);
        });

        it('filters odd weeks (单周)', () => {
            const weeks = parseWeekString('1-6单');
            expect(weeks).toEqual([1, 3, 5]);
        });

        it('filters even weeks (双周)', () => {
            const weeks = parseWeekString('1-6双');
            expect(weeks).toEqual([2, 4, 6]);
        });

        it('parses XLS style strings with brackets', () => {
            const weeks = parseWeekString('1-4([周])[01-02节]');
            expect(weeks).toEqual([1, 2, 3, 4]);
        });

        it('returns empty array for invalid inputs', () => {
            expect(parseWeekString('')).toEqual([]);
            expect(parseWeekString(null)).toEqual([]);
            expect(parseWeekString('abc')).toEqual([]);
        });
    });

    describe('assignColors and generateId', () => {
        it('assigns consistent colors to same course names', () => {
            const courses = [{ name: '高等数学' }, { name: '大学物理' }, { name: '高等数学' }];
            assignColors(courses);
            expect(courses[0].color).toBe(courses[2].color);
            expect(COURSE_COLORS).toContain(courses[0].color);
            expect(COURSE_COLORS).toContain(courses[1].color);
        });

        it('generates non-empty unique ids', () => {
            const id1 = generateId();
            const id2 = generateId();
            expect(typeof id1).toBe('string');
            expect(id1.length).toBeGreaterThan(5);
            expect(id1).not.toBe(id2);
        });
    });

    describe('parseCSVContent', () => {
        it('parses full standard CSV content with BOM and comments', () => {
            const csv =
                '\uFEFF课程名称,教师,星期,时间段,周次,地点\n' +
                '# 这是注释行说明\n' +
                '高等数学,李四,1,1,1-16,J1-101\n' +
                '线性代数,张三,2,3,2-16双,J2-202\n';

            const res = parseCSVContent(csv);
            expect(res.courses.length).toBe(2);
            expect(res.courses[0].name).toBe('高等数学');
            expect(res.courses[0].dayOfWeek).toBe(1);
            expect(res.courses[0].timeSlot).toBe(0); // 0-based
            expect(res.courses[0].weeks.length).toBe(16);
            expect(res.courses[1].name).toBe('线性代数');
            expect(res.courses[1].timeSlot).toBe(2);
            expect(res.maxSlot).toBe(3);
            expect(res.totalWeeks).toBe(20);
        });

        it('throws error on empty or header-only CSV', () => {
            expect(() => parseCSVContent('')).toThrow();
            expect(() => parseCSVContent('课程名称,教师,星期,时间段,周次,地点')).toThrow();
        });

        it('throws descriptive error on invalid course rows', () => {
            const invalidCsv = '课程名称,教师,星期,时间段,周次,地点\n,李四,1,1,1-16,地点\n';
            expect(() => parseCSVContent(invalidCsv)).toThrow();
        });
    });

    describe('extractSemesterInfo', () => {
        it('extracts semester, class, major, and department from academic table headers', () => {
            const rows = [
                ['课表标题'],
                [
                    '学期: 2026-2027-1',
                    '班级：计算机2201班',
                    '专业：计算机科学与技术',
                    '院系：信息工程学院',
                    '打印日期: 2026-09-01'
                ]
            ];
            const info = extractSemesterInfo(rows);
            expect(info.semester).toBe('2026-2027-1');
            expect(info.className).toBe('计算机2201班');
            expect(info.major).toBe('计算机科学与技术');
            expect(info.department).toBe('信息工程学院');
        });

        it('returns empty fields on empty or short rows', () => {
            const info = extractSemesterInfo([]);
            expect(info.semester).toBe('');
            expect(info.className).toBe('');
        });
    });

    describe('parseCellContent & isCourseNameLine & parseCourseRows', () => {
        it('recognizes valid course name lines and rejects numbers or symbols', () => {
            expect(isCourseNameLine('高等数学')).toBe(true);
            expect(isCourseNameLine('1-16周')).toBe(false);
            expect(isCourseNameLine('(单周)')).toBe(false);
            expect(isCourseNameLine('')).toBe(false);
        });

        it('parses multiline cell text into course entries and skips notes', () => {
            const cell = '数据结构\n王老师\n1-16([周])[01-02节]\n注意：请携带实验手册';
            const courses = parseCellContent(cell, 3, 1);
            expect(courses.length).toBe(1);
            expect(courses[0].name).toBe('数据结构');
            expect(courses[0].teacher).toBe('王老师');
            expect(courses[0].dayOfWeek).toBe(3);
            expect(courses[0].timeSlot).toBe(1);
        });

        it('parses full table rows correctly', () => {
            const rows = [
                [''],
                ['学期: 2026-2027-1'],
                ['节次', '周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                ['第1大节', '离散数学\n张老师\n1-8([周])[01-02节]', '', '', '', '', '', '']
            ];
            const parsed = parseCourseRows(rows);
            expect(parsed.slotCount).toBe(1);
            expect(parsed.courses.length).toBe(1);
            expect(parsed.courses[0].name).toBe('离散数学');
        });

        it('calculates total weeks accurately (minimum 20 weeks floor)', () => {
            const courses1 = [{ weeks: [1, 2, 8] }, { weeks: [5, 12, 18] }];
            expect(calculateTotalWeeks(courses1)).toBe(20);

            const courses2 = [{ weeks: [1, 2, 8] }, { weeks: [5, 12, 24] }];
            expect(calculateTotalWeeks(courses2)).toBe(24);
        });
    });
});
