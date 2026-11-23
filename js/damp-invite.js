/* =====================================================================
   DAMP INVITES — one "Invite a friend" button for every game

   Chess, Catan, Stratego and Battleship each grew their own copy of this
   screen; games that only ever had a room code had no way to reach a friend
   at all. This is the shared version: it rides on Damp's existing messaging
   (the `people` directory for the player list and `chats/<pair>/messages` for
   the invite), so the friend gets an ordinary chat message with a Join button
   that opens the game with the room already filled in.

   Usage from a game page:

     DampInvite.open({
       game: 'Draw & Pass',        // shown in the chat message
       code: 'ABCDE',              // the room code
       link: 'https://.../?room=ABCDE',
       accent: '#7c4dff', accentText: '#fff',
       font: "'Fredoka', system-ui", ink: '#1d1340',
       surface: '#fff', radius: '22px',
       labels: { ... }             // optional, for other languages
     });

   Nothing is loaded until the button is pressed: the Firebase SDK is
   imported on demand, so a game that never invites anyone never pays for it.
   ===================================================================== */
(function () {
  'use strict';

  var SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  var CFG = {
    apiKey: 'AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w',
    authDomain: 'damp-2406a.firebaseapp.com',
    projectId: 'damp-2406a',
    appId: '1:940989851976:web:f8fd07c258afa71fd22b7d'
  };
  var DEFAULT_LABELS = {
    title: 'Invite a friend',
    pick: 'Pick someone and they get a chat invite with a Join button.',
    online: 'Online',
    invited: 'Invited',
    sending: 'Sending…',
    sent: 'Invite sent to ',
    nobody: 'No other Damp players found yet. Share the code instead.',
    signIn: 'Sign in on Damp first, then come back and invite a friend.',
    openDamp: 'Open Damp',
    copy: 'Copy link',
    copied: 'Link copied',
    codeHint: 'Room code',
    close: 'Close',
    failed: 'Could not send the invite',
    loading: 'Looking for players…',
    of: ' invites you to a game. '
  };

  var core = null;
  var mount = null;
  var busy = false;

  function load() {
    if (core) return core;
    core = Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js')
    ]).then(function (mods) {
      var appMod = mods[0], authMod = mods[1], fs = mods[2];
      var app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(CFG);
      var auth = authMod.getAuth(app);
      var db = fs.getFirestore(app);
      return new Promise(function (resolve, reject) {
        var stop = authMod.onAuthStateChanged(auth, function (user) {
          stop();
          resolve({ app: app, auth: auth, db: db, F: fs, user: user });
        }, reject);
      });
    }).catch(function (error) {
      core = null;
      throw error;
    });
    return core;
  }

  function el(tag, style, text) {
    var node = document.createElement(tag);
    if (style) {
      for (var key in style) if (Object.prototype.hasOwnProperty.call(style, key)) node.style[key] = style[key];
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function look(opts) {
    return {
      accent: opts.accent || '#7c4dff',
      accentText: opts.accentText || '#fff',
      font: opts.font || 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      ink: opts.ink || '#1d1340',
      surface: opts.surface || '#fff',
      soft: opts.soft || 'rgba(0,0,0,.05)',
      radius: opts.radius || '20px'
    };
  }

  function panel(opts, labels, theme) {
    var wrap = el('div', {
      position: 'fixed', inset: '0', zIndex: '9999', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px', background: 'rgba(10,4,30,.62)',
      fontFamily: theme.font, color: theme.ink, overflow: 'auto'
    });
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    var card = el('div', {
      width: 'min(420px, 100%)', background: theme.surface, borderRadius: theme.radius,
      boxShadow: '0 24px 60px rgba(10,0,40,.45)', padding: '18px', maxHeight: '88vh', overflow: 'auto'
    });
    var head = el('div', { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' });
    var title = el('h2', { margin: '0', fontSize: '1.15rem', flex: '1', font: 'inherit' }, labels.title);
    var close = el('button', {
      border: '0', background: theme.soft, color: theme.ink, width: '34px', height: '34px',
      borderRadius: '999px', fontSize: '16px', cursor: 'pointer', lineHeight: '1'
    }, '✕');
    close.setAttribute('aria-label', labels.close);
    head.append(title, close);
    close.addEventListener('click', function () { wrap.remove(); });

    var codeBox = el('div', {
      display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 12px',
      background: theme.soft, borderRadius: '14px', padding: '8px 12px'
    });
    var codeWrap = el('div', { flex: '1', minWidth: '0' });
    codeWrap.append(el('div', { fontSize: '.72rem', letterSpacing: '.08em', textTransform: 'uppercase', opacity: '.6' }, labels.codeHint));
    codeWrap.append(el('div', { fontSize: '1.45rem', fontWeight: '700', letterSpacing: '.16em' }, String(opts.code || '')));
    var copy = el('button', {
      border: '0', background: theme.accent, color: theme.accentText, borderRadius: '12px',
      padding: '9px 13px', fontSize: '.9rem', fontWeight: '600', cursor: 'pointer', font: 'inherit'
    }, labels.copy);
    copy.addEventListener('click', function () {
      var link = opts.link || location.href;
      var done = function () { copy.textContent = labels.copied; setTimeout(function () { copy.textContent = labels.copy; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { window.prompt(labels.copy, link); });
      else window.prompt(labels.copy, link);
    });
    codeBox.append(codeWrap, copy);

    var note = el('p', { margin: '0 0 10px', fontSize: '.92rem', opacity: '.75', lineHeight: '1.4' }, labels.loading);
    var list = el('div', { display: 'grid', gap: '8px' });
    card.append(head, codeBox, note, list);
    wrap.append(card);
    wrap.addEventListener('click', function (event) { if (event.target === wrap) wrap.remove(); });
    document.body.append(wrap);
    return { wrap: wrap, note: note, list: list };
  }

  function personRow(person, theme, labels, onPick) {
    var row = el('button', {
      display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
      border: '0', background: theme.soft, color: theme.ink, borderRadius: '14px',
      padding: '10px 12px', font: 'inherit', fontSize: '1rem', cursor: 'pointer'
    });
    var dot = el('span', {
      width: '9px', height: '9px', borderRadius: '999px', flex: 'none',
      background: person.online ? '#22c55e' : 'rgba(128,128,128,.45)'
    });
    var name = el('span', { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }, person.name);
    var state = el('span', { fontSize: '.82rem', opacity: '.65', font: 'inherit' }, person.online ? labels.online : '');
    row.append(dot, name, state);
    row.addEventListener('click', function () { onPick(row, state); });
    return row;
  }

  function open(opts) {
    opts = opts || {};
    var labels = Object.assign({}, DEFAULT_LABELS, opts.labels || {});
    var theme = look(opts);
    if (mount) { mount.remove(); mount = null; }
    var view = panel(opts, labels, theme);
    mount = view.wrap;

    if (!opts.code) {
      view.note.textContent = labels.nobody;
      return;
    }

    load().then(function (fb) {
      if (!fb.user) {
        view.note.textContent = labels.signIn;
        var go = el('a', {
          display: 'inline-block', marginTop: '8px', background: theme.accent, color: theme.accentText,
          textDecoration: 'none', borderRadius: '12px', padding: '10px 16px', fontWeight: '600'
        }, labels.openDamp);
        go.href = '/';
        view.list.append(go);
        return;
      }
      var uid = fb.user.uid;
      var people = new Map();
      var mine = 'player';
      var drawn = false;

      function draw() {
        if (drawn) return;
        var rows = Array.from(people.values()).sort(function (a, b) {
          return (b.online ? 1 : 0) - (a.online ? 1 : 0) || a.name.localeCompare(b.name);
        });
        view.list.textContent = '';
        if (!rows.length) { view.note.textContent = labels.nobody; return; }
        view.note.textContent = labels.pick;
        rows.forEach(function (person) {
          view.list.append(personRow(person, theme, labels, function (row, state) {
            if (row.disabled || busy) return;
            busy = true;
            row.disabled = true;
            state.textContent = labels.sending;
            var text = (opts.game ? opts.game + ':' : 'Damp:') + labels.of + mine + '. ' + (opts.link || '');
            var pair = uid < person.id ? uid + '_' + person.id : person.id + '_' + uid;
            var chatRef = fb.F.doc(fb.db, 'chats', pair);
            var names = {};
            names[uid] = mine;
            names[person.id] = person.name;
            var at = Date.now();
            fb.F.setDoc(chatRef, { ids: [uid, person.id].sort(), names: names }, { merge: true })
              .then(function () { return fb.F.addDoc(fb.F.collection(chatRef, 'messages'), { from: uid, text: text, at: at }); })
              .then(function () { return fb.F.setDoc(chatRef, { last: text.slice(0, 120), lastAt: at, lastFrom: uid }, { merge: true }); })
              .then(function () { state.textContent = labels.invited; })
              .catch(function (error) {
                row.disabled = false;
                state.textContent = '';
                view.note.textContent = labels.failed + ': ' + ((error && (error.code || error.message)) || '?');
              })
              .then(function () { busy = false; });
          }));
        });
      }

      fb.F.getDoc(fb.F.doc(fb.db, 'people', uid)).then(function (snap) {
        if (snap.exists() && snap.data().name) mine = String(snap.data().name).slice(0, 20);
        else if (fb.user.displayName) mine = String(fb.user.displayName).slice(0, 20);
      }, function () { /* the invite still works without a name */ });

      var stop = fb.F.onSnapshot(fb.F.collection(fb.db, 'people'), function (snap) {
        people.clear();
        snap.forEach(function (doc) {
          if (doc.id === uid) return;
          var data = doc.data() || {};
          people.set(doc.id, { id: doc.id, name: data.name || 'player', online: !!data.at && Date.now() - data.at < 120000 });
        });
        drawn = false;
        draw();
      }, function (error) {
        view.note.textContent = labels.failed + ': ' + ((error && (error.code || error.message)) || '?');
      });
      view.wrap.addEventListener('click', function (event) { if (event.target === view.wrap) { try { stop(); } catch (e) { } } });
      view.wrap._stop = stop;
    }).catch(function (error) {
      view.note.textContent = labels.failed + ': ' + ((error && (error.message || error.code)) || '?');
    });
  }

  window.DampInvite = { open: open };
})();
