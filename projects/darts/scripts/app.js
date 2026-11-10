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
    loadClockRuns,
    saveClockRun,
    removeLatestClockRun,
    clearClockRuns,
  } = DartsStorage;
  const { renderSetup, renderGame, resetAnimationState } = DartsUI;

  // Engine je nach Modus. X01 (DartsGame) und Around the Clock (DartsClock)
  // bieten die gleichen Kern-Funktionen (recordDart, undoLastDart,
  // replaceDart, endTurn, turnIsOver) mit kompatibler Signatur.
  const engine = (st) => (st && st.mode === 'clock' ? DartsClock : DartsGame);

  const root = document.getElementById('app');
  let state = null;

  // Einzige Versions-Quelle. Bei jedem Release synchron zu CACHE_NAME
  // (service-worker.js) hochzaehlen.
  const APP_VERSION = 'v12';

  // Scroll-Position nicht vom Browser wiederherstellen lassen – das war eine
  // Mitursache des „erster Klick verpufft"-Bugs auf dem Home-Screen.
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  } catch {}

  // Ton beim Wurf-Einloggen an/aus (Default: an). Wird modulweit gehalten,
  // damit die Spiel-Handler ihn kennen, und in den Settings persistiert.
  let soundEnabled = loadSettings().sound !== false;

  function haptic(pattern) {
    // Android/Chrome kennt navigator.vibrate() → echte Vibration.
    try {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
        return;
      }
    } catch {}
    // iOS/Safari kennt vibrate() NICHT. Best-Effort-Fallback über ein
    // verstecktes <input switch> (iOS 17.4+), das innerhalb einer echten
    // Nutzergeste umgeschaltet wird. Ohne Garantie – je nach iOS-Version
    // passiert schlicht nichts.
    try {
      const h = ensureIosHapticSwitch();
      if (h) h.click();
    } catch {}
  }

  let iosHapticSwitch = null;
  function ensureIosHapticSwitch() {
    if (iosHapticSwitch !== null) return iosHapticSwitch || null;
    try {
      const label = document.createElement('label');
      label.className = 'ios-haptic';
      label.setAttribute('aria-hidden', 'true');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.appendChild(input);
      document.body.appendChild(label);
      iosHapticSwitch = label;
    } catch {
      iosHapticSwitch = false;
    }
    return iosHapticSwitch || null;
  }

  // --- Ton-Feedback (Web Audio) --------------------------------------------
  // Kurzer, trockener „Tock" beim Einloggen eines Wurfs – komplett im Code
  // erzeugt (keine Audiodatei → kein Ladeverzug). Der AudioContext startet
  // auf iOS erst nach einer echten Nutzergeste; da playSound() synchron im
  // Tap-Handler läuft, entsperrt ihn der erste Wurf von selbst.
  let audioCtx = null;
  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    } catch {
      audioCtx = null;
    }
    return audioCtx;
  }

  // kind: 'click' (normaler Wurf) | 'bust' | 'win'
  function playSound(kind) {
    if (!soundEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
    } catch {}
    const t0 = ctx.currentTime;

    const blip = (freqStart, freqEnd, startAt, dur, peak, type) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(freqStart, startAt);
      if (freqEnd && freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, startAt + dur);
      }
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + dur + 0.03);
    };

    if (kind === 'win') {
      blip(660, 660, t0, 0.1, 0.16);
      blip(990, 990, t0 + 0.11, 0.16, 0.16);
    } else if (kind === 'bust') {
      blip(200, 120, t0, 0.16, 0.18);
    } else if (kind === 'miss') {
      // „Ärgerlicher" Downer: kurzes absteigendes Wah-Wah, rauer Sägezahn.
      blip(300, 220, t0, 0.13, 0.13, 'sawtooth');
      blip(220, 160, t0 + 0.12, 0.2, 0.13, 'sawtooth');
    } else {
      blip(420, 300, t0, 0.045, 0.12); // dezenter Klick/Tock
    }
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
    // Around-the-Clock-Spiele werden bewusst nicht zwischengespeichert
    // (verlassen = vorbei). Nur X01 bekommt Resume.
    if (state && state.mode !== 'clock') saveGame(state);
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
        onStart: (opts) => {
          const { mode, names } = opts;
          const base = {
            ...loadSettings(), // u.a. sound-Flag erhalten
            mode,
            lastCount: names.length,
            lastNames: names,
          };
          if (mode === 'clock') {
            const { direction, difficulty, withBull } = opts;
            saveSettings({
              ...base,
              clockDirection: direction,
              clockDifficulty: difficulty,
              clockBull: withBull,
            });
            state = DartsClock.createGame(names, {
              direction,
              difficulty,
              withBull,
            });
            clearGame(); // keine veraltete X01-Partie hinterlassen
          } else {
            const { outMode, startScore } = opts;
            saveSettings({
              ...base,
              outMode,
              startScore,
              lastStartScore: startScore,
            });
            state = createGame(names, outMode, startScore);
          }
          resetAnimationState(state.players);
          persist(); // no-op im Clock-Modus (siehe persist())
          showGame();
          scrollTopSmooth();
        },
        onThemeChange: (mode) => {
          saveTheme(mode);
          applyTheme(mode);
        },
        onSoundChange: (on) => {
          soundEnabled = on;
          const s = loadSettings();
          s.sound = on;
          saveSettings(s);
          // Beim Einschalten kurz vorhören – entsperrt zugleich den Audio-
          // Kontext, weil wir noch in der Nutzergeste des Taps sind.
          if (on) playSound('click');
        },
        onResetTraining: () => {
          clearTraining();
          showSetup();
        },
        onResetClock: () => {
          clearClockRuns();
          showSetup();
        },
      },
      loadTraining(),
      loadClockRuns(),
      APP_VERSION
    );
    // Genau einmal, synchron, an den Anfang – ohne rAF-Nachzügler, der den
    // ersten Tap auf „Spiel starten" verschluckt hat.
    window.scrollTo(0, 0);
  }

  function showGame() {
    renderGame(root, state, {
      onDart: (dart) => {
        if (state.mode === 'clock') {
          const before = state.players[state.currentPlayerIdx].targetIdx;
          DartsClock.recordDart(state, dart);
          const advanced =
            state.players[state.currentPlayerIdx].targetIdx > before;
          // Solo-Aufzeichnung: nur 1 Spieler:in, genau einmal pro Sieg.
          if (
            state.winnerIdx !== null &&
            state.players.length === 1 &&
            !state.statRecorded
          ) {
            const player = state.players[0];
            const darts = DartsClock.dartsUsed(
              player,
              state.currentTurnDarts.length
            );
            saveClockRun({
              date: new Date().toISOString(),
              direction: state.direction,
              difficulty: state.difficulty,
              withBull: state.withBull,
              targets: state.sequence.length,
              darts,
            });
            state.statRecorded = true;
          }
          if (state.winnerIdx !== null) {
            haptic([100, 50, 100, 50, 200]);
            playSound('win');
          } else if (advanced) {
            haptic(12);
            playSound('click');
          } else {
            haptic(12);
            playSound('miss'); // Ziel nicht getroffen
          }
          showGame();
          scrollTopSmooth();
          return;
        }
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
        if (state.winnerIdx !== null) {
          haptic([100, 50, 100, 50, 200]);
          playSound('win');
        } else if (state.bust) {
          haptic([60, 40, 60]);
          playSound('bust');
        } else {
          haptic(12);
          // „Miss" (0 Punkte) bekommt einen eigenen, ärgerlicheren Sound.
          playSound(dart && dart.value === 0 ? 'miss' : 'click');
        }
        showGame();
        scrollTopSmooth();
      },
      onUndo: () => {
        if (state.mode === 'clock') {
          DartsClock.undoLastDart(state);
          // Undo-Guard fürs Clock-Solo: Siegerwurf zurück → Lauf-Eintrag weg.
          if (
            state.statRecorded &&
            state.winnerIdx === null &&
            state.players.length === 1
          ) {
            removeLatestClockRun();
            state.statRecorded = false;
          }
          haptic(8);
          showGame();
          scrollTopSmooth();
          return;
        }
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
        engine(state).replaceDart(state, index, dart);
        persist();
        haptic(8);
        showGame();
      },
      onEndTurn: () => {
        if (engine(state).turnIsOver(state)) {
          engine(state).endTurn(state);
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
  if (
    saved &&
    saved.players &&
    saved.winnerIdx === null &&
    saved.mode !== 'clock'
  ) {
    state = saved;
    if (!state.mode) state.mode = 'x01';
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
