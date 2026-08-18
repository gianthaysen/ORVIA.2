/* ============================================================
   ORVIA · login_chain_shape — die Form der Login-Kette festhalten
   ------------------------------------------------------------
   MESSUNG 17.08.2026 (Live, angemeldet): `onAuthed: TOTAL login-init chain`
   4781 ms, und die Summe der zwoelf Einzelmarken ergab exakt diese 4781 ms.
   Die Kette besteht aus sequenziellen `await` — ihre Dauer IST damit die Summe
   ihrer Glieder, nicht deren Maximum. Jedes zusaetzliche Glied verlaengert den
   Login unmittelbar.

   Zwei Zusagen haelt dieser Test fest:

   1. Der Avatar liegt NICHT mehr im kritischen Pfad. Er war mit 1296 ms der
      zweitgroesste Posten — fuer ein Profilbild, das sich nach dem Laden ohnehin
      selbst nachrendert.
   2. JEDER `await` in der Kette traegt eine Messmarke. Ohne diese Regel waechst
      die Kette unbemerkt, und der naechste, der die Dauer untersucht, sucht
      wieder im Dunkeln — genau das war am 17.08. der Ausgangspunkt.

   node supabase/tests/login_chain_shape_test.mjs
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const AUTH = ['app/js/auth.js', 'js/auth.js'].map(p => join(REPO, p)).find(existsSync);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

if (!AUTH) { ok('auth.js gefunden', false); process.exit(1); }
const src = readFileSync(AUTH, 'utf8');

/* Die Kette: vom Beginn des Datenfundaments bis zur Gesamtmarke. */
const von = src.indexOf('// Datenfundament');
const bis = src.indexOf("_P.mark('onAuthed: TOTAL login-init chain'");
ok('A1 die Login-Kette ist im Code auffindbar', von > 0 && bis > von);
const kette = src.slice(von, bis);
/* Kommentare raus — ein `await` in einem Kommentar ist kein Glied der Kette. */
const code = kette.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const awaits = (code.match(/\bawait\b/g) || []).length;
const marken = (code.match(/_P\.mark\(/g) || []).length;

ok('A2 jeder await in der Kette traegt eine Messmarke', awaits === marken,
  awaits + ' await, ' + marken + ' Marken — bei Ungleichheit waechst die Kette unsichtbar');

/* Obergrenze mit Ansage: neue Glieder sind erlaubt, aber nicht beilaeufig.
   Wer hier erhoeht, hat die Entscheidung bewusst getroffen. */
ok('A3 die Kette ist nicht heimlich gewachsen (Stand 17.08.: 10 Glieder)', awaits <= 10,
  awaits + ' await — bewusst erhoehen und diese Zeile mitziehen, sonst ist es keine Entscheidung');

/* ---------- B · Der Avatar ist raus ---------- */
ok('B1 avatarStore.hydrate wird in der Kette NICHT mehr awaited',
  !/await\s+O\.avatarStore\.hydrate\(\)/.test(code),
  '1296 von 4781 ms — gehoert nicht auf den kritischen Pfad');
ok('B2 … und laeuft stattdessen nachgelagert (setTimeout nach auth-ready)',
  /setTimeout\(function \(\) \{[\s\S]{0,400}O\.avatarStore\.hydrate\(\)/.test(src));
ok('B3 … mit erhaltener Messmarke (der Posten verschwindet aus der Kette, nicht aus der Messung)',
  /_P\.mark\('avatarStore\.hydrate \(nachgelagert/.test(src));
ok('B4 … und mit Fehlerbehandlung (ein fehlendes Bild darf nichts abbrechen)',
  /avatarStore\.hydrate\(\)\)[\s\S]{0,300}\.catch\(/.test(src));

/* ---------- C · Der Avatar rendert sich selbst nach ---------- */
/* Das ist die Voraussetzung dafuer, dass B ueberhaupt zulaessig ist. */
const AV = ['app/js/avatar-store.js', 'js/avatar-store.js'].map(p => join(REPO, p)).find(existsSync);
if (AV) {
  const av = readFileSync(AV, 'utf8');
  ok('C1 avatar-store rendert nach dem Laden selbst nach',
    /renderTopAvatar\(\)/.test(av) && /renderGMProfile\(\)/.test(av),
    'sonst bliebe das Bild bis zum naechsten Rendern aus');
}

console.log('\n' + '═'.repeat(62) + '\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
