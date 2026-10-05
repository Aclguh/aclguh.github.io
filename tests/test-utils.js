const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

function expect(actual) {
    return {
        toBe(expected) {
            assert.strictEqual(actual, expected);
        },
        toEqual(expected) {
            assert.deepStrictEqual(actual, expected);
        },
        toBeNull() {
            assert.strictEqual(actual, null);
        },
        toBeDefined() {
            assert.notStrictEqual(actual, undefined);
        },
        toContain(expected) {
            if (typeof actual === 'string' || Array.isArray(actual)) {
                assert.ok(actual.includes(expected), `Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
            } else {
                throw new Error(`toContain not supported on ${typeof actual}`);
            }
        },
        toBeGreaterThan(expected) {
            assert.ok(actual > expected, `Expected ${actual} > ${expected}`);
        },
        not: {
            toBe(expected) {
                assert.notStrictEqual(actual, expected);
            },
            toBeNull() {
                assert.notStrictEqual(actual, null);
            },
            toContain(expected) {
                if (typeof actual === 'string' || Array.isArray(actual)) {
                    assert.ok(!actual.includes(expected), `Expected ${JSON.stringify(actual)} to NOT contain ${JSON.stringify(expected)}`);
                }
            },
            toThrow() {
                assert.doesNotThrow(actual);
            }
        },
        toThrow(expected) {
            assert.throws(actual, expected);
        }
    };
}

module.exports = { describe, it, beforeEach, afterEach, expect, assert };
