const DartsStorage = (() => {
  const KEY_GAME = 'darts:current';
  const KEY_SETTINGS = 'darts:settings';

  function saveGame(state) {
    try {
      localStorage.setItem(KEY_GAME, JSON.stringify(state));
    } catch {}
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(KEY_GAME);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearGame() {
    try {
      localStorage.removeItem(KEY_GAME);
    } catch {}
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
    } catch {}
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(KEY_SETTINGS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  return { saveGame, loadGame, clearGame, saveSettings, loadSettings };
})();
