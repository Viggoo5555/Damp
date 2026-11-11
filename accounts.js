// ---------------------------------------------------------------
// ACCOUNTS: log in and your game progress follows you to any device.
//
// 1. Paste your Firebase settings below (the guide shows where to find them).
// 2. SAVE_KEYS lists what each game stores on the device. When you add a
//    new game that saves progress, add its file name and its keys here.
//    (Games that don't save anything, like Slope, don't need a line.)
// ---------------------------------------------------------------
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w",
    authDomain: "damp-2406a.firebaseapp.com",
    projectId: "damp-2406a",
    appId: "1:940989851976:web:f8fd07c258afa71fd22b7d"
  };

  const SAVE_KEYS = {
    "games/Flappy Bird.html": ["fb-best", "fb-save"],
    "games/Starclicker.html": ["voidfoundry.v1"],
    "games/verity-clicker.html": ["verityClicker.v1"],
    "games/hedgerow-hallow.html": ["hedgerow-hollow-v1"],
    "games/guess-the-color.html": ["colorMemoryBest"],
    "games/guessing-game.html": ["hol_mode", "hol_cat", "hol_sound", "hol_best", "hol_scores"]
  };

  // ---------------------------------------------------------------
  // Everything below does the work. You don't need to change it.
  // ---------------------------------------------------------------
  const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  const byId = function (id) { return document.getElementById(id); };

  let fb = null;        // the Firebase tools, once they have loaded
  let user = null;      // who is logged in (null means nobody)
  let current = null;   // the game being played right now
  let synced = null;    // the game whose saves are connected to the account
  let lastSent = "";    // what the account already has, so we only send changes
  let autosave = null;

  // Games never wait long for Firebase
  let markReady;
  const ready = new Promise(function (resolve) { markReady = resolve; });
  setTimeout(markReady, 2500);

  function gameName(game) {
    return game.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function docRef() {
    return fb.f.doc(fb.db, "users", user.uid);
  }

  // The game's saved values on this device, as one piece of text
  function snapshot(game) {
    const data = {};
    SAVE_KEYS[game.file].forEach(function (key) {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    });
    return JSON.stringify(data);
  }

  // ----- Saves -----
  // Runs before a game starts: brings the account's saved progress to this device
  async function load(game) {
    stop();
    if (!SAVE_KEYS[game.file]) return;
    current = game;
    // Known to be logged out on this device: start at once instead of waiting for Firebase
    if (!user && localStorage.getItem("damp-in") === "0") return;
    await ready;
    if (!user || current !== game) return;

    const name = gameName(game);
    try {
      // If the account is slow to answer, start the game anyway
      const snap = await Promise.race([
        fb.f.getDoc(docRef()),
        new Promise(function (resolve, reject) { setTimeout(function () { reject(new Error("slow")); }, 3000); })
      ]);
      const all = snap.exists() ? snap.data().games : null;
      const cloud = all ? all[name] : null;
      const stamp = Number(localStorage.getItem("damp-sync-" + name)) || 0;
      lastSent = cloud ? cloud.data : "";

      // The account has a newer save than this device has seen
      let keepDevice = false;
      if (cloud && cloud.updated !== stamp) {
        const mine = snapshot(game);
        const askFirst = stamp === 0 && mine !== "{}" && mine !== cloud.data;
        const choice = askFirst ? await askSaveChoice(game, cloud) : "load";
        if (current !== game) return;

        if (choice === "load") {
          const data = JSON.parse(cloud.data);
          Object.keys(data).forEach(function (key) { localStorage.setItem(key, data[key]); });
          localStorage.setItem("damp-sync-" + name, cloud.updated);
        } else if (choice === "device") {
          keepDevice = true;
        } else {
          // The question was closed: play with what is on this device and leave
          // the account alone instead of quietly overwriting either side.
          return;
        }
      }

      if (current !== game) return;
      synced = game;
      autosave = setInterval(save, 30000);
      if (keepDevice) save();
    } catch (error) { /* offline or blocked: the game just plays without cloud saves */ }
  }

  // Sends the game's progress to the account (only if it changed)
  async function save() {
    if (!user || !current || synced !== current) return;
    const game = current;
    const json = snapshot(game);
    if (json === "{}" || json === lastSent) return;

    const name = gameName(game);
    const updated = Date.now();
    const entry = {};
    entry[name] = { data: json, updated: updated };
    lastSent = json;
    try {
      await fb.f.setDoc(docRef(), { games: entry }, { merge: true });
      localStorage.setItem("damp-sync-" + name, updated);
    } catch (error) {
      lastSent = ""; // try again next time
    }
  }

  // Runs when the player closes
  function stop() {
    clearInterval(autosave);
    save();
    current = null;
    synced = null;
  }

  document.addEventListener("visibilitychange", function () { if (document.hidden) save(); });
  window.addEventListener("pagehide", save);

  window.dampSaves = { load: load, stop: stop };

  // ----- Which save wins? -----
  // A new device can already have progress and an account can have its own.
  // Resolves "load" (use the account), "device" (overwrite the account with
  // this device) or "later" (leave both alone for now).
  let saveChoice = null;

  function askSaveChoice(game, cloud) {
    return new Promise(function (resolve) {
      const dialog = byId("save-dialog");
      byId("save-game").textContent = game.title;
      byId("save-when").textContent = cloud.updated ? "Account save from " + new Date(cloud.updated).toLocaleString() : "";
      saveChoice = resolve;
      dialog.showModal();
    });
  }

  function answerSave(choice) {
    const dialog = byId("save-dialog");
    const resolve = saveChoice;
    saveChoice = null;
    if (dialog.open) dialog.close();
    if (resolve) resolve(choice);
  }

  byId("save-load").addEventListener("click", function () { answerSave("load"); });
  byId("save-keep").addEventListener("click", function () { answerSave("device"); });
  byId("save-dialog").addEventListener("close", function () { if (saveChoice) answerSave("later"); });
  byId("save-dialog").addEventListener("click", function (event) {
    if (event.target === byId("save-dialog")) answerSave("later");
  });

  // ----- Log in window -----
  const dialog = byId("account-dialog");

  function tell(text, bad) {
    byId("acc-msg").textContent = text;
    byId("acc-msg").className = bad ? "note bad" : "note";
  }

  const problems = {
    "auth/invalid-email": "That username doesn't look right.",
    "auth/missing-password": "Type a password.",
    "auth/invalid-credential": "Wrong username or password.",
    "auth/wrong-password": "Wrong username or password.",
    "auth/user-not-found": "Wrong username or password.",
    "auth/email-already-in-use": "That username is taken. Pick another one, or use Log in.",
    "auth/operation-not-allowed": "Turn on Email/Password in Firebase under Authentication, Sign-in method.",
    "auth/weak-password": "The password needs at least 6 characters.",
    "auth/too-many-requests": "Too many tries. Wait a bit and try again.",
    "auth/network-request-failed": "No connection. Try again.",
    "auth/unauthorized-domain": "This web address isn't allowed yet. Add it in Firebase under Authentication, Settings, Authorized domains."
  };

  async function run(action) {
    tell("");
    try {
      await action();
    } catch (error) {
      const code = error && error.code ? error.code : "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      tell(problems[code] || "Something went wrong (" + (code || error.message) + ").", true);
    }
  }

  // Accounts are username only. Firebase wants an email, so the username
  // is turned into a made-up address that never receives mail.
  const MAIL = "@damp.example";

  function username() { return byId("acc-user").value.trim().toLowerCase(); }
  function password() { return byId("acc-pass").value; }

  // A full email still works, so accounts made earlier can log in
  function loginEmail() {
    const name = username();
    return name.indexOf("@") > -1 ? name : name + MAIL;
  }

  function shownName(who) {
    const mail = who.email || "";
    return mail.endsWith(MAIL) ? mail.slice(0, -MAIL.length) : (mail || who.displayName || "your account");
  }

  byId("account").addEventListener("click", function () { dialog.showModal(); });
  byId("acc-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });

  byId("acc-in").addEventListener("submit", function (event) {
    event.preventDefault();
    run(function () { return fb.a.signInWithEmailAndPassword(fb.auth, loginEmail(), password()); });
  });

  byId("acc-create").addEventListener("click", function () {
    if (!/^[a-z0-9_.-]{3,20}$/.test(username())) {
      return tell("Username: 3 to 20 letters, numbers, dots, dashes or underscores.", true);
    }
    run(function () { return fb.a.createUserWithEmailAndPassword(fb.auth, loginEmail(), password()); });
  });

  byId("acc-logout").addEventListener("click", function () {
    run(function () { return fb.a.signOut(fb.auth); });
  });

  function showAccount() {
    byId("account").hidden = false;
    byId("account").textContent = user ? "Account" : "Log in";
    byId("people").hidden = !user;
    byId("acc-in").hidden = !!user;
    byId("acc-out").hidden = !user;
    if (user) byId("acc-who").textContent = shownName(user);
    byId("acc-pass").value = "";
  }

  // ----- People and messages -----
  // Every account gets one public entry in "people" so others can find it,
  // and each pair of players shares one chat document.
  const peopleDialog = byId("people-dialog");
  let peopleUnsub = null;
  let chatUnsub = null;
  let chatWith = null;

  function pairId(one, two) {
    return one < two ? one + "_" + two : two + "_" + one;
  }

  function peopleMsg(text, bad) {
    byId("people-msg").textContent = text;
    byId("people-msg").className = bad ? "note bad" : "note";
  }

  // Turns a Firestore failure into the reason Firestore actually gave, instead
  // of guessing that the rules were never published.
  function fbProblem(error) {
    const code = error && error.code ? String(error.code).replace("firestore/", "") : "";
    const detail = (error && error.message) || "";
    if (code === "permission-denied") return "Firestore refused that (permission-denied). The published rules do not allow it.";
    if (code === "failed-precondition") return "Firestore needs an index for that (failed-precondition). " + detail;
    if (code === "unavailable") return "Firestore is unreachable right now (unavailable). Try again.";
    return "Firestore error" + (code ? " (" + code + ")" : "") + (detail ? ": " + detail : ".");
  }

  // Publishes this account in the people list
  function publishMe() {
    if (!fb || !user) return;
    try {
      fb.f.setDoc(fb.f.doc(fb.db, "people", user.uid), { name: shownName(user), at: Date.now() }, { merge: true })
        .catch(function () { /* the people rules are not published yet */ });
    } catch (error) { /* not connected */ }
  }

  function showPeople() {
    byId("people-list-view").hidden = false;
    byId("chat-view").hidden = true;
    peopleMsg("");
    if (peopleUnsub) return;
    // Names come from two places: the "people" directory, and the public
    // Flappy board, which already has a row for everyone who has played.
    // Someone who has not opened the site since the directory was added has
    // no people entry yet, so the board keeps them visible anyway.
    const directory = [];
    const board = [];

    function drawPeople() {
      if (!peopleDialog.open) return;
      const people = new Map();
      directory.concat(board).forEach(function (person) {
        if (!people.has(person.id)) people.set(person.id, person);
      });
      const list = Array.from(people.values()).sort(function (x, y) { return x.name.localeCompare(y.name); });
      const box = byId("people-list");
      box.textContent = "";
      if (!list.length) {
        const empty = document.createElement("p");
        empty.className = "note";
        empty.textContent = "No one else yet. Friends show up here after they play a game or open the site while signed in.";
        box.appendChild(empty);
        return;
      }
      list.forEach(function (person) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "person";
        button.textContent = person.name;
        button.addEventListener("click", function () { openChat(person.id, person.name); });
        box.appendChild(button);
      });
    }

    fb.f.getDocs(fb.f.query(fb.f.collection(fb.db, "flappy"), fb.f.limit(50))).then(function (snap) {
      snap.forEach(function (doc) {
        if (doc.id !== user.uid) board.push({ id: doc.id, name: doc.data().name || "player" });
      });
      drawPeople();
    }, function () { /* the board is only a fallback */ });

    peopleUnsub = fb.f.onSnapshot(fb.f.collection(fb.db, "people"), function (snap) {
      directory.length = 0;
      snap.forEach(function (doc) {
        if (doc.id !== user.uid) directory.push({ id: doc.id, name: doc.data().name || "player" });
      });
      drawPeople();
    }, function (error) {
      peopleMsg(fbProblem(error), true);
    });
  }

  function openChat(uid, name) {
    chatWith = uid;
    markSeen(pairId(user.uid, uid), Date.now());
    byId("people-list-view").hidden = true;
    byId("chat-view").hidden = false;
    byId("chat-who").textContent = name;
    byId("chat-log").textContent = "";
    peopleMsg("");

    const id = pairId(user.uid, uid);
    const chatRef = fb.f.doc(fb.db, "chats", id);
    const names = {};
    names[user.uid] = shownName(user);
    names[uid] = name;
    fb.f.setDoc(chatRef, { ids: [user.uid, uid].sort(), names: names }, { merge: true })
      .catch(function (error) { peopleMsg(fbProblem(error), true); });

    if (chatUnsub) chatUnsub();
    chatUnsub = fb.f.onSnapshot(
      fb.f.query(fb.f.collection(chatRef, "messages"), fb.f.orderBy("at"), fb.f.limitToLast(100)),
      function (snap) {
        const log = byId("chat-log");
        log.textContent = "";
        snap.forEach(function (doc) {
          const data = doc.data();
          const bubble = document.createElement("div");
          bubble.className = "msg" + (data.from === user.uid ? " me" : "");
          bubble.textContent = data.text || "";
          if (data.at) {
            const time = document.createElement("span");
            time.className = "t";
            time.textContent = new Date(data.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            bubble.appendChild(time);
          }
          log.appendChild(bubble);
        });
        log.scrollTop = log.scrollHeight;
      },
      function (error) { peopleMsg(fbProblem(error), true); }
    );
  }

  byId("people").addEventListener("click", function () {
    if (!fb || !user) return;
    peopleDialog.showModal();
    showPeople();
  });
  byId("people-close").addEventListener("click", function () { peopleDialog.close(); });
  peopleDialog.addEventListener("click", function (event) {
    if (event.target === peopleDialog) peopleDialog.close();
  });
  peopleDialog.addEventListener("close", function () {
    if (peopleUnsub) { peopleUnsub(); peopleUnsub = null; }
    if (chatUnsub) { chatUnsub(); chatUnsub = null; }
    chatWith = null;
  });

  byId("chat-back").addEventListener("click", function () {
    if (chatUnsub) { chatUnsub(); chatUnsub = null; }
    chatWith = null;
    byId("chat-view").hidden = true;
    byId("people-list-view").hidden = false;
    peopleMsg("");
  });

  byId("chat-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const input = byId("chat-text");
    const text = input.value.trim();
    if (!text || !chatWith || !user) return;
    input.value = "";
    const id = pairId(user.uid, chatWith);
    const at = Date.now();
    fb.f.addDoc(fb.f.collection(fb.db, "chats", id, "messages"), { from: user.uid, text: text, at: at })
      .catch(function (error) { peopleMsg(fbProblem(error), true); });
    // Keeps the summary on the chat fresh, so the other player can be notified
    fb.f.setDoc(fb.f.doc(fb.db, "chats", id),
      { ids: [user.uid, chatWith].sort(), last: text.slice(0, 120), lastAt: at, lastFrom: user.uid },
      { merge: true }).catch(function () { /* the chat rules are not published yet */ });
  });

  // ----- Little message notification -----
  // One listener on this player's chats; a corner toast that never blocks the page.
  let notifyUnsub = null;
  let notifyFirst = true;
  let toastTimer = null;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem("damp-seen") || "{}") || {}; } catch (error) { seen = {}; }

  function markSeen(id, at) {
    seen[id] = at;
    try { localStorage.setItem("damp-seen", JSON.stringify(seen)); } catch (error) { /* storage off */ }
  }

  function toast(who, text, chatId, uid) {
    const box = byId("toast");
    box.textContent = "";
    const name = document.createElement("b");
    name.textContent = who;
    box.append(name, document.createTextNode(": " + String(text || "New message").slice(0, 70)));
    box.dataset.uid = uid;
    box.dataset.name = who;
    box.dataset.chat = chatId;
    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 5000);
  }

  function watchMessages() {
    if (notifyUnsub || !fb || !user) return;
    notifyUnsub = fb.f.onSnapshot(
      fb.f.query(fb.f.collection(fb.db, "chats"), fb.f.where("ids", "array-contains", user.uid)),
      function (snap) {
        // The first answer only sets the starting point, so old messages stay quiet
        if (notifyFirst) {
          snap.forEach(function (doc) { if (doc.data().lastAt) markSeen(doc.id, doc.data().lastAt); });
          notifyFirst = false;
          return;
        }
        snap.forEach(function (doc) {
          const data = doc.data() || {};
          if (!data.lastAt || data.lastFrom === user.uid) return;
          if (chatWith === data.lastFrom) return;
          if (seen[doc.id] && data.lastAt <= seen[doc.id]) return;
          markSeen(doc.id, data.lastAt);
          const names = data.names || {};
          toast(names[data.lastFrom] || "Someone", data.last, doc.id, data.lastFrom);
        });
      },
      function () { /* the chat rules are not published yet */ }
    );
  }

  byId("toast").addEventListener("click", function () {
    const box = byId("toast");
    if (!box.dataset.uid) return;
    box.hidden = true;
    peopleDialog.showModal();
    showPeople();
    openChat(box.dataset.uid, box.dataset.name);
  });

  // ----- Start -----
  async function init() {
    // Until the settings are pasted in, the site looks exactly as before
    if (firebaseConfig.apiKey.indexOf("PASTE") === 0) { markReady(); return; }
    try {
      const parts = await Promise.all([
        import(SDK + "firebase-app.js"),
        import(SDK + "firebase-auth.js"),
        import(SDK + "firebase-firestore.js")
      ]);
      const app = parts[0].initializeApp(firebaseConfig);
      fb = { a: parts[1], f: parts[2], auth: parts[1].getAuth(app), db: parts[2].getFirestore(app) };
      fb.a.onAuthStateChanged(fb.auth, function (who) {
        user = who;
        try { localStorage.setItem("damp-in", who ? "1" : "0"); } catch (error) { /* storage off */ }
        if (!user) { clearInterval(autosave); current = null; synced = null; }
        if (who) { publishMe(); watchMessages(); }
        else if (notifyUnsub) { notifyUnsub(); notifyUnsub = null; notifyFirst = true; }
        showAccount();
        markReady();
      });
    } catch (error) {
      markReady();
    }
  }

  init();
})();
