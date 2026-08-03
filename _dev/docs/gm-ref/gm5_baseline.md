# GM5-Baseline — gesicherter GM4-Abnahmestand (unveränderlich)

Erfasst: 2026-07-26 · Geräte-HEAD: `014ac6f` — unverändert. Referenz für den GM5-Nachweis
„Profile-, Auth-, Goal-, Activity-, Calc-, Engine- und Store-Dateien gegenüber GM4-Baseline
byte-identisch". Parallele Nutzerarbeit bleibt bewahrt.

## GM4-Abnahmestand (md5, Gerät = Container)

| Datei | md5 |
|---|---|
| js/ui.js | 0bf4cff9fa1324a1d555e98118c795d9 |
| styles.css | 8845e63647efe6b3a62a6461f9fd974c |
| index.html | 8e791a571060badd23b4cf9e6f2cbd9b |
| tools/gm4_parity.mjs | 374426ff2a55c30b9b74b188a48a10ef |
| supabase/tests/gm4_analysis_parity_test.mjs | 89edeadc9894d7977abed8d860ca2c2f |

## Eingefrorene Dateien (md5) — Profil/Auth/Goal/Activity/Calc/Engine/Store

```
b1e0813225d0e15be06aca027fff5804  js/profile.js
74ba380a7b3efd2958bc388b84127d1a  js/profile-model.js
3df5f90123721fe21396550e7988f666  js/profile-store.js
28cd90252df150e125a8e92eec013e3f  js/profile-center.js
21750d5893c4c1bda27dc386357123d9  js/profile-ui-kit.js
ba67335678735b936c78db40fbcf6929  js/avatar-store.js
87f08ae7a93eb3e4dfc10d67d9445ca8  js/auth.js
568c226287ef0b8c6fbe30538db595ba  js/auth-logic.js
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
f799c81119df5ecec4a1fe823c85f7c6  js/data.js
ff1f268522f78a85a8b96e051c0f41c4  js/sync.js
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

Abnahmekriterium GM5: identische md5 aller gelisteten Dateien; GM5 schreibt ausschließlich
js/ui.js, styles.css, index.html, tools/gm5_parity.mjs,
supabase/tests/gm5_profile_parity_test.mjs und docs/gm-ref/gm5*.

Testbaseline: 174 Tests, 168 grün, 6 ENV-Fehler. SW `orvia-v8-197` genau 1×.
