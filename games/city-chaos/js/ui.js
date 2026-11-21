// ---------------------------------------------------------------------------
// HUD, tool belt, spawn browser and settings. All markup lives in the page;
// this module fills it, keeps it in sync with the game and never leaves a
// button that does nothing.
// ---------------------------------------------------------------------------
import { TOOLS, CATEGORIES, CATALOG } from './config.js';

const $ = (id) => document.getElementById(id);

const CLOCK = { day: '12:10', dusk: '19:25', night: '23:40' };

export class UI {
  constructor(game) {
    this.game = game;
    this.toolbar = $('toolbar');
    this.contextTitle = $('ctx-title');
    this.contextKey = $('ctx-key');
    this.contextDesc = $('ctx-desc');
    this.contextTarget = $('ctx-target');
    this.healthWrap = $('ctx-health');
    this.healthBar = $('ctx-health-bar');
    this.hints = $('hints');
    this.fpsLabel = $('fps-label');
    this.clockLabel = $('clock-label');
    this.modeLabel = $('mode-label');
    this.promptEl = $('prompt');
    this.toastBox = $('toasts');
    this.searchInput = $('spawn-search');
    this.spawnRoot = $('spawn');
    this.cards = $('spawn-cards');
    this.cats = $('spawn-cats');
    this.detailName = $('detail-name');
    this.detailDesc = $('detail-desc');
    this.detailThumb = $('detail-thumb');
    this.detailSpecs = $('detail-specs');
    this.spawnButton = $('detail-spawn');
    this.recentWrap = $('spawn-recent');
    this.recentRow = $('recent-row');
    this.emptyNote = $('spawn-empty');
    this.pauseRoot = $('pause');
    this.loading = $('loading');
    this.loadBar = $('load-bar');
    this.loadText = $('load-text');

    this.activeCategory = 'vehicles';
    this.query = '';
    this.selectedItem = null;
    this.recent = [];
    this.thumbs = new Map();
    this.crosshair = $('crosshair');
    this.fpsVisible = true;
    this.fpsFrames = 0;
    this.fpsAccum = 0;
    this.modal = null;
    this.controlsOpen = false;
  }

  init() {
    this.renderToolbar(this.game.tools.current);
    const tool = TOOLS.find((entry) => entry.id === this.game.tools.current);
    this.setContext(tool);
    this.setHints(tool.hints);
    this.buildCategories();
    this.renderCards();
    this.wireSpawn();
    this.wireSettings();
    this.setClock(CLOCK.day);
    this.setMode('Sandbox');
    this.setPrompt('');

    // keep the toolbar honest when the tool changes from a key or the menu
    this.game.tools.onToolChange = (id) => {
      this.renderToolbar(id);
      const entry = TOOLS.find((item) => item.id === id);
      if (entry) {
        this.setContext(entry);
        this.setHints(entry.hints);
      }
    };
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------
  renderToolbar(activeId) {
    if (!this.toolbar) return;
    this.toolbar.innerHTML = '';
    for (const tool of TOOLS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool';
      button.title = `${tool.name} (${tool.key})`;
      button.setAttribute('aria-label', tool.name);
      button.setAttribute('aria-pressed', String(tool.id === activeId));
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${tool.icon}</svg><span class="tool-num">${tool.key}</span>`;
      button.addEventListener('click', () => {
        this.game.tools.setTool(tool.id);
        this.game.lockPointer?.();
      });
      this.toolbar.appendChild(button);
    }
  }

  setContext(tool) {
    if (!tool) return;
    this.contextTitle.textContent = tool.name;
    this.contextKey.textContent = tool.key;
    this.contextDesc.textContent = tool.desc;
  }

  setHints(hints = []) {
    this.hints.innerHTML = hints.map((line) => `<span>${line}</span>`).join('');
  }

  setTarget(entity) {
    if (!this.contextTarget) return;
    if (!entity || entity.dead) {
      this.contextTarget.textContent = 'Nothing selected';
      this.healthWrap.hidden = true;
      return;
    }
    const building = entity.building;
    const name = building ? building.name : entity.vehicle ? entity.vehicle.spec.name : entity.name;
    this.contextTarget.innerHTML = `<b>${name}</b>${entity.frozen ? ' · frozen' : ''}`;
    const hp = building ? building.hp : entity.hp;
    const maxHp = building ? building.maxHp : entity.maxHp;
    if (typeof hp === 'number' && typeof maxHp === 'number' && maxHp > 0 && (entity.damageable || building)) {
      this.healthWrap.hidden = false;
      const pct = Math.max(0, Math.min(1, hp / maxHp));
      this.healthBar.style.width = `${pct * 100}%`;
      this.healthBar.style.background = pct > 0.55 ? 'var(--good)' : pct > 0.25 ? 'var(--lamp)' : 'var(--bad)';
    } else {
      this.healthWrap.hidden = true;
    }
  }

  setCrosshair(on) {
    this.crosshair?.classList.toggle('active', !!on);
  }

  setPrompt(html) {
    if (!this.promptEl) return;
    if (!html) {
      this.promptEl.hidden = true;
      this.promptEl.innerHTML = '';
      return;
    }
    this.promptEl.innerHTML = html;
    this.promptEl.hidden = false;
  }

  setMode(text) {
    if (this.modeLabel) this.modeLabel.textContent = text;
  }

  setClock(text) {
    if (this.clockLabel) this.clockLabel.textContent = text;
  }

  setTimeMode(mode) {
    this.setClock(CLOCK[mode] || CLOCK.day);
  }

  setLoading(progress, text) {
    if (this.loadBar) this.loadBar.style.width = `${progress}%`;
    if (text && this.loadText) this.loadText.textContent = text;
  }

  hideLoading() {
    if (this.loading) this.loading.hidden = true;
  }

  showCrash(message) {
    const crash = $('crash');
    const text = $('crash-text');
    if (text && message) text.textContent = message;
    if (crash) crash.hidden = false;
    if (this.loading) this.loading.hidden = true;
  }

  toast(text, kind = '') {
    if (!this.toastBox) return;
    const node = document.createElement('div');
    node.className = `toast ${kind}`.trim();
    node.textContent = text;
    this.toastBox.appendChild(node);
    while (this.toastBox.children.length > 3) this.toastBox.firstElementChild.remove();
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 250);
    }, 2400);
  }

  tickFPS(dt) {
    this.fpsFrames++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 0.4) {
      const fps = Math.round(this.fpsFrames / this.fpsAccum);
      if (this.fpsVisible) this.fpsLabel.textContent = `${fps} FPS`;
      this.fpsFrames = 0;
      this.fpsAccum = 0;
    }
  }

  // -------------------------------------------------------------------------
  // Spawn browser
  // -------------------------------------------------------------------------
  buildCategories() {
    this.cats.innerHTML = '';
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'cat';
    all.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg><span>All</span><span class="count">${CATALOG.length}</span>`;
    all.setAttribute('aria-pressed', String(this.activeCategory === 'all'));
    all.addEventListener('click', () => this.setCategory('all'));
    this.cats.appendChild(all);

    for (const category of CATEGORIES) {
      const count = CATALOG.filter((item) => item.cat === category.id).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cat';
      button.dataset.cat = category.id;
      button.setAttribute('aria-pressed', String(this.activeCategory === category.id));
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${category.icon}</svg><span>${category.name}</span><span class="count">${count}</span>`;
      button.addEventListener('click', () => this.setCategory(category.id));
      this.cats.appendChild(button);
    }
  }

  setCategory(id) {
    this.activeCategory = id;
    for (const button of this.cats.querySelectorAll('.cat')) {
      const cat = button.dataset.cat || 'all';
      button.setAttribute('aria-pressed', String(cat === id));
    }
    this.renderCards();
  }

  filteredItems() {
    const query = this.query.trim().toLowerCase();
    return CATALOG.filter((item) => {
      if (this.activeCategory !== 'all' && item.cat !== this.activeCategory) return false;
      if (!query) return true;
      const haystack = `${item.name} ${item.desc} ${item.cat} ${item.tags || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  renderCards() {
    const items = this.filteredItems();
    this.cards.innerHTML = '';
    this.emptyNote.hidden = items.length > 0;
    for (const item of items) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.setAttribute('aria-selected', String(this.selectedItem?.id === item.id));
      card.dataset.id = item.id;
      const thumb = document.createElement('span');
      thumb.className = 'thumb';
      const image = this.game.makeThumb ? this.game.makeThumb(item) : null;
      if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.alt = '';
        img.loading = 'lazy';
        thumb.appendChild(img);
      }
      const text = document.createElement('span');
      text.className = 'card-text';
      text.innerHTML = `<strong>${item.name}</strong><em>${this.categoryLabel(item.cat)}</em>`;
      card.appendChild(thumb);
      card.appendChild(text);
      card.addEventListener('click', () => this.selectItem(item));
      card.addEventListener('dblclick', () => {
        this.selectItem(item);
        this.spawnSelected();
      });
      this.cards.appendChild(card);
    }
    if (this.selectedItem && !items.some((item) => item.id === this.selectedItem.id)) {
      this.selectedItem = null;
      this.renderDetail();
    }
    if (!this.selectedItem && items.length) this.selectItem(items[0]);
    this.renderRecent();
  }

  categoryLabel(id) {
    const category = CATEGORIES.find((entry) => entry.id === id);
    return category ? category.name : id;
  }

  selectItem(item) {
    this.selectedItem = item;
    for (const card of this.cards.querySelectorAll('.card')) {
      card.setAttribute('aria-selected', String(card.dataset.id === item.id));
    }
    this.renderDetail();
  }

  renderDetail() {
    const item = this.selectedItem;
    this.spawnButton.disabled = !item;
    this.detailThumb.innerHTML = '';
    this.detailSpecs.innerHTML = '';
    if (!item) {
      this.detailName.textContent = 'Select an object';
      this.detailDesc.textContent = 'Browse the shelf, then spawn it in front of you.';
      return;
    }
    this.detailName.textContent = item.name;
    this.detailDesc.textContent = item.desc;
    const image = this.game.makeThumb ? this.game.makeThumb(item) : null;
    if (image) {
      const img = document.createElement('img');
      img.src = image;
      img.alt = '';
      this.detailThumb.appendChild(img);
    }
    const specs = [
      ['Category', this.categoryLabel(item.cat)],
      ['Mass', `${Math.round(item.mass).toLocaleString('en-GB')} kg`],
      ['Size', `${item.size[0].toFixed(1)} × ${item.size[1].toFixed(1)} × ${item.size[2].toFixed(1)} m`],
      ['Physics', item.cat === 'vehicles' ? 'Drivable body' : item.build === 'ragdoll' ? 'Jointed ragdoll' : 'Rigid body'],
    ];
    this.detailSpecs.innerHTML = specs.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  }

  renderRecent() {
    this.recentWrap.hidden = this.recent.length === 0;
    this.recentRow.innerHTML = '';
    for (const id of this.recent) {
      const item = CATALOG.find((entry) => entry.id === id);
      if (!item) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'recent-chip';
      chip.innerHTML = `<i></i><span>${item.name}</span>`;
      chip.addEventListener('click', () => {
        this.selectedItem = item;
        this.spawnSelected();
      });
      this.recentRow.appendChild(chip);
    }
  }

  spawnSelected() {
    if (!this.selectedItem) return;
    const item = this.selectedItem;
    this.game.spawnFromMenu(item);
    this.recent = [item.id, ...this.recent.filter((id) => id !== item.id)].slice(0, 6);
    this.renderRecent();
    this.closeSpawn();
  }

  wireSpawn() {
    this.searchInput.addEventListener('input', () => {
      this.query = this.searchInput.value;
      this.renderCards();
    });
    $('spawn-close').addEventListener('click', () => this.closeSpawn());
    this.spawnButton.addEventListener('click', () => this.spawnSelected());
    this.spawnRoot.addEventListener('click', (event) => {
      if (event.target === this.spawnRoot) this.closeSpawn();
    });
  }

  openSpawn() {
    if (this.modal === 'pause') return;
    this.modal = 'spawn';
    this.spawnRoot.hidden = false;
    this.renderCards();
    this.renderDetail();
    this.game.releasePointer?.();
    this.game.ui?.setHints(['<b>Click</b> a card to inspect', '<b>Double-click</b> or <b>Spawn</b> to place it', '<b>Tab</b> closes']);
    setTimeout(() => this.searchInput.focus({ preventScroll: true }), 40);
  }

  closeSpawn() {
    this.modal = null;
    this.spawnRoot.hidden = true;
    const tool = TOOLS.find((entry) => entry.id === this.game.tools.current);
    this.setHints(tool?.hints || []);
    this.game.lockPointer?.();
  }

  // -------------------------------------------------------------------------
  // Pause and settings
  // -------------------------------------------------------------------------
  openPause() {
    this.modal = 'pause';
    this.pauseRoot.hidden = false;
    this.game.paused = true;
    this.game.releasePointer?.();
  }

  closePause() {
    this.modal = null;
    this.pauseRoot.hidden = true;
    this.game.paused = false;
    this.game.lockPointer?.();
  }

  togglePause() {
    if (this.modal === 'pause') this.closePause();
    else if (this.modal === 'spawn') this.closeSpawn();
    else this.openPause();
  }

  wireSettings() {
    const values = () => ({
      quality: $('set-quality').value,
      shadows: $('set-shadows').value,
      time: $('set-time').value,
      fps: $('set-fps').checked,
      physics: $('set-physics').value,
      shake: Number($('set-shake').value) / 100,
      mouse: Number($('set-mouse').value),
      cam: Number($('set-cam').value),
      volume: Number($('set-volume').value) / 100,
    });

    const apply = () => {
      const settings = values();
      this.fpsVisible = settings.fps;
      this.fpsLabel.hidden = !settings.fps;
      this.game.applySettings(settings);
    };

    for (const id of ['set-quality', 'set-shadows', 'set-time', 'set-fps', 'set-physics']) {
      $(id).addEventListener('change', apply);
    }
    for (const id of ['set-shake', 'set-mouse', 'set-cam', 'set-volume']) {
      $(id).addEventListener('input', apply);
    }

    $('resume').addEventListener('click', () => this.closePause());
    $('pause-close').addEventListener('click', () => this.closePause());
    $('pause').addEventListener('click', (event) => {
      if (event.target === this.pauseRoot) this.closePause();
    });
    $('reset-city').addEventListener('click', () => {
      this.closePause();
      this.game.rebuildCity();
    });
    $('freecam').addEventListener('click', () => {
      this.closePause();
      this.game.player.toggleFreeCam(true);
    });
    $('quit').addEventListener('click', () => {
      this.controlsOpen = !this.controlsOpen;
      $('controls').hidden = !this.controlsOpen;
      $('quit').textContent = this.controlsOpen ? 'Hide controls' : 'Controls';
    });

    this.applySettings = apply;
    this.setTimeSelect = (mode) => { $('set-time').value = mode; };
  }
}
