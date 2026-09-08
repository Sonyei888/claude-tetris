'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const HIGHSCORES_KEY = 'tetris.highscores';
const MAX_HIGHSCORES = 5;

// Paleta desaturada/aclarada para el skin "pastel" (misma forma que COLORS).
const PASTEL_COLORS = [
  null,
  '#a8e6e8', // I
  '#fff2b8', // O
  '#dcb8e0', // T
  '#c3e8c5', // S
  '#f2b8b8', // Z
  '#c0c6ea', // J
  '#ffdcb0', // L
];

const THEMES = {
  retro: {
    colors: COLORS,
    background: '#1a1a25',
    grid: '#22222e',
    // Nota: el wrapper drawBlock() ya se encarga de globalAlpha; estos
    // métodos solo dibujan.
    drawBlock(context, x, y, colorIndex, size) {
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    colors: COLORS,
    background: '#000000',
    grid: '#0a1a1a',
    drawBlock(context, x, y, colorIndex, size) {
      const color = this.colors[colorIndex];
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // el shadowBlur se queda "pegado" en el contexto: resetear ya mismo.
      context.shadowBlur = 0;
    },
  },
  pastel: {
    colors: PASTEL_COLORS,
    background: '#fdf6f0',
    grid: '#ecdfe0',
    drawBlock(context, x, y, colorIndex, size) {
      context.fillStyle = this.colors[colorIndex];
      const rx = x * size + 1, ry = y * size + 1, rs = size - 2;
      if (context.roundRect) {
        context.beginPath();
        context.roundRect(rx, ry, rs, rs, 6);
        context.fill();
      } else {
        // ponytail: fallback para navegadores sin roundRect() (Safari <16).
        context.fillRect(rx, ry, rs, rs);
      }
    },
  },
  pixel: {
    colors: COLORS,
    background: '#1a1a25',
    grid: '#22222e',
    drawBlock(context, x, y, colorIndex, size) {
      context.fillStyle = this.colors[colorIndex];
      const px = x * size + 1, py = y * size + 1, s = size - 2, half = s / 2;
      context.fillRect(px, py, s, s);
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(px, py, half, half);
      context.fillRect(px + half, py + half, half, half);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(px + half, py, half, half);
      context.fillRect(px, py + half, half, half);
    },
  },
};

const SKIN_KEY = 'tetris.skin';

function loadSkin() {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    if (saved && THEMES[saved]) return saved;
  } catch (e) { /* localStorage no disponible (modo privado, etc.) */ }
  return 'retro';
}

function saveSkin(skin) {
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch (e) { /* ignorar: no es crítico persistir la preferencia */ }
}

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayRecords = document.getElementById('overlay-records');
const overlayHighscores = document.getElementById('overlay-highscores');
const overlayStats = document.getElementById('overlay-stats');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const restartBtn = document.getElementById('restart-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelSelect = document.getElementById('start-level');
const overlayResetBtn = document.getElementById('overlay-reset-btn');

const startOverlay = document.getElementById('start-overlay');
const startHighscores = document.getElementById('start-highscores');
const startStats = document.getElementById('start-stats');
const startPlayBtn = document.getElementById('start-play-btn');
const startResetBtn = document.getElementById('start-reset-btn');

let board, current, next, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let startLevel = 1; // nivel elegido en el menú de pausa, aplicado en la próxima partida
let gameStartLevel = 1; // copia de startLevel fijada al iniciar la partida actual; clearLines() no debe leer startLevel en vivo o un cambio en el menú alteraría retroactivamente la partida en curso

function dropIntervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch {
    // localStorage no disponible (modo privado, file://, datos corruptos, etc.)
  }
}

function qualifiesForHighscore(list, s) {
  return s > 0 && (list.length < MAX_HIGHSCORES || s > list[list.length - 1].score);
}

function addHighscore(name, s, l, c) {
  const list = loadHighscores();
  const entry = { name, score: s, lines: l, combo: c };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  saveHighscores(list);
  return { list, highlightIndex: list.indexOf(entry) };
}

function renderHighscores(container, list, highlightIndex) {
  container.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin puntuaciones aún';
    container.appendChild(li);
    return;
  }
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    if (i === highlightIndex) li.classList.add('highscore-highlight');
    const rank = document.createElement('span');
    rank.className = 'hs-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'hs-name';
    name.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'hs-score';
    scoreSpan.textContent = (entry.score || 0).toLocaleString();
    li.append(rank, name, scoreSpan);
    container.appendChild(li);
  });
}

function renderHighscoreStats(el, list) {
  if (list.length === 0) {
    el.textContent = '';
    return;
  }
  const bestCombo = Math.max(...list.map(e => e.combo || 0));
  const maxLines = Math.max(...list.map(e => e.lines || 0));
  el.textContent = `Mejor combo: ${bestCombo}  ·  Líneas máx: ${maxLines}`;
}

function refreshHighscorePanel(listEl, statsEl, highlightIndex) {
  const list = loadHighscores();
  renderHighscores(listEl, list, highlightIndex ?? -1);
  renderHighscoreStats(statsEl, list);
  return list;
}

function saveScore() {
  let name = nameInput.value.trim().slice(0, 10);
  if (!name) name = 'Jugador';
  const { list, highlightIndex } = addHighscore(name, score, lines, maxCombo);
  renderHighscores(overlayHighscores, list, highlightIndex);
  renderHighscoreStats(overlayStats, list);
  nameEntry.classList.add('hidden');
}

function resetHighscores() {
  if (!confirm('¿Seguro que quieres borrar todos los records?')) return;
  try {
    localStorage.removeItem(HIGHSCORES_KEY);
  } catch {
    // ignorar si localStorage no está disponible
  }
  refreshHighscorePanel(startHighscores, startStats);
  refreshHighscorePanel(overlayHighscores, overlayStats);
}

const skinSelect = document.getElementById('skin-select');

let currentSkin = loadSkin();

function applySkin(skin) {
  currentSkin = THEMES[skin] ? skin : 'retro';
  const theme = THEMES[currentSkin];
  canvas.style.background = theme.background;
  nextCanvas.style.background = theme.background;
  if (skinSelect) skinSelect.value = currentSkin;
  saveSkin(currentSkin);
  // Si el bucle está detenido (pausa/game over), redibuja a mano: si no,
  // el cambio de skin no se vería hasta reanudar.
  if (paused || gameOver) {
    draw();
    drawNext();
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = gameStartLevel + Math.floor(lines / 10);
    dropInterval = dropIntervalFor(level);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  THEMES[currentSkin].drawBlock(context, x, y, colorIndex, size);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEMES[currentSkin].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayRecords.classList.remove('hidden');
  const list = refreshHighscorePanel(overlayHighscores, overlayStats);
  nameEntry.classList.toggle('hidden', !qualifiesForHighscore(list, score));
  nameInput.value = '';
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    pauseControls.classList.add('hidden');
    if (document.activeElement) document.activeElement.blur(); // evita que un control con foco (select, botón) capture teclas del juego
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseOverlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  gameStartLevel = startLevel;
  level = gameStartLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  pauseControls.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  init();
  restartBtn.blur();
});

resumeBtn.addEventListener('click', () => {
  togglePause();
  resumeBtn.blur();
});

pauseRestartBtn.addEventListener('click', () => {
  init();
  pauseRestartBtn.blur();
});

controlsToggleBtn.addEventListener('click', () => {
  pauseControls.classList.toggle('hidden');
  controlsToggleBtn.blur();
});

startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
});

saveScoreBtn.addEventListener('click', saveScore);
nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveScore();
});
overlayResetBtn.addEventListener('click', resetHighscores);

startResetBtn.addEventListener('click', resetHighscores);
startPlayBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  init();
});

refreshHighscorePanel(startHighscores, startStats);

if (skinSelect) {
  skinSelect.addEventListener('change', e => applySkin(e.target.value));
}
applySkin(currentSkin);
