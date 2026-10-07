/* ============================================================
   ORVIA · activity-streams (v8-447) — was eine Messreihe BEDEUTET.

   Eine Stelle, an der die Oberflaeche erfaehrt, welche Groesse in einer Messreihe steckt.
   Anlass: „cadence" war ein Feld fuer vier verschiedene Groessen —

     running_cadence_spm    Schritte je Minute (beide Beine)
     cycling_cadence_rpm    Kurbelumdrehungen je Minute
     swim_stroke_rate       Zuege je Minute
     rowing_stroke_rate     Schlaege je Minute

   — und der Garmin-Import hat fuer Laeufe das Feld `directRunCadence` gelesen. Das ist die
   Frequenz EINES Beins (im echten Mitschnitt 80), nicht die Schrittfrequenz
   (`directDoubleCadence`, 161). Angezeigt wurde der halbe Wert als „spm".

   Seit Details-Version 3 schreibt der Worker zu jeder Messreihe, was sie ist:
     metrics.stream_meta.<reihe> = { kind, unit, source, garmin_unit? }
   Dieses Modul liest das. Es RECHNET NICHTS UM — auch keine Verdopplung.

   Altbestand (Garmin, ohne stream_meta):
     Einheit 'rpm'  ⇒ der Worker hatte die Rad-Messreihe gewaehlt: gilt als Trittfrequenz.
     Einheit 'spm'  ⇒ er hatte `directRunCadence` ODER `directDoubleCadence` gewaehlt — am
                      gespeicherten Wert nicht unterscheidbar. status 'unverified': die
                      Oberflaeche zeigt keinen Wert, bis der Worker die Einheit neu von
                      Garmin geladen hat (geschieht von selbst, 10 Einheiten je Lauf).
   Andere Quellen (Datei-Import, manuell): unveraendert wie bisher.

   Rein: kein DOM, kein Speicher, kein Netz.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};

  var KINDS = {
    running_cadence_spm: { unit: 'spm', label: 'steps_per_minute' },
    cycling_cadence_rpm: { unit: 'rpm', label: 'revolutions_per_minute' },
    swim_stroke_rate:    { unit: 'spm', label: 'strokes_per_minute' },
    rowing_stroke_rate:  { unit: 'spm', label: 'strokes_per_minute' }
  };
  var CYCLING = { cycling: 1 };

  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function nums(arr) { var out = []; for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (typeof v === 'number' && isFinite(v)) out.push(v); } return out; }
  function stats(arr) {
    var n = nums(arr); if (!n.length) return { avg: null, max: null, n: 0 };
    var s = 0, mx = -Infinity; for (var i = 0; i < n.length; i++) { s += n[i]; if (n[i] > mx) mx = n[i]; }
    return { avg: Math.round(s / n.length), max: Math.round(mx), n: n.length };
  }

  /* Beschreibung einer Messreihe laut Worker (oder null). */
  function meta(owner, key) {
    var m = obj(owner && owner.metrics); var sm = m && obj(m.stream_meta);
    return (sm && obj(sm[key])) || null;
  }

  /* Kadenz der Aktivitaet `owner` (der Datensatz, der die Messreihen TRAEGT — bei einem
     Workout mit gekoppelter Uhr-Aufzeichnung ist das die Aufzeichnung).
     { status: 'ok' | 'unverified' | 'none', kind, unit, values, avg, max, source, legacy, reason } */
  function cadence(owner) {
    var out = { status: 'none', kind: null, unit: null, values: null, avg: null, max: null, source: null, legacy: false, reason: null };
    var m = obj(owner && owner.metrics), st = m && obj(m.streams);
    var arr = st && st.cadence;
    if (!Array.isArray(arr) || !nums(arr).length) return out;
    var md = meta(owner, 'cadence');
    if (md && KINDS[md.kind]) {
      var s1 = stats(arr);
      return { status: 'ok', kind: md.kind, unit: md.unit || KINDS[md.kind].unit, values: arr, avg: s1.avg, max: s1.max, source: md.source || null, legacy: false, reason: null };
    }
    var unit = (obj(m.stream_units) || {}).cadence || null;
    if (owner.source === 'garmin') {
      if (unit === 'rpm') { var s2 = stats(arr); return { status: 'ok', kind: 'cycling_cadence_rpm', unit: 'rpm', values: arr, avg: s2.avg, max: s2.max, source: null, legacy: true, reason: null }; }
      out.status = 'unverified'; out.legacy = true; out.reason = 'legacy_garmin_import'; out.unit = unit;
      return out;
    }
    /* keine Garmin-Zeile: Bedeutung wie bisher aus der Sportart (Datei-Import, manuell) */
    var k = CYCLING[owner.sportId] ? 'cycling_cadence_rpm' : 'running_cadence_spm';
    var s3 = stats(arr);
    return { status: 'ok', kind: k, unit: KINDS[k].unit, values: arr, avg: s3.avg, max: s3.max, source: null, legacy: true, reason: null };
  }

  /* Zeitachse der Messreihen: Sekunden seit Beginn je Messpunkt (gleiche Laenge und
     Reihenfolge wie jede andere Reihe) — oder null, wenn die Einheit noch keine traegt. */
  function timeAxis(owner) {
    var m = obj(owner && owner.metrics), st = m && obj(m.streams);
    var t = st && st.time;
    return (Array.isArray(t) && t.length > 1) ? t : null;
  }
  /* Messpunkte einer Reihe MIT Zeitbezug: [{ t, v }] — nur Punkte, an denen ein Wert vorliegt.
     Ohne Zeitachse null (Reihenfolge allein ist kein Zeitbezug; nichts wird gleichverteilt). */
  function points(owner, key) {
    var t = timeAxis(owner); if (!t) return null;
    var m = obj(owner.metrics), arr = m && obj(m.streams) && m.streams[key];
    if (!Array.isArray(arr) || arr.length !== t.length) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) { var v = arr[i], ti = t[i]; if (typeof v === 'number' && isFinite(v) && typeof ti === 'number' && isFinite(ti)) out.push({ t: ti, v: v }); }
    return out;
  }

  /* Auffaelligkeiten fuer die Entwicklung — NIE eine automatische Korrektur. */
  function qualityWarnings(owner) {
    var w = [];
    var c = cadence(owner);
    if (c.status === 'unverified') w.push({ code: 'cadence_unverified', detail: c.reason });
    if (c.status === 'ok' && c.kind === 'running_cadence_spm' && c.avg != null && c.avg < 110) w.push({ code: 'running_cadence_low', detail: c.avg });
    if (c.status === 'ok' && c.kind === 'cycling_cadence_rpm' && c.avg != null && c.avg > 140) w.push({ code: 'cycling_cadence_high', detail: c.avg });
    var t = timeAxis(owner);
    if (t) { for (var i = 1; i < t.length; i++) { if (!(t[i] >= t[i - 1])) { w.push({ code: 'time_axis_not_monotonic', detail: i }); break; } } }
    return w;
  }

  var api = { KINDS: Object.keys(KINDS), kindDef: function (k) { return KINDS[k] ? { unit: KINDS[k].unit } : null; },
    meta: meta, cadence: cadence, timeAxis: timeAxis, points: points, qualityWarnings: qualityWarnings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.activityStreams = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
