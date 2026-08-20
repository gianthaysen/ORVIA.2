/* ============================================================
   ORVIA · goal-shadow — A-06, Teil 1 des Ziel-SSOT

   WOFÜR. Die App hat heute ZWEI Leser des Hauptziels, die verschiedene Fragen
   beantworten: `goalOf()` (ui.js:4561) liefert die Legacy-Form und filtert auf
   Laufdistanz-Ziele, mit drei Rückfallebenen; `mainGoalOf()` (ui.js:4656)
   liefert das rohe aktive Ziel mit der niedrigsten Priorität, ohne Filter und
   ohne Rückfall. Ein Kraftziel mit Priorität 1 liefert `mainGoalOf()` — an
   `goalOf()` läuft es vorbei.

   Bevor die Planlogik in B-01 auf das Zielobjekt umgestellt wird, soll BELEGT
   sein, wie oft und wo beide auseinanderlaufen. Dieses Modul schreibt dafür bei
   jedem Zielereignis einen unveränderlichen Eintrag mit beiden Lesarten und
   einem Widerspruchskennzeichen.

   HÄRTESTE REGEL — BEOBACHTER, NIE BETEILIGTER. Kein Ausgang dieses Moduls darf
   ein Zielereignis verändern oder abbrechen. Fehlende Senke, Schreibfehler,
   kaputtes Profil: alles liefert {stored:false, reason} und lässt das Speichern
   des Ziels unberührt. Dieselbe Regel wie in decision-log.js.

   ZWEITE REGEL — UNVERÄNDERLICH. Kein update(). Eine Korrektur ist ein NEUER
   Eintrag. Migration 0037 hat deshalb weder update- noch delete-Policy.

   DRITTE REGEL — DATENLÜCKE ≠ WERT. Kein aktives Ziel ergibt `mainGoal: null`.
   Das ist eine Aussage, kein fehlender Wert, und wird NICHT durch einen
   Ersatzwert gefüllt.

   Kein DOM. Zeit, ID-Fabrik und Senke kommen herein — sonst wäre das Modul
   nicht testbar und die Einträge nicht reproduzierbar.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'goal-shadow@1';
  var TYPES = ['add', 'update', 'remove', 'status'];

  /* Die Felder, auf denen ein Widerspruch überhaupt feststellbar ist.
     Bewusst klein gehalten: mehr Felder erzeugen mehr Rauschen, nicht mehr
     Erkenntnis. Genau diese drei bestimmen in B-01 den Wochenplan. */
  var COMPARE = ['identity', 'category', 'targetDate', 'targetMin'];

  var _enabled = true;
  var _sink = null;
  var _fehler = 0;          // gezählte Schreibfehler — Gate A, Kriterium 4
  var _geschrieben = 0;
  var _unterwegs = 0;       // abgesetzt, aber noch nicht bestaetigt

  function setEnabled(v) { _enabled = !!v; }
  function setSink(fn) { _sink = (typeof fn === 'function') ? fn : null; }
  /* `unterwegs` ist am 20.08.2026 dazugekommen, nachdem eine Fehlmessung fast zu
     einer Fehlersuche am falschen Ende gefuehrt haette: `geschrieben` steigt erst,
     wenn die Datenbank antwortet. Wer stats() im selben Ausdruck aufruft wie das
     Zielereignis, liest zwangsläufig 0 — und 0/0 bedeutete bis dahin zweierlei:
     "nichts passiert" ODER "laeuft noch". Ein Zaehler, der zwei Zustaende gleich
     anzeigt, ist als Diagnose untauglich. */
  function stats() { return { geschrieben: _geschrieben, fehler: _fehler,
    unterwegs: _unterwegs, enabled: _enabled, senke: !!_sink }; }

  /* Tiefe Kopie. `.slice()` reicht NICHT — bei A-02 hat genau das dazu geführt,
     dass Elemente geteilt blieben und das Profil doch mutiert wurde. */
  function _copy(v) {
    if (v == null) return null;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  /* Zielzeit in Minuten aus dem rohen Zielobjekt — dieselbe Umrechnung wie in
     goalOf(), damit ein Vergleich überhaupt zulässig ist. Weicht die Umrechnung
     ab, misst man die Umrechnung statt des Ziels. */
  function _minutenAus(g) {
    if (!g || typeof g.targetValue !== 'number' || !isFinite(g.targetValue)) return null;
    if (g.unit === 'min') return g.targetValue;
    if (g.unit === 's' || g.metricType === 'time') return g.targetValue / 60;
    if (!g.unit) return g.targetValue;
    return null;
  }

  function _norm(s) { return (s == null || s === '') ? null : String(s); }
  function _nahe(a, b) {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return Math.abs(a - b) < 0.5;      // halbe Minute Toleranz: Rundung ist kein Widerspruch
  }

  /* ---------- Vergleich ---------- */
  /* Liefert die Liste der Felder, in denen die beiden Lesarten NICHT dasselbe
     Ziel meinen. Leere Liste = kein Widerspruch. Der Fall „mainGoal ist ein
     Kraftziel, legacy ein Laufziel" erscheint hier als 'identity' — und genau
     dieser Fall ist der Grund für das ganze Paket. */
  function vergleiche(mainGoal, legacyGoal, gcat) {
    var out = [];
    var mg = mainGoal || null, lg = legacyGoal || null;
    if (!mg && !lg) return out;
    if (!mg || !lg) { out.push('identity'); return out; }

    if (lg._canonicalId != null && mg.id != null && String(lg._canonicalId) !== String(mg.id))
      out.push('identity');

    var mkat = (typeof gcat === 'function') ? gcat(mg.category || mg.type) : _norm(mg.category || mg.type);
    if (_norm(mkat) !== _norm(lg.type)) out.push('category');

    if (_norm(mg.targetDate) !== _norm(lg.raceDate)) out.push('targetDate');

    if (!_nahe(_minutenAus(mg), (typeof lg.targetMin === 'number' ? lg.targetMin : null)))
      out.push('targetMin');

    return out;
  }

  /* ---------- Bauen ---------- */
  /* Rein. Fasst nichts an, was hereingegeben wird, und gibt eine eingefrorene
     Kopie zurück. opts: {eventType, mainGoal, legacyGoal, activeGoalCount,
     eventId, now, appVersion, gcat} */
  function build(opts) {
    opts = opts || {};
    var fehler = [];

    if (TYPES.indexOf(opts.eventType) < 0) fehler.push('event_type_unbekannt:' + String(opts.eventType));
    if (typeof opts.eventId !== 'string' || !opts.eventId) fehler.push('event_id_fehlt');
    if (typeof opts.now !== 'string' || !opts.now) fehler.push('zeit_fehlt');

    var mg = _copy(opts.mainGoal);
    var lg = _copy(opts.legacyGoal);
    var felder = vergleiche(mg, lg, opts.gcat);

    var rec = {
      version: VERSION,
      eventId: opts.eventId,
      eventType: opts.eventType,
      occurredAt: opts.now,
      mainGoal: mg,                                  // null ist gültig
      legacyGoal: lg,
      contradiction: felder.length > 0,
      contradictionFields: felder,
      activeGoalCount: (typeof opts.activeGoalCount === 'number' && opts.activeGoalCount >= 0)
        ? opts.activeGoalCount : 0,
      appVersion: opts.appVersion || null
    };
    return { valid: fehler.length === 0, errors: fehler, record: Object.freeze(rec) };
  }

  /* Zeile für Migration 0037. Spaltennamen exakt wie dort. */
  function toRow(rec, userId) {
    if (!rec || !userId) return null;
    return {
      user_id: userId,
      event_id: rec.eventId,
      event_type: rec.eventType,
      occurred_at: rec.occurredAt,
      main_goal: rec.mainGoal,
      legacy_goal: rec.legacyGoal,
      contradiction: rec.contradiction,
      contradiction_fields: rec.contradictionFields,
      active_goal_count: rec.activeGoalCount,
      app_version: rec.appVersion
    };
  }

  /* ---------- Schreiben ---------- */
  /* Gibt IMMER ein Ergebnisobjekt zurück und wirft nie. Der Aufrufer
     (commitGoals) darf sich auf beides verlassen. */
  function logGoalEvent(opts) {
    if (!_enabled) return { id: null, stored: false, reason: 'disabled' };
    var gebaut;
    try { gebaut = build(opts); }
    catch (e) { _fehler++; return { id: null, stored: false, reason: 'build_threw' }; }
    if (!gebaut.valid) { _fehler++; return { id: opts && opts.eventId || null, stored: false, reason: 'invalid:' + gebaut.errors.join(','), record: gebaut.record }; }
    if (!_sink) return { id: gebaut.record.eventId, stored: false, reason: 'no_sink', record: gebaut.record };
    try {
      var r = _sink(gebaut.record);
      /* Die Senke darf ausdruecklich `null`/`false` liefern, wenn es gar keinen
         Schreibversuch gab (z. B. keine Sitzung, offline). Das ist KEIN
         Schreibfehler — sonst waere die Zahl aus Gate A, Kriterium 4 wertlos,
         weil sie jeden abgemeldeten Zustand mitzaehlt. */
      if (r === null || r === false || r === undefined)
        return { id: gebaut.record.eventId, stored: false, reason: 'sink_skipped', record: gebaut.record };
      if (r && typeof r.then === 'function') {
        _unterwegs++;
        r.then(function () { _unterwegs--; _geschrieben++; })
         .catch(function () { _unterwegs--; _fehler++; });
      } else { _geschrieben++; }
      return { id: gebaut.record.eventId, stored: true, reason: null, record: gebaut.record };
    } catch (e) {
      _fehler++;
      return { id: gebaut.record.eventId, stored: false, reason: 'sink_threw', record: gebaut.record };
    }
  }

  var api = {
    VERSION: VERSION, TYPES: TYPES, COMPARE: COMPARE,
    build: build, toRow: toRow, vergleiche: vergleiche,
    logGoalEvent: logGoalEvent,
    setSink: setSink, setEnabled: setEnabled, stats: stats,
    _minutenAus: _minutenAus
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.goalShadow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
