import { generatePuzzle, findHint, isSolved, PEERS, DIFFICULTIES } from './engine.js';

const KEY = 'sudoku.save.v1';
const LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
const UNDO_LIMIT = 100;

const $ = (sel) => document.querySelector(sel);
const boardEl = $('#board');
const statusEl = $('#status');
const diffSel = $('#difficulty');
const notesBtn = $('#notes');
const pauseBtn = $('#pause');
const cells = [];
let S = null; // current game state

// ---------- build the board ----------
for (let i = 0; i < 81; i++) {
  const el = document.createElement('div');
  el.className = 'cell';
  const r = Math.floor(i / 9), c = i % 9;
  if (c === 2 || c === 5) el.classList.add('edge-r');
  if (r === 2 || r === 5) el.classList.add('edge-b');
  el.addEventListener('click', () => select(i));
  boardEl.appendChild(el);
  cells.push(el);
}

document.querySelectorAll('[data-d]').forEach((btn) =>
  btn.addEventListener('click', () => enterDigit(Number(btn.dataset.d))));
$('#undo').addEventListener('click', undo);
$('#hint').addEventListener('click', useHint);
notesBtn.addEventListener('click', toggleNotes);
pauseBtn.addEventListener('click', togglePause);
$('#new').addEventListener('click', newGame);

window.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('select')) return;
  if (/^[1-9]$/.test(e.key)) enterDigit(Number(e.key));
  else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') enterDigit(0);
  else if (e.key === 'n' || e.key === 'N') toggleNotes();
  else if (e.key === 'p' || e.key === 'P') togglePause();
  else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) undo();
  else if (e.key.startsWith('Arrow')) moveSelection(e.key);
  else return;
  e.preventDefault();
});

// Save when the page is hidden (covers switching apps on iPhone).
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

// ---------- state ----------
function newState(difficulty) {
  const { puzzle, solution } = generatePuzzle(difficulty);
  return {
    difficulty,
    puzzle,
    solution,
    board: puzzle.slice(),
    notes: new Array(81).fill(0), // bit d set = pencil mark d
    selected: -1,
    notesMode: false,
    paused: false,
    undo: [],
    hints: 0,
    won: false,
  };
}

function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    const ok = d && [d.board, d.solution, d.puzzle].every((a) => Array.isArray(a) && a.length === 81);
    if (!ok) return null;
    d.notes = Array.isArray(d.notes) && d.notes.length === 81 ? d.notes : new Array(81).fill(0);
    d.undo = Array.isArray(d.undo) ? d.undo : [];
    d.hints = d.hints || 0;
    d.paused = !!d.paused;
    d.selected = -1;
    return d;
  } catch (e) {
    return null;
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage may be blocked; play on */ }
}

function pushUndo() {
  S.undo.push({ board: S.board.slice(), notes: S.notes.slice() });
  if (S.undo.length > UNDO_LIMIT) S.undo.shift();
}

// ---------- actions ----------
function select(i) {
  if (S.paused) return;
  S.selected = i;
  render();
}

function moveSelection(key) {
  const cur = S.selected < 0 ? 0 : S.selected;
  let r = Math.floor(cur / 9), c = cur % 9;
  if (key === 'ArrowUp') r = Math.max(0, r - 1);
  if (key === 'ArrowDown') r = Math.min(8, r + 1);
  if (key === 'ArrowLeft') c = Math.max(0, c - 1);
  if (key === 'ArrowRight') c = Math.min(8, c + 1);
  select(r * 9 + c);
}

function enterDigit(d) {
  const i = S.selected;
  if (i < 0 || S.won || S.paused || S.puzzle[i]) return;
  if (S.notesMode && d) {
    if (S.board[i]) return;
    pushUndo();
    S.notes[i] ^= 1 << d;
  } else {
    // d = 0 erases the value and any pencil marks
    if (S.board[i] === d && !(d === 0 && S.notes[i])) return;
    pushUndo();
    S.board[i] = d;
    S.notes[i] = 0;
  }
  finishMove();
}

function useHint() {
  if (S.won || S.paused) return;
  const h = findHint(S.board, S.solution);
  if (!h) return;
  pushUndo();
  S.board[h.index] = h.value;
  S.notes[h.index] = 0;
  S.selected = h.index;
  S.hints++;
  finishMove();
}

function undo() {
  if (S.paused || !S.undo.length) return;
  const s = S.undo.pop();
  S.board = s.board;
  S.notes = s.notes;
  finishMove();
}

function toggleNotes() {
  if (S.paused) return;
  S.notesMode = !S.notesMode;
  render();
  save();
}

function togglePause() {
  if (S.won) return;
  S.paused = !S.paused;
  render();
  save();
}

function newGame() {
  const hasProgress = !S.won && S.board.some((v, i) => v && !S.puzzle[i]);
  if (hasProgress && !window.confirm('Start a new game? Your current progress will be lost.')) {
    diffSel.value = S.difficulty;
    return;
  }
  S = newState(diffSel.value in DIFFICULTIES ? diffSel.value : 'medium');
  render();
  save();
}

function finishMove() {
  S.won = isSolved(S.board, S.solution);
  render();
  save();
}

// ---------- drawing ----------
function render() {
  const sel = S.selected;
  const selVal = sel >= 0 ? S.board[sel] : 0;
  const peers = new Set(sel >= 0 ? PEERS[sel] : []);
  boardEl.classList.toggle('paused', S.paused);

  for (let i = 0; i < 81; i++) {
    const el = cells[i];
    const v = S.board[i];
    const r = Math.floor(i / 9), c = i % 9;
    let cls = 'cell';
    if (c === 2 || c === 5) cls += ' edge-r';
    if (r === 2 || r === 5) cls += ' edge-b';
    if (S.puzzle[i]) cls += ' given';
    if (!S.paused) {
      if (i === sel) cls += ' sel';
      else if (peers.has(i)) cls += ' peer';
      if (selVal && v === selVal && i !== sel) cls += ' same';
      if (v && v !== S.solution[i]) cls += ' bad';
    }
    el.className = cls;

    if (S.paused) {
      el.textContent = ''; // hide the numbers while paused
    } else if (v) {
      el.textContent = v;
    } else if (S.notes[i]) {
      el.innerHTML = '<div class="notes">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<span>${S.notes[i] & (1 << d) ? d : ''}</span>`).join('') +
        '</div>';
    } else {
      el.textContent = '';
    }
  }

  pauseBtn.textContent = S.paused ? 'Resume' : 'Pause';
  pauseBtn.setAttribute('aria-pressed', String(S.paused));
  notesBtn.classList.toggle('on', S.notesMode);
  notesBtn.setAttribute('aria-pressed', String(S.notesMode));

  if (S.won) {
    statusEl.textContent = 'Solved! Nice work. Start a new game when you\'re ready.';
  } else if (S.paused) {
    statusEl.textContent = `${LABEL[S.difficulty]} · Paused. Tap Resume to carry on.`;
  } else {
    const mode = S.notesMode ? ' · Notes on' : '';
    statusEl.textContent = `${LABEL[S.difficulty]} · Hints ${S.hints}${mode}`;
  }
}

// ---------- start ----------
S = loadSave() || newState('medium');
diffSel.value = S.difficulty;
render();
