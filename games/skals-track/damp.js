/*
  Damp board for SkalsTrack.

  SkalsTrack keeps the best run of every track in localStorage and normally sends
  it to Kodub's own server. That server only accepts the desktop app, so on Damp
  the board is Firestore instead: the signed-in account's best time for each
  official track is copied to skalstrack_tracks/{trackId}/scores/{uid}, and
  worker.js reads the same collection back into the game's leaderboard panel.
  Everything here fails softly: the game never depends on it.
*/
(function () {
  var SDK = "../../vendor/firebase/";
  var CONFIG = {
    apiKey: "AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w",
    authDomain: "damp-2406a.firebaseapp.com",
    projectId: "damp-2406a",
    appId: "1:940989851976:web:f8fd07c258afa71fd22b7d"
  };
  var COLLECTION = "skalstrack_tracks";
  var RECORD_PREFIX = "polytrack_v5_prod_record_";
  var MIN_MS = 5000;
  var MAX_MS = 3600000;

  // Official track ids, read from the game's own track list.
  var TRACKS = {
    "5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038": "Summer 1",
    "7eac4fee1111152cfba4d3737410264ca0f22c7f5a2211e79f0099589b8b48c0": "Summer 2",
    "148826aa16ffaa23dbc453b32cff05e025ddbce1773fc7733cc13d218926515a": "Summer 3",
    "93c7363dfea7fb09ca1d23b72cad5df43a30841d41c8ff25fb544c85bb03c7ae": "Summer 4",
    "7603aaeffa1989a649dfaa8e1804bed4481b49df233e377687d0669899566e52": "Summer 5",
    "c117823cf6788e3247b9ee63a0c091c07352bbe352c650a7790dc6718148c2fa": "Summer 6",
    "e4bcaca3a583bb0eb62a700a69d14e89c852f0c5bf740fca76e0519ebdfc9ab1": "Summer 7",
    "7239b17057127936907a805b0caa5d8c6f6c97eca9bdabf1a5312dce479629b7": "Winter 1",
    "99864b635d1891d22e17eb9267527a07a92c49c0f02893729fa2ded90e3ca0f9": "Winter 2",
    "a5341fe706097cff2a3812a3fc0d87399254557328351ae8e5c882700fc1a196": "Winter 3",
    "7d134c939df80c676a258266201beedd3b93572d5603f3ff4339ff8679803715": "Winter 4",
    "2fe4bd46b0075cc25fc770ce50adbb68447cf493c999635bb272d231811dd264": "Winter 5",
    "c20b4ee3cd517ca6cae7e43f047548757287fbd08ba81b97892a3ef520159a34": "Desert 1",
    "88647ea04145fbbbb19b55f1590e038fb0378acb2571110f02cb545cc46b0d57": "Desert 2",
    "2806030c503abb41a1a26fa9a570888be14296172bb273798ef0ad87a108a2ec": "Desert 3",
    "4697ea67b18c3f49b30a3d8884602115536650bc5435c88e3732e64d21a72d33": "Desert 4",
    "e5d084e06db4ab71196fea44efeceb23c8561266a78669c324a38f92581fe2db": "Desert 5"
  };

  var auth = null;
  var db = null;
  var F = null;
  var user = null;
  var playerName = "";
  var busy = false;

  function readRecords() {
    var best = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf(RECORD_PREFIX) !== 0) continue;
      var match = /^polytrack_v5_prod_record_\d+_(default|undeterministic)_(.+)$/.exec(key);
      if (!match) continue;
      // Only deterministic runs are worth comparing between machines.
      if (match[1] !== "default") continue;
      var trackId = match[2];
      if (!TRACKS[trackId]) continue;
      var frames = 0;
      try {
        var record = JSON.parse(localStorage.getItem(key) || "null");
        frames = record && Number(record.frames);
      } catch (error) {
        continue;
      }
      if (!Number.isFinite(frames) || frames < MIN_MS || frames > MAX_MS) continue;
      if (!best[trackId] || frames < best[trackId]) best[trackId] = frames;
    }
    return best;
  }

  function formatTime(ms) {
    var total = Math.round(ms);
    var minutes = Math.floor(total / 60000);
    var seconds = Math.floor((total % 60000) / 1000);
    var millis = total % 1000;
    return (minutes ? minutes + ":" : "") + (minutes && seconds < 10 ? "0" : "") + seconds + "." + String(millis).padStart(3, "0");
  }

  var chip = null;
  var chipTimer = 0;
  function say(text) {
    if (!chip) {
      chip = document.createElement("div");
      chip.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:2147483647;padding:9px 14px;" +
        "border-radius:9px;background:rgba(20,26,56,0.94);border:1px solid #5a6ab8;color:#e9ecff;" +
        "font:600 14px/1.35 'Segoe UI',system-ui,sans-serif;pointer-events:none;opacity:0;" +
        "transition:opacity .25s ease;box-shadow:0 8px 22px rgba(0,0,0,.35)";
      document.body.appendChild(chip);
    }
    chip.textContent = text;
    chip.style.opacity = "1";
    clearTimeout(chipTimer);
    chipTimer = setTimeout(function () { chip.style.opacity = "0"; }, 6000);
  }

  // Times already handed to the board, so the poll does not read Firestore again
  // for a track that has not improved. { uid, times: { trackId: frames } }
  var SYNC_KEY = "damp-polytrack-synced";
  var synced = { uid: "", times: {}, styles: {} };
  function loadSynced() {
    try {
      var raw = JSON.parse(localStorage.getItem(SYNC_KEY) || "null");
      if (raw && typeof raw === "object") synced = { uid: String(raw.uid || ""), times: raw.times || {}, styles: raw.styles || {} };
    } catch (error) { /* start fresh */ }
  }
  function saveSynced() {
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(synced)); } catch (error) { /* private mode */ }
  }

  // The car the player races, as the game keeps it in its own profile. The
  // board draws this thumbnail, so it should be the paint they won with.
  var PROFILE_KEY = "polytrack_v5_prod_user_";
  function carStyle() {
    try {
      var slot = parseInt(localStorage.getItem("polytrack_v5_prod_user_slot") || "0", 10);
      if (!Number.isSafeInteger(slot) || slot < 0) slot = 0;
      var raw = localStorage.getItem(PROFILE_KEY + slot);
      if (!raw) return "";
      var profile = JSON.parse(raw);
      var style = profile && profile.carStyle;
      return typeof style === "string" && /^[A-Za-z0-9+/]{20,26}={0,2}$/.test(style) ? style : "";
    } catch (error) {
      return "";
    }
  }

  // Firestore only accepts carStyle once the updated rules are published, so
  // a rejected paint still stores the time instead of losing it.
  async function writeRow(ref, row) {
    try {
      await F.setDoc(ref, row, { merge: true });
      return true;
    } catch (error) {
      if (!row.carStyle) throw error;
      await F.setDoc(ref, { name: row.name, frames: row.frames, at: row.at }, { merge: true });
      return false;
    }
  }

  async function push() {
    if (!user || !db || !F || busy) return;
    busy = true;
    try {
      if (synced.uid !== user.uid) { synced = { uid: user.uid, times: {}, styles: {} }; saveSynced(); }
      var best = readRecords();
      var style = carStyle();
      for (var trackId in best) {
        if (!Object.prototype.hasOwnProperty.call(best, trackId)) continue;
        var frames = best[trackId];
        var known = Number(synced.times[trackId]) || 0;
        var repaint = !!style && synced.styles[trackId] !== style;
        if (known && frames >= known && !repaint) continue;
        try {
          var ref = F.doc(db, COLLECTION, trackId, "scores", user.uid);
          if (known && frames >= known) {
            // The time stands, only the car changed: send the paint alone.
            await F.setDoc(ref, { carStyle: style }, { merge: true });
            synced.styles[trackId] = style;
            saveSynced();
            continue;
          }
          var existing = await F.getDoc(ref);
          var stored = existing.exists() ? Number(existing.data().frames) || 0 : 0;
          if (stored && frames >= stored) {
            synced.times[trackId] = stored;
            if (repaint) {
              await F.setDoc(ref, { carStyle: style }, { merge: true });
              synced.styles[trackId] = style;
            }
            saveSynced();
            continue;
          }
          var row = { name: playerName, frames: frames, at: F.serverTimestamp() };
          if (style) row.carStyle = style;
          var painted = await writeRow(ref, row);
          synced.times[trackId] = frames;
          if (painted && style) synced.styles[trackId] = style;
          saveSynced();
          say("Damp board: " + formatTime(frames) + " on " + TRACKS[trackId]);
        } catch (error) {
          // Most likely the Firestore rules for skalstrack_tracks are not published yet.
          console.debug("Damp board:", error && error.message ? error.message : error);
        }
      }
    } finally {
      busy = false;
    }
  }

  async function start() {
    try {
      var parts = await Promise.all([
        import(SDK + "firebase-app.js"),
        import(SDK + "firebase-auth.js"),
        import(SDK + "firebase-firestore.js")
      ]);
      var app = parts[0].getApps().length ? parts[0].getApp() : parts[0].initializeApp(CONFIG);
      auth = parts[1].getAuth(app);
      F = parts[2];
      db = F.getFirestore(app);

      loadSynced();

      parts[1].onAuthStateChanged(auth, async function (who) {
        user = who;
        playerName = "";
        if (!who) return;
        try {
          var person = await F.getDoc(F.doc(db, "people", who.uid));
          if (person.exists()) playerName = String(person.data().name || "").slice(0, 24);
        } catch (error) { /* directory is optional */ }
        if (!playerName) {
          try { playerName = String(localStorage.getItem("damp-name") || "").slice(0, 24); } catch (error) { /* ignore */ }
        }
        if (!playerName) playerName = (who.email || "").split("@")[0].slice(0, 24) || "player";
        push();
      });

      setInterval(push, 5000);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) push(); });
    } catch (error) {
      console.debug("Damp board unavailable:", error && error.message ? error.message : error);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
