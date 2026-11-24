// ---------------------------------------------------------------
// Your games are listed in games.json (the secret editor on the
// site adds to it for you).
//
// YOUR EXTENSIONS (shown only inside the secret window)
// The file must match the zip name in the repository exactly.
// ---------------------------------------------------------------
const extensions = [
  { name: "Emat Hjælper", description: "Chrome extension for emat.", file: "files/emat-svar.zip" },
  { name: "Grammatik Hjælper", description: "Chrome extension for grammatip.", file: "files/grammatik-hjaelper.zip" },
];

const ADMIN_CODE = "1203";

// ---------------------------------------------------------------
// Everything below builds the page. You don't need to change it.
// ---------------------------------------------------------------
const $ = function (id) { return document.getElementById(id); };

const search = $("search");
const chips = $("chips");
const player = $("player");
const stage = $("player-stage");
const frame = $("player-frame");
const ext = $("ext");
const editor = $("editor");
const fullscreenButton = $("player-fullscreen");
const fullscreenLabel = fullscreenButton.querySelector(".player-action-label");

let games = [];
let loadFailed = false;
let category = "All";
let admin = sessionStorage.getItem("damp-admin") === "1";
let editing = null;
let playing = "";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function slugText(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// A game's link name: "Star Clicker" becomes "star-clicker"
function slug(game) {
  return slugText(game.title);
}

// Gives each picture-less game its own tile color
function hueFrom(text) {
  let hue = 0;
  for (const char of text) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}

// A game with "hidden": true stays in games.json and keeps its files; it is only
// left off the page. Its #play= link still works, so you can keep working on it.
function liveGames() {
  return games.filter(function (game) { return !game.hidden; });
}

// The page is one shelf in three groups: video games first, then the party
// games, then the board games.
const SECTION_TITLES = { video: "Video games", party: "Party games", board: "Board games" };

function sectionOf(game) {
  if (game.board) return "board";
  if (game.party) return "party";
  return "video";
}

function categories(list) {
  const out = [];
  (list || liveGames()).forEach(function (game) {
    if (game.category && !out.includes(game.category)) out.push(game.category);
  });
  return out;
}

// ----- Games -----
function makeCard(game) {
  const item = el("div", "item");
  const card = el("a", "game");
  card.href = "#play=" + slug(game);
  card.title = game.description || "";
  ["pointerenter", "focus", "touchstart"].forEach(function (name) {
    card.addEventListener(name, function () { warm(game); }, { passive: true });
  });

  const tile = el("div", "tile");
  function letterTile() {
    tile.style.setProperty("--hue", hueFrom(game.title));
    tile.textContent = game.title.charAt(0).toUpperCase();
  }
  if (game.image) {
    const img = el("img");
    img.src = encodeURI(game.image);
    img.alt = "";
    img.loading = "lazy";
    // The tile is 16:10; giving the image its own ratio stops it collapsing
    // before the file arrives, and keeps the shelf from jumping.
    img.width = 320;
    img.height = 200;
    img.decoding = "async";
    img.addEventListener("error", function () { img.remove(); letterTile(); });
    tile.appendChild(img);
  } else {
    letterTile();
  }

  // Only you see a hidden game on the page, marked, so it can still be edited
  if (admin && game.hidden) {
    item.classList.add("is-hidden");
    tile.appendChild(el("span", "tag-hidden", "Hidden"));
  }

  card.append(tile, el("h3", null, game.title), el("p", "d", game.description || ""), el("p", "cat", game.category || "Game"));
  item.appendChild(card);

  if (admin) {
    const edit = el("button", "edit", "Edit");
    edit.type = "button";
    edit.addEventListener("click", function () { openEditor(game); });
    item.appendChild(edit);
  }
  return item;
}

function showHero() {
  const feature = $("hero-feature");
  if (!feature) return;
  const game = shelfPick();
  if (!game) { feature.hidden = true; return; }
  const id = slug(game);
  if (feature.dataset.id === id) return;
  feature.dataset.id = id;
  feature.href = "#play=" + id;
  feature.setAttribute("aria-label", "Play " + game.title);
  $("hero-game-title").textContent = game.title;
  $("hero-game-desc").textContent = game.description || "";
  $("hero-game-cat").textContent = game.category || "Game";
  const art = $("hero-art");
  art.hidden = !game.image;
  if (game.image) {
    art.src = encodeURI(game.image);
    art.onerror = function () { art.hidden = true; };
  } else {
    art.removeAttribute("src");
  }
  feature.hidden = false;
}

// Search is forgiving: "hegerow hallow" still finds Hedgerow Hallow, "draw and
// pass" finds Draw & Pass, and a word or two of a title is enough.
function searchWords(text) {
  return String(text)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/&/g, " and ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Single-letter edits between two words, giving up once they are clearly
// different words.
function editDistance(a, b, max) {
  const limit = max + 1;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = Math.min(j, limit);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array(b.length + 1);
    cur[0] = Math.min(i, limit);
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost, limit);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return limit;
    prev = cur;
  }
  return prev[b.length];
}

function closeEnough(word, target) {
  if (word === target) return true;
  if (word.length >= 2 && target.startsWith(word)) return true;
  const longest = Math.max(word.length, target.length);
  if (longest < 5) return false;
  const allowance = longest >= 9 ? 2 : 1;
  if (Math.abs(word.length - target.length) > allowance) return false;
  return editDistance(word, target, allowance) <= allowance;
}

function matchesQuery(game, query) {
  const need = searchWords(query);
  if (!need.length) return true;
  const have = searchWords(game.title + " " + (game.description || "") + " " + (game.category || ""));
  return need.every(function (word) {
    return have.some(function (target) { return closeEnough(word, target); });
  });
}

// The game you typed comes first: an exact title, then a title that starts with
// it, then one that only mentions it somewhere.
function matchRank(game, query) {
  const need = searchWords(query);
  const title = searchWords(game.title);
  if (!need.length || !title.length) return 0;
  if (title.join(" ") === need.join(" ")) return 0;
  const inTitle = need.every(function (word) {
    return title.some(function (target) { return closeEnough(word, target); });
  });
  if (!inTitle) return 3;
  return title.some(function (target) { return target.startsWith(need[0]); }) ? 1 : 2;
}

function sortedForView(list, searching, query) {
  if (searching) {
    return list.slice().sort(function (a, b) {
      return matchRank(a, query) - matchRank(b, query) || a.title.localeCompare(b.title);
    });
  }
  const mode = $("sort").value;
  if (mode === "newest") return list.slice().reverse();
  if (mode === "az") return list.slice().sort(function (a, b) { return a.title.localeCompare(b.title); });
  return forYouOrder(list);
}

// One heading, a rule to the edge and the cards underneath.
function groupBlock(key, list) {
  const block = document.createElement("section");
  block.className = "game-group";
  const title = el("h2", "group-title", SECTION_TITLES[key]);
  title.id = "group-" + key;
  block.setAttribute("aria-labelledby", title.id);
  const head = el("div", "group-head");
  head.append(title, el("span", "group-rule"));
  const cards = el("div", "grid");
  cards.append.apply(cards, list.map(makeCard));
  block.append(head, cards);
  return block;
}

function showGames() {
  const query = search.value.trim().toLowerCase();
  const searching = query !== "";
  const source = admin ? games : liveGames();

  // While you type, the page is only the games that match, best match on top.
  document.body.classList.toggle("searching", searching);
  chips.hidden = searching || source.length === 0;

  const list = sortedForView(
    searching
      ? source.filter(function (game) { return matchesQuery(game, query); })
      : source.filter(function (game) { return category === "All" || game.category === category; }),
    searching,
    query
  );

  const results = $("games-results");
  const groups = $("games-grid");

  if (searching) {
    groups.hidden = true;
    groups.replaceChildren();
    results.hidden = false;
    results.replaceChildren.apply(results, list.map(makeCard));
  } else {
    results.hidden = true;
    results.replaceChildren();
    groups.hidden = false;
    const buckets = { video: [], party: [], board: [] };
    list.forEach(function (game) { buckets[sectionOf(game)].push(game); });
    const parts = [];
    ["video", "party", "board"].forEach(function (key) {
      if (!buckets[key].length) return;
      if (parts.length) parts.push(el("hr", "divider"));
      parts.push(groupBlock(key, buckets[key]));
    });
    groups.replaceChildren.apply(groups, parts);
  }

  $("heading").textContent = searching ? "Search results" : category === "All" ? "All games" : category;
  $("count").textContent = list.length + (list.length === 1 ? " game" : " games");

  if (loadFailed) {
    $("empty").textContent = "The games list didn't load. Open the site through its web address.";
  } else {
    $("empty").textContent = source.length === 0 ? "No games yet. Check back soon." : "No games match your search.";
  }
  $("empty").hidden = list.length > 0;
  showShelf();
  showHero();
}

function showChips() {
  chips.replaceChildren();
  const all = liveGames();
  const names = ["All"].concat(categories(all));
  if (!names.includes(category)) category = "All";
  chips.hidden = all.length === 0 || search.value.trim() !== "";
  const showCats = names.length > 2;
  if (!showCats) return;

  names.forEach(function (name) {
    const chip = el("button", "chip");
    const total = name === "All" ? all.length : all.filter(function (g) { return g.category === name; }).length;
    chip.append(el("span", null, name), el("span", "n", String(total)));
    chip.type = "button";
    chip.setAttribute("aria-pressed", name === category);
    chip.addEventListener("click", function () {
      category = name;
      chips.querySelectorAll(".chip").forEach(function (other) {
        other.setAttribute("aria-pressed", other === chip);
      });
      showGames();
    });
    chips.appendChild(chip);
  });
}

search.addEventListener("input", showGames);

function playRandom() {
  const list = liveGames();
  if (!list.length) return;
  const game = list[Math.floor(Math.random() * list.length)];
  location.hash = "play=" + slug(game);
}

$("random").addEventListener("click", playRandom);
$("hero-random").addEventListener("click", playRandom);

// ----- Recently played (remembered on this device) -----
function getRecent() {
  try { return JSON.parse(localStorage.getItem("damp-recent")) || []; } catch (error) { return []; }
}

function recentGames() {
  const list = liveGames();
  return getRecent().filter(function (id) { return list.some(function (g) { return slug(g) === id; }); });
}

// There is no global play counter in the project, so the curated games.json order
// is the popularity baseline. Recent plays and their categories bend it locally.
function forYouScore(game, recents, categoryCounts) {
  const position = games.indexOf(game);
  let score = position < 0 ? 0 : games.length - position;
  if (game.featured) score += 12;

  const recentIndex = recents.indexOf(slug(game));
  if (recentIndex > -1) score += Math.max(2, 8 - recentIndex);
  if (game.category) score += Math.min(4, (categoryCounts[game.category] || 0) * 2);
  return score;
}

function forYouOrder(list) {
  const recents = recentGames();
  const categoryCounts = {};
  recents.forEach(function (id) {
    const game = games.find(function (g) { return slug(g) === id; });
    if (game && game.category) categoryCounts[game.category] = (categoryCounts[game.category] || 0) + 1;
  });

  return list.slice().sort(function (a, b) {
    const difference = forYouScore(b, recents, categoryCounts) - forYouScore(a, recents, categoryCounts);
    return difference || a.title.localeCompare(b.title);
  });
}

function shelfPick() {
  const list = liveGames();
  if (recentGames().length) return forYouOrder(list)[0] || list[0];
  return list.find(function (g) { return g.featured; }) || list[0];
}

function addRecent(game) {
  const id = slug(game);
  const list = getRecent().filter(function (other) { return other !== id; });
  list.unshift(id);
  try { localStorage.setItem("damp-recent", JSON.stringify(list.slice(0, 12))); } catch (error) { /* storage off */ }
}

// The row right above "All games"
function showShelf() {
  const picks = recentGames().slice(0, 12).map(function (id) {
    return games.find(function (g) { return slug(g) === id; });
  });
  $("shelf").hidden = !(category === "All" && search.value.trim() === "" && picks.length > 0);
  $("shelf-grid").replaceChildren(...picks.map(makeCard));
}

// ----- Sorting -----
$("sort").addEventListener("change", function () {
  try { localStorage.setItem("damp-sort", $("sort").value); } catch (error) { /* storage off */ }
  showGames();
});

// ----- Loading screen (shows at once, so the player never sits on black) -----
let hintTimer, fadeTimer;

function startLoading(game) {
  stopLoading();
  const art = $("loading-art");
  art.hidden = !game.image;
  if (game.image) art.src = encodeURI(game.image);
  $("loading-title").textContent = game.title;
  $("loading-text").textContent = "";
  $("loading").classList.remove("done");
  $("loading").hidden = false;
  hintTimer = setTimeout(function () {
    $("loading-text").textContent = "Still loading. If it stays stuck, try Open in new tab at the top.";
  }, 8000);
}

function stopLoading() {
  clearTimeout(hintTimer);
  clearTimeout(fadeTimer);
  $("loading").hidden = true;
}

// Fades the loading screen out instead of cutting to the game
function finishLoading() {
  if ($("loading").hidden) return;
  clearTimeout(hintTimer);
  $("loading").classList.add("done");
  fadeTimer = setTimeout(stopLoading, 250);
}

frame.addEventListener("load", function () {
  const loaded = Boolean(frame.src && frame.src !== "about:blank");
  playerLanguageReady = loaded;
  if (loaded) finishLoading();
  syncLanguageControls();
});

// Starts fetching a game's file as soon as someone points at its tile
const warmed = new Set();
function warm(game) {
  if (warmed.has(game.file)) return;
  warmed.add(game.file);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = encodeURI(game.file);
  document.head.appendChild(link);
}

// ----- Game player -----
function openPlayer(game) {
  if (playing !== slug(game)) {
    playing = slug(game);
    playerLanguageReady = false;
    startLoading(game);
    addRecent(game);
    // Gets the saved progress from the account first, then starts the game
    const id = playing;
    const saved = window.dampSaves ? dampSaves.load(game) : Promise.resolve();
    saved.then(function () {
      if (playing !== id) return;
      frame.src = encodeURI(game.file);
      // Slow fonts or ads inside a game can hold up the load signal, so never cover it for long
      setTimeout(function () { if (playing === id) finishLoading(); }, 3000);
    });
  }
  $("player-title").textContent = game.title;
  $("player-newtab").href = encodeURI(game.file);
  // Lets the account side put the open game in your entry for the people list
  document.dispatchEvent(new CustomEvent("damp-playing", { detail: game.title }));
  player.classList.remove("bar-open");
  player.hidden = false;
  document.body.classList.add("locked");
  syncLanguageControls();
}

function closePlayer() {
  if (player.hidden) return;
  if (document.fullscreenElement) document.exitFullscreen();
  player.classList.remove("pseudo-fullscreen");
  player.classList.remove("bar-open");
  syncFullscreenButton();
  if (window.dampSaves) dampSaves.stop();
  frame.src = "about:blank";
  playing = "";
  document.dispatchEvent(new CustomEvent("damp-playing", { detail: "" }));
  playerLanguageReady = false;
  stopLoading();
  player.hidden = true;
  document.body.classList.remove("locked");
  syncLanguageControls();
  showChips();
  showGames();
}

$("player-close").addEventListener("click", function () { location.hash = ""; });

// The game bar is a menu control: the top of the window brings it down while
// the game is on its own menu, and a game that is actually being played keeps
// the bar away, so it never covers a race or a match.
(function () {
  const EDGE = 96;
  let checked = { at: 0, doc: null, playing: false };

  // A menu counts when a big menu-like panel fills most of the frame.
  function menuInFront(doc) {
    const view = doc.defaultView;
    if (!view) return false;
    const width = view.innerWidth;
    const height = view.innerHeight;
    if (!width || !height) return false;
    const nodes = doc.querySelectorAll(
      '[class*="menu" i], [id*="menu" i], [class*="overlay" i], [id*="overlay" i], ' +
      '[class*="start" i], [id*="start" i], [class*="home" i], [id*="home" i], [role="dialog"]'
    );
    for (let i = 0; i < nodes.length; i++) {
      const style = view.getComputedStyle(nodes[i]);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.15) continue;
      const box = nodes[i].getBoundingClientRect();
      if (box.width >= width * 0.45 && box.height >= height * 0.45) return true;
    }
    return false;
  }

  // A canvas game is in play once its canvas fills the frame and no menu sits
  // on top of it. Games without a big canvas keep the bar.
  function inPlay() {
    if (player.hidden) return false;
    let doc;
    try { doc = frame.contentDocument; } catch (error) { return false; }
    if (!doc || !doc.body) return false;
    const now = Date.now();
    if (checked.doc === doc && now - checked.at < 250) return checked.playing;
    let playing = false;
    const canvas = doc.querySelector("canvas");
    const view = doc.defaultView;
    if (canvas && view) {
      const box = canvas.getBoundingClientRect();
      const fills = box.width >= view.innerWidth * 0.6 && box.height >= view.innerHeight * 0.6;
      playing = fills && !menuInFront(doc);
    }
    checked = { at: now, doc: doc, playing: playing };
    return playing;
  }

  function watch(event) {
    if (player.hidden || event.pointerType === "touch") return;
    const nearTop = event.clientY <= EDGE;
    if (nearTop && inPlay()) {
      player.classList.remove("bar-open");
      return;
    }
    player.classList.toggle("bar-open", nearTop);
  }

  function hideNow() {
    player.classList.remove("bar-open");
  }

  // The games are same-origin, so moves inside the frame move the bar too.
  function watchFrame() {
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.dampBarWatch) return;
      checked = { at: 0, doc: null, playing: false };
      doc.dampBarWatch = true;
      doc.addEventListener("pointermove", watch, { passive: true });
    } catch (error) { /* other origin: the bar still opens above the game */ }
  }

  document.addEventListener("pointermove", watch, { passive: true });
  document.addEventListener("pointerleave", hideNow);
  frame.addEventListener("load", watchFrame);
  watchFrame();
})();

$("player-share").addEventListener("click", function () {
  const button = $("player-share");
  function copied() {
    button.textContent = "Link copied";
    setTimeout(function () { button.textContent = "Copy link"; }, 2000);
  }
  function ask() { prompt("Copy this link:", location.href); }
  if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(copied, ask);
  else ask();
});

function syncFullscreenButton() {
  if (document.fullscreenElement) player.classList.remove("pseudo-fullscreen");
  const on = Boolean(document.fullscreenElement) || player.classList.contains("pseudo-fullscreen");
  fullscreenLabel.textContent = on ? "Exit fullscreen" : "Fullscreen";
  fullscreenButton.setAttribute("aria-label", on ? "Exit fullscreen" : "Fullscreen");
  fullscreenButton.setAttribute("aria-pressed", on ? "true" : "false");
}

function setPseudoFullscreen(on) {
  player.classList.toggle("pseudo-fullscreen", on);
  syncFullscreenButton();
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen();
    return;
  }
  if (player.classList.contains("pseudo-fullscreen")) {
    setPseudoFullscreen(false);
    return;
  }

  const request = stage.requestFullscreen || stage.webkitRequestFullscreen || stage.webkitRequestFullScreen;
  if (request) {
    let pending;
    try {
      pending = request.call(stage);
    } catch (error) {
      setPseudoFullscreen(true);
      return;
    }
    syncFullscreenButton();
    if (pending && pending.catch) pending.catch(function () { setPseudoFullscreen(true); });
    // Some mobile browsers expose the API but never enter fullscreen.
    setTimeout(function () {
      if (!document.fullscreenElement && !player.classList.contains("pseudo-fullscreen")) {
        setPseudoFullscreen(true);
      }
    }, 300);
    return;
  }

  setPseudoFullscreen(true);
}

fullscreenButton.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenButton);
document.addEventListener("webkitfullscreenchange", syncFullscreenButton);

// The address after # decides what shows
function route() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("play=")) {
    const id = decodeURIComponent(hash.slice(5));
    const game = games.find(function (g) { return slug(g) === id; });
    if (game) {
      openPlayer(game);
      return;
    }
  }
  closePlayer();
}

window.addEventListener("hashchange", route);

// ----- Secret door -----
function openExtensions() {
  const list = $("ext-list");
  list.replaceChildren();
  extensions.forEach(function (item) {
    const row = el("div", "row");
    const info = el("div");
    info.append(el("h3", null, item.name), el("p", null, item.description));

    const button = el("a", "button", "Download");
    button.href = item.file;
    button.setAttribute("download", "");

    row.append(info, button);
    list.appendChild(row);
  });
  if (!ext.open) ext.showModal();
}

$("ext-close").addEventListener("click", function () { ext.close(); });
ext.addEventListener("click", function (event) {
  if (event.target === ext) ext.close();
});

// Way 1 (keyboard): a famous cheat code
const door = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let step = 0;

document.addEventListener("keydown", function (event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  step = key === door[step] ? step + 1 : (key === door[0] ? 1 : 0);
  if (step === door.length) {
    step = 0;
    openExtensions();
  }

  // Press / to jump to the search box
  const typing = document.activeElement && /input|textarea/i.test(document.activeElement.tagName);
  if (event.key === "/" && !typing && player.hidden && !ext.open && !editor.open) {
    event.preventDefault();
    search.focus();
  }
  // Escape closes the topmost thing: a chat window first, then the game
  if (event.key === "Escape" && !player.hidden && !document.querySelector("dialog[open]")) {
    if (player.classList.contains("pseudo-fullscreen")) {
      setPseudoFullscreen(false);
      return;
    }
    if (!document.fullscreenElement) location.hash = "";
  }
});

// Way 2 (phone): tap the year in the footer 7 times
let taps = 0;
let tapTimer;
$("year").textContent = new Date().getFullYear();
$("year").addEventListener("click", function () {
  taps++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(function () { taps = 0; }, 3000);
  if (taps >= 7) {
    taps = 0;
    openExtensions();
  }
});

// ----- Code lock -----
function syncAdmin() {
  $("add-game").hidden = !admin;
  $("lock").hidden = !admin;
  $("code-form").hidden = admin;
}

function setAdmin(on) {
  admin = on;
  sessionStorage.setItem("damp-admin", on ? "1" : "0");
  syncAdmin();
  showGames();
}

$("code-form").addEventListener("submit", function (event) {
  event.preventDefault();
  const ok = $("code").value === ADMIN_CODE;
  $("code").value = "";
  $("code-msg").textContent = ok ? "" : "Wrong code.";
  if (ok) {
    setAdmin(true);
    ext.close();
  }
});

$("lock").addEventListener("click", function () {
  setAdmin(false);
  ext.close();
});

// ----- Game editor (saves straight to GitHub) -----
let conn = { repo: "", token: "" };

function say(text, bad) {
  $("status").textContent = text;
  $("status").className = bad ? "note bad" : "note";
}

function guessRepo() {
  const owner = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : "";
  const name = location.pathname.split("/")[1] || "";
  return owner && name && !name.includes(".") ? owner + "/" + name : "";
}

function openEditor(game) {
  editing = game || null;
  $("editor-title").textContent = game ? "Edit game" : "Add a game";
  $("save").textContent = game ? "Save changes" : "Add game";
  $("remove").hidden = !game;
  $("f-hidden").checked = !!(game && game.hidden);
  $("f-board").checked = !!(game && game.board);
  $("f-party").checked = !!(game && game.party);
  $("f-title").value = game ? game.title : "";
  $("f-category").value = game && game.category ? game.category : "";
  $("f-desc").value = game && game.description ? game.description : "";
  $("f-file").value = "";
  $("f-icon").value = "";
  updateFileInfo();
  $("f-repo").value = localStorage.getItem("damp-repo") || guessRepo();
  $("f-token").value = localStorage.getItem("damp-token") || "";
  $("conn").open = !$("f-token").value;
  $("categories").replaceChildren(...categories(games).map(function (name) {
    const option = el("option");
    option.value = name;
    return option;
  }));
  say("");
  editor.showModal();
}

// Shows which files are set now, and which new ones are picked
let previewUrl = null;

function updateFileInfo() {
  const htmlFile = $("f-file").files[0];
  const iconFile = $("f-icon").files[0];
  const html = editing ? editing.file : "";
  const icon = editing && editing.image ? editing.image : "";

  $("f-file-name").textContent = htmlFile ? htmlFile.name : (html || "No file chosen");
  $("f-icon-name").textContent = iconFile ? iconFile.name : (icon || "No file chosen");

  const preview = $("f-icon-preview");
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  if (iconFile) {
    previewUrl = URL.createObjectURL(iconFile);
    preview.src = previewUrl;
    preview.hidden = false;
  } else if (icon) {
    preview.src = encodeURI(icon);
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }
}

$("f-icon-preview").addEventListener("error", function () { $("f-icon-preview").hidden = true; });
$("f-file").addEventListener("change", updateFileInfo);
$("f-icon").addEventListener("change", updateFileInfo);

$("add-game").addEventListener("click", function () { openEditor(null); });
$("editor-close").addEventListener("click", function () { editor.close(); });

function toBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () { resolve(reader.result.split(",")[1]); };
    reader.onerror = function () { reject(new Error("Couldn't read " + file.name)); };
    reader.readAsDataURL(file);
  });
}

function textToBase64(text) {
  let binary = "";
  new TextEncoder().encode(text).forEach(function (byte) { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToText(data) {
  const binary = atob(data.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, function (c) { return c.charCodeAt(0); }));
}

function endpoint(path) {
  return "https://api.github.com/repos/" + conn.repo + "/contents/" + encodeURI(path);
}

function authHeaders() {
  return { Authorization: "Bearer " + conn.token, Accept: "application/vnd.github+json" };
}

async function problem(res) {
  if (res.status === 401) return "GitHub rejected the token.";
  if (res.status === 403 || res.status === 404) {
    return "No access to that repository. Check its name, and that the token has Contents read and write.";
  }
  let message = "";
  try { message = (await res.json()).message; } catch (error) { /* no details */ }
  return "GitHub said " + res.status + (message ? ": " + message : "");
}

// Returns the file's info (including its version id), or null if it doesn't exist yet
async function currentFile(path) {
  const res = await fetch(endpoint(path), { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await problem(res));
  return res.json();
}

async function upload(path, base64, message) {
  const old = await currentFile(path);
  const body = { message: message, content: base64 };
  if (old) body.sha = old.sha;
  const res = await fetch(endpoint(path), {
    method: "PUT",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await problem(res));
}

async function removeFile(path, message) {
  const old = await currentFile(path);
  if (!old) return;
  const res = await fetch(endpoint(path), {
    method: "DELETE",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
    body: JSON.stringify({ message: message, sha: old.sha })
  });
  if (!res.ok) throw new Error(await problem(res));
}

$("remove").addEventListener("click", async function () {
  if (!editing) return;
  conn = { repo: $("f-repo").value.trim(), token: $("f-token").value.trim() };
  if (!conn.repo || !conn.token) {
    $("conn").open = true;
    return say("Add the repository and the token first.", true);
  }
  if (!confirm('Remove "' + editing.title + '"? Its files are deleted from GitHub too.')) return;

  const gone = editing;
  $("save").disabled = true;
  $("remove").disabled = true;
  try {
    say("Updating the games list...");
    const listFile = await currentFile("games.json");
    const list = (listFile ? JSON.parse(base64ToText(listFile.content)) : games.slice())
      .filter(function (g) { return g.file !== gone.file; });
    await upload("games.json", textToBase64(JSON.stringify(list, null, 2) + "\n"), "Remove game: " + gone.title);
    games = list;
    showChips();
    showGames();

    // Delete the game's own files, but never the site's files or a picture another game still uses
    const keep = ["index.html", "404.html", "style.css", "script.js", "accounts.js", "games.json"];
    const paths = [gone.file, gone.image].filter(function (path) {
      return path && !path.includes("..") && !keep.includes(path.toLowerCase()) &&
        !list.some(function (g) { return g.file === path || g.image === path; });
    });
    for (const path of paths) {
      say("Deleting " + path + "...");
      await removeFile(path, "Delete " + path);
    }
    editing = null;
    editor.close();
  } catch (error) {
    say(error.message, true);
  }
  $("save").disabled = false;
  $("remove").disabled = false;
});

$("editor-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const title = $("f-title").value.trim();
  const htmlFile = $("f-file").files[0];
  const iconFile = $("f-icon").files[0];
  conn = { repo: $("f-repo").value.trim(), token: $("f-token").value.trim() };

  if (!title) return say("Add a title.", true);
  if (!editing && !htmlFile) return say("Pick the game's .html file.", true);
  if (!conn.repo || !conn.token) {
    $("conn").open = true;
    return say("Add the repository and the token first.", true);
  }
  const taken = games.some(function (g) { return g !== editing && g.title.toLowerCase() === title.toLowerCase(); });
  if (taken) return say("A game with that title already exists.", true);

  let iconType = "";
  if (iconFile) {
    iconType = iconFile.name.split(".").pop().toLowerCase();
    if (!["png", "jpg", "jpeg", "webp", "gif"].includes(iconType)) {
      return say("The icon must be png, jpg, webp or gif.", true);
    }
  }

  // File names never clash with the site's own files
  let base = slugText(title) || "game";
  if (base === "index" || base === "404") base += "-game";

  const entry = {
    title: title,
    description: $("f-desc").value.trim(),
    file: editing ? editing.file : "games/" + base + ".html",
    category: $("f-category").value.trim(),
    image: iconFile ? "img/" + base + "." + iconType : (editing ? editing.image || "" : "")
  };
  if (editing && editing.featured) entry.featured = true;
  if ($("f-hidden").checked) entry.hidden = true;
  if ($("f-board").checked) entry.board = true;
  if ($("f-party").checked) entry.party = true;

  $("save").disabled = true;
  try {
    if (htmlFile) {
      say("Uploading the game...");
      await upload(entry.file, await toBase64(htmlFile), "Add game file: " + title);
    }
    if (iconFile) {
      say("Uploading the icon...");
      await upload(entry.image, await toBase64(iconFile), "Add icon: " + title);
    }

    say("Updating the games list...");
    const listFile = await currentFile("games.json");
    const list = listFile ? JSON.parse(base64ToText(listFile.content)) : games.slice();
    const at = editing ? list.findIndex(function (g) { return g.file === editing.file; }) : -1;
    ["description", "category", "image"].forEach(function (key) { if (!entry[key]) delete entry[key]; });
    if (at >= 0) list[at] = entry; else list.push(entry);
    await upload("games.json", textToBase64(JSON.stringify(list, null, 2) + "\n"), "Update games list: " + title);

    localStorage.setItem("damp-repo", conn.repo);
    localStorage.setItem("damp-token", conn.token);
    games = list;
    editing = entry;
    $("f-file").value = "";
    $("f-icon").value = "";
    updateFileInfo();
    showChips();
    showGames();
    say(entry.hidden
      ? "Saved, and hidden. It stays off the page until you edit it and untick Hide; its link still plays."
      : "Saved. It goes live for everyone in about a minute.");
  } catch (error) {
    say(error.message, true);
  }
  $("save").disabled = false;
});

// ----- Language: one default for the games -----
const LANGUAGE_KEY = "damp.lang";
const LANGUAGE_GAMES = new Set(["battleship", "hedgerow-hallow", "ordle", "wildwood", "wildwood-3d"]);
let playerLanguageReady = false;

function browserLanguage() {
  return (navigator.language || "en").toLowerCase().indexOf("da") === 0 ? "da" : "en";
}

function preferredLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === "da" || saved === "en") return saved;
  } catch (error) { /* storage off */ }
  return browserLanguage();
}

function savedStringLanguage(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved === "da" || saved === "en" ? saved : "";
  } catch (error) { return ""; }
}

function savedJsonLanguage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return "";
    const saved = JSON.parse(raw);
    return saved && (saved.lang === "da" || saved.lang === "en") ? saved.lang : "";
  } catch (error) { return ""; }
}

function gameLanguage(id) {
  let saved = "";
  if (id === "battleship") saved = savedStringLanguage("bs-lang");
  else if (id === "hedgerow-hallow") saved = savedJsonLanguage("hedgerow-hollow-v1");
  else if (id === "ordle") saved = savedJsonLanguage("ordle-set");
  else if (id === "wildwood") saved = savedJsonLanguage("wildwood-v1");
  else if (id === "wildwood-3d") saved = savedJsonLanguage("wildwood3d-v1");
  return saved || preferredLanguage();
}

// Game saves are plain JSON. Only the language field is touched here.
function updateSavedLanguage(key, language) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
    saved.lang = language;
    localStorage.setItem(key, JSON.stringify(saved));
  } catch (error) { /* storage or save format unavailable */ }
}

function syncSwitch(group, language, disabled) {
  if (!group) return;
  group.classList.toggle("is-loading", Boolean(disabled));
  group.querySelectorAll("button").forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === language));
    button.disabled = Boolean(disabled);
  });
}

function syncLanguageControls() {
  syncSwitch(document.querySelector(".header-language"), preferredLanguage(), false);
  const group = $("player-language");
  if (!playing || !LANGUAGE_GAMES.has(playing) || player.hidden) {
    group.hidden = true;
    return;
  }
  group.hidden = false;
  syncSwitch(group, gameLanguage(playing), !playerLanguageReady);
}

function setGlobalLanguage(language) {
  const next = language === "da" ? "da" : "en";
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
    localStorage.setItem("bs-lang", next);
  } catch (error) { /* storage off */ }
  updateSavedLanguage("hedgerow-hollow-v1", next);
  updateSavedLanguage("ordle-set", next);
  updateSavedLanguage("wildwood-v1", next);
  updateSavedLanguage("wildwood3d-v1", next);
  syncLanguageControls();
}

// Use the game's own language control, so the current game changes without a reload.
function clickGameLanguage(language) {
  if (!playing) return false;
  let doc;
  try { doc = frame.contentDocument; } catch (error) { return false; }
  if (!doc) return false;

  if (playing === "battleship") {
    const button = doc.getElementById(language === "da" ? "lDa" : "lEn");
    if (!button) return false;
    button.click();
    return true;
  }

  if (playing === "hedgerow-hallow") {
    const button = doc.getElementById(language === "da" ? "langDa" : "langEn");
    if (!button) return false;
    button.click();
    return true;
  }

  if (playing === "wildwood" || playing === "wildwood-3d") {
    const button = doc.getElementById(language === "da" ? "langDa" : "langEn");
    if (!button) return false;
    button.click();
    return true;
  }

  if (playing === "ordle") {
    const settingsButton = doc.getElementById("sb");
    if (!settingsButton) return false;
    settingsButton.click();
    const label = language === "da" ? "Dansk" : "English";
    const button = Array.prototype.find.call(doc.querySelectorAll("#langs button"), function (option) {
      return option.getAttribute("aria-label") === label;
    });
    const panel = doc.getElementById("set");
    if (!button) {
      if (panel) panel.style.display = "none";
      return false;
    }
    button.click();
    if (panel) panel.style.display = "none";
    return true;
  }

  return false;
}

function setPlayerLanguage(language) {
  if (!playing || player.hidden) return;
  clickGameLanguage(language);
  setGlobalLanguage(language);
  syncLanguageControls();
}

document.querySelectorAll(".header-language button").forEach(function (button) {
  button.addEventListener("click", function () { setGlobalLanguage(button.dataset.lang); });
});

document.querySelectorAll(".player-language button").forEach(function (button) {
  button.addEventListener("click", function () { setPlayerLanguage(button.dataset.lang); });
});

window.addEventListener("storage", function (event) {
  if (event.key === LANGUAGE_KEY || event.key === "bs-lang" || event.key === "ordle-set" || event.key === "hedgerow-hollow-v1") {
    syncLanguageControls();
  }
});

syncLanguageControls();

// ----- Start -----
async function start() {
  try {
    const res = await fetch("games.json", { cache: "no-store" });
    games = await res.json();
  } catch (error) {
    loadFailed = true;
  }
  let savedSort = "default";
  try { savedSort = localStorage.getItem("damp-sort") || "default"; } catch (error) { /* storage off */ }
  $("sort").value = ["default", "newest", "az"].includes(savedSort) ? savedSort : "default";
  syncAdmin();
  showChips();
  showGames();
  route();
}

start();
