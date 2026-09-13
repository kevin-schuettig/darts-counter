const DartsGame = (() => {
  const START_SCORE = 501;
  const MAX_DARTS_PER_TURN = 3;

  function createGame(playerNames, outMode = 'single') {
    return {
      outMode,
      players: playerNames.map((name) => ({
        name,
        score: START_SCORE,
        committedDarts: 0,
      })),
      currentPlayerIdx: 0,
      currentTurnDarts: [],
      scoreAtTurnStart: START_SCORE,
      bust: false,
      winnerIdx: null,
    };
  }

  function dartScore(dart) {
    return dart.value * dart.multiplier;
  }

  function isDouble(dart) {
    return dart.multiplier === 2;
  }

  function dartLabel(dart) {
    if (dart.value === 0) return 'Miss';
    if (dart.value === 25) return dart.multiplier === 2 ? 'Bullseye' : 'Bull';
    const prefix = dart.multiplier === 3 ? 'T' : dart.multiplier === 2 ? 'D' : '';
    return `${prefix}${dart.value}`;
  }

  function turnPoints(state) {
    return state.currentTurnDarts.reduce((sum, d) => sum + dartScore(d), 0);
  }

  function canRecordDart(state) {
    return (
      state.winnerIdx === null &&
      !state.bust &&
      state.currentTurnDarts.length < MAX_DARTS_PER_TURN
    );
  }

  function recordDart(state, dart) {
    if (!canRecordDart(state)) return state;

    const player = state.players[state.currentPlayerIdx];
    const newScore = player.score - dartScore(dart);
    state.currentTurnDarts.push(dart);

    if (newScore === 0) {
      if (state.outMode === 'double' && !isDouble(dart)) {
        state.bust = true;
        player.score = state.scoreAtTurnStart;
        return state;
      }
      player.score = 0;
      state.winnerIdx = state.currentPlayerIdx;
      return state;
    }

    if (newScore < 0 || (state.outMode === 'double' && newScore === 1)) {
      state.bust = true;
      player.score = state.scoreAtTurnStart;
      return state;
    }

    player.score = newScore;
    return state;
  }

  function undoLastDart(state) {
    if (state.currentTurnDarts.length === 0) return state;

    state.currentTurnDarts.pop();
    state.bust = false;
    state.winnerIdx = null;
    state.players[state.currentPlayerIdx].score = state.scoreAtTurnStart;

    const darts = state.currentTurnDarts.slice();
    state.currentTurnDarts = [];
    for (const d of darts) recordDart(state, d);

    return state;
  }

  function endTurn(state) {
    if (state.winnerIdx !== null) return state;
    state.players[state.currentPlayerIdx].committedDarts +=
      state.currentTurnDarts.length;
    state.currentTurnDarts = [];
    state.bust = false;
    state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;
    state.scoreAtTurnStart = state.players[state.currentPlayerIdx].score;
    return state;
  }

  function averageThreeDart(player, currentTurnDarts = 0) {
    const totalDarts = player.committedDarts + currentTurnDarts;
    if (totalDarts === 0) return null;
    const scored = START_SCORE - player.score;
    return (scored / totalDarts) * 3;
  }

  function turnIsOver(state) {
    return (
      state.bust ||
      state.winnerIdx !== null ||
      state.currentTurnDarts.length >= MAX_DARTS_PER_TURN
    );
  }

  return {
    START_SCORE,
    MAX_DARTS_PER_TURN,
    createGame,
    dartScore,
    isDouble,
    dartLabel,
    turnPoints,
    canRecordDart,
    recordDart,
    undoLastDart,
    endTurn,
    turnIsOver,
    averageThreeDart,
  };
})();
