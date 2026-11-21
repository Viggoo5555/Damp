// The site has exactly one ad: a single responsive unit at the foot of the
// games shelf on the front page. Nothing sits between the game tiles, nothing
// runs inside a game, and nothing is shown over the player.
//
// To switch it on, create one display ad unit in AdSense
// (Ads -> By ad unit -> Display) and paste its slot id below. Until a slot id
// is set nothing is rendered and the page looks exactly as it does now.
//
// AdSense's Auto ads should stay off (AdSense -> Ads -> By site). Auto ads
// ignore the placement rules above; this file is the whole ad surface.

(function () {
  var SLOT = ''; // e.g. '1234567890' – paste the ad unit's slot id here
  var CLIENT = 'ca-pub-6851662024546666';

  var box = document.getElementById('ad-slot');
  if (!box) return;
  if (!/^\d{6,}$/.test(SLOT)) return; // no unit yet: leave the page untouched

  var label = document.createElement('span');
  label.className = 'ad-label';
  label.textContent = 'Advertisement';

  var ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.setAttribute('data-ad-client', CLIENT);
  ins.setAttribute('data-ad-slot', SLOT);
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');

  box.appendChild(label);
  box.appendChild(ins);

  function collapse() {
    box.hidden = true;
  }

  function request() {
    // Nothing fills before the site is approved or when an ad blocker eats the
    // library, so the box is collapsed again rather than left as a blank gap.
    box.hidden = false;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      collapse();
      return;
    }

    var tries = 0;
    var timer = setInterval(function () {
      var status = ins.getAttribute('data-ad-status');
      if (status === 'filled') {
        clearInterval(timer);
        return;
      }
      if (status === 'unfilled' || ++tries > 20) {
        clearInterval(timer);
        collapse();
      }
    }, 400);
  }

  // The unit is below the shelf, so it is only requested once the browser is
  // idle. Visitors who never scroll that far cost nothing.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(request, { timeout: 2500 });
  } else {
    setTimeout(request, 1200);
  }
})();
