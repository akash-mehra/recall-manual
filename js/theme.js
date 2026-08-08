/* theme.js — light/dark theme switching.
   The actual class-toggle-for-first-paint happens via a tiny INLINE script
   in each page's <head> (reading localStorage synchronously before CSS
   paints), to avoid a flash of the wrong theme. This file is the full
   version loaded later: it can set up the moon element (needs <body> to
   exist) and exposes setTheme() for the settings page to call.
*/

(function () {
  const THEME_KEY = 'recall_manual_theme';

  function getTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'light';
    } catch {
      return 'light';
    }
  }

  function ensureMoon(show) {
    let moon = document.getElementById('recall-moon');
    if (show) {
      if (!moon) {
        moon = document.createElement('div');
        moon.id = 'recall-moon';
        moon.innerHTML =
          '<div class="moon-crater moon-crater-1"></div>' +
          '<div class="moon-crater moon-crater-2"></div>' +
          '<div class="moon-crater moon-crater-3"></div>';
        document.body.appendChild(moon);
      }
    } else if (moon) {
      moon.remove();
    }
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    if (document.body) ensureMoon(theme === 'dark');
  }

  function setTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
    applyTheme(theme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTheme(getTheme()));
  } else {
    applyTheme(getTheme());
  }

  window.RecallTheme = { getTheme, setTheme, applyTheme };
})();
