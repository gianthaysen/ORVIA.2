/* ============================================================
   ORVIA · metric-resolver — Source-Auflösung für user_metrics (PURE)
   ------------------------------------------------------------
   Reine Domain-Logik: kein DOM, kein localStorage, kein Supabase,
   non-mutating, deterministisch (opts.today ist PFLICHT — kein
   Date.now()-Default im Kern; ein UI-Wrapper darf today setzen).
   Regeln exakt nach docs/GARMIN-INTEGRATION-DESIGN.md §4:
     1. Nur validity==='valid' kandidiert (suspect/invalid = Rohhistorie).
     2. Aktiver manueller Override gewinnt, SOLANGE keine gültige
        automatische Messung (device_measurement / provider_calculation /
        lab_test) mit measured_at NACH dem Override existiert.
        settings.manualOverrideEnabled===false deaktiviert Overrides.
     3. Sonst: höchster Prioritätsrang (registry.priorityOf;
        settings.preferredSource hebt den bevorzugten source_type auf
        Rang 95) unter FRISCHEN Kandidaten (Alter in Tagen relativ zu
        opts.today <= staleDays). Gleichstand → jüngstes measured_at,
        dann jüngstes imported_at.
     4. Keine frischen Kandidaten → jüngster gültiger Wert, stale:true.
     5. Gar nichts → null (Feld ausblenden, §10).
   Ergebnis-Feld `source` ist die grobe Herkunft für die UI
   ('automatic' | 'override' | 'manual' | 'estimate' | 'historical' |
   'unknown'); Provider-/Gerätedetails stehen im normalisierten `entry`.
   Vertragstest: supabase/tests/metric_resolver_test.mjs
   ============================================================ */
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var MS_PER_DAY = 86400000;
  var PREFERRED_RANK = 95;
  var AUTOMATIC_SOURCES = {
    device_measurement: true,
    provider_calculation: true,
    lab_test: true
  };

  function defaultRegistry() {
    if (O.metricRegistry) return O.metricRegistry;
    // Node/Test-Fallback (Browser lädt metric-registry.js vor diesem Modul).
    if (typeof require === 'function') {
      try { return require('./metric-registry.js'); } catch (e) { /* unten null */ }
    }
    return null;
  }

  // ---------- kleine, reine Helfer ----------------------------------

  function pick(row, snakeKey, camelKey) {
    if (row[snakeKey] !== undefined && row[snakeKey] !== null) return row[snakeKey];
    if (row[camelKey] !== undefined && row[camelKey] !== null) return row[camelKey];
    return null;
  }

  function strOrNull(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return null; // Objekte/Arrays sind hier korrupt → null
  }

  function numOrNull(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      var n = Number(v);
      if (isFinite(n)) return n;
    }
    return null;
  }

  function isOverrideEntry(e) {
    return e.isManualOverride === true || e.sourceType === 'manual_override';
  }

  // Zeitstempel für Vergleiche; unparsebar → -Infinity (verliert jeden Tie).
  function tsOf(e) {
    var t = e.measuredAt != null ? Date.parse(e.measuredAt) : NaN;
    if (!isNaN(t)) return t;
    t = e.metricDate != null ? Date.parse(String(e.metricDate).slice(0, 10) + 'T00:00:00Z') : NaN;
    return isNaN(t) ? -Infinity : t;
  }

  function importedTsOf(e) {
    var t = e.importedAt != null ? Date.parse(e.importedAt) : NaN;
    return isNaN(t) ? -Infinity : t;
  }

  // Alter in Kalendertagen relativ zu today (YYYY-MM-DD); unbestimmbar → Infinity.
  function ageDays(e, today) {
    var d = e.metricDate ? String(e.metricDate).slice(0, 10) : null;
    if (!d) return Infinity;
    var a = Date.parse(d + 'T00:00:00Z');
    var b = Date.parse(today + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return Infinity;
    return Math.round((b - a) / MS_PER_DAY);
  }

  // true wenn a "besser" als b: höherer Rang, dann jüngeres measured_at,
  // dann jüngeres imported_at, dann stabil über id (volle Determinismus).
  function betterThan(a, b, rankFn) {
    var ra = rankFn(a), rb = rankFn(b);
    if (ra !== rb) return ra > rb;
    var ta = tsOf(a), tb = tsOf(b);
    if (ta !== tb) return ta > tb;
    var ia = importedTsOf(a), ib = importedTsOf(b);
    if (ia !== ib) return ia > ib;
    return String(a.id || '') > String(b.id || '');
  }

  function bestOf(list, rankFn) {
    var best = null;
    for (var i = 0; i < list.length; i++) {
      if (best === null || betterThan(list[i], best, rankFn)) best = list[i];
    }
    return best;
  }

  function newestOf(list) {
    return bestOf(list, function () { return 0; });
  }

  function coarseSource(sourceType, isOverride) {
    if (isOverride) return 'override';
    if (AUTOMATIC_SOURCES[sourceType]) return 'automatic';
    if (sourceType === 'manual_entry') return 'manual';
    if (sourceType === 'orvia_estimate') return 'estimate';
    if (sourceType === 'historical') return 'historical';
    return 'unknown';
  }

  function requireToday(opts, fn) {
    var today = opts && opts.today;
    if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      throw new Error('metric-resolver.' + fn + ": opts.today ('YYYY-MM-DD') ist Pflicht — kein Date.now()-Default im Kern (Determinismus).");
    }
    return today;
  }

  // ---------- API ---------------------------------------------------

  /* DB-Zeile (snake_case) → internes camelCase-Entry.
     Tolerant: null/korrupter Input → null; unbekannter source_type →
     priority 0; fehlendes measured_at → Fallback metric_date.
     Idempotent: normalizeEntry(normalizeEntry(x)) strukturell identisch. */
  function normalizeEntry(row, registry) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    var R = registry || defaultRegistry();

    var metricType = strOrNull(pick(row, 'metric_type', 'metricType'));
    var sourceType = strOrNull(pick(row, 'source_type', 'sourceType'));
    var measuredAt = strOrNull(pick(row, 'measured_at', 'measuredAt'));
    var metricDate = strOrNull(pick(row, 'metric_date', 'metricDate'));
    if (metricDate) metricDate = metricDate.slice(0, 10);
    if (!measuredAt && metricDate) measuredAt = metricDate + 'T00:00:00Z';
    if (!metricDate && measuredAt && !isNaN(Date.parse(measuredAt))) {
      metricDate = measuredAt.slice(0, 10);
    }

    var rawOverride = pick(row, 'is_manual_override', 'isManualOverride');

    return {
      id: strOrNull(row.id),
      metricType: metricType,
      valueNumeric: numOrNull(pick(row, 'value_numeric', 'valueNumeric')),
      valueText: strOrNull(pick(row, 'value_text', 'valueText')),
      unit: strOrNull(pick(row, 'unit', 'unit')),
      metricDate: metricDate,
      measuredAt: measuredAt,
      importedAt: strOrNull(pick(row, 'imported_at', 'importedAt')),
      createdAt: strOrNull(pick(row, 'created_at', 'createdAt')),
      sourceType: sourceType,
      sourceRecordId: strOrNull(pick(row, 'source_record_id', 'sourceRecordId')),
      providerId: strOrNull(pick(row, 'provider_id', 'providerId')),
      deviceId: strOrNull(pick(row, 'device_id', 'deviceId')),
      quality: strOrNull(pick(row, 'quality', 'quality')),
      confidence: strOrNull(pick(row, 'confidence', 'confidence')),
      validity: strOrNull(pick(row, 'validity', 'validity')),
      isManualOverride: rawOverride === true || sourceType === 'manual_override',
      originalMetricId: strOrNull(pick(row, 'original_metric_id', 'originalMetricId')),
      overrideReason: strOrNull(pick(row, 'override_reason', 'overrideReason')),
      priority: (R && typeof R.priorityOf === 'function') ? R.priorityOf(sourceType) : 0
    };
  }

  /* Aktiver Wert einer Metrik nach §4. entries: DB-Zeilen oder bereits
     normalisierte Entries (beliebig gemischt). opts:
       today   'YYYY-MM-DD' (PFLICHT)
       settings {editMode?, preferredSource?, manualOverrideEnabled?}
       registry Registry-Override (Default: ORVIA.metricRegistry) */
  function resolveMetric(metricId, entries, opts) {
    opts = opts || {};
    var today = requireToday(opts, 'resolveMetric');
    var R = opts.registry || defaultRegistry();
    if (!R) throw new Error('metric-resolver.resolveMetric: keine Registry verfügbar (metric-registry.js laden oder opts.registry setzen).');
    var def = typeof R.byId === 'function' ? R.byId(metricId) : null;
    if (!def) return null; // unbekannte Metrik → kein Ergebnis, kein Crash

    var settings = opts.settings || {};
    var overridesEnabled = settings.manualOverrideEnabled !== false;

    var all = [];
    var list = Array.isArray(entries) ? entries : [];
    for (var i = 0; i < list.length; i++) {
      var e = normalizeEntry(list[i], R);
      if (e && e.metricType === metricId) all.push(e);
    }
    if (!all.length) return null;

    // Regel 1: nur valide Werte kandidieren; Overrides ggf. deaktiviert.
    var candidates = [];
    for (var c = 0; c < all.length; c++) {
      if (all[c].validity !== 'valid') continue;
      if (!overridesEnabled && isOverrideEntry(all[c])) continue;
      candidates.push(all[c]);
    }
    if (!candidates.length) return null;

    var rankOf = function (e) {
      if (settings.preferredSource && e.sourceType === settings.preferredSource) return PREFERRED_RANK;
      return (typeof R.priorityOf === 'function') ? R.priorityOf(e.sourceType) : (e.priority || 0);
    };

    var winner = null;
    var stale = false;

    // Regel 2: aktiver manueller Override.
    if (overridesEnabled) {
      var overrides = candidates.filter(isOverrideEntry);
      if (overrides.length) {
        var latestOverride = newestOf(overrides);
        var oTs = tsOf(latestOverride);
        var endedByNewerAuto = candidates.some(function (e) {
          return AUTOMATIC_SOURCES[e.sourceType] === true && tsOf(e) > oTs;
        });
        if (!endedByNewerAuto) {
          winner = latestOverride;
          stale = ageDays(winner, today) > def.staleDays;
        }
      }
    }

    if (!winner) {
      // Regel 3: höchster Rang unter frischen Kandidaten.
      var fresh = candidates.filter(function (e) { return ageDays(e, today) <= def.staleDays; });
      if (fresh.length) {
        winner = bestOf(fresh, rankOf);
        stale = false;
      } else {
        // Regel 4: jüngster gültiger, als veraltet markiert.
        winner = newestOf(candidates);
        stale = true;
      }
    }

    var winnerIsOverride = isOverrideEntry(winner);
    var overriddenOriginal = null;
    if (winnerIsOverride && winner.originalMetricId) {
      for (var k = 0; k < all.length; k++) {
        if (all[k].id && all[k].id === winner.originalMetricId) { overriddenOriginal = all[k]; break; }
      }
    }

    return {
      metricType: metricId,
      value: winner.valueNumeric,
      valueText: winner.valueText,
      unit: winner.unit || def.unit || null,
      source: coarseSource(winner.sourceType, winnerIsOverride),
      sourceType: winner.sourceType,
      measuredAt: winner.measuredAt,
      metricDate: winner.metricDate,
      stale: !!stale,
      isOverride: winnerIsOverride,
      overriddenOriginal: overriddenOriginal,
      editMode: settings.editMode || def.editMode,
      entry: winner
    };
  }

  /* Alle Metriken auf einmal: gruppiert selbst nach metric_type,
     ignoriert unbekannte metric_types, liefert NUR Metriken mit Ergebnis. */
  function resolveAll(entries, opts) {
    opts = opts || {};
    requireToday(opts, 'resolveAll');
    var R = opts.registry || defaultRegistry();
    if (!R) throw new Error('metric-resolver.resolveAll: keine Registry verfügbar.');

    var groups = {};
    var list = Array.isArray(entries) ? entries : [];
    for (var i = 0; i < list.length; i++) {
      var e = normalizeEntry(list[i], R);
      if (!e || !e.metricType) continue;
      if (!R.byId(e.metricType)) continue; // unbekannte Metrik ignorieren
      (groups[e.metricType] = groups[e.metricType] || []).push(e);
    }

    var out = {};
    for (var id in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, id)) continue;
      var r = resolveMetric(id, groups[id], opts);
      if (r) out[id] = r;
    }
    return out;
  }

  // ---------- Anzeige (reine Stringfunktion, keine UI-Abhängigkeit) --

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function formatPace(secPerKm) {
    var m = Math.floor(secPerKm / 60);
    var s = Math.round(secPerKm - m * 60);
    if (s === 60) { m += 1; s = 0; }
    return m + ':' + pad2(s) + ' min/km';
  }

  function formatDuration(totalSec) {
    var sec = Math.round(totalSec);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h + ':' + pad2(m) + ':' + pad2(s);
  }

  /* Formatiert ein resolveMetric-Ergebnis: decimals + Einheit (de-DE
     Komma), Text-Metriken value_text, Pace 's/km' als 'M:SS min/km',
     Zeit 's' als 'H:MM:SS'. */
  function displayValue(resolved, registry) {
    if (!resolved || typeof resolved !== 'object') return '';
    var R = registry || defaultRegistry();
    var def = (R && typeof R.byId === 'function') ? R.byId(resolved.metricType) : null;
    if (def && def.valueKind === 'text') {
      return resolved.valueText != null ? String(resolved.valueText) : '';
    }
    var v = resolved.value;
    if (typeof v !== 'number' || !isFinite(v)) {
      return resolved.valueText != null ? String(resolved.valueText) : '';
    }
    var unit = resolved.unit || (def && def.unit) || null;
    if (unit === 's/km') return formatPace(v);
    if (unit === 's') return formatDuration(v);
    var decimals = (def && def.decimals != null) ? def.decimals : 0;
    var s = v.toFixed(decimals).replace('.', ',');
    return unit ? s + ' ' + unit : s;
  }

  /* Spec §10: anzeigen nur, wenn ein aufgelöster Wert existiert ODER
     historische Einträge vorhanden sind. settings.displayEnabled===false
     blendet die Metrik immer aus. */
  function shouldDisplay(metricId, entries, opts) {
    opts = opts || {};
    var settings = opts.settings || {};
    if (settings.displayEnabled === false) return false;
    var R = opts.registry || defaultRegistry();
    if (!R || !R.byId(metricId)) return false;
    if (resolveMetric(metricId, entries, opts)) return true;
    var list = Array.isArray(entries) ? entries : [];
    for (var i = 0; i < list.length; i++) {
      var e = normalizeEntry(list[i], R);
      if (e && e.metricType === metricId) return true; // Historie vorhanden
    }
    return false;
  }

  var API = {
    normalizeEntry: normalizeEntry,
    resolveMetric: resolveMetric,
    resolveAll: resolveAll,
    displayValue: displayValue,
    shouldDisplay: shouldDisplay
  };

  O.metricResolver = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
