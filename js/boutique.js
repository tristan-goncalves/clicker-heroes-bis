import * as PIXI from 'pixi.js';
import { state, flash } from './configuration.js';

// Boutique PIXI
export function createShopUI(app) {
  function setBoughtVisual(buyBg, buyText, w = 90, h = 30) {
    buyBg.clear();
    buyBg.beginFill(0xE5E7EB);
    buyBg.lineStyle(2, 0x9CA3AF);
    buyBg.drawRoundedRect(0, 0, w, h, 6);
    buyBg.endFill();

    buyText.text = 'ACHETÉ';
    buyText.style.fill = 0x6B7280;
    buyBg.tint = 0xFFFFFF;
  }

  // Bouton de la boutique
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

  // Fenêtre de la boutique
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

  // Les deux onglets de la boutique (Armes, Bonus)
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

  // Zone scrollable de la boutique
  const scrollArea = new PIXI.Container();
  const maskArea = new PIXI.Graphics();
  const scrollContent = new PIXI.Container();

  scrollArea.addChild(scrollContent);
  scrollArea.mask = maskArea;
  shopContainer.addChild(maskArea, scrollArea);

  // Le contenu de boutique (Armes, Bonus)
  function populateTabContent(type) {
    scrollContent.removeChildren();

    const items = type === 'Armes'
      ? [
          { name: 'Canif basique', desc: '+2 dégâts par clic', cost: 50, image: 'canif_basique.png', effect: () => (state.upgrades.weaponBonus += 2) },
          { name: 'Dague de vampire', desc: '+1 dégât, Hémorragie (+1 dégât / 2s)', cost: 80, image: 'dague_vampire.png', effect: () => { state.upgrades.weaponBonus += 1; state.upgrades.hemorrhage = true; } },
          { name: 'Mattraque enragée', desc: '+4 dégâts par clic', cost: 120, image: 'mattraque_enragee.png', effect: () => (state.upgrades.weaponBonus += 4) },
          { name: 'Pioche en diamant', desc: "+2 dégâts, 10% de doubler le gain d'or", cost: 200, image: 'pioche_en_diamant.png', effect: () => { state.upgrades.weaponBonus += 2; state.upgrades.doubleGoldChance = 0.1; } },
          { name: 'Marteau de Smough', desc: '+10 dégâts par clic', cost: 800, image: 'marteau_de_smough.png', effect: () => (state.upgrades.weaponBonus += 10) },
        ]
      : [
          { name: 'Passif  —  Brûlure', desc: '-2 % PV / 15 clics (min 1 de dégât)', cost: 100, image: 'brulure.png', effect: () => (state.upgrades.passiveBonus = true) },
          { name: 'Actif  —  Charge', desc: 'Clic chargé (2 sec) inflige 5× dégâts', cost: 150, image: 'charge.png', effect: () => (state.upgrades.activeBonus = true) },
          { name: 'Passif  —  Concentration', desc: '+10 % de gain d’or', cost: 200, image: 'concentration.png', effect: () => (state.upgrades.goldMultiplier = 1.1) },
        ];

    items.forEach((item, i) => {
      const itemBox = new PIXI.Graphics();
      itemBox.beginFill(0xf9fafb);
      itemBox.lineStyle(1, 0xd1d5db);
      itemBox.drawRoundedRect(0, 0, 500, 90, 8);
      itemBox.endFill();
      itemBox.y = i * 100;

      // Image de l'item
      const texturePath = `./img/${item.image}`;
      let itemImage;

      try {
        const texture = PIXI.Texture.from(texturePath);
        itemImage = new PIXI.Sprite(texture);
        itemImage.width = 50;
        itemImage.height = 50;
        itemImage.x = 25;
        itemImage.y = 20;
        itemImage.roundPixels = true;
      } catch (e) {
        const placeholder = new PIXI.Graphics();
        placeholder.beginFill(0xe5e7eb);
        placeholder.lineStyle(1, 0x9ca3af);
        placeholder.drawRoundedRect(0, 0, 60, 60, 4);
        placeholder.endFill();
        itemImage = placeholder;
      }

      // Configuration des textes de la boutique
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

      // Gestion du prix des items
      const costContainer = new PIXI.Container();
      
      // Texte du montant
      const costText = new PIXI.Text(`${item.cost}`, {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0xdaa520,
      fontWeight: 'bold',
      });
      costText.anchor.set(1, 0);
      
      // Icône de pièce
      const coinTexture = PIXI.Texture.from('./img/gold.png');
      const coinSprite = new PIXI.Sprite(coinTexture);
      coinSprite.width = 20;
      coinSprite.height = 20;
      coinSprite.x = costText.x + 8;
      coinSprite.y = costText.y + 5;
      costContainer.addChild(costText, coinSprite);
      costContainer.x = 460;
      costContainer.y = 15;


      // Bouton "ACHETER"
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

      buyContainer.on('pointerover', () => (buyBg.tint = 0xC8F8E2));
      buyContainer.on('pointerout', () => (buyBg.tint = 0xFFFFFF));

      if (state.upgrades.ownedItems[item.name]) {
        setBoughtVisual(buyBg, buyText);
        buyContainer.interactive = false;
        buyContainer.buttonMode = false;
      } else {
        buyContainer.on('pointerdown', () => {
          if (state.gold < item.cost) {
            flash(app.view.parentNode, '#ef4444');
            return;
          }
          state.gold -= item.cost;
          if (item.effect) item.effect();
          state.upgrades.ownedItems[item.name] = true;
          if (state.goldLabel) state.goldLabel.text = `${Math.floor(state.gold)}`;
          setBoughtVisual(buyBg, buyText);
          buyContainer.interactive = false;
          buyContainer.buttonMode = false;
          flash(app.view.parentNode, '#10b981');
        });
      }

      itemBox.addChild(itemImage, nameText, descText, costContainer, buyContainer);
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

  // Gestion du scroll
  let scrollOffset = 0;
  const scrollSpeed = 40;

  function updateScroll(maskHeight) {
    const maxScroll = Math.max(0, scrollContent.height - maskHeight);
    scrollOffset = Math.max(0, Math.min(maxScroll, scrollOffset));
    scrollContent.y = -scrollOffset;
  }

  app.renderer.view.addEventListener('wheel', event => {
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

  // Bouton "FERMER" de la boutique
  const closeShop = new PIXI.Container();
  const closeWidth = 90;
  const closeHeight = 32;
  const closeBg = new PIXI.Graphics();
  const baseCloseColor = 0xE5E7EB;
  const hoverCloseColor = 0xFCA5A5;
  const clickCloseColor = 0xF87171;
  const borderCloseColor = 0xDC2626;

  closeBg.beginFill(baseCloseColor);
  closeBg.lineStyle(2, borderCloseColor, 1);
  closeBg.drawRoundedRect(0, 0, closeWidth, closeHeight, 8);
  closeBg.endFill();

  const closeText = new PIXI.Text('❌ Fermer', {
    fontFamily: 'Arial',
    fontSize: 15,
    fill: 0xB91C1C,
    fontWeight: 'bold',
  });
  closeText.anchor.set(0.5);
  closeText.x = closeWidth / 2;
  closeText.y = closeHeight / 2;

  closeShop.addChild(closeBg, closeText);
  closeShop.interactive = true;
  closeShop.buttonMode = true;

  function setCloseColor(color) {
    closeBg.clear();
    closeBg.beginFill(color);
    closeBg.lineStyle(2, borderCloseColor, 1);
    closeBg.drawRoundedRect(0, 0, closeWidth, closeHeight, 8);
    closeBg.endFill();
  }

  closeShop.on('pointerover', () => setCloseColor(hoverCloseColor));
  closeShop.on('pointerout', () => setCloseColor(baseCloseColor));
  closeShop.on('pointerdown', () => setCloseColor(clickCloseColor));
  closeShop.on('pointerup', () => setCloseColor(hoverCloseColor));

  closeShop.on('pointerdown', () => {
    shopContainer.visible = false;
    state.isPaused = false;
  });
  shopContainer.addChild(closeShop);

  // Centrer la boutique
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

    closeShop.x = (shopWidth - closeWidth) / 2;
    closeShop.y = shopHeight - closeHeight - 16;

    updateScroll(visibleHeight);
  }

  buttonContainer.on('pointerup', () => {
    centerShop();
    state.isPaused = true;
    shopContainer.visible = true;
  });
  app.renderer.on('resize', centerShop);

  // Ajout de la boutique
  app.stage.addChild(buttonContainer, shopContainer);
  state.shopButton = buttonContainer;
  state.shopContainer = shopContainer;
}
