/* ============================================================
   ORVIA · onboarding-steps — Metadaten der sichtbaren Platzhalter-Schritte (v2).
   NUR Beschreibung, welche Daten später kommen. Keine echten Formulare, keine Vorauswahlen.
   ============================================================ */
(function (root) {
  var STEPS = [
    { id: 'welcome', title: 'Willkommen bei ORVIA',
      desc: 'ORVIA erstellt keinen statischen Standardplan. Sport, Alltag, Ziel und Erholung werden gemeinsam berücksichtigt. Die Einrichtung dauert ungefähr 5–8 Minuten.' },
    { id: 'profile', title: 'Dein Athletenprofil', type: 'form',
      desc: 'Diese Angaben bilden die Grundlage für spätere Trainings- und Belastungsmodelle.' },
    { id: 'sports', title: 'Deine Sportarten', type: 'form',
      desc: 'Wähle die Sportarten, die ORVIA für dich berücksichtigen soll. Andere Aktivitäten kannst du später trotzdem jederzeit absolvieren.' },
    { id: 'training_level', title: 'Dein Trainingsstand', type: 'form',
      desc: 'Damit ordnet ORVIA Umfang, Intensität und Progression realistisch ein.' },
    { id: 'goals', title: 'Dein Ziel', type: 'form',
      desc: 'Ein Ziel reicht für den Start. Weitere kannst du jederzeit ergänzen.' },
    { id: 'availability', title: 'Dein Trainingsalltag',
      desc: 'Trainingstage und typische Dauer — ORVIA plant nur, was in dein Leben passt.' },
    { id: 'review', title: 'Zusammenfassung',
      desc: 'Prüfe kurz deine Angaben — dann legt ORVIA los.' }
  ];
  root.ORVIA = root.ORVIA || {}; root.ORVIA.onboardingV2Steps = STEPS;
  if (typeof module !== 'undefined' && module.exports) module.exports = STEPS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
