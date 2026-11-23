/*
  The slow but dependable way between two players.

  The board games prefer a direct WebRTC link: it is quick and costs the site
  nothing, but the two computers have to reach each other, which many school and
  office networks block outright. When the direct link fails the game calls in
  here instead, and both players join a room on this site (/api/room/<code>).
  The Worker's Room object then carries every move from one to the other, so the
  game only needs the page itself to load.

  DampRelay.open({ code, role, onpeer, onwaiting, onfail }) hands back a
  channel-like object once a partner shows up: it has readyState, send(), close()
  and the usual onopen / onmessage / onclose hooks, so a game can treat it as a
  data channel.
*/
(function () {
  function channel(ws) {
    var ch = {
      label: 'relay',
      readyState: 'open',
      onopen: null,
      onmessage: null,
      onclose: null,
      send: function (text) {
        try {
          if (ws.readyState === 1) ws.send(typeof text === 'string' ? text : JSON.stringify(text));
        } catch (error) { /* gone */ }
      },
      close: function () {
        try { ws.close(); } catch (error) { /* gone */ }
      }
    };
    ws.onclose = function () {
      ch.readyState = 'closed';
      if (ch.onclose) ch.onclose();
    };
    ws.onerror = function () { };
    return ch;
  }

  function open(options) {
    var role = options.role === 'host' ? 'host' : 'guest';
    var code = String(options.code || '').toUpperCase();
    var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    var ws = null, link = null, paired = false, finished = false, retry = 0;

    function schedule() {
      if (finished || paired) return;
      clearTimeout(retry);
      retry = setTimeout(join, options.delay || 1500);
    }

    function join() {
      if (finished || paired) return;
      try {
        ws = new WebSocket(proto + '//' + location.host + '/api/room/' + encodeURIComponent(code) + '?role=' + role);
      } catch (error) {
        schedule();
        return;
      }

      ws.onmessage = function (event) {
        if (paired) {
          // Everything after the handshake is the other player's game data, and
          // it is passed along exactly as it arrived.
          if (link && link.onmessage) link.onmessage({ data: event.data });
          return;
        }
        var message = null;
        try { message = JSON.parse(event.data); } catch (error) { return; }
        if (!message || typeof message !== 'object') return;
        if (message.t === 'peer') {
          paired = true;
          link = channel(ws);
          if (options.onpeer) options.onpeer(link);
          if (link.onopen) link.onopen();
          return;
        }
        if (message.t === 'waiting') {
          if (options.onwaiting) options.onwaiting();
          return;
        }
        if (message.t === 'empty') { schedule(); return; }
        if (message.t === 'full') {
          finished = true;
          if (options.onfail) options.onfail('full');
        }
      };

      ws.onclose = function () {
        if (paired) { if (link && link.onclose) link.onclose(); return; }
        schedule();
      };
      ws.onerror = function () { };
    }

    join();

    return {
      close: function () {
        finished = true;
        clearTimeout(retry);
        try { if (ws) ws.close(); } catch (error) { /* gone */ }
      }
    };
  }

  window.DampRelay = { open: open, channel: channel };
})();
