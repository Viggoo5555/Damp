// GET /api/leaderboard?game=flappy|ordle&mode=all|week
// Returns { game, mode, week, rows:[{id,name,score}], at }
//
// Reads the top 10 through the Firestore REST API, so the game can get the board
// as one small JSON request instead of loading the whole Firebase JS SDK.
// If a KV namespace is bound as LEADERBOARD it is used as a 60 second cache.

const PROJECT = 'damp-2406a';
// Games allowed through this route, and the collection each one reads
const GAMES = { flappy: 'flappy', ordle: 'ordle' };
// The public web API key. It already ships inside the site's own JavaScript,
// and env.FIREBASE_API_KEY overrides it if you set one.
const DEFAULT_KEY = 'AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w';

// Monday-based week id, matching the one the game uses
function weekKey(date) {
  const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  return y + '-W' + String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0');
}

function score(field) {
  if (!field) return 0;
  if (field.integerValue != null) return Number(field.integerValue);
  if (field.doubleValue != null) return Math.round(Number(field.doubleValue));
  return 0;
}

function reply(body, maxAge, status) {
  return new Response(body, {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? 'public, max-age=' + maxAge + ', s-maxage=30' : 'no-store'
    }
  });
}

export async function onRequestGet({ request, env, waitUntil }) {
  const params = new URL(request.url).searchParams;
  const mode = params.get('mode') === 'week' ? 'week' : 'all';
  const game = GAMES[params.get('game')] || 'flappy';
  const week = weekKey(new Date());
  const cacheKey = 'lb:' + game + ':' + mode + ':' + week;
  const kv = env.LEADERBOARD;

  if (kv) {
    const hit = await kv.get(cacheKey);
    if (hit) return reply(hit, 15);
  }

  const key = env.FIREBASE_API_KEY || DEFAULT_KEY;
  const path = mode === 'week' ? game + '_week/' + week + '/scores' : game;
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/' + path +
    '?pageSize=10&orderBy=' + encodeURIComponent('score desc') + '&key=' + key;

  let res;
  try {
    res = await fetch(url);
  } catch (error) {
    return reply(JSON.stringify({ error: 'network' }), 0, 502);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch (error) { /* no body */ }
    return reply(JSON.stringify({ error: 'upstream', status: res.status, detail: detail }), 0, 502);
  }

  let data;
  try {
    data = await res.json();
  } catch (error) {
    return reply(JSON.stringify({ error: 'bad json' }), 0, 502);
  }

  const rows = (data.documents || []).map(function (doc) {
    const fields = doc.fields || {};
    return {
      id: doc.name.slice(doc.name.lastIndexOf('/') + 1),
      name: (fields.name && fields.name.stringValue) || 'player',
      score: score(fields.score)
    };
  });

  const body = JSON.stringify({ game: game, mode: mode, week: week, rows: rows, at: Date.now() });
  if (kv && waitUntil) waitUntil(kv.put(cacheKey, body, { expirationTtl: 60 }));
  return reply(body, 15);
}
