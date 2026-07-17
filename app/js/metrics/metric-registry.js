/* ============================================================
   ORVIA · metric-registry — kanonischer Metrik-Katalog (SSOT)
   ------------------------------------------------------------
   EINE Quelle der Wahrheit für alle automatisch synchronisierbaren
   und berechneten Metriken. Provider-neutral: kein Garmin-Wissen hier.
   Konsumenten:
     - js/metrics/metric-resolver.js  (Source-Auflösung)
     - js/repos/metricsRepository.js  (user_metrics Lese/Schreib-Pfad)
     - garmin-worker (Python) über generiertes JSON
       (node js/metrics/export-registry.mjs > ../garmin-worker/orvia_worker/metric_registry.json)
   Vertragstest: supabase/tests/metric_registry_test.mjs
   ------------------------------------------------------------
   Felder je Metrik:
     id            kanonischer metric_type (== user_metrics.metric_type)
     label         deutsches UI-Label
     category      body | cardio | sleep | daily_activity | performance | load_recovery
     valueKind     numeric | text
     unit          kanonische Einheit (null bei text)
     decimals      Anzeige-Nachkommastellen
     dataClass     auto_measurable | calculated   (subjektive Werte leben NICHT hier,
                   sondern im Check-in; manuell-statische Felder im Profilmodell)
     editMode      automatic_locked | automatic_override_allowed | calculated_read_only
     plausible     [min, max] — außerhalb: validity='invalid' (Rohwert wird gespeichert,
                   aber nie als aktiver Wert aufgelöst)
     jumpMax       max. plausible Änderung ggü. letztem gültigen Wert PRO TAG —
                   darüber: validity='suspect' + metric_anomalies-Eintrag,
                   vorheriger gültiger Wert bleibt aktiv (CLAUDE-Spec §19)
     staleDays     danach gilt der Wert als veraltet (resolved.stale=true,
                   niemals als "aktuell" darstellen)
     dailySingleton true → genau ein Wert pro Tag+Quelle (deterministische
                   source_record_id 'provider:daily:<date>:<metric>')
   ============================================================ */
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  // Prioritätsränge je source_type (CLAUDE-Spec §8). Höher gewinnt.
  // manual_override hat KEINEN pauschalen Vorrang: er schlägt nur Werte, die
  // ÄLTER sind als der Override selbst (siehe metric-resolver.resolveMetric).
  var SOURCE_PRIORITY = {
    lab_test: 100,
    device_measurement: 90,
    provider_calculation: 80,
    manual_override: 70,
    manual_entry: 60,
    orvia_estimate: 40,
    historical: 20
  };

  var EDIT_MODES = ['manual_editable', 'automatic_locked', 'automatic_override_allowed', 'calculated_read_only'];

  var CAPABILITY_STATUSES = ['supported', 'unsupported', 'observed', 'not_observed',
    'temporarily_unavailable', 'permission_missing', 'insufficient_history', 'sync_failed', 'unknown'];

  var PROVIDER_TYPES = ['garmin_unofficial', 'garmin_official', 'apple_health', 'health_connect', 'strava', 'manual'];

  var OVERRIDE_REASONS = ['garmin_value_wrong', 'external_measurement_more_accurate', 'lab_test_available', 'manual_correction', 'other'];

  function m(id, label, category, unit, editMode, plausible, opts) {
    opts = opts || {};
    return {
      id: id, label: label, category: category,
      valueKind: opts.valueKind || 'numeric',
      unit: unit, decimals: opts.decimals != null ? opts.decimals : 0,
      dataClass: opts.dataClass || 'auto_measurable',
      editMode: editMode,
      plausible: plausible || null,
      jumpMax: opts.jumpMax != null ? opts.jumpMax : null,
      staleDays: opts.staleDays != null ? opts.staleDays : 7,
      dailySingleton: opts.dailySingleton !== false
    };
  }

  var LOCKED = 'automatic_locked';
  var OVERRIDE = 'automatic_override_allowed';

  var METRICS = [
    // ---- Körperdaten -------------------------------------------------
    m('weight_kg', 'Gewicht', 'body', 'kg', OVERRIDE, [30, 250], { decimals: 1, jumpMax: 3.0, staleDays: 30 }),
    m('body_fat_pct', 'Körperfett', 'body', '%', OVERRIDE, [3, 60], { decimals: 1, jumpMax: 2.5, staleDays: 60 }),
    m('bmi', 'BMI', 'body', 'kg/m²', LOCKED, [10, 60], { decimals: 1, jumpMax: 1.5, staleDays: 30 }),
    m('muscle_mass_kg', 'Muskelmasse', 'body', 'kg', LOCKED, [10, 100], { decimals: 1, jumpMax: 2.5, staleDays: 60 }),
    m('body_water_pct', 'Körperwasser', 'body', '%', LOCKED, [30, 75], { decimals: 1, jumpMax: 5, staleDays: 60 }),
    m('bone_mass_kg', 'Knochenmasse', 'body', 'kg', LOCKED, [1, 8], { decimals: 1, jumpMax: 0.5, staleDays: 90 }),
    m('visceral_fat_rating', 'Viszerales Fett', 'body', 'Index', LOCKED, [1, 30], { jumpMax: 3, staleDays: 90 }),

    // ---- Herz-Kreislauf ----------------------------------------------
    m('resting_hr', 'Ruhepuls', 'cardio', 'bpm', LOCKED, [25, 110], { jumpMax: 15, staleDays: 7 }),
    m('hrv_ms', 'HRV (Nacht)', 'cardio', 'ms', LOCKED, [10, 200], { jumpMax: 40, staleDays: 7 }),
    m('hrv_status', 'HRV-Status', 'cardio', null, LOCKED, null, { valueKind: 'text', staleDays: 7 }),
    m('max_hr', 'Maximale Herzfrequenz', 'cardio', 'bpm', OVERRIDE, [120, 220], { jumpMax: 8, staleDays: 365 }),
    m('lactate_threshold_hr', 'Schwellen-Herzfrequenz', 'cardio', 'bpm', OVERRIDE, [100, 210], { jumpMax: 10, staleDays: 180 }),
    m('lactate_threshold_pace', 'Schwellenpace', 'cardio', 's/km', OVERRIDE, [150, 600], { jumpMax: 30, staleDays: 180 }),

    // ---- Schlaf -------------------------------------------------------
    m('sleep_duration_min', 'Schlafdauer', 'sleep', 'min', OVERRIDE, [0, 960], { staleDays: 2 }),
    m('sleep_score', 'Sleep Score', 'sleep', 'Score', LOCKED, [0, 100], { staleDays: 2 }),
    m('sleep_need_min', 'Schlafbedarf', 'sleep', 'min', LOCKED, [300, 720], { staleDays: 2 }),

    // ---- Tagesaktivität ----------------------------------------------
    m('steps', 'Schritte', 'daily_activity', 'Schritte', LOCKED, [0, 100000], { staleDays: 2 }),
    m('active_kcal', 'Aktive Kalorien', 'daily_activity', 'kcal', LOCKED, [0, 10000], { staleDays: 2 }),
    m('resting_kcal', 'Ruhekalorien', 'daily_activity', 'kcal', LOCKED, [800, 4000], { staleDays: 2 }),
    m('total_kcal_provider', 'Gesamtkalorien (Provider)', 'daily_activity', 'kcal', LOCKED, [1000, 12000], { staleDays: 2 }),
    m('intensity_minutes', 'Intensitätsminuten', 'daily_activity', 'min', LOCKED, [0, 600], { staleDays: 2 }),
    m('stress_avg', 'Stress (Tag)', 'daily_activity', 'Score', LOCKED, [0, 100], { staleDays: 2 }),
    m('body_battery', 'Body Battery', 'daily_activity', 'Score', LOCKED, [0, 100], { staleDays: 2 }),
    m('spo2_avg', 'SpO₂ (Nacht)', 'daily_activity', '%', LOCKED, [70, 100], { staleDays: 2 }),
    m('respiration_avg', 'Atemfrequenz', 'daily_activity', 'Atemzüge/min', LOCKED, [6, 30], { decimals: 1, staleDays: 2 }),
    m('floors_climbed', 'Stockwerke', 'daily_activity', 'Stockwerke', LOCKED, [0, 500], { staleDays: 2 }),

    // ---- Leistungsdaten ----------------------------------------------
    m('vo2max_running', 'VO₂max Laufen', 'performance', 'ml/kg/min', LOCKED, [20, 90], { jumpMax: 4, staleDays: 90 }),
    m('vo2max_cycling', 'VO₂max Radfahren', 'performance', 'ml/kg/min', LOCKED, [20, 90], { jumpMax: 4, staleDays: 90 }),
    m('ftp_watts', 'FTP', 'performance', 'W', OVERRIDE, [80, 500], { jumpMax: 40, staleDays: 180 }),
    m('race_prediction_5k', 'Race Prediction 5 km', 'performance', 's', LOCKED, [720, 3600], { jumpMax: 120, staleDays: 60 }),
    m('race_prediction_10k', 'Race Prediction 10 km', 'performance', 's', LOCKED, [1500, 7200], { jumpMax: 240, staleDays: 60 }),
    m('race_prediction_half', 'Race Prediction Halbmarathon', 'performance', 's', LOCKED, [3300, 16200], { jumpMax: 600, staleDays: 60 }),
    m('race_prediction_marathon', 'Race Prediction Marathon', 'performance', 's', LOCKED, [7200, 32400], { jumpMax: 1500, staleDays: 60 }),
    m('endurance_score', 'Endurance Score', 'performance', 'Score', LOCKED, [0, 12000], { staleDays: 30 }),
    m('hill_score', 'Hill Score', 'performance', 'Score', LOCKED, [0, 100], { staleDays: 30 }),
    m('running_tolerance', 'Running Tolerance', 'performance', 'km/Woche', LOCKED, [0, 300], { staleDays: 30 }),
    m('fitness_age', 'Fitnessalter', 'performance', 'Jahre', LOCKED, [15, 90], { decimals: 1, staleDays: 60 }),

    // ---- Belastung & Erholung (Provider-Werte, NICHT ORVIA-Scores) ---
    m('training_readiness', 'Training Readiness', 'load_recovery', 'Score', LOCKED, [0, 100], { staleDays: 2 }),
    m('training_status', 'Training Status', 'load_recovery', null, LOCKED, null, { valueKind: 'text', staleDays: 7 }),
    m('acute_load', 'Acute Load', 'load_recovery', 'Load', LOCKED, [0, 3000], { staleDays: 7 }),
    m('load_ratio', 'Load Ratio', 'load_recovery', 'Ratio', LOCKED, [0, 5], { decimals: 2, staleDays: 7 }),
    m('recovery_time_h', 'Recovery Time', 'load_recovery', 'h', LOCKED, [0, 96], { staleDays: 2 })
  ];

  var BY_ID = {};
  for (var i = 0; i < METRICS.length; i++) BY_ID[METRICS[i].id] = METRICS[i];

  var CATEGORY_LABELS = {
    body: 'Körperdaten',
    cardio: 'Herz-Kreislauf',
    sleep: 'Schlaf',
    daily_activity: 'Tagesaktivität',
    performance: 'Leistungsdaten',
    load_recovery: 'Belastung & Erholung'
  };

  var R = {
    schemaVersion: 1,
    METRICS: METRICS,
    byId: function (id) { return BY_ID[id] || null; },
    ids: function () { return METRICS.map(function (x) { return x.id; }); },
    SOURCE_PRIORITY: SOURCE_PRIORITY,
    EDIT_MODES: EDIT_MODES,
    CAPABILITY_STATUSES: CAPABILITY_STATUSES,
    PROVIDER_TYPES: PROVIDER_TYPES,
    OVERRIDE_REASONS: OVERRIDE_REASONS,
    CATEGORY_LABELS: CATEGORY_LABELS,
    priorityOf: function (sourceType) {
      return SOURCE_PRIORITY[sourceType] != null ? SOURCE_PRIORITY[sourceType] : 0;
    },
    // Deterministische Dedupe-ID für Tages-Singleton-Metriken (== Worker-Logik).
    dailyRecordId: function (providerType, metricDate, metricType) {
      return String(providerType) + ':daily:' + String(metricDate) + ':' + String(metricType);
    },
    // Serialisierbare Form für den Python-Worker (export-registry.mjs).
    toJSON: function () {
      return {
        schemaVersion: R.schemaVersion,
        sourcePriority: SOURCE_PRIORITY,
        editModes: EDIT_MODES,
        capabilityStatuses: CAPABILITY_STATUSES,
        providerTypes: PROVIDER_TYPES,
        overrideReasons: OVERRIDE_REASONS,
        metrics: METRICS
      };
    }
  };

  O.metricRegistry = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})();
