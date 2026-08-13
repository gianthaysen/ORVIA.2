/* ORVIA · Wochenstruktur-Regelwerk (2026-08-06)

   ANLASSFALL (real gemeldet): 13 Einheiten auf 7 Tagen, sechsmal Laufen, KEIN
   Ruhetag, an sechs von sieben Tagen eine Doppeleinheit — obwohl im Profil ein
   Ruhetag hinterlegt war und Doppeleinheiten nur für einige Tage freigegeben.

   Der erste Testblock hier IST dieser Fall. Er wäre vor dem Fix rot gewesen und
   ist die Regression, die verhindert, dass das Verhalten zurückkommt.

   Geprüfte Zusagen:
     R1  harte Ruhetage bleiben leer                         (unverhandelbar)
     R2  mindestens ein Ruhetag pro Woche                    (unverhandelbar)
     R3  Doppeleinheiten nur an freigegebenen Tagen
     R4  keine zwei harten Einheiten am selben Tag
     R5  keine beinlastige Kraft am Tag einer harten Laufeinheit
     R6/R7 weich — verbessern die Woche, senken aber nie das Volumen

   Und die übergreifende Zusage: VERSCHIEBEN VOR LÖSCHEN. Eine Regel darf eine
   Einheit umlegen; sie darf sie nur dann entfernen, wenn kein zulässiger Platz
   mehr existiert — und muss das protokollieren.

   node supabase/tests/week_plan_policy_test.mjs [appRoot-absolut] */
import { existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
/* ROBUSTE APP-AUFLOESUNG: Das Repo existiert in zwei Layouts — kanonisch
   (app/supabase/tests, App-Wurzel = HERE/../..) und umstrukturiert
   (supabase/tests neben app/, App-Wurzel = HERE/../../app). Eine starre
   Aufloesung fand im jeweils anderen Layout den falschen Ordner und liess
   die GANZE Suite scheinbar fehlschlagen (0/46 statt gruen). Gesucht wird
   deshalb der erste Kandidat mit index.html UND js/engine. */
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const P = require(join(APP, 'js/engine/week-plan-policy.js'));
const PM = require(join(APP, 'js/profile-model.js'));

const R = (l) => ({ t: 'Laufen', l: l, d: l === 'Long Run' ? 'lr' : l === 'Intervalle' ? 'iv' : l === 'Tempo' ? 'tempo' : 'ez' });
const G = (l) => ({ t: 'Gym', l: l, d: '45 min' });
const B = (l) => ({ t: 'Rad', l: l || 'Easy Z2', d: '60 min' });
const S = () => ({ t: 'Schwimmen', l: 'Technik', d: '~900 m' });
const count = w => w.reduce((n, d) => n + d.length, 0);
const restDays = w => w.filter(d => !d.length).length;
const doubleDays = w => w.filter(d => d.length >= 2).length;
const show = w => w.map((d, i) => ['Mo','Di','Mi','Do','Fr','Sa','So'][i] + ':' + (d.map(x => x.t[0] + '·' + x.l).join('+') || '—')).join('  ');

/* ============ 1) Der reale Fall ============ */
sec('1 · Der gemeldete Fall — 13 Einheiten, kein Ruhetag');

/* Exakt die gemeldete Woche. */
const gemeldet = [
  [G('Oberkörper'), R('Z2 Dauerlauf')],
  [R('Intervalle'), B('Easy Z2')],
  [G('Ganzkörper'), R('Z2 Dauerlauf')],
  [R('Tempo')],
  [S(), G('Ganzkörper')],
  [R('Z2 Dauerlauf'), B('Easy Z2')],
  [R('Long Run'), G('Ganzkörper')]
];
ok('Ausgangslage stimmt mit der Meldung überein',
   count(gemeldet) === 13 && restDays(gemeldet) === 0 && doubleDays(gemeldet) === 6,
   count(gemeldet) + ' Einheiten, ' + restDays(gemeldet) + ' Ruhetage, ' + doubleDays(gemeldet) + ' Doppeltage');

/* Profil: Ruhetag Sonntag, Doppel nur Di und Sa freigegeben. */
const cfgReal = {
  availableDayIdx: [0, 1, 2, 3, 4, 5],
  restDayIdx: [6],
  preferredRestDayIdx: [6],
  doubleAllowedDayIdx: [1, 5],
  minRestDays: 1
};
const r1 = P.applyPolicy(gemeldet, cfgReal);
console.log('   → ' + show(r1.days));
ok('der harte Ruhetag (So) ist leer', r1.days[6].length === 0);
ok('es gibt mindestens einen Ruhetag', restDays(r1.days) >= 1, restDays(r1.days) + ' Ruhetage');
ok('Doppeleinheiten NUR an den freigegebenen Tagen (Di, Sa)',
   r1.days.every((d, i) => d.length < 2 || [1, 5].indexOf(i) >= 0),
   r1.days.map((d, i) => d.length >= 2 ? i : null).filter(x => x !== null).join(','));
ok('kein Tag mit zwei harten Einheiten',
   r1.days.every(d => d.filter(P.isHard).length <= 1));
ok('keine beinlastige Kraft am Tag eines harten Laufs',
   r1.days.every(d => !(d.some(x => x.t === 'Laufen' && P.isHard(x)) && d.some(P.isLegHeavy))),
   show(r1.days));
ok('jede Änderung ist protokolliert und begründet',
   r1.report.changes.length > 0 && r1.report.changes.every(c => c.rule && c.type));
ok('der Long Run hat überlebt (Kernreiz wird nie zuerst geopfert)',
   r1.days.some(d => d.some(x => x.l === 'Long Run')));
ok('Intervalle und Tempo haben überlebt',
   r1.days.some(d => d.some(x => x.l === 'Intervalle')) && r1.days.some(d => d.some(x => x.l === 'Tempo')));
ok('der strukturelle Konflikt wird ehrlich gemeldet statt versteckt',
   r1.report.warnings.some(x => x.code === 'wish_exceeds_week'),
   JSON.stringify(r1.report.warnings));

{
  const wish = r1.report.warnings.filter(x => x.code === 'wish_exceeds_week')[0];
  ok('… und die Rechnung dahinter ist nachvollziehbar',
     wish && wish.structuralMax === (6 - 1) + 2 && wish.wanted === 13,
     wish ? `max ${wish.structuralMax} bei ${wish.allowedDays} Tagen, ${wish.doubleDays} Doppeltagen, ${wish.minRestDays} Ruhetag` : '—');
}

/* ============ 2) Verschieben vor Löschen ============ */
sec('2 · Verschieben vor Löschen');
{
  /* Eine Einheit auf einem Ruhetag, daneben viel Platz ⇒ muss umziehen, nicht sterben. */
  const w = [[], [], [], [], [], [], [R('Z2 Dauerlauf')]];
  const r = P.applyPolicy(w, { availableDayIdx: [0,1,2,3,4,5], restDayIdx: [6], doubleAllowedDayIdx: [] });
  ok('Einheit vom Ruhetag wird verschoben, nicht gelöscht',
     count(r.days) === 1 && r.days[6].length === 0 &&
     r.report.changes.some(c => c.type === 'moved'), show(r.days));
  ok('kein einziges „removed" in diesem Fall',
     !r.report.changes.some(c => c.type === 'removed'));
}
{
  /* Kein Platz mehr: alle erlaubten Tage voll ⇒ ehrliches Entfernen mit Protokoll. */
  const w = [[R('Z2 Dauerlauf')], [], [], [], [], [], [R('Tempo')]];
  const r = P.applyPolicy(w, { availableDayIdx: [0], restDayIdx: [6], doubleAllowedDayIdx: [] });
  ok('ohne zulässigen Platz wird entfernt — aber protokolliert',
     r.days[6].length === 0 && r.report.changes.some(c => c.type === 'removed' && c.rule));
}

/* ============ 3) Kollisionsregeln einzeln ============ */
sec('3 · Fachliche Kollisionen');
{
  const w = [[R('Long Run'), G('Ganzkörper')], [], [], [], [], [], []];
  const r = P.applyPolicy(w, { doubleAllowedDayIdx: [0] });
  const mo = r.days[0];
  ok('Long Run + Ganzkörper am selben Tag wird aufgelöst',
     !(mo.some(x => x.t === 'Laufen' && P.isHard(x)) && mo.some(P.isLegHeavy)), show(r.days));
  ok('… bevorzugt durch Umetikettieren auf Oberkörper (Einheit bleibt erhalten)',
     count(r.days) === 2 &&
     (r.report.changes.some(c => c.type === 'retyped') || r.report.changes.some(c => c.type === 'moved')),
     JSON.stringify(r.report.changes));
}
{
  const w = [[R('Intervalle'), R('Long Run')], [], [], [], [], [], []];
  const r = P.applyPolicy(w, { doubleAllowedDayIdx: [0] });
  ok('zwei harte Läufe am selben Tag werden getrennt',
     r.days.every(d => d.filter(P.isHard).length <= 1) && count(r.days) === 2, show(r.days));
}
{
  const w = [[R('Long Run'), G('Oberkörper')], [], [], [], [], [], []];
  const r = P.applyPolicy(w, { doubleAllowedDayIdx: [0] });
  ok('Long Run + OBERKÖRPER bleibt zusammen — das ist kein Konflikt',
     r.days[0].length === 2, show(r.days));
}

/* ============ 4) Deckel auf Einheiten, nicht auf Tage ============ */
sec('4 · maxSessionsPerWeek greift auf EINHEITEN');
{
  const w = [[R('Z2 Dauerlauf'), G('Oberkörper')], [R('Intervalle')], [G('Ganzkörper')],
             [R('Z2 Dauerlauf')], [S()], [B()], [R('Long Run')]];
  const r = P.applyPolicy(w, { doubleAllowedDayIdx: [0], maxSessionsPerWeek: 6, restDayIdx: [] });
  ok('8 Einheiten mit Deckel 6 ⇒ genau 6', count(r.days) === 6, count(r.days) + ' — ' + show(r.days));
  ok('die Kernreize überleben den Deckel',
     r.days.some(d => d.some(x => x.l === 'Long Run')) &&
     r.days.some(d => d.some(x => x.l === 'Intervalle')));
  ok('jedes Entfernen ist mit Regel protokolliert — die Bilanz geht auf',
     r.report.changes.filter(c => c.type === 'removed').length === 8 - count(r.days) &&
     r.report.changes.filter(c => c.type === 'removed').every(c => !!c.rule),
     JSON.stringify(r.report.changes.filter(c => c.type === 'removed')));
}

{
  /* R8 als eigener Fall: zwei Läufe am selben Tag sind keine sinnvolle
     Doppeleinheit — das Muster entstand beim Bauen und wird jetzt verhindert. */
  const w = [[R('Long Run'), R('Z2 Dauerlauf')], [], [], [], [], [], []];
  const r = P.applyPolicy(w, { doubleAllowedDayIdx: [0] });
  ok('zweimal dieselbe Sportart am selben Tag wird getrennt',
     r.days.every(d => new Set(d.map(x => x.t)).size === d.length) && count(r.days) === 2, show(r.days));
  ok('… und der Kernreiz bleibt dabei liegen, der lockere zieht um',
     r.days[0].some(x => x.l === 'Long Run'), show(r.days));
}

/* ============ 5) Ruhetag-Garantie ohne Profilangabe ============ */
sec('5 · Ruhetag-Garantie greift auch ohne Profilangabe');
{
  const w = [[R('Z2 Dauerlauf')], [R('Intervalle')], [G('Ganzkörper')], [R('Z2 Dauerlauf')],
             [S()], [B()], [R('Long Run')]];
  const r = P.applyPolicy(w, {});
  ok('sieben belegte Tage ⇒ mindestens ein Ruhetag entsteht', restDays(r.days) >= 1, show(r.days));
  ok('dabei wird bevorzugt verschoben statt gelöscht',
     count(r.days) === 7 || r.report.changes.some(c => c.type === 'moved'),
     count(r.days) + ' von 7 erhalten');
  ok('der Long Run bleibt', r.days.some(d => d.some(x => x.l === 'Long Run')));
}
{
  const w = [[R('Z2 Dauerlauf')], [], [], [], [], [], []];
  const r = P.applyPolicy(w, {});
  ok('eine Woche mit genug Ruhe wird nicht angefasst',
     count(r.days) === 1 && r.report.changes.length === 0);
}

/* ============ 6) Reinheit ============ */
sec('6 · Reinheit und Determinismus');
{
  const w = [[R('Long Run'), G('Ganzkörper')], [R('Intervalle')], [], [], [], [], []];
  const snap = JSON.stringify(w);
  const a = P.applyPolicy(w, cfgReal);
  ok('die Eingabe wird nicht mutiert', JSON.stringify(w) === snap);
  const b = P.applyPolicy(w, cfgReal);
  ok('gleiche Eingabe ⇒ byte-gleiche Ausgabe', JSON.stringify(a.days) === JSON.stringify(b.days));
  const c = P.applyPolicy(a.days, cfgReal);
  ok('idempotent: ein zweiter Durchlauf ändert nichts mehr',
     JSON.stringify(c.days) === JSON.stringify(a.days), show(c.days));
}

/* ============ 7) Die Profilfelder kommen überhaupt an ============ */
sec('7 · effectiveTrainingConfig liefert die drei bisher toten Felder');
{
  const prof = {
    availability: {
      preferredRestDays: ['so'],
      maxSessionsPerWeek: 10,
      days: {
        mo: { available: true, doubleSession: { enabled: true } },
        di: { available: true },
        mi: { available: true, doubleSession: { enabled: true } },
        do: { available: true },
        fr: { available: true },
        sa: { available: true, doubleSession: { enabled: true } },
        so: { restDay: true }
      }
    },
    sports: [{ sportId: 'running', sessionsPerWeek: 6 }, { sportId: 'gym', sessionsPerWeek: 4 }]
  };
  const cfg = PM.effectiveTrainingConfig(prof);
  ok('restDayIdx enthält den harten Ruhetag (So = 6)',
     JSON.stringify(cfg.restDayIdx) === JSON.stringify([6]), JSON.stringify(cfg.restDayIdx));
  ok('preferredRestDayIdx wird gelesen (war zuvor totes Feld)',
     JSON.stringify(cfg.preferredRestDayIdx) === JSON.stringify([6]), JSON.stringify(cfg.preferredRestDayIdx));
  ok('doubleAllowedDayIdx enthält genau Mo, Mi, Sa',
     JSON.stringify(cfg.doubleAllowedDayIdx) === JSON.stringify([0, 2, 5]), JSON.stringify(cfg.doubleAllowedDayIdx));
  ok('der Ruhetag zählt NICHT als verfügbarer Tag',
     cfg.availableDayIdx.indexOf(6) < 0, JSON.stringify(cfg.availableDayIdx));
  ok('maxSessionsPerWeek wird durchgereicht', cfg.maxSessionsPerWeek === 10);
  ok('bestehende Felder bleiben unverändert vorhanden',
     Array.isArray(cfg.availableDayIdx) && cfg.targetDays != null && cfg.gymDays === 4);
}
{
  /* Kein availability-Objekt ⇒ leere Listen, kein Absturz, kein erfundener Ruhetag. */
  const cfg = PM.effectiveTrainingConfig({ trainingDays: 5 });
  ok('ohne Verfügbarkeitsangaben bleiben die Listen leer statt geraten',
     cfg.restDayIdx.length === 0 && cfg.preferredRestDayIdx.length === 0 && cfg.doubleAllowedDayIdx.length === 0);
}

/* ============ 8) Ohne Doppel-Freigabe schrumpft nichts ============ */
sec('8 · Fehlende Doppel-Angabe senkt bestehende Pläne nicht');
{
  const w = [[R('Z2 Dauerlauf'), G('Oberkörper')], [], [R('Intervalle')], [], [G('Ganzkörper')], [], [R('Long Run')]];
  const r = P.applyPolicy(w, { availableDayIdx: [0,1,2,3,4,5,6], doubleAllowedDayIdx: [] });
  ok('nie ausgefülltes Doppel-Feld ⇒ bestehender Doppeltag bleibt',
     r.days[0].length === 2 && count(r.days) === 5, show(r.days));
}

console.log('\nweek_plan_policy: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
