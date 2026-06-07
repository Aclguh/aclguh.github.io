/**
 * 课程表文件解析模块
 * 支持 CSV（推荐，主格式）和 XLS/XLSX（辅助格式）
 */

/* ============================================
   常量定义
   ============================================ */

const TIME_SLOTS = [
    { label: '第一大节', time: '08:30-10:05', sections: '01,02节' },
    { label: '第二大节', time: '10:25-12:00', sections: '03,04节' },
    { label: '第三大节', time: '12:20-13:50', sections: '05,06节' },
    { label: '第四大节', time: '14:00-15:35', sections: '07,08节' },
    { label: '第五大节', time: '15:55-17:30', sections: '09,10节' },
    { label: '第六大节', time: '19:00-21:25', sections: '11,12,13节' },
];

const COURSE_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#F7DC6F', '#BB8FCE',
    '#85C1E9', '#F8C471', '#82E0AA', '#F1948A',
];

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/* ============================================
   统一入口：自动检测格式
   ============================================ */

/**
 * 解析导入文件（自动检测 CSV 或 XLS 格式）
 * @param {File} file
 * @returns {Promise<Object>} 课表数据
 */
function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
        return parseCSVFile(file);
    }
    if (ext === 'xls' || ext === 'xlsx') {
        return parseXLSFile(file);
    }
    return Promise.reject(new Error('不支持的文件格式：.' + ext));
}

/* ============================================
   CSV 解析（主格式）
   ============================================ */

/**
 * CSV 格式：
 *   课程名称,教师,星期,时间段,周次,地点
 *   高等数学,张三,1,1,1-16,J1-101
 *
 * 字段说明：
 *   - 星期: 1=周一 ~ 7=周日
 *   - 时间段: 1=第一大节 ~ 6=第六大节
 *   - 周次: 支持 "1-16"（范围）、"1,3,5"（列表）、"1-16单"（单周）、"2-16双"（双周）
 */
function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const text = e.target.result;

                // 检测 BOM 并跳过
                let content = text;
                if (content.charCodeAt(0) === 0xFEFF) {
                    content = content.slice(1);
                }

                const lines = content.split(/\r?\n/).filter(function (l) {
                    return l.trim();
                });

                if (lines.length < 2) {
                    throw new Error('CSV 文件为空或只有表头，请填写课程数据');
                }

                // 解析表头（跳过）
                var header = lines[0];
                var hasHeader = /课程|名称|教师|星期|时间|周次|地点/.test(header);

                var startLine = hasHeader ? 1 : 0;
                var courses = [];
                var parseErrors = [];

                for (var i = startLine; i < lines.length; i++) {
                    var fields = parseCSVLine(lines[i]);

                    if (fields.length < 5) {
                        parseErrors.push('第' + (i + 1) + '行：列数不足（需要至少5列）');
                        continue;
                    }

                    var name = (fields[0] || '').trim();
                    var teacher = (fields[1] || '').trim();
                    var dayStr = (fields[2] || '').trim();
                    var slotStr = (fields[3] || '').trim();
                    var weekStr = (fields[4] || '').trim();
                    var location = (fields[5] || '').trim();

                    // 验证必填字段
                    if (!name) {
                        parseErrors.push('第' + (i + 1) + '行：课程名称为空');
                        continue;
                    }

                    var dayOfWeek = parseInt(dayStr);
                    if (isNaN(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
                        parseErrors.push('第' + (i + 1) + '行：星期无效（应为1-7）');
                        continue;
                    }

                    var timeSlot = parseInt(slotStr);
                    if (isNaN(timeSlot) || timeSlot < 1 || timeSlot > 6) {
                        parseErrors.push('第' + (i + 1) + '行：时间段无效（应为1-6）');
                        continue;
                    }

                    var weeks = parseWeekString(weekStr);
                    if (weeks.length === 0) {
                        parseErrors.push('第' + (i + 1) + '行：周次格式无法解析（"' + weekStr + '"）');
                        continue;
                    }

                    courses.push({
                        name: name,
                        teacher: teacher,
                        dayOfWeek: dayOfWeek,
                        timeSlot: timeSlot - 1,  // 转为0-based索引
                        weeks: weeks,
                        location: location
                    });
                }

                if (courses.length === 0) {
                    var errMsg = '未解析到有效课程';
                    if (parseErrors.length > 0) {
                        errMsg += '\n' + parseErrors.slice(0, 5).join('\n');
                    }
                    throw new Error(errMsg);
                }

                // 计算总周数
                var totalWeeks = calculateTotalWeeks(courses);

                // 分配颜色
                assignColors(courses);

                resolve({
                    semester: '',
                    className: '',
                    major: '',
                    department: '',
                    totalWeeks: totalWeeks,
                    courses: courses
                });
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = function () {
            reject(new Error('文件读取失败'));
        };

        // CSV 用文本模式读取（UTF-8）
        reader.readAsText(file, 'UTF-8');
    });
}

/**
 * 解析一行 CSV（处理引号包裹的字段）
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
    var result = [];
    var current = '';
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
        var ch = line[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current);
    return result;
}

/**
 * 生成并下载 CSV 导入模板
 */
function downloadCSVTemplate() {
    var BOM = '﻿';
    var header = '课程名称,教师,星期,时间段,周次,地点';

    var examples = [
        '高等数学（上）,张三,1,1,1-16,J1-101多媒体教室',
        '大学英语（三）,李四,2,3,1-16单,J2-201',
        '计算机组成原理,王五,3,2,1,3,5,7,9,11,13,15,J3-C302',
        '体育（篮球）,赵六,4,5,1-16,体育馆篮球场',
        '马克思主义基本原理,刘七,5,4,2-16双,J1-A104',
        '数据库课程设计,陈八,1,6,10-18,实验楼B301',
    ];

    var csvContent = BOM + header + '\n' + examples.join('\n');

    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '课程表导入模板.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ============================================
   XLS/XLSX 解析（辅助格式）
   ============================================ */

function parseXLSFile(file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();

        reader.onload = function (e) {
            try {
                if (typeof XLSX === 'undefined') {
                    throw new Error('XLS 解析库未加载，请刷新后重试，或使用 CSV 格式导入');
                }

                var data = new Uint8Array(e.target.result);
                var workbook = XLSX.read(data, { type: 'array', codepage: 936 });
                var sheetName = workbook.SheetNames[0];
                var sheet = workbook.Sheets[sheetName];
                var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });

                if (!rows || rows.length < 3) {
                    throw new Error('文件格式不正确：行数不足');
                }

                var headerRow = rows[2];
                var hasDayHeaders = headerRow.some(function (cell) {
                    return typeof cell === 'string' && (cell.indexOf('周一') >= 0 || cell.indexOf('星期') >= 0);
                });
                if (!hasDayHeaders) {
                    throw new Error('文件格式不正确：未找到星期表头，请确认是教务系统导出的课表文件');
                }

                var semesterInfo = extractSemesterInfo(rows);
                var courses = parseCourseRows(rows);
                var totalWeeks = calculateTotalWeeks(courses);
                assignColors(courses);

                resolve({
                    semester: semesterInfo.semester,
                    className: semesterInfo.className,
                    major: semesterInfo.major,
                    department: semesterInfo.department,
                    totalWeeks: totalWeeks,
                    courses: courses
                });
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = function () {
            reject(new Error('文件读取失败'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/* ============================================
   XLS 解析辅助函数
   ============================================ */

function extractSemesterInfo(rows) {
    var info = { semester: '', className: '', major: '', department: '' };
    if (rows.length < 2) return info;

    var row1Text = rows[1]
        .map(function (cell) { return String(cell).trim(); })
        .filter(Boolean)
        .join(' ');

    if (!row1Text) return info;

    var semMatch = row1Text.match(/(\d{4}-\d{4}-\d)/);
    if (semMatch) info.semester = semMatch[1];

    var classMatch = row1Text.match(/班级[：:]\s*(\S+)/);
    if (classMatch) info.className = classMatch[1];

    var majorMatch = row1Text.match(/专业[：:]\s*(\S+)/);
    if (majorMatch) info.major = majorMatch[1];

    var deptMatch = row1Text.match(/院系[：:]\s*(\S+)/);
    if (deptMatch) info.department = deptMatch[1];

    return info;
}

function parseCourseRows(rows) {
    var courses = [];
    var dataStartRow = 3;
    var timeSlotCount = Math.min(6, rows.length - dataStartRow);

    for (var slot = 0; slot < timeSlotCount; slot++) {
        var row = rows[dataStartRow + slot];
        if (!row) continue;

        for (var dayCol = 1; dayCol <= 7 && dayCol < row.length; dayCol++) {
            var cellText = String(row[dayCol] || '').trim();
            if (!cellText) continue;

            var cellCourses = parseCellContent(cellText, dayCol, slot);
            courses.push.apply(courses, cellCourses);
        }
    }

    return courses;
}

function parseCellContent(text, dayOfWeek, timeSlot) {
    var courses = [];
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length === 0) return courses;

    var i = 0;
    while (i < lines.length) {
        var line = lines[i];

        // 跳过备注行
        if (line.indexOf('注意') === 0 || line.indexOf('说明') === 0 || line.indexOf('备注') === 0) {
            i++;
            continue;
        }

        var courseLines = [];
        var j = i;

        while (j < lines.length && courseLines.length < 4) {
            var candidate = lines[j];

            if (courseLines.length > 0 && isCourseNameLine(candidate) && courseLines.length >= 3) {
                break;
            }

            courseLines.push(candidate);
            j++;
        }

        if (courseLines.length >= 2) {
            var course = createCourseEntry(courseLines, dayOfWeek, timeSlot);
            if (course) courses.push(course);
        }

        i = j;
    }

    return courses;
}

function isCourseNameLine(line) {
    if (!line) return false;
    if (/^[\d（(,，]/.test(line)) return false;
    if (!/[一-龥]/.test(line)) return false;
    if (line.length > 50 && line.indexOf('（') >= 0 && line.indexOf('）') >= 0) return false;
    return true;
}

function createCourseEntry(lines, dayOfWeek, timeSlot) {
    var name = lines[0] || '未命名课程';
    if (name.length < 2 || name.length > 60) return null;

    var teacher = '';
    var weekStr = '';
    var location = '';

    if (lines.length >= 2) {
        if (isWeekString(lines[1])) {
            weekStr = lines[1];
            location = lines.length >= 3 ? lines[2] : '';
        } else {
            teacher = lines[1];
            weekStr = lines.length >= 3 ? lines[2] : '';
            location = lines.length >= 4 ? lines[3] : '';
        }
    }

    var weeks = parseWeekString(weekStr);

    return {
        name: name,
        teacher: teacher,
        dayOfWeek: dayOfWeek,
        timeSlot: timeSlot,
        weeks: weeks,
        location: location
    };
}

function isWeekString(str) {
    if (!str) return false;
    return /[\d,，\-、()（）[\[\]]/.test(str) && /[周单双击节]/.test(str);
}

/* ============================================
   周次解析（CSV 和 XLS 共用）
   ============================================ */

/**
 * 解析周次字符串
 * 支持格式：
 *   "1-16"         → [1..16]
 *   "1,3,5,7"      → [1,3,5,7]
 *   "1-16单"       → [1,3,5,7,9,11,13,15]
 *   "2-16双"       → [2,4,6,8,10,12,14,16]
 *   "1-16([周])[01-02节]" → [1..16]  (XLS格式)
 *   "3,5,7,9,11,13,15-16" → [3,5,7,9,11,13,15,16]
 */
function parseWeekString(str) {
    if (!str) return [];

    var weeks = new Set();

    // 提取周次部分：取第一个括号前的部分
    var weekPart = str.split(/[\[(（]/)[0].trim();
    if (!weekPart) return [];

    // 按逗号/中文逗号分割
    var parts = weekPart.split(/[,，、]/);

    for (var p = 0; p < parts.length; p++) {
        var trimmed = parts[p].trim();
        if (!trimmed) continue;

        if (trimmed.indexOf('-') >= 0) {
            var rangeParts = trimmed.split(/-/);
            var start = parseInt(rangeParts[0]);
            var end = parseInt(rangeParts[rangeParts.length - 1]);

            if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start && end <= 30) {
                for (var w = start; w <= end; w++) {
                    weeks.add(w);
                }
            }
        } else {
            var num = parseInt(trimmed);
            if (!isNaN(num) && num > 0 && num <= 30) {
                weeks.add(num);
            }
        }
    }

    // 处理单/双周标记
    var hasSingle = /[单奇]/.test(str);
    var hasDouble = /[双偶]/.test(str);

    if (hasSingle && !hasDouble) {
        weeks.forEach(function (w) { if (w % 2 === 0) weeks.delete(w); });
    } else if (hasDouble && !hasSingle) {
        weeks.forEach(function (w) { if (w % 2 !== 0) weeks.delete(w); });
    }

    return Array.from(weeks).sort(function (a, b) { return a - b; });
}

/* ============================================
   通用工具函数
   ============================================ */

function calculateTotalWeeks(courses) {
    var maxWeek = 20;
    for (var i = 0; i < courses.length; i++) {
        var c = courses[i];
        if (c.weeks && c.weeks.length > 0) {
            var courseMax = Math.max.apply(null, c.weeks);
            if (courseMax > maxWeek) maxWeek = courseMax;
        }
    }
    return maxWeek;
}

function assignColors(courses) {
    var colorMap = new Map();

    for (var i = 0; i < courses.length; i++) {
        var course = courses[i];

        if (!colorMap.has(course.name)) {
            var hash = 0;
            for (var j = 0; j < course.name.length; j++) {
                hash = ((hash << 5) - hash) + course.name.charCodeAt(j);
                hash |= 0;
            }
            var colorIndex = Math.abs(hash) % COURSE_COLORS.length;
            colorMap.set(course.name, {
                color: COURSE_COLORS[colorIndex],
                colorIndex: colorIndex
            });
        }

        var mapping = colorMap.get(course.name);
        course.color = mapping.color;
        course.colorIndex = mapping.colorIndex;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
