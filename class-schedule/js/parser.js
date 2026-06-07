/**
 * XLS 文件解析模块
 * 使用 SheetJS 库解析 .xls 格式的课程表文件
 */

/**
 * 时间段定义（对应 xls 中的6个单元）
 */
const TIME_SLOTS = [
    { label: '第一大节', time: '08:30-10:05', sections: '01,02节' },
    { label: '第二大节', time: '10:25-12:00', sections: '03,04节' },
    { label: '第三大节', time: '12:20-13:50', sections: '05,06节' },
    { label: '第四大节', time: '14:00-15:35', sections: '07,08节' },
    { label: '第五大节', time: '15:55-17:30', sections: '09,10节' },
    { label: '第六大节', time: '19:00-21:25', sections: '11,12,13节' },
];

/**
 * 课程色板（12种柔和颜色）
 */
const COURSE_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#F7DC6F', '#BB8FCE',
    '#85C1E9', '#F8C471', '#82E0AA', '#F1948A',
];

/**
 * 星期名称映射
 */
const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 解析 .xls 或 .xlsx 文件
 * @param {File} file - 用户选择的文件
 * @returns {Promise<Object>} 解析后的课表数据
 */
function parseXLSFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);

                // 使用 SheetJS 解析，codepage 936 = GBK 编码
                const workbook = XLSX.read(data, {
                    type: 'array',
                    codepage: 936
                });

                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // 转换为二维数组
                const rows = XLSX.utils.sheet_to_json(sheet, {
                    header: 1,
                    defval: '',
                    blankrows: false
                });

                if (!rows || rows.length < 3) {
                    throw new Error('文件格式不正确：行数不足，请检查是否为标准课表文件');
                }

                // 验证表头格式（Row 2 应包含星期）
                const headerRow = rows[2];
                const hasDayHeaders = headerRow.some(cell =>
                    typeof cell === 'string' && (cell.includes('周一') || cell.includes('星期'))
                );
                if (!hasDayHeaders) {
                    throw new Error('文件格式不正确：未找到星期表头，请检查文件');
                }

                // 解析学期信息
                const semesterInfo = extractSemesterInfo(rows);

                // 解析课程数据
                const courses = parseCourseRows(rows);

                // 计算总周数
                const totalWeeks = calculateTotalWeeks(courses);

                // 为课程分配颜色
                assignColors(courses);

                const result = {
                    semester: semesterInfo.semester,
                    className: semesterInfo.className,
                    major: semesterInfo.major,
                    department: semesterInfo.department,
                    totalWeeks: totalWeeks,
                    courses: courses
                };

                resolve(result);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = function () {
            reject(new Error('文件读取失败，请重试'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * 从第1行提取学期信息
 * @param {Array} rows
 * @returns {Object} { semester, className, major, department }
 */
function extractSemesterInfo(rows) {
    const info = {
        semester: '未知学期',
        className: '未知班级',
        major: '',
        department: ''
    };

    if (rows.length < 2) return info;

    // Row 1 包含学期/班级/专业/院系信息（可能在多个单元格中）
    const row1Text = rows[1]
        .map(cell => String(cell).trim())
        .filter(Boolean)
        .join(' ');

    if (!row1Text) {
        // 尝试从 Row 0 获取部分信息
        const row0Text = String(rows[0][0] || '').trim();
        if (row0Text) {
            info.semester = row0Text;
        }
        return info;
    }

    // 提取学期（如：2025-2026-2）
    const semMatch = row1Text.match(/(\d{4}-\d{4}-\d)/);
    if (semMatch) {
        info.semester = semMatch[1];
    }

    // 提取班级
    const classMatch = row1Text.match(/班级[：:]\s*(\S+)/);
    if (classMatch) {
        info.className = classMatch[1];
    }

    // 提取专业
    const majorMatch = row1Text.match(/专业[：:]\s*(\S+)/);
    if (majorMatch) {
        info.major = majorMatch[1];
    }

    // 提取院系
    const deptMatch = row1Text.match(/院系[：:]\s*(\S+)/);
    if (deptMatch) {
        info.department = deptMatch[1];
    }

    return info;
}

/**
 * 解析课程行（Rows 3-8 为6个时间段）
 * @param {Array} rows
 * @returns {Array} 课程对象数组
 */
function parseCourseRows(rows) {
    const courses = [];
    const dataStartRow = 3; // 第3行开始是时间段数据
    const timeSlotCount = Math.min(6, rows.length - dataStartRow);

    for (let slot = 0; slot < timeSlotCount; slot++) {
        const row = rows[dataStartRow + slot];
        if (!row) continue;

        // 列0是时间标签，列1-7是周一到周日（共8列）
        for (let dayCol = 1; dayCol <= 7 && dayCol < row.length; dayCol++) {
            const cellText = String(row[dayCol] || '').trim();
            if (!cellText) continue;

            // 解析单元格内的课程条目
            const cellCourses = parseCellContent(cellText, dayCol, slot);
            courses.push(...cellCourses);
        }
    }

    // 尝试解析 Row 9（备注行）中的额外课程
    if (rows.length > 9) {
        const noteRow = rows[9];
        if (noteRow) {
            for (let dayCol = 1; dayCol <= 7 && dayCol < noteRow.length; dayCol++) {
                const cellText = String(noteRow[dayCol] || '').trim();
                if (!cellText) continue;

                // 备注行可能包含特殊格式的课程信息
                const cellCourses = parseCellContent(cellText, dayCol, -1);
                if (cellCourses.length > 0) {
                    // 尝试为这些课程分配合适的时间段
                    // 备注行通常没有明确的时间段，跳过或特殊处理
                    // 暂时跳过，避免显示混乱
                }
            }
        }
    }

    return courses;
}

/**
 * 解析单个单元格内容为课程数组
 * 单元格格式：每门课程4行（课程名、教师、周次、教室），课程间用空行分隔
 * @param {string} text - 单元格文本
 * @param {number} dayOfWeek - 星期几 (1-7)
 * @param {number} timeSlot - 时间段索引 (0-5)
 * @returns {Array} 课程对象数组
 */
function parseCellContent(text, dayOfWeek, timeSlot) {
    const courses = [];

    // 按换行分割，过滤空行
    const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

    if (lines.length === 0) return courses;

    // 多门课程在同一单元格时，有以下几种分隔方式：
    // 1. 每4行一组（课程名、教师、周次、教室）
    // 2. 每门课之间有连续空行（已被 filter 去除）
    // 3. 某些课程可能占用3行（无教室信息）

    // 尝试4行一组解析
    let i = 0;
    while (i < lines.length) {
        // 检查当前行是否像课程名（不以数字/括号开头，不太短）
        const line = lines[i];

        // 跳过备注说明行
        if (line.startsWith('注意') || line.startsWith('说明') || line.startsWith('备注')) {
            i++;
            continue;
        }

        // 尝试收集4行作为一个课程条目
        const courseLines = [];
        let j = i;

        // 收集最多4行
        while (j < lines.length && courseLines.length < 4) {
            const candidate = lines[j];

            // 检查是否是一个新课程的开始
            // 新课程行特征：看起来像课程名（包含中文字符，不以数字开头）
            if (courseLines.length > 0 && isCourseNameLine(candidate) && courseLines.length >= 3) {
                // 已经收集了足够行，且遇到新课程名，停止
                break;
            }

            courseLines.push(candidate);
            j++;
        }

        if (courseLines.length >= 2) {
            const course = createCourseEntry(courseLines, dayOfWeek, timeSlot);
            if (course) {
                courses.push(course);
            }
        }

        i = j;
    }

    return courses;
}

/**
 * 判断一行文本是否像课程名称
 * @param {string} line
 * @returns {boolean}
 */
function isCourseNameLine(line) {
    // 课程名通常：包含中文，不以数字/括号开头，不是纯教室号
    if (!line) return false;

    // 排除以数字、括号、逗号开头的行（通常是周次信息）
    if (/^[\d（(,，]/.test(line)) return false;

    // 排除纯英文/数字的行（可能是教室号）
    if (!/[一-龥]/.test(line)) return false;

    // 排除很长的带括号说明行
    if (line.length > 50 && line.includes('（') && line.includes('）')) return false;

    return true;
}

/**
 * 根据4行文本创建课程对象
 * @param {Array} lines - 课程文本行（2-4行）
 * @param {number} dayOfWeek
 * @param {number} timeSlot
 * @returns {Object|null}
 */
function createCourseEntry(lines, dayOfWeek, timeSlot) {
    // 第1行：课程名
    const name = lines[0] || '未命名课程';

    // 跳过明显不是课程的条目
    if (name.length < 2 || name.length > 60) return null;

    // 第2行：教师名（可能包含其他信息）
    let teacher = '';
    let weekStr = '';
    let location = '';

    if (lines.length >= 2) {
        // 判断第2行是教师名还是周次信息
        if (isWeekString(lines[1])) {
            // 没有教师名，第2行是周次
            weekStr = lines[1];
            location = lines.length >= 3 ? lines[2] : '';
        } else {
            teacher = lines[1];
            weekStr = lines.length >= 3 ? lines[2] : '';
            location = lines.length >= 4 ? lines[3] : '';
        }
    }

    // 解析周次
    const weeks = parseWeekString(weekStr);

    return {
        name: name,
        teacher: teacher,
        dayOfWeek: dayOfWeek,
        timeSlot: timeSlot,
        weeks: weeks,
        location: location
    };
}

/**
 * 判断字符串是否像周次信息
 * @param {string} str
 * @returns {boolean}
 */
function isWeekString(str) {
    if (!str) return false;
    // 周次信息特征：包含数字、逗号、-、(、)、周、单、双、节
    return /[\d,，\-、()（）[\[\]]/.test(str) &&
           /[周单双击节]/.test(str);
}

/**
 * 解析周次字符串为数字数组
 * 例："1-16([周])[01-02节]" → [1,2,3,...,16]
 * 例："2,4,6,8,10,12,14,16([周])[03-04节]" → [2,4,6,8,10,12,14,16]
 * 例："1,3,5,7,9([单])[01-02节]" → [1,3,5,7,9]
 * @param {string} str
 * @returns {number[]}
 */
function parseWeekString(str) {
    if (!str) return [];

    const weeks = new Set();

    // 提取周次部分（在括号之前）
    const weekPart = str.split(/[\[(（]/)[0].trim();

    if (!weekPart) return [];

    // 按逗号分割
    const parts = weekPart.split(/[,，、]/);

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        if (trimmed.includes('-')) {
            // 范围：1-16
            const rangeParts = trimmed.split(/-/);
            const start = parseInt(rangeParts[0]);
            const end = parseInt(rangeParts[rangeParts.length - 1]);

            if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start && end <= 30) {
                for (let w = start; w <= end; w++) {
                    weeks.add(w);
                }
            }
        } else {
            // 单个数字
            const num = parseInt(trimmed);
            if (!isNaN(num) && num > 0 && num <= 30) {
                weeks.add(num);
            }
        }
    }

    // 处理单双周标记
    const hasSingleMarker = /[单奇]/.test(str);   // 单周
    const hasDoubleMarker = /[双偶]/.test(str);   // 双周

    if (hasSingleMarker && !hasDoubleMarker) {
        // 只保留单周（奇数周）
        for (const w of weeks) {
            if (w % 2 === 0) weeks.delete(w);
        }
    } else if (hasDoubleMarker && !hasSingleMarker) {
        // 只保留双周（偶数周）
        for (const w of weeks) {
            if (w % 2 !== 0) weeks.delete(w);
        }
    }

    return Array.from(weeks).sort((a, b) => a - b);
}

/**
 * 计算所有课程中的最大周数
 * @param {Array} courses
 * @returns {number}
 */
function calculateTotalWeeks(courses) {
    let maxWeek = 20; // 默认20周
    for (const course of courses) {
        if (course.weeks && course.weeks.length > 0) {
            const courseMax = Math.max(...course.weeks);
            if (courseMax > maxWeek) {
                maxWeek = courseMax;
            }
        }
    }
    return maxWeek;
}

/**
 * 基于课程名称哈希分配颜色
 * @param {Array} courses
 */
function assignColors(courses) {
    // 按课程名去重，建立颜色映射
    const colorMap = new Map();

    for (const course of courses) {
        if (!colorMap.has(course.name)) {
            // 使用简单哈希
            let hash = 0;
            for (let i = 0; i < course.name.length; i++) {
                hash = ((hash << 5) - hash) + course.name.charCodeAt(i);
                hash |= 0; // 转为32位整数
            }
            const colorIndex = Math.abs(hash) % COURSE_COLORS.length;
            colorMap.set(course.name, {
                color: COURSE_COLORS[colorIndex],
                colorIndex: colorIndex
            });
        }

        const mapping = colorMap.get(course.name);
        course.color = mapping.color;
        course.colorIndex = mapping.colorIndex;
    }
}

/**
 * 生成简短唯一 ID
 * @returns {string}
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
