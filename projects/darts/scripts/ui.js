const DartsUI = (() => {
  const {
    dartLabel,
    dartScore,
    turnPoints,
    averageThreeDart,
    checkoutRoute,
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

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  // Gemeinsames Modal-Gerüst: Overlay mit weichgezeichnetem Hintergrund,
  // Escape/Backdrop schließen, Fokus-Trap, Body-Scroll-Sperre.
  // wire(overlay, close) verdrahtet den Inhalt und liefert das Element, das
  // initial den Fokus bekommt. dismissValue = Ergebnis bei Escape/Backdrop.
  function openOverlay(cardHtml, wire, dismissValue) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = cardHtml;
      document.body.appendChild(overlay);
      document.body.classList.add('dialog-open');
      requestAnimationFrame(() => overlay.classList.add('show'));
      let settled = false;

      function close(result) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKey, true);
        overlay.classList.remove('show');
        document.body.classList.remove('dialog-open');
        const cleanup = () => {
          overlay.remove();
          if (prevFocus && typeof prevFocus.focus === 'function') {
            try {
              prevFocus.focus();
            } catch {}
          }
        };
        if (prefersReducedMotion()) cleanup();
        else setTimeout(cleanup, 160);
        resolve(result);
      }

      // Tabbare Elemente: Buttons, Selects und je Radiogruppe nur das
      // angehakte Radio (so wie der Browser selbst durch Gruppen tabbt).
      function focusables() {
        return Array.from(
          overlay.querySelectorAll('button, select, input:not([type="radio"]), input[type="radio"]:checked')
        ).filter((el) => !el.disabled);
      }

      function onKey(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(dismissValue);
        } else if (e.key === 'Tab') {
          const f = focusables();
          if (!f.length) return;
          const first = f[0];
          const last = f[f.length - 1];
          const inside = overlay.contains(document.activeElement);
          if (e.shiftKey && (document.activeElement === first || !inside)) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      overlay.addEventListener('pointerdown', (e) => {
        if (e.target === overlay) close(dismissValue);
      });
      document.addEventListener('keydown', onKey, true);
      const initialFocus = wire(overlay, close);
      if (initialFocus) initialFocus.focus();
    });
  }

  // Eigener Bestätigungsdialog im App-Design (ersetzt window.confirm).
  // Liefert ein Promise<boolean>.
  function confirmDialog({
    title = '',
    message = '',
    confirmLabel = 'OK',
    cancelLabel = 'Abbrechen',
    danger = false,
  } = {}) {
    const card = `
      <div class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 class="dialog-title" id="dialog-title">${escapeHtml(title)}</h2>
        ${message ? `<p class="dialog-message">${escapeHtml(message)}</p>` : ''}
        <div class="dialog-actions">
          <button type="button" class="btn btn-secondary dialog-cancel">${escapeHtml(
            cancelLabel
          )}</button>
          <button type="button" class="btn ${
            danger ? 'btn-danger' : 'btn-primary'
          } dialog-confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    return openOverlay(
      card,
      (overlay, close) => {
        const cancelBtn = overlay.querySelector('.dialog-cancel');
        overlay
          .querySelector('.dialog-confirm')
          .addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));
        return cancelBtn;
      },
      false
    );
  }

  function themeItemHtml(val, label, currentTheme) {
    return `
      <label class="seg-item">
        <input type="radio" name="theme" value="${val}" ${
      val === currentTheme ? 'checked' : ''
    }>
        ${ICON[val]}
        <span>${label}</span>
      </label>`;
  }

  function soundItemHtml(val, label, soundOn) {
    return `
      <label class="seg-item">
        <input type="radio" name="sound" value="${val}" ${
      (val === 'on') === soundOn ? 'checked' : ''
    }>
        ${val === 'on' ? ICON.soundOn : ICON.soundOff}
        <span>${label}</span>
      </label>`;
  }

  // Einstellungen-Modal (Darstellung + Ton). Änderungen greifen sofort über
  // die Callbacks; „Fertig", Escape oder Tipp daneben schließen.
  function settingsDialog({ theme, soundOn, onThemeChange, onSoundChange }) {
    const card = `
      <div class="dialog-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <h2 class="dialog-title" id="settings-title">Einstellungen</h2>
        <div class="settings-group">
          <span class="legend-row">Darstellung</span>
          <div class="theme-seg" role="radiogroup" aria-label="Darstellung">
            ${themeItemHtml('system', 'System', theme)}
            ${themeItemHtml('light', 'Hell', theme)}
            ${themeItemHtml('dark', 'Dunkel', theme)}
          </div>
        </div>
        <div class="settings-group">
          <span class="legend-row">Ton beim Wurf</span>
          <div class="theme-seg" role="radiogroup" aria-label="Ton beim Wurf">
            ${soundItemHtml('on', 'An', soundOn)}
            ${soundItemHtml('off', 'Aus', soundOn)}
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="btn btn-primary dialog-done">Fertig</button>
        </div>
      </div>`;
    return openOverlay(
      card,
      (overlay, close) => {
        overlay.querySelectorAll('input[name="theme"]').forEach((radio) => {
          radio.addEventListener('change', () => {
            if (radio.checked && onThemeChange) onThemeChange(radio.value);
          });
        });
        overlay.querySelectorAll('input[name="sound"]').forEach((radio) => {
          radio.addEventListener('change', () => {
            if (radio.checked && onSoundChange)
              onSoundChange(radio.value === 'on');
          });
        });
        const done = overlay.querySelector('.dialog-done');
        done.addEventListener('click', () => close());
        return done;
      },
      undefined
    );
  }

  function tweenNumber(el, from, to, duration = 240) {
    if (from === to || !el) return;
    if (prefersReducedMotion()) {
      el.textContent = to;
      return;
    }
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
    soundOn:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/>' +
      '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    soundOff:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/>' +
      '<path d="M22 9l-6 6M16 9l6 6"/></svg>',
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

  function trainingSectionHtml(training) {
    if (!Array.isArray(training) || training.length === 0) return '';
    const rows = training
      .map((e, i) => {
        const d = new Date(e.date);
        const dateLabel = isNaN(d.getTime())
          ? '–'
          : `${String(d.getDate()).padStart(2, '0')}.${String(
              d.getMonth() + 1
            ).padStart(2, '0')}.`;
        const out = e.outMode === 'double' ? 'DO' : 'SO';
        const avgNum =
          typeof e.avg === 'number' && isFinite(e.avg) ? e.avg : null;
        const avgLabel = avgNum === null ? '–' : avgNum.toFixed(2);
        // Trend ggue. dem chronologisch vorherigen (aelteren) Solo-Spiel
        // = naechst-hoeherer Index, da neuester Eintrag an Index 0 steht.
        const prev = training[i + 1];
        const prevNum =
          prev && typeof prev.avg === 'number' && isFinite(prev.avg)
            ? prev.avg
            : null;
        let trend = '';
        if (avgNum !== null && prevNum !== null) {
          if (avgNum > prevNum)
            trend =
              ' <span class="t-trend up" aria-label="besser als zuvor">▲</span>';
          else if (avgNum < prevNum)
            trend =
              ' <span class="t-trend down" aria-label="schlechter als zuvor">▼</span>';
        }
        return `
          <tr>
            <td class="t-date">${dateLabel}</td>
            <td class="t-start">${e.startScore != null ? e.startScore : '–'}</td>
            <td class="t-out">${out}</td>
            <td class="t-avg">${avgLabel}${trend}</td>
            <td class="t-darts">${e.darts != null ? e.darts : '–'}</td>
          </tr>`;
      })
      .join('');

    return `
      <div class="training">
        <span class="legend-row">Trainingsverlauf</span>
        <div class="training-table-wrap">
          <table class="training-table">
            <thead>
              <tr>
                <th class="t-date">Datum</th>
                <th class="t-start">Start</th>
                <th class="t-out">Out</th>
                <th class="t-avg">Ø</th>
                <th class="t-darts">Würfe</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <button type="button" class="training-reset" id="training-reset">Trainingsverlauf zurücksetzen</button>
      </div>`;
  }

  // Around-the-Clock-Solo-Verlauf (Home, nur bei Einträgen). Eigene Tabelle,
  // weil die Kennzahlen andere sind als beim X01-Training.
  function clockSectionHtml(runs) {
    if (!Array.isArray(runs) || runs.length === 0) return '';
    const dirLabel = { up: 'Auf', down: 'Ab', updown: 'Auf &amp; ab' };
    const diffLabel = {
      all: 'Alle Felder',
      single: 'Single',
      double: 'Double',
      triple: 'Triple',
    };
    const rows = runs
      .map((e) => {
        const d = new Date(e.date);
        const dateLabel = isNaN(d.getTime())
          ? '–'
          : `${String(d.getDate()).padStart(2, '0')}.${String(
              d.getMonth() + 1
            ).padStart(2, '0')}.`;
        const darts = typeof e.darts === 'number' ? e.darts : null;
        const targets = typeof e.targets === 'number' ? e.targets : null;
        const quote =
          darts && targets ? `${Math.round((targets / darts) * 100)}%` : '–';
        return `
          <tr>
            <td class="t-date">${dateLabel}</td>
            <td class="t-dir">${dirLabel[e.direction] || '–'}</td>
            <td class="t-diff">${diffLabel[e.difficulty] || '–'}</td>
            <td class="t-bull">${e.withBull ? 'Ja' : 'Nein'}</td>
            <td class="t-darts">${darts != null ? darts : '–'}</td>
            <td class="t-quote">${quote}</td>
          </tr>`;
      })
      .join('');

    return `
      <div class="training clock-history">
        <span class="legend-row">Around-the-Clock-Verlauf</span>
        <div class="training-table-wrap">
          <table class="training-table">
            <thead>
              <tr>
                <th class="t-date">Datum</th>
                <th class="t-dir">Richtung</th>
                <th class="t-diff">Modus</th>
                <th class="t-bull">Bull</th>
                <th class="t-darts">Würfe</th>
                <th class="t-quote">Quote</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <button type="button" class="training-reset" id="clock-reset">Around-the-Clock-Verlauf zurücksetzen</button>
      </div>`;
  }

  function renderSetup(
    root,
    settings,
    theme,
    handlers,
    training = [],
    clockRuns = [],
    version = ''
  ) {
    armedMultiplier = 1;
    resetAnimationState(null);

    const outMode = settings.outMode === 'double' ? 'double' : 'single';
    let count = Math.min(4, Math.max(1, settings.lastCount || 2));
    const startScore = START_SCORE_OPTIONS.includes(settings.lastStartScore)
      ? settings.lastStartScore
      : 501;
    let currentTheme = ['system', 'light', 'dark'].includes(theme)
      ? theme
      : 'system';

    // Spielmodus + Around-the-Clock-Vorgaben (aus Settings, mit Defaults).
    const mode = settings.mode === 'clock' ? 'clock' : 'x01';
    const clockDirection = ['up', 'down', 'updown'].includes(
      settings.clockDirection
    )
      ? settings.clockDirection
      : 'up';
    const clockDifficulty = ['all', 'single', 'double', 'triple'].includes(
      settings.clockDifficulty
    )
      ? settings.clockDifficulty
      : 'all';
    const clockBull = settings.clockBull !== false;

    // Quelle der Wahrheit für Namen (kann leer sein → Platzhalter greift).
    const names = (settings.lastNames || []).slice(0, 4);
    while (names.length < count) names.push('');

    // Ton beim Wurf-Einloggen (Default: an). Mutable, weil das
    // Einstellungen-Modal den Wert ändert, ohne das Setup neu zu rendern.
    let soundOn = settings.sound !== false;

    root.innerHTML = `
      <section class="setup">
        <img src="./assets/icons/icon-192.png" alt="" class="setup-icon">
        <h1>Schü's Darts Counter</h1>
        <div id="setup-form">
          <div class="field">
            <span class="field-label">Spieler:innen Anzahl</span>
            <div class="seg seg-neutral" role="radiogroup">
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
          </div>

          <div class="field">
            <span class="field-label">Spieler:innen Name</span>
            <div id="names-box" class="names"></div>
          </div>

          <div class="field">
          <span class="field-label">Spielmodus</span>
          <div class="mode-panel">
          <div class="mode-tabs" role="radiogroup" aria-label="Spielmodus">
            <label class="mode-tab" data-mode="x01">
              <input type="radio" name="mode" value="x01" ${
                mode === 'x01' ? 'checked' : ''
              }>
              <span>X01</span>
            </label>
            <label class="mode-tab" data-mode="clock">
              <input type="radio" name="mode" value="clock" ${
                mode === 'clock' ? 'checked' : ''
              }>
              <span>Around the Clock</span>
            </label>
          </div>

          <div class="mode-fields" data-mode="x01"${
            mode === 'clock' ? ' hidden' : ''
          }>
            <div class="field">
              <span class="field-label">Startpunkte</span>
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
            </div>

            <div class="field">
              <span class="field-label">Out-Modus</span>
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
            </div>
          </div>

          <div class="mode-fields" data-mode="clock"${
            mode === 'x01' ? ' hidden' : ''
          }>
            <div class="field">
              <span class="field-label">Richtung</span>
              <div class="seg" role="radiogroup">
                <label class="seg-item">
                  <input type="radio" name="direction" value="up" ${
                    clockDirection === 'up' ? 'checked' : ''
                  }>
                  <span>Auf</span>
                </label>
                <label class="seg-item">
                  <input type="radio" name="direction" value="down" ${
                    clockDirection === 'down' ? 'checked' : ''
                  }>
                  <span>Ab</span>
                </label>
                <label class="seg-item">
                  <input type="radio" name="direction" value="updown" ${
                    clockDirection === 'updown' ? 'checked' : ''
                  }>
                  <span>Auf &amp; ab</span>
                </label>
              </div>
            </div>

            <div class="field">
              <span class="field-label">Schwierigkeit</span>
              <div class="field-select">
                <select name="difficulty" aria-label="Schwierigkeit">
                  <option value="all" ${
                    clockDifficulty === 'all' ? 'selected' : ''
                  }>Alle Felder zählen</option>
                  <option value="single" ${
                    clockDifficulty === 'single' ? 'selected' : ''
                  }>Nur Single</option>
                  <option value="double" ${
                    clockDifficulty === 'double' ? 'selected' : ''
                  }>Nur Double</option>
                  <option value="triple" ${
                    clockDifficulty === 'triple' ? 'selected' : ''
                  }>Nur Triple</option>
                </select>
              </div>
            </div>

            <div class="field">
              <span class="field-label">Bull</span>
              <div class="seg" role="radiogroup">
                <label class="seg-item">
                  <input type="radio" name="bull" value="on" ${
                    clockBull ? 'checked' : ''
                  }>
                  <span>Mit Bull</span>
                </label>
                <label class="seg-item">
                  <input type="radio" name="bull" value="off" ${
                    !clockBull ? 'checked' : ''
                  }>
                  <span>Ohne Bull</span>
                </label>
              </div>
            </div>
          </div>

          <button type="button" id="start-btn" class="btn btn-primary btn-big">Spiel starten</button>
          </div>
          </div>

          <button type="button" id="settings-btn" class="btn btn-secondary btn-settings">Einstellungen</button>
        </div>

        ${trainingSectionHtml(training)}

        ${clockSectionHtml(clockRuns)}

        ${
          version
            ? `<p class="app-version">Schü's Darts Counter · ${escapeHtml(
                version
              )}</p>`
            : ''
        }
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

    // --- Spielmodus-Umschalter: passende Feld-Gruppe zeigen ---
    const modeFields = Array.from(root.querySelectorAll('.mode-fields'));
    form.querySelectorAll('input[name="mode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        modeFields.forEach((el) => {
          el.hidden = el.dataset.mode !== radio.value;
        });
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

    // --- Einstellungen-Modal (Darstellung + Ton) ---
    const settingsBtn = root.querySelector('#settings-btn');
    // Gleicher Schutz wie beim Start-Button (kein Fokus-Scroll beim mousedown).
    settingsBtn.addEventListener('mousedown', (e) => e.preventDefault());
    settingsBtn.addEventListener('click', () => {
      settingsDialog({
        theme: currentTheme,
        soundOn,
        onThemeChange: (mode) => {
          currentTheme = mode;
          handlers.onThemeChange(mode);
        },
        onSoundChange: (on) => {
          soundOn = on;
          if (handlers.onSoundChange) handlers.onSoundChange(on);
        },
      });
    });

    // --- Trainingsverlauf zuruecksetzen ---
    const trainingReset = root.querySelector('#training-reset');
    if (trainingReset) {
      trainingReset.addEventListener('click', () => {
        confirmDialog({
          title: 'Trainingsverlauf löschen?',
          message: 'Alle gespeicherten X01-Solo-Läufe werden entfernt.',
          confirmLabel: 'Löschen',
          danger: true,
        }).then((ok) => {
          if (ok) handlers.onResetTraining();
        });
      });
    }

    // --- Around-the-Clock-Verlauf zuruecksetzen ---
    const clockReset = root.querySelector('#clock-reset');
    if (clockReset) {
      clockReset.addEventListener('click', () => {
        confirmDialog({
          title: 'Around-the-Clock-Verlauf löschen?',
          message: 'Alle gespeicherten Solo-Läufe werden entfernt.',
          confirmLabel: 'Löschen',
          danger: true,
        }).then((ok) => {
          if (ok && handlers.onResetClock) handlers.onResetClock();
        });
      });
    }

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
      const modeSel = form.querySelector('input[name="mode"]:checked');
      const chosenMode = modeSel ? modeSel.value : 'x01';
      if (chosenMode === 'clock') {
        const dir = form.querySelector('input[name="direction"]:checked');
        const diff = form.querySelector('select[name="difficulty"]');
        const bull = form.querySelector('input[name="bull"]:checked');
        handlers.onStart({
          mode: 'clock',
          names: finalNames,
          direction: dir ? dir.value : 'up',
          difficulty: diff ? diff.value : 'all',
          withBull: bull ? bull.value === 'on' : true,
        });
      } else {
        const out = form.querySelector('input[name="out"]:checked');
        const sel = form.querySelector('select[name="startScore"]');
        handlers.onStart({
          mode: 'x01',
          names: finalNames,
          outMode: out ? out.value : 'single',
          startScore: sel ? +sel.value : 501,
        });
      }
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
    if (state.mode === 'clock') return renderClockGame(root, state, handlers);
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

    // Checkout-Vorschlag: nur Double-Out, nur aktive Spieler:in, dynamisch nach
    // jedem Wurf. Verschwindet automatisch bei Bust/Sieg/keinem Finish.
    let checkoutHint = '';
    if (state.outMode === 'double' && !state.bust && !hasWinner) {
      const dartsLeft = MAX_DARTS_PER_TURN - state.currentTurnDarts.length;
      const route = checkoutRoute(state.players[curIdx].score, dartsLeft);
      if (route) {
        const path = route
          .map((r) => `<span class="checkout-throw">${escapeHtml(r)}</span>`)
          .join('<span class="checkout-sep" aria-hidden="true">›</span>');
        checkoutHint = `<div class="checkout-hint"><span class="checkout-label">Finish:</span> ${path}</div>`;
      }
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
      ? `<button type="button" class="btn btn-primary btn-weiter" id="btn-newgame">Spiel beenden</button>`
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
          ${checkoutHint}
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
        confirmDialog({
          title: 'Spiel beenden?',
          message: 'Der aktuelle Spielstand geht verloren.',
          confirmLabel: 'Beenden',
          danger: true,
        }).then((ok) => {
          if (ok) handlers.onNewGame();
        });
      });
  }

  // Spiel-Screen für „Around the Clock". Nutzt dasselbe Wurf-Eingabe-Pad wie
  // X01, zeigt aber pro Person die aktuelle Zielzahl statt eines Restscores.
  function renderClockGame(root, state, handlers) {
    const curIdx = state.currentPlayerIdx;
    const hasWinner = state.winnerIdx !== null;
    const canRecord =
      !hasWinner && state.currentTurnDarts.length < MAX_DARTS_PER_TURN;
    const seqLen = state.sequence.length;

    const newDartAdded =
      state.currentPlayerIdx === lastPlayerIdx &&
      state.currentTurnDarts.length === lastTurnDartsLength + 1;
    const justFilledIdx = newDartAdded
      ? state.currentTurnDarts.length - 1
      : -1;

    // Pro Wurf der Aufnahme ermitteln, ob er das jeweils aktuelle Ziel
    // getroffen hat (Replay ab Aufnahme-Start). Fehlwürfe werden rot
    // dargestellt und schütteln sich beim Einloggen – wie „Bust" in X01.
    const hitFlags = [];
    let replayIdx = state.targetIdxAtTurnStart;
    for (const d of state.currentTurnDarts) {
      const hit =
        replayIdx < seqLen &&
        DartsClock.dartHitsTarget(
          d,
          state.sequence[replayIdx],
          state.difficulty
        );
      hitFlags.push(hit);
      if (hit) replayIdx++;
    }

    const slots = Array.from({ length: MAX_DARTS_PER_TURN }, (_, i) => {
      const d = state.currentTurnDarts[i];
      if (!d) return `<div class="slot"></div>`;
      const missed = !hitFlags[i];
      const cls = ['slot', 'filled'];
      if (missed) cls.push('slot-miss');
      if (i === justFilledIdx) cls.push(missed ? 'miss-flash' : 'just-filled');
      return `<div class="${cls.join(' ')}"${
        missed ? ' aria-label="Fehlwurf"' : ''
      }>${dartLabel(d)}</div>`;
    }).join('');

    const scoreboard = state.players
      .map((p, i) => {
        const isCurrent = i === curIdx && !hasWinner;
        const isWinner = state.winnerIdx === i;
        const classes = [
          'player',
          isCurrent ? 'active' : '',
          isWinner ? 'winner' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const target =
          p.targetIdx >= seqLen ? null : state.sequence[p.targetIdx];
        const label = p.finished
          ? '✓'
          : DartsClock.targetLabel(target, state.difficulty);
        const progress = p.finished
          ? 'fertig'
          : `${Math.min(p.targetIdx, seqLen)}/${seqLen}`;
        return `
          <div class="${classes}" data-pidx="${i}">
            <div class="pname">${escapeHtml(p.name)}</div>
            <div class="pscore ptarget">${label}</div>
            <div class="pavg">${progress}</div>
          </div>`;
      })
      .join('');

    let statusLine;
    if (hasWinner) {
      statusLine = `<span class="status status-win">🏆 ${escapeHtml(
        state.players[state.winnerIdx].name
      )} gewinnt!</span>`;
    } else {
      const t = state.sequence[state.players[curIdx].targetIdx];
      statusLine = `<span class="status">Triff ${DartsClock.targetLabel(
        t,
        state.difficulty
      )} · Wurf ${state.currentTurnDarts.length}/3</span>`;
    }

    let winSummary = '';
    if (hasWinner && state.players.length === 1) {
      const p = state.players[0];
      const darts = p.committedDarts + state.currentTurnDarts.length;
      const quote = darts > 0 ? Math.round((seqLen / darts) * 100) : 0;
      winSummary = `<div class="clock-summary">${darts} Würfe · ${quote}% Trefferquote</div>`;
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
      hasWinner || state.currentTurnDarts.length >= MAX_DARTS_PER_TURN;
    const slideIn = turnOver && !lastTurnOver;

    const primaryBtn = hasWinner
      ? `<button type="button" class="btn btn-primary btn-weiter" id="btn-newgame">Spiel beenden</button>`
      : `<button type="button" class="btn btn-primary btn-weiter" id="btn-end">Weiter</button>`;

    const quitBtn = hasWinner
      ? ''
      : `<button type="button" class="btn btn-secondary btn-quit" id="btn-quit">Spiel beenden</button>`;

    const dirLabel =
      { up: 'Auf', down: 'Ab', updown: 'Auf &amp; ab' }[state.direction] || '';
    const diffLabel =
      {
        all: 'Alle Felder',
        single: 'Single',
        double: 'Double',
        triple: 'Triple',
      }[state.difficulty] || '';
    const caption = `Around the Clock · ${dirLabel} · ${diffLabel}${
      state.withBull ? ' · Bull' : ''
    }`;

    root.innerHTML = `
      <section class="game">
        <header class="scoreboard players-${state.players.length}">
          ${scoreboard}
        </header>

        <div class="turn">
          <div class="slots">${slots}</div>
          <div class="status-line">${statusLine}</div>
          ${winSummary}
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
        <div class="mode-caption">${caption}</div>

        <div class="primary-bar ${turnOver ? 'show' : ''} ${
      slideIn ? 'slide-in' : ''
    }">
          ${primaryBtn}
        </div>
      </section>
    `;

    lastTurnDartsLength = state.currentTurnDarts.length;
    lastPlayerIdx = state.currentPlayerIdx;
    lastBust = false;
    lastTurnOver = turnOver;

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
        confirmDialog({
          title: 'Spiel beenden?',
          message: 'Der aktuelle Spielstand geht verloren.',
          confirmLabel: 'Beenden',
          danger: true,
        }).then((ok) => {
          if (ok) handlers.onNewGame();
        });
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
