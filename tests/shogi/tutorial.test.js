const { describe, it, expect } = require('../test-utils.js');
const engine = require('../../shogi/js/engine.js');

// Mock browser globals for tutorial.js in Node environment
global.GameState = engine.GameState;
global.initialState = engine.initialState;
global.FULL_NAME = engine.FULL_NAME;
global.PROMOTED_NAME = engine.PROMOTED_NAME;
global.movePattern = function () {
    return { steps: [[-1, 0]], slides: [] };
};
global.game = {
    state: null,
    searchToken: 0,
    selected: null,
    over: null,
    thinking: false,
    hint: false,
    demo: null,
    showZones: false,
    undoStack: [],
    keys: [],
    keyCounts: {},
    anim: null,
    moveLog: [],
    mode: 'ai'
};
global.render = function () {};
global.renderLog = function () {};
global.recordKey = function () {};
global.refreshTurn = function () {};
global.toast = function () {};
global.newGame = function () {};
global.document = {
    getElementById: function () {
        return { textContent: '', innerHTML: '', style: {}, disabled: false };
    }
};

const tutorial = require('../../shogi/js/tutorial.js');

describe('Shogi Tutorial Module', () => {
    it('defines 7 step tutorials with valid titles and ids', () => {
        expect(tutorial.TSTEPS.length).toBe(7);
        expect(tutorial.TSTEPS[0].id).toBe('board');
        expect(tutorial.TSTEPS[6].id).toBe('mate');
    });

    it('sets up positions for interactive steps properly', () => {
        // Step 3 (move)
        tutorial.TSTEPS[2].setup();
        expect(global.game.state).not.toBeNull();
        expect(global.game.state.turn).toBe(1);

        // Step 4 (capture)
        tutorial.TSTEPS[3].setup();
        expect(global.game.state.at(4, 4)).toEqual({ t: '飞', o: 1, p: false });
        expect(global.game.state.at(4, 7)).toEqual({ t: '银', o: 2, p: false });

        // Step 4 verification logic
        const checkResult = tutorial.TSTEPS[3].check({}, { captured: { t: '银' } });
        expect(checkResult).toBe(true);
    });

    it('verifies check and promote in tutorial steps', () => {
        // Step 5 (promote)
        expect(tutorial.TSTEPS[4].check({}, { promoted: true })).toBe(true);
        expect(tutorial.TSTEPS[4].check({}, { promoted: false })).toBe(false);

        // Step 6 (drop)
        expect(tutorial.TSTEPS[5].check({ drop: true })).toBe(true);
        expect(tutorial.TSTEPS[5].check({ drop: false })).toBe(false);

        // Step 7 (mate)
        expect(tutorial.TSTEPS[6].check({}, { gameOver: true, winner: 1 })).toBe(true);
        expect(tutorial.TSTEPS[6].check({}, { gameOver: false, winner: 1 })).toBe(false);
    });
});
