import * as PIXI from 'pixi.js';
import { state, updateHUD, saveBestScore, flash } from './configuration.js';
import { createShopUI } from './boutique.js';


const enemySprites = [
  { path: './img/enemies/rattata.png', frames: 101 },
  { path: './img/enemies/piafabec.png', frames: 61 },
  { path: './img/enemies/abo.png', frames: 71 },
  { path: './img/enemies/nidoran_f.png', frames: 89 },
  { path: './img/enemies/nosferapti.png', frames: 54 },
  { path: './img/enemies/taupiqueur.png', frames: 108 },
  { path: './img/enemies/racaillou.png', frames: 103 },
  { path: './img/enemies/magneti.png', frames: 105 },
  { path: './img/enemies/voltorbe.png', frames: 71 },
  { path: './img/enemies/saquedeneu.png', frames: 63 },
  { path: './img/enemies/hypotrempe.png', frames: 80 },
  { path: './img/enemies/tygnon.png', frames: 81 },
  { path: './img/enemies/rhinoferos.png', frames: 96 },
  { path: './img/enemies/lokhlass.png', frames: 65 },
  { path: './img/enemies/voltali.png', frames: 99 },
  { path: './img/enemies/artikodin.png', frames: 51 },
  { path: './img/enemies/electhor.png', frames: 17 },
  { path: './img/enemies/sulfura.png', frames: 53 },
  { path: './img/enemies/lugia.png', frames: 16 },
  { path: './img/enemies/kyogre.png', frames: 38 },
];

// Dégâts de base du joueur
function dmgPerClick() {
  const base = 1;
  return base + state.upgrades.weaponBonus;
}

// Effets visuels des différents anneaux autour de l'ennemi
function createEffectRings() {
  const chargeRing = new PIXI.Graphics();
  chargeRing.alpha = 0;

  const goldRing = new PIXI.Graphics();
  goldRing.alpha = 0;

  state.chargeRing = chargeRing;
  state.goldRing = goldRing;

  return { chargeRing, goldRing };
}

// Gestion de la barre de vie de l'ennemi
function addHealthBar(container) {
  const barWidth = 100;
  const barHeight = 12;
  const offsetY = 60;
  const bg = new PIXI.Graphics();
  bg.beginFill(0xcccccc); // Fond (gris)
  bg.drawRect(-barWidth / 2, offsetY, barWidth, barHeight);
  bg.endFill();
  container.addChild(bg);

  const fill = new PIXI.Graphics();
  fill.beginFill(0x10b981); // Remplissage (vert)
  fill.drawRect(-barWidth / 2, offsetY, barWidth, barHeight);
  fill.endFill();
  container.addChild(fill);

  // Stocker dans le state
  state.healthBarFill = fill;
  state.healthBarWidth = barWidth;
}

// Scaling PV des Pokémons : +5/niveau + 10% cumulatif (par niveau)
function hpForLevel(level, difficulty) {
  const baseHP = 20;
  const perLevelFlat = 5;
  const perLevelPercent = 0.10;
  const hp = baseHP + (level - 1) * perLevelFlat;
  const scaled = hp * Math.pow(1 + perLevelPercent, level - 1);
  // Plus la difficulté est élevée, plus le scaling de PV des Pokémons est haut
  const mult = difficulty === 'easy' ? 0.8 : difficulty === 'hard' ? 1.6 : 1.0;
  return Math.round(scaled * mult);
}

// Initialisation du jeu
export async function startGame(host) {
  if (state.app) {
    try { state.app.destroy(true, { children: true }); } catch {}
    state.app = null;
  }
  host.innerHTML = '';

  const app = new PIXI.Application({
    width: host.clientWidth,
    height: host.clientHeight,
    backgroundColor: 0xf3f4f6,
    antialias: true,
    autoDensity: true,
  });
  host.appendChild(app.view);
  state.app = app;

  // Réinitialisation de la partie
  state.score = 0;
  state.gold = 0;
  state.level = 1;
  state.isPaused = false;
  state.enemyMaxHP = hpForLevel(state.level, state.difficulty);
  state.enemyHP = state.enemyMaxHP;
  state.clicksSincePassive = 0;
  state.lastHemorrhageTime = 0;
  updateHUD();


  // Pokémon (centré dans un container)
  const enemyContainer = new PIXI.Container();
  enemyContainer.x = app.renderer.width / 2;
  enemyContainer.y = app.renderer.height / 2;

  const spriteData = enemySprites[(state.level - 1) % enemySprites.length];

  let { chargeRing, goldRing } = createEffectRings();

  await createAnimatedEnemySprite(spriteData).then(sprite => {
    state.enemySprite = sprite;
    enemyContainer.addChild(sprite);
    enemyContainer.addChild(chargeRing);
    enemyContainer.addChild(goldRing);
    addHealthBar(enemyContainer);
  });

  enemyContainer.interactive = true;
  enemyContainer.buttonMode = true;
  state.enemy = enemyContainer;
  state.enemy.baseScale = 1.3;
  enemyContainer.scale.set(state.enemy.baseScale);
  app.stage.addChild(enemyContainer);

  let isCharging = false;
  let charged = false;
  let chargeStartTime = 0;
  const chargeTime = 2000; // 2s

  function updateChargeRing(progress) {
    chargeRing.clear();
    const color = charged ? 0xf59e0b : 0x3b82f6;

    const enemyGraphic = state.enemySprite;
    const spriteHeight = (enemyGraphic && enemyGraphic.height) || 100;
    const baseRadius = spriteHeight / 2;
    const radius = baseRadius + 20;

    chargeRing.lineStyle(baseRadius * 0.1, color, 0.9);
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

  // Halo doré lors d’un double gain de fric
  function showGoldRing() {
    goldRing.clear();

    const enemyGraphic = state.enemySprite;
    const spriteHeight = (enemyGraphic && enemyGraphic.height) || 100;
    const baseRadius = spriteHeight / 2;

    goldRing.lineStyle(4, 0xfacc15, 0.95);
    goldRing.drawCircle(0, 0, baseRadius + 20);
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

  // Appliquer des dégâts + gains score/or
  function applyDamage(amount) {
    state.enemyHP -= amount;
    state.score += amount;

    // Gain d'or avec chance de doubler (bonus de la pioche en diamant)
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

      // Remplace l'ancien sprite par le nouveau
      const spriteData = enemySprites[(state.level - 1) % enemySprites.length];
      createAnimatedEnemySprite(spriteData).then(sprite => {
        state.enemy.removeChildren();

        ({ chargeRing, goldRing } = createEffectRings());

        state.enemySprite = sprite;
        state.enemy.addChild(sprite);
        state.enemy.addChild(chargeRing);
        state.enemy.addChild(goldRing);

        addHealthBar(state.enemy);
      });
    }

    if (state.healthBarFill) {
      const ratio = Math.max(0, state.enemyHP / state.enemyMaxHP);
      state.healthBarFill.clear();
      state.healthBarFill.beginFill(0x10b981);
      state.healthBarFill.drawRect(-state.healthBarWidth / 2, 60, state.healthBarWidth * ratio, 12);
      state.healthBarFill.endFill();
    }

    updateHUD();
    updateTextLabels();
  }

  // Intéraction avec le Pokémon
  enemyContainer.on('pointerdown', () => {
    if (state.isPaused) return;

    // Pas de bonus actif => clic normal
    if (!state.upgrades.activeBonus) {
      const dmg = dmgPerClick();
      applyDamage(dmg);

      // Indication visuelle lors d'une intéraction avec le Pokémon
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

    // Bonus actif de la charge débloqué
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
      // Coup chargé : x5 de dégats
      const dmg = dmgPerClick() * 5;
      applyDamage(dmg);
      flash(host, '#f59e0b');
      animateLabelZoom(state.scoreLabel, { endScale: 1.6, duration: 350 });

      // Passif “-2% / 15 clics” → va compter 5 clics
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
      // Si l'on relâche avant les 2s → clic normal
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

  // Gestion du canvas Pixi
  const textStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 18,
    fill: 0x333333,
    fontWeight: 'bold',
  });

  const hpLabel = new PIXI.Text('', textStyle);
  const lvlLabel = new PIXI.Text('', textStyle);
  const scoreLabel = new PIXI.Text('Score : 0', { ...textStyle, fill: 0x007bff });

  // Label d'or (icône + montant) en haut à droite du canvas
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

  state.hpLabel = hpLabel;
  state.lvlLabel = lvlLabel;
  state.scoreLabel = scoreLabel;
  state.goldLabel = goldText;
  state.goldContainer = goldContainer;

  [hpLabel, lvlLabel, scoreLabel].forEach(t => t.anchor.set(0.5));
  app.stage.addChild(hpLabel, lvlLabel, scoreLabel, goldContainer);

  // Rajout de la boutique sur le canvas
  createShopUI(app);

  updateTextLabels();
  //centerEnemy();


  // Boucle principale du jeu
  app.ticker.add(() => {
    if (state.isPaused) return;

    const t = app.ticker.lastTime / 1000;
    const k = 10 + 6 * Math.sin(t * 2);
    //drawEnemy(g, k);
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

    // Gestion de l'hémorragie (si la dague a été achetée)
    if (state.upgrades.hemorrhage) {
      const now = performance.now();
      if (!state.lastHemorrhageTime) state.lastHemorrhageTime = 0;
      if (now - state.lastHemorrhageTime >= 2000) {
        state.lastHemorrhageTime = now;

        const bleedDamage = 1;
        state.enemyHP -= bleedDamage;
        state.score += bleedDamage;
        state.gold += bleedDamage;

        // Petit flash rouge de bleed
        flash(host, '#ef4444');

        // Mort du Pokémon
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

// Contrôles (pause et reprendre)
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

// Gestion des labels
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
  state.hpLabel.y = height / 2 + 200;
  state.lvlLabel.x = width / 2;
  state.lvlLabel.y = height / 2 - 150;
  state.scoreLabel.x = width / 2;
  state.scoreLabel.y = 40;

  // Label de l'or en haut à droite
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

// // Dessin de l'ennemi et centrage sur le canvas
// function drawEnemy(g, radius = 120) {
//   g.clear();
//   g.beginFill(0xf87171);
//   g.drawCircle(0, 0, radius); // centré sur (0,0)
//   g.endFill();

//   const pct = Math.max(0, state.enemyHP) / state.enemyMaxHP;
//   g.lineStyle(8, 0x10b981, 1);
//   g.arc(0, 0, radius + 14, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
// }

function createAnimatedEnemySprite({ path, frames }) {
  const texture = PIXI.Texture.from(path);
  const baseTexture = texture.baseTexture;

  return new Promise((resolve) => {
    baseTexture.on('loaded', () => {
      const frameWidth = baseTexture.width / frames;
      const frameHeight = baseTexture.height;

      const textures = [];
      for (let i = 0; i < frames; i++) {
        textures.push(new PIXI.Texture(baseTexture, new PIXI.Rectangle(i * frameWidth, 0, frameWidth, frameHeight)));
      }

      const sprite = new PIXI.AnimatedSprite(textures);
      sprite.animationSpeed = 0.15;
      sprite.anchor.set(0.5);
      sprite.play();

      // Adapte la taille automatiquement
      const scale = Math.min(1.5, 100 / frameHeight);
      sprite.scale.set(scale);

      resolve(sprite);
    });
  });
}


function centerEnemy() {
  if (!state.app || !state.enemy) return;
  state.enemy.x = state.app.renderer.width / 2;
  state.enemy.y = state.app.renderer.height / 2;
  drawEnemy(state.enemy.children[0]);
  positionTextLabels();
}
