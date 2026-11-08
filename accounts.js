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
    "Flappy Bird.html": ["fb-best", "fb-save"],
    "Starclicker.html": ["voidfoundry.v1"],
    "verity-clicker.html": ["verityClicker.v1"],
    "hedgerow-hallow.html": ["hedgerow-hollow-v1"],
    "guess-the-color.html": ["colorMemoryBest"],
    "guessing-game.html": ["hol_mode", "hol_cat", "hol_sound", "hol_best", "hol_scores"]
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
  setTimeout(markReady, 4000);

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
    await ready;
    if (!user || current !== game) return;

    const name = gameName(game);
    try {
      const snap = await fb.f.getDoc(docRef());
      const all = snap.exists() ? snap.data().games : null;
      const cloud = all ? all[name] : null;
      const stamp = Number(localStorage.getItem("damp-sync-" + name)) || 0;
      lastSent = cloud ? cloud.data : "";

      // The account has a newer save than this device has seen
      if (cloud && cloud.updated !== stamp) {
        const mine = snapshot(game);
        const askFirst = stamp === 0 && mine !== "{}" && mine !== cloud.data;
        if (!askFirst || confirm("Your account has a saved game. OK uses it. Cancel keeps the progress on this device.")) {
          const data = JSON.parse(cloud.data);
          Object.keys(data).forEach(function (key) { localStorage.setItem(key, data[key]); });
          localStorage.setItem("damp-sync-" + name, cloud.updated);
        }
      }

      if (current !== game) return;
      synced = game;
      autosave = setInterval(save, 30000);
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

  // ----- Log in window -----
  const dialog = byId("account-dialog");

  function tell(text, bad) {
    byId("acc-msg").textContent = text;
    byId("acc-msg").className = bad ? "note bad" : "note";
  }

  const problems = {
    "auth/invalid-email": "That email doesn't look right.",
    "auth/missing-password": "Type a password.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "Wrong email or password.",
    "auth/email-already-in-use": "That email already has an account. Use Log in.",
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

  function email() { return byId("acc-email").value.trim(); }
  function password() { return byId("acc-pass").value; }

  byId("account").addEventListener("click", function () { dialog.showModal(); });
  byId("acc-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });

  byId("acc-in").addEventListener("submit", function (event) {
    event.preventDefault();
    run(function () { return fb.a.signInWithEmailAndPassword(fb.auth, email(), password()); });
  });

  byId("acc-create").addEventListener("click", function () {
    run(function () { return fb.a.createUserWithEmailAndPassword(fb.auth, email(), password()); });
  });

  byId("acc-google").addEventListener("click", function () {
    run(function () { return fb.a.signInWithPopup(fb.auth, new fb.a.GoogleAuthProvider()); });
  });

  byId("acc-reset").addEventListener("click", function () {
    if (!email()) return tell("Type your email first.", true);
    run(async function () {
      await fb.a.sendPasswordResetEmail(fb.auth, email());
      tell("Password reset email sent. Check your inbox and spam.");
    });
  });

  byId("acc-logout").addEventListener("click", function () {
    run(function () { return fb.a.signOut(fb.auth); });
  });

  function showAccount() {
    byId("account").hidden = false;
    byId("account").textContent = user ? "Account" : "Log in";
    byId("acc-in").hidden = !!user;
    byId("acc-out").hidden = !user;
    if (user) byId("acc-who").textContent = user.email || user.displayName || "your account";
    byId("acc-pass").value = "";
  }

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
        if (!user) { clearInterval(autosave); current = null; synced = null; }
        showAccount();
        markReady();
      });
    } catch (error) {
      markReady();
    }
  }

  init();
})();
