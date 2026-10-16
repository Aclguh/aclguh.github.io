/**
 * 体重记录 - 数据持久化层
 * 接入统一 SafeStorage，提供容错与命名空间隔离
 */

const STORAGE_KEY = 'weight_records';
const HOVER_GUIDES_KEY = 'weight_hover_guides';
const TOOLTIP_OPACITY_KEY = 'weight_tooltip_opacity';
const BMI_ENABLED_KEY = 'weight_bmi_enabled';
const BMI_HEIGHT_KEY = 'weight_bmi_height';
const LINE_COLOR_KEY = 'weight_line_color';
const LINE_STYLE_KEY = 'weight_line_style';
const DATE_AXIS_KEY = 'weight_date_axis';

const WeightStorage = {
    loadRecords() {
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.get(STORAGE_KEY, []);
        }
        return [];
    },

    saveRecords(records) {
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.set(STORAGE_KEY, records);
        }
        return false;
    },

    clearRecords() {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.remove(STORAGE_KEY);
        }
    },

    loadHoverGuides() {
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.getItem(HOVER_GUIDES_KEY) !== 'off';
        }
        return true;
    },

    saveHoverGuides(on) {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(HOVER_GUIDES_KEY, on ? 'on' : 'off');
        }
    },

    loadTooltipOpacity(defaultVal = 94) {
        if (typeof SafeStorage !== 'undefined') {
            const v = parseInt(SafeStorage.getItem(TOOLTIP_OPACITY_KEY), 10);
            return !isNaN(v) && v >= 20 && v <= 100 ? v : defaultVal;
        }
        return defaultVal;
    },

    saveTooltipOpacity(num) {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(TOOLTIP_OPACITY_KEY, String(num));
        }
    },

    loadBmiEnabled() {
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.getItem(BMI_ENABLED_KEY) === 'on';
        }
        return false;
    },

    saveBmiEnabled(on) {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(BMI_ENABLED_KEY, on ? 'on' : 'off');
        }
    },

    loadBmiHeight() {
        if (typeof SafeStorage !== 'undefined') {
            const v = parseFloat(SafeStorage.getItem(BMI_HEIGHT_KEY));
            return !isNaN(v) && v > 0 ? v : null;
        }
        return null;
    },

    saveBmiHeight(height) {
        if (typeof SafeStorage !== 'undefined') {
            if (height == null) {
                SafeStorage.remove(BMI_HEIGHT_KEY);
            } else {
                SafeStorage.setItem(BMI_HEIGHT_KEY, String(height));
            }
        }
    },

    loadLineColor() {
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.getItem(LINE_COLOR_KEY, 'gradient');
        }
        return 'gradient';
    },

    saveLineColor(mode) {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(LINE_COLOR_KEY, mode);
        }
    },

    loadLineStyle() {
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.getItem(LINE_STYLE_KEY, 'smooth');
        }
        return 'smooth';
    },

    saveLineStyle(mode) {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(LINE_STYLE_KEY, mode);
        }
    },

    loadDateAxis() {
        if (typeof SafeStorage !== 'undefined') {
            return SafeStorage.getItem(DATE_AXIS_KEY, 'recorded');
        }
        return 'recorded';
    },

    saveDateAxis(mode) {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.setItem(DATE_AXIS_KEY, mode);
        }
    }
};

if (typeof window !== 'undefined') {
    window.WeightStorage = WeightStorage;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeightStorage;
}
