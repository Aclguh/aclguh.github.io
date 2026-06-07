/**
 * 应用入口
 * 初始化应用、绑定事件
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
        // 模板下载按钮
        document.getElementById('btn-template').addEventListener('click', function () {
            downloadCSVTemplate();
            showToast('CSV 模板已下载，请用 Excel 打开填写', 'success');
        });

        // 导入按钮
        document.getElementById('btn-import').addEventListener('click', triggerImport);
        document.getElementById('btn-empty-import').addEventListener('click', triggerImport);

        // 清空按钮
        document.getElementById('btn-clear').addEventListener('click', handleClear);

        // 文件选择
        document.getElementById('import-file-input').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (file) {
                handleImportFile(file);
                e.target.value = '';
            }
        });

        // 事件委托：周导航按钮
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[id^="btn-week-"]');
            if (btn) {
                handleWeekNavigation(btn.id);
                return;
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

            // Esc 关闭弹窗
            if (e.key === 'Escape') {
                var confirmOverlay = document.getElementById('confirm-overlay');
                if (!confirmOverlay.classList.contains('hidden')) {
                    document.getElementById('confirm-cancel').click();
                }
                return;
            }
        });

        // 周次输入框失焦
        document.addEventListener('change', function (e) {
            if (e.target.id === 'week-input') {
                handleWeekJump();
            }
            // 开学日期变更
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
                if (choice === 'confirm') {
                    // 生成 ID
                    for (var i = 0; i < data.courses.length; i++) {
                        data.courses[i].id = generateId();
                    }

                    if (saveSchedule(data)) {
                        saveCurrentWeek(1);
                        renderPage();
                        showToast('成功导入 ' + data.courses.length + ' 门课程！', 'success');
                    } else {
                        showToast('保存失败，请检查浏览器存储空间', 'error');
                    }
                } else {
                    showToast('已取消导入', 'info', 1500);
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
        document.getElementById('confirm-message').innerHTML = '<p>确定要清空所有课程数据吗？</p><p style="color:var(--color-text-muted);font-size:0.8rem">此操作不可恢复。</p>';
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
        renderSchedule(data);

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
     * 跳转到当前周（根据开学日期计算，未设置则默认第1周）
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
