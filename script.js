// ---------------------------------------------------------------
// 1. YOUR GAMES
// Each game is one .html file in the main folder of the repository.
// To add a game: upload the file, then add a line like this:
//   { title: "Snake", description: "Classic snake game.", file: "snake.html" },
// Optional: add  image: "snake.png"  to use a picture instead of the colored tile.
// ---------------------------------------------------------------
const games = [
  // { title: "Snake", description: "Classic snake game.", file: "snake.html" },
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
const gamesGrid = document.getElementById("games-grid");
const extensionsList = document.getElementById("extensions-list");
const player = document.getElementById("player");
const playerFrame = document.getElementById("player-frame");
const playerTitle = document.getElementById("player-title");
const playerNewTab = document.getElementById("player-newtab");

// Gives each game its own tile color, based on its title
function hueFrom(text) {
  let hue = 0;
  for (const char of text) {
    hue = (hue * 31 + char.charCodeAt(0)) % 360;
  }
  return hue;
}

function showGames() {
  if (games.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No games yet. Check back soon.";
    gamesGrid.replaceWith(empty);
    return;
  }

  games.forEach(function (game) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "game";

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
    card.addEventListener("click", function () {
      openGame(game);
    });
    gamesGrid.appendChild(card);
  });
}

function showExtensions() {
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
    extensionsList.appendChild(row);
  });
}

function openGame(game) {
  playerTitle.textContent = game.title;
  playerNewTab.href = game.file;
  playerFrame.src = game.file;
  player.hidden = false;
  document.body.classList.add("locked");
  playerFrame.focus();
}

function closeGame() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  playerFrame.src = "about:blank";
  player.hidden = true;
  document.body.classList.remove("locked");
}

document.getElementById("player-close").addEventListener("click", closeGame);

document.getElementById("player-fullscreen").addEventListener("click", function () {
  if (playerFrame.requestFullscreen) {
    playerFrame.requestFullscreen();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && !player.hidden && !document.fullscreenElement) {
    closeGame();
  }
});

showGames();
showExtensions();
