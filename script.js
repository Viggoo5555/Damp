// ---------------------------------------------------------------
// Your games are listed in games.json (the secret editor on the
// site adds to it for you).
//
// YOUR EXTENSIONS (shown only inside the secret window)
// The file must match the zip name in the repository exactly.
// ---------------------------------------------------------------
const extensions = [
  { name: "Emat Hjælper", description: "Chrome extension for emat.", file: "emat-svar.zip" },
  { name: "Grammatik Hjælper", description: "Chrome extension for grammatip.", file: "grammatik-hjaelper.zip" },
];

const ADMIN_CODE = "1203";

// ---------------------------------------------------------------
// Everything below builds the page. You don't need to change it.
// ---------------------------------------------------------------
const $ = function (id) { return document.getElementById(id); };

const grid = $("games-grid");
const search = $("search");
const chips = $("chips");
const player = $("player");
const frame = $("player-frame");
const ext = $("ext");
const editor = $("editor");

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

function categories() {
  const list = [];
  games.forEach(function (game) {
    if (game.category && !list.includes(game.category)) list.push(game.category);
  });
  return list;
}

// ----- Games -----
function makeCard(game) {
  const item = el("div", "item");
  const card = el("a", "game");
  card.href = "#play=" + slug(game);
  card.title = game.description || "";

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
    img.addEventListener("error", function () { img.remove(); letterTile(); });
    tile.appendChild(img);
  } else {
    letterTile();
  }

  card.append(tile, el("h3", null, game.title), el("p", null, game.category || "Game"));
  item.appendChild(card);

  if (admin) {
    const edit = el("button", "edit", "Edit");
    edit.type = "button";
    edit.addEventListener("click", function () { openEditor(game); });
    item.appendChild(edit);
  }
  return item;
}

function showGames() {
  const query = search.value.trim().toLowerCase();

  const list = games.filter(function (game) {
    const inCategory = category === "All" || game.category === category;
    const words = (game.title + " " + (game.description || "") + " " + (game.category || "")).toLowerCase();
    return inCategory && words.includes(query);
  });

  if ($("sort").value === "newest") {
    list.reverse();
  } else if ($("sort").value === "az") {
    list.sort(function (a, b) { return a.title.localeCompare(b.title); });
  }

  grid.replaceChildren(...list.map(makeCard));
  $("heading").textContent = category === "All" ? "All games" : category;
  $("count").textContent = list.length + (list.length === 1 ? " game" : " games");

  if (loadFailed) {
    $("empty").textContent = "The games list didn't load. Open the site through its web address.";
  } else {
    $("empty").textContent = games.length === 0 ? "No games yet. Check back soon." : "No games match your search.";
  }
  $("empty").hidden = list.length > 0;
  showShelf();
}

function showChips() {
  chips.replaceChildren();
  const names = ["All"].concat(categories());
  if (!names.includes(category)) category = "All";
  chips.hidden = names.length < 3;

  names.forEach(function (name) {
    const chip = el("button", "chip", name);
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

$("random").addEventListener("click", function () {
  if (games.length === 0) return;
  location.hash = "play=" + slug(games[Math.floor(Math.random() * games.length)]);
});

// ----- Recently played (remembered on this device) -----
function getRecent() {
  try { return JSON.parse(localStorage.getItem("damp-recent")) || []; } catch (error) { return []; }
}

function recentGames() {
  return getRecent().filter(function (id) { return games.some(function (g) { return slug(g) === id; }); });
}

function addRecent(game) {
  const id = slug(game);
  const list = getRecent().filter(function (other) { return other !== id; });
  list.unshift(id);
  try { localStorage.setItem("damp-recent", JSON.stringify(list.slice(0, 12))); } catch (error) { /* storage off */ }
}

// The row right above "All games"
function showShelf() {
  const picks = recentGames().slice(0, 6).map(function (id) {
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

// ----- Loading screen (only appears if the game is slow) -----
let slowTimer, hintTimer;

function startLoading() {
  stopLoading();
  slowTimer = setTimeout(function () {
    $("loading-text").textContent = "Loading game...";
    $("loading").hidden = false;
  }, 700);
  hintTimer = setTimeout(function () {
    $("loading-text").textContent = "Still loading. If it stays stuck, try Open in new tab at the top.";
  }, 10000);
}

function stopLoading() {
  clearTimeout(slowTimer);
  clearTimeout(hintTimer);
  $("loading").hidden = true;
}

frame.addEventListener("load", stopLoading);

// ----- Game player -----
function openPlayer(game) {
  if (playing !== slug(game)) {
    playing = slug(game);
    frame.src = encodeURI(game.file);
    startLoading();
    addRecent(game);
  }
  $("player-title").textContent = game.title;
  $("player-newtab").href = encodeURI(game.file);
  player.hidden = false;
  document.body.classList.add("locked");
}

function closePlayer() {
  if (player.hidden) return;
  if (document.fullscreenElement) document.exitFullscreen();
  frame.src = "about:blank";
  playing = "";
  stopLoading();
  player.hidden = true;
  document.body.classList.remove("locked");
  showChips();
  showGames();
}

$("player-close").addEventListener("click", function () { location.hash = ""; });

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

$("player-fullscreen").addEventListener("click", function () {
  if (frame.requestFullscreen) frame.requestFullscreen();
});

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
  if (event.key === "Escape" && !player.hidden && !document.fullscreenElement) {
    location.hash = "";
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
  $("f-title").value = game ? game.title : "";
  $("f-category").value = game && game.category ? game.category : "";
  $("f-desc").value = game && game.description ? game.description : "";
  $("f-file").value = "";
  $("f-icon").value = "";
  $("f-repo").value = localStorage.getItem("damp-repo") || guessRepo();
  $("f-token").value = localStorage.getItem("damp-token") || "";
  $("conn").open = !$("f-token").value;
  $("categories").replaceChildren(...categories().map(function (name) {
    const option = el("option");
    option.value = name;
    return option;
  }));
  say("");
  editor.showModal();
}

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
    const keep = ["index.html", "404.html", "style.css", "script.js", "games.json"];
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
    file: editing ? editing.file : base + ".html",
    category: $("f-category").value.trim(),
    image: iconFile ? base + "." + iconType : (editing ? editing.image || "" : "")
  };

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
    showChips();
    showGames();
    say("Saved. It goes live for everyone in about a minute.");
  } catch (error) {
    say(error.message, true);
  }
  $("save").disabled = false;
});

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
