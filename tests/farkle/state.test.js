const { describe, it, expect } = require('../test-utils.js');
const {
    state,
    fxFor,
    generateAiDice,
    loadStoredDefaultDice,
    saveStoredDefaultDice,
    loadStoredUseDefault,
    saveStoredUseDefault
} = require('../../farkle/js/state.js');

describe('Farkle State Module', () => {
    it('initializes game state with expected default values', () => {
        expect(state.target).toBe(1500);
        expect(state.phase).toBe('setup');
        expect(state.current).toBe('me');
        expect(state.scores).toEqual({ me: 0, ai: 0 });
        expect(state.turnPoints).toBe(0);
        expect(state.badges).toEqual({ me: null, ai: null });
        expect(state.playerDice.length).toBe(6);
        expect(state.aiDice.length).toBe(6);
    });

    it('generates 6 dice for AI with valid ordinary or special dice ids', () => {
        const dice = generateAiDice();
        expect(Array.isArray(dice)).toBe(true);
        expect(dice.length).toBe(6);
        // All dice should be strings
        expect(dice.every((id) => typeof id === 'string')).toBe(true);
    });

    it('resolves formation and emperor badge effects via fxFor', () => {
        // No badge
        state.badges.me = null;
        expect(fxFor('me')).toBeNull();

        // Cancelled badge
        state.badges.me = { type: 'formation', formation: 'cut', value: 50, cancelled: true };
        expect(fxFor('me')).toBeNull();

        // Active formation badge
        state.badges.me = { type: 'formation', formation: 'cut', value: 50, cancelled: false };
        expect(fxFor('me')).toEqual({ cut: 50 });

        // Active emperor badge
        state.badges.ai = { type: 'emperor', cancelled: false };
        expect(fxFor('ai')).toEqual({ emperor: true });
    });

    it('handles storage load and save defaults without crashing', () => {
        expect(loadStoredUseDefault()).toBe(true);
        saveStoredUseDefault(false);
        const defaultDice = loadStoredDefaultDice();
        expect(defaultDice.length).toBe(6);
        saveStoredDefaultDice(defaultDice);
    });
});
