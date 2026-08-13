/* ============================================================
   ORVIA · week-projection — Engine-Wochenplan → kanonisches Anzeigemodell (Phase 8.1)

   WARUM ES DIESES MODUL BRAUCHT
     `scheduler-v2.buildWeek()` liefert Sessions in Engine-Form:
         { sessionId, weekday:'mo'…'so', sportId:'running'…, prescription:{…}, provenance:{…} }
     Die Oberfläche liest ein anderes Modell (`activeWeekPlan()` in js/ui.js):
         [ [ {t:'Laufen', l:'Long Run', d:'75 min', id:'…'} ], …7 Tage-Arrays ]
     Diese Abbildung existierte bisher NICHT. Deshalb konnte der Engine-Output den
     Nutzer nie erreichen — und deshalb zeigen Zielprognose, Zielqualität und
     Tagesziele bis heute „—". Das ist die fehlende Brücke zwischen Shadow und Canary
     (Umsetzungsplan, Phase 8.1).

   VERTRAG
     • REIN: keine Mutation des Engine-Outputs, kein DOM, kein Store, kein Zufall,
       keine Uhrzeit. Gleicher Input ⇒ bitgleicher Output.
     • VOLLSTÄNDIG: jede Engine-Session landet ENTWEDER im Wochenmodell ODER
       begründet in `unmapped[]`. Nichts verschwindet still — genau dieses stille
       Verschwinden wäre der gefährlichste Fehler einer Projektion.
     • KEINE ERFINDUNG: Labels stammen aus einer geschlossenen Tabelle. Eine
       unbekannte Kombination aus Sportart und Einheitentyp wird NICHT geraten,
       sondern als `unknown_session_type` ausgewiesen.
     • RÜCKFÜHRBAR: jede projizierte Einheit trägt ihre Herkunft (`prov`), damit die
       Oberfläche Engine-Einheiten von Legacy-Einheiten unterscheiden kann.

   Dieses Modul STEUERT NICHTS. Es rechnet um. Ob und wann sein Ergebnis angezeigt
   wird, entscheidet allein der Aktivierungspfad (Canary/Live-Gate).
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'week-projection@1';

  /* Kanonische Wochentagsreihenfolge — identisch zu constraint-solver.js,
     profile-model.js und scheduler-input-factory. Nie englische Keys. */
  var WEEKDAYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

  /* Sport-ID → deutsches Anzeige-Label. Muss BITGENAU dem entsprechen, was die
     Legacy-Generatoren erzeugen (js/ui.js: gpR='Laufen', gpB='Rad', gpG='Gym',
     gpS='Schwimmen') — sonst zeigt dieselbe Sportart je nach Herkunft zwei
     verschiedene Namen. */
  var SPORT_LABEL = { running: 'Laufen', cycling: 'Rad', gym: 'Gym', swimming: 'Schwimmen' };

  /* (Sportart, Einheitentyp) → Anzeigename. Bewusst als geschlossene Tabelle:
     Was hier fehlt, wird als unmapped gemeldet statt erfunden. Die Namen folgen
     denen, die der Nutzer aus dem bisherigen Plan kennt. */
  var SESSION_LABEL = {
    running: { endurance_easy: 'Z2 Dauerlauf', endurance_long: 'Long Run',
      endurance_tempo: 'Tempo', endurance_intervals: 'Intervalle' },
    cycling: { endurance_easy: 'Easy Z2', endurance_long: 'Long Ride',
      endurance_tempo: 'Tempo', endurance_intervals: 'Intervalle' },
    swimming: { endurance_easy: 'Technik', endurance_long: 'Ausdauer',
      endurance_tempo: 'Tempo', endurance_intervals: 'Intervalle' },
    gym: { strength_general: 'Krafttraining' }
  };

  function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }

  /* Gesamtdauer einer Verordnung in Sekunden — reine Summe der ECHTEN Blockwerte.
     `repeat` zählt seine Kinder mal Wiederholungen. Blöcke ohne Dauerangabe
     (z. B. Kraftübungen mit Sätzen) tragen nichts bei; fehlt jede Angabe, ist das
     Ergebnis null und NICHT 0 — „unbekannt" und „null Minuten" sind verschieden. */
  /* Tiefe Kopie (v8-332). Das Anzeigemodell darf keine Struktur mit dem
     Scheduler-Output teilen — sonst veraendert eine Bearbeitung der Karte
     rueckwirkend die Quelle. JSON-Klon genuegt: Verordnungen sind reine
     Daten ohne Funktionen, Zyklen oder Datumsobjekte. */
  function _clone(x) {
    if (x == null) return x;
    try { return JSON.parse(JSON.stringify(x)); }
    catch (e) { return null; }                       // fail-closed: lieber nichts als etwas Geteiltes
  }

  function durationSeconds(blocks) {
    if (!Array.isArray(blocks)) return null;
    var total = 0, seen = false;
    (function walk(list, factor) {
      list.forEach(function (b) {
        if (!b || typeof b !== 'object') return;
        if (b.type === 'repeat' && Array.isArray(b.blocks)) {
          var it = isFiniteNum(b.iterations) ? b.iterations : 1;
          walk(b.blocks, factor * it);
          return;
        }
        var c = b.completion;
        if (c && c.type === 'duration' && isFiniteNum(c.value) && c.value > 0) {
          total += c.value * factor; seen = true;
        }
      });
    })(blocks, 1);
    return seen ? Math.round(total) : null;
  }

  /* Umfangs-Text für die Karte. Nur aus echten Werten; ohne Dauer bleibt es leer,
     damit die Oberfläche ihren ehrlichen Leerzustand zeigen kann. */
  function volumeLabel(seconds) {
    if (!isFiniteNum(seconds) || seconds <= 0) return null;
    var min = Math.round(seconds / 60);
    if (min < 90) return min + ' min';
    var h = Math.floor(min / 60), r = min % 60;
    return r ? (h + ':' + String(r).padStart(2, '0') + ' h') : (h + ' h');
  }

  /* Eine Engine-Session → Anzeige-Einheit, oder ein begründeter Fehlschlag.
     Rückgabe: { ok:true, dayIndex, item } | { ok:false, reason, detail } */
  function projectSession(s) {
    if (!s || typeof s !== 'object') return { ok: false, reason: 'session_malformed', detail: null };
    var di = WEEKDAYS.indexOf(s.weekday);
    if (di < 0) return { ok: false, reason: 'weekday_unknown', detail: s.weekday == null ? null : String(s.weekday) };
    var sportId = s.sportId || (s.prescription && s.prescription.sport_id) || null;
    var t = SPORT_LABEL[sportId];
    if (!t) return { ok: false, reason: 'sport_unknown', detail: sportId };
    var pr = s.prescription;
    /* Nicht-Array-Objekt (v8-331). `typeof [] === 'object'` — ein Array kam
       bis hierher durch und wurde erst weiter unten mit dem FALSCHEN Grund
       ('unknown_session_type') gemeldet. Das restliche Projekt prueft
       ueberall ausdruecklich auf Nicht-Array-Objekt; hier fehlte es. */
    if (!pr || typeof pr !== 'object' || Array.isArray(pr)) return { ok: false, reason: 'prescription_missing', detail: null };
    var byType = SESSION_LABEL[sportId] || {};
    var l = byType[pr.session_type];
    if (!l) return { ok: false, reason: 'unknown_session_type', detail: sportId + '/' + (pr.session_type == null ? 'null' : pr.session_type) };
    var sec = durationSeconds(pr.blocks);
    var item = {
      t: t, l: l,
      d: volumeLabel(sec) || '',
      id: s.sessionId || null,
      /* Herkunft mitführen: die Oberfläche muss Engine- von Legacy-Einheiten
         unterscheiden können, ohne raten zu müssen. */
      prov: { source: 'engine', projection: VERSION,
        sessionType: pr.session_type, goal: pr.goal || null,
        priority: pr.priority || null,
        durationSec: sec,
        scheduler: (s.provenance && s.provenance.scheduler) || null,
        templateId: (s.provenance && s.provenance.templateId) || null },
      /* v8-332 — DIE eigentliche Aenderung. Bis hierher wurde die Verordnung
         an genau dieser Stelle weggeworfen: uebrig blieb "Tempolauf · 75 min",
         und was der Nutzer tatsaechlich laufen soll — Aufwaermen, 4 × 1 km im
         Schwellenfenster, Trabpausen, Auslaufen — war unsichtbar, obwohl die
         Engine es jeden Tag ausgerechnet hat.

         Bewusst die ROHE Verordnung, nicht fertiger Text: Formatieren ist
         Sache von `prescription-format`, Sprache und Aussehen Sache der
         Oberflaeche. Waere hier schon Text, koennte niemand mehr etwas
         anderes daraus machen — und der Exporter braucht ohnehin die Struktur.

         Eine KOPIE, kein Verweis: das Anzeigemodell darf den Scheduler-Output
         nicht teilen, sonst veraendert eine spaetere Bearbeitung rueckwirkend
         die Quelle (dieselbe Klasse Fehler wie A5/A6 in plan-activation). */
      rx: _clone(pr)
    };
    /* v8-349 — die Hinweise reisen mit, aber GETRENNT von `rx`.
       Warum nicht hinein: `rx` ist die Verordnung, und ihr Fingerabdruck
       (`plan-activation._rxPrint`) entscheidet, ob eine Einheit als
       geaendert gilt. Haengte man die Hinweise dort an, aenderte jede neue
       Quelle den Fingerabdruck bestehender Wochen — der Nutzer saehe eine
       Aenderungsmeldung fuer eine Einheit, die sich nicht geaendert hat.

       Auch hier eine KOPIE und nur bei Inhalt, aus denselben Gruenden wie
       bei `rx`: kein geteilter Verweis, kein leeres Feld im Altbestand. */
    if (s.hinweise && s.hinweise.length) item.hinweise = _clone(s.hinweise);
    return { ok: true, dayIndex: di, item: item };
  }

  /* Vollständige Woche projizieren.
     out: { ok, days:[7][], unmapped:[{sessionId,reason,detail}], counts, provenance } */
  function projectWeek(schedulerOutput) {
    var days = [[], [], [], [], [], [], []];
    var unmapped = [];
    if (!schedulerOutput || typeof schedulerOutput !== 'object') {
      return { ok: false, error: 'scheduler_output_missing', days: days, unmapped: unmapped, notPlanned: [],
        counts: { input: 0, projected: 0, unmapped: 0, notPlanned: 0 }, provenance: { projection: VERSION } };
    }
    if (schedulerOutput.ok === false) {
      /* Ein gescheiterter Lauf wird NICHT als leere Woche ausgegeben — das wäre
         ununterscheidbar von „Woche ohne Einheiten". */
      return { ok: false, error: (schedulerOutput.error && schedulerOutput.error.code) || 'scheduler_failed',
        days: days, unmapped: unmapped, notPlanned: [],
        counts: { input: 0, projected: 0, unmapped: 0, notPlanned: 0 },
        provenance: { projection: VERSION } };
    }
    var list = Array.isArray(schedulerOutput.sessions) ? schedulerOutput.sessions : [];
    list.forEach(function (s) {
      var r = projectSession(s);
      if (r.ok) days[r.dayIndex].push(r.item);
      else unmapped.push({ sessionId: (s && s.sessionId) || null, reason: r.reason, detail: r.detail });
    });
    /* Innerhalb eines Tages stabil sortieren: Schlüsseleinheiten zuerst, danach
       nach sessionId. Ohne feste Ordnung wäre die Projektion nicht deterministisch,
       sobald der Scheduler die Reihenfolge ändert. */
    var PRIO = { key: 0, build: 1, optional: 2 };
    days.forEach(function (d) {
      d.sort(function (a, b) {
        var pa = PRIO[a.prov && a.prov.priority] , pb = PRIO[b.prov && b.prov.priority];
        if (pa == null) pa = 1; if (pb == null) pb = 1;
        if (pa !== pb) return pa - pb;
        return String(a.id).localeCompare(String(b.id));
      });
    });
    /* Der Scheduler meldet selbst zwei Arten von Verlust, BEVOR eine Session entsteht:
       `unplaced` (kein zulässiger Tag gefunden) und `blockedPrescriptions` (Verordnung
       nicht baubar). Diese Information würde auf dem Weg zur Oberfläche verschwinden,
       wenn die Projektion sie nicht mitführt — der Nutzer sähe einen dünneren Plan
       ohne Grund. Sie wird deshalb unverändert durchgereicht und in `notPlanned`
       zusammengefasst. Beim Bauen aufgefallen (2026-08-06). */
    var notPlanned = [];
    (Array.isArray(schedulerOutput.unplaced) ? schedulerOutput.unplaced : []).forEach(function (u) {
      notPlanned.push({ id: (u && u.id) || null, stage: 'placement', reason: (u && u.reason) || 'unplaced' });
    });
    (Array.isArray(schedulerOutput.blockedPrescriptions) ? schedulerOutput.blockedPrescriptions : []).forEach(function (b) {
      notPlanned.push({ id: (b && b.id) || null, stage: 'prescription', reason: (b && b.blocked) || 'blocked' });
    });
    return { ok: true, error: null, days: days, unmapped: unmapped, notPlanned: notPlanned,
      counts: { input: list.length, projected: list.length - unmapped.length,
        unmapped: unmapped.length, notPlanned: notPlanned.length },
      weekKey: schedulerOutput.weekKey || null,
      provenance: { projection: VERSION,
        scheduler: (schedulerOutput.provenance && schedulerOutput.provenance.scheduler) || null,
        policy: (schedulerOutput.provenance && schedulerOutput.provenance.policy) || null } };
  }

  /* Rückrichtung für den Vergleich Plan ⇄ Engine: reduziert ein Anzeigemodell auf
     die vergleichbaren Kerngrößen (Tag + Sportart + Einheitenname). Bewusst KEINE
     vollständige Umkehr — aus einer Anzeige-Einheit lässt sich keine Verordnung
     rekonstruieren, und so zu tun als ob wäre eine Erfindung. */
  function weekPlanToComparable(days) {
    var out = [];
    if (!Array.isArray(days)) return out;
    for (var i = 0; i < Math.min(7, days.length); i++) {
      (days[i] || []).forEach(function (it) {
        if (!it) return;
        out.push({ weekday: WEEKDAYS[i], sport: it.t || null, label: it.l || null,
          source: (it.prov && it.prov.source) || 'legacy' });
      });
    }
    out.sort(function (a, b) {
      var d = WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday);
      if (d !== 0) return d;
      return String(a.sport + a.label).localeCompare(String(b.sport + b.label));
    });
    return out;
  }

  /* Vergleich zweier Wochenmodelle (z. B. Legacy-Plan vs. Engine-Projektion).
     Liefert nur Fakten, keine Bewertung — welche Abweichung akzeptabel ist,
     entscheidet das Gate, nicht dieses Modul. */
  function diffWeeks(aDays, bDays) {
    var a = weekPlanToComparable(aDays), b = weekPlanToComparable(bDays);
    var key = function (x) { return x.weekday + '|' + x.sport + '|' + x.label; };
    var inA = {}, inB = {};
    a.forEach(function (x) { inA[key(x)] = (inA[key(x)] || 0) + 1; });
    b.forEach(function (x) { inB[key(x)] = (inB[key(x)] || 0) + 1; });
    var onlyA = [], onlyB = [], same = 0;
    Object.keys(inA).forEach(function (k) {
      var n = Math.min(inA[k], inB[k] || 0); same += n;
      for (var i = 0; i < inA[k] - n; i++) onlyA.push(k);
    });
    Object.keys(inB).forEach(function (k) {
      var n = Math.min(inB[k] || 0, inA[k] || 0);
      for (var i = 0; i < inB[k] - n; i++) onlyB.push(k);
    });
    return { same: same, onlyA: onlyA.sort(), onlyB: onlyB.sort(),
      identical: onlyA.length === 0 && onlyB.length === 0,
      countA: a.length, countB: b.length };
  }

  var api = { VERSION: VERSION, WEEKDAYS: WEEKDAYS,
    SPORT_LABEL: SPORT_LABEL, SESSION_LABEL: SESSION_LABEL,
    durationSeconds: durationSeconds, volumeLabel: volumeLabel,
    projectSession: projectSession, projectWeek: projectWeek,
    weekPlanToComparable: weekPlanToComparable, diffWeeks: diffWeeks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.weekProjection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
