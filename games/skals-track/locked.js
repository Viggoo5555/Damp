/*
  Locks the parts of the game that cannot work on Damp yet.

  Multiplayer asks Kodub's server for a room and a set of ICE servers; that
  server only answers the desktop app, so the tile gets a padlock and a short
  explanation instead of opening a dialog that cannot connect.
*/
(function () {
  var NOTE = "Multiplayer isn't available on Damp yet.";

  var toastBox = null;
  var toastTimer = 0;
  function say(text) {
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483647;" +
        "padding:10px 16px;border-radius:9px;background:rgba(20,26,56,0.95);border:1px solid #5a6ab8;color:#e9ecff;" +
        "font:600 15px/1.35 'Segoe UI',system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .2s ease;" +
        "box-shadow:0 8px 22px rgba(0,0,0,.4);white-space:nowrap";
      document.body.appendChild(toastBox);
    }
    toastBox.textContent = text;
    toastBox.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastBox.style.opacity = "0"; }, 3200);
  }

  function menuButton() {
    var buttons = document.querySelectorAll("#ui .menu-ui button");
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      var icon = button.querySelector("img");
      var src = icon ? String(icon.getAttribute("src") || "") : "";
      if (/multiplayer\.svg/.test(src) || /multiplayer/i.test(button.textContent || "")) return button;
    }
    return null;
  }

  function lock(button) {
    if (button.dataset.dampLocked) return;
    button.dataset.dampLocked = "1";
    button.setAttribute("aria-disabled", "true");
    button.title = NOTE;
    button.style.position = "relative";
    button.style.cursor = "not-allowed";

    var icon = button.querySelector("img");
    if (icon) icon.style.opacity = "0.4";
    var label = button.querySelector("p");
    if (label) label.style.opacity = "0.55";

    var badge = document.createElement("span");
    badge.style.cssText = "position:absolute;top:7px;right:7px;width:32px;height:32px;border-radius:50%;" +
      "background:rgba(11,16,53,.88);display:flex;align-items:center;justify-content:center;pointer-events:none;" +
      "box-shadow:0 2px 8px rgba(0,0,0,.45)";
    badge.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="#ffd76a" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3zm0 10a2 2 0 0 1 1 3.73V20h-2v-2.27A2 2 0 0 1 12 14z"/>' +
      "</svg>";
    button.appendChild(badge);
  }

  function decorate() {
    var button = menuButton();
    if (button) lock(button);
  }

  // The menu is rebuilt when screens change, so keep an eye on it.
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; decorate(); }, 120);
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest("#ui .menu-ui button") : null;
    if (!button || !button.dataset.dampLocked) return;
    event.stopPropagation();
    event.preventDefault();
    say(NOTE);
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  function start() {
    var ui = document.getElementById("ui");
    if (ui) new MutationObserver(schedule).observe(ui, { childList: true, subtree: true });
    decorate();
  }
})();
