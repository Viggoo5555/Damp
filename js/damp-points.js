/* =====================================================================
   DAMP POINTS — one wallet for every game on the site
   ---------------------------------------------------------------------
   Each game keeps its own currency (coins, score, points, energy). Those
   are local numbers that only mean something inside that game. Damp points
   are the currency you actually spend, and Secret Room furniture is priced
   in them.

   A game only has to say how to read and spend its own number:

     DampPoints.mount({
       game: "flappy",                 // key, used for the daily limit
       label: "Flappy Bird",
       unit: "points",
       rate: 0.15,                     // Damp points per 1 game unit
       dailyCap: 900,                  // most Damp points this game can give per day
       get: function () { return save.pts; },
       spend: function (n) { save.pts -= n; persist(); }
     });

   The chip in the corner shows the shared balance; tapping it opens the
   trade panel. `DampPoints.set(n)` overwrites the balance (games whose own
   currency *is* the wallet use that), and `onChange` fires in any tab.
   ===================================================================== */
(function () {
  "use strict";
  var KEY = "damp-points-v1";
  var listeners = [];
  var state = read();

  function read() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && typeof raw === "object") {
        return {
          points: Math.max(0, Math.round(+raw.points || 0)),
          days: raw.days && typeof raw.days === "object" ? raw.days : {}
        };
      }
    } catch (error) { /* private mode, storage blocked */ }
    return { points: 0, days: {} };
  }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { /* ignore */ }
    listeners.slice().forEach(function (fn) { try { fn(state.points); } catch (error) { /* ignore */ } });
  }
  function dayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function todayFor(game) {
    var day = dayKey();
    if (!state.days[day]) state.days[day] = {};
    // keep a week of history at most
    Object.keys(state.days).forEach(function (k) { if (k !== day && state.days[k] && Object.keys(state.days).length > 7) delete state.days[k]; });
    return state.days[day][game] || 0;
  }
  function addToday(game, n) {
    var day = dayKey();
    if (!state.days[day]) state.days[day] = {};
    state.days[day][game] = (state.days[day][game] || 0) + n;
  }
  function fmt(n) {
    n = Math.max(0, Math.round(+n || 0));
    if (n < 1000) return String(n);
    if (n < 1e6) return trim(n / 1e3) + "k";
    if (n < 1e9) return trim(n / 1e6) + "M";
    if (n < 1e12) return trim(n / 1e9) + "B";
    if (n < 1e15) return trim(n / 1e12) + "T";
    return n.toExponential(1).replace("+", "");
  }
  function trim(v) {
    var s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return s.replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
  }

  var api = {
    balance: function () { return state.points; },
    set: function (n) {
      var next = Math.max(0, Math.round(+n || 0));
      if (next === state.points) return state.points;
      state.points = next;
      write();
      return state.points;
    },
    add: function (n) {
      return api.set(state.points + Math.round(+n || 0));
    },
    spend: function (n) {
      n = Math.round(+n || 0);
      if (n <= 0) return true;
      if (state.points < n) return false;
      api.set(state.points - n);
      return true;
    },
    canSpend: function (n) { return state.points >= Math.round(+n || 0); },
    fmt: fmt,
    leftToday: function (game, cap) { return Math.max(0, (cap || 0) - todayFor(game)); },
    onChange: function (fn) {
      if (typeof fn !== "function") return function () {};
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
    },
    mount: mount
  };
  window.DampPoints = api;

  window.addEventListener("storage", function (event) {
    if (event.key !== KEY) return;
    state = read();
    listeners.slice().forEach(function (fn) { try { fn(state.points); } catch (error) { /* ignore */ } });
    var chip = document.querySelector(".dp-chip .dp-amt");
    if (chip) chip.textContent = fmt(state.points);
  });

  /* ---------- the chip and the trade panel ---------- */
  var styled = false;
  function style() {
    if (styled) return;
    styled = true;
    var css = document.createElement("style");
    css.textContent = [
      ".dp-chip{position:fixed;left:14px;bottom:14px;z-index:9998;display:inline-flex;align-items:center;gap:7px;",
      "padding:8px 13px 8px 10px;border-radius:999px;border:1px solid rgba(160,120,95,.28);",
      "background:rgba(255,250,243,.94);color:#5b4436;font:600 14px/1 Georgia,serif;letter-spacing:.2px;",
      "box-shadow:0 6px 18px rgba(90,66,50,.16);cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}",
      ".dp-chip:hover{background:#fffaf3;transform:translateY(-1px)}",
      ".dp-chip:focus-visible{outline:2px solid #e28d7f;outline-offset:3px}",
      ".dp-chip .dp-coin{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;",
      "background:linear-gradient(160deg,#f5c98a,#e0a86a);color:#7a5334;font-size:11px}",
      ".dp-chip .dp-tag{font:600 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#a2836c}",
      ".dp-sheet{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;",
      "background:rgba(58,40,29,.34);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}",
      ".dp-card{width:min(380px,100%);border-radius:18px;background:#fffaf3;color:#4a3a2e;",
      "border:1px solid rgba(160,120,95,.22);box-shadow:0 22px 50px rgba(60,40,28,.28);padding:20px 20px 16px;",
      "font:15px/1.45 ui-sans-serif,system-ui,sans-serif}",
      ".dp-card h2{margin:0 0 2px;font:600 21px/1.2 Georgia,serif}",
      ".dp-card .dp-sub{margin:0 0 14px;color:#8a7160;font-size:13px}",
      ".dp-bal{display:flex;align-items:baseline;gap:8px;padding:12px 14px;border-radius:13px;",
      "background:linear-gradient(160deg,#fdf1e1,#f7e4d3);margin-bottom:14px}",
      ".dp-bal b{font:600 26px/1 Georgia,serif}",
      ".dp-bal span{color:#8a7160;font-size:12px;letter-spacing:.08em;text-transform:uppercase}",
      ".dp-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-top:1px solid rgba(160,120,95,.16);font-size:13px}",
      ".dp-row b{font-weight:600}",
      ".dp-actions{display:flex;gap:8px;margin-top:14px}",
      ".dp-actions button{flex:1;padding:12px 10px;border-radius:12px;border:1px solid rgba(160,120,95,.28);",
      "background:#fff;color:#4a3a2e;font:600 14px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}",
      ".dp-actions button.go{background:#e28d7f;border-color:#d97f70;color:#fff}",
      ".dp-actions button:disabled{opacity:.45;cursor:not-allowed}",
      ".dp-foot{margin:12px 0 0;font-size:11.5px;color:#9a8371;text-align:center}"
    ].join("");
    document.head.appendChild(css);
  }

  function mount(opts) {
    if (!opts || typeof opts.get !== "function") return;
    style();
    var rate = +opts.rate || 0;
    var unit = opts.unit || "points";
    var cap = +opts.dailyCap || 0;

    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "dp-chip";
    chip.setAttribute("aria-label", "Damp points");
    chip.innerHTML = '<span class="dp-coin">\u25c6</span><span class="dp-amt">' + fmt(state.points) + '</span><span class="dp-tag">Damp</span>';
    document.body.appendChild(chip);

    var sheet = null;
    chip.addEventListener("click", open);

    var unsub = api.onChange(function (points) {
      var amt = chip.querySelector(".dp-amt");
      if (amt) amt.textContent = fmt(points);
      if (sheet) render();
    });
    window.addEventListener("pagehide", unsub);

    function open() {
      if (sheet) return close();
      sheet = document.createElement("div");
      sheet.className = "dp-sheet";
      sheet.innerHTML = '<div class="dp-card" role="dialog" aria-modal="true" aria-label="Damp points"></div>';
      sheet.addEventListener("click", function (event) { if (event.target === sheet) close(); });
      document.body.appendChild(sheet);
      render();
      document.addEventListener("keydown", onKey);
    }
    function close() {
      if (!sheet) return;
      document.removeEventListener("keydown", onKey);
      sheet.remove();
      sheet = null;
    }
    function onKey(event) { if (event.key === "Escape") close(); }

    function render() {
      if (!sheet) return;
      var card = sheet.querySelector(".dp-card");
      var have = Math.max(0, +opts.get() || 0);
      var left = cap ? api.leftToday(opts.game, cap) : Infinity;
      var canTrade = rate > 0 && have > 0 && left > 0;
      var allGain = Math.floor(have * rate);
      var halfGain = Math.floor((have / 2) * rate);
      var html = '<h2>Damp points</h2><p class="dp-sub">One wallet for every game. Furniture is priced in these.</p>' +
        '<div class="dp-bal"><b>' + fmt(state.points) + '</b><span>Damp points</span></div>';
      if (rate > 0) {
        html += '<div class="dp-row"><span>Your ' + escape(opts.label || "game") + '</span><b>' + fmt(have) + ' ' + escape(unit) + '</b></div>' +
          '<div class="dp-row"><span>Exchange rate</span><b>1 ' + escape(unit) + ' = ' + trim(rate) + ' Damp</b></div>' +
          (cap ? '<div class="dp-row"><span>Left to earn here today</span><b>' + fmt(left) + ' Damp</b></div>' : '');
      }
      html += '<div class="dp-actions">' +
        (rate > 0
          ? '<button type="button" data-trade="half" ' + (canTrade && halfGain > 0 ? '' : 'disabled') + '>Half \u2192 ' + fmt(halfGain) + '</button>' +
            '<button type="button" class="go" data-trade="all" ' + (canTrade && allGain > 0 ? '' : 'disabled') + '>All \u2192 ' + fmt(allGain) + '</button>'
          : '<button type="button" class="go" data-trade="close">Close</button>') +
        '</div><p class="dp-foot">' + (rate > 0 ? 'Traded points are spent from ' + escape(opts.label || "this game") + '.' : '') + '</p>';
      card.innerHTML = html;
      card.querySelectorAll("[data-trade]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var mode = btn.getAttribute("data-trade");
          if (mode === "close") return close();
          trade(mode === "half" ? Math.floor(have / 2) : have);
        });
      });
    }

    function trade(amount) {
      var have = Math.max(0, +opts.get() || 0);
      var take = Math.min(Math.max(0, Math.floor(amount)), Math.floor(have));
      if (!take || rate <= 0) return;
      var gain = Math.floor(take * rate);
      var left = cap ? api.leftToday(opts.game, cap) : Infinity;
      if (left <= 0) { flash("That is all the Damp points this game gives today."); return; }
      if (gain > left) {
        gain = left;
        take = Math.ceil(gain / rate);
        take = Math.min(take, Math.floor(have));
        gain = Math.floor(take * rate);
      }
      if (gain < 1) { flash("That is not worth a full Damp point yet."); return; }
      if (typeof opts.spend === "function") {
        var paid = opts.spend(take);
        if (paid === false) { flash("Not enough " + unit + " to trade."); return; }
      } else {
        flash("This game cannot trade yet.");
        return;
      }
      if (typeof opts.save === "function") { try { opts.save(); } catch (error) { /* ignore */ } }
      addToday(opts.game, gain);
      api.add(gain);
      flash("+" + fmt(gain) + " Damp points");
      render();
    }

    function flash(text) {
      if (!sheet) return;
      var foot = sheet.querySelector(".dp-foot");
      if (!foot) return;
      foot.textContent = text;
      foot.style.color = "#b4645a";
      setTimeout(function () { if (sheet) render(); }, 1600);
    }

    // keep the trading numbers honest if the player earns currency while the panel is open
    setInterval(function () { if (sheet) render(); }, 1200);
  }

  function escape(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
