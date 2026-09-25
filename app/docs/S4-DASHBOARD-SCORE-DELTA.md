# S4 · Dashboard + Score — Delta v14 (Stand 2026-09-25)

Vergleich Prototyp v14 (`dashRender`/`dashHero`/`dashAdp`/`dashModules`/`scoreRender`)
gegen den GM1-Block der App (`js/ui.js`: `renderCommand`, `gmHero`, `renderModules`,
`openScore`). Bewertung: **vorhanden** = deckungsgleich oder besser, **offen** = Delta,
**bewusst nicht** = im Prototyp erfunden, ohne echten Produzenten in der App.

| # | Prototyp v14 | App | Status | Build |
|---|---|---|---|---|
| 1 | Hero: Ring, Lead, Why-Zeile, Deltas, Empfehlung, CTA-Reihe, Body Battery | `gmHero` | vorhanden | — |
| 2 | **Tagesentscheidung**-Karte: Zustand, Heute, Vermeiden, Wahl mit Protokoll | `gmDecisionCard` in `#adaptBox` | **umgesetzt** | v8-409 |
| 3 | „Tauschen: lockerer Lauf" (verschiebt den Reiz) | einziger echter Verschiebe-Mechanismus = Engine-`weekAdjustments` (MOVE_SESSION) mit Undo — in der Karte als „Wochenplan anpassen"; bei KEEP nur „Wie geplant" + Check-in-Weg | bewusst anders (kein toter Knopf) | v8-409 |
| 4 | Check-in-Karte mit Werten | `renderCheckinCompact` | vorhanden | — |
| 5 | Module Schlaf / Erholung / Schritte / Aktive Energie | `activity` (Schritte + aktive kcal), `recovery`, `sleepSimple` | vorhanden (kcal in „Aktivität heute", nicht als eigene Kachel) | — |
| 6 | Belastungssteuerung (wide), Readiness & Konfidenz | `loadPro`, `readinessPro` | vorhanden | — |
| 7 | Debrief-Teaser, Renntag-Karte | `gmMaybeAutoStory`, `renderRaceModeToday` | vorhanden | — |
| 8 | Score-Sheet: Faktoren im Detail | `openScore` fcards (bewertet/gemessen/Beitrag) | vorhanden (detaillierter) | — |
| 9 | Score-Sheet: Basis-Zeile „Basis 100 · Baselines 28 T. · Konfidenz" | Basis-Zeile aus echten Werten (gewichteter Gesamtwert, recoveryCtx 28 T., `dataConfidence`) | **umgesetzt** | v8-409 |
| 10 | Score-Sheet: „Was der Score NICHT ist" | Block mit den REALEN Schwellen aus `calc.dayStateEngine` (70/55/40) und Peak ≥ 85 | **umgesetzt** | v8-409 |

| 11 | Spotlight-Tour (`spot*`, 20 Schritte, Autostart nach Onboarding) | `js/tour.js`: 11 Schritte an ECHTEN Elementen, fehlende werden übersprungen; **kein Autostart** (M9-Entscheidung: ein Orientierungs-Spotlight, kein Mehrschritt-Rundgang) — Einstieg Profil → Hilfe & über ORVIA → „Rundgang durch die App“ (ersetzt die tote „Dokumentation folgt“-Zeile) | **umgesetzt** | v8-410 |
## Entscheidungen

- **Wahl-Persistenz** bleibt `entry.adaptChoice` (Legacy, seit GM6) — jetzt zusätzlich mit
  `at` (Uhrzeit für die Erledigt-Zeile). Neu: jede Wahl geht append-only ins
  Entscheidungs-Log (`decisionType: user_override`, `decisionId: adp:<Tag>@<ts>`), wie das
  Debrief. Ein werfendes Log berührt die Wahl nicht (Beobachter-Regel).
- `renderAdaptCard()` (Legacy) rendert kein Markup mehr; sie behält nur die
  Automatik-Nebenwirkungen (Auto-Übernahme, `applyWeekAdjustments(false)`) und delegiert an
  `gmRenderDecisionCard()`. Alle 6 Alt-Aufrufer (Termine, Modus, Wochenplan) landen damit
  in der GM-Karte.
- „Vermeiden" ohne vermiedene Einheit: nur mit echtem nächsten Kernreiz aus
  `plan-variants.isKey` (`gmNextKeyUnit`), Stufe a ohne diesen Block.
- Ampelschwellen im Sheet-Text sind aus `calc.js` zitiert (Test E4 pinnt sie) — ändert
  sich die Engine, fällt der Test, nicht der Text.

## Offen / nicht Teil von S4

- Eigene „Aktive Energie"-Kachel: erst sinnvoll, wenn `energy-expenditure-resolver` ein
  Tagesziel liefert (heute nur 14-T-Maximum als Skala).
- Lernschicht aus den protokollierten Wahlen (v14 „der Planer lernt") — Bauplan Stufe 3,
  nicht in der UI versprochen.

Tests: `supabase/tests/dash_v14_s4a_test.mjs` (36), `supabase/tests/tour_v14_test.mjs` (21).
