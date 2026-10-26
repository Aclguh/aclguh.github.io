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

/**
 * 安全过滤与校验 URL，防御 javascript: 等伪协议注入
 * 仅允许 http:, https:, mailto:, tel:, 以及安全相对路径或安全图片 data:image/
 * @param {*} url - 待检测的 URL 字符串
 * @param {string} [fallback=''] - 非法 URL 时的回退值，默认为空串
 * @returns {string} 经过安全校验与转义后的 URL 字符串
 */
function sanitizeUrl(url, fallback = '') {
    if (url == null) return fallback;
    const str = String(url).trim();
    if (!str) return fallback;

    // 过滤带有 ASCII 控制字符或换行的隐蔽伪协议攻击
    // eslint-disable-next-line no-control-regex
    const cleanStr = str.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // 允许安全协议及相对路径
    const SAFE_URL_PATTERN = /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;

    // 拦截明确危险伪协议
    if (/^(?:javascript|vbscript|file):/i.test(cleanStr)) {
        return fallback;
    }

    if (
        cleanStr.startsWith('/') ||
        cleanStr.startsWith('./') ||
        cleanStr.startsWith('../') ||
        cleanStr.startsWith('#') ||
        cleanStr.startsWith('?') ||
        SAFE_URL_PATTERN.test(cleanStr)
    ) {
        return escapeAttr(cleanStr);
    }

    return fallback;
}

// 兼容全局函数引用与 ES Modules / CommonJS
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.escapeAttr = escapeAttr;
    window.escapeHTML = escapeHtml; // 兼容 camelCase / UPPERCASE 各种写法
    window.sanitizeUrl = sanitizeUrl;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml, escapeAttr, sanitizeUrl };
}
