const { describe, it, expect } = require('../test-utils.js');
const {
    initialState, generateLegalMoves, isInCheck, dropRejectionReason,
    aiChooseMove, ROWS, COLS
} = require('../../shogi/js/engine.js');

describe('Shogi Engine', () => {
    it('initializes standard 9x9 board with 40 pieces and turn 1', () => {
        const state = initialState();
        expect(state.board.length).toBe(ROWS * COLS);
        expect(state.turn).toBe(1);

        // Check Sente and Gote King positions
        expect(state.at(8, 4)).toEqual({ t: '王', p: false, o: 1 });
        expect(state.at(0, 4)).toEqual({ t: '王', p: false, o: 2 });

        // Check empty hands
        expect(state.hands[1]['步']).toBe(0);
        expect(state.hands[2]['步']).toBe(0);
    });

    it('generates legal moves for opening position', () => {
        const state = initialState();
        const moves = generateLegalMoves(state);
        expect(moves.length).toBe(30);
        expect(moves.every(m => m.from !== -1)).toBe(true);
    });

    it('makes and unmakes a move accurately', () => {
        const state = initialState();
        const moves = generateLegalMoves(state);
        const firstMove = moves[0];

        const undoInfo = state.makeMove(firstMove);
        expect(state.turn).toBe(2);

        state.unmakeMove(undoInfo);
        expect(state.turn).toBe(1);
        expect(state.board[firstMove.from]).not.toBeNull();
    });

    it('prevents Nifu (二步) drop violation', () => {
        const state = initialState();
        state.hands[1]['步'] = 1;

        // Column 0 already has a Sente pawn at row 6
        const reason = dropRejectionReason(state, 1, '步', 5, 0);
        expect(reason).toBe('二步禁手：这一列已有己方步兵');
    });

    it('prevents dropping pawn to dead-end row (last row)', () => {
        const state = initialState();
        state.hands[1]['步'] = 1;
        state.set(6, 1, null); // Clear existing pawn in column 1 so Nifu doesn't trigger first
        state.set(0, 1, null); // Clear square to test move rule, not piece collision

        // Row 0 is the farthest row for Sente, pawn cannot move forward from there
        const reason = dropRejectionReason(state, 1, '步', 0, 1);
        expect(reason).toBe('步兵不能打入最后一行（将无法移动）');
    });

    it('detects check status correctly', () => {
        const state = initialState();
        expect(isInCheck(state, 1)).toBe(false);
        expect(isInCheck(state, 2)).toBe(false);
    });

    it('runs AI move search without error', () => {
        const state = initialState();
        const result = aiChooseMove(state, { timeLimit: 100, depth: 1, random: false });
        expect(result).toBeDefined();
        expect(result.move).toBeDefined();
        expect(result.move.from).toBeDefined();
        expect(result.move.to).toBeDefined();
    });
});
