/* ============================================================
   ORVIA · checkin-fields — deklarative Feldlisten für Check-ins (SSOT)
   ------------------------------------------------------------
   Phase 6 (GARMIN-INTEGRATION-DESIGN.md §9): renderMorning()/renderEve()
   und gatherMorning()/gatherEve() werden aus DIESER Registry gespeist —
   eine Quelle der Wahrheit für Reihenfolge, Renderer-Art, Grenzen,
   Blob-Key, Tabellen-Spalte und Garmin-Automatik je Feld.

   Felder je Eintrag:
     key        Blob-Key im morning-/eve-Objekt (z. B. sleepMin)
     el         DOM-id des Eingabeelements (m_sleep …) — stabil, CSS/Tests
     label      UI-Label
     kind       sleep | range | number | chipsText | chipsBool | chipsMulti | note | issues
     min/max/step/lo/hi   Range-Parameter (kind sleep/range)
     displayDef Anzeige-Default des Sliders (KEIN Messwert — Audit-Befund 6:
                unberührte Slider speichern null, siehe _sliderVal in ui.js)
     lim        Schlüssel in LIM für numerische Grenzen (kind number)
     inputmode/placeholder   Attribute für kind number/note
     opts       Chip-Optionen (kind chips*)
     table      Spaltenname in daily_checkins (nur Doku/Vertragstest;
                das Mapping selbst lebt in checkinRepository.toRow)
     metricId   user_metrics-Metrik, die dieses Feld automatisch füllen kann
     autoMaxAgeDays  max. Alter (Kalendertage) eines Garmin-Werts, um die
                Frage zu ersetzen. FIX 19.07.2026: durchgängig 0 — der Worker
                datiert Nacht-Metriken (Schlaf/RHR/HRV) auf den AUFWACH-Tag,
                d. h. "letzte Nacht" traegt IMMER das heutige Datum. Ein
                gestern datierter Wert ist die VORLETZTE Nacht und wurde
                faelschlich vorbefuellt, wenn der heutige Sync noch fehlte.
     autoUnit   Einheit für die Kompaktanzeige "Automatisch von Garmin"
     quick      Schnell-Modus-Ersatz: {el, map} — Chip-Auswahl → Wert
     row2       Gruppen-Key: aufeinanderfolgende Felder mit gleichem Key
                werden in EINER .row2-Zeile gerendert
     modes      ['full'] | ['quick'] | ['full','quick'] (Default: ['full'])
   ============================================================ */
(function () {
  var root = (typeof window !== 'undefined') ? window : globalThis;
  root.ORVIA = root.ORVIA || {};

  var MORNING = [
    { key: 'sleepMin', el: 'm_sleep', label: 'Schlaf-Dauer', kind: 'sleep',
      min: 180, max: 720, step: 5, displayDef: 420, table: 'sleep_minutes',
      metricId: 'sleep_duration_min', autoMaxAgeDays: 0, autoUnit: 'sleep',
      /* quick.map: Chip → Wert; quick.sel: gespeicherten Wert auf Chip abbilden
         (Schwellen absteigend, erste erfüllte gewinnt) — exakt Bestandslogik. */
      quick: { el: 'm_qsleep', label: 'Schlaf letzte Nacht', opts: ['Gut', 'OK', 'Schlecht'], map: { Gut: 450, OK: 420, Schlecht: 330 }, sel: [[450, 'Gut'], [390, 'OK'], [0, 'Schlecht']] },
      quickPos: 2, modes: ['full', 'quick'] },
    { key: 'sleepQ', el: 'm_sleepQ', label: 'Schlaf-Qualität', kind: 'range',
      min: 1, max: 10, displayDef: 6, table: 'sleep_quality' },
    { key: 'rhr', el: 'm_rhr', label: 'Ruhepuls (bpm)', kind: 'number',
      lim: 'rhr', inputmode: 'numeric', placeholder: '58', row2: 'vitals',
      table: 'resting_hr', metricId: 'resting_hr', autoMaxAgeDays: 0, autoUnit: 'bpm' },
    { key: 'bb', el: 'm_bb', label: 'Body Battery (%)', kind: 'number',
      lim: 'bb', inputmode: 'numeric', placeholder: '70', row2: 'vitals',
      table: 'body_battery', metricId: 'body_battery', autoMaxAgeDays: 0, autoUnit: '%' },
    { key: 'weight', el: 'm_weight', label: 'Gewicht (kg) nüchtern', kind: 'number',
      lim: 'weight', inputmode: 'decimal', placeholder: '75', row2: 'body' },
    { key: 'hrvMs', el: 'm_hrvMs', label: 'HRV (ms)', kind: 'number',
      lim: 'hrvMs', inputmode: 'numeric', placeholder: 'z.B. 62', row2: 'body',
      table: 'hrv_ms', metricId: 'hrv_ms', autoMaxAgeDays: 0, autoUnit: 'ms' },
    { key: 'hrv', el: 'm_hrv', label: 'HRV-Status (Garmin)', kind: 'chipsText',
      opts: ['Good', 'Balanced', 'Low'], table: 'hrv_status',
      metricId: 'hrv_status', autoMaxAgeDays: 0, autoUnit: 'text' },
    { key: 'stress', el: 'm_stress', label: 'Stress-Level', kind: 'chipsText',
      opts: ['Low', 'Med', 'High'], table: 'stress' },
    { key: 'ill', el: 'm_ill', label: 'Krankheitssymptome?', kind: 'chipsBool',
      opts: ['Nein', 'Ja'], table: 'illness', quickPos: 3, modes: ['full', 'quick'] },
    /* Batch 0 (2026-07-18): Red-Flag-Erfassung — schließt den bisher toten
       Safety-Pfad (calc.js safetyCheck + decision-engine-v2 kannten diese
       Symptome, aber KEIN Erfassungspfad existierte; ENGINE-CONTRACT-AUDIT
       Befund 4). Speicherform: morning.redFlags = { fever:true, … } — nur
       ausgewählte Flags, kanonische v2-Codes (optCodes = SSOT Label→Code).
       Kein Metric-Auto-Fill: Warnzeichen sind IMMER eine bewusste Angabe.
       In BEIDEN Modi sichtbar — Safety darf nicht vom Check-in-Modus abhängen. */
    { key: 'redFlags', el: 'm_redFlags', label: 'Warnzeichen heute? (Mehrfachauswahl)', kind: 'chipsMulti',
      opts: ['Fieber', 'Brustschmerz', 'Atemnot', 'Schwindel/Ohnmacht', 'Taubheit/Lähmung', 'Schmerz nach Sturz/Unfall', 'Akute Schwellung', 'Instabilität'],
      optCodes: { 'Fieber': 'fever', 'Brustschmerz': 'chestPain', 'Atemnot': 'shortnessOfBreath', 'Schwindel/Ohnmacht': 'dizziness', 'Taubheit/Lähmung': 'neurologicalSymptoms', 'Schmerz nach Sturz/Unfall': 'accidentPain', 'Akute Schwellung': 'swelling', 'Instabilität': 'instability' },
      table: 'red_flags', quickPos: 5, modes: ['full', 'quick'] },
    { key: '_issues', el: 'm_knee', label: 'Beschwerden', kind: 'issues',
      quickPos: 4, modes: ['full', 'quick'] },
    { key: 'feel', el: 'm_feel', label: 'Allg. Befinden', kind: 'range',
      min: 1, max: 10, displayDef: 7, table: 'feel',
      quick: { el: 'm_qfeel', label: 'Wie fühlst du dich?', opts: ['Gut', 'Mittel', 'Schlecht'], map: { Gut: 8, Mittel: 6, Schlecht: 3 }, sel: [[8, 'Gut'], [5, 'Mittel'], [0, 'Schlecht']] },
      quickPos: 1, modes: ['full', 'quick'] },
    { key: 'legs', el: 'm_legs', label: 'Kraft Beine', kind: 'range',
      min: 1, max: 10, displayDef: 7, table: 'leg_strength' },
    { key: 'doms', el: 'm_doms', label: 'Muskelschmerz / DOMS', kind: 'range',
      min: 0, max: 10, displayDef: 2, lo: 'keine', hi: 'stark', table: 'doms' },
    /* ankle: wird vom Issues-Modul gerendert (hideAnkle-Profilflag); gather liest
       das Element nur, wenn vorhanden — kein eigener Renderer-Eintrag. */
    { key: 'ankle', el: 'm_ankle', kind: 'external' }
  ];

  var EVENING = [
    /* e_knee wird nur gerendert, wenn das Knie-Issue-Modul NICHT aktiv ist
       (Bestandsverhalten) — Bedingung lebt im Renderer (condition-Hook). */
    { key: 'knee', el: 'e_knee', label: 'Knie JETZT (Abend)', kind: 'range',
      min: 0, max: 10, displayDef: 0, lo: 'kein', hi: 'max',
      condition: 'kneeIssueInactive', absentDef: 0 },
    { key: 'energy', el: 'e_energy', label: 'Tagesenergie', kind: 'range',
      min: 1, max: 10, displayDef: 6 },
    { key: 'prot', el: 'e_prot', label: 'Protein (g) · Ziel 150–165', kind: 'number',
      lim: 'prot', inputmode: 'numeric', placeholder: '160', row2: 'nut' },
    { key: 'hydL', el: 'e_hydL', label: 'Hydration (Liter)', kind: 'number',
      lim: 'hydL', inputmode: 'decimal', placeholder: '3.0', row2: 'nut' },
    { key: 'carbs', el: 'e_carbs', label: 'Kohlenhydrate adäquat?', kind: 'chipsText',
      opts: ['ja', 'ok', 'nein'] },
    { key: 'sleepExp', el: 'e_sleepExp', label: 'Schlaf-Erwartung', kind: 'range',
      min: 1, max: 10, displayDef: 7 },
    { key: 'mood', el: 'e_mood', label: 'Stimmung morgen', kind: 'range',
      min: 1, max: 10, displayDef: 7 },
    { key: 'note', el: 'e_note', label: 'Tagesnotiz', kind: 'note',
      placeholder: 'Was war heute wichtig?' }
  ];

  var API = {
    schemaVersion: 1,
    MORNING: MORNING,
    EVENING: EVENING,
    byKey: function (list, key) {
      for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
      return null;
    }
  };

  root.ORVIA.checkinFields = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
