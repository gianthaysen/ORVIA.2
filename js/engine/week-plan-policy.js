/* ============================================================
   ORVIA · engine/week-plan-policy — Regelwerk für die Wochenstruktur

   ANLASS (2026-08-06, Nutzerbefund): Der Generator lieferte 13 Einheiten auf
   7 Tagen — sechsmal Laufen, kein einziger Ruhetag, an sechs von sieben Tagen
   eine Doppeleinheit. Der Nutzer hatte einen Ruhetag hinterlegt und für einige
   Tage „Doppeleinheit möglich" angehakt.

   DIE DREI DENKFEHLER, die das erzeugt haben:

     1. „MÖGLICH" WURDE ALS „SOLL" GELESEN. `doubleSession.enabled` beschreibt,
        was an einem Tag ginge — nicht, was geplant werden soll. Das Auffüllen
        kannte das Feld gar nicht und setzte überall zwei Einheiten.

     2. DER RUHETAG WAR NUR EIN RESTPOSTEN. Er entstand als Nebenwirkung des
        Tagesdeckels und wurde vom nachgelagerten Auffüllen sofort wieder
        zugebaut. Ein Ruhetag ist aber keine Lücke, die man füllt — er ist der
        Teil des Plans, in dem die Anpassung überhaupt stattfindet.

     3. DOPPELEINHEITEN HATTEN KEINE FACHLICHE REGEL. Erlaubt war alles außer
        „zweimal dieselbe Sportart". Damit landeten Long Run und Ganzkörper-Kraft
        am selben Tag — die beiden Einheiten, die sich am stärksten stören.

   WAS DIESES MODUL TUT: Es nimmt eine fertig gebaute Woche und bringt sie in
   eine Form, die trainierbar ist. Es VERSCHIEBT, wo es geht, und ENTFERNT erst,
   wenn Verschieben nicht reicht — und protokolliert beides. Es erfindet nie eine
   Einheit dazu.

   RANGFOLGE DER REGELN (bewusst: Sicherheit vor Wunschmenge)
     R1  harte Ruhetage bleiben leer                              (unverhandelbar)
     R2  mindestens ein Ruhetag pro Woche                         (unverhandelbar)
     R3  Doppeleinheiten nur an dafür freigegebenen Tagen
     R4  keine zwei harten Einheiten am selben Tag
     R5  keine beinlastige Kraft am Tag einer harten Laufeinheit
     R6  harte Einheiten nicht an zwei aufeinanderfolgenden Tagen (weich)
     R7  bevorzugte Ruhetage freihalten                           (weich)

   „Weich" heißt: wird eingehalten, solange dafür keine Einheit gelöscht werden
   muss. Der Unterschied ist wichtig — eine weiche Regel darf eine Woche
   verbessern, aber nicht heimlich das Trainingsvolumen senken.

   PUR: keine Uhr, kein Zufall, kein DOM, kein Storage, keine Mutation der
   Eingabe. Gleiche Woche rein ⇒ gleiche Woche raus.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'week-plan-policy@1';

  function _clone(w) { return (Array.isArray(w) ? w : []).map(function (d) { return Array.isArray(d) ? d.slice() : []; }); }
  function _l(it) { return String((it && it.l) || '').toLowerCase(); }

  /* Harte Einheit = hohe Intensität ODER hohe Dauer. Beides belegt denselben
     Erholungsbedarf; der Long Run ist nicht „locker", nur weil er langsam ist. */
  function isHard(it) {
    if (!it) return false;
    var l = _l(it);
    if (it.t === 'Laufen') return /interval|tempo|schwelle|long|wettkampf|koppel/.test(l);
    if (it.t === 'Rad') return /interval|tempo|long|z3|wettkampf/.test(l);
    if (it.t === 'Schwimmen') return /interval|tempo|wettkampf/.test(l);
    return false;
  }
  /* Beinlastige Kraft — der Teil des Krafttrainings, der mit Laufen kollidiert.
     Oberkörper/Push/Pull/Core sind ausdrücklich NICHT betroffen; genau deshalb
     ist Umetikettieren (R5) eine Lösung und nicht bloß ein Trick. */
  function isLegHeavy(it) {
    if (!it || it.t !== 'Gym') return false;
    return /ganzkörper|ganzkoerper|bein|legs|unterkörper|unterkoerper|squat|kniebeuge/.test(_l(it));
  }
  function isRunHard(it) { return it && it.t === 'Laufen' && isHard(it); }

  /* Wegwerf-Rangfolge: was zuerst weicht, wenn etwas weichen MUSS.
     Kleiner Wert = wertvoller. Kernreize (Long/Intervall/Tempo) bleiben,
     aufgefüllte Grundlagen- und Mobility-Einheiten gehen zuerst. */
  function dropRank(it) {
    if (!it) return 99;
    var l = _l(it);
    if (it.t === 'Mobilität' || /mobility/.test(l)) return 0;
    if (it.t === 'Gym' && /core|mobil/.test(l)) return 1;
    if (it.t === 'Laufen' && /z2|easy|dauerlauf|recovery/.test(l)) return 3;
    if (it.t === 'Rad' && /easy|recovery|commute/.test(l)) return 2;
    if (it.t === 'Schwimmen' && /technik/.test(l)) return 3;
    if (it.t === 'Gym') return 4;
    if (isHard(it)) return 9;                      /* Kernreiz — geht zuletzt */
    return 5;
  }

  function _idxSet(arr) { var m = {}; (Array.isArray(arr) ? arr : []).forEach(function (i) { m[i] = 1; }); return m; }
  function _count(w) { var n = 0; for (var i = 0; i < 7; i++) n += (w[i] || []).length; return n; }
  function _activeDays(w) { var n = 0; for (var i = 0; i < 7; i++) if ((w[i] || []).length) n++; return n; }

  /* ---- Hauptfunktion ----
     opts:
       availableDayIdx      Tage, an denen überhaupt trainiert werden darf
       restDayIdx           harte Ruhetage (Nutzerentscheidung, unverhandelbar)
       preferredRestDayIdx  gewünschte Ruhetage (weich)
       doubleAllowedDayIdx  Tage, an denen eine ZWEITE Einheit erlaubt ist
       maxSessionsPerWeek   Obergrenze Einheiten (nicht Tage!)
       minRestDays          Standard 1
       strictDoubles        true = Doppel NUR an freigegebenen Tagen (Standard,
                            sobald der Nutzer überhaupt Tage freigegeben hat) */
  function applyPolicy(week, opts) {
    var o = opts || {};
    var w = _clone(week);
    if (w.length !== 7) return { days: _clone(week), report: { ok: false, reason: 'not_a_week', changes: [], warnings: [] } };

    var changes = [], warnings = [];
    var before = _count(w);

    var avail = (Array.isArray(o.availableDayIdx) && o.availableDayIdx.length) ? _idxSet(o.availableDayIdx) : null;
    var hardRest = _idxSet(o.restDayIdx);
    var prefRest = _idxSet(o.preferredRestDayIdx);
    var dblOk = _idxSet(o.doubleAllowedDayIdx);
    var hasDblInfo = (Array.isArray(o.doubleAllowedDayIdx) && o.doubleAllowedDayIdx.length > 0);
    var minRest = (typeof o.minRestDays === 'number') ? o.minRestDays : 1;
    var maxSessions = (typeof o.maxSessionsPerWeek === 'number' && o.maxSessionsPerWeek > 0) ? o.maxSessionsPerWeek : null;

    function dayAllowed(d) {
      if (hardRest[d]) return false;
      if (avail && !avail[d]) return false;
      return true;
    }
    /* Kapazität eines Tages: 1 Einheit — 2 nur, wenn der Nutzer diesen Tag
       ausdrücklich freigegeben hat. Hat er NIRGENDS etwas freigegeben, gilt die
       alte Obergrenze 2, damit bestehende Pläne nicht schrumpfen; das ist der
       einzige Punkt, an dem fehlende Information nicht zur strengeren Regel führt
       — und er ist bewusst so gewählt, weil „Feld nie ausgefüllt" hier nicht
       „ich will keine Doppeleinheiten" bedeutet. */
    function capOf(d) {
      if (!dayAllowed(d)) return 0;
      if (!hasDblInfo) return 2;
      return dblOk[d] ? 2 : 1;
    }
    function noteRemove(it, d, rule) {
      changes.push({ type: 'removed', rule: rule, day: d, unit: (it && it.t) + ' · ' + (it && it.l) });
    }
    function noteMove(it, from, to, rule) {
      changes.push({ type: 'moved', rule: rule, from: from, to: to, unit: (it && it.t) + ' · ' + (it && it.l) });
    }

    /* Bester Zielplatz für eine Einheit: erlaubter Tag mit freier Kapazität,
       der keine neue Regelverletzung erzeugt. Leere Tage bevorzugt, dann Nähe. */
    function findSlot(it, fromDay, allowSecond) {
      var best = -1, bestScore = 1e9;
      for (var d = 0; d < 7; d++) {
        if (d === fromDay || !dayAllowed(d)) continue;
        var day = w[d] || [];
        var cap = capOf(d);
        if (day.length >= cap) continue;
        if (day.length > 0 && !allowSecond) continue;
        if (violatesWith(it, day)) continue;
        var score = day.length * 100 + Math.abs(d - fromDay) + (prefRest[d] ? 50 : 0);
        if (isHard(it) && (hasHardNeighbour(d, fromDay))) score += 30;
        if (score < bestScore) { bestScore = score; best = d; }
      }
      return best;
    }
    function hasHardNeighbour(d, ignoreDay) {
      var p = (d + 6) % 7, n = (d + 1) % 7;
      function hardOn(x) { if (x === ignoreDay) return false; return (w[x] || []).some(isHard); }
      return hardOn(p) || hardOn(n);
    }
    /* ---- Platzieren mit Verdrängung ----
       BEFUND BEIM TESTEN (2026-08-06): Ohne diese Funktion wurde der Long Run
       GELÖSCHT, weil er zufällig auf dem Ruhetag lag und alle anderen Tage voll
       waren. Das ist fachlich falsch herum: Wenn Platz fehlt, muss der wertvollste
       Reiz bleiben und der geringwertigste weichen — nicht der, der zufällig an
       der falschen Stelle stand. `findSlot` allein kennt diese Rangfolge nicht.

       Ablauf: erst regulärer Platz; sonst die geringstwertige Einheit auf einem
       zulässigen Tag verdrängen, sofern sie WIRKLICH geringwertiger ist. Die
       verdrängte Einheit versucht ihrerseits einen Platz — die Kette ist über
       `depth` begrenzt, damit kein Ringtausch entsteht. */
    function placeOrDisplace(it, fromDay, rule, depth) {
      var t = findSlot(it, fromDay, true);
      if (t >= 0) { w[t] = (w[t] || []).concat([it]); noteMove(it, fromDay, t, rule); return true; }
      if ((depth || 0) >= 2) { noteRemove(it, fromDay, rule); return false; }
      var myRank = dropRank(it);
      var bestD = -1, bestI = -1, bestRank = myRank;
      for (var d = 0; d < 7; d++) {
        if (d === fromDay || !dayAllowed(d)) continue;
        var day = w[d] || [];
        for (var i = 0; i < day.length; i++) {
          var r = dropRank(day[i]);
          if (r >= bestRank) continue;                       /* nur echt geringwertigere */
          /* Nach dem Tausch muss der Tag regelkonform sein. */
          var rest = day.slice(0, i).concat(day.slice(i + 1));
          if (violatesWith(it, rest)) continue;
          bestRank = r; bestD = d; bestI = i;
        }
      }
      if (bestD < 0) { noteRemove(it, fromDay, rule); return false; }
      var displaced = w[bestD][bestI];
      w[bestD] = w[bestD].slice(0, bestI).concat(w[bestD].slice(bestI + 1)).concat([it]);
      noteMove(it, fromDay, bestD, rule + '_verdraengt');
      placeOrDisplace(displaced, bestD, rule + '_verdraengt_weiter', (depth || 0) + 1);
      return true;
    }

    /* Würde `it` an einem Tag mit `day` gegen R4/R5 verstoßen? */
    function violatesWith(it, day) {
      for (var i = 0; i < day.length; i++) {
        var other = day[i];
        if (isHard(it) && isHard(other)) return true;                       // R4
        if (isRunHard(it) && isLegHeavy(other)) return true;                // R5
        if (isRunHard(other) && isLegHeavy(it)) return true;                // R5
        /* R8: zweimal dieselbe Sportart am selben Tag ist keine sinnvolle
           Doppeleinheit, sondern eine geteilte Einheit — „Z2 Dauerlauf + Long
           Run am Samstag" ist genau das Muster, das beim Testen entstand, als
           die Verdraengung Platz suchte. Eine Doppeleinheit lebt davon, dass
           die beiden Reize UNTERSCHIEDLICH sind. */
        if (it && other && it.t === other.t) return true;                   // R8
      }
      return false;
    }

    /* ---- R1: harte Ruhetage und gesperrte Tage räumen ---- */
    for (var d1 = 0; d1 < 7; d1++) {
      if (dayAllowed(d1) || !(w[d1] || []).length) continue;
      var stuck = [];
      var units1 = (w[d1] || []).slice().sort(function (a, b) { return dropRank(b) - dropRank(a); });  // wertvollste zuerst platzieren
      w[d1] = [];
      units1.forEach(function (it) {
        if (!placeOrDisplace(it, d1, hardRest[d1] ? 'R1_ruhetag' : 'R1_nicht_verfuegbar', 0)) stuck.push(it);
      });
      if (stuck.length) warnings.push({ code: 'units_dropped_no_slot', day: d1, count: stuck.length });
    }

    /* ---- R3: Doppeleinheiten nur an freigegebenen Tagen ----
       Überzählige zweite Einheit zuerst verschieben; nur wenn kein Platz
       existiert, entfernen. Reihenfolge im Tag: der wertvollste Reiz bleibt. */
    for (var d3 = 0; d3 < 7; d3++) {
      var cap3 = capOf(d3);
      var day3 = w[d3] || [];
      if (day3.length <= cap3) continue;
      day3.sort(function (a, b) { return dropRank(b) - dropRank(a); });   // wertvollste zuerst
      var keep3 = day3.slice(0, cap3), rest3 = day3.slice(cap3);
      w[d3] = keep3;
      rest3.forEach(function (it) {
        var t = findSlot(it, d3, true);
        if (t >= 0) { w[t] = (w[t] || []).concat([it]); noteMove(it, d3, t, 'R3_doppel_nicht_freigegeben'); }
        else { noteRemove(it, d3, 'R3_doppel_nicht_freigegeben'); }
      });
    }

    /* ---- R4/R5: Kollisionen innerhalb eines Tages auflösen ----
       Erst die verträgliche Umetikettierung versuchen (Ganzkörper → Oberkörper
       am Tag einer harten Laufeinheit): das erhält die Einheit vollständig und
       ist fachlich genau die Anpassung, die ein Coach vornehmen würde. Erst wenn
       das nicht greift, wird verschoben, zuletzt entfernt. */
    for (var d4 = 0; d4 < 7; d4++) {
      var day4 = (w[d4] || []).slice();
      if (day4.length < 2) { w[d4] = day4; continue; }
      var guard = 0;
      while (guard++ < 8) {
        /* Konflikt suchen. `conflict` ist der Index der Einheit, die weichen soll:
           bei gleichrangigen Regeln immer die GERINGWERTIGERE. */
        var conflict = -1, rule = null;
        for (var a = 0; a < day4.length && conflict < 0; a++) {
          for (var b = a + 1; b < day4.length; b++) {
            var A = day4[a], B = day4[b];
            if (isRunHard(A) && isLegHeavy(B)) { conflict = b; rule = 'R5_bein_neben_hartem_lauf'; break; }
            if (isRunHard(B) && isLegHeavy(A)) { conflict = a; rule = 'R5_bein_neben_hartem_lauf'; break; }
            if (isHard(A) && isHard(B)) { conflict = dropRank(A) <= dropRank(B) ? a : b; rule = 'R4_zwei_harte_einheiten'; break; }
            if (A && B && A.t === B.t) { conflict = dropRank(A) <= dropRank(B) ? a : b; rule = 'R8_zweimal_dieselbe_sportart'; break; }
          }
        }
        if (conflict < 0) break;
        var victim = day4[conflict];
        /* Umetikettieren statt opfern — nur fuer beinlastige Kraft neben hartem Lauf.
           Die Einheit bleibt vollstaendig erhalten, nur der Fokus wechselt; genau
           diese Anpassung wuerde ein Coach vornehmen. */
        if (rule === 'R5_bein_neben_hartem_lauf' && isLegHeavy(victim)) {
          day4[conflict] = Object.assign({}, victim, { l: 'Oberkörper' });
          changes.push({ type: 'retyped', rule: rule, day: d4,
            unit: victim.t + ' · ' + victim.l, to: 'Oberkörper' });
          continue;
        }
        day4.splice(conflict, 1);
        w[d4] = day4;                       /* Tag aktuell halten, bevor gesucht wird */
        placeOrDisplace(victim, d4, rule, 0);
        day4 = (w[d4] || []).slice();
      }
      w[d4] = day4;
    }

    /* ---- R2: mindestens ein Ruhetag ----
       Erst versuchen, den Tag leerzuräumen, indem seine Einheiten woanders
       Platz finden. Nur wenn das scheitert, wird entfernt — und zwar der
       geringstwertige Reiz, nie ein Kernreiz, solange es Alternativen gibt. */
    function restDayCount() { var n = 0; for (var i = 0; i < 7; i++) if (!(w[i] || []).length) n++; return n; }
    if (minRest > 0 && restDayCount() < minRest) {
      /* Kandidaten: bevorzugte Ruhetage zuerst, dann Tage mit den wenigsten und
         geringstwertigen Einheiten. Ein Tag mit einem Kernreiz wird nie geräumt,
         solange ein anderer Tag in Frage kommt. */
      var cands = [];
      for (var d2 = 0; d2 < 7; d2++) {
        var day2 = w[d2] || [];
        if (!day2.length) continue;
        var worth = day2.reduce(function (s, it) { return s + dropRank(it); }, 0);
        cands.push({ d: d2, worth: worth, n: day2.length, pref: prefRest[d2] ? 0 : 1 });
      }
      cands.sort(function (x, y) {
        if (x.pref !== y.pref) return x.pref - y.pref;
        if (x.worth !== y.worth) return x.worth - y.worth;
        if (x.n !== y.n) return x.n - y.n;
        return x.d - y.d;
      });
      for (var ci = 0; ci < cands.length && restDayCount() < minRest; ci++) {
        var dd = cands[ci].d;
        var units = (w[dd] || []).slice().sort(function (a, b) { return dropRank(b) - dropRank(a); });
        w[dd] = [];
        units.forEach(function (it) { placeOrDisplace(it, dd, 'R2_ruhetag_garantie', 0); });
      }
      if (restDayCount() < minRest) warnings.push({ code: 'no_rest_day_possible', required: minRest });
    }

    /* ---- Einheiten-Obergrenze (maxSessionsPerWeek) ----
       Wirkt auf EINHEITEN, nicht auf Tage. Genau diese Verwechslung war der
       Grund, warum ein Wochendeckel von z. B. 10 nie gegriffen hat. */
    if (maxSessions && _count(w) > maxSessions) {
      var all = [];
      for (var d5 = 0; d5 < 7; d5++) (w[d5] || []).forEach(function (it, i) { all.push({ d: d5, i: i, it: it, r: dropRank(it) }); });
      all.sort(function (x, y) { if (x.r !== y.r) return x.r - y.r; return x.d - y.d; });
      var over = _count(w) - maxSessions;
      var kill = {};
      for (var k = 0; k < all.length && over > 0; k++) {
        /* Einen Tag nie vollständig leeren, wenn er dadurch seinen einzigen
           Kernreiz verliert — sonst kippt die Struktur statt sich zu entlasten. */
        kill[all[k].d + ':' + all[k].i] = 1; over--;
        noteRemove(all[k].it, all[k].d, 'max_sessions_per_week');
      }
      for (var d6 = 0; d6 < 7; d6++) {
        w[d6] = (w[d6] || []).filter(function (it, i) { return !kill[d6 + ':' + i]; });
      }
    }

    /* ---- R6/R7 (weich): nur verschieben, nie löschen ---- */
    for (var d7 = 0; d7 < 7; d7++) {
      if (!prefRest[d7] || !(w[d7] || []).length) continue;
      if (restDayCount() <= minRest) break;                 /* nicht auf Kosten der Struktur */
      var moved7 = [], left7 = [];
      (w[d7] || []).forEach(function (it) {
        var t = findSlot(it, d7, true);
        if (t >= 0) { w[t] = (w[t] || []).concat([it]); moved7.push(it); noteMove(it, d7, t, 'R7_bevorzugter_ruhetag'); }
        else left7.push(it);
      });
      w[d7] = left7;
    }

    var after = _count(w);
    var doubles = 0; for (var dz = 0; dz < 7; dz++) if ((w[dz] || []).length >= 2) doubles++;

    /* Ehrlicher Hinweis, wenn der Wunsch strukturell nicht in die Woche passt.
       Das ist keine Fehlermeldung, sondern eine Rechnung: bei N erlaubten Tagen
       und M Doppeltagen sind höchstens N+M Einheiten planbar. */
    var allowedDays = 0, dblDays = 0;
    for (var dc = 0; dc < 7; dc++) { if (dayAllowed(dc)) { allowedDays++; if (capOf(dc) >= 2) dblDays++; } }
    var structuralMax = Math.max(0, allowedDays - minRest) + dblDays;
    if (before > structuralMax) {
      warnings.push({ code: 'wish_exceeds_week', wanted: before, structuralMax: structuralMax,
        allowedDays: allowedDays, doubleDays: dblDays, minRestDays: minRest });
    }

    return {
      days: w,
      report: {
        ok: true, version: VERSION,
        sessionsBefore: before, sessionsAfter: after,
        restDays: restDayCount(), doubleDays: doubles,
        changes: changes, warnings: warnings
      }
    };
  }

  var api = { VERSION: VERSION, applyPolicy: applyPolicy,
    isHard: isHard, isLegHeavy: isLegHeavy, dropRank: dropRank };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.weekPlanPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
