// jeu.js
import * as PIXI from 'pixi.js';
import { state, updateHUD, saveBestScore, flash } from './configuration.js';
import { createShopUI } from './boutique.js';

/* =============================
   MÉCANIQUES DE BASE
   ============================= */
function dmgPerClick() {
  const base = 1;
  return base + state.upgrades.weaponBonus;
}

// Scaling PV : +5/niveau + 10% cumulatif (par niveau)
function hpForLevel(level, difficulty) {
  const baseHP = 20;
  const perLevelFlat = 5;
  const perLevelPercent = 0.10;
  const hp = baseHP + (level - 1) * perLevelFlat;
  const scaled = hp * Math.pow(1 + perLevelPercent, level - 1);
  const mult = difficulty === 'easy' ? 0.8 : difficulty === 'hard' ? 1.6 : 1.0;
  return Math.round(scaled * mult);
}

/* =============================
   API EXPORTÉE
   ============================= */
export function startGame(host) {
  if (state.app) {
    try { state.app.destroy(true, { children: true }); } catch {}
    state.app = null;
  }
  host.innerHTML = '';

  const app = new PIXI.Application({
    resizeTo: host,
    backgroundColor: 0xf3f4f6,
    antialias: true,
  });
  host.appendChild(app.view);
  state.app = app;

  // Réinit partie
  state.score = 0;
  state.gold = 0;
  state.level = 1;
  state.isPaused = false;
  state.enemyMaxHP = hpForLevel(state.level, state.difficulty);
  state.enemyHP = state.enemyMaxHP;
  state.clicksSincePassive = 0;
  state.lastHemorrhageTime = 0;
  updateHUD();

  /* =============================
     ENNEMI + CONTAINER CENTRÉ
     ============================= */
  const enemyContainer = new PIXI.Container();
  enemyContainer.x = app.renderer.width / 2;
  enemyContainer.y = app.renderer.height / 2;

  const g = new PIXI.Graphics();
  drawEnemy(g);
  enemyContainer.addChild(g);

  // Cercle de charge (progression 0→100%)
  const chargeRing = new PIXI.Graphics();
  chargeRing.alpha = 0;
  enemyContainer.addChild(chargeRing);

  // Halo doré (double or)
  const goldRing = new PIXI.Graphics();
  goldRing.alpha = 0;
  enemyContainer.addChild(goldRing);

  enemyContainer.interactive = true;
  enemyContainer.buttonMode = true;
  state.enemy = enemyContainer;
  state.enemy.baseScale = 1.3;
  enemyContainer.scale.set(state.enemy.baseScale);
  app.stage.addChild(enemyContainer);

  /* =============================
     VARIABLES / UTILS CHARGE
     ============================= */
  let isCharging = false;
  let charged = false;
  let chargeStartTime = 0;
  const chargeTime = 2000; // 2s

  function updateChargeRing(progress) {
    chargeRing.clear();
    const color = charged ? 0xf59e0b : 0x3b82f6; // orange si prêt, bleu sinon

    // Rayon auto basé sur l'ennemi dessiné
    const enemyGraphic = state.enemy.children[0];
    const baseRadius = enemyGraphic?.geometry?.graphicsData?.[0]?.shape?.radius || 80;
    const radius = baseRadius + 40; // halo autour

    chargeRing.lineStyle(baseRadius * 0.5, color, 0.9);
    chargeRing.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  }

  function hideChargeRing() {
    chargeRing.alpha = 0;
    chargeRing.clear();
  }

  function cancelCharge() {
    isCharging = false;
    charged = false;
    enemyContainer.scale.set(state.enemy.baseScale);
    hideChargeRing();
    if (state.lvlLabel) state.lvlLabel.tint = 0x333333;
  }

  // Halo doré lors d’un double gain d’or
  function showGoldRing() {
    goldRing.clear();
    goldRing.lineStyle(4, 0xfacc15, 0.95);
    goldRing.drawCircle(0, 0, 50);
    goldRing.endFill();
    goldRing.alpha = 1;

    const start = performance.now();
    const duration = 500;
    function fade(time) {
      const p = (time - start) / duration;
      goldRing.alpha = Math.max(0, 1 - p);
      if (p < 1) requestAnimationFrame(fade);
      else goldRing.clear();
    }
    requestAnimationFrame(fade);
  }

  // Appliquer des dégâts + gains score/or + gestion mort & HUD
  function applyDamage(amount) {
    state.enemyHP -= amount;
    state.score += amount;

    // Gain d'or avec chance de doubler (pioche diamant)
    let goldGain = amount;
    if (state.upgrades.doubleGoldChance && Math.random() < state.upgrades.doubleGoldChance) {
      goldGain *= 2;
      showGoldRing(); // halo doré 0.5s
    }
    state.gold += goldGain;

    // Mort de l’ennemi
    if (state.enemyHP <= 0) {
      state.level++;
      state.enemyMaxHP = hpForLevel(state.level, state.difficulty);
      state.enemyHP = state.enemyMaxHP;
      flash(host, '#10b981');
      animateLabelZoom(state.lvlLabel, { endScale: 1.4, duration: 300 });
      state.lvlLabel.tint = 0x10b981;
      setTimeout(() => (state.lvlLabel.tint = 0x333333), 300);
    }

    updateHUD();
    updateTextLabels();
  }

  /* =============================
     INTERACTIONS ENNEMI
     ============================= */
  enemyContainer.on('pointerdown', () => {
    if (state.isPaused) return;

    // Pas de bonus actif => clic normal
    if (!state.upgrades.activeBonus) {
      const dmg = dmgPerClick();
      applyDamage(dmg);

      // Feedback
      enemyContainer.scale.set(state.enemy.baseScale * 0.98);
      setTimeout(() => enemyContainer.scale.set(state.enemy.baseScale), 80);
      animateLabelZoom(state.scoreLabel, { endScale: 1.3, duration: 250 });

      // Passif “-2% / 15 clics”
      if (state.upgrades.passiveBonus) {
        state.clicksSincePassive++;
        if (state.clicksSincePassive >= 15) {
          const reduction = Math.max(1, Math.floor(state.enemyHP * 0.02));
          state.enemyHP -= reduction;
          state.clicksSincePassive = 0;
          updateTextLabels();
        }
      }
      return;
    }

    // Bonus actif débloqué => charge
    isCharging = true;
    charged = false;
    chargeStartTime = performance.now();
    chargeRing.alpha = 1;
    updateChargeRing(0);
    enemyContainer.scale.set(state.enemy.baseScale * 0.95);
  });

  enemyContainer.on('pointerup', () => {
    if (state.isPaused) return;
    if (!isCharging) return;

    if (charged) {
      // Coup chargé : x5
      const dmg = dmgPerClick() * 5;
      applyDamage(dmg);
      flash(host, '#f59e0b');
      animateLabelZoom(state.scoreLabel, { endScale: 1.6, duration: 350 });

      // Passif “-2% / 15 clics” → compte 5 clics
      if (state.upgrades.passiveBonus) {
        state.clicksSincePassive += 5;
        if (state.clicksSincePassive >= 15) {
          const reduction = Math.max(1, Math.floor(state.enemyHP * 0.02));
          state.enemyHP -= reduction;
          state.clicksSincePassive = 0;
          updateTextLabels();
        }
      }
    } else {
      // Relâché avant les 2s → clic normal
      const dmg = dmgPerClick();
      applyDamage(dmg);
      enemyContainer.scale.set(state.enemy.baseScale * 0.98);
      setTimeout(() => enemyContainer.scale.set(state.enemy.baseScale), 80);

      if (state.upgrades.passiveBonus) {
        state.clicksSincePassive++;
        if (state.clicksSincePassive >= 15) {
          const reduction = Math.max(1, Math.floor(state.enemyHP * 0.02));
          state.enemyHP -= reduction;
          state.clicksSincePassive = 0;
          updateTextLabels();
        }
      }
    }

    cancelCharge();
  });

  enemyContainer.on('pointerupoutside', () => {
    cancelCharge();
  });

  /* =============================
     TEXTES / HUD PIXI
     ============================= */
  const textStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 18,
    fill: 0x333333,
    fontWeight: 'bold',
  });

  const hpLabel = new PIXI.Text('', textStyle);
  const lvlLabel = new PIXI.Text('', textStyle);
  const scoreLabel = new PIXI.Text('Score : 0', { ...textStyle, fill: 0x007bff });

  // === Label d'or (icône + montant) en haut à droite ===
  const goldContainer = new PIXI.Container();

  const goldTexture = PIXI.Texture.from('./img/gold.png');
  const goldIcon = new PIXI.Sprite(goldTexture);
  goldIcon.width = 28;
  goldIcon.height = 28;
  goldIcon.x = -35;
  goldIcon.y = -14;

  const goldText = new PIXI.Text(`${Math.floor(state.gold)}`, {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: 0xdaa520,
    fontWeight: 'bold',
  });
  goldText.anchor.set(0, 0.5);
  goldText.x = 0;
  goldText.y = 0;

  goldContainer.addChild(goldIcon, goldText);

  // Assignation au state
  state.hpLabel = hpLabel;
  state.lvlLabel = lvlLabel;
  state.scoreLabel = scoreLabel;
  state.goldLabel = goldText;        // le texte seulement (pour update)
  state.goldContainer = goldContainer;

  [hpLabel, lvlLabel, scoreLabel].forEach(t => t.anchor.set(0.5));
  app.stage.addChild(hpLabel, lvlLabel, scoreLabel, goldContainer);

  // === BOUTIQUE (UI Pixi)
  createShopUI(app);

  updateTextLabels();
  centerEnemy();

  /* =============================
     BOUCLE PRINCIPALE
     ============================= */
  app.ticker.add(() => {
    if (state.isPaused) return;

    const t = app.ticker.lastTime / 1000;
    const k = 10 + 6 * Math.sin(t * 2); // respiration visuelle
    drawEnemy(g, k);
    positionTextLabels();

    // Progression visuelle de la charge
    if (isCharging && state.upgrades.activeBonus) {
      const elapsed = performance.now() - chargeStartTime;
      const progress = Math.min(elapsed / chargeTime, 1);
      updateChargeRing(progress);
      if (progress >= 1 && !charged) {
        charged = true;
        enemyContainer.scale.set(state.enemy.baseScale * 1.12);
        flash(host, '#f59e0b');
      }
    }

    // Hémorragie (si dague achetée)
    if (state.upgrades.hemorrhage) {
      const now = performance.now();
      if (!state.lastHemorrhageTime) state.lastHemorrhageTime = 0;
      if (now - state.lastHemorrhageTime >= 2000) {
        state.lastHemorrhageTime = now;

        const bleedDamage = 1;
        state.enemyHP -= bleedDamage;
        state.score += bleedDamage;
        state.gold += bleedDamage;

        // Petit flash rouge
        flash(host, '#ef4444');

        // Mort ?
        if (state.enemyHP <= 0) {
          state.level++;
          state.enemyMaxHP = hpForLevel(state.level, state.difficulty);
          state.enemyHP = state.enemyMaxHP;
          flash(host, '#10b981');
          animateLabelZoom(state.lvlLabel, { endScale: 1.4, duration: 300 });
          state.lvlLabel.tint = 0x10b981;
          setTimeout(() => (state.lvlLabel.tint = 0x333333), 300);
        }

        updateHUD();
        updateTextLabels();
      }
    }
  });
}

/* =============================
   CONTROLES GLOBAUX
   ============================= */
export function togglePause(pauseBtn) {
  state.isPaused = !state.isPaused;
  if (pauseBtn) {
    pauseBtn.textContent = state.isPaused ? '▶️ Reprendre' : '⏸️ Pause';
  }
}

export function resetGame(host, pauseBtn) {
  saveBestScore();
  if (state.app) state.app.destroy(true, { children: true });
  state.app = null;
  state.enemy = null;
  if (host) host.innerHTML = '<span>En attente de la configuration.</span>';
  state.gold = 0;
  state.score = 0;
  state.level = 1;
  state.isPaused = false;
  updateHUD();
  if (pauseBtn) pauseBtn.textContent = '⏸️ Pause';
}

/* =============================
   TEXTE & ANIMS
   ============================= */
function updateTextLabels() {
  if (!state.hpLabel) return;
  state.hpLabel.text = `PV : ${Math.max(0, state.enemyHP)} / ${state.enemyMaxHP}`;
  state.lvlLabel.text = `Niveau ${state.level}`;
  state.scoreLabel.text = `Score : ${state.score}`;
  if (state.goldLabel) state.goldLabel.text = `${Math.floor(state.gold)}`;
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

  // Label or en haut à droite (marge 100px droite, 50px haut)
  state.goldContainer.x = width - 100;
  state.goldContainer.y = 50;
}

function animateLabelZoom(label, { startScale = 1, endScale = 1.3, duration = 250 } = {}) {
  if (!label) return;
  const start = performance.now();
  function tick(t) {
    const p = Math.min((t - start) / duration, 1);
    const s = startScale + (endScale - startScale) * (p < 0.5 ? p * 2 : 1 - (p - 0.5) * 2);
    label.scale.set(s);
    if (p < 1) requestAnimationFrame(tick);
    else label.scale.set(startScale);
  }
  requestAnimationFrame(tick);
}

/* =============================
   ENNEMI (dessin + recentrage)
   ============================= */
function drawEnemy(g, radius = 120) {
  g.clear();
  g.beginFill(0xf87171);
  g.drawCircle(0, 0, radius); // centré sur (0,0)
  g.endFill();

  const pct = Math.max(0, state.enemyHP) / state.enemyMaxHP;
  g.lineStyle(8, 0x10b981, 1);
  g.arc(0, 0, radius + 14, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
}

function centerEnemy() {
  if (!state.app || !state.enemy) return;
  state.enemy.x = state.app.renderer.width / 2;
  state.enemy.y = state.app.renderer.height / 2;
  drawEnemy(state.enemy.children[0]);
  positionTextLabels();
}
