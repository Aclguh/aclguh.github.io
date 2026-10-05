const { describe, it, expect } = require('../test-utils.js');
const {
    parseCSVLine, parseWeekString, assignColors, generateId, COURSE_COLORS
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
            const courses = [
                { name: '高等数学' },
                { name: '大学物理' },
                { name: '高等数学' }
            ];
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
});
