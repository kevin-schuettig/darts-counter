// Spielmodus „Around the Clock" — eigene, von X01 unabhängige Engine.
// Reine Logik & State, KEINE DOM-Zugriffe (wie DartsGame). Jede:r Spieler:in
// trifft die Zielzahlen der Reihe nach; wer zuerst durch ist, gewinnt sofort.
const DartsClock = (() => {
  const MAX_DARTS_PER_TURN = 3;

  // Geordnete Zielliste. Ein Ziel ist eine Zahl 1..20 oder der String 'bull'.
  // - up:     1 … 20            (+ 'bull' am Ende)
  // - down:   20 … 1            (+ 'bull' am Ende)
  // - updown: 1 … 20 (+ 'bull') … 19 … 1   → Bull am Wendepunkt, Ende bei 1
  function buildSequence(direction, withBull) {
    const up = [];
    for (let n = 1; n <= 20; n++) up.push(n);

    let seq;
    if (direction === 'down') {
      seq = up.slice().reverse();
      if (withBull) seq.push('bull');
    } else if (direction === 'updown') {
      seq = up.slice();
      if (withBull) seq.push('bull');
      for (let n = 19; n >= 1; n--) seq.push(n);
    } else {
      // 'up' (Default)
      seq = up.slice();
      if (withBull) seq.push('bull');
    }
    return seq;
  }

  function createGame(playerNames, config = {}) {
    const direction = ['up', 'down', 'updown'].includes(config.direction)
      ? config.direction
      : 'up';
    const difficulty = ['all', 'single', 'double', 'triple'].includes(
      config.difficulty
    )
      ? config.difficulty
      : 'all';
    const withBull = config.withBull !== false;
    const sequence = buildSequence(direction, withBull);

    return {
      mode: 'clock',
      direction,
      difficulty,
      withBull,
      sequence,
      players: playerNames.map((name) => ({
        name,
        targetIdx: 0,
        committedDarts: 0,
        finished: false,
      })),
      currentPlayerIdx: 0,
      currentTurnDarts: [],
      targetIdxAtTurnStart: 0,
      winnerIdx: null,
      statRecorded: false,
    };
  }

  // Zählt dieser Wurf als Treffer des aktuellen Ziels (je nach Schwierigkeit)?
  function dartHitsTarget(dart, target, difficulty) {
    if (!dart || dart.value === 0) return false;
    // Bull-Ziel: jeder Bull-Treffer zählt (Bull 25 oder Bullseye 50) —
    // unabhängig von der Schwierigkeit (ein „Triple-Bull" existiert nicht).
    if (target === 'bull') return dart.value === 25;
    if (dart.value !== target) return false;
    if (difficulty === 'single') return dart.multiplier === 1;
    if (difficulty === 'double') return dart.multiplier === 2;
    if (difficulty === 'triple') return dart.multiplier === 3;
    return true; // 'all' → Single/Double/Triple der Zielzahl zählen
  }

  function currentTarget(state) {
    const p = state.players[state.currentPlayerIdx];
    return p ? state.sequence[p.targetIdx] : undefined;
  }

  // Anzeige-Label eines Ziels inkl. Schwierigkeits-Präfix (D7, T7, Bull, 7).
  function targetLabel(target, difficulty) {
    if (target === 'bull') return 'Bull';
    if (target == null) return '–';
    const prefix =
      difficulty === 'double' ? 'D' : difficulty === 'triple' ? 'T' : '';
    return `${prefix}${target}`;
  }

  function canRecordDart(state) {
    return (
      state.winnerIdx === null &&
      state.currentTurnDarts.length < MAX_DARTS_PER_TURN
    );
  }

  function recordDart(state, dart) {
    if (!canRecordDart(state)) return state;
    const player = state.players[state.currentPlayerIdx];
    state.currentTurnDarts.push(dart);

    const target = state.sequence[player.targetIdx];
    if (dartHitsTarget(dart, target, state.difficulty)) {
      player.targetIdx += 1;
      if (player.targetIdx >= state.sequence.length) {
        player.targetIdx = state.sequence.length;
        player.finished = true;
        state.winnerIdx = state.currentPlayerIdx; // Sofort-Sieg
      }
    }
    return state;
  }

  // Undo: letzten Wurf entfernen, Ziel auf Aufnahme-Start zurück, Rest neu
  // abspielen (gleiches Muster wie DartsGame.undoLastDart).
  function undoLastDart(state) {
    if (state.currentTurnDarts.length === 0) return state;
    state.currentTurnDarts.pop();

    const player = state.players[state.currentPlayerIdx];
    player.targetIdx = state.targetIdxAtTurnStart;
    player.finished = false;
    state.winnerIdx = null;

    const darts = state.currentTurnDarts.slice();
    state.currentTurnDarts = [];
    for (const d of darts) recordDart(state, d);
    return state;
  }

  // Einzelnen Wurf der laufenden Aufnahme ersetzen/entfernen (Parität zu X01).
  function replaceDart(state, index, dart) {
    if (index < 0 || index >= state.currentTurnDarts.length) return state;
    const darts = state.currentTurnDarts.slice();
    if (dart == null) darts.splice(index, 1);
    else darts[index] = dart;

    const player = state.players[state.currentPlayerIdx];
    player.targetIdx = state.targetIdxAtTurnStart;
    player.finished = false;
    state.winnerIdx = null;
    state.currentTurnDarts = [];
    for (const d of darts) recordDart(state, d);
    return state;
  }

  function endTurn(state) {
    if (state.winnerIdx !== null) return state;
    const player = state.players[state.currentPlayerIdx];
    player.committedDarts += state.currentTurnDarts.length;
    state.currentTurnDarts = [];
    state.currentPlayerIdx =
      (state.currentPlayerIdx + 1) % state.players.length;
    state.targetIdxAtTurnStart =
      state.players[state.currentPlayerIdx].targetIdx;
    return state;
  }

  function turnIsOver(state) {
    return (
      state.winnerIdx !== null ||
      state.currentTurnDarts.length >= MAX_DARTS_PER_TURN
    );
  }

  function dartsUsed(player, currentTurnDarts = 0) {
    return player.committedDarts + currentTurnDarts;
  }

  return {
    MAX_DARTS_PER_TURN,
    buildSequence,
    createGame,
    recordDart,
    undoLastDart,
    replaceDart,
    endTurn,
    turnIsOver,
    canRecordDart,
    dartHitsTarget,
    currentTarget,
    targetLabel,
    dartsUsed,
  };
})();
