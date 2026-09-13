const DartsStorage = (() => {
  const KEY_GAME = 'darts:current';
  const KEY_SETTINGS = 'darts:settings';
  const KEY_THEME = 'darts:theme';
  const KEY_TRAINING = 'darts:training';
  const VALID_THEMES = ['system', 'light', 'dark'];
  const TRAINING_MAX = 10;

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

  function saveTheme(mode) {
    try {
      localStorage.setItem(KEY_THEME, VALID_THEMES.includes(mode) ? mode : 'system');
    } catch {}
  }

  function loadTheme() {
    try {
      const raw = localStorage.getItem(KEY_THEME);
      return VALID_THEMES.includes(raw) ? raw : 'system';
    } catch {
      return 'system';
    }
  }

  function loadTraining() {
    try {
      const raw = localStorage.getItem(KEY_TRAINING);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveTrainingRun(entry) {
    try {
      const list = loadTraining();
      list.unshift(entry);
      localStorage.setItem(KEY_TRAINING, JSON.stringify(list.slice(0, TRAINING_MAX)));
    } catch {}
  }

  function removeLatestTrainingRun() {
    try {
      const list = loadTraining();
      list.shift();
      localStorage.setItem(KEY_TRAINING, JSON.stringify(list));
    } catch {}
  }

  function clearTraining() {
    try {
      localStorage.removeItem(KEY_TRAINING);
    } catch {}
  }

  return {
    saveGame,
    loadGame,
    clearGame,
    saveSettings,
    loadSettings,
    saveTheme,
    loadTheme,
    loadTraining,
    saveTrainingRun,
    removeLatestTrainingRun,
    clearTraining,
  };
})();
