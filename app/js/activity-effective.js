/* ============================================================
   ORVIA · activity-effective (v8-445) — Quelle / manuell / wirksam.

   EIN Modell fuer nachtraeglich korrigierte Messwerte einer Aktivitaet:

     Quellwert    was Garmin / das Workout / die Eingabe geliefert hat  (bleibt erhalten)
     manuell      was der Nutzer stattdessen angegeben hat             (optional)
     wirksam      manuell, falls vorhanden — sonst der Quellwert       (das rechnet die App)

   Vertrag am Aktivitaets-Objekt des Clients:
     - Das kanonische Feld (z. B. durationSeconds) traegt IMMER den WIRKSAMEN Wert.
       Deshalb rechnen Liste, Dashboard, Woche, Plan, Analyse, Story und Last ohne
       eigene Sonderregel richtig: sie lesen das Feld wie bisher.
     - Die Korrektur steht in metrics.corrections[<kennzahl>]:
         { manual, source, unit, at, method }
       `source` ist der Quellwert zum Zeitpunkt der Korrektur. `manual: null` mit
       method 'cleared' heisst: Korrektur zurueckgenommen (bleibt als Marke stehen,
       damit ein zweites Geraet die Ruecknahme nicht fuer „fehlt noch" haelt);
       `was` merkt dabei den zurueckgenommenen Wert, damit ein Objekt, das ihn noch
       im Feld traegt, erkannt und auf den Quellwert zurueckgestellt wird.
     - Auf dem Server bleibt die Spalte (duration_seconds) der Quellwert. Der Server
       rechnet die Dauer eines Workouts ohnehin aus den Zeitstempeln neu — genau das
       hat die Korrektur bisher wieder ueberschrieben (Fehler bis v8-444).

   Wo der Vertrag hergestellt wird (und nur dort): activityNormalize.normalizeActivityRecord,
   activityConfig.normalizeServerActivity, activityStore (Lesen, Mischen, Korrigieren).
   Alle anderen Stellen lesen nur.

   Altform: metrics.durationCorrection { fromMin, toMin, at, method } (seit 2026-08-05).
   Sie wird gelesen und beim Schreiben weiter mitgefuehrt — der Garmin-Worker schuetzt
   genau diesen Schluessel beim Nachladen von Details.

   Rein: kein DOM, kein Speicher, kein Netz. Nichts wird an Ort und Stelle veraendert.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};

  var KEY = 'corrections';
  var LEGACY_DURATION = 'durationCorrection';

  function num(v) { if (v == null || v === '') return null; var n = (typeof v === 'number') ? v : parseFloat(v); return isFinite(n) ? n : null; }
  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
  function nowIso() { return new Date().toISOString(); }

  /* ---- Kennzahlen ----------------------------------------------------------
     read(a)      Wert im kanonischen Feld (Einheit siehe unit)
     write(a, v)  setzt das kanonische Feld an einer KOPIE (a ist bereits kopiert)
     editable(a)  darf der Nutzer diese Kennzahl an dieser Aktivitaet korrigieren?
     Eine weitere Kennzahl ist ein weiterer Eintrag hier — Speicherform, Aufloesung,
     Abgleich und Tests gelten dann ohne Aenderung auch fuer sie. */
  var METRICS = {
    duration: {
      unit: 's', min: 60, max: 24 * 3600,
      read: function (a) { return num(a.durationSeconds); },
      write: function (a, v) { a.durationSeconds = v; },
      /* Stand heute wie seit 2026-08-05: nur abgeschlossene ORVIA-Workouts. */
      editable: function (a) { return !!a && (a.source === 'orvia_workout' || a.source === 'live') && a.status !== 'active'; }
    },
    /* Vorbereitet (Schwimmbad: Bahnen falsch erkannt ⇒ Distanz falsch). Aufloesung und
       Speicherform stehen und sind getestet; die Eingabe ist NICHT freigeschaltet, weil
       vom Geraet gelieferte Folgewerte (Durchschnittstempo) dann mitgezogen werden muessen. */
    distance: {
      unit: 'm', min: 1, max: 1000000,
      read: function (a) {
        var s = obj(a.summary) || {};
        if (num(s.distanceM) != null) return num(s.distanceM);
        if (num(s.distanceKm) != null) return Math.round(num(s.distanceKm) * 1000);
        return null;
      },
      write: function (a, v) {
        var s = Object.assign({}, obj(a.summary) || {});
        if (num(s.distanceM) != null || (num(s.distanceKm) == null && (a.sportId === 'swimming' || a.sportId === 'rowing'))) s.distanceM = v;
        else s.distanceKm = v / 1000;
        a.summary = s;
      },
      editable: function () { return false; }
    }
  };

  /* Gespeicherter Korrektursatz einer Kennzahl — neue Form zuerst, sonst Altform. */
  function record(a, key) {
    var m = obj(a && a.metrics) || {};
    var c = obj(m[KEY]);
    var r = c ? obj(c[key]) : null;
    if (r) return r;
    if (key === 'duration') {
      var l = obj(m[LEGACY_DURATION]);
      if (l && num(l.toMin) > 0) {
        return { manual: Math.round(num(l.toMin) * 60), source: num(l.fromMin) != null ? Math.round(num(l.fromMin) * 60) : null,
          unit: 's', at: l.at || null, method: 'manual', legacy: true };
      }
    }
    return null;
  }

  /* Aufloesung: { key, unit, sourceValue, manualValue, effectiveValue, source, corrected, correctedAt, method }
     source: 'manual' | 'source' | null (kein Wert bekannt). */
  function resolveMetric(a, key) {
    var def = METRICS[key];
    var out = { key: key, unit: def ? def.unit : null, sourceValue: null, manualValue: null, effectiveValue: null,
      source: null, corrected: false, correctedAt: null, method: null };
    if (!def || !a || typeof a !== 'object') return out;
    var cur = def.read(a);
    var r = record(a, key);
    var manual = r ? num(r.manual) : null;
    if (manual == null) {
      /* Keine Korrektur — oder eine zurueckgenommene: traegt das Feld noch den zurueckgenommenen
         Wert (`was`), gilt der gemerkte Quellwert; sonst ist das Feld selbst die Quelle. */
      var src0 = cur;
      if (r && num(r.source) != null && (cur == null || cur === num(r.was))) src0 = num(r.source);
      out.sourceValue = src0; out.effectiveValue = src0; out.source = src0 != null ? 'source' : null;
      return out;
    }
    /* Das Feld traegt entweder schon den wirksamen Wert (== manuell; dann gilt der
       gemerkte Quellwert) oder noch den Quellwert (frische Serverzeile; dann gilt er). */
    var rec = num(r.source);
    out.sourceValue = (cur != null && cur !== manual) ? cur : (rec != null ? rec : cur);
    out.manualValue = manual; out.effectiveValue = manual; out.source = 'manual';
    out.corrected = true; out.correctedAt = r.at || null; out.method = r.method || 'manual';
    return out;
  }
  function getEffectiveMetric(a, key) { return resolveMetric(a, key).effectiveValue; }
  function isCorrected(a, key) { return resolveMetric(a, key).corrected; }
  function isEditable(a, key) { var def = METRICS[key]; try { return !!(def && def.editable(a)); } catch (e) { return false; } }
  function hasAnyRecord(a) {
    var m = obj(a && a.metrics); if (!m) return false;
    return !!(obj(m[KEY]) || obj(m[LEGACY_DURATION]));
  }

  function _legacyDuration(src, manual, at) {
    return { fromMin: src != null ? Math.round(src / 60) : null, toMin: Math.round(manual / 60), at: at, method: 'manual_correction' };
  }

  /* Die Altform der Dauer ist ein SPIEGEL des Satzes: vorhanden genau dann, wenn korrigiert.
     Das versionierte Belastungsmodell (engine/load-history) und der Garmin-Worker lesen sie. */
  function _mirrorLegacy(metrics, corr) {
    var d = corr && obj(corr.duration);
    if (d && num(d.manual) != null) metrics[LEGACY_DURATION] = _legacyDuration(num(d.source), num(d.manual), d.at || null);
    else if (d) delete metrics[LEGACY_DURATION];
  }

  /* Vertrag herstellen: kanonische Felder auf den wirksamen Wert bringen, Altform in die
     neue Form ueberfuehren. Idempotent. Ohne Korrektur kommt DASSELBE Objekt zurueck
     (kein Kopieren von 200 Zeilen bei jedem Lesen). */
  function applyEffective(a) {
    if (!a || typeof a !== 'object' || !hasAnyRecord(a)) return a;
    var out = null, metrics = null, corr = null;
    Object.keys(METRICS).forEach(function (key) {
      var def = METRICS[key];
      var r = record(a, key);
      if (!r) return;
      var res = resolveMetric(a, key);
      var cur = def.read(a);
      if (!res.corrected) {                                         // zurueckgenommen: Feld ggf. zurueck auf die Quelle
        var stale = res.effectiveValue != null && cur !== res.effectiveValue;
        var oldForm = key === 'duration' && !r.legacy && !!obj((obj(a.metrics) || {})[LEGACY_DURATION]);   // Altform neben der Ruecknahme
        if (stale || oldForm) {
          if (!out) { out = Object.assign({}, a); metrics = Object.assign({}, obj(a.metrics) || {}); corr = Object.assign({}, obj(metrics[KEY]) || {}); }
          if (stale) def.write(out, res.effectiveValue);
        }
        return;
      }
      var same = !r.legacy && cur === res.manualValue && num(r.source) === res.sourceValue
        && (key !== 'duration' || !!obj((obj(a.metrics) || {})[LEGACY_DURATION]));
      if (same) return;
      if (!out) { out = Object.assign({}, a); metrics = Object.assign({}, obj(a.metrics) || {}); corr = Object.assign({}, obj(metrics[KEY]) || {}); }
      corr[key] = { manual: res.manualValue, source: res.sourceValue, unit: def.unit, at: res.correctedAt, method: res.method || 'manual' };
      def.write(out, res.manualValue);
    });
    if (!out) return a;
    metrics[KEY] = corr; _mirrorLegacy(metrics, corr); out.metrics = metrics;
    return out;
  }

  /* Zwei Staende derselben Aktivitaet (dieses Geraet / Server): je Kennzahl gilt der
     JUENGERE Korrektursatz (Feld `at`; gleich alt ⇒ target bleibt). Eine Ruecknahme ist
     selbst ein Satz und setzt sich genauso durch. Uebernimmt nur die Saetze — die Felder
     stellt danach applyEffective her. Ohne Aenderung kommt DASSELBE Objekt zurueck. */
  function adoptNewer(target, other) {
    if (!target || typeof target !== 'object' || !other || !hasAnyRecord(other)) return target;
    var out = null, metrics = null, corr = null;
    Object.keys(METRICS).forEach(function (key) {
      var ro = record(other, key);
      if (!ro) return;
      var rt = record(target, key);
      if (rt && String(rt.at || '') >= String(ro.at || '')) return;
      if (!out) { out = Object.assign({}, target); metrics = Object.assign({}, obj(target.metrics) || {}); corr = Object.assign({}, obj(metrics[KEY]) || {}); }
      corr[key] = { manual: num(ro.manual), source: num(ro.source), unit: METRICS[key].unit, at: ro.at || null, method: ro.method || 'manual' };
      /* Ruecknahme: `was` ist der Wert, den DIESES Objekt noch im Feld tragen kann — seine eigene
         bisherige Korrektur (es kann eine spaetere des anderen Geraets nie gesehen haben). */
      if (num(ro.manual) == null) {
        var mine = rt ? num(rt.manual) : null;
        var was = mine != null ? mine : num(ro.was);
        if (was != null) corr[key].was = was;
      }
    });
    if (!out) return target;
    metrics[KEY] = corr; _mirrorLegacy(metrics, corr); out.metrics = metrics;
    return out;
  }

  /* Manuellen Wert setzen. Rueckgabe { ok, activity, resolved } bzw. { ok:false, error }.
     Bei wiederholter Korrektur bleibt `source` der URSPRUENGLICHE Quellwert. */
  function setManual(a, key, value, meta) {
    var def = METRICS[key];
    if (!def) return { ok: false, error: 'unknown_metric' };
    if (!a || typeof a !== 'object') return { ok: false, error: 'no_activity' };
    var v = num(value);
    if (v == null) return { ok: false, error: 'invalid_value' };
    v = Math.round(v);
    if (v < def.min || v > def.max) return { ok: false, error: 'out_of_range' };
    var before = resolveMetric(a, key);
    var at = (meta && meta.at) || nowIso();
    var out = Object.assign({}, a);
    var metrics = Object.assign({}, obj(a.metrics) || {});
    var corr = Object.assign({}, obj(metrics[KEY]) || {});
    corr[key] = { manual: v, source: before.sourceValue, unit: def.unit, at: at, method: (meta && meta.method) || 'manual' };
    metrics[KEY] = corr; _mirrorLegacy(metrics, corr);
    out.metrics = metrics;
    def.write(out, v);
    return { ok: true, activity: out, resolved: resolveMetric(out, key), previous: before };
  }

  /* Korrektur zuruecknehmen: Feld zurueck auf den Quellwert, Marke bleibt stehen. */
  function clearManual(a, key, meta) {
    var def = METRICS[key];
    if (!def) return { ok: false, error: 'unknown_metric' };
    if (!a || typeof a !== 'object') return { ok: false, error: 'no_activity' };
    var before = resolveMetric(a, key);
    if (!before.corrected) return { ok: true, activity: a, resolved: before, previous: before, unchanged: true };
    var out = Object.assign({}, a);
    var metrics = Object.assign({}, obj(a.metrics) || {});
    var corr = Object.assign({}, obj(metrics[KEY]) || {});
    corr[key] = { manual: null, source: before.sourceValue, was: before.manualValue, unit: def.unit, at: (meta && meta.at) || nowIso(), method: 'cleared' };
    metrics[KEY] = corr; _mirrorLegacy(metrics, corr);
    out.metrics = metrics;
    if (before.sourceValue != null) def.write(out, before.sourceValue);
    return { ok: true, activity: out, resolved: resolveMetric(out, key), previous: before };
  }

  var api = {
    KEY: KEY, LEGACY_DURATION: LEGACY_DURATION,
    /* Schluessel in activities.metrics, die der Client fuehrt (Abgleich mit dem Server). */
    OWNED_METRIC_KEYS: [KEY, LEGACY_DURATION],
    metricKeys: function () { return Object.keys(METRICS); },
    metricDef: function (key) { var d = METRICS[key]; return d ? { unit: d.unit, min: d.min, max: d.max } : null; },
    resolveMetric: resolveMetric, getEffectiveMetric: getEffectiveMetric,
    isCorrected: isCorrected, isEditable: isEditable,
    applyEffective: applyEffective, adoptNewer: adoptNewer, setManual: setManual, clearManual: clearManual
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.activityEffective = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
