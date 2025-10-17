import { startGame, togglePause, resetGame } from './jeu.js';

/* =============================
   ÉTAT GLOBAL DU JEU
   ============================= */
export const state = {
  hero: null,
  difficulty: 'normal',
  upgrades: {
    weaponBonus: 0,
    passiveBonus: false,
    activeBonus: false,
    hemorrhage: false,
    doubleGoldChance: 0,
    ownedItems: {}, 
  },
  app: null,
  enemy: null,
  gold: 0,
  score: 0,
  level: 1,
  isPaused: false,
};

/* =============================
   MISE À JOUR DU HUD
   ============================= */
export function updateHUD() {
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('bestScore');
  const levelEl = document.getElementById('level');

  if (scoreEl) scoreEl.textContent = state.score;
  if (bestEl) {
    const best = localStorage.getItem('bestScore') || 0;
    bestEl.textContent = best;
  }
  if (levelEl) levelEl.textContent = state.level;
}

/* =============================
   SAUVEGARDE DU SCORE
   ============================= */
export function saveBestScore() {
  const best = localStorage.getItem('bestScore') || 0;
  if (state.score > best) {
    localStorage.setItem('bestScore', state.score);
  }
}

/* =============================
   ANIMATION HÉROS (spritesheet)
   ============================= */
function animateSprite(canvas, imagePath, frameWidth, frameHeight, frameCount, frameSpeed = 120) {
  const ctx = canvas.getContext('2d');
  const image = new Image();
  image.src = imagePath;
  let frameIndex = 0;

  function drawFrame() {
    ctx.clearRect(0, 0, frameWidth, frameHeight);
    ctx.drawImage(
      image,
      frameIndex * frameWidth, 0,
      frameWidth, frameHeight,
      0, 0, frameWidth, frameHeight
    );
    frameIndex = (frameIndex + 1) % frameCount;
  }

  image.onload = () => {
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    setInterval(drawFrame, frameSpeed);
  };
}

/* =============================
   INITIALISATION DE LA CONFIG
   ============================= */
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const gameArea = document.getElementById('gameHost');
  const difficultySelect = document.getElementById('difficulty');
  const panelConfig = document.getElementById('panelConfig');

  if (!startBtn || !panelConfig) return; // sécurité

  /* =============================
     GESTION DES BOUTONS
     ============================= */
  startBtn.addEventListener('click', () => {
    if (state.hero && state.difficulty) {
      startGame(gameArea);
    }
  });
  
  pauseBtn?.addEventListener('click', () => togglePause(pauseBtn));
  resetBtn?.addEventListener('click', () => resetGame(gameArea, pauseBtn));
  difficultySelect?.addEventListener('change', e => {
    state.difficulty = e.target.value;
  });

  /* =============================
     SÉLECTION DU HÉROS
     ============================= */
  const heroCards = document.querySelectorAll('.hero-card');
  heroCards.forEach(card => {
    const hero = card.dataset.hero;

    // === Animation continue du héros ===
    const canvas = document.createElement('canvas');
    canvas.classList.add('hero-canvas');
    card.querySelector('img').replaceWith(canvas);

    if (hero === 'rapide') {
      animateSprite(canvas, './img/Pink_Monster_Attack1_4.png', 32, 32, 4, 150);
    } else if (hero === 'fort') {
      animateSprite(canvas, './img/Owlet_Monster_Attack1_4.png', 32, 32, 4, 150);
    }

    // === Sélection du héros ===
    card.addEventListener('click', () => {
      heroCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.hero = hero;
      startBtn.disabled = false;
    });
  });
});

/* =============================
   EFFET FLASH COULEUR (utile HUD)
   ============================= */
export function flash(element, color = '#fff', duration = 150) {
  const prev = element.style.backgroundColor;
  element.style.transition = 'background-color 0.15s ease';
  element.style.backgroundColor = color;
  setTimeout(() => {
    element.style.backgroundColor = prev;
  }, duration);
}
