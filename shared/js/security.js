/**
 * 通用安全与转义工具
 */

const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * 安全转义 HTML 字符串（同时适用于正文与 HTML 标签属性值）
 * @param {*} str - 待转义内容
 * @returns {string} 转义后的安全字符串
 */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, function (char) {
        return HTML_ESCAPE_MAP[char];
    });
}

/**
 * 属性值转义（别名）
 */
function escapeAttr(str) {
    return escapeHtml(str);
}

// 兼容全局函数引用与 ES Modules / CommonJS
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.escapeAttr = escapeAttr;
    window.escapeHTML = escapeHtml; // 兼容 camelCase / UPPERCASE 各种写法
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml, escapeAttr };
}
