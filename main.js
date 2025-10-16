import * as PIXI from 'pixi.js';

// =============================
// ⚙️ ÉTAT GLOBAL DU JEU
// =============================
const state = {
  app: null,
  hero: null,
  difficulty: 'normal',
  isPaused: false,
  score: 0,
  bestScore: Number(localStorage.getItem('bestScore') || 0),
  level: 1,
  enemy: null,
  enemyHP: 20,
  enemyMaxHP: 20,
  hpLabel: null,
  lvlLabel: null,
  scoreLabel: null,
};

// =============================
// 🧩 UTILITAIRES
// =============================
const byId = (id) => document.getElementById(id);
const scoreEl = byId('score');
const bestScoreEl = byId('bestScore');
const levelEl = byId('level');
const pauseBtn = byId('pauseBtn');
const resetBtn = byId('resetBtn');
const startBtn = byId('startBtn');
const difficultySel = byId('difficulty');
const clearBestBtn = byId('clearBest');
const host = byId('gameHost');

function dmgPerClick() {
  return state.hero === 'fort' ? 3 : 1;
}

function hpForLevel(level, difficulty) {
  const base = 20 + (level - 1) * 8;
  const mult = difficulty === 'easy' ? 0.9 : difficulty === 'hard' ? 1.3 : 1.0;
  return Math.round(base * mult);
}

function updateHUD() {
  scoreEl.textContent = state.score;
  bestScoreEl.textContent = state.bestScore;
  levelEl.textContent = state.level;
}

function saveBestScore() {
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('bestScore', String(state.bestScore));
  }
  updateHUD();
}

// =============================
// 🏁 PHASE D'INITIALISATION
// =============================
document.querySelectorAll('.heroBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.hero = btn.dataset.hero;
    document.querySelectorAll('.heroBtn').forEach(b => b.style.outline = 'none');
    btn.style.outline = `2px solid var(--accent)`;
    startBtn.disabled = false;
  });
});

difficultySel.addEventListener('change', () => {
  state.difficulty = difficultySel.value;
});

startBtn.addEventListener('click', () => {
  startGame();
});

// =============================
// 🎮 DÉMARRAGE DU JEU (Pixi v8)
// =============================
function startGame() {
  // Nettoyer le conteneur du jeu
  host.innerHTML = '';

  // ✅ Création de l'application Pixi.js (v7)
  const app = new PIXI.Application({
    resizeTo: host,
    backgroundColor: 0xf3f4f6, // couleur de fond gris clair
    antialias: true,
  });

  // ✅ Ajout du canvas Pixi au DOM
  host.appendChild(app.view);
  state.app = app;

  // --- Initialisation du jeu ---
  state.score = 0;
  state.level = 1;
  state.isPaused = false;
  state.enemyMaxHP = hpForLevel(state.level, state.difficulty);
  state.enemyHP = state.enemyMaxHP;
  updateHUD();

  // --- Création de l'ennemi ---
  const g = new PIXI.Graphics();
  drawEnemy(g);
  g.interactive = true;
  g.buttonMode = true;

  g.on('pointerdown', () => {
    if (state.isPaused) return;
    state.enemyHP -= dmgPerClick();
    state.score += dmgPerClick();
    g.scale.set(0.995);
    setTimeout(() => g.scale.set(1), 80);
    animateLabelZoom(state.scoreLabel, { endScale: 1.35, duration: 300 });

    if (state.enemyHP <= 0) {
      state.level += 1;
      state.enemyMaxHP = hpForLevel(state.level, state.difficulty);
      state.enemyHP = state.enemyMaxHP;
      flash(host, '#10b981');
      animateLabelZoom(state.lvlLabel, { endScale: 1.4, duration: 300 });
      state.lvlLabel.tint = 0x10b981;
      setTimeout(() => state.lvlLabel.tint = 0x333333, 300);
    }

    updateHUD();
    updateTextLabels();
  });

  state.enemy = g;
  app.stage.addChild(g);

  // --- Création des textes ---
  const textStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 18,
    fill: 0x333333,
    fontWeight: 'bold',
    dropShadow: true,
    dropShadowColor: '#ffffff',
    dropShadowBlur: 2,
    dropShadowDistance: 1,
  });

  const hpLabel = new PIXI.Text('', textStyle);
  hpLabel.anchor.set(0.5);

  const lvlLabel = new PIXI.Text('', textStyle);
  lvlLabel.anchor.set(0.5);

  const scoreLabel = new PIXI.Text('Score : 0', {
    ...textStyle,
    fontSize: 20,
    fill: 0x007bff,
  });
  scoreLabel.anchor.set(0.5);

  state.hpLabel = hpLabel;
  state.lvlLabel = lvlLabel;
  state.scoreLabel = scoreLabel;

  app.stage.addChild(hpLabel);
  app.stage.addChild(lvlLabel);
  app.stage.addChild(scoreLabel);

  updateTextLabels();

  // --- Boucle de jeu ---
  app.ticker.add((delta) => {
    if (state.isPaused) return;
    const t = app.ticker.lastTime / 1000;
    const k = 10 + 6 * Math.sin(t * 2);
    drawEnemy(state.enemy, k);
    positionTextLabels();
  });

  app.renderer.on('resize', () => {
    centerEnemy();
    positionTextLabels();
  });

  centerEnemy();
  window.addEventListener('keydown', onKeyDown);
  pauseBtn.textContent = '⏸️ Pause P';
}


// =============================
// 🧠 TEXTES PIXI
// =============================
function updateTextLabels() {
  if (!state.hpLabel || !state.lvlLabel || !state.scoreLabel) return;
  state.hpLabel.text = `PV :  ${Math.max(0, state.enemyHP)} / ${state.enemyMaxHP}`;
  state.lvlLabel.text = `Niveau ${state.level}`;
  state.scoreLabel.text = `Score : ${state.score}`;
}

function positionTextLabels() {
  if (!state.app) return;
  const { width, height } = state.app.renderer;
  state.hpLabel.x = width / 2;
  state.hpLabel.y = height / 2 + 100;
  state.lvlLabel.x = width / 2;
  state.lvlLabel.y = height / 2 - 100;
  state.scoreLabel.x = width / 2;
  state.scoreLabel.y = 40;
}


function animateLabelZoom(label, {
  startScale = 1,
  endScale = 1.3,
  duration = 250,
  easing = (t) => 1 - Math.pow(1 - t, 3) // easeOutCubic
} = {}) {
  if (!label) return;

  const startTime = performance.now();

  function animate(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easing(progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2);
    const scale = startScale + (endScale - startScale) * eased;
    label.scale.set(scale);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      label.scale.set(startScale);
    }
  }

  requestAnimationFrame(animate);
}

// =============================
// 🎨 DESSIN DE L’ENNEMI
// =============================
function drawEnemy(g, radius = 80) {
  const app = state.app;
  if (!app) return;
  const { width, height } = app.renderer;
  g.clear();

  const cx = width / 2;
  const cy = height / 2;

  // --- Cercle de base ---
  g.beginFill(0xf87171); // rouge pastel
  g.drawCircle(cx, cy, radius);
  g.endFill();

  // --- Jauge de vie (arc vert) ---
  const pct = Math.max(0, state.enemyHP) / state.enemyMaxHP;
  const start = -Math.PI / 2;
  const end = start + pct * Math.PI * 2;

  g.lineStyle(8, 0x10b981, 1);
  g.arc(cx, cy, radius + 14, start, end); // trace le contour
  g.endFill(); // ✅ ferme le tracé proprement
}

function centerEnemy() {
  if (!state.app || !state.enemy) return;
  drawEnemy(state.enemy);
  positionTextLabels();
}

// =============================
// ⏸️ PAUSE / RESET
// =============================
function onKeyDown(e) {
  if (e.key.toLowerCase() === 'p') togglePause();
}

function togglePause() {
  state.isPaused = !state.isPaused;
  pauseBtn.textContent = state.isPaused ? '▶️ Reprendre' : '⏸️ Pause';
}

function resetGame() {
  saveBestScore();
  if (state.app) {
    state.app.destroy(true, { children: true, texture: true, baseTexture: true });
    state.app = null;
  }
  state.enemy = null;
  state.score = 0;
  state.level = 1;
  state.isPaused = false;
  updateHUD();
  host.innerHTML = '<span>En attente de la configuration.</span>';
  pauseBtn.textContent = '⏸️ Pause';
}

function flash(el, color = '#6ee7ff') {
  el.animate([
    { boxShadow: '0 0 0 rgba(0,0,0,0)' },
    { boxShadow: `0 0 0 6px ${color}33` },
    { boxShadow: '0 0 0 rgba(0,0,0,0)' },
  ], { duration: 450, easing: 'ease-out' });
}

// =============================
// 🎛️ BOUTONS D’INTERFACE
// =============================
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', () => { resetGame(); flash(host, '#ef4444'); });
clearBestBtn.addEventListener('click', () => {
  localStorage.removeItem('bestScore');
  state.bestScore = 0;
  updateHUD();
});

updateHUD();
