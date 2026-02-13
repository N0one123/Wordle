import { isValidGuess, getRandomAnswer } from './dictionary.js';

const MAX_ROWS = 6;
const WORD_LENGTH = 5;
const STORAGE_KEY = 'wordle-state-v1';

const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const statusEl = document.getElementById('status');
const newGameButton = document.getElementById('new-game');

const keyboardLayout = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace']
];

const statePriority = { absent: 1, present: 2, correct: 3 };

let state = createNewState();
let tiles = [];

function createNewState() {
  return {
    answer: getRandomAnswer(),
    guesses: Array.from({ length: MAX_ROWS }, () => Array(WORD_LENGTH).fill('')),
    evaluations: Array.from({ length: MAX_ROWS }, () => Array(WORD_LENGTH).fill('empty')),
    currentRow: 0,
    currentCol: 0,
    status: 'active',
    keyStates: {}
  };
}

function buildBoard() {
  boardEl.innerHTML = '';
  tiles = Array.from({ length: MAX_ROWS }, (_, rowIndex) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('aria-label', `Guess row ${rowIndex + 1}`);

    const rowTiles = Array.from({ length: WORD_LENGTH }, (_, colIndex) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.state = 'empty';
      tile.textContent = '';
      tile.setAttribute('aria-label', `Row ${rowIndex + 1} column ${colIndex + 1}, empty`);
      row.append(tile);
      return tile;
    });

    boardEl.append(row);
    return rowTiles;
  });
}

function buildKeyboard() {
  keyboardEl.innerHTML = '';
  keyboardLayout.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';
    row.forEach((keyValue) => {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'key';
      if (keyValue === 'enter' || keyValue === 'backspace') {
        key.classList.add('wide');
      }
      key.dataset.key = keyValue;
      key.textContent = keyValue === 'backspace' ? '⌫' : keyValue;
      key.setAttribute('aria-label', `Key ${keyValue}`);
      key.addEventListener('click', () => handleKeyInput(keyValue));
      rowEl.append(key);
    });
    keyboardEl.append(rowEl);
  });
}

function render() {
  for (let row = 0; row < MAX_ROWS; row += 1) {
    for (let col = 0; col < WORD_LENGTH; col += 1) {
      const tile = tiles[row][col];
      const letter = state.guesses[row][col];
      const evalState = state.evaluations[row][col];
      tile.textContent = letter;

      if (evalState === 'empty') {
        tile.dataset.state = letter ? 'filled' : 'empty';
      } else {
        tile.dataset.state = evalState;
      }

      const statusText = letter || 'empty';
      tile.setAttribute('aria-label', `Row ${row + 1} column ${col + 1}, ${statusText}`);
    }
  }

  document.querySelectorAll('.key').forEach((keyEl) => {
    const key = keyEl.dataset.key;
    const keyState = state.keyStates[key];
    keyEl.dataset.state = keyState || '';
  });

  persistState();
}

function setStatus(message) {
  statusEl.textContent = message;
}

function handleKeyInput(key) {
  if (state.status !== 'active') {
    return;
  }

  if (/^[a-z]$/i.test(key)) {
    if (state.currentCol < WORD_LENGTH) {
      state.guesses[state.currentRow][state.currentCol] = key.toUpperCase();
      state.currentCol += 1;
    }
    render();
    return;
  }

  if (key.toLowerCase() === 'backspace') {
    if (state.currentCol > 0) {
      state.currentCol -= 1;
      state.guesses[state.currentRow][state.currentCol] = '';
    }
    render();
    return;
  }

  if (key.toLowerCase() === 'enter') {
    submitGuess();
  }
}

function getLetterCounts(word) {
  return [...word].reduce((acc, letter) => {
    acc[letter] = (acc[letter] || 0) + 1;
    return acc;
  }, {});
}

function scoreGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill('absent');
  const remainingCounts = getLetterCounts(answer);

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
      remainingCounts[guess[i]] -= 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i += 1) {
    if (result[i] === 'correct') {
      continue;
    }

    const letter = guess[i];
    if (remainingCounts[letter] > 0) {
      result[i] = 'present';
      remainingCounts[letter] -= 1;
    }
  }

  return result;
}

function updateKeyboardStates(guessLetters, scoredStates) {
  guessLetters.forEach((letter, index) => {
    const newState = scoredStates[index];
    const keyLetter = letter.toLowerCase();
    const currentState = state.keyStates[keyLetter];
    if (!currentState || statePriority[newState] > statePriority[currentState]) {
      state.keyStates[keyLetter] = newState;
    }
  });
}

function submitGuess() {
  if (state.currentCol < WORD_LENGTH) {
    setStatus('Not enough letters.');
    return;
  }

  const guess = state.guesses[state.currentRow].join('');
  if (!isValidGuess(guess)) {
    setStatus('Word is not in the list.');
    return;
  }

  const scored = scoreGuess(guess, state.answer);
  state.evaluations[state.currentRow] = scored;
  updateKeyboardStates([...guess], scored);

  if (guess === state.answer) {
    state.status = 'won';
    setStatus('You got it! 🎉');
    render();
    return;
  }

  state.currentRow += 1;
  state.currentCol = 0;

  if (state.currentRow >= MAX_ROWS) {
    state.status = 'lost';
    setStatus(`Game over. The word was ${state.answer.toUpperCase()}.`);
    render();
    return;
  }

  setStatus('');
  render();
}

function onPhysicalKeydown(event) {
  const key = event.key;

  if (/^[a-z]$/i.test(key) || key === 'Enter' || key === 'Backspace') {
    event.preventDefault();
    handleKeyInput(key.toLowerCase());
  }
}


function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function persistState() {
  const payload = {
    ...state,
    dayKey: getLocalDayKey()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadPersistedState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const todayKey = getLocalDayKey();

    if (parsed.dayKey !== todayKey || !parsed.answer) {
      return null;
    }

    return {
      answer: parsed.answer,
      guesses: parsed.guesses,
      evaluations: parsed.evaluations,
      currentRow: parsed.currentRow,
      currentCol: parsed.currentCol,
      status: parsed.status,
      keyStates: parsed.keyStates || {}
    };
  } catch {
    return null;
  }
}

function startNewGame() {
  state = createNewState();
  setStatus('New game started.');
  render();
}

function init() {
  buildBoard();
  buildKeyboard();

  const persisted = loadPersistedState();
  if (persisted) {
    state = persisted;
    setStatus(state.status === 'active' ? 'Restored your game.' : 'Restored completed game.');
  } else {
    setStatus('Guess the Wordle in 6 tries.');
  }

  newGameButton.addEventListener('click', startNewGame);
  document.addEventListener('keydown', onPhysicalKeydown);

  render();
}

init();

export { scoreGuess };
