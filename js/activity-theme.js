/* ============================================================
   ORVIA · activity-theme (v8-439) — welche Sportart bekommt welches Farbthema.

   EINE Stelle fuer die Zuordnung. Die FARBWERTE stehen ausschliesslich in styles.css
   („ORVIA FARBSYSTEM v6"): dieses Modul kennt nur Namen, keine Farben.

   Ablauf:  Sport-ID oder Anzeigename (running, „Laufen", run, „Krafttraining" …)
            → kanonische Sport-ID (trainingDomain.normSport — die bestehende Alias-Tabelle)
            → Thema (running | cycling | swimming | strength | rowing | brand)
            → data-activity="…" am umgebenden Element
            → Bausteine benutzen nur var(--activity-primary) usw.

   Sportarten ohne eigenes Thema (Fussball, Mobility, Triathlon, Sonstiges …) bekommen
   „brand" = ORVIA-Gold. Es wird bewusst KEINE Farbe erfunden: ein neues Thema ist ein
   Werte-Block in styles.css und eine Zeile in SPORT_THEME.

   Reine Darstellung — keine Datenlogik, keine Berechnung.
   ============================================================ */
(function (root) {
  'use strict';
  root.ORVIA = root.ORVIA || {};

  var FALLBACK = 'brand';
  /* Thema → Vorsilbe der Werte in styles.css (--run-primary, --bike-primary …) */
  var PREFIX = { running: 'run', cycling: 'bike', swimming: 'swim', strength: 'strength', rowing: 'row' };
  /* kanonische Sport-ID → Thema. Gehen/Wandern/Trail teilen sich das Lauf-Thema (wie bisher
     die Story: eine Familie „Tempo"), bis sie ein eigenes bekommen. */
  var SPORT_THEME = {
    running: 'running', trail_running: 'running', walking: 'running', hiking: 'running',
    cycling: 'cycling',
    swimming: 'swimming',
    gym: 'strength', strength: 'strength', strength_training: 'strength', weight_training: 'strength',
    rowing: 'rowing'
  };
  var ROLES = ['primary', 'secondary', 'light', 'tint', 'tint-strong', 'glow', 'glow-strong'];
  /* Vorgabe ohne Sportart: dieselben Werte wie [data-activity="brand"] */
  var BRAND = { primary: 'var(--orvia-brand-gold)', secondary: 'var(--orvia-brand-gold-soft)', light: 'var(--orvia-brand-gold-light)',
    tint: 'var(--orvia-brand-tint)', 'tint-strong': 'var(--orvia-brand-tint-strong)', glow: 'var(--orvia-brand-glow)', 'glow-strong': 'var(--orvia-brand-glow-strong)' };

  function norm(sport) {
    if (sport == null) return '';
    var raw = String(sport).trim().toLowerCase();
    if (!raw) return '';
    if (SPORT_THEME[raw] || raw === FALLBACK) return raw;
    var s = null;
    try { s = (root.ORVIA.trainingDomain && root.ORVIA.trainingDomain.normSport) ? root.ORVIA.trainingDomain.normSport(raw) : null; } catch (_e) { s = null; }
    return String(s || raw).toLowerCase();
  }
  /* Thema einer Sportart; Unbekanntes ⇒ 'brand' (nie ein geratenes Thema) */
  function id(sport) {
    var s = norm(sport);
    if (s === FALLBACK) return FALLBACK;
    return SPORT_THEME[s] || FALLBACK;
  }
  /* fuer HTML-Bau: data-activity="running" */
  function attr(sport) { return 'data-activity="' + id(sport) + '"'; }
  function apply(el, sport) { try { if (el && el.setAttribute) el.setAttribute('data-activity', id(sport)); } catch (_e) { } return el; }
  function role(r) { return ROLES.indexOf(r) >= 0 ? r : 'primary'; }
  /* Farbe INNERHALB eines data-activity-Bereichs (der Normalfall) */
  function cssVar(r) { return 'var(--activity-' + role(r) + ')'; }
  /* Farbe EINER BESTIMMTEN Sportart, unabhaengig vom Bereich — fuer Uebersichten, die mehrere
     Sportarten nebeneinander zeigen (Sportartenverteilung, Start-Auswahl, Last je Sportart). */
  function color(sport, r) {
    var t = id(sport), k = role(r);
    if (PREFIX[t]) return 'var(--' + PREFIX[t] + '-' + k + ')';
    return BRAND[k];
  }
  /* aufgeloester Wert am Element (der konkrete Farbwert aus styles.css) — fuer Zeichenflaechen, die keine
     CSS-Variablen verstehen. Ohne Dokument/Element: null. */
  function read(el, r) {
    try {
      if (!el || !root.getComputedStyle) return null;
      var v = root.getComputedStyle(el).getPropertyValue('--activity-' + role(r));
      v = v ? String(v).trim() : '';
      return v || null;
    } catch (_e) { return null; }
  }

  var api = {
    id: id, attr: attr, apply: apply, cssVar: cssVar, color: color, read: read,
    themes: function () { return Object.keys(PREFIX).concat([FALLBACK]); },
    roles: function () { return ROLES.slice(); },
    PRIMARY: 'var(--activity-primary)', FALLBACK: FALLBACK
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ORVIA.activityTheme = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
