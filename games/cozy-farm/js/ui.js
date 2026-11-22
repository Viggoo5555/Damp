import { CROPS, HAY_PRICE } from './store.js';
import { IMPLEMENTS } from './tractor.js';

/* =====================================================================
   COZY FARM — the interface
   Warm paper, sage and wheat. The board is the one place the numbers get
   loud: a live market for everything in the barn.
   ===================================================================== */

const icon = (id, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

const QUESTS = [
  { id: 'plowed', text: 'Plough 6 squares', done: s => s.stats.plowed >= 6, progress: s => Math.min(6, s.stats.plowed) + '/6' },
  { id: 'planted', text: 'Sow your first crop', done: s => s.stats.planted >= 1 },
  { id: 'watered', text: 'Water or feed a row', done: s => s.stats.watered >= 1 },
  { id: 'harvested', text: 'Harvest a ripe crop', done: s => s.stats.harvested >= 1 },
  { id: 'sold', text: 'Sell at the farm shop', done: s => s.stats.sold >= 1 }
];

function money(n) {
  return 'kr ' + Math.round(n).toLocaleString('en-GB');
}

export function createUI({ store, input, onTool, onCrop, onSell, onReset, onStart }) {
  const $ = id => document.getElementById(id);
  const state = store.state;
  const toolsEl = $('tools');
  const questsEl = $('quests');
  const sheet = $('sheet');
  const sheetTitle = $('sheet-title');
  const sheetBody = $('sheet-body');
  const toastEl = $('toast');
  let sheetName = '';
  let toastTimer = 0;
  let lastQuestKey = '';
  let lastSheetKey = '';

  toolsEl.innerHTML = IMPLEMENTS.map(tool => `
    <button class="tool" type="button" data-tool="${tool.id}" aria-pressed="false">
      <span class="tool-ico">${icon(tool.icon)}</span>
      <span class="tool-name">${tool.name}</span>
    </button>`).join('');

  $('seed-name').textContent = store.cropById(state.selectedCrop).name;

  function toast(title, text, tone = 'good') {
    toastEl.className = 'toast on ' + tone;
    toastEl.innerHTML = `<strong>${title}</strong>${text ? `<span>${text}</span>` : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'toast ' + tone; }, 2800);
  }

  function openSheet(name) {
    sheetName = name;
    sheet.classList.add('on');
    document.body.classList.add('sheet-open');
    renderSheet(true);
    lastSheetKey = '';
  }

  function closeSheet() {
    sheetName = '';
    sheet.classList.remove('on');
    document.body.classList.remove('sheet-open');
  }

  function renderSheet(force) {
    if (!sheetName) return;
    const key = sheetName + '|' + Math.round(store.state.market.wheat.price * 1000);
    if (!force && key === lastSheetKey) return;
    lastSheetKey = key;
    const s = store.state;
    if (sheetName === 'market') {
      sheetTitle.innerHTML = 'The farm shop <span class="sheet-sub">live market prices</span>';
      const rows = CROPS.map(c => {
        const m = s.market[c.id];
        const up = m.price >= m.prev;
        const diff = m.price - m.prev;
        const moved = Math.abs(diff) >= 0.005;
        const kg = Math.round(s.barn[c.id] || 0);
        return `<tr>
          <td class="crop-cell"><span class="dot" style="background:${c.head}"></span>${c.name}</td>
          <td class="price-cell"><b>${m.price.toFixed(2)}</b><small>kr/kg</small></td>
          <td class="trend ${moved ? (up ? 'up' : 'down') : ''}">${moved ? (up ? '▲' : '▼') + ' ' + Math.abs(diff).toFixed(2) : '—'}</td>
          <td class="stock-cell">${kg ? kg + ' kg' : '—'}</td>
          <td class="value-cell">${kg ? money(kg * m.price) : '—'}</td>
        </tr>`;
      }).join('');
      const hayRow = `<tr>
        <td class="crop-cell"><span class="dot" style="background:#dcc27c"></span>Hay bales</td>
        <td class="price-cell"><b>${HAY_PRICE}</b><small>kr each</small></td>
        <td class="trend">—</td>
        <td class="stock-cell">${s.hay ? s.hay : '—'}</td>
        <td class="value-cell">${s.hay ? money(s.hay * HAY_PRICE) : '—'}</td>
      </tr>`;
      const total = store.barnValue();
      sheetBody.innerHTML = `
        <p class="sheet-note">Prices drift through the day like a real commodity board. Sell when the number is green.</p>
        <div class="market-table"><table><thead><tr><th>Crop</th><th>Price</th><th>Today</th><th>In barn</th><th>Value</th></tr></thead><tbody>${rows}${hayRow}</tbody></table></div>
        <div class="sell-row">
          <div><span class="sell-label">Barn value</span><strong class="sell-total">${money(total)}</strong></div>
          <button class="btn primary" type="button" data-sell ${total <= 0 ? 'disabled' : ''}>Sell everything</button>
        </div>
        <p class="sheet-foot" id="sell-hint">${total <= 0 ? 'Harvest something first, then drive to the shop.' : (ui.nearShop ? 'You are at the shop — sell now.' : 'Drive to the farm shop to sell. It is the stall with the striped awning.')}</p>`;
    } else if (sheetName === 'seeds') {
      sheetTitle.innerHTML = 'Seed drawer <span class="sheet-sub">what goes in the drill</span>';
      sheetBody.innerHTML = `<p class="sheet-note">Seeds are bought per square as you sow. Water and feed a crop to make it worth more.</p>
        <div class="seed-grid">${CROPS.map(c => {
        const m = s.market[c.id];
        return `<button class="seed-card ${s.selectedCrop === c.id ? 'on' : ''}" type="button" data-crop="${c.id}">
            <span class="seed-ico" style="--c:${c.leaf}">${icon('seed')}</span>
            <strong>${c.name}</strong>
            <em>${c.blurb}</em>
            <span class="seed-stats">
              <span><b>${c.seed}</b> kr seed</span>
              <span><b>${c.grow}s</b> to grow</span>
              <span><b>${c.yield}</b> kg</span>
              <span><b>${m.price.toFixed(2)}</b> kr/kg</span>
            </span>
            <span class="seed-pick">${s.selectedCrop === c.id ? 'In the drill' : 'Choose'}</span>
          </button>`;
      }).join('')}</div>`;
    } else if (sheetName === 'help') {
      sheetTitle.innerHTML = 'How to farm <span class="sheet-sub">ten quiet minutes</span>';
      sheetBody.innerHTML = `
        <div class="help-grid">
          <div class="help-card"><h3>${icon('plow')}Drive</h3><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys. On a phone, use the round pad. Drag the meadow to look around.</p></div>
          <div class="help-card"><h3>${icon('seed')}Hang a tool on the back</h3><p>Tap a tool below the field. One fits at a time. Drive over the squares and the tool does the work.</p></div>
          <div class="help-card"><h3>${icon('water')}Water and feed</h3><p>Refill the water tank at the pond, and the spreader at the farm shop. Both make a crop grow faster and sell heavier.</p></div>
          <div class="help-card"><h3>${icon('market')}Watch the board</h3><p>Every crop sells by the kilo at a drifting market price. Take the harvest to the shop and sell when the arrows are up.</p></div>
        </div>
        <div class="help-tools">${IMPLEMENTS.map(t => `<div><b>${t.name}</b><span>${t.tag}</span></div>`).join('')}</div>
        <div class="help-foot"><button class="btn soft" type="button" data-reset>Start a fresh farm</button><span>All progress is saved on this device.</span></div>`;
    }
  }

  function renderQuests() {
    const s = store.state;
    const key = QUESTS.map(q => q.done(s) ? '1' : '0').join('') + s.stats.plowed;
    if (key === lastQuestKey) return;
    lastQuestKey = key;
    questsEl.innerHTML = QUESTS.map(q => {
      const done = q.done(s);
      return `<span class="quest ${done ? 'done' : ''}">${icon(done ? 'check' : 'leaf')}${q.text}${q.progress && !done ? `<em>${q.progress(s)}</em>` : ''}</span>`;
    }).join('');
  }

  const ui = {
    nearShop: false,
    nearPond: false,
    started: false,
    update(ctx) {
      const s = store.state;
      $('money').textContent = money(s.money);
      $('day').textContent = s.day;
      $('barn').textContent = Math.round(store.barnTotal()).toLocaleString('en-GB') + ' kg';
      $('hay').textContent = s.hay + (s.hay === 1 ? ' bale' : ' bales');
      $('speed').textContent = Math.round(ctx.speedKmh || 0) + ' km/h';
      $('seed-name').textContent = store.cropById(s.selectedCrop).name;
      document.querySelectorAll('.tool').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.tool === s.tool));
        btn.classList.toggle('on', btn.dataset.tool === s.tool);
      });
      const def = IMPLEMENTS.find(t => t.id === s.tool) || IMPLEMENTS[0];
      $('tool-name').textContent = def.name;
      $('tool-tag').textContent = def.tag;
      $('tool-ico').innerHTML = icon(def.icon);
      ui.nearShop = !!ctx.nearShop;
      ui.nearPond = !!ctx.nearPond;
      $('shop-flag').classList.toggle('on', ui.nearShop);
      $('pond-flag').classList.toggle('on', ui.nearPond);

      const water = s.water, fert = s.fertilizer;
      $('water-fill').style.width = Math.round(water * 100) + '%';
      $('fert-fill').style.width = Math.round(fert * 100) + '%';
      $('supply').classList.toggle('show', s.tool === 'water' || s.tool === 'fertilize');
      $('water-gauge').classList.toggle('empty', water < 0.05);
      $('fert-gauge').classList.toggle('empty', fert < 0.05);

      $('hint').textContent = ctx.hint || '';
      $('hint').classList.toggle('on', !!ctx.hint);
      $('btn-market').classList.toggle('ready', ui.nearShop && store.barnValue() > 0);
      $('btn-market-label').textContent = ui.nearShop && store.barnValue() > 0 ? 'Sell' : 'Market';
      renderQuests();
      if (sheetName) {
        renderSheet(false);
        const hint = document.getElementById('sell-hint');
        if (hint && sheetName === 'market') {
          const total = store.barnValue();
          hint.textContent = total <= 0 ? 'Harvest something first, then drive to the shop.' : (ui.nearShop ? 'You are at the shop — sell now.' : 'Drive to the farm shop to sell. It is the stall with the striped awning.');
          const sell = sheetBody.querySelector('[data-sell]');
          if (sell) sell.disabled = total <= 0 || !ui.nearShop;
        }
      }
    },
    toast,
    openSheet,
    closeSheet,
    setHint(text) { $('hint').textContent = text || ''; $('hint').classList.toggle('on', !!text); },
    start() {
      ui.started = true;
      $('intro').classList.remove('on');
      onStart();
    },
    showIntro(show) {
      $('intro').classList.toggle('on', !!show);
    }
  };

  // ---- events -------------------------------------------------------
  document.addEventListener('click', e => {
    const tool = e.target.closest('[data-tool]');
    if (tool) { onTool(tool.dataset.tool); return; }
    const crop = e.target.closest('[data-crop]');
    if (crop) { onCrop(crop.dataset.crop); renderSheet(true); return; }
    if (e.target.closest('[data-sell]')) { onSell(); renderSheet(true); return; }
    if (e.target.closest('[data-reset]')) {
      if (window.confirm('Start a fresh farm? The barn, the field and the money all reset.')) { onReset(); }
      return;
    }
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    if (e.target.closest('#btn-market')) { openSheet('market'); return; }
    if (e.target.closest('#btn-seeds')) { openSheet('seeds'); return; }
    if (e.target.closest('#btn-help') || e.target.closest('#btn-help2')) { openSheet('help'); return; }
  });

  $('intro-start').addEventListener('click', () => {
    try { localStorage.setItem('cozy-farm-seen', '1'); } catch (error) { /* blocked */ }
    ui.start();
  });
  $('intro-help').addEventListener('click', () => { ui.start(); openSheet('help'); });

  // touch drive pad
  const pad = $('pad');
  ['forward', 'back', 'left', 'right'].forEach(dir => {
    const btn = pad.querySelector(`[data-drive="${dir}"]`);
    const press = e => { e.preventDefault(); input[dir] = 1; btn.classList.add('down'); };
    const release = e => { if (e) e.preventDefault(); input[dir] = 0; btn.classList.remove('down'); };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  });

  return ui;
}
