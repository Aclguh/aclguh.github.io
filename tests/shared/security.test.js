const { describe, it, expect } = require('../test-utils.js');
const { escapeHtml, escapeAttr } = require('../../shared/js/security.js');

describe('Security: escapeHtml & escapeAttr', () => {
    it('应正确转义 HTML 基础特殊字符 <, >, &', () => {
        expect(escapeHtml('<div>&amp;</div>')).toBe('&lt;div&gt;&amp;amp;&lt;/div&gt;');
    });

    it('应严格转义双引号和单引号，防止属性注入', () => {
        const injected = 'My Anime" onmouseover="alert(1)"';
        const escaped = escapeHtml(injected);
        expect(escaped).toBe('My Anime&quot; onmouseover=&quot;alert(1)&quot;');
        expect(escaped).not.toContain('"');
    });

    it('处理 null, undefined, 数字与空字符串', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml('')).toBe('');
        expect(escapeHtml(123)).toBe('123');
    });
});
