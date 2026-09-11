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

**Unter t() (0 Literale):** `js/goal-detail.js`, `js/workout-gym.js` — 82 Keys.

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

1. `kind`-Feld für Plan-Items + Renderer über `t()` (4 h) — **vor** allem anderen.
2. Onboarding-UI (128) (4 h) · 3. Workout-UI (96) (3 h) · 4. Profil + Profilzentrale (258) (5 h) · 5. Plan-Tab in ui.js (≈ 300) (6 h).
6. Pseudo-Locale-Durchlauf der fünf Kernflows am Gerät (dein Auge) → DoD.

Alles ab Schritt 2 ist mechanische Extraktion mit Test je Screen; Schritt 1 ist die einzige Architekturänderung.
