/* ============================================================
   ORVIA · Zielregister — kommt das Wissen wirklich an? (v8-349)

   BEFUND, der diesen Test erzwungen hat (2026-08-13): Eine Wissensregel nennt
   in `outputs`, worauf sie wirken will. Geprueft hat das NIEMAND — jede
   Zeichenkette wurde angenommen. QUELLE-11 (Kanjuh) lief durch Einspeisung,
   Vertrag und Anwendung, erzeugte eine Vorgabe fuer
   `plan.kraftvergleich_normierung` — ein Ziel, das die Verordnung nicht
   kennt. Ein Tippfehler (`session.rest_secons`) haette sich exakt genauso
   verhalten: still, gruen, wirkungslos.

   ZWEITER BEFUND (v8-349), der die Messung dieses Tests verworfen hat: Bis
   hierher galt als „gelesen" nur, was die Verordnung als ZAHL einbaut. Alles
   andere galt als wirkungslos — 45 Ziele standen so in einer Quittungsliste.
   Das war eine zu enge Vorstellung von Wirkung UND eine unbelegte Zahl in
   beide Richtungen: gemessen wurde nie, sondern aus dem Register GERATEN.

   Seit v8-349 gibt die Verordnung `hinweise` zurueck. Dieser Test raet
   deshalb nicht mehr, sondern MISST durch die echte Kette:

       Paket → applyKnowledge → buildPrescription → hinweise/flags

   Ein Ziel gilt als angekommen, wenn es in einer wirklich gebauten
   Verordnung auftaucht — als Zahl im Workout (Flag `…_aus_wissen:`) oder
   als Hinweis mit Aussage und Herkunft. Alles andere ist nicht angekommen,
   egal was ein Register behauptet.

   DREI ZUSICHERUNGEN:
     A  Das Register in `prescription-factory.GELESENE_ZIELE` stimmt mit den
        Zielen ueberein, die der Quelltext WIRKLICH liest — beidseitig.
     B  Kein Paketziel verschwindet still. Es kommt an — oder eine
        Ausschlussentscheidung nennt einen CODE dafuer (z. B.
        `medical_safety_review_pending`). Ein Ziel, das weder ankommt noch
        gesperrt ist, ist rot.
     C  Eine autorisierte ZAHL ohne Anwender ist rot, solange sie nicht in
        `_ziele-ohne-leser.json` begruendet ist. Ein Hinweis braucht keinen
        Anwender — eine Zahl schon, sonst wurde sie umsonst freigegeben.

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
const VOKABULAR = join(HERE, '_zielvokabular.json');

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

/* Sammelstelle über beide Blöcke: erst Paket- UND Notizbefund zusammen
   ergeben die Menge, gegen die eine Quittung „überflüssig" sein kann. */
const BEFUND = { quittiert: [], zahlOhneAnwender: [], bekannteZiele: new Set() };

globalThis.ORVIA = globalThis.ORVIA || {};
const KC = require(join(APP, 'js/engine/knowledge/knowledge-contracts.js'));
globalThis.ORVIA.knowledgeContracts = KC;
const KA = require(join(APP, 'js/engine/knowledge/knowledge-application.js'));
const PF = require(join(APP, 'js/engine/prescription-factory.js'));

/* ------------------------------------------------------------------
   DIE MESSUNG. Kein Register wird befragt, keine Absicht gelesen: es
   werden Verordnungen GEBAUT und nachgesehen, was drinsteht.

   Warum über ALLE Templates: ein Ziel wie `session.rest_seconds` wird nur
   im Krafttemplate als Zahl eingebaut, `session.rpe_tempo` nur im
   Tempolauf. Wer nur ein Template baut, misst zu wenig und nennt das
   Ergebnis dann „wirkungslos".

   Warum die Pins hier aus dem Paket kommen und das im Consumer VERBOTEN
   ist: der Consumer muss unabhaengig pinnen, sonst bestaetigt das Paket
   sich selbst. Diese Messstelle prueft keine Pins — sie prueft, was durch
   eine ANGEWENDETE Kette hindurchkommt. Ob die Pins der App stimmen,
   sichert knowledge_consumer_test.mjs. ------------------------------- */
const UEBUNG = [{ exerciseId: 'squat', sets: 3, reps: 8, rest_seconds: 120 }];

function messen(pack, registry, sportId) {
  const erg = KA.applyKnowledge({
    pack: pack, registry: registry, sport: sportId, contracts: KC,
    pins: {
      expectedKnowledgeContractVersion: KC.KNOWLEDGE_CONTRACT_VERSION,
      expectedKnowledgeVersion: pack.knowledgeVersion,
      expectedPackContentHash: pack.contentHash,
      expectedSourceRegistryVersion: registry.registryVersion,
      expectedSourceRegistryHash: registry.contentHash
    }
  });
  const res = { ok: !!(erg && erg.ok), grund: erg && erg.grund, erg: erg,
    alsWert: new Set(), alsHinweis: new Set(), gesperrt: new Map(), blockiert: [] };
  if (!res.ok) return res;

  /* Gesperrte Regeln: welches Ziel faellt mit welchem CODE aus? Ein Ziel
     ohne Ankunft UND ohne Code ist der Fehlerfall — mit Code ist es eine
     Entscheidung, die jemand getroffen hat. */
  (erg.ausgeschlossen || []).forEach(a => {
    const regel = (pack.rules || []).find(r => r.ruleId === a.ruleId);
    (regel && regel.outputs || []).forEach(z => {
      if (!res.gesperrt.has(z)) res.gesperrt.set(z, []);
      res.gesperrt.get(z).push(a.ruleId + ':' + (a.code || 'ohne_code'));
    });
  });

  PF.TEMPLATE_IDS.forEach(tpl => {
    const p = PF.buildPrescription({ sportId: sportId, sessionType: tpl, durationMin: 60,
      knowledge: erg, exercises: UEBUNG }, {});
    if (!p || p.ok !== true) { res.blockiert.push(tpl + ':' + (p && p.blocked)); return; }
    /* `ziele` statt `ziel`: eine Regel mit zwei Zielen und EINEM Satz wird
       zu EINEM Hinweis zusammengefasst (sonst stuende er zweimal auf der
       Karte). Wer hier nur `ziel` liest, zaehlt das zweite Ziel faelschlich
       als „kommt nicht an". */
    (p.hinweise || []).forEach(h => {
      if (!h) return;
      (Array.isArray(h.ziele) && h.ziele.length ? h.ziele : [h.ziel])
        .forEach(z => { if (z) res.alsHinweis.add(z); });
    });
    (p.flags || []).forEach(f => {
      if (typeof f !== 'string' || f.indexOf('_aus_wissen:') <= 0) return;
      if (f.indexOf('hinweise_aus_wissen:') === 0) return;
      /* Das Flag nennt den Schluessel, nicht das Ziel. Die Zuordnung steht
         in der Factory; hier wird sie ueber die Vorgabe aufgeloest, damit
         dieser Test keine zweite Uebersetzungstabelle pflegen muss. */
      const regelId = f.split('_aus_wissen:')[1];
      (erg.vorgaben || []).forEach(v => { if (v.regelId === regelId && v.art !== 'empfehlung') res.alsWert.add(v.ziel); });
    });
  });
  return res;
}

/* ══ A · Das Register beschreibt die Wirklichkeit ══ */
sec('A · Register == was der Quelltext liest');
{
  const src = readFileSync(join(APP, 'js/engine/prescription-factory.js'), 'utf8');
  /* Der Registerblock selbst darf sich nicht mitzaehlen — sonst bestaetigt
     die Liste sich selbst, genau wie ein Pack, das seinen eigenen Hash pinnt. */
  /* v8-351: BEIDE Registerbloecke werden ausgeschnitten. Kam der zweite
     hinzu, ohne hier genannt zu werden, bestaetigte er sich selbst — genau
     der Fehler, den Probe ZR4 fuer den ersten Block bewacht. */
  const ohneRegister = src
    .replace(/var GELESENE_ZIELE = \[[\s\S]*?\];/, '')
    .replace(/var GEPRUEFTE_ZIELE = \[[\s\S]*?\];/, '');
  const imCode = [...new Set((ohneRegister.match(/'session\.[a-z_0-9]+'/g) || []).map(s => s.slice(1, -1)))].sort();
  const imRegister = (PF.GELESENE_ZIELE || []).slice().sort();
  /* Die geprueften Ziele tragen `plan.`-Namen, deshalb ein eigenes Muster.
     Sie mit den gelesenen in eine Liste zu werfen waere bequem und falsch:
     die eine sagt „wird eingebaut", die andere „wird geprueft". */
  const imCodeGeprueft = [...new Set((ohneRegister.match(/'plan\.[a-z_0-9]+'/g) || []).map(s => s.slice(1, -1)))].sort();
  const imRegisterGeprueft = (PF.GEPRUEFTE_ZIELE || []).slice().sort();

  ok('das Register ist vorhanden und nicht leer', imRegister.length > 0, imRegister.length + ' Ziele');
  ok('kein gelesenes Ziel fehlt im Register',
    imCode.every(z => imRegister.includes(z)),
    'im Code, nicht im Register: ' + JSON.stringify(imCode.filter(z => !imRegister.includes(z))));
  ok('kein Registereintrag ist erfunden (jedes wird wirklich gelesen)',
    imRegister.every(z => imCode.includes(z)),
    'im Register, nicht im Code: ' + JSON.stringify(imRegister.filter(z => !imCode.includes(z))));
  ok('das Register ist eingefroren (kein Nachtragen zur Laufzeit)',
    Object.isFrozen(PF.GELESENE_ZIELE));

  /* v8-351 — DAS ZWEITE REGISTER, mit derselben Strenge.
     Ein Ziel, das geprueft statt gesetzt wird, ist trotzdem angewendet — und
     ein erfundener Eintrag hier waere genauso gefaehrlich wie drueben: er
     liesse eine freigegebene Zahl als versorgt erscheinen. */
  ok('das Register der geprueften Ziele ist vorhanden und eingefroren',
    Array.isArray(PF.GEPRUEFTE_ZIELE) && Object.isFrozen(PF.GEPRUEFTE_ZIELE),
    JSON.stringify(imRegisterGeprueft));
  ok('kein geprueftes Ziel ist erfunden (jedes kommt im Quelltext vor)',
    imRegisterGeprueft.every(z => imCodeGeprueft.includes(z)),
    'im Register, nicht im Code: ' + JSON.stringify(imRegisterGeprueft.filter(z => !imCodeGeprueft.includes(z))));
  ok('kein Ziel steht in BEIDEN Registern',
    imRegisterGeprueft.every(z => !imRegister.includes(z)),
    JSON.stringify(imRegisterGeprueft.filter(z => imRegister.includes(z))));
}

/* ══ B · Was von den Wissenspaketen wirklich ankommt ══ */
sec('B · Wissenspakete — gemessen an gebauten Verordnungen');
{
  const dir = join(APP, 'js/engine/knowledge');
  /* Zu jedem Paket gehoert sein Quellenregister. Die Zuordnung steht hier
     ausgeschrieben: raten waere genau der Fehler, den dieser Test sucht. */
  const PAARE = [
    { pack: 'gym-knowledge-pack.js', registry: 'gym-knowledge-sources.js', sport: 'gym' },
    { pack: 'running-knowledge-pack.js', registry: 'knowledge-sources.js', sport: 'running' },
    /* v8-353: das aus den Notizen erzeugte Laufpaket. Eigene Dateien, eigenes
       Register, keine gemeinsame Regel-Kennung mit dem handgepflegten. */
    { pack: 'running-notizen-knowledge-pack.js', registry: 'running-notizen-knowledge-sources.js', sport: 'running' }
  ];
  const packDateien = readdirSync(dir).filter(f => /-knowledge-pack\.js$/.test(f)).sort();
  ok('es gibt ueberhaupt Wissenspakete zu pruefen', packDateien.length > 0, packDateien.join(', '));
  /* Ein neues Paket ohne Eintrag in PAARE wuerde sonst still uebersprungen —
     und ein uebersprungenes Paket sieht aus wie ein sauberes. */
  ok('jedes vorhandene Paket wird auch gemessen',
    packDateien.every(f => PAARE.some(p => p.pack === f)),
    'nicht gemessen: ' + JSON.stringify(packDateien.filter(f => !PAARE.some(p => p.pack === f))));

  let gesamtZiele = 0, gesamtWert = 0, gesamtHinweis = 0;
  const nirgends = [];        /* kommt nicht an UND ist nicht gesperrt */
  const gesperrtMit = [];     /* kommt nicht an, aber mit benanntem Code */
  const zahlOhneAnwender = [];

  PAARE.forEach(paar => {
    if (!existsSync(join(dir, paar.pack))) return;
    const pack = require(join(dir, paar.pack));
    const registry = require(join(dir, paar.registry));
    const m = messen(pack, registry, paar.sport);

    /* Der Name des PAKETS, nicht der Sportart: seit v8-353 gibt es zwei
       Laufpakete, und zwei gleich beschriftete Zeilen sind keine Auskunft. */
    const nameP = paar.pack.replace('-knowledge-pack.js', '');
    if (!m.ok) { ok('Paket ' + nameP + ' wird angewendet', false, 'blockiert: ' + m.grund); return; }
    ok('Paket ' + nameP + ' wird angewendet', true,
      (m.erg.vorgaben || []).length + ' Vorgaben, ' + (m.erg.ausgeschlossen || []).length + ' Regeln gesperrt');

    const ziele = new Map();
    (pack.rules || []).forEach(r => (r.outputs || []).forEach(z => {
      if (!ziele.has(z)) ziele.set(z, []); ziele.get(z).push(r.ruleId);
    }));
    ziele.forEach((regeln, z) => {
      BEFUND.bekannteZiele.add(z);
      gesamtZiele++;
      if (m.alsWert.has(z)) { gesamtWert++; return; }
      if (m.alsHinweis.has(z)) { gesamtHinweis++; return; }
      if (m.gesperrt.has(z)) { gesperrtMit.push(z + ' (' + m.gesperrt.get(z).join(', ') + ')'); return; }
      nirgends.push(z + ' (' + regeln.join(', ') + ')');
    });

    /* Eine ZAHL ohne Anwender ist etwas anderes als ein Hinweis ohne
       Anwender: sie wurde durch den Vertrag ausdruecklich zum Vorschreiben
       freigegeben — und niemand schreibt sie vor. */
    (m.erg.vorgaben || []).forEach(v => {
      if (!v || (v.art !== 'zahl' && v.art !== 'liste')) return;
      if ((PF.GELESENE_ZIELE || []).includes(v.ziel)) return;
      /* v8-351: geprueft ist auch angewendet. Eine Zahl, gegen die eine
         geplante Einheit geprueft wird, ist nicht wirkungslos — sie wird
         nur nicht vorgeschrieben. Genau diese Unterscheidung trennt die
         beiden Register; wer sie hier fallen liesse, verlangte eine
         Quittung fuer etwas, das laengst wirkt. */
      if ((PF.GEPRUEFTE_ZIELE || []).includes(v.ziel)) return;
      zahlOhneAnwender.push(v.ziel);
    });

    /* Ein Ziel, das als Wert ankommt, wird hier NICHT zusaetzlich als Hinweis
       gezaehlt. Es kann beides sein — `session.rest_seconds` ist im
       Krafttemplate eine Zahl und in den Ausdauertemplates nur ein Hinweis —
       aber eine Summe ueber 100 % waere eine Auskunft, der man nicht traut. */
    console.log('   ' + nameP + ': ' + ziele.size + ' Ziele · '
      + [...ziele.keys()].filter(z => m.alsWert.has(z)).length + ' als Wert · '
      + [...ziele.keys()].filter(z => !m.alsWert.has(z) && m.alsHinweis.has(z)).length + ' nur als Hinweis · '
      + [...ziele.keys()].filter(z => !m.alsWert.has(z) && !m.alsHinweis.has(z)).length + ' nicht angekommen');
    if (m.blockiert.length) console.log('     (Templates ohne Verordnung: ' + m.blockiert.join(', ') + ')');
  });

  console.log('   GESAMT: ' + gesamtZiele + ' Paketziele · ' + gesamtWert + ' als Wert · '
    + gesamtHinweis + ' als Hinweis · ' + gesperrtMit.length + ' bewusst gesperrt · '
    + nirgends.length + ' unerklaert verschwunden');

  ok('kein Paketziel verschwindet unerklaert',
    nirgends.length === 0,
    nirgends.length
      ? 'kommt nicht an und ist nicht gesperrt: ' + JSON.stringify(nirgends)
        + ' — entweder einen Leser bauen, eine Aussage ergaenzen oder die Regel bewusst sperren'
      : 'jedes Ziel kommt an oder nennt seinen Sperrcode');

  ok('  … jede Sperre nennt einen Code (kein stilles Ausfallen)',
    gesperrtMit.every(t => !/ohne_code/.test(t)),
    gesperrtMit.length ? gesperrtMit.join(' · ') : 'keine Sperre aktiv');

  ok('mindestens ein Paketziel wird als WERT eingebaut',
    gesamtWert > 0, gesamtWert + ' von ' + gesamtZiele);

  BEFUND.zahlOhneAnwender = [...new Set(zahlOhneAnwender)].sort();
}

/* ══ C · Die Zahlen, die freigegeben sind und trotzdem niemand anwendet ══ */
sec('C · Freigegebene Zahl ohne Anwender');
{
  /* WARUM DAS SEPARAT STEHT: seit v8-349 kommt jede Aussage als Hinweis auf
     der Karte an — das ist Wirkung, aber es ersetzt keine Zahl. Wenn der
     Vertrag eine Zahl ZUM VORSCHREIBEN freigibt (Klasse, Rolle,
     Governance alles erfuellt) und die Verordnung sie nicht anwendet, ist
     die Freigabe umsonst gewesen. Das gehoert benannt, nicht verrechnet. */
  const repin = (process.env.ORVIA_QUITTIERE_ZIELE || '').trim();
  const offen = BEFUND.zahlOhneAnwender;
  console.log('   ' + offen.length + ' freigegebene Zahl(en)/Liste(n) ohne Anwender'
    + (offen.length ? ': ' + offen.join(', ') : ''));

  if (!existsSync(QUITTUNG) && repin) {
    const swQ = readFileSync(join(APP, 'sw.js'), 'utf8').match(/const C = 'orvia-(v8-\d+)'/);
    const eintraege = {};
    offen.forEach(z => { eintraege[z] = 'QUITTIERT OHNE BEGRUENDUNG — bitte nachtragen'; });
    writeFileSync(QUITTUNG, JSON.stringify({ quittiertAm: repin,
      appVersion: swQ ? swQ[1] : 'unbekannt', ziele: eintraege }, null, 2));
    ok('Quittung AUSDRÜCKLICH neu gesetzt', true, offen.length + ' Ziele, ' + repin);
  } else if (!existsSync(QUITTUNG)) {
    ok('jede Zahl ohne Anwender ist quittiert', false,
      'QUITTUNG FEHLT (_ziele-ohne-leser.json) — ungeprüft. Ein fehlender Beleg ist kein Beleg. '
      + 'Bewusst setzen: ORVIA_QUITTIERE_ZIELE=JJJJ-MM-TT node supabase/tests/knowledge_targets_test.mjs');
  } else {
    const q = JSON.parse(readFileSync(QUITTUNG, 'utf8'));
    const quittiert = Object.keys(q.ziele || {});
    BEFUND.quittiert = quittiert;
    const unquittiert = offen.filter(z => !quittiert.includes(z));

    ok('jede freigegebene Zahl ohne Anwender ist quittiert', unquittiert.length === 0,
      unquittiert.length
        ? 'NEUE ZAHL OHNE ANWENDER: ' + unquittiert.join(' · ')
          + ' — entweder einen Leser bauen oder in _ziele-ohne-leser.json begründen'
        : quittiert.length + ' quittiert');

    ok('  … jede Quittung nennt einen Grund',
      quittiert.every(z => typeof q.ziele[z] === 'string' && q.ziele[z].trim().length >= 20),
      'ohne Begründung: ' + JSON.stringify(quittiert.filter(z => !(typeof q.ziele[z] === 'string' && q.ziele[z].trim().length >= 20))));

    const veraltet = quittiert.filter(z => !offen.includes(z));
    ok('  … keine Quittung ist überflüssig geworden', veraltet.length === 0,
      veraltet.length
        ? 'hat jetzt einen Anwender oder existiert nicht mehr: ' + JSON.stringify(veraltet)
        : quittiert.length + ' Quittungen, alle noch nötig');
  }
}

/* ══ D · Auch die Notizdateien, BEVOR daraus ein Paket wird ══ */
sec('D · Notizen in docs/wissen — käme das an?');
{
  /* WARUM HIER UND NICHT ERST BEIM PAKET: QUELLE-11 zeigte auf
     `plan.kraftvergleich_normierung` und fiel niemandem auf, weil der Sensor
     nur Pakete kannte. Ein Ziel, das nirgends ankaeme, soll auffallen, BEVOR
     jemand ein Paket dafuer baut — sonst ist die Arbeit schon getan, wenn es
     auffliegt.

     EHRLICHE EINSCHRAENKUNG DER MESSUNG: eine frische Notiz steht auf
     `technicalStatus: 'draft'` und wird von der Anwendung mit dem Code
     `technical_review_pending` gesperrt — zu Recht. Gemessen wird deshalb
     der Zustand NACH technischer Freigabe: „was kaeme an, wenn jemand diese
     Notiz freigibt?". Das ist eine Simulation und wird als solche
     ausgewiesen. Sie faelscht nichts: die medizinische Sperre bleibt
     stehen, sie wird NICHT mitsimuliert. */
  const wissenDir = join(APP, 'docs/wissen');
  if (!existsSync(wissenDir)) {
    ok('das Notizverzeichnis existiert', false, wissenDir);
  } else {
    const KI = require(join(APP, 'js/engine/knowledge/knowledge-ingest.js'));
    const notizen = readdirSync(wissenDir).filter(f => /^QUELLE-.*\.json$/.test(f)).sort();
    const unbrauchbar = [];
    const nirgends = [];
    const gesperrt = [];
    let zieleGesamt = 0, angekommen = 0;

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

      /* NUR der technische Status wird simuliert — siehe Begruendung oben. */
      (r.rules || []).forEach(x => { x.governance.technicalStatus = 'reviewed'; });
      const registry = { registryVersion: 1, sources: r.sources };
      registry.contentHash = KC.registryContentHash(registry);
      const sport = n.sport || 'gym';
      const pack = { packId: sport, version: 1, knowledgeVersion: 'kb-notizprobe-v1',
        sport: sport, rules: r.rules, contentHash: null };
      pack.contentHash = KC.packContentHash(pack);

      let m;
      try { m = messen(pack, registry, sport); }
      catch (e) { unbrauchbar.push(f + ' (Anwendung warf: ' + e.message + ')'); return; }
      if (!m.ok) { unbrauchbar.push(f + ' (Anwendung blockiert: ' + m.grund + ')'); return; }

      const kurz = f.replace(/^QUELLE-/, '').replace(/\.json$/, '');
      const ziele = new Map();
      (r.rules || []).forEach(rule => (rule.outputs || []).forEach(z => {
        if (!ziele.has(z)) ziele.set(z, []); ziele.get(z).push(rule.ruleId);
      }));
      ziele.forEach((regeln, z) => {
        BEFUND.bekannteZiele.add(z);
        zieleGesamt++;
        if (m.alsWert.has(z) || m.alsHinweis.has(z)) { angekommen++; return; }
        if (m.gesperrt.has(z)) { gesperrt.push(kurz + '/' + z + ' (' + m.gesperrt.get(z).join(', ') + ')'); return; }
        nirgends.push(kurz + '/' + z + ' (' + regeln.join(', ') + ')');
      });
    });

    console.log('   ' + notizen.length + ' Notizdateien · ' + (notizen.length - unbrauchbar.length)
      + ' vertragsfest · ' + unbrauchbar.length + ' (noch) nicht auswertbar');
    unbrauchbar.forEach(u => console.log('     ⏭️  ' + u));
    console.log('   ' + zieleGesamt + ' Notizziele · ' + angekommen
      + ' kämen nach technischer Freigabe an · ' + gesperrt.length + ' bleiben medizinisch gesperrt');
    if (gesperrt.length) gesperrt.forEach(g => console.log('     🔒 ' + g));

    ok('die Notizen werden überhaupt ausgewertet',
      zieleGesamt > 0 || notizen.length === unbrauchbar.length,
      zieleGesamt + ' Ziele aus Notizen');

    ok('kein Notizziel verschwindet unerklaert',
      nirgends.length === 0,
      nirgends.length ? JSON.stringify(nirgends) : 'jedes Notizziel kommt an oder nennt seinen Sperrcode');

    /* ══ Die Zahl, die erklaert, warum so wenig als WERT ankommt ══
       Ein Ziel ohne Anwender ist das eine. Eine Regel, die eine Zahl NENNT,
       sie aber nicht im Feld `zahlen` fuehrt, ist das andere: sie kann
       selbst mit Anwender nichts setzen.

       KEINE Zusicherung, sondern eine Ausgabe. Ein hartes Rot waere hier
       falsch: viele dieser Zahlen sind MEHRDIMENSIONAL, und wer das rot
       faerbt, verlangt eine Eingabe, die niemand sinnvoll machen kann. */
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

    /* Eine Quittung, deren Ziel nirgends mehr vorkommt, ist eine
       Karteileiche. Sie stehenzulassen hiesse, sich an einem Problem
       abzuarbeiten, das es nicht mehr gibt. */
    const unbekannt = BEFUND.quittiert.filter(z => !BEFUND.bekannteZiele.has(z));
    ok('keine Quittung nennt ein Ziel, das es nicht mehr gibt',
      unbekannt.length === 0,
      unbekannt.length ? JSON.stringify(unbekannt) : BEFUND.quittiert.length + ' Quittungen, alle Ziele existieren');
  }
}

/* ══ E · Ist dieser Zielname gemeint — oder vertippt? ══ */
sec('E · Zielvokabular');
{
  /* DIE LUECKE, DIE v8-349 AUFGERISSEN HAT. Bis v8-348 fiel ein Tippfehler im
     Zielnamen dadurch auf, dass nichts ankam. Seit v8-349 kommt die Aussage
     als Hinweis IMMER an — der Nutzer sieht sie, der Tippfehler bleibt
     unsichtbar. Das ist gut fuer den Nutzer und schlecht fuer den Sensor.

     Diese Pruefung schliesst die Luecke von der anderen Seite: nicht ueber
     die Wirkung, sondern ueber den NAMEN. Jeder Zielname muss in
     `_zielvokabular.json` mit einer Bedeutung stehen. `session.rest_secons`
     steht dort nicht — und wird rot, obwohl seine Aussage ankommt.

     Was diese Pruefung NICHT behauptet: dass ein eingetragenes Ziel einen
     Anwender hat. Sie beantwortet genau eine Frage: ist der Name gemeint? */
  const repin = (process.env.ORVIA_ZIELVOKABULAR || '').trim();
  const alle = [...BEFUND.bekannteZiele].sort();

  if (!existsSync(VOKABULAR) && repin) {
    const swQ = readFileSync(join(APP, 'sw.js'), 'utf8').match(/const C = 'orvia-(v8-\d+)'/);
    const eintraege = {};
    alle.forEach(z => { eintraege[z] = 'OHNE BEDEUTUNG EINGETRAGEN — bitte nachtragen'; });
    writeFileSync(VOKABULAR, JSON.stringify({ gepruegtAm: repin,
      appVersion: swQ ? swQ[1] : 'unbekannt', ziele: eintraege }, null, 2));
    ok('Zielvokabular AUSDRÜCKLICH neu gesetzt', true, alle.length + ' Namen, ' + repin);
  } else if (!existsSync(VOKABULAR)) {
    ok('jeder Zielname steht im Vokabular', false,
      'VOKABULAR FEHLT (_zielvokabular.json) — ungeprüft. Ein fehlender Beleg ist kein Beleg. '
      + 'Bewusst setzen: ORVIA_ZIELVOKABULAR=JJJJ-MM-TT node supabase/tests/knowledge_targets_test.mjs');
  } else {
    const v = JSON.parse(readFileSync(VOKABULAR, 'utf8'));
    const bekannt = Object.keys(v.ziele || {});
    const fremd = alle.filter(z => !bekannt.includes(z));

    console.log('   ' + alle.length + ' Zielnamen im Bestand · ' + bekannt.length + ' im Vokabular');
    ok('jeder Zielname steht im Vokabular (Tippfehlerbremse)', fremd.length === 0,
      fremd.length
        ? 'UNBEKANNTER ZIELNAME: ' + JSON.stringify(fremd)
          + ' — entweder ein Tippfehler oder ein neues Ziel, das in _zielvokabular.json gehört'
        : 'kein unbekannter Name');
    ok('  … jeder Vokabeleintrag nennt eine Bedeutung',
      bekannt.every(z => typeof v.ziele[z] === 'string' && v.ziele[z].trim().length >= 20),
      'ohne Bedeutung: ' + JSON.stringify(bekannt.filter(z => !(typeof v.ziele[z] === 'string' && v.ziele[z].trim().length >= 20))));
    /* Ein Vokabular, das mitwaechst und nie schrumpft, verliert seinen Wert:
       irgendwann steht jeder denkbare Name drin und faengt nichts mehr. */
    const tot = bekannt.filter(z => !alle.includes(z) && !(PF.GELESENE_ZIELE || []).includes(z));
    ok('  … kein Vokabeleintrag ist verwaist', tot.length === 0,
      tot.length ? 'kommt in keinem Paket und keiner Notiz mehr vor: ' + JSON.stringify(tot) : bekannt.length + ' Einträge, alle in Gebrauch');
  }
}

console.log('\n' + '═'.repeat(62));
console.log('Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
