/**
 * 体重记录 - 数据持久化层
 * 接入统一 SafeStorage，提供容错与命名空间隔离
 */

(function () {
    const STORAGE_KEY = 'weight_records';
    const HOVER_GUIDES_KEY = 'weight_hover_guides';
    const TOOLTIP_OPACITY_KEY = 'weight_tooltip_opacity';
    const BMI_ENABLED_KEY = 'weight_bmi_enabled';
    const BMI_HEIGHT_KEY = 'weight_bmi_height';
    const LINE_COLOR_KEY = 'weight_line_color';
    const LINE_STYLE_KEY = 'weight_line_style';
    const DATE_AXIS_KEY = 'weight_date_axis';

    const LINE_COLOR_VALUES = ['default', 'clear', 'red', 'green', 'blue'];
    const LINE_STYLE_VALUES = ['smooth', 'sharp', 'kline'];
    const DATE_AXIS_VALUES = ['real', 'equal'];

    const WeightStorage = {
        loadRecords() {
            if (typeof SafeStorage !== 'undefined') {
                return SafeStorage.get(STORAGE_KEY, []);
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    return raw ? JSON.parse(raw) : [];
                }
            } catch (e) {}
            return [];
        },

        saveRecords(records) {
            if (typeof SafeStorage !== 'undefined') {
                return SafeStorage.set(STORAGE_KEY, records);
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
                    return true;
                }
            } catch (e) {}
            return false;
        },

        clearRecords() {
            if (typeof SafeStorage !== 'undefined') {
                SafeStorage.remove(STORAGE_KEY);
                return;
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch (e) {}
        },

        loadHoverGuides() {
            let val = null;
            if (typeof SafeStorage !== 'undefined') {
                val = SafeStorage.getItem(HOVER_GUIDES_KEY);
            } else {
                try {
                    if (typeof localStorage !== 'undefined') val = localStorage.getItem(HOVER_GUIDES_KEY);
                } catch (e) {}
            }
            return val !== 'off';
        },

        saveHoverGuides(on) {
            const val = on ? 'on' : 'off';
            if (typeof SafeStorage !== 'undefined') {
                SafeStorage.setItem(HOVER_GUIDES_KEY, val);
                return;
            }
            try {
                if (typeof localStorage !== 'undefined') localStorage.setItem(HOVER_GUIDES_KEY, val);
            } catch (e) {}
        },

        loadTooltipOpacity(defaultVal = 94) {
            let val = null;
            if (typeof SafeStorage !== 'undefined') {
                val = SafeStorage.getItem(TOOLTIP_OPACITY_KEY);
            } else {
                try {
                    if (typeof localStorage !== 'undefined') val = localStorage.getItem(TOOLTIP_OPACITY_KEY);
                } catch (e) {}
            }
            const v = parseInt(val, 10);
            return !isNaN(v) && v >= 20 && v <= 100 ? v : defaultVal;
        },

        saveTooltipOpacity(num) {
            if (typeof SafeStorage !== 'undefined') {
                SafeStorage.setItem(TOOLTIP_OPACITY_KEY, String(num));
                return;
            }
            try {
                if (typeof localStorage !== 'undefined') localStorage.setItem(TOOLTIP_OPACITY_KEY, String(num));
            } catch (e) {}
        },

        loadBmiEnabled() {
            let val = null;
            if (typeof SafeStorage !== 'undefined') {
                val = SafeStorage.getItem(BMI_ENABLED_KEY);
            } else {
                try {
                    if (typeof localStorage !== 'undefined') val = localStorage.getItem(BMI_ENABLED_KEY);
                } catch (e) {}
            }
            return val === 'on';
        },

        saveBmiEnabled(on) {
            const val = on ? 'on' : 'off';
            if (typeof SafeStorage !== 'undefined') {
                SafeStorage.setItem(BMI_ENABLED_KEY, val);
                return;
            }
            try {
                if (typeof localStorage !== 'undefined') localStorage.setItem(BMI_ENABLED_KEY, val);
            } catch (e) {}
        },

        loadBmiHeight() {
            let val = null;
            if (typeof SafeStorage !== 'undefined') {
                val = SafeStorage.getItem(BMI_HEIGHT_KEY);
            } else {
                try {
                    if (typeof localStorage !== 'undefined') val = localStorage.getItem(BMI_HEIGHT_KEY);
                } catch (e) {}
            }
            const v = parseFloat(val);
            return !isNaN(v) && v > 0 ? v : null;
        },

        saveBmiHeight(height) {
            if (typeof SafeStorage !== 'undefined') {
                if (height == null) {
                    SafeStorage.remove(BMI_HEIGHT_KEY);
                } else {
                    SafeStorage.setItem(BMI_HEIGHT_KEY, String(height));
                }
                return;
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    if (height == null) {
                        localStorage.removeItem(BMI_HEIGHT_KEY);
                    } else {
                        localStorage.setItem(BMI_HEIGHT_KEY, String(height));
                    }
                }
            } catch (e) {}
        },

        loadLineColor() {
            let val = null;
            if (typeof SafeStorage !== 'undefined') {
                val = SafeStorage.getItem(LINE_COLOR_KEY, 'default');
            } else {
                try {
                    if (typeof localStorage !== 'undefined') val = localStorage.getItem(LINE_COLOR_KEY);
                } catch (e) {}
            }
            return LINE_COLOR_VALUES.includes(val) ? val : 'default';
        },

        saveLineColor(mode) {
            if (typeof SafeStorage !== 'undefined') {
                SafeStorage.setItem(LINE_COLOR_KEY, mode);
                return;
            }
            try {
                if (typeof localStorage !== 'undefined') localStorage.setItem(LINE_COLOR_KEY, mode);
            } catch (e) {}
        },

        loadLineStyle() {
            let val = null;
            if (typeof SafeStorage !== 'undefined') {
                val = SafeStorage.getItem(LINE_STYLE_KEY, 'smooth');
            } else {
                try {
                    if (typeof localStorage !== 'undefined') val = localStorage.getItem(LINE_STYLE_KEY);
                } catch (e) {}
            }
            return LINE_STYLE_VALUES.includes(val) ? val : 'smooth';
        },

        saveLineStyle(mode) {
            if (typeof SafeStorage !== 'undefined') {
                SafeStorage.setItem(LINE_STYLE_KEY, mode);
                return;
            }
            try {
                if (typeof localStorage !== 'undefined') localStorage.setItem(LINE_STYLE_KEY, mode);
            } catch (e) {}
        },

        loadDateAxis() {
            let val = null;
            if (typeof SafeStorage !== 'undefined') {
                val = SafeStorage.getItem(DATE_AXIS_KEY, 'real');
            } else {
                try {
                    if (typeof localStorage !== 'undefined') val = localStorage.getItem(DATE_AXIS_KEY);
                } catch (e) {}
            }
            return DATE_AXIS_VALUES.includes(val) ? val : 'real';
        },

        saveDateAxis(mode) {
            if (typeof SafeStorage !== 'undefined') {
                SafeStorage.setItem(DATE_AXIS_KEY, mode);
                return;
            }
            try {
                if (typeof localStorage !== 'undefined') localStorage.setItem(DATE_AXIS_KEY, mode);
            } catch (e) {}
        }
    };

    if (typeof window !== 'undefined') {
        window.WeightStorage = WeightStorage;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WeightStorage;
    }
})();
