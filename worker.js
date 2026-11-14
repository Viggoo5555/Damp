// Entry point for the Cloudflare Worker behind dampgames.dk.
// Static files come from this folder (see wrangler.jsonc). Requests that do
// not match a file fall through to the Worker, which only handles the
// leaderboard API; everything else is handed back to the asset server.
//
// GET /api/leaderboard?mode=all|week
// Returns { mode, week, rows:[{id,name,score}], at }
//
// Reads the top 10 through the Firestore REST API, so the game can get the board
// as one small JSON request instead of loading the whole Firebase JS SDK.
// If a KV namespace is bound as LEADERBOARD it is used as a 60 second cache.

const PROJECT = 'damp-2406a';
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

async function leaderboard(request, env, waitUntil) {
  const mode = new URL(request.url).searchParams.get('mode') === 'week' ? 'week' : 'all';
  const week = weekKey(new Date());
  const cacheKey = 'lb:' + mode + ':' + week;
  const kv = env.LEADERBOARD;

  if (kv) {
    const hit = await kv.get(cacheKey);
    if (hit) return reply(hit, 15);
  }

  const key = env.FIREBASE_API_KEY || DEFAULT_KEY;
  const path = mode === 'week' ? 'flappy_week/' + week + '/scores' : 'flappy';
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

  const body = JSON.stringify({ mode: mode, week: week, rows: rows, at: Date.now() });
  if (kv && waitUntil) waitUntil(kv.put(cacheKey, body, { expirationTtl: 60 }));
  return reply(body, 15);
}

// One WebSocket room. Two players meet here instead of over WebRTC, so the
// game works on school and office networks that block peer-to-peer traffic:
// everything travels over ordinary HTTPS to this same domain.
export class Room {
  constructor(state) {
    this.state = state;
    this.host = null;
    this.guest = null;
  }

  announce() {
    if (!this.host || !this.guest) return;
    for (const socket of [this.host, this.guest]) {
      try { socket.send(JSON.stringify({ t: 'peer' })); } catch (error) { /* gone */ }
    }
  }

  async fetch(request) {
    const role = new URL(request.url).searchParams.get('role') === 'host' ? 'host' : 'guest';
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();

    if (role === 'host') {
      if (this.host) {
        try { server.send(JSON.stringify({ t: 'full' })); } catch (error) { /* gone */ }
        return new Response(null, { status: 101, webSocket: client });
      }
      this.host = server;
    } else {
      if (!this.host) {
        try { server.send(JSON.stringify({ t: 'empty' })); } catch (error) { /* gone */ }
        return new Response(null, { status: 101, webSocket: client });
      }
      if (this.guest) {
        try { server.send(JSON.stringify({ t: 'full' })); } catch (error) { /* gone */ }
        return new Response(null, { status: 101, webSocket: client });
      }
      this.guest = server;
    }

    const peer = () => (role === 'host' ? this.guest : this.host);
    server.addEventListener('message', (event) => {
      const other = peer();
      if (other) { try { other.send(event.data); } catch (error) { /* gone */ } }
    });

    const gone = () => {
      if (role === 'host') this.host = null;
      else this.guest = null;
      const other = peer();
      if (other) { try { other.close(1000, 'peer left'); } catch (error) { /* gone */ } }
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);

    if (this.host && this.guest) this.announce();
    else if (role === 'host') { try { server.send(JSON.stringify({ t: 'waiting' })); } catch (error) { /* gone */ } }

    return new Response(null, { status: 101, webSocket: client });
  }
}

// Google's crawler checks this exact path, so serve it from here instead of
// letting a stale asset or an old cached 404 answer for it.
const ADS_TXT = 'google.com, pub-6851662024546666, DIRECT, f08c47fec0942fa0\n';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/ads.txt') {
      return new Response(request.method === 'HEAD' ? null : ADS_TXT, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=600'
        }
      });
    }
    if (url.pathname === '/api/leaderboard' || url.pathname === '/api/leaderboard/') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
      }
      return leaderboard(request, env, ctx.waitUntil.bind(ctx));
    }
    const room = url.pathname.match(/^\/api\/room\/([A-Z0-9]{3,8})$/);
    if (room && (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      if (!env.ROOMS) return new Response('Rooms are not set up', { status: 503 });
      return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
