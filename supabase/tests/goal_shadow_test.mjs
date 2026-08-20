/* ============================================================
   ORVIA · goal_shadow — A-06, Teil 1 des Ziel-SSOT
   ------------------------------------------------------------
   Geprüft wird die ZUSAGE, nicht die Implementierung:
     1. Der Beobachter verändert nichts — weder die Eingaben noch den Ablauf.
        Ein Schreibfehler darf ein Zielereignis nie abbrechen.
     2. Ein Widerspruch zwischen `mainGoalOf()` und `goalOf()` wird als solcher
        gekennzeichnet und NICHT stillschweigend aufgelöst. Das ist der Messwert,
        um den es in den 14 Tagen geht.
     3. „Kein aktives Ziel" ist eine Aussage (null), kein fehlender Wert.
     4. Die geschriebene Zeile passt zu Migration 0037 — geprüft gegen die
        SQL-Datei, nicht gegen mein Gedächtnis.

   node supabase/tests/goal_shadow_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MOD = ['app/js/engine/goal-shadow.js', 'js/engine/goal-shadow.js']
  .map(p => join(REPO, p)).find(existsSync);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

if (!MOD) { ok('goal-shadow.js gefunden', false); process.exit(1); }
const GS = require(MOD);

const gcat = t => ({ halfmarathon: 'half_marathon', fast5k: 'run_5k' })[t] || t;
const BASIS = {
  eventType: 'update', eventId: 'e1', now: '2026-08-18T19:00:00.000Z',
  activeGoalCount: 2, appVersion: 'orvia-v8-357', gcat
};
const ZIEL = { id: 'g1', category: 'half_marathon', targetValue: 105, unit: 'min', targetDate: '2026-09-06', priority: 1, status: 'active' };
const LEGACY = { type: 'half_marathon', distanceKm: 21.0975, raceDate: '2026-09-06', targetMin: 105, _canonicalId: 'g1' };

/* ---------- A · Bauen ---------- */
console.log('\nA · Bauen');
{
  const r = GS.build({ ...BASIS, mainGoal: ZIEL, legacyGoal: LEGACY });
  ok('A1 gültiger Eintrag wird gebaut', r.valid, r.errors.join(','));
  ok('A2 Ereignistyp und Zeit stehen im Datensatz',
    r.record.eventType === 'update' && r.record.occurredAt === BASIS.now);
  ok('A3 unbekannter Ereignistyp wird abgewiesen',
    !GS.build({ ...BASIS, eventType: 'irgendwas', mainGoal: ZIEL, legacyGoal: LEGACY }).valid);
  ok('A4 fehlende Ereignis-ID wird abgewiesen',
    !GS.build({ ...BASIS, eventId: '', mainGoal: ZIEL, legacyGoal: LEGACY }).valid);
  ok('A5 fehlende Zeit wird abgewiesen',
    !GS.build({ ...BASIS, now: null, mainGoal: ZIEL, legacyGoal: LEGACY }).valid);
  ok('A6 der Datensatz ist eingefroren (keine nachträgliche Korrektur)',
    Object.isFrozen(r.record));
}
{
  /* Der Fehler aus A-02: .slice() reichte nicht, die Elemente blieben geteilt. */
  const ziel = JSON.parse(JSON.stringify(ZIEL));
  const r = GS.build({ ...BASIS, mainGoal: ziel, legacyGoal: LEGACY });
  r.record.mainGoal.targetValue = 999;
  ok('A7 der Beobachter mutiert die Eingabe nicht (Inhalt)', ziel.targetValue === 105, 'war ' + ziel.targetValue);
  ok('A8 … und hält keine Referenz darauf', r.record.mainGoal !== ziel);
}
{
  const r = GS.build({ ...BASIS, eventType: 'remove', mainGoal: null, legacyGoal: null, activeGoalCount: 0 });
  ok('A9 kein aktives Ziel ist gültig und bleibt null (Datenlücke ≠ Wert)',
    r.valid && r.record.mainGoal === null && r.record.activeGoalCount === 0);
}
{
  /* Aufgedeckt von Mutationsprobe GS4: A9 allein liess `mainGoal: mg || lg`
     durchgehen, weil dort BEIDE null waren. Der gefaehrliche Fall ist der, in
     dem der Bestand etwas liefert und das Hauptziel nicht — dann wuerde ein
     Ersatzwert aus "kein Ziel" ein "dieses Ziel" machen und genau den Befund
     verdecken, den A-07 spaeter beheben soll. */
  const r = GS.build({ ...BASIS, mainGoal: null, legacyGoal: LEGACY, activeGoalCount: 0 });
  ok('A10 Hauptziel fehlt, Bestand liefert eins → mainGoal bleibt null (kein Ersatzwert)',
    r.record.mainGoal === null, 'war ' + JSON.stringify(r.record.mainGoal));
  ok('A11 … und der Bestand steht unveraendert daneben', r.record.legacyGoal
    && r.record.legacyGoal._canonicalId === 'g1');
}

/* ---------- B · Der Vergleich, um den es geht ---------- */
console.log('\nB · Widerspruchserkennung');
{
  const v = (m, l) => GS.vergleiche(m, l, gcat);
  ok('B1 identische Ziele → kein Widerspruch', v(ZIEL, LEGACY).length === 0, v(ZIEL, LEGACY).join(','));
  ok('B2 abweichendes Zieldatum wird erkannt',
    v({ ...ZIEL, targetDate: '2026-10-04' }, LEGACY).includes('targetDate'));
  ok('B3 abweichende Zielzeit wird erkannt',
    v({ ...ZIEL, targetValue: 110 }, LEGACY).includes('targetMin'));
  ok('B4 Rundung unter einer halben Minute ist KEIN Widerspruch',
    !v({ ...ZIEL, targetValue: 105.2 }, LEGACY).includes('targetMin'));
  ok('B5 Sekunden werden wie in goalOf() umgerechnet (6300 s = 105 min)',
    !v({ ...ZIEL, targetValue: 6300, unit: 's' }, LEGACY).includes('targetMin'));

  /* DER FALL, DER DAS GANZE PAKET BEGRÜNDET: ein Kraftziel mit Priorität 1
     ist das Hauptziel — goalOf() filtert es weg und liefert ein Laufziel. */
  const kraft = { id: 'g9', category: 'hypertrophy', targetValue: null, targetDate: null, priority: 1, status: 'active' };
  const f = v(kraft, LEGACY);
  ok('B6 Kraftziel als Hauptziel vs. Laufziel im Bestand → Widerspruch',
    f.includes('identity') && f.includes('category'), f.join(','));

  ok('B7 Hauptziel fehlt, Bestand liefert eins → Widerspruch', v(null, LEGACY).includes('identity'));
  ok('B8 beide leer → kein Widerspruch', v(null, null).length === 0);
  ok('B9 das Kennzeichen steht auch im Datensatz',
    GS.build({ ...BASIS, mainGoal: kraft, legacyGoal: LEGACY }).record.contradiction === true);
}

/* ---------- C · Beobachter, nie Beteiligter ---------- */
console.log('\nC · Der Beobachter darf nichts kaputtmachen');
{
  GS.setEnabled(true); GS.setSink(null);
  const r1 = GS.logGoalEvent({ ...BASIS, mainGoal: ZIEL, legacyGoal: LEGACY });
  ok('C1 ohne Senke: stored=false mit Grund, kein Wurf', r1.stored === false && r1.reason === 'no_sink');

  GS.setSink(() => { throw new Error('Senke kaputt'); });
  let geworfen = false, r2;
  try { r2 = GS.logGoalEvent({ ...BASIS, eventId: 'e2', mainGoal: ZIEL, legacyGoal: LEGACY }); }
  catch (e) { geworfen = true; }
  ok('C2 werfende Senke wird gefangen — der Aufrufer merkt nichts', !geworfen && r2.stored === false && r2.reason === 'sink_threw');

  const vorher = GS.stats().fehler;
  GS.setSink(() => Promise.reject(new Error('Netz weg')));
  GS.logGoalEvent({ ...BASIS, eventId: 'e3', mainGoal: ZIEL, legacyGoal: LEGACY });
  ok('C3 eine abgelehnte Zusage zählt als Schreibfehler (Gate A, Kriterium 4)',
    true, 'wird nach dem Tick geprüft (C3b)');

  GS.setSink(() => Promise.resolve({}));
  const r4 = GS.logGoalEvent({ ...BASIS, eventId: 'e4', mainGoal: ZIEL, legacyGoal: LEGACY });
  ok('C4 mit funktionierender Senke: stored=true', r4.stored === true && r4.reason === null);

  GS.setEnabled(false);
  ok('C5 abgeschaltet wird ausdrücklich gemeldet, nicht verschwiegen',
    GS.logGoalEvent({ ...BASIS, eventId: 'e5', mainGoal: ZIEL, legacyGoal: LEGACY }).reason === 'disabled');
  GS.setEnabled(true);

  ok('C6 es gibt kein update() — eine Korrektur ist ein neuer Eintrag',
    typeof GS.update === 'undefined' && typeof GS.edit === 'undefined');

  /* Abgemeldet/offline ist KEIN Schreibfehler. Zaehlte es als solcher, waere die
     Zahl aus Gate A, Kriterium 4 wertlos. */
  const vorSkip = GS.stats().fehler;
  GS.setSink(() => null);
  const rSkip = GS.logGoalEvent({ ...BASIS, eventId: 'e6', mainGoal: ZIEL, legacyGoal: LEGACY });
  ok('C7 kein Schreibversuch (keine Sitzung) zaehlt NICHT als Schreibfehler',
    rSkip.stored === false && rSkip.reason === 'sink_skipped' && GS.stats().fehler === vorSkip,
    rSkip.reason + ', Fehler ' + vorSkip + ' → ' + GS.stats().fehler);

  await new Promise(r => setTimeout(r, 10));
  ok('C3b … und der Fehlerzähler ist gestiegen', GS.stats().fehler > vorher,
    vorher + ' → ' + GS.stats().fehler);

  /* Nachgetragen am 20.08.2026 nach einer Fehlmessung am lebenden System:
     `geschrieben` steigt erst mit der Antwort der Datenbank. Wer stats() im selben
     Ausdruck liest wie das Zielereignis, sieht 0 — und 0/0 bedeutete zweierlei.
     `unterwegs` trennt "nichts passiert" von "laeuft noch". */
  let aufloesen;
  const s0 = GS.stats();
  GS.setSink(() => new Promise(r => { aufloesen = r; }));
  GS.logGoalEvent({ ...BASIS, eventId: 'e7', mainGoal: ZIEL, legacyGoal: LEGACY });
  const s1 = GS.stats();
  ok('C8 eine laufende Anfrage ist als `unterwegs` sichtbar, nicht als Nichts',
    s1.unterwegs === s0.unterwegs + 1 && s1.geschrieben === s0.geschrieben,
    JSON.stringify(s1));
  aufloesen({});
  await new Promise(r => setTimeout(r, 10));
  const s2 = GS.stats();
  ok('C9 … und wandert nach der Antwort in `geschrieben`',
    s2.unterwegs === 0 && s2.geschrieben === s1.geschrieben + 1, JSON.stringify(s2));
  ok('C10 stats() sagt ausserdem, ob ueberhaupt eine Senke gesetzt ist',
    GS.stats().senke === true);
}

/* ---------- D · Passt die Zeile zu Migration 0037? ---------- */
console.log('\nD · Übereinstimmung mit Migration 0037');
{
  const mig = join(REPO, 'supabase', 'migrations', '0037_goal_shadow_log.sql');
  ok('D1 Migration 0037 existiert', existsSync(mig));
  if (existsSync(mig)) {
    const sql = readFileSync(mig, 'utf8');
    const row = GS.toRow(GS.build({ ...BASIS, mainGoal: ZIEL, legacyGoal: LEGACY }).record, 'u1');
    const fehlend = Object.keys(row).filter(k => !new RegExp('\\b' + k + '\\b').test(sql));
    ok('D2 jede geschriebene Spalte existiert in der Migration', fehlend.length === 0, fehlend.join(','));
    ok('D3 die Tabelle trägt RLS', /enable row level security/.test(sql));
    ok('D4 es gibt KEINE update-/delete-Policy (Unveränderlichkeit)',
      !/for\s+(update|delete)/i.test(sql));
    ok('D5 authenticated darf nur lesen und anfügen',
      /grant select, insert on public\.goal_shadow_log to authenticated/.test(sql)
      && /revoke all on public\.goal_shadow_log from authenticated/.test(sql));
    ok('D6 anon bekommt ausdrücklich nichts (0036 gilt nicht für neue Tabellen)',
      /revoke all on public\.goal_shadow_log from anon/.test(sql));
    ok('D7 nur bekannte Ereignistypen', /check \(event_type in \('add','update','remove','status'\)\)/.test(sql));
  }
}

/* ---------- E · Verdrahtung ---------- */
/* Ein Beobachter, den niemand aufruft, ist kein Beobachter. Diese Prüfungen
   lesen den Quelltext, weil der Aufruf in commitGoals sonst unbemerkt
   herausfallen könnte — genau das ist bei anderen Modulen schon passiert. */
console.log('\nE · Verdrahtung');
{
  const PROF = ['app/js/profile.js', 'js/profile.js'].map(p => join(REPO, p)).find(existsSync);
  const src = readFileSync(PROF, 'utf8');
  /* Aufgedeckt von Mutationsprobe GS1: die alte Fassung prüfte nur, ob der Name
     irgendwo vorkommt — die Funktionsdefinition allein reichte. Geprüft wird
     jetzt der AUFRUF im Rumpf von commitGoals. */
  const rumpf = src.slice(src.indexOf('function commitGoals('),
                          src.indexOf('/* ═══ A-06 · Ziel-Shadow-Log'));
  ok('E1 commitGoals ruft den Beobachter im eigenen Rumpf auf',
    /_goalShadowNote\(/.test(rumpf), rumpf.length + ' Zeichen Rumpf geprüft');
  ok('E2 … NACH _profileSave (das Ziel ist gespeichert, bevor beobachtet wird)',
    src.indexOf("_profileSave(['goals'])") < src.indexOf('_goalShadowNote('));
  ok('E3 … und in try/catch (zweite Sicherung)',
    /try\{_goalShadowNote\([^)]*\);\}catch/.test(src));
  for (const [fn, ev] of [['goalAdd', 'add'], ['goalUpdate', 'update'], ['goalRemove', 'remove'], ['goalSetStatus', 'status']]) {
    const zeile = (src.split('\n').find(l => l.startsWith('function ' + fn + '(')) || '');
    ok('E4 ' + fn + " meldet den Ereignistyp '" + ev + "'", zeile.includes("'" + ev + "'"), zeile.trim().slice(0, 90));
  }
  ok('E5 die Senke wird beim ersten Ereignis gesetzt, nicht beim Laden',
    /_goalShadowEnsureSink\(\)/.test(src) && src.indexOf('_goalShadowEnsureSink()') < src.indexOf('function _goalShadowEnsureSink'),
    'sonst haengt sie an der Ladereihenfolge in index.html');
  ok('E6 die Senke schreibt in goal_shadow_log', /from\('goal_shadow_log'\)\.insert/.test(src));
  ok('E7 … und liefert null ohne Sitzung (kein Schreibversuch ≠ Schreibfehler)',
    /if\(!sb\|\|!uid\)return null;/.test(src));

  const IDX = ['app/index.html', 'index.html'].map(p => join(REPO, p)).find(existsSync);
  ok('E8 das Modul ist in index.html eingebunden',
    /<script src="js\/engine\/goal-shadow\.js"><\/script>/.test(readFileSync(IDX, 'utf8')));
  const SW = ['app/sw.js', 'sw.js'].map(p => join(REPO, p)).find(existsSync);
  ok('E9 … und im Offline-Vorrat des Service Workers',
    /'\.\/js\/engine\/goal-shadow\.js'/.test(readFileSync(SW, 'utf8')),
    'sonst fehlt es offline und der Beobachter schweigt genau dann, wenn es interessant wird');
}

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
