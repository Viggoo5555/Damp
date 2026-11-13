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

## The games

| Game | File | What it is |
| --- | --- | --- |
| Kryds & Bolle 3D | `games/kryds-bolle-3d.html` | marble-and-brass three in a row, vs computer or two players |
| Brick Blast | `games/brick-blast.html` | brick breaker with paddle and ball power-ups |
| River Hop | `games/river-hop.html` | cross traffic and floating logs to reach the lily pads |

The three newest games share the language layer in `lang.js`, which adds the
English/Danish pill and remembers the choice across the site.
