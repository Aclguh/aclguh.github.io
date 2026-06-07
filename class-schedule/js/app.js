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
        // 检查 SheetJS 是否加载
        if (typeof XLSX === 'undefined') {
            console.warn('SheetJS 未加载，导入功能可能不可用');
        }

        renderPage();
        bindEvents();
        console.log('📅 课程表已就绪');
    }

    // ============================================
    // 绑定事件
    // ============================================
    function bindEvents() {
        // 导入按钮
        document.getElementById('btn-import').addEventListener('click', triggerImport);
        document.getElementById('btn-empty-import').addEventListener('click', triggerImport);

        // 清空按钮
        document.getElementById('btn-clear').addEventListener('click', handleClear);

        // 导入文件选择
        document.getElementById('import-file-input').addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                handleImportFile(file);
                // 重置以便重复选择同一文件
                e.target.value = '';
            }
        });

        // 使用事件委托绑定动态生成的元素（周导航、课程卡片等）
        document.addEventListener('click', function (e) {
            // 周导航按钮
            const weekNavBtn = e.target.closest('[id^="btn-week-"]');
            if (weekNavBtn) {
                handleWeekNavigation(weekNavBtn.id);
                return;
            }
        });

        // 周次输入框回车跳转（事件委托）
        document.addEventListener('keydown', function (e) {
            if (e.target.id === 'week-input' && e.key === 'Enter') {
                e.preventDefault();
                handleWeekJump();
                return;
            }

            // 键盘快捷键
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
            if (e.key === 'Escape') {
                const confirmOverlay = document.getElementById('confirm-overlay');
                if (!confirmOverlay.classList.contains('hidden')) {
                    document.getElementById('confirm-cancel').click();
                }
                return;
            }
        });

        // 周次输入框失焦时跳转
        document.addEventListener('change', function (e) {
            if (e.target.id === 'week-input') {
                handleWeekJump();
            }
        });

        // 拖拽导入支持
        document.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const file = e.dataTransfer.files[0];
            if (file) {
                const ext = file.name.split('.').pop().toLowerCase();
                if (ext === 'xls' || ext === 'xlsx') {
                    handleImportFile(file);
                } else {
                    showToast('请拖入 .xls 或 .xlsx 格式的课程表文件', 'error');
                }
            }
        });
    }

    // ============================================
    // 导入处理
    // ============================================

    /**
     * 触发文件选择
     */
    function triggerImport() {
        document.getElementById('import-file-input').click();
    }

    /**
     * 处理导入文件
     * @param {File} file
     */
    async function handleImportFile(file) {
        // 检查文件扩展名
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'xls' && ext !== 'xlsx') {
            showToast('请选择 .xls 或 .xlsx 格式的课程表文件', 'error');
            return;
        }

        // 检查 SheetJS
        if (typeof XLSX === 'undefined') {
            showToast('XLS 解析库加载失败，请刷新页面后重试', 'error');
            return;
        }

        showToast('正在解析文件...', 'info', 1500);

        try {
            const data = await parseXLSFile(file);

            if (!data || data.courses.length === 0) {
                showToast('未解析到任何课程数据，请检查文件内容', 'error');
                return;
            }

            // 显示导入预览对话框
            const choice = await showImportDialog(data);

            if (choice === 'confirm') {
                // 为每个课程生成唯一ID
                for (const course of data.courses) {
                    course.id = generateId();
                }

                // 保存到 localStorage
                if (saveSchedule(data)) {
                    // 重置当前周为1
                    saveCurrentWeek(1);
                    // 重新渲染
                    renderPage();
                    showToast(`成功导入 ${data.courses.length} 门课程！`, 'success');
                } else {
                    showToast('保存失败，请检查浏览器存储空间', 'error');
                }
            } else {
                showToast('已取消导入', 'info', 1500);
            }
        } catch (err) {
            console.error('导入失败:', err);
            showToast(`导入失败：${err.message}`, 'error');
        }
    }

    // ============================================
    // 清空处理
    // ============================================
    function handleClear() {
        const data = loadSchedule();
        if (!data || data.courses.length === 0) {
            showToast('没有可清空的课程数据', 'info');
            return;
        }

        // 使用确认对话框
        const overlay = document.getElementById('confirm-overlay');
        const title = document.getElementById('confirm-title');
        const message = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        title.textContent = '清空课程表';
        message.innerHTML = `<p>确定要清空所有课程数据吗？</p><p style="color:var(--color-text-muted);font-size:0.82rem">此操作不可恢复，建议先导出备份。</p>`;
        okBtn.textContent = '确认清空';
        okBtn.style.background = '#e74c3c';
        okBtn.style.color = 'white';
        okBtn.style.borderColor = '#e74c3c';
        cancelBtn.textContent = '取消';
        overlay.classList.remove('hidden');

        function cleanup() {
            overlay.classList.add('hidden');
            okBtn.style.background = '';
            okBtn.style.color = '';
            okBtn.style.borderColor = '';
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

        function onCancel() {
            cleanup();
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
    }

    // ============================================
    // 周导航处理
    // ============================================

    /**
     * 处理周导航按钮点击
     * @param {string} btnId
     */
    function handleWeekNavigation(btnId) {
        const data = loadSchedule();
        if (!data) return;

        const totalWeeks = data.totalWeeks;

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
                setCurrentWeek(totalWeeks, data);
                break;
            case 'btn-week-today':
                // 尝试计算当前是第几周（基于学期起始时间）
                // 简化处理：跳转到第1周
                setCurrentWeek(estimateCurrentWeek(data), data);
                break;
        }
    }

    /**
     * 切换周次
     * @param {number} delta
     * @param {Object} data - 可选，课表数据
     */
    function changeWeek(delta, data) {
        data = data || loadSchedule();
        if (!data) return;

        const currentWeek = loadCurrentWeek();
        const newWeek = currentWeek + delta;

        if (newWeek < 1) {
            showToast('已经是第1周了', 'info', 1200);
            return;
        }
        if (newWeek > data.totalWeeks) {
            showToast(`已经是第${data.totalWeeks}周了（本学期最后一周）`, 'info', 1500);
            return;
        }

        setCurrentWeek(newWeek, data);
    }

    /**
     * 设置当前周次并重新渲染
     * @param {number} week
     * @param {Object} data - 可选
     */
    function setCurrentWeek(week, data) {
        data = data || loadSchedule();
        if (!data) return;

        if (week < 1) week = 1;
        if (week > data.totalWeeks) week = data.totalWeeks;

        saveCurrentWeek(week);
        data._currentWeek = week;
        renderStats(data);
        renderSchedule(data);

        // 更新输入框
        const input = document.getElementById('week-input');
        if (input) {
            input.value = week;
        }
    }

    /**
     * 处理周次输入框跳转
     */
    function handleWeekJump() {
        const data = loadSchedule();
        if (!data) return;

        const input = document.getElementById('week-input');
        if (!input) return;

        const week = parseInt(input.value);
        if (isNaN(week) || week < 1) {
            input.value = loadCurrentWeek();
            showToast('请输入有效的周次（1-' + data.totalWeeks + '）', 'info', 1500);
            return;
        }

        if (week > data.totalWeeks) {
            input.value = data.totalWeeks;
            setCurrentWeek(data.totalWeeks, data);
            showToast(`本学期最多${data.totalWeeks}周，已跳转到最后一周`, 'info', 1500);
            return;
        }

        setCurrentWeek(week, data);
    }

    /**
     * 估算当前周次
     * 根据学期信息（如 "2025-2026-2"）估算当前日期是第几周
     * @param {Object} data
     * @returns {number}
     */
    function estimateCurrentWeek(data) {
        // 学期格式：2025-2026-2（学年-学年-学期序号）
        const semMatch = data.semester.match(/(\d{4})-\d{4}-(\d)/);
        if (!semMatch) return 1;

        const startYear = parseInt(semMatch[1]);
        const semNum = parseInt(semMatch[2]);

        // 估算学期开始日期
        // 第1学期（秋季）：约9月1日
        // 第2学期（春季）：约2月20日左右
        let semStart;
        if (semNum === 1) {
            semStart = new Date(startYear, 8, 1); // 9月1日
        } else {
            semStart = new Date(startYear + 1, 1, 20); // 次年2月20日
        }

        const now = new Date();
        const diffMs = now - semStart;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // 计算周次（每周7天）
        const estimatedWeek = Math.floor(diffDays / 7) + 1;

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
