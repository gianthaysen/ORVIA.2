# B-13 · i18n-Struktur — Stand

**Stand:** 11.09.2026 · Band 1: 30 h, „keine Abhängigkeit, aber vor B-14"; bewusst nach dem UI-Abschluss (B-02…B-09 ✅).
**DoD:** *Kein hartkodierter nutzersichtbarer String mehr in den Kernflows; Sprachumschaltung DE↔DE-Test (Pseudo-Locale) fehlerfrei.*

## Gebaut (v8-368)

| Element | Umsetzung | Abweichung von Band 6 e.1 |
|---|---|---|
| Laufzeit | `js/i18n.js` (~90 Zeilen): `t(key, params)`, `{name}`-Platzhalter, Plural über `Intl.PluralRules` (`key.one`/`key.other`), Kette aktiv → de → Key, `setLocale` (localStorage `orvia_locale` > Gerätesprache > de), Event `orvia:locale-changed`, `parity()` für CI | — |
| Kataloge | `locales/de.js` als **Skript** (`ORVIA.locales.de = {…}`), flache namespaced Keys | Band 6 sagt JSON per fetch. Skript statt fetch: kein Async-Rennen beim Start, offline über die SW-Liste, kein zweiter Lademechanismus. Grep-barkeit bleibt. |
| Pseudo-Locale | `xx` → jeder Katalogtext in `⟦…⟧`; Klartext, der nicht durch `t()` läuft, fällt optisch auf | — |
| Inventur | `tools/i18n-inventory.mjs` — Heuristik für nutzersichtbare deutsche Literale je Datei | — |
| Schutznetz | `i18n_guard_test`: Laufzeit, Pseudo-Locale, Parität, Katalog-Regeln, **t()-Regime** (Dateien unter t() müssen 0 Literale haben), Verdrahtung | — |
| Upload-Satz | `locales/` in `deploy-verify.sh` und Deploy-Standard aufgenommen | — |

**Unter t() (0 Literale, vom Test erzwungen):** `js/goal-detail.js`, `js/workout-gym.js`, `js/workout-ui.js`, **`js/onboarding/onboarding-ui.js`** (Schritte 2+3 ✅, 11.09.) — 401 Keys. Werkzeug: `tools/i18n-extract.mjs <datei> <namespace> <out.json>` (nur in Literalen, Wortgrenzen, Markenname nie).

## Inventur 11.09. (Heuristik, ohne engine/)

| Datei | Literale |
|---|---|
| `js/ui.js` | 1061 |
| `js/profile.js` | 226 |
| `js/calc.js` | 137 |
| `js/onboarding/onboarding-ui.js` | 128 |
| `js/supplements.js` | 124 |
| `js/workout-ui.js` | 96 |
| `js/profile-model.js` | 88 |
| `js/activity.js` | 85 |
| übrige 40 Dateien | ~660 |
| **Summe** | **≈ 2600** |

Band 6 e.2 Schritt 6: bei > 1.500 Strings **Cut auf Kernflows zuerst**. Kernflows (Onboarding → Plan → Workout → Profil) liegen in `onboarding-ui.js` (128), dem Plan-Teil von `ui.js`, `workout-ui.js` (96), `profile.js`/`profile-center.js` (258). Das ist die B-13-Restarbeit; `ui.js` komplett ist B-14-nah und teils Legacy (GM7-Abbau entfernt Bereiche — dort nicht extrahieren).

## Zwei Befunde, die die Extraktion prägen

1. **Plan-Labels sind Schlüssel, keine Texte.** `unitKind()`/`unitPriority()`/`isHardUnit()` in ui.js und die Engine-Module (goal-phase-plan, absence-replanner, week-plan-designer) klassifizieren über die Wörter „Long Run", „Intervalle", „Tempo", „Z2" im Label. Werden diese Labels übersetzt, bricht die Klassifikation. Lösung vor der Extraktion: Plan-Items bekommen ein `kind`-Feld (Code) und das Label wird beim Rendern aus `t('plan.kind.' + kind)` gebildet — Klassifikation liest `kind`, nie mehr das Label. Das ist ein eigener Schritt (≈ 4 h) und Voraussetzung für EN.
2. **Kategorie-/Muskel-/Regionen-Labels** liegen als DE-Tabellen in `profile.js` (`GOAL_CAT_DE`), `profile-model.js` (`BODY_REGIONS`), `gym-volume.js`. Sie sind Daten, keine Templates: je Tabelle ein Key-Präfix (`goal.cat.*`, `body.region.*`), einmalig migriert.

## Reihenfolge Rest B-13 (≈ 22 h)

1. ✅ **`kind`-Feld für Plan-Items** (`gpR/gpB/gpG/gpS/gpM` setzen es; `unitKind`/`isHardUnit` in ui.js sowie goal-phase-plan/absence-replanner lesen es zuerst; Label-Raten bleibt Rückfall für gespeicherte Pläne). **Bewusst nicht** in `week-plan-designer`/`week-plan-policy`: beide gehören zur eingefrorenen Kohorte des Engine-Shadows (`shadow_adaptive` schlägt bei einem VERSION-Bump „Kohortenänderung — Belegsammlung beginnt neu" an, das würde Gate A #5 zurücksetzen). Ihre Label-Regex funktioniert, solange die Labels DE bleiben — d. h. bis B-14. Dann: Kohorte mit `ORVIA_REPIN_COHORT` bewusst neu setzen, beide Module auf `kind` umstellen. Offen bleibt der Renderer (`t('plan.kind.' + kind)`) — kommt mit der Plan-Tab-Extraktion (Schritt 5).
2. ✅ Onboarding-UI (211 Texte → 0; Slug-Keys `ob.*`, 11 Tests laden jetzt den Katalog) · 3. ✅ Workout-UI (96 → 0, datengetriebene Extraktion `_to_delete/x4.py`-Muster: Text → Key, längste zuerst, nur in Literalen; zusammengesetzte Meldungen als Platzhalter-Keys) · 4. Profil + Profilzentrale (258) (5 h) · 5. Plan-Tab in ui.js (≈ 300) (6 h).
6. Pseudo-Locale-Durchlauf der fünf Kernflows am Gerät (dein Auge) → DoD.

Alles ab Schritt 2 ist mechanische Extraktion mit Test je Screen; Schritt 1 ist die einzige Architekturänderung.

## Stand 12.09.2026 (HEAD nach `9b26bd4`, Build v8-369)

| Schritt | Datei(en) | Keys | Stand |
|---|---|---|---|
| 4a/4b | profile-center.js, **profile.js** | 70 + 516 | ✅ |
| 5 | auth.js (Login, Konto-Karte) | 92 | ✅ |
| 6 | activity.js | 113 | ✅ |
| 7 | nutrition, insights, race, extras, adaptive-card, issues | 299 | ✅ |
| 8 | **ui.js** (Heute, Plan, Check-in, Story, Profi-Ansicht) | 1694 | ✅ Extraktion; 184 Restliterale (Template-Literale, escaped Quotes) |

Katalog `locales/de.js`: **3190 Keys**. Inventur-Rest (Heuristik): **911** (11.09.: ~2600) — davon ui.js 184, calc.js 137, supplements.js 124 (Inhaltslexikon → Content-Katalog, nicht string-basiert), profile-model.js 88, orvia-pro.js 66. `i18n_guard` führt 14 Dateien im t()-Regime (0 Literale) und eine Ratsche (Rest ≤ 950).

**Werkzeuge:** `tools/i18n-extract.mjs` (jetzt mit Klassifikationsschutz: Objektschlüssel/Vergleich/case/Index nie extrahieren; Perf-Marken, Header, Attributfragmente übersprungen), `tools/i18n-recon.mjs` (Rückprobe: Keys → DE-Text, `diff` gegen Git-Stand, beide Seiten inliniert), `supabase/tests/_i18n-src.mjs` (`srcHasText`, `inlined`, `tStub` für Harnesse).

**Fünf Fehlerklassen, die die Rückprobe gefunden hat** (alle behoben, Regel im Extraktor):
1. Markup-/Attributfragmente als „Text" (`onclick="…"`, SVG-Attribute).
2. Groß-/Kleinschreibungs-Kollisionen im Slug (`Nicht verbunden` ↔ `nicht verbunden`).
3. Technische Strings mit Großbuchstaben (`_P.mark('onAuthed: …')`, `'Bearer '`).
4. Bezeichner-Literale (`{'Wettkampf':'race_week'}[act.n]`) — Syntaxfehler bzw. stille Fehlklassifikation.
5. `·`-Escapes im Literal → doppelter Backslash im Katalog.

**Bekannte Schuld (für B-14 EN):** Fragment-Keys (Satzteile mit führendem/abschließendem Leerzeichen, z. B. `'Zubettgeh-' + t('ui.zeit')`, `t('ui.aktuell') + n + t('ui.tage')`) sind DE-textgleich, aber nicht übersetzbar. Bei Insights, Wettkampf, Adaptive-Karte, Aktivität, Beschwerden bereits zu ganzen Sätzen mit `{platzhalter}` zusammengezogen; in profile.js/ui.js noch ~450 Fragmente. Pseudo-Locale `xx` macht sie sichtbar (`⟦…⟧⟦…⟧` statt eines Rahmens).

**Offen:** ui.js-Rest 184 (manuell), calc.js-Coach-Texte, profile-model-Tabellen (`goal.cat.*`, `body.region.*`), supplements-Content-Katalog, Renderer `t('plan.kind.'+kind)`, Pseudo-Locale-Durchlauf am Gerät.
