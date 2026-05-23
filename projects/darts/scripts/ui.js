const DartsUI = (() => {
  const { dartLabel, turnPoints, averageThreeDart, MAX_DARTS_PER_TURN } =
    DartsGame;

  let armedMultiplier = 1;
  let lastTurnDartsLength = 0;
  let lastPlayerIdx = -1;
  let lastBust = false;
  let lastScoresShown = [];

  function resetAnimationState(players) {
    lastTurnDartsLength = 0;
    lastPlayerIdx = -1;
    lastBust = false;
    lastScoresShown = players ? players.map((p) => p.score) : [];
  }

  function tweenNumber(el, from, to, duration = 240) {
    if (from === to || !el) return;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function renderSetup(root, settings, onStart) {
    armedMultiplier = 1;
    resetAnimationState(null);
    const defaultOut = settings.outMode === 'double' ? 'double' : 'single';
    const defaultCount = settings.lastCount || 2;
    const lastNames = settings.lastNames || [];

    root.innerHTML = `
      <section class="setup">
        <h1>Schü's Darts Counter</h1>
        <form id="setup-form" novalidate>
          <fieldset>
            <legend>Spieler:innen</legend>
            <div class="seg" role="radiogroup">
              ${[1, 2, 3, 4]
                .map(
                  (n) => `
                <label class="seg-item">
                  <input type="radio" name="count" value="${n}" ${
                    n === defaultCount ? 'checked' : ''
                  }>
                  <span>${n}</span>
                </label>`
                )
                .join('')}
            </div>
          </fieldset>

          <fieldset id="names-box" class="names"></fieldset>

          <fieldset>
            <legend>Out-Modus</legend>
            <div class="seg" role="radiogroup">
              <label class="seg-item">
                <input type="radio" name="out" value="single" ${
                  defaultOut === 'single' ? 'checked' : ''
                }>
                <span>Single-Out</span>
              </label>
              <label class="seg-item">
                <input type="radio" name="out" value="double" ${
                  defaultOut === 'double' ? 'checked' : ''
                }>
                <span>Double-Out</span>
              </label>
            </div>
          </fieldset>

          <button type="submit" class="btn btn-primary btn-big">Spiel starten</button>
        </form>
      </section>
    `;

    const form = root.querySelector('#setup-form');
    const namesBox = root.querySelector('#names-box');

    function renderNames(count) {
      namesBox.innerHTML = Array.from({ length: count }, (_, i) => {
        const v = lastNames[i] || `Spieler ${i + 1}`;
        return `
          <label class="name-row">
            <span class="name-label">${i + 1}</span>
            <input type="text" name="name-${i}" value="${escapeAttr(v)}"
                   autocomplete="off" autocapitalize="words" spellcheck="false"
                   inputmode="text" maxlength="20">
          </label>`;
      }).join('');
    }
    renderNames(defaultCount);

    form.addEventListener('change', (e) => {
      if (e.target.name === 'count') renderNames(+e.target.value);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const count = +fd.get('count');
      const outMode = fd.get('out');
      const names = Array.from({ length: count }, (_, i) => {
        const v = (fd.get(`name-${i}`) || '').toString().trim();
        return v || `Spieler ${i + 1}`;
      });
      onStart({ names, outMode });
    });
  }

  function renderGame(root, state, handlers) {
    const curIdx = state.currentPlayerIdx;
    const hasWinner = state.winnerIdx !== null;
    const canRecord =
      !state.bust &&
      !hasWinner &&
      state.currentTurnDarts.length < MAX_DARTS_PER_TURN;
    const turnTotal = turnPoints(state);

    if (lastScoresShown.length !== state.players.length) {
      lastScoresShown = state.players.map((p) => p.score);
    }

    const newDartAdded =
      state.currentPlayerIdx === lastPlayerIdx &&
      state.currentTurnDarts.length === lastTurnDartsLength + 1;
    const justFilledIdx = newDartAdded
      ? state.currentTurnDarts.length - 1
      : -1;
    const justBusted = state.bust && !lastBust;

    const slots = Array.from({ length: MAX_DARTS_PER_TURN }, (_, i) => {
      const d = state.currentTurnDarts[i];
      const cls = ['slot'];
      if (d) cls.push('filled');
      if (i === justFilledIdx) cls.push('just-filled');
      return `<div class="${cls.join(' ')}">${d ? dartLabel(d) : ''}</div>`;
    }).join('');

    const scoreboard = state.players
      .map((p, i) => {
        const isCurrent = i === curIdx && !hasWinner;
        const isWinner = state.winnerIdx === i;
        const flashes = isCurrent && justBusted;
        const classes = [
          'player',
          isCurrent ? 'active' : '',
          isWinner ? 'winner' : '',
          flashes ? 'bust-flash' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const liveDarts = i === curIdx ? state.currentTurnDarts.length : 0;
        const avg = averageThreeDart(p, liveDarts);
        const avgLabel =
          avg === null ? 'Ø –' : `Ø ${avg.toFixed(2)}`;
        const displayedScore =
          lastScoresShown[i] != null ? lastScoresShown[i] : p.score;
        return `
          <div class="${classes}" data-pidx="${i}">
            <div class="pname">${escapeHtml(p.name)}</div>
            <div class="pscore">${displayedScore}</div>
            <div class="pavg">${avgLabel}</div>
          </div>`;
      })
      .join('');

    let statusLine;
    if (hasWinner) {
      statusLine = `<span class="status status-win">🏆 ${escapeHtml(
        state.players[state.winnerIdx].name
      )} gewinnt!</span>`;
    } else if (state.bust) {
      statusLine = `<span class="status status-bust">BUST</span>`;
    } else {
      statusLine = `<span class="status">Wurf ${state.currentTurnDarts.length}/3 · ${turnTotal} Punkte</span>`;
    }

    const multipliers = [1, 2, 3]
      .map((m) => {
        const label = m === 1 ? 'Single' : m === 2 ? 'Double' : 'Triple';
        const on = armedMultiplier === m ? 'on' : '';
        return `<button type="button" class="mult ${on}" data-m="${m}" ${
          canRecord ? '' : 'disabled'
        }>${label}</button>`;
      })
      .join('');

    const numpadButtons = Array.from({ length: 20 }, (_, i) => {
      const n = i + 1;
      return `<button type="button" class="num" data-n="${n}" ${
        canRecord ? '' : 'disabled'
      }>${n}</button>`;
    }).join('');
    const numpad = `<div class="numpad mode-${armedMultiplier}">${numpadButtons}</div>`;

    const specials = `
      <button type="button" class="spec" data-special="miss" ${canRecord ? '' : 'disabled'}>Miss</button>
      <button type="button" class="spec" data-special="bull" ${canRecord ? '' : 'disabled'}>Bull <small>25</small></button>
      <button type="button" class="spec" data-special="bullseye" ${canRecord ? '' : 'disabled'}>Bullseye <small>50</small></button>
    `;

    const undoDisabled = state.currentTurnDarts.length === 0;
    const endDisabled =
      !hasWinner &&
      !state.bust &&
      state.currentTurnDarts.length < MAX_DARTS_PER_TURN;

    const actionRow = hasWinner
      ? `
        <button type="button" class="btn btn-secondary" id="btn-undo" ${undoDisabled ? 'disabled' : ''}>↶ Undo</button>
        <button type="button" class="btn btn-primary" id="btn-newgame">Neues Spiel</button>`
      : `
        <button type="button" class="btn btn-secondary" id="btn-undo" ${undoDisabled ? 'disabled' : ''}>↶ Undo</button>
        <button type="button" class="btn btn-primary" id="btn-end" ${endDisabled ? 'disabled' : ''}>Weiter</button>`;

    root.innerHTML = `
      <section class="game">
        <header class="scoreboard players-${state.players.length}">
          ${scoreboard}
        </header>

        <div class="turn">
          <div class="slots">${slots}</div>
          <div class="status-line">${statusLine}</div>
        </div>

        ${
          hasWinner
            ? ''
            : `
          <div class="multipliers">${multipliers}</div>
          ${numpad}
          <div class="specials">${specials}</div>
        `
        }

        <div class="actions">${actionRow}</div>

        <footer class="game-footer">
          <button type="button" class="link" id="btn-quit">Spiel beenden</button>
          <span class="mode-tag">${state.outMode === 'double' ? 'Double-Out' : 'Single-Out'}</span>
        </footer>
      </section>
    `;

    state.players.forEach((p, i) => {
      const prev = lastScoresShown[i];
      const cur = p.score;
      const scoreEl = root.querySelector(
        `.player[data-pidx="${i}"] .pscore`
      );
      if (scoreEl && typeof prev === 'number' && prev !== cur) {
        tweenNumber(scoreEl, prev, cur);
      }
      lastScoresShown[i] = cur;
    });

    lastTurnDartsLength = state.currentTurnDarts.length;
    lastPlayerIdx = state.currentPlayerIdx;
    lastBust = state.bust;

    if (canRecord) {
      root.querySelectorAll('.mult').forEach((btn) => {
        btn.addEventListener('click', () => {
          armedMultiplier = +btn.dataset.m;
          root.querySelectorAll('.mult').forEach((b) =>
            b.classList.toggle('on', +b.dataset.m === armedMultiplier)
          );
          const numpadEl = root.querySelector('.numpad');
          if (numpadEl) numpadEl.className = `numpad mode-${armedMultiplier}`;
        });
      });

      root.querySelectorAll('.num').forEach((btn) => {
        btn.addEventListener('click', () => {
          const n = +btn.dataset.n;
          const m = armedMultiplier;
          armedMultiplier = 1;
          handlers.onDart({ value: n, multiplier: m });
        });
      });

      root.querySelectorAll('.spec').forEach((btn) => {
        btn.addEventListener('click', () => {
          const s = btn.dataset.special;
          let dart;
          if (s === 'miss') dart = { value: 0, multiplier: 1 };
          else if (s === 'bull') dart = { value: 25, multiplier: 1 };
          else dart = { value: 25, multiplier: 2 };
          armedMultiplier = 1;
          handlers.onDart(dart);
        });
      });
    }

    const undoBtn = root.querySelector('#btn-undo');
    if (undoBtn)
      undoBtn.addEventListener('click', () => {
        armedMultiplier = 1;
        handlers.onUndo();
      });

    const endBtn = root.querySelector('#btn-end');
    if (endBtn)
      endBtn.addEventListener('click', () => {
        armedMultiplier = 1;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        handlers.onEndTurn();
      });

    const newGameBtn = root.querySelector('#btn-newgame');
    if (newGameBtn) newGameBtn.addEventListener('click', handlers.onNewGame);

    root.querySelector('#btn-quit').addEventListener('click', () => {
      if (hasWinner || confirm('Spiel wirklich beenden?')) handlers.onNewGame();
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c]);
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  return { renderSetup, renderGame, resetAnimationState };
})();
