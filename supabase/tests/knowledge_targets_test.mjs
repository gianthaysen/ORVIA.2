/* ============================================================
   ORVIA · Zielregister — wer liest eigentlich, was das Wissen sagt? (v8-344)

   BEFUND, der diesen Test erzwungen hat (2026-08-13): Eine Wissensregel nennt
   in `outputs`, worauf sie wirken will. Geprueft hat das NIEMAND — jede
   Zeichenkette wurde angenommen. Gemessen an den beiden vorhandenen Paketen:

       Gym      1 von 5 Zielen hatte einen Leser
       Laufen   0 von 25

   QUELLE-11 (Kanjuh) lief durch Einspeisung, Vertrag und Anwendung, erzeugte
   eine Vorgabe fuer `plan.kraftvergleich_normierung` — ein Ziel, das in der
   ganzen App nicht vorkommt. Ein Tippfehler (`session.rest_secons`) haette
   sich exakt genauso verhalten: still, gruen, wirkungslos. Das ist zum
   dritten Mal dieselbe Fehlerklasse (v8-335: niemand liest es; v8-341:
   applyKnowledge ohne Aufrufer; jetzt: das Ziel ohne Leser).

   ZWEI ZUSICHERUNGEN:
     A  Das Register in `prescription-factory.GELESENE_ZIELE` stimmt mit den
        Zielen ueberein, die der Quelltext WIRKLICH liest — beidseitig.
     B  Jedes Paketziel ohne Leser steht in `_ziele-ohne-leser.json`. Ein
        neues totes Ziel wird rot, ein quittiertes bleibt gruen.

   Warum eine Quittungsdatei statt eines Verbots: Ein Ziel ohne Leser ist kein
   Vertragsbruch, sondern Wissen, das noch keine Verwendung hat. Es zu
   verbieten hiesse, gepflegte Regeln wegzuwerfen; es stillschweigend
   durchzulassen hiesse, sich reicher zu rechnen, als man ist.

   node supabase/tests/knowledge_targets_test.mjs
   ORVIA_QUITTIERE_ZIELE=JJJJ-MM-TT node …   (Quittung bewusst neu setzen)
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = [_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
  .find(p => existsSync(join(p, 'js/engine/prescription-factory.js'))) || _flat;
const QUITTUNG = join(HERE, '_ziele-ohne-leser.json');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* Sammelstelle über beide Blöcke: Paketziele (B) und Notizziele (C) zusammen
   ergeben erst die Menge, gegen die eine Quittung „überflüssig" sein kann. */
const KARTEILEICHEN = { quittiert: [], paketZiele: [], notizZiele: [] };

globalThis.ORVIA = globalThis.ORVIA || {};
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));
globalThis.ORVIA.knowledgeContracts = KC;
const PF = require(join(APP, 'js/engine/prescription-factory.js'));

/* ══ A · Das Register beschreibt die Wirklichkeit ══ */
sec('A · Register == was der Quelltext liest');
{
  const src = readFileSync(join(APP, 'js/engine/prescription-factory.js'), 'utf8');
  /* Der Registerblock selbst darf sich nicht mitzaehlen — sonst bestaetigt
     die Liste sich selbst, genau wie ein Pack, das seinen eigenen Hash pinnt. */
  const ohneRegister = src.replace(/var GELESENE_ZIELE = \[[\s\S]*?\];/, '');
  const imCode = [...new Set((ohneRegister.match(/'session\.[a-z_0-9]+'/g) || []).map(s => s.slice(1, -1)))].sort();
  const imRegister = (PF.GELESENE_ZIELE || []).slice().sort();

  ok('das Register ist vorhanden und nicht leer', imRegister.length > 0, imRegister.length + ' Ziele');
  ok('kein gelesenes Ziel fehlt im Register',
    imCode.every(z => imRegister.includes(z)),
    'im Code, nicht im Register: ' + JSON.stringify(imCode.filter(z => !imRegister.includes(z))));
  ok('kein Registereintrag ist erfunden (jedes wird wirklich gelesen)',
    imRegister.every(z => imCode.includes(z)),
    'im Register, nicht im Code: ' + JSON.stringify(imRegister.filter(z => !imCode.includes(z))));
  ok('das Register ist eingefroren (kein Nachtragen zur Laufzeit)',
    Object.isFrozen(PF.GELESENE_ZIELE));
}

/* ══ B · Jedes Paketziel hat einen Leser oder eine Quittung ══ */
sec('B · Ziele der Wissenspakete');
{
  const dir = join(APP, 'js/engine/knowledge');
  const packDateien = readdirSync(dir).filter(f => /-knowledge-pack\.js$/.test(f)).sort();
  ok('es gibt ueberhaupt Wissenspakete zu pruefen', packDateien.length > 0, packDateien.join(', '));

  const ziele = new Map();   /* ziel → [regelId …] */
  packDateien.forEach(f => {
    const pack = require(join(dir, f));
    (pack.rules || []).forEach(r => {
      (r.outputs || []).forEach(z => {
        if (!ziele.has(z)) ziele.set(z, []);
        ziele.get(z).push(r.ruleId);
      });
    });
  });

  const gelesen = PF.GELESENE_ZIELE || [];
  const mitLeser = [...ziele.keys()].filter(z => gelesen.includes(z)).sort();
  const ohneLeser = [...ziele.keys()].filter(z => !gelesen.includes(z)).sort();

  console.log('   ' + ziele.size + ' Ziele aus ' + packDateien.length + ' Paketen · '
    + mitLeser.length + ' mit Leser · ' + ohneLeser.length + ' ohne');

  const repin = (process.env.ORVIA_QUITTIERE_ZIELE || '').trim();
  if (!existsSync(QUITTUNG) && repin) {
    const swQ = readFileSync(join(APP, 'sw.js'), 'utf8').match(/const C = 'orvia-(v8-\d+)'/);
    const eintraege = {};
    ohneLeser.forEach(z => { eintraege[z] = 'QUITTIERT OHNE BEGRUENDUNG — bitte nachtragen (' + ziele.get(z).join(', ') + ')'; });
    writeFileSync(QUITTUNG, JSON.stringify({ quittiertAm: repin,
      appVersion: swQ ? swQ[1] : 'unbekannt', ziele: eintraege }, null, 2));
    ok('Quittung AUSDRÜCKLICH neu gesetzt', true, ohneLeser.length + ' Ziele, ' + repin);
  } else if (!existsSync(QUITTUNG)) {
    ok('jedes Ziel ohne Leser ist quittiert', false,
      'QUITTUNG FEHLT (_ziele-ohne-leser.json) — ungeprüft. Ein fehlender Beleg ist kein Beleg. '
      + 'Bewusst setzen: ORVIA_QUITTIERE_ZIELE=JJJJ-MM-TT node supabase/tests/knowledge_targets_test.mjs');
  } else {
    const q = JSON.parse(readFileSync(QUITTUNG, 'utf8'));
    const quittiert = Object.keys(q.ziele || {});
    const unquittiert = ohneLeser.filter(z => !quittiert.includes(z));
    const veraltet = quittiert.filter(z => !ohneLeser.includes(z));

    ok('jedes Ziel ohne Leser ist quittiert', unquittiert.length === 0,
      unquittiert.length
        ? 'NEUES WIRKUNGSLOSES ZIEL: ' + unquittiert.map(z => z + ' (' + ziele.get(z).join(', ') + ')').join(' · ')
          + ' — entweder einen Leser bauen oder in _ziele-ohne-leser.json begründen'
        : quittiert.length + ' quittiert');
    /* Die Karteileichenprüfung steht in Block C: dort sind Paket- UND
       Notizziele bekannt. Sie hier zu führen hiesse, jede Notizquittung für
       überflüssig zu halten — ein Fehler, den dieser Test selbst gemacht hat,
       als Block C dazukam (v8-345). */
    KARTEILEICHEN.quittiert = quittiert;
    KARTEILEICHEN.paketZiele = [...ziele.keys()];
    ok('  … jede Quittung nennt einen Grund',
      quittiert.every(z => typeof q.ziele[z] === 'string' && q.ziele[z].trim().length >= 20),
      'ohne Begründung: ' + JSON.stringify(quittiert.filter(z => !(typeof q.ziele[z] === 'string' && q.ziele[z].trim().length >= 20))));
  }

  /* Die ehrliche Zahl, jedes Mal sichtbar — nicht als Fussnote. */
  ok('mindestens ein Paketziel wird tatsächlich gelesen',
    mitLeser.length > 0, mitLeser.length + ' von ' + ziele.size + ': ' + JSON.stringify(mitLeser));

  /* KEINE Zusicherung, sondern eine Zahl, die man kennen muss: ein Ziel ohne
     Leser ist das eine — eine REGEL OHNE WERT das andere. Sie kann selbst mit
     Leser nichts setzen. Gemessen am 13.08.: Gym 2 von 4, Laufen 0 von 14. */
  packDateien.forEach(f => {
    const pack = require(join(dir, f));
    const mitWert = (pack.rules || []).filter(r =>
      (r.claims || []).some(c => Object.keys(c).some(k => /quant|number|value|range|zahl/i.test(k)))).length;
    console.log('   ' + f.replace('-knowledge-pack.js', '') + ': ' + mitWert + ' von '
      + (pack.rules || []).length + ' Regeln tragen überhaupt einen Zahlwert');
  });
}

/* ══ C · Auch die Notizdateien, BEVOR daraus ein Paket wird ══ */
sec('C · Ziele der Notizdateien in docs/wissen');
{
  /* WARUM HIER UND NICHT ERST BEIM PAKET: QUELLE-11 zeigte auf
     `plan.kraftvergleich_normierung` und fiel niemandem auf, weil der Sensor
     nur Pakete kannte. Ein Ziel ohne Leser soll auffallen, BEVOR jemand ein
     Paket dafür baut — sonst ist die Arbeit schon getan, wenn es auffliegt. */
  const wissenDir = join(APP, 'docs/wissen');
  if (!existsSync(wissenDir)) {
    ok('das Notizverzeichnis existiert', false, wissenDir);
  } else {
    const KI = require(join(APP, 'js/engine/knowledge/knowledge-ingest.js'));
    const notizen = readdirSync(wissenDir).filter(f => /^QUELLE-.*\.json$/.test(f)).sort();
    const gelesen = PF.GELESENE_ZIELE || [];
    const zieleNotiz = new Map();
    const unbrauchbar = [];

    notizen.forEach(f => {
      let n;
      try { n = JSON.parse(readFileSync(join(wissenDir, f), 'utf8')); }
      catch (e) { unbrauchbar.push(f + ' (kein gültiges JSON)'); return; }
      let r;
      try { r = KI.ingest(n); } catch (e) { unbrauchbar.push(f + ' (ingest warf)'); return; }
      /* Eine Notiz, die der Vertrag ablehnt, ist hier KEIN Fehler: sie wartet
         auf Inhalt oder wurde bewusst abgelehnt (QUELLE-10). Sie wird genannt,
         nicht bestraft — sonst wäre der Test rot für etwas, das in Ordnung ist. */
      if (!r || r.ok !== true) { unbrauchbar.push(f + ' (vom Vertrag abgewiesen)'); return; }
      (r.rules || []).forEach(rule => (rule.outputs || []).forEach(z => {
        if (!zieleNotiz.has(z)) zieleNotiz.set(z, []);
        zieleNotiz.get(z).push(f.replace(/^QUELLE-/, '').replace(/\.json$/, '') + '/' + rule.ruleId);
      }));
    });

    console.log('   ' + notizen.length + ' Notizdateien · ' + (notizen.length - unbrauchbar.length)
      + ' vertragsfest · ' + unbrauchbar.length + ' (noch) nicht auswertbar');
    unbrauchbar.forEach(u => console.log('     ⏭️  ' + u));

    const ohneLeserNotiz = [...zieleNotiz.keys()].filter(z => !gelesen.includes(z)).sort();
    if (existsSync(QUITTUNG)) {
      const q = JSON.parse(readFileSync(QUITTUNG, 'utf8'));
      const quittiert = Object.keys(q.ziele || {});
      const offen = ohneLeserNotiz.filter(z => !quittiert.includes(z));
      ok('jedes Notizziel ohne Leser ist quittiert', offen.length === 0,
        offen.length
          ? 'WIRKUNGSLOS, BEVOR ES EIN PAKET GIBT: ' + offen.map(z => z + ' (' + zieleNotiz.get(z).join(', ') + ')').join(' · ')
          : ohneLeserNotiz.length + ' geprüft, alle quittiert');
    }
    ok('  … und die Notizen werden überhaupt ausgewertet',
      zieleNotiz.size > 0 || notizen.length === unbrauchbar.length,
      zieleNotiz.size + ' Ziele aus Notizen');

    /* ══ Die Zahl, die erklaert, warum so wenig ankommt ══
       Ein Ziel ohne Leser ist das eine. Eine Regel, die eine Zahl NENNT, sie
       aber nicht im Feld `zahlen` fuehrt, ist das andere: sie kann selbst mit
       Leser nichts setzen. Gemessen am 13.08.: 8 Regeln nennen eine Zahl im
       Text, nur 2 fuehren sie strukturiert.

       KEINE Zusicherung, sondern eine Ausgabe. Ein hartes Rot waere hier
       falsch: die meisten dieser Zahlen sind MEHRDIMENSIONAL (vier bis fuenf
       Serien zu drei bis vier Wiederholungen ueber sechs bis zehn Wochen),
       und das Feld `zahlen` fasst genau EINEN Bereich mit EINER Einheit. Wer
       das rot faerbt, verlangt etwas, das der Vertrag nicht kann. */
    const ZAHL_IM_TEXT = /\b(zwei|drei|vier|fuenf|fünf|sechs|sieben|acht|neun|zehn|elf|zwoelf|zwölf|\d+([.,]\d+)?)\s*(bis|und|-)?\s*(zwei|drei|vier|fuenf|fünf|sechs|sieben|acht|neun|zehn|elf|zwoelf|zwölf|\d+([.,]\d+)?)?\s*(prozent|minuten|sekunden|wochen|einheiten|serien|saetze|sätze|wiederholungen|kilometer|newton)/i;
    let genannt = 0, gefuehrt = 0;
    const offeneZahlen = [];
    notizen.forEach(f => {
      let n; try { n = JSON.parse(readFileSync(join(wissenDir, f), 'utf8')); } catch (e) { return; }
      let r; try { r = KI.ingest(n); } catch (e) { return; }
      if (!r || r.ok !== true) return;
      (n.regeln || []).forEach(rr => {
        if (rr.zahlen) { gefuehrt++; return; }
        if (ZAHL_IM_TEXT.test(rr.aussage || '')) {
          genannt++;
          offeneZahlen.push(f.replace(/^QUELLE-|\.json$/g, '') + '/' + rr.id);
        }
      });
    });
    console.log('   Zahlen: ' + gefuehrt + ' Regeln führen sie strukturiert · '
      + genannt + ' nennen sie nur im Text');
    if (offeneZahlen.length) console.log('     ' + offeneZahlen.join(', '));

    KARTEILEICHEN.notizZiele = [...zieleNotiz.keys()];
    const alleBekannt = new Set(KARTEILEICHEN.paketZiele.concat(KARTEILEICHEN.notizZiele));
    const gelesenSet = PF.GELESENE_ZIELE || [];
    const veraltet = KARTEILEICHEN.quittiert.filter(z => !alleBekannt.has(z) || gelesenSet.includes(z));
    ok('keine Quittung ist überflüssig geworden (Pakete UND Notizen)', veraltet.length === 0,
      veraltet.length
        ? 'hat jetzt einen Leser oder existiert nicht mehr: ' + JSON.stringify(veraltet)
        : KARTEILEICHEN.quittiert.length + ' Quittungen, alle noch nötig');
  }
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
