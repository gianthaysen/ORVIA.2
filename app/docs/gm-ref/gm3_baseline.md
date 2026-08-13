# GM3-Baseline — gesicherter GM2.1-Abnahmestand (unveränderlich)

Erfasst: 2026-07-25 · Geräte-HEAD: `014ac6f` (2026-07-19 19:39:12 +0000) — unverändert seit GM-Beginn.
Diese Baseline ist die Referenz für den Engine-/Store-Diff-Nachweis von GM3
(„Diff gegenüber der gesicherten GM2.1-Baseline exakt null"). Die unten aufgeführten
Arbeitsbaum-Änderungen an Engine-/Store-Dateien sind **parallele Nutzerarbeit**
(Phase-4x/5, mtimes 18.–22.07.). Sie werden bewahrt, nicht zurückgesetzt, nicht
überschrieben und nicht GM3 zugerechnet.

## GM2.1-Abnahmestand (md5, Gerät = Container)

| Datei | md5 |
|---|---|
| js/ui.js | 7009827acf4d6ddfb80914b8f22cb489 |
| styles.css | 8976008935db404999a63e95d9a4ba21 |
| sw.js | e0cc137204c65e3efca239dfe9d3e94c (Cache `orvia-v8-197`, genau 1×) |
| index.html | b092f78cca474ce3606bccdaf36c59d5 |
| tools/gm2_parity.mjs | 9065ce8bb3e744a8120e59c3d23bab90 |

## Engine-/Store-Baseline (parallele Nutzerarbeit, eingefroren für GM3)

`git diff --numstat` gegen `014ac6f` (js/engine, calc, activity*, garmin*, engine-Tests):

```
478  3   app/js/activity-config.js
156  2   app/js/activity-normalize.js
 62  1   app/js/activity-store.js
 31  2   app/js/activity-sync.js
198 78   app/js/activity.js
273  7   app/js/calc.js
 31  2   app/js/engine/decision-engine-v2.js
  1  0   app/js/engine/engine-contracts.js
 32 88   app/js/engine/shadow-runner.js
 32  2   app/supabase/tests/engine_program_e_test.mjs
```

md5 der eingefrorenen Dateien:

```
7be492ce88f74a7a173661214718891f  js/calc.js
db41535e425d46d0e0e0ef1b8b126ad6  js/activity-store.js
5b6fab853fbde37aefa7e9021f23fdd9  js/activity-config.js
943280c0e92ad2f27863643ebdbd631b  js/activity-normalize.js
3bf9f2bb1faff708014131937b712f83  js/activity-sync.js
939b2750da5946bc33ddb1d5c4a135c1  js/activity.js
77de37d3027a3e9bbd1764a411d6c5f6  js/engine/decision-engine-v2.js
3b3798980f22616167f9c751c261353c  js/engine/engine-contracts.js
b3036180e001730d9300b96e33629b3b  js/engine/goal-portfolio.js
1a3b7b2613c4ea67827c762333c39997  js/engine/plan-engine-v2.js
9d2054682370c211b8110c6be9733027  js/engine/readiness-engine-v2.js
ad7030d758a6f964d86a95e87c841341  js/engine/running-capacity-factory.js
f7d30327416c73a180f090a63d8700b4  js/engine/scheduler-goal-allocation.js
62d48bf48e272fb858c61d4c085cec11  js/engine/scheduler-input-factory.js
3601d8db31a71e0af2842ce3ba48736b  js/engine/scheduler-v1.js
0251d268e7ae94ceae6e092b0922698a  js/engine/shadow-runner.js
bdd6af5ce8d17109f3ea635bff148d3b  js/engine/training-input-resolver.js
```

Abnahmekriterium GM3: identische md5 aller hier gelisteten Engine-/Store-Dateien;
GM3 schreibt ausschließlich js/ui.js, styles.css, tools/gm3_parity.mjs,
supabase/tests/gm3_activity_parity_test.mjs und docs/gm-ref/gm3/*.

Testbaseline: 172 Tests, 166 grün, 6 ENV-Fehler (batch2f_offline_queue_live,
live_workout_rls_phase42, live_workout_rpc_smoke_phase42, muscle_volume_sql_phase43,
rls, training_rls_phase41).
