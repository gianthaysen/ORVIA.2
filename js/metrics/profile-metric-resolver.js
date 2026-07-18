/* ============================================================
   ORVIA · profile-metric-resolver — Brücke user_metrics → Profil (Phase 5)
   ------------------------------------------------------------
   Verbindet metricsRepository (I/O) + metric-resolver (pure Auflösung)
   mit den FLACHEN kanonischen Profilfeldern (weightKg, restingHrMeasured/
   rhrBaseline, hfMaxMeasured/hfMax) und liefert die Datengrundlage für
   die UI-Karte "Automatisch synchronisierte Daten".

   Architektur (GARMIN-INTEGRATION-DESIGN.md §9 Phase 5, ADR D1/D2/D6):
   - Entscheidungskern `buildCanonicalPatch` ist PURE (kein DOM, kein
     Supabase, kein Date.now()) → direkt in Node testbar.
   - Schreiben AUSSCHLIESSLICH über den offiziellen Pfad
     ORVIA.profile.updateSection('body', patch, ['body'], 'provider_sync')
     → _sectionMeta.body wird korrekt gestempelt, _perfSeedFromCanonical
     labelt ungeeditete Werte dann als 'garmin' (Doppelwelt-Fix Task 17).
   - Flache Felder bleiben flach (D1); KEINE Metric-Objekte im PROFILE.

   Schreibregeln (konservativ — im Zweifel NICHT schreiben):
     1. Nur aufgelöste Werte mit source 'automatic' oder 'override'
        (Provider-Messung bzw. bewusste Nutzerkorrektur in der Metrik-Welt).
        'manual'/'estimate'/'historical'/'unknown' speisen die kanonischen
        Felder NICHT — dafür ist der Profil-Editor zuständig.
     2. stale-Werte (resolved.stale) werden angezeigt, aber NIE in die
        kanonischen Felder geschrieben.
     3. Editor-Vorrang: hat der Nutzer die Section 'body' im Editor NACH
        dem measuredAt des aufgelösten Werts gespeichert
        (_sectionMeta.body.source==='editor' und updatedAt neuer), wird
        NICHT geschrieben — die bewusste Nutzereingabe gewinnt, bis eine
        NEUERE Messung eintrifft.
     4. Provider-Werte löschen nie ein kanonisches Feld (value==null ⇒ skip).
     5. Idempotenz: nach Rundung identische Werte erzeugen KEINEN Patch
        (kein Save-Loop, keine unnötigen Cloud-Writes).
   Vertragstest: supabase/tests/profile_metric_resolver_p5_test.mjs
   ============================================================ */
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  /* Mapping Metrik → flache kanonische Felder. `extra` bildet die in
     Task 17 festgeschriebenen Kopplungen ab (rhrBaseline folgt restingHr,
     hfMax folgt hfMaxMeasured — EINE HFmax-Welt). round: Nachkommastellen
     für den kanonischen Wert (Float-Rauschen ⇒ keine Schein-Änderungen). */
  var CANONICAL_MAP = [
    { metricId: 'weight_kg', field: 'weightKg', round: 1, extra: null },
    { metricId: 'resting_hr', field: 'restingHrMeasured', round: 0, extra: 'rhrBaseline' },
    { metricId: 'max_hr', field: 'hfMaxMeasured', round: 0, extra: 'hfMax' }
  ];

  var WRITE_SOURCES = { automatic: true, override: true };

  function _roundTo(v, decimals) {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    var f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
  }

  function _parseTs(iso) {
    var t = iso != null ? Date.parse(iso) : NaN;
    return isNaN(t) ? null : t;
  }

  /* Lokales Heute (YYYY-MM-DD) — gleiche Quelle wie metricsRepository:
     globales todayStr() falls geladen, sonst ORVIA.clock, sonst Date. */
  function todayLocal() {
    if (typeof root.todayStr === 'function') return root.todayStr();
    var now = new Date((O.clock && typeof O.clock.now === 'function') ? O.clock.now() : Date.now());
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /* profile_metric_settings-Zeilen (snake_case) → resolver-Settings einer
     Metrik. Fehlende Zeile ⇒ {} (Registry-Defaults greifen). PURE. */
  function settingsFor(settingsRows, metricId) {
    var rows = Array.isArray(settingsRows) ? settingsRows : [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || (r.metric_type || r.metricType) !== metricId) continue;
      var out = {};
      if (r.edit_mode != null) out.editMode = r.edit_mode;
      if (r.preferred_source != null) out.preferredSource = r.preferred_source;
      if (r.manual_override_enabled != null) out.manualOverrideEnabled = r.manual_override_enabled;
      if (r.display_enabled != null) out.displayEnabled = r.display_enabled;
      return out;
    }
    return {};
  }

  /* Alle Registry-Metriken gegen die Einträge auflösen (per-Metrik-Settings,
     die resolveAll nicht kann). Liefert NUR Metriken mit Ergebnis. PURE. */
  function resolveCurrent(entries, settingsRows, today) {
    var R = O.metricRegistry;
    var MR = O.metricResolver;
    if (!R || !MR) throw new Error('profile-metric-resolver: metric-registry/metric-resolver nicht geladen.');
    var out = {};
    var ids = R.ids();
    for (var i = 0; i < ids.length; i++) {
      var res = MR.resolveMetric(ids[i], entries, { today: today, settings: settingsFor(settingsRows, ids[i]) });
      if (res) out[ids[i]] = res;
    }
    return out;
  }

  /* ENTSCHEIDUNGSKERN (PURE): aufgelöste Metriken → Patch für die flachen
     kanonischen Felder nach den Schreibregeln 1-5 (Header). profile wird
     NICHT mutiert. Rückgabe: { patch, skipped:[{metricId, reason}] }. */
  function buildCanonicalPatch(resolvedMap, profile) {
    var patch = {};
    var skipped = [];
    var p = profile || {};
    var meta = p._sectionMeta && p._sectionMeta.body ? p._sectionMeta.body : null;
    var editorTs = (meta && meta.source === 'editor') ? _parseTs(meta.updatedAt) : null;

    for (var i = 0; i < CANONICAL_MAP.length; i++) {
      var map = CANONICAL_MAP[i];
      var res = resolvedMap ? resolvedMap[map.metricId] : null;
      if (!res) { skipped.push({ metricId: map.metricId, reason: 'no_value' }); continue; }
      if (!WRITE_SOURCES[res.source]) { skipped.push({ metricId: map.metricId, reason: 'source_' + res.source }); continue; }
      if (res.stale) { skipped.push({ metricId: map.metricId, reason: 'stale' }); continue; }
      var v = _roundTo(res.value, map.round);
      if (v == null) { skipped.push({ metricId: map.metricId, reason: 'null_value' }); continue; }
      if (editorTs != null) {
        var mTs = _parseTs(res.measuredAt);
        // Regel 3: unbeweisbar neuer (mTs null) oder älter/gleich alt wie die
        // letzte Editor-Speicherung ⇒ Nutzereingabe gewinnt.
        if (mTs == null || mTs <= editorTs) { skipped.push({ metricId: map.metricId, reason: 'editor_newer' }); continue; }
      }
      var changed = _roundTo(p[map.field], map.round) !== v;
      var extraChanged = map.extra ? _roundTo(p[map.extra], map.round) !== v : false;
      if (!changed && !extraChanged) { skipped.push({ metricId: map.metricId, reason: 'unchanged' }); continue; }
      patch[map.field] = v;
      if (map.extra) patch[map.extra] = v;
    }
    return { patch: patch, skipped: skipped };
  }

  function _entryTs(e) {
    var t = _parseTs(e.measuredAt);
    if (t != null) return t;
    return e.metricDate ? _parseTs(String(e.metricDate).slice(0, 10) + 'T00:00:00Z') : null;
  }

  /* Trend für die UI-Karte: jüngster ÄLTERER gültiger Zahlenwert derselben
     Metrik im Vergleich zum aufgelösten Gewinner. PURE. null, wenn kein
     Vorwert existiert oder der Gewinner keinen Zahlenwert hat. */
  function trendFor(metricId, entries, resolved) {
    var MR = O.metricResolver;
    if (!MR || !resolved || !resolved.entry || typeof resolved.value !== 'number' || !isFinite(resolved.value)) return null;
    var wTs = _entryTs(resolved.entry);
    if (wTs == null) return null;
    var list = Array.isArray(entries) ? entries : [];
    var prev = null, prevTs = null;
    for (var i = 0; i < list.length; i++) {
      var e = MR.normalizeEntry(list[i]);
      if (!e || e.metricType !== metricId || e.validity !== 'valid') continue;
      if (e.id && resolved.entry.id && e.id === resolved.entry.id) continue;
      if (typeof e.valueNumeric !== 'number' || !isFinite(e.valueNumeric)) continue;
      var t = _entryTs(e);
      if (t == null || t >= wTs) continue; // nur echte Vorwerte
      if (prev === null || t > prevTs) { prev = e; prevTs = t; }
    }
    if (!prev) return null;
    return { prevValue: prev.valueNumeric, prevDate: prev.metricDate, delta: resolved.value - prev.valueNumeric };
  }

  /* I/O: Messwerte + Settings + Provider/Geräte laden und auflösen.
     Grundlage für refresh() und die UI-Karte (Task 19: Wert/Quelle/Gerät/
     Zeitpunkt/Trend aus entries+resolved+providers+devices). */
  async function collect(opts) {
    opts = opts || {};
    var repo = O.repos && O.repos.metrics;
    if (!repo) return { success: false, data: null, error: { code: 'no_repo', message: 'metricsRepository nicht geladen.' } };
    var today = opts.today || todayLocal();

    var entriesRes = await repo.listRecent(opts.days || 400);
    if (!entriesRes.success) return { success: false, data: null, error: entriesRes.error };
    var settingsRes = await repo.getSettings();
    var settingsRows = settingsRes.success ? settingsRes.data : [];

    var providers = [], devices = [];
    if (opts.withMeta !== false) {
      var pRes = await repo.listProviders(); if (pRes.success) providers = pRes.data || [];
      var dRes = await repo.listDevices(); if (dRes.success) devices = dRes.data || [];
    }

    var resolved = resolveCurrent(entriesRes.data || [], settingsRows, today);
    return {
      success: true,
      error: null,
      data: { today: today, entries: entriesRes.data || [], settingsRows: settingsRows, resolved: resolved, providers: providers, devices: devices }
    };
  }

  /* Hauptlauf: auflösen und — falls nach den Schreibregeln nötig — über den
     offiziellen Pfad in die flachen kanonischen Felder schreiben.
     Kein Profil hydriert / kein Patch ⇒ sauberer No-Op (applied:{}). */
  async function refresh(opts) {
    var c = await collect(opts);
    if (!c.success) return c;

    var profile = root.PROFILE;
    if (!profile || !O.profile || typeof O.profile.updateSection !== 'function') {
      return { success: false, data: { resolved: c.data.resolved }, error: { code: 'profile_not_ready', message: 'PROFILE nicht hydriert oder Schreibpfad fehlt.' } };
    }

    var decision = buildCanonicalPatch(c.data.resolved, profile);
    if (Object.keys(decision.patch).length) {
      O.profile.updateSection('body', decision.patch, ['body'], 'provider_sync');
    }
    return {
      success: true,
      error: null,
      data: { today: c.data.today, resolved: c.data.resolved, applied: decision.patch, skipped: decision.skipped, providers: c.data.providers, devices: c.data.devices, entries: c.data.entries }
    };
  }

  var API = {
    CANONICAL_MAP: CANONICAL_MAP,
    todayLocal: todayLocal,
    settingsFor: settingsFor,
    trendFor: trendFor,
    resolveCurrent: resolveCurrent,
    buildCanonicalPatch: buildCanonicalPatch,
    collect: collect,
    refresh: refresh
  };

  O.profileMetricResolver = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
