/* ============================================================
   ORVIA · engine/load-profile — WAS eine Einheit im Körper belastet

   DER BEFUND, DER DIESES MODUL AUSGELÖST HAT (2026-08-06, Nutzer):
     „Wenn man Rudern macht, kann man am selben Tag nicht Rücken trainieren.
      Oder Fußball und Beintraining. Oder Laufen und Beintraining. Oder
      Ganzkörper, Ganzkörper, Ganzkörper dreimal — das geht auch nicht."

   Alle vier Beispiele haben dieselbe Ursache, und keines davon ist mit
   Sportart-Namen lösbar. Eine Regel „Laufen verträgt sich nicht mit Beinen"
   müsste für jede Sportart-Kombination einzeln geschrieben werden — bei 24
   Sportarten und 15 Muskelgruppen sind das hunderte Sonderfälle, von denen
   jeder einzeln vergessen werden kann. Genau so ist der bisherige Planer
   entstanden, und genau deshalb war er lückenhaft.

   DIE LÖSUNG IST EINE EBENE TIEFER: Nicht Sportarten kollidieren, sondern
   MUSKELGRUPPEN. Jede Einheit — ob Laufen, Rudern, Fußball oder Kniebeugen —
   wird auf dieselben 15 Muskelgruppen abgebildet (identische Schlüssel wie
   js/gym-volume.js, damit Plan und Auswertung dieselbe Sprache sprechen).
   Danach ist EINE Regel zuständig:

       Zwei Einheiten kollidieren, wenn sie dieselbe Muskelgruppe stark
       belasten, bevor diese sich erholt hat.

   Daraus folgen alle vier Beispiele des Nutzers automatisch, ohne dass eines
   davon im Code namentlich vorkommt:
     • Rudern (lats/upper_back 0,9) + Rückentraining (lats direct) → Konflikt
     • Fußball (quads/hamstrings 0,8) + Beintraining → Konflikt
     • Laufen (calves 0,9, quads 0,6) + Beintraining → Konflikt
     • Ganzkörper an drei Folgetagen → Konflikt mit sich selbst

   ZWEI ARTEN VON LAST, getrennt geführt:
     • LOKAL (muskulär) — erholt sich je Gruppe unterschiedlich schnell.
     • SYSTEMISCH (zentral/kardiovaskulär) — begrenzt, wie viele harte Reize
       eine Woche verträgt, unabhängig davon, welche Muskeln betroffen sind.
   Ein Long Run und ein schweres Kniebeugen-Training teilen sich die Beine,
   ein Long Run und ein VO2-Intervall teilen sich das zentrale Budget. Nur
   beides zusammen erklärt, warum eine Woche zu hart ist.

   ERHOLUNGSZEITEN sind Richtwerte aus der Trainingslehre (48–72 h für stark
   beanspruchte große Muskelgruppen, weniger für kleine und für aerobe
   Grundlagenbelastung). Sie sind bewusst als Tabelle sichtbar und nicht im
   Code verstreut — sie sind eine fachliche Annahme, keine Naturkonstante, und
   müssen überprüfbar bleiben.

   PUR: keine Uhr, kein Zufall, kein DOM, kein Storage.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'load-profile@1';

  /* Identisch zu js/gym-volume.js — Plan und Auswertung müssen dieselben
     Schlüssel benutzen, sonst driften Planung und Messung auseinander. */
  var MUSCLES = ['chest', 'front_delts', 'side_delts', 'rear_delts', 'triceps', 'biceps',
    'lats', 'upper_back', 'lower_back', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'forearms'];

  /* Erholung in Stunden bei STARKER Beanspruchung. Kleine Muskelgruppen
     erholen sich schneller, die großen Streckerketten am langsamsten. */
  var RECOVERY_H = {
    quads: 48, hamstrings: 48, glutes: 48, lower_back: 60, lats: 48, upper_back: 48,
    chest: 48, front_delts: 36, side_delts: 36, rear_delts: 36,
    triceps: 36, biceps: 36, forearms: 24, calves: 36, abs: 24
  };

  /* ---- Sportarten → Muskelbeanspruchung (0..1) + systemische Last ----
     0.8–1.0 = tragende Muskulatur der Bewegung · 0.4–0.7 = deutlich beteiligt
     0.1–0.3 = stabilisierend. Werte über LOCAL_CONFLICT gelten als „stark".
     Die Sportarten decken die Registry ab; unbekannte Sportarten führen NICHT
     zu „keine Last", sondern zu einer bewusst konservativen Annahme. */
  var SPORT_LOAD = {
    /* quads/hamstrings bewusst bei .7/.65: Beim Testen fiel auf, dass ein Long Run
       mit .6 knapp UNTER der Konfliktschwelle landete — „Long Run + Ganzkoerper am
       Samstag" wurde dadurch nicht erkannt, obwohl genau das der gemeldete Fall war.
       Mit .7 trennt die Intensitaetsskalierung sauber: Long Run (x.95) und Intervalle
       (x1.0) liegen darueber, ein lockerer Dauerlauf (x.7) darunter — was fachlich
       stimmt, denn locker laufen und Beintraining am selben Tag ist vertretbar. */
    running:    { quads: .7, hamstrings: .65, glutes: .55, calves: .9, lower_back: .25, abs: .3 },
    cycling:    { quads: .8, glutes: .6, hamstrings: .35, calves: .3, lower_back: .3 },
    swimming:   { lats: .7, upper_back: .6, rear_delts: .6, front_delts: .5, triceps: .4, abs: .4 },
    rowing:     { lats: .9, upper_back: .9, lower_back: .7, biceps: .5, quads: .6, glutes: .5, forearms: .4 },
    football:   { quads: .8, hamstrings: .8, glutes: .7, calves: .7, abs: .35, lower_back: .3 },
    basketball: { quads: .8, hamstrings: .6, glutes: .6, calves: .8, abs: .3 },
    handball:   { quads: .7, hamstrings: .6, glutes: .6, calves: .6, front_delts: .5, abs: .4 },
    tennis:     { quads: .6, calves: .6, front_delts: .5, forearms: .6, abs: .4, glutes: .4 },
    climbing:   { lats: .8, upper_back: .6, biceps: .7, forearms: .9, abs: .5 },
    hiking:     { quads: .5, glutes: .5, calves: .6, hamstrings: .4 },
    walking:    { calves: .3, quads: .2, glutes: .2 },
    skiing:     { quads: .8, glutes: .6, abs: .4, calves: .4 },
    boxing:     { front_delts: .6, rear_delts: .5, abs: .6, calves: .5, forearms: .5 },
    yoga:       { abs: .4, glutes: .3, hamstrings: .3, front_delts: .2 },
    mobility:   { abs: .2, hamstrings: .2, glutes: .2 }
  };

  /* Systemische (zentrale/kardiovaskuläre) Last je Einheitstyp. Skala 0..1. */
  var SYSTEMIC = { recovery: .15, easy: .3, moderate: .45, long: .7, tempo: .75, interval: .9, race: 1.0, strength: .5 };

  /* Gym-Splits → Muskelbeanspruchung. „Ganzkörper" belastet bewusst breit —
     genau deshalb kollidiert es mit sich selbst an Folgetagen. */
  var GYM_LOAD = {
    ganzkoerper: { quads: .7, hamstrings: .6, glutes: .7, lats: .7, upper_back: .6, chest: .6,
      front_delts: .5, triceps: .5, biceps: .5, abs: .5, lower_back: .45, calves: .3 },
    oberkoerper: { chest: .8, lats: .8, upper_back: .7, front_delts: .7, side_delts: .6, rear_delts: .5,
      triceps: .7, biceps: .7, abs: .3 },
    unterkoerper: { quads: .9, hamstrings: .8, glutes: .9, calves: .6, lower_back: .5, abs: .3 },
    beine: { quads: .9, hamstrings: .8, glutes: .9, calves: .6, lower_back: .5 },
    push: { chest: .9, front_delts: .8, side_delts: .6, triceps: .8 },
    pull: { lats: .9, upper_back: .9, rear_delts: .6, biceps: .8, forearms: .5 },
    ruecken: { lats: .9, upper_back: .9, rear_delts: .5, biceps: .6, lower_back: .5, forearms: .4 },
    brust: { chest: .9, front_delts: .6, triceps: .6 },
    schultern: { front_delts: .9, side_delts: .9, rear_delts: .7, triceps: .4 },
    arme: { biceps: .9, triceps: .9, forearms: .6 },
    core: { abs: .9, lower_back: .4 }
  };

  /* Ab dieser Beanspruchung gilt eine Muskelgruppe als STARK belastet. Zwei
     starke Reize auf dieselbe Gruppe ohne Erholung sind der Konfliktfall.

     DIE SCHWELLE IST DIE HEIKELSTE ZAHL DES MODULS. Zu niedrig angesetzt (0,5 im
     ersten Entwurf) meldete sie auch eine lockere Regenerationsfahrt am Tag vor
     einem Intervalltraining als Konflikt — fachlich falsch, das ist gängige
     Praxis, und der Plan wurde dadurch unnoetig duenn. Zu hoch angesetzt
     verschwinden die echten Faelle. 0,6 trennt beides: tragende Muskulatur einer
     Bewegung liegt darueber, stabilisierende Beteiligung darunter. */
  var LOCAL_CONFLICT = 0.6;

  function _norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* Deutsche Anzeigelabels der Plan-Einheiten → kanonische Sport-ID. */
  var LABEL_TO_SPORT = { 'laufen': 'running', 'rad': 'cycling', 'radfahren': 'cycling',
    'schwimmen': 'swimming', 'rudern': 'rowing', 'fussball': 'football', 'basketball': 'basketball',
    'handball': 'handball', 'tennis': 'tennis', 'klettern': 'climbing', 'wandern': 'hiking',
    'gehen': 'walking', 'ski': 'skiing', 'boxen': 'boxing', 'yoga': 'yoga',
    'mobilitaet': 'mobility', 'mobility': 'mobility' };

  function sportIdOf(unit) {
    if (!unit) return null;
    if (unit.sportId) return String(unit.sportId).toLowerCase();
    var t = _norm(unit.t);
    if (LABEL_TO_SPORT[t]) return LABEL_TO_SPORT[t];
    if (t === 'gym' || t === 'kraft' || t === 'krafttraining') return 'gym';
    return t || null;
  }

  /* Intensitätsstufe einer Einheit aus ihrem Label — dieselbe Sprache, die der
     Planer verwendet. */
  function intensityOf(unit) {
    var l = _norm(unit && unit.l);
    if (/wettkampf|race/.test(l)) return 'race';
    if (/interval/.test(l)) return 'interval';
    if (/tempo|schwelle|threshold/.test(l)) return 'tempo';
    if (/long/.test(l)) return 'long';
    if (/recovery|regener/.test(l)) return 'recovery';
    if (sportIdOf(unit) === 'gym') return 'strength';
    if (/easy|z2|dauerlauf|technik|grundlage/.test(l)) return 'easy';
    return 'moderate';
  }

  /* Gym-Split aus dem Label ableiten. Unbekannter Split ⇒ Ganzkörper-Annahme
     (konservativ: lieber zu viel Kollision vermuten als zu wenig). */
  function gymSplitOf(unit) {
    var l = _norm(unit && unit.l);
    var keys = Object.keys(GYM_LOAD);
    for (var i = 0; i < keys.length; i++) if (l.indexOf(keys[i]) >= 0) return keys[i];
    if (/legs|bein/.test(l)) return 'beine';
    if (/upper/.test(l)) return 'oberkoerper';
    if (/lower/.test(l)) return 'unterkoerper';
    if (/back/.test(l)) return 'ruecken';
    return 'ganzkoerper';
  }

  /* ---- Kern: Lastprofil einer Einheit ----
     { muscles:{key:0..1}, systemic:0..1, sportId, intensity, unknownSport } */
  function profileOf(unit) {
    var sport = sportIdOf(unit);
    var intensity = intensityOf(unit);
    var muscles = {}, unknownSport = false;

    if (sport === 'gym') {
      var split = gymSplitOf(unit);
      var base = GYM_LOAD[split] || GYM_LOAD.ganzkoerper;
      Object.keys(base).forEach(function (m) { muscles[m] = base[m]; });
    } else if (SPORT_LOAD[sport]) {
      var b2 = SPORT_LOAD[sport];
      /* Intensität skaliert die muskuläre Beanspruchung mit — ein lockerer
         Dauerlauf belastet die Waden nicht wie ein Intervalltraining. */
      var f = intensity === 'interval' || intensity === 'race' ? 1.0
        : intensity === 'tempo' ? .9 : intensity === 'long' ? .95
        : intensity === 'easy' ? .7 : intensity === 'recovery' ? .45 : .8;
      Object.keys(b2).forEach(function (m) { muscles[m] = Math.round(b2[m] * f * 100) / 100; });
    } else if (sport) {
      /* UNBEKANNTE SPORTART: keine Last anzunehmen wäre die gefährliche Antwort
         — dann würde jede neue Sportart konfliktfrei neben allem stehen. Statt-
         dessen eine breite, mittlere Ganzkörperannahme, die Kollisionen eher
         meldet als übersieht. Der Fall wird ausgewiesen, nicht verschwiegen. */
      unknownSport = true;
      /* Bewusst UEBER der Konfliktschwelle: „unbekannt" muss vorsichtig machen.
         Bei 0,5 (unter der Schwelle) waere eine unbekannte Sportart konfliktfrei
         neben allem gestanden — genau der stille Ausfall, den dieses Modul
         verhindern soll. */
      ['quads', 'hamstrings', 'glutes', 'lats', 'upper_back', 'abs'].forEach(function (m) { muscles[m] = .7; });
    }
    return { sportId: sport, intensity: intensity, muscles: muscles,
      systemic: SYSTEMIC[intensity] != null ? SYSTEMIC[intensity] : .45,
      unknownSport: unknownSport };
  }

  /* Muskelgruppen, die eine Einheit STARK belastet. */
  function heavyMuscles(unit) {
    var p = profileOf(unit), out = [];
    Object.keys(p.muscles).forEach(function (m) { if (p.muscles[m] >= LOCAL_CONFLICT) out.push(m); });
    return out.sort();
  }

  /* ---- Die eine Regel ----
     Kollidieren zwei Einheiten, wenn zwischen ihnen `gapHours` liegen?
     gapHours = 0 ⇒ selber Tag, 24 ⇒ Folgetag, 48 ⇒ übernächster Tag. */
  function conflictBetween(a, b, gapHours) {
    var pa = profileOf(a), pb = profileOf(b);
    var gap = typeof gapHours === 'number' ? gapHours : 0;
    var hits = [];
    Object.keys(pa.muscles).forEach(function (m) {
      if (!(pa.muscles[m] >= LOCAL_CONFLICT)) return;
      if (!(pb.muscles[m] >= LOCAL_CONFLICT)) return;
      /* BEFUND BEIM TESTEN (2026-08-06): Mit der vollen Erholungszeit als starrer
         Schwelle kollidierte JEDER Lauf mit JEDEM Lauf am Folgetag — die Waden
         liegen bei jedem Lauf ueber der Schwelle. Damit waeren zwei Lauftage
         hintereinander generell verboten gewesen; ein lockerer Dauerlauf am Tag
         vor einem Intervalltraining ist aber gaengige und sinnvolle Praxis.

         Richtig ist: Die Erholungszeit gilt fuer die VOLLE Beanspruchung und
         skaliert mit deren Hoehe. Eine zu 63 % belastete Gruppe braucht nicht so
         lange wie eine zu 100 % belastete. Am selben Tag (gap 0) bleibt jede
         doppelte starke Beanspruchung ein Konflikt — dort gibt es keine Erholung. */
      var need = Math.round((RECOVERY_H[m] || 48) * pa.muscles[m]);
      if (gap < need) hits.push({ muscle: m, needHours: need, gapHours: gap,
        loadA: pa.muscles[m], loadB: pb.muscles[m] });
    });
    /* Zwei systemisch harte Einheiten am selben Tag sind auch dann ein Problem,
       wenn sie völlig verschiedene Muskeln treffen (zentrale Ermüdung). */
    var systemic = (gap < 24 && pa.systemic >= .7 && pb.systemic >= .7);
    return { conflict: hits.length > 0 || systemic, muscles: hits, systemic: systemic,
      severity: hits.reduce(function (s, h) { return s + h.loadA * h.loadB; }, 0) + (systemic ? 1 : 0) };
  }

  /* Wochenbilanz: systemische Last und Beanspruchung je Muskelgruppe.
     Grundlage für „wie hart war/wird diese Woche" — im Hintergrund gerechnet,
     nicht als Zahl in der Oberfläche behauptet. */
  function weekLoad(days) {
    var perMuscle = {}, systemic = 0, sessions = 0;
    MUSCLES.forEach(function (m) { perMuscle[m] = 0; });
    (Array.isArray(days) ? days : []).forEach(function (day) {
      (Array.isArray(day) ? day : []).forEach(function (u) {
        var p = profileOf(u); sessions++;
        systemic += p.systemic;
        Object.keys(p.muscles).forEach(function (m) { if (perMuscle[m] != null) perMuscle[m] += p.muscles[m]; });
      });
    });
    var top = Object.keys(perMuscle).sort(function (a, b) { return perMuscle[b] - perMuscle[a] || (a < b ? -1 : 1); });
    return { sessions: sessions, systemic: Math.round(systemic * 100) / 100,
      perMuscle: perMuscle, mostLoaded: top.slice(0, 5).filter(function (m) { return perMuscle[m] > 0; }) };
  }

  /* Alle Kollisionen einer geplanten Woche — zyklisch, weil So an Mo grenzt. */
  function weekConflicts(days) {
    var out = [];
    for (var d = 0; d < 7; d++) {
      var day = (days && days[d]) || [];
      for (var i = 0; i < day.length; i++) {
        for (var j = i + 1; j < day.length; j++) {
          var c0 = conflictBetween(day[i], day[j], 0);
          if (c0.conflict) out.push({ dayA: d, dayB: d, a: day[i], b: day[j], gapHours: 0, detail: c0 });
        }
        var nd = (d + 1) % 7, next = (days && days[nd]) || [];
        for (var k = 0; k < next.length; k++) {
          var c1 = conflictBetween(day[i], next[k], 24);
          if (c1.conflict) out.push({ dayA: d, dayB: nd, a: day[i], b: next[k], gapHours: 24, detail: c1 });
        }
      }
    }
    return out;
  }

  var api = { VERSION: VERSION, MUSCLES: MUSCLES.slice(), RECOVERY_H: RECOVERY_H,
    SPORT_LOAD: SPORT_LOAD, GYM_LOAD: GYM_LOAD, SYSTEMIC: SYSTEMIC, LOCAL_CONFLICT: LOCAL_CONFLICT,
    profileOf: profileOf, heavyMuscles: heavyMuscles, conflictBetween: conflictBetween,
    weekLoad: weekLoad, weekConflicts: weekConflicts,
    sportIdOf: sportIdOf, intensityOf: intensityOf, gymSplitOf: gymSplitOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.loadProfile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
