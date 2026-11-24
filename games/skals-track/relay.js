/*
  SkalsTrack multiplayer over Damp's own WebSocket rooms.

  The game meets other players over WebRTC data channels. School and office
  networks drop the UDP traffic ICE needs (and often peer-to-peer entirely), so
  there the two sides never connect and the lobby gives up. This file swaps
  RTCPeerConnection for a small stand-in that carries the game's two data
  channels ("reliable" id 0 and "unreliable" id 1) over an ordinary WebSocket on
  this site's own port 443, which those networks let through.

  The game's own signalling is untouched: the invite code still travels through
  /api/v6/multiplayer, and only the room code rides inside the SDP text, which
  the two peers pass back and forth through that same channel. Each pair of
  players gets its own room at /api/room/<CODE>, so a host with several friends
  simply opens one socket per friend.

  Loaded before main.bundle.js, so the game only ever sees this version.
*/
(function () {
  if (typeof window === "undefined" || typeof window.WebSocket !== "function") return;

  var SDP_PREFIX = "damprelay:1:";
  // The room route only accepts A-Z and 0-9, so the code uses that alphabet.
  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  function makeCode() {
    var bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    var out = "";
    for (var i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
  }

  function codeOfSdp(sdp) {
    return typeof sdp === "string" && sdp.indexOf(SDP_PREFIX) === 0 ? sdp.slice(SDP_PREFIX.length) : "";
  }

  function fire(target, type, event) {
    var handler = target["on" + type];
    if (typeof handler === "function") {
      try { handler.call(target, event); } catch (error) { console.error(error); }
    }
    var list = target._listeners[type];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var fn = list[i];
      try {
        if (typeof fn === "function") fn.call(target, event);
        else if (fn && typeof fn.handleEvent === "function") fn.handleEvent(event);
      } catch (error) { console.error(error); }
    }
  }

  function listen(target, type, fn) {
    (target._listeners[type] || (target._listeners[type] = [])).push(fn);
  }

  function unlisten(target, type, fn) {
    var list = target._listeners[type];
    if (!list) return;
    var at = list.indexOf(fn);
    if (at >= 0) list.splice(at, 1);
  }

  // ---------- data channel ----------
  // The game sends ArrayBuffers and reads them back as ArrayBuffers, so a
  // message is the same frame the WebSocket delivered, minus the channel byte.
  function RelayChannel(peer, label, options) {
    this._peer = peer;
    this._listeners = {};
    this._queue = [];
    this.label = label || "";
    this.id = options && typeof options.id === "number" ? options.id : 0;
    this.ordered = !options || options.ordered !== false;
    this.binaryType = "arraybuffer";
    this.readyState = "connecting";
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }

  RelayChannel.prototype.addEventListener = function (type, fn) { listen(this, type, fn); };
  RelayChannel.prototype.removeEventListener = function (type, fn) { unlisten(this, type, fn); };

  RelayChannel.prototype.send = function (data) {
    if (this.readyState === "connecting") { this._queue.push(data); return; }
    if (this.readyState !== "open") return;
    this._peer._send(this.id, data);
  };

  RelayChannel.prototype.close = function () { this._peer.close(); };

  RelayChannel.prototype._open = function () {
    if (this.readyState !== "connecting") return;
    this.readyState = "open";
    fire(this, "open", { type: "open", target: this });
    var queued = this._queue;
    this._queue = [];
    for (var i = 0; i < queued.length; i++) this.send(queued[i]);
  };

  RelayChannel.prototype._shut = function () {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    fire(this, "close", { type: "close", target: this });
  };

  RelayChannel.prototype._deliver = function (buffer) {
    fire(this, "message", { type: "message", data: buffer, target: this });
  };

  // ---------- peer connection ----------
  function RelayPeerConnection(config) {
    this._listeners = {};
    this._channels = [];
    this._config = config || {};
    this._socket = null;
    this._room = "";
    this._role = "";
    this._attempts = 0;
    this._open = false;
    this._closed = false;
    this._pending = [];
    this.localDescription = null;
    this.remoteDescription = null;
    this.onicecandidate = null;
    this.ondatachannel = null;
    this.connectionState = "new";
    this.iceConnectionState = "new";
    this.iceGatheringState = "complete";
  }

  RelayPeerConnection.prototype.addEventListener = function (type, fn) { listen(this, type, fn); };
  RelayPeerConnection.prototype.removeEventListener = function (type, fn) { unlisten(this, type, fn); };

  RelayPeerConnection.prototype.createDataChannel = function (label, options) {
    var channel = new RelayChannel(this, label, options);
    this._channels.push(channel);
    if (this._open) channel._open();
    return channel;
  };

  RelayPeerConnection.prototype.createOffer = function () {
    if (!this._room) this._room = makeCode();
    return Promise.resolve({ type: "offer", sdp: SDP_PREFIX + this._room });
  };

  RelayPeerConnection.prototype.createAnswer = function () {
    if (!this._room) this._room = makeCode();
    return Promise.resolve({ type: "answer", sdp: SDP_PREFIX + this._room });
  };

  RelayPeerConnection.prototype.setLocalDescription = function (description) {
    this.localDescription = description || null;
    var self = this;
    // The game reads a null candidate as "gathering is done" and stops waiting.
    setTimeout(function () {
      if (self._closed) return;
      if (typeof self.onicecandidate === "function") {
        self.onicecandidate({ type: "icecandidate", candidate: null, target: self });
      }
    }, 0);
    return Promise.resolve();
  };

  RelayPeerConnection.prototype.setRemoteDescription = function (description) {
    this.remoteDescription = description || null;
    if (!description) return Promise.resolve();
    var room = codeOfSdp(description.sdp);
    if (room) this._room = room;
    // The host answers an offer; the joiner receives an answer. The side that
    // receives an offer opens the room first, so the joiner always finds it.
    this._connect(description.type === "offer" ? "host" : "guest");
    return Promise.resolve();
  };

  RelayPeerConnection.prototype.addIceCandidate = function () { return Promise.resolve(); };

  RelayPeerConnection.prototype.getStats = function () { return Promise.resolve(new Map()); };

  RelayPeerConnection.prototype.close = function () {
    if (this._closed) return;
    this._closed = true;
    this._open = false;
    if (this._socket) {
      try { this._socket.close(); } catch (error) { /* already gone */ }
      this._socket = null;
    }
    for (var i = 0; i < this._channels.length; i++) this._channels[i]._shut();
    this._setState("closed");
  };

  RelayPeerConnection.prototype._setState = function (state) {
    var changed = false;
    if (this.connectionState !== state) { this.connectionState = state; changed = true; }
    if (this.iceConnectionState !== state) { this.iceConnectionState = state; changed = true; }
    if (!changed) return;
    fire(this, "iceconnectionstatechange", { type: "iceconnectionstatechange", target: this });
    fire(this, "connectionstatechange", { type: "connectionstatechange", target: this });
  };

  RelayPeerConnection.prototype._connect = function (role) {
    if (!this._room || this._closed || this._socket) return;
    var self = this;
    var scheme = location.protocol === "https:" ? "wss:" : "ws:";
    var url = scheme + "//" + location.host + "/api/room/" + this._room +
      "?role=" + (role === "host" ? "host" : "guest");
    this._role = role;
    this._setState("connecting");

    var socket;
    try { socket = new WebSocket(url); } catch (error) { this._setState("failed"); return; }
    this._socket = socket;
    socket.binaryType = "arraybuffer";

    socket.addEventListener("open", function () {
      if (self._closed) { try { socket.close(); } catch (error) { /* ignore */ } }
    });

    socket.addEventListener("message", function (event) {
      // Control frames from the room are text; gameplay frames are binary.
      if (typeof event.data === "string") {
        var message = null;
        try { message = JSON.parse(event.data); } catch (error) { message = null; }
        var kind = message && message.t;
        if (kind === "peer") {
          self._ready();
        } else if (kind === "empty" || kind === "full") {
          // A joiner can reach the room a moment before the host's socket is
          // registered, so try again briefly instead of failing the race.
          try { socket.close(); } catch (error) { /* ignore */ }
          self._socket = null;
          if (kind === "empty" && self._attempts < 25 && !self._closed) {
            self._attempts++;
            setTimeout(function () { self._connect(role); }, 200);
          } else {
            self._setState("failed");
          }
        }
        return;
      }
      self._receive(event.data);
    });

    socket.addEventListener("close", function () {
      if (self._socket === socket) self._socket = null;
      if (self._closed) return;
      self._open = false;
      for (var i = 0; i < self._channels.length; i++) self._channels[i]._shut();
      self._setState("disconnected");
    });
  };

  RelayPeerConnection.prototype._ready = function () {
    if (this._open || this._closed) return;
    this._open = true;
    this._setState("connected");
    for (var i = 0; i < this._channels.length; i++) this._channels[i]._open();
    // The host starts sending the moment it sees the pair, which can be a tick
    // before this side's channels are open. Real data channels never deliver
    // anything before "open", so hold those frames back until the game's own
    // listeners have run.
    var waiting = this._pending;
    this._pending = [];
    for (var j = 0; j < waiting.length; j++) this._dispatch(waiting[j]);
  };

  RelayPeerConnection.prototype._receive = function (data) {
    if (!this._open) {
      if (this._pending.length < 512) this._pending.push(data);
      return;
    }
    this._dispatch(data);
  };

  RelayPeerConnection.prototype._dispatch = function (data) {
    if (!(data instanceof ArrayBuffer) || data.byteLength < 1) return;
    var bytes = new Uint8Array(data);
    var channelId = bytes[0];
    var body = bytes.buffer.slice(bytes.byteOffset + 1, bytes.byteOffset + bytes.byteLength);
    for (var i = 0; i < this._channels.length; i++) {
      if (this._channels[i].id === channelId) { this._channels[i]._deliver(body); return; }
    }
  };

  RelayPeerConnection.prototype._send = function (channelId, data) {
    var socket = this._socket;
    if (!socket || socket.readyState !== 1) return;
    var source;
    if (typeof data === "string") source = new TextEncoder().encode(data);
    else if (data instanceof ArrayBuffer) source = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) source = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else return;
    var frame = new Uint8Array(source.byteLength + 1);
    frame[0] = channelId & 0xff;
    frame.set(source, 1);
    try { socket.send(frame); } catch (error) { /* socket went away */ }
  };

  function RelaySessionDescription(init) {
    this.type = init && init.type ? init.type : "offer";
    this.sdp = init && typeof init.sdp === "string" ? init.sdp : "";
  }
  RelaySessionDescription.prototype.toJSON = function () { return { type: this.type, sdp: this.sdp }; };

  function RelayIceCandidate(init) {
    this.candidate = init && init.candidate != null ? init.candidate : "";
    this.sdpMid = init ? init.sdpMid : null;
    this.sdpMLineIndex = init ? init.sdpMLineIndex : null;
  }
  RelayIceCandidate.prototype.toJSON = function () {
    return { candidate: this.candidate, sdpMid: this.sdpMid, sdpMLineIndex: this.sdpMLineIndex };
  };

  window.RTCPeerConnection = RelayPeerConnection;
  window.webkitRTCPeerConnection = RelayPeerConnection;
  window.RTCSessionDescription = RelaySessionDescription;
  window.RTCIceCandidate = RelayIceCandidate;
})();
