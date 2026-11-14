/* =========================================================================
   FERKHL · Seite
   Baut aus window.FERKHL_MIXES (scripts/mixes.js) die Jahres-Navigation
   und pro Jahr einen SoundCloud-Player. Neuestes Jahr oben.
   ========================================================================= */
(function () {
  'use strict';

  var yearsEl = document.getElementById('years');
  var listEl = document.getElementById('list');

  /* SoundCloud-Embed-URL, aufgebaut wie der offizielle Einbettungscode.
     Private Playlists brauchen den secret_token (s-…). */
  function embedUrl(p) {
    var api = 'https%3A//api.soundcloud.com/playlists/soundcloud%3Aplaylists%3A' + p.id;
    if (p.secret) api += '%3Fsecret_token%3D' + p.secret;
    return 'https://w.soundcloud.com/player/?url=' + api +
      '&color=%2393b0ff&auto_play=false&hide_related=true&show_comments=false' +
      '&show_user=true&show_reposts=false&show_teaser=false&visual=false';
  }

  /* Volle Höhe: Player so hoch, dass alle Tracks ohne Scrollen sichtbar sind.
     Die Trackanzahl liefert die SoundCloud Widget API (nur gelesen, der Player
     bleibt der normale SoundCloud-Player). Ohne API bleibt die CSS-Höhe. */
  var SC_HEAD = 166;   // Kopf: Cover, Titel, Waveform
  var SC_ROW = 31;     // eine Zeile der Trackliste
  var SC_FOOT = 60;    // Fußzeile mit Playlist-Name

  function fitHeight(frame) {
    if (!window.SC || !SC.Widget) return;
    var widget = SC.Widget(frame);
    widget.bind(SC.Widget.Events.READY, function () {
      widget.getSounds(function (sounds) {
        if (sounds && sounds.length) {
          frame.style.height = (SC_HEAD + sounds.length * SC_ROW + SC_FOOT) + 'px';
        }
      });
    });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var items = (window.FERKHL_MIXES || []).slice().sort(function (a, b) { return b.year - a.year; });

  items.forEach(function (p) {
    var anchor = 'jahr-' + p.year;

    var chip = el('a', 'chip', String(p.year));
    chip.href = '#' + anchor;
    yearsEl.appendChild(chip);

    var sec = el('section', 'year');
    sec.id = anchor;

    var head = el('div', 'year-head');
    head.appendChild(el('h2', 'year-num display', String(p.year)));
    if (p.url) {
      var link = el('a', 'ext', 'Auf SoundCloud öffnen ↗');
      link.href = p.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      head.appendChild(link);
    }
    sec.appendChild(head);

    var frame = el('iframe', 'player');
    frame.title = 'Ferkhl Festival ' + p.year + ' auf SoundCloud';
    frame.loading = 'lazy';
    frame.allow = 'autoplay; encrypted-media';
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('frameborder', 'no');
    frame.src = embedUrl(p);
    sec.appendChild(frame);

    listEl.appendChild(sec);
    fitHeight(frame);   // erst wenn das iframe im Dokument hängt
  });

  yearsEl.hidden = items.length < 2;

  /* Kicker: Zeitraum automatisch aus den Daten */
  if (items.length > 1) {
    document.getElementById('kicker').textContent =
      'Alle Mixes · ' + items[items.length - 1].year + '–' + items[0].year;
  }
})();
