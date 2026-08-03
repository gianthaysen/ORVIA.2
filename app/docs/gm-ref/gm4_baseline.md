# GM4-Baseline — gesicherter GM3-Abnahmestand (unveränderlich)

Erfasst: 2026-07-26 · Geräte-HEAD: `014ac6f` (2026-07-19 19:39:12 +0000) — unverändert.
Referenz für den GM4-Nachweis „Engine, Scheduler, Stores, Resolver und Muskelengine
gegenüber GM3-Baseline byte-identisch". Parallele Nutzerarbeit bleibt bewahrt.

## GM3-Abnahmestand (md5, Gerät = Container)

| Datei | md5 |
|---|---|
| js/ui.js | 64e8087d9240b41d6540ff8bebc1563e |
| styles.css | 551b2aa2d30f51c9259be7598f2b5c58 |
| index.html | d1f0330071b08c00d51dbba7b6b5511c |
| tools/gm3_parity.mjs | bddbed687c77cbd913f36664acf445a2 |
| supabase/tests/gm3_activity_parity_test.mjs | cf37b33230f96edfcecf49f901af1d33 |

## Eingefrorene Engine-/Store-/Resolver-/Muskelengine-Dateien (md5)

```
7be492ce88f74a7a173661214718891f  js/calc.js
db41535e425d46d0e0e0ef1b8b126ad6  js/activity-store.js
5b6fab853fbde37aefa7e9021f23fdd9  js/activity-config.js
943280c0e92ad2f27863643ebdbd631b  js/activity-normalize.js
3bf9f2bb1faff708014131937b712f83  js/activity-sync.js
939b2750da5946bc33ddb1d5c4a135c1  js/activity.js
d2244291ca89c4e264bcb53c924d07cf  js/gym-volume.js
737145c115a425ea224cae862e21e8c3  js/intelligence.js
50567d99bff13bd2ea55c65127fe6722  js/insights.js
1bc07779cf6a5cf1ab3a1d522fc57e61  js/readiness-store.js
dcf60e951f957dca04cc1d236883b421  js/readiness-source.js
f01f6c82da543b7b259cffc997bd6090  js/checkin-field-resolver.js
bbce626f97090de8abfe4e60c860cefe  js/orvia-charts.js
ab39e5e8e3b4085f50ec21d1ff4a47ee  js/charts.js
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
5f4c215bae3a3520df156ba5bf491385  js/metrics/energy-expenditure-resolver.js
88e1f3f479213cc96b74fcf83146a2e5  js/metrics/metric-registry.js
9ce393c5807cb757e7ede0d5674bee93  js/metrics/metric-resolver.js
21ccd021992d9c8252e65652dcd6cb9c  js/metrics/profile-metric-resolver.js
```

Abnahmekriterium GM4: identische md5 aller hier gelisteten Dateien; GM4 schreibt
ausschließlich js/ui.js, styles.css, index.html, tools/gm4_parity.mjs,
supabase/tests/gm4_analysis_parity_test.mjs und docs/gm-ref/gm4*.

Testbaseline: 173 Tests, 167 grün, 6 ENV-Fehler (unverändert). SW `orvia-v8-197` genau 1×.
