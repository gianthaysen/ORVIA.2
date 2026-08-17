/* ============================================================
   ORVIA · checkin-field-resolver — Garmin-Werte für den Check-in (PURE)
   ------------------------------------------------------------
   Phase 6 (GARMIN-INTEGRATION-DESIGN.md §9): entscheidet je Registry-Feld
   (js/checkin-fields.js), ob die Frage durch einen frischen, automatisch
   synchronisierten user_metrics-Wert ERSETZT wird ('auto') oder gestellt
   bleibt ('ask'). Kein DOM, kein Supabase, deterministisch (today Pflicht).

   Auto-Regeln (konservativ — im Zweifel fragen):
     1. Feld hat metricId UND metric-resolver liefert ein Ergebnis.
     2. Quelle 'automatic' oder 'override' — manuelle/geschätzte/historische
        Werte ersetzen keine Frage.
     3. Nicht stale UND Alter (metricDate vs. today) <= autoMaxAgeDays
        (Schlaf/HFR/HRV: letzte Nacht ⇒ 1; Body Battery: tagesaktuell ⇒ 0).
     4. Wert vorhanden und aufs Feld abbildbar (Zahl gerundet in den
        Feldgrenzen; hrv_status-Text auf Good/Balanced/Low mappbar).
   Fallback ist IMMER 'ask' — Sync-Ausfall degradiert zur manuellen Frage.
   Vertragstest: supabase/tests/checkin_field_resolver_p6_test.mjs
   ============================================================ */
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var MS_PER_DAY = 86400000;
  var WRITE_SOURCES = { automatic: true, override: true };

  /* Garmin-HRV-Statustexte → Chip-Werte der UI. Unbekannte Texte ⇒ null (ask). */
  var HRV_STATUS_MAP = {
    good: 'Good', balanced: 'Balanced', low: 'Low',
    unbalanced: 'Low', poor: 'Low'
  };

  function ageDays(metricDate, today) {
    if (!metricDate || !today) return Infinity;
    var a = Date.parse(String(metricDate).slice(0, 10) + 'T00:00:00Z');
    var b = Date.parse(String(today).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return Infinity;
    return Math.round((b - a) / MS_PER_DAY);
  }

  function mapValue(field, resolved) {
    if (field.kind === 'chipsText') {
      var t = resolved.valueText != null ? String(resolved.valueText).trim().toLowerCase() : null;
      return (t && HRV_STATUS_MAP[t]) ? HRV_STATUS_MAP[t] : null;
    }
    var v = resolved.value;
    if (typeof v !== 'number' || !isFinite(v)) return null;
    v = Math.round(v);
    // Feldgrenzen: number-Felder über LIM-Semantik hinaus hier nur grob —
    // der metric-resolver garantiert bereits plausible (validity==='valid').
    if (field.kind === 'sleep' || field.kind === 'range') {
      if (field.min != null && v < field.min) return null;
      if (field.max != null && v > field.max) return null;
    }
    return v;
  }

  function fmtSleep(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h + 'h ' + (m < 10 ? '0' : '') + m + 'min';
  }

  /* Kompakte Anzeige für die "Automatisch von Garmin"-Zeile. */
  function displayText(field, value) {
    if (field.autoUnit === 'sleep') return fmtSleep(value);
    if (field.autoUnit === 'text') return String(value);
    return value + (field.autoUnit ? ' ' + field.autoUnit : '');
  }

  /* Kern: Registry-Felder + metric-resolver-Ergebnisse → Auto-Map.
     resolvedMap: {metricId: resolveMetric-Ergebnis} (z. B. aus
     profileMetricResolver.collect().data.resolved). Rückgabe:
     { key: {value, text, metricId, metricDate, measuredAt, source} } —
     NUR Felder, die die Frage wirklich ersetzen dürfen. */
  function resolveCheckinFields(fields, resolvedMap, opts) {
    opts = opts || {};
    var today = opts.today;
    if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      throw new Error("checkin-field-resolver: opts.today ('YYYY-MM-DD') ist Pflicht.");
    }
    var out = {};
    var list = Array.isArray(fields) ? fields : [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (!f || !f.metricId) continue;
      var res = resolvedMap ? resolvedMap[f.metricId] : null;
      if (!res) continue;
      if (!WRITE_SOURCES[res.source]) continue;
      if (res.stale) continue;
      var maxAge = f.autoMaxAgeDays != null ? f.autoMaxAgeDays : 1;
      if (ageDays(res.metricDate, today) > maxAge) continue;
      var v = mapValue(f, res);
      if (v == null) continue;
      out[f.key] = {
        value: v,
        text: displayText(f, v),
        metricId: f.metricId,
        metricDate: res.metricDate,
        measuredAt: res.measuredAt,
        source: 'garmin'
      };
    }
    return out;
  }

  var API = {
    resolveCheckinFields: resolveCheckinFields,
    displayText: displayText,
    HRV_STATUS_MAP: HRV_STATUS_MAP
  };

  O.checkinFieldResolver = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
