/**
 * UI 渲染模块
 * 负责课程表格、周导航、统计等界面渲染
 */

/**
 * 渲染整个页面
 */
function renderPage() {
    var data = loadSchedule();
    var currentWeek = loadCurrentWeek();

    if (!data || !data.courses || data.courses.length === 0) {
        showEmptyState();
        document.getElementById('info-bar').innerHTML = '';
        document.getElementById('week-nav').innerHTML = '';
        document.getElementById('stats-bar').innerHTML = '';
        document.getElementById('schedule-wrapper').classList.add('hidden');
        return;
    }

    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('schedule-wrapper').classList.remove('hidden');

    // 确保当前周在有效范围
    if (currentWeek > data.totalWeeks) {
        currentWeek = 1;
        saveCurrentWeek(1);
    }
    data._currentWeek = currentWeek;

    renderSemesterInfo(data);
    renderWeekNavigator(data);
    renderStats(data);
    renderSchedule(data);
}

/**
 * 渲染学期信息栏（含开学日期选择器）
 */
function renderSemesterInfo(data) {
    var bar = document.getElementById('info-bar');
    var parts = [];

    if (data.semester) {
        parts.push('<span class="info-item"><span class="info-label">学期</span> <span class="info-value">' + escapeHtml(data.semester) + '</span></span>');
    }
    if (data.className) {
        if (parts.length > 0) parts.push('<span class="info-divider"></span>');
        parts.push('<span class="info-item"><span class="info-label">班级</span> <span class="info-value">' + escapeHtml(data.className) + '</span></span>');
    }
    if (data.department) {
        if (parts.length > 0) parts.push('<span class="info-divider"></span>');
        parts.push('<span class="info-item"><span class="info-label">院系</span> <span class="info-value">' + escapeHtml(data.department) + '</span></span>');
    }

    // 开学日期选择器
    var semStart = loadSemesterStart();
    if (parts.length > 0) parts.push('<span class="info-divider"></span>');
    parts.push('<span class="info-item"><span class="info-label">开学(周一)</span> <input type="date" class="semester-date-input" id="semester-date-input" value="' + (semStart || '') + '" title="设置学期第一周周一的日期，用于计算今天是第几周"></span>');

    bar.innerHTML = parts.join('');
}

/**
 * 渲染周导航栏
 */
function renderWeekNavigator(data) {
    var nav = document.getElementById('week-nav');
    var currentWeek = data._currentWeek || loadCurrentWeek();
    var totalWeeks = data.totalWeeks;

    nav.innerHTML =
        '<button class="week-nav-btn" id="btn-week-first" title="第1周">⏮</button>' +
        '<button class="week-nav-btn" id="btn-week-prev" title="上一周">◀</button>' +
        '<div class="week-nav-info">' +
            '第 <input type="number" class="week-nav-input" id="week-input" value="' + currentWeek + '" min="1" max="' + totalWeeks + '"> 周' +
            '<span class="week-nav-total">/ 共' + totalWeeks + '周</span>' +
        '</div>' +
        '<button class="week-nav-btn" id="btn-week-next" title="下一周">▶</button>' +
        '<button class="week-nav-btn" id="btn-week-last" title="第' + totalWeeks + '周">⏭</button>' +
        '<button class="week-nav-today" id="btn-week-today">📍 今周</button>';
}

/**
 * 渲染本周统计
 */
function renderStats(data) {
    var bar = document.getElementById('stats-bar');
    var currentWeek = data._currentWeek || loadCurrentWeek();

    // 统计本周有课的课程（按 day+slot 去重计数）
    var weekCourses = data.courses.filter(function (c) {
        return c.weeks && c.weeks.indexOf(currentWeek) >= 0;
    });

    var dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < weekCourses.length; i++) {
        var c = weekCourses[i];
        if (c.dayOfWeek >= 1 && c.dayOfWeek <= 7) {
            dayCounts[c.dayOfWeek - 1]++;
        }
    }
    var activeDays = dayCounts.filter(function (c) { return c > 0; }).length;

    bar.innerHTML =
        '<span class="stat-item">📍 第 <span class="stat-num">' + currentWeek + '</span> 周</span>' +
        '<span class="stat-divider"></span>' +
        '<span class="stat-item">📚 本周课程 <span class="stat-num">' + weekCourses.length + '</span> 门次</span>' +
        '<span class="stat-divider"></span>' +
        '<span class="stat-item">📅 上课天数 <span class="stat-num">' + activeDays + '</span> 天</span>';
}

/**
 * 渲染课程表格（只渲染当前周有课的课程）
 */
function renderSchedule(data) {
    var table = document.getElementById('schedule-table');
    var currentWeek = data._currentWeek || loadCurrentWeek();

    // 构建表头
    var html = '<thead><tr>';
    html += '<th class="time-col">时间</th>';
    for (var d = 1; d <= 7; d++) {
        var weekendClass = (d >= 6) ? ' weekend' : '';
        html += '<th class="day-col' + weekendClass + '">' + DAY_NAMES[d] + '</th>';
    }
    html += '</tr></thead>';

    // 构建表体
    html += '<tbody>';
    for (var slot = 0; slot < TIME_SLOTS.length; slot++) {
        html += '<tr>';
        // 时间标签列
        html += '<td class="time-col">' +
            '<div>' + TIME_SLOTS[slot].label + '</div>' +
            '<div class="time-range">' + TIME_SLOTS[slot].time + '</div>' +
        '</td>';

        // 每天的课程（只渲染当前周有课的课程）
        for (var day = 1; day <= 7; day++) {
            // 只取当前周有课的课程
            var cellCourses = data.courses.filter(function (c) {
                return c.dayOfWeek === day &&
                       c.timeSlot === slot &&
                       c.weeks &&
                       c.weeks.indexOf(currentWeek) >= 0;
            });

            if (cellCourses.length === 0) {
                html += '<td class="empty-cell-td"></td>';
            } else {
                html += '<td>';
                for (var ci = 0; ci < cellCourses.length; ci++) {
                    var course = cellCourses[ci];
                    html += '<div class="course-block course-color-' + course.colorIndex + '"' +
                            ' title="' + escapeAttr(course.name) +
                            '&#10;教师：' + escapeAttr(course.teacher || '未知') +
                            '&#10;地点：' + escapeAttr(course.location || '未知') +
                            '&#10;周次：' + escapeAttr(course.weeks ? course.weeks.join(', ') : '') + '">' +
                        '<span class="course-name">' + escapeHtml(course.name) + '</span>';

                    if (course.teacher) {
                        html += '<span class="course-teacher">' + escapeHtml(course.teacher) + '</span>';
                    }
                    if (course.location) {
                        html += '<span class="course-location">' + escapeHtml(course.location) + '</span>';
                    }

                    html += '</div>';
                }
                html += '</td>';
            }
        }
        html += '</tr>';
    }
    html += '</tbody>';

    table.innerHTML = html;
}

/**
 * 显示空状态
 */
function showEmptyState() {
    document.getElementById('empty-state').classList.remove('hidden');
    document.getElementById('schedule-wrapper').classList.add('hidden');
    document.getElementById('info-bar').innerHTML = '';
    document.getElementById('week-nav').innerHTML = '';
    document.getElementById('stats-bar').innerHTML = '';
}

/**
 * 显示 Toast 提示
 */
function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 2500;

    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
        toast.classList.add('toast-out');
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, duration);
}

/**
 * 显示导入确认对话框
 */
function showImportDialog(data) {
    return new Promise(function (resolve) {
        var overlay = document.getElementById('confirm-overlay');
        var title = document.getElementById('confirm-title');
        var message = document.getElementById('confirm-message');
        var okBtn = document.getElementById('confirm-ok');
        var cancelBtn = document.getElementById('confirm-cancel');

        title.textContent = '导入预览';
        okBtn.textContent = '确认导入';
        cancelBtn.textContent = '取消';

        var previewHtml = '<div class="preview-info">';
        if (data.semester) {
            previewHtml += '<div class="preview-row"><span class="preview-label">学期</span><span class="preview-value">' + escapeHtml(data.semester) + '</span></div>';
        }
        if (data.className) {
            previewHtml += '<div class="preview-row"><span class="preview-label">班级</span><span class="preview-value">' + escapeHtml(data.className) + '</span></div>';
        }
        previewHtml += '<div class="preview-row"><span class="preview-label">课程总数</span><span class="preview-value">' + data.courses.length + ' 门</span></div>';
        previewHtml += '<div class="preview-row"><span class="preview-label">总周数</span><span class="preview-value">' + data.totalWeeks + ' 周</span></div>';
        previewHtml += '</div>';

        // 课程列表预览
        var previewCourses = data.courses.slice(0, 12);
        previewHtml += '<div class="preview-courses">';
        previewHtml += '<p style="font-weight:600;margin-bottom:6px;font-size:0.8rem;color:var(--color-text-secondary)">课程列表预览：</p>';
        for (var i = 0; i < previewCourses.length; i++) {
            var course = previewCourses[i];
            var dayName = DAY_NAMES[course.dayOfWeek] || '';
            var slotName = TIME_SLOTS[course.timeSlot] ? TIME_SLOTS[course.timeSlot].label : '';
            previewHtml += '<div class="preview-course-item">' +
                '<span class="preview-course-dot" style="background:' + course.color + '"></span>' +
                '<span>' + escapeHtml(course.name) + ' | ' + escapeHtml(course.teacher || '未知教师') + ' | ' + dayName + ' ' + slotName + '</span>' +
            '</div>';
        }
        if (data.courses.length > 12) {
            previewHtml += '<p style="font-size:0.78rem;color:var(--color-text-muted);margin-top:4px">... 还有 ' + (data.courses.length - 12) + ' 门课程未显示</p>';
        }
        previewHtml += '</div>';

        message.innerHTML = previewHtml;
        overlay.classList.remove('hidden');

        function cleanup() {
            overlay.classList.add('hidden');
            okBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeydown);
        }

        function onConfirm() { cleanup(); resolve('confirm'); }
        function onCancel() { cleanup(); resolve('cancel'); }
        function onKeydown(e) {
            if (e.key === 'Escape') onCancel();
            else if (e.key === 'Enter') onConfirm();
        }

        okBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeydown);
        okBtn.focus();
    });
}

/**
 * HTML 转义（用于 innerHTML）
 */
function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 属性值转义（用于 title 等属性）
 */
function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
