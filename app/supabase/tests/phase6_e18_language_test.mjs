/* ORVIA · Phase 6.5 / E-18 (2026-08-05) — testbare Produktklassifikation.
   E-18: ORVIA ist Fitness-/Trainingsplanungssoftware — kein Medizinprodukt.
   Dieses Skript prueft ALLE nutzersichtbaren Quelltexte (index.html + jede von
   der App geladene JS-Datei inkl. Knowledge-Regeln) gegen verbotene Sprachmuster:
   Verletzungs-/Heilungsversprechen, Diagnose-/Freigabeaussagen, Absolutaussagen
   ueber Gesundheitszustaende, Trainingsfreigabe trotz Schmerz.
   POSITIVKONTROLLE: die vier Unzulaessig-Beispiele aus E-18 muessen vom Muster-
   satz gefangen werden — sonst misst der Test nichts.
   Laeuft ab jetzt in jeder Auslieferungskette mit (wie der Secret-Scan).
   node supabase/tests/phase6_e18_language_test.mjs [appRoot-absolut] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2]) : (existsSync(join(_flat, 'index.html')) ? _flat : join(_flat, '..', 'app'));

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

/* ---- Verbotene Muster (E-18-Tabelle + Absolutaussagen). Jedes Muster traegt
   eine Begruendung UND ein negatable-Flag:
   negatable=true  ⇒ eine Negation in derselben Zeile entschaerft (z. B. "KEIN
                     Training verhindert Verletzungen" ist eine ehrliche Aussage).
   negatable=false ⇒ die Negation ist Teil der verbotenen Aussage selbst
                     ("Du bist heute NICHT verletzungsgefährdet") — NIE whitelisten. ---- */
const FORBIDDEN = [
  [/verhindert\s+Verletzung/i, 'Verletzungs-Verhinderungs-Versprechen (E-18)', true],
  [/nicht\s+verletzungsgef[aä]hrdet/i, 'Absolutaussage Verletzungsrisiko (E-18) — Negation IST die Aussage', false],
  [/medizinisch\s+(unzureichend|unbedenklich|sicher|ausreichend)/i, 'medizinische Zustandsbewertung (E-18)', true],
  [/(kannst|darfst|sollst)\s+(ruhig\s+|bedenkenlos\s+)?trotz\s+Schmerzen/i, 'Trainingsfreigabe trotz Schmerz (E-18)', false],
  [/trotz\s+Schmerzen\s+(weiter)?trainieren/i, 'Trainingsfreigabe trotz Schmerz (E-18)', true],
  [/garantiert\s+(schmerzfrei|verletzungsfrei|gesund)/i, 'Gesundheitsgarantie', true],
  [/(schmerzfrei|verletzungsfrei|gesund)\s+garantiert/i, 'Gesundheitsgarantie', true],
  [/\bheilt\s+(dein|deine|die|den|das)\b/i, 'Heilungsversprechen', true],
  [/ORVIA\s+diagnostiziert(?!\s+nicht\b)/i, 'Diagnoseanspruch ("diagnostiziert nicht" ist die zulaessige Abgrenzung)', false],
  [/ORVIA\s+erkennt\s+(eine\s+)?(Krankheit|Verletzung|Diagnose)/i, 'Diagnoseanspruch', true],
  [/100\s?%\s+(sicher|schmerzfrei|verletzungsfrei|gesund)/i, 'Absolutaussage Gesundheit', true],
  [/keinerlei\s+Verletzungsrisiko/i, 'Absolutaussage Verletzungsrisiko — Negation IST die Aussage', false],
  [/beugt\s+Verletzungen\s+(sicher|zuverl[aä]ssig|garantiert)\s+vor/i, 'quantifiziertes Praeventionsversprechen', true]
];

/* ---- Negationsmarker fuer negatable-Muster (\b statt \s — faengt auch Satzende
   "diagnostiziert nicht."). Bewusst eng: lieber ein manueller Whitelist-Eintrag
   mehr als ein stilles Durchrutschen. ---- */
const NEGATION = /\b(keine?|kein|nicht|nie|niemals|unzul[aä]ssig|verboten)\b/i;

/* ---- Explizite Whitelist (Datei-Substring + Zeilen-Substring) fuer dokumentierte
   Ausnahmen. Aktuell leer — jede Aufnahme braucht eine Begruendung hier im Test. ---- */
const WHITELIST = [];

/* ---- Positivkontrolle: die 4 Unzulaessig-Beispiele aus E-18 muessen matchen. ---- */
const E18_EXAMPLES = [
  'Du bist heute nicht verletzungsgefährdet.',
  'Deine Regeneration ist medizinisch unzureichend.',
  'Dieses Training verhindert Verletzungen.',
  'Du kannst trotz Schmerzen trainieren.'
];
/* Die Positivkontrolle nutzt DIESELBE Logik wie der Scan (Muster + Negationsregel) —
   sie beweist, dass die Beispiele auch MIT Whitelist-Logik gefangen wuerden. */
function violates(line) {
  return FORBIDDEN.some(([re, , negatable]) => re.test(line) && !(negatable && NEGATION.test(line)));
}
E18_EXAMPLES.forEach(ex => {
  ok('POSITIVKONTROLLE · Scan-Logik fängt E-18-Beispiel: "' + ex + '"', violates(ex));
});
/* Und die Zulaessig-Beispiele duerfen NICHT matchen (kein uebergriffiger Filter). */
const E18_ALLOWED = [
  'Die verfügbaren Trainingsdaten sprechen für eine erhöhte Belastung.',
  'Reduziere die Einheit oder prüfe dein aktuelles Befinden.',
  'Bei anhaltenden Beschwerden sollte medizinischer Rat eingeholt werden.',
  'Keine medizinische Diagnose.'
];
E18_ALLOWED.push('ORVIA diagnostiziert nicht.');
E18_ALLOWED.push('Kein Training verhindert Verletzungen zuverlässig.');
E18_ALLOWED.forEach(ex => {
  ok('GEGENKONTROLLE · zulässige Formulierung passiert: "' + ex.slice(0, 50) + '…"', !violates(ex));
});

/* ---- Nutzersichtbare Quellen: index.html + alle dort geladenen Skripte. ---- */
const idx = readFileSync(join(APP, 'index.html'), 'utf8');
const files = ['index.html'];
const reSrc = /src="(js\/[^"]+\.js)"/g; let m;
while ((m = reSrc.exec(idx))) files.push(m[1]);
ok('Scanumfang plausibel (index.html + >80 geladene JS-Dateien)', files.length > 80, String(files.length));

let findings = [];
files.forEach(f => {
  const p = join(APP, f);
  if (!existsSync(p)) { findings.push(f + ': DATEI FEHLT'); return; }
  const lines = readFileSync(p, 'utf8').split('\n');
  lines.forEach((line, i) => {
    FORBIDDEN.forEach(([re, why, negatable]) => {
      if (!re.test(line)) return;
      if (negatable && NEGATION.test(line)) return;       // Negation entschaerft NUR negatable-Muster
      if (WHITELIST.some(([wf, wl]) => f.indexOf(wf) >= 0 && line.indexOf(wl) >= 0)) return;
      findings.push(f + ':' + (i + 1) + ' [' + why + '] ' + line.trim().slice(0, 140));
    });
  });
});
ok('SCAN · keine verbotenen E-18-Sprachmuster in nutzersichtbaren Quellen (' + files.length + ' Dateien)',
   findings.length === 0, findings.slice(0, 5).join('\n    '));

console.log('\nphase6_e18_language: ' + (fail ? fail + ' FAILED (' + pass + ' ok)' : 'ALL PASSED (' + pass + ' ok)'));
process.exit(fail ? 1 : 0);
