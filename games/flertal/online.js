/* ======================================================================
   online.js — "Hver sin telefon": the same Flertal, played over Firebase.

   One document per room (fl_rooms/CODE) holds the whole game: who is in,
   the prompt, everyone's answers, the scores and the gamble. Every device
   listens to that document and draws what it says. The host is the only
   one who moves the room forward (new prompt, reveal, next round); each
   player writes only their own answer and their own gamble choice.

   With no Firebase (or no login) the game still works on one phone, which
   is what the game opens with.
   ====================================================================== */
(function () {
  "use strict";

  const FB_CONFIG = {
    apiKey: "AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w",
    authDomain: "damp-2406a.firebaseapp.com",
    projectId: "damp-2406a",
    appId: "1:940989851976:web:f8fd07c258afa71fd22b7d"
  };
  const COL = "fl_rooms";
  const MAX = 8;

  const app = document.getElementById("app");
  const net = {
    fb: null, auth: null, db: null, uid: null,
    code: null, room: null, unsub: null,
    timer: null, frozen: false, autoKey: null,
    err: "", loading: false
  };

  // ---------------------------------------------------------------- helpers
  function errText(e) {
    const code = String((e && (e.code || e.message)) || "ukendt fejl");
    if (code.indexOf("permission-denied") >= 0) return "Firebase afviste det (permission-denied). Reglerne for fl_rooms er ikke publiceret endnu.";
    if (code.indexOf("unavailable") >= 0) return "Ingen forbindelse til Firebase lige nu.";
    if (code.indexOf("not-found") >= 0) return "Der findes ingen kamp med den kode.";
    return code;
  }

  function code4() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 4; i++) out += letters[Math.floor(Math.random() * letters.length)];
    return out;
  }

  function storedName() {
    try { return (localStorage.getItem("flertal_name") || "").trim(); } catch (e) { return ""; }
  }

  function nick() {
    const input = document.getElementById("nick");
    const typed = input ? String(input.value || "").trim().slice(0, 14) : "";
    if (typed) { try { localStorage.setItem("flertal_name", typed); } catch (e) { /* storage off */ } return typed; }
    return storedName();
  }

  function modes(active) {
    return '<div class="modes">' +
      '<button class="sec' + (active === "local" ? " on" : "") + '" onclick="setup()">📱 Én telefon</button>' +
      '<button class="sec' + (active === "online" ? " on" : "") + '" onclick="flt.setup()">🌐 Hver sin telefon</button>' +
      "</div>";
  }

  function nameOf(room, uid) {
    const seat = (room.players || {})[uid];
    return seat ? seat.name : "?";
  }

  function roster(room) {
    return Object.keys(room.players || {})
      .map(function (uid) { return { uid: uid, name: room.players[uid].name, at: room.players[uid].at || 0 }; })
      .sort(function (a, b) { return a.at - b.at; });
  }

  function freeName(room, wanted) {
    const used = roster(room).map(function (p) { return p.name.toLowerCase(); });
    if (used.indexOf(wanted.toLowerCase()) < 0) return wanted;
    for (let i = 2; i < 20; i++) if (used.indexOf((wanted + " " + i).toLowerCase()) < 0) return wanted + " " + i;
    return wanted + " " + Math.floor(Math.random() * 90 + 10);
  }

  // The one-phone game keeps its scores and players in S; the online screens
  // reuse its board() and orb() by filling that same shape in.
  function syncState(room) {
    const people = roster(room);
    S.players = people.map(function (p) { return p.name; });
    S.scores = {};
    S.sz = S.sz || {};
    people.forEach(function (p) { S.scores[p.name] = (room.scores || {})[p.uid] || 0; });
  }

  function clearTimer() {
    if (net.timer) { clearInterval(net.timer); net.timer = null; }
  }

  function startTimer(seconds, startedAt) {
    clearTimer();
    const bar = document.getElementById("tb");
    const left = document.getElementById("ts");
    const wrap = document.getElementById("tm");
    if (!bar) return;
    const t0 = startedAt || Date.now();
    const tick = function () {
      const remaining = Math.max(0, seconds - (Date.now() - t0) / 1000);
      bar.style.width = (remaining / seconds * 100) + "%";
      if (left) left.textContent = String(Math.ceil(remaining));
      if (wrap && remaining <= 5) wrap.classList.add("lo");
      if (remaining <= 0) {
        clearTimer();
        const mine = (net.room && net.room.answers) ? net.room.answers[net.uid] : null;
        if (!mine) flt.answer("(ingen svar)");
      }
    };
    tick();
    net.timer = setInterval(tick, 200);
  }

  // ------------------------------------------------------------------ firebase
  async function init() {
    if (net.fb) return net.fb;
    net.loading = true;
    const mods = await Promise.all([
      import("../../vendor/firebase/firebase-app.js"),
      import("../../vendor/firebase/firebase-auth.js"),
      import("../../vendor/firebase/firebase-firestore.js")
    ]);
    const appMod = mods[0], authMod = mods[1], dbMod = mods[2];
    const fbApp = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FB_CONFIG);
    net.fb = { authMod: authMod, dbMod: dbMod };
    net.app = fbApp;
    net.auth = authMod.getAuth(fbApp);
    net.db = dbMod.getFirestore(fbApp);
    await new Promise(function (done) {
      let once = true;
      authMod.onAuthStateChanged(net.auth, function (user) {
        const before = net.uid;
        net.uid = user ? user.uid : null;
        if (once) { once = false; net.loading = false; done(); }
        else if (before !== net.uid && !net.code) drawStart();
      });
    });
    net.loading = false;
    return net.fb;
  }

  function roomRef() {
    return net.fb.dbMod.doc(net.db, COL, net.code);
  }

  async function patch(fields) {
    if (!net.code) return;
    await net.fb.dbMod.updateDoc(roomRef(), fields);
  }

  // --------------------------------------------------------------- the screens
  function drawStart() {
    clearTimer();
    let inner = "";
    if (net.err) {
      inner = '<div class="card"><p class="bad">' + esc(net.err) + "</p>" +
        '<button class="sec" onclick="flt.setup()">Prøv igen</button></div>';
    } else if (net.loading || !net.fb) {
      inner = '<div class="card"><p class="mut">Indlæser Firebase…</p></div>';
    } else if (!net.uid) {
      inner = '<div class="card"><h2>Log ind først</h2>' +
        '<p class="note">Spil over nettet bruger samme konto som resten af Damp. Log ind med knappen øverst på siden, og kom så tilbage hertil.</p>' +
        '<a href="/" target="_top"><button class="sec">Åbn Damp og log ind</button></a>' +
        '<button onclick="flt.recheck()">Jeg er logget ind nu</button></div>';
    } else {
      const guess = storedName();
      inner = '<div class="card"><b>Dit navn</b>' +
        '<input id="nick" maxlength="14" autocomplete="nickname" placeholder="Navn" value="' + esc(guess) + '">' +
        '<button onclick="flt.create()">Opret en kamp</button></div>' +
        '<div class="card"><b>Har du en kode?</b>' +
        '<input id="joincode" maxlength="4" autocomplete="off" placeholder="FX AB3K" value="' + esc(net.pendingCode || "") + '" style="text-transform:uppercase;letter-spacing:.2em">' +
        '<button onclick="flt.join()">Deltag</button></div>' +
        '<div class="how" onclick="how()">▸ SÅDAN SPILLER I</div>' +
        '<div class="card" id="hw" hidden>Alle svarer på samme spørgsmål på hver sin telefon inden for tiden. Hver gang en anden skriver det samme som dig, får du et point. Vinderne af en runde kan gamble rundens point eller alle deres point – gambler flere, tager én hele puljen. ⚡ Speedrunder har 3 hurtige spørgsmål med halv tid.</div>';
    }
    app.innerHTML = '<div class="hero"><div class="logo">FLERTAL</div><div class="sub">FØLG FLOKKEN</div></div>' +
      modes("online") + inner;
  }

  function drawLobby(room) {
    const mine = net.uid;
    const host = room.host === mine;
    const people = roster(room);
    const rows = people.map(function (p) {
      return '<div class="who-row"><span>' + esc(p.name) +
        (p.uid === mine ? '<span class="pill">DIG</span>' : "") + "</span>" +
        '<span class="mut">' + (p.uid === room.host ? "vært" : "") + "</span></div>";
    }).join("");
    app.innerHTML = modes("online") +
      '<div class="card"><h2>Rumkode</h2><div class="code" id="roomcode">' + esc(room.code) + "</div>" +
      '<p class="note" style="text-align:center">De andre vælger “🌐 Hver sin telefon” og skriver koden.</p>' +
      '<button class="sec" onclick="flt.copy()">Kopiér invitationslink</button>' +
      '<p class="mut" id="copynote"></p></div>' +
      '<div class="card"><b>Spillere (' + people.length + "/" + MAX + ")</b>" + rows + "</div>" +
      (host
        ? '<div class="card"><b>Antal runder</b><input id="rn" type="number" min="1" max="15" value="' + (room.rounds || 5) + '">' +
          '<p><b>⚡ Speedrunder</b> <span class="mut">(3 hurtige spørgsmål, halv tid)</span></p>' +
          '<input id="sr" type="number" min="0" max="10" value="' + (room.speed || 0) + '">' +
          (people.length < 2
            ? '<p class="note">I skal være mindst 2 spillere.</p><button disabled>Start spillet</button>'
            : '<button onclick="flt.start()">Start spillet</button>') +
          "</div>"
        : '<div class="card"><p class="mut">Venter på at værten starter spillet…</p></div>') +
      '<button class="sec" onclick="flt.leave()">Forlad kampen</button>';
  }

  function drawAsk(room) {
    const speed = (room.plan || [])[room.round - 1] === "s";
    const seconds = speed ? 12.5 : 25;
    const prompt = (room.prompts || [])[room.qi] || "";
    const mine = (room.answers || {})[net.uid];
    const total = roster(room).length;
    const answered = Object.keys(room.answers || {}).length;
    const head = '<p class="mut">' + (speed ? "⚡ Speedrunde · spørgsmål " + (room.qi + 1) + "/3 · " : "") +
      "Runde " + room.round + " af " + room.rounds + "</p>";
    let body;
    if (mine) {
      body = '<div class="card"><h2><span class="ck">✔</span> Svar låst</h2>' +
        '<p class="mut">' + answered + " af " + total + " har svaret. Svarene vises, når alle er færdige.</p>" +
        (room.host === net.uid
          ? '<button onclick="flt.reveal()">Vis resultatet nu</button>'
          : '<p class="mut">Venter på de andre…</p>') +
        "</div>";
    } else {
      body = '<div class="card"><h2>Dit svar</h2>' +
        '<div class="tm" id="tm"><i id="tb"></i><b id="ts">' + Math.ceil(seconds) + "</b></div>" +
        '<p class="mut">Skriv det svar, du tror flest andre skriver.</p>' +
        '<input id="a" autocomplete="off" placeholder="Dit svar" onkeydown="if(event.key===\'Enter\')flt.answer()">' +
        '<button onclick="flt.answer()">Lås svar</button></div>';
    }
    app.innerHTML = modes("online") + head + '<div class="q">' + esc(prompt) + "</div>" + body +
      '<div class="card"><b>Stilling</b>' + board() + "</div>";
    if (!mine) {
      const input = document.getElementById("a");
      if (input) input.focus();
      startTimer(seconds, room.roundStart);
    } else {
      clearTimer();
    }
    // The host presses the button, but it also moves on by itself when everyone is in.
    if (room.host === net.uid && total >= 2 && answered >= total) {
      const key = room.round + "-" + room.qi;
      if (net.autoKey !== key) { net.autoKey = key; flt.reveal(); }
    }
  }

  function questionCard(entry) {
    const top = entry.list && entry.list.length ? entry.list[0].m.length : 0;
    return '<div class="card"><div class="q">' + esc(entry.q) + "</div>" +
      (entry.list || []).map(function (g) {
        return '<div class="grp ' + (g.m.length === top && top > 1 ? "top" : "") + '">' +
          "<div><b>" + esc(g.t) + '</b><span class="tg">' + tier(g.m.length) + "</span>" +
          '<div class="who">' + g.m.map(esc).join(", ") + "</div></div>" +
          '<div class="pts">+' + (g.m.length - 1) + "</div></div>";
      }).join("") +
      (top <= 1 ? '<p class="mut">Ingen ramte det samme – ingen point denne gang.</p>' : "") +
      "</div>";
  }

  function gambleCard(room) {
    const res = room.lastResult || {};
    const winners = res.winners || [];
    const gamblers = room.gamble || { picks: {} };
    const picks = gamblers.picks || {};
    const mine = winners.indexOf(net.uid) >= 0;
    const points = (res.points || {})[net.uid] || 0;
    const total = (room.scores || {})[net.uid] || 0;
    const names = winners.map(function (uid) { return nameOf(room, uid); }).join(", ");

    if (gamblers.result) {
      return '<div class="card"><b>🎲 Kassen er åbnet</b><p>' + esc(gamblers.result) + "</p></div>";
    }

    let inner = '<div class="gb">Vinderne (' + esc(names) + ") kan gamble deres point</div>";
    if (mine && !picks[net.uid]) {
      inner += '<p class="mut">Du har ' + total + " point i alt og fik " + points + " denne runde.</p>" +
        (points < total ? '<button onclick="flt.gamblePick(\'round\')">Gamble rundens ' + points + "</button> " : "") +
        '<button onclick="flt.gamblePick(\'all\')">Gamble alle ' + total + "</button> " +
        '<button class="sec" onclick="flt.gamblePick(\'keep\')">Behold mine point</button>';
    } else if (mine) {
      inner += '<p class="mut">Dit valg er gemt.</p>';
    }
    const decided = winners.filter(function (uid) { return picks[uid] && picks[uid] !== "keep"; });
    inner += '<p class="mut">' + decided.length + " af " + winners.length + " gambler.</p>";
    if (room.host === net.uid) {
      inner += '<button onclick="flt.gambleRoll()"' + (decided.length ? "" : " disabled") + ">🎲 Træk vinderen</button>";
    } else {
      inner += '<p class="mut">Værten trækker vinderen.</p>';
    }
    return '<div class="card">' + inner + "</div>";
  }

  function drawReveal(room) {
    const res = room.lastResult || {};
    const speed = !!res.sp;
    const cards = speed
      ? (room.spRes || []).map(questionCard).join("")
      : (res.q !== undefined ? questionCard(res) : "");
    let controls = "";
    if (!speed) {
      if (room.gamble) {
        controls = gambleCard(room);
      } else if ((res.winners || []).length) {
        controls = '<div class="card"><p class="mut">Vinderne af runden: ' +
          esc((res.winners || []).map(function (uid) { return nameOf(room, uid); }).join(", ")) + "</p>" +
          (room.host === net.uid
            ? '<button onclick="flt.gambleStart()">🎲 Gamble</button>'
            : '<p class="mut">Værten åbner kassen.</p>') +
          "</div>";
      }
    }
    const last = room.round >= room.rounds;
    const nextLabel = last ? "Se vinderen" : "Næste runde";
    const waiting = room.host === net.uid
      ? '<button class="sec" onclick="flt.next()">' + nextLabel + "</button>"
      : '<p class="mut">Venter på værten…</p>';
    app.innerHTML = modes("online") +
      '<p class="mut">' + (speed ? "⚡ Speedrunde færdig · " : "") + "Runde " + room.round + " af " + room.rounds + "</p>" +
      cards +
      '<div class="card"><b>Stilling</b>' + board() + "</div>" +
      controls + waiting;
  }

  function drawEnd(room) {
    const board$ = board();
    const top = S.players.slice().sort(function (a, b) { return (S.scores[b] || 0) - (S.scores[a] || 0); });
    const best = top.length ? S.scores[top[0]] || 0 : 0;
    const winners = top.filter(function (n) { return (S.scores[n] || 0) === best; });
    app.innerHTML = modes("online") +
      '<div class="big"><span class="troph">🏆</span></div>' +
      '<h1 style="text-align:center">' + winners.map(esc).join(" & ") + "</h1>" +
      '<p style="text-align:center">' + (winners.length > 1 ? "deler sejren – I tænker lige ens!" : "tænker mest som flokken og vinder!") + "</p>" +
      '<div class="card"><b>Slutstilling</b>' + board$ + "</div>" +
      (room.host === net.uid
        ? '<button onclick="flt.again()">Spil igen</button>'
        : '<p class="mut" style="text-align:center">Værten kan starte en ny kamp.</p>') +
      '<button class="sec" onclick="flt.leave()">Forlad kampen</button>';
    confetti();
  }

  function draw() {
    if (!net.code) { drawStart(); return; }
    if (!net.room) {
      app.innerHTML = modes("online") + '<div class="card"><p class="mut">Forbinder til kampen…</p></div>';
      return;
    }
    const room = net.room;
    syncState(room);
    if (room.phase === "lobby") return drawLobby(room);
    if (room.phase === "ask") return drawAsk(room);
    if (room.phase === "reveal") return drawReveal(room);
    return drawEnd(room);
  }

  // -------------------------------------------------------------------- actions
  async function onlineSetup() {
    net.err = "";
    net.code = null;
    net.room = null;
    if (net.unsub) { net.unsub(); net.unsub = null; }
    clearTimer();
    if (!net.fb) drawStart();
    try {
      await init();
    } catch (e) {
      net.loading = false;
      net.err = "Firebase kunne ikke indlæses: " + errText(e);
    }
    drawStart();
  }

  async function create() {
    const name = nick();
    if (!name) { net.err = "Skriv et navn først."; drawStart(); return; }
    net.err = "";
    try {
      await init();
      if (!net.uid) { drawStart(); return; }
      const dbMod = net.fb.dbMod;
      let code = code4();
      let ref = dbMod.doc(net.db, COL, code);
      let snap = await dbMod.getDoc(ref);
      let guard = 0;
      while (snap.exists() && guard++ < 6) {
        code = code4();
        ref = dbMod.doc(net.db, COL, code);
        snap = await dbMod.getDoc(ref);
      }
      const now = Date.now();
      const players = {};
      players[net.uid] = { name: name, at: now };
      await dbMod.setDoc(ref, {
        code: code,
        host: net.uid,
        createdAt: now,
        updatedAt: now,
        phase: "lobby",
        round: 0,
        rounds: 5,
        speed: 0,
        plan: [],
        qi: 0,
        prompts: [],
        answers: {},
        spRes: [],
        scores: {},
        lastResult: null,
        gamble: null,
        roundStart: 0,
        players: players
      });
      enter(code);
    } catch (e) {
      net.err = "Kunne ikke oprette kampen: " + errText(e);
      drawStart();
    }
  }

  async function join() {
    const field = document.getElementById("joincode");
    const code = String(field ? field.value : "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (code.length < 4) { net.err = "Koden er fire tegn."; drawStart(); return; }
    const name = nick();
    if (!name) { net.err = "Skriv et navn først."; drawStart(); return; }
    net.err = "";
    try {
      await init();
      if (!net.uid) { drawStart(); return; }
      const dbMod = net.fb.dbMod;
      const ref = dbMod.doc(net.db, COL, code);
      const snap = await dbMod.getDoc(ref);
      if (!snap.exists()) { net.err = "Der findes ingen kamp med koden " + code + "."; drawStart(); return; }
      const room = snap.data();
      if (!(room.players || {})[net.uid]) {
        if (roster(room).length >= MAX) { net.err = "Kampen er fuld (8 spillere)."; drawStart(); return; }
        const patchDoc = {};
        patchDoc["players." + net.uid] = { name: freeName(room, name), at: Date.now() };
        await dbMod.updateDoc(ref, patchDoc);
      }
      enter(code);
    } catch (e) {
      net.err = "Kunne ikke deltage: " + errText(e);
      drawStart();
    }
  }

  function enter(code) {
    net.code = code;
    if (net.unsub) net.unsub();
    const dbMod = net.fb.dbMod;
    net.unsub = dbMod.onSnapshot(dbMod.doc(net.db, COL, code), function (snap) {
      if (!snap.exists()) {
        if (net.unsub) { net.unsub(); net.unsub = null; }
        net.code = null; net.room = null;
        net.err = "Kampen findes ikke længere.";
        drawStart();
        return;
      }
      net.room = snap.data();
      if (!net.frozen) draw();
    }, function (e) {
      net.err = "Kunne ikke læse kampen: " + errText(e);
      draw();
    });
    try { history.replaceState(null, "", location.pathname + "?room=" + code); } catch (e) { /* fine */ }
    draw();
  }

  async function start() {
    const room = net.room;
    if (!room || room.host !== net.uid) return;
    const nr = Math.max(1, Math.min(15, +document.getElementById("rn").value || 5));
    const ns = Math.max(0, Math.min(10, +document.getElementById("sr").value || 0));
    const total = nr + ns;
    const plan = [];
    for (let i = 0; i < total; i++) plan.push("n");
    for (let i = 0; i < ns; i++) plan[Math.min(total - 1, Math.floor(((i + 1) * total) / (ns + 1)))] = "s";
    const scores = {};
    roster(room).forEach(function (p) { scores[p.uid] = 0; });
    try {
      await patch({
        phase: "ask", rounds: total, speed: ns, plan: plan, round: 1, qi: 0,
        prompts: [pick()], roundStart: Date.now(), answers: {}, spRes: [],
        scores: scores, gamble: null, lastResult: null, updatedAt: Date.now()
      });
    } catch (e) { net.err = "Kunne ikke starte: " + errText(e); draw(); }
  }

  async function answer(value) {
    const room = net.room;
    if (!room || room.phase !== "ask") return;
    if ((room.answers || {})[net.uid]) return;
    const field = document.getElementById("a");
    const text = String(value !== undefined ? value : (field ? field.value : "")).trim().slice(0, 60);
    if (!text) { if (field) field.classList.add("sh"); return; }
    clearTimer();
    try {
      const patchDoc = {};
      patchDoc["answers." + net.uid] = { name: nameOf(room, net.uid), text: text, k: norm(text), at: Date.now() };
      await patch(patchDoc);
    } catch (e) { net.err = "Svaret blev ikke gemt: " + errText(e); draw(); }
  }

  async function reveal() {
    const room = net.room;
    if (!room || room.host !== net.uid || room.phase !== "ask") return;
    if (!Object.keys(room.answers || {}).length) return;
    const speed = (room.plan || [])[room.round - 1] === "s";
    const groups = {};
    Object.keys(room.answers || {}).forEach(function (uid) {
      const a = room.answers[uid];
      const key = a.k || norm(a.text || "");
      if (!groups[key]) groups[key] = { t: a.text, m: [], u: [] };
      groups[key].m.push(nameOf(room, uid));
      groups[key].u.push(uid);
    });
    const list = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return b.m.length - a.m.length; });
    const top = list.length ? list[0].m.length : 0;
    const scores = Object.assign({}, room.scores || {});
    const points = {};
    list.forEach(function (g) {
      const plus = g.m.length - 1;
      g.u.forEach(function (uid) {
        scores[uid] = (scores[uid] || 0) + plus;
        points[uid] = plus;
      });
    });
    const winners = top > 1
      ? list.filter(function (g) { return g.m.length === top; })
          .reduce(function (all, g) { return all.concat(g.u); }, [])
          .filter(function (uid) { return (scores[uid] || 0) > 0; })
      : [];
    const entry = {
      q: (room.prompts || [])[room.qi] || "",
      list: list.map(function (g) { return { t: g.t, m: g.m }; }),
      points: points,
      winners: winners,
      sp: speed
    };
    const spRes = (room.spRes || []).concat(speed ? [entry] : []);
    try {
      if (speed && room.qi < 2) {
        await patch({
          scores: scores, answers: {}, spRes: spRes, qi: room.qi + 1,
          prompts: (room.prompts || []).concat([pick()]), roundStart: Date.now(), updatedAt: Date.now()
        });
      } else {
        await patch({
          scores: scores, answers: {}, spRes: spRes, phase: "reveal",
          lastResult: entry, gamble: null, roundStart: Date.now(), updatedAt: Date.now()
        });
      }
    } catch (e) { net.err = "Kunne ikke vise resultatet: " + errText(e); draw(); }
  }

  async function gambleStart() {
    const room = net.room;
    if (!room || room.host !== net.uid) return;
    try { await patch({ gamble: { picks: {}, result: null }, updatedAt: Date.now() }); }
    catch (e) { net.err = "Kunne ikke åbne kassen: " + errText(e); draw(); }
  }

  async function gamblePick(choice) {
    const room = net.room;
    if (!room || !room.gamble || room.gamble.result) return;
    const patchDoc = {};
    patchDoc["gamble.picks." + net.uid] = choice;
    try { await patch(patchDoc); } catch (e) { net.err = "Valget blev ikke gemt: " + errText(e); draw(); }
  }

  async function gambleRoll() {
    const room = net.room;
    if (!room || room.host !== net.uid || !room.gamble || room.gamble.result) return;
    const res = room.lastResult || {};
    const picks = room.gamble.picks || {};
    const winners = res.winners || [];
    const stake = {};
    winners.forEach(function (uid) {
      if (picks[uid] === "round") stake[uid] = (res.points || {})[uid] || 0;
      else if (picks[uid] === "all") stake[uid] = (room.scores || {})[uid] || 0;
    });
    const gamblers = Object.keys(stake).filter(function (uid) { return stake[uid] > 0; });
    const scores = Object.assign({}, room.scores || {});

    if (!gamblers.length) {
      try { await patch({ gamble: { picks: picks, result: "Ingen valgte at gamble." }, updatedAt: Date.now() }); }
      catch (e) { net.err = errText(e); draw(); }
      return;
    }

    net.frozen = true;
    clearTimer();
    const finish = async function (text) {
      net.frozen = false;
      try {
        await patch({ scores: scores, gamble: { picks: picks, result: text }, updatedAt: Date.now() });
      } catch (e) { net.err = "Kunne ikke gemme trækningen: " + errText(e); draw(); }
    };

    if (gamblers.length === 1) {
      const uid = gamblers[0];
      const amount = stake[uid];
      const win = Math.random() < 0.5;
      const roll = win ? 0 : 1;
      spin([
        { t: nameOf(room, uid) + " dobler", p: 0.5, c: "#4b69ff" },
        { t: "💥 Ingenting", p: 0.5, c: "#7a869a" }
      ], roll, function () {
        if (win) { scores[uid] = (scores[uid] || 0) + amount; finish(nameOf(room, uid) + " fordoblede sin indsats til " + (amount * 2) + "! 🎉"); }
        else { scores[uid] = (scores[uid] || 0) - amount; finish(nameOf(room, uid) + " tabte sin indsats. 💀"); }
      });
      return;
    }

    const pool = gamblers.reduce(function (sum, uid) { return sum + stake[uid]; }, 0);
    let ticket = Math.random() * pool;
    let winner = gamblers[0];
    for (let i = 0; i < gamblers.length; i++) {
      if (ticket <= stake[gamblers[i]]) { winner = gamblers[i]; break; }
      ticket -= stake[gamblers[i]];
    }
    const index = gamblers.indexOf(winner);
    spin(gamblers.map(function (uid) { return { t: nameOf(room, uid), p: stake[uid] / pool }; }), index, function () {
      gamblers.forEach(function (uid) { scores[uid] = (scores[uid] || 0) - stake[uid]; });
      scores[winner] = (scores[winner] || 0) + pool;
      finish(nameOf(room, winner) + " vinder puljen på " + pool + " point! 🏆");
    });
  }

  async function next() {
    const room = net.room;
    if (!room || room.host !== net.uid) return;
    try {
      if (room.round >= room.rounds) {
        await patch({ phase: "end", updatedAt: Date.now() });
      } else {
        await patch({
          phase: "ask", round: room.round + 1, qi: 0, prompts: [pick()],
          answers: {}, spRes: [], gamble: null, lastResult: null,
          roundStart: Date.now(), updatedAt: Date.now()
        });
      }
    } catch (e) { net.err = "Kunne ikke gå videre: " + errText(e); draw(); }
  }

  async function again() {
    const room = net.room;
    if (!room || room.host !== net.uid) return;
    const scores = {};
    roster(room).forEach(function (p) { scores[p.uid] = 0; });
    try {
      await patch({
        phase: "lobby", round: 0, qi: 0, answers: {}, spRes: [], scores: scores,
        gamble: null, lastResult: null, roundStart: 0, updatedAt: Date.now()
      });
    } catch (e) { net.err = "Kunne ikke starte forfra: " + errText(e); draw(); }
  }

  async function leave() {
    const room = net.room;
    const code = net.code;
    try {
      if (room && net.fb) {
        const dbMod = net.fb.dbMod;
        const people = roster(room).filter(function (p) { return p.uid !== net.uid; });
        const patchDoc = {};
        patchDoc["players." + net.uid] = dbMod.deleteField();
        // The room needs a host to keep moving: hand it to the first player left.
        if (room.host === net.uid && people.length) patchDoc.host = people[0].uid;
        await dbMod.updateDoc(dbMod.doc(net.db, COL, code), patchDoc);
      }
    } catch (e) { /* leaving is best effort */ }
    if (net.unsub) { net.unsub(); net.unsub = null; }
    net.code = null;
    net.room = null;
    try { history.replaceState(null, "", location.pathname); } catch (e) { /* fine */ }
    setup();
  }

  function copy() {
    const link = location.origin + "/games/flertal/?room=" + net.code;
    const note = document.getElementById("copynote");
    const done = function (okText) { if (note) note.textContent = okText; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function () { done("Link kopieret."); }, function () { done(link); });
    } else {
      done(link);
    }
  }

  async function recheck() {
    if (!net.fb) { setup(); return; }
    const authMod = net.fb.authMod;
    const user = authMod.getAuth(net.app).currentUser;
    net.uid = user ? user.uid : null;
    net.err = net.uid ? "" : "Du er ikke logget ind endnu.";
    drawStart();
  }

  window.flt = {
    setup: onlineSetup, create: create, join: join, start: start, answer: answer, reveal: reveal,
    gambleStart: gambleStart, gamblePick: gamblePick, gambleRoll: gambleRoll, next: next,
    again: again, leave: leave, copy: copy, recheck: recheck
  };

  // ---- the page starts on one phone, exactly as before -------------------
  const params = new URLSearchParams(location.search);
  const invite = (params.get("room") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (invite) {
    net.pendingCode = invite;
    onlineSetup();
  } else {
    window.setup();
  }
})();
