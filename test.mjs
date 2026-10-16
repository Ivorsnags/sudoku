import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePuzzle, generateSolution, solve, countSolutions, findHint, DIFFICULTIES, UNITS,
} from './engine.js';

const isValidFull = (g) =>
  UNITS.every((u) => new Set(u.map((i) => g[i])).size === 9 && u.every((i) => g[i] >= 1 && g[i] <= 9));

test('generated solutions are valid full grids', () => {
  for (let k = 0; k < 20; k++) assert.ok(isValidFull(generateSolution()));
});

test('solver counts solutions correctly', () => {
  assert.equal(countSolutions(new Array(81).fill(0), 2), 2); // empty grid has many solutions
  const full = generateSolution();
  assert.equal(countSolutions(full, 2), 1);
});

test('every difficulty gives a unique, consistent puzzle with enough clues', () => {
  for (const d of Object.keys(DIFFICULTIES)) {
    for (let k = 0; k < 3; k++) {
      const { puzzle, solution } = generatePuzzle(d);
      assert.ok(isValidFull(solution), `${d}: solution invalid`);
      assert.equal(countSolutions(puzzle, 2), 1, `${d}: puzzle not unique`);
      puzzle.forEach((v, i) => { if (v) assert.equal(v, solution[i], `${d}: clue mismatch`); });
      const clues = puzzle.filter(Boolean).length;
      assert.ok(clues >= DIFFICULTIES[d].clues, `${d}: only ${clues} clues`);
      assert.deepEqual(solve(puzzle), solution);
    }
  }
});

test('hints are always correct and can finish a puzzle', () => {
  const { puzzle, solution } = generatePuzzle('expert');
  const board = puzzle.slice();
  let guard = 0;
  let h;
  while ((h = findHint(board, solution)) && guard++ < 81) {
    assert.equal(h.value, solution[h.index]);
    assert.equal(board[h.index], 0);
    board[h.index] = h.value;
  }
  assert.deepEqual(board, solution);
});

test('hint corrects a wrong entry first', () => {
  const { puzzle, solution } = generatePuzzle('easy');
  const board = puzzle.slice();
  const empty = board.findIndex((v) => v === 0);
  board[empty] = solution[empty] === 1 ? 2 : 1; // deliberately wrong
  const h = findHint(board, solution);
  assert.equal(h.kind, 'fix');
  assert.equal(h.index, empty);
  assert.equal(h.value, solution[empty]);
});
