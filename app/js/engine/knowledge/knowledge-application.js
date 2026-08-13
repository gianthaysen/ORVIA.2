/* ============================================================
   ORVIA · knowledge-application v1 — aus geprüftem Wissen wird eine Vorgabe.

   DER BEFUND, DER ZU DIESEM MODUL FUEHRTE. Nach v8-334 laesst sich Wissen
   einspeisen: eine Notiz wird zu einem vertragskonformen Pack, der Vertrag
   waehlt es im Advisory-Modus aus, die Einordnung stimmt. Gemessen wurde
   danach, wer dieses Pack eigentlich LIEST — und die Antwort war: niemand.
   Der einzige Consumer im Projekt (`running-capacity-factory`) ist fest auf
   das Running-Pack im Shadow-Modus gepinnt. Ein eingespeistes Gym-Pack haette
   am Verhalten der App nichts geaendert. Das Einspeisen waere ein Ritual
   ohne Wirkung geblieben.

   WAS DIESES MODUL TUT. Es nimmt ein Pack samt Register und den zugehoerigen
   Pins, waehlt ueber den Vertrag aus und uebersetzt die ausgewaehlten Regeln
   in konkrete Vorgabewerte — jede mit ihrer Herkunft.

   WAS ES AUSDRUECKLICH NICHT TUT:

   · Es GLAETTET KEINEN WIDERSPRUCH. Sagen zwei Quellen etwas Unterschiedliches
     zum selben Ziel, wird das gemeldet und KEINE Vorgabe erzeugt — es sei
     denn, eine ist nachweislich besser belegt. Heimlich zu mitteln waere die
     bequemste und zugleich falscheste Loesung: aus "Coach A sagt 3 Saetze,
     Coach B sagt 5" wuerde "4 Saetze", eine Zahl, die niemand gesagt hat.

   · Es ERFINDET KEINE ZAHL. Eine Regel ohne quantitatives Paket liefert eine
     qualitative Empfehlung und keinen Wert. Eine Regel, deren Zahl der
     Vertrag nicht freigibt, liefert den GRUND, warum nicht.

   · Es ENTSCHEIDET NICHT UEBER SICHERHEIT. Medizinisch relevante Regeln
     filtert bereits der Vertrag heraus; dieses Modul hebt das nicht auf.

   REIN. Kein DOM, kein Storage, kein Netz, keine eigene Zeitquelle.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'knowledge-application@1';

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* Rangfolge der Evidenzklassen — nur fuer die Frage, ob eine Regel eine
     andere ueberstimmen darf. Gleichstand heisst NICHT „irgendeine gewinnt",
     sondern Konflikt. */
  var RANG = { A: 4, B: 3, C: 2, D: 1 };

  /* ---------- eine Regel → Vorgabe(n) ---------- */
  function _ausRegel(regel, sourcesById, KC) {
    var ziele = Array.isArray(regel.outputs) ? regel.outputs : [];
    if (!ziele.length) return { vorgaben: [], grund: 'ohne_ziel' };

    var offen = KC.disclosureFor(regel, sourcesById);
    var claims = Array.isArray(regel.claims) ? regel.claims.filter(function (c) { return c && c.essential === true; }) : [];
    if (!claims.length) return { vorgaben: [], grund: 'ohne_essenziellen_claim' };

    var out = [];
    for (var z = 0; z < ziele.length; z++) {
      var ziel = ziele[z];
      /* Der erste essenzielle Claim mit freigegebener Zahl bestimmt den Wert.
         Gibt es keinen, bleibt es bei einer qualitativen Empfehlung — das ist
         KEIN Fehler, sondern der Normalfall bei Erfahrungswissen. */
      var mitZahl = null, gesperrt = null;
      for (var i = 0; i < claims.length; i++) {
        var c = claims[i];
        if (c.use !== 'quantitative') continue;
        if (KC.prescriptiveNumberAllowed(c, sourcesById, regel)) { mitZahl = c; break; }
        gesperrt = c;
      }
      var eintrag = {
        ziel: ziel,
        regelId: regel.ruleId,
        aussage: regel.statement || null,
        herkunft: offen,
        /* Der vorsichtige Weg gehoert zur Vorgabe, nicht in eine Fussnote:
           wer die Vorgabe nicht anwenden kann, braucht ihn sofort. */
        wennUnsicher: regel.conservativeFallback || null,
        sicherheitsgrenzen: Array.isArray(regel.safetyLimits) ? regel.safetyLimits.slice() : [],
        giltNichtFuer: Array.isArray(regel.excludedPopulations) ? regel.excludedPopulations.slice() : []
      };
      if (mitZahl) {
        var q = mitZahl.quantitative;
        eintrag.wert = { min: q.validRange.min, max: q.validRange.max };
        eintrag.einheit = q.outputUnits;
        eintrag.unsicherheit = q.uncertaintyRange;
        eintrag.nichtBei = Array.isArray(q.exclusions) ? q.exclusions.slice() : [];
        eintrag.grenzen = q.safetyBounds;
        eintrag.art = 'zahl';
      } else {
        eintrag.wert = null;
        eintrag.art = 'empfehlung';
        /* Wenn eine Zahl DA WAERE, aber nicht freigegeben ist, ist das eine
           Information — sonst sieht es aus, als haette die Quelle nie eine
           genannt. */
        if (gesperrt) eintrag.zahlGesperrt = true;
      }
      out.push(eintrag);
    }
    return { vorgaben: out, grund: null };
  }

  /* Zwei Zahlbereiche sind deckungsgleich, wenn beide Grenzen uebereinstimmen.
     Das ist Bestaetigung, kein Widerspruch. */
  function _gleicherBereich(a, b) {
    if (!a || !b || !a.wert || !b.wert) return false;
    return a.wert.min === b.wert.min && a.wert.max === b.wert.max;
  }

  /* ---------- Konflikte ----------
     Mehrere Regeln auf dasselbe Ziel. Die einzige zulaessige Aufloesung ist
     eine nachweislich BESSERE Evidenzklasse. Bei Gleichstand entsteht KEINE
     Vorgabe — der Widerspruch wird gemeldet, damit ihn jemand entscheidet.

     v8-341 — WAS "WIDERSPRUCH" HEISST, WAR ZU GROB GEFASST.
     Bis hierher galt: zwei gleich stark belegte Regeln zum selben Ziel ⇒
     keine Vorgabe. Gemessen am ersten echten Wissensbestand hiess das:

       RUN-RE-001  "Krafttraining verbessert die Laufoekonomie"     Klasse B
       RUN-RE-002  "Kraftausdauertraining bewirkt nichts"           Klasse B
       beide auf session.exercises  ⇒  Ergebnis: KEINE Vorgabe

     Diese beiden Saetze widersprechen sich nicht. Sie ERGAENZEN sich, und
     sie stammen sogar aus derselben Quelle. Die Regel hat sie trotzdem
     gegenseitig stumm geschaltet — und zwar umso haeufiger, je mehr Wissen
     eingespeist wird. Das ist die falsche Richtung: mehr Quellen mussten zu
     weniger Aussagen fuehren.

     DER FEHLER LAG IN DER GLEICHSETZUNG von "spricht zum selben Ziel" mit
     "sagt etwas Unvereinbares". Unvereinbar koennen nur WERTE sein. Zwei
     Zahlen fuer dieselbe Groesse schliessen sich aus; zwei Beschreibungen
     tun das nicht — sie sind Zusatzinformation, nicht Konkurrenz.

     NEU gilt deshalb, in dieser Reihenfolge:
       1. Qualitative Vorgaben konkurrieren NIE. Sie gehen alle durch.
       2. Eine qualitative und eine quantitative Vorgabe konkurrieren nicht.
          Die Zahl entscheidet, der Satz bleibt als eigene Vorgabe stehen.
       3. Zwei Zahlvorgaben gleicher Klasse mit DECKUNGSGLEICHEM Bereich
          sind Bestaetigung, nicht Widerspruch — die Quellen werden
          zusammengefuehrt (`bestaetigtDurch`).
       4. Zwei Zahlvorgaben gleicher Klasse mit ABWEICHENDEM Bereich bleiben
          ein Konflikt ohne Vorgabe. Das ist der Fall, den niemand
          automatisch entscheiden kann — und der einzige, um den es der
          urspruenglichen Regel je ging.

     Gemittelt wird weiterhin an keiner Stelle. Aus "3 Saetze" und
     "5 Saetze" wird nie "4". */
  function _loeseKonflikte(alle) {
    var nachZiel = {}, reihenfolge = [];
    alle.forEach(function (v) {
      if (!nachZiel[v.ziel]) { nachZiel[v.ziel] = []; reihenfolge.push(v.ziel); }
      nachZiel[v.ziel].push(v);
    });
    var vorgaben = [], konflikte = [];
    reihenfolge.forEach(function (ziel) {
      var liste = nachZiel[ziel];
      if (liste.length === 1) { vorgaben.push(liste[0]); return; }

      /* (1)+(2) Die beiden Arten werden getrennt behandelt. Qualitative
         Vorgaben gehen unangetastet durch — sie stehen nebeneinander, wie
         Anmerkungen es tun. */
      var zahlen = [], qualitativ = [];
      liste.forEach(function (v) { (v.art === 'zahl' ? zahlen : qualitativ).push(v); });
      qualitativ.forEach(function (v) { vorgaben.push(v); });

      if (!zahlen.length) return;
      if (zahlen.length === 1) { vorgaben.push(zahlen[0]); return; }

      var beste = null, besterRang = -1, gleichstand = false;
      zahlen.forEach(function (v) {
        var r = RANG[(v.herkunft && v.herkunft.evidenceClass) || 'D'] || 1;
        if (r > besterRang) { besterRang = r; beste = v; gleichstand = false; }
        else if (r === besterRang) gleichstand = true;
      });

      if (gleichstand) {
        var spitze = zahlen.filter(function (v) {
          return (RANG[(v.herkunft && v.herkunft.evidenceClass) || 'D'] || 1) === besterRang;
        });
        /* (3) Sagen alle gleichrangigen dasselbe, ist das Bestaetigung. Sie
           als Konflikt zu melden hiesse, zwei uebereinstimmende Quellen
           gegeneinander auszuspielen. */
        var einig = spitze.every(function (v) { return _gleicherBereich(v, spitze[0]); });
        if (einig) {
          var g = spitze[0];
          g.bestaetigtDurch = spitze.slice(1).map(function (v) { return v.regelId; });
          vorgaben.push(g);
          return;
        }
        /* (4) Der echte Fall: verschiedene Zahlen, gleich gut belegt. */
        konflikte.push({ ziel: ziel, grund: 'gleichrangig_widersprüchlich',
          regeln: spitze.map(function (v) { return v.regelId; }),
          klasse: (beste.herkunft && beste.herkunft.evidenceClass) || null,
          werte: spitze.map(function (v) { return v.wert || null; }),
          hinweis: 'Mehrere gleich stark belegte Regeln nennen für "' + ziel +
            '" UNTERSCHIEDLICHE Werte. Es wird KEINE Vorgabe erzeugt — entscheide, welche gilt, oder ergänze eine bessere Quelle.' });
        return;
      }
      beste.ueberstimmt = zahlen.filter(function (v) { return v !== beste; }).map(function (v) { return v.regelId; });
      vorgaben.push(beste);
    });
    return { vorgaben: vorgaben, konflikte: konflikte };
  }

  /* Ein einzelnes Paket durch den Vertrag schicken. Gibt entweder
     { ok:false, grund } oder { ok:true, rules, sourcesById, excluded } zurueck. */
  function _einPaket(eintrag, KC) {
    if (!isObj(eintrag) || !isObj(eintrag.pack) || !isObj(eintrag.registry) || !isObj(eintrag.pins)) {
      return { ok: false, grund: 'eingabe_unvollstaendig' };
    }
    var kriterien = {
      mode: 'advisory',
      expectedKnowledgeContractVersion: eintrag.pins.expectedKnowledgeContractVersion,
      expectedKnowledgeVersion: eintrag.pins.expectedKnowledgeVersion,
      expectedPackContentHash: eintrag.pins.expectedPackContentHash,
      expectedSourceRegistryVersion: eintrag.pins.expectedSourceRegistryVersion,
      expectedSourceRegistryHash: eintrag.pins.expectedSourceRegistryHash
    };
    if (eintrag.sport) kriterien.sport = eintrag.sport;

    var sel;
    try { sel = KC.selectRules(eintrag.pack, eintrag.registry, kriterien); }
    catch (e) { return { ok: false, grund: 'auswahl_warf' }; }
    if (!sel || sel.blocked === true || !Array.isArray(sel.rules)) {
      return { ok: false, grund: 'auswahl_blockiert',
        ausgeschlossen: (sel && sel.excluded) || [], fehler: (sel && sel.errors) || [] };
    }
    var reg = KC.validateRegistry(eintrag.registry);
    return { ok: true, rules: sel.rules, sourcesById: reg.sourcesById || {}, excluded: sel.excluded || [] };
  }

  /* ---------- Hauptfunktion ----------
     opts: { pack, registry, pins, sport?, contracts? }
       oder { packs: [{pack, registry, pins, sport?}, …], contracts? }

     MEHRERE PAKETE (v8-340). Bis hierher nahm die Funktion genau EIN Paket —
     und damit war die Einspeisekette faktisch einmal pro Sportart benutzbar.
     Wer fuer "running" eine zweite Quelle einspeiste, stand vor der Wahl,
     das bestehende Paket mit vierzehn handgepflegten Regeln zu ERSETZEN
     (der Schreibweg kennt nur das) oder die neuen Regeln liegen zu lassen.
     Beides ist falsch. Gefunden beim Versuch, Sperlich 2015 zu Laufen
     hinzuzufuegen.

     Der Ausweg ist bewusst NICHT, Pakete zusammenzuschreiben: das kuratierte
     Register und das handgepflegte Pack bleiben unangetastet. Stattdessen
     laeuft JEDES Paket einzeln durch den Vertrag — mit seinen EIGENEN Pins,
     seinem EIGENEN Register — und erst die ausgewaehlten Regeln treffen sich.
     Damit gilt weiterhin: ein Paket mit falschem Hash blockiert sich selbst
     und reisst die anderen nicht mit; und die Konfliktloesung sieht endlich
     alles, was zum selben Ziel spricht, statt nur einen Ausschnitt.

     `pins` sind die UNABHAENGIG hinterlegten Consumer-Konstanten — sie werden
     nie zur Laufzeit aus dem Pack gelesen. Ohne sie blockiert der Vertrag,
     und dieses Modul reicht die Blockade unveraendert durch. */
  function applyKnowledge(opts) {
    opts = isObj(opts) ? opts : {};
    var KC = opts.contracts || O.knowledgeContracts;
    if (!KC || typeof KC.selectRules !== 'function') {
      return { ok: false, grund: 'vertrag_fehlt', vorgaben: [], konflikte: [], ausgeschlossen: [], version: VERSION };
    }

    var liste;
    if (Array.isArray(opts.packs)) {
      /* Eine leere Liste ist keine leere Wissensbasis, sondern ein
         Aufruffehler — sonst saehe "nichts gefunden" aus wie "nichts da". */
      if (!opts.packs.length) {
        return { ok: false, grund: 'keine_pakete', vorgaben: [], konflikte: [], ausgeschlossen: [], version: VERSION };
      }
      liste = opts.packs;
    } else {
      liste = [{ pack: opts.pack, registry: opts.registry, pins: opts.pins, sport: opts.sport }];
    }

    var roh = [], stumm = [], ausgeschlossen = [], geprueft = 0, blockiert = [];
    for (var p = 0; p < liste.length; p++) {
      var e = _einPaket(liste[p], KC);
      if (!e.ok) {
        /* Bei genau einem Paket bleibt das Verhalten unveraendert: der Grund
           wird durchgereicht. Bei mehreren waere ein globaler Abbruch falsch —
           ein defektes Paket darf die uebrigen nicht stumm schalten; es wird
           benannt und uebersprungen. */
        if (liste.length === 1) {
          return { ok: false, grund: e.grund, vorgaben: [], konflikte: [],
            ausgeschlossen: e.ausgeschlossen || [], fehler: e.fehler || [], version: VERSION };
        }
        blockiert.push({ index: p, grund: e.grund,
          packId: (isObj(liste[p]) && isObj(liste[p].pack) && liste[p].pack.packId) || null });
        continue;
      }
      geprueft += e.rules.length;
      ausgeschlossen = ausgeschlossen.concat(e.excluded);
      for (var i = 0; i < e.rules.length; i++) {
        var r = _ausRegel(e.rules[i], e.sourcesById, KC);
        if (r.grund) { stumm.push({ regelId: e.rules[i].ruleId, grund: r.grund }); continue; }
        roh.push.apply(roh, r.vorgaben);
      }
    }

    /* Sind ALLE Pakete blockiert, ist das kein Teilergebnis, sondern ein
       Fehlschlag — sonst laege eine leere, aber "ok" gemeldete Wissensbasis
       vor, und die sieht aus wie "es gibt nichts zu sagen". */
    if (liste.length > 1 && blockiert.length === liste.length) {
      return { ok: false, grund: 'alle_pakete_blockiert', vorgaben: [], konflikte: [],
        ausgeschlossen: ausgeschlossen, blockiertePakete: blockiert, version: VERSION };
    }

    var g = _loeseKonflikte(roh);

    var erg = {
      ok: true,
      vorgaben: g.vorgaben,
      konflikte: g.konflikte,
      /* Was der Vertrag aussortiert hat, bleibt sichtbar: sonst sieht eine
         halb ausgewertete Wissensbasis aus wie eine vollstaendige. */
      ausgeschlossen: ausgeschlossen.concat(stumm.map(function (s) {
        return { ruleId: s.regelId, code: s.grund };
      })),
      geprueft: geprueft,
      version: VERSION
    };
    /* Ein blockiertes Paket unter mehreren darf nicht verschwinden. */
    if (blockiert.length) erg.blockiertePakete = blockiert;
    return erg;
  }

  /* Eine Vorgabe in einem Satz — mit Herkunft, weil der Vertrag sie
     vorschreibt (mustDisplaySource). Wer den Satz anzeigt, zeigt die Quelle
     mit; das laesst sich hier nicht auseinanderdividieren. */
  function vorgabeText(v) {
    if (!isObj(v)) return null;
    var teile = [];
    if (v.art === 'zahl' && v.wert) {
      var spanne = (v.wert.min === v.wert.max) ? String(v.wert.min) : (v.wert.min + '–' + v.wert.max);
      teile.push(spanne + (v.einheit ? (' ' + v.einheit) : ''));
    } else if (v.aussage) {
      teile.push(v.aussage);
    }
    if (!teile.length) return null;
    var basis = (v.herkunft && v.herkunft.basisLabel) || 'unbekannte Basis';
    var klasse = (v.herkunft && v.herkunft.evidenceClass) || '?';
    return teile.join(' ') + ' (' + basis + ', Klasse ' + klasse + ')';
  }

  var api = { VERSION: VERSION, RANG: RANG, applyKnowledge: applyKnowledge, vorgabeText: vorgabeText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.knowledgeApplication = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
