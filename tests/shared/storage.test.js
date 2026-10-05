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
            }
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

    it('should handle missing localStorage without throwing', () => {
        delete global.localStorage;
        expect(SafeStorage.get('key', 'def')).toBe('def');
        expect(SafeStorage.set('key', 123)).toBe(false);
        expect(() => SafeStorage.remove('key')).not.toThrow();
        expect(() => SafeStorage.clear()).not.toThrow();
    });
});
