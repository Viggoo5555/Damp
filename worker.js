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

// ---------- PolyTrack ----------
// The racing game asks for its board at /api/v6/leaderboard and expects the
// shape Kodub's own server returns: { total, entries, userEntry }. Times live
// in Firestore as milliseconds, so lower is better and rows go `frames asc`.
// games/skals-track/damp.js writes the rows for the signed-in account.
const POLYTRACK_CAR = 'AAQAAAAAAI4AU44AUwAAAA';

// A row should wear the car its player raced, so damp.js sends the paint the
// game keeps in the player's own profile. A car style is 16 bytes written as
// unpadded base64url; anything else would make the game's thumbnail renderer
// throw, so doubtful values fall back to the plain car above.
function polytrackCarStyle(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{20,26}={0,2}$/.test(value)) return null;
  try {
    return atob(value.replace(/-/g, '+').replace(/_/g, '/')).length === 16 ? value : null;
  } catch (error) {
    return null;
  }
}

function polytrackRow(doc, rank) {
  const fields = doc.fields || {};
  return {
    id: rank,
    userId: doc.name.slice(doc.name.lastIndexOf('/') + 1),
    nickname: (fields.name && fields.name.stringValue) || 'player',
    countryCode: null,
    carStyle: polytrackCarStyle(fields.carStyle && fields.carStyle.stringValue) || POLYTRACK_CAR,
    frames: fields.frames && fields.frames.integerValue != null ? Number(fields.frames.integerValue) : 0,
    time: (fields.at && fields.at.timestampValue) || new Date().toISOString(),
    verifiedState: 1
  };
}

async function polytrackCount(parent, key) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT +
    '/databases/(default)/documents:runAggregationQuery?key=' + key;
  const body = JSON.stringify({
    structuredAggregationQuery: {
      structuredQuery: {
        from: [{ collectionId: 'scores' }],
        parent: parent,
        aggregates: [{ alias: 'total', count: {} }]
      }
    }
  });
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body });
    if (!res.ok) return 0;
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : data;
    const value = first && first.result && first.result.aggregateFields && first.result.aggregateFields.total;
    return value && value.integerValue ? Number(value.integerValue) : 0;
  } catch (error) {
    return 0;
  }
}

async function polytrackLeaderboard(request, env) {
  const params = new URL(request.url).searchParams;
  const trackId = (params.get('trackId') || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!trackId) return reply(JSON.stringify({ error: 'trackId' }), 0, 400);

  const amount = Math.min(Math.max(Number(params.get('amount')) || 20, 1), 50);
  const skip = Math.min(Math.max(Number(params.get('skip')) || 0, 0), 200);
  const key = env.FIREBASE_API_KEY || DEFAULT_KEY;
  const parent = 'skalstrack_tracks/' + trackId;
  const docsUrl = 'https://firestore.googleapis.com/v1/projects/' + PROJECT +
    '/databases/(default)/documents/' + parent + '/scores?pageSize=' + Math.min(skip + amount, 250) +
    '&orderBy=' + encodeURIComponent('frames asc') + '&key=' + key;

  let res, total;
  try {
    const pair = await Promise.all([
      fetch(docsUrl),
      polytrackCount('projects/' + PROJECT + '/databases/(default)/documents/' + parent, key)
    ]);
    res = pair[0];
    total = pair[1];
  } catch (error) {
    return reply(JSON.stringify({ error: 'network' }), 0, 502);
  }

  if (!res.ok) return reply(JSON.stringify({ error: 'upstream', status: res.status }), 0, 502);

  let data;
  try {
    data = await res.json();
  } catch (error) {
    return reply(JSON.stringify({ error: 'bad json' }), 0, 502);
  }

  const entries = (data.documents || [])
    .slice(skip)
    .map(function (doc, index) { return polytrackRow(doc, skip + index + 1); });

  return reply(JSON.stringify({ total: total, entries: entries, userEntry: null }), 15);
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

// ---------- PolyTrack multiplayer ----------
// The race itself is peer-to-peer over WebRTC; the server only carries the few
// messages the two sides need to find each other. The game asks its own origin
// for that, at the same /api/v6 prefix as its board:
//
//   wss://<site>/api/v6/multiplayer/host   the host opens a room and is handed
//                                          an invite code to share
//   wss://<site>/api/v6/multiplayer/join   a joiner posts its WebRTC offer
//   GET  /api/v6/iceServers                what to gather addresses with
//
// PolyTrack normally uses Kodub's server for this, which only answers the
// desktop app, so the same small protocol is served here instead: rooms live in
// the Signal Durable Object and every step stays on this domain.

// No TURN relay is configured: the free public ones have shut down, and STUN
// covers most home networks. A TURN server can be added to this list if players
// behind strict NATs ever need one.
const ICE_SERVERS = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];

// Invite codes read over the phone, so the alphabet skips I, O, 0 and 1.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeInviteCode(isTaken) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    let code = '';
    for (const byte of bytes) code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
    if (!isTaken(code)) return code;
  }
  return '';
}

function messageOf(event) {
  try {
    const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
    const message = JSON.parse(text);
    return message && typeof message === 'object' ? message : null;
  } catch (error) {
    return null;
  }
}

function joinInvite(room, session, offer, message) {
  return {
    type: 'joinInvite',
    session: session,
    offer: offer,
    version: typeof message.version === 'string' ? message.version : '0.6.3',
    mods: Array.isArray(message.mods) ? message.mods : [],
    isModsVanillaCompatible: message.isModsVanillaCompatible !== false,
    nickname: typeof message.nickname === 'string' ? message.nickname.slice(0, 32) : 'player',
    countryCode: typeof message.countryCode === 'string' ? message.countryCode.slice(0, 2).toUpperCase() : null,
    carStyle: typeof message.carStyle === 'string' ? message.carStyle : '',
    iceServers: ICE_SERVERS
  };
}

// One relay for every invite. A host socket owns a room and its invite code;
// joiners park their offers in it, and the two sides trade answers and ICE
// candidates until their data channels open. Rooms are in memory only: an
// invite that outlives the game is worthless anyway.
export class Signal {
  constructor(state) {
    this.state = state;
    this.rooms = new Map();
    this.hostRooms = new Map();
    this.joiners = new Map();
  }

  send(socket, message) {
    try { socket.send(JSON.stringify(message)); return true; } catch (error) { return false; }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    if (url.pathname.endsWith('/join')) this.acceptJoiner(server);
    else this.acceptHost(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  acceptHost(socket) {
    socket.addEventListener('message', (event) => {
      const message = messageOf(event);
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'ping') {
        this.send(socket, { type: 'pong' });
        return;
      }
      if (message.type === 'createInvite') {
        this.createInvite(socket, message);
        return;
      }
      const room = this.hostRooms.get(socket);
      if (!room) return;
      const joiner = typeof message.session === 'string' ? room.sessions.get(message.session) : null;
      if (!joiner) return;

      if (message.type === 'acceptJoin') {
        this.send(joiner, {
          type: 'acceptJoin',
          answer: message.answer,
          version: typeof message.version === 'string' ? message.version : '0.6.3',
          mods: Array.isArray(message.mods) ? message.mods : [],
          isModsVanillaCompatible: message.isModsVanillaCompatible !== false,
          clientId: Number.isSafeInteger(message.clientId) && message.clientId > 0 ? message.clientId : 1
        });
      } else if (message.type === 'declineJoin') {
        this.send(joiner, { type: 'declineJoin', reason: typeof message.reason === 'string' ? message.reason : 'Declined' });
        this.forgetJoiner(joiner);
        try { joiner.close(1000, 'declined'); } catch (error) { /* gone already */ }
      } else if (message.type === 'iceCandidate') {
        this.send(joiner, { type: 'iceCandidate', candidate: message.candidate == null ? null : message.candidate });
      }
    });

    const gone = () => this.dropHost(socket);
    socket.addEventListener('close', gone);
    socket.addEventListener('error', gone);
  }

  createInvite(socket, message) {
    let room = this.hostRooms.get(socket);
    if (!room) {
      const code = makeInviteCode((candidate) => this.rooms.has(candidate));
      if (!code) {
        this.send(socket, { type: 'error', error: 'TotalHostLimit' });
        return;
      }
      room = { code: code, key: crypto.randomUUID(), host: socket, sessions: new Map() };
      this.rooms.set(code, room);
      this.hostRooms.set(socket, room);
    }
    this.send(socket, {
      type: 'createInvite',
      inviteCode: room.code,
      key: room.key,
      timeoutMilliseconds: null,
      censoredNickname: typeof message.nickname === 'string' ? message.nickname.slice(0, 32) : null
    });
  }

  dropHost(socket) {
    const room = this.hostRooms.get(socket);
    this.hostRooms.delete(socket);
    if (!room) return;
    this.rooms.delete(room.code);
    for (const joiner of room.sessions.values()) {
      this.send(joiner, { type: 'error', error: 'ExpiredInvite' });
      this.joiners.delete(joiner);
      try { joiner.close(1000, 'host left'); } catch (error) { /* gone already */ }
    }
    room.sessions.clear();
  }

  acceptJoiner(socket) {
    socket.addEventListener('message', (event) => {
      const message = messageOf(event);
      if (!message) return;
      const known = this.joiners.get(socket);

      // After the offer, a joiner only ever sends its own ICE candidates.
      if (known) {
        if ('candidate' in message) {
          this.send(known.room.host, {
            type: 'iceCandidate',
            session: known.session,
            candidate: message.candidate == null ? null : message.candidate
          });
        }
        return;
      }

      if (typeof message.inviteCode !== 'string' || typeof message.offer !== 'string') return;
      const room = this.rooms.get(message.inviteCode.trim().toUpperCase());
      if (!room) {
        this.send(socket, { type: 'error', error: 'ExpiredInvite' });
        try { socket.close(1000, 'expired'); } catch (error) { /* gone already */ }
        return;
      }

      const session = crypto.randomUUID();
      this.joiners.set(socket, { room: room, session: session });
      room.sessions.set(session, socket);
      this.send(room.host, joinInvite(room, session, message.offer, message));
    });

    const gone = () => this.forgetJoiner(socket);
    socket.addEventListener('close', gone);
    socket.addEventListener('error', gone);
  }

  forgetJoiner(socket) {
    const known = this.joiners.get(socket);
    if (!known) return;
    this.joiners.delete(socket);
    known.room.sessions.delete(known.session);
    this.send(known.room.host, { type: 'joinDisconnect', session: known.session });
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
    if (url.pathname === '/api/v6/leaderboard' || url.pathname === '/api/v6/leaderboard/') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
      }
      return polytrackLeaderboard(request, env);
    }
    if (url.pathname === '/api/v6/iceServers' || url.pathname === '/api/v6/iceServers/') {
      return reply(JSON.stringify(ICE_SERVERS), 0);
    }
    // Picking an opponent makes the game fetch their recorded ghost before the
    // race starts. This site keeps the boards in Firestore but has no replay
    // store, so it answers with an empty list: the race starts as a time trial
    // instead of stopping on a "Failed to load recordings" box.
    if (url.pathname === '/api/v6/recordings' || url.pathname === '/api/v6/recordings/') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
      }
      return reply('[]', 0);
    }
    if (/^\/api\/v6\/multiplayer\/(host|join)$/.test(url.pathname)) {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
        return new Response('Expected a WebSocket', { status: 426, headers: { upgrade: 'websocket' } });
      }
      if (!env.SIGNALS) return new Response('Multiplayer is not set up', { status: 503 });
      return env.SIGNALS.get(env.SIGNALS.idFromName('polytrack')).fetch(request);
    }
    const room = url.pathname.match(/^\/api\/room\/([A-Z0-9]{3,8})$/);
    if (room && (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      if (!env.ROOMS) return new Response('Rooms are not set up', { status: 503 });
      return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(request);
    }
    const draw = url.pathname.match(/^\/api\/draw\/([A-Za-z0-9]{4,8})$/);
    if (draw && (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      if (!env.DRAWS) return new Response('Draw rooms are not set up', { status: 503 });
      return env.DRAWS.get(env.DRAWS.idFromName(draw[1].toUpperCase())).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

// ---------- Draw & Pass rooms ----------
// A drawing-telephone party game: everyone writes a sentence, draws somebody
// else's, guesses that drawing, and so on until every chain has come back
// round. One Durable Object holds a whole room in memory and pushes every
// change down the open sockets, so a move costs a single round trip. Nothing
// polls a database, nothing is peer-to-peer, and nothing leaves this domain,
// which keeps it as quick at school as it is at home.
//
//   wss://<site>/api/draw/<CODE>?uid=..&name=..&color=..&new=1   open a room
//   wss://<site>/api/draw/<CODE>?uid=..&name=..&color=..         join one
//
// The object answers with {t:'state'} snapshots and small deltas
// ({t:'entry'}, {t:'react'}) and takes {t:'start'|'submit'|'vote'|'rev'|
// 'phase'|'again'|'set'|'leave'|'ping'} back from the players.

const DRAW_FILLERS = [
  'A cat riding a bicycle', 'A robot baking a cake', 'Two snails at the cinema',
  'A dragon in a bathtub', 'A penguin on stilts', 'A wizard with a flat tyre',
  'A frog in a tuxedo', 'A shark at the dentist', 'A bear on a scooter',
  'A llama in pyjamas', 'An octopus juggling hats', 'A mouse with a suitcase'
];

const drawKind = step => (step === 0 ? 'prompt' : step % 2 === 1 ? 'draw' : 'guess');

function drawChain(order, uid, step) {
  const n = order.length, p = order.indexOf(uid);
  if (p < 0 || !n) return null;
  const off = step === 0 ? 0 : step - 1;
  return order[(((p - off) % n) + n) % n];
}

function drawShuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = out[i]; out[i] = out[j]; out[j] = swap;
  }
  return out;
}

function drawText(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

export class Draw {
  constructor(state) {
    this.state = state;
    this.room = null;
    this.entries = {};
    this.votes = {};
    this.reacts = [];
    this.socks = new Map();
    this.ready = state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get('room');
      if (!saved) return;
      this.room = saved.room || null;
      this.entries = saved.entries || {};
      this.votes = saved.votes || {};
      this.reacts = saved.reacts || [];
      if (this.room && this.room.players) {
        for (const player of Object.values(this.room.players)) player.online = false;
      }
    });
  }

  sockets() {
    const all = [];
    for (const set of this.socks.values()) for (const ws of set) all.push(ws);
    return all;
  }

  save() {
    this.state.storage.put('room', { room: this.room, entries: this.entries, votes: this.votes, reacts: this.reacts }).catch(() => { /* fine */ });
  }

  send(ws, message) {
    try { ws.send(JSON.stringify(message)); } catch (error) { /* gone */ }
  }

  push(ws, withEntries) {
    this.send(ws, {
      t: 'state',
      now: Date.now(),
      room: this.room,
      entries: withEntries ? this.entries : null,
      votes: this.votes,
      reactions: this.reacts
    });
  }

  spread(withEntries) {
    for (const ws of this.sockets()) this.push(ws, !!withEntries);
  }

  members() {
    return Object.keys(this.room.players).filter(uid => this.room.players[uid].online);
  }

  durFor(step) {
    const room = this.room;
    const seconds = step === 0 ? room.promptTime : step % 2 === 1 ? room.drawTime : room.guessTime;
    return Math.max(10, Math.min(180, Number(seconds) || 30));
  }

  async fetch(request) {
    await this.ready;
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 });
    }
    const url = new URL(request.url);
    const uid = drawText(url.searchParams.get('uid'), 40) || 'anon';
    const name = drawText(url.searchParams.get('name'), 20) || 'Player';
    const color = Math.max(0, Math.min(15, parseInt(url.searchParams.get('color'), 10) || 0));
    const create = url.searchParams.get('new') === '1';

    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();

    const refuse = reason => {
      this.send(server, { t: reason });
      try { server.close(1000, reason); } catch (error) { /* gone */ }
      return new Response(null, { status: 101, webSocket: client });
    };

    if (!this.room) {
      if (!create) return refuse('missing');
      this.room = {
        host: uid, phase: 'lobby', round: 0, step: -1, stepEndsAt: 0, n: 0,
        order: [], next: {}, players: {}, promptTime: 30, drawTime: 60, guessTime: 30,
        customPrompts: true, revChain: 0, revStep: 0, createdAt: Date.now()
      };
      this.entries = {}; this.votes = {}; this.reacts = [];
    } else if (create && this.room.host !== uid && !this.room.players[uid]) {
      return refuse('taken');
    }

    let player = this.room.players[uid];
    if (!player) {
      if (this.room.phase !== 'lobby') return refuse('started');
      if (Object.keys(this.room.players).length >= 16) return refuse('full');
      player = this.room.players[uid] = { done: -1 };
    }
    player.name = name;
    player.color = color;
    player.online = true;
    player.seen = Date.now();

    let set = this.socks.get(uid);
    if (!set) this.socks.set(uid, set = new Set());
    set.add(server);

    server.addEventListener('message', event => {
      let message = null;
      try { message = JSON.parse(event.data); } catch (error) { return; }
      if (message && typeof message === 'object') this.onMessage(uid, server, message);
    });
    const gone = () => {
      const mine = this.socks.get(uid);
      if (mine) { mine.delete(server); if (!mine.size) this.socks.delete(uid); }
      if (!this.socks.has(uid)) {
        const self = this.room && this.room.players[uid];
        if (self) { self.online = false; self.seen = Date.now(); }
      }
      this.after();
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);

    // Everyone gets a fresh snapshot; the socket that just arrived also gets the
    // drawings so far, which is what a late spectator or a reconnect needs.
    for (const ws of this.sockets()) this.push(ws, ws === server);
    this.save();
    this.arm();
    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(uid, ws, message) {
    const room = this.room;
    if (!room) return;
    if (message.t === 'ping') { this.send(ws, { t: 'pong', now: Date.now() }); return; }
    const player = room.players[uid];
    if (!player) return;
    player.seen = Date.now();

    switch (message.t) {
      case 'set': {
        if (room.host !== uid) return;
        const patch = message.patch || {};
        if (typeof patch.customPrompts === 'boolean') room.customPrompts = patch.customPrompts;
        for (const key of ['promptTime', 'drawTime', 'guessTime']) {
          const value = Number(patch[key]);
          if (Number.isFinite(value)) room[key] = Math.max(10, Math.min(180, Math.round(value)));
        }
        this.after();
        return;
      }
      case 'start': this.start(uid); return;
      case 'submit': this.submit(uid, message); return;
      case 'vote': this.castVote(uid, message.chain); return;
      case 'react': this.react(uid, message.emoji); return;
      case 'rev': {
        if (room.host !== uid) return;
        room.revChain = Math.max(0, Math.min(room.n - 1, Math.round(Number(message.chain) || 0)));
        room.revStep = Math.max(0, Math.min(room.n, Math.round(Number(message.step) || 0)));
        this.after();
        return;
      }
      case 'phase': {
        if (room.host !== uid) return;
        if (message.phase === 'vote') this.toVote();
        else if (message.phase === 'results') this.toResults();
        return;
      }
      case 'again': if (room.host === uid) this.reset(); return;
      case 'leave': {
        if (room.phase === 'lobby' && room.players[uid]) {
          delete room.players[uid];
          if (room.host === uid) {
            const rest = Object.keys(room.players);
            if (rest.length) room.host = rest[0];
          }
        }
        this.after();
        return;
      }
      default: return;
    }
  }

  start(uid) {
    const room = this.room;
    if (!room || room.host !== uid) return;
    const online = this.members();
    if (online.length < 3) return;
    const order = drawShuffle(online).slice(0, 16);
    const next = {};
    order.forEach((who, i) => { next[who] = order[(i + 1) % order.length]; });
    room.phase = 'play';
    room.round = (room.round || 0) + 1;
    room.step = 0;
    room.n = order.length;
    room.order = order;
    room.next = next;
    room.revChain = 0;
    room.revStep = 0;
    room.stepEndsAt = Date.now() + this.durFor(0) * 1000 + 2000;
    for (const key of Object.keys(room.players)) room.players[key].done = -1;
    this.entries = {};
    this.votes = {};
    this.reacts = [];
    this.after(true);
  }

  submit(uid, message) {
    const room = this.room;
    if (!room || room.phase !== 'play') return;
    const step = room.step, kind = drawKind(step);
    if (message.kind !== kind) return;
    const player = room.players[uid];
    if (!player || player.done >= step) return;
    const chain = drawChain(room.order, uid, step);
    if (!chain) return;
    const key = chain + '|' + step;
    if (this.entries[key]) return;
    const entry = { round: room.round, chain: chain, step: step, kind: kind, author: uid, viewer: step === 0 ? uid : room.next[uid] };
    if (kind === 'draw') {
      const strokes = typeof message.strokes === 'string' ? message.strokes : '';
      if (strokes.length > 400000) return;
      entry.strokes = strokes || '[]';
    } else {
      entry.text = drawText(message.text, 120) || (kind === 'prompt' ? 'Something silly' : '???');
    }
    this.entries[key] = entry;
    player.done = step;
    for (const ws of this.sockets()) this.send(ws, { t: 'entry', key: key, entry: entry });
    this.after();
  }

  castVote(uid, chain) {
    const room = this.room;
    if (!room || room.phase !== 'vote') return;
    if (!room.order.includes(chain)) return;
    this.votes[uid] = chain;
    this.after();
  }

  react(uid, emoji) {
    const room = this.room;
    if (!room) return;
    const glyph = drawText(emoji, 8);
    if (!glyph) return;
    const reaction = { from: uid, chain: room.order[room.revChain] || null, step: room.revStep, emoji: glyph, at: Date.now() };
    this.reacts.push(reaction);
    if (this.reacts.length > 400) this.reacts = this.reacts.slice(-400);
    for (const ws of this.sockets()) this.send(ws, { t: 'react', reaction: reaction });
    this.after();
  }

  advance() {
    const room = this.room;
    if (!room) return;
    const step = room.step;
    for (const who of room.order) {
      const player = room.players[who];
      const chain = drawChain(room.order, who, step);
      if (!chain) continue;
      const key = chain + '|' + step;
      if (this.entries[key]) { if (player) player.done = step; continue; }
      const kind = drawKind(step);
      const entry = { round: room.round, chain: chain, step: step, kind: kind, author: who, viewer: step === 0 ? who : room.next[who], auto: true };
      if (kind === 'draw') entry.strokes = '[]';
      else if (kind === 'prompt') entry.text = DRAW_FILLERS[Math.floor(Math.random() * DRAW_FILLERS.length)];
      else entry.text = '…';
      this.entries[key] = entry;
      for (const ws of this.sockets()) this.send(ws, { t: 'entry', key: key, entry: entry });
      if (player) player.done = step;
    }
    if (step >= room.n) {
      room.phase = 'reveal';
      room.revChain = 0;
      room.revStep = 0;
      room.stepEndsAt = 0;
    } else {
      room.step = step + 1;
      room.stepEndsAt = Date.now() + this.durFor(room.step) * 1000 + 2000;
    }
    this.after();
  }

  toVote() {
    const room = this.room;
    if (!room) return;
    room.phase = 'vote';
    room.stepEndsAt = Date.now() + 75000;
    this.votes = {};
    this.after();
  }

  toResults() {
    const room = this.room;
    if (!room) return;
    room.phase = 'results';
    room.stepEndsAt = 0;
    this.after();
  }

  reset() {
    const room = this.room;
    if (!room) return;
    room.phase = 'lobby';
    room.step = -1;
    room.stepEndsAt = 0;
    room.n = 0;
    room.order = [];
    room.next = {};
    room.revChain = 0;
    room.revStep = 0;
    for (const key of Object.keys(room.players)) room.players[key].done = -1;
    this.entries = {};
    this.votes = {};
    this.reacts = [];
    this.after(true);
  }

  // Every change ends up here: finish the step when everyone online is done,
  // then tell the room and re-arm the clock.
  after(withEntries) {
    const room = this.room;
    if (!room) return;
    if (room.phase === 'play') {
      const waiting = room.order.filter(who => room.players[who] && room.players[who].online);
      if (waiting.length && waiting.every(who => (room.players[who].done ?? -1) >= room.step)) { this.advance(); return; }
    }
    if (room.phase === 'vote') {
      const waiting = room.order.filter(who => room.players[who] && room.players[who].online);
      if (waiting.length && waiting.every(who => this.votes[who])) { this.toResults(); return; }
    }
    this.save();
    this.spread(!!withEntries);
    this.arm();
  }

  arm() {
    const room = this.room;
    if (!room) return;
    let at = 0;
    if (room.phase === 'play') at = room.stepEndsAt + 2200;
    else if (room.phase === 'vote') at = room.stepEndsAt + 500;
    else at = Date.now() + 25000;
    this.state.storage.setAlarm(Math.max(Date.now() + 500, at)).catch(() => { /* fine */ });
  }

  async alarm() {
    await this.ready;
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    const host = room.players[room.host];
    if (!host || (!host.online && now - (host.seen || 0) > 30000)) {
      const replacement = this.members()[0];
      if (replacement) room.host = replacement;
    }
    if (room.phase === 'lobby') {
      for (const [uid, player] of Object.entries(room.players)) {
        if (uid === room.host) continue;
        if (!player.online && now - (player.seen || 0) > 60000) delete room.players[uid];
      }
    }
    if (room.phase === 'play' && now >= room.stepEndsAt + 1800) this.advance();
    else if (room.phase === 'vote' && now >= room.stepEndsAt) this.toResults();
    else this.after();
    this.arm();
  }
}
