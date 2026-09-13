(() => {
  const {
    createGame,
    recordDart,
    undoLastDart,
    replaceDart,
    endTurn,
    turnIsOver,
    averageThreeDart,
  } = DartsGame;
  const {
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
  } = DartsStorage;
  const { renderSetup, renderGame, resetAnimationState } = DartsUI;

  const root = document.getElementById('app');
  let state = null;

  // Einzige Versions-Quelle. Bei jedem Release synchron zu CACHE_NAME
  // (service-worker.js) hochzaehlen.
  const APP_VERSION = 'v6';

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

  // Animierter Scroll nach oben – eigene rAF-Animation statt behavior:'smooth'
  // (nicht überall zuverlässig). Nach dem Re-Render aufrufen.
  function scrollTopSmooth() {
    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    if (reduced) {
      window.scrollTo(0, 0);
      return;
    }
    requestAnimationFrame(() => {
      const start = window.scrollY || document.documentElement.scrollTop || 0;
      if (start <= 0) return;
      const startTime = performance.now();
      const duration = 320;
      function step(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        window.scrollTo(0, Math.round(start * (1 - eased)));
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
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
          scrollTopSmooth();
        },
        onThemeChange: (mode) => {
          saveTheme(mode);
          applyTheme(mode);
        },
        onResetTraining: () => {
          clearTraining();
          showSetup();
        },
      },
      loadTraining(),
      APP_VERSION
    );
    // Genau einmal, synchron, an den Anfang – ohne rAF-Nachzügler, der den
    // ersten Tap auf „Spiel starten" verschluckt hat.
    window.scrollTo(0, 0);
  }

  function showGame() {
    renderGame(root, state, {
      onDart: (dart) => {
        recordDart(state, dart);
        // Trainings-Aufzeichnung: nur Solo-Sieg, genau einmal pro Spiel.
        if (
          state.winnerIdx !== null &&
          state.players.length === 1 &&
          !state.trainingRecorded
        ) {
          const player = state.players[0];
          const darts = player.committedDarts + state.currentTurnDarts.length;
          const avg = averageThreeDart(player, state.currentTurnDarts.length);
          saveTrainingRun({
            date: new Date().toISOString(),
            startScore: state.startScore,
            outMode: state.outMode,
            avg,
            darts,
          });
          state.trainingRecorded = true;
        }
        persist();
        if (state.winnerIdx !== null) haptic([100, 50, 100, 50, 200]);
        else if (state.bust) haptic([60, 40, 60]);
        else haptic(12);
        showGame();
        scrollTopSmooth();
      },
      onUndo: () => {
        undoLastDart(state);
        // Undo-Guard: nimmt der Undo den Solo-Siegerwurf zurueck, wird der
        // gerade gespeicherte Trainingslauf wieder entfernt.
        if (
          state.trainingRecorded &&
          state.winnerIdx === null &&
          state.players.length === 1
        ) {
          removeLatestTrainingRun();
          state.trainingRecorded = false;
        }
        persist();
        haptic(8);
        showGame();
        scrollTopSmooth();
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
        scrollTopSmooth();
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
