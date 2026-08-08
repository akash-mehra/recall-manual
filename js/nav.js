/* nav.js — small helper so every same-app navigation that might follow a
   data change gives a pending Drive push a chance to actually finish
   first, instead of letting the browser tear down the page (and any
   setTimeout debounce inside it) mid-flight.
*/

window.RecallNav = {
  async goTo(url) {
    try {
      if (window.RecallSync && window.RecallAuth && RecallAuth.getCurrentUser()) {
        await RecallSync.flushPendingSync();
      }
    } catch (err) {
      console.error('Flush before navigation failed', err);
    }
    window.location.href = url;
  },
};
