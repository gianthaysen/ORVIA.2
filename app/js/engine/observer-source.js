/* ============================================================
   ORVIA · observer-source — die versionierte QUELLENBESCHAFFUNG

   WARUM ES DIESES MODUL GIBT (v8-303): observer-input war versioniert,
   die eigentliche Quellenbeschaffung steckte aber unversioniert in ui.js —
   und genau dort entstanden zwei P0 in Folge: eine Abbruchbedingung, die
   den positiven Krankheitstag 29 NIE erreichen konnte, und ein
   Beschwerdepfad, der bei jedem Aufruf Uhr und Zufall in den Snapshot
   zog (updatedAt/uid aus der Normalisierung) — die Drossel griff nicht,
   Idempotenzschluessel wurden neu, der Log konnte volllaufen.

     App-Speicher → observer-source@N → observer-input@N → Schatten/Prediction

   Die QUELLENBEDEUTUNG gehoert damit zur Kohorte: Was „die Check-in-Serie"
   oder „die aktiven Beschwerden" HEISST, ist ab jetzt Vertrag, nicht
   ui-Implementierungsdetail.

   REGELN
     · DETERMINISTISCH: keine Uhr (nur argumentierte Kalenderarithmetik),
       kein Zufall, keine Mutation der App-Speicher. Zweimal derselbe
       Zustand ⇒ byte-gleiche Projektion.
     · Nur FACHLICHE Felder werden projiziert — updatedAt, ids aus
       Normalisierungen und andere Verwaltungsfelder bleiben draussen.
     · Die Check-in-Serie laeuft IMMER ueber das volle 180-Tage-Fenster —
       keine „intelligente" Abbruchbedingung mehr; genau die war der
       29-Tage-Fehler. 180 kleine Objekte sind billiger als ein
       Logikfehler dieser Klasse.
     · observed-Beschwerden werden UEBERSETZT (Politik-Entscheid v8-303):
       profile-center und decision-engine-v2 behandeln active+observed
       als relevant — die Sicherheitsschicht folgt dieser Semantik,
       weist observed aber mit evidence 'weak' und reviewStatus aus.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'observer-source@2';
  var CHECKIN_WINDOW_DAYS = 180;

  /* ------------------------------------------------------------
     CHECK-IN-SERIE: db ist die Tages-Map der App (DB[dateIso].morning).
     ill ist dreiwertig: true / false / null (kein Check-in). Red Flags
     werden verbatim projiziert. IMMER volle 180 Tage — die Serie endet
     nie frueher, damit eine Episodensuche im Adapter jeden positiven Tag
     im Fenster finden KANN. Die Kappe selbst steht als letztes Feld. */
  function checkinSeries(db, todayIso) {
    if (!db || !todayIso || !/^\d{4}-\d{2}-\d{2}/.test(String(todayIso))) return undefined;
    var t0 = Date.parse(String(todayIso).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(t0)) return undefined;
    var out = [];
    for (var b = 0; b < CHECKIN_WINDOW_DAYS; b++) {
      var k = new Date(t0 - b * 86400000).toISOString().slice(0, 10);
      var e = db[k];
      var m = e && e.morning;
      out.push({
        date: k,
        ill: (m && m.ill === true) ? true : ((m && m.ill === false) ? false : (m && m.ill ? true : null)),
        redFlags: (m && m.redFlags) ? m.redFlags : null
      });
    }
    return out;
  }

  /* ------------------------------------------------------------
     BESCHWERDEN: STABILE fachliche Projektion aus constraintsList +
     Legacy-issues. BEWUSST NICHT profileModel.normalizeConstraint — die
     erzeugt bei jedem Aufruf updatedAt (Uhr) und fuer Legacy-Issues neue
     Zufalls-IDs. Hier zaehlen nur die Felder, die die Sicherheits-
     uebersetzung braucht; die Identitaet ist der Inhalt. */
  function safetyConstraints(profile) {
    var p = profile || {};
    if (!Array.isArray(p.constraintsList) && !Array.isArray(p.issues)) return undefined;
    var out = [];
    var byRegion = {};
    (Array.isArray(p.constraintsList) ? p.constraintsList : []).forEach(function (c) {
      if (!c) return;
      var status = (['active', 'improved', 'resolved', 'observed'].indexOf(c.status) >= 0) ? c.status : 'active';
      var region = c.bodyRegion || c.region || '';
      if (region) byRegion[region] = true;
      if (status !== 'active' && status !== 'observed') return;
      out.push({
        bodyRegion: region || 'unknown',
        side: c.side || 'na',
        title: c.title || '',
        intensity: c.intensity != null ? c.intensity : null,
        currentlyTrainable: c.currentlyTrainable != null ? !!c.currentlyTrainable : true,
        medicallyChecked: !!c.medicallyChecked,
        status: status,
        since: c.startedAt || c.since || null
      });
    });
    /* Legacy-Modulschluessel ohne reiche Beschwerde: leichte aktive
       Beschwerde — OHNE erfundene ID, ohne Zeitstempel. */
    (Array.isArray(p.issues) ? p.issues : []).forEach(function (k) {
      if (!k || k === 'none' || byRegion[k]) return;
      out.push({ bodyRegion: k, side: 'na', title: String(k), intensity: null,
        currentlyTrainable: true, medicallyChecked: false, status: 'active', since: null });
    });
    /* Deterministische Ordnung: der Schluessel ist die VOLLSTAENDIGE
       stabile Serialisierung jedes Eintrags (v8-304) — ein Teilschluessel
       (bodyRegion|side|title) liess zwei gleich benannte Beschwerden mit
       verschiedener Intensitaet/Status in Eingabereihenfolge stehen, und
       die Reihenfolge aenderte den Snapshot-Hash. */
    function _skey(x) {
      return JSON.stringify(Object.keys(x).sort().map(function (k) { return [k, x[k]]; }));
    }
    out.sort(function (a, b) {
      var ka = _skey(a), kb = _skey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    return out;
  }

  var api = { VERSION: VERSION, CHECKIN_WINDOW_DAYS: CHECKIN_WINDOW_DAYS,
    checkinSeries: checkinSeries, safetyConstraints: safetyConstraints };
  Object.freeze(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.observerSource = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
