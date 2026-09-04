/**
 * 应用入口
 * 初始化、事件绑定、导入 / 时间设置 / 周导航流程
 */

(function () {
    'use strict';

    // ============================================
    // 初始化
    // ============================================
    function init() {
        renderPage();
        bindEvents();
        console.log('📅 课程表已就绪');
    }

    // ============================================
    // 事件绑定
    // ============================================
    function bindEvents() {
        // 顶部按钮
        document.getElementById('btn-template').addEventListener('click', function () {
            downloadCSVTemplate();
            showToast('CSV 模板已下载，请用 Excel 打开填写', 'success');
        });

        document.getElementById('btn-import').addEventListener('click', triggerImport);
        document.getElementById('btn-empty-import').addEventListener('click', triggerImport);
        document.getElementById('btn-clear').addEventListener('click', handleClear);
        document.getElementById('btn-settings').addEventListener('click', openTimeSettings);

        // 文件选择
        document.getElementById('import-file-input').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (file) {
                handleImportFile(file);
                e.target.value = '';
            }
        });

        // 时间设置弹窗
        document.getElementById('btn-add-slot').addEventListener('click', addSlotRow);
        document.getElementById('settings-save').addEventListener('click', saveTimeSettings);
        document.getElementById('settings-cancel').addEventListener('click', closeTimeSettings);

        // 视图切换
        document.getElementById('btn-view-grid').addEventListener('click', function () { setViewMode('grid'); });
        document.getElementById('btn-view-day').addEventListener('click', function () { setViewMode('day'); });

        // 事件委托：遮罩点击 / 星期选项卡 / 节次删除 / 周导航按钮
        document.addEventListener('click', function (e) {
            if (e.target.classList && e.target.classList.contains('modal-overlay')) {
                // 点击遮罩关闭设置弹窗（导入确认弹窗不自动关闭，防止误触丢失数据）
                if (e.target.id === 'settings-overlay') closeTimeSettings();
                return;
            }

            var tab = e.target.closest('.day-tab');
            if (tab) {
                setSelectedDay(parseInt(tab.getAttribute('data-day'), 10));
                return;
            }

            var rmBtn = e.target.closest('.slot-remove');
            if (rmBtn) {
                removeSlotRow(rmBtn);
                return;
            }

            var btn = e.target.closest('[id^="btn-week-"]');
            if (btn) {
                handleWeekNavigation(btn.id);
            }
        });

        // 键盘事件
        document.addEventListener('keydown', function (e) {
            // 周次输入框回车
            if (e.target.id === 'week-input' && e.key === 'Enter') {
                e.preventDefault();
                handleWeekJump();
                return;
            }

            // Ctrl+← → 切换周次
            if (e.key === 'ArrowLeft' && e.ctrlKey) {
                e.preventDefault();
                changeWeek(-1);
                return;
            }
            if (e.key === 'ArrowRight' && e.ctrlKey) {
                e.preventDefault();
                changeWeek(1);
                return;
            }

            // Esc 关闭弹窗（设置弹窗优先）
            if (e.key === 'Escape') {
                var settingsOverlay = document.getElementById('settings-overlay');
                if (!settingsOverlay.classList.contains('hidden')) {
                    closeTimeSettings();
                    return;
                }
                var confirmOverlay = document.getElementById('confirm-overlay');
                if (!confirmOverlay.classList.contains('hidden')) {
                    document.getElementById('confirm-cancel').click();
                }
                return;
            }
        });

        // change 事件（周次输入、开学日期）
        document.addEventListener('change', function (e) {
            if (e.target.id === 'week-input') {
                handleWeekJump();
            }
            if (e.target.id === 'semester-date-input') {
                handleSemesterDateChange(e.target.value);
            }
        });

        // 拖拽导入
        document.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var file = e.dataTransfer.files[0];
            if (file) {
                var ext = file.name.split('.').pop().toLowerCase();
                if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') {
                    handleImportFile(file);
                } else {
                    showToast('请拖入 .csv、.xls 或 .xlsx 格式的文件', 'error');
                }
            }
        });
    }

    // ============================================
    // 视图切换
    // ============================================

    function setViewMode(mode) {
        if (loadViewMode() === mode) return;
        saveViewMode(mode);

        var data = loadSchedule();
        if (!data || !data.courses || data.courses.length === 0) return;

        data._currentWeek = loadCurrentWeek();
        renderToolbar(data);
        renderCurrentView(data);
    }

    // ============================================
    // 导入处理
    // ============================================

    function triggerImport() {
        document.getElementById('import-file-input').click();
    }

    function handleImportFile(file) {
        var ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'csv' && ext !== 'xls' && ext !== 'xlsx') {
            showToast('请选择 .csv、.xls 或 .xlsx 格式的文件', 'error');
            return;
        }

        if (ext !== 'csv' && typeof XLSX === 'undefined') {
            showToast('XLS 解析库未加载，请刷新后重试，或使用 CSV 格式', 'error');
            return;
        }

        showToast('正在解析文件...', 'info', 1500);

        parseFile(file).then(function (data) {
            if (!data || data.courses.length === 0) {
                showToast('未解析到任何课程数据', 'error');
                return;
            }

            return showImportDialog(data).then(function (choice) {
                if (choice !== 'confirm') {
                    showToast('已取消导入', 'info', 1500);
                    return;
                }

                // 生成 ID
                for (var i = 0; i < data.courses.length; i++) {
                    data.courses[i].id = generateId();
                }

                // 文件节数超出当前时间配置时自动扩展
                var expanded = false;
                if (data.maxSlot && data.maxSlot > loadTimeSlots().length) {
                    expandTimeSlotsTo(data.maxSlot);
                    expanded = true;
                }

                if (saveSchedule(data)) {
                    saveCurrentWeek(1);
                    renderPage();
                    showToast(
                        '成功导入 ' + data.courses.length + ' 门课程！' +
                        (expanded ? '节次已扩展到 ' + data.maxSlot + ' 节，可点右上角「时间」完善时间' : ''),
                        'success',
                        expanded ? 4200 : 2500
                    );
                } else {
                    showToast('保存失败，请检查浏览器存储空间', 'error');
                }
            });
        }).catch(function (err) {
            console.error('导入失败:', err);
            showToast('导入失败：' + err.message, 'error');
        });
    }

    // ============================================
    // 清空处理
    // ============================================

    function handleClear() {
        var data = loadSchedule();
        if (!data || data.courses.length === 0) {
            showToast('没有可清空的课程数据', 'info');
            return;
        }

        var overlay = document.getElementById('confirm-overlay');
        document.getElementById('confirm-title').textContent = '清空课程表';
        document.getElementById('confirm-message').innerHTML = '<p>确定要清空所有课程数据吗？</p><p style="color:var(--color-text-muted);font-size:0.8rem">此操作不可恢复（时间设置会保留）。</p>';
        var okBtn = document.getElementById('confirm-ok');
        okBtn.textContent = '确认清空';
        okBtn.style.background = '#e74c3c';
        okBtn.style.color = 'white';
        var cancelBtn = document.getElementById('confirm-cancel');
        cancelBtn.textContent = '取消';
        overlay.classList.remove('hidden');

        function cleanup() {
            overlay.classList.add('hidden');
            okBtn.style.background = '';
            okBtn.style.color = '';
            okBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeydown);
        }

        function onConfirm() {
            cleanup();
            clearSchedule();
            renderPage();
            showToast('课程数据已清空', 'info');
        }

        function onCancel() { cleanup(); }

        function onKeydown(e) {
            if (e.key === 'Escape') onCancel();
            else if (e.key === 'Enter') onConfirm();
        }

        okBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeydown);
        okBtn.focus();
    }

    // ============================================
    // 时间设置弹窗
    // ============================================

    function openTimeSettings() {
        var slots = loadTimeSlots();
        var rows = [];
        for (var i = 0; i < slots.length; i++) {
            rows.push({
                label: slots[i].label,
                start: slots[i].start,
                end: slots[i].end,
                originalIndex: i
            });
        }
        renderSlotEditor(rows);
        document.getElementById('settings-overlay').classList.remove('hidden');
    }

    function closeTimeSettings() {
        document.getElementById('settings-overlay').classList.add('hidden');
    }

    function addSlotRow() {
        var list = document.getElementById('slot-list');
        if (list.children.length >= MAX_SLOTS) {
            showToast('最多支持 ' + MAX_SLOTS + ' 节', 'info');
            return;
        }

        var row = createSlotRow({
            label: makeDefaultSlot(list.children.length + 1).label,
            start: '',
            end: '',
            originalIndex: -1
        });
        list.appendChild(row);
        updateSlotIndexes();
        row.querySelector('.slot-label').focus();
    }

    function removeSlotRow(btn) {
        var row = btn.closest('.slot-row');
        var list = document.getElementById('slot-list');

        if (list.children.length <= 1) {
            showToast('至少保留 1 节', 'info');
            return;
        }

        // 有课程占用的节次不允许删除
        var original = parseInt(row.getAttribute('data-original'), 10);
        if (!isNaN(original) && original >= 0) {
            var data = loadSchedule();
            if (data && data.courses) {
                for (var i = 0; i < data.courses.length; i++) {
                    if (data.courses[i].timeSlot === original) {
                        showToast('第 ' + (original + 1) + ' 节有课程占用，不能删除', 'error');
                        return;
                    }
                }
            }
        }

        list.removeChild(row);
        updateSlotIndexes();
    }

    /**
     * 保存时间设置：
     * 1. 校验名称与起止时间
     * 2. 被删除节次之后的课程下标整体上移，保持课程落在正确的行
     * 3. 持久化配置并重新渲染
     */
    function saveTimeSettings() {
        var rowEls = document.querySelectorAll('#slot-list .slot-row');
        if (rowEls.length === 0) {
            showToast('至少保留 1 节', 'error');
            return;
        }

        var newSlots = [];
        var keptOriginals = [];

        for (var i = 0; i < rowEls.length; i++) {
            var el = rowEls[i];
            var label = el.querySelector('.slot-label').value.trim();
            var start = el.querySelector('.slot-start').value;
            var end = el.querySelector('.slot-end').value;

            if (!label) {
                showToast('第 ' + (i + 1) + ' 节：请填写节次名称', 'error');
                return;
            }
            if (start && end && start >= end) {
                showToast('第 ' + (i + 1) + ' 节：结束时间必须晚于开始时间', 'error');
                return;
            }

            newSlots.push({ label: label, start: start, end: end });

            var original = parseInt(el.getAttribute('data-original'), 10);
            if (!isNaN(original) && original >= 0) keptOriginals.push(original);
        }

        // 找出被删除的原节次
        var oldSlots = loadTimeSlots();
        var deleted = [];
        for (var o = 0; o < oldSlots.length; o++) {
            if (keptOriginals.indexOf(o) < 0) deleted.push(o);
        }

        var data = loadSchedule();
        if (data && data.courses && data.courses.length > 0) {
            // 双保险：被删除的节次不能有课程
            for (var d = 0; d < deleted.length; d++) {
                var occupied = data.courses.some(function (c) { return c.timeSlot === deleted[d]; });
                if (occupied) {
                    showToast('第 ' + (deleted[d] + 1) + ' 节有课程占用，不能删除', 'error');
                    return;
                }
            }

            // 重映射课程节次下标
            var changed = false;
            data.courses.forEach(function (c) {
                var newIndex = remapSlotIndex(c.timeSlot, deleted);
                if (newIndex !== c.timeSlot) {
                    c.timeSlot = newIndex;
                    changed = true;
                }
            });

            // 配置必须覆盖所有课程引用的节次
            var maxNeeded = 0;
            data.courses.forEach(function (c) {
                if (c.timeSlot + 1 > maxNeeded) maxNeeded = c.timeSlot + 1;
            });
            while (newSlots.length < maxNeeded && newSlots.length < MAX_SLOTS) {
                newSlots.push(makeDefaultSlot(newSlots.length + 1));
            }

            if (changed) saveSchedule(data);
        }

        saveTimeSlots(newSlots);
        closeTimeSettings();
        renderPage();
        showToast('上课时间设置已保存（共 ' + newSlots.length + ' 节）', 'success');
    }

    /**
     * 删除中间节次后，重映射课程的时间段下标
     * @param {number} index - 原下标
     * @param {number[]} deleted - 被删除的下标（升序）
     */
    function remapSlotIndex(index, deleted) {
        var shift = 0;
        for (var i = 0; i < deleted.length; i++) {
            if (deleted[i] < index) shift++;
        }
        return index - shift;
    }

    // ============================================
    // 开学日期处理
    // ============================================

    function handleSemesterDateChange(dateStr) {
        if (dateStr) {
            saveSemesterStart(dateStr);
            // 自动跳转到计算的当前周
            var data = loadSchedule();
            if (data) {
                var week = calcWeekFromDate(dateStr, data.totalWeeks);
                setCurrentWeek(week, data);
                showToast('开学日期已设置，当前为第 ' + week + ' 周', 'info', 2000);
            }
        }
    }

    /**
     * 根据开学日期计算当前是第几周
     */
    function calcWeekFromDate(semesterStartStr, totalWeeks) {
        var startDate = new Date(semesterStartStr + 'T00:00:00');
        if (isNaN(startDate.getTime())) return 1;

        var now = new Date();
        var diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        var week = Math.floor(diffDays / 7) + 1;
        if (week < 1) week = 1;
        if (week > totalWeeks) week = totalWeeks;
        return week;
    }

    // ============================================
    // 周导航处理
    // ============================================

    function handleWeekNavigation(btnId) {
        var data = loadSchedule();
        if (!data) return;

        switch (btnId) {
            case 'btn-week-first':
                setCurrentWeek(1, data);
                break;
            case 'btn-week-prev':
                changeWeek(-1, data);
                break;
            case 'btn-week-next':
                changeWeek(1, data);
                break;
            case 'btn-week-last':
                setCurrentWeek(data.totalWeeks, data);
                break;
            case 'btn-week-today':
                jumpToCurrentWeek(data);
                break;
        }
    }

    function changeWeek(delta, data) {
        data = data || loadSchedule();
        if (!data) return;

        var currentWeek = loadCurrentWeek();
        var newWeek = currentWeek + delta;

        if (newWeek < 1) { showToast('已经是第1周了', 'info', 1200); return; }
        if (newWeek > data.totalWeeks) { showToast('已经是第' + data.totalWeeks + '周了', 'info', 1500); return; }

        setCurrentWeek(newWeek, data);
    }

    function setCurrentWeek(week, data) {
        data = data || loadSchedule();
        if (!data) return;

        if (week < 1) week = 1;
        if (week > data.totalWeeks) week = data.totalWeeks;

        saveCurrentWeek(week);
        data._currentWeek = week;
        renderStats(data);
        renderCurrentView(data);

        var input = document.getElementById('week-input');
        if (input) input.value = week;
    }

    function handleWeekJump() {
        var data = loadSchedule();
        if (!data) return;

        var input = document.getElementById('week-input');
        if (!input) return;

        var week = parseInt(input.value);
        if (isNaN(week) || week < 1) {
            input.value = loadCurrentWeek();
            showToast('请输入有效的周次（1-' + data.totalWeeks + '）', 'info', 1500);
            return;
        }
        if (week > data.totalWeeks) {
            setCurrentWeek(data.totalWeeks, data);
            return;
        }
        setCurrentWeek(week, data);
    }

    /**
     * 跳转到当前周（根据开学日期计算，未设置则尝试估算）
     */
    function jumpToCurrentWeek(data) {
        var semStart = loadSemesterStart();
        var week;
        if (semStart) {
            week = calcWeekFromDate(semStart, data.totalWeeks);
        } else {
            // 未设置开学日期，尝试用学期信息估算
            week = estimateCurrentWeek(data);
            showToast('未设置开学日期，已根据学期信息估算', 'info', 2000);
        }
        setCurrentWeek(week, data);
    }

    /**
     * 根据学期信息估算当前周次（后备方案）
     */
    function estimateCurrentWeek(data) {
        var semMatch = data.semester ? data.semester.match(/(\d{4})-\d{4}-(\d)/) : null;
        if (!semMatch) return 1;

        var startYear = parseInt(semMatch[1]);
        var semNum = parseInt(semMatch[2]);
        var semStart;

        if (semNum === 1) {
            semStart = new Date(startYear, 8, 1);
        } else {
            semStart = new Date(startYear + 1, 1, 20);
        }

        var now = new Date();
        var diffDays = Math.floor((now - semStart) / (1000 * 60 * 60 * 24));
        var estimatedWeek = Math.floor(diffDays / 7) + 1;

        if (estimatedWeek < 1) return 1;
        if (estimatedWeek > data.totalWeeks) return data.totalWeeks;
        return estimatedWeek;
    }

    // ============================================
    // 启动
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
