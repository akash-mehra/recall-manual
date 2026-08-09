/* offline.js — small persistent banner shown while the browser is offline.
   Local data still works fine (everything's in IndexedDB), this is just
   so it's clear why Drive sync isn't happening right now rather than it
   silently doing nothing.
*/

(function () {
  function ensureBanner(show) {
    let banner = document.getElementById('recall-offline-banner');
    if (show) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'recall-offline-banner';
        banner.textContent = "You're offline — your cards still work, but Drive sync is paused until you're back online.";
        document.body.appendChild(banner);
      }
    } else if (banner) {
      banner.remove();
    }
  }

  function update() {
    ensureBanner(!navigator.onLine);
  }

  window.addEventListener('online', update);
  window.addEventListener('offline', update);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }
})();
