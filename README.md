# Damp

Free browser games, served as plain static files.

## Where things are

| Path | What lives there |
| --- | --- |
| `index.html` | the catalogue page (player, search, filters) |
| `style.css` | the site's styling |
| `script.js` | catalogue, player, secret editor |
| `accounts.js` | log in, cloud saves, people and messages |
| `games.json` | the list of games: title, file, image, category |
| `games/` | one HTML file per game |
| `img/` | thumbnails shown on the catalogue tiles |
| `files/` | downloadable extensions (secret window) |
| `worker.js` | the Worker: serves `/api/leaderboard`, hands the rest to the static files |
| `wrangler.jsonc` | Worker config: name, entry point, assets folder |
| `.assetsignore` | keeps source files out of the public assets |
| `firestore.rules` | the rules to paste into Firebase |

## Adding a game

Put the game in `games/`, its picture in `img/`, then add an entry to
`games.json`. The secret editor on the site does all three for you.

Paths in `games.json` are relative to the site root, so they always start
with `games/` or `img/`.

## Battleship (`games/battleship.html`)

One self-contained file: its own small WebGL engine, no libraries. 3D top-down
board, ships are dragged into place, camera swoops in on every shot.

- **Vs computer**: Rookie / Admiral.
- **Online**: needs a logged-in account (same Firebase as the rest of the site).
  The host gets a room (`rooms/B....`, uses the existing `rooms` rules), picks a
  friend and the invite goes out as an ordinary chat message with a link
  `.../games/battleship.html?room=CODE`. Opening it joins the room. The game
  itself runs peer-to-peer over WebRTC; fleets are committed with a SHA-256 hash
  and revealed at the end so cheating is detected.
- No Firestore rule changes are needed. `accounts.js` turns links to this site
  inside chat messages into clickable links.
