import * as PIXI from 'pixi.js';

// =============================
// ÉTAT GLOBAL DU JEU
// =============================
const state = {
  app: null,
  hero: null,
  difficulty: 'normal',
  isPaused: false,
  score: 0,
  gold: 0, // 💰 monnaie
  bestScore: Number(localStorage.getItem('bestScore') || 0),
  level: 1,
  enemy: null,
  enemyHP: 20,
  enemyMaxHP: 20,
  hpLabel: null,
  lvlLabel: null,
  scoreLabel: null,
  goldLabel: null,
  shopButton: null,
  shopContainer: null,
  upgrades: {
    weaponBonus: 0,
    passiveBonus: false,
    activeBonus: false,
    ownedItems: {},
  },
  clicksSincePassive: 0,
};

// =============================
// UTILITAIRES
// =============================
const byId = (id) => document.getElementById(id);
const scoreEl = byId('score');
const bestScoreEl = byId('bestScore');
const levelEl = byId('level');
const pauseBtn = byId('pauseBtn');
const startBtn = byId('startBtn');
const difficultySel = byId('difficulty');
const resetBtn = byId('resetBtn');
const clearBestBtn = byId('clearBest');
const host = byId('gameHost');

// =============================
// MÉCANIQUES DE BASE
// =============================
function dmgPerClick() {
  const base = state.hero === 'fort' ? 3 : 1;
  return base + state.upgrades.weaponBonus;
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
// INITIALISATION DES BOUTONS
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

startBtn.addEventListener('click', () => startGame());
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetGame);
clearBestBtn.addEventListener('click', () => {
  localStorage.removeItem('bestScore');
  state.bestScore = 0;
  updateHUD();
});

// =============================
// DÉMARRAGE DU JEU
// =============================
function startGame() {
  host.innerHTML = '';

  const app = new PIXI.Application({
    resizeTo: host,
    backgroundColor: 0xf3f4f6,
    antialias: true,
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
  updateHUD();

  // === Création de l’ennemi ===
  const g = new PIXI.Graphics();
  drawEnemy(g);
  g.interactive = true;
  g.buttonMode = true;

  g.on('pointerdown', () => {
    if (state.isPaused) return;
    const dmg = dmgPerClick();
    state.enemyHP -= dmg;
    state.score += dmg;
    state.gold += dmg;
    updateTextLabels();

    g.scale.set(0.98);
    setTimeout(() => g.scale.set(1), 80);
    animateLabelZoom(state.scoreLabel, { endScale: 1.3, duration: 250 });

    // Bonus passif
    if (state.upgrades.passiveBonus) {
      state.clicksSincePassive++;
      if (state.clicksSincePassive >= 15) {
        const reduction = Math.max(1, Math.floor(state.enemyHP * 0.02));
        state.enemyHP -= reduction;
        state.clicksSincePassive = 0;
      }
    }

    // Mort de l’ennemi
    if (state.enemyHP <= 0) {
      state.level++;
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

  // === Textes Pixi ===
  const textStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 18,
    fill: 0x333333,
    fontWeight: 'bold',
  });

  const hpLabel = new PIXI.Text('', textStyle);
  const lvlLabel = new PIXI.Text('', textStyle);
  const scoreLabel = new PIXI.Text('Score : 0', { ...textStyle, fill: 0x007bff });
  const goldLabel = new PIXI.Text('Or : 0', { ...textStyle, fill: 0xdaa520 });

  [hpLabel, lvlLabel, scoreLabel, goldLabel].forEach(t => t.anchor.set(0.5));

  state.hpLabel = hpLabel;
  state.lvlLabel = lvlLabel;
  state.scoreLabel = scoreLabel;
  state.goldLabel = goldLabel;
  app.stage.addChild(hpLabel, lvlLabel, scoreLabel, goldLabel);

  // === BOUTIQUE (dans le Canva Pixi) ===
  createShopUI(app);

  updateTextLabels();
  centerEnemy();

  // Boucle principale
  app.ticker.add(() => {
    if (state.isPaused) return;
    const t = app.ticker.lastTime / 1000;
    const k = 10 + 6 * Math.sin(t * 2);
    drawEnemy(state.enemy, k);
    positionTextLabels();
  });
}

// =============================
// BOUTIQUE PIXI
// =============================
function createShopUI(app) {

  function setBoughtVisual(buyBg, buyText, w = 90, h = 30) {
    buyBg.clear();
    buyBg.beginFill(0xDDDDDD);
    buyBg.lineStyle(2, 0xBBBBBB);
    buyBg.drawRoundedRect(0, 0, w, h, 6);
    buyBg.endFill();

    buyText.text = 'ACHETÉ';
    buyText.style.fill = 0x777777;
  }
  // === BOUTON "BOUTIQUE" STYLISÉ ===
  const buttonContainer = new PIXI.Container();
  const buttonWidth = 130;
  const buttonHeight = 40;

  const buttonBg = new PIXI.Graphics();
  const baseColor = 0xE8E8E8;
  const hoverColor = 0xF0F0F0;
  const clickColor = 0xC4C4C4;
  const borderColor = 0xB0B0B0;

  buttonBg.beginFill(baseColor);
  buttonBg.lineStyle(2, borderColor, 1);
  buttonBg.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
  buttonBg.endFill();

  const shopButtonText = new PIXI.Text('🛒 Boutique', {
    fontFamily: 'Arial',
    fontSize: 16,
    fill: 0x4B4B4B,
    fontWeight: 'bold',
  });
  shopButtonText.anchor.set(0.5);
  shopButtonText.x = buttonWidth / 2;
  shopButtonText.y = buttonHeight / 2;

  buttonContainer.addChild(buttonBg, shopButtonText);
  buttonContainer.x = 20;
  buttonContainer.y = 20;
  buttonContainer.interactive = true;
  buttonContainer.buttonMode = true;

  function setButtonColor(color) {
    buttonBg.clear();
    buttonBg.beginFill(color);
    buttonBg.lineStyle(2, borderColor, 1);
    buttonBg.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
    buttonBg.endFill();
  }
  buttonContainer.on('pointerover', () => setButtonColor(hoverColor));
  buttonContainer.on('pointerout', () => setButtonColor(baseColor));
  buttonContainer.on('pointerdown', () => setButtonColor(clickColor));
  buttonContainer.on('pointerup', () => setButtonColor(hoverColor));

  // === FENÊTRE DE LA BOUTIQUE ===
  const shopContainer = new PIXI.Container();
  shopContainer.visible = false;

  const shopBg = new PIXI.Graphics();
  shopContainer.addChild(shopBg);

  const shopTitle = new PIXI.Text('🏪 Boutique', {
    fontFamily: 'Arial',
    fontSize: 24,
    fill: 0x333333,
    fontWeight: 'bold',
  });
  shopContainer.addChild(shopTitle);

  // === ONGLETS ===
  const tabs = ['Armes', 'Bonus'];
  let activeTab = 'Armes';
  const tabButtons = {};

  tabs.forEach((label, index) => {
    const tab = new PIXI.Container();
    const tabWidth = 120;
    const tabHeight = 38;
    const tabBg = new PIXI.Graphics();
    const tabText = new PIXI.Text(label, {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0x333333,
      fontWeight: 'bold',
    });
    tabText.anchor.set(0.5);
    tabText.x = tabWidth / 2;
    tabText.y = tabHeight / 2;

    tabBg.beginFill(label === activeTab ? 0xffffff : 0xE5E7EB);
    tabBg.lineStyle(2, 0xd1d5db);
    tabBg.drawRoundedRect(0, 0, tabWidth, tabHeight, 8);
    tabBg.endFill();

    tab.addChild(tabBg, tabText);
    tab.x = 100 + index * (tabWidth + 10);
    tab.y = 60;
    tab.interactive = true;
    tab.buttonMode = true;
    tab.on('pointerdown', () => {
      activeTab = label;
      updateTabDisplay();
    });
    tabButtons[label] = { tab, tabBg, tabText };
    shopContainer.addChild(tab);
  });

  // === ZONE SCROLLABLE BIEN PLACÉE ===
  const scrollArea = new PIXI.Container();
  const maskArea = new PIXI.Graphics();
  const scrollContent = new PIXI.Container();

  scrollArea.addChild(scrollContent);
  scrollArea.mask = maskArea;
  shopContainer.addChild(maskArea, scrollArea);

  // === CRÉATION DU CONTENU DYNAMIQUE ===
  function populateTabContent(type) {
    scrollContent.removeChildren();

    const items = type === 'Armes'
      ? [
          { name: '⚔️ Épée de bois', desc: '+2 dégâts par clic', cost: 50, effect: () => state.upgrades.weaponBonus += 2 },
          { name: '🗡️ Dague rapide', desc: '+1 dégât, clics plus rapides', cost: 80, effect: () => state.upgrades.weaponBonus += 1 },
          { name: '🏹 Arc léger', desc: '+4 dégâts', cost: 120, effect: () => state.upgrades.weaponBonus += 4 },
          { name: '🔨 Marteau lourd', desc: '+8 dégâts mais clics lents', cost: 200, effect: () => state.upgrades.weaponBonus += 8 },
          { name: '🪓 Hache de guerre', desc: '+10 dégâts', cost: 250, effect: () => state.upgrades.weaponBonus += 10 },
        ]
      : [
          { name: '✨ Bonus passif', desc: '-2 % PV / 15 clics (min 1 dmg)', cost: 100, effect: () => (state.upgrades.passiveBonus = true) },
          { name: '⚡ Bonus actif', desc: 'Clic chargé inflige 10× dégâts', cost: 150, effect: () => (state.upgrades.activeBonus = true) },
          { name: '🧠 Concentration', desc: '+10 % de gain d’or', cost: 200, effect: () => (state.upgrades.goldMultiplier = 1.1) },
        ];

    items.forEach((item, i) => {
      const itemBox = new PIXI.Graphics();
      itemBox.beginFill(0xf9fafb);
      itemBox.lineStyle(1, 0xd1d5db);
      itemBox.drawRoundedRect(0, 0, 500, 90, 8);
      itemBox.endFill();
      itemBox.y = i * 100;

      // === IMAGE (template) ===
      const imgBox = new PIXI.Graphics();
      imgBox.beginFill(0xe5e7eb);
      imgBox.lineStyle(1, 0x9ca3af);
      imgBox.drawRoundedRect(0, 0, 60, 60, 4);
      imgBox.endFill();
      imgBox.x = 20;
      imgBox.y = 15;

      const imgLabel = new PIXI.Text('IMG', {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0x374151,
        fontWeight: 'bold',
      });
      imgLabel.anchor.set(0.5);
      imgLabel.x = imgBox.x + 30;
      imgLabel.y = imgBox.y + 30;

      // === TEXTE PRINCIPAL ===
      const nameText = new PIXI.Text(item.name, {
        fontFamily: 'Arial',
        fontSize: 17,
        fill: 0x111827,
        fontWeight: 'bold',
      });
      nameText.x = 100;
      nameText.y = 18;

      const descText = new PIXI.Text(item.desc, {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0x4b5563,
      });
      descText.x = 100;
      descText.y = 45;

      // === COÛT EN OR ===
      const costText = new PIXI.Text(`${item.cost} OR`, {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xdaa520,
        fontWeight: 'bold',
      });
      costText.anchor.set(1, 0);
      costText.x = 460;
      costText.y = 25;

      // === BOUTON ACHETER ===
      const buyBg = new PIXI.Graphics();
      buyBg.beginFill(0xffffff);
      buyBg.lineStyle(2, 0x10b981);
      buyBg.drawRoundedRect(0, 0, 90, 28, 6);
      buyBg.endFill();

      const buyText = new PIXI.Text('ACHETER', {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0x10b981,
        fontWeight: 'bold',
      });
      buyText.anchor.set(0.5);
      buyText.x = 45;
      buyText.y = 14;

      const buyContainer = new PIXI.Container();
      buyContainer.addChild(buyBg, buyText);
      buyContainer.x = 370;
      buyContainer.y = 50;
      buyContainer.interactive = true;
      buyContainer.buttonMode = true;

      buyContainer.on('pointerover', () => {
        buyBg.tint = 0xC8F8E2;
      });
      buyContainer.on('pointerout', () => {
        buyBg.tint = 0xFFFFFF;
      });

      if (state.upgrades.ownedItems[item.name]) {
        setBoughtVisual(buyBg, buyText);
        buyContainer.interactive = false;
        buyContainer.buttonMode = false;
      } else {
        buyContainer.on('pointerdown', () => {
          if (state.gold < item.cost) {
            flash(host, '#ef4444');
            return;
          }

          state.gold -= item.cost;
          if (item.effect) item.effect();

          state.upgrades.ownedItems[item.name] = true;

          buyBg.clear();
          buyBg.beginFill(0xDDDDDD);
          buyBg.lineStyle(2, 0xBBBBBB);
          buyBg.drawRoundedRect(0, 0, 90, 30, 6);
          buyBg.endFill();

          buyText.text = 'ACHETÉ';
          buyText.style.fill = 0x777777;

          buyContainer.interactive = false;
          buyContainer.buttonMode = false;

          flash(host, '#10b981');
          updateTextLabels();
        });
      }

      // === AJOUT DES ÉLÉMENTS À LA CARTE ===
      itemBox.addChild(imgBox, imgLabel, nameText, descText, costText, buyContainer);
      scrollContent.addChild(itemBox);
    });
  }


  function updateTabDisplay() {
    Object.entries(tabButtons).forEach(([name, { tabBg }]) => {
      tabBg.clear();
      tabBg.beginFill(name === activeTab ? 0xffffff : 0xE5E7EB);
      tabBg.lineStyle(2, 0xd1d5db);
      tabBg.drawRoundedRect(0, 0, 120, 38, 8);
      tabBg.endFill();
    });
    populateTabContent(activeTab);
  }

  updateTabDisplay();

  // === SCROLL LOGIQUE ===
  let scrollOffset = 0;
  const scrollSpeed = 40;

  function updateScroll(maskHeight) {
    const maxScroll = Math.max(0, scrollContent.height - maskHeight);
    scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset));
    scrollContent.y = -scrollOffset;
  }

  app.renderer.view.addEventListener('wheel', (event) => {
    if (!shopContainer.visible) return;
    const rect = app.renderer.view.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - shopContainer.x;
    const mouseY = event.clientY - rect.top - shopContainer.y;
    if (
      mouseX >= scrollArea.x &&
      mouseX <= scrollArea.x + maskArea.width &&
      mouseY >= scrollArea.y &&
      mouseY <= scrollArea.y + maskArea.height
    ) {
      scrollOffset += event.deltaY > 0 ? scrollSpeed : -scrollSpeed;
      updateScroll(maskArea.height);
    }
  });

  // === FERMER ===
  const closeShop = new PIXI.Text('❌ Fermer', {
    fontFamily: 'Arial',
    fontSize: 16,
    fill: 0xff7300,
    fontWeight: 'bold',
  });
  closeShop.interactive = true;
  closeShop.buttonMode = true;
  closeShop.on('pointerdown', () => {
    shopContainer.visible = false;
    state.isPaused = false;
  });
  shopContainer.addChild(closeShop);

  // === POSITIONNEMENT AUTO ===
  function centerShop() {
    const { width, height } = app.renderer;
    const shopWidth = Math.min(600, width * 0.9);
    const shopHeight = Math.min(420, height * 0.9);

    shopBg.clear();
    shopBg.beginFill(0xf9fafb, 0.98);
    shopBg.lineStyle(2, 0xd1d5db, 1);
    shopBg.drawRoundedRect(0, 0, shopWidth, shopHeight, 16);
    shopBg.endFill();

    shopContainer.x = (width - shopWidth) / 2;
    shopContainer.y = (height - shopHeight) / 2;

    shopTitle.x = shopWidth / 2 - 60;
    shopTitle.y = 20;

    const contentTop = 110;
    const contentPadding = 40;

    maskArea.clear();
    const visibleHeight = shopHeight - (contentTop + 70);
    maskArea.beginFill(0xffffff);
    maskArea.drawRoundedRect(contentPadding, contentTop, shopWidth - 80, visibleHeight, 8);
    maskArea.endFill();

    scrollArea.x = contentPadding;
    scrollArea.y = contentTop;
    closeShop.x = shopWidth / 2 - 30;
    closeShop.y = shopHeight - 35;

    updateScroll(visibleHeight);
  }

  buttonContainer.on('pointerup', () => {
    centerShop();
    state.isPaused = true;
    shopContainer.visible = true;
  });
  app.renderer.on('resize', centerShop);

  // === AJOUT STAGE ===
  app.stage.addChild(buttonContainer, shopContainer);
  state.shopButton = buttonContainer;
  state.shopContainer = shopContainer;
}




// =============================
// TEXTES
// =============================
function updateTextLabels() {
  if (!state.hpLabel) return;
  state.hpLabel.text = `PV : ${Math.max(0, state.enemyHP)} / ${state.enemyMaxHP}`;
  state.lvlLabel.text = `Niveau ${state.level}`;
  state.scoreLabel.text = `Score : ${state.score}`;
  if (state.goldLabel) state.goldLabel.text = `Or : ${Math.floor(state.gold)}`;
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
  state.goldLabel.x = width / 2;
  state.goldLabel.y = 70;
}

// =============================
// ANIM LABEL
// =============================
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

// =============================
// ENNEMI
// =============================
function drawEnemy(g, radius = 80) {
  const { width, height } = state.app.renderer;
  g.clear();
  const cx = width / 2, cy = height / 2;
  g.beginFill(0xf87171);
  g.drawCircle(cx, cy, radius);
  g.endFill();

  const pct = Math.max(0, state.enemyHP) / state.enemyMaxHP;
  g.lineStyle(8, 0x10b981, 1);
  g.arc(cx, cy, radius + 14, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
}

function centerEnemy() {
  if (!state.app || !state.enemy) return;
  drawEnemy(state.enemy);
  positionTextLabels();
}

// =============================
// GESTION GÉNÉRALE
// =============================
function togglePause() {
  state.isPaused = !state.isPaused;
  pauseBtn.textContent = state.isPaused ? '▶️ Reprendre' : '⏸️ Pause';
}

function resetGame() {
  saveBestScore();
  if (state.app) state.app.destroy(true, { children: true });
  state.app = null;
  state.enemy = null;
  host.innerHTML = '<span>En attente de la configuration.</span>';
  state.gold = 0;
  state.score = 0;
  state.level = 1;
  updateHUD();
  pauseBtn.textContent = '⏸️ Pause';
}

function flash(el, color = '#6ee7ff') {
  el.animate([
    { boxShadow: '0 0 0 rgba(0,0,0,0)' },
    { boxShadow: `0 0 0 6px ${color}33` },
    { boxShadow: '0 0 0 rgba(0,0,0,0)' },
  ], { duration: 450, easing: 'ease-out' });
}
