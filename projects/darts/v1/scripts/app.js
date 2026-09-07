(() => {
  const { createGame, recordDart, undoLastDart, endTurn, turnIsOver } = DartsGame;
  const { saveGame, loadGame, clearGame, saveSettings, loadSettings } = DartsStorage;
  const { renderSetup, renderGame, resetAnimationState } = DartsUI;

  const root = document.getElementById('app');
  let state = null;

  function haptic(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {}
  }

  function persist() {
    if (state) saveGame(state);
  }

  function showSetup() {
    state = null;
    clearGame();
    resetAnimationState(null);
    if (
      document.activeElement &&
      typeof document.activeElement.blur === 'function'
    ) {
      document.activeElement.blur();
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    const settings = loadSettings();
    renderSetup(root, settings, ({ names, outMode }) => {
      saveSettings({
        outMode,
        lastCount: names.length,
        lastNames: names,
      });
      state = createGame(names, outMode);
      resetAnimationState(state.players);
      persist();
      showGame();
    });
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
    resetAnimationState(state.players);
    showGame();
  } else {
    clearGame();
    showSetup();
  }
})();
