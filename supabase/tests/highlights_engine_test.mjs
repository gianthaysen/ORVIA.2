/* ============================================================
   ORVIA · highlights_engine (v8-446) — Grundgeruest der Highlights-Engine
   ------------------------------------------------------------
   STATUS DES PRUEFLINGS: vorbereitet. js/engine/highlights.js ist ein reines Modul; die App
   laedt es noch nicht, die Story ist unveraendert. Geprueft wird der Vertrag, auf dem die
   naechsten Schritte (Regeln je Sportart, Leistungsbasis, Darstellung) aufbauen:

     A  Arten, Stufen, Vorlagen
     B  Kandidat: ohne Beleg keine Aussage, ohne Vergleichsgruppe kein Vergleich
     C  Bewertung
     D  Zusammenfuehren fast gleicher Aussagen
     E  Auswahl und Reihenfolge — die Engine fuellt nie auf
     F  Ereignis, Erzeuger, wirksame Werte

   NICHT Teil dieses Tests (eigene Schritte): Erkennen von Bestleistungen, Meilensteinen und
   erreichten Zielen. Die Bausteine dafuer gibt es schon und sie haben eigene Tests
   (bests_multisport, pb_sync, race_result, goal_history) — ein Erzeuger je Baustein folgt.
   node supabase/tests/highlights_engine_test.mjs
   ============================================================ */
import { existsSync as _exApp } from 'node:fs';
import fs from 'fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);
globalThis.window = globalThis; globalThis.ORVIA = {};
const imp = async f => (await import(new URL(_APPREL + f, import.meta.url))).default;
const E = await imp('js/activity-effective.js');
const H = await imp('js/engine/highlights.js');

const EV = { basis: 'source', metric: 'x' };
const mk = (type, extra) => { const r = H.candidate(Object.assign({ type, activityId: 'a1', sportId: 'running', value: { v: 1, unit: 'x' }, evidence: EV }, extra || {})); if (!r.ok) throw new Error(type + ': ' + r.code + ' ' + r.message); return r.candidate; };
const CMP = { comparison: { v: 2, delta: -1 }, evidence: { basis: 'orvia', metric: 'x', comparedTo: 'bisherige Bestmarke', n: 12 } };

sec('A · Arten, Stufen, Vorlagen');
{
  const WANT = ['SESSION_SUMMARY', 'PERSONAL_RECORD', 'FIRST_EVER', 'MILESTONE', 'GOAL_ACHIEVEMENT', 'PERFORMANCE_IMPROVEMENT', 'TECHNIQUE_IMPROVEMENT', 'POWER_RECORD', 'FTP_IMPROVEMENT', 'VOLUME_RECORD', 'DISTANCE_RECORD',
    'PACE_RECORD', 'ZONE_HIGHLIGHT', 'TRAINING_EFFECT', 'ROUTE_HIGHLIGHT', 'COURSE_RECORD', 'CONSISTENCY', 'COMEBACK', 'RACE_RESULT', 'PLAN_ACHIEVEMENT', 'SPORT_SPECIFIC'];
  const types = H.types();
  ok('A1 alle 21 Arten der Vorgabe sind angelegt', WANT.every(t => types.indexOf(t) >= 0) && types.length === 21, WANT.filter(t => types.indexOf(t) < 0).join(','));
  ok('A2 jede Art hat Grundwert 0–100, eine Rolle und eine vorhandene Vorlage', types.every(t => { const d = H.typeDef(t); return d.base >= 0 && d.base <= 100 && d.role && H.templates().indexOf(d.template) >= 0; }));
  const b = t => H.typeDef(t).base;
  ok('A3 Stufen wie vorgegeben: Ziel 100 > Bestleistung 95 > erstes Mal 90 > FTP 85 > sportartspezifisch 80 > Meilenstein 70 > Verbesserung 60 > Merkmal 50 > Bestaendigkeit 40 > Zusammenfassung 30',
    b('GOAL_ACHIEVEMENT') === 100 && b('PERSONAL_RECORD') === 95 && b('FIRST_EVER') === 90 && b('FTP_IMPROVEMENT') === 85 && b('SPORT_SPECIFIC') === 80 && b('MILESTONE') === 70 && b('PERFORMANCE_IMPROVEMENT') === 60 && b('ZONE_HIGHLIGHT') === 50 && b('CONSISTENCY') === 40 && b('SESSION_SUMMARY') === 30);
  const TPL = ['hero_metric', 'record_reveal', 'goal_achievement', 'before_after', 'progress_ring', 'timeline', 'map', 'chart', 'zone_distribution', 'power_curve', 'milestone', 'first_ever', 'comparison', 'split_breakdown', 'technique', 'training_effect', 'volume', 'achievement', 'route', 'celebration'];
  ok('A4 alle 20 Darstellungsfamilien der Vorgabe sind benannt, je mit Pflichtfeldern', TPL.every(t => H.templates().indexOf(t) >= 0) && H.templates().length === 20 && H.templates().every(t => H.templateFields(t).length >= 1));
  ok('A5 Bestaendigkeit und Comeback liegen unter jeder Bestleistung (Vorgabe: niedriger priorisieren)', b('CONSISTENCY') < b('PACE_RECORD') && b('COMEBACK') < b('MILESTONE'));
  ok('A6 Obergrenzen je Erzaehlform: normal 6, interessant 8, Bestleistung/Rennen 12, Ziel 12', J(H.limits()) === J({ normal: 6, interesting: 8, record: 12, goal: 12 }));
}

sec('B · Kandidat');
{
  const base = { type: 'PACE_RECORD', activityId: 'a1', value: { v: 300, unit: 's/km' } };
  ok('B1 ohne Beleg keine Aussage', H.candidate(base).code === 'NO_EVIDENCE' && H.candidate(Object.assign({}, base, { evidence: { basis: 'geschaetzt' } })).code === 'NO_EVIDENCE');
  ok('B2 Vergleich ohne Vergleichsgruppe wird abgelehnt („besser" ohne „als was" gibt es nicht)', H.candidate(Object.assign({}, base, { comparison: { v: 310 }, evidence: { basis: 'orvia' } })).code === 'NO_COMPARISON_BASIS');
  ok('B3 Pflichtfelder der Vorlage fehlen ⇒ abgelehnt, mit Angabe was fehlt', (r => r.code === 'TEMPLATE_FIELDS' && /comparison/.test(r.message))(H.candidate(Object.assign({}, base, { evidence: EV }))));
  ok('B4 unbekannte Art, fehlende Einheit, unbekannte Vorlage, leere Eingabe: geordnete Ablehnung statt Ausnahme',
    H.candidate({ type: 'GIBTS_NICHT', activityId: 'a', evidence: EV }).code === 'UNKNOWN_TYPE' && H.candidate({ type: 'MILESTONE', evidence: EV }).code === 'NO_ACTIVITY'
    && H.candidate({ type: 'MILESTONE', activityId: 'a', evidence: EV, template: 'konfetti' }).code === 'UNKNOWN_TEMPLATE' && H.candidate(null).code === 'NO_INPUT');
  const c = mk('PACE_RECORD', CMP);
  ok('B5 gueltiger Kandidat: Rolle und Vorlage aus der Art, Beleg vollstaendig uebernommen, Bewertung gesetzt', c.role === 'reveal' && c.template === 'record_reveal' && c.evidence.basis === 'orvia' && c.evidence.comparedTo === 'bisherige Bestmarke' && c.evidence.n === 12 && c.score === 80);
  ok('B6 Herkunft unterscheidbar: Messwert der Quelle / von ORVIA berechnet / Angabe des Nutzers', ['source', 'orvia', 'manual'].every(bs => H.candidate({ type: 'SESSION_SUMMARY', activityId: 'a', value: 1, evidence: { basis: bs } }).ok));
  const inp = Object.assign({ type: 'MILESTONE', activityId: 'a', value: 1, threshold: 100, evidence: EV }); const snap = J(inp); H.candidate(inp);
  ok('B7 die Eingabe wird nicht veraendert', J(inp) === snap);
}

sec('C · Bewertung');
{
  ok('C1 Feinabstimmung des Erzeugers ist begrenzt (−20 … +10) — eine Zusammenfassung kann nie zur Bestleistung werden', mk('SESSION_SUMMARY', { weight: 999 }).score === 40 && mk('PERSONAL_RECORD', Object.assign({ weight: -999 }, CMP)).score === 75);
  ok('C2 geringe Sicherheit daempft: dieselbe Aussage mit halber Sicherheit zaehlt 75 %', mk('PERSONAL_RECORD', Object.assign({ confidence: 0.5 }, CMP)).score === 71 && mk('PERSONAL_RECORD', Object.assign({ confidence: 0 }, CMP)).score === 48);
  ok('C3 Bewertung bleibt in 0–100', mk('GOAL_ACHIEVEMENT', { goal: { title: 'x' }, weight: 10 }).score === 100);
  ok('C4 score() ist rein und fuer Unbekanntes 0', H.score({ type: 'X' }) === 0 && H.score(null) === 0);
}

sec('D · Zusammenfuehren');
{
  /* Ein 5-km-Lauf mit Bestzeit erzeugt drei fast gleiche Aussagen */
  const pr = mk('PERSONAL_RECORD', Object.assign({ group: 'run:5k' }, CMP));
  const pace = mk('PACE_RECORD', Object.assign({ group: 'run:5k' }, CMP));
  const fast = mk('SPORT_SPECIFIC', { group: 'run:5k' });
  const zone = mk('ZONE_HIGHLIGHT', { zones: [1, 2, 3] });
  const input = [fast, zone, pace, pr]; const snap = J(input);
  const d = H.dedupe(input);
  ok('D1 5-km-Bestzeit + bestes Tempo + schnellster Lauf werden EIN Highlight; das Zonen-Highlight bleibt fuer sich', d.length === 2 && d[0].type === 'PERSONAL_RECORD' && d[1].type === 'ZONE_HIGHLIGHT', d.map(x => x.type).join(','));
  ok('D2 die zusammengefuehrten Aussagen gehen nicht verloren: sie haengen als supports am staerksten', d[0].supports.length === 2 && J(d[0].supports.map(s => s.type).sort()) === J(['PACE_RECORD', 'SPORT_SPECIFIC']) && d[0].supports.every(s => s.evidence && s.evidence.basis));
  ok('D3 die Eingabe bleibt unveraendert', J(input) === snap);
  const other = H.candidate(Object.assign({ type: 'PACE_RECORD', activityId: 'a2', value: 1, group: 'run:5k' }, CMP)).candidate;
  ok('D4 dieselbe Gruppe an einer ANDEREN Einheit ist ein anderes Highlight', H.dedupe([pr, other]).length === 2);
  ok('D5 ohne Gruppe wird nie zusammengefuehrt (zwei Zonen-Aussagen bleiben zwei)', H.dedupe([zone, mk('ZONE_HIGHLIGHT', { zones: [1], id: 'z2' })]).length === 2);
  ok('D6 Reihenfolge ist stabil und ohne Zufall (gleicher Wert ⇒ nach Art, dann id)', J(H.dedupe([zone, mk('TRAINING_EFFECT')]).map(x => x.type)) === J(H.dedupe([mk('TRAINING_EFFECT'), zone]).map(x => x.type)));
  ok('D7 traegt eine der zusammengefuehrten Aussagen „major", traegt es das Highlight', H.dedupe([pr, mk('PACE_RECORD', Object.assign({ group: 'run:5k', major: true }, CMP))])[0].major === true);
}

sec('E · Auswahl und Reihenfolge');
{
  const sum = mk('SESSION_SUMMARY');
  const feats = ['ZONE_HIGHLIGHT', 'TRAINING_EFFECT', 'ROUTE_HIGHLIGHT'].map((t, i) => mk(t, { zones: [1], route: [[0, 0]], id: t + i }));
  const s3 = H.sequence([sum].concat(feats.slice(0, 2)));
  ok('E1 die Engine fuellt nie auf: drei belegte Aussagen ⇒ drei Highlights (keine Mindestzahl)', s3.items.length === 3 && s3.mode === 'normal' && s3.dropped.length === 0);
  ok('E2 normale Einheit: die Zusammenfassung steht vorn', s3.items[0].type === 'SESSION_SUMMARY');
  const many = [sum].concat(Array.from({ length: 12 }, (_, i) => mk('ZONE_HIGHLIGHT', { zones: [i], id: 'z' + i })));
  const sN = H.sequence(many);
  ok('E3 normale Einheit: hoechstens 6, der Rest wird ausgewiesen statt verschwiegen', sN.items.length === 6 && sN.dropped.length === 7 && sN.items[0].type === 'SESSION_SUMMARY');
  const withImp = many.concat([mk('PERFORMANCE_IMPROVEMENT', CMP)]);
  ok('E4 interessante Einheit (deutliche Verbesserung): hoechstens 8', H.sequence(withImp).mode === 'interesting' && H.sequence(withImp).items.length === 8);
  const withPr = many.concat([mk('PERSONAL_RECORD', Object.assign({ group: 'run:5k' }, CMP)), mk('PERFORMANCE_IMPROVEMENT', CMP), mk('ROUTE_HIGHLIGHT', { route: [[0, 0]] })]);
  const sR = H.sequence(withPr);
  ok('E5 Bestleistung: hoechstens 12; Reihenfolge Zusammenfassung → Bestleistung → Vergleich → Merkmale → Strecke', sR.mode === 'record' && sR.items.length === 12 && sR.items[0].type === 'SESSION_SUMMARY' && sR.items[1].type === 'PERSONAL_RECORD' && sR.items[2].type === 'PERFORMANCE_IMPROVEMENT' && sR.items[sR.items.length - 1].type === 'ROUTE_HIGHLIGHT', sR.items.map(x => x.type).join(' → '));
  const goal = mk('GOAL_ACHIEVEMENT', { goal: { title: 'Marathon unter 3:30' }, value: { v: 12468, unit: 's' } });
  const sG = H.sequence([sum, goal, mk('PERSONAL_RECORD', CMP), feats[0]]);
  ok('E6 erreichtes Ziel: eigene Erzaehlform — das Ziel steht VOR der Zusammenfassung und loest die Wuerdigung aus', sG.mode === 'goal' && sG.items[0].type === 'GOAL_ACHIEVEMENT' && sG.celebration === true && sG.items.some(x => x.type === 'SESSION_SUMMARY'), sG.items.map(x => x.type).join(' → '));
  ok('E7 genau EINE Zusammenfassung, auch wenn zwei Erzeuger eine liefern', H.sequence([sum, mk('SESSION_SUMMARY', { id: 's2' }), feats[0]]).items.filter(x => x.type === 'SESSION_SUMMARY').length === 1);
  const weak = mk('CONSISTENCY', { points: [1], confidence: 0, weight: -20 });
  ok('E8 unter der Schwelle (' + H.MIN_SCORE + ') wird nichts gezeigt', weak.score < H.MIN_SCORE && H.sequence([sum, weak]).items.length === 1);
  ok('E9 opts.max begrenzt zusaetzlich; leere Eingabe ergibt eine leere Folge', H.sequence(many, { max: 3 }).items.length === 3 && H.sequence([]).items.length === 0 && H.sequence(null).mode === 'normal');
  ok('E10 grosse Ereignisse bekommen die Wuerdigung als Vorlage, normale ihre eigene', H.templateFor(mk('PERSONAL_RECORD', Object.assign({ major: true }, CMP))) === 'celebration' && H.templateFor(mk('PERSONAL_RECORD', CMP)) === 'record_reveal' && H.templateFor(mk('MILESTONE', { threshold: 100, major: true })) === 'milestone');
}

sec('F · Ereignis, Erzeuger, wirksame Werte');
{
  const pr = mk('PERSONAL_RECORD', Object.assign({ group: 'run:5k' }, CMP));
  const ev = H.eventOf(pr, '2026-10-06T10:00:00.000Z');
  ok('F1 Ereignis = dauerhafte Tatsache hinter dem Kandidaten (Art, Einheit, Wert, Vergleich, Beleg, Zeitpunkt von aussen, Engine-Stand)', ev && ev.type === 'PERSONAL_RECORD' && ev.activityId === 'a1' && ev.group === 'run:5k' && ev.at === '2026-10-06T10:00:00.000Z' && ev.evidence.comparedTo && ev.engine === H.VERSION);
  ok('F2 die Zusammenfassung ist kein Ereignis; ohne Zeitangabe bleibt `at` leer (keine Uhr im Modul)', H.eventOf(mk('SESSION_SUMMARY')) === null && H.eventOf(pr).at === null);
  ok('F3 mitgeliefert ist genau ein Erzeuger: die Zusammenfassung', J(H.generators()) === J(['session_summary']));

  const a = { id: 'w1', sportId: 'gym', source: 'orvia_workout', status: 'completed', durationSeconds: 341 * 60, metrics: {} };
  const b0 = H.build({ activity: a, effective: E });
  ok('F4 Folge einer Einheit ohne Besonderheit: eine Zusammenfassung aus dem Messwert', b0.items.length === 1 && b0.items[0].value.v === 20460 && b0.items[0].evidence.basis === 'source' && b0.mode === 'normal');
  const corr = E.setManual(a, 'duration', 75 * 60).activity;
  const b1 = H.build({ activity: corr, effective: E });
  ok('F5 nach manueller Korrektur rechnen die Highlights mit der WIRKSAMEN Dauer (75 min) und weisen sie als Angabe des Nutzers aus', b1.items[0].value.v === 4500 && b1.items[0].evidence.basis === 'manual');
  const legacy = { id: 'w2', sportId: 'gym', source: 'orvia_workout', status: 'completed', durationSeconds: 341 * 60, metrics: { durationCorrection: { fromMin: 341, toMin: 75, at: 'x' } } };
  ok('F6 … auch wenn die Einheit noch im Zustand vor der Reparatur ist (Feld 341, Korrektur in der Altform)', H.build({ activity: legacy, effective: E }).items[0].value.v === 4500);
  ok('F7 ohne Einheit oder ohne Dauer: leere Folge, kein Fehler', H.build({}).items.length === 0 && H.build({ activity: { id: 'x' }, effective: E }).items.length === 0);

  /* Fehler eines Erzeugers und unbelegte Kandidaten brechen nichts ab und werden ausgewiesen */
  H.registerGenerator('test_wirft', () => { throw new Error('kaputt'); });
  H.registerGenerator('test_unbelegt', ctx => [{ type: 'PACE_RECORD', activityId: ctx.activity.id, value: 1, comparison: { v: 2 } }]);
  H.registerGenerator('test_ok', ctx => [{ type: 'MILESTONE', activityId: ctx.activity.id, value: { v: 100, unit: 'km' }, threshold: 100, evidence: { basis: 'orvia', metric: 'run_total_km' } }]);
  const b2 = H.build({ activity: corr, effective: E });
  ok('F8 ein fehlerhafter Erzeuger und ein unbelegter Kandidat brechen die Folge nicht ab und stehen in `rejected`',
    b2.items.length === 2 && J(b2.rejected.map(r => r.generator + ':' + r.code).sort()) === J(['test_unbelegt:NO_EVIDENCE', 'test_wirft:GENERATOR_ERROR']), J(b2.rejected));
  ok('F9 der belegte Meilenstein steht nach der Zusammenfassung', b2.items[0].type === 'SESSION_SUMMARY' && b2.items[1].type === 'MILESTONE' && b2.mode === 'interesting');
}

sec('G · Stand im Projekt');
{
  const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
  const src = rd('js/engine/highlights.js');
  ok('G1 das Modul ist rein: kein DOM, kein Speicher, kein Netz, keine Uhr, kein Zufall', !/document\.|localStorage|fetch\(|new Date\(|Date\.now\(|Math\.random\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
  ok('G2 ehrlich ausgewiesen: VORBEREITET — die App laedt das Modul noch nicht, die Story ist unveraendert', /STATUS: VORBEREITET/.test(src) && !/engine\/highlights\.js/.test(rd('index.html')) && !/engine\/highlights\.js/.test(rd('sw.js')));
  ok('G3 fuer den Nutzer heisst es „Highlights": Knopf und Schliessen-Beschriftung kommen aus der Sprachdatei',
    /'ui\.highlights_ansehen': 'Highlights ansehen'/.test(rd('locales/de.js')) && /_uiT\('ui\.highlights_ansehen'\)/.test(rd('js/ui.js')) && /_uiT\('ui\.highlights_schliessen'\)/.test(rd('js/ui.js')) && !/Story ansehen|Story schließen/.test(rd('js/ui.js')) && !/Story ansehen/.test(rd('js/activity.js')));
  ok('G4 der Knopf bleibt die Hauptaktion (Stern, volle Breite, vor den Korrekturen)', /class="cta wide-ghost gm-story-cta"[^>]*onclick="gmOpenStory\(/.test(rd('js/ui.js')) && rd('js/ui.js').indexOf('class="cta wide-ghost gm-story-cta"') < rd('js/ui.js').indexOf('<div class="gm-corr"'));
}

console.log('\n' + (fail ? '❌' : '✅') + ' highlights_engine: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
