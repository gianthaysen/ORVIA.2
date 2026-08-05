/* ORVIA · Phase 4 (2026-08-05) — Sichtbare Qualitätsmängel (Umsetzungsplan §Phase 4,
   Gap-Analyse P2-1…P2-5, Entscheidungen 2+4).

   Verträge:
     4.1 Muskelkarte: timedOut = „aufgegeben OHNE Bereitschaft"; Perf: Promise.all
         statt sequentieller Detail-Schleife + 60-s-Cache NUR für den refresh-Pfad
         (Invalidierung über orvia:activity-updated).
     4.2 E-02: zentraler Quellenprioritätsvertrag (source-contract.js) — Messung,
         Profilwert und Tanaka-Schätzung nie unter derselben Kennzeichnung.
     4.3 Analyse-CSS: .kpi-Umbruch, #gmAna .mile-Margin (nur dort), .impact-Flex.
     4.4 Hypnogramm: EINE Farbquelle (STAGE_COLOR), Spurenbeschriftung + Legende,
         4 GM_METRIC_INFO-Einträge für die Schlafphasen.
     4.5 F.dayLabel: ein Tages-Label-Formatierer; fmtDate/relDayTitle/gmStandLbl
         lesen ihn (Details in format_utils_test).
     4.6 Handle/Bio: vertikaler Durchstich 0029 (Migration→Repo→Store→Editor→Anzeige).

   node supabase/tests/phase4_quality_test.mjs [appRoot-absolut] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
/* Zwei Checkout-Layouts: Cloud (App unter ../../) und Geraet (App unter ../../../app). */
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2]) : (existsSync(join(_flat, 'index.html')) ? _flat : join(_flat, '..', 'app'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R = f => readFileSync(join(APP, f), 'utf8');

/* ============ 4.1 Muskelkarte (Quelltext + Verhaltens-Sandbox) ============ */
const gv = R('js/gym-volume.js');
ok('4.1 timedOut nur ohne erreichte Bereitschaft (kein data_unavailable trotz Daten)',
   /r\.timedOut = !ready/.test(gv));
ok('4.1 Detail-Nachladen parallel (Promise.all), Fehler weiter einzeln gezählt',
   /Promise\.all\(uniqueIds\.map/.test(gv) && /WORKOUT_DETAILS_FAILED/.test(gv));
ok('4.1 Kurzzeit-Cache NUR für den refresh-Pfad + Event-Invalidierung',
   /GYM_PIPE_TTL_MS = 60000/.test(gv) && /if \(!opts\.refresh \|\| opts\.force\)/.test(gv) && /orvia:activity-updated.*invalidateGymPipelineCache/.test(gv));

/* Verhaltens-Sandbox: waitForGymDataDependencies mit nie bereitem Store → timedOut,
   mit bereitem Store → NICHT timedOut (auch wenn Auth fehlt). */
{
  const gymAct = () => ({ sportId: 'gym', status: 'completed', startedAt: new Date().toISOString(),
    workoutSessionId: 'ws-t1', exercises: [{ exerciseNameSnapshot: 'Bankdrücken',
      sets: [{ set_type: 'working', completed: true, reps: 8 }, { set_type: 'working', completed: true, reps: 8 }] }] });
  const mk = (readyStore) => new Promise((res) => {
    const sb = { window: null, console, setTimeout: (fn) => fn(), module: undefined, localStorage: undefined };
    sb.window = sb; sb.globalThis = sb;
    vm.createContext(sb);
    vm.runInContext(gv, sb, { filename: 'gym-volume.js' });
    sb.ORVIA.activityStore = readyStore ? { listActivities: () => [gymAct()] } : null;
    // waitForGymDataDependencies ist nicht exportiert → Verhalten über den Report-Status
    // pruefen. maxWaitMs=900 < 3000: die Auth-Wartefrist muss aufs Budget gekappt sein,
    // sonst kippt ein BEREITER Store mit ECHTEN Daten in data_unavailable (der alte Bug).
    sb.ORVIA.gymVolume.buildShadowReport({ days: 7, maxWaitMs: 900 }).then(r => res(r));
  });
  const rTimeout = await mk(false);
  const rReady = await mk(true);
  ok('4.1 SANDBOX · Store nie bereit ⇒ data_unavailable + timedOut', rTimeout.reportStatus === 'data_unavailable' && rTimeout.diagnostics.readiness.timedOut === true, rTimeout.reportStatus);
  ok('4.1 SANDBOX · Store bereit + Daten, Auth fehlt ⇒ ok, NICHT timedOut (vorher Fehlklassifikation)',
     rReady.reportStatus === 'ok' && rReady.diagnostics.readiness.timedOut === false && rReady.source.workoutCount === 1,
     rReady.reportStatus + ' · timedOut=' + rReady.diagnostics.readiness.timedOut + ' · workouts=' + rReady.source.workoutCount);
}

/* ============ 4.2 E-02 Quellenprioritätsvertrag ============ */
{
  const sc = require(join(APP, 'js/metrics/source-contract.js'));
  ok('4.2 Rangfolge exakt E-02 (1..4)',
     sc.RANK.measured_validated === 1 && sc.RANK.device_sync === 2 && sc.RANK.profile_manual === 3 && sc.RANK.derived_estimate === 4);
  ok('4.2 confidence-Zuordnung exakt E-02',
     sc.CONFIDENCE.device_sync === 'measured' && sc.CONFIDENCE.profile_manual === 'user_provided' && sc.CONFIDENCE.derived_estimate === 'estimated');
  ok('4.2 KERNREGEL · Profilwert und Schätzwert nie unter derselben Kennzeichnung',
     sc.LABEL.profile_manual !== sc.LABEL.derived_estimate && sc.CONFIDENCE.profile_manual !== sc.CONFIDENCE.derived_estimate);
  const picked = sc.pick([
    sc.make(187, 'derived_estimate', { method: 'tanaka_208_07' }),
    sc.make(198, 'profile_manual', {})
  ]);
  ok('4.2 pick(): Profilwert (Rang 3) schlägt Schätzung (Rang 4)', picked.value === 198 && picked.source === 'profile_manual');
  ok('4.2 Anzeigezeile nach Entscheidung 2', sc.line(picked, 'bpm') === '198 bpm · Quelle: Profil, manuell');
  /* HFmax-Auflösung: gemessen > Tanaka; ohne beides ⇒ null (kein 190-Default) */
  const hm1 = sc.hfMax({ hfMaxMeasured: 198, age: 22 });
  const hm2 = sc.hfMax({ hfMaxMeasured: null, age: 22 });
  const hm3 = sc.hfMax({ hfMaxMeasured: null, age: null });
  ok('4.2 hfMax: Messung/Profilwert gewinnt', hm1.value === 198 && hm1.source !== 'derived_estimate');
  ok('4.2 hfMax: nur Alter ⇒ Tanaka als GEKENNZEICHNETE Schätzung (193 bei 22 J.)',
     hm2.value === 193 && hm2.source === 'derived_estimate' && hm2.method === 'tanaka_208_07');
  ok('4.2 hfMax: weder Messung noch Alter ⇒ null (kein erfundener Default)', hm3 === null);
  ok('4.2 restingHr: kein Schätzpfad — ohne Messung null', sc.restingHr({}) === null);
  /* Provider-Herkunft: _sectionMeta.body.source==='provider_sync' ⇒ device_sync */
  const hmDev = sc.hfMax({ hfMaxMeasured: 195, _sectionMeta: { body: { source: 'provider_sync', updatedAt: '2026-08-01T10:00:00Z' } } });
  ok('4.2 Provider-Herkunft wird als device_sync gekennzeichnet (nie mit manuell vermischt)',
     hmDev.source === 'device_sync' && hmDev.confidence === 'measured');
}
const prof = R('js/profile.js');
ok('4.2 renderZones nutzt den zentralen Vertrag + getrennte Titel-Kennzeichnung',
   /ORVIA\.sourceContract\.hfMax\(PROFILE\)/.test(prof) && /\(berechnet\)/.test(prof) && /\(Profil\)/.test(prof) && /\(gemessen\)/.test(prof));
ok('4.2 Tanaka-Zonen tragen den Schätzwert-Hinweis + Handlungspfad',
   /Schätzwert, keine Messung/.test(prof) && /Trage eine gemessene HFmax/.test(prof));
const idx = R('index.html');
ok('4.2 source-contract.js geladen + im SW-Precache',
   /js\/metrics\/source-contract\.js/.test(idx) && /js\/metrics\/source-contract\.js/.test(R('sw.js')));

/* ============ 4.3 Analyse-CSS ============ */
const css = R('styles.css');
ok('4.3 .kpi span: Umbruch/Trennung statt Überlauf (P2-2a)',
   /\.kpi span\{[^}]*overflow-wrap:anywhere;hyphens:auto/.test(css));
ok('4.3 lang="de" am <html> (hyphens:auto wirksam)', /<html lang="de"/.test(idx));
const ui = R('js/ui.js');
ok('4.3 4-KPI-Reihen in der Analyse als 2×2 (Übersicht + Ausdauer)',
   (ui.match(/kpi-row" style="grid-template-columns:repeat\(2,1fr\)"/g) || []).length === 2);
ok('4.3 #gmAna .mile: 18px-Seitenabstand NUR dort (Entscheidung 4) + Ellipsis-Schutz',
   /#gmAna \.mile\{margin-left:18px;margin-right:18px\}/.test(css) && /#gmAna \.mile \.mile-t,#gmAna \.mile \.mile-d\{white-space:nowrap/.test(css)
   && /\n\.mile\{display:flex;gap:12px/.test(css) /* globale Regel unangetastet (Pixelvertrag) */);
ok('4.3 .impact: gap + min-width:0 + text-align:right (P2-2c)',
   /\.impact\{[^}]*gap:10px/.test(css) && /\.impact strong\{[^}]*min-width:0;text-align:right/.test(css) && /\.impact>span\{flex:0 0 auto;white-space:nowrap\}/.test(css));

/* ============ 4.4 Hypnogramm ============ */
const sr = R('js/series-reader.js');
ok('4.4 EINE Farbquelle: STAGE_COLOR mit CSS-Variablen + Fallback, exportiert',
   /deep: 'var\(--sleep,#9585ED\)'/.test(sr) && /Reader\.STAGE_COLOR = STAGE_COLOR/.test(sr) && /Reader\.STAGE_LABEL = STAGE_LABEL/.test(sr));
ok('4.4 ui.js-Phasenbalken lesen dieselbe Quelle (keine zweite Farbwelt)',
   /ORVIA\.seriesReader\.STAGE_COLOR/.test(ui) && !/'sleep_deep_min','Tief','var\(--sleep\)'/.test(ui));
ok('4.4 Hypnogramm: Spurenbeschriftung + Zeitachsen-Zeile + <title> je Segment',
   /Spurenbeschriftung als HTML-Spalte/.test(sr) && /Einschlafen/.test(sr) && /<title>/.test(sr));
ok('4.4 Legende unter dem Hypnogramm-Slot aus derselben Quelle',
   /gmHypnoSlot/.test(ui) && /STAGE_LABEL/.test(ui) && /dist-leg/.test(ui));
{
  /* Render-Sandbox: Labels + Wrapper vorhanden, plain-Modus liefert reines SVG */
  const sb = { window: null, console, module: undefined }; sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb); vm.runInContext(sr, sb, { filename: 'series-reader.js' });
  const H = sb.ORVIA.seriesReader.renderHypnogram([[0, 1800, 'deep'], [1800, 3600, 'light'], [5400, 1200, 'rem'], [6600, 300, 'awake']]);
  ok('4.4 SANDBOX · Ausgabe trägt alle 4 Spurenlabels', /Tief/.test(H) && /Leicht/.test(H) && /REM/.test(H) && /Wach/.test(H));
  const P = sb.ORVIA.seriesReader.renderHypnogram([[0, 1800, 'deep']], { plain: true });
  ok('4.4 SANDBOX · plain-Modus = reines SVG (Abwärtskompatibilität)', /^<svg/.test(P) && !/Tief<\/span>/.test(P));
  ok('4.4 SANDBOX · leere Punkte ⇒ leerer String (kein erfundenes Bild)', sb.ORVIA.seriesReader.renderHypnogram([]) === '');
}
ok('4.4 GM_METRIC_INFO: 4 Schlafphasen-Einträge mit echtem Erklärtext (statt Generiktext)',
   /sleep_deep_min:\{hb:true/.test(ui) && /sleep_light_min:\{hb:null/.test(ui) && /sleep_rem_min:\{hb:true/.test(ui) && /sleep_awake_min:\{hb:false/.test(ui)
   && /Tiefschlaf verschlechtert Regeneration/.test(ui));

/* ============ 4.5 Relative Tageslabels ============ */
const fu = R('js/format-utils.js');
ok('4.5 F.dayLabel existiert (Heute/Gestern/Morgen/Wochentag, todayKey injizierbar)',
   /F\.dayLabel = function \(key, todayKey\)/.test(fu));
ok('4.5 fmtDate ruft dayLabel zuerst (11 Aufrufstellen zentral bedient), Datum bleibt erhalten',
   /function fmtDate\(s\)\{\n  try\{\n    var _F=\(window\.ORVIA&&ORVIA\.fmt\)\|\|null;/.test(ui) && /rl\+', '\+new Date\(s\+'T12:00'\)/.test(ui));
ok('4.5 die drei Ad-hoc-Lösungen lesen den zentralen Formatierer',
   /relDayTitle[\s\S]{0,400}_F\.dayLabel/.test(ui) && /gmStandLbl[\s\S]{0,500}dayLabel/.test(ui) && /_rl3==='Heute'/.test(ui));

/* ============ 4.6 Handle + Bio (0029, vertikaler Durchstich) ============ */
ok('4.6 Migration 0029 vorhanden (Spalten + Längen-Guards, Anzeige-Handle ohne Unique-Anspruch)',
   existsSync(join(APP, 'supabase/migrations/0029_profile_handle_bio.sql'))
   && /add column if not exists handle text/.test(R('supabase/migrations/0029_profile_handle_bio.sql'))
   && /char_length\(bio\) <= 160/.test(R('supabase/migrations/0029_profile_handle_bio.sql')));
const repo = R('js/repos/profileRepository.js'), store = R('js/profile-store.js');
ok('4.6 Repository + Store mappen handle/bio (Sync-Kanal, 0016-Muster)',
   /handle: profile\.handle \?\? null/.test(repo) && /'handle', 'bio'/.test(store) && /row\.handle !== undefined/.test(store));
ok('4.6 Editor: Felder in Persönliche Grunddaten, Handle normalisiert (max 30, [a-z0-9._]), Bio max 160',
   /key:'handle'/.test(prof) && /key:'bio'/.test(prof) && /slice\(0,30\)/.test(prof) && /slice\(0,160\)/.test(prof) && /replace\(\/\[\^a-z0-9\._\]\/g,''\)/.test(prof));
ok('4.6 Profilkopf rendert echte Werte; leer bleibt ehrlich (kein Fake-Handle)',
   /PROFILE\.handle\)\?'@'\+gmEsc\(PROFILE\.handle\):'—'/.test(ui) && /PROFILE\.bio\)\?gmEsc\(PROFILE\.bio\)/.test(ui));

/* ============ SW-Version ============ */
const sw = R('sw.js');
const swv = (sw.match(/orvia-v8-(\d+)/) || [])[1];
ok('SW-Version erhoeht (>= 228, Phase 4), genau einmal', swv != null && Number(swv) >= 228 && (sw.match(/orvia-v8-\d+/g) || []).length === 1, 'orvia-v8-' + swv);

console.log('\nphase4_quality: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
