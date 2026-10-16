// Sudoku engine: candidates, solver, generator and hints. No DOM, so it runs in the browser and in Node.

export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ALL = 0x3fe; // bits 1..9 set

export const ROWS = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c));
export const COLS = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c));
export const BOXES = Array.from({ length: 9 }, (_, b) => {
  const top = Math.floor(b / 3) * 3;
  const left = (b % 3) * 3;
  const out = [];
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) out.push((top + dr) * 9 + left + dc);
  return out;
});
export const UNITS = [...ROWS, ...COLS, ...BOXES];

// For each cell, the 20 other cells that share a row, column or box.
export const PEERS = Array.from({ length: 81 }, (_, i) => {
  const set = new Set();
  for (const u of UNITS) if (u.includes(i)) for (const j of u) if (j !== i) set.add(j);
  return [...set];
});

export const DIFFICULTIES = {
  easy: { clues: 38 },
  medium: { clues: 32 },
  hard: { clues: 27 },
  expert: { clues: 23 },
};

const popcount = (m) => {
  let n = 0;
  while (m) { m &= m - 1; n++; }
  return n;
};

const maskToDigits = (m) => DIGITS.filter((d) => m & (1 << d));

// Digits that can still go in cell i, given the current grid (bit d set = d possible).
export function candidatesMask(grid, i) {
  let used = 0;
  for (const p of PEERS[i]) used |= 1 << grid[p];
  return ALL & ~used;
}

// Pick the empty cell with the fewest candidates.
// Returns best = -1 when the grid is full, bestN = 0 when some cell is a dead end.
function pickCell(grid) {
  let best = -1, bestMask = 0, bestN = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const m = candidatesMask(grid, i);
    const n = popcount(m);
    if (n < bestN) {
      best = i; bestMask = m; bestN = n;
      if (n <= 1) break;
    }
  }
  return { best, bestMask, bestN };
}

// Fills grid in place. With rng, digits are tried in random order. Returns true on success.
function search(grid, rng) {
  const { best, bestMask, bestN } = pickCell(grid);
  if (best < 0) return true;
  if (bestN === 0) return false;
  let digits = maskToDigits(bestMask);
  if (rng) digits = shuffle(digits, rng);
  for (const d of digits) {
    grid[best] = d;
    if (search(grid, rng)) return true;
  }
  grid[best] = 0;
  return false;
}

// Counts solutions, stopping at `limit`. Used to check uniqueness.
export function countSolutions(grid, limit = 2) {
  const g = Array.from(grid);
  let count = 0;
  const rec = () => {
    const { best, bestMask, bestN } = pickCell(g);
    if (best < 0) { count++; return; }
    if (bestN === 0) return;
    for (const d of maskToDigits(bestMask)) {
      g[best] = d;
      rec();
      if (count >= limit) break;
    }
    g[best] = 0;
  };
  rec();
  return count;
}

// Returns a solved copy of grid, or null if it has no solution.
export function solve(grid) {
  const g = Array.from(grid);
  return search(g, null) ? g : null;
}

export function generateSolution(rng = Math.random) {
  const g = new Array(81).fill(0);
  search(g, rng);
  return g;
}

export function generatePuzzle(difficulty = 'medium', rng = Math.random) {
  const target = DIFFICULTIES[difficulty].clues;
  const solution = generateSolution(rng);
  const puzzle = solution.slice();
  let clues = 81;
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k), rng)) {
    if (clues <= target) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) === 1) clues--;
    else puzzle[i] = keep; // removing it would make the puzzle ambiguous
  }
  return { puzzle, solution, difficulty };
}

// Suggests one move. Every suggestion is checked against the solution, so hints are never wrong.
// Returns { index, value, kind } or null when there is nothing left to fill.
export function findHint(board, solution) {
  // 1) A wrong entry the player made: correct it first.
  for (let i = 0; i < 81; i++) {
    if (board[i] && board[i] !== solution[i]) return { index: i, value: solution[i], kind: 'fix' };
  }
  // 2) Naked single: only one digit fits this cell.
  for (let i = 0; i < 81; i++) {
    if (board[i]) continue;
    const m = candidatesMask(board, i);
    if (popcount(m) === 1) {
      const d = Math.round(Math.log2(m));
      if (solution[i] === d) return { index: i, value: d, kind: 'single' };
    }
  }
  // 3) Hidden single: a digit fits only one cell in a row, column or box.
  for (const u of UNITS) {
    for (const d of DIGITS) {
      if (u.some((i) => board[i] === d)) continue;
      const spots = u.filter((i) => !board[i] && (candidatesMask(board, i) & (1 << d)));
      if (spots.length === 1 && solution[spots[0]] === d) return { index: spots[0], value: d, kind: 'hidden' };
    }
  }
  // 4) Fallback: reveal the first empty cell.
  for (let i = 0; i < 81; i++) {
    if (!board[i]) return { index: i, value: solution[i], kind: 'reveal' };
  }
  return null;
}

export function isSolved(board, solution) {
  return board.every((v, i) => v === solution[i]);
}

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
