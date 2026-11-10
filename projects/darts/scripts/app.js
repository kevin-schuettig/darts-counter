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
  const APP_VERSION = 'v14';

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
  // Töne werden komplett im Code erzeugt (keine Audiodatei → kein Ladeverzug).
  //
  // Zuverlässigkeit auf iOS:
  // - Der AudioContext läuft erst nach einer echten Nutzergeste. Wir
  //   entsperren ihn bei JEDEM Tap (unlockAudio), nicht nur beim ersten –
  //   nach App-Wechsel/Sperrbildschirm steht er sonst auf „suspended" bzw.
  //   „interrupted" und bleibt stumm. Lässt er sich nicht wecken (z. B.
  //   nachdem eine andere App die Audio-Ausgabe belegt hatte), wird er
  //   verworfen und neu angelegt.
  // - Audio-Session „ambient": Die Töne mischen sich mit Musik aus anderen
  //   Apps (Spotify & Co. laufen weiter). Bewusste Entscheidung (v14): Der
  //   iOS-Stumm-Schalter macht die Töne dann leise. „playback" (ignoriert
  //   den Stumm-Schalter) blockiert sich mit fremder Musik – getestet in v13.
  // - Lautstärke: hohe Pegel + Kompressor als Begrenzer.
  let audioCtx = null;
  let masterIn = null;

  function recreateAudioCtx() {
    try {
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
    } catch {}
    audioCtx = null;
    masterIn = null;
    getAudioCtx();
  }

  function getAudioCtx() {
    if (audioCtx && audioCtx.state !== 'closed') return audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      // Signalkette: Töne → Master-Gain → Kompressor (Begrenzer) → Ausgang.
      const master = audioCtx.createGain();
      master.gain.value = 1.0;
      const limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      master.connect(limiter).connect(audioCtx.destination);
      masterIn = master;
    } catch {
      audioCtx = null;
      masterIn = null;
    }
    return audioCtx;
  }

  // Neuere iOS-Versionen kennen navigator.audioSession: „ambient" = mischt
  // sich mit fremder Musik. Ohne API ist das ohnehin das Web-Audio-Verhalten.
  function applyAudioSession() {
    if (!(navigator.audioSession && 'type' in navigator.audioSession)) return;
    try {
      navigator.audioSession.type = 'ambient';
    } catch {}
  }

  // Bei jeder Nutzergeste: Kontext wecken. Klappt das nicht (bleibt
  // „interrupted"/„suspended" oder resume schlägt fehl), Kontext neu
  // anlegen – der nächste Tap startet ihn dann sauber.
  function unlockAudio() {
    if (!soundEnabled) return;
    applyAudioSession();
    const ctx = getAudioCtx();
    if (!ctx || ctx.state === 'running') return;
    try {
      const p = ctx.resume();
      if (p && p.then) {
        p.then(() => {
          if (ctx.state !== 'running') recreateAudioCtx();
        }).catch(recreateAudioCtx);
      }
    } catch {
      recreateAudioCtx();
    }
  }

  ['pointerdown', 'touchend', 'keydown'].forEach((type) => {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockAudio();
  });

  // kind: 'click' (Wurf) | 'miss' | 'bust' | 'win'
  function playSound(kind) {
    if (!soundEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx || !masterIn) return;
    if (ctx.state !== 'running') {
      try {
        ctx.resume();
      } catch {}
    }
    // Kleiner Vorlauf, damit der erste Ton nach dem Aufwecken nicht
    // abgeschnitten wird.
    const t0 = ctx.currentTime + 0.01;

    // Ton aus Grundwelle + leiser Oktave (mehr „Körper" auf Handy-Lautsprechern).
    const tone = (freqStart, freqEnd, startAt, dur, peak, type) => {
      [
        [1, 1],
        [2, 0.35],
      ].forEach(([mult, level]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'triangle';
        osc.frequency.setValueAtTime(freqStart * mult, startAt);
        if (freqEnd && freqEnd !== freqStart) {
          osc.frequency.exponentialRampToValueAtTime(
            freqEnd * mult,
            startAt + dur
          );
        }
        const p = Math.max(0.0002, peak * level);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(p, startAt + 0.005);
        gain.gain.setValueAtTime(p, startAt + dur * 0.35);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
        osc.connect(gain).connect(masterIn);
        osc.start(startAt);
        osc.stop(startAt + dur + 0.03);
      });
    };

    if (kind === 'win') {
      tone(660, 660, t0, 0.14, 0.9);
      tone(880, 880, t0 + 0.13, 0.14, 0.9);
      tone(1320, 1320, t0 + 0.26, 0.28, 0.9);
    } else if (kind === 'bust') {
      tone(220, 110, t0, 0.3, 1.0, 'sawtooth');
    } else if (kind === 'miss') {
      // „Ärgerlicher" Downer: absteigendes Wah-Wah, rauer Sägezahn.
      tone(320, 230, t0, 0.15, 0.8, 'sawtooth');
      tone(230, 150, t0 + 0.14, 0.26, 0.8, 'sawtooth');
    } else {
      tone(520, 340, t0, 0.09, 0.9); // kräftiger Klick/Tock
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
          // Beim Einschalten kurz vorhören – entsperrt zugleich den
          // Kontext (wir sind noch in der Nutzergeste).
          if (on) {
            unlockAudio();
            playSound('click');
          }
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
