/* ============================================================
   ORVIA · prescription-format v1 — aus einer Verordnung lesbare Zeilen.

   WARUM ES DIESES MODUL GIBT. Die Engine rechnet seit Monaten jeden Tag eine
   vollstaendige Verordnung aus: Aufwaermen, Arbeitsintervalle mit Pace-Fenster,
   Trabpausen, Auslaufen. Auf der Wochenkarte stand davon genau ein Wort und
   eine Zahl — "Tempolauf · 75 min". Der Nutzer sah nie, WAS er laufen soll.
   Dieses Modul macht aus der Verordnung Text. Mehr nicht: es rechnet nichts,
   entscheidet nichts und ergaenzt nichts.

   DIE EINE REGEL. Was nicht in der Verordnung steht, wird NICHT erfunden.
   Fehlt ein Pace-Fenster, steht kein Tempo da — nicht ein geschaetztes.
   Fehlt eine Dauer, steht keine Dauer da. Ein Block, dessen Typ unbekannt ist,
   wird als Warnung gemeldet und NICHT mit einem Sammelbegriff ueberdeckt.
   Diese Regel ist der ganze Grund, warum das Formatieren ein eigenes,
   getestetes Modul ist statt drei Zeilen in der Oberflaeche.

   ABGRENZUNG.
   - Kein DOM, kein Storage, keine Netzwerk- und keine eigene Zeitquelle.
   - Keine Bewertung ("gutes Tempo"), keine Empfehlung, keine Umrechnung in
     andere Einheiten als die, die die Verordnung selbst nennt.
   - Der Rueckgabewert ist DATEN (Zeilen mit Art und Text), kein HTML. Wer
     rendert, entscheidet ueber das Aussehen — nicht dieses Modul.

   ZEILENARTEN (`kind`), damit die Oberflaeche gewichten kann:
     warmup | work | recovery | cooldown | exercise | skill | open | group
   `group` ist eine Wiederholungsgruppe; ihre Kinder haengen in `children`.
   ============================================================ */
(function (root) {
  var O = root.ORVIA = root.ORVIA || {};
  var VERSION = 'prescription-format@1';

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /* ---------- Einheiten ----------
     Alle Formatierer geben null zurueck, wenn der Wert fehlt oder untauglich
     ist. Kein Ersatzwert, keine 0 als Platzhalter. */

  /* Sekunden pro Kilometer als m:ss. 306 -> "5:06". */
  function paceText(secPerKm) {
    var s = num(secPerKm);
    if (s === null || s <= 0) return null;
    var t = Math.round(s);
    var m = Math.floor(t / 60), r = t % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  /* Dauer in Sekunden -> "45 s" / "4 min" / "1:15 h". Krumme Minutenwerte
     bleiben krumm; hier wird nichts auf glatte Zahlen gezogen. */
  function durationText(seconds) {
    var s = num(seconds);
    if (s === null || s <= 0) return null;
    if (s < 90) return Math.round(s) + ' s';
    var min = Math.round(s / 60);
    if (min < 90) return min + ' min';
    var h = Math.floor(min / 60), r = min % 60;
    return h + ':' + (r < 10 ? '0' : '') + r + ' h';
  }
  /* Meter -> "800 m" / "1 km" / "1,5 km". Deutsches Dezimalkomma. */
  function distanceText(meters) {
    var m = num(meters);
    if (m === null || m <= 0) return null;
    if (m < 1000) return Math.round(m) + ' m';
    var km = m / 1000;
    var txt = (Math.round(km * 10) / 10).toString().replace('.', ',');
    return txt + ' km';
  }

  /* ---------- Abbruchbedingung ---------- */
  function completionText(c) {
    if (!isObj(c)) return null;
    if (c.type === 'duration') return durationText(c.value);
    if (c.type === 'distance') {
      /* Einheit ernst nehmen: 'km' bedeutet Kilometer, nicht Meter. */
      var v = num(c.value);
      if (v === null || v <= 0) return null;
      if (c.unit === 'km') return distanceText(v * 1000);
      if (c.unit === 'm' || c.unit == null) return distanceText(v);
      return null;                                   // unbekannte Einheit ⇒ lieber schweigen
    }
    if (c.type === 'reps') {
      var r = num(c.value);
      return (r !== null && r > 0) ? (Math.round(r) + ' Wdh.') : null;
    }
    if (c.type === 'open') return null;              // bewusst offen — kein Text
    return null;
  }

  /* ---------- Ziel ----------
     Wert ODER Bereich, nie beides (der Vertrag verbietet das bereits). */
  function _range(t, fmt, unit) {
    var v = num(t.value), lo = num(t.min), hi = num(t.max);
    var u = unit ? ' ' + unit : '';
    if (v !== null) { var s = fmt(v); return s === null ? null : s + u; }
    if (lo !== null && hi !== null) {
      var a = fmt(lo), b = fmt(hi);
      if (a === null || b === null) return null;
      /* Pace zaehlt rueckwaerts: die groessere Sekundenzahl ist die langsamere
         Grenze. Damit "5:06–5:24" und nicht "5:24–5:06" dasteht, wird nach dem
         formatierten ZAHLENWERT sortiert, nicht nach dem Text. */
      return (lo <= hi ? a + '–' + b : b + '–' + a) + u;
    }
    if (lo !== null) { var x = fmt(lo); return x === null ? null : 'ab ' + x + u; }
    if (hi !== null) { var y = fmt(hi); return y === null ? null : 'bis ' + y + u; }
    return null;
  }
  function targetText(t) {
    if (!isObj(t) || t.type === 'open') return null;
    var whole = function (n) { return String(Math.round(n)); };
    if (t.type === 'pace') { var p = _range(t, paceText, 'min/km'); return p; }
    if (t.type === 'speed') return _range(t, function (n) { return String(Math.round(n * 10) / 10).replace('.', ','); }, 'km/h');
    if (t.type === 'rpe') { var r = _range(t, whole, null); return r === null ? null : 'RPE ' + r; }
    if (t.type === 'rir') { var i = _range(t, whole, null); return i === null ? null : 'RIR ' + i; }
    if (t.type === 'hr') return _range(t, whole, 'bpm');
    if (t.type === 'hr_zone') { var z = _range(t, whole, null); return z === null ? null : 'HF-Zone ' + z; }
    if (t.type === 'power') return _range(t, whole, 'W');
    if (t.type === 'weight') return _range(t, function (n) { return String(Math.round(n * 10) / 10).replace('.', ','); }, 'kg');
    if (t.type === 'cadence') return _range(t, whole, '/min');
    return null;                                     // unbekannter Zieltyp ⇒ schweigen, nicht raten
  }

  /* ---------- Blockbeschriftung ---------- */
  var KIND_LABEL = {
    warmup: 'Aufwärmen', work: 'Belastung', recovery: 'Pause',
    cooldown: 'Auslaufen', skill: 'Technik', open: 'Offen'
  };

  /* Kraftuebung: "4 × 6–8 · 80 kg · RIR 2". Der Anzeigename kommt von aussen
     (nameOf), weil die Uebungsbibliothek nicht Teil dieses Moduls ist. Fehlt
     er, steht die exercise_id da — sichtbar unaufgeloest statt stillschweigend
     "Übung". */
  function exerciseText(b, nameOf) {
    var name = (typeof nameOf === 'function' && nameOf(b.exercise_id)) || b.exercise_id || null;
    var parts = [];
    var sets = num(b.sets);
    var reps = b.repetitions;
    var repTxt = null;
    if (isObj(reps)) {
      var lo = num(reps.min), hi = num(reps.max);
      if (lo !== null && hi !== null) repTxt = (lo === hi) ? String(lo) : (lo + '–' + hi);
      else if (lo !== null) repTxt = String(lo);
      else if (hi !== null) repTxt = String(hi);
    } else if (num(reps) !== null) repTxt = String(Math.round(num(reps)));
    if (sets !== null && repTxt !== null) parts.push(Math.round(sets) + ' × ' + repTxt);
    else if (sets !== null) parts.push(Math.round(sets) + ' Sätze');
    else if (repTxt !== null) parts.push(repTxt + ' Wdh.');
    var tgt = targetText(b.target);
    if (tgt) parts.push(tgt);
    var rest = durationText(b.rest_seconds);
    if (rest) parts.push(rest + ' Pause');
    return { name: name, detail: parts.join(' · ') };
  }

  /* ---------- eine Zeile je Block ---------- */
  function _line(b, nameOf, warnings, path) {
    if (!isObj(b)) { warnings.push({ code: 'block_not_object', at: path }); return null; }

    if (b.type === 'repeat') {
      var it = num(b.iterations);
      if (it === null || it < 1 || Math.floor(it) !== it) {
        warnings.push({ code: 'repeat_iterations_invalid', at: path, got: b.iterations });
        return null;                                 // fail-closed: keine Gruppe ohne gueltige Anzahl
      }
      if (!Array.isArray(b.blocks) || !b.blocks.length) {
        warnings.push({ code: 'repeat_empty', at: path });
        return null;
      }
      var kids = [];
      b.blocks.forEach(function (c, i) {
        var l = _line(c, nameOf, warnings, path + '.' + i);
        if (l) kids.push(l);
      });
      if (!kids.length) return null;
      /* Kurzform in EINER Zeile, wenn alle Kinder einzeilig sind — das ist der
         Regelfall (Intervall + Trabpause) und liest sich als Satz besser als
         eine Aufzaehlung. */
      var inline = kids.map(function (k) { return k.text; }).join(' · ');
      return { kind: 'group', iterations: Math.round(it), children: kids,
        text: Math.round(it) + ' × (' + inline + ')' };
    }

    if (b.type === 'exercise') {
      if (typeof b.exercise_id !== 'string' || !b.exercise_id) {
        warnings.push({ code: 'exercise_without_id', at: path });
        return null;
      }
      var ex = exerciseText(b, nameOf);
      return { kind: 'exercise', exerciseId: b.exercise_id, name: ex.name,
        text: ex.detail ? (ex.name + ' — ' + ex.detail) : ex.name, detail: ex.detail || null };
    }

    if (KIND_LABEL[b.type] === undefined) {
      warnings.push({ code: 'unknown_block_type', at: path, got: b.type });
      return null;                                   // NICHT mit einem Sammelbegriff ueberdecken
    }

    var comp = completionText(b.completion);
    var tgt = targetText(b.target);
    var label = KIND_LABEL[b.type];
    var core = [comp, tgt].filter(Boolean).join(' @ ');
    return { kind: b.type, label: label, completion: comp, target: tgt,
      text: core ? (label + ' ' + core) : label };
  }

  /* ---------- Hauptfunktion ----------
     prescription: das `prescription`-Objekt einer Scheduler-Session
     opts.nameOf:  optionale Auflösung exercise_id -> Anzeigename
     Rueckgabe: { ok, lines[], warnings[], version }
     `ok:false` heisst: es gibt NICHTS Darstellbares — dann zeigt die
     Oberflaeche ihren ehrlichen Leerzustand statt einer halben Wahrheit. */
  function formatPrescription(prescription, opts) {
    opts = isObj(opts) ? opts : {};
    var warnings = [];
    if (!isObj(prescription)) {
      return { ok: false, lines: [], warnings: [{ code: 'prescription_missing' }], version: VERSION };
    }
    var blocks = prescription.blocks;
    if (!Array.isArray(blocks) || !blocks.length) {
      return { ok: false, lines: [], warnings: [{ code: 'blocks_empty' }], version: VERSION };
    }
    var lines = [];
    blocks.forEach(function (b, i) {
      var l = _line(b, opts.nameOf, warnings, String(i));
      if (l) lines.push(l);
    });
    return { ok: lines.length > 0, lines: lines, warnings: warnings, version: VERSION };
  }

  /* Einzeiler fuer die eingeklappte Karte: die Belastungsanteile, ohne
     Aufwaermen und Auslaufen — das ist die Aussage, die den Tag beschreibt.
     Gibt null zurueck, wenn nichts Belastbares dasteht. */
  function summaryLine(prescription, opts) {
    var r = formatPrescription(prescription, opts);
    if (!r.ok) return null;
    var kern = r.lines.filter(function (l) {
      return l.kind === 'group' || l.kind === 'work' || l.kind === 'exercise';
    });
    var quelle = kern.length ? kern : r.lines;
    return quelle.map(function (l) { return l.text; }).join(' · ') || null;
  }

  /* ============================================================
     v8-349 — HINWEISE ALS ZEILEN.

     Die Verordnung liefert seit v8-349 `hinweise`: Wissen, das keine Zahl
     ist und deshalb nicht in einen Block passt — „aus isolierten Krafttests
     laesst sich die Laufleistung nicht vorhersagen", „Altersformeln
     ueberschaetzen die maximale Herzfrequenz".

     Dieselbe Regel wie im ganzen Modul: NICHTS wird ergaenzt. Was der
     Hinweis nicht sagt, steht nicht da. Die Herkunft wird mitgefuehrt, weil
     eine Aussage ohne Quelle in dieser App keine Aussage ist.
     ============================================================ */
  function hinweisZeilen(hinweise) {
    if (!Array.isArray(hinweise) || !hinweise.length) return [];
    var out = [];
    hinweise.forEach(function (h) {
      if (!h || typeof h.aussage !== 'string' || !h.aussage.trim()) return;
      /* v8-351 — BEFUND VOR AUSSAGE, und beides bleibt getrennt.
         Ein Pruefbefund („Quadrizeps 7 Saetze geplant") ist eine Messung an
         DIESER Einheit; die Aussage daneben gehoert der Quelle. Steht der
         Befund oben, liest der Nutzer zuerst, was ihn betrifft — und die
         Quelle darunter als Beleg, nicht als Behauptung ueber seinen Plan.
         Zusammengezogen waeren es ORVIA-Zahlen im Mund einer
         Uebersichtsarbeit von 2007. */
      var hatBefund = (typeof h.befund === 'string' && h.befund.trim().length > 0);
      var zeile = { text: hatBefund ? h.befund.trim() : h.aussage.trim(),
        regelId: h.regelId || null, ziel: h.ziel || null };
      var zusatz = [];
      if (hatBefund) zusatz.push('laut Quelle: ' + h.aussage.trim());
      /* Eine Summe ueber die Haelfte der Uebungen ist keine Summe. Was nicht
         mitgezaehlt wurde, steht an der Zeile — nicht in einer Fussnote und
         erst recht nicht nirgends. */
      if (hatBefund && Array.isArray(h.nichtGezaehlt) && h.nichtGezaehlt.length) {
        zusatz.push('nicht mitgezählt: ' + h.nichtGezaehlt.map(function (u) {
          return (u && (u.name || u.exerciseId)) || 'unbenannte Übung';
        }).join(', '));
      }
      if (h.zahlGesperrt === true) zusatz.push('Zahl vorhanden, aber nicht freigegeben');
      if (Array.isArray(h.giltNichtFuer) && h.giltNichtFuer.length) {
        zusatz.push('gilt nicht für: ' + h.giltNichtFuer.join(', '));
      }
      if (Array.isArray(h.grenzen) && h.grenzen.length) zusatz.push('Grenze: ' + h.grenzen.join('; '));
      if (h.wennUnsicher) zusatz.push('im Zweifel: ' + h.wennUnsicher);
      if (zusatz.length) zeile.zusatz = zusatz;
      if (h.herkunft && (h.herkunft.evidenceClass || h.herkunft.label)) {
        zeile.herkunft = h.herkunft.label || ('Klasse ' + h.herkunft.evidenceClass);
      }
      out.push(zeile);
    });
    return out;
  }

  var api = { VERSION: VERSION, hinweisZeilen: hinweisZeilen,
    paceText: paceText, durationText: durationText, distanceText: distanceText,
    completionText: completionText, targetText: targetText,
    formatPrescription: formatPrescription, summaryLine: summaryLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.prescriptionFormat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
