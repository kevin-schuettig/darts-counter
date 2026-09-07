const DartsUI = (() => {
  const {
    dartLabel,
    dartScore,
    turnPoints,
    averageThreeDart,
    MAX_DARTS_PER_TURN,
  } = DartsGame;

  let armedMultiplier = 1;
  let lastTurnDartsLength = 0;
  let lastPlayerIdx = -1;
  let lastBust = false;
  let lastTurnOver = false;
  let lastScoresShown = [];

  function resetAnimationState(players) {
    lastTurnDartsLength = 0;
    lastPlayerIdx = -1;
    lastBust = false;
    lastTurnOver = false;
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

  const START_SCORE_OPTIONS = [101, 301, 501, 701];

  const ICON = {
    grip:
      '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' +
      '<circle cx="7" cy="4" r="1.5"/><circle cx="7" cy="10" r="1.5"/><circle cx="7" cy="16" r="1.5"/>' +
      '<circle cx="13" cy="4" r="1.5"/><circle cx="13" cy="10" r="1.5"/><circle cx="13" cy="16" r="1.5"/></svg>',
    clear:
      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M6 6l8 8M14 6l-8 8"/></svg>',
    system:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
    light:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z"/></svg>',
  };

  function nameRowHtml(idx, value) {
    return `
      <div class="name-row" data-idx="${idx}">
        <button type="button" class="drag-handle" tabindex="-1" aria-label="Reihenfolge ändern">${ICON.grip}</button>
        <input type="text" placeholder="Spieler ${idx + 1}" value="${escapeAttr(value || '')}"
               autocomplete="off" autocapitalize="words" spellcheck="false"
               inputmode="text" enterkeyhint="done" maxlength="20">
        <button type="button" class="name-clear" tabindex="-1" aria-label="Eingabe löschen">${ICON.clear}</button>
      </div>`;
  }

  function renderSetup(root, settings, theme, handlers) {
    armedMultiplier = 1;
    resetAnimationState(null);

    const outMode = settings.outMode === 'double' ? 'double' : 'single';
    let count = Math.min(4, Math.max(1, settings.lastCount || 2));
    const startScore = START_SCORE_OPTIONS.includes(settings.lastStartScore)
      ? settings.lastStartScore
      : 501;
    const currentTheme = ['system', 'light', 'dark'].includes(theme)
      ? theme
      : 'system';

    // Quelle der Wahrheit für Namen (kann leer sein → Platzhalter greift).
    const names = (settings.lastNames || []).slice(0, 4);
    while (names.length < count) names.push('');

    const themeItem = (val, label) => `
      <label class="seg-item">
        <input type="radio" name="theme" value="${val}" ${
      val === currentTheme ? 'checked' : ''
    }>
        ${ICON[val]}
        <span>${label}</span>
      </label>`;

    root.innerHTML = `
      <section class="setup">
        <img src="./assets/icons/icon-192.png" alt="" class="setup-icon">
        <h1>Schü's Darts Counter</h1>
        <div id="setup-form">
          <fieldset>
            <legend>Spieler:innen</legend>
            <div class="seg" role="radiogroup">
              ${[1, 2, 3, 4]
                .map(
                  (n) => `
                <label class="seg-item">
                  <input type="radio" name="count" value="${n}" ${
                    n === count ? 'checked' : ''
                  }>
                  <span>${n}</span>
                </label>`
                )
                .join('')}
            </div>
          </fieldset>

          <fieldset id="names-box" class="names"></fieldset>

          <fieldset>
            <legend>Startpunkte</legend>
            <div class="field-select">
              <select name="startScore" aria-label="Startpunkte">
                ${START_SCORE_OPTIONS.map(
                  (s) =>
                    `<option value="${s}" ${
                      s === startScore ? 'selected' : ''
                    }>${s} Punkte</option>`
                ).join('')}
              </select>
            </div>
          </fieldset>

          <fieldset>
            <legend>Out-Modus</legend>
            <div class="seg" role="radiogroup">
              <label class="seg-item">
                <input type="radio" name="out" value="single" ${
                  outMode === 'single' ? 'checked' : ''
                }>
                <span>Single-Out</span>
              </label>
              <label class="seg-item">
                <input type="radio" name="out" value="double" ${
                  outMode === 'double' ? 'checked' : ''
                }>
                <span>Double-Out</span>
              </label>
            </div>
          </fieldset>

          <button type="button" id="start-btn" class="btn btn-primary btn-big">Spiel starten</button>
        </div>

        <div class="theme-switch">
          <span class="legend-row">Darstellung</span>
          <div class="theme-seg" role="radiogroup">
            ${themeItem('system', 'System')}
            ${themeItem('light', 'Hell')}
            ${themeItem('dark', 'Dunkel')}
          </div>
        </div>
      </section>
    `;

    const form = root.querySelector('#setup-form');
    const namesBox = root.querySelector('#names-box');
    const startBtn = root.querySelector('#start-btn');

    function rows() {
      return Array.from(namesBox.querySelectorAll('.name-row'));
    }

    function syncNamesFromDOM() {
      rows().forEach((row, i) => {
        const input = row.querySelector('input');
        names[i] = input.value;
      });
    }

    function renderNames() {
      namesBox.innerHTML = Array.from({ length: count }, (_, i) =>
        nameRowHtml(i, names[i])
      ).join('');
    }

    renderNames();

    // --- Spieleranzahl ---
    form.querySelectorAll('input[name="count"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        syncNamesFromDOM();
        count = +radio.value;
        while (names.length < count) names.push('');
        renderNames();
      });
    });

    // --- Löschen-X + Fokus-Sichtbarkeit (Delegation) ---
    function refreshClear(row) {
      const input = row.querySelector('input');
      const show = document.activeElement === input && !!input.value.trim();
      row.classList.toggle('can-clear', show);
    }

    namesBox.addEventListener('focusin', (e) => {
      const row = e.target.closest('.name-row');
      if (row) refreshClear(row);
    });
    namesBox.addEventListener('focusout', (e) => {
      const row = e.target.closest('.name-row');
      if (row) row.classList.remove('can-clear');
    });
    namesBox.addEventListener('input', (e) => {
      const row = e.target.closest('.name-row');
      if (!row) return;
      const i = rows().indexOf(row);
      if (i >= 0) names[i] = e.target.value;
      refreshClear(row);
    });

    // --- Pointer-Interaktion (Löschen-X + Drag-Handle) ---
    namesBox.addEventListener('pointerdown', (e) => {
      const clearBtn = e.target.closest('.name-clear');
      if (clearBtn) {
        e.preventDefault(); // Fokus im Feld halten (Tastatur bleibt offen)
        const row = clearBtn.closest('.name-row');
        const input = row.querySelector('input');
        const i = rows().indexOf(row);
        input.value = '';
        if (i >= 0) names[i] = '';
        row.classList.remove('can-clear');
        input.focus();
        return;
      }
      const handle = e.target.closest('.drag-handle');
      if (handle) startDrag(e, handle);
    });

    // --- Drag & Drop (pointer-basiert, touch-fähig) ---
    function startDrag(e, handle) {
      e.preventDefault();
      const active = document.activeElement;
      if (active && typeof active.blur === 'function') active.blur();

      syncNamesFromDOM();
      const rowEls = rows();
      const dragged = handle.closest('.name-row');
      let fromIdx = rowEls.indexOf(dragged);
      let toIdx = fromIdx;
      const rect = dragged.getBoundingClientRect();
      const step = rect.height + 8; // Zeilenhöhe + gap
      const startY = e.clientY;

      dragged.classList.add('dragging');
      rowEls.forEach((r) => {
        if (r !== dragged) r.classList.add('drag-shift');
      });

      try {
        handle.setPointerCapture(e.pointerId);
      } catch {}

      function onMove(ev) {
        const dy = ev.clientY - startY;
        dragged.style.transform = `translateY(${dy}px)`;
        let next = fromIdx + Math.round(dy / step);
        next = Math.max(0, Math.min(count - 1, next));
        if (next !== toIdx) {
          toIdx = next;
          rowEls.forEach((r, i) => {
            if (r === dragged) return;
            let shift = 0;
            if (fromIdx < toIdx && i > fromIdx && i <= toIdx) shift = -step;
            else if (fromIdx > toIdx && i >= toIdx && i < fromIdx) shift = step;
            r.style.transform = shift ? `translateY(${shift}px)` : '';
          });
        }
      }

      function onUp() {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        if (toIdx !== fromIdx) {
          const moved = names.splice(fromIdx, 1)[0];
          names.splice(toIdx, 0, moved);
        }
        renderNames(); // setzt Transforms/Klassen sauber zurück
      }

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    }

    // --- Theme-Umschalter ---
    root.querySelectorAll('input[name="theme"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) handlers.onThemeChange(radio.value);
      });
    });

    // --- Spiel starten (robust gegen den ersten-Tap-Bug) ---
    let started = false;
    function doStart() {
      if (started) return;
      started = true;
      syncNamesFromDOM();
      const finalNames = Array.from(
        { length: count },
        (_, i) => (names[i] || '').trim() || `Spieler ${i + 1}`
      );
      const out = form.querySelector('input[name="out"]:checked');
      const sel = form.querySelector('select[name="startScore"]');
      handlers.onStart({
        names: finalNames,
        outMode: out ? out.value : 'single',
        startScore: sel ? +sel.value : 501,
      });
    }

    // Kern-Fix des „erster Klick verpufft"-Bugs:
    // Beim mousedown würde der Button Fokus bekommen → Safari scrollt ihn „in
    // die Ansicht" → alles rutscht nach oben, der Button wandert unter dem
    // Cursor weg, mouseup landet auf einem anderen Element → click feuert nicht.
    // preventDefault auf mousedown verhindert genau diesen Fokus-Scroll; der
    // click bleibt erhalten. (Kein <form>/type=submit und kein pointerup mehr.)
    startBtn.addEventListener('mousedown', (e) => e.preventDefault());
    startBtn.addEventListener('click', doStart);

    // Enter im Namensfeld startet ebenfalls.
    namesBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input')) {
        e.preventDefault();
        doStart();
      }
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
      if (!d) return `<div class="slot"></div>`;
      const cls = ['slot', 'filled', 'editable'];
      if (i === justFilledIdx) cls.push('just-filled');
      return `<button type="button" class="${cls.join(
        ' '
      )}" data-slot="${i}" aria-label="Wurf ${i + 1} korrigieren">${dartLabel(
        d
      )}</button>`;
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
      <button type="button" class="spec" data-special="miss" ${canRecord ? '' : 'disabled'}>Miss <small>0</small></button>
      <button type="button" class="spec" data-special="bull" ${canRecord ? '' : 'disabled'}>Bull <small>25</small></button>
      <button type="button" class="spec" data-special="bullseye" ${canRecord ? '' : 'disabled'}>Bullseye <small>50</small></button>
    `;

    const undoDisabled = state.currentTurnDarts.length === 0;
    const turnOver =
      hasWinner ||
      state.bust ||
      state.currentTurnDarts.length >= MAX_DARTS_PER_TURN;
    // „Hereinfahren" nur beim Übergang von „läuft noch" → „fertig".
    const slideIn = turnOver && !lastTurnOver;

    const primaryBtn = hasWinner
      ? `<button type="button" class="btn btn-primary btn-weiter" id="btn-newgame">Neues Spiel</button>`
      : `<button type="button" class="btn btn-primary btn-weiter" id="btn-end">Weiter</button>`;

    const quitBtn = hasWinner
      ? ''
      : `<button type="button" class="btn btn-secondary btn-quit" id="btn-quit">Spiel beenden</button>`;

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
          <div class="input-group">
            <div class="multipliers tab-strip">${multipliers}</div>
            ${numpad}
          </div>
          <div class="specials">${specials}</div>
        `
        }

        <div class="action-row">
          <button type="button" class="btn btn-secondary btn-icon" id="btn-undo" ${
            undoDisabled ? 'disabled' : ''
          } aria-label="Letzten Wurf rückgängig">↶</button>
          ${quitBtn}
        </div>
        <div class="mode-caption">${
          state.outMode === 'double' ? 'Double-Out' : 'Single-Out'
        }</div>

        <div class="primary-bar ${turnOver ? 'show' : ''} ${
      slideIn ? 'slide-in' : ''
    }">
          ${primaryBtn}
        </div>
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
    lastTurnOver = turnOver;

    // Einzelne Wurf-Felder per Nummerntastatur korrigieren (ohne Multiplikator).
    root.querySelectorAll('.slot.editable').forEach((slotEl) => {
      slotEl.addEventListener('click', () => {
        const i = +slotEl.dataset.slot;
        const d = state.currentTurnDarts[i];
        if (!d) return;
        const pts = dartScore(d);
        slotEl.innerHTML = `<input class="slot-input" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" maxlength="2" value="${pts}">`;
        const input = slotEl.querySelector('input');
        input.focus();
        input.select();
        let committed = false;
        const commit = () => {
          if (committed) return;
          committed = true;
          const raw = input.value.trim();
          if (raw === '') {
            handlers.onEditDart(i, null); // leeres Feld = Wurf entfernen
            return;
          }
          const n = parseInt(raw, 10);
          if (Number.isNaN(n) || n < 0 || n > 60) {
            slotEl.textContent = dartLabel(d); // ungültig → zurücksetzen
            return;
          }
          handlers.onEditDart(i, { value: n, multiplier: 1 });
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          }
        });
      });
    });

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
        handlers.onEndTurn();
      });

    const newGameBtn = root.querySelector('#btn-newgame');
    if (newGameBtn) newGameBtn.addEventListener('click', handlers.onNewGame);

    const quitBtnEl = root.querySelector('#btn-quit');
    if (quitBtnEl)
      quitBtnEl.addEventListener('click', () => {
        if (confirm('Spiel wirklich beenden?')) handlers.onNewGame();
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
