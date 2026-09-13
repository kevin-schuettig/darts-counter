const DartsGame = (() => {
  const START_SCORE = 501;
  const START_SCORES = [101, 301, 501, 701];
  const MAX_DARTS_PER_TURN = 3;

  // Rest-Scores, die im Double-Out prinzipiell nicht in einer Aufnahme
  // ausgemacht werden koennen ("Bogey"-Zahlen) -> nie ein Vorschlag.
  const BOGEY_SCORES = new Set([169, 168, 166, 165, 163, 162, 159]);

  // Feste Lookup-Tabelle mit Standard-/Lehrbuch-Checkouts fuer Double-Out
  // (2..170, ohne Bogeys). Labels sind reine Anzeige-Strings; das Finish
  // endet immer auf einem Doppel (D1..D20) oder dem Doppel-Bull ("Bull",
  // = 50). Automatisch generiert und arithmetisch validiert.
  const CHECKOUTS = {
    2: ['D1'],
    3: ['1', 'D1'],
    4: ['D2'],
    5: ['1', 'D2'],
    6: ['D3'],
    7: ['3', 'D2'],
    8: ['D4'],
    9: ['1', 'D4'],
    10: ['D5'],
    11: ['3', 'D4'],
    12: ['D6'],
    13: ['5', 'D4'],
    14: ['D7'],
    15: ['7', 'D4'],
    16: ['D8'],
    17: ['1', 'D8'],
    18: ['D9'],
    19: ['3', 'D8'],
    20: ['D10'],
    21: ['1', 'D10'],
    22: ['D11'],
    23: ['3', 'D10'],
    24: ['D12'],
    25: ['1', 'D12'],
    26: ['D13'],
    27: ['3', 'D12'],
    28: ['D14'],
    29: ['5', 'D12'],
    30: ['D15'],
    31: ['7', 'D12'],
    32: ['D16'],
    33: ['1', 'D16'],
    34: ['D17'],
    35: ['3', 'D16'],
    36: ['D18'],
    37: ['5', 'D16'],
    38: ['D19'],
    39: ['7', 'D16'],
    40: ['D20'],
    41: ['1', 'D20'],
    42: ['2', 'D20'],
    43: ['3', 'D20'],
    44: ['4', 'D20'],
    45: ['5', 'D20'],
    46: ['6', 'D20'],
    47: ['7', 'D20'],
    48: ['8', 'D20'],
    49: ['9', 'D20'],
    50: ['Bullseye'],
    51: ['11', 'D20'],
    52: ['12', 'D20'],
    53: ['13', 'D20'],
    54: ['14', 'D20'],
    55: ['15', 'D20'],
    56: ['16', 'D20'],
    57: ['17', 'D20'],
    58: ['18', 'D20'],
    59: ['19', 'D20'],
    60: ['20', 'D20'],
    61: ['T7', 'D20'],
    62: ['T10', 'D16'],
    63: ['T9', 'D18'],
    64: ['T8', 'D20'],
    65: ['T11', 'D16'],
    66: ['T10', 'D18'],
    67: ['T9', 'D20'],
    68: ['T12', 'D16'],
    69: ['T11', 'D18'],
    70: ['T10', 'D20'],
    71: ['T13', 'D16'],
    72: ['T12', 'D18'],
    73: ['T11', 'D20'],
    74: ['T14', 'D16'],
    75: ['T13', 'D18'],
    76: ['T12', 'D20'],
    77: ['T15', 'D16'],
    78: ['T14', 'D18'],
    79: ['T13', 'D20'],
    80: ['T16', 'D16'],
    81: ['T15', 'D18'],
    82: ['T14', 'D20'],
    83: ['T17', 'D16'],
    84: ['T16', 'D18'],
    85: ['T15', 'D20'],
    86: ['T18', 'D16'],
    87: ['T17', 'D18'],
    88: ['T16', 'D20'],
    89: ['T19', 'D16'],
    90: ['T18', 'D18'],
    91: ['T17', 'D20'],
    92: ['T20', 'D16'],
    93: ['T19', 'D18'],
    94: ['T18', 'D20'],
    95: ['T19', 'D19'],
    96: ['T20', 'D18'],
    97: ['T19', 'D20'],
    98: ['T20', 'D19'],
    99: ['T20', '7', 'D16'],
    100: ['T20', 'D20'],
    101: ['T17', 'Bull'],
    102: ['T20', '2', 'D20'],
    103: ['T20', '3', 'D20'],
    104: ['T18', 'Bull'],
    105: ['T20', '5', 'D20'],
    106: ['T20', '6', 'D20'],
    107: ['T19', 'Bull'],
    108: ['T20', '8', 'D20'],
    109: ['T20', '9', 'D20'],
    110: ['T20', 'Bull'],
    111: ['T20', '11', 'D20'],
    112: ['T20', '12', 'D20'],
    113: ['T20', '13', 'D20'],
    114: ['T20', '14', 'D20'],
    115: ['T20', '15', 'D20'],
    116: ['T20', '16', 'D20'],
    117: ['T20', '17', 'D20'],
    118: ['T20', '18', 'D20'],
    119: ['T20', '19', 'D20'],
    120: ['T20', '20', 'D20'],
    121: ['T20', 'T7', 'D20'],
    122: ['T20', 'T10', 'D16'],
    123: ['T20', 'T9', 'D18'],
    124: ['T20', 'T8', 'D20'],
    125: ['T20', 'T11', 'D16'],
    126: ['T20', 'T10', 'D18'],
    127: ['T20', 'T9', 'D20'],
    128: ['T20', 'T12', 'D16'],
    129: ['T20', 'T11', 'D18'],
    130: ['T20', 'T10', 'D20'],
    131: ['T20', 'T13', 'D16'],
    132: ['T20', 'T12', 'D18'],
    133: ['T20', 'T11', 'D20'],
    134: ['T20', 'T14', 'D16'],
    135: ['T20', 'T13', 'D18'],
    136: ['T20', 'T12', 'D20'],
    137: ['T20', 'T15', 'D16'],
    138: ['T20', 'T14', 'D18'],
    139: ['T20', 'T13', 'D20'],
    140: ['T20', 'T16', 'D16'],
    141: ['T20', 'T15', 'D18'],
    142: ['T20', 'T14', 'D20'],
    143: ['T20', 'T17', 'D16'],
    144: ['T20', 'T16', 'D18'],
    145: ['T20', 'T15', 'D20'],
    146: ['T20', 'T18', 'D16'],
    147: ['T20', 'T17', 'D18'],
    148: ['T20', 'T16', 'D20'],
    149: ['T20', 'T19', 'D16'],
    150: ['T20', 'T18', 'D18'],
    151: ['T20', 'T17', 'D20'],
    152: ['T20', 'T20', 'D16'],
    153: ['T20', 'T19', 'D18'],
    154: ['T20', 'T18', 'D20'],
    155: ['T20', 'T19', 'D19'],
    156: ['T20', 'T20', 'D18'],
    157: ['T20', 'T19', 'D20'],
    158: ['T20', 'T20', 'D19'],
    160: ['T20', 'T20', 'D20'],
    161: ['T20', 'T17', 'Bull'],
    164: ['T20', 'T18', 'Bull'],
    167: ['T20', 'T19', 'Bull'],
    170: ['T20', 'T20', 'Bull'],
  };

  // Reine Funktion: liefert die Checkout-Route fuer einen Rest-Score, wenn ein
  // gueltiger Double-Out-Weg existiert, der in <= dartsLeft Darts endet.
  // Sonst null. Kein State, keine DOM-Zugriffe.
  function checkoutRoute(score, dartsLeft) {
    if (!Number.isFinite(score) || !Number.isFinite(dartsLeft)) return null;
    if (dartsLeft < 1) return null;
    if (score < 2 || score > 170) return null;
    if (BOGEY_SCORES.has(score)) return null;
    const route = CHECKOUTS[score];
    if (!route || route.length > dartsLeft) return null;
    return route.slice();
  }

  function createGame(playerNames, outMode = 'single', startScore = START_SCORE) {
    const start = START_SCORES.includes(startScore) ? startScore : START_SCORE;
    return {
      outMode,
      startScore: start,
      players: playerNames.map((name) => ({
        name,
        score: start,
        startScore: start,
        committedDarts: 0,
      })),
      currentPlayerIdx: 0,
      currentTurnDarts: [],
      scoreAtTurnStart: start,
      bust: false,
      winnerIdx: null,
      trainingRecorded: false,
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
    const base = player.startScore || START_SCORE;
    const scored = base - player.score;
    return (scored / totalDarts) * 3;
  }

  // Ersetzt einen einzelnen Wurf der laufenden Aufnahme (manuelle Korrektur)
  // und berechnet die Aufnahme komplett neu, damit Bust/Sieg konsistent bleiben.
  function replaceDart(state, index, dart) {
    if (index < 0 || index >= state.currentTurnDarts.length) return state;
    const darts = state.currentTurnDarts.slice();
    if (dart == null) darts.splice(index, 1);
    else darts[index] = dart;

    state.currentTurnDarts = [];
    state.bust = false;
    state.winnerIdx = null;
    state.players[state.currentPlayerIdx].score = state.scoreAtTurnStart;
    for (const d of darts) recordDart(state, d);
    return state;
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
    START_SCORES,
    MAX_DARTS_PER_TURN,
    createGame,
    dartScore,
    isDouble,
    dartLabel,
    turnPoints,
    canRecordDart,
    recordDart,
    undoLastDart,
    replaceDart,
    endTurn,
    turnIsOver,
    averageThreeDart,
    checkoutRoute,
  };
})();
