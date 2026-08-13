/* ============================================================
   ORVIA · engine/week-plan-designer — die Woche wird KONSTRUIERT, nicht repariert

   WARUM ES DIESES MODUL GIBT (2026-08-06, zweiter Nutzerbefund):
   Der erste Anlauf war ein Regelwerk, das eine fertig gefüllte Woche nachträglich
   entschärft (week-plan-policy). Das Ergebnis war weiterhin fachlich schwach:
   Laufen an Mo/Di/So — also drei Lauftage in Folge über den Wochenwechsel —,
   Tempo und Intervalle zu dicht beieinander, Long Run direkt neben einem
   Belastungstag. Eine nachgelagerte Reparatur kann das gar nicht finden: Sie
   prüft einzelne TAGE. Der Fehler liegt aber im RHYTHMUS der Woche.

   Der richtige Weg ist der, den ein Coach geht — und zwar in dieser Reihenfolge:

     1. ZUERST die Kernreize setzen (Long Run, Intervalle, Tempo/Schwelle) und
        zwar mit dem größtmöglichen Abstand zueinander. Alles andere ordnet sich
        diesen drei Terminen unter, nie umgekehrt.
     2. DANN die lockere Grundlage in die Lücken, ohne Ketten aus Lauftagen.
     3. DANN die Nebensportarten, bevorzugt an Tagen ohne Laufbelastung.
     4. ZULETZT das Krafttraining — beinlastig nur dort, wo es keinen Kernreiz
        stört, weder am selben Tag noch am Tag DAVOR.

   DIE WOCHE IST EIN RING, KEINE LINIE. Sonntag → Montag ist ein echter Übergang.
   Genau dieser Fehler stand im Befund: Long Run am Sonntag, Lauf am Montag,
   Lauf am Dienstag. Jede Abstandsrechnung hier ist deshalb zyklisch (mod 7).

   HARTE ABSTANDSREGELN (die Zahlen sind der Grund, warum das Modul existiert):
     • zwischen zwei Kernreizen mindestens 48 h — also mindestens ein Tag dazwischen
     • nie drei Lauftage in Folge
     • kein beinlastiges Krafttraining am Tag eines Kernreizes ODER am Tag davor
     • Tag nach dem Long Run: locker oder frei, nie ein zweiter Kernreiz

   OPTIMAL STATT HEURISTISCH: Bei höchstens sieben Tagen und wenigen Kernreizen
   ist die Zahl der Möglichkeiten winzig (C(7,3) = 35). Das Modul probiert
   deshalb ALLE zulässigen Kombinationen durch und nimmt die beste — kein Raten,
   keine Reihenfolgeabhängigkeit, reproduzierbar. Eine Heuristik hätte genau die
   Ketten erzeugt, die hier verhindert werden sollen.

   PUR: keine Uhr, kein Zufall, kein DOM, kein Storage. Gleiche Eingabe ⇒
   byte-gleiche Woche.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'week-plan-designer@1';

  function _l(it) { return String((it && it.l) || '').toLowerCase(); }
  function _clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }

  /* ---- Klassifikation ---- */
  function isRun(it) { return !!it && it.t === 'Laufen'; }
  function isHard(it) {
    if (!it) return false;
    var l = _l(it);
    if (it.t === 'Laufen') return /interval|tempo|schwelle|long|wettkampf|koppel/.test(l);
    if (it.t === 'Rad') return /interval|tempo|long|z3|wettkampf/.test(l);
    if (it.t === 'Schwimmen') return /interval|tempo|wettkampf/.test(l);
    return false;
  }
  function isLong(it) { return !!it && /long/.test(_l(it)); }
  function isLegHeavy(it) {
    if (!it || it.t !== 'Gym') return false;
    return /ganzkörper|ganzkoerper|bein|legs|unterkörper|unterkoerper|squat|kniebeuge/.test(_l(it));
  }
  /* Wertigkeit: was zuerst platziert wird und zuletzt weicht. */
  function rank(it) {
    if (isLong(it)) return 0;
    if (isHard(it)) return 1;
    if (it && it.t === 'Gym' && !isLegHeavy(it)) return 4;
    if (it && it.t === 'Gym') return 3;
    if (isRun(it)) return 2;
    return 5;
  }

  /* Zyklischer Abstand zweier Wochentage (0=Mo … 6=So): So↔Mo ist 1, nicht 6. */
  function cycDist(a, b) { var d = Math.abs(a - b) % 7; return Math.min(d, 7 - d); }

  /* ---- Kombinationen k aus Liste ---- */
  function combos(list, k) {
    var out = [];
    (function rec(start, acc) {
      if (acc.length === k) { out.push(acc.slice()); return; }
      for (var i = start; i < list.length; i++) { acc.push(list[i]); rec(i + 1, acc); acc.pop(); }
    })(0, []);
    return out;
  }

  /* ============================================================
     designWeek(units, opts)

     units  Liste der zu platzierenden Einheiten ({t, l, d, …}) — WAS trainiert
            wird, entscheidet der Aufrufer. Dieses Modul entscheidet nur WANN.
     opts   availableDayIdx, restDayIdx, preferredRestDayIdx,
            doubleAllowedDayIdx, maxSessionsPerWeek, minRestDays,
            longRunPreferredDays (Standard: Sa, So — mehr Zeit am Wochenende)

     Rückgabe {days:[7][], report:{placed, unplaced[], reasons, quality}}
     ============================================================ */
  function designWeek(units, opts) {
    var o = opts || {};
    var list = (Array.isArray(units) ? units : []).filter(function (u) { return u && u.t; }).map(_clone);
    var w = [[], [], [], [], [], [], []];
    var unplaced = [], notes = [];
    var LP = O.loadProfile || null;

    var minRest = (typeof o.minRestDays === 'number') ? o.minRestDays : 1;
    var maxSessions = (typeof o.maxSessionsPerWeek === 'number' && o.maxSessionsPerWeek > 0) ? o.maxSessionsPerWeek : null;
    var hardRest = {}; (o.restDayIdx || []).forEach(function (i) { hardRest[i] = 1; });
    var prefRest = {}; (o.preferredRestDayIdx || []).forEach(function (i) { prefRest[i] = 1; });
    var dblOk = {}; (o.doubleAllowedDayIdx || []).forEach(function (i) { dblOk[i] = 1; });
    var hasDblInfo = !!(o.doubleAllowedDayIdx && o.doubleAllowedDayIdx.length);
    var availSet = null;
    if (Array.isArray(o.availableDayIdx) && o.availableDayIdx.length) {
      availSet = {}; o.availableDayIdx.forEach(function (i) { availSet[i] = 1; });
    }
    var longPref = Array.isArray(o.longRunPreferredDays) ? o.longRunPreferredDays : [5, 6];
    /* Obergrenze fuer Doppeltage. Hat der Nutzer Tage ausdruecklich freigegeben,
       gilt seine Angabe. Hat er NICHTS angegeben, waeren sonst plötzlich fuenf
       Doppeltage moeglich — dieselbe Verwechslung von „moeglich" mit „soll", nur
       eine Ebene hoeher. Ohne Angabe daher hoechstens zwei. */
    var _trainDaysGuess = Math.max(1, (function () { var n = 0; for (var i = 0; i < 7; i++) if (!hardRest[i] && (!availSet || availSet[i])) n++; return n; })() - minRest);
    var maxDoubleDays = (typeof o.maxDoubleDays === 'number') ? o.maxDoubleDays
      : (hasDblInfo ? o.doubleAllowedDayIdx.length
        /* Ohne Angabe zurueckhaltend (2) — ABER eine ausdrueckliche Wunschzahl
           darf nicht an dieser Vorsicht scheitern: Wer 10 Einheiten auf 6 Tagen
           will, hat die Doppeleinheiten implizit mitbestellt. Sonst wuerde hier
           genau der Fehler wiederholt, den dieses Modul beheben soll — eine
           ausdrueckliche Nutzerangabe zu ignorieren. */
        : Math.min(_trainDaysGuess, Math.max(2, (Array.isArray(units) ? units.length : 0) - _trainDaysGuess)));

    function allowed(d) { return !hardRest[d] && (!availSet || availSet[d]); }
    function doubleDaysUsed() { var n = 0; for (var i = 0; i < 7; i++) if ((w[i] || []).length >= 2) n++; return n; }
    function cap(d) {
      if (!allowed(d)) return 0;
      if (hasDblInfo && !dblOk[d]) return 1;
      /* Ein zweiter Platz nur, solange das Wochenlimit fuer Doppeltage nicht
         erreicht ist — ausser dieser Tag ist bereits ein Doppeltag. */
      if ((w[d] || []).length >= 2) return 2;
      if (doubleDaysUsed() >= maxDoubleDays) return 1;
      return 2;
    }
    /* Kapazitaetsrechnung ohne laufenden Zustand (fuer Phase 0). */
    function capStatic(d) { if (!allowed(d)) return 0; return (!hasDblInfo || dblOk[d]) ? 2 : 1; }

    var days = []; for (var i0 = 0; i0 < 7; i0++) if (allowed(i0)) days.push(i0);
    if (!days.length) return { days: w, report: { ok: false, reason: 'no_available_day', placed: 0, unplaced: list, quality: null } };

    /* Wie viele Tage müssen frei bleiben? Der Ruhetag wird VOR der Platzierung
       reserviert, nicht hinterher freigeräumt — das war der Kernfehler zuvor. */
    var trainableCount = Math.max(1, days.length - minRest);

    /* ============================================================
       PHASE 0 · Nachfrage an die Woche anpassen — VOR der Platzierung.

       BEFUND BEIM BAUEN (2026-08-06): Ohne diesen Schritt wurde einfach so lange
       platziert, bis kein Platz mehr war — mit dem Ergebnis, dass von vier
       gewünschten Krafteinheiten KEINE übrig blieb, weil Rad und Schwimmen die
       letzten Plätze zuerst belegt hatten. Wer zuerst kommt, mahlt zuerst, ist
       keine Trainingsplanung.

       Zwei Regeln greifen hier, beide sind Standard in der Trainingslehre:

       (a) POLARISIERUNG. Der Anteil harter Einheiten wächst nicht mit dem
           Wunsch, sondern mit dem Umfang. Drei Kernreize bei fünf Trainingstagen
           sind kein ambitionierter Plan, sondern ein Ermüdungsplan — die lockere
           Grundlage, aus der die Anpassung entsteht, fehlt dann schlicht.
             bis 4 Einheiten → 1 Kernreiz
             5 bis 7         → 2
             8 bis 10        → 3
             ab 11           → 4

       (b) ANTEILIGE KÜRZUNG. Passt der Wunsch nicht in die Woche, wird über ALLE
           Sportarten anteilig gekürzt und nicht eine ganze Sportart geopfert.
           Jede gewünschte Sportart behält mindestens eine Einheit, solange
           Kapazität da ist — eine Sportart, die im Plan gar nicht vorkommt,
           verschwindet sonst still aus dem Training.
       ============================================================ */
    /* Der reservierte Ruhetag zählt nicht zur Kapazität, und die Zahl der
       Doppeltage ist gedeckelt: Kapazität = Trainingstage + erlaubte Doppeltage. */
    var restBudget = Math.max(0, minRest);
    var trainDays = Math.max(1, days.length - restBudget);
    var dblCandidates = days.filter(function (d) { return capStatic(d) >= 2; }).length;
    var capacity = Math.max(1, trainDays + Math.min(maxDoubleDays, dblCandidates, trainDays));

    function maxHardFor(n) { return n <= 4 ? 1 : n <= 7 ? 2 : n <= 10 ? 3 : 4; }

    var demandReport = null;
    if (list.length > capacity || list.filter(isHard).length > maxHardFor(Math.min(list.length, capacity))) {
      var target = Math.min(list.length, capacity);
      var maxHard = maxHardFor(target);
      /* Nach Sportart gruppieren, in jeder Gruppe die wertvollsten zuerst. */
      var bySport = {};
      list.forEach(function (u) { (bySport[u.t] = bySport[u.t] || []).push(u); });
      Object.keys(bySport).forEach(function (k) { bySport[k].sort(function (a, b) { return rank(a) - rank(b); }); });
      var sports = Object.keys(bySport).sort();
      /* Anteilig zuteilen, jede Sportart mindestens eine Einheit. */
      var quota = {}, assigned = 0;
      sports.forEach(function (k) { quota[k] = 1; assigned++; });
      while (assigned < target) {
        var pickK = null, bestRatio = -1;
        sports.forEach(function (k) {
          if (quota[k] >= bySport[k].length) return;
          var ratio = (bySport[k].length - quota[k]) / bySport[k].length;
          if (ratio > bestRatio) { bestRatio = ratio; pickK = k; }
        });
        if (!pickK) break;
        quota[pickK]++; assigned++;
      }
      var kept = [], hardKept = 0, dropped = [];
      sports.forEach(function (k) {
        bySport[k].forEach(function (u, i) {
          if (i >= quota[k]) { dropped.push({ unit: u, reason: 'anteilige_kuerzung' }); return; }
          if (isHard(u)) {
            if (hardKept >= maxHard) {
              /* Statt zu streichen: als lockere Grundlage derselben Sportart
                 behalten — der Trainingstag bleibt, nur die Intensität fällt weg. */
              var soft = Object.assign({}, u, u.t === 'Laufen' ? { l: 'Z2 Dauerlauf', d: 'ez' } : { l: 'Easy Z2' });
              kept.push(soft);
              notes.push({ code: 'polarisierung', unit: u.t + ' · ' + u.l,
                detail: 'Bei ' + target + ' Einheiten sind höchstens ' + maxHard + ' harte Reize sinnvoll — als lockere Einheit eingeplant.' });
              return;
            }
            hardKept++;
          }
          kept.push(u);
        });
      });
      dropped.forEach(function (d) { unplaced.push(d); });
      demandReport = { wanted: list.length, capacity: capacity, planned: kept.length,
        maxHard: maxHard, quota: quota };
      list = kept;
    }

    /* ---- Sortierung: Kernreize zuerst ---- */
    var hard = list.filter(isHard).sort(function (a, b) { return rank(a) - rank(b); });
    var easyRun = list.filter(function (u) { return isRun(u) && !isHard(u); });
    var gymLeg = list.filter(isLegHeavy);
    var gymUpper = list.filter(function (u) { return u.t === 'Gym' && !isLegHeavy(u); });
    var other = list.filter(function (u) { return !isHard(u) && !isRun(u) && u.t !== 'Gym'; });

    /* ============================================================
       PHASE A · Kernreize maximal weit auseinander
       Erschöpfende Suche: jede zulässige Tageskombination wird bewertet, die
       beste gewinnt. Bewertet wird nach dem KLEINSTEN Abstand im Ring — eine
       Woche ist so gut wie ihr engster Übergang.
       ============================================================ */
    var restReserve = [];
    /* Bevorzugte Ruhetage schon hier aus dem Angebot nehmen, solange danach
       genug Tage bleiben — sonst konkurriert der Wunsch später mit der Struktur. */
    var poolDays = days.slice();
    if (minRest > 0) {
      var wanted = poolDays.filter(function (d) { return prefRest[d]; });
      wanted.forEach(function (d) {
        if (poolDays.length - 1 >= trainableCount) {
          poolDays = poolDays.filter(function (x) { return x !== d; });
          restReserve.push(d);
        }
      });
    }
    /* Reicht der Pool nicht für alle Einheiten, bleibt er trotzdem so groß wie
       nötig — der Ruhetag ist gesetzt, die Menge passt sich an, nicht die Ruhe. */

    var hardDays = [];
    if (hard.length) {
      var k = Math.min(hard.length, poolDays.length);
      var best = null, bestScore = -1e9;
      combos(poolDays, k).forEach(function (c) {
        var s = scoreHardDays(c, hard, longPref, prefRest);
        if (s > bestScore) { bestScore = s; best = c; }
      });
      hardDays = best || [];
      /* Zuordnung Kernreiz → Tag: Long Run auf den bevorzugten Tag, die übrigen
         so, dass die Reihenfolge im Ring dem natürlichen Rhythmus folgt. */
      var assign = assignHard(hard, hardDays, longPref);
      assign.forEach(function (a) { w[a.day].push(a.unit); });
      if (hard.length > k) {
        hard.slice(k).forEach(function (u) { unplaced.push({ unit: u, reason: 'zu_viele_kernreize_fuer_die_woche' }); });
      }
      var mg = minGapOf(hardDays);
      if (hardDays.length > 1 && mg < 2) {
        notes.push({ code: 'kernreize_eng', minGapDays: mg,
          detail: 'Bei ' + hardDays.length + ' Kernreizen und ' + poolDays.length + ' Trainingstagen sind 48 h Abstand nicht überall möglich.' });
      }
    }

    /* Helfer für die Folgephasen ---------------------------------- */
    function dayHasHard(d) { return (w[d] || []).some(isHard); }
    function runDaysSet() { var m = {}; for (var d = 0; d < 7; d++) if ((w[d] || []).some(isRun)) m[d] = 1; return m; }
    /* Drei Lauftage in Folge (zyklisch) verhindern. */
    function wouldMakeRunChain(d) {
      var m = runDaysSet(); m[d] = 1;
      for (var s = 0; s < 7; s++) {
        if (m[s] && m[(s + 1) % 7] && m[(s + 2) % 7]) return true;
      }
      return false;
    }
    function fits(u, d, allowSecond) {
      if (!allowed(d)) return false;
      var day = w[d] || [];
      if (day.length >= cap(d)) return false;
      if (day.length > 0 && !allowSecond) return false;
      for (var i = 0; i < day.length; i++) {
        var other2 = day[i];
        if (isHard(u) && isHard(other2)) return false;                        // nie zwei Kernreize
        if (u.t === other2.t) return false;                                   // nie zweimal dieselbe Sportart
        /* MUSKELEBENE (2026-08-06): Der eigentliche Test. Sportart-Namen sagen
           nichts darueber, was belastet wird — Rudern und Rueckentraining teilen
           sich den Latissimus, Fussball und Beintraining die Streckerkette.
           Diese eine Pruefung ersetzt alle Sonderfaelle. */
        if (LP && LP.conflictBetween(u, other2, 0).conflict) return false;
      }
      /* Und ueber Nacht: eine stark beanspruchte Gruppe braucht ihre Erholung,
         egal aus welcher Sportart die Belastung kam. Zyklisch — So grenzt an Mo. */
      if (LP) {
        var prevDay = w[(d + 6) % 7] || [], nextDay = w[(d + 1) % 7] || [];
        for (var pi = 0; pi < prevDay.length; pi++) if (LP.conflictBetween(prevDay[pi], u, 24).conflict) return false;
        for (var ni = 0; ni < nextDay.length; ni++) if (LP.conflictBetween(u, nextDay[ni], 24).conflict) return false;
      }
      if (isRun(u) && wouldMakeRunChain(d)) return false;                     // keine Dreierkette
      /* Beinlastige Kraft: nicht am Tag eines Kernreizes und nicht am Tag DAVOR.
         Der Tag davor zählt, weil die Vorermüdung genau die Einheit entwertet,
         für die man den Kernreiz geplant hat. */
      if (isLegHeavy(u)) {
        if (dayHasHard(d)) return false;
        if (dayHasHard((d + 1) % 7)) return false;
      }
      return true;
    }
    function freeDaysLeft() {
      var free = 0; for (var d = 0; d < 7; d++) if (allowed(d) && !(w[d] || []).length) free++;
      return free;
    }
    /* Belegen ist nur erlaubt, solange danach noch genug Ruhetage übrig bleiben. */
    function mayOccupyNewDay() { return freeDaysLeft() > minRest; }

    /* Platzieren in zwei Durchgaengen.

       BEFUND (2026-08-06): Mit der Muskelebene allein als HARTER Bedingung fielen
       Einheiten aus dem Plan — bei zehn gewuenschten Einheiten blieben sieben
       uebrig, weil fuer den Rest keine vollstaendig kollisionsfreie Stelle
       existierte. Das ist die falsche Antwort: Der Nutzer hat die Einheiten
       ausdruecklich gewuenscht, und ein Coach sagt in so einer Lage nicht „faellt
       aus", sondern „eng, aber so herum am besten".

       Deshalb: erst streng (keine Kollision), und nur wenn das nirgends geht, ein
       zweiter Durchgang mit der am wenigsten schlechten Stelle — mit Notiz, damit
       die Einschraenkung sichtbar bleibt statt still zu passieren. */
    function place(u, prefer, strictOnly) {
      var strict = [], loose = [];
      for (var d = 0; d < 7; d++) {
        var empty = !(w[d] || []).length;
        if (empty && !mayOccupyNewDay()) continue;
        if (!hasRoom(u, d)) continue;
        var sc = prefer(d, empty);
        if (fits(u, d, true)) strict.push({ d: d, score: sc });
        else loose.push({ d: d, score: sc - conflictCost(u, d) * 100 });
      }
      var pool = strict.length ? strict : (strictOnly ? [] : loose);
      if (!pool.length) return false;
      pool.sort(function (a, b) { return b.score - a.score || a.d - b.d; });
      w[pool[0].d].push(u);
      if (!strict.length) {
        notes.push({ code: 'enge_woche', unit: u.t + ' · ' + u.l, day: pool[0].d,
          detail: 'Keine vollständig konfliktfreie Stelle — bestmögliche Position gewählt.' });
      }
      return true;
    }
    /* Reine Kapazitaets- und Grundpruefung, ohne Muskelebene. */
    function hasRoom(u, d) {
      if (!allowed(d)) return false;
      var day = w[d] || [];
      if (day.length >= cap(d)) return false;
      for (var i = 0; i < day.length; i++) {
        if (isHard(u) && isHard(day[i])) return false;      // zwei Kernreize bleiben ausgeschlossen
        if (u.t === day[i].t) return false;                  // zweimal dieselbe Sportart bleibt ausgeschlossen
      }
      /* UNVERHANDELBAR bleibt auch die Kettenregel. Sie im Lockerungs-Durchgang
         mit aufzuweichen war ein Fehler beim Bauen: Es entstanden wieder vier
         Lauftage in Folge — also genau der Befund, der dieses Modul ausgeloest
         hat. Weich darf nur die MUSKELEBENE sein, nie der Wochenrhythmus. */
      if (isRun(u) && wouldMakeRunChain(d)) return false;
      return true;
    }
    /* Wie teuer waere diese Stelle? Summe der Kollisionsschwere am Tag und zu
       den Nachbartagen — je hoeher, desto spaeter wird sie gewaehlt. */
    function conflictCost(u, d) {
      if (!LP) return 0;
      var c = 0;
      (w[d] || []).forEach(function (o2) { var r2 = LP.conflictBetween(u, o2, 0); if (r2.conflict) c += r2.severity + 1; });
      (w[(d + 6) % 7] || []).forEach(function (o2) { var r2 = LP.conflictBetween(o2, u, 24); if (r2.conflict) c += r2.severity * .5 + .5; });
      (w[(d + 1) % 7] || []).forEach(function (o2) { var r2 = LP.conflictBetween(u, o2, 24); if (r2.conflict) c += r2.severity * .5 + .5; });
      if (isLegHeavy(u) && (dayHasHard(d) || dayHasHard((d + 1) % 7))) c += 2;
      if (isRun(u) && wouldMakeRunChain(d)) c += 3;
      return c;
    }

    /* ============================================================
       PHASE B · Beinlastiges Krafttraining ZUERST unter den Nebeneinheiten

       BEFUND BEIM BAUEN: Ursprünglich stand Kraft am Ende — mit dem Ergebnis,
       dass Rad und Schwimmen die wenigen freien Tage belegten und BEIDE
       Krafteinheiten mangels Abstand zu einem Kernreiz auf Oberkörper
       heruntergestuft wurden. Beinlastige Kraft hat die meisten Einschränkungen
       (nicht am Kernreiztag, nicht am Tag davor) und gehört deshalb nach vorn:
       wer am wenigsten Auswahl hat, wählt zuerst. Rad und Schwimmen passen
       danach fast überall hin.
       ============================================================ */
    gymLeg.forEach(function (u) {
      var scoreLeg = function (d, empty) {
        var s = 0;
        /* möglichst weit weg vom nächsten Kernreiz — Beine brauchen den Abstand */
        var dist = 9; for (var h = 0; h < 7; h++) if (dayHasHard(h)) dist = Math.min(dist, cycDist(d, h));
        s += dist * 8;
        if (empty) s += 3;
        if (prefRest[d]) s -= 40;
        return s;
      };
      /* Zuerst NUR konfliktfreie Plaetze. Erst wenn es keinen gibt, die
         Oberkoerper-Variante versuchen — und erst danach eine enge Loesung.
         Andersherum entstuenden zwei Ganzkoerper-Einheiten an Folgetagen,
         obwohl ein Wechsel auf Oberkoerper das sauber loest. */
      var ok5 = place(u, scoreLeg, true);
      if (!ok5) {
        /* Statt zu verwerfen: als Oberkörper platzieren — der Trainingsreiz
           bleibt erhalten, nur der Fokus wandert weg von den Beinen. */
        var altScore = function (d, empty) { return (dayHasHard(d) ? 6 : 0) + (empty ? 0 : 5) + (prefRest[d] ? -40 : 0); };
        var alt = Object.assign({}, u, { l: 'Oberkörper' });
        if (place(alt, altScore, true)) {
          notes.push({ code: 'bein_zu_oberkoerper', unit: u.t + ' · ' + u.l,
            detail: 'Kein Tag mit ausreichendem Abstand zu einem Kernreiz — als Oberkörper eingeplant statt gestrichen.' });
        } else if (place(u, scoreLeg)) {
          /* Enge Woche: bewusst die am wenigsten schlechte Stelle, mit Notiz. */
        } else {
          unplaced.push({ unit: u, reason: 'kein_tag_mit_abstand_zum_kernreiz' });
        }
      }
    });

    /* ============================================================
       PHASE C · Lockere Läufe — Abstand zu den Kernreizen, keine Ketten
       ============================================================ */
    easyRun.forEach(function (u) {
      var ok2 = place(u, function (d, empty) {
        var s = 0;
        /* möglichst weit weg vom nächsten Kernreiz */
        var dist = 9; for (var h = 0; h < 7; h++) if (dayHasHard(h)) dist = Math.min(dist, cycDist(d, h));
        s += dist * 10;
        /* der Tag NACH einem Kernreiz ist Regenerationstag — locker ist ok,
           aber nachrangig; der Tag DAVOR soll frei von Zusatzlast bleiben */
        if (dayHasHard((d + 6) % 7)) s -= 6;
        if (dayHasHard((d + 1) % 7)) s -= 10;
        if (empty) s += 8;                       /* eigener Tag vor Doppeleinheit */
        if (prefRest[d]) s -= 40;
        return s;
      });
      if (!ok2) unplaced.push({ unit: u, reason: 'kein_tag_ohne_laufkette_oder_kapazitaet' });
    });

    /* ============================================================
       PHASE D · Rad / Schwimmen — bevorzugt an Tagen ohne Lauf
       ============================================================ */
    other.forEach(function (u) {
      var ok3 = place(u, function (d, empty) {
        var s = 0;
        if (!(w[d] || []).some(isRun)) s += 12;                 /* Belastung streuen */
        if (dayHasHard(d)) s -= 8;
        if (dayHasHard((d + 1) % 7)) s -= 6;                    /* Tag vor Kernreiz locker halten */
        if (empty) s += 4;
        if (prefRest[d]) s -= 40;
        return s;
      });
      if (!ok3) unplaced.push({ unit: u, reason: 'keine_kapazitaet' });
    });

    /* ============================================================
       PHASE E · Oberkörper-Kraft — passt fast überall, blockiert nichts
       Oberkörper zuerst: er passt fast überall und blockiert nichts.
       ============================================================ */
    gymUpper.forEach(function (u) {
      var ok4 = place(u, function (d, empty) {
        var s = 0;
        if (dayHasHard(d)) s += 6;              /* harte Tage bündeln: harter Tag hart, lockerer Tag locker */
        if (!empty) s += 5;                     /* gern als zweite Einheit */
        if (prefRest[d]) s -= 40;
        return s;
      });
      if (!ok4) unplaced.push({ unit: u, reason: 'keine_kapazitaet' });
    });
    /* ---- Wochendeckel auf EINHEITEN ---- */
    if (maxSessions) {
      var total = 0; for (var dc = 0; dc < 7; dc++) total += w[dc].length;
      while (total > maxSessions) {
        var worst = null;
        for (var d8 = 0; d8 < 7; d8++) for (var i8 = 0; i8 < w[d8].length; i8++) {
          var r8 = rank(w[d8][i8]);
          if (!worst || r8 > worst.r) worst = { d: d8, i: i8, r: r8, u: w[d8][i8] };
        }
        if (!worst) break;
        w[worst.d].splice(worst.i, 1);
        unplaced.push({ unit: worst.u, reason: 'max_sessions_per_week' });
        total--;
      }
    }

    /* ---- Qualitätsbericht: nachrechenbar, nicht behauptet ---- */
    var q = qualityOf(w);
    return {
      days: w,
      report: {
        ok: true, version: VERSION,
        placed: q.sessions, unplaced: unplaced, notes: notes, demand: demandReport,
        restDays: q.restDays, doubleDays: q.doubleDays,
        hardDays: q.hardDays, minGapHard: q.minGapHard,
        maxRunStreak: q.maxRunStreak, quality: q
      }
    };
  }

  /* Bewertung einer Tageskombination für die Kernreize.
     Leitgröße ist der KLEINSTE Abstand im Ring — eine Woche ist so gut wie ihr
     engster Übergang. Erst danach zählen Gleichmäßigkeit und Wunschtage. */
  function scoreHardDays(cand, hardUnits, longPref, prefRest) {
    var s = 0;
    var mg = minGapOf(cand);
    s += mg * 1000;
    if (cand.length > 1 && mg < 2) s -= 5000;              /* unter 48 h ist ein echter Mangel */
    /* Gleichmäßigkeit: Summe der quadrierten Abweichungen der Lücken. */
    if (cand.length > 1) {
      var gaps = gapsOf(cand), avg = 7 / cand.length, dev = 0;
      gaps.forEach(function (g) { dev += (g - avg) * (g - avg); });
      s -= dev * 20;
    }
    /* Long Run auf einen der bevorzugten Tage (mehr Zeit am Wochenende). */
    var hasLong = hardUnits.some(isLong);
    if (hasLong) { var hit = cand.some(function (d) { return longPref.indexOf(d) >= 0; }); if (hit) s += 300; }
    cand.forEach(function (d) { if (prefRest[d]) s -= 800; });
    return s;
  }
  function gapsOf(sortedDays) {
    var c = sortedDays.slice().sort(function (a, b) { return a - b; });
    var gaps = [];
    for (var i = 0; i < c.length; i++) {
      var next = c[(i + 1) % c.length];
      var g = (next - c[i] + 7) % 7;
      gaps.push(g === 0 ? 7 : g);
    }
    return gaps;
  }
  function minGapOf(cand) {
    if (!cand || cand.length < 2) return 7;
    return Math.min.apply(null, gapsOf(cand));
  }

  /* Kernreize den gewählten Tagen zuordnen: Long Run bevorzugt auf den
     Wunschtag, der Rest der Reihe nach im Ring. */
  function assignHard(hardUnits, hardDays, longPref) {
    var dayList = hardDays.slice().sort(function (a, b) { return a - b; });
    var out = [], used = {};
    var longUnit = hardUnits.filter(isLong)[0] || null;
    if (longUnit) {
      var pick = -1;
      for (var i = 0; i < dayList.length; i++) if (longPref.indexOf(dayList[i]) >= 0) { pick = dayList[i]; break; }
      if (pick < 0) pick = dayList[dayList.length - 1];
      out.push({ unit: longUnit, day: pick }); used[pick] = 1;
    }
    var restUnits = hardUnits.filter(function (u) { return u !== longUnit; });
    var freeDays = dayList.filter(function (d) { return !used[d]; });
    restUnits.forEach(function (u, i) { if (i < freeDays.length) out.push({ unit: u, day: freeDays[i] }); });
    return out;
  }

  /* Messwerte statt Behauptungen — dieselbe Rechnung, die die Tests prüfen. */
  function qualityOf(w) {
    var sessions = 0, restDays = 0, doubleDays = 0, hardDays = [];
    var runDays = {};
    for (var d = 0; d < 7; d++) {
      var day = w[d] || [];
      sessions += day.length;
      if (!day.length) restDays++;
      if (day.length >= 2) doubleDays++;
      if (day.some(isHard)) hardDays.push(d);
      if (day.some(isRun)) runDays[d] = 1;
    }
    var maxRunStreak = 0, cur = 0;
    for (var s = 0; s < 14; s++) { if (runDays[s % 7]) { cur++; if (cur > maxRunStreak) maxRunStreak = cur; } else cur = 0; }
    if (maxRunStreak > 7) maxRunStreak = 7;
    return { sessions: sessions, restDays: restDays, doubleDays: doubleDays,
      hardDays: hardDays, minGapHard: minGapOf(hardDays), maxRunStreak: maxRunStreak };
  }

  var api = { VERSION: VERSION, designWeek: designWeek, qualityOf: qualityOf,
    isHard: isHard, isLong: isLong, isLegHeavy: isLegHeavy, isRun: isRun,
    cycDist: cycDist, minGapOf: minGapOf, gapsOf: gapsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.weekPlanDesigner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
