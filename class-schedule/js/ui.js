/**
 * UI 渲染模块
 * 负责课程表格、周导航、统计等界面渲染
 */

/**
 * 渲染整个页面（根据是否有数据）
 */
function renderPage() {
    const data = loadSchedule();
    const currentWeek = loadCurrentWeek();

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
        saveCurrentWeek(1);
        data._currentWeek = 1;
    } else {
        data._currentWeek = currentWeek;
    }

    renderSemesterInfo(data);
    renderWeekNavigator(data);
    renderStats(data);
    renderSchedule(data);
}

/**
 * 渲染学期信息栏
 */
function renderSemesterInfo(data) {
    const bar = document.getElementById('info-bar');
    const parts = [];

    if (data.semester) {
        parts.push(`<span class="info-item"><span class="info-label">学期</span> <span class="info-value">${escapeHtml(data.semester)}</span></span>`);
    }
    if (data.className) {
        if (parts.length > 0) parts.push('<span class="info-divider"></span>');
        parts.push(`<span class="info-item"><span class="info-label">班级</span> <span class="info-value">${escapeHtml(data.className)}</span></span>`);
    }
    if (data.department) {
        if (parts.length > 0) parts.push('<span class="info-divider"></span>');
        parts.push(`<span class="info-item"><span class="info-label">院系</span> <span class="info-value">${escapeHtml(data.department)}</span></span>`);
    }
    if (parts.length > 0) {
        parts.push('<span class="info-divider"></span>');
    }
    parts.push(`<span class="info-item"><span class="info-label">总课程</span> <span class="info-value">${data.courses.length}门</span></span>`);

    bar.innerHTML = parts.join('');
}

/**
 * 渲染周导航栏
 */
function renderWeekNavigator(data) {
    const nav = document.getElementById('week-nav');
    const currentWeek = data._currentWeek || loadCurrentWeek();
    const totalWeeks = data.totalWeeks;

    nav.innerHTML = `
        <button class="week-nav-btn" id="btn-week-first" title="第1周">⏮</button>
        <button class="week-nav-btn" id="btn-week-prev" title="上一周">◀</button>
        <div class="week-nav-info">
            第
            <input type="number" class="week-nav-input" id="week-input"
                   value="${currentWeek}" min="1" max="${totalWeeks}">
            周
            <span class="week-nav-total">/ 共${totalWeeks}周</span>
        </div>
        <button class="week-nav-btn" id="btn-week-next" title="下一周">▶</button>
        <button class="week-nav-btn" id="btn-week-last" title="第${totalWeeks}周">⏭</button>
        <button class="week-nav-today" id="btn-week-today" title="跳转到第1周">📍 今周</button>
    `;
}

/**
 * 渲染本周统计
 */
function renderStats(data) {
    const bar = document.getElementById('stats-bar');
    const currentWeek = data._currentWeek || loadCurrentWeek();

    // 统计本周有课的课程数
    const weekCourses = data.courses.filter(c => c.weeks && c.weeks.includes(currentWeek));

    // 统计每天课程数
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // 0=周日, 1-6=周一到周六
    for (const c of weekCourses) {
        if (c.dayOfWeek >= 1 && c.dayOfWeek <= 7) {
            dayCounts[c.dayOfWeek - 1]++;
        }
    }

    // 计算有课的天数
    const activeDays = dayCounts.filter(c => c > 0).length;

    bar.innerHTML = `
        <span class="stat-item">📍 第 <span class="stat-num">${currentWeek}</span> 周</span>
        <span class="stat-divider"></span>
        <span class="stat-item">📚 本周课程 <span class="stat-num">${weekCourses.length}</span> 门次</span>
        <span class="stat-divider"></span>
        <span class="stat-item">📅 上课天数 <span class="stat-num">${activeDays}</span> 天</span>
    `;
}

/**
 * 渲染课程表格
 */
function renderSchedule(data) {
    const table = document.getElementById('schedule-table');
    const currentWeek = data._currentWeek || loadCurrentWeek();

    // 构建表头
    let html = '<thead><tr>';
    html += '<th class="time-col">时间</th>';
    for (let d = 1; d <= 7; d++) {
        const weekendClass = (d >= 6) ? ' weekend' : '';
        html += `<th class="day-col${weekendClass}">${DAY_NAMES[d]}</th>`;
    }
    html += '</tr></thead>';

    // 构建表体
    html += '<tbody>';
    for (let slot = 0; slot < TIME_SLOTS.length; slot++) {
        html += '<tr>';
        // 时间标签
        html += `<td class="time-col">
            <div>${TIME_SLOTS[slot].label}</div>
            <div class="time-range">${TIME_SLOTS[slot].time}</div>
        </td>`;

        // 每天的课程
        for (let day = 1; day <= 7; day++) {
            // 查找该时间段该天的所有课程
            const cellCourses = data.courses.filter(c =>
                c.dayOfWeek === day && c.timeSlot === slot
            );

            html += '<td>';
            if (cellCourses.length === 0) {
                html += '<div class="course-block empty-cell" style="background:var(--color-cell-empty)"></div>';
            } else {
                for (const course of cellCourses) {
                    const isActive = course.weeks && course.weeks.includes(currentWeek);
                    const stateClass = isActive ? 'active' : 'inactive';
                    const colorClass = isActive ? `course-color-${course.colorIndex}` : '';

                    html += `<div class="course-block ${stateClass} ${colorClass}"
                                  title="${escapeHtml(course.name)}&#10;教师：${escapeHtml(course.teacher)}&#10;地点：${escapeHtml(course.location)}&#10;周次：${escapeHtml(course.weeks ? course.weeks.join(', ') : '')}">
                        <span class="course-name">${escapeHtml(course.name)}</span>`;

                    if (course.teacher) {
                        html += `<span class="course-teacher">${escapeHtml(course.teacher)}</span>`;
                    }
                    if (course.location) {
                        html += `<span class="course-location">${escapeHtml(course.location)}</span>`;
                    }

                    html += '</div>';
                }
            }
            html += '</td>';
        }
        html += '</tr>';
    }
    html += '</tbody>';

    table.innerHTML = html;

    // 滚动到周一可见（移动端体验优化）
    const scrollContainer = document.querySelector('.schedule-scroll');
    if (scrollContainer && window.innerWidth < 768) {
        scrollContainer.scrollLeft = 0;
    }
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
 * @param {string} message - 消息内容
 * @param {string} type - 类型：'success' | 'error' | 'info'
 * @param {number} duration - 显示时长（毫秒）
 */
function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 2500;

    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

/**
 * 显示导入确认对话框
 * @param {Object} data - 解析后的课表数据
 * @returns {Promise<string>} 'confirm' | 'cancel'
 */
function showImportDialog(data) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirm-overlay');
        const title = document.getElementById('confirm-title');
        const message = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        title.textContent = '导入预览';
        okBtn.textContent = '确认导入';
        cancelBtn.textContent = '取消';

        // 构建预览内容
        let previewHtml = '<div class="preview-info">';
        previewHtml += `<div class="preview-row"><span class="preview-label">学期</span><span class="preview-value">${escapeHtml(data.semester)}</span></div>`;
        previewHtml += `<div class="preview-row"><span class="preview-label">班级</span><span class="preview-value">${escapeHtml(data.className)}</span></div>`;
        if (data.department) {
            previewHtml += `<div class="preview-row"><span class="preview-label">院系</span><span class="preview-value">${escapeHtml(data.department)}</span></div>`;
        }
        previewHtml += `<div class="preview-row"><span class="preview-label">课程总数</span><span class="preview-value">${data.courses.length} 门</span></div>`;
        previewHtml += `<div class="preview-row"><span class="preview-label">总周数</span><span class="preview-value">${data.totalWeeks} 周</span></div>`;
        previewHtml += '</div>';

        // 课程列表预览（最多显示15门）
        const previewCourses = data.courses.slice(0, 15);
        previewHtml += '<div class="preview-courses">';
        previewHtml += '<p style="font-weight:600;margin-bottom:6px;font-size:0.82rem;color:var(--color-text-secondary)">课程列表预览：</p>';
        for (const course of previewCourses) {
            const dayName = DAY_NAMES[course.dayOfWeek] || '';
            const slotName = TIME_SLOTS[course.timeSlot] ? TIME_SLOTS[course.timeSlot].label : '';
            previewHtml += `<div class="preview-course-item">
                <span class="preview-course-dot" style="background:${course.color}"></span>
                <span>${escapeHtml(course.name)} | ${escapeHtml(course.teacher || '未知教师')} | ${dayName} ${slotName}</span>
            </div>`;
        }
        if (data.courses.length > 15) {
            previewHtml += `<p style="font-size:0.8rem;color:var(--color-text-muted);margin-top:6px">... 还有 ${data.courses.length - 15} 门课程未显示</p>`;
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

        function onConfirm() {
            cleanup();
            resolve('confirm');
        }

        function onCancel() {
            cleanup();
            resolve('cancel');
        }

        function onKeydown(e) {
            if (e.key === 'Escape') {
                onCancel();
            } else if (e.key === 'Enter') {
                onConfirm();
            }
        }

        okBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeydown);
        okBtn.focus();
    });
}

/**
 * HTML 转义
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
