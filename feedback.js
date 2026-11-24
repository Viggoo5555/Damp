// ---------------------------------------------------------------
// FEEDBACK: one small button, one small form.
//
// A pill sits in the bottom-right corner of the site (in the top bar
// while a game is open, so it never covers a game's own HUD). It opens
// a short form: what kind of thing it is, where it happened (the main
// menu or a named game), and a message. Reports land in the Firestore
// collection `feedback`, which the site owner reads in the Firebase
// console. The open game's title is filled in automatically, and every
// report also carries the page it came from.
// ---------------------------------------------------------------
(function () {
  "use strict";

  var PROJECT = "damp-2406a";
  // The same public web key the rest of the site already ships.
  var API_KEY = "AIzaSyDJhWSi7QZKXtOPYwKHPF7zPg_klh1If7w";
  var ENDPOINT = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
    "/databases/(default)/documents/feedback?key=" + encodeURIComponent(API_KEY);
  var COOLDOWN_MS = 30000;
  var SENT_KEY = "damp-feedback-sent";
  var QUEUE_KEY = "damp-feedback-queue";
  var KINDS = ["Something's broken", "An idea", "Something else"];

  var dialog, whereSelect, textBox, status, sendButton, meta, pill;
  var playerEl, playerTitle;

  function onPage() { return location.protocol === "http:" || location.protocol === "https:"; }
  if (!onPage()) return;

  function gameTitles() {
    try {
      if (typeof games !== "undefined" && Array.isArray(games)) {
        return games.map(function (game) { return game && game.title; }).filter(Boolean);
      }
    } catch (error) { /* the shelf has not loaded yet */ }
    return [];
  }

  function currentGame() {
    try {
      if (playerEl && !playerEl.hidden && playerTitle) return playerTitle.textContent.trim();
    } catch (error) { /* no player yet */ }
    return "";
  }

  function build() {
    pill = document.createElement("button");
    pill.type = "button";
    pill.id = "feedback-open";
    pill.className = "feedback-pill";
    pill.setAttribute("aria-haspopup", "dialog");
    pill.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.4A.7.7 0 0 1 4.3 18.8V6.5Z"/></svg>' +
      '<span>Feedback</span>';
    document.body.appendChild(pill);

    var html =
      '<form id="feedback-form" novalidate>' +
      '  <h2 id="feedback-title">Send feedback</h2>' +
      '  <p class="feedback-lede">Something broken, or an idea? Type it here and it comes straight to Damp.</p>' +
      '  <div class="feedback-kinds" role="radiogroup" aria-label="What kind of feedback">' +
      KINDS.map(function (kind, index) {
        return '<label><input type="radio" name="kind" value="' + kind + '"' + (index === 0 ? " checked" : "") + '><span>' + kind + "</span></label>";
      }).join("") +
      "  </div>" +
      '  <label class="feedback-field" for="feedback-where">Where?' +
      '    <select id="feedback-where"></select>' +
      "  </label>" +
      '  <label class="feedback-field" for="feedback-text">What is wrong, or what should change?' +
      '    <textarea id="feedback-text" maxlength="1000" rows="4" required ' +
      'placeholder="What happened, and what should happen instead?"></textarea>' +
      "  </label>" +
      '  <p class="feedback-meta" id="feedback-meta"></p>' +
      '  <div class="feedback-actions">' +
      '    <button type="button" id="feedback-cancel">Cancel</button>' +
      '    <button type="submit" class="button" id="feedback-send">Send</button>' +
      "  </div>" +
      '  <p class="feedback-status" id="feedback-status" aria-live="polite"></p>' +
      "</form>";

    dialog = document.createElement("dialog");
    dialog.id = "feedback";
    dialog.setAttribute("aria-labelledby", "feedback-title");
    dialog.innerHTML = html;
    document.body.appendChild(dialog);

    whereSelect = dialog.querySelector("#feedback-where");
    textBox = dialog.querySelector("#feedback-text");
    status = dialog.querySelector("#feedback-status");
    sendButton = dialog.querySelector("#feedback-send");
    meta = dialog.querySelector("#feedback-meta");

    pill.addEventListener("click", openDialog);
    dialog.querySelector("#feedback-cancel").addEventListener("click", closeDialog);
    dialog.querySelector("#feedback-form").addEventListener("submit", submit);
    textBox.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submit(event);
      }
    });

    var bar = document.querySelector("#player .player-actions");
    if (bar) {
      var barButton = document.createElement("button");
      barButton.type = "button";
      barButton.id = "player-feedback";
      barButton.setAttribute("aria-haspopup", "dialog");
      barButton.innerHTML = '<svg class="player-icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.4A.7.7 0 0 1 4.3 18.8V6.5Z"/></svg>' +
        '<span class="player-action-label">Feedback</span>';
      barButton.addEventListener("click", openDialog);
      bar.insertBefore(barButton, bar.querySelector("#player-share") || null);
    }

    playerEl = document.getElementById("player");
    playerTitle = document.getElementById("player-title");
    if (playerEl && typeof MutationObserver === "function") {
      new MutationObserver(syncPill).observe(playerEl, { attributes: true, attributeFilter: ["hidden"] });
    }
    syncPill();
    setTimeout(flush, 2500);
  }

  // While a game is open the bar carries the button, so the corner stays clear
  // for the game's own speedometer or messages.
  function syncPill() {
    if (!pill) return;
    var playing = false;
    try { playing = Boolean(playerEl) && !playerEl.hidden; } catch (error) { playing = false; }
    pill.hidden = playing;
  }

  function refreshWhere() {
    var titles = gameTitles();
    var current = currentGame();
    var options = ['<option value="">The main menu and the whole site</option>'];
    titles.forEach(function (title) {
      options.push('<option value="' + escapeHtml(title) + '">' + escapeHtml(title) + "</option>");
    });
    whereSelect.innerHTML = options.join("");
    if (current) {
      var match = titles.indexOf(current);
      if (match >= 0) whereSelect.value = current;
      else whereSelect.value = "";
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function openDialog() {
    if (!dialog) return;
    refreshWhere();
    status.textContent = "";
    sendButton.disabled = false;
    var name = window.dampUser && window.dampUser.name ? String(window.dampUser.name) : "";
    meta.textContent = name
      ? "Sending as " + name + "."
      : "Sending without a name. Log in first if you want me to know who it is.";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    setTimeout(function () { try { textBox.focus(); } catch (error) { /* ignore */ } }, 30);
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function kind() {
    var picked = dialog.querySelector('input[name="kind"]:checked');
    return picked ? picked.value : KINDS[0];
  }

  // Reports typed before the feedback inbox is open for writes would be lost,
  // so a failed send is kept in this browser and retried on the next visit.
  function queue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") || []; } catch (error) { return []; }
  }

  function keep(report) {
    try {
      var next = queue();
      next.push(report);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(next.slice(-5)));
    } catch (error) { /* private mode: nothing to keep it in */ }
  }

  function flush() {
    var pending = queue();
    if (!pending.length) return;
    pending.reduce(function (chain, report) {
      return chain.then(function () {
        return fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(report)
        }).then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          try {
            var rest = queue();
            rest.shift();
            localStorage.setItem(QUEUE_KEY, JSON.stringify(rest));
          } catch (error) { /* ignore */ }
        });
      }).catch(function () { /* still closed; keep it for later */ });
    }, Promise.resolve());
  }

  // Nothing is lost when the send fails: the text stays in the box.
  function submit(event) {
    if (event) event.preventDefault();
    var message = (textBox.value || "").trim();
    if (message.length < 4) {
      status.textContent = "A few more words, please.";
      textBox.focus();
      return;
    }
    var last = 0;
    try { last = Number(localStorage.getItem(SENT_KEY)) || 0; } catch (error) { last = 0; }
    if (last && Date.now() - last < COOLDOWN_MS) {
      status.textContent = "You just sent one — give it a minute.";
      return;
    }

    var fields = {
      kind: { stringValue: kind() },
      where: { stringValue: (whereSelect.value || "Main menu").slice(0, 60) },
      text: { stringValue: message.slice(0, 1000) },
      page: { stringValue: location.pathname.slice(0, 160) + location.hash.slice(0, 40) },
      at: { timestampValue: new Date().toISOString() },
      ua: { stringValue: (navigator.userAgent || "").slice(0, 180) }
    };
    var name = window.dampUser && window.dampUser.name ? String(window.dampUser.name).slice(0, 40) : "";
    if (name) fields.name = { stringValue: name };

    sendButton.disabled = true;
    status.textContent = "Sending…";

    var report = { fields: fields };

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report)
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      try { localStorage.setItem(SENT_KEY, String(Date.now())); } catch (error) { /* private mode */ }
      textBox.value = "";
      status.textContent = "Thanks — that is in.";
      setTimeout(closeDialog, 900);
    }).catch(function (error) {
      keep(report);
      sendButton.disabled = false;
      status.textContent = "Kept this one — it will send on your next visit.";
      if (window.console && console.warn) console.warn("Feedback:", error);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
