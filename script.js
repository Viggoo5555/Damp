// ---------------------------------------------------------------
// 1. YOUR GAMES
// Each game is one .html file in the main folder of the repository.
// To add a game: upload the file, then add a line like this:
//   { title: "Snake", description: "Classic snake game.", file: "snake.html", category: "Arcade" },
// "category" is optional. Games with the same category are grouped
// under one filter button at the top of the page.
// Optional: add  image: "snake.png"  to use a picture instead of the colored tile.
// ---------------------------------------------------------------
const games = [
  { title: "Flappy Bird", description: "Classic arcade bird game with custom skins and worlds shop.", file: "Flappy Bird.html", category: "Arcade" },
  { title: "Snake", description: "Eat food, grow longer, and avoid hitting the walls or yourself.", file: "snake.html", category: "Arcade" },
  { title: "Pong", description: "Retro table tennis arcade game. Beat the AI!", file: "pong.html", category: "Arcade" },
  { title: "Tic-Tac-Toe", description: "Classic 3-in-a-row strategy game against a friend.", file: "tictactoe.html", category: "Puzzle" }
];

// ---------------------------------------------------------------
// 2. YOUR EXTENSIONS
// The file must match the zip name in the repository exactly.
// ---------------------------------------------------------------
const extensions = [
  { name: "Emat Hjælper", description: "Chrome extension for emat.", file: "emat-svar.zip" },
  { name: "Grammatik Hjælper", description: "Chrome extension for grammatip.", file: "grammatik-hjaelper.zip" },
];

// ---------------------------------------------------------------
// Everything below builds the page. You don't need to change it.
// ---------------------------------------------------------------
const $ = function (id) { return document.getElementById(id); };

const viewGames = $("view-games");
const viewExtensions = $("view-extensions");
const gamesGrid = $("games-grid");
const search = $("search");
const chips = $("chips");
const count = $("count");
const empty = $("empty");
const player = $("player");
const playerFrame = $("player-frame");

let activeCategory = "All";

// A game's link name: "snake.html" becomes "snake"
function idOf(game) {
  return game.file.replace(/\.html?$/i, "");
}

// Gives each game its own tile color, based on its title
function hueFrom(text) {
  let hue = 0;
  for (const char of text) {
    hue = (hue * 31 + char.charCodeAt(0)) % 360;
  }
  return hue;
}

// ----- Games -----
function makeCard(game) {
  const card = document.createElement("a");
  card.className = "game";
  card.href = "#play=" + encodeURIComponent(idOf(game));

  const tile = document.createElement("div");
  tile.className = "tile";
  if (game.image) {
    const img = document.createElement("img");
    img.src = game.image;
    img.alt = "";
    tile.appendChild(img);
  } else {
    tile.style.setProperty("--hue", hueFrom(game.title));
    tile.textContent = game.title.charAt(0).toUpperCase();
  }

  const name = document.createElement("h3");
  name.textContent = game.title;

  const text = document.createElement("p");
  text.textContent = game.description || "";

  card.append(tile, name, text);
  return card;
}

function showGames() {
  const query = search.value.trim().toLowerCase();

  const list = games.filter(function (game) {
    const inCategory = activeCategory === "All" || game.category === activeCategory;
    const words = (game.title + " " + (game.description || "") + " " + (game.category || "")).toLowerCase();
    return inCategory && words.includes(query);
  });

  gamesGrid.replaceChildren(...list.map(makeCard));

  if (games.length === 0) {
    $("toolbar").hidden = true;
    count.textContent = "";
    empty.textContent = "No games yet. Check back soon.";
    empty.hidden = false;
  } else if (list.length === 0) {
    count.textContent = "";
    empty.textContent = "No games match your search.";
    empty.hidden = false;
  } else {
    count.textContent = list.length + (list.length === 1 ? " game" : " games");
    empty.hidden = true;
  }
}

function showChips() {
  const categories = [];
  games.forEach(function (game) {
    if (game.category && !categories.includes(game.category)) {
      categories.push(game.category);
    }
  });

  chips.hidden = categories.length < 2;

  ["All"].concat(categories).forEach(function (name) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = name;
    chip.setAttribute("aria-pressed", name === activeCategory);
    chip.addEventListener("click", function () {
      activeCategory = name;
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
  const game = games[Math.floor(Math.random() * games.length)];
  location.hash = "play=" + encodeURIComponent(idOf(game));
});

// Press / to jump to the search box
document.addEventListener("keydown", function (event) {
  const typing = document.activeElement && /input|textarea/i.test(document.activeElement.tagName);
  if (event.key === "/" && !typing && player.hidden && !viewGames.hidden) {
    event.preventDefault();
    search.focus();
  }
  if (event.key === "Escape" && !player.hidden && !document.fullscreenElement) {
    location.hash = "games";
  }
});

// ----- Extensions -----
function showExtensions() {
  const list = $("extensions-list");
  extensions.forEach(function (ext) {
    const row = document.createElement("div");
    row.className = "row";

    const info = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = ext.name;
    const text = document.createElement("p");
    text.textContent = ext.description;
    info.append(name, text);

    const button = document.createElement("a");
    button.className = "button";
    button.href = ext.file;
    button.setAttribute("download", "");
    button.textContent = "Download";

    row.append(info, button);
    list.appendChild(row);
  });
}

// ----- Game player -----
function openPlayer(game) {
  if (player.hidden || !playerFrame.src.endsWith(game.file)) {
    playerFrame.src = game.file;
  }
  $("player-title").textContent = game.title;
  $("player-newtab").href = game.file;
  player.hidden = false;
  document.body.classList.add("locked");
}

function closePlayer() {
  if (player.hidden) return;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  playerFrame.src = "about:blank";
  player.hidden = true;
  document.body.classList.remove("locked");
}

$("player-close").addEventListener("click", function () {
  location.hash = "games";
});

$("player-fullscreen").addEventListener("click", function () {
  if (playerFrame.requestFullscreen) {
    playerFrame.requestFullscreen();
  }
});

// ----- Pages (the address after # decides what shows) -----
function route() {
  const hash = location.hash.slice(1);

  if (hash.startsWith("play=")) {
    const id = decodeURIComponent(hash.slice(5));
    const game = games.find(function (g) { return idOf(g) === id; });
    if (game) {
      openPlayer(game);
      return;
    }
  }

  closePlayer();
  const page = hash === "extensions" ? "extensions" : "games";
  viewGames.hidden = page !== "games";
  viewExtensions.hidden = page !== "extensions";
  $("tab-games").setAttribute("aria-current", page === "games" ? "page" : "false");
  $("tab-extensions").setAttribute("aria-current", page === "extensions" ? "page" : "false");
}

window.addEventListener("hashchange", route);

showChips();
showGames();
showExtensions();
route();
