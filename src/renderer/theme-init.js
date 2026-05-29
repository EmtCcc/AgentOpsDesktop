// AgentOps Desktop — Theme Initialization (Prevents FOUC)
// This script runs before CSS loads to set the correct theme immediately.

(function() {
  'use strict';

  var THEME_KEY = 'agentops-theme';
  var VALID_THEMES = ['light', 'dark', 'system'];

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function resolveTheme(theme) {
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme;
  }

  function applyTheme(theme) {
    var resolved = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', resolved);
  }

  // Read stored preference or default to 'system'
  var stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch (e) {
    // localStorage not available
  }

  var theme = (stored && VALID_THEMES.indexOf(stored) !== -1) ? stored : 'system';

  // Apply immediately
  applyTheme(theme);

  // Listen for system theme changes when in system mode
  if (theme === 'system' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      var current = null;
      try {
        current = localStorage.getItem(THEME_KEY);
      } catch (e) {
        // ignore
      }
      if (current === 'system' || !current) {
        applyTheme('system');
      }
    });
  }
})();
