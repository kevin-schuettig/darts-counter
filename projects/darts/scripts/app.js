(() => {
  const { createGame, recordDart, undoLastDart, replaceDart, endTurn, turnIsOver } =
    DartsGame;
  const {
    saveGame,
    loadGame,
    clearGame,
    saveSettings,
    loadSettings,
    saveTheme,
    loadTheme,
  } = DartsStorage;
  const { renderSetup, renderGame, resetAnimationState } = DartsUI;

  const root = document.getElementById('app');
  let state = null;

  // Scroll-Position nicht vom Browser wiederherstellen lassen – das war eine
  // Mitursache des „erster Klick verpufft"-Bugs auf dem Home-Screen.
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  } catch {}

  function haptic(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {}
  }

  function applyTheme(mode) {
    const el = document.documentElement;
    if (mode === 'light' || mode === 'dark') el.setAttribute('data-theme', mode);
    else el.removeAttribute('data-theme');
    updateThemeColor();
  }

  function updateThemeColor() {
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && bg) meta.setAttribute('content', bg);
    } catch {}
  }

  applyTheme(loadTheme());

  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (loadTheme() === 'system') updateThemeColor();
    });
  } catch {}

  function persist() {
    if (state) saveGame(state);
  }

  function showSetup() {
    state = null;
    clearGame();
    resetAnimationState(null);
    const settings = loadSettings();
    renderSetup(
      root,
      settings,
      loadTheme(),
      {
        onStart: ({ names, outMode, startScore }) => {
          saveSettings({
            outMode,
            startScore,
            lastCount: names.length,
            lastNames: names,
            lastStartScore: startScore,
          });
          state = createGame(names, outMode, startScore);
          resetAnimationState(state.players);
          persist();
          showGame();
        },
        onThemeChange: (mode) => {
          saveTheme(mode);
          applyTheme(mode);
        },
      }
    );
    // Genau einmal, synchron, an den Anfang – ohne rAF-Nachzügler, der den
    // ersten Tap auf „Spiel starten" verschluckt hat.
    window.scrollTo(0, 0);
  }

  function showGame() {
    renderGame(root, state, {
      onDart: (dart) => {
        recordDart(state, dart);
        persist();
        if (state.winnerIdx !== null) haptic([100, 50, 100, 50, 200]);
        else if (state.bust) haptic([60, 40, 60]);
        else haptic(12);
        showGame();
      },
      onUndo: () => {
        undoLastDart(state);
        persist();
        haptic(8);
        showGame();
      },
      onEditDart: (index, dart) => {
        replaceDart(state, index, dart);
        persist();
        haptic(8);
        showGame();
      },
      onEndTurn: () => {
        if (turnIsOver(state)) {
          endTurn(state);
          persist();
          haptic(15);
        }
        showGame();
        requestAnimationFrame(() =>
          window.scrollTo({ top: 0, behavior: 'smooth' })
        );
      },
      onNewGame: () => {
        showSetup();
      },
    });
  }

  const saved = loadGame();
  if (saved && saved.players && saved.winnerIdx === null) {
    state = saved;
    if (!state.startScore) state.startScore = DartsGame.START_SCORE;
    state.players.forEach((p) => {
      if (!p.startScore) p.startScore = state.startScore;
    });
    resetAnimationState(state.players);
    showGame();
  } else {
    clearGame();
    showSetup();
  }
})();
