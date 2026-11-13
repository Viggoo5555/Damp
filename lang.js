/* Damp language layer: one preference shared by every game.
   Usage: <script src="../lang.js"></script>, mark text with data-i18n="key",
   and call DampLang.t('key') for strings set from JavaScript. */
(function () {
  var KEY = 'damp.lang';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}
  var initial = stored || ((navigator.language || 'en').toLowerCase().indexOf('da') === 0 ? 'da' : 'en');
  var lang = initial === 'da' ? 'da' : 'en';
  var listeners = [];

  var D = {
    en: {
      'lang.name': 'English',
      'common.play': 'Play',
      'common.start': 'Start',
      'common.restart': 'Restart',
      'common.again': 'Play again',
      'common.newGame': 'New game',
      'common.back': 'Back',
      'common.close': 'Close',
      'common.score': 'Score',
      'common.level': 'Level',
      'common.lives': 'Lives',
      'common.time': 'Time',
      'common.stars': 'Stars',
      'common.wave': 'Wave',
      'common.dots': 'Dots',
      'common.sound': 'Sound',
      'common.on': 'On',
      'common.off': 'Off',
      'common.you': 'You',
      'common.computer': 'Computer',
      'common.twoPlayers': '2 players',
      'common.language': 'Language',

      'tica.title': 'Kryds & Bolle 3D',
      'tica.sub': 'Gold pieces on black marble. Three in a row wins.',
      'tica.start': 'Start game',
      'tica.newGame': 'New game',
      'tica.vsComputer': 'Vs computer',
      'tica.twoPlayers': '2 players',
      'tica.turnX': 'X to move',
      'tica.turnO': 'O to move',
      'tica.yourTurn': 'Your turn',
      'tica.computerTurn': 'Computer thinking',
      'tica.winX': 'X wins',
      'tica.winO': 'O wins',
      'tica.draw': 'Draw',
      'tica.youWin': 'You win',
      'tica.computerWins': 'Computer wins',
      'tica.hint': 'Click a square to place your piece · drag to look around',
      'tica.score': 'Score',
      'tica.streak': 'Streak',

      'sky.title': 'SKY HOP 3D',
      'sky.sub': 'Eight stars are scattered across the floating islands. Hop, double jump and climb your way to the top of the sky.',
      'sky.start': 'Start climbing',
      'sky.move': 'WASD / ARROWS — MOVE',
      'sky.jump': 'SPACE — JUMP ×2',
      'sky.camera': 'DRAG — CAMERA',
      'sky.hint': 'WASD / arrows move · SPACE jump (twice for a double jump) · drag to orbit',
      'sky.winTitle': 'ALL EIGHT!',
      'sky.winText': 'All eight stars in {time}. Nice hopping.',
      'sky.again': 'Climb again',

      'brick.title': 'BRICK BLAST',
      'brick.sub': 'Clear every brick. Catch the falling capsules: wide paddle, extra ball, slow ball. Mouse or arrow keys.',
      'brick.play': 'Play',
      'brick.over': 'GAME OVER',
      'brick.overSub': 'You scored {score}. The bricks win this round — go again?',
      'brick.again': 'Play again',
      'brick.launch': 'SPACE OR CLICK TO LAUNCH',
      'brick.ready': 'BALL READY',
      'brick.wide': 'Wide paddle',
      'brick.multi': 'Extra ball',
      'brick.slow': 'Slow ball',

      'star.title': 'STAR SWARM',
      'star.sub': 'The swarm descends in formation. Hold the line, use the bunkers, and clear every wave. Arrows or A/D to move, space to fire.',
      'star.launch': 'Launch',
      'star.over': 'SWARM WINS',
      'star.overSub': 'You scored {score} across {waves}. Ready for another run?',
      'star.again': 'Launch again',

      'river.title': 'RIVER HOP',
      'river.sub': 'Cross five lanes of traffic, ride the logs and reach the lily pads. One hop at a time. Arrow keys or WASD.',
      'river.start': 'Hop in',
      'river.over': 'SPLASHED OUT',
      'river.overSub': 'You scored {score}. The river is undefeated.',
      'river.allSafe': 'ALL SAFE',
      'river.allSafeSub': 'All five lily pads reached. {score} points.',
      'river.again': 'Hop again',

      'maze.title': 'MAZE MUNCH',
      'maze.sub': 'Eat every dot, dodge the bugs and grab a power pellet to turn the tables. Arrows or WASD.',
      'maze.start': 'Munch',
      'maze.caught': 'CAUGHT',
      'maze.caughtSub': 'The bugs got you. {score} points.',
      'maze.clear': 'MAZE CLEARED',
      'maze.clearSub': 'Every dot eaten. {score} points.',
      'maze.again': 'Munch again'
    },
    da: {
      'lang.name': 'Dansk',
      'common.play': 'Spil',
      'common.start': 'Start',
      'common.restart': 'Genstart',
      'common.again': 'Spil igen',
      'common.newGame': 'Nyt spil',
      'common.back': 'Tilbage',
      'common.close': 'Luk',
      'common.score': 'Point',
      'common.level': 'Bane',
      'common.lives': 'Liv',
      'common.time': 'Tid',
      'common.stars': 'Stjerner',
      'common.wave': 'Bølge',
      'common.dots': 'Prikker',
      'common.sound': 'Lyd',
      'common.on': 'Til',
      'common.off': 'Fra',
      'common.you': 'Dig',
      'common.computer': 'Computeren',
      'common.twoPlayers': '2 spillere',
      'common.language': 'Sprog',

      'tica.title': 'Kryds & Bolle 3D',
      'tica.sub': 'Messingbrikker på sort marmor. Tre på stribe vinder.',
      'tica.start': 'Start spil',
      'tica.newGame': 'Nyt spil',
      'tica.vsComputer': 'Mod computeren',
      'tica.twoPlayers': '2 spillere',
      'tica.turnX': 'X skal spille',
      'tica.turnO': 'O skal spille',
      'tica.yourTurn': 'Din tur',
      'tica.computerTurn': 'Computeren tænker',
      'tica.winX': 'X vinder',
      'tica.winO': 'O vinder',
      'tica.draw': 'Uafgjort',
      'tica.youWin': 'Du vinder',
      'tica.computerWins': 'Computeren vinder',
      'tica.hint': 'Klik på en rude for at sætte din brik · træk for at kigge rundt',
      'tica.score': 'Stilling',
      'tica.streak': 'Sejrsstime',

      'sky.title': 'SKY HOP 3D',
      'sky.sub': 'Otte stjerner ligger spredt på de flyvende øer. Hop, dobbeltspring og klatr op til toppen af himlen.',
      'sky.start': 'Klatr op',
      'sky.move': 'WASD / PILE — GÅ',
      'sky.jump': 'MELLEMRUM — SPRING ×2',
      'sky.camera': 'TRÆK — KAMERA',
      'sky.hint': 'WASD / piletaster går · MELLEMRUM springer (to gange for dobbeltspring) · træk for at dreje kameraet',
      'sky.winTitle': 'ALLE OTTE!',
      'sky.winText': 'Alle otte stjerner på {time}. Flot hoppet.',
      'sky.again': 'Klatr igen',

      'brick.title': 'BRICK BLAST',
      'brick.sub': 'Knæk alle murstenene. Fang kapslerne: bred paddle, ekstra bold, langsom bold. Mus eller piletaster.',
      'brick.play': 'Spil',
      'brick.over': 'SPILLET ER SLUT',
      'brick.overSub': 'Du fik {score} point. Murstenene vinder denne runde — prøver du igen?',
      'brick.again': 'Spil igen',
      'brick.launch': 'MELLEMRUM ELLER KLIK FOR AT SKYDE',
      'brick.ready': 'BOLDEN KLAR',
      'brick.wide': 'Bred paddle',
      'brick.multi': 'Ekstra bold',
      'brick.slow': 'Langsom bold',

      'star.title': 'STAR SWARM',
      'star.sub': 'Sværmen rykker ned i formation. Hold linjen, brug bunkerne og klar alle bølger. Piletaster eller A/D for at gå, mellemrum for at skyde.',
      'star.launch': 'Affyr',
      'star.over': 'SVÆRMEN VANDT',
      'star.overSub': 'Du fik {score} point over {waves}. Klar til endnu et forsøg?',
      'star.again': 'Affyr igen',

      'river.title': 'RIVER HOP',
      'river.sub': 'Kryds fem vognbaner, rid på træstammerne og nå åkanderne. Et hop ad gangen. Piletaster eller WASD.',
      'river.start': 'Hop ind',
      'river.over': 'SPLASK I VANDET',
      'river.overSub': 'Du fik {score} point. Floden er stadig ubesejret.',
      'river.allSafe': 'ALLE I SIKKERHED',
      'river.allSafeSub': 'Alle fem åkander nået. {score} point.',
      'river.again': 'Hop igen',

      'maze.title': 'MAZE MUNCH',
      'maze.sub': 'Spis alle prikker, undgå bæsterne og snup en power-pellet, så jagten vender. Piletaster eller WASD.',
      'maze.start': 'Spis',
      'maze.caught': 'FANGET',
      'maze.caughtSub': 'Bæsterne tog dig. {score} point.',
      'maze.clear': 'LABYRINTEN KLARET',
      'maze.clearSub': 'Alle prikker spist. {score} point.',
      'maze.again': 'Spis igen'
    }
  };

  function t(key, vars) {
    var s = (D[lang] && D[lang][key]) || (D.en && D.en[key]) || key;
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  function apply(root) {
    root = root || document;
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    var attrs = root.querySelectorAll('[data-i18n-aria]');
    for (var j = 0; j < attrs.length; j++) {
      attrs[j].setAttribute('aria-label', t(attrs[j].getAttribute('data-i18n-aria')));
    }
    document.documentElement.lang = lang;
    var btn = document.getElementById('damp-lang-btn');
    if (btn) btn.title = t('common.language');
  }

  function set(next) {
    lang = next === 'da' ? 'da' : 'en';
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(document);
    for (var i = 0; i < listeners.length; i++) listeners[i](lang);
    var ev;
    try { ev = new CustomEvent('damp:lang', { detail: { lang: lang } }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('damp:lang', true, true); }
    document.dispatchEvent(ev);
  }

  function toggle() { set(lang === 'da' ? 'en' : 'da'); }

  function mount() {
    if (document.getElementById('damp-lang-btn')) return;
    var b = document.createElement('button');
    b.id = 'damp-lang-btn';
    b.type = 'button';
    b.setAttribute('aria-label', 'English / Dansk');
    b.innerHTML = '<span data-code="en">EN</span><i></i><span data-code="da">DA</span>';
    b.style.cssText = [
      'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483000',
      'display:flex', 'align-items:center', 'gap:6px',
      'padding:7px 10px', 'border-radius:999px',
      'border:1px solid rgba(255,255,255,.22)',
      'background:rgba(10,16,22,.72)', 'color:#cfd8e3',
      'font:600 11px/1 ui-sans-serif,system-ui,sans-serif',
      'letter-spacing:.12em', 'cursor:pointer', 'backdrop-filter:blur(8px)',
      'transition:border-color .15s, background .15s'
    ].join(';');
    b.addEventListener('click', toggle);
    b.addEventListener('mouseenter', function () { b.style.borderColor = 'rgba(233,180,76,.8)'; });
    b.addEventListener('mouseleave', function () { b.style.borderColor = 'rgba(255,255,255,.22)'; });
    document.body.appendChild(b);
    apply(document);
    paint();
  }

  function paint() {
    var b = document.getElementById('damp-lang-btn');
    if (!b) return;
    var spans = b.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) {
      var on = spans[i].getAttribute('data-code') === lang;
      spans[i].style.color = on ? '#e9b44c' : 'rgba(207,216,227,.55)';
      spans[i].style.opacity = on ? '1' : '.8';
    }
    var btn = document.getElementById('damp-lang-btn');
    if (btn) btn.title = t('common.language');
  }

  var origSet = set;
  set = function (next) { origSet(next); paint(); };

  window.DampLang = {
    get lang() { return lang; },
    t: t,
    set: function (l) { set(l); },
    toggle: toggle,
    apply: apply,
    onChange: function (fn) { listeners.push(fn); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mount(); });
  } else {
    mount();
  }
})();
