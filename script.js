// ---------------------------------------------------------------
// 1. YOUR GAMES
// Each game is one .html file in the main folder of the repository.
// To add a game, upload the file (and a picture), then add a line:
//   { title: "Snake", description: "Classic snake game.", file: "snake.html", category: "Arcade", image: "snake.png" },
// "category" and "image" are optional. Games with the same category
// get one filter button at the top of the page.
// ---------------------------------------------------------------
const games = [
  {
    title: "Flappy Bird",
    description: "Classic arcade bird game with custom skins and worlds shop.",
    file: "Flappy Bird.html",
    category: "Arcade",
    image: "flappy.png"
  },
  {
    title: "Star Clicker",
    description: "Click your star, grow it and add orbiting planets.",
    file: "Starclicker.html",
    category: "Clicker",
    image: "starclicker.png"
  },
  // Ready for when you upload the game file:
  // { title: "Bartender", description: "Mix the perfect cocktail.", file: "bartender.html", category: "Puzzle", image: "bartender.png" },
];

// ---------------------------------------------------------------
// 2. YOUR EXTENSIONS (shown only in the hidden extensions window)
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

const grid = $("games-grid");
const search = $("search");
const chips = $("chips");
const player = $("player");
const frame = $("player-frame");
const ext = $("ext");

let category = "All";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A game's link name: "Star Clicker" becomes "star-clicker"
function slug(game) {
  return game.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Gives each picture-less game its own tile color
function hueFrom(text) {
  let hue = 0;
  for (const char of text) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}

// ----- Games -----
function makeCard(game) {
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
    img.src = game.image;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", function () { img.remove(); letterTile(); });
    tile.appendChild(img);
  } else {
    letterTile();
  }

  card.append(tile, el("h3", null, game.title), el("p", null, game.category || "Game"));
  return card;
}

function showGames() {
  const query = search.value.trim().toLowerCase();

  const list = games.filter(function (game) {
    const inCategory = category === "All" || game.category === category;
    const words = (game.title + " " + (game.description || "") + " " + (game.category || "")).toLowerCase();
    return inCategory && words.includes(query);
  });

  grid.replaceChildren(...list.map(makeCard));
  $("heading").textContent = category === "All" ? "All games" : category;
  $("count").textContent = list.length + (list.length === 1 ? " game" : " games");
  $("empty").hidden = list.length > 0;
}

function showChips() {
  const categories = [];
  games.forEach(function (game) {
    if (game.category && !categories.includes(game.category)) categories.push(game.category);
  });

  chips.hidden = categories.length < 2;

  ["All"].concat(categories).forEach(function (name) {
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

// ----- Game player -----
function openPlayer(game) {
  if (player.hidden) frame.src = encodeURI(game.file);
  $("player-title").textContent = game.title;
  $("player-newtab").href = encodeURI(game.file);
  player.hidden = false;
  document.body.classList.add("locked");
}

function closePlayer() {
  if (player.hidden) return;
  if (document.fullscreenElement) document.exitFullscreen();
  frame.src = "about:blank";
  player.hidden = true;
  document.body.classList.remove("locked");
}

$("player-close").addEventListener("click", function () { location.hash = ""; });

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

// ----- Secret door to the extensions -----
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
  if (event.key === "/" && !typing && player.hidden && !ext.open) {
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

showChips();
showGames();
route();
