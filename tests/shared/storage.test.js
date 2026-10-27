const { describe, it, expect, beforeEach, afterEach } = require('../test-utils.js');
const { SafeStorage } = require('../../shared/js/storage.js');

describe('SafeStorage', () => {
    let mockStorage = {};

    beforeEach(() => {
        mockStorage = {};
        global.localStorage = {
            getItem: (key) => (key in mockStorage ? mockStorage[key] : null),
            setItem: (key, val) => {
                if (key === 'THROW_QUOTA') {
                    const err = new Error('Quota exceeded');
                    err.name = 'QuotaExceededError';
                    throw err;
                }
                mockStorage[key] = String(val);
            },
            removeItem: (key) => {
                delete mockStorage[key];
            },
            clear: () => {
                mockStorage = {};
            },
            get length() {
                return Object.keys(mockStorage).length;
            },
            key: (i) => Object.keys(mockStorage)[i] || null
        };
    });

    afterEach(() => {
        delete global.localStorage;
    });

    it('should set and get values with serialization', () => {
        const data = { theme: 'dark', count: 42, list: [1, 2, 3] };
        const ok = SafeStorage.set('test_key', data);
        expect(ok).toBe(true);

        const loaded = SafeStorage.get('test_key');
        expect(loaded).toEqual(data);
    });

    it('should return default value when key does not exist', () => {
        const val = SafeStorage.get('non_existent', 'my-default');
        expect(val).toBe('my-default');
    });

    it('should return default value when parsing corrupt json', () => {
        mockStorage['corrupt'] = '{invalid json';
        const val = SafeStorage.get('corrupt', { fallback: true });
        expect(val).toEqual({ fallback: true });
    });

    it('should safely handle QuotaExceededError on set', () => {
        const ok = SafeStorage.set('THROW_QUOTA', { big: 'data' });
        expect(ok).toBe(false);
    });

    it('should remove and clear items properly', () => {
        SafeStorage.set('k1', 1);
        SafeStorage.set('k2', 2);
        expect(SafeStorage.get('k1')).toBe(1);

        SafeStorage.remove('k1');
        expect(SafeStorage.get('k1')).toBe(null);
        expect(SafeStorage.get('k2')).toBe(2);

        SafeStorage.clear();
        expect(SafeStorage.get('k2')).toBe(null);
    });

    it('should handle raw string items and has check', () => {
        expect(SafeStorage.has('str_key')).toBe(false);
        SafeStorage.setItem('str_key', 'plain_text');
        expect(SafeStorage.has('str_key')).toBe(true);
        expect(SafeStorage.getItem('str_key')).toBe('plain_text');
        expect(SafeStorage.getItem('non_key', 'default_str')).toBe('default_str');
    });

    it('should support createNamespace isolation', () => {
        const ns1 = SafeStorage.createNamespace('app1:');
        const ns2 = SafeStorage.createNamespace('app2:');

        ns1.set('val', { name: 'app1' });
        ns2.set('val', { name: 'app2' });

        expect(ns1.get('val')).toEqual({ name: 'app1' });
        expect(ns2.get('val')).toEqual({ name: 'app2' });
        expect(SafeStorage.get('app1:val')).toEqual({ name: 'app1' });

        ns1.remove('val');
        expect(ns1.has('val')).toBe(false);
        expect(ns2.has('val')).toBe(true);
    });

    it('should support generateId with optional prefix', () => {
        const id1 = SafeStorage.generateId();
        const id2 = SafeStorage.generateId('prefix');
        expect(typeof id1).toBe('string');
        expect(id1.length).toBeGreaterThan(6);
        expect(id2.startsWith('prefix_')).toBe(true);
        expect(id1).not.toBe(id2);
    });

    it('should support defineSchema and execute migration when version is bumped', () => {
        SafeStorage.set('app_config', { oldField: 'value1' });

        SafeStorage.defineSchema('app_config', {
            version: 2,
            migrate: (oldData, oldVer) => {
                expect(oldVer).toBe(0);
                return { newField: oldData.oldField, upgraded: true };
            }
        });

        const upgraded = SafeStorage.get('app_config');
        expect(upgraded.upgraded).toBe(true);
        expect(upgraded.newField).toBe('value1');
        expect(SafeStorage.getItem('__schema_ver_app_config')).toBe('2');
    });

    it('should support exportAll and importAll across storage namespaces', () => {
        SafeStorage.set('key1', { a: 1 });
        SafeStorage.setItem('key2', 'string_val');

        const exported = SafeStorage.exportAll();
        expect(exported.version).toBe(1);
        expect(exported.data.key1).toBe(JSON.stringify({ a: 1 }));
        expect(exported.data.key2).toBe('string_val');

        // 清空后再通过 importAll 还原
        SafeStorage.clear();
        expect(SafeStorage.has('key1')).toBe(false);

        const ok = SafeStorage.importAll(exported, 'replace');
        expect(ok).toBe(true);
        expect(SafeStorage.get('key1')).toEqual({ a: 1 });
        expect(SafeStorage.getItem('key2')).toBe('string_val');
    });

    it('should handle missing localStorage without throwing', () => {
        delete global.localStorage;
        expect(SafeStorage.get('key', 'def')).toBe('def');
        expect(SafeStorage.getItem('key', 'def')).toBe('def');
        expect(SafeStorage.set('key', 123)).toBe(false);
        expect(SafeStorage.setItem('key', 'str')).toBe(false);
        expect(SafeStorage.has('key')).toBe(false);
        expect(() => SafeStorage.remove('key')).not.toThrow();
        expect(() => SafeStorage.clear()).not.toThrow();
    });
});
