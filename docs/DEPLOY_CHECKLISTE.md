# ORVIA — Deploy-Checkliste (gianthaysen.github.io)

Stand: 2026-06-21 08:40, Service-Worker-Version in sw.js:
    const C = 'orvia-v8-106';

Alle folgenden Dateien müssen am EXAKT gleichen Pfad im GitHub-Repo liegen.
Größe = lokaler Stand (zur groben Plausibilitätsprüfung).

## Kerndateien (Root)
- [ ] index.html                  30377 Bytes
- [ ] styles.css                 142156 Bytes
- [ ] sw.js                        3112 Bytes
- [ ] manifest.webmanifest          648 Bytes

## JavaScript (js/ und js/repos/) — Reihenfolge wie in index.html geladen
- [ ] js/4.4.1/chart.umd.min.js                FEHLT LOKAL
- [ ] js/config.js                               1448 Bytes
- [ ] js/supplements.js                         12353 Bytes
- [ ] js/calc.js                                64057 Bytes
- [ ] js/data.js                                14458 Bytes
- [ ] js/profile.js                             27043 Bytes
- [ ] js/issues.js                              14890 Bytes
- [ ] js/intelligence.js                         9893 Bytes
- [ ] js/orvia-pro.js                           17215 Bytes
- [ ] js/charts.js                               4538 Bytes
- [ ] js/ui.js                                 183031 Bytes
- [ ] js/activity.js                            27340 Bytes
- [ ] js/nutrition.js                           12430 Bytes
- [ ] js/insights.js                             8543 Bytes
- [ ] js/race.js                                 4168 Bytes
- [ ] js/story.js                               14173 Bytes
- [ ] js/extras.js                               9802 Bytes
- [ ] js/repos/repoBase.js                       4909 Bytes
- [ ] js/repos/profileRepository.js              1905 Bytes
- [ ] js/repos/checkinRepository.js              2840 Bytes
- [ ] js/repos/trainingLoadRepository.js         6828 Bytes
- [ ] js/repos/readinessRepository.js            2793 Bytes
- [ ] js/repos/goalRepository.js                 1855 Bytes
- [ ] js/repos/availabilityRepository.js         1817 Bytes
- [ ] js/training-domain.js                     13095 Bytes
- [ ] js/repos/exerciseRepository.js             2846 Bytes
- [ ] js/repos/sportRepository.js                2886 Bytes
- [ ] js/repos/trainingPlanRepository.js         4710 Bytes
- [ ] js/repos/workoutRepository.js             13452 Bytes
- [ ] js/offline-queue.js                        9069 Bytes
- [ ] js/profile-store.js                        7881 Bytes
- [ ] js/checkin-store.js                        8004 Bytes
- [ ] js/migrate-blob.js                         7487 Bytes
- [ ] js/readiness-source.js                     7760 Bytes
- [ ] js/readiness-store.js                      8228 Bytes
- [ ] js/training-migration.js                   3002 Bytes
- [ ] js/workout-store.js                       30236 Bytes
- [ ] js/sync.js                                 9702 Bytes
- [ ] js/auth.js                                16816 Bytes
- [ ] js/checkin-extra.js                        7454 Bytes
- [ ] js/workout-ui.js                          52592 Bytes

## Assets (Icons/Branding)
- [ ] assets/.DS_Store                                 6148 Bytes
- [ ] assets/brand/orvia-favicon.svg                    550 Bytes
- [ ] assets/brand/orvia-icon-dark.svg                  948 Bytes
- [ ] assets/brand/orvia-icon-light.svg                 954 Bytes
- [ ] assets/brand/orvia-icon.svg                      1504 Bytes
- [ ] assets/brand/orvia-lockup-horizontal.svg         1341 Bytes
- [ ] assets/brand/orvia-lockup-stacked.svg            1269 Bytes
- [ ] assets/brand/orvia-og-image.png                 78153 Bytes
- [ ] assets/brand/orvia-symbol-only.svg                698 Bytes
- [ ] assets/brand/orvia-wordmark.svg                   481 Bytes
- [ ] assets/icons/apple-touch-icon.png               14982 Bytes
- [ ] assets/icons/icon-192.png                       16136 Bytes
- [ ] assets/icons/icon-512.png                       50467 Bytes
- [ ] assets/icons/maskable-icon-512.png              39172 Bytes
- [ ] assets/og/orvia-og-image.png                    78153 Bytes

## NUR in Supabase ausführen (NICHT auf github.io hochladen)
- [ ] supabase/migrations/0002_core_data_foundation.sql
- [ ] supabase/migrations/0003_training_domain.sql
- [ ] supabase/migrations/0004_live_workout.sql
- [ ] supabase/migrations/0005_live_workout_hardening.sql
- [ ] supabase/migrations/0006_exercise_library_expansion.sql
- [ ] supabase/migrations/0007_workout_terminal_rpc.sql

Hinweis: Der Ordner supabase/tests/ und supabase/migrations/ gehören NICHT auf die Website.
