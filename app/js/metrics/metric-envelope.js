/* ============================================================
   ORVIA · metric-envelope — GEMEINSAMER Kennzahlen-Vertrag (Phase 2.0)

   Jede Belastungskennzahl traegt VIER Informationen:

       Wert · Zeitraum · Datenabdeckung · Berechnungsgrundlage

   und zwar TECHNISCH ERZWUNGEN, nicht nur textlich gefordert: create() wirft,
   wenn Provenienz (Methode + Formelversion) oder Zeitraum fehlen. Es gibt
   damit keinen Weg, eine Kennzahl ohne Herkunft zu bauen. Genau die Fehler-
   klasse, die zuvor drei unabhaengige Intensitaetsdefinitionen erzeugt hatte
   (frei modellierte ViewModels je Kennzahl), ist damit strukturell gesperrt.

   Verbindlich fuer: Belastung nach Sportart · Harte Einheiten · TRIMP ·
   Easy Share · Interferenz · spaeter ATL/CTL und sportartspezifische Kapazitaet
   (docs/UMSETZUNGSPLAN-2026-08.md, Phase 2.0).

   Statusregeln (abgeleitet, nie frei gesetzt):
     none     = keine auswertbare Eingabe (available == 0) oder value == null
     complete = alle geeigneten Eingaben decken die Kennzahl (available == eligible > 0)
     partial  = alles dazwischen — der Wert ist gueltig, aber als Teilbild
                auszuweisen („kein Wochenmittelwert ohne Warnhinweis", 2.3)

   Kein DOM, kein Store — reine Funktionen, in node testbar.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = '1.0.0';

  /* Lesbare Methodennamen fuer die Anzeigezeile. Die Formel-/Regelversion
     bleibt in provenance.version — Korrekturen an einer Formel aendern damit
     nie unbemerkt historische Werte (Phase 2.3). */
  var METHOD_LABELS = {
    duration_share_by_sport: 'Anteil bekannter Trainingsdauer',
    session_rpe_hard_share: 'RPE ≥ 7',
    banister_trimp: 'Banister-TRIMP',
    label_or_hr_easy_share: 'Label bzw. HF ≤ 78 % HFmax',
    load_spike_and_leg_interference: 'Lastsprung 3/7 Tage + Bein-Interferenz'
  };

  function fail(msg) { throw new Error('metric-envelope: ' + msg); }

  function create(spec) {
    spec = spec || {};
    if (!spec.metricId || typeof spec.metricId !== 'string') fail('metricId fehlt');
    var p = spec.period;
    if (!p || !p.type) fail(spec.metricId + ': period fehlt — kein Wert ohne Zeitraum');
    if (p.type === 'rolling' && !(p.days > 0)) fail(spec.metricId + ': rolling-Zeitraum ohne days');
    if (!p.startDate || !p.endDate) fail(spec.metricId + ': period ohne startDate/endDate');
    var prov = spec.provenance;
    if (!prov || !prov.method) fail(spec.metricId + ': provenance.method fehlt — kein Wert ohne Berechnungsgrundlage');
    if (!prov.version) fail(spec.metricId + ': provenance.version fehlt — Formelkorrekturen waeren unsichtbar');
    var cov = spec.coverage || {};
    var eligible = (cov.eligible != null) ? cov.eligible : null;
    var available = (cov.available != null) ? cov.available : null;
    if (eligible == null || available == null) fail(spec.metricId + ': coverage.eligible/available fehlt');
    if (available > eligible) fail(spec.metricId + ': coverage.available > eligible');
    var pct = eligible > 0 ? Math.round(available / eligible * 100) : 0;
    var value = (spec.value !== undefined) ? spec.value : null;
    var status;
    if (value == null || available === 0) { status = 'none'; value = null; }
    else if (available === eligible && eligible > 0) status = 'complete';
    else status = 'partial';
    return {
      schema: 'metric-envelope@' + VERSION,
      metricId: spec.metricId,
      value: value,
      unit: spec.unit != null ? spec.unit : null,
      period: { type: p.type, days: p.days != null ? p.days : null, startDate: p.startDate, endDate: p.endDate },
      coverage: { eligible: eligible, available: available, pct: pct, status: status },
      provenance: {
        method: prov.method, version: prov.version,
        sources: Array.isArray(prov.sources) ? prov.sources : [],
        inputs: prov.inputs || null,
        assumptions: Array.isArray(prov.assumptions) ? prov.assumptions : []
      },
      status: status,
      reason: status === 'none' ? (spec.reason || 'keine auswertbaren Eingaben') : (spec.reason || null)
    };
  }

  /* Die Anzeigezeile des Darstellungsvertrags:
       „2 von 9 Einheiten · RPE ≥ 7 · letzte 7 Tage"
     unitNoun benennt, WAS gezaehlt wurde (Einheiten, Laeufe, Tage). */
  function line(env, unitNoun) {
    if (!env) return null;
    var noun = unitNoun || 'Einheiten';
    var covTxt = env.coverage.available + ' von ' + env.coverage.eligible + ' ' + noun;
    var m = METHOD_LABELS[env.provenance.method] || env.provenance.method;
    var per;
    if (env.period.type === 'rolling') per = 'letzte ' + env.period.days + ' Tage';
    else if (env.period.type === 'calendar_week') per = 'Kalenderwoche';
    else per = env.period.startDate + '–' + env.period.endDate;
    return covTxt + ' · ' + m + ' · ' + per;
  }

  /* Phase 2.2: Datenmodell fuer ECHTE HF-Zonen — vorbereitet, bewusst NICHT
     befuellt. Es existiert kein Zonen-Datenpfad; jede Befuellung ohne
     Quellenvertrag waere eine Erfindung. */
  function heartRateZonesTemplate() {
    return { z1Sec: null, z2Sec: null, z3Sec: null, z4Sec: null, z5Sec: null,
      source: null, zoneModelId: null };
  }

  var api = { VERSION: VERSION, METHOD_LABELS: METHOD_LABELS,
    create: create, line: line, heartRateZonesTemplate: heartRateZonesTemplate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.metricEnvelope = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
