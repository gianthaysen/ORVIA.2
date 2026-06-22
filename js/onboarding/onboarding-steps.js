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
    { id: 'sports_placeholder', title: 'Deine Sportarten',
      desc: 'Hier wählst du später deine Sportarten und Disziplinen. Folgefragen erscheinen nur für die Sportarten, die du auswählst.' },
    { id: 'goals_placeholder', title: 'Deine Ziele',
      desc: 'Hier legst du später dein wichtigstes Ziel und bis zu zwei Nebenziele fest. Bei Zielkonflikten priorisiert ORVIA dein Hauptziel.' },
    { id: 'schedule_placeholder', title: 'Dein Trainingsalltag',
      desc: 'Hier kommen später deine Trainingstage, Zeitfenster und festen Termine (z. B. Mannschaftstraining, Spiele, Kurse).' },
    { id: 'review_placeholder', title: 'Zusammenfassung',
      desc: 'Dein Basisprofil ist gespeichert. Die weiteren Bereiche für Sportarten, Ziele und Trainingsalltag folgen in den nächsten Entwicklungsschritten. Dein Fortschritt liegt lokal auf diesem Gerät.' }
  ];
  root.ORVIA = root.ORVIA || {}; root.ORVIA.onboardingV2Steps = STEPS;
  if (typeof module !== 'undefined' && module.exports) module.exports = STEPS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
