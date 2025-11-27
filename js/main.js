import { state, updateHUD } from './configuration.js';
import { startGame, togglePause, resetGame } from './jeu.js';


const byId = (id) => document.getElementById(id);

const startBtn = byId('startBtn');
const pauseBtn = byId('pauseBtn');
const resetBtn = byId('resetBtn');
const difficultySel = byId('difficulty');
const clearBestBtn = byId('clearBest');
const host = byId('gameHost');

// Difficulté
if (difficultySel) {
  difficultySel.addEventListener('change', () => {
    state.difficulty = difficultySel.value;
  });
}

// Gestion de la pause et du reset
pauseBtn?.addEventListener('click', () => togglePause(pauseBtn));
resetBtn?.addEventListener('click', () => resetGame(host, pauseBtn));

clearBestBtn?.addEventListener('click', () => {
  localStorage.removeItem('bestScore');
  updateHUD();
});

// PAUSE
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'p') {
    togglePause(pauseBtn);
  }
});

updateHUD();
