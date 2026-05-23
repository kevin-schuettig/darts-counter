# Darts Counter – Backlog

Ideen, die im Gespräch aufkamen, aber bewusst nicht im aktuellen Scope sind. Hier zur späteren Wiedervorlage.

---

## Checkout-Hinweise

Wenn der Restscore klein genug ist, dass er in einer Aufnahme abgeräumt werden kann, schlägt die App eine konkrete Dart-Kombination zum Finishen vor – ein eingebauter Spickzettel statt einer Checkout-Tabelle auf Papier.

### Wann anzeigen

- **Double-Out**: ab Restscore ≤ 170 (höchster möglicher Double-Out-Checkout).
- **Single-Out**: ab Restscore ≤ 180 (3× T20).

### Beispiele (Double-Out)

| Restscore | Vorschlag |
|---|---|
| 170 | T20, T20, Bullseye |
| 100 | T20, D20 |
| 60  | T20 oder S20, D20 |
| 40  | D20 |
| 32  | D16 |

### Umsetzung

- Vordefinierte Lookup-Tabelle für Restscores, je nach Out-Modus.
- Anzeige im Spiel-Screen unterhalb des Status-Texts oder am Rand des aktiven Spielers.
- Optional: nur den ersten Vorschlag zeigen, weitere Optionen über Tap aufklappen.

### Offene Fragen

- Soll der Vorschlag *vor* dem ersten Dart der Aufnahme angezeigt werden oder erst, wenn weniger als 3 Darts übrig sind?
- Anzeige nur für die aktive Person oder auch für die anderen (Spannung beim Zuschauen)?

---

## „Letzte Aufnahme"-Anzeige

Im Scoreboard pro Spieler:in zusätzlich die Punkte aus der zuletzt abgeschlossenen Aufnahme anzeigen. So sehen die anderen ohne Nachfrage, was gerade geworfen wurde.

### Beispiel

Spielerin A wirft T20-T20-T20 = 180 und drückt „Weiter". Im Scoreboard erscheint unter A jetzt etwa `Last: 180`.

### Varianten

- **Summe** (pragmatisch): `Last: 180` — passt auch ins 4-Spieler-Layout.
- **Einzelne Würfe** (mehr Info): `T20 · T20 · T20` — wird auf kleinen Phones mit 4 Spieler:innen schnell eng.

### Umsetzung

- Pro Spieler:in `lastTurnPoints` (und optional `lastTurnDarts`) im Game-State persistieren.
- In `endTurn` setzen, in `createGame` mit `null` initialisieren.
- Im Scoreboard renderbar machen, kleine Schrift unter Score/Average.

### Offene Fragen

- Bust-Aufnahmen als `Last: 0 (Bust)` anzeigen oder gar nicht?
- Soll die Anzeige der laufenden Aufnahme (live, während noch geworfen wird) auch dorthin oder bleibt das den Wurf-Slots vorbehalten?
