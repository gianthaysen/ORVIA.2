/* ============================================================
   ORVIA · source-contract — E-02 Quellenprioritätsvertrag (Phase 4, 2026-08-05)
   ------------------------------------------------------------
   ZENTRAL, nicht pro Kennzahl (docs/ENTSCHEIDUNGEN-2026-08.md · E-02):

     Rang | Quelle                          | source              | confidence
     -----+---------------------------------+---------------------+--------------
       1  | aktuelle validierte Messung     | measured_validated  | measured
       2  | synchronisierte Gerätedaten     | device_sync         | measured
       3  | manuell eingetragener Profilwert| profile_manual      | user_provided
       4  | berechneter Schätzwert          | derived_estimate    | estimated
       5  | kein Wert                       | —                   | —

   Kernregel: Rang 3 und 4 sind NICHT gleichwertig. Ein bewusst eingetragener
   HFmax ist qualitativ etwas anderes als 208 − 0,7 × Alter (Tanaka). Beide
   dürfen nie unter derselben Kennzeichnung erscheinen.

   Reines Domain-Modul: kein DOM, kein Storage, kein Netzwerk — Node-testbar
   (supabase/tests/phase4_quality_test.mjs). UI-Renderer LESEN hier Labels und
   Auflösung; sie definieren keine eigenen Quellbegriffe mehr.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  var VERSION = 'e02.1';

  var RANK = { measured_validated: 1, device_sync: 2, profile_manual: 3, derived_estimate: 4 };

  var CONFIDENCE = {
    measured_validated: 'measured',
    device_sync: 'measured',
    profile_manual: 'user_provided',
    derived_estimate: 'estimated'
  };

  /* Anzeige-Labels (kurz + lang). Kurzform für Wertzeilen, Langform für Sheets. */
  var LABEL = {
    measured_validated: 'gemessen (validiert)',
    device_sync: 'gemessen (Gerät)',
    profile_manual: 'Profil, manuell',
    derived_estimate: 'berechnet (Schätzung)'
  };
  var LABEL_LONG = {
    measured_validated: 'Aktuelle validierte Messung',
    device_sync: 'Synchronisierte Gerätedaten',
    profile_manual: 'Manuell eingetragener Profilwert',
    derived_estimate: 'Berechneter Schätzwert — keine Messung'
  };

  /* E-02-Werteform. value==null ⇒ null (Rang 5: kein Wert wird nicht verpackt). */
  function make(value, source, opts) {
    if (value == null) return null;
    if (!RANK[source]) throw new Error('source-contract: unbekannte Quelle "' + source + '"');
    opts = opts || {};
    return {
      value: value,
      source: source,
      measuredAt: opts.measuredAt != null ? opts.measuredAt : null,
      updatedAt: opts.updatedAt != null ? opts.updatedAt : null,
      confidence: CONFIDENCE[source],
      method: opts.method != null ? opts.method : null   // z. B. 'tanaka_208_07' bei derived_estimate
    };
  }

  /* Auflösung: bester Kandidat nach Rang (kleiner = besser). Kandidaten mit
     value==null werden übersprungen. Kein Kandidat ⇒ null (ehrlich: kein Wert). */
  function pick(candidates) {
    var best = null;
    (candidates || []).forEach(function (c) {
      if (!c || c.value == null || !RANK[c.source]) return;
      if (!best || RANK[c.source] < RANK[best.source]) best = c;
    });
    return best;
  }

  /* Anzeigezeile: „198 bpm · Quelle: Profil, manuell" (Entscheidung 2). */
  function line(resolved, unit) {
    if (!resolved || resolved.value == null) return null;
    return String(resolved.value) + (unit ? ' ' + unit : '') + ' · Quelle: ' + (LABEL[resolved.source] || resolved.source);
  }

  /* ---- Kanonische Auflösungen der Profil-Fallback-Werte (Entscheidung 2:
     HFmax, Ruhepuls, Gewicht, Größe — Schwellenpace/FTP/Schwellen-HF haben
     noch keinen Datenpfad und werden hier NICHT erfunden). ----
     Herkunft measured-Felder: _sectionMeta.body.source==='provider_sync' ⇒
     device_sync, sonst profile_manual (Editor/Onboarding) — identische
     Unterscheidung wie _perfSeedFromCanonical (profile.js). */
  function _bodyMetaSource(profile) {
    try {
      var m = profile && profile._sectionMeta && profile._sectionMeta.body;
      return (m && m.source === 'provider_sync') ? 'device_sync' : 'profile_manual';
    } catch (e) { return 'profile_manual'; }
  }
  function _bodyMetaUpdatedAt(profile) {
    try { return (profile && profile._sectionMeta && profile._sectionMeta.body && profile._sectionMeta.body.updatedAt) || null; }
    catch (e) { return null; }
  }

  /* HFmax: Messung/Profilwert gewinnt; sonst Tanaka (208 − 0,7 × Alter) als
     KLAR getrennter Schätzwert. Ohne beides ⇒ null (kein 190/201-Default). */
  function hfMax(profile) {
    var p = profile || {};
    var cands = [];
    if (p.hfMaxMeasured != null) {
      cands.push(make(p.hfMaxMeasured, _bodyMetaSource(p), { updatedAt: _bodyMetaUpdatedAt(p) }));
    }
    if (p.age != null && p.age > 0) {
      cands.push(make(Math.round(208 - 0.7 * p.age), 'derived_estimate', { method: 'tanaka_208_07' }));
    }
    return pick(cands);
  }

  function restingHr(profile) {
    var p = profile || {};
    if (p.restingHrMeasured == null) return null;   // kein Schätzpfad für Ruhepuls — nichts erfinden
    return make(p.restingHrMeasured, _bodyMetaSource(p), { updatedAt: _bodyMetaUpdatedAt(p) });
  }

  function weightKg(profile) {
    var p = profile || {};
    if (p.weightKg == null) return null;
    return make(p.weightKg, _bodyMetaSource(p), { updatedAt: _bodyMetaUpdatedAt(p) });
  }

  function heightCm(profile) {
    var p = profile || {};
    if (p.heightCm == null) return null;
    return make(p.heightCm, 'profile_manual', { updatedAt: _bodyMetaUpdatedAt(p) });   // Größe hat keinen Gerätepfad
  }

  var api = {
    VERSION: VERSION, RANK: RANK, CONFIDENCE: CONFIDENCE, LABEL: LABEL, LABEL_LONG: LABEL_LONG,
    make: make, pick: pick, line: line,
    hfMax: hfMax, restingHr: restingHr, weightKg: weightKg, heightCm: heightCm
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.sourceContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
