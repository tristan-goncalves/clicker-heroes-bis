import { state, updateHUD } from './configuration.js';
import { startGame, togglePause, resetGame } from './jeu.js';

/* =============================
   ACCÈS DOM
   ============================= */
const byId = (id) => document.getElementById(id);

const startBtn = byId('startBtn');
const pauseBtn = byId('pauseBtn');
const resetBtn = byId('resetBtn');
const difficultySel = byId('difficulty');
const clearBestBtn = byId('clearBest');
const host = byId('gameHost');

/* =============================
   GESTION DE LA DIFFICULTÉ
   ============================= */
if (difficultySel) {
  difficultySel.addEventListener('change', () => {
    state.difficulty = difficultySel.value;
  });
}

/* =============================
   BOUTONS PRINCIPAUX
   ============================= */
//startBtn?.addEventListener('click', () => startGame(host));
pauseBtn?.addEventListener('click', () => togglePause(pauseBtn));
resetBtn?.addEventListener('click', () => resetGame(host, pauseBtn));

clearBestBtn?.addEventListener('click', () => {
  localStorage.removeItem('bestScore');
  updateHUD();
});

/* =============================
   RACCOURCIS CLAVIER
   ============================= */
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'p') {
    togglePause(pauseBtn);
  }
});

/* =============================
   INITIALISATION
   ============================= */
updateHUD();
