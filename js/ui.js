/* Robustheit: GM-Grafikhelfer (gm-icons.js) können in Test-Sandboxes fehlen — neutrale
   Fallbacks, damit ui.js ohne Ladereihenfolge-Annahme evaluierbar bleibt. */
(function(g){['ring','icon','arrow','battGrad','sparkline'].forEach(function(k){if(typeof g[k]!=='function')g[k]=function(){return '';};});if(!g.SC)g.SC={};if(!g.TINT)g.TINT={};})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));
/* GM1-Daten vor der Top-Level-Init (Modul-Registry, Levels; Funktionen hoisten selbst). */
var GM_NA='Noch nicht verfügbar';
var ALLMOD={readinessPro:{t:"Readiness & Konfidenz",d:"Baseline, SD, Trends",lvl:3},recovery:{t:"Schlaf & Erholung",d:"Score, HRV, Ruhepuls",lvl:2},loadPro:{t:"Belastungssteuerung",d:"CTL/ATL, ACWR, Sportart",lvl:3},loadSimple:{t:"Trainingsbelastung",d:"Status + Zone",lvl:2},vitals:{t:"HRV & Ruhepuls",d:"Trend + Baseline",lvl:2},vitalsFull:{t:"Vitalwerte",d:"HRV, RHR, HRR, VO₂, Atmung",lvl:3},stress:{t:"Stress",d:"Tagesverlauf",lvl:3},activity:{t:"Aktivität heute",d:"Schritte, aktive kcal",lvl:1},activitySimple:{t:"Schritte",d:"Tagesziel",lvl:1},next:{t:"Bevorstehendes Training",d:"Nächste Einheit",lvl:1},nextSimple:{t:"Nächstes Training",d:"Was & wann",lvl:1},contrib:{t:"Belastungs-Beitrag",d:"ATL pro Einheit",lvl:3},goal:{t:"Ziel-Fortschritt",d:"Hauptziel",lvl:2},goalSimple:{t:"Dein Ziel",d:"Fortschritt",lvl:1},sleepSimple:{t:"Schlaf",d:"einfach",lvl:1},pain:{t:"Beschwerden",d:"Schmerz-Status",lvl:1},
/* 2026-08-05 (Nutzerentscheidung): Ernaehrung, Abend-Check-in und Routinen lagen als
   Legacy-Karten ausserhalb des Modulsystems (eigenes Markup, nicht anordenbar,
   nicht ausblendbar). Jetzt regulaere Module — gleiche Datenquellen, GM-Darstellung. */
nutrition:{t:"Energie & Ernährung",d:"Kalorien, Makros, Protein",lvl:1},evening:{t:"Abend-Check-in",d:"Protein, Beschwerden, Notiz",lvl:1},supplements:{t:"Routinen & Supplements",d:"Tagesroutinen, Stack",lvl:1}};
var LEVELMOD={a:["nextSimple","goalSimple","sleepSimple","activitySimple","pain","nutrition","evening","supplements"],f:["recovery","loadSimple","vitals","goal","activity","next","nutrition","evening","supplements"],p:["readinessPro","loadPro","recovery","vitalsFull","stress","contrib","goal","activity","next","nutrition","evening","supplements"]};
/* Wrapper (nicht direkte Referenzen): bestehende Quelltext-Slice-Tests evaluieren ui.js
   teilweise — Aufloesung erst beim Aufruf haelt jede Teilauswertung referenzsicher. */
var GM_REND={recovery:function(d){return gmModRecovery(d);},sleepSimple:function(d){return gmModSleepSimple(d);},activitySimple:function(d){return gmModActivitySimple(d);},loadSimple:function(d){return gmModLoadSimple(d);},loadPro:function(d){return gmModLoadPro(d);},readinessPro:function(d){return gmModReadinessPro(d);},vitals:function(d){return gmModVitals(d);},vitalsFull:function(d){return gmModVitalsFull(d);},stress:function(d){return gmModStress(d);},activity:function(d){return gmModActivity(d);},next:function(d){return gmModNext(d);},nextSimple:function(d){return gmModNextSimple(d);},goal:function(d){return gmModGoal(d);},goalSimple:function(d){return gmModGoalSimple(d);},pain:function(d){return gmModPain(d);},contrib:function(d){return gmModContrib(d);},
nutrition:function(d){return gmModNutrition(d);},evening:function(d){return gmModEvening(d);},supplements:function(d){return gmModSupplements(d);}};
var GM_KGRID={recovery:1,activity:1};
var GM_METRIC_DEFS={sleep_duration_min:{label:'Schlaf',icon:'moon',color:'sleep',unit:' min'},hrv_ms:{label:'Herzfrequenzvariabilität',icon:'pulse',color:'ready',unit:' ms'},resting_hr:{label:'Ruhepuls',icon:'heart',color:'ready',unit:' bpm'},stress_avg:{label:'Stress',icon:'wind',color:'ready',unit:''},body_battery:{label:'Body Battery',icon:'battery',color:'activity',unit:''},steps:{label:'Schritte',icon:'activity',color:'activity',unit:''},active_kcal:{label:'Aktive Energie',icon:'bolt',color:'activity',unit:' kcal'},load:{label:'Trainingsbelastung',icon:'gauge',color:'ready',unit:''},
/* GM7.4-2: Group-1 — bereits vom Worker produzierte/gespeicherte Werte, generisches Detail-Sheet (Quelle/Stand/Stale). Keine medizinische Bewertung, keine UI-Neuberechnung. */
training_readiness:{label:'Training Readiness',icon:'bolt',color:'ready',unit:''},acute_load:{label:'Acute Load',icon:'gauge',color:'activity',unit:''},load_ratio:{label:'Load Ratio (ACWR)',icon:'gauge',color:'ready',unit:''},recovery_time_h:{label:'Recovery Time',icon:'heart',color:'ready',unit:' h'},
endurance_score:{label:'Endurance Score',icon:'activity',color:'activity',unit:''},running_tolerance:{label:'Running Tolerance',icon:'activity',color:'ready',unit:' km/Wo'},fitness_age:{label:'Fitnessalter',icon:'pulse',color:'ready',unit:' J.'},respiration_avg:{label:'Atemfrequenz',icon:'wind',color:'ready',unit:'/min'},vo2max_running:{label:'VO₂max Laufen',icon:'pulse',color:'ready',unit:''},vo2max_cycling:{label:'VO₂max Radfahren',icon:'pulse',color:'activity',unit:''},
stress_max:{label:'Stress-Maximum',icon:'wind',color:'ready',unit:''},sleep_deep_min:{label:'Tiefschlaf',icon:'moon',color:'sleep',unit:' min'},sleep_light_min:{label:'Leichtschlaf',icon:'moon',color:'sleep',unit:' min'},sleep_rem_min:{label:'REM-Schlaf',icon:'moon',color:'sleep',unit:' min'},sleep_awake_min:{label:'Wachphasen',icon:'moon',color:'sleep',unit:' min'}};
/* GM7.6 (Teilbereich 1): metrikspezifische Einordnung fuer die Detail-Sheets — statische
   Erklaertexte in drei Tiefen (a/f/p), moegliche Einfluesse und Trainingsbedeutung, analog
   zur METRICS-Registry des Golden Masters (interp.a/f/p, factors, meaning). Reine Bildung/
   Einordnung, KEINE Datenwerte; hb = higherBetter fuer Chart/vs-Oe-Faerbung. */
var GM_METRIC_INFO={
  sleep_duration_min:{hb:true,
    a:'So lange hast du letzte Nacht geschlafen. Regelmäßig genug Schlaf ist die wichtigste Grundlage für Erholung und Fortschritt.',
    f:'Gemessene Schlafdauer der letzten Nacht. Aussagekräftig ist weniger die einzelne Nacht als dein Muster über die Woche — konstante Zeiten wirken stärker als einzelne lange Nächte.',
    p:'Schlafdauer aus der Geräteerkennung (Bewegung + HF). Systematische Unterschätzung bei ruhigem Wachliegen ist möglich; bewerte Trend und Wochenmittel, nicht Einzelnächte.',
    factors:['Zubettgeh-Zeit','Koffein am Nachmittag','Alkohol','Späte, schwere Mahlzeiten','Bildschirmzeit am Abend','Raumtemperatur','Späte harte Einheiten'],
    meaning:'Zu wenig Schlaf senkt Regeneration, Glykogenspeicherung und Reaktionsfähigkeit — harte Einheiten nach kurzen Nächten haben ein schlechteres Reiz-Nutzen-Verhältnis.'},
  hrv_ms:{hb:true,
    a:'Die Herzfrequenzvariabilität zeigt, wie erholt dein Nervensystem ist. Höher als sonst ist meist ein gutes Zeichen.',
    f:'Nächtliche HRV. Einzelwerte schwanken stark — entscheidend ist der Vergleich mit deiner eigenen Baseline, nicht mit anderen Personen oder Absolutwerten.',
    p:'Nächtliches rMSSD-basiertes Signal. Interpretation nur relativ zur individuellen Log-Baseline (7/28 T.); akut erhöhte Werte nach sehr harter Belastung können parasympathische Sättigung statt Erholung anzeigen.',
    factors:['Trainingsbelastung der Vortage','Alkohol','Infekt/Krankheit','Schlafqualität','Stress','Hitze und Dehydration'],
    meaning:'Deutlich unter Baseline über mehrere Tage spricht für reduzierte Belastbarkeit — Intensität eher senken. Im oder über dem Normalbereich sind Qualitätsreize gut möglich.'},
  resting_hr:{hb:false,
    a:'Dein Puls in völliger Ruhe. Niedriger als sonst ist meist ein gutes Zeichen für Erholung.',
    f:'Nächtlicher Ruhepuls. Ein Anstieg von mehreren Schlägen über deine Baseline ist ein frühes, robustes Warnsignal für unvollständige Erholung oder beginnende Krankheit.',
    p:'Minimum-/Nachtwert des Geräts. Als Ampel gemeinsam mit HRV lesen: RHR erhöht + HRV gesenkt = klarer Erholungsrückstand; isolierte Einzelabweichungen sind wenig aussagekräftig.',
    factors:['Erholungszustand','Infekt/Fieber','Alkohol','Hitze','Dehydration','Aufregung/Stress','Ausdauertrainingszustand (langfristig)'],
    meaning:'Ein über Tage erhöhter Ruhepuls ist ein Grund, Intensität herauszunehmen — unabhängig davon, wie gut sich der Tag subjektiv anfühlt.'},
  stress_avg:{hb:false,
    a:'Dein durchschnittlicher Stresswert heute (0–100). Niedriger ist entspannter.',
    f:'Tages-Stresswert des Geräts, abgeleitet aus der Herzfrequenzvariabilität über den Tag. Dauerhaft hohe Werte fressen dieselben Erholungsressourcen wie Training.',
    p:'HRV-basiertes autonomes Belastungsmaß (0–100). Training selbst erscheint als „Stress" — bewerte die Ruhephasen zwischen Belastungen; fehlende Ruheanteile sind das eigentliche Signal.',
    factors:['Arbeits-/Alltagsbelastung','Koffein','Schlafdefizit','Training (physiologisch erwartbar)','Infekt','Emotionale Anspannung'],
    meaning:'Hoher Alltagsstress + hartes Training addieren sich. An Tagen mit durchgehend hohem Stresslevel ist eine lockere Einheit oft der bessere Reiz.'},
  body_battery:{hb:true,
    a:'Deine Energiereserve (0–100). Nachts lädt sie auf, tagsüber wird sie verbraucht.',
    f:'Energie-Schätzung des Geräts aus HRV, Stress, Schlaf und Aktivität. Der Startwert am Morgen zeigt, wie viel die Nacht wirklich aufgeladen hat.',
    p:'Modellwert (0–100) aus HRV/Stress/Aktivität. Nützlich als Tagesbudget-Heuristik: niedriger Morgenwert nach normaler Nacht deutet auf verdeckte Belastung (Stress, Infekt, Alkohol).',
    factors:['Schlafqualität','Stresslevel','Trainingsbelastung','Alkohol','Krankheit'],
    meaning:'Ein niedriger Wert verbietet kein Training, spricht aber für Umfang statt Intensität — und für konsequentes Auffüllen über Schlaf.'},
  steps:{hb:true,
    a:'Deine Schritte heute. Alltagsbewegung zählt zusätzlich zum Training.',
    f:'Tagesschritte als Maß der Alltagsaktivität (NEAT). Für Ausdauerathleten relevant als versteckter Belastungsanteil neben dem eigentlichen Training.',
    p:'Schrittzählung des Geräts. An harten Trainingstagen viel zusätzliches Gehvolumen = zusätzliche Belastung; an Ruhetagen unterstützt lockeres Gehen die Regeneration.',
    factors:['Alltag/Beruf','Trainingseinheiten','Bewusste Spaziergänge'],
    meaning:'Sehr hohe Alltagsaktivität an harten Tagen verlängert die Erholungszeit; moderate Bewegung an Ruhetagen fördert sie.'},
  active_kcal:{hb:true,
    a:'Kalorien, die du heute durch Bewegung zusätzlich verbraucht hast.',
    f:'Aktive Energie über dem Grundumsatz (Gerät). Wichtig für die Energieverfügbarkeit: hoher Verbrauch braucht entsprechend höhere Zufuhr.',
    p:'Geräteschätzung des aktivitätsbedingten Verbrauchs (HF-/Beschleunigungsmodell, Fehlerbereich beachten). Für die Ernährungssteuerung als Trend, nicht als exakte Zahl verwenden.',
    factors:['Trainingsumfang und -intensität','Alltagsaktivität','Körpergewicht'],
    meaning:'Anhaltend hoher Verbrauch ohne angepasste Energiezufuhr gefährdet Regeneration, Anpassung und Hormonhaushalt (LEA-Risiko).'},
  recovery_time_h:{hb:false,
    f:'Vom Gerät geschätzte verbleibende Erholungszeit bis zur nächsten harten Einheit.',
    p:'Garmin-Modellwert aus Belastung + Erholungssignalen. Als Richtwert lesen — ORVIA rechnet ihn nicht nach und übersteuert ihn nicht.',
    factors:['Letzte Trainingsbelastung','Schlaf','Stress'],
    meaning:'Innerhalb der Erholungszeit sind lockere Einheiten sinnvoll; harte Reize erst danach oder bewusst als Overreaching-Entscheidung.'},
  training_readiness:{hb:true,
    f:'Garmin-Bereitschaftswert aus Schlaf, Erholungszeit, HRV-Status und Belastungshistorie.',
    p:'Provider-Composite (0–100). Parallel zum ORVIA-Score als Zweitmeinung nutzbar; Abweichungen entstehen durch unterschiedliche Gewichtung, nicht durch Fehler.',
    factors:['Schlaf','HRV-Status','Erholungszeit','Belastungshistorie'],
    meaning:'Hohe Readiness stützt Qualitätsreize; niedrige Werte sprechen für Umfang/Technik statt Intensität.'},
  acute_load:{hb:null,
    f:'Akute Trainingsbelastung der letzten Tage (Garmin-EPOC-basiert).',
    p:'EPOC-gewichtete 7-Tage-Last des Providers — nicht identisch mit ORVIAs sRPE-basiertem ATL. Beide Systeme parallel lesen, nicht mischen.',
    factors:['Trainingsumfang','Intensität'],
    meaning:'Sprunghafte Anstiege der akuten Last sind der klassische Auslöser für Überlastungsbeschwerden — Progression glätten.'},
  load_ratio:{hb:null,
    f:'Verhältnis akuter zu chronischer Belastung (Garmin). Werte um 0,8–1,3 gelten als produktiver Bereich.',
    p:'Provider-ACWR. Methodisch umstritten als Einzelkriterium — als grobe Leitplanke verwenden, Entscheidung bleibt beim Gesamtbild (Score, Symptome, Schlaf).',
    factors:['Belastungsaufbau der letzten Wochen','Pausen/Ausfälle'],
    meaning:'Deutlich über 1,3–1,5 nach Pausen oder Sprüngen = erhöhtes Verletzungsrisiko; sehr niedrige Werte = Detraining-Tendenz.'},
  respiration_avg:{hb:null,
    f:'Durchschnittliche Atemfrequenz (meist nächtlich). Stabil niedrige Werte sprechen für gute Erholung.',
    p:'Atemzüge/min aus der Geräteerkennung. Ein Anstieg über die eigene Baseline kann früh auf Infekt oder Belastungsrückstand hinweisen.',
    factors:['Infekt','Schlafqualität','Stress'],
    meaning:'Auffällige Anstiege zusammen mit erhöhtem Ruhepuls ernst nehmen — eher Erholungstag einplanen.'},
  vo2max_running:{hb:true,
    f:'Geschätzte maximale Sauerstoffaufnahme (Laufen) — der wichtigste Einzelmarker deiner aeroben Kapazität.',
    p:'Geräteschätzung aus Pace-HF-Relation (GPS-abhängig). Träge Kennzahl: reale Änderungen zeigen sich über Wochen, nicht Tage; Tagessprünge sind Messrauschen.',
    factors:['Aerobes Training über Monate','Gewichtsänderung','Hitze (verzerrt Schätzung)'],
    meaning:'Langfristig steigende VO₂max bestätigt wirksames Ausdauertraining — kurzfristige Schwankungen nicht übersteuern.'},
  vo2max_cycling:{hb:true,
    f:'Geschätzte maximale Sauerstoffaufnahme (Radfahren).',
    p:'Leistungs-/HF-basierte Schätzung; ohne Powermeter deutlich unsicherer. Trend über Wochen bewerten.',
    factors:['Aerobes Training','Powermeter-Verfügbarkeit'],
    meaning:'Trend zählt; Einzelwerte nicht überinterpretieren.'},
  stress_max:{hb:false,
    f:'Höchster gemessener Stresswert des Tages.',
    p:'Spitzenwert der Intraday-Stresskurve — einzelne Spitzen sind normal, relevant ist die Dauer hoher Phasen.',
    factors:['Akute Anspannung','Training','Koffein'],
    meaning:'Einzelne Spitzen sind unkritisch; lange Hochphasen ohne Ruheanteile kosten Erholung.'},
  /* Phase 4 (2026-08-05, P2-3): Schlafphasen — vorher griff der Generiktext. */
  sleep_deep_min:{hb:true,
    a:'Im Tiefschlaf erholt sich dein Körper am stärksten. Mehr davon ist meist gut.',
    f:'Tiefschlaf-Dauer der letzten Nacht. Hier laufen körperliche Reparatur, Wachstumshormon-Ausschüttung und Glykogen-Auffüllung — für Sportler die wichtigste Phase. Typisch sind grob 15–25 % der Nacht, vor allem in der ersten Nachthälfte.',
    p:'Geräteschätzung aus Bewegung/HF/HRV — gegen Polysomnographie die fehleranfälligste Phasenklassifikation (Verwechslung mit ruhigem Leichtschlaf). Trend über Wochen bewerten, nicht Einzelnächte; späte harte Einheiten und Alkohol drücken den Tiefschlafanteil messbar.',
    factors:['Alkohol (stark negativ)','Späte intensive Einheiten','Zubettgeh-Zeit (erste Nachthälfte)','Raumtemperatur','Schlafregelmäßigkeit'],
    meaning:'Anhaltend wenig Tiefschlaf verschlechtert Regeneration und Anpassung an harte Reize — ein Grund, Belastung und Abendroutine zu prüfen.'},
  sleep_light_min:{hb:null,
    a:'Leichtschlaf ist der normale Übergangsschlaf — er macht den größten Teil der Nacht aus.',
    f:'Leichtschlaf-Dauer der letzten Nacht. Mit typisch ~50 % der Nacht die größte Phase; weder „gut" noch „schlecht" — auffällig ist eher ein sehr hoher Anteil auf Kosten von Tief- und REM-Schlaf.',
    p:'Sammelkategorie der Geräteklassifikation (N1+N2). Ein hoher Leichtschlafanteil bei kurzem Tief-/REM-Schlaf kann auf fragmentierten Schlaf hindeuten (Stress, Alkohol, Lärm) — als Quotient lesen, nicht absolut.',
    factors:['Schlafdauer gesamt','Koffein','Stress','Umgebung (Lärm, Licht)'],
    meaning:'Für sich genommen wenig steuerungsrelevant — relevant wird er im Verhältnis zu Tief- und REM-Anteil.'},
  sleep_rem_min:{hb:true,
    a:'Im REM-Schlaf verarbeitet dein Gehirn den Tag — wichtig für Lernen und Reaktion.',
    f:'REM-Dauer der letzten Nacht. Zentral für motorisches Lernen, Gedächtnis und emotionale Regulation; typisch 20–25 % der Nacht, überwiegend in der zweiten Nachthälfte — frühes Aufstehen kappt zuerst REM.',
    p:'REM häuft sich in den Morgenstunden: verkürzte Nächte reduzieren REM überproportional. Alkohol unterdrückt REM in der ersten Nachthälfte (Rebound später). Für Techniksport und Intervalltage ist REM-Defizit relevanter als es sich anfühlt.',
    factors:['Gesamtschlafdauer (zweite Nachthälfte!)','Alkohol','Sehr früher Wecker','Unregelmäßige Schlafzeiten'],
    meaning:'Wer chronisch früh raus muss, verliert vor allem REM — konstante Zubettgeh-Zeit ist der wirksamste Hebel.'},
  sleep_awake_min:{hb:false,
    a:'Wachzeit in der Nacht. Kurzes Aufwachen ist völlig normal.',
    f:'Erkannte Wachminuten innerhalb des Schlaffensters. Mehrere kurze Wachphasen pro Nacht sind physiologisch normal und werden oft nicht erinnert; relevant sind lange oder häufige Unterbrechungen.',
    p:'Geräte unterschätzen ruhiges Wachliegen systematisch (Bewegungsarmut ≈ Schlaf). Ein Anstieg gegenüber der eigenen Baseline ist trotzdem ein brauchbares Fragmentierungssignal — zusammen mit RHR/HRV lesen.',
    factors:['Alkohol (zweite Nachthälfte)','Stress/Grübeln','Harndrang (späte Flüssigkeit)','Lärm/Licht','Hitze'],
    meaning:'Steigende nächtliche Wachzeit über mehrere Tage spricht für fragmentierte Erholung — Readiness-Entscheidungen konservativer treffen.'}
};
var _gmLastFocus=null;
/* ============================================================
   UI LAYER — Rendering, Events, Tabs. Nutzt Calc (rein) + DB (data.js).
   ============================================================ */
const RACE={get date(){var g=(typeof goalOf==='function')?goalOf():null;return (g&&g.raceDate)||(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.raceDate)||'';},
            get name(){var g=(typeof goalOf==='function')?goalOf():null;return (g&&typeof RACE_LABELS_P!=='undefined'&&RACE_LABELS_P[g.type])||(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.raceName)||'Ziel';}};
let cur=todayStr();
let activeTypes=new Set();

function ic(n){return '<svg class="ic"><use href="#i-'+n+'"/></svg>';}
const TYPES={Laufen:{ic:ic('run'),sub:'Run'},Gym:{ic:ic('dumbbell'),sub:'Kraft'},Rad:{ic:ic('bike'),sub:'Cycling'},Schwimmen:{ic:ic('swim'),sub:'Pool'},Mobilität:{ic:ic('stretch'),sub:'Stretch'}};
/* Routinen NICHT mehr global hardcoded (Gian-spezifisch). Aus Nutzer-Beschwerden ableiten. */
/* ============ Phase 3 (2026-08-05) · Feature-Flags + kontextuelle Sichtbarkeit ============
   Aktivierungsmatrix: docs/PHASE3-AKTIVIERUNGSMATRIX.md. Jedes reaktivierte Feature
   haengt an einem Flag (Rollback: Flag aus ⇒ Einfluss weg, DATEN BLEIBEN). */
var GM_P3_FLAGS={routines:1,eveCheckin:1,nutrition:1,anaTips:1,preWorkoutGarmin:1,
                 /* Block 2 (2026-08-05) */ weekReview:1,recoveryIntel:1,equipment:1,cycle:1,baselines:1};
function gmFeatureFlag(id){
  try{var v=localStorage.getItem('orvia_flag_'+id);if(v==='0')return false;if(v==='1')return true;}catch(_){ }
  return !!GM_P3_FLAGS[id];
}
function gmSetFeatureFlag(id,on){try{localStorage.setItem('orvia_flag_'+id,on?'1':'0');}catch(_){ }}
/* Abend-Check-in: kontextuell ab 17 Uhr — oder wenn fuer den Tag bereits Daten da sind. */
function gmEveVisible(hour,e){
  if(!gmFeatureFlag('eveCheckin'))return false;
  var hasData=!!(e&&e.eve&&Object.keys(e.eve).length);
  if(hasData)return true;
  if(cur!==todayStr())return false;          /* Vergangenheit ohne Daten: nichts nachtragen suggerieren */
  return hour>=17;
}
function gmApplyPhase3Visibility(){
  try{
    var e=entry(cur);
    var eveOn=gmEveVisible(new Date().getHours(),e);
    var ev=document.getElementById('eveCard');if(ev)ev.classList.toggle('p3-live',eveOn);
    /* 2026-08-05: Laeuft der Abend-Check-in als Modul (gmModEvening), traegt das Modul den
       Status — das Formular erscheint erst auf ausdrueckliche Anforderung (gmGotoEvening-
       Checkin / Quick-Action setzen .gm-co-open). Gleiches Muster wie #routinesCard. */
    if(ev){var _evMod=(typeof gmModOn==='function')&&gmModOn('evening');
      ev.classList.toggle('gm-hidden-host',_evMod&&!ev.classList.contains('gm-co-open'));}
    var nu=document.getElementById('nutritionBox');if(nu)nu.classList.toggle('p3-live',gmFeatureFlag('nutrition')&&cur===todayStr());
    /* #extraCheckin bleibt AUS (E-21): erst die Garmin-basierte Variante — die App
       stellt keine Fragen, deren Antwort bereits gemessen vorliegt. */
    var rc=document.getElementById('routinesCard');if(rc)rc.classList.toggle('p3-live',gmFeatureFlag('routines'));
  }catch(_){ }
}
/* E-22: Routinen sind nutzerkonfigurierbar (PROFILE.routinesCustom), nicht mehr auf
   einen Nutzer hartkodiert. Eine LEERE Auswahl ist eine gueltige Entscheidung
   (gleiche Regel wie die Modulverwaltung, P0-7). Ohne Konfiguration gilt der
   bisherige Bestand (Mobility + Knie-Set bei Kniethema) — kein Bruch fuer
   Bestandsnutzer, deren Haken an den alten Schluesseln haengen. */
var GM_ROUTINE_PRESETS=[['mob','Mobility'],['stretch','Dehnen'],['ss','Spanish Squats (Knie)'],['ice','Eisbeutel/Kühlen'],['core','Core-Routine'],['walk','Spaziergang'],['med','Meditation/Atmung'],['foam','Faszienrolle']];
function activeRoutines(){
  try{
    var c=(typeof PROFILE!=='undefined'&&PROFILE)?PROFILE.routinesCustom:null;
    if(Array.isArray(c))return c.map(function(x){return [x.k,x.label];});
  }catch(_){ }
  var issues=((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.issues)||[]);
  if(issues.indexOf('knee')>=0)return [['mob','Mobility'],['ss','Spanish Squats (Knie)'],['ice','Eisbeutel Knie']];
  return [['mob','Mobility']];
}
function gmOpenRoutinesEditor(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var cur2=activeRoutines();
  var curKeys={};cur2.forEach(function(r){curKeys[r[0]]=true;});
  var rows=cur2.map(function(r,i){
    return '<div class="ps-row"><span>'+gmEsc(r[1])+'</span><button class="xbtn" aria-label="Entfernen" onclick="gmRoutineRemove('+i+')">✕</button></div>';}).join('');
  var presets=GM_ROUTINE_PRESETS.filter(function(p){return !curKeys[p[0]];})
    .map(function(p){return '<button type="button" class="chip" onclick="gmRoutineAdd(\''+p[0]+'\',\''+gmEsc(p[1])+'\')">+ '+gmEsc(p[1])+'</button>';}).join('');
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('repeat')+'</div><div><h3>Routinen anpassen</h3><div class="sh-sub" style="margin:2px 0 0">Deine täglichen Gewohnheiten — individuell, nicht vorgegeben</div></div></div>'+
    '<div class="sh-block"><div class="bh">Aktiv</div>'+(rows||'<p class="muted" style="margin:0">Keine Routinen aktiv — auch das ist eine gültige Wahl.</p>')+'</div>'+
    '<div class="sh-block"><div class="bh">Vorschläge</div><div class="chips" style="display:flex;flex-wrap:wrap;gap:8px">'+(presets||'<span class="muted">Alle Vorschläge aktiv.</span>')+'</div>'+
    '<div class="calc-field" style="margin-top:10px"><label>Eigene Routine</label><input type="text" id="gmRoutineNewIn" maxlength="40" placeholder="z. B. 10 min Lesen"><button class="btn sec" style="margin-top:8px" onclick="gmRoutineAddCustom()">Hinzufügen</button></div></div>'+
    '<div class="source">'+icon('info','xs')+' Erfasste Haken vergangener Tage bleiben erhalten, auch wenn eine Routine später entfernt wird.</div>';
  gmOpenSheet('detailSheet');
}
function _gmRoutinesPersist(list){
  if(typeof PROFILE==='undefined'||!PROFILE)return;
  PROFILE.routinesCustom=list.map(function(r){return {k:r[0],label:r[1]};});
  if(typeof saveProfile==='function')saveProfile();
  if(typeof renderRoutines==='function')renderRoutines();
  gmOpenRoutinesEditor();
}
function gmRoutineRemove(i){var l=activeRoutines();l.splice(i,1);_gmRoutinesPersist(l);}
function gmRoutineAdd(k,label){var l=activeRoutines();if(l.some(function(r){return r[0]===k;}))return;l.push([k,label]);_gmRoutinesPersist(l);}
function gmRoutineAddCustom(){
  var el=document.getElementById('gmRoutineNewIn');var name=el?String(el.value||'').trim():'';
  if(!name)return;
  var k='cu_'+name.toLowerCase().replace(/[^a-z0-9äöüß]+/g,'_').slice(0,24);
  gmRoutineAdd(k,name);
}
const SLOTS=['Morgens','Pre-Workout','Post-Workout','Mit Mahlzeit','Abends'];
const DAYNAMES=['Mo','Di','Mi','Do','Fr','Sa','So'];
const WEEKPLAN=[
  [{t:'Gym',l:'Ganzkörper',d:'45 min'}],
  [{t:'Schwimmen',l:'Technik',d:'6:00 Uhr · ~900 m'},{t:'Gym',l:'Oberkörper',d:'45 min'}],
  [{t:'Laufen',l:'Intervalle',d:'iv'},{t:'Gym',l:'Ganzkörper',d:'45 min'}],
  [{t:'Gym',l:'Oberkörper',d:'45 min'}],
  [{t:'Laufen',l:'Z2 Dauerlauf',d:'ez'}],
  [{t:'Schwimmen',l:'Ausdauer',d:'~900 m'},{t:'Rad',l:'Z2 Dauerfahrt',d:'60 min · 123–144 bpm'}],
  [{t:'Laufen',l:'Long Run',d:'lr'}]];
/* ---- Dynamischer Plan-Generator: Plan aus Profil + Ziel + Sportarten ---- */
function gpR(l,d){return {t:'Laufen',l:l,d:d};}
function gpB(l,d){return {t:'Rad',l:l,d:d};}
function gpG(l){return {t:'Gym',l:l,d:'45 min'};}
function gpS(l,d){return {t:'Schwimmen',l:l,d:d||'~1000 m'};}
function gpM(){return {t:'Mobilität',l:'Mobility',d:'15 min'};}
function planDaysTarget(){
  if(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.trainingDays)return PROFILE.trainingDays;
  var lvl=(typeof userLevel==='function')?userLevel():'fortgeschritten';
  return lvl==='anfaenger'?3:lvl==='profi'?6:4;
}
function gymSplit(days){
  if(days<=2)return ['Ganzkörper','Ganzkörper'];
  if(days===3)return ['Ganzkörper','Oberkörper','Beine'];
  if(days===4)return ['Oberkörper','Beine','Oberkörper','Beine'];
  if(days===5)return ['Push','Pull','Beine','Oberkörper','Core'];
  return ['Push','Pull','Beine','Push','Pull','Core'];
}
/* R1.2: EIN kanonischer Ziel-ID-Namespace. gcat() normalisiert Legacy-IDs
   (halfmarathon/fast5k/fast10k) beim LESEN über die zentrale profileModel-Tabelle;
   ohne profileModel (Test-Slices) Identität. Geschrieben wird nur noch kanonisch. */
function gcat(t){
  try{var pm=(typeof ORVIA!=='undefined'&&ORVIA&&ORVIA.profileModel)||(typeof window!=='undefined'&&window.ORVIA&&window.ORVIA.profileModel);
    if(pm&&typeof pm.canonGoalCategory==='function')return pm.canonGoalCategory(t);}catch(e){}
  return t;
}
function isRaceGoal(g){g=g||((typeof goalOf==='function')?goalOf():{});return ['half_marathon','marathon','run_5k','run_10k','triathlon','ironman','sprint_triathlon','olympic_triathlon','half_ironman','cycling_race'].indexOf(gcat(g.type))>=0 && !!g.raceDate;}
function generateWeekPlan(){
  // H1 (2026-07-11): PROFILE.sports ist KANONISCH ein Objekt-Array ({sportId,…}) —
  // die alten deutschen String-Vergleiche liefen dauerhaft ins Leere (Flags immer
  // false → Plan entstand nur aus dem Ziel-Fallback, Nebensportarten fehlten).
  // Verbot F: nie wieder deutsches String-Array annehmen.
  var sp=(typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.sports))?PROFILE.sports:[];
  var _ids=sp.filter(function(s){return s&&s.activeInApp!==false;}).map(function(s){return typeof s==='string'?s:(s.sportId||'');});
  var run=_ids.indexOf('running')>=0||_ids.indexOf('Laufen')>=0,
      bike=_ids.indexOf('cycling')>=0||_ids.indexOf('Rad')>=0,
      gym=_ids.indexOf('gym')>=0||_ids.indexOf('Gym')>=0,
      swim=_ids.indexOf('swimming')>=0||_ids.indexOf('Schwimmen')>=0;
  if(_ids.indexOf('triathlon')>=0){run=bike=swim=true;}
  var g=(typeof goalOf==='function')?goalOf():{type:'health'};var gt=gcat(g.type||'health');
  var lvl=(typeof userLevel==='function')?userLevel():'fortgeschritten';
  var runGoal=['half_marathon','marathon','run_5k','run_10k'].indexOf(gt)>=0;
  var triGoal=['triathlon','ironman','sprint_triathlon','olympic_triathlon','half_ironman'].indexOf(gt)>=0;
  var strengthGoal=['muscle','muscle_gain','strength'].indexOf(gt)>=0;
  if(!run&&!bike&&!gym&&!swim){ if(runGoal)run=true; else if(triGoal){run=bike=swim=true;} else if(strengthGoal)gym=true; else gym=true; }
  var w=[[],[],[],[],[],[],[]];
  if(triGoal){
    // Anfänger: Basisaufbau, KEINE harten Intervalle, kürzere Long-Einheiten (Spec §5/§6).
    var triBeg=(lvl==='anfaenger'||lvl==='wiedereinstieg');
    w[0]=[gpS('Technik','~900 m')];
    w[1]=[triBeg?gpR('Z2 Dauerlauf','ez'):gpR('Intervalle','iv')];
    w[2]=[gpB('Easy Z2',triBeg?'45 min':'75 min')];
    w[3]=[gpS('Ausdauer',triBeg?'~900 m':'~1200 m')].concat(gym?[gpG('Oberkörper')]:[]);
    w[4]=gym?[gpG('Ganzkörper')]:[gpM()];
    w[5]=triBeg?[gpB('Easy Z2','60 min')]:[gpB('Long Ride','2–3 h'),gpR('Koppellauf','ez')];
    w[6]=[gpR('Long Run','lr')];
  }else if(runGoal||(run&&!swim)){
    if(lvl==='anfaenger'){w[1]=[gpR('Z2 Dauerlauf','ez')];w[3]=[gpR('Z2 Dauerlauf','ez')];w[6]=[gpR('Long Run','lr')];}
    else{w[1]=[gpR('Intervalle','iv')];w[3]=[gpR(lvl==='profi'?'Tempo':'Z2 Dauerlauf',lvl==='profi'?'tempo':'ez')];w[6]=[gpR('Long Run','lr')];}
    if(bike)w[5]=(w[5]||[]).concat([gpB('Easy Z2','60 min')]);
    if(swim)w[4]=(w[4]||[]).concat([gpS('Technik','~900 m')]);
    if(gym){var _cfgGd=null;try{if(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)_cfgGd=ORVIA.profileModel.effectiveTrainingConfig(PROFILE).gymDays;}catch(e){}
      /* H1: gleiche gymDays-Quelle wie die Setup-Anzeige (effectiveTrainingConfig) */
      var _gd=Math.max(0,Math.min(6,_cfgGd!=null?_cfgGd:((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.gymDays!=null)?PROFILE.gymDays:3)));
      var _gs=[0,2,5,4];var _gp=0;for(var _gi=0;_gi<_gs.length&&_gp<_gd;_gi++){w[_gs[_gi]]=(w[_gs[_gi]]||[]).concat([gpG(_gp%2?'Ganzkörper':'Oberkörper')]);_gp++;}}
  }else if(gt==='cycling_event'||(bike&&!run&&!swim&&!(gym&&!bike))){
    w[1]=[lvl==='anfaenger'?gpB('Easy Z2','60 min'):gpB('Intervalle','5×5 min')];w[2]=[gym?gpG('Oberkörper'):gpM()];w[3]=[gpB('Easy Z2','75 min')];w[4]=lvl==='anfaenger'?[]:[gym?gpG('Beine'):gpM()];w[5]=[gpB('Long Ride','2–3 h')];w[6]=[gpB('Recovery','45 min')];
  }else if(strengthGoal||(gym&&!run&&!bike&&!swim)){
    var days=planDaysTarget();var split=gymSplit(days);
    var placement={2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,4,5],6:[0,1,2,3,4,5]}[split.length]||[0,2,4];
    placement.forEach(function(day,idx){if(split[idx])w[day]=[gpG(split[idx])];});
    if(!w[6].length)w[6]=[gpM()];
  }else if(run&&gym&&!bike){
    w[0]=[gpG('Oberkörper')];w[1]=[gpR('Intervalle','iv')];w[2]=[gpG('Ganzkörper')];w[3]=[gpR('Z2 Dauerlauf','ez')];w[4]=[gpG('Oberkörper')];w[6]=[gpR('Long Run','lr')];
  }else if(bike&&gym&&!run){
    w[0]=[gpG('Oberkörper')];w[1]=[gpB('Intervalle','5×5 min')];w[3]=[gpG('Beine')];w[4]=[gpB('Easy Z2','60 min')];w[6]=[gpB('Long Ride','2–3 h')];
  }else if(run&&bike&&!gym){
    w[1]=[gpR('Intervalle','iv')];w[2]=[gpB('Easy Z2','75 min')];w[4]=[gpR('Z2 Dauerlauf','ez')];w[5]=[gpB('Long Ride','2–3 h')];w[6]=[gpR('Long Run','lr')];
  }else{
    var d2=planDaysTarget();
    w[0]=[gym?gpG('Ganzkörper'):gpM()];w[2]=[run?gpR('Z2 Dauerlauf','ez'):(bike?gpB('Easy Z2','45 min'):gpM())];w[4]=[gym?gpG('Ganzkörper'):gpM()];
    if(d2>=4)w[5]=[run?gpR('Z2 Dauerlauf','ez'):(bike?gpB('Easy Z2','60 min'):gpG('Oberkörper'))];
    w[6]=[gpM()];
  }
  // ---- P4: Profil/Availability ist die EINZIGE Trainingskonfiguration ----
  // effectiveTrainingConfig liefert Zieltagzahl + verfügbare Tage (kanonisch aus
  // availability, Legacy-Fallback trainingDays). Vorher war die Tageszahl faktisch
  // im Template verdrahtet (Lauf-Ziel = fix 3 Tage) und trainingDays nur ein Deckel.
  var cfg=null;try{if(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)cfg=ORVIA.profileModel.effectiveTrainingConfig(PROFILE);}catch(e){}
  var maxDays=(cfg&&cfg.targetDays)||((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.trainingDays)?PROFILE.trainingDays:planDaysTarget());
  // (1) Einheiten von nicht verfügbaren Tagen auf freie verfügbare Tage verschieben.
  if(cfg&&cfg.availableDayIdx&&cfg.availableDayIdx.length){
    var _avail={};cfg.availableDayIdx.forEach(function(i){_avail[i]=1;});
    for(var mv=0;mv<7;mv++){
      if(w[mv].length&&!_avail[mv]){
        var tgt=-1,bd=99;
        for(var cand=0;cand<7;cand++){if(_avail[cand]&&!w[cand].length){var dist=Math.abs(cand-mv);if(dist<bd){bd=dist;tgt=cand;}}}
        if(tgt>=0){w[tgt]=w[mv];w[mv]=[];}
        // kein freier verfügbarer Tag mehr → Einheit bleibt liegen (Deckel unten greift; ehrlich statt still löschen)
      }
    }
  }
  // ---- Obergrenze: Trainingstage/Woche ist die GESAMTzahl der Trainingstage ----
  // (gymDays ist Teilmenge davon, keine zusätzliche Menge). Überzählige Tage nach
  // niedrigster Priorität entfernen — wichtige A-Einheiten (Long/Intervall) bleiben.
  if(maxDays){
    var active=[];for(var ad=0;ad<7;ad++)if(w[ad].length)active.push(ad);
    if(active.length>maxDays){
      var dayPr=function(day){var best=3;w[day].forEach(function(it){var p=(typeof unitPriority==='function')?unitPriority(it):'B';var rank=({A:0,B:1,C:2})[p];if(rank==null)rank=1;if(rank<best)best=rank;});return best;};
      active.sort(function(a,b){var d=dayPr(a)-dayPr(b);return d!==0?d:a-b;});
      var keep={};active.slice(0,maxDays).forEach(function(d){keep[d]=1;});
      for(var rd2=0;rd2<7;rd2++)if(!keep[rd2])w[rd2]=[];
    }
  }
  // (2) P4: Auffüllen bis zur Zieltagzahl — NUR mit lockeren Einheiten (Z2/Technik/
  // Ganzkörper/Mobility), nie zusätzliche Intensität. Verteilungs-Heuristik: Tage mit
  // wenig belegten Nachbarn zuerst (vermeidet unnötige Belastungsblöcke). Ruhetage
  // (nicht verfügbare Tage) werden respektiert. Datierte feste Termine behandelt die
  // Tagesadaption (buildTrainingDecision erhält fixedEvents) — ein generisches
  // Wochentemplate kennt keine Kalenderdaten.
  if(maxDays){
    var _fillPool=[];
    var _hasAvail=!!(cfg&&cfg.availableDayIdx&&cfg.availableDayIdx.length);
    for(var fd=0;fd<7;fd++){if(!w[fd].length&&(!_hasAvail||cfg.availableDayIdx.indexOf(fd)>=0))_fillPool.push(fd);}
    _fillPool.sort(function(a,b){function nb(d){return (w[(d+6)%7].length?1:0)+(w[(d+1)%7].length?1:0);}var d=nb(a)-nb(b);return d!==0?d:a-b;});
    var _activeN=0;for(var an=0;an<7;an++)if(w[an].length)_activeN++;
    var _fi=0;
    while(_activeN<maxDays&&_fi<_fillPool.length){
      var _day=_fillPool[_fi++];
      w[_day]=[run?gpR('Z2 Dauerlauf','ez'):(bike?gpB('Easy Z2','60 min'):(swim?gpS('Technik','~900 m'):(gym?gpG('Ganzkörper'):gpM())))];
      _activeN++;
    }
  }
  /* ============================================================
     (3) Gewuenschte EINHEITEN je Sportart (2026-08-05, Nutzer-Feedback)

     BEFUND: Bis hierher entsteht der Plan aus einem festen Wochentemplate, in dem
     die Nebensportarten hartkodiert GENAU EINMAL vorkommen (z. B. `if(bike) w[5]=…
     concat([gpB('Easy Z2','60 min')])`). Wer im Profil 3 Radeinheiten hinterlegt,
     bekam trotzdem eine. Zusaetzlich deckelt der Schritt darueber ausschliesslich
     TAGE — eine Woche hat sieben, also waren z. B. 10 Einheiten/Woche strukturell
     unerreichbar, egal was im Profil stand (gemeldet als „ich will zehn, habe sieben").

     LOESUNG (bewusst additiv): Der bestehende Aufbau bleibt unveraendert; hier wird
     nur die Luecke zwischen IST und der im Profil hinterlegten Wunschzahl gefuellt.
     Quelle ist ausschliesslich PROFILE.sports[].sessionsPerWeek (kanonisch normalisiert,
     profile-model.js) — ohne Angabe passiert nichts, es wird nichts geraten.

     REGELN: nur LOCKERE Einheiten (nie zusaetzliche Intensitaet), Ruhetage/nicht
     verfuegbare Tage bleiben unangetastet, und erst wenn alle verfuegbaren Tage
     belegt sind, entstehen Doppeleinheiten — beginnend bei den am wenigsten
     belasteten Tagen. Mehr als 2 Einheiten pro Tag werden nicht geplant.
     ============================================================ */
  (function(){
    var sports=(typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.sports))?PROFILE.sports:[];
    if(!sports.length)return;
    /* Wunschzahl je kanonischer Sport-ID — nur echte, positive Angaben. */
    var want={};
    sports.forEach(function(s){
      if(!s||typeof s!=='object')return;
      if(s.activeInApp===false)return;
      var id=s.sportId||'';var n=s.sessionsPerWeek;
      if(!id||n==null||!isFinite(+n)||+n<=0)return;
      want[id]=Math.min(14,Math.round(+n));
    });
    var ids=Object.keys(want);if(!ids.length)return;
    /* Bereits geplante Einheiten je Sportart zaehlen (it.t ist das deutsche Label
       des Templates — dieselbe Quelle, die auch die Plananzeige liest). */
    var LABEL={running:'Laufen',cycling:'Rad',swimming:'Schwimmen',gym:'Gym'};
    var MAKE={
      running:function(){return gpR('Z2 Dauerlauf','ez');},
      cycling:function(){return gpB('Easy Z2','60 min');},
      swimming:function(){return gpS('Technik','~900 m');},
      gym:function(){return gpG('Ganzkörper');}
    };
    var have={};
    for(var d0=0;d0<7;d0++)(w[d0]||[]).forEach(function(it){
      if(!it||!it.t)return;have[it.t]=(have[it.t]||0)+1;});
    /* Verfuegbare Tage: Ruhetage bleiben ausgeschlossen — sie sind eine ausdrueckliche
       Nutzerentscheidung und werden hier NICHT ueberschrieben. */
    var hasAvail=!!(cfg&&cfg.availableDayIdx&&cfg.availableDayIdx.length);
    /* ============================================================
       KORREKTUR (2026-08-06) an genau dieser Stelle.

       Die erste Fassung dieses Blocks (2026-08-05) hat den Befund erzeugt, der
       ihn jetzt korrigiert: Sie kannte als einzige Grenzen MAX_PER_DAY=2 und
       „nicht zweimal dieselbe Sportart am Tag". Damit hat sie
         • jeden freien Tag belegt — auch den Ruhetag, den der Tagesdeckel
           unmittelbar davor erzeugt hatte, und
         • an jedem Tag eine zweite Einheit ergaenzt, ohne zu pruefen, ob der
           Nutzer diesen Tag ueberhaupt fuer Doppeleinheiten freigegeben hat.
       Ich hatte damals notiert „Ruhetag bleibt erhalten". Das galt nur fuer
       ausdruecklich als nicht verfuegbar markierte Tage — nicht fuer den
       Ruhetag, der aus dem Deckel entstand. Genau der wurde wieder zugebaut.

       Jetzt: harte Ruhetage und nicht freigegebene Doppeltage sind schon beim
       Auffuellen tabu. Die Feinstruktur (Kollisionen, Ruhetag-Garantie,
       Wochendeckel) prueft danach week-plan-policy.js.
       ============================================================ */
    var _hardRest={};(cfg&&cfg.restDayIdx||[]).forEach(function(i){_hardRest[i]=1;});
    var _dblOk={};(cfg&&cfg.doubleAllowedDayIdx||[]).forEach(function(i){_dblOk[i]=1;});
    var _hasDblInfo=!!(cfg&&cfg.doubleAllowedDayIdx&&cfg.doubleAllowedDayIdx.length);
    var days=[];for(var d1=0;d1<7;d1++){
      if(_hardRest[d1])continue;                                   /* Ruhetag ist kein Fuellplatz */
      if(!hasAvail||cfg.availableDayIdx.indexOf(d1)>=0)days.push(d1);
    }
    if(!days.length)return;
    /* Kapazitaet je Tag: 1 — 2 nur, wenn dieser Tag ausdruecklich freigegeben ist. */
    function _capOf(dd){ if(!_hasDblInfo)return 2; return _dblOk[dd]?2:1; }
    var PL=(window.ORVIA&&ORVIA.weekPlanPolicy)||null;
    ids.forEach(function(id){
      var mk=MAKE[id];if(!mk)return;                     /* nur Sportarten mit echtem Template */
      var lbl=LABEL[id];if(!lbl)return;
      var missing=want[id]-(have[lbl]||0);
      var guard=0;
      while(missing>0&&guard++<14){
        var neu=mk();
        /* Zielsuche: leere Tage zuerst; ein zweiter Slot nur an freigegebenen
           Tagen und nur, wenn dabei keine fachliche Kollision entsteht. */
        var pick=-1,best=99;
        days.forEach(function(dd){
          var day=w[dd]||[];
          if(day.length>=_capOf(dd))return;
          for(var q=0;q<day.length;q++)if(day[q]&&day[q].t===lbl)return;   /* nicht 2× gleiche Sportart/Tag */
          /* Kein harter Lauf neben beinlastiger Kraft und keine zwei harten
             Einheiten — dieselben Regeln, die die Policy danach prueft. */
          if(PL){var bad=false;
            for(var q2=0;q2<day.length;q2++){var o2=day[q2];
              if(PL.isHard(neu)&&PL.isHard(o2)){bad=true;break;}
              if(PL.isHard(neu)&&neu.t==='Laufen'&&PL.isLegHeavy(o2)){bad=true;break;}
              if(PL.isHard(o2)&&o2.t==='Laufen'&&PL.isLegHeavy(neu)){bad=true;break;}}
            if(bad)return;}
          if(day.length<best){best=day.length;pick=dd;}
        });
        if(pick<0)break;                                  /* kein Platz mehr — ehrlich statt ueberladen */
        w[pick]=(w[pick]||[]).concat([neu]);
        missing--;
      }
    });
  })();
  /* ============================================================
     (4) Wochenstruktur-Regelwerk (2026-08-06) — die letzte Instanz.

     Alles davor ist Template plus Auffuellen; hier wird aus dem Ergebnis eine
     Woche, die trainierbar ist: Ruhetag garantiert, Doppeleinheiten nur wo
     freigegeben, keine zwei harten Einheiten am selben Tag, keine beinlastige
     Kraft am Tag eines harten Laufs. Verschieben vor Loeschen; jede Aenderung
     wird protokolliert (PROFILE._planPolicy) und ist damit erklaerbar.
     ============================================================ */
  /* ============================================================
     (4a) WOCHENAUFBAU (2026-08-06, zweiter Nutzerbefund) — der Designer ordnet
     die Woche neu an, BEVOR das Sicherheitsnetz prueft.

     Das Template darueber bestimmt, WELCHE Einheiten die Woche enthaelt. Es
     bestimmt aber auch die Tage — und genau das war fachlich schwach: Laufen an
     Mo/Di/So (drei Lauftage ueber den Wochenwechsel), Tempo direkt neben
     Intervallen, Long Run neben einem Belastungstag. Ein nachgelagertes
     Regelwerk findet das nicht, weil es einzelne TAGE prueft und nicht den
     Rhythmus.

     Deshalb: alle Einheiten einsammeln und von week-plan-designer neu
     platzieren lassen — Kernreize zuerst und maximal weit auseinander, dann
     Beinkraft, dann lockere Grundlage. Der Designer entscheidet NUR das WANN.
     ============================================================ */
  try{
    var _DS=(window.ORVIA&&ORVIA.weekPlanDesigner)||null;
    if(_DS&&typeof _DS.designWeek==='function'){
      var _units=[];for(var _du=0;_du<7;_du++)(w[_du]||[]).forEach(function(it){if(it&&it.t)_units.push(it);});
      if(_units.length){
        var _dr=_DS.designWeek(_units,{
          availableDayIdx:(cfg&&cfg.availableDayIdx)||null,
          restDayIdx:(cfg&&cfg.restDayIdx)||[],
          preferredRestDayIdx:(cfg&&cfg.preferredRestDayIdx)||[],
          doubleAllowedDayIdx:(cfg&&cfg.doubleAllowedDayIdx)||[],
          maxSessionsPerWeek:(cfg&&cfg.maxSessionsPerWeek)||null,
          minRestDays:1
        });
        if(_dr&&_dr.report&&_dr.report.ok){
          w=_dr.days;
          try{if(typeof PROFILE!=='undefined'&&PROFILE)PROFILE._planDesign=_dr.report;}catch(_e2){}
        }
      }
    }
  }catch(_){ }
  try{
    var _PL=(window.ORVIA&&ORVIA.weekPlanPolicy)||null;
    if(_PL&&typeof _PL.applyPolicy==='function'){
      var _res=_PL.applyPolicy(w,{
        availableDayIdx:(cfg&&cfg.availableDayIdx)||null,
        restDayIdx:(cfg&&cfg.restDayIdx)||[],
        preferredRestDayIdx:(cfg&&cfg.preferredRestDayIdx)||[],
        doubleAllowedDayIdx:(cfg&&cfg.doubleAllowedDayIdx)||[],
        maxSessionsPerWeek:(cfg&&cfg.maxSessionsPerWeek)||null,
        minRestDays:1
      });
      if(_res&&_res.report&&_res.report.ok){
        w=_res.days;
        try{if(typeof PROFILE!=='undefined'&&PROFILE)PROFILE._planPolicy=_res.report;}catch(_e){}
      }
    }
  }catch(_){ }
  var nonEmpty=0;for(var i=0;i<7;i++)if(w[i].length)nonEmpty++;
  /* Entscheidungs-Log (Stufe 0a): protokolliert WARUM diese Woche so aussieht.
     Steht bewusst NACH der Berechnung und veraendert w nicht — bei Ausfall des
     Logs ist der Plan byte-fuer-byte identisch (decision_log_test.mjs, Z4). */
  try{
    if(window.ORVIA&&ORVIA.logWeekDecision){
      ORVIA.logWeekDecision({
        cfg:cfg||null,
        design:(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE._planDesign)||null,
        policy:(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE._planPolicy)||null,
        finalSummary:{sessions:w.reduce(function(n,d){return n+d.length;},0),
          restDays:w.filter(function(d){return !d.length;}).length}
      });
    }
  }catch(_){ }
  return nonEmpty?w:null;
}
/* FIX (2026-07-16, „Donnerstag Ruhetag wird ignoriert"): Der GESPEICHERTE Wochenplan gewann
   bisher immer unverändert — die Trainingsverfügbarkeit aus dem Profil wirkte nur bei einer
   Neu-Generierung, nie auf den bestehenden Plan. Diese PURE Funktion richtet einen Plan an
   der Verfügbarkeit aus: Einheiten auf nicht verfügbaren Tagen wandern auf den nächst-
   gelegenen verfügbaren FREIEN Tag; ohne freien Tag bleibt die Einheit ehrlich liegen.
   Nicht-mutierend, deterministisch, idempotent — persistiert NICHTS (Renderer speichern nie). */
function alignPlanToAvailability(plan,cfg){
  if(!Array.isArray(plan)||plan.length!==7)return plan;
  if(!cfg||!Array.isArray(cfg.availableDayIdx)||!cfg.availableDayIdx.length)return plan;
  var avail={};cfg.availableDayIdx.forEach(function(i){avail[i]=1;});
  var w=plan.map(function(d){return Array.isArray(d)?d.slice():[];});
  var moved=false;
  for(var mv=0;mv<7;mv++){
    if(w[mv].length&&!avail[mv]){
      var tgt=-1,bd=99;
      for(var cand=0;cand<7;cand++){if(avail[cand]&&!w[cand].length){var dist=Math.abs(cand-mv);if(dist<bd){bd=dist;tgt=cand;}}}
      if(tgt>=0){w[tgt]=w[mv];w[mv]=[];moved=true;}
    }
  }
  return moved?w:plan;
}
/* Batch 2b (2026-07-18): stabile Planned-Session-IDs. Jede weekPlan-Einheit
   erhält EINMALIG eine persistente id ('ps:…') — Grundlage für den
   Plan-Actual-Link (workout_sessions.planned_session_id, bisher ungenutzt).
   IDs werden nie neu vergeben; Verschieben/Ausrichten erhält sie. */
/* Batch 2c: deterministische IDs für GENERIERTE Pläne (Reload-stabil, solange
   der deterministische Generator denselben Plan liefert). Format psg:<tag>:<pos>:<slug>. */
function ensureGeneratedPlanIds(plan){
  if(!Array.isArray(plan))return false;
  var assigned=false;
  for(var di=0;di<7;di++){var day=plan[di]||[];for(var j=0;j<day.length;j++){var it=day[j];
    if(it&&typeof it==='object'&&!it.id){
      var slug=String((it.t||'')+'-'+(it.l||'')).toLowerCase().replace(/[^a-z0-9äöü]+/g,'_');
      it.id='psg:'+di+':'+j+':'+slug;assigned=true;}}}
  return assigned;
}
/* Batch 2d: Template ≠ konkrete Planinstanz. item.id ('ps:'/'psg:') ist die
   STABILE templateSessionId (Wiederholungs-Slot im Wochenplan). Die konkrete
   geplante Einheit eines Kalendertags ist die plannedOccurrenceId
   'po:<lokales Datum>:<templateSessionId>': gleiche Woche ⇒ über Reloads
   identisch; Folgewoche ⇒ anderes Datum ⇒ andere ID; durch Availability
   verschobene Einheiten nutzen das TATSÄCHLICH geplante Datum (die Ansicht
   aus activeWeekPlan ist bereits ausgerichtet, di = realer Wochentag). */
function planLocalDateForIndex(di){
  var t=new Date(todayStr()+'T12:00');
  var wd=(t.getDay()+6)%7;
  t.setDate(t.getDate()+(di-wd));
  return todayStr(t);
}
function plannedOccurrenceIdFor(item,di){
  if(!item||!item.id)return null;
  return 'po:'+planLocalDateForIndex(di)+':'+item.id;
}
/* v8-310a (Gians P0): Die Occurrence einer DARGESTELLTEN Woche. Der Klick
   bildet den Datumskontext EINMAL (dateIso der gerenderten Karte) und reicht
   ihn unveraendert durch — keine Aktion rekonstruiert das Datum spaeter aus
   _wOff oder di. plannedOccurrenceIdFor(item,di) bleibt fuer Pfade, die
   AUSDRUECKLICH die laufende Woche meinen (Resolver-Abgleich beim Speichern). */
function plannedOccurrenceIdForDate(item,dateIso){
  if(!item||!item.id||!dateIso)return null;
  return 'po:'+dateIso+':'+item.id;
}
/* v8-310a: Wochenkopf als PURE Funktion — der Hoisting-Fehler (undefined
   Wochen voraus / NaN.NaN.) entstand, weil _wOff im Renderer erst NACH der
   Kopfzeile deklariert wurde. Eine Funktion mit Parameter kann den Fehler
   strukturell nicht mehr haben und ist direkt testbar. */
function gmPlanWeekHeader(off){
  var o=(typeof off==='number'&&isFinite(off))?off:0;
  var m0=new Date();var w0=(m0.getDay()+6)%7;m0.setDate(m0.getDate()-w0+o*7);
  var s0=new Date(m0),e0=new Date(m0);e0.setDate(m0.getDate()+6);
  return {label:o===0?'Diese Woche':(o===-1?'Letzte Woche':(o===1?'Nächste Woche':
      (o<0?Math.abs(o)+' Wochen zurück':o+' Wochen voraus'))),
    range:s0.getDate()+'.'+(s0.getMonth()+1)+'. – '+e0.getDate()+'.'+(e0.getMonth()+1)+'.'};
}
/* v8-310a (Gians Entscheidung): DREI Tageszustaende statt „leer = Ruhetag".
   'rest' nur fuer den KONFIGURIERTEN Ruhetag (hart oder bevorzugt),
   'unavailable' nur bei ausdruecklich gepflegter Verfuegbarkeit,
   sonst 'free' — verfuegbar, aber nichts geplant. Ausblenden wuerde die
   drei Bedeutungen wieder vermischen, deshalb bleibt jede Karte sichtbar. */
function gmDayStateFor(di,cfg){
  var rest=((cfg&&cfg.restDayIdx)||[]).concat((cfg&&cfg.preferredRestDayIdx)||[]);
  if(rest.indexOf(di)>=0)return 'rest';
  var avail=(cfg&&cfg.availableDayIdx)||null;
  if(avail&&avail.length&&avail.indexOf(di)<0)return 'unavailable';
  return 'free';
}
var _psSeq=0;
function ensurePlannedSessionIds(plan){
  var assigned=false;
  if(!Array.isArray(plan))return false;
  for(var di=0;di<7;di++){var day=plan[di]||[];for(var j=0;j<day.length;j++){var it=day[j];
    if(it&&typeof it==='object'&&!it.id){it.id='ps:'+Date.now().toString(36)+':'+(_psSeq++).toString(36)+':'+Math.random().toString(36).slice(2,6);assigned=true;}}}
  return assigned;
}
/* ============================================================
   BEOBACHTUNG AN DER ZENTRALEN PLANQUELLE (v8-296).

   BEFUND: Schatten, Vorhersagen und Retry-Herzschlag hingen im GENERATOR —
   aber activeWeekPlan() kehrt bei kanonischem oder gespeichertem Plan VOR
   dem Generator zurueck. Ein Nutzer mit bestehendem Plan (der Normalfall)
   erreichte den Observer NIE: Die Verdrahtung war getestet, der Weg
   dorthin nicht. Jetzt laeuft JEDER Rueckgabepfad durch diesen Wrapper;
   das Entscheidungs-Log der GENERIERUNG (week_design/final_plan) bleibt
   bewusst im Generator — es protokolliert die Entscheidung, nicht den
   Bestand.

   RENDER-STURM-DROSSEL: activeWeekPlan() wird je Render dutzendfach
   gerufen. Beobachtet wird ein UNVERAENDERTER Plan hoechstens einmal je
   Minute — ein GEAENDERTER sofort (der Schluessel enthaelt den Planinhalt).
   Die Drossel verliert nichts: Schatten dedupliziert per idempotencyKey,
   Vorhersagen per predictionId, der Herzschlag ueber das Ergebnis.
   ============================================================ */
var _gmObsLast={key:null,at:0};
/* PLAN-IDENTITAET AUCH OHNE KANONISCHES MODELL (v8-297): Bei gespeichertem
   Altplan lieferte _gmCanonPlan null fuer planId/planRevision — predict()
   lehnte fail-closed ab, und der Aufruf lief ins Leere: erreicht, aber
   wirkungslos. Der Altplan HAT eine ehrliche Identitaet: die Woche als
   Plan-ID und der INHALT als Revision — eine Bearbeitung ist eine neue
   Revision (alte Vorhersagen werden ehrlich superseded), unveraenderter
   Inhalt bleibt dieselbe. Kanonisch geladen gewinnt immer das Modell.
   Dieselbe Funktion speist gmDbSave — Vorhersage und Debrief tragen
   dieselbe Identitaet, sonst traefe sich nie etwas. */
function gmPlanIdentity(dateIso){
  try{
    if(typeof _gmCanonPlan!=='undefined'&&_gmCanonPlan&&_gmCanonPlan.plan){
      return {planId:_gmCanonPlan.plan.planId!=null?_gmCanonPlan.plan.planId:null,
        planRevision:_gmCanonPlan.plan.revision!=null?_gmCanonPlan.plan.revision:null,
        basis:'canonical'};
    }
  }catch(_e){}
  try{
    var p=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weekPlan)||null;
    if(p&&p.length===7){
      var wk=null;
      try{var PD=(window.ORVIA&&window.ORVIA.planDomain)||null;
        wk=PD&&PD.weekKeyFor?PD.weekKeyFor(dateIso||((typeof todayStr==='function')?todayStr():null)):null;}catch(_e2){wk=null;}
      if(!wk)return {planId:null,planRevision:null,basis:'none'};
      var s=JSON.stringify(p),h=5381;
      for(var ci=0;ci<s.length;ci++)h=((h<<5)+h+s.charCodeAt(ci))>>>0;
      return {planId:'weekplan:'+wk,planRevision:'wp:'+h.toString(16),basis:'stored_weekplan'};
    }
  }catch(_e3){}
  return {planId:null,planRevision:null,basis:'none'};
}
/* SPORT-IDENTITAET EINER PLANEINHEIT — EINE QUELLE FUER BEIDE SEITEN
   (v8-298): Der Debrief-Pfad mappte Rad->cycling/Schwimmen->swimming laengst,
   die Vorhersage nur das exakte 'Laufen' — Rad und Schwimmen wurden als
   sport:null prognostiziert und in der Kalibrierung zu 'unknown' vermengt.
   Dieselbe Funktion speist jetzt BEIDE Seiten; Drift ist damit unmoeglich. */
function gmSportIdOfUnit(u){
  if(u&&u.sportId)return u.sportId;
  var t=String((u&&u.t)||'').toLowerCase();
  if(t.indexOf('lauf')>=0)return 'running';
  if(t.indexOf('rad')>=0)return 'cycling';
  if(t.indexOf('schwimm')>=0)return 'swimming';
  return null;
}
function gmObserveWeekPlan(w,src){
  try{
    if(!Array.isArray(w))return w;
    var OI=(window.ORVIA&&ORVIA.observerInput)||null;
    if(!OI||!OI.build)return w;               /* ohne Eingangsmodul keine Beobachtung */
    /* DER EINE SNAPSHOT (v8-299, observer-input@1): Alle Quellen werden
       EINMAL eingesammelt, tief kopiert, eingefroren und gehasht. Schatten,
       Vorhersagen, Herzschlag UND Drossel arbeiten mit DEMSELBEN Zustand —
       die Drossel kann nichts mehr verschlucken, was im Snapshot steht,
       denn jede Aenderung aendert den Hash (auch Performance, Zielzeit,
       korrigierte Aktivitaeten). Quellen, die fehlen, werden als
       'unavailable' AUSGEWIESEN, nicht als leer gedeutet. */
    var snap=OI.build({
      userId:(window.ORVIA&&ORVIA.user&&ORVIA.user.id)||null,
      today:(typeof todayStr==='function')?todayStr():null,
      weekId:(function(){try{var PD=(window.ORVIA&&window.ORVIA.planDomain)||null;
        return PD&&PD.weekKeyFor?PD.weekKeyFor(todayStr()):null;}catch(_e){return null;}})(),
      currentPlan:w,
      planIdentity:(typeof gmPlanIdentity==='function')?gmPlanIdentity(null):undefined,
      /* P0 (v8-299): Die ECHTE Aktivitaetsquelle ist der activityStore —
         activitiesAll() existierte nie, DB.activities ist tagbasiert leer.
         Fehlt der Store, ist das 'unavailable', keine leere Liste. */
      activities:(function(){try{var st=window.ORVIA&&ORVIA.activityStore;
        return (st&&st.listActivities)?(st.listActivities()||[]):undefined;}catch(_e){return undefined;}})(),
      debriefs:(function(){try{return (typeof gmDbStore==='function')?(gmDbStore()||[]):undefined;}catch(_e){return undefined;}})(),
      sports:(function(){try{return (typeof PROFILE!=='undefined'&&PROFILE)?(PROFILE.sports||null):undefined;}catch(_e){return undefined;}})(),
      goal:(function(){try{return (typeof goalOf==='function')?(goalOf()||null):undefined;}catch(_e){return undefined;}})(),
      level:(function(){try{return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.level)||null;}catch(_e){return null;}})(),
      currentPerformance:(function(){try{return (window.ORVIA&&ORVIA._lastPlanPerf!==undefined)?ORVIA._lastPlanPerf:undefined;}catch(_e){return undefined;}})(),
      /* STEUERFELDER (v8-300): ohne sie sah C2 im echten Schatten weder
         Krankheit noch Taper, und Stufe 5 kein Zieldatum. */
      availability:(function(){try{return (window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)?(ORVIA.profileModel.effectiveTrainingConfig(typeof PROFILE!=='undefined'?PROFILE:null)||null):undefined;}catch(_e){return undefined;}})(),
      phase:(function(){try{
        var g=(typeof goalOf==='function')?goalOf():null;
        if(!g||!g.raceDate||typeof Calc==='undefined'||!Calc.racePhases)return null;
        var act=(Calc.racePhases(g.raceDate,todayStr())||[]).filter(function(p){return p&&p.on;})[0];
        if(!act)return null;
        return ({'Taper':'taper','Wettkampf':'race_week','Peak':'peak','Aufbau':'build'})[act.n]||null;
      }catch(_e){return null;}})(),
      /* ROHE Check-in-Serie der letzten 28 Tage (v8-301): ill dreiwertig
         (true/false/null=kein Check-in) + Red Flags. Die EPISODEN-Ableitung
         (symptomFreeDays, kein Fensterablauf) ist observer-input@3 —
         Verhalten gehoert in den versionierten Adapter, nicht hierher. */
      /* QUELLEN UEBER DAS VERSIONIERTE MODUL (v8-303): Die Beschaffung
         selbst ist jetzt Vertrag (observer-source@1) — hier wird nur noch
         verdrahtet. Fehlt das Modul, sind die Quellen 'unavailable' und
         das Abnahme-Gate schliesst aus (fail-closed), statt dass ui wieder
         selbst fachliche Zustaende sammelt. */
      checkins:(function(){try{
        var OS=window.ORVIA&&ORVIA.observerSource;
        if(!OS||!OS.checkinSeries)return undefined;
        return OS.checkinSeries((typeof DB!=='undefined'&&DB)||null,
          (typeof todayStr==='function')?todayStr():null);
      }catch(_e){return undefined;}})(),
      profileConstraints:(function(){try{
        var OS=window.ORVIA&&ORVIA.observerSource;
        if(!OS||!OS.safetyConstraints)return undefined;
        return OS.safetyConstraints(typeof PROFILE!=='undefined'?PROFILE:null);
      }catch(_e){return undefined;}})()
    });
    /* DIE DROSSEL IST DER SNAPSHOT-HASH: unveraenderter Zustand hoechstens
       einmal je Minute, JEDE Zustandsaenderung sofort. Setzt der Resolver
       _lastPlanPerf erst nach diesem Render, aendert das den Hash — die
       naechste Beobachtung laeuft dann mit Performance, statt dass der
       erste Lauf der einzige bliebe. gmDbSave bustet zusaetzlich direkt. */
    var key=String(src||'')+'|'+snap.hash;
    var nowMs=Date.now();
    if(_gmObsLast.key===key&&(nowMs-_gmObsLast.at)<60000)return w;
    _gmObsLast.key=key;_gmObsLast.at=nowMs;
    /* Schattenbetrieb: rechnet die adaptive Kette mit, VERAENDERT NICHTS.
       Weist `w` nichts zu — shadow_adaptive_test prueft diese Stelle. Alle
       Felder stammen aus dem EINEN Snapshot; planId traegt jetzt auch beim
       gespeicherten Altplan die weekplan:-Identitaet. */
    if(window.ORVIA&&ORVIA.logWeekShadow){
      ORVIA.logWeekShadow({
        weekId:snap.weekId,
        planId:snap.planIdentity.planId,
        today:snap.today,
        currentPlan:w,
        activities:snap.activities,
        debriefs:snap.debriefs,
        sports:snap.sports,
        /* STUFE-5-FORMEN AUS DEM ADAPTER (v8-300): goalOf()/Resolver-Formen
           direkt durchzureichen ergab IMMER insufficient_data — Stufe 5
           erwartet targetValue/metricType und EINEN Leistungswert. Die
           Uebersetzung ist observer-input@2 (kohortengebunden). */
        goal:(snap.derived&&snap.derived.feasibilityGoal)
          ? Object.assign({},snap.goal||{},snap.derived.feasibilityGoal)
          : snap.goal,
        currentPerformance:(snap.derived&&snap.derived.feasibilityPerformance)||null,
        targetDate:snap.targetDate,
        weeksLeft:snap.weeksLeft,
        availability:snap.availability,
        phase:snap.phase,
        lowWeekReason:snap.lowWeekReason,
        /* v8-301: EPISODE statt Fensterzaehlung, Sicherheitsschicht in
           C2-Form — beides aus dem versionierten Adapter. */
        interruption:(snap.derived&&snap.derived.interruption!==undefined)?snap.derived.interruption:snap.interruption,
        constraints:(snap.derived&&snap.derived.constraints)||null,
        level:snap.level,
        inputHash:snap.hash, inputVersion:snap.version, inputBasis:snap.basis
      });
    }
    if(window.ORVIA&&ORVIA.logWeekPredictions){
      ORVIA.logWeekPredictions({
        weekId:snap.weekId,
        planId:snap.planIdentity.planId,
        planRevision:snap.planIdentity.planRevision,
        today:snap.today,
        currentPlan:w,
        /* AUS DEM SNAPSHOT, NICHT AUS DER WELT (v8-300): Der verzoegerte
           Callback las O._lastPlanPerf und den lebenden Debrief-Speicher —
           eine Aenderung zwischen Snapshot und Callback haette die
           Vorhersage rueckwirkend veraendert. */
        performance:snap.currentPerformance,
        debriefs:snap.debriefs
      });
    }
    /* Retry-Herzschlag: offene pendings erneut versuchen — der Planlauf ist
       der natuerliche Takt, kein eigener Timer. */
    if(window.ORVIA&&ORVIA.reconcilePendingPredictions){
      ORVIA.reconcilePendingPredictions((function(){
        try{return (typeof gmDbStore==='function'&&gmDbStore())||[];}catch(_e){return [];}
      })());
    }
  }catch(_){ }
  return w;
}
function activeWeekPlan(){
  /* Phase 5F (2026-08-05): kanonischer Lesepfad. ALLE 7 Plan-Leser (Dashboard,
     Plan-Tab, Start-Sheet, Workout-UI, Wochenreview, Plan-Ist-Analyse, Coach-
     Briefing) laufen durch DIESE Funktion — ist das kanonische Modell geladen,
     liefert sie dessen effektiven Plan (Baseline ⊕ Overrides). Fallback ist die
     Projektion in PROFILE.weekPlan, die per Konstruktion identisch ist (5E) —
     es gibt keinen Zeitpunkt mit zwei Wahrheiten. Flag aus ⇒ reiner Legacy-Pfad.
     Leeres kanonisches Modell OHNE Overrides faellt bewusst auf den Legacy-/
     Generator-Pfad zurueck (kein persistierter Plan ⇒ Generator bleibt zustaendig). */
  try{
    if(typeof gmCanonPlanOn==='function'&&gmCanonPlanOn()){
      if(!_gmCanonPlan.plan&&typeof gmCanonPlanEnsure==='function')gmCanonPlanEnsure();
      var _PD5=(typeof gmCanonPlanDomain==='function')?gmCanonPlanDomain():null;
      if(_gmCanonPlan.plan&&_PD5&&_gmCanonPlan.weekKey===_PD5.weekKeyFor(todayStr())
         &&((_gmCanonPlan.plan.baseline&&_gmCanonPlan.plan.baseline.sessions&&_gmCanonPlan.plan.baseline.sessions.length)||( _gmCanonPlan.plan.overrides&&_gmCanonPlan.plan.overrides.length))){
        var _eff5=JSON.parse(JSON.stringify(_PD5.effectiveSessions(_gmCanonPlan.plan).days));
        try{
          var _cfg5=(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)?ORVIA.profileModel.effectiveTrainingConfig(PROFILE):null;
          return gmObserveWeekPlan(alignPlanToAvailability(_eff5,_cfg5),'canonical');
        }catch(_e5){return gmObserveWeekPlan(_eff5,'canonical');}
      }
    }
  }catch(_){ }
  var p=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weekPlan);
  if(p&&p.length===7){
    // Selbstheilung: früher fälschlich in die wiederkehrende Struktur geschriebene
    // Tagesanpassungen (adaptiveReplacement) entfernen → Originaleinheit wiederherstellen.
    var dirty=false;
    for(var di=0;di<7;di++){var day=p[di]||[];for(var j=0;j<day.length;j++){if(day[j]&&day[j].adaptiveReplacement){dirty=true;
      var orig=day[j].originalSession?Object.assign({},day[j].originalSession):null;if(orig)delete orig.kind;
      if(orig){day[j]=orig;}else{day.splice(j,1);j--;}}}}
    if(ensurePlannedSessionIds(p))dirty=true; // Batch 2b: fehlende IDs einmalig vergeben + persistieren
    if(dirty&&typeof saveProfile==='function'){try{saveProfile();}catch(_){}}
    /* FIX (2026-07-16): Verfügbarkeit auch auf den GESPEICHERTEN Plan anwenden (Ansicht/
       Entscheidung), ohne ihn zu persistieren — der Plan im Profil bleibt unangetastet. */
    try{
      var _cfg=(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)?ORVIA.profileModel.effectiveTrainingConfig(PROFILE):null;
      return gmObserveWeekPlan(alignPlanToAvailability(p,_cfg),'stored');
    }catch(e){return gmObserveWeekPlan(p,'stored');}
  }
  var g=(typeof generateWeekPlan==='function')?generateWeekPlan():null;
  // Batch 2c: auch GENERIERTE (nicht persistierte) Pläne erhalten stabile IDs —
  // deterministisch aus Position+Inhalt, damit sie über Reloads identisch bleiben
  // (der Generator ist bei gleichem Profil deterministisch). Wird der Plan später
  // gespeichert, bleiben die IDs erhalten; ensurePlannedSessionIds überschreibt nie.
  if(g)ensureGeneratedPlanIds(g);
  // Kein Rückfall mehr auf Gians festen Beispielplan — leerer 7-Tage-Rahmen ist neutral.
  return g?gmObserveWeekPlan(g,'generated'):[[],[],[],[],[],[],[]];
}
var PLAN_PRESETS=[
  {t:'Laufen',l:'Intervalle',d:'iv'},{t:'Laufen',l:'Z2 Dauerlauf',d:'ez'},{t:'Laufen',l:'Tempo',d:'tempo'},{t:'Laufen',l:'Long Run',d:'lr'},
  {t:'Rad',l:'Easy Z2',d:'60 min'},{t:'Rad',l:'Long Ride',d:'90 min'},{t:'Rad',l:'Commute',d:'Pendeln'},
  {t:'Schwimmen',l:'Technik',d:'~900 m'},{t:'Schwimmen',l:'Ausdauer',d:'~1000 m'},
  {t:'Gym',l:'Ganzkörper',d:'45 min'},{t:'Gym',l:'Oberkörper',d:'45 min'},{t:'Gym',l:'Push',d:'45 min'},{t:'Gym',l:'Pull',d:'45 min'},{t:'Gym',l:'Core',d:'30 min'},{t:'Gym',l:'Beine',d:'45 min'},
  {t:'Mobilität',l:'Mobility',d:'15 min'}];
/* GM7: hartkodierter Phasen-Zweitnamespace PHASES entfernt — einzige kanonische Quelle ist Calc.racePhases. */
const WEEK_TARGETS=[['Laufen',3,'run'],['Schwimmen',2,'swim'],['Gym',4,'dumbbell'],['Rad',2,'bike']];

/* ---- Mini-Helfer ---- */
function v(id){const e=document.getElementById(id);return e?e.value:'';}
/* Phase 4 (P2-4): relative Tageslabels zentral — Heute/Gestern/Morgen ersetzen den
   Wochentag, das absolute Datum bleibt erhalten (kein Informationsverlust). Innerhalb
   der laufenden Woche traegt der Wochentagsname die Relation bereits. */
function fmtDate(s){
  try{
    var _F=(window.ORVIA&&ORVIA.fmt)||null;
    var rl=(_F&&_F.dayLabel)?_F.dayLabel(s,todayStr()):null;
    if(rl==='Heute'||rl==='Gestern'||rl==='Morgen')
      return rl+', '+new Date(s+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'long'});
  }catch(_){ }
  return new Date(s+'T12:00').toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'});
}
function daysTo(date){return Math.round((new Date(date+'T00:00')-new Date(todayStr()+'T00:00'))/864e5);}
function avg(a){return Calc.avg(a);}
function fmtPace(s){return Calc.fmtPace(s);}

/* ---- Toast (mit optionaler Aktion, z. B. Rückgängig) ---- */
let _toastFn=null;
function toast(m){const t=document.getElementById('toast');t.classList.remove('act');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1600);}
function toastAction(msg,label,fn){const t=document.getElementById('toast');_toastFn=fn;
  t.innerHTML=esc(msg)+' <button class="tbtn" onclick="_toastFn&&_toastFn();document.getElementById(\'toast\').classList.remove(\'show\')">'+esc(label)+'</button>';
  t.classList.add('show','act');clearTimeout(t._t);t._t=setTimeout(()=>{t.classList.remove('show','act');},5000);}

/* ---- Autosave: ein Timer PRO Formular + synchroner Flush vor Kontextwechsel ---- */
const _debT={};
function debounce(key,fn){if(_debT[key])clearTimeout(_debT[key].t);_debT[key]={t:setTimeout(()=>{delete _debT[key];fn();},150),fn};}
function flushAuto(){Object.keys(_debT).forEach(k=>{const d=_debT[k];clearTimeout(d.t);delete _debT[k];d.fn();});}

/* ---- Slider/Chips ---- */
function slider(id,label,min,max,def,lo,hi){
  return `<div class="field"><label>${label}<span class="val" id="${id}_v">${def}</span></label>
    <input type="range" id="${id}" min="${min}" max="${max}" value="${def}" oninput="sv('${id}',${min},${max})">
    <div class="scale"><span>${lo||min}</span><span>${hi||max}</span></div></div>`;}
function sv(id,min,max){const el=document.getElementById(id);const val=+el.value;const lab=document.getElementById(id+'_v');if(lab)lab.textContent=val;el.style.setProperty('--p',((val-min)/(max-min)*100)+'%');}
function initRanges(){document.querySelectorAll('input[type=range]').forEach(el=>{if(el.id==='m_sleep')return;sv(el.id,+el.min,+el.max);});}
function chips(label,id,opts,sel,multi,green){sel=sel||[];
  const b=opts.map(o=>`<button type="button" class="chip${green?' gn':''}${sel.includes(o)?' on':''}" data-v="${esc(o)}" onclick="chipTap('${id}','${jsArg(o)}',${!!multi})">${esc(o)}</button>`).join('');
  return `<div class="field"><label>${label}</label><div class="chips" id="${id}">${b}</div></div>`;}
function chipTap(id,val,multi){const box=document.getElementById(id);const btn=[...box.children].find(c=>c.dataset.v===val);if(!btn)return;
  if(multi)btn.classList.toggle('on');else{[...box.children].forEach(c=>c.classList.remove('on'));btn.classList.add('on');}}
function chipGet(id){const box=document.getElementById(id);if(!box)return[];return[...box.children].filter(c=>c.classList.contains('on')).map(c=>c.dataset.v);}

/* ============ KONTEXT-BUILDER (Baselines, Fenster) ============ */
function recoveryCtx(dateStr){
  const ln7=[],ln28=[],rhr28=[],sleep7=[],sleep28=[],bb28=[];let lowStreak=0,streakDone=false;
  /* v8-320: Krankheitsverlauf. `ill` ist heute ein Ja/Nein — an dem Tag, an dem
     man den Haken wegnimmt, ist man sofort wieder voll belastbar. Physiologisch
     ist der Wiedereinstieg nach einem Infekt graduell. Hier wird im BEREITS
     laufenden Durchlauf ermittelt: wie viele Tage ist die letzte Krankheit her
     (0 = heute noch krank) und wie lange hat sie am Stueck gedauert. */
  const illDays=[];
  for(let i=1;i<=28;i++){
    const d=new Date(dateStr+'T12:00');d.setDate(d.getDate()-i);
    const e=DB[todayStr(d)];const m=e&&e.morning;if(!m)continue;
    if(m.hrvMs){const ln=Math.log(m.hrvMs);ln28.push(ln);if(i<=7)ln7.push(ln);}
    if(m.rhr!=null)rhr28.push(m.rhr);
    if(i<=7&&m.sleepMin!=null)sleep7.push(m.sleepMin);
    /* v8-318: eigene Historie fuer Schlafdauer und Body Battery — im BEREITS
       laufenden 28-Tage-Durchlauf, also ohne zusaetzliche Kosten. */
    if(m.sleepMin!=null&&m.sleepMin>120&&m.sleepMin<900)sleep28.push(m.sleepMin);
    if(m.bb!=null&&m.bb>=0&&m.bb<=100)bb28.push(m.bb);
    if(m.ill)illDays.push(i);          /* i = Tage vor dateStr */
    /* v8-317: SCHWELLE statt Gleichheit. Vorher `s===25` — das war der eine
       Wert, den der alte HRV-Zweig für 'Low'/'Unbalanced' vergab. Mit den
       korrigierten Garmin-Kategorien (Low 38, Poor 22, Unbalanced 62) hätte
       ein Gleichheitsvergleich die Strähne still nie wieder erkannt. Gemeint
       war immer „HRV im schlechten Bereich" — genau das steht jetzt da.
       'Unbalanced' zählt bewusst NICHT als Strähne: es heißt leicht neben der
       eigenen Baseline, nicht deutlich darunter. */
    if(!streakDone){const s=Calc.hrvScoreOf(m,null);if(s!=null&&s<=40)lowStreak++;else streakDone=true;}
  }
  /* v8-317: Trifft der Muskelkater die HEUTE geplante Belastung? Die
     Entscheidungsseite wusste das längst (evaluateDomsImpact), der Score
     nicht — Beinmuskelkater drückte auch an einem Oberkörpertag voll durch.
     Hier EINMAL bestimmt und an readiness() weitergereicht; ohne bekannte
     Region bleibt es bei null (= konservativ, volles Gewicht wie bisher). */
  /* v8-317: groesster erfasster Schmerz des Tages ueber ALLE Regionen — dieselbe
     Ableitung wie in getDecision (Knie + e.issues). Ohne sie kannte readiness()
     nur den Knieschmerz, und Huefte/Ruecken/Schulter bewegten den Rohwert nie. */
  let painToday=null;
  try{
    const _e=DB[dateStr]||null,_m=(_e&&_e.morning)||null;
    if(_m){
      painToday=(_m.knee!=null?_m.knee:null);
      if(_e.issues)Object.keys(_e.issues).forEach(function(k){const vv=_e.issues[k];
        if(typeof vv==='number'&&(painToday==null||vv>painToday))painToday=vv;});
    }
  }catch(_){painToday=null;}
  let domsHitsToday=null;
  try{
    const _mToday=(DB[dateStr]&&DB[dateStr].morning)||null;
    if(_mToday&&_mToday.domsRegion&&typeof Calc.evaluateDomsImpact==='function'){
      const _u=(typeof todayPrimaryUnit==='function')?todayPrimaryUnit():null;
      const _tt=(typeof Calc.classifyTrainingType==='function')?Calc.classifyTrainingType(_u):null;
      domsHitsToday=!!Calc.evaluateDomsImpact({doms:_mToday.doms,domsRegion:_mToday.domsRegion},_tt).hits;
    }
  }catch(_){domsHitsToday=null;}
  /* ═══ v8-319 · GEMESSENE SCHLAFDATEN STATT ERSATZWERTE ════════════════
     Der Worker synchronisiert seit Langem sleep_need_min (Garmins eigener,
     personalisierter Schlafbedarf), sleep_score und die Phasen — im Produkt
     hatte sleep_need_min NULL Verwendungsstellen und der Sleep Score floss
     nirgends in die Bewertung. Der 28-Tage-Median aus v8-318 war ein
     Hilfswert fuer genau diesen Fall; liegt der gemessene Bedarf vor, gewinnt
     er. Reihenfolge: gemessen > eigener Median > fest (480, in calc.js).
     Fehlt der Metrik-Cache oder ist er zu schmal, liefern die Helfer null und
     alles bleibt beim v8-318-Verhalten — keine erfundenen Werte. */
  function _metricVal(id){
    try{var r=(typeof gmMetric==='function')?gmMetric(id):null;
      return (r&&typeof r.value==='number'&&isFinite(r.value))?r.value:null;}catch(_){return null;}
  }
  function _sleepNeed(hist){
    var measured=_metricVal('sleep_need_min');
    if(measured!=null&&measured>240&&measured<720)return measured;
    return (hist&&hist.length>=14)?Calc.median(hist):null;
  }
  /* Anteil aus Tief- und REM-Schlaf gegen die EIGENE Verteilung. Der absolute
     Minutenwert haengt an der Schlafdauer und waere doppelt gezaehlt; der
     ANTEIL ist die zusaetzliche Information. Braucht 14 eigene Naechte. */
  function _phaseShare(){
    try{
      if(typeof gmMetricSeries!=='function')return {today:null,base:null,n:0};
      var dp=gmMetricSeries('sleep_deep_min',28),rm=gmMetricSeries('sleep_rem_min',28),
          du=gmMetricSeries('sleep_duration_min',28);
      if(!dp||!rm||!du)return {today:null,base:null,n:0};
      var byD={},byR={};
      dp.dates.forEach(function(d,i){byD[d]=dp.values[i];});
      rm.dates.forEach(function(d,i){byR[d]=rm.values[i];});
      var shares=[],last=null;
      du.dates.forEach(function(d,i){
        var tot=du.values[i],de=byD[d],re=byR[d];
        if(!(tot>0)||de==null||re==null)return;
        var sh=(de+re)/tot;
        if(!(sh>0&&sh<1))return;
        shares.push(sh);last={date:d,share:sh};
      });
      if(shares.length<14)return {today:null,base:null,n:shares.length};
      var today=(last&&last.date===dateStr)?last.share:null;
      return {today:today,base:Calc.median(shares),n:shares.length};
    }catch(_){return {today:null,base:null,n:0};}
  }
  const _ph=_phaseShare();
  /* Krankheitsverlauf zusammenfassen: juengster Krankheitstag und die Laenge
     der ZUSAMMENHAENGENDEN Phase, die dort endet. Eine Erkaeltung vor drei
     Wochen soll den heutigen Tag nicht mehr bremsen — deshalb zaehlt nur die
     letzte, direkt zurueckliegende Phase. */
  let illSinceEnd=null,illDuration=0;
  try{
    const illToday=!!((DB[dateStr]&&DB[dateStr].morning)||{}).ill;
    if(illToday){
      illSinceEnd=0;illDuration=1;
      for(let k=1;k<=28;k++){if(illDays.indexOf(k)>=0)illDuration++;else break;}
    }else if(illDays.length){
      const last=Math.min.apply(null,illDays);
      illSinceEnd=last;illDuration=1;
      for(let k=last+1;k<=28;k++){if(illDays.indexOf(k)>=0)illDuration++;else break;}
    }
  }catch(_){illSinceEnd=null;illDuration=0;}
  return{hrvBase7:ln7.length>=4?Calc.avg(ln7):null,hrvSd28:Calc.sd(ln28),hrvN:ln28.length,
    sleepNeedMeasured:_metricVal('sleep_need_min'),
    sleepScore:_metricVal('sleep_score'),
    /* v9: gemessener Tages-Stress (Garmin 0–100) statt der Low/Med/High-Kategorie.
       Die Metrik liegt seit GM7.4 in der Registry, wurde im Score aber nie gelesen. */
    stressAvg:_metricVal('stress_avg'),
    phaseShareToday:_ph.today,phaseShareBase:_ph.base,phaseN:_ph.n,
    illSinceEnd:illSinceEnd,illDuration:illDuration,
    rhrBase:rhr28.length>=7?Calc.median(rhr28):null,rhrN:rhr28.length,
    /* v9: eigene Streuung des Ruhepulses — Grundlage der neuen, streuungs-
       basierten Bewertung in Calc.readiness. Braucht dieselben >=7 Tage wie
       die Baseline; darunter null, dann greift dort der Ersatzwert. */
    rhrSd:rhr28.length>=7?Calc.sd(rhr28):null,
    /* v8-318/319: die Schlafschuld zaehlt gegen den Bedarf, nicht gegen fest
       verdrahtete 8 h. RANGFOLGE (v8-319): Garmins GEMESSENER Schlafbedarf
       (sleep_need_min) schlaegt den 28-Tage-Median-Ersatz aus v8-318 — der war
       immer nur ein Hilfswert fuer den Fall, dass kein gemessener Bedarf
       vorliegt. Beide werden in calc.js auf 7–8 h begrenzt. */
    sleepDebtH:sleep7.length>=4?Calc.sleepDebt(sleep7,_sleepNeed(sleep28)):null,hrvLowStreak:lowStreak,
    domsHitsToday:domsHitsToday,painToday:painToday,
    /* ═══ v8-318 · MITWACHSENDE REFERENZEN ═══════════════════════════════
       Gians Vorgabe: „Der Score darf nichts mit perfekten Werten zu tun haben
       … es gibt Daten, die sich mit der Zeit entwickeln, und das muss
       eingerechnet werden." Fuer HRV (hrvBase7/hrvSd28) und Ruhepuls
       (rhrBase) galt das laengst — Schlafdauer und Body Battery wurden
       dagegen gegen FESTE Schwellen gerechnet (5–8 h bzw. Rohwert). Wer
       gewohnheitsmaessig 7 h braucht, wurde damit dauerhaft unter 100
       gehalten, obwohl er ausgeschlafen ist.
       Beide Referenzen sind der eigene Median der letzten 28 Tage. MINDESTENS
       14 eigene Tage — darunter bleibt der Wert null und calc.js benutzt
       weiterhin die bisherige feste Rampe. Keine erfundene Baseline. */
    sleepBase:_sleepNeed(sleep28),
    sleepSd:sleep28.length>=14?Calc.sd(sleep28):null,
    sleepN:sleep28.length,
    bbBase:bb28.length>=14?Calc.median(bb28):null,
    bbN:bb28.length};
}
function readinessFor(k){const e=DB[k];if(!e||!e.morning||e.morning.knee==null)return{score:''};return Calc.readiness(e.morning,recoveryCtx(k));}
function readinessOf(k){const e=DB[k];return(e&&e.morning&&e.morning.knee!=null)?Calc.readiness(e.morning,recoveryCtx(k)).score:null;}
// Zentraler Lauf-Filter (Calc.isValidRunForAnalytics) — schließt fehlerhafte/zu schnelle/markierte Läufe
// aus ALLEN laufbezogenen Auswertungen aus (Bestzeiten, Prognosen, Effizienz, Wochen-km, Pace).
function _validRun(r){return (typeof Calc!=='undefined'&&Calc.isValidRunForAnalytics)?Calc.isValidRunForAnalytics(r):!!r;}
/* Ziel-SSOT/Analytics (2026-07-18): Läufe aus dem kanonischen Activity-Store
   (Garmin-Worker/Sync) je LOKALEM Tag. Vorher zählten runsWindow/weekRunKm nur
   Blob-Sessions — synchronisierte Läufe fehlten komplett in der Prognose.
   Blob-Session gewinnt je Tag (reicher: sub/RPE/Knie); der Store füllt Lücken.
   sub bleibt '' — Quality-Erkennung erfordert weiterhin eine Klassifizierung. */
/* I2c: Einzelne kanonische Store-/Garmin-Laufsessions mit STABILER ID — die Quelle der
   Session-Identität. KEINE Verschmelzung, KEINE Tages-/Wochenaggregation hier. tz-lokaler Tag
   via activityConfig.dayOfActLocal(effectiveTimezone), Fallback todayStr. Kanonische
   Sportnormalisierung (normSport) verwirft nur EXPLIZIT anders getaggte Aktivitäten. */
function _storeRunSessions(){
  try{
    var st=window.ORVIA&&ORVIA.activityStore;if(!st||!st.listActivities)return [];
    var tz=(window.ORVIA&&ORVIA.profileStore&&ORVIA.profileStore.effectiveTimezone)?ORVIA.profileStore.effectiveTimezone():'UTC';
    var cfg=window.ORVIA&&ORVIA.activityConfig;
    var dayOf=(cfg&&cfg.dayOfActLocal)?cfg.dayOfActLocal:null;
    var norm=(window.ORVIA&&ORVIA.trainingDomain&&ORVIA.trainingDomain.normSport)?ORVIA.trainingDomain.normSport:null;
    var out=[];
    st.listActivities({sportId:'running'}).forEach(function(a){
      if(!a)return;
      if(norm&&a.sportId!=null&&norm(a.sportId)!=='running')return;
      if(a.status&&a.status!=='completed')return;
      if(!a.startedAt)return;
      var k=dayOf?dayOf(a,tz):null;
      if(!k){var dt=new Date(a.startedAt);if(isNaN(dt.getTime()))return;k=todayStr(dt);}
      var s=a.summary||{};
      var distKm=s.distance_m!=null?s.distance_m/1000:(s.distanceKm!=null?s.distanceKm:(s.distanceM!=null?s.distanceM/1000:null));
      var durMin=a.durationSeconds!=null?a.durationSeconds/60:null;
      if(!(distKm>0&&durMin>0))return;
      var hr=s.avg_hr!=null?s.avg_hr:(s.avgHr!=null?s.avgHr:null);
      var el=s.elevation_gain_m!=null?s.elevation_gain_m:(s.elevationM!=null?s.elevationM:null);
      out.push({id:a.clientRecordId||a.sourceRecordId||a.id||null,day:k,
        distKm:Math.round(distKm*100)/100,durMin:Math.round(durMin),
        hr:hr!=null?Math.round(hr):null,elevM:el!=null?Math.round(el):null,source:'sync'});
    });
    return out;
  }catch(e){return [];}
}
/* I2c: AUSDRÜCKLICHER Tagesaggregat-Vertrag (NICHT eine Einzelsession). dist/dur/elev sind
   Tagessummen (nur für Wochenumfang), longestKm = größte EINZELsession des Tages, sessionCount
   = Anzahl, sessions[] = identitätserhaltende Einzelsessionliste. Getrennte Läufe verschmelzen
   NIE zu einer künstlichen Long-Run-Session. Aufbau strikt aus _storeRunSessions(). */
function _storeRunsByDay(){
  var map={};
  _storeRunSessions().forEach(function(x){
    var e=map[x.day];
    if(!e){e=map[x.day]={sub:'',dist:0,dur:0,hr:null,elev:0,longestKm:0,sessionCount:0,sessions:[],source:'sync',_hrsum:0,_hrw:0};}
    e.dist+=x.distKm;e.dur+=x.durMin;e.sessionCount+=1;e.sessions.push(x);
    if(x.distKm>e.longestKm)e.longestKm=x.distKm;
    if(x.hr!=null){e._hrsum+=x.hr*x.durMin;e._hrw+=x.durMin;}
    if(x.elevM!=null)e.elev+=x.elevM;
  });
  Object.keys(map).forEach(function(k){var e=map[k];
    e.dist=Math.round(e.dist*100)/100;e.dur=Math.round(e.dur);e.longestKm=Math.round(e.longestKm*100)/100;
    e.hr=e._hrw>0?Math.round(e._hrsum/e._hrw):null;e.elev=Math.round(e.elev);
    delete e._hrsum;delete e._hrw;});
  return map;
}
function runsWindow(days){const out=[];const ext=_storeRunsByDay();for(let i=days-1;i>=0;i--){const k=dkey(-i);const e=DB[k];const r=e&&e.sessions&&e.sessions.Laufen;if(r&&_validRun(r))out.push(Object.assign({date:k},r));else if(ext[k])out.push(Object.assign({date:k},ext[k]));}return out;}
/* I2c: Längster EINZELlauf (km) in den letzten `days` Tagen — distanzbasiert, ohne .sub-Label,
   Session-genau (keine Tages-Summen ⇒ zwei 5-km-Läufe ergeben NICHT einen 10-km-Long-Run).
   Dedupe wie runsWindow: Blob-Session gewinnt je Tag (ersetzt die Store-Sessions dieses Tages),
   sonst größte Store-Einzelsession des Tages. Umfasst Store-/Garmin-Läufe OHNE Legacy-.sub. */
function _longestRunKm(days){
  var byDay=_storeRunsByDay();var max=0;
  for(var i=days-1;i>=0;i--){
    var k=dkey(-i);var e=DB[k];var r=e&&e.sessions&&e.sessions.Laufen;
    if(r&&_validRun(r)){ if((r.dist||0)>max)max=r.dist||0; }            // Blob gewinnt je Tag (Einzelsession)
    else if(byDay[k]){ if(byDay[k].longestKm>max)max=byDay[k].longestKm; } // größte Store-Einzelsession
  }
  return Math.round(max*100)/100;
}
function weekRunKm(off){var anc=new Date(todayStr()+'T12:00:00');var day=(anc.getDay()+6)%7;var mon=new Date(anc);mon.setDate(anc.getDate()-day-7*(off||0));
  // I2: Wochen-km = kanonischer Wochenvertrag (weeklyActivityTotals). weekRef = Montag der
  // injizierten Referenzwoche; identischer Eingang wie Wochenreview/Plan: listActivities()+DB,
  // effektive Nutzerzeitzone, Dedupe/Legacy-Merge im Aggregator. knownDistanceKm = robuste
  // Teilsumme (fehlende Einzeldistanzen senken den Wert nicht auf null).
  var weekRef=todayStr(mon);
  var st=window.ORVIA&&ORVIA.activityStore;
  var cfg=window.ORVIA&&ORVIA.activityConfig;
  // I2b: fehlt der kanonische Vertrag (Activity Store / weeklyActivityTotals), ist das Ergebnis
  // UNBEKANNT (null) — eine falsche 0 km würde Nutzer/Engine eine leere Woche vorspiegeln.
  // Eine ECHTE Null-Woche (Vertrag vorhanden, keine Läufe) bleibt weiterhin 0.
  if(!st||!st.listActivities||!cfg||!cfg.weeklyActivityTotals)return null;
  var tz=(window.ORVIA&&ORVIA.profileStore&&ORVIA.profileStore.effectiveTimezone)?ORVIA.profileStore.effectiveTimezone():'UTC';
  var acts=st.listActivities();
  var ts=st.isTombstoned?st.isTombstoned:null;
  var wk=cfg.weeklyActivityTotals(acts,DB,{weekRef:weekRef,timezone:tz,isTombstoned:ts});
  if(!wk)return null;                                     // Vertrag lieferte kein Ergebnis ⇒ unbekannt, nicht 0
  return (wk.bySport&&wk.bySport.running&&wk.bySport.running.knownDistanceKm)||0;
}
function allLoads(){
  const keys=Object.keys(DB).filter(isDay).sort();
  const n=Math.min(365,Math.max(90,keys.length?Math.round((new Date(todayStr())-new Date(keys[0]))/864e5)+1:90));
  // I3a: kanonische Tageslast-Serie (Store+Legacy dedupliziert, Provenienz, Missingness,
  // tz-korrekt) statt blob-only sessionLoad. Garmin-ohne-RPE ⇒ geschätzt (nicht 0),
  // unbekannte Tage ⇒ nicht als Ruhe. loadSeries/loadModel bleiben unverändert (Regel 7/8).
  var _cfg=(window.ORVIA&&ORVIA.activityConfig)?ORVIA.activityConfig:null;
  var _st=(window.ORVIA&&ORVIA.activityStore)?ORVIA.activityStore:null;
  var _tz=(window.ORVIA&&ORVIA.profileStore&&ORVIA.profileStore.effectiveTimezone)?ORVIA.profileStore.effectiveTimezone():'UTC';
  var _ts=(_st&&_st.isTombstoned)?_st.isTombstoned:null;
  if(_cfg&&_cfg.dailyLoadSeries&&_st&&_st.listActivities){
    var _ser=_cfg.dailyLoadSeries(_st.listActivities(),DB,{days:n,endDay:todayStr(),timezone:_tz,isTombstoned:_ts});
    if(_ser){
      const labels=_ser.days.map(d=>new Date(d.day+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));
      return{loads:_ser.loads,measuredLoads:_ser.measuredLoads,labels:labels,confidence:_ser.confidence,completeness:_ser.completeness,valid:_ser.valid,known:_ser.knownMask,acuteAssessable:_ser.acuteAssessable,provenance:'canonical'};
    }
  }
  // Fallback (kanonischer Vertrag nicht verfügbar): blob-only, AUSGEWIESEN reduziert.
  const loads=[],labels=[];
  for(let i=n-1;i>=0;i--){const k=dkey(-i);loads.push(Calc.sessionLoad(DB[k]));labels.push(new Date(k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));}
  // I3a.1: Fehlt der kanonische Provider, KEIN Legacy-Lastfallback für Safety: acuteAssessable=false.
  return{loads,labels,measuredLoads:null,confidence:'reduziert',completeness:null,valid:true,known:null,acuteAssessable:false,provenance:'legacy_fallback'};
}
/* ============================================================
   I3 Part B — Dünner Daten-Adapter für den kanonischen Plan-Ist-Resolver.
   KEINE Erfüllungslogik im UI: baut nur planbezogene Occurrences + kanonische Aktivitäten
   und ruft Calc.resolvePlanActual (SSOT). Automatische Verknüpfung ausschließlich über
   plan-eigene Identität (occurrenceId 'po:<localDate>:<templateSessionId>'): reale Workouts
   tragen sie in metrics.plannedSessionId (activity-store.js:64), plan_done-Marker im DB-Blob
   tragen sie direkt. Tag+Sport allein verknüpfen NIE (nur ambiguous/unknown). Eine Quelle
   für Heute-Chip (planFulfillmentToday) und Planseite (renderWeekPlan). */
function _planActualNorm(v){
  var nd=(window.ORVIA&&ORVIA.trainingDomain&&ORVIA.trainingDomain.normSport)?ORVIA.trainingDomain.normSport:null;
  return nd?nd(v):String(v||'').toLowerCase();
}
function _planActualWeekdayIndex(dateStr){ return (new Date(dateStr+'T12:00').getDay()+6)%7; }
function planActualResolveForDates(dates){
  dates=(dates||[]).filter(Boolean);
  var dateSet={}; dates.forEach(function(d){ dateSet[d]=true; });
  var store=(window.ORVIA&&ORVIA.activityStore)||null;
  var cfg=(window.ORVIA&&ORVIA.activityConfig)||null;
  var tz=(window.ORVIA&&ORVIA.profileStore&&ORVIA.profileStore.effectiveTimezone)?ORVIA.profileStore.effectiveTimezone():'UTC';
  var activitiesLoaded=!!(store&&store.listActivities);
  var planLoaded=(typeof activeWeekPlan==='function');
  // Occurrences: je Datum den (wiederkehrenden) Wochenplan-Slot; plan-eigene ID 'po:<date>:<templateId>'.
  var planned=[];
  if(planLoaded){
    var wp=activeWeekPlan();
    dates.forEach(function(day){
      var wd=_planActualWeekdayIndex(day);
      var items=(wp&&wp[wd])||[];
      items.forEach(function(it){
        if(!it||!it.t)return;
        var occ=it.id?('po:'+day+':'+it.id):null;
        planned.push({occurrenceId:occ, sportId:_planActualNorm(it.t), localDate:day, plannedDurationMin:null, plannedDistanceKm:null});
      });
    });
  }
  // Kanonische Aktivitäten (Store): plan-eigene Identität NUR via metrics.plannedSessionId.
  var activities=[];
  if(activitiesLoaded){
    var acts=store.listActivities()||[];
    acts.forEach(function(a){
      var ld=(cfg&&cfg.dayOfActLocal)?cfg.dayOfActLocal(a,tz):((a.startedAt||'').slice(0,10));
      if(!dateSet[ld])return;
      var dm=(a.durationSeconds!=null)?Math.round(a.durationSeconds/60):null;
      var dk=(a.summary&&a.summary.distanceKm!=null)?a.summary.distanceKm:null;
      var _pl=(store&&store.planLinkOf)?store.planLinkOf(a):((a.metrics&&a.metrics.plannedSessionId)||null);
      activities.push({activityId:(a.id||a.clientRecordId), sportId:_planActualNorm(a.sportId), localDate:ld,
        plannedSessionId:_pl, durationMin:dm, distanceKm:dk,
        load:null, loadKnown:false, source:a.source||null, externalId:a.sourceRecordId||null});
    });
    // Explizite plan_done-Marker (DB-Blob): datenlos, aber plan-eigene Identität (Nutzer-Assertion).
    dates.forEach(function(day){
      var e=(typeof DB!=='undefined'&&DB)?DB[day]:null; var ses=e&&e.sessions; if(!ses)return;
      Object.keys(ses).forEach(function(t){ if(t==='_ts')return; var s=ses[t]||{};
        if(s.source==='plan_done'&&s.plannedSessionId){
          activities.push({activityId:('plandone:'+day+':'+t), sportId:_planActualNorm(t), localDate:day,
            plannedSessionId:s.plannedSessionId, durationMin:null, distanceKm:null, load:null, loadKnown:false, source:'plan_done', externalId:null});
        }
      });
    });
  }
  var today=(typeof todayStr==='function')?todayStr():null;
  // I3b.1 FAIL-CLOSED: fehlt der kanonische Resolver oder wirft er, wird NICHTS erfüllt.
  // KEIN Rückfall auf Tag+Sport. resolverAvailable=false ⇒ Konsumenten zeigen 'nicht bestimmbar'.
  var res;
  try{
    if(!(typeof Calc!=='undefined'&&Calc.resolvePlanActual))throw new Error('resolver_missing');
    res=Calc.resolvePlanActual(planned, activities, {today:today, activitiesLoaded:activitiesLoaded, planLoaded:planLoaded});
    res.resolverAvailable=true;
  }catch(_re){
    res={results:[], unmatched:[], byDay:{}, resolverAvailable:false, provenance:{activitiesLoaded:activitiesLoaded, planLoaded:planLoaded, today:today}};
  }
  var byOcc={};
  (res.results||[]).forEach(function(r){ if(r.plannedSessionId!=null) byOcc[r.plannedSessionId]=r; });
  res.byOcc=byOcc;
  return res;
}
/* Heute-Chip: EIN Tagesstatus aus dem Resolver, gemappt auf die bestehende pf-Vokabular. */
function planActualToday(){
  var UNBEST={key:'unbestimmt',label:'Nicht bestimmbar',assessable:false};
  var today=(typeof todayStr==='function')?todayStr():null;
  if(!today)return UNBEST;
  var res=planActualResolveForDates([today]);
  // I3b.1 FAIL-CLOSED: Resolver fehlt/fehlgeschlagen ODER Activity-Quelle fehlt ⇒ nicht bestimmbar.
  if(!res||res.resolverAvailable===false||!(res.provenance&&res.provenance.activitiesLoaded))return UNBEST;
  var day=res.byDay&&res.byDay[today];
  var hasUnmatched=(res.unmatched||[]).some(function(u){ return u.localDate===today; });
  if(!day){
    if(hasUnmatched)return{key:'ungeplant',label:'Ungeplante Einheit',assessable:true};
    return{key:'keins',label:'',assessable:true};
  }
  if(day.status==='ambiguous')return UNBEST;   // mehrdeutig ⇒ ehrlich nicht bestimmbar
  if(day.status==='unknown'&&hasUnmatched)return{key:'ungeplant',label:'Ungeplante Einheit',assessable:true};
  var map={completed:{key:'erfuellt',label:'Plan erfüllt',assessable:true},
           partial:{key:'teilweise',label:'Teilweise erfüllt',assessable:(day.assessable!==false)},
           missed:{key:'ausgefallen',label:'Einheit ausgefallen',assessable:true},
           unknown:{key:'offen',label:'Geplant',assessable:false}};
  return map[day.status]||UNBEST;
}

let _goalCache=null,_goalCacheT=0;
/* P1: Hook für ui-refresh.js — _goalCache ist let-gescopet und von außen sonst unerreichbar. */
window.orviaGoalCacheInvalidate=function(){_goalCache=null;};
function buildGoal(){
  if(_goalCache&&Date.now()-_goalCacheT<5000)return _goalCache;
  const ld=allLoads();const ctlArr=Calc.loadSeries(ld.loads).ctl; // R1.4: eine Kurvenquelle
  const keys=Object.keys(DB).filter(isDay).sort();
  const trackingWeeks=keys.length?Math.floor((new Date(todayStr())-new Date(keys[0]))/(7*864e5)):0;
  // I2c: Missingness strukturiert bis zur Prognose propagieren — unbekannte Vorwochen NICHT zu 0
  // koalieren (das würde einen Trainingsmangel erfinden). avg4WeekKm = Mittel der BEKANNTEN
  // Vorwochen; <2 bekannte Wochen ⇒ null ⇒ goalEngine markiert Volumen als not_assessable und
  // reduziert die Confidence, statt ein 0-km-Veto zu feuern. Bekannte Null-Wochen bleiben 0.
  var _prevW=[weekRunKm(1),weekRunKm(2),weekRunKm(3),weekRunKm(4)];
  var _known=_prevW.filter(function(v){return v!=null;});
  var _avg4=_known.length>=2?(_known.reduce(function(a,b){return a+b;},0)/_known.length):null;
  _goalCache=Calc.goalEngine(runsWindow(42),{
    daysToRace:daysTo(RACE.date),targetMin:goalTargetMin(),   // Ziel-SSOT statt Legacy-Blob
    avg4WeekKm:_avg4,
    targetWeekKm:Calc.weekKmTarget(daysTo(RACE.date),0),
    lrMax28:_longestRunKm(28),   // I2c: distanzbasiert, Session-genau, inkl. Store-/Garmin-Läufe ohne .sub
    ctlNow:ctlArr[ctlArr.length-1]??null,ctlPrev28:ctlArr.length>28?ctlArr[ctlArr.length-29]:null,trackingWeeks,
    loadConfidence:ld.confidence});   // I3a.3: bestehende Last-Confidence für das CTL-Trend-Veto (kein Duplikat)
  _goalCacheT=Date.now();return _goalCache;
}
function nextRunInfo(ampelC,readyScore){
  const wd=(new Date(todayStr()+'T12:00').getDay()+6)%7;
  const planRun=(activeWeekPlan()[wd]||[]).find(p=>p.t==='Laufen');
  let lastRun=null;
  for(let i=1;i<=14;i++){const k=dkey(-i);const e=DB[k];const r=e&&e.sessions&&e.sessions.Laufen;
    if(r){lastRun={sub:r.sub,knee:r.knee,daysAgo:i,morningKnee:e.morning?e.morning.knee:null};break;}}
  const y=DB[dkey(-1)],y2=DB[dkey(-2)];const m=(DB[todayStr()]||{}).morning||{};
  return Calc.nextRunRec({ampelC,readiness:readyScore,lastRun,planToday:planRun?planRun.l:null,
    heavyLegsYesterday:Calc.heavyLegs(y&&y.sessions&&y.sessions.Gym),
    heavyLegs2d:Calc.heavyLegs(y2&&y2.sessions&&y2.sessions.Gym),doms:m.doms,legs:m.legs});
}

/* ============ COMMAND CENTER (Today-Hero) ============ */
/* ============ ORVIA SCORE — Tagesform 0–100 + Subscores ============ */
function executionScore(){
  try{
    const today=todayStr();let chk=0,tr=0;
    for(let i=0;i<7;i++){const dt=new Date(today+'T12:00');dt.setDate(dt.getDate()-i);const k=todayStr(dt);
      const e=DB[k];if(!e)continue;
      if(e.morning)chk++;
      if(e.sessions&&Object.keys(e.sessions).filter(x=>x!=='_ts').length)tr++;}
    return Math.round(Calc.clampC((chk/7)*65+(tr>=3?35:tr*12),0,100));
  }catch(e){return null;}
}
/* @deprecated als eigene Logik — jetzt reiner Adapter auf getDecision().
   Liefert das alte Format (score/status/subs/m/r/ctx) für renderCommand & Co.,
   OHNE eigene Caps oder Status-Texte. Quelle der Wahrheit: getDecision(). */
function orviaScore(){
  var d=(typeof getDecision==='function')?getDecision():null;if(!d)return null;
  var c={GREEN:'g',YELLOW:'y',ORANGE:'o',RED:'r'}[d.dayState]||'y';
  /* v9: drittes Feld = tatsaechlich verwendetes Gewicht in Prozent. Ohne das
     stand unter „So entsteht dein Score" eine Liste, die nichts erklaerte. */
  var subs=[['Erholung',d.subscores.recovery.value,d.subscores.recovery.weight],
    [d.subscores.control.label,d.subscores.control.value,d.subscores.control.weight],
    ['Umsetzung',d.subscores.execution.value,d.subscores.execution.weight]];
  return{score:d.score,status:{l:d.statusText,c:c},subs:subs,
    r:d._r,ctx:d._ctx,m:d._m,recovery:d.subscores.recovery.value,
    dayState:d.dayState,safety:d.safety,decision:d};
}
/* ============ NUTZER-LEVEL (Anfänger / Fortgeschritten / Profi) ============ */
/* H1 (2026-07-11): Onboarding v2 setzt PROFILE.level bewusst NICHT mehr — das Level
   lebt kanonisch am Primärsport (beginner/intermediate/advanced/competitive). Vorher
   galt damit JEDER v2-Nutzer als „fortgeschritten" (Anfänger bekamen Intervalle —
   sicherheitsrelevant). Kanonisches Level zuerst, PROFILE.level nur Legacy-Fallback. */
function userLevel(){
  /* R1.5: EINE Ableitung über profileModel.primarySportLevel (Kit-Level des
     Primärsports zuerst, Legacy PROFILE.level nur Fallback). Fehlend ⇒ Standard
     'fortgeschritten' (Anzeige-Dichte) — NIE automatisch 'profi'. */
  var k=null;
  try{var pm=(typeof ORVIA!=='undefined'&&ORVIA&&ORVIA.profileModel)||(typeof window!=='undefined'&&window.ORVIA&&window.ORVIA.profileModel);
    if(pm&&typeof pm.primarySportLevel==='function')k=pm.primarySportLevel(typeof PROFILE!=='undefined'?PROFILE:null);}catch(e){}
  if(k==='beginner')return 'anfaenger';
  if(k==='competitive')return 'profi';
  if(k==='intermediate'||k==='advanced')return 'fortgeschritten';
  return 'fortgeschritten';}
function uiDetailMode(){/* Anzeigemodus: unabhaengige, persistente Darstellungsdichte (Anfaenger/Fortgeschritten/Profi). Getrennt von userLevel() (Faehigkeitsstufe, steuert Plan/Engine). Standard = einmalig aus userLevel() abgeleitet.
  GM7.5j: geraeteuebergreifend — PRIMAER aus dem cloud-synchronisierten Profil (PROFILE.uiDetailMode,
  Teil des bestehenden orvia_profile_v1-Sync-Vertrags); der lokale Schluessel orvia_ui_mode bleibt
  als schneller Fallback fuer nicht-hydrierte Boots erhalten (gleiche Werte, eine Wahrheit: Profil). */
  try{var p=(typeof PROFILE!=='undefined'&&PROFILE)?PROFILE.uiDetailMode:null;if(p==='anfaenger'||p==='fortgeschritten'||p==='profi')return p;}catch(e){}
  try{var v=localStorage.getItem('orvia_ui_mode');if(v==='anfaenger'||v==='fortgeschritten'||v==='profi')return v;}catch(e){}return (typeof userLevel==='function')?userLevel():'fortgeschritten';}
function setUiDetailMode(m){if(m!=='anfaenger'&&m!=='fortgeschritten'&&m!=='profi')return;try{localStorage.setItem('orvia_ui_mode',m);}catch(e){}
  /* GM7.5j: zusaetzlich in das cloud-synchronisierte Profil spiegeln (bestehender
     saveProfile-Vertrag, orvia_profile_v1 ist Teil des kanonischen Blob-Syncs). */
  try{if(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.uiDetailMode!==m){PROFILE.uiDetailMode=m;if(typeof saveProfile==='function')saveProfile();}}catch(e){}
  if(typeof applyLevelClass==='function')applyLevelClass();if(typeof renderLevelBox==='function')renderLevelBox();if(typeof renderCommand==='function')renderCommand();if(typeof toast==='function')toast('Ansicht: '+({anfaenger:'Anfaenger',fortgeschritten:'Fortgeschritten',profi:'Profi'}[m]||m));}
function applyLevelClass(){try{var r=document.documentElement;r.classList.remove('lvl-anfaenger','lvl-fortgeschritten','lvl-profi');r.classList.add('lvl-'+uiDetailMode());}catch(e){}}
/* GM7.6: Erscheinungsbild (Dunkel/Hell/Automatisch) — nutzt den bereits vorhandenen,
   bisher unverdrahteten CSS-Layer [data-theme="light"] (styles.css, GM-Kaskade-Bereich).
   Persistiert im bestehenden Profilvertrag (PROFILE.themePref -> saveProfile), dadurch
   automatisch cloud-synchronisiert wie jedes andere Profilfeld (orvia_profile_v1 ist
   bereits Teil der sync.js-KEYS). Einziger Aufruf-Ort fuer die Auto-Systemwechsel-
   Ueberwachung ist der IIFE-Block direkt darunter (kein mehrfaches Binden). */
function orviaThemePref(){try{var v=(typeof PROFILE!=='undefined'&&PROFILE)?PROFILE.themePref:null;return (v==='light'||v==='dark'||v==='auto')?v:'dark';}catch(e){return 'dark';}}
function orviaApplyTheme(){
  var pref=orviaThemePref(),eff=pref;
  if(pref==='auto'){try{eff=(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';}catch(e){eff='dark';}}
  try{var r=document.documentElement;if(eff==='light')r.setAttribute('data-theme','light');else r.removeAttribute('data-theme');}catch(e){}
}
function orviaSetThemePref(pref){
  if(pref!=='light'&&pref!=='dark'&&pref!=='auto')return;
  if(typeof PROFILE==='undefined'||!PROFILE)return;
  PROFILE.themePref=pref;
  try{if(typeof saveProfile==='function')saveProfile();}catch(e){}
  orviaApplyTheme();
  try{if(typeof gmRerenderAppearance==='function')gmRerenderAppearance();}catch(e){}
}
try{orviaApplyTheme();}catch(e){}
(function(){
  // GENAU EINE Registrierung fuer den Auto-Modus, auch wenn das Script doppelt liefe.
  if(window._orviaThemeMqBound)return;window._orviaThemeMqBound=true;
  try{
    if(!window.matchMedia)return;
    var mq=matchMedia('(prefers-color-scheme: light)');
    var onChange=function(){orviaApplyTheme();};
    if(mq.addEventListener)mq.addEventListener('change',onChange);
    else if(mq.addListener)mq.addListener(onChange);
  }catch(e){}
})();
function setUserLevel(l){/* R: Anzeigemodus entkoppelt von der Faehigkeitsstufe (PROFILE.level bleibt unangetastet) -> aendert nur Darstellungsdichte, nie die Trainingslogik. */setUiDetailMode(l);}
function renderLevelBox(){var el=document.getElementById('levelBox');if(!el)return;var c=uiDetailMode();
  var opts=[['anfaenger','Anfänger','Klar & reduziert'],['fortgeschritten','Fortgeschritten','Klarheit + Analyse'],['profi','Profi','Maximale Detailtiefe']];
  el.innerHTML='<div class="lvl-opts">'+opts.map(function(o){return '<button class="lvl-opt'+(c===o[0]?' on':'')+'" onclick="setUserLevel(\''+o[0]+'\')"><b>'+o[1]+'</b><span>'+o[2]+'</span></button>';}).join('')+'</div>'+
    '<p class="note" style="text-align:left;margin-top:10px">Ändert nur Informationsdichte &amp; Fachtiefe — nie die Qualität der Empfehlung.</p>';}
function simpleIntensity(a,score){
  if(a.c==='r')return {w:'Ruhetag',c:'r'};
  if(a.c==='y')return {w:'locker',c:'y'};
  if(score>=85)return {w:'normal',c:'g'};
  return {w:'locker–mittel',c:'g'};}
/* GM6: die beiden hier fruher stehenden Legacy-Zustandsrenderer (renderCommand
   mit .occ-Markup samt Helfer proTechLine sowie der kompakte Check-in mit
   .cic-Markup) waren durch die spateren GM-Definitionen bereits ueberschrieben
   und damit tot. Sie sind entfernt, damit kein latenter Legacy-Ruckfallpfad in
   der Datei verbleibt (§3). Keine Verhaltensanderung. */

/* ============ TAGESANPASSUNG (Score + Zustand → konkrete Planänderung) ============ */
function todayPrimaryUnit(){
  var wd=(new Date(todayStr()+'T12:00').getDay()+6)%7;
  var units=(activeWeekPlan()[wd]||[]);
  var run=units.filter(function(u){return u.t==='Laufen';})[0];if(run)return run;
  var leg=units.filter(function(u){return u.t==='Gym'&&/Bein|Ganzk/i.test(u.l);})[0];if(leg)return leg;
  var gym=units.filter(function(u){return u.t==='Gym';})[0];if(gym)return gym;
  var bike=units.filter(function(u){return u.t==='Rad';})[0];if(bike)return bike;
  return units[0]||null;
}
/* @deprecated — KEINE eigene Entscheidungslogik mehr. Dünner Kompatibilitäts-Wrapper:
   mappt die zentrale Entscheidung (currentDecision → Calc.buildTrainingDecision) auf das
   frühere Output-Format. Die UI nutzt currentDecision() direkt; dieser Wrapper bleibt nur,
   damit eventuelle Alt-Aufrufer keinen Referenzfehler werfen. */
function adaptToday(){
  var d=(typeof currentDecision==='function')?currentDecision():null;
  if(!d||d.todayAction==='KEEP')return null;
  var tierMap={REST:'recovery',REPLACE_WITH_RECOVERY:'recovery',SWAP_MODALITY:'replace',MOVE_SESSION:'replace',REDUCE_VOLUME:'reduce',REDUCE_INTENSITY:'reduce'};
  return {
    tier:tierMap[d.todayAction]||'reduce',
    origLabel:d.avoidedSession?d.avoidedSession.label:'',
    newTitle:d.recommendedSession.label,
    newDetail:d.recommendedSession.detail,
    why:(d.readinessReasons||[]).slice(),
    origAction:d.avoidedSession?('„'+d.avoidedSession.label+'" angepasst'):'—',
    alts:[],
    caution:(d.safety&&d.safety.triggered)?d.safety.advice:''
  };
}
/* ---- Empfehlungssicherheit (Datenqualität) ---- */
function dataConfidence(){
  var days=Object.keys(DB).filter(isDay);var n=days.length;
  var ci=days.filter(function(k){return DB[k].morning;}).length;
  var acts=days.filter(function(k){var s=DB[k].sessions;return s&&Object.keys(s).some(function(t){return t!=='_ts';});}).length;
  var hrv=days.some(function(k){return DB[k].morning&&DB[k].morning.hrvMs;});
  var sc=0;if(n>=28)sc+=2;else if(n>=10)sc+=1;if(ci>=14)sc+=2;else if(ci>=5)sc+=1;if(acts>=8)sc+=1;if(hrv)sc+=1;
  var lvl=sc>=5?{l:'hoch',c:'g'}:sc>=3?{l:'mittel',c:'y'}:{l:'niedrig',c:'r'};
  var msg=lvl.l==='hoch'?'Genug Daten für verlässliche Empfehlungen.':lvl.l==='mittel'?'Solide Basis — mehr Check-ins schärfen die Empfehlung.':'ORVIA braucht mehr Check-ins & Aktivitäten für sichere Empfehlungen.';
  return {level:lvl,n:n,ci:ci,acts:acts,msg:msg};
}
function renderConfidence(){
  var el=document.getElementById('confBox');if(!el)return;
  if(cur!==todayStr()){el.innerHTML='';el.style.display='none';return;}
  var c=dataConfidence();el.style.display='';
  var bs='';
  try{ if(window.ORVIA&&window.ORVIA.readinessStore){
    var st=window.ORVIA.readinessStore.getBaselineStatus();
    var lbl=st==='active'?['Persönliche Baseline aktiv','g']:st==='building'?['Persönliche Baseline wird aufgebaut','y']:['Persönliche Baseline: noch zu wenig Daten','r'];
    bs='<div class="cfd cfd-'+lbl[1]+'" style="margin-top:6px"><span class="cfd-dot"></span><span class="cfd-t">'+esc(lbl[0])+'</span></div>';
  } }catch(e){}
  el.innerHTML='<div class="cfd cfd-'+c.level.c+'"><span class="cfd-dot"></span><span class="cfd-t"><b>Empfehlungssicherheit: '+c.level.l+'</b> · '+esc(c.msg)+'</span></div>'+bs;
}
/* ============ FESTE TERMINE (Phase 2) — Datenmodell + UI ============
   Gespeichert in PROFILE.fixedEvents: {id,title,type,sport,date,priority,isMovable:false} */
var FIXED_EVENT_TYPES=[['club_training','Vereinstraining'],['match','Spiel'],['race','Wettkampf'],['work','Arbeit'],['school','Schule'],['travel','Reise'],['course','Kurs'],['other','Sonstiges']];
function fixedEventLabel(t){var f=FIXED_EVENT_TYPES.find(function(x){return x[0]===t;});return f?f[1]:t;}
function fixedEventsList(){return (typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.fixedEvents))?PROFILE.fixedEvents:[];}
/* Termine der AKTUELLEN Woche → {day:0–6, type, title, sport, priority} für die Engine. */
function fixedEventsThisWeek(){
  var now=new Date();var day=(now.getDay()+6)%7;var mon=new Date(now);mon.setDate(now.getDate()-day);
  var monK=todayStr(mon);var sun=new Date(mon);sun.setDate(mon.getDate()+6);var sunK=todayStr(sun);
  return fixedEventsList().filter(function(ev){return ev&&isDay(ev.date)&&ev.date>=monK&&ev.date<=sunK;})
    .map(function(ev){var di=(new Date(ev.date+'T12:00').getDay()+6)%7;return {day:di,type:ev.type,title:ev.title||fixedEventLabel(ev.type),sport:ev.sport||'',priority:ev.priority||'normal'};});
}
function addFixedEvent(ev){if(typeof PROFILE==='undefined'||!PROFILE)return;PROFILE.fixedEvents=PROFILE.fixedEvents||[];ev.id='fe'+Date.now().toString(36);ev.isMovable=false;PROFILE.fixedEvents.push(ev);if(typeof saveProfile==='function')saveProfile();}
function removeFixedEvent(id){if(typeof PROFILE==='undefined'||!PROFILE||!PROFILE.fixedEvents)return;PROFILE.fixedEvents=PROFILE.fixedEvents.filter(function(e){return e.id!==id;});if(typeof saveProfile==='function')saveProfile();renderTrainingSetup();if(typeof renderAdaptCard==='function')renderAdaptCard();}
function openFixedEventEditor(){
  var wrap=document.createElement('div');wrap.className='orvia-modal-bg';
  wrap.innerHTML='<div class="orvia-modal goal-modal"><h3>Fester Termin</h3>'+
    '<div class="gm-field"><label>Titel</label><input type="text" id="feTitle" placeholder="z. B. Spiel / Vereinstraining"></div>'+
    '<div class="gm-field"><label>Typ</label><div class="gm-chips" id="feType">'+FIXED_EVENT_TYPES.map(function(t,i){return '<button type="button" class="gm-chip'+(i===0?' on':'')+'" data-v="'+t[0]+'" onclick="gmPick(this,\'feType\')">'+esc(t[1])+'</button>';}).join('')+'</div></div>'+
    '<div class="gm-field"><label>Datum</label><input type="date" id="feDate" value="'+escH(todayStr())+'"></div>'+
    '<div class="gm-field"><label>Priorität</label><div class="gm-chips" id="fePrio"><button type="button" class="gm-chip on" data-v="normal" onclick="gmPick(this,\'fePrio\')">Normal</button><button type="button" class="gm-chip" data-v="high" onclick="gmPick(this,\'fePrio\')">Wichtig</button></div></div>'+
    '<button class="btn" onclick="saveFixedEventFromForm()">Termin speichern</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="closeFixedEventEditor()">Abbrechen</button></div>';
  document.body.appendChild(wrap);window._feModal=wrap;
  wrap.addEventListener('click',function(e){if(e.target===wrap)closeFixedEventEditor();});
}
function closeFixedEventEditor(){if(window._feModal){try{window._feModal.remove();}catch(e){}window._feModal=null;}}
function saveFixedEventFromForm(){
  var typeEl=document.querySelector('#feType .on'),prioEl=document.querySelector('#fePrio .on');
  var date=(document.getElementById('feDate')||{}).value||'';
  if(!isDay(date)){if(typeof toast==='function')toast('Bitte gültiges Datum');return;}
  var type=typeEl?typeEl.dataset.v:'other';
  addFixedEvent({title:(document.getElementById('feTitle')||{}).value||fixedEventLabel(type),type:type,date:date,priority:prioEl?prioEl.dataset.v:'normal'});
  closeFixedEventEditor();renderTrainingSetup();if(typeof renderAdaptCard==='function')renderAdaptCard();if(typeof toast==='function')toast('Termin gespeichert ✓');
}
function renderFixedEventsBox(){
  var evs=fixedEventsList().slice().sort(function(a,b){return (a.date||'').localeCompare(b.date||'');});
  var rows=evs.length?evs.map(function(ev){return '<div class="fe-row"><span class="fe-main"><b>'+esc(ev.title||fixedEventLabel(ev.type))+'</b><span class="fe-sub">'+esc(fixedEventLabel(ev.type))+' · '+esc(ev.date)+(ev.priority==='high'?' · wichtig':'')+'</span></span><button class="fe-del" onclick="removeFixedEvent(\''+ev.id+'\')" aria-label="Entfernen">✕</button></div>';}).join(''):'<div class="ob-empty">Noch keine festen Termine.</div>';
  return '<div class="ts-row" style="flex-direction:column;align-items:stretch"><div class="ts-lab" style="margin-bottom:6px">Feste Termine (fix, nicht verschiebbar)</div>'+
    '<div class="fe-list">'+rows+'</div>'+
    '<button class="btn sec" style="margin-top:8px" onclick="openFixedEventEditor()">+ Termin hinzufügen</button>'+
    '<p class="note" style="text-align:left;margin-top:6px">Feste Termine (Spiel, Vereinstraining, Wettkampf …) werden nie verschoben. ORVIA plant Zusatztraining darum herum und schützt vor harten Einheiten direkt davor.</p></div>';
}
/* ---- P4: Trainings-Setup ist READ-ONLY-Zusammenfassung — das Profil (Verfügbarkeit,
   Präferenzen, Sportarten) ist die einzige Eingabestelle. Datierte feste Termine
   behalten hier ihren einzigen Editor (keine Doppel-Eingabe, da nirgendwo sonst). ---- */
function renderTrainingSetup(){
  var el=document.getElementById('trainingSetupBox');if(!el)return;
  var p=(typeof PROFILE!=='undefined'&&PROFILE)?PROFILE:{};
  var cfg={};try{if(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)cfg=ORVIA.profileModel.effectiveTrainingConfig(p);}catch(e){}
  var days=cfg.targetDays!=null?cfg.targetDays:(p.trainingDays||((typeof planDaysTarget==='function')?planDaysTarget():4));
  var srcDE={availability:'aus deiner Verfügbarkeit',legacy:'Alt-Einstellung — Verfügbarkeit im Profil setzen',none:'Standard nach Trainingsniveau'};
  var modeDE={manual:'Nur Hinweis',assisted:'Vorschlag',automatic:'Automatisch'};
  var riskDE={conservative:'Konservativ',balanced:'Ausgewogen',ambitious:'Ambitioniert'};
  var dayNames=['Mo','Di','Mi','Do','Fr','Sa','So'];
  var availStr=(cfg.availableDayIdx&&cfg.availableDayIdx.length)?cfg.availableDayIdx.map(function(i){return dayNames[i];}).join(', '):'Noch nicht festgelegt';
  function ro(label,val){return '<div class="ts-row"><div class="ts-lab">'+label+'</div><div class="ts-opts">'+val+'</div></div>';}
  el.innerHTML=
    '<p class="note" style="text-align:left;margin:0 0 10px">Dein Profil ist die einzige Quelle der Trainingskonfiguration — hier ist die Zusammenfassung.</p>'+
    ro('Trainingstage / Woche','<b>'+days+'</b> <span class="fe-sub">('+esc(srcDE[cfg.daysSource]||srcDE.none)+')</span>')+
    ro('Verfügbare Tage',esc(availStr))+
    (cfg.gymDays!=null?ro('Gym-Einheiten',cfg.gymDays+' / Woche'):'')+
    ro('Anpassungs-Modus',esc(modeDE[cfg.adaptationMode]||'Vorschlag'))+
    ro('Risikobereitschaft',esc(riskDE[cfg.riskTolerance]||'Ausgewogen'))+
    '<div class="gmc-acts" style="margin:10px 0"><button class="gmc-b" onclick="openAvailabilityEditor()">Verfügbarkeit bearbeiten</button>'+
    '<button class="gmc-b" onclick="openPreferencesEditor()">Modus &amp; Risiko (Präferenzen)</button></div>'+
    renderFixedEventsBox();
}
/* P4: DEPRECATED — die vier Setter haben keine UI-Aufrufer mehr (Setup-Card ist
   read-only). Sie bleiben eine Übergangszeit für Alt-Pfade erhalten; Entfernung in
   einem späteren Aufräum-Paket, wenn keine Leser mehr existieren. */
function setTrainingDays(n){if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.trainingDays=n;if(typeof saveProfile==='function')saveProfile();}renderTrainingSetup();if(typeof renderWeekPlan==='function')renderWeekPlan();if(typeof toast==='function')toast('Trainingstage: '+n+' / Woche');}
function setAdaptMode(m){if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.adaptationMode=m;if(typeof saveProfile==='function')saveProfile();}renderTrainingSetup();if(typeof renderAdaptCard==='function')renderAdaptCard();if(typeof toast==='function')toast('Modus: '+({manual:'Nur Hinweis',assisted:'Vorschlag',automatic:'Automatisch'}[m]||m));}
function setRiskTol(r){if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.riskTolerance=r;if(typeof saveProfile==='function')saveProfile();}renderTrainingSetup();if(typeof toast==='function')toast('Risiko: '+({conservative:'Konservativ',balanced:'Ausgewogen',ambitious:'Ambitioniert'}[r]||r));}
function setGymDays(n){if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.gymDays=n;if(typeof saveProfile==='function')saveProfile();}renderTrainingSetup();if(typeof renderWeekPlan==='function')renderWeekPlan();if(typeof toast==='function')toast('Gym-Tage: '+n+' / Woche');}
/* Hinweis: frühere Helfer todayDayState()/weekAdaptNote() wurden entfernt —
   sie waren eigene Berechnungspfade. Einzige Quelle ist jetzt currentDecision()
   → Calc.buildTrainingDecision(). */
/* ============ PERSISTENTES REBUILD_WEEK (Phase 3) ============
   Schreibt den angepassten Wochenplan dauerhaft + Änderungsprotokoll (planAdjustment).
   Mit Undo-Snapshot. confirmed=true (Nutzer) / false (Automatikmodus). */
function applyWeekAdjustments(confirmed){
  var d=currentDecision();if(!d||!d.weekAdjustments||!d.weekAdjustments.length||!d.weekPlanAdjusted)return;
  if(typeof PROFILE==='undefined'||!PROFILE)return;
  var prev=(PROFILE.weekPlan&&PROFILE.weekPlan.length===7)?JSON.parse(JSON.stringify(PROFILE.weekPlan)):null;
  var batchId='pa'+Date.now().toString(36);
  PROFILE._planUndo={batchId:batchId,plan:prev};
  // TRENNUNG Struktur vs. Tagesinstanz (Phase 4.2-Fix):
  // Die einmalige, readiness-basierte Ersatz-Einheit (adaptiveReplacement) darf NICHT in die
  // wiederkehrende Wochenstruktur (PROFILE.weekPlan) wandern, sonst erscheint sie in jeder Woche.
  // Sie wird datumsgebunden an den heutigen Tag gehängt; die Struktur behält die Originaleinheit.
  var ti=(new Date(todayStr()+'T12:00').getDay()+6)%7;
  var adaptItem=null;
  PROFILE.weekPlan=d.weekPlanAdjusted.map(function(day,di){
    return (day||[]).map(function(it){var c=Object.assign({},it);delete c.kind;return c;})
      .filter(function(it){ if(it.adaptiveReplacement){ if(di===ti&&!adaptItem)adaptItem=Object.assign({},it); return false; } return true; });
  });
  /* KF-011: Engine-Anpassung als solche kennzeichnen (Provenienz statt Konflation). */
  try{if(typeof _planMeta==='function')_planMeta('engine_adjustment',batchId);}catch(_){ }
  if(adaptItem){
    // Originaleinheit in der Struktur wiederherstellen (heutiger Slot wurde durch Ersatz geleert).
    var orig=adaptItem.originalSession?Object.assign({},adaptItem.originalSession):null;
    if(orig){ delete orig.kind; PROFILE.weekPlan[ti]=PROFILE.weekPlan[ti]||[]; if(!PROFILE.weekPlan[ti].length)PROFILE.weekPlan[ti].push(orig); }
    // Datumsgebundene Tagesinstanz — nur am echten Datum sichtbar, nicht in Folgewochen.
    try{ var et=entry(todayStr()); et._adaptItem={dayIndex:ti,item:adaptItem}; }catch(_){}
  }
  PROFILE.planAdjustments=PROFILE.planAdjustments||[];
  var DN=['Mo','Di','Mi','Do','Fr','Sa','So'];
  d.weekAdjustments.forEach(function(c){
    PROFILE.planAdjustments.push({id:'pa'+Math.random().toString(36).slice(2,8),batchId:batchId,timestamp:Date.now(),
      reason:c.reason,actionType:c.action,affectedDate:DN[c.day]||'',oldSession:null,newSession:null,
      source:'adaptive_engine',userConfirmed:!!confirmed,riskReductionReason:c.reason});
  });
  try{entry(todayStr())._weekAdjBatch=batchId;}catch(_){}
  if(typeof saveProfile==='function')saveProfile();if(typeof save==='function')save();
  /* Phase 5E: mit kanonischem Modell ist die Engine-Anpassung eine BASELINE-Revision
     mit Rebase (E-16) — deine manuellen Overrides bleiben erhalten; die Projektion
     ueberschreibt das oben gesetzte Legacy-Feld mit dem effektiven Plan. */
  try{if(gmCanonPlanOn()&&typeof gmCanonPlanEngineRebase==='function')gmCanonPlanEngineRebase(PROFILE.weekPlan,batchId);}catch(_){ }
  if(typeof renderPlan==='function')renderPlan();if(typeof renderAdaptCard==='function')renderAdaptCard();
  if(typeof toast==='function')toast(confirmed?'Wochenplan angepasst ✓':'Wochenplan automatisch angepasst');
}
function revertWeekAdjustments(){
  if(typeof PROFILE==='undefined'||!PROFILE||!PROFILE._planUndo)return;
  var u=PROFILE._planUndo;
  PROFILE.weekPlan=u.plan||null;
  PROFILE.planAdjustments=(PROFILE.planAdjustments||[]).filter(function(a){return a.batchId!==u.batchId;});
  PROFILE._planUndo=null;
  try{var e=entry(todayStr());if(e._weekAdjBatch)delete e._weekAdjBatch;if(e._adaptItem)delete e._adaptItem;}catch(_){}
  if(typeof saveProfile==='function')saveProfile();if(typeof save==='function')save();
  if(typeof renderPlan==='function')renderPlan();if(typeof renderAdaptCard==='function')renderAdaptCard();
  if(typeof toast==='function')toast('Anpassung rückgängig gemacht');
}
function weekAdjustmentsApplied(){
  try{var b=entry(todayStr())._weekAdjBatch;return b&&PROFILE&&PROFILE._planUndo&&PROFILE._planUndo.batchId===b;}catch(_){return false;}
}
/* ============ EINE QUELLE DER WAHRHEIT FÜRS UI ============
   getDecision() baut den Input (inkl. Mess-Komponenten) und ruft die Engine GENAU
   EINMAL pro Render. Tagesformkarte, Daily Decision Card, Insights, Command und
   Wochenplan lesen dasselbe Objekt. UI rechnet KEINE eigenen Caps/Status. */
var _decisionCache=null,_decisionDay=null,_decisionBuilding=false;
function invalidateDecision(){_decisionCache=null;_decisionDay=null;}
function getDecision(){
  var _gdP=(window.ORVIA&&window.ORVIA.perf)||{now:function(){return Date.now();},mark:function(){}};
  var _gd0=_gdP.now();
  if(cur!==todayStr())return null;
  if(_decisionCache&&_decisionDay===cur)return _decisionCache;
  /* INCIDENT-FIX (2026-07-15): Reentranz-Guard. getDecision → riskCard/intelCtx →
     currentDecision → getDecision bildete einen Zyklus (intelCtx liest decisionState
     seit P3). Ohne Guard rekursiert der Aufbau bis zum Stack-Limit (gemessen: Tiefe
     ~900–2800, ~5000 gefangene RangeErrors, >8 s CPU PRO Interaktion — die gemeldeten
     5–10-s-Hänger bei JEDER Interaktion, da renderDay/renderDecision den Cache jedes
     Mal invalidieren). Verschachtelte Aufrufe WÄHREND des Aufbaus erhalten null
     (= „keine Entscheidung verfügbar", Verhalten wie vor P3) — steuert nichts. */
  if(_decisionBuilding)return null;
  if(typeof pauseFor==='function'&&pauseFor(todayStr()))return null;
  var e=DB[todayStr()];if(!e||!e.morning)return null; // erst nach Check-in
  _decisionBuilding=true;
  try{
  var m=e.morning;
  var _gdc=_gdP.now();var ctx=(typeof recoveryCtx==='function')?recoveryCtx(cur):{};_gdP.mark('getDecision: recoveryCtx (28d loop)',_gdc);
  var r=Calc.readiness(m,ctx);
  // Mess-Komponenten aus UI-Quellen (keine Caps/keine Entscheidung):
  var riskRaw=0;try{if(typeof riskCard==='function')riskRaw=riskCard().score;}catch(_){}
  var ic2={};try{if(typeof intelCtx==='function')ic2=intelCtx();}catch(_){}
  var loadFit=null;if(ic2&&ic2.targetKm&&ic2.weekKm>0){var ratio=ic2.weekKm/ic2.targetKm;loadFit=Math.round(Calc.clampC(100-Math.abs(ratio-1)*110,25,100));}
  var execution=(typeof executionScore==='function')?executionScore():null;
  var _gdg=_gdP.now();var progress=null;try{var g=buildGoal();progress=g.state==='ontrack'?88:g.state==='border'?62:g.state==='risk'?38:null;}catch(_){}_gdP.mark('getDecision: buildGoal (incl. allLoads 90-365d loop; 5s TTL-cached)',_gdg);
  // Schmerz-Region (painRegion) getrennt; DOMS-Region separat (domsRegion, falls erfasst)
  var pain=(m.knee!=null?m.knee:0),painRegion=(m.knee!=null&&m.knee>0)?'Knie':'';
  if(e.issues){Object.keys(e.issues).forEach(function(k){var vv=e.issues[k];if(typeof vv==='number'&&vv>pain){pain=vv;painRegion=(typeof ISSUE_LABELS!=='undefined'&&ISSUE_LABELS[k])||k;}});}
  var _gdl=_gdP.now();var load3=null,load7=null,_loadConf=null,_loadMiss=null,_acuteAssess=null;try{var _al=allLoads();var ld=_al.measuredLoads||_al.loads;_loadConf=_al.confidence||null;_loadMiss=_al.completeness||null;_acuteAssess=(_al.acuteAssessable===true);if(_al.valid===false){_loadConf='not_assessable';_acuteAssess=false;}if(ld&&ld.length>=7){load3=Calc.avg(ld.slice(-3));load7=Calc.avg(ld.slice(-7));}}catch(_){}_gdP.mark('getDecision: allLoads (2nd, uncached call — duplicate of buildGoal pass above)',_gdl);
  var ti=(new Date(todayStr()+'T12:00').getDay()+6)%7;
  var _gdf=_gdP.now();var conf=(typeof dataConfidence==='function')?dataConfidence():null;_gdP.mark('getDecision: dataConfidence (3x full-history Object.keys(DB) scan)',_gdf);
  var dec=Calc.buildTrainingDecision({
    checkin:{pain:pain,painRegion:painRegion,doms:m.doms,domsRegion:m.domsRegion||'',illness:!!m.ill,
      /* v8-320: der Verlauf, nicht nur der heutige Haken. */
      illSinceEnd:(ctx?ctx.illSinceEnd:null),illDuration:(ctx?ctx.illDuration:0),
      sleepH:(m.sleepMin!=null?m.sleepMin/60:null),sleepQ:m.sleepQ,feel:m.feel,stress:m.stress,hrv:m.hrv,
      rhrDev:r.rhrDev,sleepDebtH:(ctx?ctx.sleepDebtH:null),readiness:r.score,
      /* Batch 0: Red Flags kommen kanonisch aus morning.redFlags (Check-in-Chips);
         direkte m.fever-… Felder bleiben als Legacy-/Import-Fallback lesbar. */
      fever:(m.redFlags&&m.redFlags.fever)||m.fever,swelling:(m.redFlags&&m.redFlags.swelling)||m.swelling,
      instability:(m.redFlags&&m.redFlags.instability)||m.instability,chestPain:(m.redFlags&&m.redFlags.chestPain)||m.chestPain,
      shortnessOfBreath:(m.redFlags&&m.redFlags.shortnessOfBreath)||m.shortnessOfBreath,dizziness:(m.redFlags&&m.redFlags.dizziness)||m.dizziness,
      neurologicalSymptoms:(m.redFlags&&m.redFlags.neurologicalSymptoms)||m.neurologicalSymptoms,accidentPain:(m.redFlags&&m.redFlags.accidentPain)||m.accidentPain},
    components:{recovery:r.score,riskRaw:riskRaw,loadFit:loadFit,execution:execution,progress:progress},
    loads:{load3:load3,load7:load7,confidence:_loadConf,missingness:_loadMiss,acuteAssessable:_acuteAssess},
    plannedToday:(typeof todayPrimaryUnit==='function')?todayPrimaryUnit():null,
    weekPlan:(typeof activeWeekPlan==='function')?activeWeekPlan():null,
    todayIndex:ti,fixedEvents:(typeof fixedEventsThisWeek==='function')?fixedEventsThisWeek():[],
    profile:(typeof PROFILE!=='undefined'?PROFILE:{}),goal:(typeof PROFILE!=='undefined'&&PROFILE?PROFILE.primaryGoal:null),
    dataQuality:conf?{confidence:conf.level.l,note:conf.msg}:{}
  });
  // Zwischen-Check-ins (live/pre/post) verschärfen NUR die Entscheidung, nie den Readiness-Score.
  try{
    if(typeof Calc.escalateWithExtras==='function')
      dec=Calc.escalateWithExtras(dec,{live:e.live||null,pre:e.pre||null,post:e.post||null});
  }catch(_){}
  dec._m=m;dec._r=r;dec._ctx=ctx;
  _decisionCache=dec;_decisionDay=cur;
  _gdP.mark('getDecision: TOTAL (uncached rebuild)',_gd0);
  return dec;
  }finally{_decisionBuilding=false;}
}
function currentDecision(){return getDecision();}
var STATE_LABELS={GREEN:'GRÜN',YELLOW:'GELB',ORANGE:'ORANGE',RED:'ROT'};
var DECISION_WORD={GREEN:'Trainieren',YELLOW:'Reduzieren',ORANGE:'Ersetzen',RED:'Pausieren'};
/* Daily Decision Card (Phase 7) — rendert die zentrale Entscheidung. */
function renderAdaptCard(){
  var el=document.getElementById('adaptBox');if(!el)return;
  var d=(window.Calc&&Calc.buildTrainingDecision)?currentDecision():null;
  if(!d){el.innerHTML='';el.style.display='none';return;}
  el.style.display='';
  var state=d.dayState,hasChange=(d.todayAction!=='KEEP');
  var mode=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.adaptationMode)||'assisted';
  var e=DB[todayStr()];
  var ch=(e&&e.adaptChoice&&e.adaptChoice.action===d.todayAction)?e.adaptChoice.choice:null;
  if(mode==='automatic'&&hasChange&&!ch){var ea=entry(todayStr());ea.adaptChoice={action:d.todayAction,choice:'accepted'};if(typeof save==='function')save();ch='accepted';}
  var head='<div class="adp-head">'+ic('pulse')+'<span>Tagesentscheidung</span>'+
    '<span class="adp-state adp-state-'+state.toLowerCase()+'">'+STATE_LABELS[state]+' · '+DECISION_WORD[state]+'</span></div>';
  var safety=(d.safety&&d.safety.triggered)?'<div class="adp-caution">'+esc(d.safety.advice)+'</div>':'';
  var rec='<div class="adp-block"><span class="adp-lab">Heute</span><div class="adp-val"><b>'+esc(d.recommendedSession.label)+'</b>'+(d.recommendedSession.detail?'<span>'+esc(d.recommendedSession.detail)+'</span>':'')+'</div></div>';
  var avoid=d.avoidedSession?'<div class="adp-block"><span class="adp-lab">Vermeiden</span><div class="adp-val">'+esc(d.avoidedSession.label)+'</div></div>':'';
  /* H5 (2026-07-11): Der „Warum?"-Block lebt EINMAL — in der Command-Karte darüber.
     Diese Karte zeigt nur noch das Plan-Delta (Heute/Vermeiden/Verschiebungen);
     identische Trigger-Listen doppelt auf einem Screen waren Audit-Befund 3a. */
  var why='';
  var DN=['Mo','Di','Mi','Do','Fr','Sa','So'];
  var moves=(d.weekAdjustments||[]).filter(function(c){return c.action==='MOVE_SESSION'||c.action==='REBUILD_WEEK';});
  var applied=(typeof weekAdjustmentsApplied==='function')&&weekAdjustmentsApplied();
  // Automatikmodus: Wochenplan einmal automatisch anwenden (mit Undo-Snapshot)
  if(mode==='automatic'&&moves.length&&!applied){applyWeekAdjustments(false);return;}
  var week='';
  if(applied){
    week='<div class="adp-week"><b>Wochenplan angepasst</b> — Änderungen gespeichert (siehe Plan). <button class="linklike" onclick="revertWeekAdjustments()">Rückgängig</button></div>';
  }else if(moves.length){
    week='<div class="adp-week"><b>Wochenplan-Vorschlag:</b> '+moves.map(function(c){return c.action==='MOVE_SESSION'?('Harte Einheit → '+DN[c.day]+' (≥48 h Abstand, kein Konflikt mit Terminen).'):esc(c.reason);}).join(' ')+
      '<div class="adp-btns" style="margin-top:8px"><button class="btn sec" onclick="applyWeekAdjustments(true)">Wochenplan anpassen</button></div></div>';
  }
  var actions='';
  if(hasChange){
    if(ch==='accepted')actions='<div class="adp-accepted">✓ '+(mode==='automatic'?'Automatisch angepasst':'Übernommen')+'. <button class="linklike" onclick="adaptReopen()">'+(mode==='automatic'?'Rückgängig':'ändern')+'</button></div>';
    else if(ch==='original')actions='<div class="adp-folded">Nur als Hinweis angezeigt. <button class="linklike" onclick="adaptReopen()">doch anpassen</button></div>';
    else actions='<div class="adp-btns"><button class="btn" onclick="adaptChoose(\'accepted\')">Änderung übernehmen</button>'+
      '<button class="btn sec" onclick="adaptChoose(\'original\')">Nur als Hinweis</button></div>';
  }
  var feel='<button class="linklike adp-feel" onclick="adaptFeelDifferent()">Ich fühle mich anders → Check-in anpassen</button>';
  el.innerHTML='<div class="adapt-card adp-'+state.toLowerCase()+'">'+head+safety+rec+avoid+why+week+actions+feel+'</div>';
}
function adaptChoose(choice){var d=currentDecision();if(!d)return;var e=entry(todayStr());e.adaptChoice={action:d.todayAction,choice:choice};if(typeof save==='function')save();renderAdaptCard();if(typeof toast==='function')toast(choice==='original'?'Als Hinweis angezeigt':'Anpassung übernommen ✓');}
function adaptReopen(){var e=entry(todayStr());if(e.adaptChoice){delete e.adaptChoice;if(typeof save==='function')save();}renderAdaptCard();}
function adaptFeelDifferent(){var mf=document.getElementById('morningForm');if(mf)mf.scrollIntoView({behavior:'smooth',block:'start'});if(typeof toast==='function')toast('Passe deinen Check-in an — die Entscheidung aktualisiert sich.');}
/* ============ MORGEN ============ */
function checkinContextHint(){
  var hints=[];
  try{var y=todayStr(new Date(Date.now()-864e5));var ye=DB[y];if(ye&&ye.morning&&ye.morning.knee>=3)hints.push('Gestern Knie '+ye.morning.knee+'/10 — heute gezielt prüfen.');}catch(e){}
  var u=(typeof todayPrimaryUnit==='function')?todayPrimaryUnit():null;
  if(u&&typeof isHardUnit==='function'&&isHardUnit(u))hints.push('Heute harte Einheit geplant — achte auf Müdigkeit & Muskelkater.');
  if(typeof pauseFor==='function'&&pauseFor(todayStr()))hints.push('Pause aktiv — Kurz-Check reicht.');
  return hints.length?'<div class="ci-hint">'+hints.map(esc).join(' ')+'</div>':'';
}
function setCheckinMode(mode){if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.checkinMode=mode;if(typeof saveProfile==='function')saveProfile();}renderMorning();}
/* ============ Phase 6 (2026-07-17): deklaratives Check-in-Rendering ============
   renderMorning/renderEve + gatherMorning/gatherEve werden aus der Registry
   ORVIA.checkinFields (js/checkin-fields.js) gespeist — eine Quelle der
   Wahrheit für Reihenfolge, Renderer-Art, Grenzen und Garmin-Automatik.
   Frische Garmin-Werte (ORVIA.checkinFieldResolver, geladen via
   profileMetricResolver.collect) ERSETZEN die objektive Frage durch eine
   kompakte "Automatisch von Garmin"-Zeile mit Bearbeiten-Fallback;
   Sync-Ausfall/stale ⇒ Frage erscheint wie bisher (Design §9 Phase 6). */
function ciEditManually(key){_ciManualMap()[key]=1;renderMorning();}
/* Kompakte Auto-Zeile: Wert einzeilig prominent, darunter Sync-Punkt + Quelle,
   rechts ein ✎-Icon (statt Textlink — bricht in row2-Halbzellen nicht um). */
function _ciAutoRow(f,a){return '<div class="field ci-auto"><label>'+esc(f.label)+'</label>'+
  '<div class="ci-auto-val"><div class="ci-auto-main"><strong>'+esc(a.text)+'</strong>'+
  '<span class="ci-auto-src"><i class="ci-auto-dot"></i>Garmin</span></div>'+
  '<button type="button" class="ci-auto-edit" aria-label="'+esc(f.label)+' manuell bearbeiten" onclick="ciEditManually(\''+f.key+'\')">✎</button></div></div>';}
function _ciFmtQuickSel(f,val){if(val==null||!f.quick||!f.quick.sel)return [];
  for(var i=0;i<f.quick.sel.length;i++){if(val>=f.quick.sel[i][0])return [f.quick.sel[i][1]];}
  return [];}
function _ciFieldHTML(f,m,mode){
  var a=_ciAutoMap()[f.key];
  if(a&&!_ciManualMap()[f.key]&&f.kind!=='issues')return _ciAutoRow(f,a);
  var pre=(_ciManualMap()[f.key]&&a)?a.value:null; // „Bearbeiten": mit Garmin-Wert vorbelegt
  if(mode==='quick'&&f.quick)return chips(f.quick.label,f.quick.el,f.quick.opts,_ciFmtQuickSel(f,m[f.key]));
  switch(f.kind){
    case 'sleep':{var sm=(m[f.key]!=null?m[f.key]:(pre!=null?pre:f.displayDef));
      return '<div class="field"><label>'+esc(f.label)+'<span class="val" id="m_sleep_v"></span></label>'+
        '<div class="sleepbig" id="sleepBig"></div>'+
        '<input type="range" id="'+f.el+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'" value="'+sm+'" oninput="sleepUpd()">'+
        '<div class="scale"><span>3h</span><span>12h</span></div>'+
        '<div class="stepbtns"><button type="button" onclick="sleepStep(-15)">– 15 min</button><button type="button" onclick="sleepStep(15)">+ 15 min</button></div></div>';}
    case 'range':return slider(f.el,f.label,f.min,f.max,(m[f.key]!=null?m[f.key]:f.displayDef),f.lo,f.hi);
    case 'number':{var nv=(m[f.key]!=null?m[f.key]:pre);
      return '<div class="field"><label>'+esc(f.label)+'</label><input type="number" inputmode="'+(f.inputmode||'numeric')+'" id="'+f.el+'" value="'+(nv!=null?nv:'')+'" placeholder="'+esc(f.placeholder||'')+'"></div>';}
    case 'chipsText':{var sel=m[f.key]?[m[f.key]]:(pre!=null?[String(pre)]:[]);return chips(f.label,f.el,f.opts,sel);}
    case 'chipsBool':return chips(f.label,f.el,f.opts,[m[f.key]?'Ja':'Nein']);
    /* Batch 0: Mehrfach-Chips (Red Flags) — gespeicherte kanonische Codes
       (m[key]={fever:true,…}) über registry.optCodes zurück auf Labels mappen. */
    case 'chipsMulti':{var selM=[];var rfObj=m[f.key]||{};
      f.opts.forEach(function(lab){var code=(f.optCodes&&f.optCodes[lab])||lab;if(rfObj[code]===true)selM.push(lab);});
      return chips(f.label,f.el,f.opts,selM,true);}
    case 'issues':return (typeof checkinIssuesHTML==='function')?checkinIssuesHTML(m):slider('m_knee',(mode==='quick'?'Beschwerden JETZT':'Knie-Schmerz JETZT'),0,10,(m.knee!=null?m.knee:0),'kein','max');
    case 'note':return '<div class="field" style="margin-bottom:0"><label>'+esc(f.label)+'</label><input type="text" id="'+f.el+'" value="'+esc(m[f.key])+'" placeholder="'+esc(f.placeholder||'')+'"></div>';
  }
  return '';}
function _ciFormHTML(fields,m,mode){
  var list=fields.filter(function(f){var ms=f.modes||['full'];return ms.indexOf(mode)>=0&&f.kind!=='external';});
  if(mode==='quick')list=list.slice().sort(function(x,y){return (x.quickPos||99)-(y.quickPos||99);});
  var parts=[];var i=0;
  while(i<list.length){
    var f=list[i];
    if(mode==='full'&&f.row2&&i+1<list.length&&list[i+1].row2===f.row2){
      parts.push('<div class="row2">'+_ciFieldHTML(f,m,mode)+_ciFieldHTML(list[i+1],m,mode)+'</div>');i+=2;continue;}
    parts.push(_ciFieldHTML(f,m,mode));i++;}
  if(mode==='quick')parts.push('<p class="note" style="margin-top:8px">Schnell-Check — für Pace, HF, HRV &amp; Details auf „Ausführlich" wechseln.</p>');
  return parts.join('');}
/* Garmin-Werte für heute laden (einmal je Tag/Session; Ausfall ⇒ alle Fragen manuell). */
function _ciAutoLoad(){try{
  var t=todayStr();var s=window._ciAuto;
  if(s&&s.date===t&&(s.state==='ready'||s.state==='loading'))return;
  if(!(window.ORVIA&&ORVIA.profileMetricResolver&&ORVIA.checkinFieldResolver&&ORVIA.checkinFields&&ORVIA.repos&&ORVIA.repos.metrics))return;
  window._ciAuto={date:t,state:'loading',map:{}};
  ORVIA.profileMetricResolver.collect({withMeta:false,days:3,today:t}).then(function(r){
    var s2=window._ciAuto;if(!s2||s2.date!==t)return;
    if(r&&r.success){
      s2.map=ORVIA.checkinFieldResolver.resolveCheckinFields(ORVIA.checkinFields.MORNING,r.data.resolved,{today:t});
      s2.state='ready';
      /* Phase 7: vollständige Resolver-Map für weitere Konsumenten cachen
         (nutrition.js liest steps/active_kcal/resting_kcal/total_kcal daraus). */
      gmStashResolved({date:t,days:3,resolved:r.data.resolved,entries:(r.data&&r.data.entries)||[]});
      // Formular nur neu aufbauen, wenn der Nutzer nicht gerade darin tippt.
      var mf=document.getElementById('morningForm');
      if(Object.keys(s2.map).length&&mf&&mf.innerHTML&&!(document.activeElement&&mf.contains&&mf.contains(document.activeElement)))renderMorning();
    }else{s2.state='error';}
  }).catch(function(){var s2=window._ciAuto;if(s2)s2.state='error';});
}catch(e){}}
function renderMorning(){
  const m=(entry(cur).morning)||{};
  var mode=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.checkinMode)||'full';
  var toggle='<div class="ci-mode"><button type="button" class="'+(mode==='quick'?'on':'')+'" onclick="setCheckinMode(\'quick\')">Schnell</button><button type="button" class="'+(mode==='full'?'on':'')+'" onclick="setCheckinMode(\'full\')">Ausführlich</button></div>';
  var hint=checkinContextHint();
  _ciAutoLoad();
  var REG=(window.ORVIA&&ORVIA.checkinFields)?ORVIA.checkinFields.MORNING:null;
  /* GM6: fehlendes Feldregister ist ein nicht behebbarer Darstellungsfehler —
     GM-Fehlerkomponente statt Legacy-.note. Kein Retry-Button, weil es keine
     bestehende sichere Aktion gibt, die das Modul nachladen wuerde (§4). */
  var body=REG?_ciFormHTML(REG,m,mode):gmStateError({icon:'alert',title:'Check-in-Modul nicht geladen.',desc:'Lade die App neu, sobald du wieder online bist.'});
  document.getElementById('morningForm').innerHTML=toggle+hint+body;
  initRanges();if(document.getElementById('m_sleep'))sleepUpd();
}
function sleepUpd(){const el=document.getElementById('m_sleep');const t=+el.value;const h=Math.floor(t/60),mm=t%60;
  document.getElementById('sleepBig').innerHTML=h+'<small>h</small> '+String(mm).padStart(2,'0')+'<small>min</small>';
  document.getElementById('m_sleep_v').textContent=h+'h '+String(mm).padStart(2,'0');
  el.style.setProperty('--p',((t-180)/(720-180)*100)+'%');}
function sleepStep(d){const el=document.getElementById('m_sleep');if(el&&el.dataset)el.dataset.dirty='1';el.value=clamp(+el.value+d,180,720);sleepUpd();autoMorning();}
/* P6-Vorbedingung (c) (2026-07-17, Audit-Befund 6): Unberührte Slider-Defaults
   (Schlaf 420 / Qualität 6 / Befinden 7 / Beine 7 / DOMS 2) sind KEINE Messwerte.
   Ein Slider-Wert zählt nur, wenn der Nutzer ihn in dieser Sitzung angefasst hat
   (data-dirty, gesetzt vom input-Listener/sleepStep) ODER bereits ein gespeicherter
   Vorwert existiert (dann zeigt der Slider diesen ohnehin an). Sonst: null —
   Readiness/Baselines rechnen null-tolerant (m.sleepMin!=null-Guards in calc.js). */
function _sliderVal(id,prevVal){var el=document.getElementById(id);
  if(el&&el.dataset&&el.dataset.dirty==='1')return +el.value;
  return prevVal!=null?prevVal:null;}
/* Phase 6: Kontext-Helfer für das deklarative Gather/Render (bewusst zwischen
   _sliderVal und gatherMorning platziert — Verhaltenstests isolieren genau
   diesen Block über die Funktionsgrenzen _sliderVal … toggleAnkle). */
function _ciReg(){return (window.ORVIA&&window.ORVIA.checkinFields)?window.ORVIA.checkinFields:null;}
function _ciAutoMap(){var s=window._ciAuto;var t=(typeof todayStr==='function')?todayStr():null;
  return (s&&t&&s.date===t&&s.map)?s.map:{};}
function _ciManualMap(){window._ciManual=window._ciManual||{};return window._ciManual;}
function _ciQuickVal(f){if(!f.quick)return null;var c=chipGet(f.quick.el)[0];
  if(c==null||c==='')return null;return f.quick.map[c]!=null?f.quick.map[c]:null;}
/* Deklaratives Gather: Registry bestimmt je Feld den Leser. Vorrang je Feld:
   bewusste Nutzereingabe (dirty-Slider/Zahlenfeld/Chip) > frischer Garmin-Wert
   (nur wenn KEIN Eingabeelement gerendert wurde) > Vorwert > null.
   Übernommene Garmin-Werte werden in autoSources je Feld gekennzeichnet
   (⇒ daily_checkins.auto_sources, Migration 0021). */
function gatherMorning(){
  var prev=(entry(cur).morning)||{};
  var REG=_ciReg();var fields=REG?REG.MORNING:[];
  var A=_ciAutoMap();var man=_ciManualMap();
  var out={};var autoSrc={};
  fields.forEach(function(f){
    if(f.kind==='issues')return; // knee/issues unten wie bisher (Issues-Modul)
    var el=document.getElementById(f.el);
    var a=A[f.key];
    if(a&&!man[f.key]&&!el){out[f.key]=a.value;autoSrc[f.key]=a.source||'garmin';return;}
    switch(f.kind){
      case 'sleep':
      case 'range':{
        if(el){out[f.key]=_sliderVal(f.el,prev[f.key]);}
        else if(f.quick){var q=_ciQuickVal(f);out[f.key]=q!=null?q:(prev[f.key]!=null?prev[f.key]:null);}
        else{out[f.key]=prev[f.key]!=null?prev[f.key]:null;}
        break;}
      case 'number':out[f.key]=el?numIn(f.el,...LIM[f.lim]):(prev[f.key]!=null?prev[f.key]:null);break;
      case 'chipsText':out[f.key]=el?(chipGet(f.el)[0]||''):(prev[f.key]||'');break;
      case 'chipsBool':out[f.key]=el?(chipGet(f.el)[0]==='Ja'):(!!prev[f.key]);break;
      /* Batch 0: Mehrfach-Chips → Objekt kanonischer Codes ({}=bewusst „keine";
         Element nicht gerendert ⇒ Vorwert bzw. null = nicht erfasst). */
      case 'chipsMulti':{
        if(el){var rfSel={};chipGet(f.el).forEach(function(lab){var code=(f.optCodes&&f.optCodes[lab])||lab;rfSel[code]=true;});out[f.key]=rfSel;}
        else{out[f.key]=(prev[f.key]&&typeof prev[f.key]==='object')?prev[f.key]:null;}
        break;}
      case 'external':out[f.key]=el?+v(f.el):(prev[f.key]!=null?prev[f.key]:null);break;
    }
  });
  out.knee=document.getElementById('m_knee')?+v('m_knee'):(prev.knee!=null?prev.knee:null);
  if(Object.keys(autoSrc).length)out.autoSources=autoSrc;
  out.ts=Date.now();
  return out;}
function toggleAnkle(hide){if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.hideAnkle=!!hide;if(typeof saveProfile==='function')saveProfile();if(typeof renderMorning==='function')renderMorning();}}
/* P6: Formular-präsent-Guard über m_ill (in beiden Modi immer gerendert, nie auto) —
   m_sleep kann bei Garmin-Übernahme fehlen, m_qfeel existiert nur im Schnell-Modus. */
function autoMorning(){if(!document.getElementById('m_ill')&&!document.getElementById('m_qfeel'))return;if(!canEditCur(true))return;entry(cur).morning=gatherMorning();if(typeof gatherCheckinIssues==='function')gatherCheckinIssues();save();renderDecision();try{if(window.ORVIA&&window.ORVIA.checkinStore)window.ORVIA.checkinStore.persistMorning(cur);}catch(e){}}
/* ---- Zentraler Editier-Guard für den aktuell gewählten Tag ---- */
function canEditCur(silent){
  if(cur===todayStr()||window._correctionMode)return true;
  if(!silent&&typeof toast==='function')toast('Tag abgeschlossen — „Korrektur erfassen" nutzen');
  return false;
}
function startCorrection(){window._correctionMode=true;renderDay();if(typeof toast==='function')toast('Korrektur-Modus aktiv');}
function endCorrection(){window._correctionMode=false;renderDay();}
function logCorrection(section){var e=entry(cur);e._corrections=e._corrections||[];e._corrections.push({ts:Date.now(),section:section||'tag',date:cur});}
function renderDecision(){var _rdP=(window.ORVIA&&window.ORVIA.perf)||{now:function(){return Date.now();},mark:function(){}};var _rd0=_rdP.now();
  if(typeof invalidateDecision==='function')invalidateDecision();renderCommand();var t=(cur===todayStr());var ro=document.getElementById('readyOut'),ao=document.getElementById('ampelOut');if(t){if(ro)ro.innerHTML='';if(ao)ao.innerHTML='';}else{renderReadiness();renderAmpel();}
  _rdP.mark('renderDecision: v1 decision + render',_rd0);
  // E2: Engine-v2 SHADOW-Lauf (protokolliert v1-vs-v2, steuert NIE die Anzeige).
  var _rd1=_rdP.now();
  try{if(t&&window.ORVIA&&window.ORVIA.engineShadow)window.ORVIA.engineShadow.run();}catch(e){}
  _rdP.mark('renderDecision: engineShadow.run (duplicate v2 engine pass)',_rd1);
  /* Phase 8.4: Aktivierungsversuch im selben Takt. Bei ausgeschaltetem Flag kehrt
     die Funktion sofort zurueck (kein Aufwand, kein Protokolleintrag). Ein
     erledigter Tag wird vermerkt, damit nicht jeder Render neu rechnet; ein
     ungeklaerter Ausgang darf es dagegen erneut versuchen — gedeckelt, damit
     ein Dauerfehler keine Schleife wird. */
  try{
    if(t&&typeof gmEngineActivateWeek==='function'&&window._engActDay!==todayStr()&&(window._engActTries||0)<3){
      window._engActTries=(window._engActTries||0)+1;
      var _ar=gmEngineActivateWeek();
      if(_ar&&(_ar.applied||_ar.reason==='unchanged'||_ar.reason==='would_drop_overrides'))window._engActDay=todayStr();
    }
  }catch(e){}}
function saveMorning(){if(!canEditCur())return;entry(cur).morning=gatherMorning();if(typeof gatherCheckinIssues==='function')gatherCheckinIssues();if(window._correctionMode&&cur!==todayStr())logCorrection('morning');save();renderDecision();try{if(window.ORVIA&&window.ORVIA.checkinStore){window.ORVIA.checkinStore.persistMorning(cur).then(function(r){if(!r||typeof toast!=='function')return;
  if(r.success===false){
    /* INCIDENT 2026-07-16: Fehler NICHT mehr verschlucken — Code im Toast, Details in der
       Konsole (vorher war die Ursache nicht diagnostizierbar; realer Fall: fehlender
       Unique-Index für den daily_checkins-Upsert, Migration 0017). */
    try{console.error('[ORVIA checkin] persistMorning fehlgeschlagen:',JSON.stringify(r.error));}catch(_){}
    toast('Check-in lokal gespeichert (Cloud-Sync fehlgeschlagen: '+((r.error&&r.error.code)||'unbekannt')+')');
  }
  else if(r.sync_status==='pending')toast('Offline gespeichert – wird synchronisiert ⏳');});}}catch(e){}
  // Phase 3: physiologische Readiness (dec._r) + Komponenten + Baselines persistieren (best-effort).
  try{if(window.ORVIA&&window.ORVIA.readinessStore){var _d=getDecision();if(_d&&_d._r)window.ORVIA.readinessStore.persistForDay(cur,_d._r,_d._m,_d._ctx);}}catch(e){}
  if(typeof collapseCheckinCard==='function')collapseCheckinCard();if(typeof renderCheckinCompact==='function')renderCheckinCompact();toast(window._correctionMode&&cur!==todayStr()?'Korrektur gespeichert ✓':'Gespeichert ✓');window.scrollTo({top:0,behavior:'smooth'});}

/* ============ READINESS + AMPEL ============ */
function renderReadiness(){const e=entry(cur);const out=document.getElementById('readyOut');
  if(!e.morning){out.innerHTML='';return;}
  const r=Calc.readiness(e.morning,recoveryCtx(cur));const C=2*Math.PI*52;const off=C*(1-r.score/100);
  const txt=r.band==='g'?'Bereit':r.band==='y'?'Moderat':'Erholung nötig';
  out.innerHTML=`<div class="card readycard">
    <svg class="ring" viewBox="0 0 120 120">
      <circle class="ringbg" cx="60" cy="60" r="52"></circle>
      <circle class="ringfg" cx="60" cy="60" r="52" transform="rotate(-90 60 60)" style="stroke:${r.color};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"></circle>
      <text x="60" y="56" text-anchor="middle" font-size="30" font-weight="800" fill="${r.color}">${r.score}</text>
      <text x="60" y="76" text-anchor="middle" font-size="11" font-weight="700" fill="#b8b4aa">READY</text>
    </svg>
    <div class="readyinfo"><div class="rscore">${r.score}%</div><div class="rband" style="color:${r.color}">${txt}</div>
      ${r.lim.length?`<div class="rlim">Limitiert durch: <b>${r.lim.join(', ')}</b></div>`:''}</div></div>`;
}
function warningsFor(m,ctx){
  const w=[];
  if(ctx.rhrBase!=null&&m.rhr!=null&&m.rhr-ctx.rhrBase>=5)w.push(`Ruhepuls +${(m.rhr-ctx.rhrBase).toFixed(0)} über 28T-Baseline (${ctx.rhrBase.toFixed(0)}) — Infekt/Overreaching prüfen.`);
  const p=prevMorning(cur);if(p&&m.knee>p.knee+0.5)w.push(`Knie-Schmerz <b>steigt</b> (${p.knee}→${m.knee}) — Belastung runter.`);
  if(m.sleepMin<360)w.push(`Schlaf ${(m.sleepMin/60).toFixed(1)}h — Regenerations-Defizit.`);
  if(ctx.sleepDebtH!=null&&ctx.sleepDebtH>=4)w.push(`Schlaf-Konto: −${ctx.sleepDebtH.toFixed(1)}h in 7 Tagen.`);
  return w;
}
function prevMorning(date){let d=new Date(date+'T12:00');for(let i=1;i<=14;i++){d.setDate(d.getDate()-1);const k=todayStr(d);if(DB[k]&&DB[k].morning)return DB[k].morning;}return null;}
function renderAmpel(){const e=entry(cur);const out=document.getElementById('ampelOut');
  if(!e.morning){out.innerHTML='';return;}
  const ctx=recoveryCtx(cur);const r=Calc.readiness(e.morning,ctx);const a=Calc.ampel(e.morning,r,ctx);
  const w=warningsFor(e.morning,ctx);
  // P3: renderAmpel läuft nur für VERGANGENE Tage (renderDecision leert ampelOut für heute).
  // Die Legacy-Ampel ist eine historische Einordnung — klar kennzeichnen, damit sie nie
  // mit der finalen Tagesentscheidung (buildTrainingDecision) konkurriert.
  out.innerHTML=(w.length?`<div class="warn"><b>Trigger-Warnungen</b><ul>${w.map(x=>'<li>'+x+'</li>').join('')}</ul></div>`:'')+
    `<div class="amp ${a.c}"><div class="big">${a.t}</div><div class="amp-hist">Historische Einordnung dieses Tages — keine aktuelle Empfehlung.</div><ul>${a.why.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><div class="rec"><b>Einordnung dieses Tages:</b><br>${esc(a.rec)}</div></div>`;
}

/* ============ TRAINING (Post) ============ */
let _trash=null;
function renderTypeGrid(){var _tg=document.getElementById('typeGrid');if(!_tg)return;_tg.innerHTML=Object.keys(TYPES).map(t=>
  `<div class="typebtn${activeTypes.has(t)?' on':''}" onclick="toggleType('${t}')"><div class="ti">${TYPES[t].ic}</div><div class="tn">${t}</div><div class="tc">${activeTypes.has(t)?'✓ aktiv':TYPES[t].sub}</div></div>`).join('');}
function hasContent(o){return o&&Object.keys(o).some(k=>{const x=o[k];return x!=null&&x!==''&&!(Array.isArray(x)&&!x.length)&&k!=='rpe'&&k!=='perf'&&k!=='knee';});}
function toggleType(t){
  if(!canEditCur())return;
  if(activeTypes.has(t)){
    const data=(entry(cur).sessions||{})[t];
    activeTypes.delete(t);
    if(hasContent(data)){_trash={date:cur,type:t,data};
      renderTypeGrid();renderPostBlocks();savePost(true);
      toastAction(t+' entfernt','Rückgängig',undoTrash);return;}
  } else activeTypes.add(t);
  renderTypeGrid();renderPostBlocks();savePost(true);
  if(t==='Gym')gymInterferenceCheck();
}
function undoTrash(){if(!_trash)return;const e=entry(_trash.date);e.sessions=e.sessions||{};e.sessions[_trash.type]=_trash.data;
  if(_trash.date===cur){activeTypes.add(_trash.type);renderTypeGrid();renderPostBlocks();}
  save();_trash=null;}
function gymInterferenceCheck(){
  const g=(entry(cur).sessions||{}).Gym;
  if(!Calc.heavyLegs(g))return;
  const wd=(new Date(cur+'T12:00').getDay()+6)%7;
  const tm=(activeWeekPlan()[(wd+1)%7]||[]).find(p=>p.t==='Laufen'&&/Intervalle|Tempo|Long/.test(p.l));
  if(tm)toastAction('Schwere Beine <24h vor '+tm.l,'OK',()=>{});
}
function renderPostBlocks(){var _pb=document.getElementById('postBlocks');if(!_pb)return;const ses=(entry(cur).sessions)||{};let html='';
  if(activeTypes.has('Laufen'))html+=blockRun(ses.Laufen||{});
  if(activeTypes.has('Gym'))html+=blockGym(ses.Gym||{});
  if(activeTypes.has('Rad'))html+=blockRad(ses.Rad||{});
  if(activeTypes.has('Schwimmen'))html+=blockSwim(ses.Schwimmen||{});
  if(activeTypes.has('Mobilität'))html+=blockMob(ses['Mobilität']||{});
  document.getElementById('postBlocks').innerHTML=html;initRanges();updRun();updRad();updSwim();}
function blockRun(d){return `<div class="sescard"><div class="seshead">${ic('run')}Laufen</div>
  ${chips('Typ','l_sub',['Walk-Run','Easy Z2','Tempo','Intervalle','Long Run','Wettkampf'],d.sub?[d.sub]:[])}
  <div class="row2"><div class="field"><label>Distanz (km)</label><input type="number" inputmode="decimal" id="l_dist" value="${d.dist??''}" placeholder="5" oninput="updRun()"></div>
  <div class="field"><label>Dauer (mm:ss)</label><input type="text" inputmode="numeric" id="l_dur" value="${d.dur!=null?fmtDurInput(d.dur):''}" placeholder="36:07" oninput="updRun()"></div></div>
  <div class="calc" id="l_calc"></div>
  <div class="row2" style="margin-top:14px"><div class="field"><label>Ø Herzfrequenz</label><input type="number" inputmode="numeric" id="l_hr" value="${d.hr??''}" placeholder="150"></div>
  <div class="field"><label>Höhenmeter</label><input type="number" inputmode="numeric" id="l_elev" value="${d.elev??''}" placeholder="opt."></div></div>
  <div class="row2"><div class="field"><label>HF min</label><input type="number" inputmode="numeric" id="l_hrmin" value="${d.hrmin??''}" placeholder="120"></div>
  <div class="field"><label>HF max</label><input type="number" inputmode="numeric" id="l_hrmax" value="${d.hrmax??''}" placeholder="185"></div></div>
  <div class="field"><label>Schrittfrequenz (spm)</label><input type="number" inputmode="numeric" id="l_cad" value="${d.cad??''}" placeholder="z.B. 164"></div>
  ${gearChips('shoe','l_gear',d.gearId)}
  ${slider('l_rpe','RPE',1,10,d.rpe??5,'leicht','max')}
  ${slider('l_perf','Leistung',1,10,d.perf??6)}
  ${chips('Einheit war','l_felt',['zu leicht','passend','zu hart'],d.felt?[d.felt]:[])}
  ${slider('l_knee','Knie POST',0,10,d.knee??0,'kein','max')}
  <div class="field" style="margin-bottom:0"><label>Notiz</label><input type="text" id="l_note" value="${esc(d.note)}" placeholder="Strecke / Gefühl..."></div></div>`;}
var EXERCISES=[
 {n:'Spanish Squat',g:'Reha / Knie',m:'Quad exzentrisch'},
 {n:'VMO Step-down',g:'Reha / Knie',m:'Vastus medialis'},
 {n:'Terminal Knee Extension',g:'Reha / Knie',m:'VMO / Knie'},
 {n:'Step-up',g:'Reha / Knie',m:'Quad / Glute'},
 {n:'Wall Sit',g:'Reha / Knie',m:'Quad isometrisch'},
 {n:'Wadenheben',g:'Reha / Knie',m:'Waden / Achilles'},
 {n:'Glute Bridge',g:'Glutes / Posterior',m:'Gesäß'},
 {n:'Single-Leg Bridge',g:'Glutes / Posterior',m:'Gesäß einbeinig'},
 {n:'Hip Thrust',g:'Glutes / Posterior',m:'Gesäß'},
 {n:'Clamshells',g:'Glutes / Posterior',m:'Gluteus medius'},
 {n:'Monster Walks',g:'Glutes / Posterior',m:'Abduktoren'},
 {n:'Romanian Deadlift',g:'Glutes / Posterior',m:'Hamstrings / Gesäß'},
 {n:'Kreuzheben',g:'Glutes / Posterior',m:'gesamte Kette'},
 {n:'Good Morning',g:'Glutes / Posterior',m:'Hamstrings / Rücken'},
 {n:'Nordic Curl',g:'Glutes / Posterior',m:'Hamstrings exzentrisch'},
 {n:'Kabel-Kickback',g:'Glutes / Posterior',m:'Gesäß isoliert'},
 {n:'Bankdrücken',g:'Push (Oberkörper)',m:'Brust / Trizeps'},
 {n:'Schrägbankdrücken',g:'Push (Oberkörper)',m:'obere Brust'},
 {n:'Kurzhantel-Bankdrücken',g:'Push (Oberkörper)',m:'Brust'},
 {n:'Schulterdrücken',g:'Push (Oberkörper)',m:'Schultern'},
 {n:'Arnold Press',g:'Push (Oberkörper)',m:'Schultern'},
 {n:'Seitheben',g:'Push (Oberkörper)',m:'seitliche Schulter'},
 {n:'Dips',g:'Push (Oberkörper)',m:'Brust / Trizeps'},
 {n:'Liegestütze',g:'Push (Oberkörper)',m:'Brust / Core'},
 {n:'Trizeps-Pushdown',g:'Push (Oberkörper)',m:'Trizeps'},
 {n:'Klimmzug',g:'Pull (Oberkörper)',m:'Lat / Bizeps'},
 {n:'Klimmzug breit',g:'Pull (Oberkörper)',m:'Lat breit'},
 {n:'Latzug',g:'Pull (Oberkörper)',m:'Lat'},
 {n:'Rudern (Langhantel)',g:'Pull (Oberkörper)',m:'oberer Rücken'},
 {n:'Kabelrudern eng',g:'Pull (Oberkörper)',m:'mittlerer Rücken'},
 {n:'Face Pull',g:'Pull (Oberkörper)',m:'hintere Schulter'},
 {n:'Reverse Fly',g:'Pull (Oberkörper)',m:'hintere Schulter'},
 {n:'Bizeps-Curl',g:'Pull (Oberkörper)',m:'Bizeps'},
 {n:'Hammer-Curl',g:'Pull (Oberkörper)',m:'Bizeps / Unterarm'},
 {n:'Plank',g:'Core',m:'Rumpf'},
 {n:'Side Plank',g:'Core',m:'seitlicher Rumpf'},
 {n:'Pallof Press',g:'Core',m:'Anti-Rotation'},
 {n:'Bird Dog',g:'Core',m:'Rumpf / Stabilität'},
 {n:'Dead Bug',g:'Core',m:'tiefe Bauchmuskeln'},
 {n:'Bicycle Crunch',g:'Core',m:'schräge Bauchmuskeln'},
 {n:'Russian Twist',g:'Core',m:'Rotation'},
 {n:'Hängendes Beinheben',g:'Core',m:'untere Bauchmuskeln'},
 {n:'Ab Wheel',g:'Core',m:'gesamter Rumpf'},
 {n:'Mountain Climbers',g:'Core',m:'Rumpf / Kondition'}
];
function allExercises(){var c=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.customExercises)||[];return EXERCISES.concat(c.map(function(n){return {n:n,g:'Eigene',m:''};}));}
function migrateEx(names){if(!names||!names.length)return [];return names.map(function(n){return {n:n,sets:null,reps:null,kg:null};});}
function gymProgressHint(name){
  if(typeof cur==='undefined')return '';
  var days=Object.keys(DB).filter(isDay).filter(function(k){return k<cur;}).sort().reverse();
  for(var i=0;i<days.length;i++){var s=DB[days[i]].sessions;var g=s&&s.Gym;
    if(g&&g.exLog){var p=g.exLog.filter(function(x){return x.n===name&&(x.kg!=null||x.reps!=null);})[0];
      if(p)return '<div class="gymrow-prog">Zuletzt: '+(p.sets!=null?p.sets:'?')+'×'+(p.reps!=null?p.reps:'?')+(p.kg!=null?' @ '+p.kg+' kg':'')+'</div>';}}
  return '<div class="gymrow-prog gymrow-new">Erste Erfassung — ab jetzt mit Verlauf</div>';
}
function gymRowsHTML(list){
  if(!list||!list.length)return gmStateEmpty({icon:'dumbbell',title:'Noch keine Übung gewählt',desc:'Tippe „+ Übungen wählen“, um Sätze und Wiederholungen zu erfassen.'});
  return list.map(function(x){
    return '<div class="gymrow" data-n="'+esc(x.n)+'"><div class="gymrow-top"><span class="gymrow-n">'+esc(x.n)+'</span>'+
      '<button type="button" class="gymrow-x" onclick="removeGymRow(this)" aria-label="Entfernen">✕</button></div>'+
      '<div class="gymrow-in"><label>Sätze<input type="number" inputmode="numeric" class="gx-sets" value="'+(x.sets!=null?x.sets:'')+'" placeholder="3" oninput="autoPost()"></label>'+
      '<label>Wdh<input type="number" inputmode="numeric" class="gx-reps" value="'+(x.reps!=null?x.reps:'')+'" placeholder="8" oninput="autoPost()"></label>'+
      '<label>kg<input type="number" inputmode="decimal" class="gx-kg" value="'+(x.kg!=null?x.kg:'')+'" placeholder="45" oninput="autoPost()"></label></div>'+
      gymProgressHint(x.n)+'</div>';
  }).join('');
}
function readGymRows(){
  var rows=[],els=document.querySelectorAll('#g_ex_rows .gymrow');
  for(var i=0;i<els.length;i++){var el=els[i];
    var st=parseInt((el.querySelector('.gx-sets')||{}).value,10),rp=parseInt((el.querySelector('.gx-reps')||{}).value,10),kg=parseFloat((((el.querySelector('.gx-kg')||{}).value)||'').replace(',','.'));
    rows.push({n:el.getAttribute('data-n'),sets:isNaN(st)?null:st,reps:isNaN(rp)?null:rp,kg:isNaN(kg)?null:kg});}
  return rows;
}
function removeGymRow(btn){var row=btn.closest('.gymrow');if(!row)return;var n=row.getAttribute('data-n');var keep=readGymRows().filter(function(x){return x.n!==n;});var c=document.getElementById('g_ex_rows');if(c)c.innerHTML=gymRowsHTML(keep);if(typeof autoPost==='function')autoPost();}
function gymPickerBody(curNames){
  var ex=allExercises(),groups={};ex.forEach(function(x){(groups[x.g]=groups[x.g]||[]).push(x);});
  return Object.keys(groups).map(function(g){
    return '<div class="gxg"><div class="gxg-h">'+esc(g)+'</div>'+groups[g].map(function(x){
      var on=curNames.indexOf(x.n)>=0;
      return '<button type="button" class="gx'+(on?' on':'')+'" data-n="'+esc(x.n)+'" onclick="this.classList.toggle(\'on\')"><span class="gx-n">'+esc(x.n)+'</span>'+(x.m?'<span class="gx-m">'+esc(x.m)+'</span>':'')+'</button>';
    }).join('')+'</div>';
  }).join('');
}
function openGymPicker(){
  var curNames=readGymRows().map(function(x){return x.n;});
  var wrap=document.createElement('div');wrap.className='orvia-modal-bg';
  wrap.innerHTML='<div class="orvia-modal goal-modal gym-pick"><h3>Übungen wählen</h3>'+
    '<div class="gx-add"><input type="text" id="gx_new" placeholder="Eigene Übung…"><button type="button" class="btn sec" onclick="addCustomExercise()">+</button></div>'+
    '<div class="gx-scroll" id="gx_scroll">'+gymPickerBody(curNames)+'</div>'+
    '<button class="btn" onclick="applyGymPicker()">Übernehmen</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="closeGymPicker()">Abbrechen</button></div>';
  document.body.appendChild(wrap);window._gymPick=wrap;wrap.addEventListener('click',function(ev){if(ev.target===wrap)closeGymPicker();});
}
function _gymPickerSel(){var sel=[];if(window._gymPick){var ns=window._gymPick.querySelectorAll('.gx.on');for(var i=0;i<ns.length;i++)sel.push(ns[i].getAttribute('data-n'));}return sel;}
function addCustomExercise(){
  var inp=document.getElementById('gx_new');var n=inp?inp.value.trim():'';if(!n)return;
  if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.customExercises=PROFILE.customExercises||[];
    if(PROFILE.customExercises.indexOf(n)<0&&!EXERCISES.some(function(x){return x.n===n;}))PROFILE.customExercises.push(n);
    if(typeof saveProfile==='function')saveProfile();}
  var sel=_gymPickerSel();if(sel.indexOf(n)<0)sel.push(n);
  var sc=document.getElementById('gx_scroll');if(sc)sc.innerHTML=gymPickerBody(sel);
  if(inp)inp.value='';
}
function applyGymPicker(){
  var sel=_gymPickerSel();
  var existing=readGymRows(),byName={};existing.forEach(function(x){byName[x.n]=x;});
  var merged=sel.map(function(n){return byName[n]||{n:n,sets:null,reps:null,kg:null};});
  var c=document.getElementById('g_ex_rows');if(c)c.innerHTML=gymRowsHTML(merged);
  closeGymPicker();if(typeof autoPost==='function')autoPost();
}
function closeGymPicker(){if(window._gymPick){try{window._gymPick.remove();}catch(e){}window._gymPick=null;}}
/* ---- Gym-Tiefe: Muskelvolumen, Übungsersatz, Deload ---- */
var EX_MUSCLES={
 'Spanish Squat':['Quads'],'VMO Step-down':['Quads'],'Terminal Knee Extension':['Quads'],'Step-up':['Quads','Glutes'],'Wall Sit':['Quads'],'Wadenheben':['Waden'],
 'Glute Bridge':['Glutes'],'Single-Leg Bridge':['Glutes'],'Hip Thrust':['Glutes'],'Clamshells':['Glutes'],'Monster Walks':['Glutes'],'Romanian Deadlift':['Hamstrings','Glutes'],'Kreuzheben':['Hamstrings','Glutes','Rücken'],'Good Morning':['Hamstrings','Rücken'],'Nordic Curl':['Hamstrings'],'Kabel-Kickback':['Glutes'],
 'Bankdrücken':['Brust','Trizeps'],'Schrägbankdrücken':['Brust'],'Kurzhantel-Bankdrücken':['Brust'],'Schulterdrücken':['Schultern','Trizeps'],'Arnold Press':['Schultern'],'Seitheben':['Schultern'],'Dips':['Brust','Trizeps'],'Liegestütze':['Brust'],'Trizeps-Pushdown':['Trizeps'],
 'Klimmzug':['Rücken','Bizeps'],'Klimmzug breit':['Rücken'],'Latzug':['Rücken'],'Rudern (Langhantel)':['Rücken'],'Kabelrudern eng':['Rücken'],'Face Pull':['Schultern'],'Reverse Fly':['Schultern'],'Bizeps-Curl':['Bizeps'],'Hammer-Curl':['Bizeps'],
 'Plank':['Core'],'Side Plank':['Core'],'Pallof Press':['Core'],'Bird Dog':['Core'],'Dead Bug':['Core'],'Bicycle Crunch':['Core'],'Russian Twist':['Core'],'Hängendes Beinheben':['Core'],'Ab Wheel':['Core'],'Mountain Climbers':['Core']
};
var MUSCLE_ORDER=['Brust','Rücken','Schultern','Quads','Hamstrings','Glutes','Bizeps','Trizeps','Core','Waden'];
function hasGymData(){
  if(typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.sports)&&PROFILE.sports.some(function(s){return s&&(s.sportId==='gym'||s==='Gym');}))return true;   // H1: kanonische sportIds
  var f=false;try{Object.keys(DB).filter(isDay).forEach(function(k){var s=DB[k].sessions;if(s&&s.Gym&&s.Gym.exLog&&s.Gym.exLog.length)f=true;});}catch(e){}
  return f;
}
function muscleVolume(){
  var vol={};MUSCLE_ORDER.forEach(function(m){vol[m]=0;});
  var today=todayStr(),weekAgo=todayStr(new Date(Date.now()-6*864e5));
  try{Object.keys(DB).filter(isDay).forEach(function(k){if(k<weekAgo||k>today)return;var s=DB[k].sessions;if(!s||!s.Gym||!s.Gym.exLog)return;
    s.Gym.exLog.forEach(function(x){var mus=EX_MUSCLES[x.n];if(!mus)return;var sets=(x.sets!=null?x.sets:3);mus.forEach(function(mm){if(vol[mm]!=null)vol[mm]+=sets;});});
  });}catch(e){}
  return vol;
}
function volRate(s){ // Phase 4.3: einheitlich über Calc.muscleVolumeStatus (eine getestete Quelle)
  if(typeof Calc!=='undefined'&&Calc.muscleVolumeStatus){var st=Calc.muscleVolumeStatus(s);if(st.key==='no_data')return null;return {l:st.label.toLowerCase(),c:st.color};}
  if(s<=0)return null;if(s<10)return {l:'zu wenig',c:'r'};if(s<=20)return {l:'optimal',c:'g'};if(s<=24)return {l:'hoch',c:'y'};return {l:'zu hoch',c:'r'};
}
/* Phase 4.3 Körperkarte: Vorder-/Rückseite, je Muskelgruppe statusgefärbt (schematisch). */
/* Anatomische Muskel-Polygone (viewBox je Figur 0 0 100 200).
   Basis: react-body-highlighter (MIT License) — eigene Integration & Gruppen-Mapping, kein Stock-Bild. */
var BODY_ANT={
  chest:["51.8367347 41.6326531 51.0204082 55.1020408 57.9591837 57.9591837 67.755102 55.5102041 70.6122449 47.3469388 62.0408163 41.6326531","29.7959184 46.5306122 31.4285714 55.5102041 40.8163265 57.9591837 48.1632653 55.1020408 47.755102 42.0408163 37.5510204 42.0408163"],
  obliques:["68.5714286 63.2653061 67.3469388 57.1428571 58.7755102 59.5918367 60 64.0816327 60.4081633 83.2653061 65.7142857 78.7755102 66.5306122 69.7959184","33.877551 78.3673469 33.0612245 71.8367347 31.0204082 63.2653061 32.244898 57.1428571 40.8163265 59.1836735 39.1836735 63.2653061 39.1836735 83.6734694"],
  abs:["56.3265306 59.1836735 57.9591837 64.0816327 58.3673469 77.9591837 58.3673469 92.6530612 56.3265306 98.3673469 55.1020408 104.081633 51.4285714 107.755102 51.0204082 84.4897959 50.6122449 67.3469388 51.0204082 57.1428571","43.6734694 58.7755102 48.5714286 57.1428571 48.9795918 67.3469388 48.5714286 84.4897959 48.1632653 107.346939 44.4897959 103.673469 40.8163265 91.4285714 40.8163265 78.3673469 41.2244898 64.4897959"],
  biceps:["16.7346939 68.1632653 17.9591837 71.4285714 22.8571429 66.122449 28.9795918 53.877551 27.755102 49.3877551 20.4081633 55.9183673","71.4285714 49.3877551 70.2040816 54.6938776 76.3265306 66.122449 81.6326531 71.8367347 82.8571429 68.9795918 78.7755102 55.5102041"],
  triceps:["69.3877551 55.5102041 69.3877551 61.6326531 75.9183673 72.6530612 77.5510204 70.2040816 75.5102041 67.3469388","22.4489796 69.3877551 29.7959184 55.5102041 29.7959184 60.8163265 22.8571429 73.0612245"],
  'front-deltoids':["78.3673469 53.0612245 79.5918367 47.755102 79.1836735 41.2244898 75.9183673 37.9591837 71.0204082 36.3265306 72.244898 42.8571429 71.4285714 47.3469388","28.1632653 47.3469388 21.2244898 53.0612245 20 47.755102 20.4081633 40.8163265 24.4897959 37.1428571 28.5714286 37.1428571 26.9387755 43.2653061"],
  quadriceps:["34.6938776 98.7755102 37.1428571 108.163265 37.1428571 127.755102 34.2857143 137.142857 31.0204082 132.653061 29.3877551 120 28.1632653 111.428571 29.3877551 100.816327 32.244898 94.6938776","63.2653061 105.714286 64.4897959 100 66.9387755 94.6938776 70.2040816 101.22449 71.0204082 111.836735 68.1632653 133.061224 65.3061224 137.55102 62.4489796 128.571429 62.0408163 111.428571","38.7755102 129.387755 38.3673469 112.244898 41.2244898 118.367347 44.4897959 129.387755 42.8571429 135.102041 40 146.122449 36.3265306 146.530612 35.5102041 140","59.5918367 145.714286 55.5102041 128.979592 60.8163265 113.877551 61.2244898 130.204082 64.0816327 139.591837 62.8571429 146.530612","32.6530612 138.367347 26.5306122 145.714286 25.7142857 136.734694 25.7142857 127.346939 26.9387755 114.285714 29.3877551 133.469388","71.8367347 113.061224 73.877551 124.081633 73.877551 140.408163 72.6530612 145.714286 66.5306122 138.367347 70.2040816 133.469388"],
  abductors:["52.6530612 110.204082 54.2857143 124.897959 60 110.204082 62.0408163 100 64.8979592 94.2857143 60 92.6530612 56.7346939 104.489796","47.755102 110.612245 44.8979592 125.306122 42.0408163 115.918367 40.4081633 113.061224 39.5918367 107.346939 37.9591837 102.44898 34.6938776 93.877551 39.5918367 92.244898 41.6326531 99.1836735 43.6734694 105.306122"],
  calves:["71.4285714 160.408163 73.4693878 153.469388 76.7346939 161.22449 79.5918367 167.755102 78.3673469 187.755102 79.5918367 195.510204 74.6938776 195.510204","24.8979592 194.693878 27.755102 164.897959 28.1632653 160.408163 26.122449 154.285714 24.8979592 157.55102 22.4489796 161.632653 20.8163265 167.755102 22.0408163 188.163265 20.8163265 195.510204","72.6530612 195.102041 69.7959184 159.183673 65.3061224 158.367347 64.0816327 162.44898 64.0816327 165.306122 65.7142857 177.142857","35.5102041 158.367347 35.9183673 162.44898 35.9183673 166.938776 35.1020408 172.244898 35.1020408 176.734694 32.244898 182.040816 30.6122449 187.346939 26.9387755 194.693878 27.3469388 187.755102 28.1632653 180.408163 28.5714286 175.510204 28.9795918 169.795918 29.7959184 164.081633 30.2040816 158.77551"],
  head:["42.4489796 2.85714286 40 11.8367347 42.0408163 19.5918367 46.122449 23.2653061 49.7959184 25.3061224 54.6938776 22.4489796 57.5510204 19.1836735 59.1836735 10.2040816 57.1428571 2.44897959 49.7959184 0"],
  neck:["55.5102041 23.6734694 50.6122449 33.4693878 50.6122449 39.1836735 61.6326531 40 70.6122449 44.8979592 69.3877551 36.7346939 63.2653061 35.1020408 58.3673469 30.6122449","28.9795918 44.8979592 30.2040816 37.1428571 36.3265306 35.1020408 41.2244898 30.2040816 44.4897959 24.4897959 48.9795918 33.877551 48.5714286 39.1836735 37.9591837 39.5918367"],
  knees:["33.877551 140 34.6938776 143.265306 35.5102041 147.346939 36.3265306 151.020408 35.1020408 156.734694 29.7959184 156.734694 27.3469388 152.653061 27.3469388 147.346939 30.2040816 144.081633","65.7142857 140 72.244898 147.755102 72.244898 152.244898 69.7959184 157.142857 64.8979592 156.734694 62.8571429 151.020408"],
  forearm:["6.12244898 88.5714286 10.2040816 75.1020408 14.6938776 70.2040816 16.3265306 74.2857143 19.1836735 73.4693878 4.48979592 97.5510204 0 100","84.4897959 69.7959184 83.2653061 73.4693878 80 73.0612245 95.1020408 98.3673469 100 100.408163 93.4693878 89.3877551 89.7959184 76.3265306","77.5510204 72.244898 77.5510204 77.5510204 80.4081633 84.0816327 85.3061224 89.7959184 92.244898 101.22449 94.6938776 99.5918367","6.93877551 101.22449 13.4693878 90.6122449 18.7755102 84.0816327 21.6326531 77.1428571 21.2244898 71.8367347 4.89795918 98.7755102"]
};
var BODY_POST={
  head:["50.6382979 0 45.9574468 0.85106383 40.8510638 5.53191489 40.4255319 12.7659574 45.106383 20 55.7446809 20 59.1489362 13.6170213 59.5744681 4.68085106 55.7446809 1.27659574"],
  trapezius:["44.6808511 21.7021277 47.6595745 21.7021277 47.2340426 38.2978723 47.6595745 64.6808511 38.2978723 53.1914894 35.3191489 40.8510638 31.0638298 36.5957447 39.1489362 33.1914894 43.8297872 27.2340426","52.3404255 21.7021277 55.7446809 21.7021277 56.5957447 27.2340426 60.8510638 32.7659574 68.9361702 36.5957447 64.6808511 40.4255319 61.7021277 53.1914894 52.3404255 64.6808511 53.1914894 38.2978723"],
  'back-deltoids':["29.3617021 37.0212766 22.9787234 39.1489362 17.4468085 44.2553191 18.2978723 53.6170213 24.2553191 49.3617021 27.2340426 46.3829787","71.0638298 37.0212766 78.2978723 39.5744681 82.5531915 44.6808511 81.7021277 53.6170213 74.893617 48.9361702 72.3404255 45.106383"],
  'upper-back':["31.0638298 38.7234043 28.0851064 48.9361702 28.5106383 55.3191489 34.0425532 75.3191489 47.2340426 71.0638298 47.2340426 66.3829787 36.5957447 54.0425532 33.6170213 41.2765957","68.9361702 38.7234043 71.9148936 49.3617021 71.4893617 56.1702128 65.9574468 75.3191489 52.7659574 71.0638298 52.7659574 66.3829787 63.4042553 54.4680851 66.3829787 41.7021277"],
  triceps:["26.8085106 49.787234 17.8723404 55.7446809 14.4680851 72.3404255 16.5957447 81.7021277 21.7021277 63.8297872 26.8085106 55.7446809","73.6170213 50.212766 82.1276596 55.7446809 85.9574468 73.1914894 83.4042553 82.1276596 77.8723404 62.9787234 73.1914894 55.7446809","26.8085106 58.2978723 26.8085106 68.5106383 22.9787234 75.3191489 19.1489362 77.4468085 22.5531915 65.5319149","72.7659574 58.2978723 77.0212766 64.6808511 80.4255319 77.4468085 76.5957447 75.3191489 72.7659574 68.9361702"],
  'lower-back':["47.6595745 72.7659574 34.4680851 77.0212766 35.3191489 83.4042553 49.3617021 102.12766 46.8085106 82.9787234","52.3404255 72.7659574 65.5319149 77.0212766 64.6808511 83.4042553 50.6382979 102.12766 53.1914894 83.8297872"],
  gluteal:["44.6808511 99.5744681 30.212766 108.510638 29.787234 118.723404 31.4893617 125.957447 47.2340426 121.276596 49.3617021 114.893617","55.3191489 99.1489362 51.0638298 114.468085 52.3404255 120.851064 68.0851064 125.957447 69.787234 119.148936 69.3617021 108.510638"],
  hamstring:["28.9361702 122.12766 31.0638298 129.361702 36.5957447 125.957447 35.3191489 135.319149 34.4680851 150.212766 29.3617021 158.297872 28.9361702 146.808511 27.6595745 141.276596 27.2340426 131.489362","71.4893617 121.702128 69.3617021 128.93617 63.8297872 125.957447 65.5319149 136.595745 66.3829787 150.212766 71.0638298 158.297872 71.4893617 147.659574 72.7659574 142.12766 73.6170213 131.914894","38.7234043 125.531915 44.2553191 145.957447 40.4255319 166.808511 36.1702128 152.765957 37.0212766 135.319149","61.7021277 125.531915 63.4042553 136.170213 64.2553191 153.191489 60 166.808511 56.1702128 146.382979"],
  calves:["29.3617021 160.425532 28.5106383 167.234043 24.6808511 179.574468 23.8297872 192.765957 25.5319149 197.021277 28.5106383 193.191489 29.787234 180 31.9148936 171.06383 31.9148936 166.808511","37.4468085 165.106383 35.3191489 167.659574 33.1914894 171.914894 31.0638298 180.425532 30.212766 191.914894 34.0425532 200 38.7234043 190.638298 39.1489362 168.93617","62.9787234 165.106383 61.2765957 168.510638 61.7021277 190.638298 66.3829787 199.574468 70.6382979 191.914894 68.9361702 179.574468 66.8085106 170.212766","70.6382979 160.425532 72.3404255 168.510638 75.7446809 179.148936 76.5957447 192.765957 74.4680851 196.595745 72.3404255 193.617021 70.6382979 179.574468 68.0851064 168.085106"],
  abductor:["48.0851064 122.978723 44.6808511 122.978723 41.2765957 125.531915 45.106383 144.255319 48.5106383 135.744681 48.9361702 129.361702","51.9148936 122.553191 55.7446809 123.404255 59.1489362 125.957447 54.893617 144.255319 51.9148936 136.170213 51.0638298 129.361702"],
  knees:["34.4680851 153.191489 31.0638298 159.148936 33.6170213 166.382979 37.4468085 162.553191","66.3829787 153.617021 62.9787234 162.978723 66.8085106 166.382979 69.3617021 159.148936"],
  forearm:["86.3829787 75.7446809 91.0638298 83.4042553 93.1914894 94.0425532 100 106.382979 96.1702128 104.255319 88.0851064 89.3617021 84.2553191 83.8297872","13.6170213 75.7446809 8.93617021 83.8297872 6.80851064 93.6170213 0 106.382979 3.82978723 104.255319 12.3404255 88.5106383 15.7446809 82.9787234","81.2765957 79.5744681 77.4468085 77.8723404 79.1489362 84.6808511 91.0638298 103.829787 93.1914894 108.93617 94.4680851 104.680851","18.7234043 79.5744681 22.1276596 77.8723404 20.8510638 84.2553191 9.36170213 102.978723 6.80851064 108.510638 5.10638298 104.680851"]
};
// Muskel-Slug → ORVIA-Datengruppe (deutsch). Nicht gelistete Slugs = neutrale Silhouette.
// Rücken liefert serverseitig nur EINE Sammelgruppe ('back' → 'Rücken'); die drei Rücken-Polygone
// teilen sich daher Status & Daten, werden aber einzeln beschriftet & gefärbt (siehe SLUG_LABEL/GROUP_TINT).
var SLUG_DE={chest:'Brust','front-deltoids':'Schultern','back-deltoids':'Schultern',biceps:'Bizeps',triceps:'Trizeps',
  abs:'Core',obliques:'Core',trapezius:'Rücken','upper-back':'Rücken','lower-back':'Rücken',
  quadriceps:'Quads',hamstring:'Hamstrings',gluteal:'Glutes',calves:'Waden'};
// Anzeige-Label je Slug (Rücken in drei Teile). Fehlt → Datengruppenname.
var SLUG_LABEL={'upper-back':'Latissimus',trapezius:'Mittlerer Rücken','lower-back':'Unterer Rücken'};
// Gedämpfte, distinkte Grundfarbe je Region — Muskeln sind ohne Daten unterscheidbar (keine Status-Farbe).
var GROUP_TINT={Brust:'#7e5450',Schultern:'#7e6440',Bizeps:'#6f5b3a',Trizeps:'#6a5638',Core:'#5f6a42',
  Quads:'#3f5d72',Hamstrings:'#544b6e',Glutes:'#3f5170',Waden:'#3a5f59',
  Latissimus:'#74443c','Mittlerer Rücken':'#6c5331','Unterer Rücken':'#6b4053'};
// Eindeutige Farben je Statusfarbe (NICHT Rot für „unter" UND „über").
function bmFill(c){return {good:'var(--success,#34d399)',high:'#fb923c',low:'#eab308',warn:'var(--danger,#fb7185)',info:'rgba(59,130,246,.6)'}[c]||'rgba(148,163,184,.22)';}
// Kanonische RPC-Gruppe (englisch) → deutsche Körperkarten-Gruppe.
var COARSE_DE={chest:'Brust',shoulders:'Schultern',back:'Rücken',biceps:'Bizeps',triceps:'Trizeps',
  core:'Core',quads:'Quads',hamstrings:'Hamstrings',glutes:'Glutes',calves:'Waden'};
function setMvRange(d){window._mvDays=d;renderMuscleVolume();}
function _mvHasLegacy(){var vol=muscleVolume();return MUSCLE_ORDER.some(function(m){return vol[m]>0;});}
function _mvLegacyPer(){var vol=muscleVolume();var per={};MUSCLE_ORDER.forEach(function(m){if(vol[m]>0)per[m]={effective:vol[m],direct:null,indirect:null,workouts:null,lastAt:null,legacy:true};});return per;}
function _mvPerFrom(rows){ // RPC-Zeilen (je Gruppe einmalig) → per + extras (unbekannte Gruppen)
  var per={},extras={};
  (rows||[]).forEach(function(row){
    var de=COARSE_DE[row.muscle_group];var key=de||row.muscle_group;var b=de?per:extras;
    b[key]={effective:+row.effective_sets||0,direct:+row.direct_sets||0,indirect:+row.indirect_sets||0,
      workouts:+row.workout_count||0,lastAt:row.last_trained_at||null};
  });
  return {per:per,extras:extras};
}
function _mvWeeklyMap(per,days){var m={};Object.keys(per||{}).forEach(function(k){m[k]=Calc.muscleWeeklyEquivalent(per[k].effective,days);});return m;}
/* Zentrale asynchrone Datenquelle. Fälle A (Live), B (RPC ok, keine Live-Daten → Legacy),
   C (RPC fehlt → Legacy + Hinweis), D (Auth/Server-Fehler → Fehlerzustand). */
async function loadMuscleVolume(days){
  days=days||7;
  var O=window.ORVIA;
  var ready=O&&O.repos&&O.repos.workout&&O.repos.workout.getMuscleVolume&&O.user;
  var online=(typeof navigator==='undefined'||navigator.onLine!==false);
  if(!ready||!online){
    if(_mvHasLegacy())return {source:'legacy',fallbackReason:'offline',days:7,per:_mvLegacyPer(),extras:{},baseline:{}};
    return {source:'empty',fallbackReason:'offline',days:days,per:{},extras:{},baseline:{}};
  }
  var to=todayStr(),from=todayStr(new Date(Date.now()-(days-1)*864e5));
  var r=await O.repos.workout.getMuscleVolume(from,to);
  if(!r.success){
    var s=(((r.error&&r.error.code)||'')+' '+((r.error&&r.error.message)||'')).toLowerCase();
    var rpcMissing=/does not exist|not found|pgrst202|schema cache|function/.test(s);
    var permission=/permission|rls|42501|jwt|denied/.test(s);
    if(rpcMissing&&_mvHasLegacy())return {source:'legacy',fallbackReason:'rpc_missing',days:7,per:_mvLegacyPer(),extras:{},baseline:{},error:r.error};
    return {source:'error',fallbackReason:permission?'permission':(rpcMissing?'rpc_missing':'server'),error:r.error,days:days,legacyAvailable:_mvHasLegacy()};
  }
  var built=_mvPerFrom(r.data);
  var hasLive=Object.keys(built.per).length||Object.keys(built.extras).length;
  if(!hasLive){
    if(_mvHasLegacy())return {source:'legacy',fallbackReason:'no_live_data',days:7,per:_mvLegacyPer(),extras:{},baseline:{}};
    return {source:'empty',fallbackReason:'no_live_data',days:days,per:{},extras:{},baseline:{}};
  }
  // Baseline: gleich lange Vorperiode (für large_increase). Zweiter RPC-Aufruf.
  var baseline={};
  try{
    var pf=todayStr(new Date(Date.now()-(2*days-1)*864e5)),pt=todayStr(new Date(Date.now()-days*864e5));
    var br=await O.repos.workout.getMuscleVolume(pf,pt);
    if(br.success)baseline=_mvWeeklyMap(_mvPerFrom(br.data).per,days);
  }catch(e){}
  return {source:'supabase',days:days,per:built.per,extras:built.extras,baseline:baseline};
}
function _mvPriority(group){try{var p=PROFILE&&PROFILE.musclePriority&&PROFILE.musclePriority[group];return p||'normal';}catch(e){return 'normal';}}
// Allgemeines Beschwerde-Signal aus dem heutigen Check-in (NICHT muskelspezifisch).
function _mvHasComplaintToday(){try{var e=DB[todayStr()];if(!e)return false;var m=e.morning||{};if(m.knee>=3||m.ill)return true;var iss=e.issues||{};return Object.keys(iss).some(function(k){return typeof iss[k]==='number'&&iss[k]>=3;});}catch(e){return false;}}
function _mvCtx(d,group){
  var bl=(d.baseline&&d.baseline[group]!=null)?d.baseline[group]:null;
  var priority=_mvPriority(group);
  var t=Calc.muscleTargetRange({priority:priority});
  // historyConfidence (KEINE echte Wochenzählung): vergleichbarer Vorzeitraum mit Daten vorhanden?
  var hc=(bl!=null&&bl>0)?'comparable_period':'insufficient';
  return {days:d.days,priority:priority,baselineWeekly:bl,historyConfidence:hc,targetLow:t.low,targetHigh:t.high,hasComplaint:_mvHasComplaintToday()};
}
function _mvStatusFor(d,group){
  var e=d.per[group];if(!e)return {weekly:0,status:{color:'muted',label:'Keine Daten',key:'no_data'},ctx:null};
  var ctx=_mvCtx(d,group);var weekly=Calc.muscleWeeklyEquivalent(e.effective,d.days);
  return {weekly:weekly,status:Calc.muscleVolumeStatus(weekly,ctx),ctx:ctx};
}
function renderBodyMap(statusByGroup,neutral){
  function fig(data,tx){
    var out='';
    Object.keys(data).forEach(function(slug){
      var de=SLUG_DE[slug],polys=data[slug];
      if(de){
        var label=SLUG_LABEL[slug]||de;
        var st=statusByGroup[de]||{color:'muted',label:'Keine Daten'};
        // Ohne Daten: distinkte Grundfarbe (Muskel erkennbar). Mit Daten: Status-Farbe.
        var fill=st.color==='muted'?(GROUP_TINT[label]||GROUP_TINT[de]||'#2c3744'):bmFill(st.color);
        out+='<g class="bm-region" tabindex="0" role="button" aria-label="'+escH(label+': '+st.label)+'" data-g="'+escH(de)+'" onclick="showMuscleDetail(\''+escH(de)+'\')" onkeydown="muscleKeyActivate(event,\''+escH(de)+'\')"><title>'+escH(label+': '+st.label)+'</title>'+
          polys.map(function(p){return '<polygon points="'+p+'" fill="'+fill+'" stroke="rgba(0,0,0,.5)" stroke-width="0.5"/>';}).join('')+'</g>';
      }else{
        out+=polys.map(function(p){return '<polygon points="'+p+'" fill="var(--bm-base,#2c3744)" stroke="rgba(0,0,0,.4)" stroke-width="0.4"/>';}).join('');
      }
    });
    return '<g transform="translate('+tx+',4)">'+out+'</g>';
  }
  var legend=neutral
    ?'<div class="bm-leg"><span>Noch nicht ausreichend bewertet — Muskelbereiche neutral dargestellt.</span></div>'
    :'<div class="bm-leg"><span><i style="background:'+bmFill('low')+'"></i>unter Ziel</span><span><i style="background:'+bmFill('good')+'"></i>im Ziel</span><span><i style="background:'+bmFill('high')+'"></i>über Ziel</span><span><i style="background:'+bmFill('warn')+'"></i>Warnung</span><span><i style="background:'+bmFill('info')+'"></i>wenig Historie</span><span><i style="background:#5f6a42"></i>gedämpft = noch keine Daten</span></div>';
  return '<div class="bodymap"><svg viewBox="0 0 232 216" width="100%" role="img" aria-label="Körperkarte Muskelvolumen">'+
    fig(BODY_ANT,8)+fig(BODY_POST,128)+
    '<text x="58" y="214" text-anchor="middle" font-size="8" fill="var(--mut,#94a3b8)">Vorderseite</text>'+
    '<text x="178" y="214" text-anchor="middle" font-size="8" fill="var(--mut,#94a3b8)">Rückseite</text>'+
    '</svg>'+legend+'</div>';
}
function muscleKeyActivate(ev,group){if(ev&&(ev.key==='Enter'||ev.key===' '||ev.key==='Spacebar')){ev.preventDefault();showMuscleDetail(group);}}
/* ---- Gym-Muskelvolumen: PRODUKTIVE Quelle ist jetzt ORVIA.gymVolume (Inkrement 2C). ---- */
// Deutsche Zahl: ganze Werte ohne Nachkommastelle, sonst max. 1 Dezimal mit Komma.
function fmtDe(n){ if(n==null||isNaN(n))return '–'; var r=Math.round(n*10)/10; return (r===Math.round(r))?String(Math.round(r)):String(r).replace('.',','); }
var CONF_LABEL_DE={low:'niedrig',medium:'mittel',high:'hoch'};
var CONF_REASON_DE={
  legacy_synthetic_data:'Ältere Trainingsdaten enthalten nur zusammengefasste Satzinformationen.',
  too_few_workouts:'Noch zu wenige verwertbare Workouts.',
  too_short_period:'Beobachtungszeitraum noch zu kurz.',
  unclassified_exercises:'Einige Übungen konnten noch nicht eindeutig zugeordnet werden.',
  partial_data:'Trainingsdaten sind nur teilweise verfügbar.'
};
/* ====== ORVIA Muskelkarte-Pilot — konsumiert AUSSCHLIESSLICH die gym-volume Engine.
   Keine zweite Volumenberechnung im UI. Fachzahlen kommen unverändert aus getProductiveVolumeModel()
   / explainMuscleVolume(). uiDetailMode() steuert NUR Darstellungstiefe. experience (Zielkorridor)
   stammt aus der Fähigkeitsstufe (primarySportLevel), NICHT aus uiDetailMode. ====== */
// Fähigkeitsstufe → Engine-experience. primarySportLevel: beginner|intermediate|advanced|competitive.
function mvExperience(profile){
  try{
    var pm=(typeof window!=='undefined'&&window.ORVIA&&ORVIA.profileModel)||(typeof ORVIA!=='undefined'&&ORVIA&&ORVIA.profileModel);
    var src=(profile!==undefined)?profile:((typeof PROFILE!=='undefined')?PROFILE:null);
    var k=(pm&&typeof pm.primarySportLevel==='function')?pm.primarySportLevel(src):null;
    if(k==='advanced'||k==='competitive')return 'advanced';
    if(k==='intermediate')return 'intermediate';
    if(k==='beginner')return 'beginner';
  }catch(e){}
  return 'beginner';
}
// 5-stufiges UI-Statusmodell — strikt aus Engine-Keys (below|in|above|insufficient_data) + Datenpräsenz.
// KEIN erfundener „Warnung"-Status (die Engine liefert per Muskel keinen). Farbe NIE alleinige Info → Symbol+Text.
var MV_STATUS_META={
  in:{label:'Im Ziel',sym:'✓',color:'#34d399'},
  below:{label:'Unter Ziel',sym:'▽',color:'#eab308'},
  above:{label:'Über Ziel',sym:'▲',color:'#3b82f6'},
  low_history:{label:'Wenig Historie',sym:'~',color:'#a78bfa'},
  no_data:{label:'Keine Daten',sym:'–',color:'#64748b'}
};
function mvStatusModel(m){
  var key=m&&m.status&&m.status.key;
  if(key==='in'||key==='below'||key==='above')return {key:key,label:MV_STATUS_META[key].label,sym:MV_STATUS_META[key].sym,color:MV_STATUS_META[key].color};
  // insufficient_data / unbekannt: mit realen Sätzen = „wenig Historie", sonst „keine Daten" (NIE 0/„unter Ziel").
  var has=!!(m&&((m.realWorkingSets||0)>0||(m.effectiveSetEquivalents||0)>0));
  var t=has?'low_history':'no_data';
  return {key:t,label:MV_STATUS_META[t].label,sym:MV_STATUS_META[t].sym,color:MV_STATUS_META[t].color};
}
// Front/Back-Zuordnung der 15 kanonischen Engine-IDs (Union = alle 15, disjunkt).
var MV_FRONT_IDS=['chest','front_delts','side_delts','biceps','forearms','abs','quads'];
var MV_BACK_IDS=['rear_delts','upper_back','lats','triceps','lower_back','glutes','hamstrings','calves'];
// Regionsgeometrie je muscleId (viewBox 200x360). Werte = [x,y,w,h,rx]; mehrere Rects = L/R.
var MV_MAP_POS={
  chest:[[74,64,24,22,8],[102,64,24,22,8]], front_delts:[[57,58,17,15,7],[126,58,17,15,7]],
  side_delts:[[50,72,14,17,7],[136,72,14,17,7]], biceps:[[47,90,15,30,7],[138,90,15,30,7]],
  forearms:[[44,124,13,34,6],[143,124,13,34,6]], abs:[[86,90,28,18,6],[86,110,28,18,6],[86,130,28,16,6]],
  quads:[[75,176,23,72,11],[102,176,23,72,11]],
  rear_delts:[[57,58,17,15,7],[126,58,17,15,7]], upper_back:[[80,54,40,24,10]],
  lats:[[74,80,22,40,9],[104,80,22,40,9]], triceps:[[47,90,15,32,7],[138,90,15,32,7]],
  lower_back:[[82,120,36,26,8]], glutes:[[76,170,24,26,11],[100,170,24,26,11]],
  hamstrings:[[75,198,23,54,11],[102,198,23,54,11]], calves:[[76,256,22,48,11],[102,256,22,48,11]]
};
if(typeof window!=='undefined'){window._mvSide=window._mvSide||'front';}
function setMvSide(s){if(typeof window!=='undefined')window._mvSide=s;if(typeof renderMuscleVolume==='function')renderMuscleVolume();}
function mvLabelDe(id){try{var L=(window.ORVIA&&ORVIA.gymVolume&&ORVIA.gymVolume.MUSCLE_LABEL);if(L&&L[id])return L[id];}catch(e){}return id;}
/* v8-352 — ZWEI ZAHLEN ZUM SELBEN GEGENSTAND, und keine rechnet die andere aus.

   ORVIA fuehrt zum Satzumfang je Muskelgruppe zwei Werte mit verschiedenen
   Bezugsgroessen und sehr verschiedener Belegbarkeit:

     Richtwert (gym-volume.CORRIDORS)   6–12 je Muskelgruppe und WOCHE
                                        Produktwert, keine Quelle
     Quelle (GYM-HYP-002, 2007)         5–6 je Muskelgruppe und EINHEIT
                                        Klasse B, wissenschaftlich ungeprueft

   Verbunden waeren sie ueber die Wochenfrequenz — und genau die nennt die
   Quelle ausdruecklich NICHT: „Keine Angabe zur Wochenfrequenz, ohne die
   eine Satzzahl je Einheit wenig aussagt." Zwei Einheiten je Woche ergaeben
   10–12 und passten; drei ergaeben 15–18 und laegen darueber. Welche
   Rechnung stimmt, weiss niemand.

   Also wird NICHT gerechnet. Beide Zahlen stehen nebeneinander, jede mit
   ihrer Bezugsgroesse und ihrer Herkunft, und der Unterschied wird benannt.
   Das ist unbequemer als eine Zahl — und das einzige, was ehrlich ist.

   Ohne eingespeistes Wissen steht hier nichts: kein Vergleich, kein Verweis
   auf eine Quelle, die gar nicht geladen ist. */
function gmKorridorAbgrenzungHTML(){
  try{
    var O=window.ORVIA||{};
    var KC=O.knowledgeConsumer;
    if(!KC||typeof KC.wissenFuer!=='function')return '';
    var w=KC.wissenFuer('gym');
    if(!w||w.ok!==true||!Array.isArray(w.vorgaben))return '';
    var v=null;
    for(var i=0;i<w.vorgaben.length;i++){
      var c=w.vorgaben[i];
      if(c&&c.ziel==='plan.saetze_je_muskelgruppe'&&c.art==='zahl'&&c.wert){v=c;break;}
    }
    if(!v)return '';
    var klasse=(v.herkunft&&v.herkunft.evidenceClass)?('Klasse '+v.herkunft.evidenceClass):null;
    return '<div class="md-corr-cmp">'+
      '<b>Dazu aus einer Quelle:</b> '+escH(v.wert.min+'–'+v.wert.max)+' '+
      escH(v.einheit||'Sätze je Muskelgruppe und Trainingseinheit')+
      (klasse?' <span class="muted">['+escH(klasse+' · '+(v.regelId||''))+']</span>':'')+
      '<br><span class="muted">Andere Bezugsgröße als der Richtwert oben — '+
      'je <b>Einheit</b> statt je Woche. Umgerechnet wird nicht: die Quelle '+
      'nennt keine Wochenfrequenz.</span></div>';
  }catch(_){return '';}
}

// Reine, modusunabhängige Detail-Kennzahlen — exakt aus Engine, keine UI-Rechnung.
function mvDetailNumbers(m,ex){
  m=m||{};
  return {
    muscleId:m.muscleId, realWorkingSets:m.realWorkingSets, directSets:m.directSets,
    indirectSetEquivalents:m.indirectSetEquivalents, effectiveSetEquivalents:m.effectiveSetEquivalents,
    weeklyEquivalent:m.weeklyEquivalent,
    targetMin:(m.targetRange&&m.targetRange.min), targetMax:(m.targetRange&&m.targetRange.max),
    targetDisplay:(m.targetRange&&m.targetRange.displayStatus)||null, targetSource:(m.targetRange&&m.targetRange.source)||null,
    /* v8-352: Basis und Klartext-Label wandern mit — sonst muesste die
       Darstellung raten, was fuer eine Zahl sie da anzeigt. */
    targetBasis:(m.targetRange&&m.targetRange.basis)||null, targetLabel:(m.targetRange&&m.targetRange.label)||null,
    confidence:m.confidence, confidenceReason:m.confidenceReason||null,
    exclusionCount:(ex&&ex.exclusions&&ex.exclusions.length)||0,
    statusKey:mvStatusModel(m).key
  };
}
// Konservative nächste Handlung = Darstellung des Engine-Status (KEINE Volumenberechnung, nicht-medizinisch).
function mvNextStep(statusKey){
  return {
    below:'1–2 gezielte Sätze pro Woche mehr — saubere Ausführung vor Last.',
    in:'Kurs halten — Volumen liegt im wirksamen Bereich.',
    above:'Volumen halten oder leicht reduzieren; auf Erholung achten.',
    low_history:'Weiter erfassen — nach ~2 Wochen wird der Zielkorridor belastbar.',
    no_data:'Für diese Gruppe liegen im Zeitraum noch keine gewerteten Sätze vor.'
  }[statusKey]||'Weiter beobachten.';
}
// Status-Chip (Farbe + Symbol + Text; Farbe nie allein).
function mvChip(st){return '<span class="mvx-chip" style="--mvc:'+st.color+'"><span class="mvx-dot"></span>'+st.sym+' '+escH(st.label)+'</span>';}
// Body-Map (Vorder-/Rückseite umschaltbar), Regionen per muscleId korrekt verlinkt.
function renderMuscleMap(model){
  var side=(typeof window!=='undefined'&&window._mvSide)||'front';
  var ids=side==='front'?MV_FRONT_IDS:MV_BACK_IDS;
  var byId={}; (model&&model.muscles||[]).forEach(function(m){byId[m.muscleId]=m;});
  var sil='<g class="mvx-sil"><circle cx="100" cy="28" r="16"/><rect x="66" y="48" width="68" height="118" rx="22"/>'+
    '<rect x="40" y="70" width="20" height="92" rx="10"/><rect x="140" y="70" width="20" height="92" rx="10"/>'+
    '<rect x="72" y="168" width="26" height="170" rx="13"/><rect x="102" y="168" width="26" height="170" rx="13"/></g>';
  var regions=ids.map(function(id){
    var m=byId[id]; var st=m?mvStatusModel(m):{key:'no_data',label:MV_STATUS_META.no_data.label,sym:MV_STATUS_META.no_data.sym,color:MV_STATUS_META.no_data.color};
    var label=mvLabelDe(id); var pos=MV_MAP_POS[id]||[];
    var op=st.key==='no_data'?0.26:0.82, sop=st.key==='no_data'?0.5:0.9;
    var rects=pos.map(function(r){return '<rect x="'+r[0]+'" y="'+r[1]+'" width="'+r[2]+'" height="'+r[3]+'" rx="'+r[4]+'" fill="'+st.color+'" fill-opacity="'+op+'" stroke="'+st.color+'" stroke-opacity="'+sop+'" stroke-width="1"/>';}).join('');
    var r0=pos[0]||[0,0,0,0]; var gx=r0[0]+r0[2]/2, gy=r0[1]+r0[3]/2+3;
    return '<g class="mvx-region" data-m="'+id+'" role="button" tabindex="0" aria-label="'+escH(label+': '+st.label)+'" onclick="showMuscleDetail(\''+id+'\')" onkeydown="muscleKeyActivate(event,\''+id+'\')"><title>'+escH(label+': '+st.label)+'</title>'+rects+'<text x="'+gx+'" y="'+gy+'" class="mvx-sym">'+st.sym+'</text></g>';
  }).join('');
  var toggle='<div class="mvx-toggle" role="tablist"><button role="tab" aria-selected="'+(side==='front')+'" class="'+(side==='front'?'on':'')+'" onclick="setMvSide(\'front\')">Vorderseite</button>'+
    '<button role="tab" aria-selected="'+(side==='back')+'" class="'+(side==='back'?'on':'')+'" onclick="setMvSide(\'back\')">Rückseite</button></div>';
  var legend='<div class="mvx-legend">'+['in','below','above','low_history','no_data'].map(function(k){var s=MV_STATUS_META[k];return '<span class="mvx-leg"><i style="background:'+s.color+'"></i>'+s.sym+' '+s.label+'</span>';}).join('')+'</div>';
  var note='<p class="note mvx-note" style="text-align:left">Farbe <b>und</b> Symbol zeigen den Status. „– Keine Daten" bedeutet <b>nicht</b> zu wenig Training, sondern keine gewerteten Sätze im Zeitraum. Evidenzinformierte Schätzung, keine biologische Messung.</p>';
  return '<div class="mvx-map">'+toggle+'<div class="mvx-figure"><svg viewBox="0 0 200 348" class="mvx-svg" role="img" aria-label="Muskelkarte '+(side==='front'?'Vorderseite':'Rückseite')+'">'+sil+regions+'</svg></div>'+legend+note+'</div>';
}
function showMuscleDetail(idOrGroup){
  var model=(typeof window!=='undefined')?window._mvModel:null; var days=(typeof window!=='undefined'&&window._mvDays)||28;
  var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var m=model&&model.muscles&&model.muscles.filter(function(x){return x.muscleId===idOrGroup;})[0];
  if(!m){ if(typeof oModal==='function')oModal(mvLabelDe(idOrGroup)||'Muskel','<p class="muted" style="margin:0">Für diese Gruppe liegen im gewählten Zeitraum noch keine gewerteten Satzdaten vor. Sobald Gym-Sätze erfasst sind, erscheint hier die vollständige Aufschlüsselung.</p>'); return; }
  var exp=mvExperience(); var weeks=Math.round(days/7*10)/10; var ex=null;
  try{ if(window.ORVIA&&ORVIA.gymVolume){ var snaps=ORVIA.gymVolume.snapshotsFromStore({days:days}); ex=ORVIA.gymVolume.explainMuscleVolume(m.muscleId,snaps,{days:days,weeks:weeks,experience:exp}); } }catch(e){}
  var num=mvDetailNumbers(m,ex); var st=mvStatusModel(m);
  var contribs=(ex&&ex.contributions)||[];
  var direct=contribs.filter(function(c){return c.relationship==='direct';});
  var indirect=contribs.filter(function(c){return c.relationship==='indirect';});
  function line(c){return '<div class="md-row"><span>'+escH(c.exerciseName)+'</span><b>'+c.completedWorkingSets+' '+(c.relationship==='direct'?'direkte':'indirekte')+' Sätze × '+fmtDe(c.coefficient)+' = '+fmtDe(c.contribution)+'</b></div>';}
  var corridor=(num.targetDisplay==='insufficient_data'||num.targetMin==null)
    ?'Noch nicht genug Daten für einen individuellen Zielkorridor.'
    :'Richtwert: '+fmtDe(num.targetMin)+'–'+fmtDe(num.targetMax)+' effektive Satzäquivalente/Woche';
  /* v8-352 — DIE HERKUNFT GEHOERT AN DIE ZAHL, nicht in den Profi-Modus.
     Der Korridor stammt aus keiner Quelle. Das Label kommt aus der Engine
     (gym-volume.targetCorridor), damit die Oberflaeche es nicht selbst
     formuliert und dabei abschwaecht. */
  var korridorHerkunft=(m&&m.targetRange&&m.targetRange.label)?m.targetRange.label:null;
  var head='<div class="md-head">'+mvChip(st)+'<span class="md-week">'+fmtDe(num.weeklyEquivalent)+' eff./Woche</span></div>';
  var body='';
  // Anfänger: Kernaussage + einfache nächste Handlung (Fachzahlen bleiben identisch, nur weniger davon).
  if(mode==='anfaenger'){
    body=head+
      '<p class="md-core">'+escH(mvLabelDe(m.muscleId))+': <b>'+escH(st.label)+'</b>. '+fmtDe(num.effectiveSetEquivalents)+' effektive Satzäquivalente in den letzten '+days+' Tagen.</p>'+
      '<div class="md-corr">'+escH(corridor)+
        (korridorHerkunft?'<span class="md-corr-src">'+escH(korridorHerkunft)+'</span>':'')+'</div>'+
      '<p class="md-next"><b>Nächster Schritt:</b> '+escH(mvNextStep(st.key))+'</p>';
  } else {
    // Fortgeschritten: direkte/indirekte Sätze, Korridor, Entwicklung.
    body=head+
      '<div class="md-stat">'+
        '<div class="md-row"><span>Direkte Arbeitssätze</span><b>'+fmtDe(num.directSets)+'</b></div>'+
        '<div class="md-row"><span>Indirekte Satzäquivalente</span><b>'+fmtDe(num.indirectSetEquivalents)+'</b></div>'+
        '<div class="md-row"><span><b>Effektive Satzäquivalente</b></span><b>'+fmtDe(num.effectiveSetEquivalents)+'</b></div>'+
      '</div>'+
      '<div class="md-corr">'+escH(corridor)+
        (korridorHerkunft?'<span class="md-corr-src">'+escH(korridorHerkunft)+'</span>':'')+
        gmKorridorAbgrenzungHTML()+'</div>'+
      (direct.length?'<div class="modlbl">Direkte Beiträge</div>'+direct.map(line).join(''):'')+
      (indirect.length?'<div class="modlbl">Indirekte Beiträge</div>'+indirect.map(line).join(''):'')+
      (!contribs.length?'<p class="muted" style="margin:6px 0 0">Keine Beiträge im Zeitraum.</p>':'')+
      '<p class="md-next"><b>Nächster Schritt:</b> '+escH(mvNextStep(st.key))+'</p>';
    // Profi: vollständige Rechnung + Ausschlüsse + Confidence + Quelle + Datenqualität.
    if(mode==='profi'){
      var CONF={low:'niedrig',medium:'mittel',high:'hoch'};
      body+='<div class="md-pro">'+
        '<div class="md-row"><span>Reale Arbeitssätze</span><b>'+fmtDe(num.realWorkingSets)+'</b></div>'+
        '<div class="md-row"><span>Beitrag = Σ (reale Sätze × Koeffizient)</span><b>'+fmtDe(num.effectiveSetEquivalents)+'</b></div>'+
        '<div class="md-row"><span>Zeitraum</span><b>'+days+' Tage ('+fmtDe(weeks)+' Wo.)</b></div>'+
        '<div class="md-row"><span>Konfidenz</span><b>'+(CONF[num.confidence]||num.confidence||'–')+(num.confidenceReason?' ('+escH(num.confidenceReason)+')':'')+'</b></div>'+
        '<div class="md-row"><span>Korridor-Basis</span><b>'+escH(num.targetBasis==='produktwert'?'Produktwert (keine Quelle)':(num.targetBasis||'–'))+'</b></div>'+
        '<div class="md-row"><span>Korridor-Kennung</span><b>'+escH(num.targetSource||'–')+'</b></div>'+
        '<div class="md-row"><span>Ausgeschlossene Sätze</span><b>'+num.exclusionCount+'</b></div>'+
      '</div>';
    }
  }
  if(ex&&ex.exclusions&&ex.exclusions.length&&mode!=='anfaenger'){ body+='<p class="note" style="text-align:left;margin-top:8px">Ausgeschlossen: '+ex.exclusions.length+' Satz/Sätze (z. B. Aufwärm-/unvollständige Sätze) — nachvollziehbar, nicht gewertet.</p>'; }
  if(m.confidenceReason==='legacy_synthetic_data'){ body+='<p class="note" style="text-align:left;margin-top:6px">Satzdetails aus älteren, zusammengefassten Trainingsdaten rekonstruiert.</p>'; }
  body+='<p class="note" style="text-align:left;margin-top:6px">Evidenzinformierte Schätzung, keine exakte biologische Messung.</p>';
  if(typeof oModal==='function')oModal(mvLabelDe(m.muscleId)+' · '+fmtDe(num.effectiveSetEquivalents)+' effektiv',body);
}

var _mvReq=0; // Race-Condition-Schutz: nur die jeweils neueste Anfrage rendert
function renderMuscleVolume(){
  var el=document.getElementById('muscleVolBox');if(!el)return;var card=el.parentElement;if(card)card.style.display='';
  var days=window._mvDays||28;var reqId=++_mvReq;var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var ranges=[7,14,28,90].map(function(d){return '<button class="wo-fchip '+(d===days?'on':'')+'" aria-pressed="'+(d===days)+'" onclick="setMvRange('+d+')">'+d+' T</button>';}).join('');
  /* GM6: Lade-, Fehler- und Leerzustaende dieses Hosts verwenden die
     Golden-Master-Komponenten (.sk / .errbar / .card>.empty). */
  el.innerHTML='<div class="wo-fchips" style="padding:0 0 10px">'+ranges+'</div><div id="mvBody">'+gmStateLoading({bare:true})+'</div>';
  function out(html){var body=document.getElementById('mvBody');if(body)body.innerHTML=html;}
  if(!(window.ORVIA&&ORVIA.gymVolume&&ORVIA.gymVolume.getProductiveVolumeModel)){out(gmStateError({icon:'alert',title:'Muskelvolumen-Modul nicht geladen.',desc:'Die Auswertung steht erst nach einem vollständigen Laden der App wieder zur Verfügung.'}));return;}
  var _mvP=(window.ORVIA&&window.ORVIA.perf)||{now:function(){return Date.now();},mark:function(){}};var _mvT0=_mvP.now();
  // experience aus Fähigkeitsstufe (nicht uiDetailMode) → Engine bestimmt den Zielkorridor.
  ORVIA.gymVolume.getProductiveVolumeModel({days:days,refresh:true,experience:mvExperience()}).then(function(model){
    _mvP.mark('renderMuscleVolume: getProductiveVolumeModel(refresh:true)',_mvT0);
    if(reqId!==_mvReq)return; window._mvModel=model; window._mvDays=days;
    if(model.status==='data_unavailable'||model.status==='load_error'||model.fallbackUsed){
      out(gmStateError({title:'Eingeschränkte Datenbasis.',desc:'Muskelvolumen konnte momentan nicht vollständig berechnet werden.',retry:'renderMuscleVolume()',label:'Erneut versuchen'}));return;
    }
    if(model.status==='no_gym_workouts'||!model.muscles.length){
      out(gmStateEmpty({icon:'dumbbell',title:'Noch keine Krafttrainingsdaten',desc:'Starte ein Gym-Training mit Übungen und Sätzen — dann erscheint dein Volumen je Muskelgruppe.'}));return;
    }
    /* Partial: vorhandene Inhalte bleiben sichtbar, nur der fehlende Teil wird
       markiert — GM-Fehlerkomponente statt Legacy-.mv-note (§3). */
    var partial=model.status==='partial_data'?gmStateError({icon:'info',title:'Teilweise ausgewertet.',desc:'Ein Teil deiner Trainingsdaten konnte nicht berücksichtigt werden.'}):'';
    var CONF={low:'niedrig',medium:'mittel',high:'hoch'};
    var cards=model.muscles.map(function(m){
      var st=mvStatusModel(m);
      /* v8-352: „Ziel" ohne Herkunft war die unglaubwuerdigste Zahl auf
         dem Bildschirm — daneben tragen die Hinweise aus Wissen ihre
         Evidenzklasse. Der Korridor ist ein ORVIA-Richtwert; das steht
         jetzt dran, kurz auf der Kachel und ausfuehrlich im Detail. */
      var corr=(m.targetRange&&m.targetRange.displayStatus==='insufficient_data')
        ?'Noch kein individueller Zielkorridor'
        :'Richtwert: '+fmtDe(m.targetRange.min)+'–'+fmtDe(m.targetRange.max)+'/Woche';
      var lines='';
      if(mode==='anfaenger'){
        lines='<div class="mvc-eff">'+fmtDe(m.effectiveSetEquivalents)+' effektive Sätze · letzte '+days+' T</div>'+
              '<div class="mvc-next">'+escH(mvNextStep(st.key))+'</div>';
      }else{
        lines='<div class="mvc-sub">'+fmtDe(m.directSets)+' direkt · '+fmtDe(m.indirectSetEquivalents)+' indirekt</div>'+
              '<div class="mvc-eff">Letzte '+days+' T: '+fmtDe(m.effectiveSetEquivalents)+' eff. · Ø '+fmtDe(m.weeklyEquivalent)+'/Wo</div>'+
              '<div class="mvc-corr">'+escH(corr)+'</div>';
        if(mode==='profi'){lines+='<div class="mvc-conf">Datenbasis: '+(CONF[m.confidence]||m.confidence)+(m.confidenceReason?' · '+escH(m.confidenceReason):'')+'</div>';}
      }
      return '<button class="mvcard" data-m="'+m.muscleId+'" onclick="showMuscleDetail(\''+m.muscleId+'\')" onkeydown="muscleKeyActivate(event,\''+m.muscleId+'\')">'+
        '<div class="mvc-h"><span class="mvc-t">'+escH(m.label)+'</span>'+mvChip(st)+'</div>'+lines+'</button>';
    }).join('');
    var info='<details class="mv-info"><summary>Was bedeuten diese Werte?</summary>'+
      '<p><b>Direkte Sätze</b> – Sätze mit diesem Muskel als primärem Ziel.</p>'+
      '<p><b>Indirekte Satzäquivalente</b> – gewichtete sekundäre Belastung aus zusammengesetzten Übungen.</p>'+
      '<p><b>Effektive Satzäquivalente</b> – direkte plus gewichtete indirekte Beiträge (nicht über Muskeln aufsummierbar).</p>'+
      '<p class="muted">Werte &amp; Zielkorridor stammen aus der ORVIA-Muskelvolumen-Engine. Evidenzinformierte Schätzungen, keine Messung.</p></details>';
    out(renderMuscleMap(model)+partial+'<div class="mvcards mvx-cards">'+cards+'</div>'+info+
      '<p class="note" style="text-align:left;margin-top:8px">Antippen für Details (Beiträge je Übung, Ausschlüsse, Konfidenz). Zeitraum steuert die Datumsgrenzen; „/Woche" ist der daraus normalisierte Durchschnitt.</p>');
  }).catch(function(e){ _mvP.mark('renderMuscleVolume: getProductiveVolumeModel (error)',_mvT0); if(reqId!==_mvReq)return; try{console.error('[muscleVolume]',e);}catch(_){ } out(gmStateError({title:'Muskelvolumen konnte momentan nicht berechnet werden.',retry:'renderMuscleVolume()',label:'Erneut versuchen'})); });
}

function gymInjuryHint(){
  var e=DB[todayStr()];var m=e&&e.morning;var knee=(m&&m.knee!=null)?m.knee:0;
  var iss=(e&&e.issues)||{};var back=iss.back||0,shoulder=iss.shoulder||0;
  var pIss=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.issues)||[];
  var tips=[];
  if(knee>=2)tips.push('Knie '+knee+'/10: meide tiefe Kniebeugen, Step-ups, Ausfallschritte, Sprünge. Besser: Beinpresse leicht, Glute Bridge, Beinstrecker leicht, Wadenheben.');
  if(shoulder>=2||pIss.indexOf('shoulder')>=0)tips.push('Schulter: kein schweres Overhead-Drücken. Besser: Landmine-/Schrägdrücken, Seitheben leicht, Face Pulls.');
  if(back>=2||pIss.indexOf('back')>=0)tips.push('Rücken: weniger axiale Last — Maschinen/gestützte Übungen, kein schweres Kreuzheben/Good Morning, kontrolliert.');
  if(!tips.length)return '';
  return '<div class="gym-injury">'+tips.map(esc).join('<br>')+'</div>';
}
function blockGym(d){return `<div class="sescard"><div class="seshead">${ic('dumbbell')}Gym</div>${(typeof gymInjuryHint==='function')?gymInjuryHint():''}
  ${chips('Fokus (mehrfach)','g_sub',['Ganzkörper','Oberkörper','Push','Pull','Core','Beine','Glute-Aktivierung','VMO/Rehab'],d.sub,true)}
  <div class="row2"><div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="g_dur" value="${d.dur??''}" placeholder="45"></div>
  <div class="field"><label>Sätze gesamt</label><input type="number" inputmode="numeric" id="g_sets" value="${d.sets??''}" placeholder="20"></div></div>
  ${slider('g_rpe','RPE (Anstrengung)',1,10,d.rpe??6,'leicht','max')}
  ${slider('g_perf','Leistung',1,10,d.perf??6)}
  ${slider('g_knee','Knie POST',0,10,d.knee??0,'kein','max')}
  <div class="field"><label>Übungen &amp; Sätze</label>
    <button type="button" class="btn sec gym-ex-btn" id="g_ex_btn" onclick="openGymPicker()">+ Übungen wählen</button>
    <div class="gym-ex-rows" id="g_ex_rows">${gymRowsHTML(d.exLog&&d.exLog.length?d.exLog:migrateEx(d.exercises))}</div></div>
  <div class="field" style="margin-bottom:0"><label>Notiz</label><input type="text" id="g_note" value="${esc(d.note)}" placeholder="z.B. Bench 4×8..."></div></div>`;}
function blockRad(d){return `<div class="sescard"><div class="seshead">${ic('bike')}Rad</div>
  ${chips('Typ','r_sub',['Commute','Easy Z2','Tempo Z3','Intervalle','Long Ride'],d.sub?[d.sub]:[])}
  <div class="row2"><div class="field"><label>Distanz (km)</label><input type="number" inputmode="decimal" id="r_dist" value="${d.dist??''}" placeholder="30" oninput="updRad()"></div>
  <div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="r_dur" value="${d.dur??''}" placeholder="60" oninput="updRad()"></div></div>
  <div class="calc" id="r_calc"></div>
  ${gearChips('bike','r_gear',d.gearId)}
  <div class="row2" style="margin-top:14px"><div class="field"><label>Ø Herzfrequenz</label><input type="number" inputmode="numeric" id="r_hr" value="${d.hr??''}" placeholder="135"></div>
  <div class="field"><label>Höhenmeter</label><input type="number" inputmode="numeric" id="r_elev" value="${d.elev??''}" placeholder="opt."></div></div>
  ${slider('r_rpe','RPE',1,10,d.rpe??5,'leicht','max')}
  ${slider('r_perf','Leistung',1,10,d.perf??6)}
  ${slider('r_knee','Knie POST',0,10,d.knee??0,'kein','max')}
  <div class="field" style="margin-bottom:0"><label>Notiz</label><input type="text" id="r_note" value="${esc(d.note)}" placeholder="flach / Wind..."></div></div>`;}
function blockSwim(d){return `<div class="sescard"><div class="seshead">${ic('swim')}Schwimmen</div>
  ${chips('Fokus','s_sub',['Brust-Technik','Kraul-Integration','Kraul','Mixed','Kick-Drills'],d.sub?[d.sub]:[])}
  <div class="row2"><div class="field"><label>Distanz (m)</label><input type="number" inputmode="numeric" id="s_dist" value="${d.dist??''}" placeholder="800" oninput="updSwim()"></div>
  <div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="s_dur" value="${d.dur??''}" placeholder="40" oninput="updSwim()"></div></div>
  <div class="calc" id="s_calc"></div>
  <div class="field" style="margin-top:14px"><label>Längste am Stück (m)</label><input type="number" inputmode="numeric" id="s_long" value="${d.long??''}" placeholder="200"></div>
  ${slider('s_rpe','RPE',1,10,d.rpe??5,'leicht','max')}
  ${slider('s_perf','Gefühl/Technik',1,10,d.perf??5)}
  <div class="field" style="margin-bottom:0"><label>Technik-Notiz</label><input type="text" id="s_note" value="${esc(d.note)}" placeholder="Atmung / Gleitphase..."></div></div>`;}
function blockMob(d){return `<div class="sescard"><div class="seshead">${ic('stretch')}Mobilität</div>
  ${chips('Bereich (mehrfach)','mo_sub',['Sprunggelenk','Spanish Squats','Glute-Aktivierung','Stretching','Full Routine'],d.sub,true)}
  <div class="field"><label>Dauer (min)</label><input type="number" inputmode="numeric" id="mo_dur" value="${d.dur??''}" placeholder="15"></div>
  ${slider('mo_knee','Knie POST',0,10,d.knee??0,'kein','max')}
  <div class="field" style="margin-bottom:0"><label>Notiz</label><input type="text" id="mo_note" value="${esc(d.note)}" placeholder="links extra..."></div></div>`;}
function durMin(id,lo,hi){var s=(v(id)||'').trim();if(!s)return null;var m;
  if(s.indexOf(':')>=0){var p=s.split(':');var mm=parseInt(p[0],10),ss=parseInt(p[1],10);if(isNaN(mm)||isNaN(ss)||ss<0||ss>=60)return null;m=mm+ss/60;}
  else{m=parseFloat(s.replace(',','.'));if(isNaN(m))return null;}
  if(lo!=null)m=Math.max(lo,Math.min(hi,m));return m;}
function fmtDurInput(min){if(min==null)return '';var m=Math.floor(min),s=Math.round((min-m)*60);if(s===60){m++;s=0;}return m+':'+String(s).padStart(2,'0');}
function updRun(){const el=document.getElementById('l_calc');if(!el)return;const di=numIn('l_dist',...LIM.runKm),du=durMin('l_dur',LIM.runMin[0],LIM.runMin[1]);
  el.textContent=(di&&du)?`Ø ${fmtPace(du*60/di)} /km`:'';}
function updRad(){const el=document.getElementById('r_calc');if(!el)return;const di=numIn('r_dist',...LIM.radKm),du=numIn('r_dur',...LIM.radMin);el.textContent=(di&&du)?`Ø ${(di/(du/60)).toFixed(1)} km/h`:'';}
function updSwim(){const el=document.getElementById('s_calc');if(!el)return;const di=numIn('s_dist',...LIM.swimM),du=numIn('s_dur',...LIM.swimMin);
  if(di&&du){const sp=du*60/(di/100);el.textContent=`Ø ${Math.floor(sp/60)}:${String(Math.round(sp%60)).padStart(2,'0')} /100m`;}else el.textContent='';}
function savePost(silent){if(!canEditCur(silent))return;const e=entry(cur);e.sessions=e.sessions||{};
  Object.keys(e.sessions).forEach(t=>{if(t!=='_ts'&&!activeTypes.has(t))delete e.sessions[t];});
  if(activeTypes.has('Laufen'))e.sessions.Laufen={sub:chipGet('l_sub')[0]||'',dist:numIn('l_dist',...LIM.runKm),dur:durMin('l_dur',LIM.runMin[0],LIM.runMin[1]),cad:numIn('l_cad',100,260),hr:numIn('l_hr',...LIM.hr),elev:numIn('l_elev',...LIM.elev),hrmin:numIn('l_hrmin',...LIM.hr),hrmax:numIn('l_hrmax',...LIM.hr),rpe:+v('l_rpe'),perf:+v('l_perf'),knee:+v('l_knee'),note:v('l_note'),felt:(typeof chipGet==='function'?(chipGet('l_felt')[0]||''):''),gearId:gearSel('l_gear')};
  if(activeTypes.has('Gym'))e.sessions.Gym={sub:chipGet('g_sub'),dur:numIn('g_dur',...LIM.gymMin),sets:numIn('g_sets',...LIM.sets),exLog:(typeof readGymRows==='function'?readGymRows():[]),rpe:+v('g_rpe'),perf:+v('g_perf'),knee:+v('g_knee'),note:v('g_note')};
  if(activeTypes.has('Rad'))e.sessions.Rad={sub:chipGet('r_sub')[0]||'',dist:numIn('r_dist',...LIM.radKm),dur:numIn('r_dur',...LIM.radMin),hr:numIn('r_hr',...LIM.hr),elev:numIn('r_elev',...LIM.elev),rpe:+v('r_rpe'),perf:+v('r_perf'),knee:+v('r_knee'),note:v('r_note'),gearId:gearSel('r_gear')};
  if(activeTypes.has('Schwimmen'))e.sessions.Schwimmen={sub:chipGet('s_sub')[0]||'',dist:numIn('s_dist',...LIM.swimM),dur:numIn('s_dur',...LIM.swimMin),long:numIn('s_long',...LIM.swimM),rpe:+v('s_rpe'),perf:+v('s_perf'),note:v('s_note')};
  if(activeTypes.has('Mobilität'))e.sessions['Mobilität']={sub:chipGet('mo_sub'),dur:numIn('mo_dur',...LIM.mobMin),knee:+v('mo_knee'),note:v('mo_note')};
  e.sessions._ts=Date.now();save();renderCommand();
  // Phase 3: absolvierte Sessions in training_load_daily persistieren (idempotent über
  // client_session_id 'blob:<date>:<sport>'; deckt sich mit migrate-blob → keine Dubletten).
  // Lösch-Sync entfernt manuelle Zeilen entfernter Sportarten. Belastung ≠ Readiness.
  try{
    if(window.ORVIA&&window.ORVIA.repos&&window.ORVIA.repos.trainingLoad){
      var _tl=window.ORVIA.repos.trainingLoad,_rows=[],_keep=[];
      Object.keys(e.sessions).forEach(function(sp){ if(sp==='_ts')return; var s=e.sessions[sp]; if(!s||typeof s!=='object')return;
        var cid='blob:'+cur+':'+sp; _keep.push(cid);
        _rows.push(_tl.toRow(cur,sp,Object.assign({},s,{client_session_id:cid}))); });
      if(_rows.length&&typeof _tl.saveMany==='function')_tl.saveMany(_rows);
      if(typeof _tl.pruneManualDay==='function')_tl.pruneManualDay(cur,_keep);
    }
  }catch(_e){}
  if(!silent){
    var L=DB[cur]&&DB[cur].sessions&&DB[cur].sessions.Laufen;
    // PB-Erkennung nur für zentral validierte Läufe (Aufrufer-Gate; detectPBs validiert zusätzlich intern).
    var pbs=(activeTypes.has('Laufen')&&L&&_validRun(L)&&typeof detectPBs==='function')?detectPBs(cur):[];
    var sig=(pbs&&pbs.length)?pbs.map(function(p){return p.label+':'+p.val;}).join('|'):'';
    if(pbs&&pbs.length&&L&&L._pbSig!==sig&&typeof celebratePB==='function'){L._pbSig=sig;save();celebratePB(pbs);}
    else{var fb=(activeTypes.has('Laufen')&&typeof trainingFeedback==='function')?trainingFeedback():null;
      if(fb&&typeof oModal==='function')oModal('Training-Feedback','<div class="coachbubble">'+esc(fb)+'</div>');
      else toast(activeTypes.size?activeTypes.size+' Einheit(en) gespeichert ✓':'Keine Einheit gewählt');}
  }}
function autoPost(){savePost(true);}
/* Ausführliches, regelbasiertes Feedback nach dem Lauf */
function trainingFeedback(){
  var e=DB[cur];if(!e||!e.sessions||!e.sessions.Laufen)return null;var L=e.sessions.Laufen;
  if(!L.dist||!L.dur)return null;
  if(!_validRun(L))return null; // unplausibler Lauf → kein absurdes Feedback
  var pace=L.dur*60/L.dist;var p=[];
  if(L.sub==='Wettkampf')p.push('Wettkampf im Kasten — stark, dass du dich gestellt hast! '+fmtDe(L.dist)+' km in '+fmtDurInput(L.dur)+' ('+fmtPace(pace)+'/km).');
  else p.push('Einheit gespeichert: '+fmtDe(L.dist)+' km in '+fmtDurInput(L.dur)+', Schnitt '+fmtPace(pace)+'/km.');
  var days=Object.keys(DB).filter(isDay).filter(function(k){return k<cur;}).sort().reverse();
  for(var i=0;i<days.length;i++){var pe=DB[days[i]];if(pe&&pe.sessions&&pe.sessions.Laufen&&_validRun(pe.sessions.Laufen)){var P=pe.sessions.Laufen;
    if(P.dist&&P.dur&&Math.abs(P.dist-L.dist)/L.dist<=0.3){var diff=Math.round(P.dur*60/P.dist-pace);
      if(diff>=8)p.push('Das sind '+diff+' s/km schneller als bei deinem letzten ähnlichen Lauf — deine Form geht klar nach vorne.');
      else if(diff>=3)p.push('Etwas schneller als zuletzt bei ähnlicher Distanz — sauberer Fortschritt.');
      else if(diff<=-8)p.push('Bewusst lockerer als letztes Mal — genau richtig, wenn Erholung das Ziel war.');
      else p.push('Tempo auf dem Niveau deiner letzten ähnlichen Einheit — solide Konstanz.');
      break;}}}
  var g=(typeof goalOf==='function')?goalOf():null;var z=(g&&g.targetMin&&Calc.paceZones)?Calc.paceZones(g.distanceKm,g.targetMin):null;
  if(z){var easy=z.find(function(x){return x.k==='Easy';});
    if(L.sub==='Easy Z2'&&easy&&pace<easy.lo)p.push('Für einen Easy Run war das zu schnell — '+fmtPace(easy.lo)+'–'+fmtPace(easy.hi)+'/km wäre der Bereich. Nächstes Mal 10–15 s/km langsamer, dann bringt er mehr.');}
  if(L.knee!=null&&L.knee>=3)p.push('Knie nach dem Lauf '+L.knee+'/10 — heute kühlen, morgen lockerer angehen und im Warm-up genau hinspüren.');
  else if(L.knee!=null&&L.knee<=1)p.push('Knie blieb ruhig ('+L.knee+'/10) — gutes Zeichen.');
  if(L.felt)p.push('Du hast die Einheit als „'+L.felt+'" empfunden.'+(L.felt==='zu hart'?' Wenn das öfter vorkommt, Pace oder Umfang etwas zurücknehmen.':(L.felt==='zu leicht'?' Beim nächsten Mal ruhig etwas mehr fordern.':'')));
  p.push('Nimm mit, was gut lief: geduldig starten, hinten rausdrehen.');
  return p.join(' ');
}

/* ============ ROUTINEN & SUPPLEMENTS ============ */
/* P7: Roll-up offener Tagesaufgaben — Grundlage für die dynamische Karte.
   Offen = aktive, heute nicht abgehakte Routinen + empfohlene, nicht genommene Supplements. */
function openRoutineTasks(){try{
  const e=entry(cur);const r=e.routines||{};
  const openR=activeRoutines().filter(([k])=>!r[k]).length;
  const taken=e.subs||[];
  const recs=(typeof suppRecs==='function')?suppRecs():[];
  const openS=recs.filter(x=>taken.indexOf(x.n)<0).length;
  return openR+openS;
}catch(e){return 0;}}
function renderRoutines(){const e=entry(cur);const r=e.routines||{};
  // P7: keine statische Dauerkarte — nur zeigen, wenn HEUTE etwas offen ist
  // (Vergangenheit: nur wenn dort tatsächlich etwas erfasst wurde).
  const card=document.getElementById('routinesCard');
  const open=openRoutineTasks();
  const isToday=cur===todayStr();
  const hasHist=Object.keys(r).length>0||((e.subs||[]).length>0);
  // H5: Quick-Add „Routinen" darf die Karte auch ohne offene Aufgaben zeigen
  // (window._routinesForceShow, bis zum Tageswechsel) — sonst Race mit diesem Gate.
  const force=!!window._routinesForceShow&&isToday;
  /* GM6.1 §5: der Bereich darf nicht verschwinden, nachdem ihn der Nutzer
     ausdruecklich geoeffnet hat. gmShowCarryover('routinesCard') (js/ui.js)
     setzt dafuer .gm-co-open; styles.css:3306 macht die Karte damit sichtbar.
     Das hier gesetzte INLINE display:none haette diese CSS-Regel jedoch
     ueberschrieben — genau der gemeldete Defekt. Der explizit geoeffnete
     Zustand wird deshalb wie force behandelt. Reine Sichtbarkeit; die
     Bedingungen fuer echte Inhalte bleiben unveraendert. */
  const coOpen=!!(card&&card.classList&&card.classList.contains('gm-co-open'));
  /* Phase 3 (E-22): sind Routinen konfiguriert, ist die Karte HEUTE regulaer da —
     der taegliche Abhak-Kontext ist ihr Zweck. Leere Auswahl ⇒ Karte weg. */
  const _act3=activeRoutines();
  /* 2026-08-05: Laeuft der Bereich als Modul (gmModSupplements), traegt das Modul den
     taeglichen Status — die Formularkarte erscheint dann nur noch auf ausdrueckliche
     Anforderung (gmGotoRoutines setzt .gm-co-open). Kein Doppelinhalt, aber auch kein
     Funktionsverlust: das Formular selbst bleibt unveraendert. */
  const _modOn=(typeof gmModOn==='function')&&gmModOn('supplements');
  if(card)card.style.display=((force||coOpen)||(!_modOn&&(isToday?(open>0||_act3.length>0):hasHist)))?'':'none';
  const badge=document.getElementById('routinesOpenBadge');
  if(badge)badge.textContent=(isToday&&open>0)?open+' offen':'';
  const act=activeRoutines();
  const chips=document.getElementById('routineChips');
  if(chips)chips.innerHTML=act.map(([k,lab])=>`<button type="button" class="chip gn${r[k]?' on':''}" onclick="toggleRoutine('${k}',this)">${lab}</button>`
    ).join('')+`<button type="button" class="chip" style="opacity:.75" onclick="gmOpenRoutinesEditor()">⚙ Anpassen</button>`;
  /* E-22: das feste Spanish-Squats-Zaehlfeld erscheint NUR, wenn die Routine aktiv
     ist — es war ein hartkodiertes Ein-Nutzer-Feld. Erfasste Werte bleiben. */
  const ssField=document.getElementById('ssRepsField');
  if(ssField)ssField.style.display=act.some(x=>x[0]==='ss')?'':'none';
  const ss=document.getElementById('ssRepsIn');if(ss)ss.value=r.ssReps??'';   // P7: Guard (warf vorher bei fehlendem Element)
  renderSupps();}
function toggleRoutine(k,btn){if(!canEditCur())return;const e=entry(cur);e.routines=e.routines||{};e.routines[k]=e.routines[k]?0:1;btn.classList.toggle('on');save();}
function toggleSub(s,btn){if(!canEditCur())return;const e=entry(cur);e.subs=e.subs||[];const i=e.subs.indexOf(s);if(i>=0)e.subs.splice(i,1);else e.subs.push(s);if(btn)btn.classList.toggle('on');save();}
let stackEdit=false,browseOpen=false;
function getStack(){return DB._stack||(DB._stack=[]);}
function allSupps(){return [].concat(...Object.values(SUB_CATS));}
function suppRecs(){
  const e=entry(cur);const m=e.morning||{};const ev=e.eve||{};
  const wd=(new Date(cur+'T12:00').getDay()+6)%7;const plan=activeWeekPlan()[wd]||[];const out=[];
  out.push({n:'Vitamin D3',why:'Basis im Norden — 1000–4000 IE zum Essen'});
  out.push({n:'Omega-3 (EPA/DHA)',why:'Entzündungsmodulation & Herz — 1–2g täglich'});
  out.push({n:'Kreatin',why:'3–5g täglich, Timing egal'});
  const run=plan.find(p=>p.t==='Laufen');
  if(run&&/Intervalle|Tempo/.test(run.l))out.push({n:'Koffein',why:run.l+' heute — 3–6mg/kg, 45–60min vorher'});
  if(run&&/Long/.test(run.l))out.push({n:'Elektrolyte/Natrium',why:'Long Run heute — Natrium ersetzen'});
  if(run||plan.find(p=>p.t==='Rad'))out.push({n:'Kollagen + Vit C',why:'15g + Vit C ~1h vor der Einheit — Sehnen-Support'});
  if(m.sleepQ!=null&&m.sleepQ<=5)out.push({n:'Magnesium-Glycinat',why:'Schlafqualität '+m.sleepQ+'/10 — heute Abend 300–400mg'});
  else out.push({n:'Magnesium-Glycinat',why:'Abends — Schlaf & Muskelfunktion'});
  if((activeWeekPlan()[(wd+1)%7]||[]).find(p=>p.t==='Schwimmen'))out.push({n:'Melatonin',why:'Morgen früher Schwimmtag — 0,5–1mg vor dem Schlaf'});
  if(ev.prot!=null&&ev.prot<150)out.push({n:'Whey/Protein',why:'Erst '+ev.prot+'g — Lücke zum 150g-Ziel schließen'});
  else out.push({n:'Whey/Protein',why:'Baustein fürs 150–165g-Ziel'});
  /* v8-317: Garmins echte Kategorien (Low UND Poor) plus Schwelle statt Gleichheit. */
  if(Calc.hrvBelowBaseline(m.hrv)||(function(){var _s=Calc.hrvScoreOf(m,recoveryCtx(cur));return _s!=null&&_s<=40;})())out.push({n:'L-Theanin',why:'HRV gedrückt — beruhigend; Koffein heute meiden'});
  const seen=new Set();return out.filter(r=>!seen.has(r.n)&&seen.add(r.n));
}
function renderSupps(){
  const subs=(entry(cur).subs)||[];const stack=getStack();
  document.getElementById('recBox').innerHTML=`<div class="slot">Für heute empfohlen</div>`+suppRecs().map(r=>{const on=subs.includes(r.n);
    return `<div class="stackitem rec${on?' on':''}" onclick="toggleSub('${jsArg(r.n)}');renderSupps()">
      <div class="check">${on?'✓':''}</div><div><div class="sname">${esc(r.n)}</div><div class="sdose">${esc(r.why)}</div></div></div>`;}).join('');
  let html='<div class="supphd">Dein Stack · Schnellauswahl <span>(antippen = heute genommen · „Stack bearbeiten" anpassen)</span></div>';
  if(stack.length){
    SLOTS.forEach(slot=>{const items=stack.filter(x=>x.timing===slot);if(!items.length)return;
      html+=`<div class="slot">${slot}</div>`;
      items.forEach(it=>{const on=subs.includes(it.name);
        html+=`<div class="stackitem${on?' on':''}" onclick="toggleSub('${jsArg(it.name)}');renderSupps()">
          <div class="check">${on?'✓':''}</div>
          <div><div class="sname">${esc(it.name)}</div>${it.dose?`<div class="sdose">${esc(it.dose)}</div>`:''}</div>
          ${stackEdit?`<span class="del" onclick="event.stopPropagation();delStack('${jsArg(it.name)}','${jsArg(it.timing)}')">✕</span>`:''}</div>`;});});
  }else{
    /* GM6.1 §5: Leerzustand des Supplement-Stacks. Statt des Legacy-Absatzes
       (<p class="muted">) jetzt die exakte Golden-Master-Empty-Komponente an
       fester Position innerhalb der bestehenden Struktur — direkt nach der
       Ueberschrift, vor der Aktionszeile. Der Bereich verschwindet nicht und es
       werden KEINE Demo-Supplements und keine automatisch erzeugten Eintraege
       gezeigt. Die Erfassungsaktion erscheint nur, wenn der Editor noch nicht
       offen ist — sie ruft openStackEditor(), das ausschliesslich den bereits
       vorhandenen, funktionsfaehigen Erfassungsweg (addStack()) oeffnet. */
    html+=gmStateEmpty({icon:'db',title:'Noch kein Stack angelegt',
      desc:'Lege feste Supplements an — auch eigene, frei benannte. Bis dahin bleibt der Stack leer; ORVIA schlägt hier nichts automatisch vor.',
      action:stackEdit?null:'openStackEditor()',actionIcon:'plus',label:'Stack bearbeiten'});
  }
  html+=`<div style="margin-top:10px;display:flex;gap:10px">
    <button class="chip" onclick="stackEdit=!stackEdit;renderSupps()">${stackEdit?'Fertig ✓':'Stack bearbeiten'}</button>
    <button class="chip" onclick="browseOpen=!browseOpen;renderBrowse()" id="browseBtn">${browseOpen?'Schließen':'+ Einmalig genommen'}</button></div>`;
  if(stackEdit){
    html+=`<div class="addrow">
      <input id="addName" list="suppDatalist" placeholder="Eigenes Supplement…">
      <datalist id="suppDatalist">${allSupps().map(s=>`<option value="${esc(s)}">`).join('')}</datalist>
      <input id="addDose" placeholder="Dosis">
      <select id="addTiming">${SLOTS.map(s=>`<option>${s}</option>`).join('')}</select>
      <button onclick="addStack()">+</button></div>`;}
  document.getElementById('stackBox').innerHTML=html;
  renderBrowse();
}
/* GM6.1 §5: reine UI-Aktion — oeffnet den bereits vorhandenen Stack-Editor.
   Bewusst KEIN Toggle (der Chip toggelt), damit die Aktion aus dem Leerzustand
   heraus deterministisch oeffnet. Keine Datenmutation, keine Persistenz. */
function openStackEditor(){stackEdit=true;renderSupps();
  try{var b=document.getElementById('addName');if(b)b.focus();}catch(_){ }}
function addStack(){const name=v('addName').trim(),dose=v('addDose'),timing=v('addTiming');if(!name)return;
  const st=getStack();if(!st.find(x=>x.name===name&&x.timing===timing))st.push({name,dose,timing});save();renderSupps();}
function delStack(name,timing){DB._stack=getStack().filter(x=>!(x.name===name&&x.timing===timing));save();renderSupps();}
function renderBrowse(){const subs=(entry(cur).subs)||[];const el=document.getElementById('subBrowse');
  const bb=document.getElementById('browseBtn');if(bb)bb.textContent=browseOpen?'Schließen':'+ Einmalig genommen';
  el.innerHTML=browseOpen?
    Object.entries(SUB_CATS).map(([cat,items])=>`<div class="subcat">${cat}</div><div class="chips">`+
      items.map(s=>`<button type="button" class="chip gn${subs.includes(s)?' on':''}" onclick="toggleSub('${jsArg(s)}',this)">${esc(s)}</button>`).join('')+`</div>`).join(''):'';
}
function bindReps(){var el=document.getElementById('ssRepsIn');if(!el)return;el.onchange=()=>{if(!canEditCur())return;const e=entry(cur);e.routines=e.routines||{};e.routines.ssReps=numIn('ssRepsIn',...LIM.reps);save();};}
/* Lexikon (Bottom-Sheet) */
function openSuppList(){document.getElementById('suppSheet').innerHTML=
  `<div class="sheethead"><h2>${ic('pill')}Supplement-Lexikon</h2><button class="xbtn" onclick="closeSupp()">✕</button></div>
   <p class="muted" style="margin:0 0 12px">Tippe ein Mittel für Erklärung + individuelle Einschätzung.</p>
   <input class="searchbox" placeholder="Suchen…" oninput="renderSuppBody(this.value)">
   <div id="suppListBody"></div>`;
  renderSuppBody('');document.getElementById('suppModal').classList.add('show');}
function renderSuppBody(q){q=(q||'').toLowerCase();let html='';
  Object.entries(SUB_CATS).forEach(([cat,items])=>{const fil=items.filter(s=>s.toLowerCase().includes(q));if(!fil.length)return;
    html+=`<div class="scat">${cat}</div>`;
    fil.forEach(s=>{const m=vmeta((SUPP_INFO[s]||{}).v||2);html+=`<div class="suppli" onclick="openSuppDetail('${jsArg(s)}')"><span style="font-weight:600">${esc(s)}</span><span class="vb ${m.c}">${m.t}</span></div>`;});});
  document.getElementById('suppListBody').innerHTML=html||'<p class="muted">Nichts gefunden.</p>';}
function openSuppDetail(name){const i=SUPP_INFO[name]||{};const m=vmeta(i.v||2);
  document.getElementById('suppSheet').innerHTML=
   `<div class="sheethead"><button class="xbtn" onclick="openSuppList()">‹</button><button class="xbtn" onclick="closeSupp()">✕</button></div>
    <div class="suppdetail"><h3>${esc(name)}</h3><span class="vb ${m.c}">${m.t}</span>
      <div class="lbl">Wirkung</div><p>${i.w||'–'}</p>
      <div class="lbl">Evidenz</div><p>${i.e||'–'}</p>
      <div class="lbl">Dosis &amp; Timing</div><p>${i.d||'–'}</p>
      <div class="lbl">Für dich</div><div class="foryou">${i.f||'–'}</div></div>`;}
function closeSupp(){document.getElementById('suppModal').classList.remove('show');}

/* ============ ABEND ============ */
/* Phase 6: deklarativ aus ORVIA.checkinFields.EVENING; Bedingung 'kneeIssueInactive'
   reproduziert das Bestandsverhalten (e_knee nur, wenn das Knie-Issue-Modul den
   Wert NICHT selbst erhebt bzw. das Modul fehlt). */
function _ciEveFields(){
  var REG=_ciReg();if(!REG)return null;
  return REG.EVENING.filter(function(f){
    if(f.condition==='kneeIssueInactive'&&typeof checkinIssueKeys==='function'&&checkinIssueKeys().indexOf('knee')<0)return false;
    return true;});}
function renderEve(){const e=(entry(cur).eve)||{};
  var fields=_ciEveFields();
  /* Phase 3 (E-24): ehrlicher Status im Kopf der Karte — erledigt vs. offen —
     statt eines kommentarlosen Formulars. Karte erscheint kontextuell ab 17 Uhr
     (gmEveVisible), nicht mehr dauerhaft versteckt. */
  var done=!!(e&&e.ts);
  var head=done
    ?'<div class="mini-note" style="margin:0 0 10px">'+icon('check','xs')+'<div><b>Heute erledigt.</b> Du kannst Werte bis Tagesende anpassen.</div></div>'
    :'<div class="mini-note" style="margin:0 0 10px">'+icon('moon','xs')+'<div><b>Tagesabschluss.</b> 1 Minute — verbessert die Empfehlung für morgen.</div></div>';
  document.getElementById('eveForm').innerHTML=head+(fields?_ciFormHTML(fields,e,'full'):gmStateError({icon:'alert',title:'Check-in-Modul nicht geladen.',desc:'Lade die App neu, sobald du wieder online bist.'}));
  initRanges();}
/* Wie gatherMorning: dirty-Slider-Logik auch abends — unberührte Defaults
   (Energie 6 / Schlaf-Erwartung 7 / Stimmung 7) sind keine Messwerte. */
function gatherEve(){var prev=(entry(cur).eve)||{};
  var REG=_ciReg();var fields=REG?REG.EVENING:[];
  var out={};
  fields.forEach(function(f){var el=document.getElementById(f.el);
    switch(f.kind){
      case 'range':out[f.key]=el?_sliderVal(f.el,prev[f.key]):(f.absentDef!==undefined?f.absentDef:(prev[f.key]!=null?prev[f.key]:null));break;
      case 'number':out[f.key]=el?numIn(f.el,...LIM[f.lim]):(prev[f.key]!=null?prev[f.key]:null);break;
      case 'chipsText':out[f.key]=el?(chipGet(f.el)[0]||''):(prev[f.key]||'');break;
      case 'note':out[f.key]=el?v(f.el):(prev[f.key]||'');break;
    }});
  out.ts=Date.now();return out;}
/* H3 (E3): Abend-Check-in geht jetzt auch in daily_checkins ('evening') — Kernfelder
   Stimmung(feel)/Energie/Knie/Notiz; Ernährung bleibt bewusst Blob (Nutrition-Modul später). */
function _persistEve(){try{var ev=entry(cur).eve;if(!ev)return;
  if(window.ORVIA&&ORVIA.checkinStore&&ORVIA.checkinStore.persistCheckin)
    ORVIA.checkinStore.persistCheckin(cur,'evening',{ts:ev.ts,knee:ev.knee,feel:ev.mood,energy:ev.energy,note:ev.note});}catch(e){}}
function autoEve(){if(!document.getElementById('e_knee'))return;if(!canEditCur(true))return;entry(cur).eve=gatherEve();save();_persistEve();}
function saveEve(){if(!canEditCur())return;entry(cur).eve=gatherEve();if(window._correctionMode&&cur!==todayStr())logCorrection('eve');save();_persistEve();toast(window._correctionMode&&cur!==todayStr()?'Korrektur gespeichert ✓':'Abend gespeichert ✓');}

/* ============ BANNERS ============ */
function renderBanners(){const out=document.getElementById('banners');let html='';
  if(DB._corrupt){
    html+=`<div class="banner err">${ic('info')}<span><b>Gespeicherte Daten waren beschädigt.</b> Eine Rettungskopie liegt im Browser-Speicher. Backup importieren oder leer weiterstarten.</span>
      <button onclick="document.getElementById('importFile').click()">Import</button>
      <button onclick="resolveCorrupt();renderDay()">Leer starten</button></div>`;
    out.innerHTML=html;return;
  }
  if(saveFailed)html+=`<div class="banner err">${ic('save')}<span><b>Speichern fehlgeschlagen</b> (Speicher voll oder privater Modus). Jetzt Backup ziehen!</span><button onclick="exportData()">Backup</button></div>`;
  const e=DB[todayStr()];const hr=new Date().getHours();
  if(cur===todayStr()&&hr>=9&&hr<21&&(!e||!e.morning))
    html+=`<div class="banner info">${ic('sun')}<span>Morgen-Check-in fehlt noch — 2 Minuten, dann gibt's deine Ampel.</span></div>`;
  const lb=DB._lastBackup;const nDays=Object.keys(DB).filter(isDay).length;
  if(nDays>=5&&(!lb||Date.now()-lb>7*864e5))
    html+=`<div class="banner warn2">${ic('save')}<span>${lb?'Backup älter als 7 Tage':'Noch kein Backup'} — Daten liegen nur im Browser.</span><button onclick="exportData();renderBanners()">Sichern</button></div>`;
  out.innerHTML=html;}

/* ============ ZENTRALE TAG-LOGIK ============ */
/* relativer Tagestitel: Heute / Gestern / Morgen / Wochentag.
   Phase 4 (P2-4): zentraler Formatierer F.dayLabel statt eigener Datumsarithmetik —
   identische Labels ueberall; Fallback (ausserhalb der Woche) bleibt der Wochentag. */
function relDayTitle(d){
  try{
    var _F=(window.ORVIA&&ORVIA.fmt)||null;
    var rl=(_F&&_F.dayLabel)?_F.dayLabel(d,todayStr()):null;
    if(rl)return rl;
  }catch(_){ }
  return new Date(d+'T12:00').toLocaleDateString('de-DE',{weekday:'long'});
}
/* P1A: Daily-Motivation entfernt — englische Floskeln widersprechen „Analyse statt
   Motivation" und der deutschen Produktsprache (Produktreife-Audit #24/35). */

/* ============ TAG RENDERN / NAVIGATION ============ */
function renderDay(){if(typeof invalidateDecision==='function')invalidateDecision();const hr=new Date().getHours();const today=cur===todayStr();
  document.getElementById('dayTitle').textContent=relDayTitle(cur);
  /* v3-Header: ausschließlich echte Quellen — kein Demo-Name, kein Demo-Sync. */
  (function(){try{
    var hn=document.getElementById('hdrName');
    if(hn)hn.textContent=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.name)?PROFILE.name:'Athlet';
    var mb=document.getElementById('modeBadge');
    if(mb&&typeof uiDetailMode==='function'){var _m=uiDetailMode();mb.textContent=({anfaenger:'Einfache Ansicht',fortgeschritten:'Fortgeschritten',profi:'Profi-Ansicht'})[_m]||'';}
    /* GM7: Geraete-Sync (Provider+last_sync) ist die kanonische Quelle dieser Zeile;
       Cloud-Sync-Status nur als klar benannter Fallback (gmApplySyncLine). */
    gmApplySyncLine();gmDeviceSyncRefresh();
  }catch(_){ }})();
  if(typeof renderCheckinCompact==='function')renderCheckinCompact();
  document.getElementById('greet').textContent=today?(hr<11?'Guten Morgen':hr<18?'Hi':'Guten Abend'):'Ausgewählter Tag';
  document.getElementById('dateLabel').textContent=fmtDate(cur);
  document.getElementById('nextDay').style.visibility=(cur>=todayStr())?'hidden':'visible';
  const tb=document.getElementById('todayBtn');if(tb)tb.style.display=today?'none':'inline-flex';
  activeTypes=new Set(Object.keys((entry(cur).sessions)||{}).filter(k=>k!=='_ts'));
  renderBanners();renderMorning();renderDecision();
  if(typeof renderPauseBanner==='function')renderPauseBanner();
  /* GM7: renderAdaptCard/renderConfidence/renderTipEngine sind GM-fremde Legacy-Karten —
     Inhalte leben jetzt im Hero (changelog) bzw. im Readiness-&-Konfidenz-Modul. */
  (function(){try{['adaptBox','confBox','insights'].forEach(function(id){var el=document.getElementById(id);if(el){el.innerHTML='';el.style.display='none';}});}catch(_){ }})();
  if(typeof renderModules==='function')renderModules();
  if(typeof renderExtraCheckin==='function')renderExtraCheckin();
  if(window.ORVIA&&window.ORVIA.workoutUI&&window.ORVIA.workoutUI.renderEntry)window.ORVIA.workoutUI.renderEntry();
  renderTypeGrid();renderPostBlocks();renderRoutines();renderEve();bindReps();
  if(typeof renderNutritionToday==='function')renderNutritionToday();
  if(typeof gmApplyPhase3Visibility==='function')gmApplyPhase3Visibility();   /* Phase 3: kontextuelle Reaktivierung */
  if(typeof renderRaceModeToday==='function')renderRaceModeToday();
  if(typeof renderTopAvatar==='function')renderTopAvatar();
  if(typeof setTopTitle==='function'){var th=document.getElementById('tab-heute');if(th&&!th.classList.contains('hide'))setTopTitle('heute');}
  applyDayLock();}
/* ---- Vergangene Tage sichtbar sperren: Banner + Felder deaktivieren ----
   Datenschutz-Ebene liegt zusätzlich in canEditCur(); dies ist die UX-Ebene. */
function applyDayLock(){
  var host=document.getElementById('tab-heute');if(!host)return;
  var isPast=(cur<todayStr());
  var locked=(cur!==todayStr()&&!window._correctionMode);
  var old=document.getElementById('dayLockBanner');if(old)old.remove();
  if(isPast){
    var anchor=document.getElementById('morningForm');
    if(anchor&&anchor.parentNode){
      var b=document.createElement('div');b.id='dayLockBanner';b.className='banner '+(window._correctionMode?'warn':'info');
      b.innerHTML=window._correctionMode
        ?'<span>Korrektur-Modus: Änderungen an diesem abgeschlossenen Tag werden als Korrektur protokolliert. <button class="lexlink" onclick="endCorrection()">Fertig</button></span>'
        :'<span>Dieser Tag ist abgeschlossen und kann nicht mehr bearbeitet werden. <button class="lexlink" onclick="startCorrection()">Korrektur erfassen</button></span>';
      anchor.parentNode.insertBefore(b,anchor);
    }
  }
  host.querySelectorAll('input,textarea,select').forEach(function(el){
    if(el.closest&&el.closest('#dayLockBanner'))return;
    el.disabled=locked;
  });
  /* P1A-Fix: Chips/Stepper/Toggles sind BUTTONS — vorher blieben sie tappbar und
     änderten den sichtbaren Zustand, während autoMorning die Speicherung still
     verwarf (Vertrauensbruch). Gesperrt werden nur die Erfassungs-Formulare;
     Navigation/Korrektur-Buttons bleiben bedienbar. */
  ['morningForm','eveForm','extraCheckin','modules'].forEach(function(id){
    var f=document.getElementById(id);if(!f)return;
    if(f.classList){if(locked)f.classList.add('locked-form');else f.classList.remove('locked-form');}
    f.querySelectorAll&&f.querySelectorAll('button').forEach(function(b){
      if(b.closest&&b.closest('#dayLockBanner'))return;
      b.disabled=locked;
    });
  });
}
function shiftDay(n){flushAuto();const d=new Date(cur+'T12:00');d.setDate(d.getDate()+n);const k=todayStr(d);if(k>todayStr())return;window._correctionMode=false;cur=k;renderDay();window.scrollTo(0,0);}
function goToday(){flushAuto();window._correctionMode=false;cur=todayStr();renderDay();window.scrollTo(0,0);}

/* ============ PLAN ============ */
function cdHTML(){const d=daysTo(RACE.date);return `<div class="cd"><div><div class="num">${d}</div><div class="lab">Tage</div></div>
  <div><div style="font-weight:800;font-size:15px">${ic('flag')}${RACE.name}</div><div class="ph">${(()=>{try{return new Date(RACE.date+'T12:00').toLocaleDateString('de-DE');}catch(e){return RACE.date;}})()} · ${Calc.racePhase(d)}</div></div></div>`;}
/* ====== E1: Phasen bis zum Ziel (Plan) — v5-Phase-Track aus Calc.racePhases.
   KEINE eigene Phasen-/Periodisierungslogik: Namen, Zeiträume, Beschreibung und die aktuelle
   Phase (on) kommen 1:1 aus dem kanonischen Vertrag; done/upcoming ist reine Datums-Präsentation
   auf denselben Feldern. Ziel ausschließlich aus goalOf() (kanonische Prioritätsauswahl).
   uiDetailMode ändert nur Erklärtiefe. ====== */
function _phFmt(s){return s?new Date(s+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}):'offen';}
function _phState(p,t){if(p.on)return 'now';if(p.to&&t>p.to)return 'done';return 'upcoming';}
function renderPhases(){
  var box=document.getElementById('phaseBox');if(!box)return;
  var g=(typeof goalOf==='function')?goalOf():null;
  var rd=(g&&g.raceDate)||'';
  var phases=(typeof Calc!=='undefined'&&Calc.racePhases)?Calc.racePhases(rd,todayStr()):[];
  if(!phases.length){
    box.innerHTML='<div class="empty-card"><div class="empty-h">Phasen</div><p class="empty-p">Trainingsphasen erscheinen, sobald ein aktives Ziel ein Wettkampfdatum hat (Profil → Ziel).</p></div>';return;}
  var t=todayStr();var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var d=(typeof daysTo==='function')?daysTo(rd):null;
  var past=(d!=null&&d<0);
  var segs=phases.map(function(p){var st=past?(_phState(p,t)==='now'?'done':_phState(p,t)):_phState(p,t);
    return '<button type="button" class="phv5-seg is-'+st+'" data-ph="'+escH(p.n+'·'+(p.from||'')+'·'+(p.to||''))+'" data-state="'+st+'" onclick="openPhaseSheet(\''+escH(p.n)+'\')" aria-label="'+escH('Phase '+p.n+(st==='now'?', aktuell':st==='done'?', abgeschlossen':', kommend'))+'">'+
      '<b>'+escH(p.n)+'</b>'+(mode==='anfaenger'?'':'<span>'+escH((p.from?_phFmt(p.from)+'–':'bis ')+_phFmt(p.to))+'</span>')+'</button>';}).join('');
  var head='';
  if(past){head='<p class="note phv5-note" style="text-align:left">Das Zieldatum ('+escH(_phFmt(rd))+') liegt '+Math.abs(d)+' Tage zurück — kein aktiver Trainingsblock. Aktualisiere dein Ziel im Profil.</p>';}
  else if(d!=null){var now=null;for(var x=0;x<phases.length;x++)if(phases[x].on)now=phases[x];
    head='<p class="phv5-head">'+(now?('Aktuell: <b>'+escH(now.n)+'</b> · '):'')+escH(String(d))+' Tage bis zum Ziel ('+escH(_phFmt(rd))+')</p>';}
  var foot='';
  if(mode==='anfaenger')foot='<p class="note phv5-note" style="text-align:left">Dein Training läuft in Phasen auf das Ziel zu. Tippe eine Phase für Details.</p>';
  if(mode==='profi')foot='<p class="note phv5-note" style="text-align:left">Quelle: Calc.racePhases · Zieldatum aus dem aktiven Ziel (goalOf). Zeiträume kanonisch, keine UI-Berechnung.</p>';
  box.innerHTML=head+'<div class="phv5-track" role="group" aria-label="Trainingsphasen bis zum Ziel">'+segs+'</div>'+foot;}
function openPhaseSheet(name){
  var g=(typeof goalOf==='function')?goalOf():null;var rd=(g&&g.raceDate)||'';
  var phases=(typeof Calc!=='undefined'&&Calc.racePhases)?Calc.racePhases(rd,todayStr()):[];
  var p=null;for(var i=0;i<phases.length;i++)if(phases[i].n===name)p=phases[i];
  if(!p){if(typeof oModal==='function')oModal(name,'<p class="muted" style="margin:0">Für diese Phase liegen keine Daten vor.</p>');return;}
  var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var t=todayStr();var st=_phState(p,t);
  var stTxt=st==='now'?'Aktuelle Phase':st==='done'?'Abgeschlossen':'Kommend';
  var body='<div class="rcv-sh-v">'+escH(p.n)+'</div>'+
    '<p style="margin:8px 0 0">'+escH(p.d||'')+'</p>'+
    '<div class="rcv-sh-meta">Zeitraum: <b>'+escH((p.from?_phFmt(p.from)+' – ':'offen bis ')+_phFmt(p.to))+'</b> · Status: <b>'+escH(stTxt)+'</b></div>';
  if(mode==='profi'){body+='<div class="rcv-sh-meta">Quelle: Calc.racePhases · Zieldatum '+escH(rd||'–')+' ('+escH((g&&g.type)||'–')+')</div>';}
  body+='<p class="note" style="text-align:left;margin-top:10px">Phasenstruktur aus dem Wettkampfdatum — keine Wocheninhalte oder Prognosen.</p>';
  try{if(typeof _rcvLastFocus!=='undefined')_rcvLastFocus=document.activeElement;}catch(_){ }
  if(typeof oModal==='function')oModal('Phase · '+p.n,body);
  try{var sh=document.getElementById('suppSheet');if(sh){sh.setAttribute('tabindex','-1');sh.focus();}}catch(_){ }
}
/* ====== E1-ENDE ====== */
/* ====== E2: Laufumfang Woche (Plan/Ist) — v5-Karte, in place statt alter Rampe.
   Ziel NUR aus Calc.weekKmTarget + Calc.effectiveKmTarget (Ist-Kopplung), Ist NUR aus der
   kanonischen weekRunKm-Kette (weeklyActivityTotals: Mo-verankert, Nutzer-TZ, dedupliziert,
   missing ⇒ null statt 0). KEINE zweite Aggregation und KEINE Statusbewertung im UI —
   für Wochen-km existiert kanonisch nur Verhältnis + Deckelungs-Flag (dokumentierte Lücke;
   der Tages-/Sportarten-Erfüllungsvertrag – planStatus – wird hier bewusst NICHT zweckentfremdet).
   Gilt ausschließlich für LAUF-Kilometer. ====== */


function renderRamp(){
  var box=document.getElementById('rampBox');if(!box)return;
  var W=_wkVolData();
  var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  if(W.state==='unknown'){
    box.innerHTML='<div class="empty-card"><div class="empty-h">Laufumfang</div><p class="empty-p">Wochen-km aktuell nicht bestimmbar (Aktivitätsdaten nicht verf\u00fcgbar).</p></div>';return;}
  if(W.state==='no_target'){
    box.innerHTML='<div class="empty-card"><div class="empty-h">Laufumfang</div><p class="empty-p">Kein Wochenziel \u2014 das Renndatum fehlt oder liegt vorbei. Ziel im Profil aktualisieren.</p>'+
      (W.act!=null?'<p class="empty-p">Diese Woche gelaufen: <b>'+fmtDe(W.act)+' km</b></p>':'')+'</div>';return;}
  var barPct=Math.min(100,W.pct);
  var big=fmtDe(W.act)+' / '+W.eff+' km';
  var lead=mode==='anfaenger'
    ?'Du bist bei <b>'+fmtDe(W.act)+'</b> von <b>'+W.eff+'</b> Lauf-Kilometern diese Woche.'
    :(W.over?'<b>+'+fmtDe(Math.round((W.act-W.eff)*10)/10)+' km</b> \u00fcber dem Wochenziel \u2014 ehrlich gez\u00e4hlt, Balken gedeckelt.'
      :'Noch <b>'+fmtDe(W.rest)+' km</b> offen bis zum Wochenziel.');
  var head='<div class="wkv5-head"><span>Diese Woche \u00b7 Laufen</span><b class="wkv5-big" data-wk="'+_wkEsc(fmtDe(W.act)+'|'+W.eff+'|'+W.cal)+'">'+_wkEsc(big)+'</b></div>';
  var bar='<div class="wkv5-bar'+(W.over?' wkv5-over':'')+'" role="img" aria-label="'+_wkEsc(fmtDe(W.act)+' von '+W.eff+' Lauf-Kilometern')+'"><i style="width:'+barPct.toFixed(0)+'%"></i></div>';
  var notes='';
  if(mode!=='anfaenger'){
    if(W.deload)notes+='<p class="note wkv5-note">Kalenderziel w\u00e4re '+W.cal+' km \u2014 gedeckelt auf +10\u2009% \u00fcber deinem 3-Wochen-Maximum (Ist-Kopplung).</p>';
    var next='';for(var i2=1;i2<=3;i2++){var t2=Calc.weekKmTarget(W.d,i2);if(t2<=0)break;
      next+='<div class="wkv5-next"><span>In '+i2+' Woche'+(i2>1?'n':'')+'</span><b>~'+t2+' km'+(Calc.weekKmTarget(W.d,i2)<Calc.weekKmTarget(W.d,i2-1)&&i2<3?' \u00b7 Entlastung':'')+'</b></div>';}
    if(next)notes+='<div class="wkv5-nextwrap">'+next+'</div>';
  }
  if(mode==='profi')notes+='<p class="note wkv5-note">Zeitraum: '+_wkEsc(_wkVolRange())+' (lokale Zeitzone) \u00b7 Quelle: kanonische Wochenaggregation (dedupliziert, nur abgeschlossene Lauf-Einheiten) \u00b7 Ziel: weekKmTarget mit Ist-Kopplung.</p>';
  box.innerHTML='<button type="button" class="wkv5-tap" onclick="openWeekVolumeSheet()" aria-label="Laufumfang-Details \u00f6ffnen">'+head+bar+'<p class="wkv5-lead">'+lead+'</p></button>'+notes;
}
function openWeekVolumeSheet(){
  var W=_wkVolData();
  if(W.state!=='ok'){if(typeof oModal==='function')oModal('Laufumfang','<p class="muted" style="margin:0">'+(W.state==='unknown'?'Wochen-km aktuell nicht bestimmbar.':'Kein aktives Wochenziel.')+'</p>');return;}
  var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var body='<div class="rcv-sh-v" data-wk="'+_wkEsc(fmtDe(W.act)+'|'+W.eff)+'">'+_wkEsc(fmtDe(W.act)+' / '+W.eff+' km')+'</div>'+
    '<p style="margin:8px 0 0">Lauf-Kilometer dieser Woche (Mo\u2013So) gegen dein effektives Wochenziel.</p>'+
    '<div class="rcv-sh-meta">'+(W.over?'\u00dcber dem Ziel: <b>+'+fmtDe(Math.round((W.act-W.eff)*10)/10)+' km</b>':'Offen: <b>'+fmtDe(W.rest)+' km</b>')+
    (W.deload?' \u00b7 Kalenderziel '+W.cal+' km, gedeckelt (Ist-Kopplung)':'')+'</div>';
  if(mode==='profi')body+='<div class="rcv-sh-meta">Zeitraum: '+_wkEsc(_wkVolRange())+' \u00b7 Nur Laufen \u00b7 kanonische Aggregation (dedupliziert, Nutzer-Zeitzone).</div>';
  body+='<p class="note" style="text-align:left;margin-top:10px">Richtwerte mit Entlastungswochen \u2014 bei Warnsignalen hat Erholung Vorrang.</p>';
  try{if(typeof _rcvLastFocus!=='undefined')_rcvLastFocus=document.activeElement;}catch(_){ }
  if(typeof oModal==='function')oModal('Laufumfang \u00b7 Woche',body);
  try{var sh=document.getElementById('suppSheet');if(sh){sh.setAttribute('tabindex','-1');sh.focus();}}catch(_){ }
}
/* Helfer NACH renderRamp (Function-Hoisting): so liegt alles im Quelltext-Slice
   des bestehenden Vertragstests engine_i2b (renderRamp → recommendedRunVolume). */
function _wkVolData(){
  var d=daysTo(RACE.date);
  var act=weekRunKm(0),w1=weekRunKm(1),w2=weekRunKm(2),w3=weekRunKm(3);
  if(act==null||w1==null||w2==null||w3==null)return {state:'unknown'};
  var cal=Calc.weekKmTarget(d,0);
  if(!(cal>0))return {state:'no_target',act:act};
  var eff=Calc.effectiveKmTarget(cal,[w1,w2,w3]);
  if(!(eff>0))return {state:'no_target',act:act};
  return {state:'ok',act:act,cal:cal,eff:eff,deload:eff<cal,over:act>eff,
    pct:act/eff*100,rest:Math.max(0,Math.round((eff-act)*10)/10),d:d};
}
function _wkVolRange(){
  var anc=new Date(todayStr()+'T12:00:00');var day=(anc.getDay()+6)%7;
  var mon=new Date(anc);mon.setDate(anc.getDate()-day);
  var sun=new Date(mon.getTime());sun.setDate(mon.getDate()+6);
  var f=function(dt){return dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});};
  return 'Mo '+f(mon)+' \u2013 So '+f(sun);
}
function _wkEsc(x){return (typeof escH==='function')?escH(x):String(x==null?'':x);}
/* ====== E2-ENDE ====== */
/* Profil-/historienbasiertes Lauf-Volumen (Phase-2-Engine) für den aktiven Nutzer. */
function recommendedRunVolume(){
  var prof=(typeof PROFILE!=='undefined'&&PROFILE)?PROFILE:{};
  var hist=(typeof runsWindow==='function')?runsWindow(28):[];
  // Wenig echte Historie → Onboarding-Angaben (typische Distanz × Läufe/Woche) als Seed nutzen.
  if(hist.filter(function(r){return r&&r.dist>0;}).length<3 && prof.typicalRunKm){
    var n=Math.max(1,Math.round((prof.recentRunsPerWeek||1)*4));
    hist=[];for(var s=0;s<n;s++)hist.push({dist:prof.typicalRunKm,sub:'Easy Z2'});
    if(prof.longestRunKm&&prof.longestRunKm>prof.typicalRunKm)hist.push({dist:prof.longestRunKm,sub:'Long Run'});
  }
  var m=((typeof DB!=='undefined'&&DB[todayStr()])||{}).morning||{};
  var rd={knee:(m.knee!=null?m.knee:0)};
  try{var rs=[];for(var i=0;i<7;i++){var s=(typeof readinessOf==='function')?readinessOf(dkey(-i)):null;if(s!=null)rs.push(s);}rd.avgReady=Calc.avg(rs);}catch(e){}
  return Calc.calculateRecommendedWeeklyRunVolume(prof,hist,rd);
}
function lrKm(wk){
  // Nur echtes Lauf-Distanzziel mit Renndatum → Runna-Long-Run-Progression.
  if(typeof isRunDistanceGoal==='function'&&isRunDistanceGoal()&&goalOf().raceDate){
    if(wk>=25)return null; if(wk>=22)return [12,10,8][wk-22]; return Math.max(7,Math.min(20,wk-2));
  }
  // Sonst: profil-/historienbasiertes Long-Run-Limit (Anfänger konservativ).
  try{var v=recommendedRunVolume();return v.longRunKm||null;}catch(e){return null;}
}
/* E1: sichtbarer Rebuild-Pfad — Konfig geändert + Entscheidung „später" ⇒ Banner. */
function orviaRebuildPlan(){if(typeof PROFILE==='undefined'||!PROFILE)return;
  PROFILE.weekPlan=null;PROFILE._planUndo=null;
  PROFILE.planImpact=Object.assign({},PROFILE.planImpact||{},{pending:false,userDecision:'rebuilt',updatedAt:new Date().toISOString()});
  if(typeof saveProfile==='function')saveProfile();
  if(typeof renderPlan==='function')renderPlan();
  if(typeof toast==='function')toast('Plan neu aufgebaut ✓');}
/* ====== E4: Wochenliste (v5-Session-Cards) — Sessions, Reihenfolge, Status und
   Prioritäten unverändert aus den bestehenden kanonischen Quellen; reine Darstellung. ====== */
function renderWeekPlan(){
  try{if(typeof gmRenderAdaptiveCard==='function')gmRenderAdaptiveCard();}catch(_e){}
  const off=window._planWeekOff||0;
  // E1: ausstehende Plan-Neuberechnung sichtbar machen (statt stillem Alt-Plan).
  try{var _pb=document.getElementById('planRebuildBanner');
    if(!_pb){var _wpEl=document.getElementById('weekPlanBox')||document.getElementById('weekPlan');
      if(_wpEl&&_wpEl.parentNode){_pb=document.createElement('div');_pb.id='planRebuildBanner';_wpEl.parentNode.insertBefore(_pb,_wpEl);}}
    if(_pb){var _pend=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weekPlan&&PROFILE.planImpact&&PROFILE.planImpact.pending);
      _pb.innerHTML=_pend?'<div class="banner warn"><span><b>Deine Konfiguration hat sich geändert.</b> Der angezeigte Plan basiert noch auf dem alten Stand.</span><button onclick="orviaRebuildPlan()">Plan neu aufbauen</button></div>':'';}}catch(e){}
  const goal=buildGoal();
  const isRunna=(typeof isRunDistanceGoal==='function'&&isRunDistanceGoal()&&goalOf().raceDate);
  const baseWeek=isRunna?Calc.runnaWeek(daysTo(RACE.date)):1;
  const wk=Math.max(1,Math.min(25,baseWeek+off));
  const _rs=document.getElementById('runnaSub');if(_rs)_rs.textContent=isRunna
    ?('ORVIA-Laufplan · Woche '+wk+'/25 — wird automatisch abgehakt, sobald du loggst.')
    :'Dein Wochenplan — passt sich an Ziel, Trainingstage und Verlauf an.';
  const now=new Date();const day=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-day+off*7);
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  // Konkrete Pace-Zahlen nur bei HM (dort ist die Riegel-/HM_KM-Mathematik gültig).
  // Sonst Anstrengungs-Cues statt falscher HM-Paces.
  var pd;
  if(gcat(goalOf().type)==='half_marathon'){
    const ref=(goal.state!=='nodata'?goal.tPred:goalTargetMin());const rp=ref*60/Calc.HM_KM;
    pd={iv:fmtPace(rp*0.90)+'–'+fmtPace(rp*0.94)+' /km',ez:fmtPace(rp*1.18)+'–'+fmtPace(rp*1.30)+' /km',lr:fmtPace(rp*1.10)+'–'+fmtPace(rp*1.18)+' /km'};
  }else{
    pd={iv:'zügig, kontrolliert',ez:'locker · Z2 (Gespräch möglich)',lr:'gleichmäßig locker'};
  }
  const lk=lrKm(wk);
  // I3 Part B: Plan-Ist-Auflösung der angezeigten Woche über den kanonischen Resolver (SSOT).
  var _paByOcc={};try{var _paDates=[];for(var _pi=0;_pi<7;_pi++){var _pdd=new Date(mon);_pdd.setDate(mon.getDate()+_pi);_paDates.push(todayStr(_pdd));}if(typeof planActualResolveForDates==='function'&&typeof Calc!=='undefined'&&Calc.resolvePlanActual){_paByOcc=(planActualResolveForDates(_paDates)||{}).byOcc||{};}}catch(_paE){_paByOcc={};}
  const mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  let html='';for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const k=todayStr(d);const e=DB[k];const isToday=k===todayStr();
    // Datumsgebundene Tagesinstanz (adaptive Ersatz-Einheit) NUR am echten Datum überlagern.
    const dayInstance=(e&&e._adaptItem&&e._adaptItem.dayIndex===i)?e._adaptItem.item:null;
    const renderItems=dayInstance?[dayInstance]:activeWeekPlan()[i];
    const items=renderItems.length?renderItems.map((it,idx)=>{const det=pd[it.d]||it.d;var _occId=(it&&it.id)?('po:'+k+':'+it.id):null;var _paR=(_occId&&_paByOcc[_occId])?_paByOcc[_occId]:null;var _isDone=(_paR&&_paR.state==='completed'); // I3b.1 fail-closed: kein Rückfall auf Tag+Sport-done
      let lbl=it.l; if(it.l==='Long Run'&&lk)lbl='Long Run · '+lk+' km';
      const pri=(typeof unitPriority==='function')?unitPriority(it):'';
      // „angepasst“-Badge NUR für die echte Tagesinstanz — nie aus der wiederkehrenden Struktur.
      const isAdapt=!!dayInstance&&!!it.adaptiveReplacement;
      const adaptBadge=isAdapt?'<span class="pl-adapt">angepasst</span> ':'';
      // Anfänger: Titel + wichtigste vorhandene Angabe; Fortgeschritten/Profi: + Sportart + Prioritätsbadge.
      const sub=(mode==='anfaenger')?(det?esc(det):''):(esc(it.t)+(det?' · '+esc(det):''));
      return `<button type="button" class="sess5${isAdapt?' sess5-adapt':''}${_isDone?' done':''}" data-sid="${esc(it.id||'')}" data-done="${_isDone?'1':'0'}" onclick="try{_pqLastFocus=this}catch(e){};planEntryClick(${i},${idx},'${k}')"><span class="sess5-ico">${(TYPES[it.t]||TYPES.Mobilität).ic}</span><span class="sess5-main"><b>${adaptBadge}${esc(lbl)}</b>${sub?'<p>'+sub+'</p>':''}</span>${(pri&&mode!=='anfaenger')?'<span class="sess5-pri ppri-'+pri+'">'+pri+'</span>':''}<span class="sess5-state${_isDone?' done':''}">${_isDone?'✓ Erledigt':'›'}</span></button>`;
    }).join('')
    :(function(){var _s5=(typeof gmDayStateFor==='function')?gmDayStateFor(i,(function(){try{return (window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)?ORVIA.profileModel.effectiveTrainingConfig(typeof PROFILE!=='undefined'?PROFILE:null):null;}catch(_){return null;}})()):'rest';
      return _s5==='rest'?'<div class="sess5-rest"><span aria-hidden="true">☾</span> Ruhetag</div>'
        :_s5==='unavailable'?'<div class="sess5-rest"><span aria-hidden="true">–</span> Nicht verfügbar</div>'
        :'<div class="sess5-rest"><span aria-hidden="true">·</span> Frei</div>';})();
    const pz=(typeof pauseFor==='function')?pauseFor(k):null;
    html+=`<div class="pday${isToday?' today':''}${pz?' paused':''}"><div class="pd">${DAYNAMES[i]} ${d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}${isToday?' · HEUTE':''}${pz?' <span class="pd-pause">'+esc(pz.reason||'Pause')+'</span>':''}</div>${items}</div>`;}
  const fmt=function(dt){return dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});};
  const nav='<div class="pweek-nav"><button class="pwk-arw" onclick="shiftPlanWeek(-1)"'+(isRunna&&wk<=1?' disabled':'')+' aria-label="vorige Woche">‹</button>'+
    '<div class="pwk-mid"><span class="pwk-w">'+(isRunna?('Woche '+wk+' / 25'):'Woche')+'</span><span class="pwk-r">'+fmt(mon)+'–'+fmt(sun)+'</span></div>'+
    '<button class="pwk-arw" onclick="shiftPlanWeek(1)"'+(isRunna&&wk>=25?' disabled':'')+' aria-label="nächste Woche">›</button></div>'+
    (off!==0?'<button class="pwk-today" onclick="planWeekToday()">↑ Zur aktuellen Woche</button>':'');
  const meta=(mode==='profi')?'<p class="sess5-meta">Quelle: Wochenplan (Profil/Generator) · Erledigt-Abgleich: kanonischer Plan-Ist-Resolver (fail-closed) · Prioritäten A/B/C aus dem bestehenden Einheiten-Helfer.</p>':'';
  document.getElementById('weekPlanBox').innerHTML=nav+html+meta;
  /* Escape/Rückfokus: Wiederverwendung des vorhandenen Sheet-Vertrags — GLEICHER Guard wie E3,
     dadurch maximal EIN globaler Handler. Zentrales Modal-Cleanup in oModal: spätere Aufgabe. */
  try{if(typeof window!=='undefined'&&!window._pqEscBound){window._pqEscBound=1;
    document.addEventListener('keydown',function(ev){
      if(ev.key!=='Escape')return;
      var m=document.getElementById('suppModal');
      if(m&&m.classList&&m.classList.contains&&m.classList.contains('show')){
        if(typeof closeSupp==='function')closeSupp();
        try{if(typeof _pqLastFocus!=='undefined'&&_pqLastFocus&&_pqLastFocus.focus)_pqLastFocus.focus();}catch(_){ }
      }});}}catch(_){ }
}
function shiftPlanWeek(d){window._planWeekOff=(window._planWeekOff||0)+d;renderWeekPlan();}
function planWeekToday(){window._planWeekOff=0;renderWeekPlan();}
/* ====== E4-ENDE ====== */
/* ---- Einheitenpriorität A/B/C + Plan-Varianten + Planqualität ---- */
function unitPriority(item){
  var k=unitKind(item),l=(item.l||'').toLowerCase();
  if(item.t==='Laufen'){if(k==='long'||k==='interval'||k==='tempo')return 'A';return 'B';}
  if(item.t==='Rad'){if(/long|interval/.test(l)||k==='interval')return 'A';if(/recovery/.test(l))return 'C';return 'B';}
  if(item.t==='Schwimmen')return 'B';
  if(item.t==='Gym'){if(/core|mobil/.test(l))return 'C';return 'B';}
  return 'C';
}
function isHardUnit(it){var k=unitKind(it);return (it.t==='Laufen'&&(k==='interval'||k==='tempo'||k==='long'))||(it.t==='Rad'&&/interval|long/i.test(it.l||''));}
function planVariants(){
  var w=activeWeekPlan();var all=[],A=[],AB=[];
  w.forEach(function(day,di){day.forEach(function(it){var pri=unitPriority(it);all.push(it);if(pri==='A')A.push({it:it,di:di});if(pri==='A'||pri==='B')AB.push(it);});});
  return {all:all,A:A,AB:AB};
}
function renderPlanVariants(){
  var el=document.getElementById('planVariantsBox');if(!el)return;
  var v=planVariants();var dn=['Mo','Di','Mi','Do','Fr','Sa','So'];
  var aList=v.A.map(function(x){return dn[x.di]+' '+x.it.l;}).join(', ')||'—';
  el.innerHTML='<div class="pv-grid">'+
    '<div class="pv"><span class="pv-h">Ideal</span><b>'+v.all.length+'</b><span class="pv-s">alle Einheiten</span></div>'+
    '<div class="pv"><span class="pv-h">Realistisch</span><b>'+v.AB.length+'</b><span class="pv-s">A + B</span></div>'+
    '<div class="pv"><span class="pv-h">Notfall</span><b>'+v.A.length+'</b><span class="pv-s">nur A</span></div></div>'+
    '<div class="pv-must"><b>Pflicht (A):</b> '+esc(aList)+'</div>'+
    '<p class="note" style="text-align:left;margin-top:8px">Wenig Zeit oder Recovery? Zuerst C streichen, dann B — die A-Einheiten halten Fortschritt und Routine.</p>';
}
function planQualityChecks(){
  var warns=[];var g=(typeof goalOf==='function')?goalOf():{};var lvl=(typeof userLevel==='function')?userLevel():'fortgeschritten';
  var w=activeWeekPlan();var sessDays=0;
  w.forEach(function(day){if(day.length)sessDays++;});
  var restDays=7-sessDays;
  if(restDays===0)warns.push(['Kein fester Ruhetag','Plane mindestens 1 Ruhetag/Woche ein — Anpassung passiert in der Erholung.']);
  if(lvl==='anfaenger'&&sessDays>=6)warns.push(['Viele Trainingstage für Anfänger','Reduziere auf 3–4 Tage, bis Konsistenz und Belastbarkeit stehen.']);
  var bb=false;for(var i=0;i<7;i++){if((w[i]||[]).some(isHardUnit)&&(w[(i+1)%7]||[]).some(isHardUnit))bb=true;}
  if(bb)warns.push(['Harte Tage direkt hintereinander','Zwischen zwei harte Einheiten einen leichten Tag oder Ruhetag legen.']);
  var dRace=g.raceDate?daysTo(g.raceDate):null;
  if(g.type==='marathon'&&lvl==='anfaenger'&&dRace!=null&&dRace<84)warns.push(['Marathon-Ziel sehr ambitioniert','Als Anfänger braucht ein Marathon i. d. R. 4–6 Monate Aufbau — Zwischenziel (10 km/HM) erwägen.']);
  if(gcat(g.type)==='half_marathon'&&lvl==='anfaenger'&&dRace!=null&&dRace<42)warns.push(['HM-Ziel knapp für Anfänger','Unter 6 Wochen ist riskant — Umfang vorsichtig steigern oder Datum schieben.']);
  var e=DB[todayStr()];var knee=(e&&e.morning&&e.morning.knee!=null)?e.morning.knee:0;
  var u=(typeof todayPrimaryUnit==='function')?todayPrimaryUnit():null;
  if(knee>=4&&u&&isHardUnit(u))warns.push(['Knie '+knee+'/10 und harte Einheit geplant','Heute ersetzen (Easy/Bike) — siehe Tagesanpassung auf „Heute".']);
  var rating=warns.length===0?{l:'gut',c:'g'}:warns.length<=2?{l:'moderat',c:'y'}:{l:'riskant',c:'r'};
  return {rating:rating,warns:warns};
}
/* ====== E3: Planqualität (v5) — Darstellung ausschließlich aus planQualityChecks();
   Status & Warnungen verbatim übernommen, keine eigene Bewertung, keine Planänderung. ====== */
function renderPlanQuality(){
  var el=document.getElementById('planQualityBox');if(!el)return;
  var q=planQualityChecks();var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var n=q.warns.length;
  var head='<button type="button" class="pqv5-head" data-pq-rating="'+_pqEsc(q.rating.c)+'" data-pq-warns="'+n+'" onclick="openPlanQualitySheet()" aria-haspopup="dialog" aria-label="Planqualität-Details öffnen">'+_pqChip(q.rating)+'<span class="pqv5-more">Details ›</span></button>';
  var lead=n===0
    ?'<p class="pqv5-lead">'+(mode==='anfaenger'?'Keine Auffälligkeiten — dein Wochenplan ist ausgewogen aufgebaut.':'Keine Auffälligkeiten in den Planprüfungen.')+'</p>'
    :'<p class="pqv5-lead">'+n+(n===1?' Auffälligkeit':' Auffälligkeiten')+(mode==='anfaenger'?' — die Hinweise zeigen dir direkt, was du ändern kannst.':' in den Planprüfungen.')+'</p>';
  var meta=mode==='profi'?'<p class="pqv5-meta">Datenbasis: Wochenplanstruktur, Zielkonfiguration, Level, heutiges Check-in · Status und Hinweise unverändert aus der ORVIA-Planprüfung.</p>':'';
  el.innerHTML=head+lead+_pqWarnList(q)+meta;
}
function openPlanQualitySheet(){
  var q=planQualityChecks();var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var body='<div class="rcv-sh-v" data-pq-rating="'+_pqEsc(q.rating.c)+'" data-pq-warns="'+q.warns.length+'">'+_pqChip(q.rating)+'</div>'+
    (q.warns.length?_pqWarnList(q):'<p style="margin:8px 0 0">Keine Auffälligkeiten in den Planprüfungen.</p>')+
    '<div class="rcv-sh-meta">Bewertung und Hinweise stammen unverändert aus der ORVIA-Planprüfung — hier wird nichts automatisch am Plan geändert.</div>';
  if(mode==='profi')body+='<div class="rcv-sh-meta">Datenbasis: Wochenplanstruktur, Zielkonfiguration, Level, heutiges Check-in.</div>';
  try{_pqLastFocus=document.activeElement;if(typeof _rcvLastFocus!=='undefined')_rcvLastFocus=document.activeElement;}catch(_){ }
  if(typeof oModal==='function')oModal('Planqualität & Sicherheit',body);
  try{var sh=document.getElementById('suppSheet');if(sh){sh.setAttribute('tabindex','-1');sh.focus();}}catch(_){ }
  /* A11y: Escape schließt, Rückfokus zum Auslöser — idempotent, unabhängig davon,
     ob ein anderes Sheet die globale Bindung schon gesetzt hat. */
  try{if(typeof window!=='undefined'&&!window._pqEscBound){window._pqEscBound=1;
    document.addEventListener('keydown',function(ev){
      if(ev.key!=='Escape')return;
      var m=document.getElementById('suppModal');
      if(m&&m.classList&&m.classList.contains&&m.classList.contains('show')){
        if(typeof closeSupp==='function')closeSupp();
        try{if(_pqLastFocus&&_pqLastFocus.focus)_pqLastFocus.focus();}catch(_){ }
      }});}}catch(_){ }
}
var _pqLastFocus=null;
/* Helfer nach den Nutzern (Function-Hoisting) — der Block bleibt als Ganzes evaluierbar. */
function _pqEsc(x){return (typeof escH==='function')?escH(x):String(x==null?'':x);}
function _pqChip(r){var sym=r.c==='g'?'✓':r.c==='y'?'▲':'‼';return '<span class="pqv5-chip pq-'+_pqEsc(r.c)+'"><span class="pqv5-sym" aria-hidden="true">'+sym+'</span>'+_pqEsc(r.l)+'</span>';}
function _pqWarnList(q){if(!q.warns.length)return '';return '<div class="pqv5-list">'+q.warns.map(function(x){return '<div class="pqv5-w"><span class="pqv5-wsym" aria-hidden="true">▲</span><div class="pqv5-wt"><b>'+_pqEsc(x[0])+'</b><span>'+_pqEsc(x[1])+'</span></div></div>';}).join('')+'</div>';}
/* ====== E3-ENDE ====== */
/* ---- Wochenplan-Editor ---- */
/* ============================================================
   v8-323 (K2) · Kraftplanung sichtbar und bearbeitbar
   ------------------------------------------------------------
   BEFUND bis hierher: Der Datenvertrag (strength-plan@1) trug seit v8-321
   Uebungen, Saetze, Wiederholungen und Zielgewicht; v8-322 hat die
   Schreibpfade und die Uebernahme beim Sessionstart angeschlossen. Sichtbar
   war davon NICHTS: renderGMPlan las `plannedExercises` nicht, und
   summarizePlanned() hatte keinen Aufrufer. Es gab auch keinen Weg, Vorgaben
   ueberhaupt anzulegen — der Editor kopierte beim Hinzufuegen nur {t,l,d}.

   Die Uebungsnamen liegen in der DB-Tabelle `exercises`; der Wochenplan
   rendert aber SYNCHRON. Deshalb ein kleiner Namens-Cache: einmal laden,
   in localStorage spiegeln (damit die erste Darstellung nach einem Neustart
   und offline traegt), danach synchron nachschlagen. Ein unbekannter
   Schluessel wird NIEMALS geraten — er wird als unbekannt ausgewiesen.
   ============================================================ */
var _gmExLib=null,_gmExLibLoading=false;
/* v8-351 — FORMATVERSION DES ZWISCHENSPEICHERS.
   Bis v8-350 hielt der Spiegel je Uebung nur {name, slug}. Das
   Bewegungsmuster fehlte, obwohl `select('*')` es laengst mitliefert — und
   an ihm haengen 45 der 78 Systemuebungen bei der Muskelzuordnung
   (gemessen: 33 % statt 91 %, siehe tools/messung-zuordnungsquote.mjs).

   Ein alter Eintrag OHNE Muster darf jetzt nicht als „diese Uebung hat kein
   Muster" gelesen werden — sonst bliebe die Quote nach dem Update genau so
   niedrig und niemand saehe den Grund. Deshalb traegt der Spiegel eine
   Formatversion: passt sie nicht, wird er verworfen und neu geholt.
   Verworfen, nicht repariert — geraten wird auch hier nichts. */
var GM_EXLIB_FORMAT=2;
function gmExLibKey(){try{return 'orvia_exlib_'+((window.ORVIA&&ORVIA.user&&ORVIA.user.id)||'x');}catch(_){return 'orvia_exlib_x';}}
function gmExLibLoadLocal(){
  if(_gmExLib)return _gmExLib;
  try{
    var raw=localStorage.getItem(gmExLibKey());
    if(raw){
      var o=JSON.parse(raw);
      /* Format 1 war ein nacktes {id:{name,slug}} ohne Huelle. Es wird nicht
         gelesen, sondern verworfen: eine halbe Bibliothek ist schlimmer als
         keine, weil sie wie eine vollstaendige aussieht. */
      if(o&&typeof o==='object'&&o.format===GM_EXLIB_FORMAT&&o.map&&typeof o.map==='object'){_gmExLib=o.map;return _gmExLib;}
    }
  }catch(_){ }
  return null;
}
/* Laedt die kanonische Bibliothek EINMAL und ruft danach cb(). Ohne Netz
   passiert nichts Schlimmes: der Spiegel aus localStorage bleibt gueltig,
   und fehlt auch der, zeigt die Oberflaeche „unbekannte Uebung" statt eines
   erfundenen Namens. */
function gmExLibEnsure(cb){
  if(_gmExLib){if(cb)cb(_gmExLib);return;}
  if(gmExLibLoadLocal()&&cb)cb(_gmExLib);
  if(_gmExLibLoading)return;
  _gmExLibLoading=true;
  try{
    if(!(window.ORVIA&&ORVIA.repos&&ORVIA.repos.exercise)){_gmExLibLoading=false;return;}
    ORVIA.repos.exercise.list().then(function(r){
      _gmExLibLoading=false;
      if(!r||!r.success||!r.data)return;
      /* `movementPattern` kommt aus derselben Antwort (select('*')) und wird
         seit v8-351 mitgespeichert — ohne ihn kann die Muskelzuordnung 45
         der 78 Systemuebungen nicht aufloesen. */
      var map={};for(var i=0;i<r.data.length;i++){var e=r.data[i];if(e&&e.id)map[e.id]={name:e.name||null,slug:e.slug||null,movementPattern:e.movement_pattern||null};}
      _gmExLib=map;
      try{localStorage.setItem(gmExLibKey(),JSON.stringify({format:GM_EXLIB_FORMAT,map:map}));}catch(_){ }
      if(cb)cb(_gmExLib);
    }).catch(function(){_gmExLibLoading=false;});
  }catch(_){_gmExLibLoading=false;}
}
/* Synchroner Nachschlag. null = nicht aufloesbar (die Oberflaeche macht das
   sichtbar, sie erfindet nichts). */
function gmExName(id){
  var lib=_gmExLib||gmExLibLoadLocal();
  if(!lib||!id)return null;
  var e=lib[id];
  return (e&&e.name)?e.name:null;
}
/* v8-351 — die aufgeloeste Uebung, wie `gym-volume.musclesFor` sie braucht.
   Eine geplante Uebung fuehrt laut `strength-plan@1` NUR `exerciseId` — eine
   Datenbankkennung. Damit findet die Muskelzuordnung nichts: sie sucht nach
   Name, Slug oder Bewegungsmuster. Diese Funktion setzt zusammen, was die
   Bibliothek dazu weiss, und gibt null zurueck, wenn sie nichts weiss.

   Ausdruecklich KEIN Rueckfall auf die Kennung als Name: aus einer UUID
   einen Uebungsnamen zu machen hiesse, eine Zuordnung zu erfinden. */
function gmExAufgeloest(id){
  var lib=_gmExLib||gmExLibLoadLocal();
  if(!lib||!id)return null;
  var e=lib[id];
  if(!e)return null;
  return { exerciseId:id, name:e.name||null, slug:e.slug||null, movementPattern:e.movementPattern||null };
}
/* Zeilen fuer die Wochenplan-Karte. Liefert [] wenn nichts geplant ist —
   Altbestand ohne Vorgaben bleibt damit unveraendert. */
function gmPlannedLines(item){
  try{
    var SP=window.ORVIA&&ORVIA.strengthPlan;if(!SP)return [];
    var list=SP.readPlanned(item);if(!list.length)return [];
    var out=[];
    for(var i=0;i<list.length;i++){
      var nm=gmExName(list[i].exerciseId);
      out.push({resolved:!!nm,text:SP.summarizeExercise(list[i],function(){return nm;})});
    }
    return out;
  }catch(_){return [];}
}
var _gmExLibRerender=false;
function gmPlannedLinesHTML(item){
  var lines=gmPlannedLines(item);
  if(!lines.length)return '';
  /* Namen noch nicht da? Genau EINMAL nachladen und danach neu zeichnen —
     der Wochenplan rendert synchron, die Bibliothek kommt asynchron. */
  if(!(_gmExLib||gmExLibLoadLocal())&&!_gmExLibRerender){
    _gmExLibRerender=true;
    gmExLibEnsure(function(){try{if(typeof renderPlan==='function')renderPlan();}catch(_){ }});
  }
  var html='<ul class="sc-plex">';
  for(var i=0;i<lines.length;i++){
    html+='<li'+(lines[i].resolved?'':' class="sc-plex-unknown" title="Diese Übung steht nicht in der Bibliothek — die Kennung wird unverändert angezeigt."')+'>'+
      (lines[i].resolved?'':'⚠ ')+gmEsc(lines[i].text)+'</li>';
  }
  return html+'</ul>'+gmMuskelHinweisHTML(item);
}

/* v8-351 — DER PRUEFBEFUND AN DER SELBST GEPLANTEN EINHEIT.
   Eine Krafteinheit, die der Nutzer selbst zusammengestellt hat, hat KEINE
   Verordnung (`item.rx` ist leer) — es gibt also nichts, woran der
   Hinweisweg aus v8-349 haengen koennte. Genau hier ist die Regel aber
   anwendbar: die Uebungen stehen fest, und damit auch die Saetze je
   Muskelgruppe.

   Gerechnet wird mit DEMSELBEN Pruefer wie in der Verordnung
   (`prescriptionFactory.muskelHinweise`) und dargestellt mit DEMSELBEN
   Formatierer. Ein zweiter Pruefer hier waere die naechste Stelle, an der
   zwei Wahrheiten auseinanderlaufen.

   Fail-closed an jeder Stelle: fehlt ein Modul, fehlt das Wissen, fehlt die
   Uebungsbibliothek — dann steht hier NICHTS. Kein Ersatztext, keine
   Schaetzung, kein „ungefaehr". */
function gmMuskelHinweisHTML(item){
  try{
    var O=window.ORVIA||{};
    var SP=O.strengthPlan, PF=O.prescriptionFactory, FMT=O.prescriptionFormat, KC=O.knowledgeConsumer;
    if(!SP||!PF||!FMT||!KC)return '';
    if(typeof PF.muskelHinweise!=='function')return '';
    var list=SP.readPlanned(item);
    if(!list||!list.length)return '';
    /* Die geplante Uebung fuehrt nur eine Kennung. Ohne aufgeloeste
       Bibliothek gibt es keine Muskelzuordnung — und dann sagen wir nichts,
       statt die Haelfte zu zaehlen und es Summe zu nennen. */
    var aufgeloest=[],offen=0;
    for(var i=0;i<list.length;i++){
      var a=gmExAufgeloest(list[i].exerciseId);
      if(!a){offen++;continue;}
      a.sets=list[i].sets;
      aufgeloest.push(a);
    }
    if(!aufgeloest.length)return '';
    var wissen=KC.wissenFuer('gym');
    if(!wissen||wissen.ok!==true)return '';
    var h=PF.muskelHinweise(aufgeloest,wissen);
    if(!h||!h.length)return '';
    /* Uebungen, die die Bibliothek gar nicht kennt, gehoeren in denselben
       Vermerk wie die nicht zuordenbaren — fuer den Nutzer ist es dieselbe
       Frage: was ist hier nicht mitgezaehlt worden? */
    if(offen>0){
      h[0].nichtGezaehlt=(h[0].nichtGezaehlt||[]).concat([{name:offen+' Übung(en) ohne Bibliothekseintrag'}]);
    }
    var z=FMT.hinweisZeilen(h);
    if(!z||!z.length)return '';
    var html='<ul class="sc-plex sc-rx-hint">';
    for(var j=0;j<z.length;j++){
      html+='<li><span class="sc-hint-text">'+gmEsc(z[j].text)+'</span>';
      if(z[j].herkunft||z[j].regelId){
        html+='<span class="sc-hint-src">'+gmEsc([z[j].herkunft,z[j].regelId].filter(Boolean).join(' · '))+'</span>';
      }
      var zu=z[j].zusatz||[];
      for(var k=0;k<zu.length;k++)html+='<span class="sc-hint-note">'+gmEsc(zu[k])+'</span>';
      html+='</li>';
    }
    return html+'</ul>';
  }catch(_){return '';}
}

/* v8-332b — Die Ausdauer-Vorgabe AUF der Wochenkarte.
   Gegenstueck zu gmPlannedLinesHTML: dort die selbst geplanten Kraftuebungen,
   hier die von der Engine berechnete Verordnung (`item.rx`).

   Ohne `rx` liefert die Funktion '' — Altbestand und Legacy-Einheiten sehen
   Zeichen fuer Zeichen aus wie vorher, es entsteht kein leerer Kasten.

   Formatiert wird AUSSCHLIESSLICH ueber prescription-format. Waere hier eine
   zweite Formatierung, gaebe es zwei Wahrheiten und irgendwann zwei
   verschiedene Tempoangaben fuer dieselbe Einheit. */
function gmRxLinesHTML(item){
  if(!item||!item.rx)return '';
  var F=(window.ORVIA&&ORVIA.prescriptionFormat)||null;
  if(!F)return '';
  var r;
  try{r=F.formatPrescription(item.rx,{nameOf:(typeof gmExName==='function')?gmExName:null});}
  catch(_){return '';}
  if(!r||!r.ok||!r.lines.length)return '';
  var html='<ul class="sc-plex sc-rx">';
  for(var i=0;i<r.lines.length;i++){
    var l=r.lines[i];
    /* Belastung und Uebungen tragen die Aussage; Aufwaermen/Auslaufen sind
       Beiwerk und werden zurueckgenommen — aber NICHT weggelassen, sonst
       fehlte dem Nutzer die halbe Einheit. */
    var kern=(l.kind==='group'||l.kind==='work'||l.kind==='exercise');
    html+='<li'+(kern?'':' class="sc-rx-soft"')+'>'+gmEsc(l.text)+'</li>';
  }
  html+='</ul>';
  return html+gmHinweisHTML(item);
}

/* v8-349 — WAS DIE QUELLE SAGT, ABER NICHT ALS ZAHL.
   Die Kette Quelle → Regel → Vorgabe → Verordnung endete bis hierher an der
   Zahl: was sich nicht in Saetze, Pausen oder Tempo giessen liess, kam nicht
   an. Das war eine zu enge Vorstellung von Wirkung. Ein Satz wie „aus
   isolierten Krafttests laesst sich die Laufleistung nicht vorhersagen"
   aendert keine Satzzahl — er aendert, was der Nutzer von seinen Werten
   erwartet.

   DREI REGELN, die hier nicht verhandelbar sind:
     • Ohne Wissen steht hier NICHTS. Kein allgemeiner Ratschlag, keine
       Fuellzeile — die Hinweise sind belegt oder sie sind nicht da.
     • Jeder Satz nennt seine Regel und seine Evidenzklasse. Ein Hinweis
       ohne Herkunft waere eine anonyme Behauptung.
     • Ausschluesse und Grenzen stehen SICHTBAR an der Zeile, nicht in einer
       Fussnote. „gilt nicht für: akute_verletzung" ist kein Kleingedrucktes,
       sondern die Haelfte der Aussage.

   Formatiert wird ausschliesslich ueber `prescription-format.hinweisZeilen`
   — aus demselben Grund wie oben bei der Verordnung: zwei Formatierungen
   waeren zwei Wahrheiten. */
function gmHinweisHTML(item){
  if(!item||!item.hinweise||!item.hinweise.length)return '';
  var F=(window.ORVIA&&ORVIA.prescriptionFormat)||null;
  if(!F||typeof F.hinweisZeilen!=='function')return '';
  var z;
  /* v8-353: die Wochenkarte zeigt hoechstens vier Hinweise. Eine Laufeinheit
     erzeugt seit dem Verdrahten des Laufwissens 14 belegte Aussagen — jede
     richtig, alle zusammen unlesbar. Was nicht gezeigt wird, wird gezaehlt
     und benannt, nicht verschwiegen. Die Vier ist ein Produktwert fuer diese
     Kartengroesse, keine Erkenntnis. */
  try{z=F.hinweisZeilen(item.hinweise,{max:4});}catch(_){return '';}
  if(!z||!z.length)return '';
  var html='<ul class="sc-plex sc-rx-hint">';
  for(var i=0;i<z.length;i++){
    var h=z[i];
    if(h.art==='gekuerzt'){
      html+='<li class="sc-hint-more">'+gmEsc(h.text)+'</li>';
      continue;
    }
    html+='<li><span class="sc-hint-text">'+gmEsc(h.text)+'</span>';
    if(h.herkunft||h.regelId){
      html+='<span class="sc-hint-src">'+gmEsc([h.herkunft,h.regelId].filter(Boolean).join(' · '))+'</span>';
    }
    if(h.zusatz&&h.zusatz.length){
      for(var j=0;j<h.zusatz.length;j++){
        html+='<span class="sc-hint-note">'+gmEsc(h.zusatz[j])+'</span>';
      }
    }
    html+='</li>';
  }
  return html+'</ul>';
}

var _planEdit=null;
function openPlanEditor(){
  _planEdit=JSON.parse(JSON.stringify(activeWeekPlan()));
  var wrap=document.createElement('div');wrap.className='orvia-modal-bg';
  wrap.innerHTML='<div class="orvia-modal goal-modal plan-edit"><h3>Wochenplan bearbeiten</h3><div class="pe-scroll" id="pe_scroll"></div>'+
    '<button class="btn" onclick="savePlanEdit()">Speichern</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="resetPlan()">Auf Standard zurücksetzen</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="closePlanEditor()">Abbrechen</button></div>';
  document.body.appendChild(wrap);window._planEd=wrap;wrap.addEventListener('click',function(ev){if(ev.target===wrap)closePlanEditor();});
  /* v8-323: Panelzustand gehoert nicht ueber Editor-Sitzungen hinweg erhalten. */
  _peOpen=null;_peErr=null;
  /* Uebungsbibliothek vorladen, damit Auswahl und Namen sofort da sind. */
  gmExLibEnsure(function(){renderPlanEditor();});
  renderPlanEditor();
}
/* ---- v8-323 (K2) · Uebungs-Editor im Wochenplan-Editor ----
   Zustand liegt AUSSCHLIESSLICH in _planEdit[di][ii].plannedExercises — es gibt
   kein zweites UI-Modell. Alle Listenoperationen laufen ueber den reinen
   Datenvertrag (strengthPlan.insert/remove/move/updateExerciseAt), damit
   Sortierung, Grenzen und Fail-closed-Verhalten nur an EINER Stelle stehen. */
var _peOpen=null;   /* {di,ii} — geoeffnetes Uebungspanel */
var _peErr=null;    /* {di,ii,msg} — sichtbarer Fehler statt stiller Ablehnung */
var PE_ERR_TEXT={
  missing:'Pflichtangabe fehlt', not_integer:'nur ganze Zahlen', not_finite:'keine Zahl',
  out_of_range:'ausserhalb des zulaessigen Bereichs', reversed_range:'Von-Wert groesser als Bis-Wert',
  too_many:'Obergrenze erreicht', not_object:'unbrauchbare Eingabe'
};
var PE_FIELD_DE={sets:'Sätze',minReps:'Wdh. von',maxReps:'Wdh. bis',targetWeightKg:'Zielgewicht',targetRir:'RIR',restSeconds:'Pause',exerciseId:'Übung'};
function _peErrText(errs){
  if(!errs||!errs.length)return 'Eingabe abgelehnt.';
  var e=errs[0];
  return (PE_FIELD_DE[e.field]||e.field||'Eingabe')+': '+(PE_ERR_TEXT[e.code]||e.code);
}
function _peSP(){return (window.ORVIA&&ORVIA.strengthPlan)||null;}
function _peItem(di,ii){try{return (_planEdit&&_planEdit[di]&&_planEdit[di][ii])||null;}catch(_){return null;}}
function _peList(di,ii){var SP=_peSP(),it=_peItem(di,ii);return (SP&&it)?SP.readPlanned(it):[];}
function _peCommit(di,ii,list){
  var SP=_peSP(),it=_peItem(di,ii);if(!SP||!it)return false;
  _planEdit[di][ii]=SP.attachPlanned(it,list);   /* attachPlanned liefert eine Kopie */
  return true;
}
/* Leeres Feld = „keine Vorgabe" (null). Unlesbares = NaN ⇒ sichtbarer Fehler,
   niemals stilles Verwerfen. */
function _peNum(el){
  if(!el)return null;
  var v=String(el.value==null?'':el.value).trim().replace(',','.');
  if(!v)return null;
  var n=parseFloat(v);
  return isFinite(n)?n:NaN;
}
function peToggleEx(di,ii){
  if(_peOpen&&_peOpen.di===di&&_peOpen.ii===ii){_peOpen=null;}
  else{_peOpen={di:di,ii:ii};_peErr=null;gmExLibEnsure(function(){renderPlanEditor();});}
  renderPlanEditor();
}
function peAddEx(di,ii){
  var SP=_peSP();if(!SP)return;
  var sel=document.getElementById('pe_ex_sel_'+di+'_'+ii);
  var setsEl=document.getElementById('pe_ex_sets_'+di+'_'+ii);
  var id=sel&&sel.value;
  if(!id){_peErr={di:di,ii:ii,msg:'Bitte zuerst eine Übung auswählen.'};return renderPlanEditor();}
  var sets=_peNum(setsEl);
  if(sets===null||(typeof sets==='number'&&isNaN(sets))){
    _peErr={di:di,ii:ii,msg:'Sätze: Pflichtangabe fehlt'};return renderPlanEditor();
  }
  var r=SP.insertExercise(_peList(di,ii),{exerciseId:id,sets:sets});
  if(!r.ok){_peErr={di:di,ii:ii,msg:_peErrText(r.errors)};return renderPlanEditor();}
  _peErr=null;_peCommit(di,ii,r.exercises);renderPlanEditor();
}
function peRemoveEx(di,ii,idx){
  var SP=_peSP();if(!SP)return;
  var r=SP.removeExerciseAt(_peList(di,ii),idx);
  if(!r.ok){_peErr={di:di,ii:ii,msg:_peErrText(r.errors)};return renderPlanEditor();}
  _peErr=null;_peCommit(di,ii,r.exercises);renderPlanEditor();
}
function peMoveEx(di,ii,idx,dir){
  var SP=_peSP();if(!SP)return;
  var r=SP.moveExercise(_peList(di,ii),idx,idx+dir);
  if(!r.ok)return;                       /* Rand der Liste — kein Fehler, nur nichts zu tun */
  _peErr=null;_peCommit(di,ii,r.exercises);renderPlanEditor();
}
function peUpdateEx(di,ii,idx,field,el){
  var SP=_peSP();if(!SP)return;
  var v=_peNum(el);
  if(typeof v==='number'&&isNaN(v)){
    _peErr={di:di,ii:ii,msg:(PE_FIELD_DE[field]||field)+': keine Zahl'};return renderPlanEditor();
  }
  var patch={};patch[field]=v;
  var r=SP.updateExerciseAt(_peList(di,ii),idx,patch);
  if(!r.ok){_peErr={di:di,ii:ii,msg:_peErrText(r.errors)};return renderPlanEditor();}
  _peErr=null;_peCommit(di,ii,r.exercises);renderPlanEditor();
}
/* Auswahlliste AUSSCHLIESSLICH aus der kanonischen Bibliothek. Ist sie (noch)
   nicht geladen, gibt es keine Ersatzliste und keine Freitexteingabe — dann
   sagt die Oberflaeche das offen. */
function peExOptions(){
  var lib=_gmExLib||gmExLibLoadLocal();
  if(!lib)return null;
  var arr=[];for(var id in lib)if(Object.prototype.hasOwnProperty.call(lib,id))arr.push({id:id,name:(lib[id]&&lib[id].name)||id});
  arr.sort(function(a,b){return String(a.name).localeCompare(String(b.name),'de');});
  return arr;
}
function peExPanelHTML(di,ii){
  var SP=_peSP();if(!SP)return '';
  var list=_peList(di,ii);
  var rows='';
  for(var i=0;i<list.length;i++){
    var e=list[i],nm=gmExName(e.exerciseId);
    var idp=di+'_'+ii+'_'+i;
    rows+='<div class="pe-exrow">'+
      '<div class="pe-exname'+(nm?'':' pe-exname-unknown')+'">'+(nm?'':'⚠ ')+esc(nm||e.exerciseId)+
        (nm?'':'<span class="pe-exhint">nicht in der Bibliothek</span>')+'</div>'+
      '<div class="pe-exfields">'+
        '<label>Sätze<input type="number" inputmode="numeric" min="1" max="20" id="pe_f_sets_'+idp+'" value="'+e.sets+'" onchange="peUpdateEx('+di+','+ii+','+i+',\'sets\',this)"></label>'+
        '<label>Wdh. von<input type="number" inputmode="numeric" min="1" max="100" value="'+(e.minReps==null?'':e.minReps)+'" onchange="peUpdateEx('+di+','+ii+','+i+',\'minReps\',this)"></label>'+
        '<label>bis<input type="number" inputmode="numeric" min="1" max="100" value="'+(e.maxReps==null?'':e.maxReps)+'" onchange="peUpdateEx('+di+','+ii+','+i+',\'maxReps\',this)"></label>'+
        '<label>kg<input type="number" inputmode="decimal" step="0.5" min="0" max="500" value="'+(e.targetWeightKg==null?'':e.targetWeightKg)+'" onchange="peUpdateEx('+di+','+ii+','+i+',\'targetWeightKg\',this)"></label>'+
        '<label>Pause s<input type="number" inputmode="numeric" min="0" max="900" value="'+(e.restSeconds==null?'':e.restSeconds)+'" onchange="peUpdateEx('+di+','+ii+','+i+',\'restSeconds\',this)"></label>'+
      '</div>'+
      '<div class="pe-exact">'+
        '<button type="button" onclick="peMoveEx('+di+','+ii+','+i+',-1)" aria-label="Nach oben"'+(i===0?' disabled':'')+'>↑</button>'+
        '<button type="button" onclick="peMoveEx('+di+','+ii+','+i+',1)" aria-label="Nach unten"'+(i===list.length-1?' disabled':'')+'>↓</button>'+
        '<button type="button" onclick="peRemoveEx('+di+','+ii+','+i+')" aria-label="Übung entfernen">✕</button>'+
      '</div></div>';
  }
  if(!rows)rows='<p class="pe-empty">Noch keine Übungen geplant.</p>';
  var opts=peExOptions();
  var add;
  if(!opts){
    add='<p class="pe-exwarn">Die Übungsbibliothek ist gerade nicht verfügbar (offline oder noch nicht geladen). Übungen lassen sich erst hinzufügen, wenn sie da ist — es wird keine Ersatzliste erfunden.</p>';
  }else{
    var os='<option value="">Übung wählen …</option>';
    for(var k=0;k<opts.length;k++)os+='<option value="'+esc(opts[k].id)+'">'+esc(opts[k].name)+'</option>';
    add='<div class="pe-exadd"><select id="pe_ex_sel_'+di+'_'+ii+'">'+os+'</select>'+
      '<input type="number" inputmode="numeric" min="1" max="20" id="pe_ex_sets_'+di+'_'+ii+'" value="3" aria-label="Sätze">'+
      '<button type="button" class="btn sec" onclick="peAddEx('+di+','+ii+')">Hinzufügen</button></div>';
  }
  var err=(_peErr&&_peErr.di===di&&_peErr.ii===ii)?'<p class="pe-exerr" role="alert">'+esc(_peErr.msg)+'</p>':'';
  var est=SP.estimateDurationMin(list);
  var meta=list.length?'<p class="pe-exmeta">'+list.length+' Übung'+(list.length===1?'':'en')+(est?' · geschätzt '+est+' min':'')+'</p>':'';
  return '<div class="pe-expanel">'+rows+meta+err+add+'</div>';
}
function renderPlanEditor(){
  var sc=document.getElementById('pe_scroll');if(!sc)return;
  var SP=_peSP();
  var opts=PLAN_PRESETS.map(function(p,i){return '<option value="'+i+'">'+esc(p.t+' · '+p.l)+'</option>';}).join('');
  sc.innerHTML=_planEdit.map(function(day,di){
    var items=day.length?day.map(function(it,ii){
      var chip='<span class="pe-chip">'+esc(it.l);
      /* Nur Krafteinheiten bekommen den Uebungs-Schalter — Sportart wird
         normalisiert, nicht per Teilstring geraten (v8-316-Lehre). */
      if(SP&&SP.isStrengthItem(it)){
        var n=SP.readPlanned(it).length;
        var open=!!(_peOpen&&_peOpen.di===di&&_peOpen.ii===ii);
        chip+='<button type="button" class="pe-exbtn'+(open?' on':'')+'" onclick="peToggleEx('+di+','+ii+')" aria-expanded="'+(open?'true':'false')+'">Übungen ('+n+')</button>';
      }
      chip+='<button type="button" onclick="removePlanItem('+di+','+ii+')" aria-label="Entfernen">✕</button></span>';
      if(SP&&SP.isStrengthItem(it)&&_peOpen&&_peOpen.di===di&&_peOpen.ii===ii)chip+=peExPanelHTML(di,ii);
      return chip;
    }).join(''):'<span class="pe-empty">Ruhetag</span>';
    return '<div class="pe-day"><div class="pe-dh">'+DAYNAMES[di]+'</div><div class="pe-items">'+items+'</div>'+
      '<div class="pe-add"><select class="pe-sel" id="pe_sel_'+di+'">'+opts+'</select><button type="button" class="btn sec" onclick="addPlanItem('+di+')">+</button></div></div>';
  }).join('');
}
function addPlanItem(di){var sel=document.getElementById('pe_sel_'+di);if(!sel)return;var p=PLAN_PRESETS[+sel.value];if(!p)return;_planEdit[di].push({t:p.t,l:p.l,d:p.d});renderPlanEditor();}
function removePlanItem(di,ii){_planEdit[di].splice(ii,1);if(_peOpen&&_peOpen.di===di&&_peOpen.ii===ii)_peOpen=null;renderPlanEditor();}
/* GM7.5g: renderWeekPlan() bemalt nur die verborgene Legacy-Box (#weekPlanBox); die sichtbare
   GM-Planseite (renderPlan->renderGMPlan) blieb nach Editor-Save/Reset stale, weil saveProfile()
   kein orvia:profile-updated ausloest. Bestehenden Renderer direkt nachziehen (kein neuer Pfad). */
/* KF-011: Jede Schreibquelle von PROFILE.weekPlan hinterlaesst ab jetzt ihre
   Provenienz in PROFILE.weekPlanMeta {source, at, batchId?}. Engine-Anpassung
   und manueller Override sind damit unterscheidbar; das Feld selbst und alle
   Leser bleiben unveraendert (kein Migrationsbedarf, kein Formatwechsel). */
function _planMeta(source,batchId){try{if(typeof PROFILE!=='undefined'&&PROFILE)PROFILE.weekPlanMeta={source:source,at:new Date().toISOString(),batchId:batchId||null};}catch(_){ }}
function savePlanEdit(){
  /* Phase 5E: mit kanonischem Modell schreibt der Editor OVERRIDES (Diff), nie mehr
     den Vollersatz — die Projektion haelt PROFILE.weekPlan konsistent. Flag aus ⇒
     unveraenderter Legacy-Pfad. */
  if(typeof gmCanonPlanOn==='function'&&gmCanonPlanOn()&&_gmCanonPlan.plan&&typeof gmCanonPlanSaveEdit==='function'&&gmCanonPlanSaveEdit(JSON.parse(JSON.stringify(_planEdit)))){
    closePlanEditor();renderWeekPlan();try{if(typeof renderPlan==='function')renderPlan();}catch(_){ }
    if(typeof toast==='function')toast('Wochenplan gespeichert ✓ (kanonisch)');return;
  }
  if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.weekPlan=JSON.parse(JSON.stringify(_planEdit));_planMeta('manual_edit');if(typeof saveProfile==='function')saveProfile();}closePlanEditor();renderWeekPlan();try{if(typeof renderPlan==='function')renderPlan();}catch(_){ }if(typeof toast==='function')toast('Wochenplan gespeichert ✓');}
function resetPlan(){if(typeof PROFILE!=='undefined'&&PROFILE){PROFILE.weekPlan=null;PROFILE._planUndo=null;_planMeta('reset');if(PROFILE.planImpact)PROFILE.planImpact.pending=false;if(typeof saveProfile==='function')saveProfile();}closePlanEditor();renderWeekPlan();try{if(typeof renderPlan==='function')renderPlan();}catch(_){ }if(typeof toast==='function')toast('Plan neu aufgebaut — aus deiner aktuellen Konfiguration');}
function closePlanEditor(){if(window._planEd){try{window._planEd.remove();}catch(e){}window._planEd=null;}}
/* ---- Pause / Urlaub ---- */
function pauseFor(dateStr){var ps=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.pauses)||[];for(var i=0;i<ps.length;i++){if(dateStr>=ps[i].from&&dateStr<=ps[i].to)return ps[i];}return null;}
function renderPauseBanner(){
  var el=document.getElementById('pauseBanner');if(!el)return;
  var p=pauseFor(cur);
  if(!p){el.innerHTML='';el.style.display='none';return;}
  el.style.display='';
  el.innerHTML='<div class="pause-banner"><div><b>Pause aktiv · '+esc(p.reason||'Pause')+'</b><span>bis '+(typeof fmtDate==='function'?fmtDate(p.to):p.to)+' — kein Trainingsdruck, Erholung zählt. Logge nur, was du wirklich machst.</span></div></div>';
}
/* ============ Phase 5D/5E (2026-08-05) · Kanonisches Planmodell — Integration ============
   Flag 'canonPlan' (Default AUS — Aktivierung erst NACH Migration 0030, Toggle im
   Plan-⚙-Sheet). Solange AUS: exakt der bisherige Legacy-Pfad, null Verhaltensaenderung.
   Solange AN:
     • 5D: PROFILE.weekPlan wird EINMALIG verlustfrei in user_week_plans migriert
       (planDomain.fromLegacyWeekPlan; KF-011-Stempel bestimmt baseline.source).
     • 5E: der Plan-Editor schreibt OVERRIDES (diffEditedDays), die Engine schreibt
       BASELINE-Revisionen + Rebase (E-16) — sie ueberschreiben einander nie mehr.
     • Projektion: PROFILE.weekPlan wird aus effectiveSessions() zurueckgeschrieben,
       damit alle 7 Legacy-Leser bis 5F EINE konsistente Wahrheit sehen.
     • Rebase-Konflikte: Badge am Plan (Entscheidung ②), Sheet mit Aufloesung. */
function gmCanonPlanOn(){return typeof gmFeatureFlag==='function'&&gmFeatureFlag('canonPlan');}
var _gmCanonPlan={plan:null,weekKey:null,loading:false,error:null};
function gmCanonPlanRepo(){return (window.ORVIA&&ORVIA.repos&&ORVIA.repos.weekPlan)||null;}
function gmCanonPlanDomain(){return (window.ORVIA&&ORVIA.planDomain)||null;}
function gmCanonPlanEnsure(cb){
  if(!gmCanonPlanOn())return;
  var PD=gmCanonPlanDomain(),repo=gmCanonPlanRepo();if(!PD||!repo)return;
  var wk=PD.weekKeyFor(todayStr());if(!wk)return;
  if(_gmCanonPlan.plan&&_gmCanonPlan.weekKey===wk){if(cb)cb(_gmCanonPlan.plan);return;}
  if(_gmCanonPlan.loading)return;
  _gmCanonPlan.loading=true;
  repo.get(wk).then(function(r){
    _gmCanonPlan.loading=false;
    if(!r.success){_gmCanonPlan.error=r.error||true;return;}
    if(r.data){_gmCanonPlan.plan=r.data;_gmCanonPlan.weekKey=wk;_gmCanonPlan.error=null;if(cb)cb(r.data);return;}
    /* 5D: Erstmigration des Legacy-Bestands (verlustfrei; Legacy-Feld bleibt bestehen). */
    var legacy=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weekPlan)||null;
    var plan=PD.fromLegacyWeekPlan(legacy,(PROFILE&&PROFILE.weekPlanMeta)||null,{weekKey:wk,now:new Date().toISOString()});
    repo.save(plan).then(function(sr){
      if(sr.success||sr.sync_status==='pending'){_gmCanonPlan.plan=plan;_gmCanonPlan.weekKey=wk;_gmCanonPlan.error=null;if(cb)cb(plan);}
      else _gmCanonPlan.error=sr.error||true;
    });
  }).catch(function(){_gmCanonPlan.loading=false;_gmCanonPlan.error=true;});
}
/* ============================================================
   v8-315 · DIE WOCHE WIRD ADRESSIERBAR.

   BEFUND (Gians „jede Folgewoche sieht gleich aus"): Der Plan-Renderer las
   activeWeekPlan() OHNE Wochenbezug. Der Blätter-Versatz _wOff wirkte nur auf
   das Datum in der Kopfzeile und auf die Ist-Auflösung — der INHALT war immer
   die laufende Woche. Zwei getrennte Probleme steckten darin:

   1. WAHRHEIT: user_week_plans ist seit Migration 0029 nach week_key
      adressiert, weekPlanRepository.get(weekKey) existiert. Liegt für eine
      andere Woche ein eigener Plan vor (Engine-Aktivierung, manuelle
      Änderung), wurde er NICHT angezeigt — stattdessen die laufende Woche,
      beschriftet mit dem fremden Datum. Das ist die schwerere Hälfte: die
      Ansicht behauptete etwas, das nicht stimmte.
   2. STRUKTUR: PROFILE.weekPlan ist per Konstruktion eine WIEDERKEHRENDE
      Wochenstruktur (siehe Selbstheilungs-Kommentar in activeWeekPlan). Ohne
      eigenen Plan für die Zielwoche ist die wiederkehrende Struktur die
      ehrliche Antwort — aber sie muss als VORSCHAU kenntlich sein und darf
      nicht wie ein festgelegter Plan aussehen.

   Diese Runde löst 1 und macht 2 sichtbar. Sie erzeugt AUSDRÜCKLICH KEINE
   Wochenvariation: eine in der Oberfläche erfundene Progression wäre genau
   die Ersatzheuristik, die Bauplan §17.2 verbietet. Periodisierung ist
   Stufe 10 und braucht die Engine — diese Runde macht sie erst möglich,
   indem es einen Ort gibt, an den eine Folgewoche überhaupt geschrieben
   werden kann.

   ZWEI RIEGEL, die beim Bauen aufgefallen sind:
   a) KEINE BEOBACHTUNG FREMDER WOCHEN. gmObserveWeekPlan hängt den Plan an
      den Schatten-Snapshot mit weekId = HEUTIGE Woche. Gäbe man ihm eine
      Vorschauwoche, würde der Observer eine fremde Woche als aktuellen Plan
      protokollieren — die Kalibrierung wäre verunreinigt, und zwar
      unbemerkt. Der Vorschaupfad beobachtet deshalb nie.
   b) KEIN SCHREIBEN AUS DER VORSCHAU. Der Lesepfad für fremde Wochen ruft
      weder Selbstheilung noch ensurePlannedSessionIds noch saveProfile —
      sonst könnte das Blättern den gespeicherten Plan verändern.
   ============================================================ */
var _gmWeekCache={};        /* weekKey -> {plan|null, at} — nur Lesecache */
var _gmWeekLoading={};
function gmWeekKeyForOffset(off){
  var PD=(typeof gmCanonPlanDomain==='function')?gmCanonPlanDomain():null;
  if(!PD||typeof PD.weekKeyFor!=='function')return null;
  var n=(typeof off==='number'&&isFinite(off))?off:0;
  /* Die injizierbare Uhr, nicht new Date() — dieselbe Quelle wie todayStr()
     selbst, sonst koennte der Wochenschluessel gegen ein anderes Heute rechnen
     als der Rest des Renderers. */
  var d=new Date((typeof orviaNowMs==='function')?orviaNowMs():Date.now());
  d.setDate(d.getDate()+n*7);
  return PD.weekKeyFor(todayStr(d));
}
/* Laedt den Plan einer FREMDEN Woche nach und rendert danach neu. Fuer die
   laufende Woche ist gmCanonPlanEnsure zustaendig — dieser Pfad fasst
   _gmCanonPlan nie an und migriert nichts (kein save, kein fromLegacy). */
function gmWeekPlanEnsure(weekKey,cb){
  if(!weekKey)return;
  if(Object.prototype.hasOwnProperty.call(_gmWeekCache,weekKey)){if(cb)cb(_gmWeekCache[weekKey]);return;}
  if(_gmWeekLoading[weekKey])return;
  var repo=(typeof gmCanonPlanRepo==='function')?gmCanonPlanRepo():null;
  if(!repo||!gmCanonPlanOn()){_gmWeekCache[weekKey]=null;if(cb)cb(null);return;}
  _gmWeekLoading[weekKey]=true;
  repo.get(weekKey).then(function(r){
    delete _gmWeekLoading[weekKey];
    _gmWeekCache[weekKey]=(r&&r.success&&r.data)?r.data:null;
    if(cb)cb(_gmWeekCache[weekKey]);
    try{if(typeof gmPlanWeekOff==='function'&&gmWeekKeyForOffset(gmPlanWeekOff())===weekKey&&typeof renderGMPlan==='function')renderGMPlan();}catch(_){ }
  }).catch(function(){delete _gmWeekLoading[weekKey];_gmWeekCache[weekKey]=null;});
}
/* DER Lesepfad des Plan-Renderers. Liefert IMMER {days, provenance, weekKey}.
   provenance ist Teil des Vertrags, nicht Kosmetik: die Oberflaeche muss
   unterscheiden koennen zwischen „das ist der Plan dieser Woche" und
   „das ist die wiederkehrende Struktur als Vorschau". */
function gmPlanForOffset(off){
  var n=(typeof off==='number'&&isFinite(off))?off:0;
  var weekKey=gmWeekKeyForOffset(n);
  if(n===0){
    var days0=[[],[],[],[],[],[],[]];
    try{days0=activeWeekPlan();}catch(_){ }
    return {days:days0,provenance:'current',weekKey:weekKey};
  }
  /* Fremde Woche: eigener persistierter Plan? */
  var PD=(typeof gmCanonPlanDomain==='function')?gmCanonPlanDomain():null;
  if(weekKey&&PD&&typeof PD.effectiveSessions==='function'){
    if(!Object.prototype.hasOwnProperty.call(_gmWeekCache,weekKey)){
      gmWeekPlanEnsure(weekKey);
      /* NACH dem Anstossen erneut pruefen: ohne Repo/ohne kanonisches Modell
         entscheidet gmWeekPlanEnsure SYNCHRON (Cache = null). Wer hier blind
         'loading' zurueckgibt, zeigt dauerhaft „wird geladen …", obwohl nie
         etwas geladen wird — genau das hat die Testprobe aufgedeckt. */
      if(!Object.prototype.hasOwnProperty.call(_gmWeekCache,weekKey))
        return {days:gmRecurringBaselineDays(),provenance:'loading',weekKey:weekKey};
    }
    var wp=_gmWeekCache[weekKey];
    if(wp&&((wp.baseline&&wp.baseline.sessions&&wp.baseline.sessions.length)||(wp.overrides&&wp.overrides.length))){
      try{
        var eff=JSON.parse(JSON.stringify(PD.effectiveSessions(wp).days));
        var cfg=null;
        try{cfg=(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)?ORVIA.profileModel.effectiveTrainingConfig(PROFILE):null;}catch(_){ }
        /* KEIN gmObserveWeekPlan — siehe Riegel (a). */
        return {days:(typeof alignPlanToAvailability==='function')?alignPlanToAvailability(eff,cfg):eff,
          provenance:'planned_week',weekKey:weekKey};
      }catch(_){ }
    }
  }
  return {days:gmRecurringBaselineDays(),provenance:'recurring_preview',weekKey:weekKey};
}
/* Die wiederkehrende Struktur OHNE Nebenwirkung: kein Speichern, keine
   ID-Vergabe, keine Beobachtung — siehe Riegel (b). */
function gmRecurringBaselineDays(){
  try{
    var p=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weekPlan);
    if(p&&p.length===7){
      var cp=JSON.parse(JSON.stringify(p));
      var cfg=null;
      try{cfg=(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)?ORVIA.profileModel.effectiveTrainingConfig(PROFILE):null;}catch(_){ }
      return (typeof alignPlanToAvailability==='function')?alignPlanToAvailability(cp,cfg):cp;
    }
    var g=(typeof generateWeekPlan==='function')?generateWeekPlan():null;
    return g||[[],[],[],[],[],[],[]];
  }catch(_){return [[],[],[],[],[],[],[]];}
}
var GM_PROV_NOTE={
  planned_week:null,
  recurring_preview:'Vorschau aus deiner wiederkehrenden Wochenstruktur — für diese Woche ist noch kein eigener Plan festgelegt.',
  loading:'Plan dieser Woche wird geladen …'
};
/* Projektion: kanonischer effektiver Plan → Legacy-Feld (EINE Wahrheit bis 5F). */
function gmCanonPlanProject(plan){
  try{
    var PD=gmCanonPlanDomain();if(!PD||typeof PROFILE==='undefined'||!PROFILE)return;
    var eff=PD.effectiveSessions(plan);
    PROFILE.weekPlan=JSON.parse(JSON.stringify(eff.days));
    if(typeof _planMeta==='function')_planMeta('canonical_projection','rev'+plan.revision);
    if(typeof saveProfile==='function')saveProfile();
  }catch(_){ }
}
function gmCanonPlanPersist(plan,after){
  var repo=gmCanonPlanRepo();if(!repo)return;
  _gmCanonPlan.plan=plan;
  repo.save(plan).then(function(r){
    if(!r.success&&r.sync_status!=='pending'&&typeof toast==='function')toast('Plan-Sync fehlgeschlagen — lokal gespeichert');
    if(after)after(r);
  });
  gmCanonPlanProject(plan);
}
/* 5E · Editor-Speichern: Struktur-Diff → einzelne Overrides. */
function gmCanonPlanSaveEdit(editedDays){
  var PD=gmCanonPlanDomain();var plan=_gmCanonPlan.plan;
  if(!PD||!plan)return false;
  var eff=PD.effectiveSessions(plan);
  var now=new Date().toISOString();
  var ovs=PD.diffEditedDays(eff,editedDays,{now:now,reason:'user_manual'});
  var p=plan,err=null;
  ovs.forEach(function(ov){var r=PD.applyOverride(p,ov);if(r.error){err=r.error;return;}p=r.plan;});
  if(err){try{console.error('[canonPlan] Override abgelehnt:',err);}catch(_){ }return false;}
  gmCanonPlanPersist(p);
  return true;
}
/* 5E · Engine-Anpassung: neue Baseline + Rebase (Overrides bleiben erhalten). */
function gmCanonPlanEngineRebase(adjustedDays,batchId){
  var PD=gmCanonPlanDomain();var plan=_gmCanonPlan.plan;
  if(!PD||!plan)return false;
  var nb=PD.baselineFromDays(adjustedDays,{source:'engine',engineVersion:batchId||null,generatedAt:new Date().toISOString()});
  var r=PD.rebase(plan,nb,{now:new Date().toISOString()});
  gmCanonPlanPersist(r.plan);
  if(r.conflicts.length&&typeof toast==='function')toast(r.conflicts.length+' Plan-Konflikt(e) — siehe Plan-Tab');
  return true;
}
/* ============ Phase 8.4 (2026-08-06) · flag-gesteuerter Aktivierungspfad ============
   Bis hierher endete die Engine im Protokoll: week-projection baute das Anzeige-
   modell, aber niemand schrieb es je in den Plan. Das ist der eine Aufruf, der die
   Kette schliesst — und er ist dreifach gesperrt:
     1. serverseitiges Flag 'engine_v2_plan' (fail-closed, feature-flags.js),
     2. kanonisches Planmodell aktiv (ohne Baseline/Override-Trennung gaebe es
        keinen Ort, an dem manuelle Aenderungen die Engine ueberleben koennten),
     3. plan-activation verweigert selbst, sobald ein Override verloren ginge.
   Steht auch nur eine der drei nicht, passiert exakt nichts — der Legacy-Pfad
   bleibt unveraendert. JEDER Ausgang wird protokolliert; genau dieses Protokoll
   wertet canary-eval aus. Ohne Ereignisse meldet es insufficient_data, nie „gruen". */
function gmEnginePlanFlagOn(){
  try{return !!(window.ORVIA&&ORVIA.featureFlags&&ORVIA.featureFlags.isEnabled('engine_v2_plan'));}catch(_){return false;}
}
function gmEngineActivateWeek(){
  var PA=(window.ORVIA&&ORVIA.planActivation)||null;
  if(!PA)return null;
  var on=gmEnginePlanFlagOn();
  /* Ohne Freigabe nicht einmal rechnen: kein Aufwand, kein Protokolleintrag,
     keine Moeglichkeit einer Nebenwirkung. */
  if(!on)return null;
  if(!gmCanonPlanOn()||!_gmCanonPlan.plan)
    {PA.logEvent({at:new Date().toISOString(),reason:'no_canonical_plan',applied:false,flag:'engine_v2_plan'});return null;}
  var sh=(window.ORVIA&&ORVIA.engineShadow)||null;
  var wk=null;try{wk=sh&&typeof sh.buildWeekNow==='function'?sh.buildWeekNow():null;}catch(_){ }
  if(!wk||!wk.result)
    {PA.logEvent({at:new Date().toISOString(),reason:'projection_failed',applied:false,flag:'engine_v2_plan',error:'no_scheduler_result'});return null;}
  var r=PA.activate({plan:_gmCanonPlan.plan,schedulerOutput:wk.result,enabled:true,
    now:new Date().toISOString(),weekKey:_gmCanonPlan.weekKey});
  PA.logEvent(r.event);
  if(!r.applied)return r;
  /* Erst ab hier wird geschrieben — und der Zustand davor bleibt fuer den
     Rueckweg erhalten (Canary-Kriterium „Migration reversibel"). */
  try{PROFILE._planEngineUndo=r.previous;}catch(_){ }
  gmCanonPlanPersist(r.plan);
  if(r.conflicts&&r.conflicts.length&&typeof toast==='function')toast(r.conflicts.length+' Plan-Konflikt(e) — siehe Plan-Tab');
  return r;
}
/* Rueckweg aus der Konsole/Notfall: ORVIA.enginePlanRevert() */
function gmEnginePlanRevert(){
  var PA=(window.ORVIA&&ORVIA.planActivation)||null;
  var snap=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE._planEngineUndo)||null;
  if(!PA||!snap)return {ok:false,reason:'no_snapshot'};
  var r=PA.revert(snap);
  if(!r.ok)return r;
  gmCanonPlanPersist(r.plan);
  try{PROFILE._planEngineUndo=null;}catch(_){ }
  PA.logEvent({at:new Date().toISOString(),reason:'reverted',applied:false,flag:'engine_v2_plan'});
  try{if(typeof renderPlan==='function')renderPlan();}catch(_){ }
  return r;
}
try{window.ORVIA=window.ORVIA||{};ORVIA.enginePlanActivate=gmEngineActivateWeek;ORVIA.enginePlanRevert=gmEnginePlanRevert;}catch(_){ }
/* Konflikt-Badge + Sheet (Entscheidung ②: Badge, keine Unterbrechung). */
function gmCanonPlanConflictCount(){
  try{return (_gmCanonPlan.plan&&_gmCanonPlan.plan.pendingConflicts&&_gmCanonPlan.plan.pendingConflicts.length)||0;}catch(_){return 0;}
}
function gmOpenPlanConflictsSheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var PD=gmCanonPlanDomain();var plan=_gmCanonPlan.plan;
  var cs=(plan&&plan.pendingConflicts)||[];
  var body;
  if(!cs.length){body='<p class="muted">Keine offenen Plan-Konflikte.</p>';}
  else{
    body=cs.map(function(c){
      return '<div class="card"><div class="ctitle"><div class="l">'+icon('alert')+' Änderung nicht übertragbar</div></div>'+
        '<p style="font-size:12px;color:var(--muted);margin:0 0 8px">Deine Änderung („'+gmEsc(c.type)+'") hing an einer Einheit, die die Engine neu aufgebaut hat ('+gmEsc(c.reason)+'). Sie wird nicht geraten neu zugeordnet (E-16).</p>'+
        '<div class="sheet-cta"><button class="sec" onclick="gmCanonPlanDiscardConflict(\''+gmEsc(c.overrideId)+'\')">Änderung verwerfen</button></div></div>';
    }).join('');
  }
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--attention-t,rgba(237,180,78,.16));color:var(--attention)">'+icon('alert')+'</div><div><h3>Plan-Konflikte</h3><div class="sh-sub" style="margin:2px 0 0">Engine-Update vs. deine Änderungen</div></div></div>'+
    '<div class="sh-block">'+body+'</div>'+
    '<div class="source">'+icon('info','xs')+' Jede Entscheidung wird in der Planhistorie dokumentiert.</div>';
  gmOpenSheet('detailSheet');
}
function gmCanonPlanDiscardConflict(ovId){
  var PD=gmCanonPlanDomain();var plan=_gmCanonPlan.plan;if(!PD||!plan)return;
  var r=PD.resolveConflict(plan,ovId,{action:'discard'},new Date().toISOString());
  if(r.error)return;
  gmCanonPlanPersist(r.plan,function(){gmOpenPlanConflictsSheet();try{renderGMPlan();}catch(_){ }});
}
function renderPlanPauses(){
  var el=document.getElementById('planPauses');if(!el)return;
  var ps=((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.pauses)||[]).map(function(p,i){return {p:p,i:i};});
  ps.sort(function(a,b){return a.p.from<b.p.from?-1:1;});
  if(!ps.length){el.innerHTML='';return;}
  el.innerHTML='<div class="pause-list">'+ps.map(function(o){return '<div class="pause-item"><span>'+esc(o.p.reason||'Pause')+' · '+(typeof fmtDate==='function'?fmtDate(o.p.from)+'–'+fmtDate(o.p.to):o.p.from+'–'+o.p.to)+'</span><button onclick="delPause('+o.i+')" aria-label="Entfernen">✕</button></div>';}).join('')+'</div>';
}
function openPauseEditor(){
  var t=(typeof todayStr==='function'?todayStr():'');
  var wrap=document.createElement('div');wrap.className='orvia-modal-bg';
  wrap.innerHTML='<div class="orvia-modal goal-modal"><h3>Pause eintragen</h3>'+
    '<div class="gm-field"><label>Grund</label><div class="gm-chips" id="pause_r"><button type="button" class="gm-chip on" data-v="Urlaub" onclick="gmPick(this,\'pause_r\')">Urlaub</button><button type="button" class="gm-chip" data-v="Krank" onclick="gmPick(this,\'pause_r\')">Krank</button><button type="button" class="gm-chip" data-v="Pause" onclick="gmPick(this,\'pause_r\')">Sonstiges</button></div></div>'+
    '<div class="gm-field"><label>Von</label><input type="date" id="pause_f" value="'+t+'"></div>'+
    '<div class="gm-field"><label>Bis</label><input type="date" id="pause_t" value="'+t+'"></div>'+
    '<button class="btn" onclick="savePause()">Pause speichern</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="closePause()">Abbrechen</button></div>';
  document.body.appendChild(wrap);window._pauseEd=wrap;wrap.addEventListener('click',function(ev){if(ev.target===wrap)closePause();});
}
function closePause(){if(window._pauseEd){try{window._pauseEd.remove();}catch(e){}window._pauseEd=null;}}
function savePause(){
  if(typeof PROFILE!=='undefined'&&PROFILE){
    var rd=(document.querySelector('#pause_r .on')||{}).dataset;var r=rd?rd.v:'Pause';
    var f=(document.getElementById('pause_f')||{}).value,tt=(document.getElementById('pause_t')||{}).value;
    if(!f||!tt){if(typeof toast==='function')toast('Von/Bis fehlt');return;}
    if(tt<f){var x=f;f=tt;tt=x;}
    PROFILE.pauses=PROFILE.pauses||[];PROFILE.pauses.push({from:f,to:tt,reason:r});
    if(typeof saveProfile==='function')saveProfile();
  }
  closePause();if(typeof renderPlanPauses==='function')renderPlanPauses();renderWeekPlan();if(typeof renderPauseBanner==='function')renderPauseBanner();if(typeof toast==='function')toast('Pause gespeichert ✓');
}
function delPause(i){if(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.pauses){PROFILE.pauses.splice(i,1);if(typeof saveProfile==='function')saveProfile();if(typeof renderPlanPauses==='function')renderPlanPauses();renderWeekPlan();if(typeof renderPauseBanner==='function')renderPauseBanner();}}
/* ---- Einheiten-Detail (anklickbar im Wochenplan) ---- */
function unitKind(item){
  var l=(item.l||'').toLowerCase(),d=item.d;
  if(item.t==='Gym')return 'gym';if(item.t==='Schwimmen')return 'swim';if(item.t==='Rad')return 'bike';if(item.t==='Mobilität')return 'mob';
  if(d==='iv'||l.indexOf('interval')>=0)return 'interval';
  if(d==='lr'||l.indexOf('long')>=0)return 'long';
  if(l.indexOf('tempo')>=0||l.indexOf('schwelle')>=0)return 'tempo';
  return 'easy';
}
function unitPace(kind){
  var g=(typeof goalOf==='function')?goalOf():null;
  var z=(g&&g.targetMin&&Calc.paceZones)?Calc.paceZones(g.distanceKm,g.targetMin):null;if(!z)return null;
  var key={interval:'Intervall (VO2)',easy:'Easy',long:'Long Run',tempo:'Tempo / Schwelle'}[kind];if(!key)return null;
  var zone=z.find(function(x){return x.k===key;});return zone?Calc.fmtPace(zone.lo)+'–'+Calc.fmtPace(zone.hi)+'/km':null;
}
function unitHF(kind){
  var hm=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.hfMax)||((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.age)?Math.round(208-0.7*PROFILE.age):190);
  var r={interval:[0.88,0.95],easy:[0.61,0.72],long:[0.65,0.75],tempo:[0.82,0.88],bike:[0.61,0.72]}[kind];if(!r)return null;
  return Math.round(r[0]*hm)+'–'+Math.round(r[1]*hm)+' bpm';
}
function unitStruct(item,kind){
  var S={
    interval:{goal:'VO2max & Schnelligkeit — Reize über der Schwelle.',warmup:'10–15 min locker + 3–4 Strides',main:'Konkret: 6 × 800 m im Intervall-Tempo, dazwischen 2 min Trab-Pause (~5 km Belastung). Gleichmäßig halten — die letzte Wiederholung darf nicht langsamer sein.',cooldown:'10 min auslaufen',rpe:'RPE 8–9',alt:'Bei Müdigkeit/Knie: Easy Z2 oder Bike Z2'},
    easy:{goal:'Grundlagenausdauer — locker, aerob, fördert Erholung.',warmup:'5 min eintraben',main:'Gleichmäßig im Easy-Bereich — Unterhaltungstempo',cooldown:'kurz auslaufen',rpe:'RPE 3–4',alt:'Bei Knie: Bike/Schwimmen Z2'},
    long:{goal:'Ausdauer & Long-Run-Ökonomie.',warmup:'locker starten',main:'Konkret: gleichmäßig im Long-Run-Tempo durchlaufen, bewusst nicht zu schnell starten. Ab der Peak-Phase die letzten 20 min als 2 × 10 min Race-Pace einbauen.',cooldown:'letzte Minuten locker',rpe:'RPE 4–5',alt:'Bei Knie: kürzen oder durch Bike ersetzen'},
    tempo:{goal:'Laktatschwelle — kontrolliert hart.',warmup:'10 min locker',main:'Konkret: nach dem Warm-up 25 min am Stück im Tempo/Schwellen-Bereich — „komfortabel hart", noch kontrolliert und gleichmäßig.',cooldown:'10 min locker',rpe:'RPE 7',alt:'Bei Müdigkeit: in Easy umwandeln'},
    gym:{goal:'Kraft & Stabilität — Verletzungsschutz und Laufökonomie.',warmup:'Mobilität + Aktivierung',main:item.l+' nach Plan; Grundübungen sauber, Technik vor Last',cooldown:'kurze Mobility',rpe:'Technik-Fokus',alt:'Bei Knie: keine schweren Beine — Oberkörper + Glute/Core'},
    swim:{goal:'Gelenkschonende Ausdauer & Technik.',warmup:'4 × 25 m locker',main:item.l,cooldown:'2 × 25 m locker',rpe:'kontrolliert',alt:''},
    bike:{goal:'Aerobe Basis — gelenkschonend.',warmup:'5 min locker',main:'Gleichmäßige Z2-Dauerfahrt',cooldown:'5 min ausrollen',rpe:'RPE 3–4',alt:''},
    mob:{goal:'Beweglichkeit & Prävention.',warmup:'',main:item.l,cooldown:'',rpe:'',alt:''}
  };
  var s=Object.assign({},S[kind]||S.easy);
  s.pace=(item.t==='Laufen')?unitPace(kind):null;s.hf=unitHF(kind);return s;
}
function unitGuidance(item,kind){
  var e=DB[todayStr()];var m=e&&e.morning;
  if(!m)return 'Mach zuerst den Morgen-Check-in — dann passt ORVIA die Einheit an deine Tagesform an.';
  // R1.3: heutige Einheiten-Freigabe aus der zentralen Entscheidung (getDecision),
  // nicht mehr aus einer eigenen Ampel-Rechnung. Fallback konservativ 'y'.
  var a;try{var d0=(typeof getDecision==='function')?getDecision():null;
    a={c:({GREEN:'g',YELLOW:'y',ORANGE:'o',RED:'r'})[d0&&d0.dayState]||'y'};}catch(x){a={c:'y'};}
  var knee=m.knee!=null?m.knee:0;var alt=unitStruct(item,kind).alt||'Bike/Schwimmen Z2';
  if(item.t==='Laufen'){
    if(knee>=4)return 'Knie '+knee+'/10 — Lauf heute nicht empfohlen. Besser: '+alt+'.';
    if(knee>=3)return 'Knie '+knee+'/10 — wenn überhaupt nur locker; steigt der Schmerz im Warm-up, abbrechen.';
    if(a.c==='r'||a.c==='o')return 'Tagesform '+(a.c==='r'?'rot':'orange')+' — heute keine Intensität. '+((kind==='interval'||kind==='tempo')?'Easy Z2 statt der harten Einheit.':'Wenn, dann sehr locker und kürzer.');
    if(a.c==='y')return 'Tagesform gelb — '+((kind==='interval'||kind==='tempo')?'reduzieren: weniger Wiederholungen oder Easy.':'nach Plan, aber Pace am langsamen Ende halten.');
    var p=unitPace(kind);return 'Grünes Licht — Einheit nach Plan. '+(p?'Pace '+p+' halten.':'Im Zielbereich bleiben.');
  }
  if(item.t==='Gym'){if(knee>=3)return 'Knie '+knee+'/10 — keine schweren Beine. Oberkörper + Glute/Core.';return 'Technik vor Last. Vor Intervall-/Long-Run-Tagen Beine moderat halten.';}
  return 'Locker und gleichmäßig — gelenkschonende Ausdauer, kein Wettkampf.';
}
/* ---- Detaillierte Einheiten-Vorgaben (km/Dauer/Pace/HF/Splits) ---- */
function avgSec(z){return z?(z.lo+z.hi)/2:null;}
function unitZone(kind){
  var g=(typeof goalOf==='function')?goalOf():null;
  var z=(g&&g.targetMin&&Calc.paceZones)?Calc.paceZones(g.distanceKm,g.targetMin):null;if(!z)return null;
  var key={interval:'Intervall (VO2)',easy:'Easy',long:'Long Run',tempo:'Tempo / Schwelle'}[kind];if(!key)return null;
  return z.find(function(x){return x.k===key;})||null;
}
function fmtDur(min){min=Math.round(min);var h=Math.floor(min/60),m=min%60;return h?(h+':'+String(m).padStart(2,'0')+' h'):(m+' min');}
function pz(z){return z?(Calc.fmtPace(z.lo)+'–'+Calc.fmtPace(z.hi)+'/km'):'Zielbereich';}
function runPrescription(item,kind){
  var lk=(typeof lrKm==='function')?lrKm(Calc.runnaWeek(daysTo(RACE.date))):14;if(!lk)lk=14;
  var ez=unitZone('easy'),tz=unitZone('tempo'),iz=unitZone('interval'),lz=unitZone('long');
  var easyP=avgSec(ez)||390,tempoP=avgSec(tz)||315,intP=avgSec(iz)||290,longP=avgSec(lz)||405;
  var p={t:'Laufen',kind:kind};
  if(kind==='easy'){p.dist=8;p.pace=ez;p.dur=8*easyP/60;p.splits=[['1 km','locker einlaufen'],['6 km','stabil locker @ '+pz(ez)],['1 km','auslaufen']];p.goal='Grundlagenausdauer — locker, aerob, fördert Erholung.';p.cues='Unterhaltungstempo.';}
  else if(kind==='long'){p.dist=lk;p.pace=lz;p.dur=lk*longP/60;p.splits=[['0–'+Math.round(lk*0.3)+' km','sehr locker'],[Math.round(lk*0.3)+'–'+Math.round(lk*0.8)+' km','stabil @ '+pz(lz)],[Math.round(lk*0.8)+'–'+lk+' km','optional leicht zügiger, wenn Score gut']];p.goal='Ausdauer & Long-Run-Ökonomie.';p.cues='Bewusst langsam starten.';}
  else if(kind==='tempo'){p.dist=10;p.pace=tz;p.dur=(2*easyP+5*tempoP+3*easyP)/60;p.splits=[['2 km','Warm-up easy'],['5 km','@ '+pz(tz)+' (komfortabel hart)'],['3 km','Cool-down easy']];p.goal='Laktatschwelle — kontrolliert hart.';p.cues='Gleichmäßig, noch kontrolliert.';}
  else{p.dist=9;p.pace=iz;p.dur=(2*easyP+6*0.8*intP+6*0.4*easyP+2*easyP)/60;p.splits=[['2 km','Warm-up easy + 3–4 Strides'],['6 × 800 m','@ '+pz(iz)],['je 400 m / 2 min','Trab-Pause'],['2 km','Cool-down easy']];p.goal='VO2max & Schnelligkeit — Reize über der Schwelle.';p.cues='Letzte Wiederholung nicht langsamer.';}
  p.hf=unitHF(kind);p.rpe={easy:'RPE 3–4',long:'RPE 4–5',tempo:'RPE 7',interval:'RPE 8–9'}[kind];p.alt=unitStruct(item,kind).alt;return p;
}
function bikeSub(item){var l=(item.l||'').toLowerCase();if(l.indexOf('long')>=0)return 'long';if(l.indexOf('recovery')>=0||l.indexOf('regener')>=0||l.indexOf('commute')>=0)return 'recovery';if(l.indexOf('interval')>=0||l.indexOf('tempo')>=0||l.indexOf('z3')>=0)return 'interval';return 'easy';}
function bikePrescription(item){
  var sub=bikeSub(item);var p={t:'Rad',kind:sub,hf:unitHF('bike')};
  if(sub==='long'){p.dist=70;p.durStr='2:30–3:00 h';p.zone='HF Zone 2';p.splits=[['30 min','locker einrollen'],['~2 h','konstant Zone 2'],['20 min','nur zügiger, wenn Tagesform gut']];p.goal='Lange aerobe Ausdauer.';p.rpe='RPE 3–5';p.alt='Bei schlechter Form: 40 km locker oder Indoor Z2.';}
  else if(sub==='recovery'){p.dist=25;p.durStr='45–60 min';p.zone='HF Zone 1–2';p.splits=[['gesamt','locker Z1–2, keine Antritte']];p.goal='Durchblutung & Erholung.';p.rpe='RPE 2–3';p.alt='Kann entfallen, wenn sehr müde.';}
  else if(sub==='interval'){p.dist=45;p.durStr='90 min';p.zone='Z2 + Intervalle';p.splits=[['15 min','locker einrollen'],['5 × 5 min','hart / 5 min locker'],['15 min','ausrollen']];p.goal='Schwelle / VO2 auf dem Rad.';p.rpe='RPE 8 in den Blöcken';p.alt='Bei schlechter Form: nur Z2-Dauerfahrt.';}
  else{p.dist=35;p.durStr='75–90 min';p.zone='HF Zone 2';p.splits=[['10 min','locker einrollen'],['60 min','konstant Zone 2'],['10 min','ausrollen']];p.goal='Aerobe Basis, gelenkschonend.';p.rpe='RPE 3–4';p.alt='Commute zählt als Regeneration.';}
  return p;
}
function unitHero(cells){return '<div class="unit-hero">'+cells.map(function(c){return '<div class="uh-cell"><b>'+escH(c[0])+'</b><span>'+escH(c[1])+'</span></div>';}).join('')+'</div>';}
function unitSplits(splits,profi){if(!splits||!splits.length)return '';
  if(profi)return '<div class="unit-splits"><div class="us-h">Splits</div>'+splits.map(function(s){return '<div class="usp"><span class="usp-k">'+escH(s[0])+'</span><span class="usp-v">'+escH(s[1])+'</span></div>';}).join('')+'</div>';
  return '<div class="unit-steps">'+splits.map(function(s){return '<div class="ustep"><span class="ust-l">'+escH(s[0])+'</span><span>'+escH(s[1])+'</span></div>';}).join('')+'</div>';}
function unitBodyRun(item,kind,lvl){
  var p=runPrescription(item,kind);
  var cells=[[p.dist+' km','Distanz'],['~'+fmtDur(p.dur),'Dauer']];
  if(lvl!=='anfaenger'&&p.pace)cells.push([Calc.fmtPace(p.pace.lo)+'–'+Calc.fmtPace(p.pace.hi),'/km']);
  var goal='<div class="unit-goal">'+escH(p.goal)+'</div>';
  var guid='<div class="unit-rec"><b>Heute für dich</b><br>'+escH(unitGuidance(item,kind))+'</div>';
  var alt=p.alt?'<div class="unit-alt"><b>Alternative:</b> '+escH(p.alt)+'</div>':'';
  if(lvl==='anfaenger'){
    var word={easy:'locker',long:'ruhig und gleichmäßig',tempo:'zügig, aber kontrolliert',interval:'mit ein paar schnellen Abschnitten'}[kind]||'locker';
    var cue={easy:'Du solltest dich dabei noch unterhalten können.',long:'Starte langsam und halte ein angenehmes Tempo.',tempo:'„Komfortabel hart" — du kannst nur noch kurze Sätze sprechen.',interval:'Zwischen den schnellen Stücken locker traben.'}[kind]||'';
    var simple='Laufe ca. '+Math.round(p.dur)+' Minuten '+word+'. '+cue+' Fühlst du dich schwer, kürze auf '+Math.round(p.dur*0.7)+' Minuten.';
    return unitHero(cells)+goal+'<div class="unit-simple">'+escH(simple)+'</div>'+guid+alt;
  }
  var stats=[];if(p.hf)stats.push(['HF-Zone',p.hf]);if(p.rpe)stats.push(['Intensität',p.rpe]);
  var statHTML='<div class="unit-stats">'+stats.map(function(x){return '<div class="unit-stat"><span class="us-k">'+escH(x[0])+'</span><span class="us-v">'+escH(x[1])+'</span></div>';}).join('')+'</div>';
  var cues=(lvl==='profi'&&p.cues)?'<div class="unit-cues">'+escH(p.cues)+((kind==='easy'||kind==='long')?' Bei HR-Drift >5 % Pace reduzieren.':'')+'</div>':'';
  return unitHero(cells)+goal+statHTML+unitSplits(p.splits,lvl==='profi')+cues+guid+alt;
}
function unitBodyBike(item,lvl){
  var p=bikePrescription(item);
  var cells=[[p.dist+' km','Distanz'],[p.durStr,'Dauer']];
  if(lvl!=='anfaenger')cells.push([p.zone,'Zone']);
  var goal='<div class="unit-goal">'+escH(p.goal)+'</div>';
  var guid='<div class="unit-rec"><b>Heute für dich</b><br>'+escH(unitGuidance(item,'bike'))+'</div>';
  var alt=p.alt?'<div class="unit-alt"><b>Alternative:</b> '+escH(p.alt)+'</div>':'';
  if(lvl==='anfaenger'){
    var simple='Fahre '+p.durStr+' '+(p.kind==='recovery'?'ganz locker':(p.kind==='long'?'gleichmäßig und ruhig':'locker'))+'. Kein hartes Antreten — du sollst dich danach gut fühlen.';
    return unitHero(cells)+goal+'<div class="unit-simple">'+escH(simple)+'</div>'+guid+alt;
  }
  var stats=[];if(p.hf)stats.push(['HF-Zone',p.hf]);if(p.rpe)stats.push(['Intensität',p.rpe]);
  var statHTML='<div class="unit-stats">'+stats.map(function(x){return '<div class="unit-stat"><span class="us-k">'+escH(x[0])+'</span><span class="us-v">'+escH(x[1])+'</span></div>';}).join('')+'</div>';
  var cues=(lvl==='profi')?'<div class="unit-cues">Ohne Powermeter HF-Zone & RPE führen. Kadenz 85–95.</div>':'';
  return unitHero(cells)+goal+statHTML+unitSplits(p.splits,lvl==='profi')+cues+guid+alt;
}
function unitBodyOther(item,kind,lvl){
  var s=unitStruct(item,kind);
  var goal='<div class="unit-goal">'+escH(s.goal)+'</div>';
  var guid='<div class="unit-rec"><b>Heute für dich</b><br>'+escH(unitGuidance(item,kind))+'</div>';
  var alt=s.alt?'<div class="unit-alt"><b>Alternative:</b> '+escH(s.alt)+'</div>':'';
  if(lvl==='anfaenger')return goal+'<div class="unit-simple">'+escH(s.main)+'</div>'+guid+alt;
  var steps='';
  if(s.warmup)steps+='<div class="ustep"><span class="ust-l">Warm-up</span><span>'+escH(s.warmup)+'</span></div>';
  if(s.main)steps+='<div class="ustep"><span class="ust-l">Hauptteil</span><span>'+escH(s.main)+'</span></div>';
  if(s.cooldown)steps+='<div class="ustep"><span class="ust-l">Cool-down</span><span>'+escH(s.cooldown)+'</span></div>';
  var statHTML=(lvl==='profi'&&s.rpe)?'<div class="unit-stats"><div class="unit-stat"><span class="us-k">Intensität</span><span class="us-v">'+escH(s.rpe)+'</span></div></div>':'';
  return goal+statHTML+(steps?'<div class="unit-steps">'+steps+'</div>':'')+guid+alt;
}
function planEntryClick(di,ii,dateIso){
  // AD1b: eindeutiger Plan–Actual-Link → kanonische Activity öffnen (Kontext 'plan');
  // keiner/mehrdeutig → geplante Vorgabe (openUnit), NIE eine beliebige Tagesaktivität blind wählen.
  // v8-310a (Gians P0): dateIso kommt von der GERENDERTEN Karte (dargestellte
  // Woche). Ohne Angabe (Legacy-Aufrufer) gilt die laufende Woche — danach wird
  // der Kontext nur noch DURCHGEREICHT, nie neu aus _wOff/di gerechnet.
  try{
    var row=activeWeekPlan()[di]; var item=row&&row[ii];
    /* v8-310a-Haertung: KEIN Legacy-Rueckbau mehr. Ein datumsloser Aufrufer
       bekommt eine rein lesbare Ansicht ohne Occurrence — nie eine still
       rekonstruierte laufende Woche (genau die Fehlerklasse dieses P0). */
    var dIso=dateIso||null;
    var occ=(dIso&&item&&item.id&&typeof plannedOccurrenceIdForDate==='function')?plannedOccurrenceIdForDate(item,dIso):null;
    var au=(window.ORVIA&&ORVIA.activityUI)?ORVIA.activityUI:null;
    var res=(occ&&au&&au.resolvePlannedActivity)?au.resolvePlannedActivity(occ):{status:'none'};
    if(res&&res.status==='unique'&&res.id&&au&&au.openActivityDetail){ au.openActivityDetail(res.id,'plan'); return; }
    if(res&&res.status==='ambiguous'&&typeof toast==='function'){ toast('Mehrere Aktivitäten für diese Einheit — bitte manuell zuordnen.'); }
    openUnit(di,ii,dIso);
  }catch(e){ try{ openUnit(di,ii,dateIso); }catch(_){} }
}
function openUnit(di,ii,dateIso){
  var row=activeWeekPlan()[di];if(!row)return;var item=row[ii];if(!item)return;
  var kind=unitKind(item);var lvl=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var body=(item.t==='Laufen')?unitBodyRun(item,kind,lvl):(item.t==='Rad')?unitBodyBike(item,lvl):unitBodyOther(item,kind,lvl);
  /* v8-310a (Gians P0): DAS DATUM SPERRT AKTIONEN — nicht der Wochentagsindex.
     Der alte Vergleich (di gegen den heutigen Wochentagsindex) machte in einer geblaetterten Woche
     denselben Wochentag wie heute faelschlich bedienbar: „Training starten"
     fuer eine Einheit NAECHSTE Woche haette eine heutige Aktivitaet mit
     falscher Occurrence erzeugt. Starten/Erledigen NUR wenn dateIso===heute;
     Vergangenheit und Zukunft sind ausschliesslich lesbar. */
  /* v8-310a-Haertung: ohne Datumskontext ist die Ansicht NUR lesbar. */
  var dIso=dateIso||null;
  var isToday=(dIso===todayStr());
  var foot='';
  if(isToday){
    foot+='<button class="btn" onclick="startPlannedUnit('+di+','+ii+',\''+dIso+'\')">Training starten</button>'+
      '<button class="btn sec" style="margin-top:10px" onclick="markPlannedDone(\''+escH(item.t)+'\','+di+','+ii+',\''+dIso+'\')">Als erledigt markieren</button>';
  }else if(dIso){
    var _dd3=null;try{var _d3=new Date(dIso+'T12:00');_dd3=_d3.getDate()+'.'+(_d3.getMonth()+1)+'.';}catch(_){ }
    foot+='<div class="mini-note">'+icon('info','xs')+'<div>Nur lesbar — diese Einheit ist für '+(_dd3?('den '+_dd3):'einen anderen Tag')+' geplant. Starten und Erledigen sind nur am Tag selbst möglich.</div></div>';
  }
  foot+='<button class="btn sec" style="margin-top:10px" onclick="closeSupp();openPlanEditor()">Plan bearbeiten / verschieben</button>';
  if(typeof oModal==='function')oModal(item.l+' · '+item.t,body,foot);
}
/* F1+: kompakte Plan-Notiz aus der geplanten Einheit (Struktur/Sollwerte) für den Live-Modus. */
function planNoteFor(item){
  try{
    var kind=(typeof unitKind==='function')?unitKind(item):item.t;
    if(typeof unitStruct==='function'){
      var s=unitStruct(item,kind);var parts=[];
      if(s){if(s.warmup)parts.push('Auf: '+s.warmup);if(s.main)parts.push(s.main);if(s.cooldown)parts.push('Ab: '+s.cooldown);}
      if(parts.length)return parts.join(' · ');
      if(s&&s.goal)return s.goal;
    }
  }catch(e){}
  return item.l||'';
}
/* F1: geplante Einheit live starten — Sportart + Plan-Sollwerte an den passenden Live-Modus. */
function startPlannedUnit(di,ii,dateIso){
  var item=null;try{item=activeWeekPlan()[di][ii];}catch(e){}
  try{if(typeof closeSupp==='function')closeSupp();}catch(e){}
  if(!item)return;
  /* v8-310a (Gians P0, zweiter Riegel): Auch wenn der Button in einer
     geblaetterten Woche nie gerendert wird — die Funktion selbst verweigert
     jeden Start ausserhalb des heutigen Datums. Ein Konsolenaufruf oder ein
     kuenftiger Renderfehler darf keine Aktivitaet mit fremder Occurrence
     erzeugen. */
  /* v8-310a-Haertung: fehlendes Datum ist ein VERTRAGSBRUCH des Aufrufers —
     benannter Fehler statt stiller Rekonstruktion, keine Mutation. */
  if(!dateIso){
    if(typeof toast==='function')toast('Nicht gestartet — fehlender Datumskontext.');
    return {ok:false,code:'missing_date_context'};
  }
  var dIso=dateIso;
  if(dIso!==todayStr()){
    if(typeof toast==='function')toast('Nicht gestartet — diese Einheit ist nicht für heute geplant.');
    return {ok:false,code:'not_today'};
  }
  var note=planNoteFor(item);
  /* Batch 2d: planned_session_id erhält die OCCURRENCE-ID (konkrete Instanz
     mit Datum), nicht die Template-ID; zusätzlich unveränderlicher Snapshot
     der geplanten Vorgabe für den späteren Plan-Ist-Vergleich. */
  var occ=(typeof plannedOccurrenceIdForDate==='function')?plannedOccurrenceIdForDate(item,dIso):null;
  var planSnap=occ?{occurrenceId:occ,templateSessionId:item.id||null,plannedDate:dIso,t:item.t||null,l:item.l||null,d:item.d||null,capturedAt:Date.now()}:null;
  /* v8-322: die geplanten Kraftvorgaben gehoeren IN den Snapshot. Vorher trug er
     nur t/l/d — die Uebungen, Saetze und Zielgewichte gingen beim Start
     verloren, und der spaetere Soll-Ist-Vergleich haette auf der Soll-Seite
     nichts zu vergleichen gehabt. Nur anhaengen, wenn tatsaechlich etwas
     geplant ist: sonst bliebe bei jeder Laufeinheit ein leeres Feld im
     unveraenderlichen Anker stehen. */
  try{
    var _pex=(window.ORVIA&&window.ORVIA.strengthPlan)?window.ORVIA.strengthPlan.readPlanned(item):[];
    if(planSnap&&_pex.length)planSnap.plannedExercises=_pex;
  }catch(e){}
  if(window.ORVIA&&window.ORVIA.workoutUI&&window.ORVIA.workoutUI.startSport)window.ORVIA.workoutUI.startSport(item.t,{planNote:note,planLabel:item.l,plannedSessionId:occ,templateSessionId:item.id||null,planSnapshot:planSnap});
  return {ok:true,code:'started'};
}
/* F1: geplante Einheit ohne Live-Tracking als erledigt markieren (heutiger Tag, lokale Quelle). */
/* Batch 2e/2f: „Als erledigt markieren" — FAIL CLOSED.
   P1A bleibt: KEINE erfundenen Messwerte/Dauer/Distanz/RPE. Batch 2f schließt
   den Scheinerfolg: vorher zeigte die Funktion IMMER den Erfolgstoast, auch
   wenn wegen einer bestehenden Session derselben Sportart nichts gespeichert
   wurde. Jetzt gilt:
   - vorhandene Trainingsdaten werden NIE überschrieben (ehrliche Ablehnung),
   - Planerfüllung wird eindeutig + idempotent über die Occurrence-ID gespeichert
     (wiederholter Klick auf dieselbe Occurrence ändert nichts),
   - ohne Plan-Referenz (keine Occurrence ableitbar) wird ehrlich abgelehnt —
     kein anker-loser Eintrag, kein improvisiertes Schatten-SSOT,
   - Erfolgstoast NUR nach verifizierter Speicherung (Rollback bei save-Fehler).
   Rückgabe { ok, code } für Tests/Aufrufer. */
function markPlannedDone(type,di,ii,dateIso){
  var result={ok:false,code:'error'};
  try{
    var it=null;
    try{it=(di!=null&&ii!=null&&typeof activeWeekPlan==='function')?(activeWeekPlan()[di]||[])[ii]:null;}catch(_){}
    /* v8-310a (Gians P0, zweiter Riegel): Erledigen NUR am Tag selbst. Der
       Datumskontext kommt vom Klick und wird hier verifiziert, nicht neu
       gerechnet — eine Markierung mit fremder Occurrence waere eine falsche
       Grundwahrheit fuer C3 und jede spaetere Auswertung. */
    /* v8-310a-Haertung: ohne Datumskontext keine Mutation — benannter Fehler. */
    if(!dateIso){
      result.code='missing_date_context';
      if(typeof toast==='function')toast('Nicht markiert — fehlender Datumskontext.');
      return result;
    }
    var dIso=dateIso;
    if(dIso!==todayStr()){
      result.code='not_today';
      if(typeof toast==='function')toast('Nicht markiert — Erledigen ist nur am Tag der Einheit möglich.');
      return result;
    }
    var occ=(it&&it.id&&typeof plannedOccurrenceIdForDate==='function')?plannedOccurrenceIdForDate(it,dIso):null;
    if(!occ){
      result.code='no_plan_reference';
      if(typeof toast==='function')toast('Nicht markiert — keine eindeutige Plan-Einheit gefunden.');
    }else{
      var e=entry(dIso);
      /* Batch 2h: Zustand VOR jeder Mutation sichern — EXISTENZ und WERT strikt
         getrennt (2g vermischte beides: sessions:null wurde bei Speicherfehler
         gelöscht statt als null wiederhergestellt).
         hadProp   = existierte die Property 'sessions' (unabhängig vom Wert)?
         prevWasUndefined = Property existierte mit Wert undefined (nicht
                            JSON-serialisierbar, eigener Restaurationsfall).
         prevJson  = JSON-kompatible tiefe Kopie des Altwerts (deckt null,
                     Objekte und alle JSON-Werte ab). */
      var hadProp=Object.prototype.hasOwnProperty.call(e,'sessions');
      var prevWasUndefined=hadProp&&e.sessions===undefined;
      var prevRef=hadProp?e.sessions:null;
      var prevJson=(hadProp&&!prevWasUndefined)?JSON.stringify(e.sessions):null;
      e.sessions=e.sessions||{};
      var ex=e.sessions[type];
      if(ex&&ex.source==='plan_done'&&ex.plannedSessionId===occ){
        // Idempotent: dieselbe Occurrence ist bereits markiert — nichts ändern.
        result={ok:true,code:'already_marked'};
        if(typeof toast==='function')toast(type+' war bereits als erledigt markiert.');
      }else if(ex){
        // Slot belegt (echte Trainingsdaten oder andere Occurrence): NIE überschreiben.
        result.code='slot_occupied';
        if(typeof toast==='function')toast('Nicht markiert — für heute existiert bereits ein '+type+'-Eintrag. Nichts überschrieben.');
      }else{
        /* Batch 2g: WIRKLICH fail-closed. Das reale save() (data.js) WIRFT bei
           Quota/Privatmodus/saveBlocked NICHT, sondern gibt false zurück — eine
           In-Memory-Prüfung nach dem Aufruf ist KEIN Persistenznachweis.
           Erfolg gilt ausschließlich bei save() === true. Vorher wird der
           vollständige vorherige Zustand gesichert (inkl. _ts und der Frage,
           ob sessions überhaupt existierte) und bei JEDEM Fehler byte-
           identisch wiederhergestellt. */
        function rollback(){
          try{
            if(!hadProp){
              // Property existierte nicht -> exakt so wiederherstellen (löschen).
              delete e.sessions;
            }else if(prevWasUndefined){
              // Property existierte MIT Wert undefined -> Zuweisung erhält die
              // Existenz (hasOwnProperty bleibt true), Wert wieder undefined.
              e.sessions=undefined;
            }else if(typeof prevJson==='string'){
              // Normalfall inkl. null: tiefe JSON-Kopie des Altwerts.
              e.sessions=JSON.parse(prevJson);
            }else{
              /* Altwert war nicht JSON-serialisierbar (im DB-Blob praktisch
                 unmöglich, da localStorage-JSON-Roundtrip) -> Referenz als
                 Best-Effort wiederherstellen statt Property zu löschen. */
              e.sessions=prevRef;
            }
          }catch(_){}
        }
        /* v8-322: derselbe Anker wie beim Live-Start — auch die ohne Messwerte
           abgehakte Einheit behaelt ihre Soll-Vorgaben. */
        var _pexDone=[];
        try{_pexDone=(window.ORVIA&&window.ORVIA.strengthPlan)?window.ORVIA.strengthPlan.readPlanned(it):[];}catch(_e){}
        var _snapDone={occurrenceId:occ,templateSessionId:it.id,plannedDate:dIso,t:it.t||null,l:it.l||null,d:it.d||null,capturedAt:Date.now()};
        if(_pexDone.length)_snapDone.plannedExercises=_pexDone;
        var rec={note:'Als erledigt markiert (ohne Messwerte)',source:'plan_done',
          plannedSessionId:occ,templateSessionId:it.id,
          planSnapshot:_snapDone};
        e.sessions=e.sessions||{};
        e.sessions[type]=rec;e.sessions._ts=Date.now();
        var persisted=false;
        if(typeof save!=='function'){
          rollback();
          result.code='save_unavailable';
          if(typeof toast==='function')toast('Speichern nicht möglich — nicht markiert.');
        }else{
          try{persisted=(save()===true);}
          catch(err){persisted=false;}
          if(persisted){
            result={ok:true,code:'marked'};
            if(typeof toast==='function')toast(type+' als erledigt markiert ✓');
          }else{
            rollback();
            result.code='save_failed';
            if(typeof toast==='function')toast('Speichern fehlgeschlagen — nicht markiert.');
          }
        }
      }
    }
  }catch(_){result.code='error';}
  try{if(typeof closeSupp==='function')closeSupp();}catch(e2){}
  if(typeof renderDay==='function')renderDay();
  if(typeof renderWeekPlan==='function')renderWeekPlan();
  return result;
}

/* v8-310b · Korrekturpfad 3: Ein plan_done-Marker ist eine datenlose
   Nutzerbehauptung und KEINE Activity. Deshalb wird bei der Ruecknahme nur
   exakt dieser Marker entfernt — ohne Tombstone, ohne Workout-Loeschung und
   ohne Eingriff in Tageslast oder andere Sessions. */
function planDoneMarkerFor(type,dateIso,occurrenceId){
  try{
    if(!type||!dateIso||!occurrenceId||typeof DB==='undefined'||!DB)return null;
    var e=DB[dateIso],s=e&&e.sessions&&e.sessions[type];
    return (s&&s.source==='plan_done'&&s.plannedSessionId===occurrenceId)?s:null;
  }catch(_){return null;}
}
function undoPlanDone(type,dateIso,occurrenceId){
  if(!type||!dateIso||!occurrenceId)return {ok:false,code:'missing_context'};
  var e=(typeof DB!=='undefined'&&DB)?DB[dateIso]:null;
  var marker=planDoneMarkerFor(type,dateIso,occurrenceId);
  if(!e||!e.sessions||!marker)return {ok:false,code:'marker_not_found'};
  var before;
  try{before=JSON.stringify(e.sessions);}catch(_){return {ok:false,code:'snapshot_failed'};}
  delete e.sessions[type];
  var remaining=Object.keys(e.sessions).filter(function(k){return k!=='_ts';});
  if(!remaining.length)delete e.sessions;
  else e.sessions._ts=Date.now();
  var saved=false;
  try{saved=(typeof save==='function'&&save()===true);}catch(_){saved=false;}
  if(!saved){
    try{e.sessions=JSON.parse(before);}catch(_){ }
    return {ok:false,code:'save_failed'};
  }
  try{if(typeof renderDay==='function')renderDay();}catch(_){ }
  try{if(typeof renderWeekPlan==='function')renderWeekPlan();}catch(_){ }
  try{if(typeof renderGMPlan==='function')renderGMPlan();}catch(_){ }
  try{if(window.dispatchEvent)window.dispatchEvent(new CustomEvent('orvia:activity-updated',{detail:{planDoneUndone:true,occurrenceId:occurrenceId}}));}catch(_){ }
  if(typeof toast==='function')toast('Erledigt-Markierung zurückgenommen');
  return {ok:true,code:'unmarked'};
}
function confirmUndoPlanDone(type,dateIso,occurrenceId){
  var run=function(){return undoPlanDone(type,dateIso,occurrenceId);};
  if(typeof orviaConfirm==='function'){
    orviaConfirm({title:'Erledigt-Markierung zurücknehmen?',text:'Es wird nur die manuelle Markierung entfernt. Echte Aktivitäten und Trainingsdaten bleiben unverändert.',okLabel:'Markierung entfernen',onOk:run});
    return {ok:true,code:'confirmation_open'};
  }
  return run();
}
/* Wochenziele NICHT mehr aus festen Defaults, sondern aus dem aktiven Plan ableiten. */
function weeklyPlanTargets(){
  var plan=(typeof activeWeekPlan==='function')?activeWeekPlan():null;var t={};
  if(plan){for(var i=0;i<7;i++){(plan[i]||[]).forEach(function(it){if(it&&it.t)t[it.t]=(t[it.t]||0)+1;});}}
  return t;
}
function renderGoals(){
  const box=document.getElementById('goalBox');if(!box)return;
  // DT1: Ist aus dem EINEN kanonischen Wochen-Vertrag (Store+Legacy dedupliziert), Soll strikt getrennt
  // aus Plan bzw. Präferenz. Dynamische Sichtbarkeit: Sportart erscheint bei Plan-Soll>0 ODER als
  // relevante Zielsportart (Profil, sessionsPerWeek>0) — NIE aus einer zufälligen Ist-Aktivität.
  var _acts=(window.ORVIA&&ORVIA.activityStore)?ORVIA.activityStore.listActivities():[];
  var _ts=(window.ORVIA&&ORVIA.activityStore&&ORVIA.activityStore.isTombstoned)?ORVIA.activityStore.isTombstoned:null;
  // DT1b: effektive Nutzerzeitzone (profileStore.effectiveTimezone) statt fester Konstante; weekRef = heutiges LOKALES Datum in DIESER tz.
  var _tz=(window.ORVIA&&ORVIA.profileStore&&ORVIA.profileStore.effectiveTimezone)?ORVIA.profileStore.effectiveTimezone():'UTC';
  var _ref=(window.ORVIA&&ORVIA.activityConfig&&ORVIA.activityConfig.dayOfActLocal)?ORVIA.activityConfig.dayOfActLocal({startedAt:new Date().toISOString()},_tz):todayStr();
  var _wk=(window.ORVIA&&ORVIA.activityConfig&&ORVIA.activityConfig.weeklyActivityTotals)?ORVIA.activityConfig.weeklyActivityTotals(_acts,DB,{weekRef:_ref,timezone:_tz,isTombstoned:_ts}):null;
  var _nS=(window.ORVIA&&ORVIA.trainingDomain&&ORVIA.trainingDomain.normSport)?ORVIA.trainingDomain.normSport:function(v){return String(v||'').toLowerCase();};
  function _ist(germanKey){if(!_wk)return 0;var sp=_nS(germanKey);return (_wk.bySport[sp]&&_wk.bySport[sp].sessionCount)||0;}
  const ICONMAP={Laufen:'run',Gym:'dumbbell',Rad:'bike',Schwimmen:'swim',Mobilität:'stretch'};
  const KEYMAP={running:'Laufen',gym:'Gym',cycling:'Rad',swimming:'Schwimmen',mobility:'Mobilität'};
  const order=['Laufen','Rad','Schwimmen','Gym','Mobilität'];
  const tgts=weeklyPlanTargets();
  var visible={};
  Object.keys(tgts).forEach(function(k){if(tgts[k]>0)visible[k]={tgt:tgts[k],ist:_ist(k)};});   // Plan-Soll
  var psports=(typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.sports))?PROFILE.sports:[];
  psports.forEach(function(s){if(!s)return;var gk=KEYMAP[_nS(s.sportId)];if(!gk||visible[gk])return;
    if(s.activeInApp!==false&&s.sessionsPerWeek!=null&&s.sessionsPerWeek>0)visible[gk]={tgt:s.sessionsPerWeek,ist:_ist(gk)};});   // Präferenz-Wochenziel
  var keys=order.filter(function(k){return visible[k];}).concat(Object.keys(visible).filter(function(k){return order.indexOf(k)<0;}));
  if(!keys.length){box.innerHTML='<p class="muted" style="margin:0">Wochenziele erscheinen, sobald dein Trainingsplan steht.</p>';return;}
  box.innerHTML=keys.map(function(key){var v=visible[key];var tgt=v.tgt;var icon=ICONMAP[key]||'target';var c=v.ist;
    var pct=tgt>0?Math.min(100,c/tgt*100):(c>0?100:0);var sollLabel=tgt>0?tgt:'–';
    return `<div class="goal"><div class="goalhead"><span>${ic(icon)}${key}</span><span>${c} / ${sollLabel}</span></div>
      <div class="goalbar"><i class="${tgt>0&&c>=tgt?'done':''}" style="width:${pct}%"></i></div></div>`;}).join('');}
/* Ziel-SSOT: Zielzeit-Änderung auf der Pace-Seite schreibt ZUERST ins kanonische
   Ziel (user_goals, unit 's' wie saveGoal), damit goalTargetMin() überall denselben
   Wert liest; der Legacy-Blob wird nur als Spiegel mitgeführt. */
function setHmTarget(){const t=numIn('hmTarget',60,240);if(t){
  try{var g=goalOf();if(g&&g._canonicalId&&typeof goalUpdate==='function'){
    goalUpdate(g._canonicalId,{metricType:'time',unit:'s',targetValue:Math.round(t*60)},'Zielzeit geändert (Pace-Seite)');}}catch(e){}
  DB._hmTargetMin=t;save();_goalCache=null;}renderPace();}
function renderPace(){
  const t=goalTargetMin();
  const inp=document.getElementById('hmTarget');if(inp&&document.activeElement!==inp)inp.value=t;
  const goal=buildGoal();
  const ref=goal.state!=='nodata'?goal.tPred:t;
  const rpT=t*60/Calc.HM_KM, rp=ref*60/Calc.HM_KM;
  const zone=(lab,lo,hi)=>`<div class="pace"><span>${lab}</span><b>${fmtPace(lo)}${hi?'–'+fmtPace(hi):''} /km</b></div>`;
  let html=`<div class="pace hero"><span><b>Ziel-Pace</b> · ${Calc.fmtTime(t)}</span><b>${fmtPace(rpT)} /km</b></div>`;
  if(goal.state!=='nodata')html+=`<div class="pace"><span>Aktuelle Fitness (Prognose ${Calc.fmtTime(goal.tPred)})</span><b>${fmtPace(rp)} /km</b></div>`;
  html+=zone('Easy / Z2',rp*1.18,rp*1.30)+zone('Long Run',rp*1.10,rp*1.18)
    +zone('Tempo',rp*0.97,rp*1.02)+zone('Intervalle (1km)',rp*0.90,rp*0.94);
  html+=`<p class="note" style="text-align:left">${goal.state!=='nodata'
    ?'Trainings-Zonen sind an deiner <b>aktuellen Fitness</b> verankert (nicht am Wunschziel) — das schützt vor systematischem Zu-schnell-Laufen.'
    :'Noch keine Fitness-Prognose — Zonen basieren vorerst auf der Zielzeit. '+ (goal.need||'')}</p>`;
  document.getElementById('paceBox').innerHTML=html;}
/* ============ ZIELPLANER + PACE-ZONEN (Phase 3) ============ */
const RACE_DIST={run_5k:5,run_10k:10,half_marathon:21.0975,marathon:42.195}; // R1.2: kanonische Keys; Lookups laufen über gcat()
const RACE_LABELS_P={run_5k:'5 km',run_10k:'10 km',half_marathon:'Halbmarathon',marathon:'Marathon'};
function raceLabel(t){return RACE_LABELS_P[gcat(t)];}
/* H2 (2026-07-11): EINE Ziel-Welt. goals[] (kanonisch, Wizard + Cloud-Sync) ist die
   Quelle — das Singular PROFILE.goal ist nur noch Legacy-Spiegel/Fallback. Damit
   erscheinen Wizard-Ziele endlich im Race-Header/Pace-Bereich und Race-Editor-Ziele
   synchronisieren in die Cloud. Kanonisch abgedeckt: die Standard-Laufdistanzen
   (RACE_DIST); custom-Distanzen laufen weiter über den Spiegel. */
function goalOf(){
  var p=(typeof PROFILE!=='undefined'&&PROFILE)?PROFILE:{};
  try{
    var gs=(typeof listGoals==='function')?listGoals():(Array.isArray(p.goals)?p.goals:[]);
    var cand=gs.filter(function(g){return g&&g.status==='active'&&RACE_DIST[gcat(g.category)];})
      .sort(function(a,b){return (a.priority||9)-(b.priority||9);})[0];
    if(cand){
      var ct=gcat(cand.category);
      var tm=null;
      /* FIX (2026-07-16, „Zielzeit offen"): metricType kann beim Cloud-Roundtrip verloren
         gehen (metric_type wird nur „wenn belegt" gesendet). Die EINHEIT gewinnt deshalb
         über metricType: 'min' → direkt; 's' oder time-Metrik → Sekunden/60; Legacy ohne
         Einheit → Minuten (hmTargetMin-Welt). */
      if(typeof cand.targetValue==='number'){
        if(cand.unit==='min')tm=cand.targetValue;
        else if(cand.unit==='s'||cand.metricType==='time')tm=cand.targetValue/60;
        else if(!cand.unit)tm=cand.targetValue;
      }
      return {type:ct,distanceKm:RACE_DIST[ct],raceDate:cand.targetDate||'',
        targetMin:tm,priority:'solide',_canonicalId:cand.id};
    }
  }catch(e){}
  // R1.2: Legacy-Spiegel beim Lesen kanonisieren (nicht mutieren).
  if(p.goal&&p.goal.distanceKm){var lt=gcat(p.goal.type);return lt===p.goal.type?p.goal:Object.assign({},p.goal,{type:lt});}
  // KEIN HM-Fallback mehr: das Ziel kommt ausschließlich aus dem Nutzerprofil.
  var t=gcat(p.primaryGoal||'health');var dist=RACE_DIST[t]||null;
  return {type:t,distanceKm:dist,raceDate:p.raceDate||'',
    targetMin:p.hmTargetMin||(t==='half_marathon'&&typeof DB!=='undefined'&&DB?DB._hmTargetMin:null)||null,priority:'solide'};
}
/* Ziel-SSOT (2026-07-18): EINE Lesequelle für die Zielzeit in Minuten.
   Kanonisches Ziel (goalOf → user_goals, dort pflegt der Ziel-Editor die
   Zielzeit) gewinnt; der Legacy-Blob-Wert DB._hmTargetMin ist NUR noch
   Fallback für Altbestände. Vorher lasen Zielkarte/buildGoal/Pace-Seite
   DB._hmTargetMin direkt und zeigten damit veraltete Zielzeiten an. */
function goalTargetMinOrNull(){
  try{var g=goalOf();if(g&&typeof g.targetMin==='number'&&isFinite(g.targetMin)&&g.targetMin>0)return g.targetMin;}catch(e){}
  var lg=(typeof DB!=='undefined'&&DB&&DB._hmTargetMin)||null;
  return (typeof lg==='number'&&isFinite(lg)&&lg>0)?lg:null;}
function goalTargetMin(){var t=goalTargetMinOrNull();return t!=null?t:110;}
/* Renn-/Distanzziel mit auswertbarer Distanz? (für HM-/Pace-/Prognose-Widgets) */
function isRunDistanceGoal(g){g=g||goalOf();return ['run_5k','run_10k','half_marathon','marathon'].indexOf(gcat(g.type))>=0;}
/* G0 (2026-07-19): Der Plan-Kopf zeigt das KANONISCHE aktive Hauptziel aus
   PROFILE.goals (alle Sportarten/Kategorien), nicht mehr ausschließlich Lauf-
   Distanzziele. Lauf-Wettkampfziele bekommen Zielzeit/-pace; alle anderen
   (Fußball, Gym, Körperfett, Technik, Saison, frei) bekommen allgemeine
   Zielinformationen bzw. klare nicht-anwendbare Zustände — keine HM-Felder.
   „Ziel bearbeiten" öffnet exakt dieses kanonische Ziel im Wizard (per ID);
   ohne Ziel lautet die Aktion „Ziel hinzufügen". */
function renderRaceHeader(){
  var el=document.getElementById('raceHeader');if(!el)return;
  var mg=(typeof mainGoalOf==='function')?mainGoalOf():null;
  if(!mg){
    el.innerHTML='<div class="racehead"><div class="rh-top"><span class="rh-name">Noch kein Ziel</span>'+
      '<button class="rh-edit" onclick="openGoalEditor()">Ziel hinzufügen</button></div>'+
      '<div class="rh-date">Lege ein Ziel fest, dann plant ORVIA darauf hin.</div></div>';
    return;
  }
  var runType=(typeof gcat==='function')?gcat(mg.category):mg.category;
  var isRun=['run_5k','run_10k','half_marathon','marathon'].indexOf(runType)>=0;
  var title=mg.title||(RACE_LABELS_P[runType])||(typeof goalCatLabel==='function'&&goalCatLabel(mg.category))||'Ziel';
  var d=mg.targetDate?daysTo(mg.targetDate):null;
  var dateTxt=mg.targetDate?new Date(mg.targetDate+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'long',year:'numeric'}):'kein Datum';
  var editBtn='<button class="rh-edit" onclick="openGoalEditor(\''+esc(mg.id)+'\')">Ziel bearbeiten</button>';
  if(isRun){
    var tm=null;
    if(typeof mg.targetValue==='number'){ if(mg.unit==='min')tm=mg.targetValue; else if(mg.unit==='s'||mg.metricType==='time')tm=mg.targetValue/60; else if(!mg.unit)tm=mg.targetValue; }
    var distKm=RACE_DIST[runType]||null;
    var phase=(d!=null&&d>=0)?Calc.racePhase(d):'—';
    var tgtTime=tm?Calc.fmtTime(tm):'offen';
    var tgtPace=(tm&&distKm)?Calc.fmtPace(tm*60/distKm)+'/km':'—';
    el.innerHTML='<div class="racehead">'+
      '<div class="rh-top"><span class="rh-name">'+escH(title)+'</span>'+editBtn+'</div>'+
      '<div class="rh-date">'+escH(dateTxt)+'</div>'+
      '<div class="rh-grid">'+
        '<div class="rh-cell"><span class="rh-num">'+(d!=null?(d>=0?d:'—'):'–')+'</span><span class="rh-lab">Tage</span></div>'+
        '<div class="rh-cell"><span class="rh-num">'+escH(tgtTime)+'</span><span class="rh-lab">Zielzeit</span></div>'+
        '<div class="rh-cell"><span class="rh-num">'+escH(tgtPace)+'</span><span class="rh-lab">Zielpace</span></div>'+
      '</div>'+
      '<div class="rh-phase">Phase: <b>'+escH(phase)+'</b></div></div>';
    return;
  }
  // Nicht-Lauf-Hauptziel: allgemeine Zielinfo, KEINE Zeit/Pace/Distanz-Felder.
  var catTxt=(typeof goalCatLabel==='function')?goalCatLabel(mg.category):mg.category;
  var tgt=(typeof mg.targetValue==='number')?('<div class="rh-cell"><span class="rh-num">'+escH(''+mg.targetValue)+(mg.unit?' '+escH(mg.unit):'')+'</span><span class="rh-lab">Zielwert</span></div>'):'';
  el.innerHTML='<div class="racehead">'+
    '<div class="rh-top"><span class="rh-name">'+escH(title)+'</span>'+editBtn+'</div>'+
    '<div class="rh-date">'+escH(catTxt)+' · '+escH(dateTxt)+'</div>'+
    '<div class="rh-grid">'+
      '<div class="rh-cell"><span class="rh-num">'+(d!=null?(d>=0?d:'—'):'–')+'</span><span class="rh-lab">Tage</span></div>'+
      tgt+
    '</div></div>';
}
/* G0: KANONISCHER Hauptziel-Selektor über ALLE Sportarten/Kategorien (niedrigste
   priority unter aktiven Zielen). Getrennt von goalOf() (Lauf-Wettkampfprojektion)
   und von der Bearbeitung-per-ID. Reine Lesefunktion, nicht-mutierend. */
function mainGoalOf(){
  try{
    var gs=(typeof listGoals==='function')?listGoals():((typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.goals))?PROFILE.goals:[]);
    if(!Array.isArray(gs))return null;
    var cand=gs.filter(function(g){return g&&g.status==='active';})
      .sort(function(a,b){return (a.priority||9)-(b.priority||9);})[0];
    return cand||null;
  }catch(e){return null;}
}
function renderPaceZones(){
  var el=document.getElementById('paceZonesBox');if(!el)return;
  var g=goalOf();
  if(!g.targetMin){var _peId=g&&g._canonicalId?("openGoalEditor('"+esc(g._canonicalId)+"')"):"openGoalEditor()";el.innerHTML='<p class="muted" style="margin:0">Lege eine Zielzeit fest, dann berechnet ORVIA deine Pace-Zonen. <button class="lexlink" onclick="'+_peId+'">Ziel bearbeiten</button></p>';return;}
  var zones=Calc.paceZones(g.distanceKm,g.targetMin);if(!zones){el.innerHTML='';return;}
  el.innerHTML=zones.map(function(z){
    var val=(z.lo===z.hi)?Calc.fmtPace(z.lo):Calc.fmtPace(z.lo)+'–'+Calc.fmtPace(z.hi);
    var hero=(z.k==='Zielpace')?' pz-hero':'';
    return '<div class="pz'+hero+'"><span class="pz-k">'+escH(z.k)+'</span><span class="pz-v">'+escH(val)+'<small> /km</small></span></div>';
  }).join('')+
  '<p class="note" style="text-align:left;margin-top:12px">Automatisch aus Zielzeit &amp; Distanz (Riegel-Modell). Richtwerte — bei Hitze, Müdigkeit oder Knie eher am langsameren Ende.</p>';
}
function gearChips(type,fieldId,sel){
  var gs=((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.gear)||[]).filter(function(x){return x.type===type;});
  if(!gs.length)return '';
  var label=type==='bike'?'Rad':'Schuhe';
  return '<div class="field"><label>'+label+'</label><div class="gm-chips" id="'+fieldId+'">'+
    '<button type="button" class="gm-chip'+(!sel?' on':'')+'" data-gid="" onclick="gmPick(this,\''+fieldId+'\')">—</button>'+
    gs.map(function(g){return '<button type="button" class="gm-chip'+(sel===g.id?' on':'')+'" data-gid="'+esc(g.id)+'" onclick="gmPick(this,\''+fieldId+'\')">'+esc(g.name)+'</button>';}).join('')+
    '</div></div>';
}
function gearSel(fieldId){var el=document.querySelector('#'+fieldId+' .on');return el?(el.getAttribute('data-gid')||null):null;}
function gmPick(btn,boxId){var box=document.getElementById(boxId);if(!box)return;[].forEach.call(box.children,function(c){c.classList.remove('on');});btn.classList.add('on');}
function parseTimeToMin(s){s=(s||'').trim();if(!s)return null;
  if(s.indexOf(':')>=0){var m=s.split(':');if(m.length!==2)return null;var h=parseInt(m[0],10),mi=parseInt(m[1],10);
    if(isNaN(h)||isNaN(mi)||h<0||mi<0||mi>=60)return null;return h*60+mi;}
  var n=parseFloat(s.replace(',','.'));return(isNaN(n)||n<=0)?null:n;}
/* G0 (2026-07-19): LEGACY/DEBUG-ONLY. Der alte Laufdistanz-Race-Editor. Er ist
   NICHT mehr der produktive Zieleditor und wird von keinem produktiven UI-Pfad
   aufgerufen — der vollständige sportübergreifende Wizard in profile.js
   (openGoalEditor(id)) ist die EINZIGE produktive Zielbearbeitung. Umbenannt, um
   die frühere globale Namenskollision (ui.js lädt nach profile.js) zu beseitigen.
   Nur zur Referenz erhalten; nicht verdrahten. */
function _legacyRaceGoalEditor(){
  closeGoalEditor();
  var g=goalOf();
  var types=[['run_5k','5 km'],['run_10k','10 km'],['half_marathon','Halbmarathon'],['marathon','Marathon'],['custom','Freie Distanz']]; // R1.2: nur kanonische IDs
  var prios=[['finish','Finish'],['solide','Solide Leistung'],['ambitioniert','Ambitionierte Zeit']];
  var tval=g.targetMin?Math.floor(g.targetMin/60)+':'+String(Math.round(g.targetMin%60)).padStart(2,'0'):'';
  var wrap=document.createElement('div');wrap.className='orvia-modal-bg';
  wrap.innerHTML='<div class="orvia-modal goal-modal"><h3>Ziel festlegen</h3>'+
    '<div class="gm-field"><label>Distanz</label><div class="gm-chips" id="gmType">'+types.map(function(t){return '<button type="button" class="gm-chip'+(g.type===t[0]?' on':'')+'" data-v="'+t[0]+'" onclick="gmPick(this,\'gmType\')">'+t[1]+'</button>';}).join('')+'</div></div>'+
    '<div class="gm-field"><label>Freie Distanz (km) — nur bei „Freie Distanz"</label><input type="number" inputmode="decimal" id="gmDist" placeholder="z. B. 15" value="'+escH(g.type==='custom'&&g.distanceKm?g.distanceKm:'')+'"></div>'+
    '<div class="gm-field"><label>Wettkampfdatum</label><input type="date" id="gmDate" value="'+escH(g.raceDate||'')+'"></div>'+
    '<div class="gm-field"><label>Zielzeit (Std:Min, z. B. 1:50)</label><input type="text" id="gmTime" inputmode="numeric" placeholder="1:50" value="'+escH(tval)+'"></div>'+
    '<div class="gm-field"><label>Priorität</label><div class="gm-chips" id="gmPrio">'+prios.map(function(t){return '<button type="button" class="gm-chip'+((g.priority||'solide')===t[0]?' on':'')+'" data-v="'+t[0]+'" onclick="gmPick(this,\'gmPrio\')">'+t[1]+'</button>';}).join('')+'</div></div>'+
    '<button class="btn" onclick="saveGoal()">Ziel speichern</button>'+
    '<button class="btn sec" style="margin-top:10px" onclick="closeGoalEditor()">Abbrechen</button></div>';
  document.body.appendChild(wrap);window._goalModal=wrap;
  wrap.addEventListener('click',function(e){if(e.target===wrap)closeGoalEditor();});
}
function closeGoalEditor(){if(window._goalModal){try{window._goalModal.remove();}catch(e){}window._goalModal=null;}}
function saveGoal(){
  if((typeof PROFILE==='undefined'||!PROFILE)&&typeof ensureProfile==='function')ensureProfile();
  var typeEl=document.querySelector('#gmType .on');var prioEl=document.querySelector('#gmPrio .on');
  var type=typeEl?typeEl.dataset.v:'half_marathon';
  var dEl=document.getElementById('gmDate');var date=dEl?dEl.value:'';
  var tEl=document.getElementById('gmTime');var targetMin=parseTimeToMin(tEl?tEl.value:'');
  var prio=prioEl?prioEl.dataset.v:'solide';
  var dist;
  if(type==='custom'){var dEl2=document.getElementById('gmDist');dist=dEl2?parseFloat((dEl2.value||'').replace(',','.')):null;if(!dist||dist<=0)dist=null;}
  else dist=RACE_DIST[type]||21.0975;
  var label=RACE_LABELS_P[type]||(type==='custom'?(dist?dist+' km':'Freie Distanz'):type);
  // H2: KANONISCH in goals[] schreiben (goalAdd/goalUpdate → commitGoals → _profileSave
  // → Event + Cloud-Sync). Das Singular PROFILE.goal bleibt nur als Legacy-Spiegel.
  try{
    if(typeof goalAdd==='function'&&typeof goalUpdate==='function'&&RACE_DIST[type]){
      var _cur=goalOf();
      var _patch={category:type,title:label+(targetMin?' unter '+Calc.fmtTime(targetMin):''),
        targetDate:date||null,metricType:'time',unit:'s',
        targetValue:targetMin!=null?Math.round(targetMin*60):null,status:'active'};
      if(_cur&&_cur._canonicalId)goalUpdate(_cur._canonicalId,_patch,'Zieldatum geändert');
      else goalAdd(Object.assign({priority:1},_patch),'Hauptziel geändert');
    }
  }catch(e){try{console.warn('[ORVIA] Kanonisches Ziel-Update fehlgeschlagen:',e&&e.message);}catch(_){}}
  PROFILE.goal={type:type,distanceKm:dist,raceDate:date,targetMin:targetMin,priority:prio};
  PROFILE.primaryGoal=type;PROFILE.primaryGoalLabel=label;
  PROFILE.raceName=label;PROFILE.raceDate=date;
  if(targetMin&&type==='half_marathon'){PROFILE.hmTargetMin=targetMin;if(typeof DB!=='undefined'&&DB)DB._hmTargetMin=targetMin;}
  if(typeof _goalCache!=='undefined')_goalCache=null;
  if(typeof saveProfile==='function')saveProfile();
  closeGoalEditor();renderPlan();
  if(typeof renderProfileScreen==='function')renderProfileScreen();
  if(typeof toast==='function')toast('Ziel gespeichert ✓');
}
function renderPlan(){flushAuto();renderRaceHeader();if(typeof renderRaceMode==='function')renderRaceMode();renderPaceZones();
  if(typeof renderPlanPauses==='function')renderPlanPauses();
  if(typeof renderWeekPlan==='function')renderWeekPlan();
  if(typeof renderPlanVariants==='function')renderPlanVariants();
  if(typeof renderPlanQuality==='function')renderPlanQuality();
  if(typeof renderForecast==='function')renderForecast();
  // Detailbereich IMMER sichtbar. Wochenplan + Wochenziele sind sportübergreifend; lauf-spezifische
  // Sektionen (Phasen/Umfang/Pace) bekommen für Nicht-Lauf-Ziele klare Empty-States statt zu verschwinden.
  var g=goalOf();var hm=document.getElementById('hmPlan');var pn=document.getElementById('planNote');
  if(hm)hm.style.display='';
  /* H5: toter #cdPlan-Container entfernt (wurde nur geleert, nie befuellt). */
  if(typeof renderGoals==='function')renderGoals();
  var isRun=(typeof isRunDistanceGoal==='function')&&isRunDistanceGoal(g);
  if(pn)pn.innerHTML='';
  renderPhases();  // sportübergreifend aus dem Wettkampfdatum (eigener Empty-State)
  if(isRun){
    renderRamp();renderPace();
  }else{
    var lbl=(typeof RACE_LABELS_P!=='undefined'&&RACE_LABELS_P[g.type])||g.type||'dein Ziel';
    _planEmpty('rampBox','Wochen-Umfang','Die Lauf-Umfangsrampe erscheint für Laufziele (5 km bis Marathon).');
    _planEmpty('paceBox','Renn-Pace','Konkrete Renn-Paces gibt es für Laufdistanzen. Für '+escH(lbl)+' zählen Trainingszonen und Belastungssteuerung.');
  }
}
function _planEmpty(id,h,p){var el=document.getElementById(id);if(el)el.innerHTML='<div class="empty-card"><div class="empty-h">'+escH(h)+'</div><p class="empty-p">'+p+'</p></div>';}

/* ============ ANALYTICS (Segmente) ============ */
let dashRange=14,seg='ueber';
function setRange(n){dashRange=n;renderDash();}
function setSeg(s){seg=s;renderDash();window.scrollTo(0,0);}
function series(days){const out=[];for(let i=days-1;i>=0;i--){const k=dkey(-i);out.push({k,e:DB[k]||null});}return out;}
/* KF-021 — Bestzeiten haben ab jetzt DREI Quellen in fester Rangfolge:
     1. GEMESSEN aus kanonischen Garmin-Runden (ORVIA.runBests.measuredRunBests)
     2. GEMESSEN aus manuell gepflegten Bestwerten (Legacy-Blob .best)
     3. GESCHAETZT aus der Durchschnittspace des schnellsten Laufs (Riegel)
   Innerhalb 1+2 gewinnt die schnellere ECHTE Zeit; 3 greift nur, wenn fuer die
   Distanz gar keine Messung existiert — und bleibt als Schaetzung etikettiert.

   Vorher gab es nur 2 und 3, und der Laufpool bestand ausschliesslich aus
   Legacy-Tagesblobs. Reine Garmin-Synchronisationen waren damit fuer die
   Bestzeiten unsichtbar (siehe Kommentar bei gmActPersonalBest). Folge: ein real
   gelaufener 1-km-Intervallsplit von 4:20 wurde von einer aus der
   Durchschnittspace abgeleiteten Schaetzung (4:37) verdeckt — eine Schaetzung,
   die eine vorhandene Messung ueberschrieb.

   `src` benennt je Distanz die tatsaechlich verwendete Quelle:
     'lap_window' | 'activity_total' | 'manual_best' | 'estimate' | null
   `real` bleibt bitgenau der bisherige Vertrag: true = echte Leistung, keine Schaetzung. */
function bestTimes(){
  var runs=[],seen={};
  Object.keys(DB).filter(isDay).forEach(function(k){var s=DB[k].sessions;if(!s||!s.Laufen)return;var r=s.Laufen;
    if(!((r.dist&&r.dur)||r.best))return;
    runs.push({day:k,dist:r.dist||null,dur:r.dur||null,best:r.best||null});
    if(r.dist&&r.dur)seen[k]=true;});
  /* KF-021: kanonische Store-/Garmin-Laeufe gehoeren in den Schaetzpool. Blob gewinnt
     je Tag (identische Dedupe-Regel wie runsWindow/_longestRunKm). */
  try{_storeRunSessions().forEach(function(x){if(seen[x.day])return;seen[x.day]=true;
    runs.push({day:x.day,dist:x.distKm,dur:x.durMin,best:null});});}catch(_){ }
  /* KF-021: gemessene Bestzeiten aus den kanonischen Runden. */
  var meas=null;
  try{var _rb=window.ORVIA&&ORVIA.runBests,_st=window.ORVIA&&ORVIA.activityStore;
    if(_rb&&_rb.measuredRunBests&&_st&&_st.listActivities)
      meas=_rb.measuredRunBests(_st.listActivities(),{isTombstoned:_st.isTombstoned||null});}catch(_){ }
  var rb={k1:null,k5:null,k10:null},src={k1:null,k5:null,k10:null};
  runs.forEach(function(r){if(!r.best)return;
    ['k1','k5','k10'].forEach(function(kk){var v=r.best[kk];
      if(v&&(rb[kk]==null||v<rb[kk])){rb[kk]=v;src[kk]='manual_best';}});});
  ['k1','k5','k10'].forEach(function(kk){var m=meas&&meas[kk];
    if(m&&m.sec!=null&&(rb[kk]==null||m.sec<rb[kk])){rb[kk]=m.sec;src[kk]=m.method;}});
  if(!runs.length&&rb.k1==null&&rb.k5==null&&rb.k10==null)return null;
  var elig=runs.filter(function(r){return r.dist>=2&&r.dur;});var est=null;
  if(elig.length){var best=elig.reduce(function(a,b){return (b.dur/b.dist)<(a.dur/a.dist)?b:a;});var proj=function(d){return Math.round(best.dur*Math.pow(d/best.dist,1.06)*60);};est={pace:(best.dur/best.dist)*60,dist:best.dist,t1:proj(1),t5:proj(5),t10:proj(10)};}
  var pick=function(kk,ek){if(rb[kk]!=null)return rb[kk];if(est){src[kk]='estimate';return est[ek];}return null;};
  var t1=pick('k1','t1'),t5=pick('k5','t5'),t10=pick('k10','t10');
  if(t1==null&&t5==null&&t10==null)return null;
  return {t1:t1,t5:t5,t10:t10,real:{k1:rb.k1!=null,k5:rb.k5!=null,k10:rb.k10!=null},
    src:src,meas:meas||null,
    estPace:est?est.pace:null,estDist:est?est.dist:null,n:runs.length};
}
/* Einheitliche Quellenetiketten fuer alle Bestzeiten-Renderer — EINE Formulierung,
   damit Kachel, Liste und Detailsheet nicht unterschiedlich behaupten koennen,
   woher ein Wert stammt. */
var GM_BT_SRC={lap_window:'gemessen · Runden aus der Uhr',activity_total:'gemessen · Aktivität',
  stream_window:'gemessen · Messreihe der Uhr',
  /* 2026-08-05: Abschnitt aus einer laengeren Einheit, dessen Zeit aus der Gesamtdauer
     gleichmaessig abgeleitet wurde (die Messreihe traegt keinen Zeitstempel). Die volle
     Dauer inkl. Pausen wird mitverteilt ⇒ der Wert ist eine Obergrenze, nie zu schnell.
     Bewusst als EIGENE Quelle benannt, nicht als Rundenmessung. */
  stream_uniform:'aus Messreihe abgeleitet (Abschnitt, Obergrenze)',
  manual_best:'eingetragene Bestleistung',estimate:'geschätzt (Riegel-Modell, keine Messung)'};
function gmBtSrcLabel(b,kk){
  var s=b&&b.src?b.src[kk]:null;
  if(!s)return GM_NA;
  var t=GM_BT_SRC[s]||GM_NA;
  var m=(b.meas&&b.meas[kk]&&(s==='lap_window'||s==='activity_total'))?b.meas[kk]:null;
  if(m&&m.km!=null)t+=' ('+(typeof fmtDe==='function'?fmtDe(m.km):m.km)+' km)';
  return t;
}
function gmBtSrcShort(b,kk){var s=b&&b.src?b.src[kk]:null;
  /* 2026-08-05: 'stream_uniform' beruht auf echten Distanzdaten, aber auf einer
     abgeleiteten Zeitachse — es waere unehrlich, das schlicht „gemessen" zu nennen,
     und ebenso unehrlich, es mit der reinen Riegel-Schaetzung gleichzusetzen.
     Deshalb eine dritte, eigene Kurzform. */
  if(s==='stream_uniform')return 'abgeleitet';
  return s==='estimate'?'geschätzt':(s?'gemessen':'—');}
function renderBestTimes(){
  var el=document.getElementById('bestTimesBox');if(!el)return;var b=bestTimes();
  if(!b){el.innerHTML=gmStateEmpty({icon:'run',title:'Noch keine Läufe',desc:'Bestzeiten erscheinen, sobald du Läufe loggst.'});return;}
  /* KF-021: Etikett folgt der TATSAECHLICHEN Quelle. „Strava" war seit dem
     Garmin-Sync ohnehin falsch und verdeckte, dass hinter „echt" eine Messung
     und hinter dem Rest eine Schaetzung steht. */
  /* 2026-08-05: Drei statt zwei Herkunftsstufen. „abgeleitet" (Abschnitt aus einer
     laengeren Einheit, Zeitachse aus der Gesamtdauer) darf weder als volle Messung
     gruen noch als blosse Schaetzung grau erscheinen — eigene, neutrale Stufe. */
  var cell=function(lbl,sec,kk){var s=b.src?b.src[kk]:null;
    var cls=(s==='stream_uniform')?'bt-derived':(b.real[kk]?'bt-real':'bt-est');
    return '<div class="bt"><span class="bt-d">'+lbl+'</span><span class="bt-t">'+(sec!=null?fmtPace(sec):'–')+'</span><span class="bt-src '+cls+'">'+escH(gmBtSrcShort(b,kk))+'</span></div>';};
  var anyReal=b.real.k1||b.real.k5||b.real.k10;
  var anyDerived=['k1','k5','k10'].some(function(k){return b.src&&b.src[k]==='stream_uniform';});
  /* Ehrliche Datenlage statt stillem „—": macht sichtbar, WORAUF die Werte beruhen
     und warum eine Distanz ggf. keine Messung hat (gemeldet als „die Bestzeiten
     werden immer noch nicht aus den Splits ermittelt"). */
  var _m=b.meas||{},_scan=null;
  try{_scan=(_m.scanned!=null)?_m:null;}catch(_){ }
  el.innerHTML='<div class="bt-grid">'+cell('1 km',b.t1,'k1')+cell('5 km',b.t5,'k5')+cell('10 km',b.t10,'k10')+'</div>'+
    '<p class="note" style="text-align:left;margin-top:10px">'+
    (anyReal?'„Gemessen" = echte Leistung aus deinen Runden bzw. Aktivitäten. ':'')+
    (anyDerived?'„Abgeleitet" = schnellster Abschnitt aus einer längeren Einheit; die Zeit stammt aus der Gesamtdauer der Aktivität und ist damit eine Obergrenze — nie zu schnell. ':'')+
    (b.estPace?'„Geschätzt" = aus deinem schnellsten Lauf ('+fmtDe(b.estDist)+' km @ '+fmtPace(b.estPace)+'/km, Riegel-Modell) — nur dort, wo keine Messung existiert.':'')+'</p>'+
    (_scan?('<p class="note" style="text-align:left;margin-top:6px;opacity:.75">Datenlage: '+_scan.scanned+' Läufe ausgewertet · '+_scan.withSplits+' mit Runden · '+(_scan.withStreams||0)+' mit Messreihe'+((_scan.withDerivedTime||0)?' (davon '+_scan.withDerivedTime+' ohne Zeitstempel — Zeit aus der Gesamtdauer abgeleitet)':'')+'.</p>'):'');
}
function renderDash(){
  flushAuto();
  if(typeof renderBestTimes==='function')renderBestTimes();
  if(typeof renderMuscleVolume==='function')renderMuscleVolume();
  if(typeof renderCompliance==='function')renderCompliance();
  if(typeof renderLoadBudget==='function')renderLoadBudget();
  if(typeof renderWeekInsights==='function')renderWeekInsights();
  if(typeof renderIntel==='function')renderIntel();
  if(typeof renderProExtras==='function')renderProExtras();
  document.getElementById('dashSegs').innerHTML=[['ueber','Überblick'],['ausdauer','Ausdauer'],['erholung','Erholung'],['koerper','Körper']]
    .map(([k,l])=>`<button class="${seg===k?'on':''}" onclick="setSeg('${k}')">${l}</button>`).join('');
  ['ueber','ausdauer','erholung','koerper'].forEach(s=>document.getElementById('seg-'+s).classList.toggle('hide',s!==seg));
  const showRange=seg==='erholung'||seg==='koerper';
  document.getElementById('rangeTabs').style.display=showRange?'flex':'none';
  if(showRange)document.getElementById('rangeTabs').innerHTML=[7,14,30,90].map(n=>`<button class="${n===dashRange?'on':''}" onclick="setRange(${n})">${n}T</button>`).join('');
  document.getElementById('chartWarn').innerHTML=chartOK()?'':'<div class="banner warn2">Charts brauchen einmalig Internet — die Bibliothek wird danach offline gecacht.</div>';
  if(seg==='ueber')renderSegUeber();else if(seg==='ausdauer')renderSegAusdauer();else if(seg==='erholung')renderSegErholung();else renderSegKoerper();
}
function kpi(n,l,col){return `<div class="k"><div class="n" style="color:${col||'var(--txt)'}">${n}</div><div class="l">${l}</div></div>`}
/* --- Überblick --- */
function renderSegUeber(){
  const S=series(14);const ready=S.map(s=>readinessOf(s.k));
  const last=[...S].reverse().find(s=>s.e&&s.e.morning);
  const r7=avg(ready.slice(-7));
  const goal=buildGoal();
  const lastR=last?readinessFor(last.k):null;
  document.getElementById('kpiBox').innerHTML=
    kpi(lastR&&lastR.score!==''?lastR.score+'%':'–','Readiness',lastR&&lastR.color)+
    kpi(r7!=null?Math.round(r7)+'%':'–','Ø Ready 7T')+
    kpi(last?last.e.morning.knee:'–','Knie heute',last?(last.e.morning.knee<=2?'var(--green)':last.e.morning.knee>=6?'var(--red)':'var(--yellow)'):'')+
    kpi((function(){var w=weekRunKm(0);return w==null?'–':w.toFixed(0);})(),'km diese Wo.')+
    (isRunDistanceGoal()
      ?kpi(goal.state!=='nodata'?Calc.fmtTime(goal.tPred):'–',(RACE_LABELS_P[goalOf().type]||'Ziel')+'-Prognose',goal.state==='ontrack'?'var(--green)':goal.state==='border'?'var(--yellow)':goal.state==='risk'?'var(--red)':'')
      :kpi('–','Prognose'))+
    kpi((()=>{const p=[];for(let i=0;i<7;i++){const e=DB[dkey(-i)];if(e&&e.eve&&e.eve.prot!=null)p.push(e.eve.prot);}const a=avg(p);return a!=null?Math.round(a)+'g':'–';})(),'Ø Protein 7T');
  renderGoalCard('goalDetail');
  renderInsights();renderACWRCard();renderStreaks();renderHeat();renderBadges();renderWeek();
  const ld=allLoads();
  drawForm('cForm',ld.loads,ld.labels);
  const labels=S.map(s=>new Date(s.k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));
  drawBarLine('cLoad',labels,{label:'Trainingslast',data:S.map(s=>Calc.sessionLoad(s.e)||null),color:'#c9ae7c'},{label:'Tagesform %',data:ready,color:'#16a34a'},{maxY2:100});
}
function renderGoalCard(elId){
  const el=document.getElementById(elId);if(!el)return;
  // Ziel-SSOT: Server-Aktivitäten nachladen (throttled, fire-and-forget) — neue
  // Läufe invalidieren den Goal-Cache und fließen beim nächsten Render ein.
  try{if(window.ORVIA&&ORVIA.activitySync&&ORVIA.activitySync.pullServerActivities)ORVIA.activitySync.pullServerActivities();}catch(e){}
  // Goal Engine (Riegel-Prognose) gilt nur für Lauf-Distanzziele. Sonst neutrale Zielkarte.
  if(!isRunDistanceGoal()){
    var gg=goalOf();var glabel=(typeof GOAL_LABELS!=='undefined'&&GOAL_LABELS[gg.type])||gg.type||'Allgemeine Gesundheit';
    el.innerHTML=`<div class="rtr" style="background:linear-gradient(135deg,#2a3342,#1a2330)">
      <h2 style="color:#fff;margin-bottom:8px">${ic('target')}Ziel · ${escH(glabel)}</h2>
      <div style="font-size:14px;line-height:1.5">Prognosen für eine konkrete Zielzeit gibt es für Lauf-Distanzen (5 km, 10 km, Halbmarathon, Marathon). Für dein Ziel zählt vor allem Konsistenz und Belastungssteuerung.</div></div>`;return;}
  const g=buildGoal();
  if(g.state==='nodata'){var _gtm=goalTargetMinOrNull();var tt=_gtm!=null?Calc.fmtTime(_gtm):'offen';
    el.innerHTML=`<div class="rtr" style="background:linear-gradient(135deg,#2a3342,#1a2330)">
    <h2 style="color:#fff;margin-bottom:8px">${ic('target')}${escH(RACE_LABELS_P[goalOf().type]||'Ziel')} · Ziel ${tt}</h2>
    <div style="font-size:14px;line-height:1.5">Noch keine belastbare Prognose. Nötig: ${g.need}. Aktuell: ${g.nRuns} Läufe, ${g.nQuality} Quality.</div></div>`;return;}
  const bg=g.state==='ontrack'?'linear-gradient(135deg,#0e9f6e,#056649)':g.state==='border'?'linear-gradient(135deg,#d97706,#92500a)':'linear-gradient(135deg,#e8345c,#9f1239)';
  const lab=g.state==='ontrack'?'ON TRACK':g.state==='border'?'GRENZWERTIG':'GEFÄHRDET';
  el.innerHTML=`<div class="rtr" style="background:${bg}">
    <h2 style="color:#fff;margin-bottom:8px">${ic('target')}Goal Engine · ${lab}</h2>
    <div style="font-size:14px;line-height:1.6">Prognose: <b>${Calc.fmtTime(g.tPred)}</b> (Riegel ${Calc.fmtTime(g.tRiegel)}${g.tEF?' · EF-Check '+Calc.fmtTime(g.tEF):''}) · Ziel ${Calc.fmtTime(g.target)} · Puffer ${g.delta>0?'+':''}${g.delta}%<br>
    ${g.vetos.length?'<b>Engpässe:</b> '+g.vetos.map(esc).join(' · '):'Alle bewertbaren Volumen-Gates erfüllt.'}<br>
    ${(g.notAssessable&&g.notAssessable.length)?'<b>Eingeschränkt bewertbar:</b> '+g.notAssessable.map(esc).join(', ')+' — Prognose mit reduzierter Sicherheit.<br>':''}
    <span style="opacity:.85;font-size:12px">Basis: ${g.nRuns} Läufe / ${g.nQuality} Quality in 42T. Riegel-Exponent 1,06; EF nur aus Easy-Z2.</span></div></div>`;
}
function renderACWRCard(){
  /* R1.4: zentraler loadModel-Vertrag statt eigener acwr-Rechnung (vorher zusätzlich
     auf slice(-42) — jetzt volle Historie, identisch zum Form-Chart). */
  const ld=allLoads();const lm=Calc.loadModel(ld.loads);
  const _lc=(ld&&ld.confidence)||null;   // I3a: Last-Provenienz/Confidence der Serie
  // I3a.2: bekannte Teilsumme/Untergrenze NUR aus ausschliesslich gemessener Last (measuredLoads) -
  // dieselbe EWMA-Formel (Calc.loadSeries), KEINE neue Lastformel. Anzeigevertrag je Confidence-Stufe.
  var _ctlLB=null;try{if(ld&&ld.measuredLoads&&ld.measuredLoads.length){var _lbS=Calc.loadSeries(ld.measuredLoads);_ctlLB=(_lbS.ctl&&_lbS.ctl.length)?Math.round(_lbS.ctl[_lbS.ctl.length-1]):null;}}catch(_e){}
  var _lcc=Calc.loadConfidenceContract?Calc.loadConfidenceContract(_lc):{tier:'hoch',suppressNumbers:false,ctlAtlNote:null,acwrTsbNote:null};
  const a=(lm&&lm.acwr!=null)?{ratio:lm.acwr,acute:lm.acute,chronic:lm.chronic,enough:lm.acwrReliable}:{ratio:null,acute:null,chronic:null,enough:false};
  let bg,txt,desc;
  if(!a.enough){bg='linear-gradient(135deg,#2a3342,#1a2330)';txt='–';desc='Lastsprung-Indikator erscheint nach ≥21 Tagen Trainingshistorie.';}
  else if(_lcc.suppressNumbers){bg='linear-gradient(135deg,#2a3342,#1a2330)';txt='nicht belastbar';desc='Lastserie unvollstaendig - ACWR aktuell nicht belastbar bewertbar.';}
  else if(a.ratio<0.8){bg='linear-gradient(135deg,#0ea5e9,#0369a1)';txt=a.ratio;desc='Akute Last unter Kapazität — Spielraum zum kontrollierten Aufbauen.';}
  else if(a.ratio<=1.3){bg='linear-gradient(135deg,#0e9f6e,#056649)';txt=a.ratio;desc='Optimaler Korridor (0,8–1,3) — Belastung und Kapazität im Gleichgewicht.';}
  else if(a.ratio<=1.5){bg='linear-gradient(135deg,#d97706,#92500a)';txt=a.ratio;desc='Erhöht — du steigerst schneller als die Basis mitwächst. Plateau halten.';}
  else{bg='linear-gradient(135deg,#e8345c,#9f1239)';txt=a.ratio;desc='Deutlicher Lastsprung (>1,5) — genau dieses Muster ging deiner Patella-Reizung voraus. Last senken.';}
  document.getElementById('acwrBox').innerHTML=`<div class="acwr" style="background:${bg}"><div class="al">Lastsprung-Indikator · ACWR (EWMA)</div><div class="ar">${txt}</div><div class="ad">${desc}${(a.enough&&!_lcc.suppressNumbers)?`<br><span style="opacity:.8;font-size:12px">Akut: ${a.acute} AU · Chronisch: ${a.chronic} AU/Wo</span>`:''}${(_lcc.ctlAtlNote||_lcc.acwrTsbNote)?`<br><span style="opacity:.85;font-size:12px">${[_lcc.acwrTsbNote,_lcc.ctlAtlNote,(_ctlLB!=null?('Bekannte Teilsumme (nur gemessen): CTL ca. '+_ctlLB+' AU.'):null)].filter(Boolean).join(' ')}</span>`:''}</div></div>`;}
function renderInsights(){const days=Object.keys(DB).filter(isDay).sort();let out=[];
  let mq=[],nq=[];days.forEach(k=>{const e=DB[k];if(e.morning&&e.morning.sleepQ!=null){((e.subs||[]).includes('Melatonin')?mq:nq).push(e.morning.sleepQ);}});
  if(mq.length>=3&&nq.length>=3){const d=avg(mq)-avg(nq);if(Math.abs(d)>=0.5)out.push(`Mit <b>Melatonin</b> ist deine Schlafqualität ${d>0?'+':''}${d.toFixed(1)} Punkte ${d>0?'höher':'niedriger'} (${avg(mq).toFixed(1)} vs ${avg(nq).toFixed(1)}).`);}
  let lo=[],hi=[];for(let i=1;i<days.length;i++){const p=DB[days[i-1]],c=DB[days[i]];if(p&&p.morning&&p.morning.sleepMin!=null&&c&&c.morning&&c.morning.knee!=null)(p.morning.sleepMin<420?lo:hi).push(c.morning.knee);}
  if(lo.length>=3&&hi.length>=3){const d=avg(lo)-avg(hi);if(Math.abs(d)>=0.4)out.push(`Nach Nächten <b>&lt;7h</b> ist dein Knie am Folgetag ${d>0?'+':''}${d.toFixed(1)} ${d>0?'höher':'niedriger'}.`);}
  let lh=[],ll=[];for(let i=1;i<days.length;i++){const p=DB[days[i-1]],c=DB[days[i]];if(p&&c&&c.morning&&c.morning.knee!=null)(Calc.sessionLoad(p)>=300?lh:ll).push(c.morning.knee);}
  if(lh.length>=3&&ll.length>=3){const d=avg(lh)-avg(ll);if(Math.abs(d)>=0.4)out.push(`Nach <b>hoher Last</b> (≥300 AU) ist dein Knie am Folgetag ${d>0?'+':''}${d.toFixed(1)} ${d>0?'höher':'niedriger'}.`);}
  const pd=days.map(k=>DB[k]).filter(e=>e.eve&&e.eve.prot!=null);if(pd.length>=3){const hit=pd.filter(e=>e.eve.prot>=150).length;out.push(`Protein-Ziel (≥150g) an <b>${hit}/${pd.length}</b> erfassten Tagen erreicht.`);}
  document.getElementById('insightBox').innerHTML=out.length?out.map(x=>`<div class="insight">${x}</div>`).join(''):'<p class="muted">Mehr Daten nötig — Insights erscheinen nach ~1 Woche Tracking.</p>';}
function streak(pred){let n=0;for(let i=0;i<400;i++){const e=DB[dkey(-i)];if(i===0&&!pred(e))continue;if(pred(e))n++;else break;}return n;}
function renderStreaks(){
  const issues=((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.issues)||[]);
  const ci=streak(e=>e&&e.morning);const mo=streak(e=>e&&e.routines&&e.routines.mob);
  let html=`<div class="streak"><div class="sn">${ci}</div><div class="sl">Check-in</div></div>`;
  if(issues.indexOf('knee')>=0){const ss=streak(e=>e&&e.routines&&e.routines.ss);
    html+=`<div class="streak"><div class="sn">${ss}</div><div class="sl">Spanish Squats</div></div>`;}
  html+=`<div class="streak"><div class="sn">${mo}</div><div class="sl">Mobility</div></div>`;
  document.getElementById('streakBox').innerHTML=html;}
function heatColor(k,e){const s=readinessOf(k);if(s==null)return (e&&e.sessions&&Object.keys(e.sessions).filter(x=>x!=='_ts').length)?'#1a2330':'#121a26';
  return s>=75?'#34d399':s>=60?'#1f8a66':s>=45?'#8a6d1f':'#7a2b3d';}
function renderHeat(){const today=new Date(todayStr()+'T12:00');let start=new Date(today);start.setDate(start.getDate()-83);
  const wd=(start.getDay()+6)%7;start.setDate(start.getDate()-wd);
  let html='';for(let d=new Date(start);d<=today;d.setDate(d.getDate()+1)){const k=todayStr(d);const e=DB[k];
    html+=`<div class="heatcell" style="background:${heatColor(k,e)}" title="${k}"></div>`;}
  document.getElementById('heatBox').innerHTML=html;}
function renderBadges(){const days=Object.keys(DB).filter(isDay);
  const last7=[];for(let i=0;i<7;i++){const e=DB[dkey(-i)];if(e&&e.morning&&e.morning.knee!=null)last7.push(e.morning.knee);}
  const B=[
    {ic:ic('swim'),t:'Erste 200m am Stück',d:'Schwimmen',on:days.some(k=>DB[k].sessions&&DB[k].sessions.Schwimmen&&(DB[k].sessions.Schwimmen.long||0)>=200)},
    {ic:ic('stretch'),t:'14-Tage Mobility',d:'Streak ≥14',on:streak(e=>e&&e.routines&&e.routines.mob)>=14},
    {ic:ic('pulse'),t:'Knie 7T <2',d:'7 Tage stabil',on:last7.length>=7&&Math.max(...last7)<2},
    {ic:ic('calendar'),t:'30 Check-ins',d:'Konsistenz',on:days.filter(k=>DB[k].morning).length>=30},
    {ic:ic('bike'),t:'30 km Ride',d:'Distanz',on:days.some(k=>DB[k].sessions&&DB[k].sessions.Rad&&(DB[k].sessions.Rad.dist||0)>=30)},
    {ic:ic('dumbbell'),t:'14-Tage Squats',d:'Reha-Disziplin',on:streak(e=>e&&e.routines&&e.routines.ss)>=14},
    {ic:ic('run'),t:'Comeback-Lauf',d:'Erster Lauf geloggt',on:days.some(k=>DB[k].sessions&&DB[k].sessions.Laufen)},
    {ic:ic('flag'),t:'10 km am Stück',d:'Lauf-Distanz',on:days.some(k=>DB[k].sessions&&DB[k].sessions.Laufen&&(DB[k].sessions.Laufen.dist||0)>=10)}];
  document.getElementById('badgeBox').innerHTML=B.map(b=>`<div class="badge${b.on?' on':''}"><div class="bi">${b.ic}</div><div><div class="bt">${b.t}</div><div class="bd">${b.d}</div></div></div>`).join('');}
function renderWeek(){const now=new Date();const day=(now.getDay()+6)%7;const mon=new Date(now);mon.setDate(now.getDate()-day);
  let gym=0,rad=0,radKm=0,swim=0,swimM=0,mob=0,run=0,runKm=0,knee=[],sleeps=[],bbs=[],protOk=0,prots=0,ss=0,mobR=0,mela=0;
  for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const e=DB[todayStr(d)];if(!e)continue;const s=e.sessions||{};
    if(s.Laufen){run++;runKm+=s.Laufen.dist||0;}if(s.Gym)gym++;if(s.Rad){rad++;radKm+=s.Rad.dist||0;}if(s.Schwimmen){swim++;swimM+=s.Schwimmen.dist||0;}if(s['Mobilität'])mob++;
    if(e.morning){if(e.morning.knee!=null)knee.push(e.morning.knee);if(e.morning.sleepMin)sleeps.push(e.morning.sleepMin/60);if(e.morning.bb!=null)bbs.push(e.morning.bb);}
    if(e.eve&&e.eve.prot!=null){prots++;if(e.eve.prot>=150)protOk++;}
    if(e.routines){if(e.routines.ss)ss++;if(e.routines.mob)mobR++;}
    if(e.subs&&e.subs.includes('Melatonin'))mela++;}
  const kAvg=avg(knee);const tr=Calc.trendDir(knee);
  document.getElementById('weekSummary').innerHTML=
    `<div class="weekrow"><span>${ic('run')}Laufen</span><b>${run}× · ${runKm.toFixed(1)} km</b></div>
     <div class="weekrow"><span>${ic('dumbbell')}Gym</span><b>${gym}×</b></div>
     <div class="weekrow"><span>${ic('bike')}Rad</span><b>${rad}× · ${radKm.toFixed(0)} km</b></div>
     <div class="weekrow"><span>${ic('swim')}Schwimmen</span><b>${swim}/2 · ${swimM} m</b></div>
     <div class="weekrow"><span>${ic('stretch')}Mobilität</span><b>${mob}×</b></div>
     <div class="weekrow"><span>${ic('pulse')}Ø Knie</span><b>${kAvg!=null?kAvg.toFixed(1)+'/10'+(tr?' · '+tr:''):'–'}</b></div>
     <div class="weekrow"><span>${ic('zzz')}Ø Schlaf</span><b>${avg(sleeps)!=null?avg(sleeps).toFixed(1)+'h':'–'}</b></div>
     <div class="weekrow"><span>${ic('battery')}Ø Body Battery</span><b>${avg(bbs)!=null?Math.round(avg(bbs))+'%':'–'}</b></div>
     <div class="weekrow"><span>${ic('nutrition')}Protein-Ziel-Tage</span><b>${protOk}/${prots}</b></div>
     <div class="weekrow"><span>${ic('dumbbell')}Spanish Squats</span><b>${ss}/7</b></div>
     <div class="weekrow"><span>${ic('stretch')}Sprunggelenk-Mob.</span><b>${mobR}/7</b></div>
     <div class="weekrow"><span>${ic('pill')}Melatonin</span><b>${mela}/7</b></div>`;}
/* --- Ausdauer --- */
function renderSegAusdauer(){
  renderFormFitnessV5();
  renderGoalCard('goalDetail2');
  // Nächster Lauf
  const e=DB[todayStr()];const m=e&&e.morning;
  let nrTxt='Morgen-Check-in nötig für eine Empfehlung.';
  // R1.3: Empfehlung aus der zentralen Tagesentscheidung (SSoT), keine eigene Ampel.
  if(m){const d0=(typeof getDecision==='function')?getDecision():null;
    if(d0)nrTxt=nextRunInfo(({GREEN:'g',YELLOW:'y',ORANGE:'o',RED:'r'})[d0.dayState]||'y',d0.score!=null?d0.score:0).txt;}
  document.getElementById('nextRunBox').innerHTML=`<div class="insight" style="border-left-color:var(--cyan)"><b>Nächster Lauf:</b> ${esc(nrTxt)}</div>`;
  // 80/20
  const runs28=runsWindow(28);const es=Calc.easyShare(runs28);
  const tooHard=runs28.filter(r=>Calc.easyTooHard(r)).length;
  let ezHtml;
  if(es==null)ezHtml='<p class="muted">Erscheint ab 6 Läufen in 28 Tagen.</p>';
  else{const pct=Math.round(es*100);const ok=pct>=75;
    ezHtml=`<div class="goal"><div class="goalhead"><span>Easy-Anteil (Ziel ≥80%)</span><span>${pct}%</span></div>
      <div class="goalbar"><i class="${ok?'done':''}" style="width:${pct}%${ok?'':';background:linear-gradient(90deg,#fbbf24,#d97706)'}"></i></div></div>
      <p class="note" style="text-align:left">${ok?'Polarisierung stimmt — harte Einheiten bleiben hart, leichte leicht.':'Zu viel Intensität: Easy-Läufe wirklich easy laufen (HF ≤157).'}${tooHard?' · '+tooHard+'× Easy zu hart (HF >78% max).':''}</p>`;}
  document.getElementById('split8020').innerHTML=ezHtml;
  // Wochensprung + LR
  // I2b: weeklyJump nur mit bekannten Wochen-km aufrufen — sonst kein Fehlalarm/keine Falschzahl.
  const _wkNowA=weekRunKm(0),_wkPrevA=weekRunKm(1);
  const jump=(_wkNowA!=null&&_wkPrevA!=null)?Calc.weeklyJump(_wkNowA,_wkPrevA):{lvl:'g',ratio:null,msg:null};
  const lrMax=_longestRunKm(28);   // I2c: längster EINZELlauf distanzbasiert (inkl. Store-/Garmin ohne .sub)
  const w=Math.ceil(Math.max(daysTo(RACE.date),1)/7);const[lo,hi]=Calc.lrTarget(w);
  document.getElementById('lrBox').innerHTML=
    (jump.msg?`<div class="insight" style="border-left-color:${jump.lvl==='r'?'var(--red)':'var(--yellow)'}">${esc(jump.msg)}</div>`:'')+
    `<div class="goal"><div class="goalhead"><span>Long Run max. (28T) · Soll ${lo}–${hi} km</span><span>${lrMax.toFixed(1)} km</span></div>
     <div class="goalbar"><i class="${lrMax>=lo?'done':''}" style="width:${Math.min(100,lrMax/hi*100)}%"></i></div></div>
     <p class="note" style="text-align:left">Steigerung max. +2 km pro Long Run — Sehnen mögen keine Sprünge.</p>`;
  // EF Chart (nur Easy-Z2)
  const efs=Calc.efSeries(runsWindow(90));
  const wrap=document.getElementById('efWrap');
  if(!efs.length){killChart('cEF');wrap.innerHTML='<p class="muted" style="padding-top:50px;text-align:center">Braucht Easy-Z2-Läufe mit Distanz, Dauer + HF (131–157 bpm).</p>';}
  else if(!chartOK())chartGuard('efWrap');
  else{wrap.innerHTML='<canvas id="cEF"></canvas>';
    drawLine('cEF',efs.map(p=>new Date(p.date+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})),
      [{label:'EF Easy-Z2 (m/min ÷ bpm)',data:efs.map(p=>p.ef),color:'#fb7185'}],{minAuto:true});}
  // Schwimmen
  renderSwimChart();
  // Interferenz heute
  const y=DB[dkey(-1)];const hl=Calc.heavyLegs(y&&y.sessions&&y.sessions.Gym);
  document.getElementById('interfBox').innerHTML=hl
    ?`<div class="insight" style="border-left-color:var(--yellow)">Gestern schweres Beintraining — Quality-Läufe heute eine Stufe runter.</div>`
    :`<p class="muted">Keine Bein-Lauf-Interferenz in den letzten 24h.</p>`;
}
function renderSwimChart(){
  const wrap=document.getElementById('swimWrap');
  const days=Object.keys(DB).filter(k=>isDay(k)&&DB[k].sessions&&DB[k].sessions.Schwimmen).sort();
  const pts=days.map(k=>{const s=DB[k].sessions.Schwimmen;
    return{k,long:s.long||null,pace:(s.dist&&s.dur)?+(s.dur*60/(s.dist/100)).toFixed(0):null};}).filter(p=>p.long||p.pace);
  if(!pts.length){killChart('cSwim');wrap.innerHTML=gmStateEmpty({icon:'drop',title:'Noch keine Schwimm-Einheiten',desc:'Sobald du eine Schwimmeinheit loggst, erscheint hier deine Entwicklung.'});return;}
  if(!chartOK()){chartGuard('swimWrap');return;}
  wrap.innerHTML='<canvas id="cSwim"></canvas>';
  drawBarLine('cSwim',pts.map(p=>new Date(p.k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})),
    {label:'Längste am Stück (m)',data:pts.map(p=>p.long),color:'#c9ae7c'},
    {label:'Pace s/100m',data:pts.map(p=>p.pace),color:'#16a34a'},{goalY:400,goalLabel:'Ziel 400m'});
}
/* --- Erholung --- */
function renderSegErholung(){
  renderRecoveryTilesV5();
  const S=series(dashRange);
  const labels=S.map(s=>new Date(s.k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));
  const g=f=>S.map(s=>s.e&&s.e.morning?s.e.morning[f]:null);
  const ready=S.map(s=>readinessOf(s.k));
  drawLine('cReady',labels,[{label:'Readiness %',data:ready,color:'#b89a60'},{label:'Knie',data:g('knee'),color:'#e11d48',y2:true}],{max:100});
  const hrvMs=g('hrvMs');
  const hrvAvg=hrvMs.map((_,i)=>{const win=[];for(let j=Math.max(0,i-6);j<=i;j++)if(hrvMs[j]!=null)win.push(hrvMs[j]);return win.length>=3?+avg(win).toFixed(0):null;});
  drawLine('cHRV',labels,[{label:'HRV (ms)',data:hrvMs,color:'#dcc79a'},{label:'Ø 7T',data:hrvAvg,color:'#b89a60'}],{minAuto:true});
  drawLine('cSleep',labels,[{label:'Std',data:S.map(s=>s.e&&s.e.morning&&s.e.morning.sleepMin!=null?+(s.e.morning.sleepMin/60).toFixed(2):null),color:'#c9ae7c'},{label:'Qualität',data:g('sleepQ'),color:'#8e7647',y2:true}],{max:12});
  drawLine('cBB',labels,[{label:'Body Batt %',data:g('bb'),color:'#16a34a'},{label:'Ruhepuls',data:g('rhr'),color:'#f59e0b',y2:true}],{max:100});
  const ctx=recoveryCtx(todayStr());
  document.getElementById('recovNote').innerHTML=
    `<div class="insight">Baselines (28T): Ruhepuls ${ctx.rhrBase!=null?Math.round(ctx.rhrBase)+' bpm':'– (braucht ≥7 Werte)'} · HRV-Datenpunkte ${ctx.hrvN}/14 nötig für Baseline-Score · Schlaf-Konto 7T: ${ctx.sleepDebtH!=null?'−'+ctx.sleepDebtH.toFixed(1)+'h':'–'}</div>`;
}
/* --- Körper --- */
function renderSegKoerper(){
  const S=series(dashRange);
  const labels=S.map(s=>new Date(s.k+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}));
  const w=S.map(s=>s.e&&s.e.morning?s.e.morning.weight:null);
  const wAvg=w.map((_,i)=>{const win=[];for(let j=Math.max(0,i-6);j<=i;j++)if(w[j]!=null)win.push(w[j]);return win.length>=2?+avg(win).toFixed(1):null;});
  drawLine('cWeight',labels,[{label:'kg',data:w,color:'#b89a60'},{label:'Ø 7T',data:wAvg,color:'#16a34a'}],{minAuto:true});
  drawLine('cProt',labels,[{label:'Protein g',data:S.map(s=>s.e&&s.e.eve?s.e.eve.prot:null),color:'#16a34a'}],{max:200,goal:150});
  // Gewichts-Hinweis: 7T-Schnitt jetzt vs. vor 4 Wochen
  const now7=[],prev7=[];
  for(let i=0;i<7;i++){const e=DB[dkey(-i)];if(e&&e.morning&&e.morning.weight!=null)now7.push(e.morning.weight);}
  for(let i=28;i<35;i++){const e=DB[dkey(-i)];if(e&&e.morning&&e.morning.weight!=null)prev7.push(e.morning.weight);}
  const hint=Calc.weightHint(avg(now7),avg(prev7));
  document.getElementById('weightHint').innerHTML=hint
    ?`<div class="insight" style="border-left-color:${hint.lvl==='g'?'var(--green)':'var(--yellow)'}">${esc(hint.txt)}</div>`
    :'<p class="muted">Gewichts-Trend erscheint nach ~5 Wochen Tracking.</p>';
}

/* ============ VERLAUF ============ */
let histFilter='alle',histLimit=60;
function renderHist(){
  flushAuto();
  document.getElementById('histChips').innerHTML=[['alle','Alle'],['lauf','Läufe'],['train','Training'],['notiz','Notizen']]
    .map(([k,l])=>`<button type="button" class="chip${histFilter===k?' on':''}" onclick="histFilter='${k}';histLimit=60;renderHist()">${l}</button>`).join('');
  let keys=Object.keys(DB).filter(isDay).sort().reverse();
  if(histFilter==='lauf')keys=keys.filter(k=>DB[k].sessions&&DB[k].sessions.Laufen);
  if(histFilter==='train')keys=keys.filter(k=>DB[k].sessions&&Object.keys(DB[k].sessions).filter(x=>x!=='_ts').length);
  if(histFilter==='notiz')keys=keys.filter(k=>DB[k].eve&&DB[k].eve.note);
  if(!keys.length){document.getElementById('histList').innerHTML='<p class="muted">Keine passenden Einträge.</p>';return;}
  const shown=keys.slice(0,histLimit);
  document.getElementById('histList').innerHTML=shown.map(k=>{const e=DB[k];const m=e.morning;
    const s=m?readinessFor(k):null;const dot=s&&s.color?s.color:'#2a3342';
    const dd=new Date(k+'T12:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'});
    let bits=[];if(s&&s.score!=='')bits.push(s.score+'%');if(m)bits.push('Knie '+m.knee);
    const st=Object.keys(e.sessions||{}).filter(x=>x!=='_ts');if(st.length)bits.push(st.map(x=>(TYPES[x]||{ic:''}).ic).join(''));
    if(e.eve&&e.eve.note)bits.push(ic('list'));
    return `<div class="hist" onclick="goEdit('${k}')"><span><span class="pill" style="background:${dot}"></span>${dd}</span><span class="muted">${bits.join(' · ')||'—'}</span></div>`;}).join('')
    +(keys.length>histLimit?`<button class="btn sec" style="margin-top:12px" onclick="histLimit+=60;renderHist()">Mehr laden (${keys.length-histLimit})</button>`:'');}
function goEdit(k){flushAuto();window._correctionMode=false;cur=k;renderDay();document.querySelector('.tabbar button[data-tab="heute"]').click();}

/* ============ PROFIL + AI REVIEW ============ */
function renderMehr(){
  const lb=DB._lastBackup;
  document.getElementById('backupStatus').innerHTML=lb
    ?`Letztes Backup: <b>${new Date(lb).toLocaleDateString('de-DE')}</b> (vor ${Math.floor((Date.now()-lb)/864e5)} Tagen)`
    :'Noch kein Backup gemacht.';
  document.getElementById('aiPreview').textContent=weekSummaryText();
  if(typeof renderProfileScreen==='function')renderProfileScreen();
  if(typeof renderDataHub==='function')renderDataHub();
  if(typeof renderLegalCard==='function')renderLegalCard();
}
function buildAIReview(){
  const tage=[];
  for(let i=6;i>=0;i--){const k=dkey(-i);const e=DB[k];if(!e)continue;
    const m=e.morning||{},ev2=e.eve||{},s=e.sessions||{};
    tage.push({datum:k,readiness:e.morning?readinessFor(k).score:null,knieMorgen:m.knee??null,knieAbend:ev2.knee??null,
      schlafH:m.sleepMin?+(m.sleepMin/60).toFixed(1):null,schlafQ:m.sleepQ??null,hrvMs:m.hrvMs??null,hrvStatus:m.hrv||null,
      rhr:m.rhr??null,bodyBattery:m.bb??null,gewicht:m.weight??null,doms:m.doms??null,protein:ev2.prot??null,energie:ev2.energy??null,notiz:ev2.note||null,
      einheiten:Object.keys(s).filter(t=>t!=='_ts').map(t=>{const x=s[t];return{typ:t,art:x.sub||null,km:x.dist??null,min:x.dur??null,hf:x.hr??null,rpe:x.rpe??null,kniePost:x.knee??null};})});}
  const goal=buildGoal();const runs28=runsWindow(28);
  const _wkNowB=weekRunKm(0),_wkPrevB=weekRunKm(1);
  const es=Calc.easyShare(runs28);const jump=(_wkNowB!=null&&_wkPrevB!=null)?Calc.weeklyJump(_wkNowB,_wkPrevB):{lvl:'g',ratio:null,msg:null};
  const ld=allLoads();const _lm=Calc.loadModel(ld.loads);
  // I3a.3: Last-Confidence bis in den Coach-Report durchreichen (bestehender Vertrag via
  // Calc.loadConfidenceContract, keine zweite Confidence-Logik). Roher acwr-Schlüssel bleibt
  // kompatibel, wird aber bei nicht belastbarer Last korrekt unterdrückt statt scheinpräzise.
  // I3a.6: Confidence-Auflösung FAIL-CLOSED normalisieren, BEVOR loadConfidenceContract
  // aufgerufen wird. Nur die drei gültigen Werte hoch/reduziert/not_assessable werden
  // durchgereicht; fehlend/leer/null/unbekannt wird konservativ zu not_assessable statt
  // (wie bisher über loadConfidenceContracts permissiven Fallback) stillschweigend zu hoch.
  const _lcRaw2=(ld&&ld.confidence!=null)?ld.confidence:null;
  const _lcValid2=(_lcRaw2==='hoch'||_lcRaw2==='reduziert'||_lcRaw2==='not_assessable');
  const _lc2=_lcValid2?_lcRaw2:'not_assessable';
  const _lcc2=Calc.loadConfidenceContract?Calc.loadConfidenceContract(_lc2):{tier:'hoch',suppressNumbers:false,ctlAtlNote:null,acwrTsbNote:null};
  const _acwrAssessable=!_lcc2.suppressNumbers&&!!(_lm&&_lm.acwr!=null);
  const ac={ratio:_acwrAssessable?_lm.acwr:null}; // R1.4
  // Reason bei fehlender/ungültiger Last-Confidence bleibt verständlich und unterscheidbar
  // von einer echten (gemeldeten) not_assessable-Lastserie — kein zweiter Reason-Vertrag.
  const _acwrReason2=_lcValid2?_lcc2.acwrTsbNote:'ACWR/TSB nicht belastbar (Last-Confidence fehlt oder ungültig: load_confidence_missing_or_invalid).';
  // I3a.5: estimated korrigiert — 'not_assessable' hatte bisher value:null UND estimated:true
  // (Widerspruch: kein Wert, aber angeblich geschätzt). Jetzt exakt: estimated ist NUR true,
  // wenn ein modellierter Wert tatsächlich vorhanden ist (assessable) UND die aufgelöste
  // Confidence 'reduziert' ist. Sonst (hoch, not_assessable, fehlend/ungültig) false.
  const acwrStatus={value:ac.ratio,confidence:_lc2||'hoch',assessable:_acwrAssessable,estimated:(_acwrAssessable&&_lc2==='reduziert'),reason:_acwrReason2,knownDays:(ld.completeness&&ld.completeness.knownDays!=null)?ld.completeness.knownDays:null};
  // I3a.4: Legacy-Feld `acwr` NUR bei belastbarer (hoher) Confidence numerisch. Bei 'reduziert'
  // (Modellschätzwert) und 'not_assessable' zwingend null, damit ein Legacy-Konsument, der
  // acwrStatus ignoriert, keine unmarkierte Schätzung als exakten Wert übernimmt. Der
  // Schätzwert bleibt ausschließlich in acwrStatus.value (estimated:true) sichtbar.
  const _acwrLegacy=((_lc2||'hoch')==='hoch')?acwrStatus.value:null;
  const warnungen=[];
  if(jump.msg)warnungen.push(jump.msg);
  if(es!=null&&es<0.75)warnungen.push('Easy-Anteil nur '+Math.round(es*100)+'% (Ziel ≥75–80%)');
  (goal.vetos||[]).forEach(x=>warnungen.push('Ziel-Veto: '+x));
  var _g=(typeof goalOf==='function')?goalOf():{};var _zl=((typeof RACE_LABELS_P!=='undefined'&&RACE_LABELS_P[_g.type])||_g.type||'Allgemeine Fitness')+(_g.raceDate?(' · '+_g.raceDate):'');
  return{erstellt:todayStr(),athlet:{name:(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.name)||'Athlet',alter:(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.age)||null,gewichtKg:(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weightKg)||null,hfMax:(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.hfMax)||null,ziel:_zl},
    hmPrognose:goal,acwr:_acwrLegacy,acwrStatus:acwrStatus,easyAnteilProzent28T:es!=null?Math.round(es*100):null,
    wochenKm:{aktuell:_wkNowB!=null?+_wkNowB.toFixed(1):null,vorwoche:_wkPrevB!=null?+_wkPrevB.toFixed(1):null,soll:Calc.weekKmTarget(daysTo(RACE.date),0)},
    warnungen,letzte7Tage:tage};
}
function weekSummaryText(){
  const r=buildAIReview();const g=r.hmPrognose;
  const ready=r.letzte7Tage.map(t=>t.readiness).filter(x=>x!=null);
  const runs=r.letzte7Tage.reduce((s,t)=>s+t.einheiten.filter(e=>e.typ==='Laufen').length,0);
  const lines=[
    'Woche bis '+r.erstellt+': '+(r.wochenKm.aktuell!=null?(r.wochenKm.aktuell+' km gelaufen'):'Wochen-km nicht bestimmbar')+' ('+runs+' Läufe, Soll '+r.wochenKm.soll+' km), Ø Readiness '+(ready.length?Math.round(Calc.avg(ready))+'%':'–')+'.',
    g.state==='nodata'?'HM-Prognose: noch nicht belastbar ('+g.nQuality+' Quality-Läufe).':'HM-Prognose: '+Calc.fmtTime(g.tPred)+' ('+(g.state==='ontrack'?'on track':g.state==='border'?'grenzwertig':'gefährdet')+') bei Ziel '+Calc.fmtTime(g.target)+'.',
    r.warnungen.length?'Warnungen: '+r.warnungen.join(' | '):'Keine aktiven Warnungen.'];
  return lines.join('\n');
}
function copyAIReview(){
  const j=JSON.stringify(buildAIReview(),null,1);
  var _g=(typeof goalOf==='function')?goalOf():{};var _gl=(typeof RACE_LABELS_P!=='undefined'&&RACE_LABELS_P[_g.type])||_g.type||'allgemeine Fitness';
  const prompt='Du bist mein Trainings-Coach. Ziel: '+_gl+(_g.raceDate?(' (Datum '+_g.raceDate+')'):'')+'. Analysiere die Woche: größter Engpass, konkrete Anpassung für nächste Woche, Risiken. Daten:\n'+j;
  navigator.clipboard.writeText(prompt).then(()=>toast('Coach Briefing kopiert ✓')).catch(()=>toast('Kopieren fehlgeschlagen'));
}
function copySummary(){navigator.clipboard.writeText(weekSummaryText()).then(()=>toast('Zusammenfassung kopiert ✓')).catch(()=>toast('Kopieren fehlgeschlagen'));}

/* ============ TABS + INIT ============ */
const TAB_TITLES={heute:'Heute',plan:'Plan',akt:'Aktivität',dash:'Insights',hist:'Verlauf'};
function setTopTitle(name){const el=document.getElementById('topTitle');if(el)el.textContent='';}
function renderTopAvatar(){const el=document.getElementById('tbAvatarInner');if(!el)return;
  var p=(typeof PROFILE!=='undefined'&&PROFILE)?PROFILE:{};
  /* 0016: Server-SoT zuerst (signierte Storage-URL, auf allen Geräten identisch), Base64 nur Fallback. */
  var src=(window.ORVIA&&ORVIA.avatarStore&&ORVIA.avatarStore.currentSrc)?ORVIA.avatarStore.currentSrc():(p.avatar||null);
  if(src)el.innerHTML='<img src="'+(typeof escH==='function'?escH(src):src)+'" alt="">';
  else el.textContent=((p.name||'O').trim()[0]||'O').toUpperCase();}
function showTab(name){
  // PERF-INSTRUMENTIERUNG (Audit 2026-07-15): misst nur den SYNCHRONEN Teil des Tabwechsels.
  // Renderer wie renderDash/renderMuscleVolume stoßen zusätzliche async Arbeit an, die hier
  // NICHT erfasst ist (separat instrumentiert in renderMuscleVolume/gymPipelineAsync).
  var _P=(window.ORVIA&&window.ORVIA.perf)||{now:function(){return Date.now();},mark:function(){}};
  var _tTab=_P.now();
  flushAuto();
  try{closeProfile();}catch(e){}                 // Profil-Overlay beim Tabwechsel schließen (Avatar oben rechts)
  ['heute','plan','akt','dash','hist','training'].forEach(t=>{var el=document.getElementById('tab-'+t);if(el)el.classList.add('hide');});
  var sel=document.getElementById('tab-'+name);if(sel)sel.classList.remove('hide');
  document.querySelectorAll('.tabbar button').forEach(x=>x.classList.toggle('on',x.dataset.tab===name));
  setTopTitle(name);
  // INCIDENT-FIX: jeden Tab-Renderer einzeln kapseln — ein Renderer-Fehler darf NIE
  // einen inkonsistenten Zustand hinterlassen (Button aktiv, Panel leer/falsch).
  function _safe(fn){var _t=_P.now();try{fn();}catch(e){try{console.error('[ORVIA showTab] Renderer-Fehler:',name,e&&e.message);}catch(_){}}_P.mark('showTab('+name+'): renderer (sync part)',_t);}
  if(name==='heute')_safe(renderDay);           // P1: Heute bei jedem Öffnen frisch
  if(name==='plan')_safe(renderPlan);if(name==='dash')_safe(renderDash);
  if(name==='hist')_safe(renderHist);if(name==='akt')_safe(renderAkt);
  if(name==='training'&&window.ORVIA&&window.ORVIA.workoutUI&&window.ORVIA.workoutUI.renderHub)_safe(window.ORVIA.workoutUI.renderHub);
  window.scrollTo(0,0);
  _P.mark('showTab('+name+'): TOTAL (sync part)',_tTab);}
/* v3-Shell: EINE delegierte, idempotente Tabbar-Bindung (kein Listener pro Button, keine Doppelbindung).
   Ziele: heute/plan/akt/dash via showTab; 'mehr' öffnet das bestehende Profil-Overlay (openProfile).
   Der FAB (#navPlus) gehört weiterhin den Quick-Actions (bindPlusButton) und hat kein data-tab. */
(function(){
  var wrap=document.querySelector('.tabwrap');if(!wrap||wrap.dataset.bound)return;wrap.dataset.bound='1';
  var ind=document.createElement('span');ind.className='glass-indicator';wrap.prepend(ind);
  var bar=wrap.closest('.tabbar');
  var lastTab='heute';
  function btnOf(name){return wrap.querySelector('button[data-tab="'+name+'"]');}
  /* aria-current gehoert an das TATSAECHLICH aktive Ziel — ohne das ist der aktive
     Zustand fuer Screenreader nur eine Farbe. Wird bei jedem Wechsel mitgefuehrt. */
  function markOn(name){wrap.querySelectorAll('button[data-tab]').forEach(function(x){
    var on=x.dataset.tab===name;x.classList.toggle('on',on);
    if(on)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');});}
  /* Liquid-Glass (2026-08-06): Die Kapsel bewegt sich per translate3d statt per
     `left` — `left` erzwingt in jedem Frame ein Layout, `transform` laeuft auf dem
     Compositor. Die Breite folgt weiterhin dem echten Tab (unterschiedlich lange
     Labels), wird aber nur bei ECHTER Aenderung geschrieben, damit ein Sync ohne
     Groessenwechsel keine Layoutarbeit ausloest. */
  var _indW=-1;
  function syncInd(anim){var b=wrap.querySelector('button[data-tab].on')||btnOf(lastTab);if(!b)return;
    var x=b.offsetLeft,w=b.offsetWidth;
    if(!(w>0))return;                                  /* Bar unsichtbar/nicht gelayoutet ⇒ nichts schreiben */
    if(anim===false)ind.style.transition='none';
    if(w!==_indW){ind.style.width=w+'px';_indW=w;}
    ind.style.transform='translate3d('+x+'px,0,0)';
    if(anim===false)requestAnimationFrame(function(){ind.style.transition='';});}
  window._orviaTabSync=function(){markOn(lastTab);syncInd();};
  /* Layoutwechsel, die kein resize-Event feuern (Schriftgroesse, Labelwechsel,
     Standalone-Statusleiste): ResizeObserver auf der Bar selbst — EIN Beobachter,
     nicht pro Button. */
  try{if(typeof ResizeObserver==='function'){
    var _ro=new ResizeObserver(function(){syncInd(false);});_ro.observe(wrap);}
  }catch(_){ }
  function goTab(name){
    if(!name)return;
    if(name==='mehr'){if(typeof openProfile==='function')openProfile();markOn('mehr');syncInd();return;}
    if(typeof profileOpen==='function'&&profileOpen()&&typeof closeProfile==='function')closeProfile();
    lastTab=name;
    var b=btnOf(name);if(b){b.classList.add('pop');setTimeout(function(){try{b.classList.remove('pop');}catch(e){}},400);}
    showTab(name);markOn(name);syncInd();
    /* Signal fuer die Scroll-Komprimierung: showTab scrollt nach oben, die Bar muss
       dann wieder voll ausgefahren sein. Ein Event statt einer direkten Kopplung —
       der Tabwechsel kennt die Bar-Optik nicht. */
    try{window.dispatchEvent(new CustomEvent('orvia:tab-changed',{detail:{tab:name}}));}catch(_){ }}
  /* Click nur für Tastatur/Assistive Tech (detail===0) — Pointer-Taps navigieren im pointerdown,
     weil setPointerCapture den Click auf die Wrap retargetet (verifiziert im Harness). */
  wrap.addEventListener('click',function(e){if(e.detail!==0)return;var b=e.target.closest('button[data-tab]');if(b)goTab(b.dataset.tab);});
  /* Tap + Drag: pointerdown navigiert sofort (v3-Verhalten); gedrückt halten und fahren wechselt live. */
  var drag=false,lastHit=null;
  function hit(x,y){var el=document.elementFromPoint(x,y);return el&&el.closest?el.closest('.tabwrap button[data-tab]'):null;}
  wrap.addEventListener('pointerdown',function(e){drag=true;lastHit=null;
    wrap.classList.add('dragging');   /* GM7: enges Folgen + Squash waehrend des Drags (CSS .dragging) */
    var b=hit(e.clientX,e.clientY);if(b){lastHit=b.dataset.tab;goTab(b.dataset.tab);}
    try{wrap.setPointerCapture(e.pointerId);}catch(_){}});
  wrap.addEventListener('pointermove',function(e){if(!drag)return;var b=hit(e.clientX,e.clientY);
    if(b&&b.dataset.tab!==lastHit){lastHit=b.dataset.tab;if(navigator.vibrate)try{navigator.vibrate(6);}catch(_){}goTab(b.dataset.tab);}});
  function endDrag(){drag=false;lastHit=null;wrap.classList.remove('dragging');}
  wrap.addEventListener('pointerup',endDrag);wrap.addEventListener('pointercancel',endDrag);
  /* Tastatur: Pfeile wechseln zwischen den fünf Zielen; Enter/Space native Button-Semantik. */
  wrap.addEventListener('keydown',function(e){
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
    var bs=[].slice.call(wrap.querySelectorAll('button[data-tab]'));
    var cur=document.activeElement&&document.activeElement.dataset?bs.indexOf(document.activeElement):-1;
    if(cur<0)cur=bs.findIndex(function(x){return x.classList.contains('on');});
    var n=bs[(cur+(e.key==='ArrowRight'?1:bs.length-1))%bs.length];
    if(n){n.focus();goTab(n.dataset.tab);e.preventDefault();}});
  window.addEventListener('resize',function(){syncInd(false);});
  window.addEventListener('orientationchange',function(){setTimeout(function(){syncInd(false);},260);});
  requestAnimationFrame(function(){syncInd(false);});

  /* ============================================================
     Scroll-Komprimierung (2026-08-06)

     Die Bar darf beim Lesen zurueckweichen, aber NIE verschwinden — sie ist die
     einzige Navigation. Deshalb nur eine Groessenaenderung (CSS .compact), kein
     Ausblenden und keine Positionsaenderung.

     STABILITAET: Ein naiver Vergleich „scrollt gerade nach unten" flackert bei
     jeder Mikrobewegung und bei iOS-Rubberbanding. Deshalb Hysterese: der Zustand
     wechselt erst, wenn seit dem letzten Wechsel mehr als THRESH Pixel in dieselbe
     Richtung zurueckgelegt wurden. Zusaetzlich bleibt die Bar in den obersten
     TOP_ZONE Pixeln immer voll ausgefahren.

     KOSTEN: passiver Listener, der ausschliesslich einen Wert merkt; die eigentliche
     Auswertung laeuft einmal pro Frame in rAF und schreibt nur bei ECHTEM
     Zustandswechsel ins DOM. Kein Layout-Lesen im Scroll-Handler.
     ============================================================ */
  (function(){
    if(!bar)return;
    var THRESH=44,TOP_ZONE=90;
    var lastY=0,anchor=0,compact=false,ticking=false,dir=0;
    function apply(){
      ticking=false;
      var y=window.pageYOffset||document.documentElement.scrollTop||0;
      if(y<0)y=0;                                      /* iOS-Overscroll nach oben */
      if(y<=TOP_ZONE){ if(compact){compact=false;bar.classList.remove('compact');} lastY=y;anchor=y;dir=0;return; }
      var d=y-lastY;
      /* Bezugspunkt beim Richtungswechsel ist die VORHERIGE Position, nicht die
         aktuelle. Sonst waere `moved` im selben Frame immer 0 — ein Sprung-Scroll
         (scrollTo, Anker, Tastatur) haette die Komprimierung nie ausgeloest, weil
         Richtungswechsel und Bewegung im selben Ereignis liegen. */
      if(d>0&&dir!==1){dir=1;anchor=lastY;}
      else if(d<0&&dir!==-1){dir=-1;anchor=lastY;}
      lastY=y;
      var moved=y-anchor;
      if(dir===1&&moved>THRESH&&!compact){compact=true;bar.classList.add('compact');}
      else if(dir===-1&&(anchor-y)>THRESH&&compact){compact=false;bar.classList.remove('compact');}
    }
    window.addEventListener('scroll',function(){
      if(ticking)return;ticking=true;requestAnimationFrame(apply);
    },{passive:true});
    /* Tabwechsel scrollt nach oben ⇒ Zustand sofort zuruecksetzen, sonst bliebe die
       Bar faelschlich komprimiert. */
    window.addEventListener('orvia:tab-changed',function(){
      compact=false;dir=0;lastY=0;anchor=0;try{bar.classList.remove('compact');}catch(_){ }
    });
  })();

  /* ============================================================
     Specular-Highlight (2026-08-06) — nur auf Geraeten mit ECHTEM Zeiger.
     Auf Touch waere es entweder unsichtbar oder eine Dauerlast; die Media Query
     schliesst das aus, bevor ueberhaupt ein Listener entsteht. Reduced Motion
     schaltet es ebenfalls ab.
     ============================================================ */
  (function(){
    var fine=false,noMotion=false;
    try{fine=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;}catch(_){ }
    try{noMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;}catch(_){ }
    if(!fine||noMotion)return;
    /* Die Variablen sitzen auf .tabglass — dort liegt die Specular-Ebene
       (.tabglass::after). .tabwrap::after ist von einer frueheren Generation belegt
       und bewusst abgeschaltet. */
    /* EINE Mechanik fuer beide Glaskoerper: die Bar (Variablen auf .tabglass, dort
       liegt .tabglass::after) und den Plus-Button (Variablen auf ihm selbst, sein
       ::after traegt das Highlight). .tabwrap::after ist von einer frueheren
       Generation belegt und bewusst abgeschaltet. */
    function bindSpecular(host,target){
      if(!host||!target)return;
      var raf=0,px=0,py=0;
      function paint(){raf=0;target.style.setProperty('--sx',px+'px');target.style.setProperty('--sy',py+'px');}
      host.addEventListener('pointermove',function(e){
        if(e.pointerType==='touch')return;
        var r=host.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top;
        if(!raf)raf=requestAnimationFrame(paint);
      },{passive:true});
      host.addEventListener('pointerenter',function(e){if(e.pointerType!=='touch')target.style.setProperty('--spec-o','1');});
      host.addEventListener('pointerleave',function(){target.style.setProperty('--spec-o','0');
        if(raf){cancelAnimationFrame(raf);raf=0;}});
    }
    bindSpecular(wrap,wrap.querySelector('.tabglass')||wrap);
    try{var fab=document.getElementById('navPlus');if(fab)bindSpecular(fab,fab);}catch(_){ }
  })();
})();
function openProfile(){
  if(typeof renderMehr==='function')renderMehr();
  if(window.renderAccountCard)renderAccountCard();
  if(typeof renderNutritionConfig==='function')renderNutritionConfig();
  if(typeof renderEquipment==='function')renderEquipment();
  if(typeof renderLevelBox==='function')renderLevelBox();
  if(typeof renderTrainingSetup==='function')renderTrainingSetup();
  if(typeof renderCycle==='function')renderCycle();
  if(typeof applyLevelClass==='function')applyLevelClass();
  document.body.classList.add('profile-open');
  var el=document.getElementById('tab-mehr');if(el){el.classList.remove('hide');}
  // Browser-Back schließt zuerst das Profil-Overlay (History-State pushen).
  try{if(!history.state||!history.state.orviaProfile)history.pushState({orviaProfile:true},'');}catch(_){}
  window.scrollTo(0,0);}
function profileOpen(){return document.body.classList.contains('profile-open');}
function closeProfile(fromPop){var was=profileOpen();document.body.classList.remove('profile-open');var el=document.getElementById('tab-mehr');if(el)el.classList.add('hide');if(typeof window._orviaTabSync==='function')try{window._orviaTabSync();}catch(_){ }
  // Wenn direkt geschlossen (nicht via Back): den gepushten History-Eintrag konsumieren.
  if(was&&!fromPop){try{if(history.state&&history.state.orviaProfile)history.back();}catch(_){}}}
window.addEventListener('popstate',function(){if(profileOpen())closeProfile(true);});
function closeAllOverlays(){
  try{if(typeof closeSupp==='function')closeSupp();}catch(e){}
  try{closeProfile();}catch(e){}
  try{document.querySelectorAll('.orvia-modal-bg').forEach(function(m){m.remove();});}catch(e){}
  window._goalModal=window._nutModal=window._actModal=window._maModal=null;}
function gotoHist(){closeProfile();showTab('hist');}
/* renderAkt() ist der Kompatibilitäts-Wrapper um ORVIA.activity.render (GM3-Pfad, unten). */
document.getElementById('suppModal').addEventListener('click',e=>{if(e.target.id==='suppModal')closeSupp();});
/* Tastatur: Tabbar ausblenden, wenn iOS-Keyboard offen */
if(window.visualViewport){visualViewport.addEventListener('resize',()=>{
  const kb=window.innerHeight-visualViewport.height>120;
  document.querySelector('.tabbar').classList.toggle('kb',kb);});}
/* Profil laden + Race/Ziel synchronisieren; Onboarding bei frischer Installation */
const _profileExisted=(typeof ensureProfile==='function')?ensureProfile():true;
if(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.hmTargetMin&&DB._hmTargetMin==null)DB._hmTargetMin=PROFILE.hmTargetMin;
renderDay();
// App startet IMMER auf „Heute" (kein Wiederherstellen des letzten Tabs). Aktive Workout-Session
// wird nur im Hintergrund hydriert (tryRestore), ohne Tab-Wechsel oder Overlay.
try{localStorage.removeItem('orvia_tab');}catch(e){}
if(!_profileExisted&&Object.keys(DB).filter(isDay).length===0&&typeof window.openOrviaOnboarding==='function'&&!(window.ORVIA_CFG&&window.ORVIA_CFG.configured))setTimeout(()=>window.openOrviaOnboarding({fresh:true,source:'firstrun'}),350);
/* P6 (c): Slider-Berührung markieren, BEVOR autoMorning speichert — nur bewusst
   angefasste Slider zählen als Messwert (siehe _sliderVal in gatherMorning). */
document.getElementById('morningForm').addEventListener('input',e=>{try{if(e&&e.target&&e.target.type==='range'&&e.target.dataset)e.target.dataset.dirty='1';}catch(_){}debounce('m',autoMorning);});
document.getElementById('morningForm').addEventListener('click',e=>{if(e.target.closest('.chip'))autoMorning();});
/* FIX #16.8 (2026-07-02): #postBlocks wurde in Phase 4.2 aus index.html entfernt (Heute ohne
   Post-Logger); der ungeschützte Zugriff warf bei JEDEM Laden und blockierte den restlichen
   Init-Block (eveForm-Listener, pagehide-/visibilitychange-Flush, SW-Registrierung). Null-Guard. */
var _pbEl=document.getElementById('postBlocks');
if(_pbEl){
  _pbEl.addEventListener('input',()=>debounce('p',autoPost));
  _pbEl.addEventListener('click',e=>{if(e.target.closest('.chip'))autoPost();});
}
document.getElementById('eveForm').addEventListener('input',e=>{try{if(e&&e.target&&e.target.type==='range'&&e.target.dataset)e.target.dataset.dirty='1';}catch(_){}debounce('e',autoEve);});
/* Ziel-SSOT: nach einem Server-Activity-Pull sichtbare Zielkarten aktualisieren. */
window.addEventListener('orvia:activities-pulled',function(){try{
  ['goalDetail','goalDetail2'].forEach(function(id){if(document.getElementById(id))renderGoalCard(id);});
}catch(e){}});
document.getElementById('eveForm').addEventListener('click',e=>{if(e.target.closest('.chip'))autoEve();});
window.addEventListener('pagehide',function(){flushAuto();if(window.orviaFlushSync)window.orviaFlushSync();});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){flushAuto();if(window.orviaFlushSync)window.orviaFlushSync();}});
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('sw.js');


/* ====== Kompakter Check-in (v5): Statuskarte aus ECHTEN Daten, Formular bleibt im DOM ====== */
function expandCheckinCard(){var c=document.getElementById('checkinCard');if(c)c.classList.remove('ci-collapsed');var b=document.getElementById('checkinCompact');if(b)b.setAttribute('aria-expanded','true');}
function collapseCheckinCard(){var c=document.getElementById('checkinCard');if(c)c.classList.add('ci-collapsed');var b=document.getElementById('checkinCompact');if(b)b.setAttribute('aria-expanded','false');}
/* GM6: einziger Einstieg „Check-in starten". Der Ablauf (erst aufklappen, dann
   zum Formular scrollen) stand bisher zweimal als inline-JS in HTML-Attributen
   (Hero-Empty und .ci-simple) und war dort doppelt escaped. Eine benannte
   Funktion ruft ausschliesslich die bereits vorhandenen sicheren Aktionen auf —
   kein neuer Zustand, keine Persistenz, kein zusaetzlicher Request. */
function gotoCheckinForm(){try{expandCheckinCard();document.getElementById('morningForm').scrollIntoView({behavior:'smooth',block:'start'});}catch(_){}}
function toggleCheckinCard(){var c=document.getElementById('checkinCard');if(!c)return;
  if(c.classList.contains('ci-collapsed')){expandCheckinCard();try{c.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){}}
  else collapseCheckinCard();}
/* GM6: toter Legacy-Check-in (.cic-Markup) entfernt — die GM-Version weiter
   unten hat ihn ohnehin ueberschrieben. Keine Verhaltensanderung (§3). */
/* Quick-Action „Check-in" führt zum Formular → vorher aufklappen (Wrap, quick-actions.js bleibt unberührt). */
(function(){function wrap(){try{var qa=window.ORVIA&&window.ORVIA.quickActions;if(!qa||qa._ciWrapped||typeof qa.gotoMorningCheckin!=='function')return;qa._ciWrapped=1;
  var o=qa.gotoMorningCheckin;qa.gotoMorningCheckin=function(){try{expandCheckinCard();}catch(_){ }return o.apply(this,arguments);};}catch(_){ }}
  wrap();if(document.readyState!=='complete')window.addEventListener('load',wrap);setTimeout(wrap,400);})();


/* ====== D1: Form & Fitness (Ausdauer) — kanonisches Lastmodell → ORVIA.charts.richChart.
   REINE Darstellung: Serien ausschliesslich aus allLoads() + Calc.loadSeries (SSOT, keine
   eigene EWMA). Missingness ueber Calc.loadConfidenceContract: suppressNumbers ⇒ Empty-State
   (nie 0-Kurven); <14 Tage Historie ⇒ ehrlicher Partial-State. uiDetailMode aendert NUR den
   Erklaertext, nie die Zahlen. Ueberblick-cForm (Chart.js) bleibt unveraendert. ====== */
function renderFormFitnessV5(){
  var host=document.getElementById('formFitnessV5');if(!host)return;
  try{
    if(!(window.ORVIA&&window.ORVIA.charts&&window.ORVIA.charts.richChart)){
      host.innerHTML=gmStateError({icon:'alert',title:'Diagramm-Modul nicht geladen.',desc:'Die Kurve erscheint nach einem vollständigen Laden der App wieder.'});return;}
    var ld=allLoads();
    var lcc=(typeof Calc!=='undefined'&&Calc.loadConfidenceContract)?Calc.loadConfidenceContract(ld.confidence):{tier:'hoch',suppressNumbers:false,ctlAtlNote:null};
    if(lcc.suppressNumbers){
      /* Partial/unbelastbar: GM-Empty statt Legacy-Absatz — keine erfundene Kurve. */
      host.innerHTML=gmStateEmpty({icon:'chart',title:'Form-Kurve noch nicht belastbar',desc:lcc.ctlAtlNote||'CTL/ATL nicht belastbar — die Lastserie ist unvollständig.'});return;}
    var S=Calc.loadSeries(ld.loads||[]);var n=(S.ctl||[]).length;
    if(n<14){
      host.innerHTML=gmStateEmpty({icon:'chart',title:'Noch zu wenig Lasthistorie',desc:'Erst '+n+' Tage erfasst — die Form-Kurve erscheint ab 14 Tagen, wenn das 42-Tage-Fitnessmodell aussagekräftig wird.'});return;}
    var k=Math.min(28,n);
    var ctl=S.ctl.slice(-k).map(function(v){return Math.round(v);});
    var atl=S.atl.slice(-k).map(function(v){return Math.round(v);});
    var tsb=S.tsb.slice(-k).map(function(v){return Math.round(v);});
    var labels=(ld.labels||[]).slice(-k);
    var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
    var cT=ctl[k-1],aT=atl[k-1],tT=tsb[k-1];
    var legend='<div class="ffv-legend">'+
      '<span><i style="background:var(--accent,#C9AE7C)"></i>Fitness <b>'+cT+'</b></span>'+
      '<span><i style="background:var(--crit,#F0637A)"></i>Ermüdung <b>'+aT+'</b></span>'+
      '<span><i style="background:var(--ready,#43D693)"></i>Form <b>'+(tT>0?'+':'')+tT+'</b></span></div>';
    var expl=mode==='anfaenger'
      ?'Gold = wie fit du bist. Liegt Grün (Form) über null, bist du frisch — unter null brauchst du Erholung.'
      :mode==='profi'
        ?'CTL = EWMA(42) der kanonischen Tageslast (sRPE), ATL = EWMA(7), Form (TSB) = CTL − ATL. Letzte '+k+' Tage; Scrubbing auf der Fitness-Kurve (Touch/Maus/Pfeiltasten).'
        :'Fitness baut sich über Wochen auf, Ermüdung über Tage — Form ist die Differenz. Deutlich positiv = frisch, stark negativ = überlastet.';
    host.innerHTML=legend+'<div class="oc2" id="ffvChart"></div>'+
      '<p class="note" style="text-align:left;margin-top:8px">'+expl+(lcc.ctlAtlNote?' · '+escH(lcc.ctlAtlNote):'')+'</p>';
    window.ORVIA.charts.richChart(document.getElementById('ffvChart'),{
      label:'Fitness (CTL)',series:ctl,times:labels,unit:'',color:'gold',
      baseline:Math.round(ctl.reduce(function(x,y){return x+y;},0)/k),higherBetter:true,dec:0,
      overlays:[{series:atl,color:'var(--crit)'},{series:tsb,color:'var(--ready)',dash:'4 3'}]});
  }catch(e){try{console.error('[formFitnessV5]',e);}catch(_){}
    host.innerHTML=gmStateError({title:'Form & Fitness konnte gerade nicht dargestellt werden.',retry:'renderFormFitnessV5()',label:'Erneut versuchen'});}
}


/* ====== D2: Erholung heute (Analyse) — kanonischer Metrik-Resolver → v5-Kacheln + Sheet.
   EINE Datenbasis: window._metricsResolved (Tagescache, Form wie _ciAutoLoad) bzw. read-only
   profileMetricResolver.collect(). KEINE Berechnung im UI, missing ⇒ keine Kachel (nie 0),
   stale ⇒ sichtbar "veraltet". uiDetailMode ändert nur Erklärtiefe, nie Werte. ====== */
var _rcvReq=0,_rcvLastFocus=null;
var _RCV_TILES=[
  {id:'sleep_duration_min',label:'Schlaf',icon:'zzz'},
  {id:'hrv_ms',label:'HRV',icon:'heart'},
  {id:'resting_hr',label:'Ruhepuls',icon:'pulse'},
  {id:'stress_avg',label:'Stress',icon:'flame'},
  {id:'body_battery',label:'Body Battery',icon:'battery'}
];
function _rcvVal(r){ /* reine Darstellung — keine Umrechnung außer Anzeigeformat */
  if(r.metricType==='sleep_duration_min'&&r.value!=null){var h=Math.floor(r.value/60),m=Math.round(r.value-h*60);return h+':'+String(m).padStart(2,'0')+' h';}
  if(r.value!=null)return fmtDe(r.value)+(r.unit?' '+r.unit:'');
  return r.valueText!=null?String(r.valueText):'–';}
function _rcvSrc(r){return ({automatic:'Automatisch (Gerät)',manual:'Manuell',override:'Manuell korrigiert',estimate:'Schätzung',historical:'Historisch'})[r.source]||'Quelle unbekannt';}
function _rcvWhen(r){try{var d=r.measuredAt?new Date(r.measuredAt):null;
  if(d&&!isNaN(d))return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+', '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  }catch(_){ }
  return r.metricDate?new Date(r.metricDate+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}):'–';}
/* GM7.5f: zentraler Cache-Setter fuer _metricsResolved. Ein SCHMALER Collect (3/14 T.)
   darf einen bereits vorhandenen BREITEREN Tagescache (z.B. Analyse 180 T.) nicht
   ueberschreiben — sonst verlieren Trend-/Sparkline-Konsumenten ihre Serienbasis und
   muessten neu laden. Aktualisiert werden in dem Fall nur die heutigen resolved-Werte
   (frischer Tageswert gewinnt), die breiten entries bleiben erhalten. */
function gmStashResolved(next){
  try{
    var cur=window._metricsResolved;
    if(cur&&cur.date===next.date&&cur.days!=null&&next.days!=null&&cur.days>next.days){
      if(next.resolved)cur.resolved=Object.assign({},cur.resolved||{},next.resolved);
      return;
    }
    window._metricsResolved=next;
  }catch(_){ }
}
/* GM7.5h: Dashboard-seitiges Vorladen des 14-Tage-Resolver-Caches. Ohne diesen Anstoss
   zeigten alle Modul-Sparklines und Sheet-Kurven auf „Heute" dauerhaft den Leerzustand,
   bis der Nutzer zufaellig ein Analyse-Segment besuchte (Audit-Befund #1): der einzige
   Heute-Collector laeuft mit days:3, und der Fenster-Guard in gmMetricSeries weist einen
   3-Tage-Cache fuer 14-Tage-Anfragen korrekt ab. Gleicher Resolver, gleiche Parameter wie
   renderRecoveryTilesV5 — kein neuer Vertrag. Fehlschlag: 60s-Sperre statt Retry-Schleife. */
var _gmWideResolveBusy=false,_gmWideResolveFailAt=0;
function gmPrimeWideResolve(){
  try{
    var c=window._metricsResolved;
    if(c&&c.date===todayStr()&&(c.days==null||c.days>=14))return;
    if(_gmWideResolveBusy)return;
    if(_gmWideResolveFailAt&&(Date.now()-_gmWideResolveFailAt)<60000)return;
    var P=window.ORVIA&&ORVIA.profileMetricResolver;
    if(!P||typeof P.collect!=='function')return;
    _gmWideResolveBusy=true;var t=todayStr();
    P.collect({withMeta:false,days:14,today:t}).then(function(r){
      _gmWideResolveBusy=false;
      if(r&&r.success){
        gmStashResolved({date:t,days:14,resolved:(r.data&&r.data.resolved)||{},entries:(r.data&&r.data.entries)||[]});
        try{if(typeof renderModules==='function')renderModules();}catch(_){ }
      }else{_gmWideResolveFailAt=Date.now();}
    }).catch(function(){_gmWideResolveBusy=false;_gmWideResolveFailAt=Date.now();});
  }catch(_){ }
}
function _rcvResolvedToday(){var c=(typeof window!=='undefined')?window._metricsResolved:null;
  return (c&&c.date===todayStr()&&c.resolved)?c.resolved:null;}
function renderRecoveryTilesV5(){
  var host=document.getElementById('recoveryTilesV5');if(!host)return;
  var resolved=_rcvResolvedToday();
  if(resolved){_rcvRender(host,resolved);return;}
  var P=(typeof window!=='undefined')&&window.ORVIA&&window.ORVIA.profileMetricResolver;
  if(!P||typeof P.collect!=='function'){host.innerHTML=gmStateError({icon:'alert',title:'Metrik-Modul nicht geladen.',desc:'Die Erholungswerte erscheinen nach einem vollständigen Laden der App wieder.'});return;}
  var req=++_rcvReq;var t=todayStr();
  host.innerHTML=gmStateLoading({bare:true});
  /* GM7.5f: 8→14 Tage — die aus DIESEM Cache gespeisten Detail-Sheets beschriften ihre
     Statistik als „Ø 14 T" (gmMetricTrendStats/gmMetricSeries(id,14)); ein 8-Tage-Fenster
     wuerde seit dem Fenster-Guard ehrlich „—" zeigen bzw. davor still zu schmal rechnen.
     Kein neuer Vertrag, gleicher Resolver, nur das ehrliche Mindestfenster der Konsumenten. */
  P.collect({withMeta:false,days:14,today:t}).then(function(r){
    if(req!==_rcvReq)return;
    if(r&&r.success){var res=(r.data&&r.data.resolved)||{};
      try{gmStashResolved({date:t,days:14,resolved:res,entries:(r.data&&r.data.entries)||[]});}catch(_){ }
      _rcvRender(host,res);}
    else{_rcvError(host);}
  }).catch(function(){if(req===_rcvReq)_rcvError(host);});}
function _rcvError(host){host.innerHTML=gmStateError({title:'Erholungswerte konnten nicht geladen werden.',desc:'Offline oder Server nicht erreichbar.',retry:'renderRecoveryTilesV5()',label:'Erneut versuchen'});}
function _rcvRender(host,resolved){
  var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var tiles=[];
  for(var i=0;i<_RCV_TILES.length;i++){var tdef=_RCV_TILES[i];var r=resolved[tdef.id];
    if(!r||(r.value==null&&r.valueText==null))continue; /* fehlend ⇒ KEINE Kachel, nie 0 */
    var staleBadge=r.stale?'<span class="rcv-stale">veraltet · '+escH(_rcvWhen(r))+'</span>':'';
    var meta=mode==='anfaenger'?'':'<span class="rcv-meta">'+escH(mode==='profi'?_rcvSrc(r)+' · '+_rcvWhen(r):_rcvWhen(r))+'</span>';
    tiles.push('<button type="button" class="rcv-tile'+(r.stale?' is-stale':'')+'" data-m="'+tdef.id+'" data-val="'+escH(r.value!=null?r.value:r.valueText)+'" onclick="openRecoveryMetricSheet(\''+tdef.id+'\')" aria-label="'+escH(tdef.label+': '+_rcvVal(r)+(r.stale?', veraltet':''))+'">'+
      '<span class="rcv-l">'+escH(tdef.label)+'</span>'+
      '<span class="rcv-v">'+escH(_rcvVal(r))+'</span>'+staleBadge+meta+'</button>');}
  if(!tiles.length){host.innerHTML=gmStateEmpty({icon:'moon',title:'Noch keine Erholungswerte für heute',desc:'Sobald dein Gerät Werte liefert oder du sie im Check-in einträgst, erscheinen sie hier.',action:'expandCheckinCard()',actionIcon:'activity',label:'Manuell erfassen'});return;}
  host.innerHTML='<div class="rcv-grid">'+tiles.join('')+'</div>'+
    (mode==='anfaenger'?'<p class="note" style="text-align:left;margin-top:8px">Tippe eine Kachel für Details. Werte kommen automatisch von deinem Gerät oder aus deinem Check-in.</p>':'');}
function openRecoveryMetricSheet(metricId){
  /* GM7.5h: EIN Sheet-System (Mapping-Doc „GM-Sheet-System als EINZIGES Sheet-System") —
     delegiert an das volle GM-Metrik-Sheet (Kurve, Ø/vs-Ø, Quelle/Stand/Stale). Das
     bisherige oModal bleibt als Fallback, falls der GM1-Block nicht geladen ist
     (isolierte Testumgebung / Teil-Deploys). */
  try{if(typeof openMetric==='function'&&document.getElementById('detailSheet')&&typeof GM_METRIC_DEFS!=='undefined'&&GM_METRIC_DEFS[metricId]){openMetric(metricId);return;}}catch(_){ }
  var resolved=_rcvResolvedToday();var r=resolved&&resolved[metricId];
  var tdef=null;for(var i=0;i<_RCV_TILES.length;i++)if(_RCV_TILES[i].id===metricId)tdef=_RCV_TILES[i];
  if(!r||!tdef){if(typeof oModal==='function')oModal(tdef?tdef.label:'Metrik','<p class="muted" style="margin:0">Für diese Metrik liegt heute kein aufgelöster Wert vor.</p>');return;}
  var mode=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var EXPL={sleep_duration_min:'Gemessene Schlafdauer der letzten Nacht.',hrv_ms:'Nächtliche Herzfrequenzvariabilität — Einzelwerte schwanken, aussagekräftig ist der Vergleich mit deiner eigenen Baseline.',resting_hr:'Ruhepuls der Nacht.',stress_avg:'Tages-Stresswert deines Geräts (0–100).',body_battery:'Energie-Schätzung deines Geräts (0–100).'};
  var body='<div class="rcv-sh-v" data-val="'+escH(r.value!=null?r.value:r.valueText)+'">'+escH(_rcvVal(r))+(r.stale?' <span class="rcv-stale">veraltet</span>':'')+'</div>'+
    '<p style="margin:8px 0 0">'+escH(EXPL[metricId]||'')+'</p>';
  if(mode!=='anfaenger'){body+='<div class="rcv-sh-meta">Quelle: <b>'+escH(_rcvSrc(r))+'</b> · Stand: <b>'+escH(_rcvWhen(r))+'</b>'+(r.stale?' · <b>veraltet</b> (kein frischer Wert im Gültigkeitsfenster)':'')+'</div>';}
  if(mode==='profi'){body+='<div class="rcv-sh-meta">Roh-Quelle: '+escH(r.sourceType||'–')+' · Metrik-Datum: '+escH(r.metricDate||'–')+(r.isOverride?' · manueller Override aktiv':'')+'</div>';}
  body+='<p class="note" style="text-align:left;margin-top:10px">Anzeige aus dem kanonischen Metrik-Speicher — keine Bewertung, keine medizinische Aussage.</p>';
  try{_rcvLastFocus=document.activeElement;}catch(_){ }
  if(typeof oModal==='function')oModal(tdef.label,body);
  /* A11y: Fokus ins Sheet, Escape schließt, Rückfokus zum Auslöser (idempotent gebunden). */
  try{var sh=document.getElementById('suppSheet');if(sh){sh.setAttribute('tabindex','-1');sh.focus();}}catch(_){ }
  try{if(typeof window!=='undefined'&&!window._rcvEscBound){window._rcvEscBound=1;
    document.addEventListener('keydown',function(ev){
      if(ev.key!=='Escape')return;
      var m=document.getElementById('suppModal');
      if(m&&m.classList&&m.classList.contains&&m.classList.contains('show')){
        if(typeof closeSupp==='function')closeSupp();
        try{if(_rcvLastFocus&&_rcvLastFocus.focus)_rcvLastFocus.focus();}catch(_){ }
      }});}}catch(_){ }
}
/* ====== D2-ENDE ====== */

/* ====== GM1: Golden-Master-Dashboard — vollständiger Screen (Header-Daten, Hero mit
   SVG-Score-Ring, Statuspill, Delta-Slots, Empfehlung inkl. Profi-Erklärung/Anpassungs-
   Chips/Änderungsprotokoll, CTA, Body-Battery-Slot, Check-in-Karte, Modulsystem
   ALLMOD/LEVELMOD, Modulverwaltung, Loading/Empty/Error, GM-Sheet-System).
   REINE DARSTELLUNG: alle Werte aus orviaScore()/getDecision()/adaptToday()/
   todayPrimaryUnit()/DB-Check-in/_metricsResolved (profileMetricResolver, read-only)/
   allLoads()+Calc.loadSeries. Fehlende Quelle ⇒ struktureller Slot mit „—" bzw.
   „Noch nicht verfügbar" — die Struktur schrumpft NIE. Keine Engine-Änderung. ====== */
function gmLevel(){var m=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';return m==='anfaenger'?'a':m==='profi'?'p':'f';}
function gmEsc(x){return (typeof escH==='function')?escH(x):String(x==null?'':x);}
/* --- Modulsystem: IDs, Reihenfolge und Stufen exakt aus dem Golden Master --- */
/* 2026-08-05: Ist ein Bereich als Modul aktiv, darf sein Legacy-Host nicht ZUSAETZLICH
   erscheinen — sonst stuende derselbe Inhalt zweimal auf dem Dashboard. Eine Quelle
   der Wahrheit fuer alle drei Hosts (#nutritionBox, #eveCard, #routinesCard). */
function gmModOn(id){try{return gmModules().indexOf(id)>=0;}catch(_){return false;}}
function gmModules(){var l=gmLevel();
  /* Phase 1 · P0-7: `arr.length` fiel bei einer LEEREN Liste auf die Standardmodule
     zurueck — wer alles ausblendete, bekam ueberraschend alles wieder. Seit die
     Modulverwaltung ausgeblendete Module anzeigt und zurueckholen kann, ist die
     leere Auswahl eine gueltige Entscheidung. „Standard" stellt sie jederzeit her. */
  try{var raw=localStorage.getItem('orvia_gm_mods_'+l);if(raw){var arr=JSON.parse(raw);if(Array.isArray(arr)&&arr.every(function(id){return ALLMOD[id];}))return arr;}}catch(_){ }
  return LEVELMOD[l].slice();}
function gmSaveModules(arr){try{localStorage.setItem('orvia_gm_mods_'+gmLevel(),JSON.stringify(arr));}catch(_){ }}
/* --- Adapter: kanonische Quellen → GM-View-Model (keine Berechnung, keine Erfindung) --- */
function gmMetric(id){var c=(typeof window!=='undefined')?window._metricsResolved:null;
  var r=(c&&c.date===todayStr()&&c.resolved)?c.resolved[id]:null;
  return (r&&(r.value!=null||r.valueText!=null))?r:null;}
/* GM7.4-A: Heute-Guard. Liefert die aufgelöste Metrik NUR, wenn ihr metricDate
   dem lokalen heutigen Kalendertag entspricht — sonst null. Verhindert, dass ein
   älterer letzter Wert als „heute" erscheint. */
function gmMetricToday(id){var r=gmMetric(id);return (r&&r.metricDate===todayStr())?r:null;}
/* GM7.4-A: ehrliches Stand-Label aus einer aufgelösten Metrik: „heute" nur bei
   heutigem metricDate, sonst „Stand TT.MM." (kein „heute" für Altwerte). */
function gmStandLbl(r){
  if(!r||(r.value==null&&r.valueText==null))return null;
  /* Phase 4 (P2-4): Labels aus dem zentralen Formatierer (heute/gestern), sonst absolut. */
  try{
    var _F=(window.ORVIA&&ORVIA.fmt)||null;
    var rl=(_F&&_F.dayLabel)?_F.dayLabel(r.metricDate,todayStr()):null;
    if(rl==='Heute')return 'heute';
    if(rl==='Gestern')return 'gestern';
  }catch(_){ }
  if(r.metricDate===todayStr())return 'heute';
  try{var d=new Date(r.metricDate+'T12:00');return 'Stand '+d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});}catch(_){return 'Stand '+gmEsc(String(r.metricDate));}
}
/* GM7.4: read-only Serien-Anbindung (user_metric_series). Fetch injizierbar
   (Test-Override), sonst Supabase-Default. Rein lesend, kein Rückschreiben. */
function gmSeriesFetch(metricType,from,to){
  try{
    if(typeof window!=='undefined'&&typeof window.__ORVIA_TEST_SERIES_FETCH==='function')return window.__ORVIA_TEST_SERIES_FETCH(metricType,from,to);
    if(window.ORVIA&&ORVIA.seriesReader&&ORVIA.seriesReader.supabaseFetch)return ORVIA.seriesReader.supabaseFetch(metricType,from,to);
  }catch(_){ }
  return Promise.reject(new Error('no_fetch'));
}
/* GM7.4.1: rendert eine Aktivitäts-Detail-Stream-Serie (metrics.streams — reine
   Werte-Arrays je Sample, KEINE [offset,value]-Paare wie user_metric_series) als
   SVG. Baut ausschließlich aus echten, vorhandenen Werten Index→Wert-Punkte
   (Sample-Reihenfolge = zeitliche Reihenfolge; kein erfundener Zeitstempel, keine
   Neuberechnung des Werts selbst). null-Lücken werden übersprungen, nicht als 0
   angezeigt. <2 echte Werte ⇒ leerer String (Aufrufer zeigt ehrlichen Leerzustand). */
function gmRenderStreamCurve(arr,color,label){
  if(!Array.isArray(arr))return '';
  var pts=[];for(var i=0;i<arr.length;i++){var v=arr[i];if(typeof v==='number'&&isFinite(v))pts.push([i,v]);}
  if(pts.length<2)return '';
  try{return (window.ORVIA&&ORVIA.seriesReader&&ORVIA.seriesReader.renderCurve)?ORVIA.seriesReader.renderCurve(pts,{color:color,label:label}):'';}catch(_){return '';}
}
/* GM7.6: Stress-Verteilung aus den ECHTEN Intraday-Punkten — dauergewichtete Anteile je
   Garmin-Bucket (Ruhe 0-25, Niedrig 26-50, Mittel 51-75, Hoch 76-100). Reine Aggregation
   gespeicherter Werte (wie Ø/Min/Max), keine neue Bewertung. */
function gmStressDistribution(pts){
  try{
    if(!Array.isArray(pts)||pts.length<2)return '';
    var buckets=[['Ruhe',0,25,'var(--sleep)'],['Niedrig',26,50,'var(--ready)'],['Mittel',51,75,'var(--attention)'],['Hoch',76,100,'var(--crit)']];
    var tot=0,acc=[0,0,0,0];
    for(var i=0;i<pts.length;i++){
      var v=pts[i][1];if(typeof v!=='number'||!isFinite(v))continue;
      var dur=(i+1<pts.length)?Math.max(0,pts[i+1][0]-pts[i][0]):((pts.length>1)?Math.max(0,pts[i][0]-pts[i-1][0]):0);
      if(!dur)continue;tot+=dur;
      for(var b=0;b<4;b++){if(v>=buckets[b][1]&&v<=buckets[b][2]){acc[b]+=dur;break;}}
    }
    if(!tot)return '';
    var fmtDur=function(s){var h=Math.floor(s/3600),m=Math.round((s-h*3600)/60);return (h?h+'h ':'')+m+'min';};
    return '<div style="margin-top:12px"><div class="bh">Stressanalyse (gemessene Anteile)</div>'+buckets.map(function(bk,b){
      var pct=Math.round(acc[b]/tot*100);
      return '<div class="distb"><div class="dh"><span class="dl">'+bk[0]+'</span><span><span class="dp" style="color:'+bk[3]+'">'+pct+'%</span> <span class="dt">'+fmtDur(acc[b])+'</span></span></div><div class="dbar"><i style="width:'+Math.max(pct,acc[b]>0?1:0)+'%;background:'+bk[3]+'"></i></div></div>';
    }).join('')+'</div>';
  }catch(_){return '';}
}
/* GM7.6: Body-Battery-Bilanz aus der ECHTEN gespeicherten Tageskurve — Summe der positiven
   (geladen) und negativen (verbraucht) Aenderungen zwischen den gespeicherten Punkten.
   Reine Delta-Aggregation, kein Garmin-charged/drained-Ersatzwert. */
function gmBbBalance(pts){
  try{
    if(!Array.isArray(pts)||pts.length<2)return '';
    var up=0,down=0;
    for(var i=1;i<pts.length;i++){var d=pts[i][1]-pts[i-1][1];if(!isFinite(d))continue;if(d>0)up+=d;else down+=-d;}
    return '<div style="display:flex;gap:10px;margin:0 0 10px">'+
      '<div style="flex:1;background:var(--ready-t);border:1px solid rgba(67,214,147,.28);border-radius:14px;padding:13px"><div style="font-size:11px;color:var(--muted);font-weight:700">Aufgeladen</div><div style="font-size:22px;font-weight:800;color:var(--ready);margin-top:4px">+'+Math.round(up)+'</div><div style="font-size:10.5px;color:var(--muted)">Summe der Anstiege (gespeicherte Kurve)</div></div>'+
      '<div style="flex:1;background:var(--crit-t);border:1px solid rgba(240,99,122,.28);border-radius:14px;padding:13px"><div style="font-size:11px;color:var(--muted);font-weight:700">Verbraucht</div><div style="font-size:22px;font-weight:800;color:var(--crit);margin-top:4px">−'+Math.round(down)+'</div><div style="font-size:10.5px;color:var(--muted)">Summe der Rückgänge (gespeicherte Kurve)</div></div></div>';
  }catch(_){return '';}
}
/* Lädt eine Tages-Serie asynchron in einen vorhandenen Slot. Nur innerHTML-Ersatz
   (keine Listener → keine DOM-/Listener-Akkumulation bei mehrfachem Öffnen).
   Fehlend/leer/offline ⇒ ehrlicher Leerzustand, NIE 0/erfundene Kurve. */
function gmLoadSeriesInto(slotId,metricType,renderFn){
  try{
    var R=window.ORVIA&&ORVIA.seriesReader;if(!R||!R.read)return;
    R.read({metricType:metricType,fromDate:todayStr(),today:todayStr(),fetchRows:gmSeriesFetch}).then(function(res){
      var el=document.getElementById(slotId);if(!el)return;
      if(res.state==='ok'&&res.series.length&&res.series[0].points.length){
        var svg='';try{svg=renderFn(res.series[0].points);}catch(_){ }
        el.innerHTML=svg?(svg+(res.stale?'<div style="font-size:10px;color:var(--muted);font-weight:650">veraltet</div>':'')):('<div style="font-size:11px;color:var(--muted)">'+GM_NA+' — kein zeitlicher Verlauf gespeichert.</div>');
      }else if(res.state==='error'){
        el.innerHTML='<div style="font-size:11px;color:var(--muted)">'+GM_NA+' — offline oder nicht ladbar.</div>';
      }else{
        el.innerHTML='<div style="font-size:11px;color:var(--muted)">'+GM_NA+' — kein zeitlicher Verlauf für diesen Tag gespeichert.</div>';
      }
    }).catch(function(){var el=document.getElementById(slotId);if(el)el.innerHTML='<div style="font-size:11px;color:var(--muted)">'+GM_NA+'</div>';});
  }catch(_){ }
}
/* --- GM6.1 §4: kanonische Stimmungsprojektion --------------------------------
   Der Golden Master fuehrt im eigenen View-Model das Feld `mood` mit genau drei
   Werten: "top" | "ok" | "tired" (orvia_dashboard_5.html:375/387/400). Die drei
   .mood-Felder der Auswahl entsprechen 1:1 dieser Reihenfolge (GM-Zeile 507).
   ORVIAs kanonisches Feld ist `morning.feel` (Befinden 1–10; Konsumenten:
   readiness-engine-v2.js:37 scoreFeel=clamp(feel*10,0,100), calc.js:563/598/601,
   calc.js:1308/1309). gmMoodKey() ist eine REINE Projektion dieses vorhandenen
   Werts auf die GM-Schluessel — kein zweiter Zustandsspeicher, keine Persistenz,
   keine Aenderung der Check-in- oder Decision-Logik. Fehlt der Wert, ist das
   Ergebnis null und KEIN Feld erhaelt .on (unbekannt ist nicht „Geht so").
   Schwellen folgen den bereits produktiv verwendeten calc.js-Grenzen (<=4 gilt
   dort als niedriges Befinden); 5–6 mittig, >=7 hoch. */
function gmMoodKey(feel){
  var f=(feel==null||feel==='')?null:Number(feel);
  if(f==null||!isFinite(f))return null;
  if(f>=7)return 'top';
  if(f>=5)return 'ok';
  return 'tired';
}
/* GM6.1 §4: exakte Uebernahme des Golden-Master-Verhaltens window.setMood
   (orvia_dashboard_5.html:699) — Geschwister entmarkieren, das getippte Feld
   markieren. Ergaenzt wird ausschliesslich aria-pressed, damit der sichtbare
   Zustand auch assistiv erreichbar ist. Rein visuell: KEIN Schreibzugriff,
   keine Persistenz, keine Engine- oder Decision-Aktion. Der verbindliche Wert
   wird weiterhin ausschliesslich im Check-in-Formular erfasst. */
function gmSetMood(el){
  if(!el||!el.parentNode)return;
  var sib=el.parentNode.querySelectorAll('.mood');
  for(var i=0;i<sib.length;i++){sib[i].classList.remove('on');sib[i].setAttribute('aria-pressed','false');}
  el.classList.add('on');el.setAttribute('aria-pressed','true');
}
/* ===== GM7: kanonische VM-Adapter (Quelle -> Vertrag -> VM; keine Renderer-Rechnung) ===== */
/* Serien aus dem Resolver-Tagescache (entries werden seit GM7 mitgecacht). */
function gmMetricSeries(id,maxN){
  try{var c=window._metricsResolved;if(!c||c.date!==todayStr()||!Array.isArray(c.entries))return null;
    /* GM7.5f: Fenster-Guard (Analyse-Audit-Befund). Der Cache wird von unterschiedlich breiten
       Kollektoren geteilt (heute-Tab: 3 T., D2: 8 T., Analyse: 180 T.). Ein schmaler Cache darf
       eine breite Serien-Anfrage NICHT bedienen — sonst zeigt der Erholungstrend eine still auf
       3-8 Tage gestutzte „14-Tage"-Serie. Analog zum bestehenden Guard in gmAnaResolved
       (ui.js: „darf die Analyse nicht bedienen"): zu schmal => null (ehrlicher Leerzustand),
       der zustaendige Renderer stoesst den breiten Resolve ohnehin an und rendert danach neu. */
    if(maxN&&c.days!=null&&c.days<maxN)return null;
    var MR=window.ORVIA&&ORVIA.metricResolver;if(!MR||!MR.normalizeEntry)return null;
    var by={};c.entries.forEach(function(raw){var e=MR.normalizeEntry(raw);
      if(!e||e.metricType!==id||e.validity!=='valid')return;
      if(typeof e.valueNumeric!=='number'||!isFinite(e.valueNumeric))return;
      var d=e.metricDate;if(!d)return;
      if(by[d]==null||true)by[d]=e.valueNumeric;});
    var keys=Object.keys(by).sort();if(!keys.length)return null;
    if(maxN&&keys.length>maxN)keys=keys.slice(-maxN);
    return {dates:keys,values:keys.map(function(k){return by[k];})};
  }catch(_){return null;}
}
/* Sheet-Statistik: Oe(14T) + vs. Oe aus der kanonischen Serie (reine Aggregation, kein Modell). */
function gmMetricTrendStats(id,current){
  var s=gmMetricSeries(id,14);if(!s||!s.values.length)return null;
  var avg=s.values.reduce(function(a,b){return a+b;},0)/s.values.length;
  return {avg:Math.round(avg*10)/10,n:s.values.length,
    vs:(current!=null)?Math.round((current-avg)*10)/10:null};
}
/* Readiness-Deltas vs. gestern / 14-T-Oe — Quelle: readinessHistory (persistiert),
   Fallback: Calc.readiness (dieselbe kanonische Formel) auf vorhandene Morgendaten. */
function gmPastReadiness(dateKey){
  try{var st=window.ORVIA&&ORVIA.readinessStore;var h=st&&st.getScoreFor?st.getScoreFor(dateKey):null;
    if(h&&h.score!=null)return h.score;}catch(_){ }
  try{var e=DB[dateKey];if(e&&e.morning)return Calc.readiness(e.morning,recoveryCtx(dateKey)).score;}catch(_){ }
  return null;
}
function gmReadinessDeltas(todayScore){
  if(todayScore==null)return [['flat','—'],['flat','—']];
  var t=new Date(todayStr()+'T12:00');
  /* ═══ v9 · KEIN STRICH, WENN ES EINEN VERGLEICH GIBT ════════════════════
     BEFUND (Gian, 16.08.): „Dieses versus gestern, und dann ist da 'n Strich."
     Ursache: es wurde AUSSCHLIESSLICH auf gestern geschaut. Fehlt dort der
     Morgen-Check-in (Ruhetag, verschlafen, Reise), stand dauerhaft „—",
     obwohl vorgestern ein Wert vorlag. Ein Vergleich, der beim ersten
     Datenloch aufgibt, ist in der Praxis fast nie da.
     NEU: bis zu 7 Tage zurueck den letzten vorhandenen Wert nehmen und das
     Label ehrlich mitfuehren („vs. vor 3 Tagen"). Kein geschaetzter Wert,
     nur ein ehrlich benannter Bezugspunkt. */
  var ys=null,ysAgo=0;
  for(var q=1;q<=7;q++){var dq=new Date(t);dq.setDate(t.getDate()-q);var vq=gmPastReadiness(todayStr(dq));
    if(vq!=null){ys=vq;ysAgo=q;break;}}
  var ysLabel=ysAgo<=1?'vs. gestern':('vs. vor '+ysAgo+' Tagen');
  var vals=[];for(var i=1;i<=14;i++){var d=new Date(t);d.setDate(t.getDate()-i);var v=gmPastReadiness(todayStr(d));if(v!=null)vals.push(v);}
  var avg=vals.length>=5?Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length):null;
  /* GM7.6-Fix: Richtungscode 'dn' (GM-Vertrag arrow()/.delta.dn) — 'down' rendrte
     faelschlich den Flach-Pfeil und verlor die rote Negativ-Faerbung. */
  var mk=function(delta,lbl){if(delta==null)return ['flat',lbl+': —'];
    var dirn=delta>0?'up':delta<0?'dn':'flat';
    return [dirn,(delta>0?'+':'')+delta+' '+lbl];};
  return [mk(ys!=null?todayScore-ys:null,ysLabel),mk(avg!=null?todayScore-avg:null,'vs. 14-T-Ø')];
}
/* Breakdown aus der kanonischen Komponentenrechnung (readiness-store.buildComponents). */
/* v9: Namen an die Engine angeglichen (Schlaf-Score (Gerät) / Schlafgefühl /
   Muskelkater). Die Altnamen bleiben als Schlüssel stehen, damit historische
   Komponentenzeilen aus der Datenbank weiterhin ihre Farbe bekommen. */
var GM_BRK_COLOR={'Knie':'crit','Schmerz':'crit','HRV':'ready','Befinden':'cyan','Schlaf-Konto':'sleep','Schlafdauer':'sleep',
  'Schlaf-Score (Gerät)':'sleep','Schlafgefühl':'sleep','Schlafphasen':'sleep','Schlafqualität':'sleep','Schlafqualität (gemessen)':'sleep',
  'Stress':'activity','Ruhepuls':'ready','Muskelkater':'crit','DOMS':'crit','Body Battery':'activity'};
function gmReadinessBreakdown(os){
  var out=null;
  try{var st=window.ORVIA&&ORVIA.readinessStore;
    if(st&&st.buildComponents&&os&&os.r&&os.r.parts&&os.r.parts.length){
      var comps=st.buildComponents(os.r.parts,os.m||{},os.ctx||{});
      out=comps.map(function(c){
        /* GM7.6: norm (0-100) und raw additiv (Index 4/5) fuer die GM-Faktorkarten des
           Score-Sheets — dieselben Engine-Werte, keine Neuberechnung. */
        return [c.name,c.contribution!=null?Math.round(c.contribution):null,GM_BRK_COLOR[c.name]||'neutral',c.reason||(c.raw!=null?String(c.raw):'—'),(c.norm!=null?Math.round(c.norm):null),(c.raw!=null?c.raw:null)];
      });}
  }catch(_){ }
  if(out&&out.length)return out;
  return [['Ausgangswert',null,'neutral','—'],['Schlaf',null,'sleep','—'],['HRV',null,'ready','—'],['Ruhepuls',null,'ready','—'],['Energie (subj.)',null,'cyan','—'],['Belastung',null,'activity','—'],['Schmerzen',null,'crit','—']];
}
/* Konfidenz aus der kanonischen Datenqualitaetsquelle (dataConfidence + Baseline-Status). */
function gmConfVM(){
  try{var c=dataConfidence();
    var bs=null;try{bs=window.ORVIA&&ORVIA.readinessStore?ORVIA.readinessStore.getBaselineStatus():null;}catch(_){ }
    /* GM7.5h: Baseline-Abweichung aus bereits kanonischen Werten (heutige HRV aus dem
       Resolver-Tagescache vs. recoveryCtx.hrvBase7) — reine Differenz zur Anzeige, gleiche
       Konversion wie readiness-store; ohne Baseline oder Tageswert bleibt sd null (—). */
    var sd=null;try{var _hr=(typeof gmMetricToday==='function')?gmMetricToday('hrv_ms'):null;var _cx=(typeof recoveryCtx==='function')?recoveryCtx(todayStr()):null;
      if(_hr&&_hr.value!=null&&_cx&&_cx.hrvBase7!=null){var _dv=Math.round(_hr.value-Math.exp(_cx.hrvBase7));sd=(_dv>=0?'+':'')+_dv+' ms';}}catch(_){ }
    return {levelLabel:c.level.l,levelColor:c.level.c==='g'?'ready':c.level.c==='y'?'attention':'crit',
      complete:c.ci+' Check-ins · '+c.acts+' Aktivitäten · '+c.n+' Tage',
      sd:sd,note:c.msg+(bs==='active'?' Persönliche Baseline aktiv.':bs==='building'?' Baseline wird aufgebaut.':''),pct:null};
  }catch(_){return {levelLabel:null,levelColor:'neutral',complete:null,sd:null,note:GM_NA,pct:null};}
}
/* Belastungs-Beitrag: letzte Einheiten mit Tageslast (sRPE) — ehrlich als Last, nicht als ATL. */
function gmLoadContrib(){
  /* GM7.2 FIX: allLoads().loads ist ein ZAHLEN-Array (kein {date,load}); der frühere
     Zugriff L.loads[i].load/.date lieferte immer null → „Noch nicht verfügbar".
     Kanonische Tageslast (sRPE) verwenden; Datum aus der Serienposition rekonstruieren
     (Serie endet heute). Eine echte Pro-Aktivitäts-Last-Attribution ist NICHT exportiert
     (dokumentiert) — hier ehrlich als Tageslast je Trainingstag. */
  try{var L=(typeof allLoads==='function')?allLoads():null;if(!L||!L.loads||!L.loads.length)return null;
    var loads=L.loads;var len=loads.length;var rows=[];
    for(var i=len-1;i>=0&&rows.length<3;i--){
      var v=loads[i];if(v==null||!(v>0))continue;
      var k=dkey(-(len-1-i));                                   /* i=len-1 → heute */
      var types=[];try{var e=DB[k];if(e&&e.sessions)types=Object.keys(e.sessions).filter(function(t){return t!=='_ts';});}catch(_){ }
      var wd='';try{wd=new Date(k+'T12:00').toLocaleDateString('de-DE',{weekday:'short'});}catch(_){ }
      rows.push([types.length?types.join(' + '):'Training',wd+(types.length?'':' · Tageslast'),fmtDe(Math.round(v)),'activity']);
    }
    return rows.length?rows:null;
  }catch(_){return null;}
}
/* Ziel-Label kanonisch/* Ziel-Label kanonisch (RACE_LABELS_P/GOAL_LABELS + Zielzeit) — nie die rohe ID. */
function gmGoalLabel(g){
  if(!g)return null;
  var lbl=null;
  try{lbl=(g.label||g.title)||null;}catch(_){ }
  try{if(!lbl&&typeof RACE_LABELS_P!=='undefined'&&RACE_LABELS_P[g.type])lbl=RACE_LABELS_P[g.type];}catch(_){ }
  try{if(!lbl&&typeof GOAL_LABELS!=='undefined'&&GOAL_LABELS[g.type])lbl=GOAL_LABELS[g.type];}catch(_){ }
  if(!lbl&&g.type)lbl=String(g.type).replace(/_/g,' ');
  var tm=null;try{tm=g.targetMin!=null?g.targetMin:(typeof PROFILE!=='undefined'&&PROFILE&&/half|hm/i.test(String(g.type))?PROFILE.hmTargetMin:null);}catch(_){ }
  if(lbl&&tm){var hh=Math.floor(tm/60),mm=Math.round(tm%60);lbl+=' < '+hh+':'+String(mm).padStart(2,'0');}
  return lbl;
}
/* Geraete-Sync (Provider + last_sync) — asynchron gecacht; Cloud-Sync bleibt getrennt. */
var _gmDevSync={state:'idle',provider:null,lastSyncAt:null,fetchedAt:0};
function gmDeviceSyncRefresh(){
  try{
    if(_gmDevSync.state==='loading')return;
    if(Date.now()-_gmDevSync.fetchedAt<60000&&_gmDevSync.state==='ready')return;
    var repo=window.ORVIA&&ORVIA.repos&&ORVIA.repos.metrics;
    if(!repo||!repo.listProviders){_gmDevSync.state='unavailable';return;}
    _gmDevSync.state='loading';
    repo.listProviders().then(function(r){
      if(r&&r.success&&Array.isArray(r.data)&&r.data.length){
        var best=null;
        /* KF-019: connection_status, reauthentication_required und last_error_code
           werden vom Worker gepflegt (reauth_required/TOKENS_MISSING, sobald das
           lokal erzeugte Garmin-Token ablaeuft). Vorher wurde „verbunden" allein
           daraus abgeleitet, DASS eine Zeile existiert — die App verschwieg damit
           eine notwendige Neuanmeldung. */
        r.data.forEach(function(p){var ts=p.last_sync_at||p.last_sync||p.lastSyncAt||null;
          if(!best||(ts&&(!best.ts||ts>best.ts)))best={provider:p.provider_type||p.provider||'Gerät',ts:ts,
            status:p.connection_status||p.status||null,
            reauth:!!(p.reauthentication_required||p.connection_status==='reauth_required'),
            errCode:p.last_error_code||null};});
        _gmDevSync={state:'ready',provider:best?best.provider:null,lastSyncAt:best?best.ts:null,
          reauth:!!(best&&best.reauth),errCode:best?best.errCode:null,status:best?best.status:null,fetchedAt:Date.now()};
      }else{_gmDevSync={state:'none',provider:null,lastSyncAt:null,reauth:false,errCode:null,status:null,fetchedAt:Date.now()};}
      try{var stx=document.getElementById('syncTxt');if(stx)gmApplySyncLine();}catch(_){ }
      try{if(typeof gmRerenderConnections==='function')gmRerenderConnections();}catch(_){ }
    }).catch(function(){_gmDevSync.state='error';_gmDevSync.fetchedAt=Date.now();});
  }catch(_){ }
}
function gmDevProviderName(){
  return ({garmin:'Garmin',strava:'Strava',apple_health:'Apple Health',applehealth:'Apple Health'})[String(_gmDevSync.provider||'').toLowerCase()]||_gmDevSync.provider;
}
/* KF-019: braucht der Provider eine Neuanmeldung? (Worker setzt reauth_required,
   wenn das lokal erzeugte Garmin-Session-Token abgelaufen ist.) */
function gmDevReauthNeeded(){return _gmDevSync.state==='ready'&&!!_gmDevSync.reauth;}
function gmDeviceSyncText(){
  var F=window.ORVIA&&ORVIA.fmt;
  if(_gmDevSync.state==='ready'&&_gmDevSync.provider){
    var provName=gmDevProviderName();
    if(_gmDevSync.reauth)return provName+' · Neuanmeldung erforderlich';
    var rel=F&&F.fmtRelTime?F.fmtRelTime(_gmDevSync.lastSyncAt):null;
    return rel?(provName+' · '+rel+' synchronisiert'):(provName+' · verbunden');
  }
  if(_gmDevSync.state==='none')return 'Kein Gerät verbunden';
  return null; /* unbekannt/lokal -> Cloud-Sync-Status anzeigen */
}
function gmApplySyncLine(){
  try{var stx=document.getElementById('syncTxt'),sl=document.getElementById('syncLine');
    var dev=gmDeviceSyncText();
    /* KF-019: Neuanmeldung ist ein Fehlerzustand, kein „synced". */
    if(dev!=null){if(stx)stx.textContent=dev;if(sl)sl.dataset.state=(gmDevReauthNeeded()?'error':(_gmDevSync.state==='ready'?'synced':'local'));return;}
    if(stx&&typeof window.orviaSyncState==='function'){var st=window.orviaSyncState();
      stx.textContent=({local:'Lokaler Modus',synced:'Cloud synchronisiert',pending:'Cloud-Sync läuft …',error:'Sync-Fehler',offline:'Offline – lokal'})[st]||'Lokaler Modus';
      if(sl)sl.dataset.state=st;}
  }catch(_){ }
}
/* ---------- KF-004: Produzenten fuer TRIMP / Hochintensiv / Sportverteilung /
   Interferenz. Vorher waren diese vier Zellen hart auf null verdrahtet — es gab
   schlicht keinen Produzenten. Regeln:
     • Sportverteilung: Anteil der bekannten Wochendauer je Sportart aus dem
       kanonischen Wochenvertrag (weeklyActivityTotals) — reine Arithmetik.
     • TRIMP: Banister-TRIMP je Einheit (min × HRr × 0,64 × e^(1,92·HRr);
       Koeffizient 1,67 bei weiblichem Profil), NUR wenn Ø-HF der Einheit,
       Ruhepuls-Baseline und HFmax bekannt sind. HFmax wie calc.js:_hrMax
       (PROFILE.hfMax, sonst Tanaka 208−0,7·Alter) — fehlt beides: null.
     • Hochintensiv: Lastanteil harter Einheiten der letzten 7 Tage.
       Hart = RPE ≥ 8 oder Ø-HF ≥ 85 % HFmax; locker = Ø-HF ≤ 78 % HFmax
       oder Easy-Label. Einheiten OHNE RPE und HF sind nicht klassifizierbar
       und fallen aus ZAEHLER UND NENNER — nie stillschweigend als „locker".
     • Interferenz: rein deskriptiv — Tage mit Kraft UND harter Ausdauer.
   Jede Zelle bleibt „—", wenn ihre Datenbasis fehlt. */
function gmWeekSessions7(){
  var out=[];
  var st=window.ORVIA&&ORVIA.activityStore,cfg=window.ORVIA&&ORVIA.activityConfig;
  var tz=(window.ORVIA&&ORVIA.profileStore&&ORVIA.profileStore.effectiveTimezone)?ORVIA.profileStore.effectiveTimezone():'UTC';
  var norm=(window.ORVIA&&ORVIA.trainingDomain&&ORVIA.trainingDomain.normSport)?ORVIA.trainingDomain.normSport:function(v){return String(v||'').toLowerCase();};
  var days={};for(var i=0;i<7;i++)days[dkey(-i)]=true;
  var blobBySport={};   /* day|sport -> true (Blob gewinnt je Tag, wie runsWindow) */
  var LEG={Laufen:'running',Rad:'cycling',Gym:'gym',Schwimmen:'swimming'};
  Object.keys(days).forEach(function(k){
    var e=(typeof DB!=='undefined')?DB[k]:null;var ss=e&&e.sessions;if(!ss)return;
    Object.keys(ss).forEach(function(t){
      if(t==='_ts')return;var s=ss[t];if(!s||!(s.dur>0))return;
      var sp=LEG[t]||norm(t);
      blobBySport[k+'|'+sp]=true;
      out.push({day:k,sport:sp,min:s.dur,rpe:(s.rpe!=null?+s.rpe:null),hr:(s.hr!=null?+s.hr:null),sub:s.sub||''});
    });
  });
  try{
    if(st&&st.listActivities){
      st.listActivities().forEach(function(a){
        if(!a||!a.startedAt)return;
        if(a.status&&a.status!=='completed')return;
        var k=(cfg&&cfg.dayOfActLocal)?cfg.dayOfActLocal(a,tz):String(a.startedAt).slice(0,10);
        if(!days[k])return;
        var sp=norm(a.sportId);
        if(blobBySport[k+'|'+sp])return;                       /* Dedupe: Blob gewinnt je Tag+Sport */
        var min=a.durationSeconds!=null?a.durationSeconds/60:null;if(!(min>0))return;
        var s=a.summary||{};
        var hr=s.avg_hr!=null?s.avg_hr:(s.avgHr!=null?s.avgHr:null);
        out.push({day:k,sport:sp,min:Math.round(min),rpe:(s.rpe!=null?+s.rpe:null),hr:hr!=null?Math.round(hr):null,sub:''});
      });
    }
  }catch(_){ }
  return out;
}
/* ---------- Phase 2.0: Envelope-Produzenten ----------
   Jede Kennzahl entsteht ueber ORVIA.metricEnvelope.create() — Wert · Zeitraum ·
   Abdeckung · Berechnungsgrundlage sind damit erzwungen (create() wirft ohne
   Provenienz/Zeitraum). gmLoadExtras() bleibt als schmale Sicht fuer die
   bestehenden Kartenzellen erhalten und liest AUSSCHLIESSLICH die Envelopes. */
function gmLoadEnvelopes(){
  var E=window.ORVIA&&ORVIA.metricEnvelope;if(!E)return null;
  var out={};
  var roll7={type:'rolling',days:7,startDate:dkey(-6),endDate:todayStr()};
  /* 2.1 Belastung nach Sportart — kanonischer Wochenvertrag (Kalenderwoche). */
  try{
    var wk=(typeof gmActWeekTotals==='function')?gmActWeekTotals():null;
    if(wk&&wk.bySport){
      var tot=0,mins={},sessAll=0,sessKnown=0;
      Object.keys(wk.bySport).forEach(function(sp){var b=wk.bySport[sp];
        sessAll+=b.sessionCount||0;
        var m=b.knownDurationMin;if(m>0){mins[sp]=m;tot+=m;}
        /* Einheiten ohne Dauer stehen in provenance.missingFields — Abdeckung je Einheit: */
      });
      var missDur=0;try{(wk.provenance&&wk.provenance.missingFields||[]).forEach(function(x){if(x.field==='duration')missDur++;});}catch(_){ }
      sessKnown=Math.max(0,sessAll-missDur);
      var pct=function(sp){return mins[sp]?Math.round(mins[sp]/tot*100):0;};
      out.sport=E.create({metricId:'training_load_by_sport',
        value:tot>0?[['Laufen',pct('running'),'ready'],['Kraft',pct('gym'),'activity'],['Rad',pct('cycling'),'cyan']]:null,
        unit:'%',
        period:{type:'calendar_week',startDate:wk.weekStart,endDate:wk.weekEnd},
        coverage:{eligible:sessAll,available:sessKnown},
        provenance:{method:'duration_share_by_sport',version:'1.0.0',sources:['garmin','manual'],
          assumptions:[]},
        reason:tot>0?null:'keine Einheiten mit bekannter Dauer in dieser Woche'});
    }
  }catch(_){ }
  try{
    var ses=gmWeekSessions7();
    /* 2.2 Harte Einheiten — reiner RPE-Proxy (Anteil der EINHEITEN mit RPE >= 7).
       Ausdruecklich KEINE HF-Zonen-Behauptung; Einheiten ohne RPE fallen aus
       Zaehler UND Nenner — fallen aus ZAEHLER UND NENNER heisst: die Abdeckung
       steht sichtbar im Envelope, nichts wird stillschweigend als „locker"
       gezaehlt. Echte HF-Zonen: heartRateZonesTemplate() (vorbereitet, leer). */
    var withRpe=ses.filter(function(s){return s.rpe!=null;});
    var hard=withRpe.filter(function(s){return s.rpe>=7;});
    out.hard=E.create({metricId:'hard_sessions_share',
      value:withRpe.length?Math.round(hard.length/withRpe.length*100):null,
      unit:'%',period:roll7,
      coverage:{eligible:ses.length,available:withRpe.length},
      provenance:{method:'session_rpe_hard_share',version:'1.0.0',sources:['garmin','manual'],
        inputs:{threshold:7,hardCount:hard.length},assumptions:[]},
      reason:withRpe.length?null:'keine Einheiten mit RPE in den letzten 7 Tagen'});
    /* 2.3 TRIMP (Banister) — nur mit GEMESSENEM Ruhepuls (PROFILE.rhrBaseline
       bzw. heutige Messung); kein Fallback (konsistent zu calc._rhrBase).
       HFmax: gemessen (PROFILE.hfMax), sonst Tanaka — als Annahme ausgewiesen. */
    var hrMaxMeasured=null,hrMax=null,assum=[];
    try{hrMaxMeasured=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.hfMax)||null;}catch(_){ }
    if(hrMaxMeasured!=null)hrMax=hrMaxMeasured;
    else{try{var age=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.age)||null;if(age){hrMax=Math.round(208-0.7*age);assum.push('hfmax_tanaka_aus_alter');}}catch(_){ }}
    var rhr=null;
    try{rhr=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.rhrBaseline)||null;
      if(rhr==null){var rm=(typeof gmMetric==='function')?gmMetric('resting_hr'):null;if(rm&&rm.value!=null)rhr=rm.value;}}catch(_){ }
    var sexRaw=null;try{sexRaw=(PROFILE&&(PROFILE.sex||PROFILE.gender))||null;}catch(_){ }
    var female=/^(f|w)/i.test(String(sexRaw||''));
    if(!sexRaw)assum.push('geschlecht_unbekannt_parameter_maennlich');
    var k=female?1.67:1.92;
    var trs=[];
    if(hrMax!=null&&rhr!=null&&hrMax>rhr){
      ses.forEach(function(s){
        if(s.hr==null||!(s.min>0))return;
        /* HRR-Bereich: avgHr <= Ruhepuls ⇒ nicht auswertbar; avgHr >= HFmax ⇒ auf 1 gekappt. */
        var hrr=(s.hr-rhr)/(hrMax-rhr);if(!(hrr>0))return;hrr=Math.min(hrr,1);
        trs.push(s.min*hrr*0.64*Math.exp(k*hrr));
      });
    }
    out.trimp=E.create({metricId:'trimp_avg',
      value:trs.length?Math.round(trs.reduce(function(a,b){return a+b;},0)/trs.length):null,
      unit:'',period:roll7,
      coverage:{eligible:ses.length,available:trs.length},
      provenance:{method:'banister_trimp',version:'1.0.0',sources:['garmin','manual'],
        inputs:{formula:'min × HRr × 0,64 × e^(k·HRr)',k:k,restingHr:rhr,maxHr:hrMax,
          maxHrSource:hrMaxMeasured!=null?'gemessen':'tanaka',sexParameter:female?'female':'male',
          durationUnit:'min',hrrClamp:'(0,1]',rounding:'ganzzahlig'},
        assumptions:assum},
      reason:(hrMax==null||rhr==null)?'ohne gemessenen Ruhepuls bzw. HFmax kein TRIMP (kein Fallback)':(trs.length?null:'keine Einheiten mit Ø-HF')});
    /* 2.4 Interferenz — kanonischer Producer Calc.evaluateLoadAndInterference
       (Lastsprung 3/7 Tage + Bein-Interferenz), Eingaben aus der kanonischen
       Tageslast-Serie und dem heutigen Check-in. */
    try{
      var L=(typeof allLoads==='function')?allLoads():null;
      var l3=null,l7=null;
      if(L&&L.loads&&L.loads.length>=7){
        var arr=L.loads;var n=arr.length;
        var sum=function(kk){var s2=0,c=0;for(var i=1;i<=kk;i++){var v=arr[n-i];if(v!=null){s2+=v;c++;}}return c===kk?s2/kk:null;};
        l3=sum(3);l7=sum(7);
      }
      var m0=null;try{var e0=DB[todayStr()];m0=e0&&e0.morning;}catch(_){ }
      var tt0=null;try{tt0=(typeof todayPrimaryUnit==='function')?todayPrimaryUnit():null;}catch(_){ }
      var eli=(Calc&&Calc.evaluateLoadAndInterference)?Calc.evaluateLoadAndInterference(
        {loads:{load3:l3,load7:l7},doms:(m0&&m0.doms!=null)?m0.doms:0},
        {legLoad:!!(tt0&&/gym|kraft|leg|interval|tempo|long/i.test((tt0.t||'')+' '+(tt0.l||'')))}):null;
      var interfTxt=null;
      if(eli){interfTxt=eli.notes&&eli.notes.length?eli.notes.join(' + ')+(eli.spikePct!=null?' (+'+eli.spikePct+' % über 7-Tage-Schnitt)':''):'Keine Auffälligkeit (Lastsprung/Bein-Interferenz)';}
      out.interf=E.create({metricId:'load_interference',
        value:interfTxt,unit:null,period:roll7,
        coverage:{eligible:2,available:(l3!=null&&l7!=null?1:0)+(m0?1:0)},
        provenance:{method:'load_spike_and_leg_interference',version:'1.0.0',sources:['garmin','manual'],
          inputs:{load3:l3!=null?Math.round(l3):null,load7:l7!=null?Math.round(l7):null,doms:(m0&&m0.doms)||0},assumptions:[]},
        reason:(l3==null||l7==null)?'Tageslast-Serie fuer 3/7-Tage-Vergleich unvollstaendig':null});
    }catch(_){ }
    /* 2.5 Easy Share — klassifizierte leichte Laeufe / alle KLASSIFIZIERTEN Laeufe. */
    try{
      var runs=(typeof runsWindow==='function')?runsWindow(28):[];
      var esd=(Calc&&Calc.easyShareDetail)?Calc.easyShareDetail(runs):null;
      if(esd)out.easy=E.create({metricId:'easy_share',
        value:esd.share!=null?Math.round(esd.share*100):null,
        unit:'%',period:{type:'rolling',days:28,startDate:dkey(-27),endDate:todayStr()},
        coverage:{eligible:esd.totalRuns,available:esd.classifiedRuns},
        provenance:{method:'label_or_hr_easy_share',version:'1.0.0',sources:['garmin','manual'],
          inputs:{easyMin:esd.easyMin,classifiedMin:esd.classifiedMin,hrMax:esd.hrMaxUsed},
          assumptions:esd.hrMaxUsed==null?['ohne_hfmax_nur_labels']:[]},
        reason:esd.share==null?'unter 6 klassifizierbare Laeufe in 28 Tagen':null});
    }catch(_){ }
  }catch(_){ }
  return out;
}
/* Schmale Sicht fuer die bestehenden Kartenzellen — liest NUR Envelopes. */
function gmLoadExtras(){
  var env=null;try{env=gmLoadEnvelopes();}catch(_){ }
  var res={trimp:null,hi:null,sport:null,interf:null,env:env};
  if(!env)return res;
  if(env.trimp&&env.trimp.value!=null)res.trimp=env.trimp.value;
  if(env.hard&&env.hard.value!=null)res.hi=env.hard.value+' %';
  if(env.sport&&env.sport.value)res.sport=env.sport.value;
  if(env.interf&&env.interf.value!=null)res.interf=env.interf.value;
  return res;
}
function gmDashVM(){
  var os=null;try{os=(typeof orviaScore==='function')?orviaScore():null;}catch(_){ }
  var e=(typeof DB!=='undefined'&&DB)?DB[todayStr()]:null;var m=e&&e.morning;
  var ciDone=!!(m&&Object.keys(m).length);
  var stC=os?({g:'ready',y:'attention',o:'attention',r:'crit'})[os.status.c]||'attention':'neutral';
  var lead=os?(os.dayState==='GREEN'?'Trainieren – kontrolliert bleiben':os.dayState==='YELLOW'?'Reduzieren empfohlen':os.dayState==='ORANGE'?'Anpassen / Ersatztraining':'Regeneration priorisieren'):'Check-in ausstehend';
  /* GM7.2: kurzes Pill-Wort (GM: „Bereit"/„Moderat"/…) statt langem Statustext,
     der aus dem 150-px-Ring herausragte. Peak bleibt Peak (statusText). */
  var pillWord=os?((os.statusText==='Peak')?'Peak':({GREEN:'Bereit',YELLOW:'Moderat',ORANGE:'Anpassen',RED:'Erholung'})[os.dayState]||os.status.l):'Check-in';
  var why=[];try{var dd=os&&os.decision;
    if(dd&&dd.triggers&&dd.triggers.length)why=dd.triggers.map(function(t){return t.title+' — '+t.detail;});
    else if(dd&&dd.readinessReasons)why=dd.readinessReasons.slice(0,3);}catch(_){ }
  if(!why.length)why=[os?'Stabile Werte – nichts Auffälliges.':'2 Minuten Morgen-Check-in, dann steht deine Tagesentscheidung.'];
  var rec=null;try{rec=os&&os.decision&&os.decision.recommendedSession;}catch(_){ }
  var ad=null;try{ad=(typeof adaptToday==='function')?adaptToday():null;}catch(_){ }
  var bb=gmMetric('body_battery');
  var ld=null,atl=null,ctl=null,tsb=null,suppress=false;
  try{var L=(typeof allLoads==='function')?allLoads():null;
    if(L){var S=Calc.loadSeries(L.loads);
      atl=S.atl&&S.atl.length?Math.round(S.atl[S.atl.length-1]):null;
      ctl=S.ctl&&S.ctl.length?Math.round(S.ctl[S.ctl.length-1]):null;
      tsb=(S.tsb&&S.tsb.length)?Math.round(S.tsb[S.tsb.length-1]):((atl!=null&&ctl!=null)?(ctl-atl):null);
      try{var cc=Calc.loadConfidenceContract?Calc.loadConfidenceContract(L.confidence):null;suppress=!!(cc&&cc.suppressNumbers);}catch(_){ }
    }}catch(_){ }
  if(suppress){atl=null;ctl=null;tsb=null;}
  var u=null;try{u=(typeof todayPrimaryUnit==='function')?todayPrimaryUnit():null;}catch(_){ }
  var g=null;try{g=(typeof goalOf==='function')?goalOf():null;}catch(_){ }
  var wk=null;try{if(typeof isRunDistanceGoal==='function'&&isRunDistanceGoal()&&g&&g.raceDate)wk='Woche '+Math.max(1,Math.min(25,Calc.runnaWeek(daysTo(RACE.date))))+' / 25';}catch(_){ }
  var goalName=null;try{goalName=gmGoalLabel(g);}catch(_){ }
  var ciVals=[];
  if(ciDone){if(m.sleepMin!=null)ciVals.push(['Schlaf',fmtDe(m.sleepMin/60)+' h']);
    if(m.sleepQ!=null)ciVals.push(['Qualität',fmtDe(m.sleepQ)+'/10']);
    if(m.bb!=null)ciVals.push(['Body Battery',fmtDe(m.bb)]);
    if(m.knee!=null)ciVals.push(['Knie',fmtDe(m.knee)+'/10']);}
  var pain=(m&&m.knee!=null&&m.knee>=1)?{region:'Knie',level:fmtDe(m.knee)+'/10 gemeldet',note:'aus deinem Morgen-Check-in'}:null;
  var warnings=[];try{if(os&&os.decision&&os.decision.triggers)warnings=os.decision.triggers.map(function(t){return ['alert',t.title,t.detail];});}catch(_){ }
  try{var pz=(typeof pauseFor==='function')?pauseFor(todayStr()):null;if(pz)warnings.push(['moon','Pause aktiv',(pz.reason||'Pause')+' — der Plan pausiert bis '+(pz.to||'auf Weiteres')+'.']);}catch(_){ }
  var hrv=gmMetric('hrv_ms'),rhr=gmMetric('resting_hr'),sl=gmMetric('sleep_duration_min'),str=gmMetric('stress_avg');
  var _vm={
    hasScore:!!os,score:os?os.score:null,status:os?os.status.l:'Check-in ausstehend',statusColor:stC,pillWord:pillWord,
    simpleStatus:os?os.status.l:'Check-in ausstehend',lead:lead,simpleLead:lead,
    why:why.slice(0,3).join(' '),whyList:why,ciDone:ciDone,
    deltas:gmReadinessDeltas(os?((os.r&&os.r.score!=null)?os.r.score:os.score):null),
    reco:{cls:stC==='neutral'?'attention':stC,ic:stC==='ready'?'bolt':stC==='crit'?'shield':'gauge',
      t:rec?rec.label:(os?lead:'Check-in ausfüllen'),d:rec?(rec.detail||''):'Danach steht deine konkrete Empfehlung.'},
    simpleReco:null,
    pro:rec?('<b>'+gmEsc(rec.label)+'.</b> '+gmEsc(rec.detail||'')):GM_NA,
    changelog:ad?{from:ad.origLabel||'—',to:ad.newTitle||'—',reason:(ad.why&&ad.why[0])||'Tagesanpassung'}:null,
    session:{name:rec?rec.label:(u?u.l:'Training'),detail:rec?(rec.detail||''):(u?u.t:'')},
    battery:bb?(bb.value!=null?bb.value:null):null,
    charge:null,drain:null,
    ciVals:ciVals,mCheck:m||null,
    /* GM6.1 §4: kanonische Auswahl, direkt aus dem bestehenden Check-in-Wert
       projiziert. Einzige Quelle der Wahrheit bleibt morning.feel. */
    mood:gmMoodKey(m?m.feel:null),
    load:(function(){
      var lm=null,lcc=null;try{var L2=(typeof allLoads==='function')?allLoads():null;
        if(L2&&Calc.loadModel){lm=Calc.loadModel(L2.loads);lcc=Calc.loadConfidenceContract?Calc.loadConfidenceContract(L2.confidence):null;}}catch(_){ }
      var sup2=!!(lcc&&lcc.suppressNumbers);
      var acwrOk=!!(lm&&lm.acwr!=null&&lm.acwrReliable&&!sup2);
      var band=null;if(acwrOk){band=Math.max(4,Math.min(96,Math.round((lm.acwr-0.4)/(1.8-0.4)*100)));}
      var word=null,scv='neutral';
      if(acwrOk){if(lm.acwr<0.8){word='Erholt';scv='cyan';}else if(lm.acwr<=1.3){word='Im grünen Bereich';scv='ready';}else if(lm.acwr<=1.5){word='Erhöht';scv='attention';}else{word='Überlastet';scv='crit';}}
      /* KF-004: trimp/hi/sport/interf kommen jetzt aus gmLoadExtras() — echte
         Produzenten mit dokumentierten Regeln; fehlende Datenbasis bleibt null. */
      var ex=null;try{ex=(typeof gmLoadExtras==='function')?gmLoadExtras():null;}catch(_){ }
      return {atl:atl,ctl:ctl,tsb:tsb!=null?((tsb>=0?'+':'')+tsb):null,
        status:word,word:word,statusColor:scv,
        acwr:acwrOk?fmtDe(lm.acwr):null,band:band,
        mono:(lm&&lm.monotony!=null&&!sup2)?fmtDe(lm.monotony):null,
        strain:(lm&&lm.strain!=null&&!sup2)?fmtDe(lm.strain):null,
        trimp:(ex&&ex.trimp!=null)?fmtDe(ex.trimp):null,
        hi:(ex&&ex.hi!=null)?ex.hi:null,
        sport:(ex&&ex.sport)?ex.sport:[['Laufen',null,'ready'],['Kraft',null,'activity'],['Rad',null,'cyan']],
        interf:(ex&&ex.interf)?ex.interf:null,
        env:(ex&&ex.env)?ex.env:null};
    })(),
    goal:(function(){
      var pred='—',predD='flat';
      try{var bt=(typeof bestTimes==='function')?bestTimes():null;
        if(bt&&bt.t10!=null&&g&&/half|hm/i.test(String(g.type||''))&&Calc.riegelHM){
          var hmMin=Calc.riegelHM(10,bt.t10/60);
          if(hmMin!=null)pred='Prognose '+Calc.fmtTime(hmMin);}}catch(_){ }
      return {name:goalName||'—',pct:null,wk:wk||'—',pred:pred,predD:predD};
    })(),
    pain:pain,warnings:warnings,
    breakdown:gmReadinessBreakdown(os),
    conf:gmConfVM(),
    contrib:gmLoadContrib(),
    /* batteryWord entfernt (Phase 1, 1c): war syntaktisch IMMER null (beide Zweige)
       und wurde von keinem Renderer gelesen. */
    next:u?{t:u.l,s:u.t+(wk?' · '+wk:''),tag:'Heute'}:null,
    metrics:(function(){
      var stp=gmMetric('steps'),kc=gmMetric('active_kcal'),ssc=gmMetric('sleep_score');
      var hs=gmMetricSeries('hrv_ms',14),sts=gmMetricSeries('stress_avg',14);
      var vo2=gmMetric('vo2max_running'),vo2c=gmMetric('vo2max_cycling'),resp=gmMetric('respiration_avg');
      return {hrv:hrv?hrv.value:null,hrvLbl:gmStandLbl(hrv),rhr:rhr?rhr.value:null,sleepMin:sl?sl.value:null,stress:str?str.value:null,stressLbl:gmStandLbl(str),
        /* GM7.4-A: Schritte/aktive kcal tragen jetzt ihr ehrliches Stand-Label;
           ein Altwert erscheint nicht mehr als „heute". */
        steps:stp?stp.value:null,stepsLbl:gmStandLbl(stp),kcal:kc?kc.value:null,kcalLbl:gmStandLbl(kc),
        /* GM7.6 (Teilbereich 6): Fortschrittsbalken reagieren auf den ECHTEN Wert. Es gibt
           keinen kanonischen Schritt-/kcal-Zielvertrag — als ehrliche, rein praesentische
           Skala dient das persoenliche 14-T-Maximum derselben gespeicherten Serie (gleiche
           Normalisierung wie eine Sparkline; kein erfundenes Ziel). Ohne Serie bleibt der
           Balken leer. */
        stepsPct:(function(){try{if(!stp||stp.value==null)return null;var s3=gmMetricSeries('steps',14);if(!s3||!s3.values.length)return null;var mx=Math.max.apply(null,s3.values.concat([stp.value]));return mx>0?Math.round(Math.min(100,stp.value/mx*100)):null;}catch(_){return null;}})(),
        kcalPct:(function(){try{if(!kc||kc.value==null)return null;var s4=gmMetricSeries('active_kcal',14);if(!s4||!s4.values.length)return null;var mx2=Math.max.apply(null,s4.values.concat([kc.value]));return mx2>0?Math.round(Math.min(100,kc.value/mx2*100)):null;}catch(_){return null;}})(),
        sleepScore:ssc?ssc.value:null,
        vo2max:vo2?vo2.value:null,vo2maxCycling:vo2c?vo2c.value:null,respiration:resp?resp.value:null,
        /* GM7.2: Erholungs-Composite IST kanonisch = getDecision().subscores.recovery.value
           (calc.js readiness, kombiniert HRV/Ruhepuls/Schlaf; nie null bei Entscheidung).
           KEINE neue UI-Formel — nur der vorhandene Subscore. */
        recovery:(os&&os.recovery!=null)?os.recovery:null,
        hrvSeries:(hs&&hs.values.length>=3)?hs.values:null,
        stressSeries:(sts&&sts.values.length>=3)?sts.values:null};
    })()
  };
  _vm.simpleReco=_vm.reco;
  return _vm;
}
/* --- GM-Bausteine (Markup 1:1 Golden Master; Werte aus dem VM) --- */
function gmVal(v,unit){return v==null?'—':gmEsc(fmtDe(v))+(unit||'');}
function gmCtaRow(d){
  var lvl=gmLevel();
  if(d.statusColor==='crit')return '<div class="cta-row"><button class="cta wide-ghost" onclick="gmStartTraining()">'+icon('shield','sm')+' Leichte Alternative ansehen<span class="ct-sub">'+gmEsc(d.session.detail)+'</span></button></div>';
  var prim='<button class="cta prim" onclick="gmStartTraining()">'+icon('play','sm')+' '+gmEsc(d.session.name)+' starten<span class="ct-sub">'+gmEsc(d.session.detail)+'</span></button>';
  if(lvl==='a')return '<div class="cta-row">'+prim+'</div>';
  return '<div class="cta-row">'+prim+'<button class="cta ghost" aria-label="Im Plan ansehen" onclick="showTab(\'plan\')">'+icon('calendar','sm')+'</button></div>';
}
function gmBatt(d){
  var v=d.battery;var lvl=gmLevel();
  if(lvl==='a'){var word=v==null?'—':(v<30?'Niedrig':v<55?'Mittel':'Hoch');
    return '<div class="batt tap" role="button" tabindex="0" onclick="openMetric(\'body_battery\')" style="margin-top:14px"><span class="taphint">'+icon('chev','xs')+'</span><div class="batt-head"><div class="t">'+icon('battery','sm')+' Energiereserve</div><div class="v" style="color:'+(v==null?'var(--muted)':v<30?'var(--crit)':v<55?'var(--attention)':'var(--ready)')+'">'+word+'</div></div>'+
    '<div class="batt-track"><div class="batt-fill" style="width:'+(v==null?0:Math.max(0,Math.min(100,v)))+'%;background:'+(v==null?'transparent':battGrad(v))+'"></div></div></div>';}
  return '<div class="batt tap" role="button" tabindex="0" aria-label="Body Battery" onclick="openMetric(\'body_battery\')" onkeydown="if(event.key===\'Enter\')openMetric(\'body_battery\')"><span class="taphint">'+icon('chev','xs')+'</span>'+
    '<div class="batt-head"><div class="t">'+icon('battery','sm')+' Body Battery</div><div class="v">'+(v==null?'—':gmEsc(fmtDe(v))+'<small>/100</small>')+'</div></div>'+
    '<div class="batt-track"><div class="batt-fill" style="width:'+(v==null?0:Math.max(0,Math.min(100,v)))+'%;background:'+(v==null?'transparent':battGrad(v))+'"></div></div>'+
    '<div class="batt-sub"><span class="chg" id="gmBattChg">▲ '+(d.charge==null?'—':gmEsc(d.charge))+'</span><span class="drn" id="gmBattDrn">▼ '+(d.drain==null?'—':gmEsc(d.drain))+'</span></div></div>';
}
/* GM7.6: Lade-/Verbrauchsbilanz im Hero aus der ECHTEN gespeicherten Intraday-Kurve
   (body_battery_intraday): Summe positiver/negativer Aenderungen — dieselbe reine
   Delta-Aggregation wie im Detail-Sheet (gmBbBalance). Asynchron, nur Text-Ersatz in
   vorhandene Slots (keine Listener, kein Re-Render); ohne Serie bleibt ehrlich „—". */
function gmLoadHeroBattBalance(){
  try{
    var R=window.ORVIA&&ORVIA.seriesReader;if(!R||!R.read)return;
    if(!document.getElementById('gmBattChg'))return;
    R.read({metricType:'body_battery_intraday',fromDate:todayStr(),today:todayStr(),fetchRows:gmSeriesFetch}).then(function(res){
      var c=document.getElementById('gmBattChg'),dr=document.getElementById('gmBattDrn');
      if(!c||!dr)return;
      if(res.state==='ok'&&res.series.length&&res.series[0].points.length>=2){
        var pts=res.series[0].points,up=0,down=0;
        for(var i=1;i<pts.length;i++){var dv=pts[i][1]-pts[i-1][1];if(!isFinite(dv))continue;if(dv>0)up+=dv;else down+=-dv;}
        c.textContent='▲ +'+Math.round(up);dr.textContent='▼ −'+Math.round(down);
      }
    }).catch(function(){});
  }catch(_){ }
}
function gmHero(d){
  var lvl=gmLevel();
  var ringHtml=d.hasScore?ring(d.score,SC[d.statusColor],lvl==='a'?170:150,lvl==='a'?14:12):ring(0,'var(--neutral)',lvl==='a'?170:150,lvl==='a'?14:12);
  var scoreRing='<div class="ring-wrap" role="button" tabindex="0" aria-label="ORVIA-Score, Details öffnen" onclick="openScore()" onkeydown="if(event.key===\'Enter\')openScore()">'+ringHtml+
    '<div class="ring-c"><div class="big">'+(d.hasScore?gmEsc(String(d.score)):'—')+'</div><div class="u">'+(lvl==='a'?'DEIN SCORE':'ORVIA-SCORE')+' '+icon('chev','xs')+'</div>'+
    '<div class="statuspill sp-'+d.statusColor+'" style="background:'+(TINT[d.statusColor]||'var(--surface)')+';color:'+(SC[d.statusColor]||'var(--muted)')+'">'+icon(d.statusColor==='ready'?'bolt':d.statusColor==='crit'?'shield':'gauge','xs')+' '+gmEsc(d.pillWord||(lvl==='a'?d.simpleStatus:d.status))+'</div></div></div>';
  var reco;
  if(lvl==='p'){
    reco='<div class="reco flow '+d.reco.cls+'"><div class="rc-ic">'+icon(d.reco.ic)+'</div><div><div class="rt">'+gmEsc(d.reco.t)+'</div><div class="prescription">'+d.pro+'</div></div></div>'+
      '<div class="adjust"><div class="adjust-h">Empfehlung anpassen</div><div class="adjust-row">'+
      ['gauge|Intensität','calendar|Dauer','chart|Volumen','run|Sportart','target|Priorität'].map(function(x){var p=x.split('|');
        /* Phase 1b: war ein anklickbar wirkender Chip ohne Funktion. Jetzt reine
           Auflistung dessen, was die Empfehlung spaeter anpassen koennen soll. */
        return '<span class="adjchip adj-na">'+icon(p[0])+' '+p[1]+'</span>';}).join('')+'</div>'+
      (d.changelog?'<div class="changelog">'+icon('pen','sm')+'<div><b>Zuletzt geändert:</b> '+gmEsc(d.changelog.from)+' → '+gmEsc(d.changelog.to)+' · Grund: '+gmEsc(d.changelog.reason)+'</div></div>':'')+'</div>';
  }else{
    var rc=(lvl==='a'&&d.simpleReco)?d.simpleReco:d.reco;
    reco='<div class="reco flow '+(lvl==='a'?'big ':'')+rc.cls+'"'+(lvl==='a'?' style="margin-top:16px"':'')+'><div class="rc-ic">'+icon(rc.ic)+'</div><div><div class="rt">'+gmEsc(rc.t)+'</div><div class="rd">'+gmEsc(rc.d)+'</div></div></div>';
  }
  var aura='<div class="hero-aura" data-aura="'+(d.hasScore?d.statusColor:'neutral')+'" aria-hidden="true"></div>';
  if(lvl==='a'){
    return '<div class="hero simple">'+aura+'<div class="hero-top">'+scoreRing+'<div class="hero-right"><div class="lead">'+gmEsc(d.simpleLead)+'</div></div></div>'+reco+gmCtaRow(d)+gmBatt(d)+'</div>';
  }
  return '<div class="hero">'+aura+'<div class="hero-top">'+scoreRing+'<div class="hero-right"><div class="lead">'+gmEsc(d.lead)+'</div><div class="why">'+gmEsc(d.why)+'</div>'+
    '<div class="deltas">'+d.deltas.map(function(x){return '<span class="delta '+x[0]+'">'+arrow(x[0])+' '+gmEsc(x[1])+'</span>';}).join('')+'</div></div></div>'+
    reco+gmCtaRow(d)+gmBatt(d)+'</div>';
}
/* Check-in-Karte (GM): steuert NUR das bestehende Formular (#checkinCard) — nie neu erzeugen. */
function renderCheckinCompact(){try{
  var box=document.getElementById('checkinCompact');if(!box)return;
  var d=gmDashVM();
  /* Dichte folgt dem Darstellungsmodus: gmLevel() ist die GM-Kurzform von
     uiDetailMode() (a|f|p, js/ui.js). Sie steuert ausschliesslich die
     Erklaertiefe — niemals Fachwerte, Zustandswahrheit oder Missingness. */
  var lvl=gmLevel();
  box.className='card tight'; /* GM-Layout; Legacy .ci-compact-Flex würde die GM-Zeile zerlegen */
  /* GM6: Stufe a mit offenem Check-in verwendet im Golden Master die
     Stimmungsauswahl .ci-simple in einer .card OHNE .tight (checkinCard(), GM-Zeile
     ~600). Die drei .mood-Felder loesen ausschliesslich die bereits vorhandene,
     sichere Aktion aus (Karte aufklappen + zum Formular scrollen) — sie speichern
     nichts. stopPropagation verhindert das doppelte Auslösen von
     toggleCheckinCard() am Container (index.html:129).
     GM6.1 §4: Der aktive Zustand .on wird jetzt aus dem Golden Master migriert.
     Er ist eine reine PROJEKTION von d.mood (= gmMoodKey(morning.feel)) — es gibt
     keinen zweiten Zustandsspeicher, kein Schreiben auf `feel` und damit keine
     Verschiebung des Readiness-Scores (Gewicht 15). Deshalb zeigt ein erneutes
     Rendern immer exakt die kanonische Auswahl; ein Tap ohne gespeicherten Wert
     markiert nur optisch (GM-Verhalten window.setMood, GM-Zeile 699) und fuehrt
     danach in das echte Formular, in dem der Wert tatsaechlich erfasst wird. */
  if(lvl==='a'&&!d.ciDone){
    box.className='card';
    var GO='event.stopPropagation();gmSetMood(this);gotoCheckinForm()';
    var MOODS=[['😃','Top','top'],['🙂','Geht so','ok'],['😴','Müde','tired']];
    box.innerHTML='<div class="ci-simple"><div class="q">Wie fühlst du dich heute?</div><div class="moods">'+
      MOODS.map(function(m){var on=(d.mood===m[2]);
        return '<div class="mood'+(on?' on':'')+'" data-mood="'+m[2]+'" role="button" aria-pressed="'+(on?'true':'false')+'" tabindex="0" onclick="'+GO+'" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();'+GO+';}"><div class="em">'+m[0]+'</div><div class="ml">'+m[1]+'</div></div>';}).join('')+
      '</div></div>';
    box.dataset.state='open';
    return;
  }
  if(!d.ciDone){
    box.innerHTML='<div class="checkin"><div class="ci-ic" style="background:var(--attention-t);color:var(--attention)">'+icon('pen')+'</div>'+
      '<div class="ci-b"><div class="ci-t">Morgen-Check-in</div><div class="ci-s">'+(lvl==='a'?'Kurz ausfüllen — dann steht deine Tagesentscheidung.':'Noch nicht ausgefüllt · verbessert die Empfehlung')+'</div></div>'+
      '<span class="ci-pill ci-open">Offen</span></div>';
  }else{
    box.innerHTML='<div class="checkin"><div class="ci-ic" style="background:var(--ready-t);color:var(--ready)">'+icon('check')+'</div>'+
      '<div class="ci-b"><div class="ci-t">Morgen-Check-in</div><div class="ci-s">Heute erledigt · fließt in den Score ein</div></div>'+
      '<span class="ci-pill ci-done">Erledigt</span></div>'+
      (d.ciVals.length&&lvl!=='a'?'<div class="ci-vals">'+d.ciVals.map(function(v){return '<span class="ci-val">'+gmEsc(v[0])+' <b>'+gmEsc(v[1])+'</b></span>';}).join('')+'</div>':'');
  }
  box.dataset.state=d.ciDone?'done':'open';
}catch(_){ }}
/* --- Module (Struktur 1:1 GM; fehlende Quelle ⇒ „—"/Noch nicht verfügbar) --- */
function gmTap(mid){return 'class="kcard tap" role="button" tabindex="0" onclick="openMetric(\''+mid+'\')" onkeydown="if(event.key===\'Enter\')openMetric(\''+mid+'\')"';}
function gmModRecovery(d){var M=d.metrics;
  return '<div '+gmTap('sleep_duration_min')+'><span class="taphint">'+icon('chev','xs')+'</span><div class="kh">'+icon('moon')+' Schlaf</div><div class="kv">'+(M.sleepScore!=null?gmEsc(fmtDe(M.sleepScore))+'<small>/100</small>':'—')+'</div><div class="kd flat">'+(M.sleepMin!=null?gmEsc(fmtDe(M.sleepMin/60))+' h geschlafen':GM_NA)+'</div><div class="bar-mini"><i style="width:'+(M.sleepScore!=null?M.sleepScore:0)+'%;background:var(--sleep)"></i></div><div style="font-size:10.5px;color:var(--muted);font-weight:650;margin-top:7px">'+(M.sleepMin!=null?gmEsc(fmtDe(M.sleepMin/60))+' h'+(function(){var _dp=gmMetric('sleep_deep_min');return (_dp&&_dp.value!=null)?' · Tief '+gmEsc(fmtDe(Math.round(_dp.value)))+' min':' · Phasen: —';})():'—')+'</div></div>'+
  '<div class="kcard tap" role="button" tabindex="0" onclick="openRecoverySheet()" onkeydown="if(event.key===\'Enter\')openRecoverySheet()"><span class="taphint">'+icon('chev','xs')+'</span><div class="kh">'+icon('heart')+' Erholung</div><div class="kv">'+(M.recovery!=null?gmEsc(fmtDe(M.recovery))+'<small>%</small>':'—')+'</div><div class="kd flat">'+(M.hrv!=null?'HRV '+gmEsc(fmtDe(M.hrv))+' ms':GM_NA)+'</div><div class="bar-mini"><i style="width:'+(M.recovery!=null?M.recovery:0)+'%;background:var(--ready)"></i></div><div style="font-size:10.5px;color:var(--muted);font-weight:650;margin-top:7px">'+(M.rhr!=null?'Ruhepuls '+gmEsc(fmtDe(M.rhr))+' bpm':GM_NA)+'</div></div>';}
function gmModVitals(d){var M=d.metrics;
  var chart=M.hrvSeries?sparkline(M.hrvSeries.slice(-8),SC.ready):'<div class="spark" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--faint)">Verlauf '+GM_NA.toLowerCase()+'</div>';
  return '<div class="kcard tap" role="button" tabindex="0" style="grid-column:span 2" onclick="openMetric(\'hrv_ms\')" onkeydown="if(event.key===\'Enter\')openMetric(\'hrv_ms\')"><span class="taphint">'+icon('chev','xs')+'</span><div class="ctitle" style="margin-bottom:8px"><div class="l">'+icon('pulse')+' HRV &amp; Ruhepuls</div><span class="kd flat">'+(M.hrv!=null?'heute':'—')+'</span></div>'+
    '<div style="display:flex;gap:14px;align-items:flex-end"><div style="flex:1">'+chart+'</div><div style="text-align:right"><div style="font-size:22px;font-weight:800;font-variant-numeric:tabular-nums">'+(M.hrv!=null?gmEsc(fmtDe(M.hrv))+' ms':'—')+'</div><div style="font-size:10.5px;color:var(--muted);font-weight:700">HRV heute</div></div></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);font-weight:650;margin-top:8px"><span>'+(function(){
      /* GM7.5h: kanonische HRV-Baseline (recoveryCtx.hrvBase7, ln-Mittel) — identische
         Anzeige-Konversion wie readiness-store.js (~exp(base)); ohne 4+ Messwerte „—". */
      try{var _c=recoveryCtx(todayStr());if(_c&&_c.hrvBase7!=null)return 'Baseline ~'+Math.round(Math.exp(_c.hrvBase7))+' ms';}catch(_){ }
      return 'Baseline —';})()+'</span><span>Ruhepuls '+(M.rhr!=null?gmEsc(fmtDe(M.rhr))+' bpm':'—')+'</span></div></div>';}
function gmModVitalsFull(d){var M=d.metrics;
  var chart=M.hrvSeries?sparkline(M.hrvSeries,SC.ready):'<div class="spark" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--faint)">Verlauf '+GM_NA.toLowerCase()+'</div>';
  var cell=function(v,l){return '<div style="text-align:center"><div style="font-size:15px;font-weight:800">'+(v==null?'—':gmEsc(fmtDe(v)))+'</div><div style="font-size:9.5px;color:var(--muted);font-weight:700">'+l+'</div></div>';};
  return '<div class="card tap" role="button" tabindex="0" onclick="openMetric(\'hrv_ms\')" onkeydown="if(event.key===\'Enter\')openMetric(\'hrv_ms\')"><div class="ctitle"><div class="l">'+icon('pulse')+' Vitalwerte</div><span class="more">Details '+icon('chev','xs')+'</span></div>'+
    '<div style="display:flex;gap:14px;align-items:flex-end"><div style="flex:1">'+chart+'</div><div style="text-align:right"><div style="font-size:24px;font-weight:800;font-variant-numeric:tabular-nums">'+(M.hrv!=null?gmEsc(fmtDe(M.hrv))+' ms':'—')+'</div><div style="font-size:10.5px;color:var(--muted);font-weight:700">HRV '+(M.hrv!=null?gmEsc(M.hrvLbl||'—'):'—')+'</div></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:13px;padding-top:13px;border-top:1px solid var(--hair)">'+cell(M.rhr,'Ruhepuls')+cell(null,'HRR')+cell(M.vo2max,M.vo2maxCycling!=null?'VO₂max Lauf':'VO₂max')+cell(M.respiration,'Atmung')+(M.vo2maxCycling!=null?cell(M.vo2maxCycling,'VO₂max Rad'):'')+'</div></div>';}
function gmModStress(d){var M=d.metrics;
  var chart=M.stressSeries?sparkline(M.stressSeries,SC.ready):'<div class="spark" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--faint)">Verlauf '+GM_NA.toLowerCase()+'</div>';
  return '<div class="card tap" role="button" tabindex="0" onclick="openMetric(\'stress_avg\')" onkeydown="if(event.key===\'Enter\')openMetric(\'stress_avg\')"><div class="ctitle" style="margin-bottom:8px"><div class="l">'+icon('wind')+' Stress</div><span class="kd flat">'+(M.stress!=null?gmEsc(M.stress!=null&&M.stressLbl==='heute'?'Ø heute':(M.stressLbl||'—')):'—')+'</span></div>'+
    '<div style="display:flex;gap:14px;align-items:flex-end"><div style="flex:1">'+chart+'</div><div style="text-align:right"><div style="font-size:22px;font-weight:800;font-variant-numeric:tabular-nums">'+(M.stress!=null?gmEsc(fmtDe(M.stress)):'—')+'</div><div style="font-size:10.5px;color:var(--muted);font-weight:700">'+(M.stress!=null&&M.stressLbl==='heute'?'Ø heute':gmEsc(M.stressLbl||'—'))+'</div></div></div></div>';}
function gmModActivity(d){var M=d.metrics;
  return '<div '+gmTap('steps')+'><span class="taphint">'+icon('chev','xs')+'</span><div class="kh">'+icon('activity')+' Schritte</div><div class="kv">'+(M.steps!=null?gmEsc(fmtDe(M.steps)):'—')+'</div><div class="kd flat">'+(M.steps!=null?gmEsc(M.stepsLbl||'—'):GM_NA)+'</div><div class="bar-mini"><i style="width:'+(M.stepsPct!=null?M.stepsPct:0)+'%;background:var(--activity)"></i></div></div>'+
  '<div '+gmTap('active_kcal')+'><span class="taphint">'+icon('chev','xs')+'</span><div class="kh">'+icon('bolt')+' Aktive Energie</div><div class="kv">'+(M.kcal!=null?gmEsc(fmtDe(M.kcal))+'<small>kcal</small>':'—')+'</div><div class="kd flat">'+(M.kcal!=null?gmEsc(M.kcalLbl||'—'):GM_NA)+'</div><div class="bar-mini"><i style="width:'+(M.kcalPct!=null?M.kcalPct:0)+'%;background:var(--activity)"></i></div></div>';}
function gmModLoadSimple(d){var L=d.load;
  var scv=L.statusColor&&L.statusColor!=='neutral'?L.statusColor:null;
  return '<div class="card tap" role="button" tabindex="0" onclick="openMetric(\'load\')" onkeydown="if(event.key===\'Enter\')openMetric(\'load\')"><span class="taphint">'+icon('chev','xs')+'</span><div class="simplecard"><div class="sc-ic" style="background:'+(scv?TINT[scv]:'var(--surface-2)')+';color:'+(scv?SC[scv]:'var(--muted)')+'">'+icon('gauge')+'</div><div><div class="sc-t">Belastung: '+(L.word?gmEsc(L.word):(L.atl!=null?'ATL '+gmEsc(fmtDe(L.atl)):'—'))+'</div><div class="sc-v">'+(L.status?'Status: '+gmEsc(L.status):GM_NA)+'</div></div><div class="sc-big" style="color:'+(scv?SC[scv]:'var(--muted)')+'">'+(scv?icon(scv==='ready'?'check':'alert','sm'):(L.ctl!=null?gmEsc(fmtDe(L.ctl)):'—'))+'</div></div>'+
  '<div class="zoneband" style="margin-top:14px">'+(L.band!=null?'<div class="mk" style="left:'+L.band+'%"></div>':'')+'</div><div class="range-lbl"><span>Erholt</span><span>Optimal</span><span>Überlastet</span></div></div>';}
function gmModLoadPro(d){var L=d.load;
  var dc=function(v,l){return '<div class="datacell"><div class="dl">'+l+'</div><div class="dn">'+(v==null?GM_NA:gmEsc(String(v)))+'</div></div>';};
  return '<div class="card mod-wide tap" role="button" tabindex="0" onclick="openMetric(\'load\')" onkeydown="if(event.key===\'Enter\')openMetric(\'load\')"><div class="ctitle"><div class="l">'+icon('gauge')+' Belastungssteuerung</div><span class="more">Details '+icon('chev','xs')+'</span></div>'+
    '<div class="body"><div class="ring-wrap" style="width:74px;height:74px">'+ring(L.atl!=null?Math.min(L.atl/85*100,100):0,'var(--activity)',74,8)+'<div class="ring-c"><div style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums">'+(L.atl!=null?gmEsc(fmtDe(L.atl)):'—')+'</div><div style="font-size:9px;color:var(--muted);font-weight:700">ATL</div></div></div>'+
    '<div class="load-stats"><div class="ls"><div class="n">'+(L.ctl!=null?gmEsc(fmtDe(L.ctl)):'—')+'</div><div class="l">CTL</div></div><div class="ls"><div class="n">'+(L.tsb!=null?gmEsc(L.tsb):'—')+'</div><div class="l">TSB</div></div><div class="ls"><div class="n">'+(L.acwr!=null?gmEsc(String(L.acwr)):'—')+'</div><div class="l">ACWR</div></div></div></div>'+
    '<div class="zoneband">'+(L.band!=null?'<div class="mk" style="left:'+L.band+'%"></div>':'')+'</div><div class="range-lbl"><span>Erhaltung</span><span>'+(L.status?gmEsc(L.status):'—')+'</span><span>Überlastet</span></div>'+
    /* Phase 2.2: „Harte Einheiten" (RPE-Proxy) — bewusst NICHT „Hochintensiv":
       das wuerde eine HF-Zonen-Auswertung suggerieren, die nicht existiert. */
    '<div class="datarow">'+dc(L.mono,'Monotonie')+dc(L.strain,'Strain (Wo.)')+dc(L.trimp,'TRIMP Ø')+dc(L.hi,'Harte Einheiten')+'</div>'+
    /* Phase 2.0/2.3: Abdeckung sichtbar an der Zahl — kein Wochenmittelwert ohne
       Warnhinweis. Zeile erscheint NUR, wenn ein Wert auf Teilabdeckung beruht. */
    (function(){var env=L.env;if(!env)return '';
      var parts=[];
      [['hard','Harte Einheiten','Einheiten'],['trimp','TRIMP','Einheiten']].forEach(function(x){
        var e=env[x[0]];if(e&&e.status==='partial')parts.push(x[1]+' aus '+e.coverage.available+' von '+e.coverage.eligible+' '+x[2]);});
      if(!parts.length)return '';
      return '<div class="interf">'+icon('alert','xs')+' <b>Teilabdeckung:</b> '+gmEsc(parts.join(' · '))+' · letzte 7 Tage — Details im Last-Sheet.</div>';})()+
    '<div style="font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:800;margin-top:14px">Belastung nach Sportart</div>'+
    '<div class="sportbars">'+L.sport.map(function(s){return '<div class="sportbar"><div class="sn">'+gmEsc(s[0])+'</div><div class="st"><i style="width:'+(s[1]!=null?s[1]:0)+'%;background:'+SC[s[2]]+'"></i></div><div class="sv">'+(s[1]!=null?gmEsc(fmtDe(s[1]))+'%':'—')+'</div></div>';}).join('')+'</div>'+
    '<div class="interf">'+icon('info','xs')+' <b>Interferenz:</b> '+(L.interf?gmEsc(L.interf):GM_NA)+'</div></div>';}
function gmModReadinessPro(d){
  var maxAbs=1;d.breakdown.forEach(function(b){if(b[1]!=null&&Math.abs(b[1])>maxAbs)maxAbs=Math.abs(b[1]);});
  var rows=d.breakdown.map(function(b){var v=b[1];var pos=v!=null&&v>=0;var w=v==null?0:Math.abs(v)/maxAbs*100;
    var col=b[2]==='neutral'||v==null?'var(--neutral)':(pos?SC[b[2]]:'var(--crit)');
    return '<div class="brow"><div class="bl"><span class="fdot" style="background:'+(SC[b[2]]||'var(--neutral)')+'"></span>'+gmEsc(b[0])+'</div><div class="bbar"><i style="'+(pos||v==null?'left:50%':'right:50%')+';width:'+(w/2)+'%;background:'+col+'"></i></div><div class="bv" style="color:'+(v==null?'var(--muted)':col)+'">'+(v==null?'—':(v>=0?(v===0?'0':'+'+v):v))+'</div><div class="bsd">'+gmEsc(b[3]||'—')+'</div></div>';}).join('');
  return '<div class="card tap" role="button" tabindex="0" onclick="openScore()" onkeydown="if(event.key===\'Enter\')openScore()"><div class="ctitle"><div class="l">'+icon('target')+' Readiness &amp; Konfidenz</div><span class="more">'+(d.conf.levelLabel?gmEsc(d.conf.levelLabel)+' ':'')+icon('chev','xs')+'</span></div>'+
    '<div class="breakdown">'+rows+'</div>'+
    '<div class="datarow"><div class="datacell"><div class="dl">Datenkonfidenz</div><div class="dn" style="color:'+(SC[d.conf.levelColor]||'var(--muted)')+'">'+(d.conf.levelLabel?gmEsc(d.conf.levelLabel):'—')+'</div></div><div class="datacell"><div class="dl">Baseline-Abw.</div><div class="dn">'+(d.conf.sd!=null?gmEsc(d.conf.sd):'—')+'</div></div></div>'+
    '<div class="interf" style="margin-top:8px">'+icon('db','xs')+' <b>Daten:</b> '+gmEsc(d.conf.complete!=null?d.conf.complete:GM_NA)+'. '+gmEsc(d.conf.note||'')+'</div></div>';}
function gmModNext(d){
  return '<div class="card"><div class="ctitle"><div class="l">'+icon('calendar')+' Bevorstehendes Training</div></div><div class="next-row"><div class="next-ic">'+icon('run')+'</div><div class="next-b"><div class="next-t">'+(d.next?gmEsc(d.next.t):'—')+'</div><div class="next-s">'+(d.next?gmEsc(d.next.s):'Kein Eintrag im Wochenplan')+'</div></div><span class="next-tag">'+(d.next?gmEsc(d.next.tag):'—')+'</span></div></div>';}
function gmModNextSimple(d){
  return '<div class="card"><div class="simplecard"><div class="sc-ic" style="background:var(--activity-t);color:var(--activity)">'+icon('run')+'</div><div><div class="sc-t">Nächstes Training</div><div class="sc-v">'+(d.next?gmEsc(d.next.t):'Kein Eintrag im Wochenplan')+'</div></div><span class="next-tag" style="margin-left:auto">'+(d.next?gmEsc(d.next.tag):'—')+'</span></div></div>';}
function gmModGoal(d){
  return '<div class="card"><div class="ctitle"><div class="l">'+icon('target')+' Ziel-Fortschritt</div><span class="more">'+gmEsc(d.goal.wk)+'</span></div><div style="font-size:15px;font-weight:800">'+gmEsc(d.goal.name)+'</div><div class="goalbar"><i style="width:'+(d.goal.pct!=null?d.goal.pct:0)+'%"></i></div><div class="goalmeta"><span>'+(d.goal.pct!=null?gmEsc(fmtDe(d.goal.pct))+'% des Aufbaus':'Fortschritt: —')+'</span><span>'+arrow(d.goal.predD)+' '+gmEsc(d.goal.pred)+'</span></div></div>';}
function gmModGoalSimple(d){
  return '<div class="card"><div class="simplecard" style="margin-bottom:2px"><div class="sc-ic" style="background:rgba(201,174,124,.14);color:var(--gold-soft)">'+icon('target')+'</div><div><div class="sc-t">'+gmEsc(d.goal.name)+'</div><div class="sc-v">'+gmEsc(d.goal.wk)+'</div></div><div class="sc-big" style="color:var(--gold-soft)">'+(d.goal.pct!=null?gmEsc(fmtDe(d.goal.pct))+'%':'—')+'</div></div><div class="goalbar"><i style="width:'+(d.goal.pct!=null?d.goal.pct:0)+'%"></i></div></div>';}
function gmModSleepSimple(d){var M=d.metrics;
  return '<div class="card tap" role="button" tabindex="0" onclick="openMetric(\'sleep_duration_min\')" onkeydown="if(event.key===\'Enter\')openMetric(\'sleep_duration_min\')"><span class="taphint">'+icon('chev','xs')+'</span><div class="simplecard"><div class="sc-ic" style="background:var(--sleep-t);color:var(--sleep)">'+icon('moon')+'</div><div><div class="sc-t">Schlaf</div><div class="sc-v">'+(M.sleepMin!=null?gmEsc(fmtDe(M.sleepMin/60))+' h geschlafen':GM_NA)+'</div></div><div class="sc-big">'+(M.sleepScore!=null?gmEsc(fmtDe(M.sleepScore)):'—')+'</div></div></div>';}
function gmModActivitySimple(d){var M=d.metrics;
  return '<div class="card tap" role="button" tabindex="0" onclick="openMetric(\'steps\')" onkeydown="if(event.key===\'Enter\')openMetric(\'steps\')"><span class="taphint">'+icon('chev','xs')+'</span><div class="simplecard"><div class="sc-ic" style="background:var(--activity-t);color:var(--activity)">'+icon('activity')+'</div><div style="flex:1"><div class="sc-t">Schritte: '+(M.steps!=null?gmEsc(fmtDe(M.steps)):'—')+'</div><div class="sc-v">'+(M.steps!=null?'heute':GM_NA)+'</div><div class="bar-mini" style="margin-top:8px"><i style="width:'+(M.stepsPct!=null?M.stepsPct:0)+'%;background:var(--activity)"></i></div></div></div></div>';}
function gmModPain(d){
  if(!d.pain)return '<div class="card"><div class="simplecard"><div class="sc-ic" style="background:var(--ready-t);color:var(--ready)">'+icon('check')+'</div><div><div class="sc-t">Keine Beschwerden</div><div class="sc-v">Nichts gemeldet — weiter so</div></div></div></div>';
  return '<div class="card" style="border-color:rgba(240,99,122,.3)"><div class="simplecard"><div class="sc-ic" style="background:var(--crit-t);color:var(--crit)">'+icon('knee')+'</div><div style="flex:1"><div class="sc-t">'+gmEsc(d.pain.region)+' · '+gmEsc(d.pain.level)+'</div><div class="sc-v">'+gmEsc(d.pain.note)+'</div></div></div></div>';}
/* ============================================================
   Module Ernaehrung / Abend-Check-in / Routinen (2026-08-05, Nutzerentscheidung)

   AUSGANGSLAGE: Diese drei Bereiche lagen als Legacy-Karten fest im Dashboard-DOM
   (index.html #nutritionBox, #eveCard, #routinesCard) — eigenes Markup, eigene
   Typografie, ausserhalb des Modulsystems, weder aus-/einblendbar noch anordenbar.
   Genau das war die Meldung „das passt alles nicht mehr" / „muss mit in die Module".

   VORGEHEN (bewusst konservativ): Die Module sind KOMPAKTE STATUSKARTEN im GM-Stil,
   die auf die vorhandenen, unveraenderten Formulare fuehren — exakt das Muster, das
   der Morgen-Check-in seit v5 nutzt (#checkinCompact + #checkinCard). Es entsteht
   KEIN zweiter Zustandsspeicher und kein zweites Formular; alle Werte stammen aus
   denselben kanonischen Quellen wie bisher. Fehlende Werte bleiben ehrlich „—".
   ============================================================ */
/* Energie & Ernaehrung: Tagesziel + Makroverteilung als EIN gestapelter Balken
   (statt drei konkurrierender Kacheln) + gemessene Protein-Adhaerenz. */
function gmModNutrition(d){
  var t=null,wk=null;
  try{t=(typeof nutToday==='function')?nutToday():null;}catch(_){ }
  try{wk=(typeof nutWeekly==='function')?nutWeekly():null;}catch(_){ }
  if(!t){
    return '<div class="card tap gm-ext" role="button" tabindex="0" onclick="openNutritionEditor()" onkeydown="if(event.key===\'Enter\')openNutritionEditor()"><span class="taphint">'+icon('chev','xs')+'</span>'+
      '<div class="simplecard"><div class="sc-ic" style="background:var(--activity-t);color:var(--activity)">'+icon('battery')+'</div>'+
      '<div style="flex:1"><div class="sc-t">Energie &amp; Ernährung</div><div class="sc-v">Körperdaten fehlen — dann rechnet ORVIA Kalorien und Makros</div></div></div></div>';
  }
  var pk=t.protein*4,ck=t.carbs*4,fk=t.fat*9,tot=pk+ck+fk;
  var pct=function(v){return tot>0?Math.round(v/tot*100):0;};
  var dtL={rest:'Ruhetag',easy:'Lockerer Tag',quality:'Intensiver Tag',long:'Long-Run-Tag',strength:'Krafttag'}[t.dayType]||'';
  return '<div class="card tap gm-ext" role="button" tabindex="0" onclick="gmOpenNutritionSheet()" onkeydown="if(event.key===\'Enter\')gmOpenNutritionSheet()"><span class="taphint">'+icon('chev','xs')+'</span>'+
    '<div class="ctitle"><div class="l">'+icon('battery')+' Energie &amp; Ernährung</div><span class="more">'+gmEsc(dtL)+'</span></div>'+
    '<div class="nu-hero"><b>'+gmEsc(fmtDe(t.kcal))+'</b><span>kcal Tagesziel'+(t.burn?' · inkl. ~'+gmEsc(fmtDe(t.burn))+' kcal Training':'')+'</span></div>'+
    '<div class="nu-stack" role="img" aria-label="Makroverteilung">'+
      '<i class="nu-p" style="width:'+pct(pk)+'%"></i><i class="nu-c" style="width:'+pct(ck)+'%"></i><i class="nu-f" style="width:'+pct(fk)+'%"></i></div>'+
    '<div class="nu-legend">'+
      '<span><i class="nu-p"></i>Protein <b>'+gmEsc(fmtDe(t.protein))+' g</b></span>'+
      '<span><i class="nu-c"></i>Carbs <b>'+gmEsc(fmtDe(t.carbs))+' g</b></span>'+
      '<span><i class="nu-f"></i>Fett <b>'+gmEsc(fmtDe(t.fat))+' g</b></span></div>'+
    (wk?'<div class="nu-foot"><span>Protein-Ziel diese Woche</span><b>'+wk.proteinDays+'/7 Tage</b></div>':'')+
    '</div>';
}
/* Detail-Sheet: gemessene Protein-Historie (echte Abend-Eintraege, KEINE erfundene
   Kalorienaufnahme — die wird in ORVIA nirgends erfasst) + heutige Zielwerte. */
function gmOpenNutritionSheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var t=null,wk=null;try{t=nutToday();}catch(_){ }try{wk=nutWeekly();}catch(_){ }
  /* 14 Tage Protein-Ist aus dem kanonischen Tagesspeicher — nur echte Eintraege. */
  var days=[],maxP=0;
  try{for(var i=13;i>=0;i--){var k=dkey(-i);var e=DB[k];
    var v=(e&&e.eve&&e.eve.prot!=null&&isFinite(e.eve.prot))?+e.eve.prot:null;
    if(v!=null&&v>maxP)maxP=v;days.push({k:k,v:v});}}catch(_){ }
  var pT=(t&&t.protein)||null;if(pT&&pT>maxP)maxP=pT;
  var bars=days.map(function(x){
    var h=(x.v!=null&&maxP>0)?Math.max(4,Math.round(x.v/maxP*100)):0;
    var hit=(x.v!=null&&pT)?(x.v>=pT*0.9):false;
    var lb='';try{var dd=new Date(x.k+'T12:00');lb=DAYNAMES[(dd.getDay()+6)%7];}catch(_){ }
    return '<div class="nb-col"><div class="nb-track"><i class="'+(hit?'hit':'')+'" style="height:'+h+'%"></i></div><small>'+gmEsc(lb)+'</small></div>';
  }).join('');
  var got=days.filter(function(x){return x.v!=null;}).length;
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--activity-t);color:var(--activity)">'+icon('battery')+'</div><div><h3>Energie &amp; Ernährung</h3><div class="sh-sub" style="margin:2px 0 0">'+(t?fmtDe(t.kcal)+' kcal Tagesziel':GM_NA)+'</div></div></div>'+
    (t?('<div class="sh-block"><div class="nu-legend nu-legend-lg">'+
      '<span><i class="nu-p"></i>Protein <b>'+gmEsc(fmtDe(t.protein))+' g</b></span>'+
      '<span><i class="nu-c"></i>Carbs <b>'+gmEsc(fmtDe(t.carbs))+' g</b></span>'+
      '<span><i class="nu-f"></i>Fett <b>'+gmEsc(fmtDe(t.fat))+' g</b></span></div></div>'):'')+
    '<div class="sh-block"><h4 style="margin:0 0 8px;font-size:13px">Protein · letzte 14 Tage</h4>'+
      (got?('<div class="nu-bars">'+bars+'</div><p class="note" style="text-align:left;margin-top:8px">'+got+' von 14 Tagen erfasst'+(pT?' · Ziel '+fmtDe(pT)+' g (grün = mindestens 90 % erreicht)':'')+'. Nur eingetragene Abendwerte — nichts hochgerechnet.</p>')
        :'<p class="note" style="text-align:left">Noch keine Protein-Einträge. Der Wert kommt aus dem Abend-Check-in.</p>')+'</div>'+
    (wk&&wk.weightTrend?'<div class="sh-block"><div class="nu-foot"><span>Gewicht · 7 Tage</span><b>'+gmEsc(wk.weightTrend)+'</b></div></div>':'')+
    '<div class="sheet-cta"><button class="sec" onclick="gmCloseSheets()">Schließen</button><button class="prim" onclick="gmCloseSheets();openNutritionEditor()">Ernährung anpassen</button></div>';
  gmOpenSheet('detailSheet');
}
/* Abend-Check-in: Statuskarte auf das VORHANDENE Formular (#eveCard). */
function gmModEvening(d){
  var e=null;try{e=entry(cur);}catch(_){ }
  var ev=(e&&e.eve)||null;
  var filled=ev?Object.keys(ev).filter(function(k){return ev[k]!=null&&ev[k]!=='';}).length:0;
  var done=filled>0;
  var bits=[];
  try{if(ev){if(ev.prot!=null)bits.push(fmtDe(ev.prot)+' g Protein');if(ev.knee!=null)bits.push('Knie '+ev.knee);if(ev.note)bits.push('Notiz');}}catch(_){ }
  return '<div class="card tap gm-ext" role="button" tabindex="0" onclick="gmGotoEveningCheckin()" onkeydown="if(event.key===\'Enter\')gmGotoEveningCheckin()"><span class="taphint">'+icon('chev','xs')+'</span>'+
    '<div class="simplecard"><div class="sc-ic" style="background:'+(done?'var(--ready-t);color:var(--ready)':'var(--sleep-t);color:var(--sleep)')+'">'+icon(done?'check':'moon')+'</div>'+
    '<div style="flex:1"><div class="sc-t">Abend-Check-in</div><div class="sc-v">'+(done?gmEsc(bits.length?bits.join(' · '):'erfasst'):'Noch offen — Protein, Beschwerden, Tagesnotiz')+'</div></div></div></div>';
}
function gmGotoEveningCheckin(){
  var c=document.getElementById('eveCard');if(!c)return;
  /* .gm-co-open ueberlebt ein erneutes gmApplyPhase3Visibility — sonst wuerde das
     Formular direkt nach dem Aufklappen wieder verschwinden. */
  try{c.classList.remove('gm-hidden-host');c.classList.add('gm-co-open','p3-live');}catch(_){ }
  try{c.scrollIntoView({behavior:'smooth',block:'center'});}catch(_){ }
  try{var f=c.querySelector('input,select,textarea,button');if(f)setTimeout(function(){try{f.focus({preventScroll:true});}catch(_){ }},420);}catch(_){ }
}
/* Routinen & Supplements: Statuskarte auf die VORHANDENE <details>-Karte. */
function gmModSupplements(d){
  var open=0,act=0,subs=0;
  try{open=(typeof openRoutineTasks==='function')?(openRoutineTasks()||0):0;}catch(_){ }
  try{act=(typeof activeRoutines==='function')?(activeRoutines()||[]).length:0;}catch(_){ }
  try{var e=entry(cur);subs=((e&&e.subs)||[]).length;}catch(_){ }
  var doneN=Math.max(0,act-open);
  var sub;
  if(!act&&!subs)sub='Noch nichts eingerichtet — Routinen und Supplements festlegen';
  else if(open>0)sub=doneN+' von '+act+' Routinen erledigt'+(subs?' · '+subs+' Supplements':'');
  else sub=(act?'Alle '+act+' Routinen erledigt':'Keine Routinen')+(subs?' · '+subs+' Supplements':'');
  var allDone=act>0&&open===0;
  return '<div class="card tap gm-ext" role="button" tabindex="0" onclick="gmGotoRoutines()" onkeydown="if(event.key===\'Enter\')gmGotoRoutines()"><span class="taphint">'+icon('chev','xs')+'</span>'+
    '<div class="simplecard"><div class="sc-ic" style="background:'+(allDone?'var(--ready-t);color:var(--ready)':'rgba(201,174,124,.14);color:var(--gold-soft)')+'">'+icon(allDone?'check':'calendar')+'</div>'+
    '<div style="flex:1"><div class="sc-t">Routinen &amp; Supplements</div><div class="sc-v">'+gmEsc(sub)+'</div>'+
    (act>0?'<div class="bar-mini" style="margin-top:8px"><i style="width:'+Math.round(doneN/act*100)+'%;background:var(--ready)"></i></div>':'')+
    '</div></div></div>';
}
function gmGotoRoutines(){
  var c=document.getElementById('routinesCard');if(!c)return;
  try{c.style.display='';c.classList.add('gm-co-open');c.open=true;}catch(_){ }
  try{c.scrollIntoView({behavior:'smooth',block:'center'});}catch(_){ }
}
function gmModContrib(d){
  var list=(d.contrib&&d.contrib.length)?d.contrib:[null,null,null];
  var rows=list.map(function(c){
    var col=c?SC[c[3]]:'var(--muted)';var bg=c?TINT[c[3]]:'var(--surface-2)';
    return '<div style="display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--hair)"><div style="width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:'+bg+';color:'+col+'">'+icon('run','sm')+'</div><div><div style="font-size:12.5px;font-weight:700">'+(c?gmEsc(c[0]):'—')+'</div><div style="font-size:10.5px;color:var(--muted);font-weight:600">'+(c?gmEsc(c[1]):GM_NA)+'</div></div><div style="margin-left:auto;font-size:13px;font-weight:800;color:'+col+'">'+(c?gmEsc(c[2])+' <small style="font-weight:600;color:var(--muted)">sRPE</small>':'—')+'</div></div>';}).join('');
  return '<div class="card"><div class="ctitle"><div class="l">'+icon('gauge')+' Belastungs-Beitrag <span style="color:var(--muted);font-weight:600;font-size:11px">· letzte Trainingstage · Tageslast (sRPE)</span></div></div>'+rows+'</div>';}
function gmModWarnings(d){
  if(!d.warnings.length)return '';
  return '<div class="card warn"><div class="ctitle"><div class="l" style="color:var(--crit)">'+icon('alert')+' Braucht Aufmerksamkeit</div></div>'+d.warnings.map(function(w){return '<div class="wrow"><span class="w-ic">'+icon(w[0],'sm')+'</span><div><div class="wt">'+gmEsc(w[1])+'</div><div class="wd">'+gmEsc(w[2])+'</div></div></div>';}).join('')+'</div>';}
/* --- Zustände (Struktur 1:1 GM) --- */
function gmLoadingHero(){return '<div class="hero"><div class="hero-top"><div class="sk" style="width:150px;height:150px;border-radius:50%"></div><div style="flex:1"><div class="sk" style="height:15px;width:80%;margin-bottom:9px"></div><div class="sk" style="height:11px;width:95%;margin-bottom:6px"></div><div class="sk" style="height:11px;width:70%"></div></div></div><div class="sk" style="height:52px;margin-top:15px"></div><div class="sk" style="height:52px;margin-top:11px;border-radius:15px"></div></div>';}
function gmLoadingMods(){var k='<div class="kcard"><div class="sk" style="height:12px;width:60%;margin-bottom:12px"></div><div class="sk" style="height:26px;width:50%;margin-bottom:9px"></div><div class="sk" style="height:30px"></div></div>';
  /* GM6: der Golden Master erzeugt repeat(level==='a'?2:4) Kacheln — Stufe a zeigt
     14, Stufe f/p 20 Skeletons. Vorher war die Zahl fest auf 4 verdrahtet. */
  var g='',n=(gmLevel()==='a')?2:4;for(var i=0;i<n;i++)g+=k;
  return '<div class="card"><div class="sk" style="height:14px;width:45%;margin-bottom:14px"></div><div class="sk" style="height:44px"></div></div><div class="kgrid">'+g+'</div>';}
function gmErrorBar(){return '<div class="errbar">'+icon('wifi','sm')+'<div><b>Offline — zwischengespeicherter Stand.</b> Werte werden aktualisiert, sobald die Verbindung zurück ist.</div></div>';}
function gmEmptyHero(){return '<div class="hero gap"><div class="empty" style="padding:24px 14px"><div class="e-ic" style="width:64px;height:64px;border-radius:20px">'+icon('db')+'</div><div class="et" style="font-size:15px">Noch keine Bereitschaft berechnet</div><div class="ed"><b style="color:var(--activity)">Das ist kein schlechter Wert</b> — es fehlen nur Daten. ORVIA braucht Check-in, Schlaf und Belastung, um deinen Score zu berechnen.</div><div class="eb" style="margin-top:16px" onclick="gotoCheckinForm()">'+icon('bolt','sm')+' Check-in starten</div></div></div>'+
  '<div class="gapnote">'+icon('info','sm')+'<div><b>Datenlücke ≠ schlechter Score.</b> Ein niedriger Score heißt „schlecht erholt". Fehlende Daten heißt „unbekannt" — beides wird bewusst unterschiedlich dargestellt.</div></div>';}
function gmEmptyMods(){return '<div class="card"><div class="empty"><div class="e-ic">'+icon('moon')+'</div><div class="et">Schlaf &amp; Erholung</div><div class="ed">Verbinde ein Gerät oder erfasse manuell.</div><div class="eb" onclick="expandCheckinCard()">'+icon('activity','sm')+' Manuell erfassen</div></div></div>';}
/* --- GM6: systemweite Zustandskomponenten --------------------------------
   Ein Satz Bausteine fuer ALLE Hosts ausserhalb des Dashboards (Analyse,
   Plan, Profil, Aktivitaet). Sie erzeugen exakt die Golden-Master-Komponenten
   .sk, .card > .empty und .errbar — nie wieder Legacy-Absaetze (.muted /
   .note / .mv-note) oder den Legacy-Button .btn.sec.
   Keine Fachlogik, keine Datenbewertung, keine neue Persistenz.
   o.retry darf ausschliesslich eine bereits vorhandene, sichere Re-Render-
   Funktion enthalten; ohne echte Aktion entsteht KEIN Button (§4). */
/* GM6 · Skelettgeometrie: der Golden Master kennt GENAU ZWEI Skelettbausteine
   (orvia_dashboard_5.html:632, loadingView) — den Karten- und den Kachelblock.
   Eine frei parametrierte Zeilenhoehe waere eine Erfindung und wuerde die
   Pixelparitaet gegen die Referenz zwangslaeufig brechen. Deshalb werden hier
   ausschliesslich die beiden echten Bausteine ausgegeben, woertlich identisch
   zu gmLoadingMods() (Dashboard) und damit zum Golden Master. */
function gmStateLoading(o){
  o=o||{};
  var kc=(o.kind==='kcard');
  var body=kc
    ? '<div class="sk" style="height:12px;width:60%;margin-bottom:12px"></div><div class="sk" style="height:26px;width:50%;margin-bottom:9px"></div><div class="sk" style="height:30px"></div>'
    : '<div class="sk" style="height:14px;width:45%;margin-bottom:14px"></div><div class="sk" style="height:44px"></div>';
  var n=(o.blocks>0)?o.blocks:1,h='';
  for(var i=0;i<n;i++)h+=o.bare?body:'<div class="'+(kc?'kcard':'card')+'">'+body+'</div>';
  return h;
}
function gmStateEmpty(o){
  o=o||{};
  return '<div class="card"><div class="empty"><div class="e-ic">'+icon(o.icon||'db')+'</div><div class="et">'+gmEsc(o.title||'Noch keine Daten')+'</div><div class="ed">'+gmEsc(o.desc||'')+'</div>'+
    (o.action?'<div class="eb" onclick="'+o.action+'">'+icon(o.actionIcon||'bolt','sm')+' '+gmEsc(o.label||'')+'</div>':'')+'</div></div>';
}
function gmStateError(o){
  o=o||{};
  return '<div class="errbar">'+icon(o.icon||'wifi','sm')+'<div><b>'+gmEsc(o.title||'Momentan nicht verfügbar.')+'</b>'+(o.desc?' '+gmEsc(o.desc):'')+'</div></div>'+
    /* margin-top:14px = Golden Master errorView (orvia_dashboard_5.html:636).
       .cta setzt display:flex ⇒ der Button ist bereits blocklevel und fuellt die
       Kartenbreite; ein zusaetzliches width:100% waere redundant. */
    (o.retry?'<button class="cta wide-ghost" style="margin-top:14px" onclick="'+o.retry+'">'+icon('wifi','sm')+' '+gmEsc(o.label||'Erneut versuchen')+'</button>':'');
}
/* --- GM6-ENDE Zustandskomponenten ---------------------------------------
   Endmarke analog zu GM1-ENDE / D2-ENDE. Sie erlaubt Slice-basierten Tests,
   exakt diese drei Komponenten deterministisch und unveraendert zu uebernehmen,
   statt in der Sandbox Ersatzmarkup zu definieren. */
/* --- Orchestrierung: Hero-Host (#command) + Modul-Host (#modules) --- */
function gmDashState(){
  var d=gmDashVM();
  var sync=null;try{sync=(typeof window!=='undefined'&&typeof window.orviaSyncState==='function')?window.orviaSyncState():null;}catch(_){ }
  /* GM6: Offline/Fehler wird VOR der Datenpruefung entschieden. Die GM-errorView
     IST die Darstellung „offline mit zwischengespeichertem Stand" — sie darf also
     nicht mehr an noData gekoppelt sein. Zweites produktives Offline-Signal:
     navigator.onLine (js/orvia-pro.js initOffline). 'local'/'pending' sind KEINE
     Fehler (lokal gespeichert bzw. Push ausstehend). */
  var off=false;try{off=(typeof navigator!=='undefined'&&navigator.onLine===false);}catch(_){ }
  var degraded=(sync==='error'||sync==='offline'||off);
  var noData=!d.hasScore&&!d.ciDone&&d.metrics.hrv==null&&d.metrics.sleepMin==null&&d.battery==null;
  /* GM6.1 §2: Hard-Error und „offline mit verwendbarem Cache" sind ZWEI
     verschiedene Zustaende, kein Zielkonflikt.
       'offline' = Degradationssignal UND verwendbare Daten vorhanden.
                   Module, Werte und Check-in bleiben vollstaendig sichtbar;
                   zusaetzlich der GM-konforme Offline-/Sync-Hinweis (.errbar)
                   und die ehrliche Veraltet-Markierung im Hero (gedimmter Ring,
                   „ZULETZT"). Es wird NICHTS neu berechnet.
       'error'   = Degradationssignal OHNE verwendbare Daten. Nur dann gilt die
                   reduzierte Golden-Master-errorView (Hero endet die Seite).
     Das Degradationssignal wird weiterhin VOR den Datenzweigen 'empty'/'normal'
     ausgewertet; lediglich die Aufteilung in 'offline'/'error' haengt an noData. */
  if(degraded&&!noData)return 'offline';
  if(degraded)return 'error';
  if(noData)return 'empty';
  return 'normal';
}
function gmErrorHero(){var d=gmDashVM();var sc=d.hasScore?d.score:null;
  return '<div class="hero"><div class="hero-top"><div class="ring-wrap" style="width:150px;height:150px;opacity:.55">'+ring(sc!=null?sc:0,'var(--neutral)',150,12)+'<div class="ring-c"><div class="big" style="color:var(--muted)">'+(sc!=null?sc:'—')+'</div><div class="u">ZULETZT</div></div></div><div class="hero-right"><div class="lead" style="color:var(--muted)">Zwischengespeicherter Stand</div><div class="why">Werte könnten veraltet sein. Prüfe die Verbindung und versuche es erneut.</div></div></div>'+
  '<button id="gmRetryBtn" class="cta wide-ghost" style="margin-top:14px;width:100%" onclick="renderDay&&renderDay()">'+icon('wifi','sm')+' Erneut versuchen</button></div>';}
function gmSetCheckinVisible(v){try{var a=document.getElementById('checkinCompact'),b=document.getElementById('checkinCard');
  if(a)a.style.display=v?'':'none';if(b)b.style.display=v?'':'none';}catch(_){ }}
/* GM6-Fokusvertrag: ersetzt ein Zustandswechsel den fokussierten Knoten (z. B. den
   Retry-Button nach erfolgreichem Neuladen), darf der Fokus nicht auf <body>
   fallen. Er kehrt dann in den Host-Container zurueck — bevorzugt auf ein gleich
   benanntes Element, sonst auf den Host selbst. Keine Datenwirkung. */
function gmSetHTML(el,html){
  var had=false,id=null;
  try{var a=document.activeElement;if(a&&a!==document.body&&el.contains(a)){had=true;id=a.id||null;}}catch(_){ }
  el.innerHTML=html;
  if(!had)return;
  try{
    var t=id?el.querySelector('#'+id):null;
    if(t&&typeof t.focus==='function'){t.focus({preventScroll:true});return;}
    el.setAttribute('tabindex','-1');el.focus({preventScroll:true});
  }catch(_){ }
}
function renderCommand(){
  var el=document.getElementById('command');if(!el)return;
  if(typeof applyLevelClass==='function')applyLevelClass();
  if(typeof orviaApplyTheme==='function')orviaApplyTheme();
  try{var mb=document.getElementById('modeBadge');if(mb){var l=gmLevel();mb.innerHTML=l==='p'?icon('bolt','xs')+' Profi-Ansicht':l==='a'?'Einfache Ansicht':'';}}catch(_){ }
  if(typeof cur!=='undefined'&&cur!==todayStr()){gmSetHTML(el,'');return;}
  var state=(typeof window!=='undefined'&&window._gmStateOverride)||gmDashState();
  /* GM6.1 §2: im Zustand 'offline' (Cache vorhanden) bleibt der Check-in sichtbar. */
  gmSetCheckinVisible(state==='normal'||state==='empty'||state==='offline');
  if(state==='loading'){gmSetHTML(el,gmLoadingHero());return;}
  /* GM6.1 §2 — Hard-Error: reduzierte Golden-Master-errorView. Kein verwendbarer
     Cache vorhanden, deshalb der ehrliche Ersatz-Hero (gedimmter Ring, „ZULETZT",
     „—" statt einer erfundenen 0) plus die vorhandene, echte Retry-Aktion. */
  if(state==='error'){gmSetHTML(el,gmErrorBar()+gmErrorHero());return;}
  /* GM6.1 §2 — Offline MIT verwendbarem Cache: ausdruecklich ein ANDERER Zustand.
     Der Auftrag lautet „behaelt die vorhandenen Module und Werte sichtbar, zeigt
     ZUSAETZLICH den Golden-Master-konformen Offline-/Sync-Hinweis". Deshalb:
     unveraenderter Normal-Hero (alle Werte byte-identisch, kein Wert ersetzt,
     nichts neu berechnet) und davor der GM-.errbar als ehrliche Veraltet-
     Markierung. Der frueher hier verwendete gmErrorHero() ist der Hard-Error-
     Renderer — genau der Fallback, den §2 fuer diesen Zustand verbietet: er
     haette Deltas, Batterie und Empfehlung verworfen und die Score-Einheit
     ueberschrieben. Bewusst KEIN zusaetzlicher Retry-Button: die Rueckkehr
     erfolgt automatisch (Hinweistext), und jedes weitere Element haette im
     Golden Master keine Entsprechung. */
  if(state==='offline'){gmSetHTML(el,gmErrorBar()+gmHero(gmDashVM()));try{if(typeof gmLoadHeroBattBalance==='function')gmLoadHeroBattBalance();}catch(_){ }return;}
  if(state==='empty'){gmSetHTML(el,gmEmptyHero());return;}
  gmSetHTML(el,gmHero(gmDashVM()));
  /* GM7.6: echte Lade-/Verbrauchsbilanz asynchron in die batt-sub-Slots (nur Text). */
  try{if(typeof gmLoadHeroBattBalance==='function')gmLoadHeroBattBalance();}catch(_){ }
  /* GM7.8: neue, abgeschlossene Einheit als Story zeigen — genau ein Versuch je Sitzung
     (Guard in gmMaybeAutoStory), nur mit echten Daten, danach dauerhaft als gesehen. */
  try{if(typeof gmMaybeAutoStory==='function')setTimeout(gmMaybeAutoStory,600);}catch(_){ }
}
function renderModules(){
  var host=document.getElementById('modules');if(!host)return;
  if(typeof cur!=='undefined'&&cur!==todayStr()){host.innerHTML='';return;}
  try{if(typeof gmPrimeWideResolve==='function')gmPrimeWideResolve();}catch(_){ }
  var lvl=gmLevel();
  var state=(typeof window!=='undefined'&&window._gmStateOverride)||gmDashState();
  /* GM6: eduhint erscheint im Golden Master ausschliesslich im Normalzweig.
     Der Empty-Zweig verwendet nur das sectlabel — deshalb sind beide getrennt. */
  var edu=(lvl==='a'?'<div class="eduhint">'+icon('info','sm')+'<div><b>Neu bei ORVIA?</b> Dein Score fasst Schlaf, Erholung und Belastung zu einer Zahl zusammen. Tippe den Score oder eine Karte für Details.</div></div>':'');
  var sect='<div class="sectlabel" data-gm-slot="dashboard-modules">'+(lvl==='a'?'Das Wichtigste':'Deine Module')+' <span class="edit" onclick="gmOpenMM()">'+icon('gear','xs')+' Anpassen</span></div>';
  if(state==='loading'){host.innerHTML=gmLoadingMods();return;}
  /* GM6.1 §2: NUR der Hard-Error (kein verwendbarer Cache) uebernimmt die
     reduzierte GM-errorView, in der nach dem Hero nichts mehr folgt. Der Zustand
     'offline' faellt bewusst NICHT hierher, sondern durchlaeuft unveraendert den
     Normalzweig — dieselben Module, dieselben Werte, byte-identisches Markup,
     ohne jede Neuberechnung. */
  if(state==='error'){host.innerHTML='';return;}
  if(state==='empty'){host.innerHTML=sect+gmEmptyMods()+'<div class="addmod" onclick="gmOpenMM()">'+icon('bolt','sm')+' Modul hinzufügen</div>';return;}
  var d=gmDashVM();
  var html=edu+sect+(lvl==='p'?gmModWarnings(d):'');
  var buf=[];var flush=function(){if(buf.length){html+='<div class="kgrid">'+buf.join('')+'</div>';buf=[];}};
  gmModules().forEach(function(id){if(!GM_REND[id])return;if(GM_KGRID[id])buf.push(GM_REND[id](d));else{flush();html+=GM_REND[id](d);}});
  flush();
  html+='<div class="addmod" onclick="gmOpenMM()">'+icon('bolt','sm')+' '+(lvl==='a'?'Mehr anzeigen':'Modul hinzufügen oder anordnen')+'</div>';
  host.innerHTML=html;
}
/* --- GM-Sheet-System (EIN System: scrim + sheets, zentrale Escape-/Fokus-Logik) --- */
function gmOpenSheet(id){try{_gmLastFocus=document.activeElement;}catch(_){ }
  var sh=document.getElementById(id);var sc=document.getElementById('scrim');
  if(!sh)return;sh.classList.add('on');if(sc)sc.classList.add('on');
  try{sh.setAttribute('tabindex','-1');sh.focus();}catch(_){ }
  try{if(typeof window!=='undefined'&&!window._gmEscBound){window._gmEscBound=1;
    document.addEventListener('keydown',function(ev){
      if(ev.key!=='Escape')return;
      var any=false;document.querySelectorAll('.sheet.on').forEach(function(s){s.classList.remove('on');any=true;});
      var scr=document.getElementById('scrim');if(scr)scr.classList.remove('on');
      var sm=document.getElementById('suppModal');
      if(sm&&sm.classList&&sm.classList.contains('show')){if(typeof closeSupp==='function')closeSupp();any=true;}
      if(any){try{if(_gmLastFocus&&_gmLastFocus.focus)_gmLastFocus.focus();}catch(_){ }}
    });
    var scr0=document.getElementById('scrim');if(scr0&&!scr0._gmBound){scr0._gmBound=1;scr0.addEventListener('click',gmCloseSheets);}
  }}catch(_){ }}
function gmCloseSheets(){document.querySelectorAll('.sheet.on').forEach(function(s){s.classList.remove('on');});
  var sc=document.getElementById('scrim');if(sc)sc.classList.remove('on');
  try{if(_gmLastFocus&&_gmLastFocus.focus)_gmLastFocus.focus();}catch(_){ }}
/* Modal-Cleanup: oModal (Legacy) läuft ab jetzt zentral über das GM-Sheet-System. */
function oModal(title,body,footer){
  var sh=document.getElementById('detailSheet');
  if(!sh){var lm=document.getElementById('suppSheet');if(lm){lm.innerHTML='<div class="sheethead"><h2>'+gmEsc(title)+'</h2><button class="xbtn" onclick="closeSupp()">✕</button></div>'+body+(footer||'');var mm=document.getElementById('suppModal');if(mm)mm.classList.add('show');}return;}
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div><h3>'+gmEsc(title)+'</h3></div></div><div class="sh-block" style="margin-top:8px">'+body+'</div>'+(footer?'<div class="sheet-cta">'+footer+'</div>':'');
  gmOpenSheet('detailSheet');
}
function gmOpenDaySheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var isToday=(typeof cur==='undefined')||cur===todayStr();
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('calendar')+'</div><div><h3>Tag wählen</h3><div class="sh-sub" style="margin:2px 0 0">'+gmEsc((typeof fmtDate==='function'&&typeof cur!=='undefined')?fmtDate(cur):'')+'</div></div></div>'+
    '<div class="sheet-cta"><button class="sec" onclick="shiftDay(-1);gmOpenDaySheet()">‹ Vortag</button>'+(isToday?'':'<button class="sec" onclick="shiftDay(1);gmOpenDaySheet()">Nächster ›</button>')+(isToday?'':'<button class="prim" onclick="goToday();gmCloseSheets()">Heute</button>')+'</div>';
  gmOpenSheet('detailSheet');
}
function gmShowCarryover(id){try{var el=document.getElementById(id);if(el){el.classList.add('gm-co-open');el.scrollIntoView({behavior:'smooth',block:'start'});}}catch(_){ }}
/* Carry-over-Zugänge über die ECHTEN Quick-Actions (Wrap, quick-actions.js unberührt) */
(function(){function wrap(){try{var qa=window.ORVIA&&window.ORVIA.quickActions;if(!qa||qa._gmCoWrapped)return;qa._gmCoWrapped=1;
  if(typeof qa.gotoEveningCheckin==='function'){var oe=qa.gotoEveningCheckin;qa.gotoEveningCheckin=function(){gmShowCarryover('eveCard');return oe.apply(this,arguments);};}
  if(typeof qa.gotoRoutines==='function'){var orr=qa.gotoRoutines;qa.gotoRoutines=function(){gmShowCarryover('routinesCard');return orr.apply(this,arguments);};}
}catch(_){ }}wrap();if(typeof window!=='undefined'){window.addEventListener('load',function(){wrap();setTimeout(wrap,600);});}})();
/* gmOpenBell() entfernt (Phase 1b): der Header-Knopf hatte keinen Endzustand. */
/* GM7: Segment-Ring aus den kanonischen Score-Komponenten (buildComponents) —
   Winkel proportional zum Beitrag, Farben aus dem Komponenten-Mapping. */
function gmSegRing(brk,score,size){
  size=size||96;var r=(size/2)-7,cx=size/2,cy=size/2,C=2*Math.PI*r;
  var parts=(brk||[]).filter(function(b){return b[1]!=null&&b[1]>0;});
  if(!parts.length)return ring(score||0,'var(--neutral)',size,9);
  var total=parts.reduce(function(a,b){return a+b[1];},0)||1;
  var frac=Math.max(0,Math.min(1,(score!=null?score:total)/100));
  var off=0,segs='';
  parts.forEach(function(b){
    var share=b[1]/total*frac*C;var gap=Math.min(3,share*0.15);
    segs+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+(SC[b[2]]||'var(--neutral)')+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+Math.max(0.1,share-gap)+' '+(C-share+gap)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
    off+=share;});
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--surface-2)" stroke-width="9"/>'+segs+'</svg>';
}
function gmToggleFactor(i){try{var el=document.getElementById('gmFc'+i);if(el)el.classList.toggle('open');}catch(_){ }}
function openScore(){
  var os=null;try{os=(typeof orviaScore==='function')?orviaScore():null;}catch(_){ }
  var d=gmDashVM();var sh=document.getElementById('detailSheet');if(!sh)return;
  var brk=(d.breakdown||[]).filter(function(b){return b[1]!=null;});
  var chips=brk.map(function(b){return '<span class="ci-val" style="border-color:'+(TINT[b[2]]||'var(--hair)')+'"><span class="fdot" style="background:'+(SC[b[2]]||'var(--neutral)')+';display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px"></span>'+gmEsc(b[0])+' <b>+'+gmEsc(String(b[1]))+'</b></span>';}).join(' ');
  /* v9: Gewicht sichtbar machen. Vorher standen hier drei Zahlen (85 / 74 / 80)
     unter der Ueberschrift „So entsteht dein Score" — und die Headline war eine
     vierte, die sich aus keiner von ihnen ergab. Jetzt steht an jeder Zeile,
     mit welchem Anteil sie in die Zahl oben eingeht. */
  var rows=(os&&os.subs?os.subs:[]).filter(function(x){return x[1]!=null;}).map(function(x){var v=Math.round(x[1]);
    var wp=(x.length>2&&x[2]!=null)?x[2]:null;
    return '<div class="brow"><div class="bl"><span class="fdot" style="background:'+(v>=70?'var(--ready)':v>=50?'var(--attention)':'var(--crit)')+'"></span>'+gmEsc(x[0])+(wp!=null?' <span style="color:var(--muted);font-weight:650">· '+wp+' %</span>':'')+'</div><div class="bbar"><i style="left:50%;width:'+(v/2)+'%;background:'+(v>=70?'var(--ready)':v>=50?'var(--attention)':'var(--crit)')+'"></i></div><div class="bv">'+v+'</div></div>';}).join('');
  /* v9: Rechenweg als Klartextzeile — und der Sicherheitsdeckel wird sichtbar,
     wenn er gegriffen hat. Vorher war eine gedeckelte Zahl von einer
     gerechneten nicht zu unterscheiden. */
  var _dec=(os&&os.decision)||null;
  var _calcLine='';
  if(_dec&&_dec.scoreParts&&_dec.scoreParts.length){
    _calcLine='<p style="margin:10px 0 0;color:var(--muted);font-size:11.5px">'+
      gmEsc(_dec.scoreParts.map(function(p){return p.name+' '+p.value+' × '+p.weight+' %';}).join('  +  '))+
      '  =  <b style="color:var(--text)">'+_dec.scoreRaw+'</b></p>';
    if(_dec.scoreCapped)_calcLine+='<p style="margin:6px 0 0;color:var(--attention);font-size:11.5px">'+
      gmEsc('Sicherheitsgrenze aktiv: auf '+_dec.score+' begrenzt — '+((_dec.readinessReasons||[])[0]||'Zustand des Tages'))+'</p>';
  }
  /* GM7.6 (Teilbereich 2): Aufschluesselung als GM-Faktorkarten (Prototyp factorRows:
     fcard mit Kopf, seg10-Fuellstand, Wert/Beitrag-Chips, Begruendung, Deeplink). Alle
     Werte stammen unveraendert aus buildComponents (norm 0-100, contribution, reason) —
     keine Neuberechnung, kein erfundener Faktor. Deeplink nur, wenn das Ziel-Sheet
     eine kanonische Metrik ist. */
  var GM_FACTOR_ICON={'Schlafdauer':'moon','Schlafqualität':'moon','Schlaf-Score (Gerät)':'moon','Schlafgefühl':'moon','Schlafphasen':'moon','Schlaf-Konto':'moon','HRV':'pulse','Ruhepuls':'heart','Stress':'wind','Body Battery':'battery','Befinden':'heart','Knie':'knee','Schmerz':'knee','Muskelkater':'bolt','DOMS':'bolt','Ausgangswert':'db'};
  var GM_FACTOR_LINK={'HRV':'hrv_ms','Ruhepuls':'resting_hr','Schlafdauer':'sleep_duration_min','Schlafqualität':'sleep_duration_min','Schlaf-Score (Gerät)':'sleep_score','Schlafgefühl':'sleep_duration_min','Schlafphasen':'sleep_deep_min','Schlaf-Konto':'sleep_duration_min','Stress':'stress_avg','Body Battery':'body_battery'};
  var detail=brk.map(function(b,i){
    var col=SC[b[2]]||'var(--neutral)',tint=TINT[b[2]]||'var(--surface-2)';
    var norm=(b.length>4&&b[4]!=null)?Math.max(0,Math.min(100,b[4])):null;
    var fill=norm!=null?Math.round(norm/10):0;
    var link=GM_FACTOR_LINK[b[0]]||null;
    return '<div class="fcard" id="gmFc'+i+'"><div class="fhead" role="button" tabindex="0" onclick="gmToggleFactor('+i+')" onkeydown="if(event.key===\'Enter\')gmToggleFactor('+i+')">'+
      '<div class="fi" style="background:'+tint+';color:'+col+'">'+icon(GM_FACTOR_ICON[b[0]]||'heart','sm')+'</div>'+
      '<div><div class="ft">'+gmEsc(b[0])+'</div><div class="fp" style="color:'+col+'">+'+gmEsc(String(b[1]))+' Pkt</div></div>'+
      '<div class="fraw" style="color:'+col+'">'+(norm!=null?norm:'—')+'</div><span class="fchev">'+icon('chev','sm')+'</span></div>'+
      '<div class="fbody"><div class="fbody-in">'+
        '<div class="seg10">'+Array.from({length:10},function(_,k){return '<i style="background:'+(k<fill?col:'#0a1019')+'"></i>';}).join('')+'</div>'+
        /* v9: GEMESSENER Wert neben dem bewerteten. Gian, 16.08.: „Body Battery
           100 — meine Body Battery war eigentlich bei 95." Beide Zahlen sind
           richtig, aber nur eine stand da: 100 ist die BEWERTUNG (auf oder ueber
           dem eigenen Normalwert), 95 der Messwert. Ohne den Messwert daneben
           wirkt die Bewertung wie ein falscher Messwert. */
        '<div class="fchips">'+((b.length>5&&b[5]!=null)?'<span class="fchipv">Gemessen <b>'+gmEsc(String(b[5]))+'</b></span>':'')+'<span class="fchipv">Bewertet <b>'+(norm!=null?norm:'—')+'</b>/100</span><span class="fchipv">Beitrag <b>+'+gmEsc(String(b[1]))+' Pkt</b></span></div>'+
        (b[3]?'<div class="fex">'+gmEsc(b[3])+'</div>':'')+
        (link?'<div class="deeplink" role="button" tabindex="0" onclick="openMetric(\''+link+'\')" onkeydown="if(event.key===\'Enter\')openMetric(\''+link+'\')">'+gmEsc(b[0])+' öffnen '+icon('chev','xs')+'</div>':'')+
      '</div></div></div>';}).join('');
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="ring-wrap" style="width:96px;height:96px">'+
    (brk.length?gmSegRing(d.breakdown,os?os.score:null,96):ring(os?os.score:0,SC[d.statusColor]||'var(--neutral)',96,9))+
    '<div class="ring-c"><div style="font-size:26px;font-weight:800">'+(os?os.score:'—')+'</div></div></div>'+
    '<div><h3>ORVIA-Score</h3><div class="sh-sub" style="margin:3px 0 0"><span class="statuspill sp-'+d.statusColor+'" style="background:'+(TINT[d.statusColor]||'var(--surface)')+';color:'+(SC[d.statusColor]||'var(--muted)')+'">'+gmEsc(d.status)+'</span></div></div></div>'+
    (chips?'<div class="sh-block" style="padding-top:6px"><div class="ci-vals" style="flex-wrap:wrap;gap:6px">'+chips+'</div></div>':'')+
    (rows?'<div class="sh-block"><div class="bh">So entsteht dein Score</div><div class="breakdown">'+rows+'</div>'+_calcLine+'</div>':'<div class="sh-block"><div class="bh">So entsteht dein Score</div><p>'+GM_NA+' — sobald dein Check-in vorliegt, erscheinen hier die Teilwerte.</p></div>')+
    /* v9: praezise Ueberschrift. „Aufschlüsselung" allein liess offen, WOVON —
       es sind ausschliesslich die Bestandteile der Erholung, nicht des Scores. */
    (detail?'<div class="sh-block"><div class="bh">Aufschlüsselung der Erholung</div><p style="margin:0 0 10px;color:var(--muted);font-size:11.5px">Diese Faktoren ergeben den Erholungswert oben. Die Punkte sind Beiträge zum Erholungswert — nicht zum Gesamtscore.</p><div class="breakdown">'+detail+'</div></div>':'')+
    /* GM7.5h: Datenqualitaet (GM openScore, Prototyp Z.944) — bereits berechnetes conf-VM
       (gmConfVM: dataConfidence()+Baseline-Status), identisch zu gmModReadinessPro. */
    (d.conf&&d.conf.levelLabel?'<div class="sh-block"><div class="bh">Datenqualität</div><div class="confidence"><span class="confchip">'+icon('check','xs')+' Konfidenz <b style="color:'+(SC[d.conf.levelColor]||'var(--muted)')+'">'+gmEsc(d.conf.levelLabel)+'</b></span>'+(d.conf.complete?'<span class="confchip">'+icon('db','xs')+' Daten <b>'+gmEsc(d.conf.complete)+'</b></span>':'')+'<span class="confchip">'+icon('pulse','xs')+' HRV-Abw. <b>'+(d.conf.sd!=null?gmEsc(d.conf.sd):'—')+'</b></span></div>'+(d.conf.note?'<p style="margin-top:10px;color:var(--muted);font-size:11.5px">'+gmEsc(d.conf.note)+'</p>':'')+'</div>':'')+
    (gmLevel()==='p'?'<div class="sh-block"><div class="bh">Berechnung</div><p>Zentrale Entscheidung der ORVIA-Engine (eine Quelle für alle Modi). Safety-Gates können optimistische Werte überstimmen. Nur die Darstellungstiefe unterscheidet sich je Modus.</p></div>':'')+
    '<div class="source">'+icon('db','xs')+' ORVIA-Engine · Anzeige ohne Neuberechnung</div>';
  gmOpenSheet('detailSheet');
}
function openMetric(key){
  var def=GM_METRIC_DEFS[key]||{label:'Metrik',icon:'chart',color:'neutral',unit:''};
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var valTxt='—';var src=GM_NA;var meta='';var curVal=null;
  if(key==='load'){return openLoadSheet();}   /* GM7.2: dediziertes Last-Sheet (gleiche Serie wie Übersicht) */
  else{var r=gmMetric(key);
    if(r){curVal=(r.value!=null)?r.value:null;
      valTxt=(r.value!=null?fmtDe(r.value):String(r.valueText))+def.unit;
      /* GM7.6b: lesbares Quellen-Label statt Rohschluessel (device_measurement etc.). */
      src=({device_measurement:'Gerätemessung',provider_calculation:'Provider-Berechnung',manual_entry:'Manuell erfasst',manual_override:'Manuell korrigiert',lab_test:'Labormessung',orvia_estimate:'ORVIA-Schätzung',historical:'Historisch'})[r.sourceType]||r.sourceType||'Metrik-Speicher';
      /* GM7.2: Metrik-Datum sichtbar machen — so ist „64 Schritte / 0 kcal" als HEUTIGER
         Providerwert verifizierbar (nicht ein alter „latest value"). */
      var _md='';try{if(r.metricDate){var _d=new Date(r.metricDate+'T12:00');_md=' · Stand '+_d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});}}catch(_){ }
      meta=(r.stale?' · veraltet':'')+_md;}}
  /* GM7: echte Serie + Aggregation aus dem Resolver-Cache — kein unbedingter Leerzustand mehr. */
  var series=(key==='load')?null:gmMetricSeries(key,14);
  var stats=(key==='load')?null:gmMetricTrendStats(key,curVal);
  /* GM7.6c-Fix: Anzeige-Dezimalstellen aus der kanonischen metric-registry (SSOT) —
     vorher zeigten Zaehlmetriken „12947,4 Schritte". */
  var _dec=0;try{var _rm=window.ORVIA&&ORVIA.metricRegistry&&ORVIA.metricRegistry.byId(key);_dec=(_rm&&_rm.decimals)||0;}catch(_){ }
  var _p10=Math.pow(10,_dec);
  var _fmtStat=function(v){return fmtDe(Math.round(v*_p10)/_p10);};
  var chart;
  if(series&&series.values.length>=3){
    /* GM7.5h: id-Slot — nach dem Einhaengen ersetzt ORVIA.charts.richChart (GM-Chart mit
       Baseline-Ø + Scrubbing, wie openLoadSheet) den sparkline-Fallback; ohne Chart-Modul
       bleibt der sparkline stehen. */
    /* GM7.6c-Fix: oc2-Klasse — das gesamte Chart-CSS (fill:none der Linienpfade, Fokus-
       Outline-Unterdrueckung, Achsen-Label-Stile) ist .oc2-gescoped; ohne sie fuellten sich
       Linien-/Glow-Pfade schwarz und iOS zeichnete einen blauen Fokus-Rahmen. */
    chart='<div class="ochart oc2" id="gmMetricChartSlot" style="padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:12px">'+sparkline(series.values,SC[def.color]||'var(--ready)')+
      '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-weight:650;margin-top:4px"><span>'+gmEsc(series.dates[0].slice(5))+'</span><span>'+gmEsc(series.dates[series.dates.length-1].slice(5))+'</span></div></div>';
  }else{
    chart='<div class="ochart"><div class="spark" style="height:60px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--faint);background:var(--surface);border:1px solid var(--border);border-radius:12px;text-align:center;padding:0 12px">'+
      (series?'Verlauf '+GM_NA.toLowerCase()+' — erst '+series.values.length+' Messwert(e) gespeichert.':'Verlauf '+GM_NA.toLowerCase()+' — für diese Metrik ist keine Serie gespeichert.')+'</div></div>';
  }
  /* GM7.6: GM-Statzeile (Prototyp openMetric: Ø 14 T. / Baseline / vs. Ø, statgrid3).
     Baseline nur aus kanonischen Quellen: HRV = exp(recoveryCtx.hrvBase7) (identische
     Konversion wie readiness-store), Ruhepuls = recoveryCtx.rhrBase (28-T-Median).
     Andere Metriken haben keinen Baseline-Produzenten -> ehrlich „—". */
  var info=GM_METRIC_INFO[key]||null;
  var hb=(info&&info.hb!=null)?info.hb:null;
  var baseVal=null;
  try{
    if(key==='hrv_ms'||key==='resting_hr'){var _bcx=recoveryCtx(todayStr());
      if(key==='hrv_ms'&&_bcx&&_bcx.hrvBase7!=null)baseVal=Math.round(Math.exp(_bcx.hrvBase7));
      if(key==='resting_hr'&&_bcx&&_bcx.rhrBase!=null)baseVal=Math.round(_bcx.rhrBase);}
  }catch(_){ }
  var devCol=function(dv){if(dv==null||hb==null)return 'var(--text)';return (hb?dv>=0:dv<=0)?'var(--ready)':'var(--crit)';};
  var statsRow='<div class="statgrid3">'+
    '<div><div class="n">'+(stats?gmEsc(_fmtStat(stats.avg))+'<small>'+gmEsc(def.unit)+'</small>':'—')+'</div><div class="l">Ø '+(stats?stats.n:14)+' T.</div></div>'+
    '<div><div class="n">'+(baseVal!=null?gmEsc(_fmtStat(baseVal))+'<small>'+gmEsc(def.unit)+'</small>':'—')+'</div><div class="l">Baseline</div></div>'+
    '<div><div class="n" style="color:'+devCol(stats&&stats.vs!=null?stats.vs:null)+'">'+((stats&&stats.vs!=null)?((stats.vs>=0?'+':'')+gmEsc(_fmtStat(stats.vs))+'<small>'+gmEsc(def.unit)+'</small>'):'—')+'</div><div class="l">vs. Ø</div></div></div>';
  var extra='';
  if(key==='sleep_duration_min'){
    var ssc=gmMetric('sleep_score');
    /* GM7.4: Schlafphasen-DAUERN aus dem kanonischen Speicher (Worker liest
       jetzt deep/light/rem/awakeSleepSeconds → sleep_*_min). Nur echte Werte;
       fehlt eine Phase → „—". Der zeitaufgelöste Hypnogramm-Verlauf braucht
       einen separaten Serien-Speicher und wird NICHT synthetisiert. */
    /* Phase 4 (P2-3): Farben aus der EINEN Quelle (seriesReader.STAGE_COLOR) — vorher
       divergierten Phasenbalken und Hypnogramm (dieselbe Phase in zwei Farben). */
    var _phc=(window.ORVIA&&ORVIA.seriesReader&&ORVIA.seriesReader.STAGE_COLOR)||{deep:'var(--sleep)',light:'#9db4d8',rem:'#7c9cff',awake:'var(--gold-soft)'};
    var _ph=[['sleep_deep_min','Tief',_phc.deep],['sleep_light_min','Leicht',_phc.light],['sleep_rem_min','REM',_phc.rem],['sleep_awake_min','Wach',_phc.awake]];
    var _pv=_ph.map(function(p){var mm=gmMetric(p[0]);return {l:p[1],c:p[2],v:(mm&&mm.value!=null)?mm.value:null};});
    var _anyPh=_pv.some(function(x){return x.v!=null;});
    var _tot=_pv.reduce(function(s,x){return s+(x.v||0);},0);
    var _phaseHtml;
    var _fmtHm=function(m){var h=Math.floor(m/60),mm=Math.round(m-h*60);return (h?h+'h ':'')+mm+'min';};
    if(_anyPh&&_tot>0){
      /* GM7.6: GM-Phasenzeilen (Prototyp sleepSheet .phrow: Punkt, Name, Dauer, %-Pill)
         + Verteilungsbalken — Werte unveraendert aus dem kanonischen Speicher. */
      _phaseHtml='<div style="display:flex;height:10px;border-radius:6px;overflow:hidden;margin:8px 0 4px">'+_pv.map(function(x){var w=(x.v!=null)?(x.v/_tot*100):0;return x.v!=null?'<i style="width:'+w+'%;background:'+x.c+'"></i>':'';}).join('')+'</div>'+
        _pv.map(function(x){var _pct=(x.v!=null)?Math.round(x.v/_tot*100):null;
          return '<div class="phrow"><span class="pd" style="background:'+x.c+'"></span><span class="pn">'+x.l+'</span><span class="pv">'+(x.v!=null?gmEsc(_fmtHm(x.v)):'—')+'</span><span class="ppct" style="background:rgba(255,255,255,.06);color:var(--muted)">'+(_pct!=null?_pct+'%':'—')+'</span></div>';}).join('')+
        '<p style="margin-top:8px;color:var(--muted);font-size:11px">Phasen-Dauern aus dem kanonischen Speicher.</p>';
    }else{
      _phaseHtml='<p style="margin-top:6px;color:var(--muted);font-size:11.5px">Schlafphasen (Tief/Leicht/REM/Wach): '+GM_NA+' — für diesen Tag sind keine Phasen-Dauern gespeichert. Kein erfundenes Hypnogramm.</p>';
    }
    /* GM7.6: „Erholsamer Schlaf" (GM sleepSheet) — Anteil Tief+REM an der Schlafzeit
       (ohne Wachphasen), reine Aggregation der gespeicherten Phasen-Dauern. Idealband
       35-50 % ist eine statische schlafwissenschaftliche Referenz, kein Messwert.
       14-T-Vergleich nur aus echten gespeicherten Phasen-Serien. */
    var _restHtml='';
    try{
      var _deep=_pv[0].v,_light=_pv[1].v,_rem=_pv[2].v;
      if(_deep!=null&&_rem!=null&&(_deep+(_light||0)+_rem)>0){
        var _sleepTot=_deep+(_light||0)+_rem;
        var _restMin=_deep+_rem,_restPct=Math.round(_restMin/_sleepTot*100);
        var _vs14='';
        try{var _sd=gmMetricSeries('sleep_deep_min',14),_sr=gmMetricSeries('sleep_rem_min',14),_sl=gmMetricSeries('sleep_light_min',14);
          if(_sd&&_sr&&_sl&&_sd.values.length>=3){
            var _by={};_sd.dates.forEach(function(dt,ix){_by[dt]={d:_sd.values[ix]};});
            _sr.dates.forEach(function(dt,ix){if(_by[dt])_by[dt].r=_sr.values[ix];});
            _sl.dates.forEach(function(dt,ix){if(_by[dt])_by[dt].l=_sl.values[ix];});
            var _ps=[];Object.keys(_by).forEach(function(dt){var e2=_by[dt];if(e2.d!=null&&e2.r!=null&&(e2.d+(e2.l||0)+e2.r)>0)_ps.push((e2.d+e2.r)/(e2.d+(e2.l||0)+e2.r)*100);});
            if(_ps.length>=3){var _pavg=_ps.reduce(function(a,b){return a+b;},0)/_ps.length;var _pd2=Math.round(_restPct-_pavg);
              _vs14='<p style="font-size:12px;color:var(--muted);margin-top:9px;line-height:1.5">Tief- und REM-Schlaf sind die erholsamen Phasen. <b style="color:'+(_pd2>=0?'var(--ready)':'var(--attention)')+'">'+(_pd2>=0?'+':'')+_pd2+' %P</b> vs. deinem '+_ps.length+'-Nächte-Durchschnitt.</p>';}}
        }catch(_){ }
        _restHtml='<div class="sh-block"><div class="bh">Erholsamer Schlaf</div>'+
          '<div class="ih" style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:20px;font-weight:800">'+_restPct+'<small>%</small> · '+gmEsc(_fmtHm(_restMin))+'</div><span class="ppct" style="background:'+((_restPct>=35&&_restPct<=50)?'var(--ready-t)':'rgba(255,255,255,.06)')+';color:'+((_restPct>=35&&_restPct<=50)?'var(--ready)':'var(--muted)')+'">'+((_restPct>=35&&_restPct<=50)?'Im Idealband':'Referenz 35–50%')+'</span></div>'+
          '<div class="dbar" style="height:8px;border-radius:5px;background:#0a1019;overflow:hidden;margin-top:9px;position:relative"><i style="display:block;height:100%;width:'+Math.min(_restPct,100)+'%;background:linear-gradient(90deg,#2f9e6b,var(--ready))"></i></div>'+
          '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--faint);font-weight:650;margin-top:4px"><span>0%</span><span style="color:var(--ready)">Ideal 35–50% (Referenzwert)</span><span>100%</span></div>'+_vs14+'</div>';
      }
    }catch(_){ }
    extra='<div class="sh-block"><div class="bh">Schlaf-Score</div><p>'+(ssc&&ssc.value!=null?('<b style="font-size:18px">'+gmEsc(fmtDe(ssc.value))+'</b>/100 — aus dem kanonischen Speicher (Provider-Score).'):(GM_NA+' — kein Schlaf-Score im kanonischen Speicher.'))+'</p></div>'+
      '<div class="sh-block"><div class="bh">Schlafphasen</div>'+_phaseHtml+'</div>'+_restHtml+
      /* GM7.6: Schlaf-Coach-Slot (GM sleepSheet) — es existiert kein produktiver
         Schlafziel-/Empfehlungsvertrag; Struktur bleibt, Inhalt ehrlich NA (Regel #12). */
      '<div class="sh-block"><div class="bh">Schlaf-Coach · heute Nacht</div><p style="color:var(--muted);font-size:12px">'+GM_NA+' — eine persönliche Schlafenszeit-Empfehlung braucht den Schlafziel-Vertrag (Zielkorridor). ORVIA erfindet keine Empfehlung.</p></div>'+
      /* GM7.4: echtes Hypnogramm aus user_metric_series (sleep_stages) — asynchron,
         ehrlicher Leerzustand solange nicht persistiert; kein erfundenes Bild. */
      '<div class="sh-block"><div class="bh">Hypnogramm</div><div id="gmHypnoSlot"><div style="font-size:11px;color:var(--muted)">'+GM_NA+' — lädt …</div></div></div>'+
      /* GM7.4.1: Nachtverlauf HF/Stress/Body Battery/Atmung — echte Serien aus
         user_metric_series (sleep_hr/sleep_stress/sleep_body_battery/sleep_respiration),
         asynchron nachgeladen; je Serie ehrlicher Leerzustand solange nicht persistiert. */
      '<div class="sh-block"><div class="bh">Nachtverlauf</div>'+
      ['gmSleepHrSlot:Herzfrequenz','gmSleepStressSlot:Stress','gmSleepBbSlot:Body Battery','gmSleepRespSlot:Atmung'].map(function(s){
        var p=s.split(':');return '<div style="margin-top:8px"><div style="font-size:10.5px;color:var(--muted);font-weight:700;margin-bottom:3px">'+p[1]+'</div><div id="'+p[0]+'"><div style="font-size:11px;color:var(--muted)">'+GM_NA+' — lädt …</div></div></div>';
      }).join('')+'</div>';
  }
  else if(key==='stress_avg'){
    /* GM7.4: Tages-Höchststress (stress_max) aus dem kanonischen Speicher. Die
       Intraday-Kurve ist eine Zeitreihe (separater Speicher) — kein interpoliertes Mittel. */
    var _smx=gmMetric('stress_max');
    extra='<div class="sh-block"><div class="bh">Tages-Maximum</div><p>'+(_smx&&_smx.value!=null?('<b style="font-size:18px">'+gmEsc(fmtDe(_smx.value))+'</b> — höchster gemessener Stresswert des Tages (Garmin).'):(GM_NA+' — kein Tages-Maximum gespeichert.'))+'</p></div>'+
      /* GM7.4: echte Intraday-Stresskurve aus user_metric_series (stress_intraday) —
         nur gespeicherte Punkte, kein interpoliertes Tagesmittel. */
      '<div class="sh-block"><div class="bh">Intraday-Verlauf</div><div id="gmStressIntraSlot"><div style="font-size:11px;color:var(--muted)">'+GM_NA+' — lädt …</div></div></div>'+
      /* GM7.6: Skalen-Einordnung (GM stressSheet, statische Skala 0-100) — nur F/P. */
      (((typeof gmLevel==='function'?gmLevel():'f')!=='a')?'<div class="sh-block"><div class="bh">Die Skala</div>'+[['0–25','Ruhe','var(--sleep)'],['26–50','Niedrig','var(--ready)'],['51–75','Mittel','var(--attention)'],['76–100','Hoch','var(--crit)']].map(function(r){return '<div class="scalerow"><span class="sr" style="color:'+r[2]+'">'+r[0]+'</span><span class="sd2" style="background:'+r[2]+'"></span><span class="sl">'+r[1]+'</span></div>';}).join('')+'</div>':'');
  }
  else if(key==='hrv_ms'){
    /* GM7.4.1: echte nächtliche HRV-Einzelmessreihe (sleep_hrv, user_metric_series) —
       zusätzlich zur skalaren Tages-/14-Tage-Serie oben (kanonischer Metrik-Speicher). */
    extra='<div class="sh-block"><div class="bh">Nächtlicher HRV-Verlauf</div><div id="gmHrvNightSlot"><div style="font-size:11px;color:var(--muted)">'+GM_NA+' — lädt …</div></div></div>';
  }
  else if(key==='body_battery'){
    /* GM7.4.1: echte Intraday-Body-Battery-Kurve (body_battery_intraday, user_metric_series). */
    extra='<div class="sh-block"><div class="bh">Intraday-Verlauf</div><div id="gmBbIntraSlot"><div style="font-size:11px;color:var(--muted)">'+GM_NA+' — lädt …</div></div></div>';
  }
  /* GM7.6: metrikspezifischer Header-Untertitel (GM sleepSheet: „Letzte Nacht · 7h 31min · Score 84"). */
  var subTxt='heute '+valTxt;
  if(key==='sleep_duration_min'){try{var _ss2=gmMetric('sleep_score');
    var _durTxt=(curVal!=null)?(Math.floor(curVal/60)+'h '+String(Math.round(curVal%60)).padStart(2,'0')+'min'):valTxt;
    subTxt='Letzte Nacht · '+_durTxt+((_ss2&&_ss2.value!=null)?' · Score '+Math.round(_ss2.value):'');}catch(_){ }}
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:'+(TINT[def.color]||'var(--surface-2)')+';color:'+(SC[def.color]||'var(--muted)')+'">'+icon(def.icon)+'</div><div><h3>'+gmEsc(def.label)+'</h3><div class="sh-sub" style="margin:2px 0 0">'+gmEsc(subTxt)+'</div></div></div>'+
    chart+statsRow+extra+
    (function(){
      /* GM7.6: metrikspezifische Einordnung in drei Tiefen (GM: interp.a/f/p, factors,
         meaning) statt eines fuer alle Metriken identischen Generiktextes. Reine statische
         Erklaertexte; ohne Katalogeintrag bleibt der ehrliche Generikhinweis. */
      var lvl2=(typeof gmLevel==='function')?gmLevel():'f';
      if(!info)return '<div class="sh-block"><div class="bh">Was das heißt</div><p>Anzeige aus dem kanonischen Speicher — keine Bewertung, keine medizinische Aussage. Ø und vs. Ø sind reine Aggregation der gespeicherten Serie.</p></div>';
      var interp=(lvl2==='a'&&info.a)?info.a:(lvl2==='p'&&info.p)?info.p:(info.f||info.p||info.a);
      var facts=(info.factors&&info.factors.length)?(lvl2==='a'?info.factors.slice(0,3):info.factors):null;
      /* GM7.6b: „Berechnung & Konfidenz" (GM openMetric, F/P) — ausschliesslich echte Werte:
         Datenqualitaet aus dataConfidence() (kanonisch, kein erfundener %-Wert), Baseline nur
         fuer HRV/Ruhepuls (recoveryCtx), Abweichung fuer HRV in SD der eigenen ln-Baseline
         (identische Statistik wie hrvScoreOf: hrvBase7/hrvSd28) bzw. Ruhepuls in bpm vs.
         28-T-Median. Ohne Produzent bleibt der Chip ehrlich „—". */
      var confBlock='';
      if(lvl2!=='a'){
        var dqLbl=null;try{var _dq=dataConfidence();dqLbl=_dq&&_dq.level?_dq.level.l:null;}catch(_){ }
        var devChip='—';
        try{var _cx2=recoveryCtx(todayStr());
          if(key==='hrv_ms'&&curVal!=null&&_cx2&&_cx2.hrvBase7!=null&&_cx2.hrvSd28){var _z=(Math.log(curVal)-_cx2.hrvBase7)/_cx2.hrvSd28;devChip=(_z>=0?'+':'')+fmtDe(Math.round(_z*10)/10)+' SD';}
          else if(key==='resting_hr'&&curVal!=null&&_cx2&&_cx2.rhrBase!=null){var _dv2=Math.round(curVal-_cx2.rhrBase);devChip=(_dv2>=0?'+':'')+_dv2+' bpm';}
        }catch(_){ }
        confBlock='<div class="sh-block"><div class="bh">Berechnung &amp; Konfidenz</div><div class="confidence">'+
          '<span class="confchip">'+icon('check','xs')+' Datenqualität <b>'+(dqLbl?gmEsc(dqLbl):'—')+'</b></span>'+
          '<span class="confchip">'+icon('pulse','xs')+' Abweichung <b>'+gmEsc(devChip)+'</b></span>'+
          '<span class="confchip">'+icon('db','xs')+' Baseline <b>'+(baseVal!=null?gmEsc(fmtDe(baseVal))+gmEsc(def.unit):'—')+'</b></span></div>'+
          (lvl2==='p'?'<p style="margin-top:10px;font-size:11.5px;color:var(--muted)">'+(key==='hrv_ms'?'Abweichung in SD der persönlichen ln-Baseline (7-T-Mittel, 28-T-Streuung) — dieselbe Statistik wie in der Score-Engine. ':'')+'Ein Konfidenz-Prozentwert je Metrik existiert nicht als kanonischer Vertrag — ORVIA zeigt die echte Datenqualitätsstufe statt einer erfundenen Zahl.</p>':'')+'</div>';
      }
      return '<div class="sh-block"><div class="bh">Was das heißt</div><p>'+gmEsc(interp)+'</p></div>'+
        (facts?'<div class="sh-block"><div class="bh">Mögliche Einflüsse</div><div class="factchips">'+facts.map(function(f){return '<span class="factchip">'+gmEsc(f)+'</span>';}).join('')+'</div></div>':'')+
        (info.meaning?'<div class="sh-block"><div class="bh">Bedeutung für Training &amp; Erholung</div><p>'+gmEsc(info.meaning)+'</p></div>':'')+
        confBlock;
    })()+
    (key==='active_kcal'?'<div class="sh-block"><span class="deeplink" onclick="gmCloseSheets();gmShowCarryover(\'nutritionBox\')">'+icon('chev','xs')+' Ernährung erfassen</span></div>':'')+
    '<div class="source">'+icon('db','xs')+' '+gmEsc(src)+gmEsc(meta)+'</div>';
  gmOpenSheet('detailSheet');
  /* GM7.5h: GM-Chart mit Baseline-Ø + Scrubbing (identisches Muster wie openLoadSheet) —
     ersetzt den sparkline-Fallback im id-Slot; Baseline = 14-T-Ø aus gmMetricTrendStats
     (reine Aggregation derselben Serie), kein neuer Wert. */
  try{
    if(series&&series.values.length>=3&&window.ORVIA&&ORVIA.charts&&ORVIA.charts.richChart){
      var _cs=document.getElementById('gmMetricChartSlot');
      if(_cs)ORVIA.charts.richChart(_cs,{label:def.label,series:series.values,times:series.dates.map(function(x){return x.slice(5);}),unit:def.unit||'',color:def.color,baseline:(baseVal!=null)?baseVal:((stats&&stats.avg!=null)?stats.avg:null),higherBetter:hb!==false,dec:_dec});
    }
  }catch(_){ }
  /* GM7.4: echte Tages-Serien asynchron nachladen (read-only) — nur innerHTML in
     den vorhandenen Slot, keine Listener/DOM-Akkumulation. */
  if(key==='sleep_duration_min'&&window.ORVIA&&ORVIA.seriesReader){
    /* Phase 4 (P2-3): Spurenbeschriftung liefert renderHypnogram selbst; darunter die
       Legende aus derselben Farb-/Label-Quelle (STAGE_COLOR/STAGE_LABEL). */
    gmLoadSeriesInto('gmHypnoSlot','sleep_stages',function(p){
      var h=ORVIA.seriesReader.renderHypnogram(p);if(!h)return '';
      var SC2=ORVIA.seriesReader.STAGE_COLOR||{},SL2=ORVIA.seriesReader.STAGE_LABEL||{};
      var leg=['deep','light','rem','awake'].map(function(s){return '<span><i style="background:'+(SC2[s]||'var(--muted)')+'"></i>'+gmEsc(SL2[s]||s)+'</span>';}).join('');
      return h+'<div class="dist-leg" style="margin-top:6px">'+leg+'</div>';});
    gmLoadSeriesInto('gmSleepHrSlot','sleep_hr',function(p){return ORVIA.seriesReader.renderCurve(p,{color:'var(--ready)',axes:true,unit:'bpm'});});
    gmLoadSeriesInto('gmSleepStressSlot','sleep_stress',function(p){return ORVIA.seriesReader.renderCurve(p,{color:'var(--attention)',axes:true});});
    gmLoadSeriesInto('gmSleepBbSlot','sleep_body_battery',function(p){return ORVIA.seriesReader.renderCurve(p,{color:'var(--activity)',axes:true});});
    gmLoadSeriesInto('gmSleepRespSlot','sleep_respiration',function(p){return ORVIA.seriesReader.renderCurve(p,{color:'var(--cyan)',axes:true,unit:'/min'});});
  }
  else if(key==='stress_avg'&&window.ORVIA&&ORVIA.seriesReader)gmLoadSeriesInto('gmStressIntraSlot','stress_intraday',function(p){var c=ORVIA.seriesReader.renderCurve(p,{color:'var(--attention)',axes:true,height:64});return c?c+gmStressDistribution(p):'';});
  else if(key==='hrv_ms'&&window.ORVIA&&ORVIA.seriesReader)gmLoadSeriesInto('gmHrvNightSlot','sleep_hrv',function(p){return ORVIA.seriesReader.renderCurve(p,{color:'var(--ready)',axes:true,unit:'ms',height:56});});
  else if(key==='body_battery'&&window.ORVIA&&ORVIA.seriesReader)gmLoadSeriesInto('gmBbIntraSlot','body_battery_intraday',function(p){var c=ORVIA.seriesReader.renderCurve(p,{color:'var(--activity)',axes:true,height:64});return c?gmBbBalance(p)+c:'';});
}
/* ===== GM7.2: dediziertes Trainingsbelastungs-Sheet — GLEICHE kanonische Kette wie die
   Übersicht (allLoads()+Calc.loadSeries/loadModel). Behebt den Anschlussfehler
   „Übersicht zeigt ATL/CTL/TSB, Detail behauptet keine Serie". 1M/3M/6M schaltet
   ausschließlich das Anzeigefenster derselben Serie. Keine neue Lastformel. ===== */
var _loadSheetRange=30;
function gmSetLoadRange(d){_loadSheetRange=(d===90||d===180)?d:30;openLoadSheet();}
function openLoadSheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var L=null,S=null,lm=null,lcc=null;
  try{L=(typeof allLoads==='function')?allLoads():null;
    if(L&&Calc.loadSeries){S=Calc.loadSeries(L.loads);lm=Calc.loadModel?Calc.loadModel(L.loads):null;
      lcc=Calc.loadConfidenceContract?Calc.loadConfidenceContract(L.confidence):null;}}catch(_){ }
  var sup=!!(lcc&&lcc.suppressNumbers);
  var atl=(S&&S.atl&&S.atl.length&&!sup)?Math.round(S.atl[S.atl.length-1]):null;
  var ctl=(S&&S.ctl&&S.ctl.length&&!sup)?Math.round(S.ctl[S.ctl.length-1]):null;
  var tsb=(S&&S.tsb&&S.tsb.length&&!sup)?Math.round(S.tsb[S.tsb.length-1]):((atl!=null&&ctl!=null)?ctl-atl:null);
  var acwr=(lm&&lm.acwr!=null&&lm.acwrReliable&&!sup)?fmtDe(lm.acwr):null;
  var hasSeries=!!(S&&S.ctl&&S.ctl.length>=2&&!sup);
  var rng=_loadSheetRange;
  var stat=function(v,l){return '<div class="sh-stat"><div class="l">'+l+'</div><div class="n">'+(v==null?'—':gmEsc(String(v)))+'</div></div>';};
  var rbtn=function(d,lbl){return '<button class="range-chip '+(rng===d?'on':'')+'" onclick="gmSetLoadRange('+d+')">'+lbl+'</button>';};
  var chart;
  if(hasSeries){
    var k=Math.min(rng,S.ctl.length);
    /* GM7.6c: GM-monthnav-Zeile — echter Monat des Fensterendes (heutiges Datum); ein
       Monats-Blaettern hat keinen kanonischen Datenpfad (Fenster ist relativ) -> Pfeile
       sichtbar deaktiviert statt Demo-Navigation (Regel #12). */
    var _mLbl='';try{_mLbl=new Date().toLocaleDateString('de-DE',{month:'long',year:'numeric'});}catch(_){ }
    /* Phase 1b: die beiden Chevrons sahen nach Zeitraum-Navigation aus, hatten
       aber nie einen Handler. Entfernt — die Beschriftung bleibt. */
    chart='<div style="display:flex;align-items:center;gap:10px;margin:10px 0 6px"><b style="font-size:13.5px">'+gmEsc(_mLbl)+'</b>'+
      '<div class="range-row" style="margin:0 0 0 auto">'+rbtn(30,'1M')+rbtn(90,'3M')+rbtn(180,'6M')+'</div></div><div class="oc2" id="loadSheetChart"></div>';
  }else{
    chart='<div class="ochart"><div class="spark" style="height:70px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--faint);text-align:center;padding:0 12px;background:var(--surface);border:1px solid var(--border);border-radius:12px">'+
      ((lcc&&lcc.ctlAtlNote)?gmEsc(lcc.ctlAtlNote):(GM_NA+' — CTL/ATL erscheinen ab belastbarer Lasthistorie.'))+'</div></div>';
  }
  var last=(S&&S.ctl&&S.ctl.length)?Math.round(S.ctl[S.ctl.length-1]):null;
  var win=hasSeries?S.ctl.slice(-Math.min(rng,S.ctl.length)):[];
  var avg=win.length?Math.round(win.reduce(function(a,b){return a+b;},0)/win.length):null;
  /* GM7.6b: Status-Wort aus dem bereits kanonischen ACWR-Banding (unveraendert). */
  var statusWord=(atl!=null&&acwr!=null)?(parseFloat(String(acwr).replace(',','.'))<0.8?'Erholt':parseFloat(String(acwr).replace(',','.'))<=1.3?'Im grünen Bereich':parseFloat(String(acwr).replace(',','.'))<=1.5?'Erhöht':'Überlastet'):null;
  /* GM-Kopfkarte (Prototyp loadSheet): ATL-Ring + WAS DAS BEDEUTET + CTL/TSB/ACWR-Chips.
     Ring-Skala = persoenliches ATL-Maximum des Fensters (gleiche ehrliche Normalisierung wie
     Sparklines/Balken — die Prototyp-Konstante /85 ist Demo). „Gesunder CTL-Bereich" hat
     keinen Engine-Produzenten -> Slot bleibt, Wert ehrlich „—" (Regel #12). */
  var headCard='';
  if(atl!=null){
    var _amax=Math.max.apply(null,(S.atl||[atl]).map(function(v){return Math.round(v);}).concat([atl,1]));
    var _apct=Math.max(4,Math.min(100,Math.round(atl/_amax*100)));
    headCard='<div class="card" style="margin:14px 0 0;padding:16px"><div style="display:flex;gap:14px;align-items:center">'+
      '<div class="ring-wrap" style="width:82px;height:82px;flex-shrink:0">'+ring(_apct,SC.activity,82,7)+'<div class="ring-c"><div style="font-size:22px;font-weight:800">'+atl+'</div><div style="font-size:9px;color:var(--muted);font-weight:700">ATL</div></div></div>'+
      '<div style="flex:1;min-width:0"><div style="font-size:10px;letter-spacing:.08em;color:var(--faint);font-weight:800">WAS DAS BEDEUTET</div>'+
      '<div style="font-size:14px;font-weight:750;margin-top:3px">'+(statusWord?gmEsc(statusWord):'—')+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><span class="fchipv" style="background:var(--activity-t);color:var(--activity);border-color:transparent">CTL <b>'+(ctl!=null?ctl:'—')+'</b></span><span class="fchipv">TSB <b>'+(tsb!=null?((tsb>=0?'+':'')+tsb):'—')+'</b></span><span class="fchipv">ACWR <b>'+(acwr!=null?gmEsc(acwr):'—')+'</b></span></div>'+
      '<div style="margin-top:8px;font-size:11.5px;color:var(--muted)">Gesunder CTL-Bereich: <b>—</b> (kein kanonischer Vertrag)</div></div></div></div>';
  }
  /* GM-Statusleitfaden: Struktur bleibt vollstaendig (6 Zustaende), Tagesanteile ehrlich „—" —
     es existiert kein kanonischer Fitness-Status-je-Tag-Produzent (Garmin-Konzept); nur der
     heutige, real aus dem ACWR-Banding abgeleitete Zustand wird markiert. */
  /* GM7.6d: Statusleitfaden in GM-verbatim-Markup (.sguide/.srow/.sbadge, Prototyp
     Z.1030-1035) — hochwertiger Badge statt improvisierter Pill (Gian-Feedback).
     Tagesanteile weiterhin ehrlich „—" (kein kanonischer Status-Verlauf). */
  var guide=(function(){
    var rows=[['Abnehmend','chart','sleep'],['Erhaltung','db','neutral'],['Aufbau','bolt','ready'],['Höchstform','target','activity'],['Überlastet','alert','attention'],['Übertrainiert','shield','crit']];
    var map={'Erholt':'Abnehmend','Im grünen Bereich':'Aufbau','Erhöht':'Überlastet','Überlastet':'Überlastet'};
    var cur2=statusWord?map[statusWord]:null;
    return '<div class="sh-block"><div class="bh">Statusleitfaden · 30 Tage</div><div class="sguide">'+rows.map(function(r){
      var on=(cur2===r[0]);var col=SC[r[2]]||'var(--muted)',tint=TINT[r[2]]||'var(--surface-2)';
      return '<div class="srow"'+(on?' style="border-color:'+col+'"':'')+'><div class="st">'+
        '<span class="si" style="background:'+tint+';color:'+col+'">'+icon(r[1],'xs')+'</span>'+
        '<span class="sn">'+r[0]+'</span>'+
        (on?'<span class="sbadge" style="background:'+tint+';color:'+col+'">AKTUELL</span>':'')+
        '<span class="sd"><b>—</b> Tage</span><span class="spct" style="background:'+tint+';color:'+col+'">—</span></div>'+
        '<div class="sbar"><i style="width:0%;background:'+col+'"></i></div></div>';
    }).join('')+'</div><p style="margin-top:4px;font-size:11px;color:var(--muted)">Tagesanteile je Status: '+GM_NA+' — es gibt keinen kanonischen Fitness-Status-Verlauf (Garmin-Konzept, keine Engine-Quelle). Markiert ist nur der heutige, aus dem echten ACWR abgeleitete Zustand.</p></div>';
  })();
  var band=headCard;
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--activity-t);color:var(--activity)">'+icon('gauge')+'</div>'+
    '<div><h3>Trainingsbelastung</h3><div class="sh-sub" style="margin:2px 0 0">heute '+(atl!=null?'ATL '+atl+' · CTL '+(ctl!=null?ctl:'—')+' · TSB '+(tsb!=null?((tsb>=0?'+':'')+tsb):'—'):'—')+'</div></div></div>'+
    chart+
    '<div class="sh-stats">'+stat(ctl,'CTL')+stat(atl,'ATL')+stat(tsb!=null?((tsb>=0?'+':'')+tsb):null,'TSB (Form)')+stat(acwr,'ACWR')+'</div>'+
    band+guide+
    /* Phase 2.0 — Darstellungsvertrag: jede Kennzahl mit Wert · Zeitraum ·
       Abdeckung · Berechnungsgrundlage, direkt aus den Envelopes. */
    (function(){
      var E=window.ORVIA&&ORVIA.metricEnvelope;var env=null;
      try{env=(typeof gmLoadEnvelopes==='function')?gmLoadEnvelopes():null;}catch(_){ }
      if(!E||!env)return '';
      var DEFS=[['hard','Harte Einheiten','Einheiten'],['trimp','TRIMP Ø','Einheiten'],
        ['easy','Easy Share (Laufen)','Läufen'],['sport','Belastung nach Sportart','Einheiten'],['interf','Interferenz','Signalen']];
      var rows=DEFS.map(function(x){
        var e=env[x[0]];if(!e)return '';
        var vTxt;
        if(e.value==null)vTxt='—';
        else if(x[0]==='sport')vTxt=e.value.filter(function(s){return s[1]>0;}).map(function(s){return s[0]+' '+fmtDe(s[1])+' %';}).join(' · ')||'—';
        else if(typeof e.value==='number')vTxt=fmtDe(e.value)+(e.unit==='%'?' %':(e.unit||''));
        else vTxt=String(e.value);
        var warn=e.status==='partial'?' <span style="color:var(--attention);font-weight:700">Teilabdeckung</span>':'';
        var sub=(e.status==='none'&&e.reason)?gmEsc(e.reason):gmEsc(E.line(e,x[2]));
        return '<div style="padding:7px 0;border-bottom:1px solid var(--hair)"><div style="display:flex;justify-content:space-between;gap:10px"><span style="font-weight:700">'+x[1]+'</span><b style="font-variant-numeric:tabular-nums;text-align:right">'+gmEsc(vTxt)+'</b></div><div style="font-size:11px;color:var(--muted);margin-top:2px">'+sub+warn+'</div></div>';
      }).join('');
      return '<div class="sh-block"><div class="bh">Berechnungsgrundlage</div>'+rows+
        '<p style="margin-top:6px;font-size:11px;color:var(--muted)">Kein Wert ohne Zeitraum, Abdeckung und Methode (Metrik-Envelope v'+gmEsc(E.VERSION)+'). Echte HF-Zonen folgen erst mit einem Zonen-Datenpfad — bis dahin keine Zonen-Behauptung.</p></div>';
    })()+
    '<div class="sh-block"><div class="bh">Was das heißt</div><p>CTL = 42-Tage-EWMA der Tageslast (sRPE = Minuten × RPE, keine TSS-Skala). ATL = 7-Tage-EWMA. Form (TSB) = CTL − ATL. Dieselbe kanonische Serie wie die Belastungssteuerung — read-only, keine Neuberechnung.</p></div>'+
    '<div class="source">'+icon('db','xs')+' ORVIA · kanonisches Lastmodell (sRPE)'+((L&&L.provenance==='legacy_fallback')?' · reduzierte Datenlage':'')+'</div>';
  gmOpenSheet('detailSheet');
  if(hasSeries){try{var el=document.getElementById('loadSheetChart');
    if(el&&window.ORVIA&&ORVIA.charts&&ORVIA.charts.richChart){var k2=Math.min(rng,S.ctl.length);
      ORVIA.charts.richChart(el,{label:'CTL (Fitness)',series:S.ctl.slice(-k2).map(function(v){return Math.round(v);}),
        times:(L.labels||[]).slice(-k2),unit:'',color:'gold',baseline:avg,higherBetter:true,dec:0,
        overlays:[{series:S.atl.slice(-k2).map(function(v){return Math.round(v);}),color:'var(--crit)'}]});}
  }catch(_){ }}
}
/* ===== GM7.2: dediziertes Erholungs-Sheet — Composite ist kanonisch
   (getDecision().subscores.recovery.value); Teilsignale HRV/Ruhepuls/Schlaf aus den
   Metrik-Serien. Keine neue Recovery-Formel im UI. ===== */
function openRecoverySheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var os=null;try{os=(typeof orviaScore==='function')?orviaScore():null;}catch(_){ }
  var rec=(os&&os.recovery!=null)?os.recovery:null;
  var d=gmDashVM();var M=d.metrics;
  var stat=function(v,l,u){return '<div class="sh-stat"><div class="l">'+l+'</div><div class="n">'+(v==null?'—':gmEsc(fmtDe(v))+(u||''))+'</div></div>';};
  /* GM7.6 (Teilbereich 4): Der Erholungstrend ist NICHT eine einzelne HRV-Kurve. Es gibt
     keinen persistierten Composite-Verlauf (der Erholungs-Subscore wird nicht als Serie
     gespeichert) — gezeigt werden die vier realen Teilserien (HRV, Ruhepuls, Schlaf,
     Body Battery) aus dem kanonischen Metrik-Speicher, mit klar benannter Grenze. */
  var _rdefs=[['hrv_ms','HRV','ready',function(v){return fmtDe(Math.round(v))+' ms';}],
    ['resting_hr','Ruhepuls','crit',function(v){return fmtDe(Math.round(v))+' bpm';}],
    ['sleep_duration_min','Schlaf','sleep',function(v){return fmtDe(Math.round(v/6)/10)+' h';}],
    ['body_battery','Body Battery','activity',function(v){return fmtDe(Math.round(v));}]];
  var _rrows='',_rany=false;
  _rdefs.forEach(function(rd){
    var s2=gmMetricSeries(rd[0],14);
    if(s2&&s2.values.length>=3){_rany=true;
      _rrows+='<div style="display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid var(--hair)"><div style="width:86px;font-size:11.5px;font-weight:700;color:var(--muted)">'+rd[1]+'</div><div style="flex:1;min-width:0">'+sparkline(s2.values,SC[rd[2]]||'var(--ready)')+'</div><div style="width:64px;text-align:right;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums">'+gmEsc(rd[3](s2.values[s2.values.length-1]))+'</div></div>';
    }else{
      _rrows+='<div style="display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid var(--hair)"><div style="width:86px;font-size:11.5px;font-weight:700;color:var(--muted)">'+rd[1]+'</div><div style="flex:1;font-size:10.5px;color:var(--faint)">'+(s2?'erst '+s2.values.length+' Messwert(e)':'keine Serie gespeichert')+'</div><div style="width:64px;text-align:right;font-weight:800;color:var(--muted)">—</div></div>';
    }});
  var chart='<div class="sh-block" style="padding-top:8px"><div class="bh">Erholungstrend · 14 Tage</div>'+_rrows+
    '<p style="margin-top:8px;color:var(--muted);font-size:11px">Ein zusammengefasster Erholungs-Verlauf wird nicht als Serie gespeichert — ORVIA zeigt die vier echten Teilserien statt einer nachgebauten Composite-Kurve.</p></div>';
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--ready-t);color:var(--ready)">'+icon('heart')+'</div>'+
    '<div><h3>Erholung</h3><div class="sh-sub" style="margin:2px 0 0">heute '+(rec!=null?gmEsc(fmtDe(rec))+' %':'—')+'</div></div></div>'+
    chart+
    '<div class="sh-stats">'+stat(M.hrv,'HRV',' ms')+stat(M.rhr,'Ruhepuls',' bpm')+stat(M.sleepMin!=null?M.sleepMin/60:null,'Schlaf',' h')+'</div>'+
    '<div class="sh-block"><div class="bh">Was das heißt</div><p>'+(rec!=null?('Erholung '+fmtDe(rec)+' % — der kanonische ORVIA-Composite kombiniert HRV, Ruhepuls und Schlaf (plus subjektive Marker). Er entscheidet mit über die Trainingsfreigabe.'):(GM_NA+' — der Composite erscheint nach dem Morgen-Check-in.'))+'</p></div>'+
    '<div class="source">'+icon('db','xs')+' ORVIA-Engine · Erholungs-Subscore (read-only)</div>';
  gmOpenSheet('detailSheet');
}
/* GM7.9k: „Profil vervollstaendigen" nannte bisher nur „Wenige Angaben fehlen noch" und
   fuehrte auf die Profiluebersicht — man musste die Luecke selbst suchen. Der kanonische
   Vollstaendigkeitsvertrag (profileModel.computeProfileCompleteness) weiss genau, WELCHER
   Pflichtbereich fehlt, und das Profilcenter bindet dafuer bereits openProfileSection(id).
   Beides wird jetzt genutzt: die Kachel benennt den fehlenden Bereich und springt direkt in
   dessen Editor. Rein lesend, keine eigene Bewertung der Vollstaendigkeit. */
function gmProfileGap(){
  try{
    var M=window.ORVIA&&ORVIA.profileModel;if(!M||typeof M.computeProfileCompleteness!=='function')return null;
    var p=(typeof PROFILE!=='undefined'&&PROFILE)||null;if(!p)return null;
    var c=M.computeProfileCompleteness(p);
    var miss=(c&&c.essential&&c.essential.missing)||[];
    if(!miss.length)return null;
    var offen={},order=[];
    miss.forEach(function(m){if(m&&m.section&&!offen[m.section]){offen[m.section]=1;order.push(m.section);}});
    var sid=order[0];var lbl=null;
    try{var PC=window.ORVIA&&ORVIA.profileCenter;lbl=PC&&PC.SECTION_LABELS&&PC.SECTION_LABELS[sid];}catch(_){ }
    return {section:sid,label:lbl||sid,rest:order.length-1};
  }catch(_){ }
  return null;
}
function gmGotoProfileGap(sid){
  gmCloseSheets();
  try{if(typeof openProfileSection==='function'&&sid){openProfileSection(sid);return;}}catch(_){ }
  try{var PC=window.ORVIA&&ORVIA.profileCenter;if(PC&&PC.open){PC.open();return;}}catch(_){ }
  try{gmRunQA('profile_complete');}catch(_){ }
}
/* Quick-Add: GM-qaSheet über die ECHTEN Quick-Actions (runAction bleibt der Executor).
   GM7.9j — Fehlerbehebung: getFavorites() liefert laut Vertrag (js/quick-actions.js) eine
   Liste von AKTIONS-IDs, KEINE Aktionsobjekte. Der Renderer hat sie aber wie Objekte
   behandelt, wodurch a.label/a.description/a.icon/a.id samt und sonders undefined waren:
   jede Kachel blieb textlos, fiel auf den Blitz-Fallback (#i-zap) zurueck und der Tap rief
   gmRunQA('') auf — das Sheet war damit vollstaendig funktionslos.
   Aufgeloest wird jetzt ueber den kanonischen Menuebauer composeQuickMenu(), der genau
   dafuer existiert: er liefert fertige Aktionsobjekte, stellt bis zu zwei Kontextaktionen
   (z. B. offener Morgen-Check-in) voran und entfernt Doppelungen mit den Favoriten. */
function gmOpenQA(){
  var sh=document.getElementById('qaSheet');if(!sh)return;
  var qa=(typeof window!=='undefined'&&window.ORVIA&&window.ORVIA.quickActions)||null;
  var menu=null;
  try{
    if(qa&&qa.composeQuickMenu){
      var ctx={};try{ctx=(qa.buildContext&&qa.buildContext())||{};}catch(_){ }
      var favs=[];try{favs=(qa.getFavorites&&qa.getFavorites())||[];}catch(_){ }
      menu=qa.composeQuickMenu(ctx,favs,qa.ACTIONS);
    }
  }catch(_){ }
  var list=[];
  if(menu)list=(menu.context||[]).concat(menu.favorites||[]);
  /* Fail-safe: fehlt der Menuebauer, wenigstens die nicht-kontextuellen Aktionen zeigen. */
  if(!list.length){try{list=((qa&&qa.ACTIONS)||[]).filter(function(a){return a&&a.category!=='context';}).slice(0,6);}catch(_){ }}
  list=list.filter(function(a){return a&&a.id&&a.label;}).slice(0,6);
  var tint={training_start:'activity',checkin_morning:'ready',checkin_evening:'sleep',activity_log:'activity',weight_update:'cyan',complaint_log:'crit',routines_check:'ready',goal_add:'gold',measurement_log:'ready',appointment_add:'activity',
    training_continue:'activity',profile_complete:'cyan',complaint_update:'crit'};
  var ctxIds={};try{(menu&&menu.context||[]).forEach(function(a){ctxIds[a.id]=1;});}catch(_){ }
  var gap=gmProfileGap();
  var grid=list.length?list.map(function(a,i){var c=tint[a.id]||'activity';
    /* Kontextaktionen tragen den Grund sichtbar — sonst bleibt die kanonische Beschreibung. */
    var d=a.description||'';if(ctxIds[a.id])d=d?('Jetzt sinnvoll · '+d):'Jetzt sinnvoll';
    var act="gmRunQA('"+gmEsc(a.id)+"')";
    /* Profil-Luecke: konkreter Bereich statt Allgemeinplatz, Tap springt direkt hinein. */
    if(a.id==='profile_complete'&&gap){
      d=gap.label+(gap.rest>0?' · +'+gap.rest+' weitere':'');   /* kurz: nur der offene Bereich */
      act="gmGotoProfileGap('"+gmEsc(gap.section)+"')";
    }
    return '<div class="qa'+(i===0?' primary':'')+'" role="button" tabindex="0" onclick="'+act+'" onkeydown="if(event.key===\'Enter\')'+act+'">'+
      '<div class="q-ic"'+(i===0?'':' style="background:'+((typeof TINT!=='undefined'&&TINT[c])||'var(--surface-2)')+';color:'+((typeof SC!=='undefined'&&SC[c])||'var(--muted)')+'"')+'><svg class="ic"><use href="'+gmEsc(a.icon||'#i-zap')+'"/></svg></div>'+
      '<div><div class="q-t">'+gmEsc(a.label)+'</div><div class="q-d">'+gmEsc(d)+'</div></div></div>';}).join('')
    :'<p class="muted" style="margin:0">Schnellaktionen '+GM_NA.toLowerCase()+'.</p>';
  /* GM7.9j: Der Untertitel verspricht „anpassbar". Der Favoriten-Manager existiert produktiv
     (quickActions.openFavoritesManager), war aber aus der Oberflaeche nicht erreichbar — die
     Zusage lief ins Leere. Letzte Kachel entspricht der GM-Position „Eigenes Element". */
  var canEdit=false;try{canEdit=!!(qa&&qa.openFavoritesManager&&typeof window.openSheet==='function');}catch(_){ }
  if(list.length&&canEdit){
    grid+='<div class="qa" role="button" tabindex="0" onclick="gmOpenQAFavs()" onkeydown="if(event.key===\'Enter\')gmOpenQAFavs()">'+
      '<div class="q-ic" style="background:var(--surface-2);color:var(--gold-soft,#c9ae7c)"><svg class="ic"><use href="#i-list"/></svg></div>'+
      '<div><div class="q-t">Anpassen</div><div class="q-d">Auswahl und Reihenfolge</div></div></div>';
  }
  sh.innerHTML='<div class="grab"></div><h3>Schnell hinzufügen</h3><div class="sh-sub">Häufig genutzt zuerst'+(canEdit?' · anpassbar':'')+'</div><div class="qa-grid">'+grid+'</div>';
  gmOpenSheet('qaSheet');
}
function gmOpenQAFavs(){
  gmCloseSheets();
  try{var qa=window.ORVIA&&window.ORVIA.quickActions;if(qa&&qa.openFavoritesManager)qa.openFavoritesManager();}catch(_){ }
}
function gmRunQA(id){gmCloseSheets();try{var qa=window.ORVIA&&window.ORVIA.quickActions;if(qa&&qa.runAction)qa.runAction(id);}catch(_){ }}
/* Phase 1 · KF-001 — Hero-CTA „Training starten".
   Vorher wurde runAction() aufgerufen und das Ergebnis mit einem
   bedingungslosen `return` verworfen. Der Fallback darunter war damit toter
   Code, und ein fehlgeschlagener Dispatch blieb unsichtbar.
   Jetzt: Ergebnis auswerten, bei Misserfolg der Reihe nach zurueckfallen und
   den Nutzer erst dann ehrlich informieren, wenn KEIN Weg funktioniert hat. */
function gmStartTraining(){
  var res=null;
  try{var qa=window.ORVIA&&window.ORVIA.quickActions;
    if(qa&&qa.runActionEx)res=qa.runActionEx('training_start');
    else if(qa&&qa.runAction)res={handled:!!qa.runAction('training_start'),reason:null};
  }catch(_){ }
  if(res&&res.handled)return;
  if(res&&res.reason==='blocked')return;            /* Doppeltipp — kein Fallback, kein Hinweis */
  try{if(window.ORVIA&&ORVIA.workoutUI&&ORVIA.workoutUI.openTrainingTab){
    var r=ORVIA.workoutUI.openTrainingTab();
    if(!r||r.ok!==false)return;
  }}catch(_){ }
  try{if(typeof gmOpenStartSheet==='function'){gmOpenStartSheet();return;}}catch(_){ }
  try{if(typeof toast==='function')toast('Training lässt sich gerade nicht starten.');}catch(_){ }
}
/* Modulverwaltung (mmSheet, reine UI-Präferenz mit localStorage) */
function gmOpenMM(){gmRenderMM();gmOpenSheet('mmSheet');}
/* Phase 1 · P0-7/P0-8 — Modulverwaltung.

   P0-7: Das Sheet rendert bisher NUR die aktiven Module. Ein ausgeschaltetes
   Modul verschwand damit aus der Liste und liess sich nie wieder einzeln
   einschalten — nur ueber „Standard" (Reset aller). Der Untertitel versprach
   aber „Ein-/ausblenden". Jetzt werden alle Module der aktuellen Stufe
   gezeigt; ausgeschaltete stehen unten und lassen sich zurueckholen.

   P0-8: Der Drag-Griff (.mm-drag) war rein dekorativ — im gesamten Projekt gibt
   es weder draggable noch einen dragstart-Handler. Entfernt; die Reihenfolge
   aendert man ueber die bereits funktionierenden Pfeiltasten. */
function gmRenderMM(){
  var sh=document.getElementById('mmSheet');if(!sh)return;
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var active=gmModules();
  var all=(LEVELMOD[lvl]||[]).slice();
  active.forEach(function(id){if(all.indexOf(id)<0)all.push(id);});   /* Fremdeintraege nicht verlieren */
  var inactive=all.filter(function(id){return active.indexOf(id)<0;});
  function row(id,on,i,n){
    var mm=ALLMOD[id]||{t:id,d:'',lvl:1};
    var lbl=mm.lvl===3?'PROFI':mm.lvl===2?'FORTGESCHR.':'BASIS';
    var order=on?('<div class="mm-order"><button '+(i===0?'disabled':'')+' onclick="gmMoveMod('+i+',-1)" aria-label="nach oben">▲</button><button '+(i===n-1?'disabled':'')+' onclick="gmMoveMod('+i+',1)" aria-label="nach unten">▼</button></div>'):'';
    return '<div class="mm-item'+(on?'':' mm-off')+'"><div class="mm-b"><div class="mm-t">'+gmEsc(mm.t)+'</div><div class="mm-d">'+gmEsc(mm.d)+'</div></div>'+
      '<span class="mm-lvl">'+lbl+'</span>'+order+
      '<div class="sw'+(on?' on':'')+'" role="switch" aria-checked="'+(on?'true':'false')+'" tabindex="0" aria-label="'+gmEsc(mm.t)+(on?' ausblenden':' einblenden')+'"'+
      ' onclick="gmToggleMod(\''+id+'\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();gmToggleMod(\''+id+'\');}"></div></div>';
  }
  var rows=active.map(function(id,i){return row(id,true,i,active.length);}).join('');
  if(inactive.length){
    rows+='<div class="sectlabel" style="margin:14px 0 6px">Ausgeblendet<span class="ana-count">'+inactive.length+'</span></div>'+
          inactive.map(function(id){return row(id,false,-1,0);}).join('');
  }
  sh.innerHTML='<div class="grab"></div><h3>Module anpassen</h3><div class="sh-sub">Ein-/ausblenden und Reihenfolge · Sichtbarkeitsstufe je Modul</div><div id="mmList">'+rows+'</div>'+
    '<div class="sheet-cta"><button class="sec" onclick="gmMMReset()">Standard</button><button class="prim" onclick="gmMMDone()">Fertig</button></div>';
}
/* Nimmt jetzt die MODUL-ID statt eines Listenindex — ein Index waere nach dem
   Ausblenden mehrdeutig (aktive und ausgeblendete Liste). */
function gmToggleMod(id){
  var mods=gmModules();var i=mods.indexOf(id);
  if(i>=0)mods.splice(i,1);else mods.push(id);
  gmSaveModules(mods);gmRenderMM();renderModules();
}
function gmMoveMod(i,dir){var mods=gmModules();var j=i+dir;if(j<0||j>=mods.length)return;var t=mods[i];mods[i]=mods[j];mods[j]=t;gmSaveModules(mods);gmRenderMM();renderModules();}
function gmMMDone(){gmCloseSheets();renderModules();}
function gmMMReset(){try{localStorage.removeItem('orvia_gm_mods_'+gmLevel());}catch(_){ }gmRenderMM();renderModules();}
/* FAB → GM-Quick-Add (Rebind idempotent; quick-actions.runAction bleibt der Executor) */
(function(){function bind(){try{var b=document.getElementById('navPlus');if(b&&b.onclick!==gmOpenQA)b.onclick=gmOpenQA;}catch(_){ }}
  bind();if(typeof window!=='undefined'){window.addEventListener('load',function(){bind();setTimeout(bind,600);});}})();
/* ====== GM1-ENDE ====== */

/* ====== GM2: Golden-Master-Planseite — Referenz ist AUSSCHLIESSLICH die finale aktive
   planView des GM (pvar-Reihe, Variantenkarte, session-cards, pq-grid, fc-corridor,
   phase-track, vol-row, daily-goals, tabspacer). Kein plan-hero der überschriebenen
   Altansicht, keine frühere Wochentagsleiste, keine Journal-Ansicht. Alle Werte read-only aus den bestehenden
   kanonischen Quellen (activeWeekPlan/Resolver, planQualityChecks, racePhases, weekRunKm/
   weekKmTarget/effectiveKmTarget); fehlende Verträge ⇒ strukturerhaltende „—"-Slots. ====== */
function gmPlanWeekMeta(){
  var wk=null,phase=null,range='';
  try{if(typeof isRunDistanceGoal==='function'&&isRunDistanceGoal()&&goalOf().raceDate)wk=Math.max(1,Math.min(25,Calc.runnaWeek(daysTo(RACE.date))));}catch(_){ }
  try{var ph=Calc.racePhases(RACE.date,todayStr());(ph||[]).forEach(function(p){if(p.on)phase=p.n;});}catch(_){ }
  try{var now=new Date();var d=(now.getDay()+6)%7;var mon=new Date(now);mon.setDate(now.getDate()-d);var sun=new Date(mon);sun.setDate(mon.getDate()+6);
    var f=function(x){return x.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});};range=f(mon)+'–'+f(sun);}catch(_){ }
  return {wk:wk,phase:phase,range:range};
}
/* ---------- Planvarianten A/B/C (Produktentscheidung 2026-08-04) ----------
   A = Optimal (der vollstaendige Plan), B = Reduziert (wenig Zeit), C = Minimal-
   woche (fast keine Zeit). Es wird KEIN Inhalt erfunden: jede Variante ist eine
   TEILMENGE der real geplanten Einheiten, eingestuft ueber die bestehende
   produktive unitPriority()-Klassifikation (Kern/Aufbau/Ergaenzung). Der
   gespeicherte Wochenplan wird dabei NIE veraendert — die Auswahl ist eine
   Ansicht/Fokussetzung und liegt in localStorage. Die individuelle, leistungs-
   datenbasierte Varianten-PLANUNG uebernimmt spaeter die Trainingsengine. */
/* Namen und Beschreibungen kommen aus js/engine/plan-variants.js — dort liegt
   auch die Rechnung. Zwei Namensquellen fuer dieselbe Sache waren der Grund,
   warum Beschriftung und Verhalten auseinanderliefen. Der Rueckfall gilt nur,
   wenn das Modul fehlt. */
var GM_PLAN_VARIANTS=(function(){
  try{if(window.ORVIA&&ORVIA.planVariants&&ORVIA.planVariants.META)return ORVIA.planVariants.META;}catch(_){ }
  return {A:{name:'Vollständig',desc:'Der Plan wie gebaut — alle Einheiten.'},
    B:{name:'Reduziert',desc:'Gleiche Wochenstruktur, ohne Doppeleinheiten. Zeitsparend, alle Kernreize bleiben.'},
    C:{name:'Minimal',desc:'Nur die Einheiten, die das Ziel tragen.'}};})();
/* Wochenversatz der Planseite. Bewusst NUR im Speicher (kein localStorage):
   Beim naechsten Oeffnen soll wieder die laufende Woche stehen — sonst landet
   man Wochen spaeter unbemerkt in einer alten Woche und haelt sie fuer aktuell. */
var _gmPlanWeekOff=0;
function gmPlanWeekOff(){return _gmPlanWeekOff;}
function gmShiftPlanWeek(d){
  _gmPlanWeekOff=Math.max(-52,Math.min(52,_gmPlanWeekOff+(d||0)));
  try{renderGMPlan();}catch(_){ }
}
function gmPlanWeekToday(){_gmPlanWeekOff=0;try{renderGMPlan();}catch(_){ }}
function gmPlanVariantSel(){try{var v=localStorage.getItem('orvia_plan_variant_v1');return (v==='B'||v==='C')?v:'A';}catch(_){return 'A';}}
function gmSetPlanVariant(v){
  if(!GM_PLAN_VARIANTS[v])return;
  try{localStorage.setItem('orvia_plan_variant_v1',v);}catch(_){ }
  try{renderGMPlan();}catch(_){ }
  try{if(typeof gmCloseSheets==='function')gmCloseSheets();}catch(_){ }
}
function gmPlanVariantModel(){
  /* FIX (2026-08-06, Nutzerbefund „bei A reduziert und B zaehlen dieselben Einheiten"):
     Die alte Fassung filterte nach unitPriority (A=alles, B=A+B, C=nur A). Liefert
     unitPriority fuer die Einheiten eines Nutzers durchgaengig denselben Wert — und
     genau das tut sie bei Laufen+Rad+Kraft —, filtert B nichts weg und zeigt dieselbe
     Zahl wie A. Die Varianten waren dreimal derselbe Plan mit anderer Beschriftung.

     Neue Bedeutung (Nutzervorgabe): B ist NICHT eine andere Prioritaetsklasse,
     sondern derselbe Plan zeiteffizienter — Doppeleinheiten aufgeloest, Kernreize
     unangetastet. Die Rechnung liegt in js/engine/plan-variants.js (pur, getestet). */
  var week=[[],[],[],[],[],[],[]];try{week=activeWeekPlan()||week;}catch(_){ }
  var PV=(window.ORVIA&&ORVIA.planVariants)||null;
  var sel=gmPlanVariantSel();
  if(!PV||typeof PV.build!=='function'){
    /* Ohne das Modul KEINE Variantenaussage — lieber „—" als drei gleiche Zahlen. */
    return {sel:sel,classified:false,total:0,variants:{A:{count:null},B:{count:null},C:{count:null}},
      keep:function(){return null;},note:null};
  }
  var built=PV.build(week);
  var out={sel:sel,classified:true,total:built.A.count,built:built,
    note:built.note,consistent:built.consistent,distinct:built.distinct,variants:{}};
  ['A','B','C'].forEach(function(v){
    var b=built[v];
    out.variants[v]={count:b.count,days:b.trainingDays,rest:b.restDays,core:b.keySessions,
      name:b.name,desc:b.desc,dropped:b.dropped};
  });
  /* Bleibt die Einheit (di,ii) in der gewaehlten Variante erhalten? Verglichen wird
     ueber Sportart+Bezeichnung am selben Tag — dieselbe Einheit kommt pro Tag nur
     einmal vor (Regel R8 im Designer), die Zuordnung ist also eindeutig. */
  out.keep=function(di,ii){
    try{
      var it=(week[di]||[])[ii];if(!it)return null;
      var target=built[out.sel];if(!target)return true;
      var day=target.days[di]||[];
      for(var k=0;k<day.length;k++){if(day[k]&&day[k].t===it.t&&day[k].l===it.l)return true;}
      return false;
    }catch(_){return null;}
  };
  return out;
}
function gmOpenVariantSheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var vm=null;try{vm=gmPlanVariantModel();}catch(_){ }
  var dn=['Mo','Di','Mi','Do','Fr','Sa','So'];
  var blocks=['A','B','C'].map(function(v){
    var meta=GM_PLAN_VARIANTS[v];var d=vm&&vm.variants[v];
    var stat=(d&&d.count!=null)?(d.count+' von '+vm.total+' Einheiten · '+d.days+' Trainingstage · '+d.rest+' Ruhetage'):GM_NA;
    var list='';
    if(d&&d.kept&&d.kept.length&&v!=='A'){
      list='<p style="margin:6px 0 0;font-size:12px;color:var(--muted)">'+d.kept.map(function(u){return dn[u.di]+' '+gmEsc(u.it.l||u.it.t);}).join(' · ')+'</p>';
    }
    return '<div class="sh-block"><div class="bh">Variante '+v+' · '+meta.name+(vm&&vm.sel===v?' — ausgewählt':'')+'</div><p>'+meta.desc+'</p>'+
      '<p style="margin:6px 0 0;font-size:12.5px;font-weight:700">'+gmEsc(stat)+'</p>'+list+
      '<div class="sheet-cta" style="margin-top:8px"><button class="'+(vm&&vm.sel===v?'':'sec ')+'" onclick="gmSetPlanVariant(\''+v+'\')">'+(vm&&vm.sel===v?'Ausgewählt':'Variante '+v+' wählen')+'</button></div></div>';
  }).join('');
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--activity-t);color:var(--activity)">'+icon('calendar')+'</div><div><h3>Planvarianten</h3><div class="sh-sub" style="margin:2px 0 0">A · B · C — Teilmengen deines echten Plans</div></div></div>'+
    blocks+
    '<div class="source">'+icon('info','xs')+' Einstufung nach Einheitstyp (Kern / Aufbau / Ergänzung). Dein gespeicherter Plan bleibt unverändert — entfallende Einheiten werden nur ausgeblendet markiert. Die individuelle Varianten-Planung übernimmt die Trainingsengine.</div>';
  gmOpenSheet('detailSheet');
}
function gmOpenPlanSettingsSheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  /* KF-011: Provenienz der letzten Planaenderung sichtbar machen. */
  var prov='';try{var pm=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weekPlanMeta)||null;
    if(pm&&pm.source){var srcDE={manual_edit:'manuell bearbeitet',engine_adjustment:'durch die Engine angepasst',reset:'neu aufgebaut'}[pm.source]||pm.source;
      var when='';try{var dt=new Date(pm.at);if(!isNaN(dt))when=' am '+dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+', '+dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});}catch(_){ }
      prov='<div class="source">'+icon('info','xs')+' Zuletzt '+gmEsc(srcDE)+gmEsc(when)+'.</div>';}}catch(_){ }
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('gear')+'</div><div><h3>Plan &amp; Wochenstruktur</h3><div class="sh-sub" style="margin:2px 0 0">Bestehende Werkzeuge</div></div></div>'+
    '<div class="sheet-cta"><button class="sec" onclick="gmCloseSheets();openPlanEditor()">Plan bearbeiten</button><button class="sec" onclick="gmCloseSheets();openPauseEditor()">Pause / Urlaub</button>'+
    /* Phase 3 · Block 2: Wochenreview + Coach Briefing — kontextueller Einstieg am Plan. */
    ((typeof gmFeatureFlag!=='function'||gmFeatureFlag('weekReview'))?'<button class="sec" onclick="gmOpenWeekReviewSheet()">Wochenreview</button>':'')+'</div>'+prov+
    /* Phase 5D/5E: Beta-Toggle fuers kanonische Planmodell — Aktivierung setzt die
       ausgefuehrte Migration 0030 voraus (user_week_plans); sonst schlaegt der erste
       Sync sichtbar fehl (kein stiller Fallback). Flag aus ⇒ reiner Legacy-Pfad. */
    '<div class="sh-block" style="margin-top:10px"><div class="bh">Kanonisches Planmodell (Beta)</div>'+
    '<p style="font-size:12px;color:var(--muted);margin:0 0 8px">Engine-Anpassungen und deine manuellen Änderungen werden getrennt gespeichert und überschreiben einander nie mehr — mit Planhistorie. Voraussetzung: Migration 0030 ist in Supabase ausgeführt.</p>'+
    '<div class="sheet-cta"><button class="sec" onclick="gmSetFeatureFlag(\'canonPlan\',!gmCanonPlanOn());gmCloseSheets();try{renderGMPlan()}catch(e){}">'+((typeof gmCanonPlanOn==='function'&&gmCanonPlanOn())?'Deaktivieren (zurück zum Legacy-Plan)':'Aktivieren')+'</button></div></div>';
  gmOpenSheet('detailSheet');
}
/* Phase 3 · Block 2 (2026-08-05): Wochenreview als GM-Sheet auf dem Plan-Tab —
   IDENTISCHE kanonische Berechnung wie der Legacy-Review (weeklyReviewHTML,
   orvia-pro.js: Wochenvertrag + Readiness/Schlaf/Beschwerde-Mittel), plus der
   bestehende Coach-Briefing-Export (copyAIReview: vollstaendiges Datenpaket als
   Prompt in die Zwischenablage). Kein zweiter Rechenweg. */
function gmOpenWeekReviewSheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var body='';
  try{body=(typeof weeklyReviewHTML==='function')?weeklyReviewHTML():'<p class="muted">'+GM_NA+'</p>';}catch(_){body='<p class="muted">'+GM_NA+'</p>';}
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--activity-t);color:var(--activity)">'+icon('chart')+'</div><div><h3>Wochenreview</h3><div class="sh-sub" style="margin:2px 0 0">Kanonischer Wochenvertrag · Mo–So</div></div></div>'+
    '<div class="sh-block">'+body+'</div>'+
    '<div class="sheet-cta"><button class="sec" onclick="typeof copyAIReview===\'function\'&&copyAIReview()">'+icon('copy','sm')+' Coach Briefing kopieren</button></div>'+
    '<div class="source">'+icon('info','xs')+' Briefing = vollständiges Wochen-Datenpaket (Prognose, ACWR-Status, Warnungen, letzte 7 Tage) als Prompt für deinen Coach oder eine KI — nur in die Zwischenablage, es verlässt das Gerät nicht automatisch.</div>';
  gmOpenSheet('detailSheet');
}
function gmDailyGoalsBlock(){
  var slots=[['Schritte','foot'],['Aktive kcal','bolt'],['Wasser','drop'],['Schlaf','moon']];
  return '<div class="daily-goals">'+slots.map(function(s){
    return '<div class="daily-goal"><div class="dg-top"><span>'+s[0]+'</span>'+icon(s[1],'xs')+'</div><b>— / —</b><div class="mini-track"><i style="width:0%"></i></div></div>';}).join('')+'</div>'+
  '<div class="mini-note" style="margin-top:8px">'+icon('info','xs')+'<div>'+GM_NA+' — es existiert noch kein dailyTargets-Datenvertrag (Schritte-/kcal-/Wasser-/Schlafziele). ORVIA zeigt hier keine erfundenen Ziele.</div></div>';
}
/* ============================================================
   v8-313 · ZIELPROGNOSE — die erste echte Engine-Anbindung des Plan-Tabs.

   BEFUND, DER DAZU FÜHRTE: Der Slot zeigte die String-Literale
   „vorsichtig — realistisch — optimistisch —" und den Satz „erscheint mit der
   externen Trainingsengine". Diese Engine ist seit v8-2xx im Haus und rechnet
   bei JEDEM Planlauf mit: performance-zones.forecast() liefert exakt dieses
   Tripel, goal-feasibility.feasibility() liefert die Zielaussicht. Beides lief
   im Schattenbetrieb und wurde nie gelesen. forecast() hatte im gesamten
   Projekt NULL Aufrufer.

   WARUM HIER UND NICHT IM LEGACY-CONTAINER: Die Zielaussicht wurde bereits
   gerendert — in #adaptiveCard (js/adaptive-card.js), einem direkten Kind von
   #tab-plan, das styles.css:3130 (`#tab-plan > :not(#gmPlan):not(#gmPage)`)
   ausblendet. Der zweite Renderpfad hing an renderWeekPlan(), das nur vom
   überschriebenen renderPlan() gerufen wird. Der Wert existierte also, war aber
   doppelt unerreichbar. Statt die CSS-Regel aufzuweichen (sie hält die gesamte
   Legacy-Planansicht zurück) liest der GM-Slot die Engine jetzt direkt.

   WAS SICH NICHT ÄNDERT — DIE EHRLICHKEITSREGEL: Ohne belastbaren Leistungswert
   gibt es weiterhin KEINE Zahl. Neu ist nur, dass der leere Zustand seinen GRUND
   nennt und den Weg zeigt, statt auf eine „externe Engine" zu vertrösten, die es
   längst gibt. goal-feasibility fail-closed 'insufficient_data' bleibt unberührt:
   ein Leistungswert OHNE Datum ist laut Evidenzvertrag informational, nie
   entscheidungsfähig (evidence.js usability()) — daran rüttelt diese Runde nicht.

   REINE DARSTELLUNG: keine eigene Rechnung, kein Schreiben, kein Zustand. Die
   Funktion ist pur (Eingaben rein, String raus) und deshalb als VERHALTEN
   testbar — sie bekommt die bereits im Render aufgelöste Leistung übergeben,
   statt sie ein zweites Mal aufzulösen (das könnte abweichen). */
function gmGoalForecastMin(min){
  if(!(min>0))return '—';
  var h=Math.floor(min/60),m=Math.round(min%60);
  if(m===60){h++;m=0;}
  return h>0?(h+':'+String(m).padStart(2,'0')+' h'):(m+' min');
}
/* Reine Sicht auf Korridor + Zielaussicht. runPerf = _perfBySport.running.
   goal = goalOf()-Ergebnis. feas = getAdaptiveExplanation().feasibility (darf
   fehlen — die Karte bleibt dann ohne Aussagezeile, nicht ohne Korridor). */
function gmGoalForecastView(runPerf,goal,feas){
  var v={ok:false,reason:null,cautious:null,realistic:null,optimistic:null,
    bandPct:null,confidence:null,status:null,weeks:null,missing:[],reachable:null};
  var distKm=(goal&&goal.distanceKm>0)?goal.distanceKm:null;
  if(!distKm){v.reason='no_goal_distance';return v;}
  if(!runPerf||runPerf.ok!==true){
    v.reason='no_performance';
    /* Den konkreten Mangel durchreichen statt ihn zu verallgemeinern — der
       Resolver benennt ihn bereits (path.prompt/detail). */
    try{if(runPerf&&(runPerf.detail||(runPerf.path&&runPerf.path.prompt)))v.missing.push(String((runPerf.path&&runPerf.path.prompt)||runPerf.detail));}catch(_){ }
    return v;
  }
  var PZ=(window.ORVIA&&ORVIA.performanceZones)||null;
  if(!PZ||typeof PZ.forecast!=='function'){v.reason='no_forecast_module';return v;}
  var fc=null;try{fc=PZ.forecast(runPerf,distKm);}catch(_){fc=null;}
  if(!fc||fc.ok!==true){v.reason=(fc&&fc.reason)||'not_computable';return v;}
  v.ok=true;
  v.cautious=fc.cautiousMin;v.realistic=fc.realisticMin;v.optimistic=fc.optimisticMin;
  v.bandPct=fc.bandPct;v.confidence=fc.confidence;
  /* Zielzeit gegen die KONSERVATIVE Kante prüfen, nicht gegen den Punktwert —
     dieselbe Regel, die observer-input für die Evidenzvererbung anwendet. */
  if(goal&&goal.targetMin>0){
    v.target=goal.targetMin;
    v.reachable=(goal.targetMin>=fc.cautiousMin)?'likely':(goal.targetMin>=fc.optimisticMin)?'edge':'beyond';
  }
  if(feas&&feas.status){
    v.status=feas.status;
    if(feas.estimatedWeeksRange&&feas.estimatedWeeksRange.min!=null)v.weeks=feas.estimatedWeeksRange;
    if(feas.status==='insufficient_data'&&feas.limitingFactors&&feas.limitingFactors.length)
      v.missing=v.missing.concat(feas.limitingFactors);
  }
  return v;
}
var GM_FEAS_TEXT={within_modeled_corridor:'Im Rahmen dessen, was das Modell trägt',
  outside_modeled_corridor:'Außerhalb des Modellkorridors',insufficient_data:'Datenlage reicht nicht'};
var GM_MISSING_TEXT={current_performance:'ein gemessener Leistungswert',
  current_performance_not_decision_eligible:'ein Leistungswert MIT Datum (undatiert zählt nicht)',
  goal:'eine bezifferte Zielzeit'};
function gmGoalForecastCard(lvl,perfBySport){
  var runPerf=(perfBySport&&perfBySport.running)||null;
  var goal=null;try{goal=(typeof goalOf==='function')?goalOf():null;}catch(_){ }
  var feas=null;
  try{var ax=(window.ORVIA&&ORVIA.getAdaptiveExplanation)?ORVIA.getAdaptiveExplanation():null;
    feas=(ax&&ax.feasibility)||null;}catch(_){ }
  var v=gmGoalForecastView(runPerf,goal,feas);
  if(!v.ok){
    var why=v.reason==='no_goal_distance'
      ?'Ohne Zieldistanz gibt es nichts zu prognostizieren — hinterlege ein Distanzziel.'
      :v.missing.length
        ?('Es fehlt: '+v.missing.map(function(m){return gmEsc(GM_MISSING_TEXT[m]||m);}).join(', ')+'.')
        :'Es fehlt ein belastbarer Leistungswert.';
    var cta=(v.reason==='no_performance')
      ?' <span class="edit" role="button" tabindex="0" onclick="gmOpenBestTimesEntry()" onkeydown="if(event.key===\'Enter\')gmOpenBestTimesEntry()">Leistung erfassen</span>':'';
    return '<div class="card"><div class="fc-labels"><span>vorsichtig —</span><span>realistisch —</span><span>optimistisch —</span></div>'+
      '<div class="fc-corridor"><div class="fc-band" style="left:12%;right:12%;opacity:.18"></div></div>'+
      '<div class="mini-note">'+icon('info','xs')+'<div>'+why+cta+'</div></div></div>';
  }
  /* Der Korridor ist eine SPANNE. Die Bandbreite kommt aus Belegstufe und Alter
     der Referenz (evidence.bandFor) — ein schwacher oder alter Wert erzeugt ein
     sichtbar breiteres Band. Genau das soll man sehen. */
  var inset=Math.max(4,Math.min(34,50-(v.bandPct||5)*2.2));
  var tgtTxt='';
  if(v.target>0){
    var tw={likely:'Deine Zielzeit '+gmGoalForecastMin(v.target)+' liegt im Korridor.',
      edge:'Deine Zielzeit '+gmGoalForecastMin(v.target)+' liegt an der optimistischen Kante.',
      beyond:'Deine Zielzeit '+gmGoalForecastMin(v.target)+' liegt unter dem, was der heutige Wert trägt.'}[v.reachable];
    if(tw)tgtTxt=' '+gmEsc(tw);
  }
  var statusTxt=v.status?('<b>'+gmEsc(GM_FEAS_TEXT[v.status]||v.status)+'.</b>'):'';
  var weeksTxt=(v.weeks&&v.weeks.min!=null)
    ?(' Geschätzter Zeitraum: etwa '+gmEsc(String(v.weeks.min))+(v.weeks.max!=null?' bis '+gmEsc(String(v.weeks.max))+' Wochen':' Wochen oder deutlich mehr')+' — Spanne, keine Terminzusage.'):'';
  var basisTxt=(lvl==='p'&&v.confidence)
    ?(' Grundlage: Beleglage '+gmEsc(String(v.confidence))+', Bandbreite ±'+gmEsc(String(v.bandPct))+' %.'):'';
  return '<div class="card"><div class="fc-labels"><span>vorsichtig '+gmEsc(gmGoalForecastMin(v.cautious))+
      '</span><span>realistisch '+gmEsc(gmGoalForecastMin(v.realistic))+
      '</span><span>optimistisch '+gmEsc(gmGoalForecastMin(v.optimistic))+'</span></div>'+
    '<div class="fc-corridor"><div class="fc-band" style="left:'+inset+'%;right:'+inset+'%"></div></div>'+
    '<div class="mini-note">'+icon('info','xs')+'<div>'+statusTxt+tgtTxt+weeksTxt+basisTxt+
      ' Modellwert aus deiner gemessenen Referenz — keine Garantie.</div></div></div>';
}
/* ============================================================
   v8-316 · PLANQUALITÄT — die sechs Kacheln bekommen Werte.

   Bis hierher waren „Zielabdeckung · Erholungsverteilung · Belastungsbalance ·
   Zeitmachbarkeit · Sportbalance · Datenqualität" sechs Literale „—" mit Balken
   auf 0 %. Anders als bei Zielprognose und adaptiver Einschätzung fehlte hier
   nicht die Verdrahtung, sondern der RECHNER: es existierte ausschließlich der
   Validator engine-contracts.isPlanQuality(). js/engine/plan-quality.js ist der
   Produzent dazu (rein, versioniert, ohne DOM/Uhr).

   DIE OBERFLÄCHE SCHAUT AUF `applicable`, NICHT AUF DIE ZAHL. Der Vertrag
   verlangt für jeden Subscore eine Zahl 0–100; nicht bewertbare Bereiche
   tragen deshalb 0 und rating 'insufficient_data'. Würde die Kachel die 0
   anzeigen, stünde dort „0 % Sportbalance" für einen reinen Läufer — eine
   Abwertung für etwas, das gar nicht bewertet wurde. Deshalb: nicht anwendbar
   ⇒ „—" mit leerem Balken, wie zuvor, aber mit Grund.
   ============================================================ */
function gmPlanQualityEval(week,perfBySport){
  try{
    var PQE=(window.ORVIA&&ORVIA.planQuality)||null;
    if(!PQE||typeof PQE.evaluate!=='function')return null;
    var cfg=null;
    try{cfg=(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)?ORVIA.profileModel.effectiveTrainingConfig(typeof PROFILE!=='undefined'?PROFILE:null):null;}catch(_){ }
    var sports=[];
    try{
      var sp=(typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.sports))?PROFILE.sports:[];
      sports=sp.filter(function(s){return s&&s.activeInApp!==false;})
        .map(function(s){return typeof s==='string'?s:(s.sportId||'');}).filter(Boolean);
    }catch(_){ }
    return PQE.evaluate({
      days:week,
      /* DIESELBEN Prädikate wie im übrigen Produkt — kein zweites Hart-Kriterium. */
      isHardUnit:(typeof isHardUnit==='function')?isHardUnit:null,
      isLongUnit:function(it){try{return unitKind(it)==='long';}catch(_){return false;}},
      level:(typeof userLevel==='function')?userLevel():null,
      goal:(typeof goalOf==='function')?goalOf():null,
      config:cfg,activeSports:sports,
      performance:(perfBySport&&perfBySport.running)||null,
      planProvenance:(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weekPlan&&PROFILE.weekPlan.length===7)?'stored':'generated'
    });
  }catch(_){return null;}
}
var GM_PQ_LABELS=[['goalCoverage','Zielabdeckung'],['recoveryDistribution','Erholungsverteilung'],
  ['loadBalance','Belastungsbalance'],['timeFeasibility','Zeitmachbarkeit'],
  ['sportBalance','Sportbalance'],['dataQuality','Datenqualität']];
var GM_PQ_NA_TEXT={no_goal:'kein Ziel hinterlegt',goal_without_distance_model:'für diese Zielart noch kein Modell',
  no_availability_config:'Verfügbarkeit nicht gepflegt',single_sport:'nur eine Sportart aktiv',
  no_sessions:'keine Einheiten geplant',too_few_active_days:'zu wenige Trainingstage',
  no_sport_normalizer:'Sportart-Zuordnung nicht verfügbar',too_few_known_sports:'zu wenige bekannte Sportarten',
  no_plan:'kein Plan'};
function gmPlanQualityCells(ev){
  return GM_PQ_LABELS.map(function(p){
    var s=ev&&ev.subscores?ev.subscores[p[0]]:null;
    if(!s||s.applicable!==true){
      var why=s&&s.note?(GM_PQ_NA_TEXT[s.note]||s.note):null;
      return '<div class="pq" data-pq-key="'+p[0]+'" data-pq-applicable="0"><div class="pqt">'+p[1]+'</div>'+
        '<div class="pqv" style="color:var(--muted)">—</div><div class="pq-track"><i style="width:0%"></i></div>'+
        (why?'<div class="pq-na">'+gmEsc(why)+'</div>':'')+'</div>';
    }
    var col=s.value>=80?'var(--ready)':s.value>=60?'var(--gold-soft)':s.value>=40?'var(--attention)':'var(--crit)';
    return '<div class="pq" data-pq-key="'+p[0]+'" data-pq-applicable="1"><div class="pqt">'+p[1]+'</div>'+
      '<div class="pqv" style="color:'+col+'">'+gmEsc(String(s.value))+'</div>'+
      '<div class="pq-track"><i style="width:'+s.value+'%;background:'+col+'"></i></div></div>';
  }).join('');
}
/* v8-314 · Abschnitt „Adaptive Einschätzung" für den GM-Plan. Reine Weiterleitung
   an den bestehenden, verhaltensgetesteten Renderer — die Funktion existiert nur,
   damit der Abschnittstitel NICHT erscheint, wenn die Karte leer ist (sonst stünde
   eine Überschrift über nichts). Kein eigener Zustand, keine eigene Rechnung. */
function gmAdaptiveSection(){
  var body='';
  try{
    var AC=(window.ORVIA&&ORVIA.adaptiveCard)||null;
    if(AC&&typeof AC.render==='function'&&window.ORVIA&&ORVIA.getAdaptiveExplanation)
      body=AC.render(ORVIA.getAdaptiveExplanation())||'';
  }catch(_){body='';}
  if(!body)return '';
  return '<div class="sectlabel" data-gm-slot="plan-adaptive">Adaptive Einschätzung</div>'+
    '<div class="card">'+body+'</div>';
}
function renderGMPlan(){
  var host=document.getElementById('gmPlan');if(!host)return;
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var meta=gmPlanWeekMeta();
  /* Phase 5D: kanonischen Plan lazy laden/migrieren (Flag-gated, non-blocking). */
  try{if(typeof gmCanonPlanEnsure==='function')gmCanonPlanEnsure(function(){try{var b=document.getElementById('gmPlanConfBadge');var n=gmCanonPlanConflictCount();if(b)b.style.display=n>0?'':'none';}catch(_){ }});}catch(_){ }
  var _confN=(typeof gmCanonPlanConflictCount==='function')?gmCanonPlanConflictCount():0;
  var h='';
  /* 1. Header (+ 5E-Konflikt-Badge, Entscheidung ②: Badge statt Unterbrechung) */
  h+='<div class="hdr"><div><div class="greet">'+(meta.wk!=null?'Trainingswoche '+meta.wk:'Wochenplan')+(meta.phase?' · '+gmEsc(meta.phase)+'phase':'')+'</div><h1>Dein Plan</h1><div class="date">'+gmEsc(meta.range)+(meta.phase?' · '+gmEsc(meta.phase):'')+(lvl==='p'?' · Struktur, Varianten & Prognose':'')+'</div></div><div class="hdr-actions">'+
    '<button class="iconbtn" id="gmPlanConfBadge" style="color:var(--attention);'+(_confN>0?'':'display:none')+'" aria-label="Plan-Konflikte" onclick="gmOpenPlanConflictsSheet()">'+icon('alert','sm')+'</button>'+
    '<button class="iconbtn" aria-label="Plan-Einstellungen" onclick="gmOpenPlanSettingsSheet()">'+icon('gear','sm')+'</button></div></div>';
  /* 2–4. Planvariante A/B/C — echte, waehlbare Teilmengen des realen Plans
     (Produktentscheidung 2026-08-04; ersetzt den frueheren Schein-Zustand
     „B on + Empfohlen" ohne Funktion, KF-007). Zahlen ausschliesslich aus dem
     tatsaechlich geplanten Wochenplan; keine Zeit-/Belastungsprognose. */
  var pvm=null;try{pvm=gmPlanVariantModel();}catch(_){ }
  var pSel=pvm?pvm.sel:'A';
  var pMeta=GM_PLAN_VARIANTS[pSel]||GM_PLAN_VARIANTS.A;
  h+='<div class="sectlabel" data-gm-slot="plan-variant">Planvariante <span class="edit" onclick="gmOpenVariantSheet()">'+gmEsc(pMeta.name)+' · Details</span></div>';
  h+='<div class="pvar-row">'+['A','B','C'].map(function(v){
    var d=pvm&&pvm.variants[v];var n=(d&&d.count!=null)?d.count:null;
    return '<button class="pvar '+(pSel===v?'on':'')+'" onclick="gmSetPlanVariant(\''+v+'\')" aria-pressed="'+(pSel===v)+'"><b>'+v+'</b><span>'+gmEsc(GM_PLAN_VARIANTS[v].name)+(n!=null?' · '+n:'')+'</span></button>';}).join('')+'</div>';
  var pd=pvm?pvm.variants[pSel]:null;
  var pCell=function(v,l){return '<div class="wp"><b>'+(v!=null?gmEsc(String(v)):'—')+'</b><span>'+l+'</span></div>';};
  h+='<div class="card"><div class="ctitle"><div class="l">Variante '+pSel+' · '+gmEsc(pMeta.name)+'</div><span class="more" onclick="gmOpenVariantSheet()">Wechseln '+icon('chev','xs')+'</span></div>'+
    '<p class="prescription" style="margin-bottom:10px">'+gmEsc(pMeta.desc)+'</p>'+
    '<div class="week-progress">'+pCell(pd?pd.count:null,'EINHEITEN')+pCell(pd?pd.days:null,'TRAININGSTAGE')+pCell(pd?pd.core:null,'KERNREIZE')+pCell(pd?pd.rest:null,'RUHETAGE')+'</div>'+
    '<div class="mini-note" style="margin:10px 0 0">'+icon('info','xs')+'<div><b>Auswirkung:</b> '+((pd&&pd.count!=null&&pvm)?(pSel==='A'?'Alle '+pvm.total+' geplanten Einheiten aktiv.':pd.count+' von '+pvm.total+' Einheiten aktiv · '+(pd.core||0)+' Kernreize bleiben. Entfallende sind unten markiert, dein gespeicherter Plan bleibt unverändert.'):GM_NA+' — ohne Variantenmodell keine Aussage.')+((pvm&&pvm.note)?' '+gmEsc(pvm.note):'')+'</div></div></div>';
  /* 5–6. Woche (kanonische Wochenliste, E4-Datenpfad in GM-session-cards) */
  /* Kopfzeile der Wochenliste mit Blaetterung. Der Zeitraum wird ausgeschrieben,
     damit beim Blaettern nie unklar ist, welche Woche man sieht.
     v8-310a (Gians Befund): _wOff wurde hier benutzt, aber erst SPAETER
     deklariert — Hoisting machte es undefined, die Kopfzeile zeigte
     „undefined Wochen voraus" und „NaN.NaN." OHNE Exception (setDate(NaN)
     wirft nicht). Der Versatz wird jetzt VOR der ersten Verwendung geholt
     und die Kopfzeile kommt aus der puren, testbaren Funktion
     gmPlanWeekHeader(). */
  var _wOff=(typeof gmPlanWeekOff==='function')?gmPlanWeekOff():0;
  var _wLbl='Diese Woche',_wRange='';
  try{var _wh=gmPlanWeekHeader(_wOff);_wLbl=_wh.label;_wRange=_wh.range;}catch(_){ }
  h+='<div class="sectlabel" data-gm-slot="plan-week">'+gmEsc(_wLbl)+
     '<span class="edit">'+
       '<button class="iconbtn" aria-label="Woche zurück" onclick="gmShiftPlanWeek(-1)">'+icon('chev','xs')+'</button>'+
       '<span style="margin:0 8px;font-variant-numeric:tabular-nums">'+gmEsc(_wRange)+'</span>'+
       '<button class="iconbtn" aria-label="Woche vor" onclick="gmShiftPlanWeek(1)">'+icon('chev','xs')+'</button>'+
       (_wOff!==0?'<button class="iconbtn" aria-label="Zur aktuellen Woche" onclick="gmPlanWeekToday()" style="margin-left:6px">Heute</button>':'')+
     '</span></div>';
  /* v8-315: Der Wocheninhalt kommt jetzt aus dem wochenadressierten Lesepfad.
     Die Kopfnotiz benennt die HERKUNFT statt pauschal „Vorschau" zu behaupten —
     liegt fuer die Zielwoche ein eigener Plan vor, ist es kein Vorschautext
     mehr, und das muss man sehen koennen. */
  var _wSel=gmPlanForOffset(_wOff);
  var week=(_wSel&&_wSel.days)||[[],[],[],[],[],[],[]];
  if(_wOff!==0){
    var _provNote=(_wOff<0)
      ?'Vergangene Woche — die Einheiten zeigen, wie sie tatsächlich absolviert wurden.'
      :(GM_PROV_NOTE[_wSel&&_wSel.provenance]||'Kommende Woche — für diese Woche ist ein eigener Plan hinterlegt.');
    h+='<div class="mini-note" style="margin:0 0 8px" data-gm-prov="'+gmEsc((_wSel&&_wSel.provenance)||'')+'">'+icon('info','xs')+'<div>'+gmEsc(_provNote)+'</div></div>';
  }
  /* WOCHENNAVIGATION (2026-08-07, Nutzerwunsch): Die Planseite zeigte immer nur
     die laufende Woche. Zurueckblaettern gab es nur in der verborgenen Legacy-Box
     (shiftPlanWeek → renderWeekPlan) — an der sichtbaren Seite also gar nicht.
     `gmPlanWeekOff` ist der Versatz in Wochen: 0 = diese Woche, -1 = vorige.
     Der Versatz wirkt NUR auf die Anzeige; der gespeicherte Wochenplan ist eine
     wiederkehrende Struktur und wird dadurch nie veraendert.
     v8-310a: _wOff ist bereits VOR der Kopfzeile deklariert (Hoisting-Fix) —
     hier keine zweite Deklaration mehr. */
  var byOcc={};try{var dates=[];var now=new Date();var wd0=(now.getDay()+6)%7;var mon=new Date(now);mon.setDate(now.getDate()-wd0+_wOff*7);
    for(var i=0;i<7;i++){var dd=new Date(mon);dd.setDate(mon.getDate()+i);dates.push(todayStr(dd));}
    if(typeof planActualResolveForDates==='function'&&typeof Calc!=='undefined'&&Calc.resolvePlanActual){byOcc=(planActualResolveForDates(dates)||{}).byOcc||{};}
    var dayKeys=dates;
  }catch(_){var dayKeys=[];}
  /* Leistungszonen aus dem KOMPLETTEN Profil (2026-08-06). Einmal je Render
     aufgeloest und an alle Karten weitergereicht — nicht je Karte neu gerechnet.
     Fehlt fuer eine Sportart die Referenz, bleibt es dort bei „—" MIT Grund,
     waehrend die anderen Sportarten echte Vorgaben zeigen. */
  var _perf=null;
  try{
    if(window.ORVIA&&ORVIA.performanceResolver){
      var _acts=[];try{if(ORVIA.activityStore&&ORVIA.activityStore.listActivities)_acts=ORVIA.activityStore.listActivities();}catch(_a){}
      _perf=ORVIA.performanceResolver.resolveAll(typeof PROFILE!=='undefined'?PROFILE:null,
        {today:todayStr(),activities:_acts});
    }
  }catch(_){ }
  var _perfBySport=(_perf&&_perf.sports)||null;
  /* C3: Das Debrief muss gegen GENAU die Zonen urteilen, die die Karte gezeigt
     hat. Deshalb wird die Aufloesung dieses Renders gemerkt, statt sie beim
     Oeffnen der Rueckmeldung erneut zu rechnen — das waere nicht nur teurer,
     sondern koennte auch abweichen (zwischenzeitlich erfasster Wert). */
  try{if(window.ORVIA)ORVIA._lastPlanPerf=_perf;}catch(_){ }
  /* A-08 (2026-08-20): Machbarkeit BEOBACHTEN, nicht steuern. Der Adapter liest
     das Hauptziel (mainGoalOf) und das eben aufgeloeste Leistungsbild, ruft den
     Bewerter und legt das Urteil unter ORVIA._lastFeasibility ab. Kein Blocker,
     kein Einfluss auf den Plan — ein zweiter, stiller Kanal fuer B-01/B-02. */
  try{
    if(window.ORVIA&&ORVIA.goalFeasibilityAdapter&&typeof mainGoalOf==='function'){
      var _feasG=mainGoalOf();
      ORVIA._lastFeasibility=ORVIA.goalFeasibilityAdapter.observe({
        goal:_feasG, resolvedPerformance:_perf, today:(typeof todayStr==='function'?todayStr():null),
        level:(typeof userLevel==='function'?userLevel():null)
      });
    }
  }catch(_fe){ }
  /* v8-310a: Tageszustands-Konfiguration EINMAL je Render aufloesen. */
  var _dayCfg=null;
  try{_dayCfg=(window.ORVIA&&ORVIA.profileModel&&ORVIA.profileModel.effectiveTrainingConfig)?ORVIA.profileModel.effectiveTrainingConfig(typeof PROFILE!=='undefined'?PROFILE:null):null;}catch(_){ }
  var cards='';
  for(var di=0;di<7;di++){
    var items=week[di]||[];var k=(typeof dayKeys!=='undefined'&&dayKeys[di])||'';
    /* Bugfix (2026-08-05, Nutzer-Feedback): zeigte bisher NUR "Tag.Monat" (z. B. "3.8"),
       obwohl DAYNAMES an 5 anderen Stellen in dieser Datei fuer genau diesen Zweck
       existiert — der Nutzer las eine Zahlenfolge statt Wochentagen. Wochentag zuerst
       (der eigentliche Bezugspunkt beim Planblick), Datum bleibt als Kontext dahinter. */
    var dLbl=DAYNAMES[di]||'';try{var dd2=new Date(k+'T12:00');dLbl=(DAYNAMES[di]||'')+' · '+dd2.getDate()+'.'+(dd2.getMonth()+1);}catch(_){ }
    if(!items.length){
      /* v8-310a (Gians Entscheidung): leer ≠ Ruhetag. Drei ehrliche Zustaende
         aus der Verfuegbarkeit — der Nutzer sah ZWEI „Ruhetage", hatte aber
         nur einen eingestellt; der zweite war schlicht unbelegt. */
      var _ds=(typeof gmDayStateFor==='function')?gmDayStateFor(di,_dayCfg):'rest';
      var _dsL=_ds==='rest'?['moon','Ruhetag','—']
        :_ds==='unavailable'?['info','Nicht verfügbar','laut Verfügbarkeit gesperrt']
        :['info','Frei','verfügbar — keine Einheit geplant'];
      cards+='<div class="session-card rest"><span class="session-ico">'+icon(_dsL[0])+'</span><span class="session-main"><b>'+gmEsc(dLbl)+' · '+_dsL[1]+'</b><p>'+_dsL[2]+'</p></span><span class="session-state">—</span></div>';
      continue;
    }
    for(var ii=0;ii<items.length;ii++){var it=items[ii];
      var occ=(it&&it.id)?('po:'+k+':'+it.id):null;
      var _res=(occ&&byOcc[occ])||null;
      var done=!!(_res&&_res.state==='completed');
      var ic2=it.t==='Gym'?'dumbbell':it.t==='Rad'?'activity':it.t==='Schwimmen'?'activity':'run';
      /* GM7: Sportart + Umfang (it.d, vorhandenes Feld) + Prioritaet (unitPriority, vorhandene Quelle) */
      /* GM7.2: rohe Lauf-Codes (lr/iv/ez/tempo/recovery) sind Engine-Kürzel, kein Umfang —
         nicht als Untertitel zeigen. Echter Umfang (14 km) käme aus dem session.*-Vertrag (blockiert). */
      var _dOk=it.d&&!/^(lr|iv|ez|tempo|recovery|long|easy)$/i.test(String(it.d).trim());
      var subP=gmEsc(it.t)+(_dOk?' · '+gmEsc(it.d):'');
      /* Konkrete Vorgabe statt Engine-Kuerzel: „5:53–6:25/km" bzw. „140–188 W".
         Traegt die Konfidenz mit — eine abgeleitete Zahl darf nicht aussehen wie
         eine gemessene. Ohne Referenz erscheint nichts (kein erfundener Bereich). */
      try{
        if(_perfBySport&&window.ORVIA&&ORVIA.performanceZones&&ORVIA.performanceZones.targetForUnit){
          var _tg=ORVIA.performanceZones.targetForUnit(it,_perfBySport);
          if(_tg&&_tg.ok&&_tg.text){
            /* 0b: eine Skala fuer die ganze Engine. ORVIA.evidence.marker() ist die
                 einzige Stelle, die Belegstufe in ein Zeichen uebersetzt — vorher stand
                 die Zuordnung hier und haette bei jeder Aenderung nachgezogen werden muessen. */
              var _cf=(window.ORVIA&&ORVIA.evidence)?(ORVIA.evidence.marker(_tg.confidence)?' '+ORVIA.evidence.marker(_tg.confidence):'')
                :(_tg.confidence==='strong'?'':_tg.confidence==='moderate'?' ≈':' ~');
            subP+=' · <b style="color:var(--txt)">'+gmEsc(_tg.text)+'</b>'+_cf;
          }
        }
      }catch(_){ }
      /* GM7.5g (Audit-Revert): Kern/Flexibel-Badges kamen aus derselben unitPriority-
         Label-Heuristik — keine Engine-Klassifikation, daher entfernt (kein erfundener
         Prioritaetsstatus; Erledigt/— kommt weiterhin aus dem echten Resolver). */
      var prioBadge='';
      /* Planvariante: in der gewaehlten Variante entfallende Einheiten bleiben
         SICHTBAR (Struktur schrumpft nie, Plan unveraendert), werden aber ehrlich
         als „Entfaellt" markiert. Erledigte Einheiten gewinnen immer. */
      var pKeep=true;try{if(pvm)pKeep=pvm.keep(di,ii)!==false;}catch(_){ }
      var pSkip=!pKeep&&!done;
      cards+='<div class="session-card'+(done?' done':'')+(pSkip?' pvar-skip':'')+'" data-sid="'+gmEsc(it.id||'')+'" role="button" tabindex="0" onclick="planEntryClick('+di+','+ii+',\''+gmEsc(k)+'\')" onkeydown="if(event.key===\'Enter\')planEntryClick('+di+','+ii+',\''+gmEsc(k)+'\')">'+
        '<span class="session-ico">'+icon(ic2)+'</span><span class="session-main"><b>'+gmEsc(dLbl)+' · '+gmEsc(it.l)+prioBadge+'</b><p>'+subP+'</p>'+
        /* v8-323 (K2): die geplanten Kraftuebungen stehen jetzt AUF der Karte.
           Ohne Vorgaben liefert der Helfer '' — Altbestand sieht unveraendert
           aus, kein leerer Kasten. */
        gmPlannedLinesHTML(it)+gmRxLinesHTML(it)+'</span>'+
        '<span class="session-state'+(done?' done':'')+'">'+(done?'Erledigt':(pSkip?'Entfällt ('+pSel+')':'—'))+'</span></div>';
      /* IST-Werte einer absolvierten Einheit — der eigentliche Zweck des
         Zurueckblaetterns. Quelle ist ausschliesslich der Resolver (`actual`);
         fehlt dort ein Wert, wird er weggelassen statt geschaetzt. */
      try{
        if(_res&&_res.actual){
          var _a=_res.actual,_bits=[];
          if(_a.distanceKm!=null)_bits.push(fmtDe(Math.round(_a.distanceKm*10)/10)+' km');
          if(_a.durationMin!=null)_bits.push(Math.round(_a.durationMin)+' min');
          if(_a.distanceKm>0&&_a.durationMin>0){
            var _pc=Math.round(_a.durationMin*60/_a.distanceKm);
            _bits.push(Math.floor(_pc/60)+':'+String(_pc%60).padStart(2,'0')+'/km');
          }
          if(_bits.length){
            /* C3: Rueckmeldung zur absolvierten Einheit. Der Zustand wird
               ANGEZEIGT (erfasst / offen), damit sichtbar ist, wo die Engine
               noch keine Grundwahrheit hat — eine unbeantwortete Einheit ist
               kein stiller Datenpunkt, sondern eine offene Frage. */
            var _dbKey=gmDbKey(k,it),_dbRec=null;
            try{_dbRec=gmDbFind(_dbKey);}catch(_e3){ }
            var _dbTxt=_dbRec&&_dbRec.rpe!=null
              ?'RPE '+_dbRec.rpe+(_dbRec.pain?' · Schmerz gemeldet':'')+(_dbRec.deltaRpe!=null?' (erwartet '+_dbRec.expectedRpe+')':'')
              :'Rückmeldung offen';
            cards+='<div class="mini-note" style="margin:-4px 0 8px 44px">'+icon('check','xs')+
              '<div><b>Absolviert:</b> '+gmEsc(_bits.join(' · '))+
              (_res.confidence&&_res.confidence!=='high'?' <span style="color:var(--muted)">(Zuordnung '+gmEsc(_res.confidence)+')</span>':'')+
              '<br><span class="edit" role="button" tabindex="0" onclick="gmOpenDebriefAt('+di+','+ii+',\''+gmEsc(k)+'\')">'+gmEsc(_dbTxt)+'</span>'+
              '</div></div>';
          }
        }
      }catch(_){ }
    }
  }
  h+='<div class="plan-list">'+cards+'</div>';
  /* 7–8. Planqualität (E3-Quelle read-only; 6 strukturelle Zellen mit —) */
  var pq=null;try{pq=planQualityChecks();}catch(_){ }
  var _pqEval=gmPlanQualityEval(week,_perfBySport);
  var pqCells=gmPlanQualityCells(_pqEval);
  var pqNote;
  if(!pq){pqNote=GM_NA+'.';}
  else if(gmLevel()==='a'){pqNote='<b>Planqualität: '+gmEsc(pq.rating.l)+'.</b> '+(pq.warns.length?pq.warns.length+' Hinweis'+(pq.warns.length>1?'e':'')+' im Sheet.':'Keine Auffälligkeiten.');}
  else{pqNote='<b>Planqualität: '+gmEsc(pq.rating.l)+'.</b> '+(pq.warns.length?gmEsc(pq.warns[0][0])+(pq.warns.length>1?' (+'+(pq.warns.length-1)+' weitere)':'')+' — Details im Planqualitäts-Sheet.':'Keine Auffälligkeiten in den Planprüfungen.')+(gmLevel()==='p'?' Subscores erscheinen mit der externen Engine.':'');}
  h+='<div class="sectlabel" data-gm-slot="plan-quality">Planqualität <span class="edit" onclick="openPlanQualitySheet()">Details</span></div>';
  h+='<div class="card" role="button" tabindex="0" onclick="openPlanQualitySheet()" onkeydown="if(event.key===\'Enter\')openPlanQualitySheet()"><div class="pq-grid">'+pqCells+'</div>'+
    '<div class="mini-note" style="margin-top:10px">'+icon('info','xs')+'<div>'+pqNote+'</div></div></div>';
  if(lvl!=='a'){
    /* 9a. Zielprognose (Struktur; kein kanonischer Prognosevertrag) */
    /* GM7.5g: echtes Ziel im Label (GM zeigt „Zielprognose · Halbmarathon 1:50") — Identitaet
       aus dem kanonischen Ziel-SSOT (goalOf/raceLabel/goalTargetMinOrNull); die Prognose-
       WERTE selbst bleiben ehrlich — (kein Prognosevertrag). */
    var _gLbl='';try{var _g=goalOf();var _rl=(typeof raceLabel==='function')?raceLabel(_g&&_g.type):null;var _tm=(typeof goalTargetMinOrNull==='function')?goalTargetMinOrNull():null;
      if(_rl)_gLbl=' · '+_rl+(_tm!=null?' '+Math.floor(_tm/60)+':'+String(_tm%60).padStart(2,'0'):'');}catch(_){ }
    h+='<div class="sectlabel" data-gm-slot="plan-goal-forecast">Zielprognose'+gmEsc(_gLbl)+'</div>';
    h+=gmGoalForecastCard(lvl,_perfBySport);
    /* v8-314: ADAPTIVE EINSCHAETZUNG im SICHTBAREN Plan-Tab.
       Der Renderer (js/adaptive-card.js) existiert seit v8-283, ist String->String
       und als Verhalten getestet — er schrieb aber ausschliesslich in
       #adaptiveCard, ein direktes Kind von #tab-plan, das styles.css:3130
       ausblendet, angestossen aus renderWeekPlan() (nur vom ueberschriebenen
       renderPlan() gerufen). Die vollstaendige Ausgabe des Schattenbetriebs —
       Anpassungsrichtung, Delta, Zielload, Sperrgruende, Begruendung — war damit
       fuer den Nutzer nie sichtbar. Hier wird DERSELBE Renderer mit DEMSELBEN
       View-Vertrag benutzt: keine zweite Darstellung, keine eigene Rechnung.
       FAIL-SOFT bleibt: ohne Beobachtung liefert render() den leeren String,
       dann entfaellt der Abschnitt ersatzlos (keine halb gefuellte Karte). */
    h+=gmAdaptiveSection();
    /* 9b. Phasen (Calc.racePhases read-only) */
    var phases=[];try{phases=Calc.racePhases(RACE.date,todayStr())||[];}catch(_){ }
    var t0=todayStr();
    /* Redesign (2026-08-05, Nutzerentscheidung): Die frueheren 5 gleich breiten Text-Chips
       waren strukturell zu eng — jeder Phasenname musste in ~60 px passen, deshalb erst
       Ueberlappung (vor v8-241), dann Ellipsis (v8-241), dann Zeilenumbruch (v8-245) und in
       KEINER Variante lesbar. Neue Struktur nach Nutzervorgabe: schmale Fortschritts-
       segmente OHNE Text (dort kann per Konstruktion nichts abgeschnitten werden), darunter
       die aktuelle Phase gross und fett mit ihrer Wochenangabe, darunter alle Phasen als
       Liste in voller Breite. Gleiche Datenquelle (Calc.racePhases), nur andere Darstellung. */
    var _dts=daysToSafe();var _dtsOk=(_dts!=null&&isFinite(_dts));
    var _gShort='—';try{var _g2=goalOf();var _rl2=(typeof raceLabel==='function')?raceLabel(_g2&&_g2.type):null;if(_rl2)_gShort=_rl2==='Halbmarathon'?'HM':_rl2;}catch(_){ }
    var _wkLbl=function(p){return (window.ORVIA&&ORVIA.fmt&&ORVIA.fmt.phaseWeeksLabel)?ORVIA.fmt.phaseWeeksLabel(p):'—';};
    h+='<div class="sectlabel" data-gm-slot="plan-phases">Phasen bis zum Ziel <span class="edit">'+(_dtsOk?'noch '+Math.max(0,Math.ceil(_dts/7))+' Wochen':'—')+'</span></div>';
    if(!phases.length){
      h+='<div class="card"><div class="ph-now"><b>—</b><span>'+GM_NA+' — ohne Zieldatum gibt es kein Phasenmodell.</span></div>'+
        '<div class="mini-note" style="margin-top:10px">'+icon('info','xs')+'<div>Sobald ein Wettkampfdatum im Ziel hinterlegt ist, erscheinen die Phasen bis dorthin.</div></div></div>';
    }else{
      /* Segmentleiste: reine Fortschrittsanzeige, kein Text ⇒ kein Abschneiden moeglich. */
      var segs=phases.map(function(p){var cls=p.on?'now':((p.to&&p.to<t0)?'done':'todo');
        return '<i class="ph-seg '+cls+'" aria-hidden="true"></i>';}).join('');
      segs+='<i class="ph-seg '+((_dtsOk&&_dts<0)?'done':'todo')+' ph-goal" aria-hidden="true"></i>';
      /* Aktuelle Phase gross — der eigentliche Bezugspunkt beim Planblick. */
      var _cur=null;for(var pi=0;pi<phases.length;pi++)if(phases[pi].on){_cur=phases[pi];break;}
      var _curTxt=_cur?(_wkLbl(_cur)+(_cur.d?' · '+_cur.d:'')):(_dtsOk&&_dts<0?'Wettkampf liegt hinter dir':GM_NA);
      h+='<div class="card">'+
        '<div class="ph-bar" role="img" aria-label="Phasenfortschritt">'+segs+'</div>'+
        '<div class="ph-now"><b>'+gmEsc(_cur?_cur.n:'—')+'</b><span>'+gmEsc(_curTxt)+'</span></div>'+
        /* Vollbreiten-Liste: jede Phase hat eine eigene Zeile, nichts wird gequetscht. */
        '<div class="ph-list">'+phases.map(function(p){
          var st=p.on?'now':((p.to&&p.to<t0)?'done':'todo');
          var mark=st==='done'?'✓':(st==='now'?'●':'');
          return '<div class="ph-row '+st+'"><span class="ph-mk">'+mark+'</span><span class="ph-n">'+gmEsc(p.n)+'</span><span class="ph-w">'+gmEsc(_wkLbl(p))+'</span></div>';
        }).join('')+
        '<div class="ph-row '+((_dtsOk&&_dts<0)?'done':'todo')+'"><span class="ph-mk">'+((_dtsOk&&_dts<0)?'✓':'')+'</span><span class="ph-n">Ziel · '+gmEsc(_gShort)+'</span><span class="ph-w">'+(_dtsOk?(_dts<0?'vorbei':'in '+Math.max(0,Math.ceil(_dts/7))+' Wo'):'—')+'</span></div>'+
        '</div>'+
        '<div class="mini-note" style="margin-top:10px">'+icon('info','xs')+'<div>Phasen aus dem kanonischen Phasenmodell — aktuelle Phase aus dem kanonischen Phasenfeld, ohne eigene Periodisierung. Austrittskriterien folgen mit der Engine.</div></div></div>';
    }
    /* 9c. Wochenkilometer (E2-Quellen; 6 Spalten) */
    var dRace=daysToSafe();
    var cols=[['−2',2],['−1',1],['akt.',0],['+1',-1],['+2',-2],['+3',-3]];
    var vals=cols.map(function(c){
      var act=null,plan=null;
      if(c[1]>=0){try{act=weekRunKm(c[1]);}catch(_){ }}
      if(c[1]===0){try{var cal=Calc.weekKmTarget(dRace,0);if(cal>0){var l3=[weekRunKm(1),weekRunKm(2),weekRunKm(3)];if(l3.every(function(v){return v!=null;}))plan=Calc.effectiveKmTarget(cal,l3);else plan=cal;}}catch(_){ }}
      if(c[1]<0){try{var p2=Calc.weekKmTarget(dRace,-c[1]);if(p2>0)plan=p2;}catch(_){ }}
      return {lbl:c[0],act:act,plan:plan};
    });
    var mx=1;vals.forEach(function(v){if(v.plan!=null&&v.plan>mx)mx=v.plan;if(v.act!=null&&v.act>mx)mx=v.act;});
    var volCols=vals.map(function(v){
      return '<div class="vol-col"><div class="vol-bars">'+
        '<i class="vol-plan" style="height:'+(v.plan!=null?Math.round(v.plan/mx*100):0)+'%"></i>'+
        '<i class="vol-act" style="height:'+(v.act!=null?Math.round(v.act/mx*100):0)+'%"></i></div>'+
        '<b>'+(v.act!=null?gmEsc(fmtDe(v.act)):(v.plan!=null?gmEsc(fmtDe(v.plan)):'—'))+'</b><small>'+v.lbl+(v.act!=null&&v.plan!=null?' · Ziel '+gmEsc(fmtDe(v.plan)):'')+'</small></div>';}).join('');
    h+='<div class="sectlabel" data-gm-slot="plan-week-km">Wochenkilometer (Lauf) <span class="edit">Zielkorridor</span></div>';
    h+='<div class="card"><div class="vol-row">'+volCols+'</div>'+
      '<div class="dist-leg" style="margin-top:6px"><span><i style="background:rgba(255,255,255,.4)"></i>Geplant (Ziel)</span><span><i style="background:var(--ready)"></i>Absolviert (Ist)</span></div>'+
      '<div class="mini-note" style="margin-top:8px">'+icon('info','xs')+'<div>Ist aus der kanonischen Wochenaggregation, Ziel aus dem bestehenden Zielmodell. Ein Balken erscheint nur bei belastbarem Wert — keine neue Aggregation, keine Schätzwerte im UI.</div></div></div>';
  }
  /* 10–12. Tagesziele + Abschluss */
  h+='<div class="sectlabel" data-gm-slot="plan-daily-goals">Tagesziele <span class="edit" onclick="gmOpenDailyGoalsSheet()">'+icon('pen','xs')+' Bearbeiten</span></div>';
  h+=gmDailyGoalsBlock();
  h+='<div class="tabspacer"></div>';
  host.innerHTML=h;
}
function daysToSafe(){try{return daysTo(RACE.date);}catch(_){return null;}}
function gmOpenDailyGoalsSheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('target')+'</div><div><h3>Tagesziele</h3><div class="sh-sub" style="margin:2px 0 0">'+GM_NA+'</div></div></div>'+
    '<div class="sh-block"><p>Tagesziele (Schritte, Kalorien, Wasser, Schlaf) sind strukturell vorbereitet. Es existiert noch keine produktive Ziel- und Istwert-Quelle — hier wird nichts simuliert.</p></div>';
  gmOpenSheet('detailSheet');
}
/* Session-Vollseite (GM sessionView-Struktur) — ersetzt das openUnit-Sheet sichtbar,
   bestehende Aktionen (Training starten / erledigt / Editor) bleiben produktiv. */
function gmOpenSessionPage(di,ii,dateIso){
  var pg=document.getElementById('gmPage');if(!pg)return;
  var row=[];try{row=activeWeekPlan()[di]||[];}catch(_){ }
  var it=row[ii];if(!it)return;
  var note=null;try{note=(typeof planNoteFor==='function')?planNoteFor(it):null;}catch(_){ }
  if(note===it.l)note=null;
  /* v8-310a (Gians P0): DIESE Seite ist die produktive Einheiten-Ansicht
     (openUnit ist unten auf sie umgelenkt) — und sie entschied per
     WOCHENTAGSINDEX ueber „Training starten". In einer geblaetterten Woche
     war derselbe Wochentag wie heute damit faelschlich startbar. Das Datum
     kommt jetzt vom Klick; gestartet wird NUR am Tag selbst, sonst steht
     hier der ehrliche Nur-lesbar-Hinweis. */
  /* v8-310a-Haertung: ohne Datumskontext ist auch die Vollseite NUR lesbar. */
  var dIso=dateIso||null;
  var isToday=(dIso===todayStr());
  var _occ2=(dIso&&it.id&&typeof plannedOccurrenceIdForDate==='function')?plannedOccurrenceIdForDate(it,dIso):null;
  var _pd2=(typeof planDoneMarkerFor==='function')?planDoneMarkerFor(it.t,dIso,_occ2):null;
  var cta=isToday
    ?'<button class="cta prim" style="margin:0 18px;width:calc(100% - 36px)" onclick="gmCloseSessionPage();startPlannedUnit('+di+','+ii+',\''+dIso+'\')">'+icon('play','sm')+' Training starten</button>'
    :'<div class="mini-note" style="margin:0 18px">'+icon('info','xs')+'<div>Nur lesbar — Starten ist nur am Tag der Einheit möglich.</div></div>'+
     '<button class="cta wide-ghost" style="margin:10px 18px 0;width:calc(100% - 36px)" onclick="gmCloseSessionPage();openPlanEditor()">Plan bearbeiten / verschieben</button>';
  var _dLbl2='';try{var _d4=new Date(dIso+'T12:00');_dLbl2=' · '+_d4.getDate()+'.'+(_d4.getMonth()+1);}catch(_){ }
  var _undoPd=_pd2?'<button class="cta wide-ghost" style="margin:10px 18px 0;width:calc(100% - 36px)" onclick="confirmUndoPlanDone(\''+gmEsc(it.t)+'\',\''+gmEsc(dIso)+'\',\''+gmEsc(_occ2)+'\')">Erledigt-Markierung zurücknehmen</button>':'';
  pg.innerHTML='<div class="page-head"><div class="page-head-row"><button class="backbtn" onclick="gmCloseSessionPage()" aria-label="Zurück">'+icon('chev')+'</button><div><h2>'+gmEsc(DAYNAMES[di])+_dLbl2+' · '+gmEsc(it.l)+'</h2><p>Planvorgabe</p></div></div></div>'+   /* siehe GM7.9h-Notiz unter dieser Funktion */
    '<div class="plan-hero"><div class="plan-kicker">'+gmEsc(it.t)+'</div><h2>'+gmEsc(it.l)+'</h2><p>Geplante Einheit aus deinem Wochenplan; Ziel- und Intensitätsbereiche folgen mit der externen Trainingsengine.</p>'+
    '<div class="week-progress"><div class="wp"><b>'+(it.d&&!/^(iv|ez|lr|tempo)$/.test(it.d)?gmEsc(it.d):'—')+'</b><span>UMFANG</span></div><div class="wp"><b>—</b><span>INTENSITÄT</span></div><div class="wp"><b>—</b><span>ZIEL</span></div><div class="wp"><b>—</b><span>KONFIDENZ</span></div></div></div>'+
    '<div class="coach-card"><h3>'+icon('sparkle','sm')+' Warum diese Einheit?</h3><p>'+(note?gmEsc(note):'Eine kanonische Begründung ist noch nicht verfügbar — ORVIA erfindet hier keine Erklärung. Die Einheit stammt unverändert aus deinem Wochenplan; Anpassungen nimmst du über den Plan-Editor vor, nicht hier.')+'</p></div>'+
    cta+_undoPd+'<div class="tabspacer"></div>';
  pg.classList.add('on');
  try{pg.scrollTop=0;}catch(_){ }
}
/* GM7.9h — zwei bewusste Abweichungen dieser Seite vom Golden Master, geprueft 2026-08-02:
   1) KPI-Beschriftung: der GM nennt die dritte Zelle „ZIEL" mit dem Demowert „RPE 5". Die
      Beschriftung ist Struktur und wurde daher uebernommen; der Wert bleibt ehrlich „—",
      weil es fuer den RPE-Zielwert keinen kanonischen Produzenten gibt. unitStruct() haelt
      zwar eine kind→RPE-Tabelle (easy = RPE 3–4 …), die ist aber eine UI-seitige
      Vorgabetabelle und KEINE Ausgabe der Trainingsengine — sie wird im produktiven Pfad
      auch nirgends angezeigt (planNoteFor nutzt nur warmup/main/cooldown/goal). Sie hier
      einzublenden wuerde genau das erfinden, was der Absatz darueber als „folgt mit der
      externen Trainingsengine" ausweist.
   2) Untertitel: der GM schreibt „Planvorgabe und tatsaechliche Einheit", weil seine
      Session-Seite fuer bereits absolvierte Tage zusaetzlich „Abgeschlossene Aktivitaet
      oeffnen" anbietet. ORVIA loest denselben Fall FRUEHER auf: planEntryClick() erkennt
      ueber resolvePlannedActivity() den eindeutigen Plan-Ist-Link und oeffnet direkt das
      Aktivitaetsdetail — diese Seite zeigt daher ausschliesslich die Planvorgabe. Der
      GM-Untertitel waere hier ein Versprechen, das die Seite nicht einloest; „Planvorgabe"
      ist der praezisere Text und bleibt bewusst stehen. */
function gmCloseSessionPage(){var pg=document.getElementById('gmPage');if(pg)pg.classList.remove('on');}
/* Bestehende Session-Aktion bleibt der Einstieg: openUnit zeigt jetzt die GM-Vollseite. */
/* v8-310a: Die GM-Vollseite ERSETZT das aeltere openUnit-Sheet (spaetere
   Deklaration gewinnt). Der Datumskontext des Klicks geht 1:1 mit durch. */
function openUnit(di,ii,dateIso){gmOpenSessionPage(di,ii,dateIso);}
/* Aktiver GM2-Pfad: renderPlan rendert NUR den GM-Aufbau — die unsichtbaren Legacy-
   Renderer (E1–E4 u. a.) werden übersprungen (kein doppelter Engine-/Helper-Aufruf,
   keine Nebenwirkungen unsichtbarer Ausgaben). Quellcode der Blöcke bleibt unverändert;
   endgültiger Abbau ist GM7. */
function renderPlan(){
  if(document.getElementById('gmPlan')){renderGMPlan();return;}
}
/* ====== GM2-ENDE ====== */
/* ====== GM3: Aktivitäten-Hub, Aktivitätsdetail & Start-Einstieg (finale aktive activityView
   des Golden Masters). Struktur exakt: hdr → hub-actions(5) → subtabs → kpi-row →
   Sportverteilung (nur F/P) → hub-actions(2 Teaser) → filter-row(5) → activity-list →
   tabspacer. Datenregeln: Activity Store/Import/Dedupe/Matching read-only; Werte NUR aus
   kanonischen Aggregatoren (weeklyActivityTotals/weekRunKm, listActivitiesUnified,
   activityDetailViewModel); keine UI-Ersatzaggregation, Missingness bleibt — und wird nie 0.
   Fehlende Handler ⇒ sichtbar deaktivierte Slots mit ehrlichem NA. ====== */
var gmActScope='week';
var gmActFilter='Alle';
var GM_ACT_SPORT={running:'Laufen',gym:'Kraft',cycling:'Radfahren',swimming:'Schwimmen'};
var GM_ACT_FILTER={Laufen:'running',Kraft:'gym',Radfahren:'cycling',Schwimmen:'swimming'};
function gmActSrcLabel(src){
  /* GM7.7: Provider-Quellen ergaenzt — echte Garmin-/Strava-Importe zeigten bisher „—",
     weil nur die generischen Schluessel gemappt waren. */
  return {import:'Import',manual:'Manuell erfasst',orvia_workout:'ORVIA Workout',live:'Live-Workout',legacy_local:'Lokal erfasst',
    garmin:'Garmin',garmin_unofficial:'Garmin',garmin_official:'Garmin',strava:'Strava',apple_health:'Apple Health',health_connect:'Health Connect'}[src]||(src?String(src):'—');
}
/* GM-SVG-Visualisierung: rein darstellerische Wahl anhand des kanonischen Sportfeldes. */
function gmActGlyph(gmSport){
  var c={Laufen:'var(--ready)',Radfahren:'var(--activity)',Kraft:'var(--gold)',Schwimmen:'var(--cyan)'}[gmSport]||'var(--ready)';
  if(gmSport==='Kraft'){var bars=[34,52,44,64,50,68,56].map(function(h,i){return '<rect x="'+(16+i*40)+'" y="'+(72-h*0.72).toFixed(0)+'" width="20" height="'+(h*0.72).toFixed(0)+'" rx="5" fill="'+c+'" opacity="'+(0.5+i*0.06).toFixed(2)+'"/>';}).join('');return '<svg class="act-glyph" viewBox="0 0 300 82" preserveAspectRatio="none">'+bars+'</svg>';}
  if(gmSport==='Schwimmen'){var lanes=[24,42,60].map(function(y,i){return '<path d="M0 '+y+' Q 37 '+(y-9)+' 75 '+y+' T 150 '+y+' T 225 '+y+' T 300 '+y+'" fill="none" stroke="'+c+'" stroke-width="2.6" opacity="'+(0.75-i*0.18).toFixed(2)+'"/>';}).join('');return '<svg class="act-glyph" viewBox="0 0 300 82" preserveAspectRatio="none">'+lanes+'</svg>';}
  return '<svg class="act-glyph" viewBox="0 0 300 82" preserveAspectRatio="none"><path d="M18 62 L68 30 L128 42 L176 18 L236 50 L282 26" fill="none" stroke="'+c+'" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="18" cy="62" r="5.2" fill="'+c+'"/><circle cx="282" cy="26" r="5.2" fill="#0c1017" stroke="'+c+'" stroke-width="2.4"/></svg>';
}
/* Kanonischer Wochenvertrag (DT1) — identisches Aufrufmuster wie weekRunKm; KEINE eigene
   Aggregation, nur der bestehende produktive Aggregator. */
function gmActWeekTotals(){
  try{
    var st=window.ORVIA&&ORVIA.activityStore,cfg=window.ORVIA&&ORVIA.activityConfig;
    if(!st||!st.listActivities||!cfg||!cfg.weeklyActivityTotals)return null;
    var tz=(window.ORVIA&&ORVIA.profileStore&&ORVIA.profileStore.effectiveTimezone)?ORVIA.profileStore.effectiveTimezone():'UTC';
    var ts=st.isTombstoned?st.isTombstoned:null;
    return cfg.weeklyActivityTotals(st.listActivities(),(typeof DB!=='undefined')?DB:{},{weekRef:todayStr(),timezone:tz,isTombstoned:ts});
  }catch(_){return null;}
}
function gmActPlanFulfillment(scope){
  /* GM7.2: Planerfüllung aus dem KANONISCHEN Plan-Ist-Abgleich (planActualResolveForDates
     → Calc.resolvePlanActual). Fenster: 7 Tage (Woche) bzw. 28 Tage (Monat). Keine UI-Logik. */
  try{
    if(typeof planActualResolveForDates!=='function'||!(Calc&&Calc.resolvePlanActual))return null;
    var days=(scope==='month')?28:7;var ds=[];var now=new Date(orviaNowMs());
    for(var i=days-1;i>=0;i--){var dd=new Date(now);dd.setDate(now.getDate()-i);ds.push(todayStr(dd));}
    var pr=planActualResolveForDates(ds)||{};var occ=pr.byOcc||{};var tot=0,done=0;
    Object.keys(occ).forEach(function(k){tot++;if(occ[k]&&occ[k].state==='completed')done++;});
    return tot>0?Math.round(done/tot*100):null;
  }catch(_){return null;}
}
function gmActPeriodTotals(scope){
  /* GM7.2: Monat = UI-Adapter, der die KANONISCHE Wochen-Aggregation (weeklyActivityTotals)
     über die letzten 4 ISO-Wochen summiert. KEINE neue Aggregations-/Lastformel; Completeness
     bleibt ehrlich (ein unvollständiges Teilfenster ⇒ Gesamtwert null/—). Woche = 1 Fenster. */
  try{
    var st=window.ORVIA&&ORVIA.activityStore,cfg=window.ORVIA&&ORVIA.activityConfig;
    if(!st||!st.listActivities||!cfg||!cfg.weeklyActivityTotals)return null;
    var tz=(window.ORVIA&&ORVIA.profileStore&&ORVIA.profileStore.effectiveTimezone)?ORVIA.profileStore.effectiveTimezone():'UTC';
    var ts=st.isTombstoned?st.isTombstoned:null;var acts=st.listActivities();
    var weeks=(scope==='month')?4:1;
    var agg={sessionCount:0,knownDurationMin:0,knownDistanceKm:0,knownLoadUnits:0,cDur:true,cDist:true,cLoad:true};
    var bySport={};
    for(var w=0;w<weeks;w++){
      var ref=todayStr(new Date(orviaNowMs()-w*7*864e5));
      var wk=cfg.weeklyActivityTotals(acts,(typeof DB!=='undefined')?DB:{},{weekRef:ref,timezone:tz,isTombstoned:ts});
      if(!wk||!wk.totals)continue;var t=wk.totals;
      agg.sessionCount+=t.sessionCount||0;
      agg.knownDurationMin+=t.knownDurationMin||0; if(t.completeness&&!t.completeness.duration)agg.cDur=false;
      agg.knownDistanceKm+=t.knownDistanceKm||0;  if(t.completeness&&!t.completeness.distance)agg.cDist=false;
      agg.knownLoadUnits+=t.knownLoadUnits||0;    if(t.completeness&&!t.completeness.load)agg.cLoad=false;
      Object.keys(wk.bySport||{}).forEach(function(sp){var b=wk.bySport[sp];var acc=bySport[sp]||(bySport[sp]={knownDurationMin:0,knownDistanceKm:0,sessionCount:0});
        acc.knownDurationMin+=b.knownDurationMin||0;acc.knownDistanceKm+=b.knownDistanceKm||0;acc.sessionCount+=b.sessionCount||0;});
    }
    return {totals:{sessionCount:agg.sessionCount,
      durationMin:agg.cDur?Math.round(agg.knownDurationMin):null,knownDurationMin:Math.round(agg.knownDurationMin),
      distanceKm:agg.cDist?Math.round(agg.knownDistanceKm*100)/100:null,knownDistanceKm:Math.round(agg.knownDistanceKm*100)/100,
      loadUnits:agg.cLoad?Math.round(agg.knownLoadUnits):null,
      completeness:{duration:agg.cDur,distance:agg.cDist,load:agg.cLoad}},
      bySport:bySport,weeks:weeks};
  }catch(_){return null;}
}
function gmActFmtMin(min){
  if(min==null||isNaN(min))return '—';
  var h=Math.floor(min/60),m=Math.round(min%60);
  return h+':'+String(m).padStart(2,'0')+' h';
}
function gmActTodayItem(){
  try{var row=activeWeekPlan()[(new Date().getDay()+6)%7]||[];return row.length?row[0]:null;}catch(_){return null;}
}
/* v8-310b · Im geplanten Hub-Modus darf die gewaehlte Sportart nicht an
   irgendeine heutige Planeinheit gebunden werden. Vorher startete der Code
   stets Index 0: „Krafttraining" konnte so eine Lauf-/Rad-Occurrence erben
   oder umgekehrt. Eindeutig passender Sport => planbar; kein/mehrere Treffer
   => fail-closed und Start ueber die konkrete Plankarte. */
function gmPlannedStartSelection(sport,plan,dayIndex){
  var di=(dayIndex!=null)?dayIndex:((new Date().getDay()+6)%7);
  var row=[];try{row=(plan||activeWeekPlan())[di]||[];}catch(_){row=[];}
  var norm=function(v){
    try{if(window.ORVIA&&ORVIA.trainingDomain&&ORVIA.trainingDomain.normSportStrict)return ORVIA.trainingDomain.normSportStrict(v);}
    catch(_){ }
    var s=String(v||'').toLowerCase();
    if(s==='gym'||s.indexOf('kraft')>=0)return 'gym';
    if(s.indexOf('lauf')>=0)return 'running';
    if(s.indexOf('rad')>=0)return 'cycling';
    if(s.indexOf('schwimm')>=0)return 'swimming';
    return s||null;
  };
  var wanted=norm(sport),hits=[];
  for(var i=0;i<row.length;i++)if(norm(row[i]&&(row[i].sportId||row[i].t))===wanted)hits.push({item:row[i],di:di,ii:i});
  if(hits.length===1)return {status:'unique',item:hits[0].item,di:di,ii:hits[0].ii,sportId:wanted};
  if(hits.length>1)return {status:'ambiguous',matches:hits,sportId:wanted};
  return {status:'none',matches:[],sportId:wanted};
}
function renderGMActivity(){
  var host=document.getElementById('gmAkt');if(!host)return;
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var h='';
  /* 1. Header (GM: Trainingszentrale / Aktivitäten / modusabhängige date / Verbindungs-Button).
     Verbindungs-Einstieg = bestehender Import-/Verbindungs-Sheet. */
  var dateTxt=lvl==='a'?'Starten, ansehen, verstehen':lvl==='p'?'Start-Flow, Volumen, Belastung & Debrief':'Starten, planen und auswerten';
  h+='<div class="hdr"><div><div class="greet">Trainingszentrale</div><h1>Aktivitäten</h1><div class="date">'+dateTxt+'</div></div><button class="iconbtn" aria-label="Verbindungen &amp; Import" onclick="openImportSheet()">'+icon('link','sm')+'</button></div>';
  /* 2. Erste hub-actions: 5 Slots. Fehlender Handler ⇒ sichtbar deaktiviert + ehrliches NA. */
  var tItem=gmActTodayItem();
  h+='<div class="hub-actions">'+
    '<button class="hub-act primary" onclick="gmOpenStartSheet()"><span class="ha-ic">'+icon('play','sm')+'</span><div><b>Training starten</b><span>Sport wählen · geplant oder frei</span></div></button>'+
    '<button class="hub-act" onclick="gmOpenStartSheet(\'planned\')"><span class="ha-ic">'+icon('calendar','sm')+'</span><div><b>Geplante Einheit</b><span>'+(tItem?'Heute: '+gmEsc(tItem.l):'Heute: —')+'</span></div></button>'+
    '<button class="hub-act" onclick="gmOpenStartSheet(\'free\')"><span class="ha-ic">'+icon('bolt','sm')+'</span><div><b>Freies Training</b><span>Ohne Plan</span></div></button>'+
    '<button class="hub-act" onclick="openManualActivity()"><span class="ha-ic">'+icon('pen','sm')+'</span><div><b>Manuell hinzufügen</b><span>Nachtragen</span></div></button>'+
    (function(){var la=null;try{var _l=listActivitiesUnified(1);la=(_l&&_l[0])||null;}catch(_){ }
      if(la){var vm2=null;try{vm2=activityDetailViewModel(la);}catch(_){ }var lbl=(vm2&&(vm2.sportLabel||vm2.title))||'letzte Einheit';var um=(vm2&&vm2.distanceLabel)?' '+vm2.distanceLabel:'';
        return '<button class="hub-act" onclick="gmOpenStartSheet(\'repeat\')"><span class="ha-ic">'+icon('run','sm')+'</span><div><b>Letzte wiederholen</b><span>'+gmEsc(lbl+um)+'</span></div></button></div>';}
      return '<button class="hub-act" disabled aria-disabled="true"><span class="ha-ic">'+icon('run','sm')+'</span><div><b>Letzte wiederholen</b><span>Noch keine Aktivität</span></div></button></div>';})();
  /* 3. Subtabs Woche/Monat */
  h+='<div class="subtabs"><button class="'+(gmActScope==='week'?'on':'')+'" onclick="gmSetActScope(\'week\')">Woche</button><button class="'+(gmActScope==='month'?'on':'')+'" onclick="gmSetActScope(\'month\')">Monat</button></div>';
  /* 4. KPI-Zellen: alle 6 GM-Slots strukturell; Werte NUR aus kanonischen Aggregatoren.
     Woche: weekRunKm (Laufdistanz) + weeklyActivityTotals (Dauer nur bei vollständiger
     Abdeckung, Einheiten, Belastung nur gemessene sRPE). kcal/Planerfüllung ohne
     Aggregator ⇒ —. Monat: kein kanonischer Monatsvertrag ⇒ Struktur bleibt, Werte —. */
  var wk=gmActPeriodTotals(gmActScope);            /* GM7.2: Woche UND Monat liefern jetzt Werte */
  /* GM7.5c: „Distanz" ist im Golden Master eine Einzelzahl ohne Sportart-Disambiguierung —
     eine ueber Lauf+Rad+Schwimmen usw. summierte Zahl waere irrefuehrend (rule #8: nicht
     belegbare Multisportwerte -> „—"; Mapping-Doc: „Lauf-km via weekRunKm"). weekRunKm ist
     bereits die kanonische, im ganzen Produkt (Header/Dashboard) genutzte Quelle fuer
     Lauf-Wochenkilometer (robuste Teilsumme, fehlende Einzeldistanzen senken nicht auf null).
     Monat = Summe der letzten 4 ISO-Wochen, gleiche „robuste Teilsumme"-Philosophie wie
     gmActPeriodTotals selbst (GM7.2-Kommentar) statt einer zweiten, abweichenden Formel. */
  var dist=(function(){
    if(typeof weekRunKm!=='function')return null;
    if(gmActScope==='month'){
      /* Anders als eine einzelne Session-Luecke (die weekRunKm robust traegt) macht eine
         ganze UNBEKANNTE Woche die Monatssumme irrefuehrend unvollstaendig -> erst bei allen
         4 Wochen bekannt zeigen, sonst ehrlich „—" (rule #8). */
      var sum=0;
      for(var _wi=0;_wi<4;_wi++){var v=weekRunKm(_wi);if(v==null)return null;sum+=v;}
      return Math.round(sum*100)/100;
    }
    return weekRunKm(0);
  })();
  var planErf=gmActPlanFulfillment(gmActScope);      /* kanonischer Plan-Ist-Abgleich */
  /* GM7.4: „aktive kcal" ist der kanonische Tagesmetrik-Wert active_kcal (Worker:
     summary.activeKilocalories). Summe der GESPEICHERTEN Tageswerte über dasselbe
     Fenster wie die Belastung (Woche=7, Monat=28 T.). Keine neue Formel, reine
     Aggregation gespeicherter Werte; fehlt die Serie → „—" (kein 0-Platzhalter). */
  var kcalPeriod=(function(){try{var n=(gmActScope==='month')?28:7;var s=(typeof gmMetricSeries==='function')?gmMetricSeries('active_kcal',n):null;
    if(s&&s.values&&s.values.length){var sum=0,any=false;s.values.forEach(function(v){if(v!=null){sum+=v;any=true;}});return any?Math.round(sum):null;}}catch(_){ }return null;})();
  var kpis=[
    [dist!=null?fmtDe(dist)+' km':'—','Laufdistanz'],
    [(wk&&wk.totals&&wk.totals.durationMin!=null)?gmActFmtMin(wk.totals.durationMin):'—','Dauer'],
    [kcalPeriod!=null?fmtDe(kcalPeriod)+' kcal':'—','aktive kcal'],
    [(wk&&wk.totals&&wk.totals.sessionCount!=null)?String(wk.totals.sessionCount):'—','Einheiten'],
    /* Bugfix (2026-08-05): im Monat nullte EINE unvollstaendige Woche die ganze Summe.
       Ehrlich: bekannte Teilsumme mit ≥-Kennzeichnung statt Dauer-Strich. */
    [(wk&&wk.totals&&wk.totals.loadUnits!=null)?String(wk.totals.loadUnits):((wk&&wk.totals&&wk.totals.knownLoadUnits>0)?'≥'+wk.totals.knownLoadUnits:'—'),'Belastung'],
    [planErf!=null?planErf+'%':'—','Planerfüllung']
  ];
  var shown=(lvl==='a')?kpis.slice(0,3):kpis;
  h+='<div class="kpi-row" style="grid-template-columns:repeat(3,1fr)">'+shown.map(function(s){return '<div class="kpi"><b>'+gmEsc(s[0])+'</b><span>'+gmEsc(s[1])+'</span></div>';}).join('')+'</div>';
  /* 5. Sportartenverteilung (nur F/P): Segmente nur bei vollständigem kanonischem
     Dauer-Vertrag; sonst neutrale Leiste + —. Keine Prozentrechnung über die Liste. */
  if(lvl!=='a'){
    var segs=null;
    if(wk&&wk.totals&&wk.totals.completeness&&wk.totals.completeness.duration&&wk.totals.knownDurationMin>0){
      var bs=wk.bySport||{};var tot=wk.totals.knownDurationMin;
      var vRun=(bs.running&&bs.running.knownDurationMin)||0,vKraft=(bs.gym&&bs.gym.knownDurationMin)||0,vRad=(bs.cycling&&bs.cycling.knownDurationMin)||0;
      var vRest=Math.max(0,tot-vRun-vKraft-vRad);
      var pct=function(v){return Math.round(v/tot*100);};
      segs=[['Laufen',pct(vRun),'var(--ready)'],['Kraft',pct(vKraft),'var(--gold)'],['Rad',pct(vRad),'var(--activity)'],['Sonstiges',pct(vRest),'var(--cyan)']];
    }
    h+='<div class="card"><div class="ctitle"><div class="l">Sportartenverteilung</div><span class="more">'+(gmActScope==='week'?'Woche':'Monat')+'</span></div>'+
      '<div class="dist-bar">'+(segs?segs.map(function(s){return '<i style="width:'+s[1]+'%;background:'+s[2]+'"></i>';}).join(''):'<i style="width:25%;background:rgba(255,255,255,.08)"></i><i style="width:25%;background:rgba(255,255,255,.08)"></i><i style="width:25%;background:rgba(255,255,255,.08)"></i><i style="width:25%;background:rgba(255,255,255,.08)"></i>')+'</div>'+
      '<div class="dist-leg">'+(segs?segs.map(function(s){return '<span><i style="background:'+s[2]+'"></i>'+s[0]+' '+s[1]+'%</span>';}).join(''):['Laufen','Kraft','Rad','Sonstiges'].map(function(n,i){var c=['var(--ready)','var(--gold)','var(--activity)','var(--cyan)'][i];return '<span><i style="background:'+c+'"></i>'+n+' —</span>';}).join(''))+'</div></div>';
  }
  /* 6. Teaser: Bestleistung / Meilenstein — keine produktiven Seiten ⇒ ehrliches NA-Sheet,
     keine Demo-Bestzeit, keine Demo-Meilensteine. */
  var _bt=null;try{_bt=(typeof bestTimes==='function')?bestTimes():null;}catch(_){ }
  var _btSub='—';if(_bt){var _fs=function(sec){var m=Math.floor(sec/60),ss=Math.round(sec%60);return m+':'+String(ss).padStart(2,'0');};
    if(_bt.t5!=null)_btSub='5 km '+_fs(_bt.t5)+(_bt.real.k5?'':' (Prognose)');else if(_bt.t10!=null)_btSub='10 km '+_fs(_bt.t10)+(_bt.real.k10?'':' (Prognose)');}
  var _msSub='—';try{var _ach=(typeof gmAchievements==='function')?gmAchievements():null;var _nm=(typeof gmNextMilestone==='function')?gmNextMilestone(_ach):null;if(_nm)_msSub=_nm.label+' '+gmAchFmtVal(_nm.next,_nm.unit);}catch(_){ }
  h+='<div class="hub-actions"><button class="hub-act" onclick="gmOpenBestTimesEntry()"><span class="ha-ic">'+icon('bolt','sm')+'</span><div><b>Bestleistung</b><span>'+gmEsc(_btSub)+'</span></div></button><button class="hub-act" onclick="gmOpenMilestonesEntry()"><span class="ha-ic">'+icon('target','sm')+'</span><div><b>Meilenstein</b><span>'+gmEsc(_msSub)+'</span></div></button></div>';
  /* 7. Filter: 5 GM-Filter über das kanonische Sportfeld; unbekannte Sportarten bleiben
     unter „Alle" sichtbar. Keine neue Such-/Klassifikationslogik. */
  h+='<div class="filter-row">'+['Alle','Laufen','Kraft','Radfahren','Schwimmen'].map(function(f){return '<button class="filter-pill '+(gmActFilter===f?'on':'')+'" onclick="gmSetActivityFilter(\''+f+'\')">'+f+'</button>';}).join('')+'</div>';
  /* 8. Aktivitätsliste: kanonische vereinheitlichte Liste (IDs + Reihenfolge unverändert),
     Karten exakt im GM-Markup, Werte aus dem kanonischen Detail-View-Model. */
  var acts=[];try{acts=listActivitiesUnified(40)||[];}catch(_){ }
  var list=(gmActFilter==='Alle')?acts:acts.filter(function(a){return a&&a.sportId===GM_ACT_FILTER[gmActFilter];});
  var cards=list.map(function(a){
    var vm=null;try{vm=activityDetailViewModel(a);}catch(_){ }
    vm=vm||{};
    var aid=a.clientRecordId||a.id||'';
    var gsp=GM_ACT_SPORT[a.sportId]||null;
    var title=vm.title||vm.sportLabel||'Aktivität';
    var dl=(vm.date?((typeof fmtDate==='function')?fmtDate(vm.date):vm.date):'—')+((vm.time&&!(vm.source==='legacy_local'&&vm.time==='00:00'))?' · '+vm.time:'');
    var um=vm.distanceLabel||((a.sportId==='gym'&&a.summary&&a.summary.exerciseCount!=null)?a.summary.exerciseCount+' Übungen':null)||'—';
    var tempo=vm.paceLabel||((a.sportId==='gym'&&a.summary&&a.summary.rpe!=null)?'RPE '+a.summary.rpe:null)||'—';
    return '<article class="activity-card" role="button" tabindex="0" data-aid="'+gmEsc(aid)+'" onclick="gmOpenActivityPage(\''+gmEsc(aid)+'\')" onkeydown="if(event.key===\'Enter\')gmOpenActivityPage(\''+gmEsc(aid)+'\')">'+
      '<div class="activity-visual" data-sport="'+(gsp||'')+'">'+gmActGlyph(gsp||'Laufen')+'</div>'+
      '<div class="activity-body"><div class="activity-row"><div><h3>'+gmEsc(title)+'</h3><p>'+gmEsc(dl)+' · '+gmEsc(gmActSrcLabel(vm.source))+'</p></div>'+
      (a.status==='completed'?'<span class="session-state done">Abgeschlossen</span>':'<span class="session-state">—</span>')+'</div>'+
      '<div class="activity-metrics"><div><b>'+gmEsc(um)+'</b><span>UMFANG</span></div><div><b>'+gmEsc(vm.durationLabel||'—')+'</b><span>DAUER</span></div><div><b>'+gmEsc(tempo)+'</b><span>TEMPO</span></div><div><b>'+(vm.avgHr!=null?gmEsc(vm.avgHr)+' bpm':'—')+'</b><span>Ø HF</span></div></div></div></article>';
  }).join('');
  h+='<div class="activity-list">'+(list.length?cards:'<div class="empty"><div class="e-ic">'+icon('activity')+'</div><div class="et">Keine Aktivität in diesem Filter</div></div>')+'</div>';
  /* 9. Abschluss */
  h+='<div class="tabspacer"></div>';
  host.innerHTML=h;
}
function gmSetActScope(s){gmActScope=(s==='month')?'month':'week';renderGMActivity();}
function gmSetActivityFilter(f){gmActFilter=f;renderGMActivity();}
/* ---------- Aktivitätsdetail (GM-Vollseite; Route/Chart/Splits NUR aus echten Daten) ---------- */
/* GM7.7: sportgerechte Stream-Definitionen. „Tempo"/„Geschwindigkeit" sind reine
   Einheitenumrechnungen DERSELBEN gemessenen Geschwindigkeit (m/s) — keine neue Groesse,
   keine Modellannahme: Laufen/Gehen min/km, Rad km/h, Schwimmen min/100 m, sonst m/s. */
function gmActStreamDefs(sportId){
  var paceSports={running:1,hiking:1,walking:1,trail_running:1};
  var speedDef;
  /* Tempo konventionell als mm:ss lesen (nicht als Dezimalminuten) — reine Formatierung. */
  var paceFmt=function(v){if(v==null||!isFinite(v))return null;var m=Math.floor(v),s=Math.round((v-m)*60);if(s===60){m++;s=0;}return m+':'+String(s).padStart(2,'0');};
  if(paceSports[sportId])speedDef={key:'speed',label:'Tempo (min/km)',unit:'/km',color:'sleep',hb:false,dec:2,fmt:paceFmt,conv:function(v){return v>0.3?(1000/v/60):null;}};
  else if(sportId==='cycling')speedDef={key:'speed',label:'Geschwindigkeit (km/h)',unit:' km/h',color:'sleep',hb:true,dec:1,conv:function(v){return v*3.6;}};
  else if(sportId==='swimming')speedDef={key:'speed',label:'Tempo (min/100 m)',unit:'/100 m',color:'sleep',hb:false,dec:2,fmt:paceFmt,conv:function(v){return v>0.1?(100/v/60):null;}};
  else speedDef={key:'speed',label:'Geschwindigkeit (m/s)',unit:' m/s',color:'sleep',hb:true,dec:1,conv:null};
  return [
    {key:'heart_rate',label:'Herzfrequenz (bpm)',unit:' bpm',color:'ready',hb:false,dec:0,conv:null},
    speedDef,
    {key:'cadence',label:'Kadenz (spm)',unit:' spm',color:'cyan',hb:true,dec:0,conv:null},
    {key:'elevation',label:'Höhe (m)',unit:' m',color:'activity',hb:null,dec:0,conv:null}
  ];
}
/* GM7.9: Sportfamilien-Aufloesung fuer sportgerechte Detail-/Story-Darstellung.
   Reine Klassifikation der vorhandenen Sport-ID — keine Datenlogik. */
function gmActFamily(sportId){
  var s=null;try{s=(window.ORVIA&&ORVIA.trainingDomain&&ORVIA.trainingDomain.normSport)?ORVIA.trainingDomain.normSport(sportId):null;}catch(_){ }
  s=(s||String(sportId||'')).toLowerCase();
  if(s==='gym'||s==='strength'||s==='strength_training'||s==='weight_training')return 'gym';
  if(s==='cycling')return 'cycling';
  if(s==='swimming')return 'swimming';
  if(s==='rowing')return 'rowing';
  if(s==='running'||s==='walking'||s==='hiking'||s==='trail_running')return 'pace';
  return 'other';
}
/* GM7.9: Gym-Aggregate AUSSCHLIESSLICH aus echten gespeicherten Saetzen
   (workoutDetail/workoutSnapshot der Activity oder Legacy-exLog der verknuepften
   Session). Volumen = Summe kg x Wdh. nur ueber Saetze, die BEIDE Werte tragen —
   reine Arithmetik, keine Schaetzung, kein Hochrechnen. */
function gmActGymAgg(a,vm,sess){
  var out={exCount:null,setCount:null,volumeKg:null,list:null,legacy:false};
  var ex=null;
  try{
    if(vm&&vm.workoutDetail&&vm.workoutDetail.length)ex=vm.workoutDetail;
    else if(a&&a.workoutSnapshot&&a.workoutSnapshot.length)ex=a.workoutSnapshot;
    else if(a&&Array.isArray(a.exercises)&&a.exercises.length)ex=a.exercises;
    else if(a&&a.metrics&&Array.isArray(a.metrics.exercises)&&a.metrics.exercises.length)ex=a.metrics.exercises;
  }catch(_){ }
  if(ex){
    var list=[],sets=0,vol=0,volKnown=false;
    ex.forEach(function(e){
      var ss=(e&&Array.isArray(e.sets))?e.sets:[];
      var rows=[],evol=0,eKnown=false;
      ss.forEach(function(st){
        if(!st)return;
        var reps=(st.reps!=null&&isFinite(+st.reps))?+st.reps:null;
        var w=(st.weight!=null&&isFinite(+st.weight))?+st.weight:((st.weightKg!=null&&isFinite(+st.weightKg))?+st.weightKg:null);
        sets++;rows.push({reps:reps,weight:w});
        if(reps!=null&&w!=null){evol+=reps*w;vol+=reps*w;volKnown=true;eKnown=true;}
      });
      list.push({name:(e&&(e.exerciseNameSnapshot||e.name||e.n))||'Übung',sets:rows,volumeKg:eKnown?evol:null});
    });
    out.exCount=list.length;out.setCount=sets||null;out.volumeKg=volKnown?vol:null;out.list=list;
  }else if(sess&&Array.isArray(sess.exLog)&&sess.exLog.length){
    var l2=[],s2=0,v2=0,k2=false;
    sess.exLog.forEach(function(x){
      if(!x)return;
      var n=(x.sets!=null&&x.sets>0)?x.sets:((x.reps!=null||x.kg!=null)?1:0);
      s2+=n;
      var evol=(x.reps!=null&&x.kg!=null&&n>0)?n*x.reps*x.kg:null;
      if(evol!=null){v2+=evol;k2=true;}
      l2.push({name:x.n||'Übung',setsN:n||null,reps:x.reps!=null?x.reps:null,kg:x.kg!=null?x.kg:null,volumeKg:evol});
    });
    out.exCount=l2.length;out.setCount=s2||null;out.volumeKg=k2?v2:null;out.list=l2;out.legacy=true;
  }else if(a&&a.summary&&a.summary.exerciseCount!=null){
    out.exCount=a.summary.exerciseCount;
    if(a.summary.setCount!=null)out.setCount=a.summary.setCount;
  }
  return out;
}
/* kg-Volumen mit deutschem Tausenderpunkt (reine Anzeige). */
function gmKg(v){return Math.round(v).toLocaleString('de-DE');}
/* GM7.9c / KF-021-Nachtrag (2026-08-04): bestTimes() liest inzwischen die
   kanonischen Garmin-Daten (js/run-bests.js) und ist fuer DISTANZ-Bestzeiten
   die einzige Wahrheit — die Story prueft sie ZUERST (siehe 1b im Story-Builder).
   gmActPersonalBest beantwortet seitdem nur noch die ANDERE Frage: war diese
   GANZE Aktivitaet (Ø-Tempo/-Geschwindigkeit) schneller als jede vergleichbare
   abgeschlossene Aktivitaet derselben Sportart? Rein lesender Vergleich ueber
   listActivitiesUnified; Ergebnis NUR mit echter Vergleichsbasis — die allererste
   Einheit ist kein „Rekord", sondern ein Erstwert. */
function gmActPersonalBest(a,vm,fam){
  if(!a)return null;
  var MIN_KM={pace:2,swimming:0.4,cycling:10};
  if(!MIN_KM.hasOwnProperty(fam))return null;
  var sportId=a.sportId;
  var metricOf=function(x){
    var s=(x&&x.summary)||{};
    var durS=(x&&x.durationSeconds!=null)?x.durationSeconds:null;
    if(!durS||durS<=0)return null;
    if(fam==='swimming'){
      var m=(s.distanceM!=null)?s.distanceM:(s.distanceKm!=null?s.distanceKm*1000:null);
      if(m==null||m<=0)return null;
      var km0=m/1000;if(km0<MIN_KM.swimming)return null;
      return {metric:durS/(m/100),unit:'/100 m',kind:'pace100',higherBetter:false};
    }
    var km=(s.distanceKm!=null)?s.distanceKm:(s.distanceM!=null?s.distanceM/1000:null);
    if(km==null||km<MIN_KM[fam])return null;
    if(fam==='cycling')return {metric:km/(durS/3600),unit:' km/h',kind:'speed',higherBetter:true};
    return {metric:durS/km,unit:'/km',kind:'pace',higherBetter:false};
  };
  var cur=metricOf(a);if(!cur)return null;
  var aid=a.clientRecordId||a.id;
  var pool=[];try{pool=listActivitiesUnified(400)||[];}catch(_){ }
  var bestOther=null;
  pool.forEach(function(x){
    if(!x||x.sportId!==sportId)return;
    var xid=x.clientRecordId||x.id;if(aid&&xid&&xid===aid)return;
    if(x.status&&x.status!=='completed')return;
    var v=metricOf(x);if(!v)return;
    if(bestOther==null)bestOther=v.metric;
    else if(cur.higherBetter?(v.metric>bestOther):(v.metric<bestOther))bestOther=v.metric;
  });
  if(bestOther==null)return null;                 /* keine Vergleichsbasis -> kein Rekord */
  var better=cur.higherBetter?(cur.metric>bestOther):(cur.metric<bestOther);
  if(!better)return null;
  return {cur:cur,bestOther:bestOther};
}
var _gmActCharts=[];
function gmOpenActivityPage(aid){
  var pg=document.getElementById('gmActPage');if(!pg)return;
  _gmActCharts=[];
  var a=null;try{a=(typeof _resolveActivityAny==='function')?_resolveActivityAny(aid):null;}catch(_){ }
  if(!a)return;
  var vm=null;try{vm=activityDetailViewModel(a);}catch(_){ }
  vm=vm||{};
  var run=vm.sportId==='running';
  /* Kanonisch verknüpfte Legacy-Session (AD1c-Story-Verknüpfung) — einzige Route-/Split-Quelle. */
  var sess=null;try{if(vm.storyRef&&typeof DB!=='undefined'){var e=DB[vm.storyRef.date];sess=(e&&e.sessions&&e.sessions[vm.storyRef.typ])||null;}}catch(_){ }
  /* GM7.9: Legacy-Aktivitaeten (source legacy_local) tragen _legacy.date/type — direkte
     Session-Aufloesung (einzige Quelle fuer Gym-Saetze/RPE aus dem Tages-Blob). */
  try{if(!sess&&a._legacy&&typeof DB!=='undefined'){var eL=DB[a._legacy.date];sess=(eL&&eL.sessions&&eL.sessions[a._legacy.type])||null;}}catch(_){ }
  /* GM7.3: kanonische Route zuerst (metrics.route aus dem Activity-Record, cloud-synchron);
     Legacy-Blob nur als Fallback. */
  var route=null;try{route=(vm.canonicalRoute&&vm.canonicalRoute.length>1)?vm.canonicalRoute:((sess&&typeof actRoute==='function')?actRoute(sess):null);}catch(_){ }
  /* GM7.7: Splits zuerst kanonisch (metrics.splits = echte Garmin-Runden, cloud-synchron
     und geraeteuebergreifend), Legacy-Blob nur als Fallback — analog zur Route (GM7.3). */
  var splits=(vm.canonicalSplits&&vm.canonicalSplits.length)?vm.canonicalSplits:((sess&&Array.isArray(sess.splits)&&sess.splits.length)?sess.splits:null);
  var splitsCanon=!!(vm.canonicalSplits&&vm.canonicalSplits.length);
  var rate=null;try{if(run&&sess&&typeof rateActivity==='function')rate=rateActivity('Laufen',sess);}catch(_){ }
  var dl=(vm.date?((typeof fmtDate==='function')?fmtDate(vm.date):vm.date):'—')+((vm.time&&!(vm.source==='legacy_local'&&vm.time==='00:00'))?' · '+vm.time:'');
  var h='<div class="page-head"><div class="page-head-row"><button class="backbtn" onclick="gmCloseActivityPage()" aria-label="Zurück">'+icon('chev')+'</button><div><h2>'+gmEsc(vm.title||vm.sportLabel||'Aktivität')+'</h2><p>'+gmEsc(dl)+'</p></div></div></div>';
  /* Route-Slot nur bei Laufaktivitäten; ohne GPS ehrlicher Empty-State im selben Slot. */
  if(run||route){
    h+='<div class="route-map">'+(route?((typeof routeSVG==='function')?routeSVG(route):''):'<div class="route-empty">'+icon('activity')+'<div>Keine GPS-Route für diese Einheit vorhanden.</div></div>')+'</div>';
  }
  h+='<div class="detail-title"><div class="plan-kicker">'+gmEsc(vm.sportLabel||'Aktivität')+(vm.planLink?' · Plan-Ist verknüpft':'')+'</div><h1>'+gmEsc(vm.title||vm.sportLabel||'—')+'</h1><p>'+gmEsc(gmActSrcLabel(vm.source))+(vm.planLink?' · dem Wochenplan zugeordnet':(vm.source==='orvia_workout'?' · in ORVIA aufgezeichnet — keine Nachbearbeitung im UI':' · Quelle unverändert übernommen — keine Nachbearbeitung im UI'))+'</p></div>';
  /* GM7.5e: Schrittfrequenz war ein hartkodiertes „—", obwohl die kanonische
     Kadenz-Messreihe (canonicalStreams.cadence, echte Garmin-Werte, dieselbe Quelle
     wie die Kadenz-Kurve weiter unten) bereits vorliegt. Reiner arithmetischer
     Mittelwert der ECHTEN Samples — keine Interpolation, keine Umrechnung, keine
     Erfindung; ohne Serie bleibt der Slot ehrlich „—". */
  var _cadAvg=(function(){try{var c=vm.canonicalStreams&&vm.canonicalStreams.cadence;if(!Array.isArray(c))return null;var sum=0,n=0;for(var i=0;i<c.length;i++){var v=c[i];if(typeof v==='number'&&isFinite(v)){sum+=v;n++;}}return n?Math.round(sum/n):null;}catch(_){return null;}})();
  /* GM7.9: KPI-Zellen je Sportfamilie — Struktur bleibt (6 Zellen, GM-Raster), Inhalte
     sportgerecht: Krafttraining zeigt keine leere Distanz-/Tempo-Zelle mehr, sondern
     Uebungen/Saetze/Volumen (reine Summen der ECHTEN Saetze); Rad Geschwindigkeit statt
     Lauf-Tempo; Ballsport/Sonstige Dauer/HF/Energie. Fehlende Werte bleiben ehrlich „—". */
  var _fam=gmActFamily(vm.sportId);
  var _gym=(_fam==='gym')?gmActGymAgg(a,vm,sess):null;
  var _rpe=(a.summary&&a.summary.rpe!=null)?a.summary.rpe:((sess&&sess.rpe!=null)?sess.rpe:null);
  var _spd=(function(){var s5=a.summary||{};if(s5.avgSpeedKmh!=null&&isFinite(s5.avgSpeedKmh)&&s5.avgSpeedKmh>0)return Math.round(s5.avgSpeedKmh*10)/10;if(s5.distanceKm>0&&a.durationSeconds>0)return Math.round(s5.distanceKm/(a.durationSeconds/3600)*10)/10;return null;})();
  var _hrC=[vm.avgHr!=null?vm.avgHr+' bpm':'—','Ø HERZFREQUENZ'];
  var kcells;
  if(_fam==='gym'){
    kcells=[
      [vm.durationLabel||'—','DAUER'],
      [_gym&&_gym.exCount!=null?String(_gym.exCount):'—','ÜBUNGEN'],
      [_gym&&_gym.setCount!=null?String(_gym.setCount):'—','SÄTZE'],
      [_gym&&_gym.volumeKg!=null?gmKg(_gym.volumeKg)+' kg':'—','VOLUMEN'],
      _hrC,
      [_rpe!=null?'RPE '+_rpe:'—','BELASTUNG']
    ];
  }else if(_fam==='cycling'){
    kcells=[
      [vm.distanceLabel||'—','DISTANZ'],
      [vm.durationLabel||'—','DAUER'],
      [_spd!=null?fmtDe(_spd)+' km/h':'—','Ø GESCHWINDIGKEIT'],
      _hrC,
      [(vm.elevationM!=null?vm.elevationM+' m':'—'),'HÖHENMETER'],
      [vm.caloriesKcal!=null?fmtDe(vm.caloriesKcal)+' kcal':'—','KALORIEN']
    ];
  }else if(_fam==='swimming'||_fam==='rowing'){
    kcells=[
      [vm.distanceLabel||'—','DISTANZ'],
      [vm.durationLabel||'—','DAUER'],
      [vm.paceLabel||'—','Ø TEMPO'],
      _hrC,
      [vm.caloriesKcal!=null?fmtDe(vm.caloriesKcal)+' kcal':'—','KALORIEN'],
      [_rpe!=null?'RPE '+_rpe:'—','BELASTUNG']
    ];
  }else if(_fam==='pace'){
    kcells=[
      [vm.distanceLabel||'—','DISTANZ'],
      [vm.durationLabel||'—','DAUER'],
      [vm.paceLabel||'—','Ø TEMPO'],
      _hrC,
      [_cadAvg!=null?_cadAvg+' spm':'—','SCHRITTFREQUENZ'],
      [(vm.elevationM!=null?vm.elevationM+' m':'—'),'HÖHENMETER']
    ];
  }else{
    kcells=[
      [vm.durationLabel||'—','DAUER'],
      [vm.distanceLabel||'—','DISTANZ'],
      _hrC,
      [vm.maxHr!=null?vm.maxHr+' bpm':'—','MAX. HERZFREQUENZ'],
      [vm.caloriesKcal!=null?fmtDe(vm.caloriesKcal)+' kcal':'—','KALORIEN'],
      [_rpe!=null?'RPE '+_rpe:'—','BELASTUNG']
    ];
  }
  /* GM7.4-A: per-Aktivitäts-Trainingslast (Garmin activityTrainingLoad → metrics.training_load).
     Produzierter Wert, bislang nicht dargestellt; nur zeigen wenn vorhanden. */
  var _actTl=(a&&a.metrics&&a.metrics.training_load!=null&&isFinite(a.metrics.training_load))?Math.round(a.metrics.training_load):null;
  if(_actTl!=null)kcells.push([String(_actTl),'BELASTUNG (GARMIN)']);
  h+='<div class="detail-kpis">'+kcells.map(function(c){return '<div><b>'+gmEsc(c[0])+'</b><span>'+gmEsc(c[1])+'</span></div>';}).join('')+'</div>';
  /* P0-Nachtrag 2026-08-05 (Nutzerentscheidung): Dauer eines ORVIA-Workouts ist
     nachtraeglich korrigierbar — bewusst KEINE automatische Obergrenze. Eine
     vorhandene Korrektur bleibt sichtbar (vorher → nachher, manuell). */
  if((vm.source==='orvia_workout'||vm.source==='live')&&vm.status!=='active'&&a.durationSeconds!=null){
    var _dc=a.metrics&&a.metrics.durationCorrection;
    h+='<div class="mini-note" style="margin:2px 18px 10px">'+icon('pen','xs')+'<div>'+
      (_dc?('Dauer manuell korrigiert: '+(_dc.fromMin!=null?_dc.fromMin+' min':'—')+' → <b>'+_dc.toMin+' min</b>. '):'')+
      '<a href="#" onclick="event.preventDefault();gmOpenDurationCorrectSheet(\''+gmEsc(a.clientRecordId||a.id)+'\','+Math.round(a.durationSeconds/60)+')" style="font-weight:700">Dauer korrigieren</a>'+
      (_dc?'':' — z. B. wenn die App während des Trainings beendet wurde und Wartezeit mitzählte.')+'</div></div>';
  }
  /* v8-310b · Drei Korrekturwege bleiben sichtbar getrennt: Link loesen
     behaelt die Activity; Loeschen nutzt ausschliesslich den kanonischen
     Tombstone-Pfad. Keine Schaltflaeche tut beides. */
  var _aidCorr=a.clientRecordId||a.id;
  h+='<div style="margin:0 18px 14px">'+
    (vm.planLink?'<button class="cta wide-ghost" style="width:100%;margin-bottom:8px" onclick="unlinkActivityPlanCanonical(\''+gmEsc(String(_aidCorr))+'\',\''+gmEsc(String(vm.planLink))+'\')">Vom Wochenplan lösen</button>':'')+
    '<button class="cta wide-ghost danger-btn" style="width:100%" onclick="deleteActivityCanonical(\''+gmEsc(String(_aidCorr))+'\')">Aktivität löschen</button></div>';
  /* GM7.8: Story jederzeit erneut ansehen (nur wenn genug echte Daten vorliegen). */
  try{if(typeof gmStoryPages==='function'&&gmStoryPages(a).length>=2)
    h+='<div style="margin:0 18px 14px"><button class="cta wide-ghost" onclick="gmOpenStory(\''+gmEsc(String(aid))+'\')">'+icon('sparkle','sm')+' Story ansehen</button></div>';}catch(_){ }
  /* Debrief NUR aus bestehender produktiver Bewertung; sonst ehrliche Missingness. */
  h+='<div class="coach-card"><h3>'+icon('sparkle','sm')+' ORVIA Debrief</h3><p>'+(rate?gmEsc(rate.txt):'Ein kanonisches Debrief ist für diese Einheit noch nicht verfügbar — ORVIA erfindet keine Analyse. Die Werte oben stammen unverändert aus der Aktivitätsquelle und werden im UI weder nachberechnet noch ergänzt.')+'</p>'+
    '<div class="coach-tags"><span>'+(rate?'Beibehalten: '+gmEsc(rate.badge):'Das beibehalten: —')+'</span><span>'+(rate&&rate.next?gmEsc(rate.next):'Nächstes Mal: —')+'</span><span>'+(rate?'Planwirkung: —':'Auswirkung auf die Planung: —')+'</span></div></div>';
  /* GM7.9: Krafttraining — Uebungs- & Satzliste aus den ECHTEN gespeicherten Saetzen
     (Snapshot/Legacy-Log). Reine Wiedergabe + Summen; ohne Details ehrlicher Leerzustand. */
  if(_fam==='gym'){
    var _gx=_gym&&_gym.list,_grows='';
    if(_gx&&_gx.length){
      _grows=_gx.map(function(e){
        var sub;
        if(e.sets&&e.sets.length){
          sub=e.sets.map(function(st,i){
            var mid=(st.weight!=null&&st.reps!=null)?'<strong>'+fmtDe(st.weight)+' kg</strong><span class="gs-x">×</span><strong>'+st.reps+'</strong>'
              :(st.reps!=null)?'<strong>'+st.reps+' Wdh.</strong>'
              :(st.weight!=null)?'<strong>'+fmtDe(st.weight)+' kg</strong>':'<strong>—</strong>';
            return '<div class="gymset-row"><span>Satz '+(i+1)+'</span>'+mid+'</div>';}).join('');
        }else{
          sub='<div class="gymset-row"><span>'+(e.setsN!=null?e.setsN+' Sätze':'—')+'</span><strong>'+(e.kg!=null?fmtDe(e.kg)+' kg':'—')+'</strong><span class="gs-x">×</span><strong>'+(e.reps!=null?e.reps:'—')+'</strong></div>';
        }
        return '<div class="gymex"><div class="gymex-head"><b>'+gmEsc(e.name)+'</b><span>'+(e.volumeKg?gmKg(e.volumeKg)+' kg Volumen':'')+'</span></div>'+sub+'</div>';
      }).join('');
    }else{
      /* Bugfix-Nachbesserung (2026-08-05): Der bisherige Text behauptete pauschal „keine
         Details gespeichert" — er verdeckte damit die drei voellig verschiedenen Faelle
         (wird gerade nachgeladen / Server hat sie wirklich nicht / offline, deshalb nicht
         pruefbar). Der Nutzer sah dadurch bei verschwundenen Saetzen dieselbe Meldung wie
         bei einem Workout, das nie Saetze hatte. Jetzt wird der TATSAECHLICHE Zustand
         benannt — samt Diagnose-Einstieg, damit die Ursache belegbar statt vermutet ist. */
      var _st=_gmActFallbackState[String(aid)]||null;
      var _canServer=!!(a&&(a.workoutSessionId||a.sourceRecordId)&&(vm.source==='orvia_workout'||vm.source==='live'));
      var _off=false;try{_off=(navigator.onLine===false);}catch(_){ }
      if(_st==='loading')_grows='<div class="gm-split-empty">Satzdetails werden aus der Cloud nachgeladen …</div>';
      else if(_off&&_canServer)_grows='<div class="gm-split-empty">Offline — die Satzdetails liegen nicht auf diesem Gerät und können gerade nicht aus der Cloud geladen werden. Sie sind nicht verloren.</div>';
      else if(_st==='server_empty')_grows='<div class="gm-split-empty">Für diese Einheit sind weder auf diesem Gerät noch in der Cloud Satzdetails vorhanden. ORVIA erfindet keine Sätze.</div>';
      else if(_st==='error')_grows='<div class="gm-split-empty">Die Satzdetails konnten nicht geladen werden (Verbindungsfehler). <a href="#" onclick="event.preventDefault();gmActRetryGym(\''+gmEsc(String(aid))+'\')" style="font-weight:700">Erneut versuchen</a></div>';
      else _grows='<div class="gm-split-empty">'+GM_NA+' — für diese Einheit sind keine Übungs- und Satzdetails gespeichert. ORVIA erfindet keine Sätze.</div>';
      if(_canServer)_grows+='<div class="mini-note" style="margin-top:8px">'+icon('info','xs')+'<div><a href="#" onclick="event.preventDefault();gmOpenSetsDiagnose(\''+gmEsc(String(aid))+'\')" style="font-weight:700">Warum fehlen die Sätze?</a> — zeigt, wo die Daten tatsächlich liegen.</div></div>';
    }
    h+='<div class="card"><div class="ctitle"><div class="l">'+icon('dumbbell')+' Übungen &amp; Sätze</div>'+(_gym&&_gym.setCount?'<span class="more">'+_gym.setCount+' Sätze</span>':'')+'</div>'+_grows+'</div>';
  }
  /* GM7.9: Messreihen/Runden nicht mehr Lauf-exklusiv — jede Sportart mit ECHTEN
     kanonischen Streams/Splits (Rad, Schwimmen, Gym-HF, Ballsport) zeigt dieselben
     GM-Charts. Die ehrlichen Leerzustaende bleiben Lauf-exklusiv (dortiger Vertrag). */
  var _hasStream=false;try{var _sAll=vm.canonicalStreams;if(_sAll)for(var _k in _sAll){if(Array.isArray(_sAll[_k])&&_sAll[_k].length>=3){_hasStream=true;break;}}}catch(_){ }
  if(run||_hasStream||splits){
    /* GM7.4.1: echte Garmin-Detail-Streams (metrics.streams, get_activity_details) —
       nur tatsächlich vorhandene Kurven, korrekt beschriftete Einheiten (Geschwindigkeit
       bleibt m/s, KEINE Tempo-Umrechnung/-Verwechslung); fehlt der Serienvertrag
       vollständig ⇒ derselbe ehrliche Leerzustand wie zuvor. */
    /* GM7.7: Aktivitaets-Messreihen jetzt als GM-richChart (Achsen, Ø-Baseline, Min/Max-
       Marker, Scrubbing-Readout) statt roher Pfade — identische Chart-Komponente wie in
       den Metrik-Sheets. Werte bleiben die ECHTEN Samples; „Tempo" ist eine reine
       Einheitenumrechnung derselben Geschwindigkeitsmessung (1000/v in min/km), keine
       neue Groesse — deshalb sportgerecht beschriftet statt roher m/s. */
    var _st=vm.canonicalStreams||null;
    var _curveDefs=gmActStreamDefs(vm.sportId);
    var _slots=_st?_curveDefs.map(function(c,i){
      var arr=_st[c.key];if(!Array.isArray(arr))return '';
      var pts=[];for(var q=0;q<arr.length;q++){var v=arr[q];if(typeof v==='number'&&isFinite(v))pts.push(c.conv?c.conv(v):v);}
      if(pts.length<3)return '';
      _gmActCharts.push({id:'gmActStream'+i,vals:pts,label:c.label,unit:c.unit,color:c.color,hb:c.hb,dec:c.dec,fmt:c.fmt||null});
      return '<div style="margin-top:12px"><div style="font-size:10.5px;color:var(--muted);font-weight:700;margin-bottom:2px">'+gmEsc(c.label)+'</div><div class="oc2" id="gmActStream'+i+'"></div></div>';
    }).join(''):'';
    if(run||_slots)h+='<div class="card"><div class="ctitle"><div class="l">'+icon('chart')+' Aktivitäts-Messreihen (Garmin)</div><span class="more">'+(_gmActCharts.length?_gmActCharts.length+' Serien':'')+'</span></div>'+
      (_slots?_slots:'<div class="gm-chart-empty">'+GM_NA+' — für diese Einheit liegt keine kanonische Messreihe vor. Keine nachgebaute Kurve.</div>')+'</div>';
    /* Splits nur aus echten Splits (kanonische Story-Verknüpfung). */
    var srows='',_splitNote='';
    if(splits){
      /* GM7.7: Balkenlaenge relativ zur schnellsten Runde (echte Zeiten), zusaetzlich
         Ø-HF je Runde, wenn die Quelle sie liefert. Keine erfundene Runde. */
      var secs=splits.map(function(s){return s.sec;});
      var fast=Math.min.apply(null,secs),slow=Math.max.apply(null,secs),rng=(slow-fast)||1;
      srows=splits.map(function(s,i){
        var w=40+(1-(s.sec-fast)/rng)*55;
        var mm=Math.floor(s.sec/60),ss=Math.round(s.sec%60);
        /* Volle Runde (~1 km) => Rundennummer wie im Golden Master; abweichende Laenge
           (z.B. Schlussrunde 0,42 km) => echte Distanz statt irrefuehrender „1". */
        var full=(s.km==null)||Math.abs(s.km-1)<=0.05;
        var lbl=full?(i+1):(fmtDe(s.km)+' km');
        return '<div class="split-row'+(s.hr!=null?' has-hr':'')+'"><span>'+gmEsc(String(lbl))+'</span><span class="splitbar" style="width:'+w.toFixed(0)+'%"></span><strong>'+mm+':'+String(ss).padStart(2,'0')+'</strong>'+(s.hr!=null?'<span class="sp-hr">'+s.hr+' bpm</span>':'')+'</div>';
      }).join('');
      _splitNote='<div style="margin-top:8px;font-size:10.5px;color:var(--muted)">'+(splitsCanon?'Echte Runden aus der Aktivitätsquelle (Garmin).':'Runden aus der verknüpften Trainingssession.')+'</div>';
    }else{
      srows='<div class="gm-split-empty">'+GM_NA+' — für diese Einheit liegen keine echten Runden vor. Aus den gespeicherten Messreihen lassen sich keine Splits ableiten (die Serien tragen keinen Zeitstempel) — ORVIA rechnet hier nichts hoch.</div>';
    }
    if(run||splits)h+='<div class="card"><div class="ctitle"><div class="l">'+(splitsCanon?'Runden':'Kilometer-Splits')+'</div>'+(splits?'<span class="more">'+splits.length+'</span>':'')+'</div><div class="split-list">'+srows+'</div>'+_splitNote+'</div>';
  }
  h+='<div class="tabspacer"></div>';
  pg.innerHTML=h;
  pg.classList.add('on');
  try{pg.scrollTop=0;}catch(_){ }
  /* GM7.7: Stream-Charts nach dem Einhaengen zeichnen — dieselbe GM-Komponente wie in den
     Metrik-Sheets. Baseline = Ø der ECHTEN Samples (reine Aggregation). X-Achse: Sample-
     Position in % der Einheit (die Serien tragen keinen Zeitstempel — kein erfundener). */
  try{
    if(window.ORVIA&&ORVIA.charts&&ORVIA.charts.richChart){
      _gmActCharts.forEach(function(c){
        var el=document.getElementById(c.id);if(!el)return;
        var avg=c.vals.reduce(function(a,b){return a+b;},0)/c.vals.length;
        var times=c.vals.map(function(_,i){var p=Math.round(i/(c.vals.length-1)*100);return (i===0)?'Start':(i===c.vals.length-1?'Ende':(p+'%'));});
        ORVIA.charts.richChart(el,{label:c.label,series:c.vals,times:times,unit:c.unit,color:c.color,baseline:Math.round(avg*100)/100,higherBetter:c.hb!==false,dec:c.dec,fmtValue:c.fmt||undefined});
      });
    }
  }catch(_){ }
  /* Bugfix (2026-08-05, Nutzer-Feedback „Saetze verschwinden nach 1-2 Tagen"): diese Seite
     las Uebungen/Saetze bisher NUR aus dem lokalen workoutSnapshot (gmActGymAgg) — anders
     als das andere Aktivitaets-Detail (js/activity.js, _loadWorkoutDetailInto) und die
     Koerperkarte (gym-volume.js, gymPipelineAsync) gab es hier KEINEN Fallback auf die
     dauerhafte Server-Quelle. Fehlt der lokale Snapshot, jetzt einmalig live nachladen und
     reparieren statt "keine Saetze gespeichert" zu zeigen. */
  try{
    if(_fam==='gym'&&(!_gym||!_gym.list||!_gym.list.length)&&(vm.source==='orvia_workout'||vm.source==='live'))gmActLoadGymFallback(aid,a);
  }catch(_){ }
}
var _gmActFallbackTried={};
var _gmActFallbackState={};   /* aid -> loading | loaded | server_empty | error | no_session */
function gmActRetryGym(aid){
  var k=String(aid);delete _gmActFallbackTried[k];delete _gmActFallbackState[k];
  try{gmOpenActivityPage(aid);}catch(_){ }
}
function gmActLoadGymFallback(aid,a){
  var key=String(aid);if(_gmActFallbackTried[key])return;_gmActFallbackTried[key]=true;
  var repos=window.ORVIA&&ORVIA.repos&&ORVIA.repos.workout;
  var sid=a&&(a.workoutSessionId||a.sourceRecordId);
  if(!repos||!repos.loadWorkoutTree||!sid){_gmActFallbackState[key]='no_session';return;}
  _gmActFallbackState[key]='loading';
  var redraw=function(){var pg=document.getElementById('gmActPage');
    if(pg&&pg.classList.contains('on'))try{gmOpenActivityPage(aid);}catch(_){ }};
  repos.loadWorkoutTree(sid).then(function(r){
    if(!(r&&r.success)){_gmActFallbackState[key]='error';redraw();return;}
    if(!(r.data&&Array.isArray(r.data.exercises)&&r.data.exercises.length)){
      /* Server erreichbar, hat aber selbst keine Saetze — das ist eine ECHTE Aussage
         und keine Vermutung; sie unterscheidet Datenverlust von „nie erfasst". */
      _gmActFallbackState[key]='server_empty';redraw();return;}
    var store=window.ORVIA&&ORVIA.activityStore;
    if(!(store&&store.repairWorkoutSnapshot)){_gmActFallbackState[key]='error';redraw();return;}
    var rr=store.repairWorkoutSnapshot(a.clientRecordId||a.id,r.data.exercises);
    if(!rr||!rr.ok){_gmActFallbackState[key]='error';redraw();return;}
    _gmActFallbackState[key]='loaded';
    /* Nur neu rendern, wenn die Seite noch offen ist — der Nutzer koennte weitergeklickt
       haben. Die Reparatur selbst gilt trotzdem (auch fuer Koerperkarte/Volumen). */
    redraw();
  }).catch(function(){_gmActFallbackState[key]='error';redraw();});
}
/* Diagnose „Warum fehlen die Sätze?" (2026-08-05). Beantwortet mit ECHTEN, gerade
   gemessenen Werten, wo die Satzdetails liegen — lokal, in der Cloud, oder nirgends.
   Ohne diese Ansicht liess sich Datenverlust nicht von „nie erfasst" unterscheiden;
   genau daran scheiterte die Ursachenklaerung bisher. Reines Lesen, keine Aenderung. */
function gmOpenSetsDiagnose(aid){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var a=null;try{a=(typeof _resolveActivityAny==='function')?_resolveActivityAny(aid):null;}catch(_){ }
  var row=function(k,v,ok){return '<div class="md-row"><span>'+gmEsc(k)+'</span><b style="color:'+(ok===true?'var(--ready)':(ok===false?'var(--crit)':'var(--text)'))+'">'+gmEsc(v)+'</b></div>';};
  var snapN=0;try{snapN=(a&&Array.isArray(a.workoutSnapshot))?a.workoutSnapshot.length:0;}catch(_){ }
  var setsN=0;try{if(a&&Array.isArray(a.workoutSnapshot))a.workoutSnapshot.forEach(function(e){setsN+=((e&&e.sets)||[]).length;});}catch(_){ }
  var sid=a&&(a.workoutSessionId||a.sourceRecordId)||null;
  var on=true;try{on=navigator.onLine!==false;}catch(_){ }
  var body='<div class="md-pro">'+
    row('Aktivität gefunden',a?'ja':'nein',!!a)+
    row('Quelle',(a&&a.source)||'—')+
    row('Übungen auf diesem Gerät',String(snapN),snapN>0)+
    row('Sätze auf diesem Gerät',String(setsN),setsN>0)+
    row('Server-Session-ID',sid?'vorhanden':'fehlt',!!sid)+
    row('Sync-Status',(a&&a.syncStatus)||'—',(a&&a.syncStatus)==='synced')+
    row('Verbindung',on?'online':'offline',on)+
    '</div>';
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('info')+'</div><div><h3>Wo liegen die Sätze?</h3><div class="sh-sub" style="margin:2px 0 0">Gemessener Ist-Zustand, keine Vermutung</div></div></div>'+
    '<div class="sh-block">'+body+'<p class="note" style="text-align:left;margin-top:10px" id="gmSetsDiagOut">Tippe „In der Cloud nachsehen", um zu prüfen, ob die Sätze serverseitig noch vorhanden sind.</p></div>'+
    '<div class="sheet-cta"><button class="sec" onclick="gmCloseSheets()">Schließen</button>'+
    (sid&&on?'<button class="prim" onclick="gmSetsDiagProbe(\''+gmEsc(String(aid))+'\',\''+gmEsc(String(sid))+'\')">In der Cloud nachsehen</button>':'')+'</div>';
  gmOpenSheet('detailSheet');
}
function gmSetsDiagProbe(aid,sid){
  var out=document.getElementById('gmSetsDiagOut');if(out)out.textContent='Frage die Cloud ab …';
  var repos=window.ORVIA&&ORVIA.repos&&ORVIA.repos.workout;
  if(!repos||!repos.loadWorkoutTree){if(out)out.textContent='Cloud-Modul nicht geladen.';return;}
  repos.loadWorkoutTree(sid).then(function(r){
    if(!out)return;
    if(!(r&&r.success)){out.textContent='Cloud-Abfrage fehlgeschlagen'+((r&&r.error&&r.error.message)?': '+r.error.message:'.')+' Die Sätze sind dadurch NICHT als verloren belegt.';return;}
    var exs=(r.data&&r.data.exercises)||[];var n=0;exs.forEach(function(e){n+=((e&&e.sets)||[]).length;});
    if(n>0){out.textContent='In der Cloud liegen '+exs.length+' Übungen mit '+n+' Sätzen. Sie werden jetzt auf dieses Gerät zurückgeholt.';
      try{var st=ORVIA.activityStore;var a=_resolveActivityAny(aid);
        if(st&&st.repairWorkoutSnapshot&&a)st.repairWorkoutSnapshot(a.clientRecordId||a.id,exs);}catch(_){ }
      setTimeout(function(){try{gmCloseSheets();gmOpenActivityPage(aid);}catch(_){ }},1200);
    }else{out.textContent='Auch in der Cloud sind für diese Einheit keine Sätze gespeichert — die Details wurden beim Abschließen des Trainings nie serverseitig abgelegt. Das ist ein Schreib-, kein Anzeigefehler.';}
  }).catch(function(e){if(out)out.textContent='Cloud-Abfrage fehlgeschlagen: '+String(e&&e.message||e);});
}
function gmCloseActivityPage(){var pg=document.getElementById('gmActPage');if(pg)pg.classList.remove('on');}
/* P0-Nachtrag 2026-08-05: Dauer-Korrektur-Sheet. Schreibt ueber den Store
   (Activity + Server-Session + Trainingslast) — das UI rechnet nichts selbst. */
function gmOpenDurationCorrectSheet(aid,curMin){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('pen')+'</div><div><h3>Dauer korrigieren</h3><div class="sh-sub" style="margin:2px 0 0">Aktuell '+curMin+' min</div></div></div>'+
    '<div class="sh-block"><p>Trainierte Zeit in Minuten — z. B. wenn die App während des Trainings beendet wurde und Wartezeit mitzählte. Die Korrektur wird als manuelle Angabe protokolliert und passt auch die Trainingslast an.</p>'+
    '<div class="calc-field" style="margin-top:8px"><label>Dauer (min)</label><input type="number" id="gmDurCorrIn" inputmode="numeric" min="1" max="1440" value="'+curMin+'" style="width:110px;text-align:right"></div></div>'+
    '<div class="sheet-cta"><button class="sec" onclick="gmCloseSheets()">Abbrechen</button><button class="prim" onclick="gmApplyDurationCorrect(\''+gmEsc(aid)+'\')">Speichern</button></div>';
  gmOpenSheet('detailSheet');
  try{var inp=document.getElementById('gmDurCorrIn');if(inp){inp.focus();inp.select();}}catch(_){ }
}
function gmApplyDurationCorrect(aid){
  var v=null;try{v=parseInt(document.getElementById('gmDurCorrIn').value,10);}catch(_){ }
  if(!(v>0&&v<=1440)){if(typeof toast==='function')toast('Bitte eine Dauer zwischen 1 und 1440 min angeben.');return;}
  var ws=window.ORVIA&&ORVIA.workoutStore;
  if(!ws||!ws.correctFinishedDuration){if(typeof toast==='function')toast('Korrektur nicht verfügbar.');return;}
  ws.correctFinishedDuration(aid,v).then(function(r){
    gmCloseSheets();
    if(r&&r.success){if(typeof toast==='function')toast('Dauer korrigiert: '+v+' min ✓');
      try{gmOpenActivityPage(aid);}catch(_){ }
      try{if(typeof renderAkt==='function')renderAkt();}catch(_){ }}
    else{if(typeof toast==='function')toast('Korrektur fehlgeschlagen'+(r&&r.error&&r.error.message?': '+r.error.message:'.'));}
  });
}
/* GM7.9: „Bestleistung"-Einstieg aus Aktivitäten/Analyse — bestTimes() ist DIESELBE
   kanonische Quelle, die die Kachel-Unterzeile bereits befuellt (Widerspruch vorher:
   Unterzeile zeigte eine echte Bestzeit, Tap zeigte trotzdem „noch nicht verfuegbar").
   Bei echten Werten direkter Einstieg in die produktive Bestzeiten-Seite (identischer
   Renderer wie im Profil, GM7-Direct-Entry-Muster wie das Dashboard-Zahnrad); ohne
   jeden echten Wert bleibt es beim ehrlichen NA-Sheet — keine neue Darstellung. */
function gmOpenBestTimesEntry(){
  var bt=null;try{bt=(typeof bestTimes==='function')?bestTimes():null;}catch(_){ }
  var has=!!(bt&&(bt.t1!=null||bt.t5!=null||bt.t10!=null));
  if(!has){gmOpenActTeaserSheet('best');return;}
  try{openProfile();_gmProfDirectEntry=true;gmOpenProfPage('bestTimes');}catch(_){gmOpenActTeaserSheet('best');}
}
/* ---------- Teaser-Sheets: ehrliches NA, keine Demo-Bestzeiten/-Meilensteine ---------- */
function gmOpenActTeaserSheet(kind){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var t=kind==='best'?'Bestleistungen':'Meilensteine';
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon(kind==='best'?'bolt':'target')+'</div><div><h3>'+t+'</h3><div class="sh-sub" style="margin:2px 0 0">'+GM_NA+'</div></div></div>'+
    '<div class="sh-block"><p>'+t+' erscheinen mit deinen ersten abgeschlossenen Aktivitäten — gemessen, nicht erfunden. ORVIA zeigt keine erfundenen Werte.</p></div>';
  gmOpenSheet('detailSheet');
}
/* v8-312: Sportart-Icons im Training-Start-Sheet MUESSEN mit dem kanonischen Sport-
   Katalog uebereinstimmen (js/onboarding/onboarding-sports-logic.js: football->'ball',
   mobility->'stretch' — bereits produktiv fuer Aktivitaetenliste/Hub ueber
   ORVIA.activityConfig.sportIcon()). gm-icons.js ist laut eigenem Dateikopf VERBATIM
   aus dem Golden Master und bleibt unangetastet; hier werden NUR die beiden dort
   fehlenden Glyphen als IDENTISCHES Pfad-Markup der bereits kanonischen Sprite-Symbole
   (index.html #i-ball / #i-stretch) nachgezogen — keine neue Bildsprache.
   Vorher wurden 'target' (Ziel-/Readiness-Icon, siehe Zielkarte/Meilenstein) und 'moon'
   (im ganzen Produkt exklusiv Schlaf) zweckentfremdet: Fussball und die Zielkarte teilten
   sich ein Icon, Mobility sah aus wie die Schlaf-Kachel. Zusaetzlich hing Fussball an
   var(--ready) — derselben Farbe wie Laufen, beide Kacheln waren farblich nicht zu
   unterscheiden. Neue Token --team/--recovery (styles.css) sind bewusst NICHT mit einer
   bereits semantisch belegten Farbe identisch (--attention/--crit=Warnung/kritisch,
   --sleep=Schlaf) — sonst waere nur eine Kollision gegen eine andere getauscht. */
var GM_SPORT_ICON_EXTRA={
  ball:'<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4c2.4 2.3 3.7 5.3 3.7 8.6s-1.3 6.3-3.7 8.6"/><path d="M12 3.4C9.6 5.7 8.3 8.7 8.3 12s1.3 6.3 3.7 8.6"/><path d="M3.6 10.2h16.8M3.6 13.8h16.8"/>',
  stretch:'<circle cx="12" cy="4.6" r="1.9"/><path d="M12 7.4v6M12 9.2L7.2 11.6M12 9.2l4.8 2.4M12 13.4l-3.6 6.2M12 13.4l3.6 6.2"/>'
};
function gmSportTileIcon(n,c){if(GM_SPORT_ICON_EXTRA[n])return '<svg class="ic '+(c||'')+'" viewBox="0 0 24 24">'+GM_SPORT_ICON_EXTRA[n]+'</svg>';return icon(n,c);}
/* ---------- Training-Start-Sheet (GM-Einstieg; nur bestehende produktive Start-Handler) ---------- */
var _gmStartCtx={mode:null,sport:null};
function gmOpenStartSheet(mode){
  _gmStartCtx={mode:mode||null,sport:null};
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var title=mode==='planned'?'Geplante Einheit starten':mode==='repeat'?'Letztes Training wiederholen':mode==='free'?'Freies Training':'Training starten';
  var sub=lvl==='a'?'Wähle deine Sportart':lvl==='p'?'Sportart → geplant/frei → Pre-Start-Check':'Sportart wählen · dann geplant oder frei';
  var SPORTS=[['Laufen','run','var(--ready)'],['Krafttraining','dumbbell','var(--gold)'],['Radfahren','activity','var(--activity)'],['Schwimmen','drop','var(--cyan)'],['Fußball','ball','var(--team)'],['Mobility','stretch','var(--recovery)'],['Eigenes','plus','var(--muted)']];
  sh.innerHTML='<div class="grab"></div><h3>'+title+'</h3><div class="sh-sub">'+sub+'</div>'+
    '<div class="sport-grid">'+SPORTS.map(function(s){return '<button class="sport-tile" onclick="gmStartSport(\''+s[0]+'\')"><span class="st-ic" style="background:'+s[2]+';color:#0c1017">'+gmSportTileIcon(s[1],'sm')+'</span><b>'+s[0]+'</b></button>';}).join('')+'</div>';
  gmOpenSheet('detailSheet');
}
function gmStartSport(sport){
  _gmStartCtx.sport=sport;
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var plannedMode=(_gmStartCtx.mode==='planned');
  var _sel=plannedMode?gmPlannedStartSelection(sport):{status:'none'};
  var planned=plannedMode&&_sel.status==='unique';
  var tItem=planned?_sel.item:null;
  /* Readiness-/Safety-Hinweis NUR aus bestehender kanonischer Ausgabe — nie ausgeblendet. */
  var hint='';try{var d=(typeof getDecision==='function')?getDecision():null;if(d)hint=String(d.reco||d.title||'');}catch(_){ }
  if(!hint)hint='Keine kanonische Readiness-Bewertung verfügbar — ORVIA erfindet keinen Zustand.';
  if(plannedMode&&!planned)hint=(_sel.status==='ambiguous')
    ?'Mehrere passende Planeinheiten heute — öffne die gewünschte Einheit direkt im Wochenplan.'
    :'Für diese Sportart ist heute keine Planeinheit vorhanden. Wähle „Frei" oder öffne eine Plankarte.';
  var canStart=plannedMode?planned:!!(window.ORVIA&&ORVIA.workoutUI&&ORVIA.workoutUI.startSport);
  var rows=[
    ['Ziel der Einheit',planned?gmEsc(tItem.l):'—'],
    ['Dauer','—'],
    [sport==='Krafttraining'?'Volumen':'Distanz','—'],
    ['Intensität','—'],
    ['Ausrüstung','—'],
    ['Wearable','—']
  ];
  /* Phase 3 · E-21: Vor-Start-Werte aus GARMIN-Messungen statt manueller Abfrage —
     die App stellt keine Fragen, deren Antwort bereits gemessen vorliegt.
     Nur echte heutige Werte (gmMetric = Heute-Guard); fehlend ⇒ ehrlich „—". */
  var preRows='';
  /* typeof-Guard: die GM3-Blockauswertung der Paritaetstests laedt den Flag-Helfer
     (Legacy-Region) nicht mit — Standard ist AN. */
  if(typeof gmFeatureFlag!=='function'||gmFeatureFlag('preWorkoutGarmin')){
    var _bb=null,_st5=null;
    try{_bb=(typeof gmMetric==='function')?gmMetric('body_battery'):null;
      _st5=(typeof gmMetric==='function')?gmMetric('stress_avg'):null;}catch(_){ }
    var _os5=null;try{_os5=(typeof orviaScore==='function')?orviaScore():null;}catch(_){ }
    var pr=[
      ['Body Battery',(_bb&&_bb.value!=null)?fmtDe(_bb.value):'—'],
      ['Stress (heute Ø)',(_st5&&_st5.value!=null)?fmtDe(_st5.value):'—'],
      ['Readiness',(_os5&&_os5.score!=null)?_os5.score+' · '+gmEsc(_os5.statusText||''):'—']
    ];
    preRows='<div class="sh-block" style="margin:0 0 6px"><div class="bh">Vor-Start-Werte (gemessen)</div>'+
      '<div class="card prestart" style="margin:6px 0 0">'+pr.map(function(r){return '<div class="ps-row"><span>'+r[0]+'</span><b>'+gmEsc(r[1])+'</b></div>';}).join('')+'</div>'+
      '<p style="margin:6px 0 0;font-size:11px;color:var(--muted)">Aus deinen Garmin-/Check-in-Daten — kein manueller Pre-Check-in nötig. Wird beim Start als Snapshot gesichert.</p></div>';
  }
  sh.innerHTML='<div class="grab"></div><h3>'+gmEsc(sport)+'</h3><div class="sh-sub">Vor dem Start</div>'+
    '<div class="subtabs" style="margin:6px 0 12px"><button class="'+(plannedMode?'on':'')+'" onclick="gmStartSetMode(\'planned\')">Geplant</button><button class="'+(plannedMode?'':'on')+'" onclick="gmStartSetMode(\'free\')">Frei</button></div>'+   /* Phase 1b: Subtab „Vorlage" entfernt — kein Endzustand vorhanden. */
    '<div class="card prestart" style="margin:0 0 6px">'+rows.map(function(r){return '<div class="ps-row"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>';}).join('')+'</div>'+
    preRows+
    '<div class="mode-hint">'+icon('shield','sm')+'<div>'+gmEsc(hint)+'</div></div>'+
    (canStart
      ?'<button class="cta prim" style="width:100%;margin-top:12px" onclick="gmStartFromPreStart()">'+icon('play','sm')+' '+gmEsc(sport)+' starten</button>'
      :'<button class="cta prim" disabled aria-disabled="true" style="width:100%;margin-top:12px">'+gmEsc(sport)+' starten — '+GM_NA+'</button>')+
    /* Phase 1b: „Nur an Uhr uebergeben" war ein Knopf ohne jeden Endzustand.
       Entfernt; kommt zurueck, wenn die Uhr-Uebergabe existiert. */
    '';
  gmOpenSheet('detailSheet');
}
function gmStartSetMode(m){_gmStartCtx.mode=(m==='planned')?'planned':'free';if(_gmStartCtx.sport)gmStartSport(_gmStartCtx.sport);}
function gmStartFromPreStart(){
  var sport=_gmStartCtx.sport;
  var sel=(_gmStartCtx.mode==='planned')?gmPlannedStartSelection(sport):null;
  /* v8-310a/310b: Der Hub-Einstieg „Aktivitäten → Training starten →
     Geplant" uebergibt das heutige dateIso AUSDRUECKLICH. Die konkrete
     Einheit kommt aus gmPlannedStartSelection: nie wieder blind Index 0. */
  if(_gmStartCtx.mode==='planned'){
    if(!sel||sel.status!=='unique'){
      if(typeof toast==='function')toast(sel&&sel.status==='ambiguous'?'Mehrere passende Planeinheiten — bitte im Plan auswählen.':'Keine passende Planeinheit für diese Sportart heute.');
      return {ok:false,code:sel&&sel.status==='ambiguous'?'ambiguous_planned_unit':'no_matching_planned_unit'};
    }
    try{if(typeof gmCloseSheets==='function')gmCloseSheets();}catch(_){ }
    if(typeof startPlannedUnit==='function')return startPlannedUnit(sel.di,sel.ii,todayStr());
    return {ok:false,code:'start_unavailable'};
  }
  try{if(typeof gmCloseSheets==='function')gmCloseSheets();}catch(_){ }
  if(window.ORVIA&&ORVIA.workoutUI&&ORVIA.workoutUI.startSport)ORVIA.workoutUI.startSport(sport);
  return {ok:true,code:'free_started'};
}
/* Kanonischer Aktivitäten-Renderer (GM7-Fix): EXAKT eine produktive Implementierung
   unter ORVIA.activity.render. Das globale renderAkt ist nur noch ein eindeutiger
   Kompatibilitäts-Wrapper für bestehende Aufrufer (data.js, story.js, activity.js,
   showTab). Die frühere zweite Top-Level-Deklaration `function renderAkt()` in
   activity.js (Legacy, Ziel #aktBox = display:none) überschrieb diese Zuweisung
   per Hoisting und machte den Tab komplett schwarz — sie heißt jetzt
   renderAktLegacy und hat keinen produktiven Aufrufer mehr. */
(function(){window.ORVIA=window.ORVIA||{};ORVIA.activity=ORVIA.activity||{};
ORVIA.activity.render=function renderActivityTab(){
  if(document.getElementById('gmAkt')){
    try{if(typeof _fetchServerActivities==='function')_fetchServerActivities();}catch(_){ }
    renderGMActivity();return;
  }
};})();
renderAkt=function(){return ORVIA.activity.render();};
/* ====== GM3-ENDE ====== */
/* ============================================================
   GM7.8 · Post-Workout-Story — erzaehlt eine ABGESCHLOSSENE Einheit als Vollbild-
   Sequenz (Route zeichnet sich, Kennzahlen, Runden, Debrief, Belastungswirkung).
   AUSSCHLIESSLICH kanonische Werte: activityDetailViewModel (Summary/Streams/Runden/
   Route), rateActivity (bestehendes Debrief), Calc.loadSeries (Lastmodell).
   Keine Engine-Aenderung, keine Neuberechnung, keine erfundene Seite: fehlt eine
   Datenquelle, entfaellt die betreffende Seite ersatzlos.
   ============================================================ */
var _gmStory={pages:[],idx:0,timer:null,aid:null};
var GM_STORY_MS=8500;
/* Gesehene Storys: kanonisch im Profil (cloud-synchron ueber saveProfile), damit die
   Story auf keinem Zweitgeraet erneut aufpoppt. Deckel 60 Eintraege. */
function gmStorySeen(){try{var v=(typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.storySeen))?PROFILE.storySeen:null;return v||[];}catch(_){return [];}}
function gmStoryMarkSeen(aid){
  if(!aid)return;
  try{
    if(typeof PROFILE==='undefined'||!PROFILE)return;
    var l=Array.isArray(PROFILE.storySeen)?PROFILE.storySeen.slice():[];
    if(l.indexOf(aid)>=0)return;
    l.push(aid);if(l.length>60)l=l.slice(-60);
    PROFILE.storySeen=l;
    if(typeof saveProfile==='function')saveProfile();
  }catch(_){ }
}
/* ------------------------------------------------------------
   GM7.9 · Story-Redesign (Runna-inspiriert, nur ECHTE Werte):
   vollflaechige Seiten, Titel oben links (Einheit · Datum), grosse
   faktische Headline unten, gestaffelte Einflug-Animationen (Runden/
   Uebungen/Zellen), Dot-Matrix-Flaechencharts (HF/Geschwindigkeit) mit
   Ø-Badge, sportartspezifische Seitensets ueber gmActFamily. Fehlt eine
   Datenquelle, entfaellt die betreffende Seite ersatzlos.
   ------------------------------------------------------------ */
/* Warmer Verlaufs-Akzent je Sportfamilie (reine Darstellung). */
function gmStoryTheme(fam){
  var T={
    pace:    {acc:'#FF8A4C',soft:'rgba(255,138,76,.30)'},
    cycling: {acc:'#5AA0F0',soft:'rgba(90,160,240,.30)'},
    swimming:{acc:'#3ED6C4',soft:'rgba(62,214,196,.28)'},
    gym:     {acc:'#DCC79A',soft:'rgba(220,199,154,.28)'},
    rowing:  {acc:'#7C9CFF',soft:'rgba(124,156,255,.28)'},
    other:   {acc:'#43D693',soft:'rgba(67,214,147,.28)'}
  };
  return T[fam]||T.other;
}
/* Dot-Matrix-Flaechenchart (SVG) aus einer ECHTEN Messreihe: Spaltenmittelwerte
   (reine Aggregation derselben Samples), Punkte wachsen von links nach rechts,
   Ø-Linie mit Badge, Min/Max der Reihe als Achsenlabels. Keine Interpolation,
   keine Glaettung, keine erfundenen Werte. */
/* GM7.9e: Grosse Cover-Kennzahl typografisch aufbereiten — Zahlen gross, Einheiten
   ("h", "min", "km", "Saetze") inline klein. Rein darstellend: der Text wird NICHT
   veraendert, nur ausgezeichnet. Vorher brach z. B. "1 h 21 min" um und das "min"
   stand allein in der zweiten Zeile. */
function gmStoryBigVal(txt){
  return gmEsc(String(txt==null?'':txt)).replace(/([A-Za-zÄÖÜäöüß]+)/g,'<small>$1</small>');
}
function gmStoryDotChart(vals,unit,dec){
  if(!Array.isArray(vals)||vals.length<5)return '';
  /* GM7.9e: mehr Spalten = kuerzeres Mittelungsfenster je Spalte. Bei 46 Spalten wurden
     ueber eine lange Einheit teils 2 Minuten je Spalte gemittelt, wodurch echte
     Schwankungen (z. B. Intervalle) verschwanden und der Verlauf konstant wirkte.
     Weiterhin reine Spaltenmittelung derselben Samples — keine Interpolation. */
  var W=360,H=430,cols=Math.min(78,vals.length),rows=34;
  var bucket=[];
  for(var c=0;c<cols;c++){
    var a0=Math.floor(c*vals.length/cols),b0=Math.max(a0+1,Math.floor((c+1)*vals.length/cols));
    var sm=0,n=0;for(var i=a0;i<b0&&i<vals.length;i++){sm+=vals[i];n++;}
    bucket.push(n?sm/n:vals[a0]);
  }
  var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),rng=(mx-mn)||1;
  var avg=0;vals.forEach(function(v){avg+=v;});avg/=vals.length;
  var cw=W/cols,rh=H/rows,r=Math.max(1.6,Math.min(cw,rh)*0.30);
  var dots='';
  bucket.forEach(function(v,c){
    var hN=Math.max(1,Math.round(((v-mn)/rng)*(rows-2))+1);
    var col='';
    for(var q=0;q<hN;q++){
      var depth=hN-1-q;                                  /* 0 = oberster Punkt der Spalte */
      var kc=(depth===0)?' class="t0"':(depth===1?' class="t1"':(depth===2?' class="t2"':''));
      col+='<circle'+kc+' cx="'+(c*cw+cw/2).toFixed(1)+'" cy="'+(H-(q*rh+rh/2)).toFixed(1)+'" r="'+r.toFixed(1)+'"/>';}
    dots+='<g class="wst-dc" style="animation-delay:'+(180+c*24)+'ms">'+col+'</g>';
  });
  var avgY=H-(((avg-mn)/rng)*(rows-2)+1)*rh;
  var f=function(v){return (dec===0?Math.round(v):Math.round(v*10)/10).toLocaleString('de-DE');};
  return '<div class="wst-dotwrap">'+
    '<svg class="wst-dots" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+dots+
    '<line class="wst-avg" x1="0" x2="'+W+'" y1="'+avgY.toFixed(1)+'" y2="'+avgY.toFixed(1)+'"/></svg>'+
    '<span class="wst-avgbadge" style="top:'+Math.max(5,Math.min(92,avgY/H*100)).toFixed(1)+'%">Ø '+f(avg)+gmEsc(unit)+'</span>'+
    '<span class="wst-ax wst-axmax">'+f(mx)+gmEsc(unit)+'</span>'+
    '<span class="wst-ax wst-axmin">'+f(mn)+gmEsc(unit)+'</span></div>';
}
/* Baut die Seiten NUR aus vorhandenen Werten. Rueckgabe: [] = keine Story moeglich. */
function gmStoryPages(a){
  var vm=null;try{vm=activityDetailViewModel(a);}catch(_){ }
  if(!vm)return [];
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var fam=gmActFamily(vm.sportId);
  var th=gmStoryTheme(fam);
  var accCss='--acc:'+th.acc+';--accsoft:'+th.soft;
  var pages=[];
  /* Legacy-Sessions tragen ein synthetisches T00:00 — keine gemessene Uhrzeit. */
  var dl=(vm.date?((typeof fmtDate==='function')?fmtDate(vm.date):vm.date):'')+((vm.time&&!(vm.source==='legacy_local'&&vm.time==='00:00'))?' · '+vm.time:'');
  var title=vm.title||vm.sportLabel||'Training';
  var top='<div class="wst-top"><b>'+gmEsc(title)+'</b><span>'+gmEsc(dl)+(vm.source?' · '+gmEsc(gmActSrcLabel(vm.source)):'')+'</span></div>';
  var page=function(mid,footHtml){return '<div class="wst-bg" style="'+accCss+'"></div><div class="wst-in" style="'+accCss+'">'+top+'<div class="wst-mid">'+mid+'</div>'+(footHtml||'')+'</div>';};
  var foot=function(hl,sub){return '<div class="wst-foot"><div class="wst-hl">'+hl+'</div>'+(sub?'<div class="wst-hsub">'+gmEsc(sub)+'</div>':'')+'</div>';};
  var em=function(v){return '<em class="wst-em">'+gmEsc(String(v))+'</em>';};
  /* Verknuepfte Legacy-Session (Splits/Saetze/RPE/Debrief): storyRef ODER _legacy. */
  var sess=null;
  try{if(vm.storyRef&&typeof DB!=='undefined'){var e0=DB[vm.storyRef.date];sess=(e0&&e0.sessions&&e0.sessions[vm.storyRef.typ])||null;}}catch(_){ }
  try{if(!sess&&a&&a._legacy&&typeof DB!=='undefined'){var e1=DB[a._legacy.date];sess=(e1&&e1.sessions&&e1.sessions[a._legacy.type])||null;}}catch(_){ }
  var st=vm.canonicalStreams||null;
  var cleanArr=function(arr,conv){if(!Array.isArray(arr))return null;var out=[];for(var i=0;i<arr.length;i++){var v=arr[i];if(typeof v==='number'&&isFinite(v)){var w=conv?conv(v):v;if(w!=null&&isFinite(w))out.push(w);}}return out.length>=5?out:null;};
  var hr=cleanArr(st&&st.heart_rate,null);
  var gym=(fam==='gym')?gmActGymAgg(a,vm,sess):null;
  /* ---------- Headline: faktischer Satz aus echten Feldern ---------- */
  var VERB={running:'gelaufen',trail_running:'gelaufen',walking:'gegangen',hiking:'gewandert',cycling:'Rad gefahren',swimming:'geschwommen',rowing:'gerudert'};
  var PLAY={football:1,handball:1,basketball:1,tennis:1,padel:1,volleyball:1,table_tennis:1,tabletennis:1};
  var sNorm=null;try{sNorm=(window.ORVIA&&ORVIA.trainingDomain&&ORVIA.trainingDomain.normSport)?ORVIA.trainingDomain.normSport(vm.sportId):null;}catch(_){ }
  sNorm=(sNorm||String(vm.sportId||'')).toLowerCase();
  var durTxt=vm.durationLabel||null;
  /* Rad: Ø-Geschwindigkeit (km/h) aus Summary bzw. Distanz/Dauer — reine Arithmetik
     echter Werte; das /km-Tempo waere fuer Rad die falsche Konvention. */
  var spdAvg=(function(){var s6=(a&&a.summary)||{};var d6=(a&&a.durationSeconds)||null;
    if(s6.avgSpeedKmh!=null&&isFinite(s6.avgSpeedKmh)&&s6.avgSpeedKmh>0)return Math.round(s6.avgSpeedKmh*10)/10;
    if(s6.distanceKm>0&&d6>0)return Math.round(s6.distanceKm/(d6/3600)*10)/10;return null;})();
  var subParts=[];
  if(fam==='cycling'){if(spdAvg!=null)subParts.push('Ø '+fmtDe(spdAvg)+' km/h');}
  else if(vm.paceLabel)subParts.push('Ø '+vm.paceLabel);
  if(durTxt)subParts.push(durTxt);
  if(vm.avgHr!=null)subParts.push('Ø HF '+vm.avgHr+' bpm');
  if(vm.caloriesKcal!=null)subParts.push(fmtDe(vm.caloriesKcal)+' kcal');
  var sub=subParts.join(' · ');
  var hl;
  if(fam==='gym'&&gym&&gym.exCount){
    hl='Du hast '+em(gym.exCount+(gym.exCount===1?' Übung':' Übungen'))+(gym.setCount?' mit '+em(gym.setCount+' Sätzen'):'')+' absolviert.';
    sub=[gym.volumeKg?gmKg(gym.volumeKg)+' kg bewegtes Volumen':null,durTxt,vm.avgHr!=null?'Ø HF '+vm.avgHr+' bpm':null].filter(Boolean).join(' · ');
  }else if(VERB[sNorm]&&vm.distanceLabel){
    hl='Du bist '+em(vm.distanceLabel)+' '+VERB[sNorm]+'.';
  }else if(VERB[sNorm]&&durTxt){
    hl='Du bist '+em(durTxt)+' '+VERB[sNorm]+'.';
  }else if(PLAY[sNorm]&&durTxt){
    hl='Du hast '+em(durTxt)+' '+gmEsc(vm.sportLabel||'')+' gespielt.';
  }else if(durTxt){
    hl='Du hast '+em(durTxt)+' '+gmEsc(vm.sportLabel||'Training')+' absolviert.';
  }else{
    hl=gmEsc(vm.sportLabel||'Einheit')+' abgeschlossen.';
  }
  /* ---------- 1) Cover: Route (zeichnet sich) oder grosse Kennzahl ---------- */
  var route=(vm.canonicalRoute&&vm.canonicalRoute.length>1)?vm.canonicalRoute:null;
  var cover='';
  if(route&&typeof routeSVG==='function'){
    /* GM7.9e: Cover-Route im echten Seitenverhaeltnis der Strecke und ohne Kachel-
       hintergrund, damit sie die freie Seitenhoehe nutzt. pathLength normiert die
       Zeichenanimation auf die tatsaechliche Pfadlaenge (vorher fester Schaetzwert). */
    try{var svg=routeSVG(route,{aspect:'auto',noBg:true});
      svg=svg.replace('<path d="','<path class="gm-route-line" pathLength="1" style="--rl:1" d="');
      cover='<div class="wst-map big">'+svg+'</div>';}catch(_){ }
  }
  if(!cover){
    var bigV=(fam==='gym'&&gym&&gym.setCount)?[String(gym.setCount),'Sätze']
      :(vm.distanceLabel?[vm.distanceLabel,'Distanz']:(durTxt?[durTxt,'Dauer']:null));
    cover=bigV?'<div class="wst-bignum'+(String(bigV[0]).length>6?' long':'')+'"><b>'+gmStoryBigVal(bigV[0])+'</b><span>'+gmEsc(bigV[1])+'</span></div>':'';
  }
  /* Ohne Route: grosse Kennzahl mittig auf der Seite (Kick + Zahl zentriert). */
  pages.push(page('<div class="wst-kick'+(route?'':' ctr')+'">Einheit abgeschlossen</div>'+cover,foot(hl,sub)));
  /* ---------- 1b) Neue Bestzeit — zwei kanonische Wege, EINE Rangfolge:
     (1) DISTANZ-Bestzeit aus dem kanonischen Bestzeitenmodell (bestTimes().meas):
         stammt eine gemessene 1/5/10-km-Bestzeit aus GENAU dieser Aktivitaet,
         ist das der staerkste Beleg — Runden-/Streamfenster, nicht Durchschnitt.
     (2) Sonst der bisherige Ganz-Aktivitaeten-Vergleich (gmActPersonalBest):
         beantwortet die ANDERE Frage „schnellster Lauf/Ride insgesamt".
     Damit ist die fruehere Doppel-Wahrheit aufgeloest: das Distanzmodell fuehrt,
     der Aktivitaetsvergleich bleibt als klar benannter Zusatz. */
  try{
    var distPB=null;
    try{
      if(fam==='pace'&&typeof bestTimes==='function'){
        var _bt2=bestTimes();var _aid2=a.clientRecordId||a.id||a.sourceRecordId||null;
        if(_bt2&&_bt2.meas&&_aid2){
          ['k1','k5','k10'].forEach(function(kk){var m2=_bt2.meas[kk];
            if(m2&&m2.activityId===_aid2&&(!distPB||m2.targetKm>distPB.targetKm))distPB=m2;});
        }
      }
    }catch(_){ }
    if(distPB){
      var GOLD2='#DCC79A',GOLDSOFT2='rgba(220,199,154,.35)';
      var _fs3=function(sec){var m3=Math.floor(sec/60),s3=Math.round(sec%60);return m3+':'+String(s3).padStart(2,'0');};
      pages.push('<div class="wst-bg pr" style="--acc:'+GOLD2+';--accsoft:'+GOLDSOFT2+'"></div><div class="wst-in" style="--acc:'+GOLD2+';--accsoft:'+GOLDSOFT2+'">'+top+
        '<div class="wst-mid"><div class="wst-kick pr">'+icon('bolt','sm')+'<span>Neue Bestzeit · gemessen</span></div><div class="wst-prval">'+gmEsc(fmtDe(distPB.targetKm))+' km in '+gmEsc(_fs3(distPB.sec))+'</div></div>'+
        foot('Deine schnellste gemessene '+em(fmtDe(distPB.targetKm)+' km')+'-Strecke — '+(distPB.method==='stream_window'?'aus den Messreihen deiner Uhr':distPB.method==='lap_window'?'aus den Runden deiner Uhr':'aus dieser Aktivität')+'.','Gemessen über '+fmtDe(distPB.km)+' km — keine Schätzung.')+'</div>');
    }
    var pb=distPB?null:gmActPersonalBest(a,vm,fam);
    if(pb){
      var GOLD='#DCC79A',GOLDSOFT='rgba(220,199,154,.35)';
      var prTitle=(pb.cur.kind==='speed')?'Neue Bestleistung':'Neue Bestzeit';
      var curTxt=(pb.cur.kind==='speed')?(fmtDe(Math.round(pb.cur.metric*10)/10)+pb.cur.unit):(fmtPace(pb.cur.metric)+pb.cur.unit);
      var prevTxt=(pb.cur.kind==='speed')?(fmtDe(Math.round(pb.bestOther*10)/10)+pb.cur.unit):(fmtPace(pb.bestOther)+pb.cur.unit);
      var prSub;
      if(pb.cur.kind==='speed'){
        var dKmh=Math.round((pb.cur.metric-pb.bestOther)*10)/10;
        prSub=fmtDe(dKmh)+' km/h schneller als deine bisherige Bestleistung ('+prevTxt+')';
      }else{
        var dSec=Math.max(0,Math.round(pb.bestOther-pb.cur.metric));
        prSub=fmtPace(dSec)+' schneller pro '+(pb.cur.kind==='pace100'?'100 m':'km')+' als deine bisherige Bestzeit ('+prevTxt+')';
      }
      pages.push('<div class="wst-bg pr" style="--acc:'+GOLD+';--accsoft:'+GOLDSOFT+'"></div><div class="wst-in" style="--acc:'+GOLD+';--accsoft:'+GOLDSOFT+'">'+top+
        '<div class="wst-mid"><div class="wst-kick pr">'+icon('bolt','sm')+'<span>'+prTitle+'</span></div><div class="wst-prval">'+gmEsc(curTxt)+'</div></div>'+
        foot(em(prTitle)+'!',prSub)+'</div>');
    }
  }catch(_){ }
  /* ---------- 2) Runden — fliegen gestaffelt von links ein ---------- */
  try{
    var laps=(vm.canonicalSplits&&vm.canonicalSplits.length)?vm.canonicalSplits:((sess&&Array.isArray(sess.splits)&&sess.splits.length)?sess.splits:null);
    if(laps&&laps.length>=2){
      var secs=laps.map(function(x){return x.sec;});
      var fast=Math.min.apply(null,secs),slow=Math.max.apply(null,secs),rngL=(slow-fast)||1;
      var fmtL=function(sec){var m=Math.floor(sec/60),s3=Math.round(sec%60);return m+':'+String(s3).padStart(2,'0');};
      var iFast=secs.indexOf(fast);
      var maxRows=9,shown=laps.slice(0,maxRows);
      var rows=shown.map(function(x,i){
        var w=34+(1-(x.sec-fast)/rngL)*62;
        var full=(x.km==null)||Math.abs(x.km-1)<=0.05;
        var lbl=full?String(i+1):(fmtDe(x.km)+' km');
        return '<div class="wst-lap'+(i===iFast?' best':'')+'" style="animation-delay:'+(140+i*95)+'ms"><span>'+gmEsc(lbl)+'</span><i style="width:'+w.toFixed(0)+'%"></i><strong>'+fmtL(x.sec)+'</strong></div>';
      }).join('');
      pages.push(page('<div class="wst-kick">Runden</div><div class="wst-laps">'+rows+'</div>'+(laps.length>maxRows?'<div class="wst-note">+ '+(laps.length-maxRows)+' weitere im Aktivitätsdetail.</div>':''),
        foot('Schnellste Runde: '+em(fmtL(fast)),'Runde '+(iFast+1)+' von '+laps.length+' · langsamste '+fmtL(slow))));
    }
  }catch(_){ }
  /* ---------- 3) Gym: Uebungen & Saetze — fliegen gestaffelt ein ---------- */
  if(fam==='gym'&&gym&&gym.list&&gym.list.length){
    var exRows=gym.list.slice(0,8).map(function(e,i){
      var det;
      if(e.sets&&e.sets.length){
        det=e.sets.map(function(s4){
          if(s4.weight!=null&&s4.reps!=null)return fmtDe(s4.weight)+' kg × '+s4.reps;
          if(s4.reps!=null)return s4.reps+' Wdh.';
          return s4.weight!=null?fmtDe(s4.weight)+' kg':'—';
        }).join(' · ');
      }else{
        det=[(e.setsN?e.setsN+' Sätze':null),(e.kg!=null?fmtDe(e.kg)+' kg':null),(e.reps!=null?'× '+e.reps:null)].filter(Boolean).join(' · ')||'—';
      }
      return '<div class="wst-ex" style="animation-delay:'+(140+i*95)+'ms"><div class="wst-exh"><b>'+gmEsc(e.name)+'</b>'+(e.volumeKg?'<span>'+gmKg(e.volumeKg)+' kg</span>':'')+'</div><div class="wst-exd">'+gmEsc(det)+'</div></div>';
    }).join('');
    pages.push(page('<div class="wst-kick">Übungen</div><div class="wst-laps">'+exRows+'</div>'+(gym.list.length>8?'<div class="wst-note">+ '+(gym.list.length-8)+' weitere im Aktivitätsdetail.</div>':''),
      foot(gym.setCount?em(gym.setCount+' Sätze')+' im Log.':'Dein Krafttraining.',gym.volumeKg?gmKg(gym.volumeKg)+' kg Gesamtvolumen — Summe aus Gewicht × Wiederholungen':null)));
  }
  /* ---------- 4) Herzfrequenz: Dot-Matrix-Flaeche ueber die ganze Seite ---------- */
  if(hr){
    var hrAvg=Math.round(hr.reduce(function(x,y){return x+y;},0)/hr.length);
    var hrMax=Math.max.apply(null,hr);
    pages.push(page('<div class="wst-kick">Herzfrequenz</div>'+gmStoryDotChart(hr,' bpm',0),
      foot('Ø '+em(hrAvg+' bpm')+' über die Einheit.','Maximal '+hrMax+' bpm · gemessene Werte, nichts nachgerechnet')));
  }
  /* ---------- 5) Rad: Geschwindigkeit als Dot-Matrix (reine km/h-Umrechnung) ---------- */
  if(fam==='cycling'){
    var spdC=cleanArr(st&&st.speed,function(v){return v>0?v*3.6:null;});
    if(spdC){
      var spAvg=Math.round(spdC.reduce(function(x,y){return x+y;},0)/spdC.length*10)/10;
      pages.push(page('<div class="wst-kick">Geschwindigkeit</div>'+gmStoryDotChart(spdC,' km/h',1),
        foot('Ø '+em(fmtDe(spAvg)+' km/h')+'.','Gemessene Geschwindigkeit — reine Einheitenumrechnung aus m/s')));
    }
  }
  /* ---------- 6) Kennzahlen-Raster: nur belegte Zellen, gestaffelt ---------- */
  var cells=[];
  if(vm.distanceLabel)cells.push([vm.distanceLabel,'Distanz']);
  if(durTxt)cells.push([durTxt,'Dauer']);
  if(fam==='cycling'){if(spdAvg!=null)cells.push([fmtDe(spdAvg)+' km/h','Ø Geschwindigkeit']);}
  else if(vm.paceLabel)cells.push([vm.paceLabel,'Ø Tempo']);
  if(vm.avgHr!=null)cells.push([vm.avgHr+' bpm','Ø Herzfrequenz']);
  if(vm.maxHr!=null)cells.push([vm.maxHr+' bpm','Max. Herzfrequenz']);
  if(gym){
    if(gym.exCount!=null)cells.push([String(gym.exCount),'Übungen']);
    if(gym.setCount!=null)cells.push([String(gym.setCount),'Sätze']);
    if(gym.volumeKg!=null)cells.push([gmKg(gym.volumeKg)+' kg','Volumen']);
  }
  var cad=null;try{var cs2=st&&st.cadence;if(Array.isArray(cs2)){var sm2=0,nn=0;cs2.forEach(function(v){if(typeof v==='number'&&isFinite(v)){sm2+=v;nn++;}});cad=nn?Math.round(sm2/nn):null;}}catch(_){ }
  if(cad!=null&&fam==='pace')cells.push([cad+' spm','Ø Schrittfrequenz']);
  if(vm.elevationM!=null&&(fam==='pace'||fam==='cycling'))cells.push([vm.elevationM+' m','Höhenmeter']);
  if(vm.caloriesKcal!=null)cells.push([fmtDe(vm.caloriesKcal)+' kcal','Energie']);
  var rpe0=(a&&a.summary&&a.summary.rpe!=null)?a.summary.rpe:((sess&&sess.rpe!=null)?sess.rpe:null);
  if(rpe0!=null)cells.push(['RPE '+rpe0,'Belastung']);
  if(cells.length>=2){
    pages.push(page('<div class="wst-kick">Deine Zahlen</div><div class="wst-grid">'+cells.slice(0,8).map(function(c,i){
      return '<div class="wst-cell" style="animation-delay:'+(120+i*80)+'ms"><b>'+gmEsc(String(c[0]))+'</b><span>'+gmEsc(c[1])+'</span></div>';}).join('')+'</div>',
      foot('Alles aus deiner Einheit.','Werte unverändert aus der Aktivitätsquelle — ORVIA rechnet nichts nach')));
  }
  /* ---------- 7) Debrief: nur bestehende produktive Bewertung ---------- */
  var rate2=null;try{if(vm.sportId==='running'&&sess&&typeof rateActivity==='function')rate2=rateActivity('Laufen',sess);}catch(_){ }
  if(rate2){
    pages.push(page('<div class="wst-kick">ORVIA Debrief</div><div class="wst-debrief">'+gmEsc(rate2.txt)+'</div>'+
      '<div class="wst-tags"><span>Beibehalten: '+gmEsc(rate2.badge||'—')+'</span>'+(rate2.next?'<span>'+gmEsc(rate2.next)+'</span>':'')+'</div>',
      foot('Eingeordnet: '+em(rate2.badge||'—'),null)));
  }
  /* ---------- 8) Wirkung auf die Belastung: kanonisches Lastmodell, nur F/P ---------- */
  if(lvl!=='a'){
    try{
      var L2=(typeof allLoads==='function')?allLoads():null,S2=null,lcc2=null;
      if(L2&&Calc&&Calc.loadSeries){S2=Calc.loadSeries(L2.loads);lcc2=Calc.loadConfidenceContract?Calc.loadConfidenceContract(L2.confidence):null;}
      var sup3=!!(lcc2&&lcc2.suppressNumbers);
      if(S2&&S2.ctl&&S2.ctl.length&&!sup3){
        var ctl2=Math.round(S2.ctl[S2.ctl.length-1]),atl2=Math.round(S2.atl[S2.atl.length-1]);
        var tsb2=(S2.tsb&&S2.tsb.length)?Math.round(S2.tsb[S2.tsb.length-1]):(ctl2-atl2);
        pages.push(page('<div class="wst-kick">Wirkung</div><div class="wst-grid">'+[[String(ctl2),'Fitness (CTL)'],[String(atl2),'Ermüdung (ATL)'],[(tsb2>=0?'+':'')+tsb2,'Form (TSB)']].map(function(c,i){
          return '<div class="wst-cell" style="animation-delay:'+(120+i*80)+'ms"><b>'+gmEsc(String(c[0]))+'</b><span>'+gmEsc(c[1])+'</span></div>';}).join('')+'</div>',
          foot('Deine Belastung heute.','Tageswerte des kanonischen Lastmodells (sRPE) — dieselbe Serie wie die Belastungssteuerung, read-only')));
      }
    }catch(_){ }
  }
  return pages;
}
function gmStoryStop(){if(_gmStory.timer){clearTimeout(_gmStory.timer);_gmStory.timer=null;}}
function gmStoryRender(){
  var host=document.getElementById('gmStory');if(!host)return;
  var n=_gmStory.pages.length;if(!n)return;
  var bars='<div class="wst-bars">'+_gmStory.pages.map(function(_,i){
    return '<i class="'+(i<_gmStory.idx?'done':(i===_gmStory.idx?'act':''))+'"><b></b></i>';}).join('')+'</div>';
  host.innerHTML=bars+
    '<button class="wst-x" aria-label="Story schließen" onclick="gmStoryClose()">'+icon('x','sm')+'</button>'+
    '<button class="wst-nav prev" aria-label="Zurück" onclick="gmStoryPrev()"></button>'+
    '<button class="wst-nav next" aria-label="Weiter" onclick="gmStoryNext()"></button>'+
    _gmStory.pages.map(function(p,i){return '<div class="wst-page'+(i===_gmStory.idx?' on':'')+'">'+p+'</div>';}).join('');
  /* Auto-Weiterschaltung wie im Story-Muster; Tap uebersteuert jederzeit. */
  gmStoryStop();
  try{host.style.setProperty('--st-dur',(GM_STORY_MS/1000)+'s');}catch(_){ }
  _gmStory.timer=setTimeout(function(){gmStoryNext();},GM_STORY_MS);
}
function gmStoryNext(){if(_gmStory.idx>=_gmStory.pages.length-1){gmStoryClose();return;}_gmStory.idx++;gmStoryRender();}
function gmStoryPrev(){if(_gmStory.idx<=0)return;_gmStory.idx--;gmStoryRender();}
function gmStoryClose(){
  gmStoryStop();
  var host=document.getElementById('gmStory');
  if(host){host.classList.remove('on');host.setAttribute('aria-hidden','true');host.innerHTML='';}
  try{document.documentElement.style.overflow='';}catch(_){ }
  gmStoryMarkSeen(_gmStory.aid);
  _gmStory.pages=[];_gmStory.idx=0;_gmStory.hrSeries=null;
  try{if(_gmLastFocus&&_gmLastFocus.focus)_gmLastFocus.focus();}catch(_){ }
}
function gmOpenStory(aid){
  var host=document.getElementById('gmStory');if(!host)return false;
  var a=null;try{a=(typeof _resolveActivityAny==='function')?_resolveActivityAny(aid):null;}catch(_){ }
  if(!a)return false;
  var pages=gmStoryPages(a);
  if(pages.length<2)return false;            /* zu wenig echte Daten => keine Story */
  try{_gmLastFocus=document.activeElement;}catch(_){ }
  _gmStory.pages=pages;_gmStory.idx=0;_gmStory.aid=aid;
  host.classList.add('on');host.setAttribute('aria-hidden','false');
  try{document.documentElement.style.overflow='hidden';}catch(_){ }
  gmStoryRender();
  try{host.focus&&host.setAttribute('tabindex','-1');host.focus&&host.focus();}catch(_){ }
  /* Escape/Pfeiltasten: GENAU EINMAL global gebunden (kein Listener-Zuwachs). */
  try{
    if(!window._gmStoryKeyBound){window._gmStoryKeyBound=1;
      document.addEventListener('keydown',function(ev){
        var h=document.getElementById('gmStory');
        if(!h||!h.classList.contains('on'))return;
        if(ev.key==='Escape'){ev.preventDefault();gmStoryClose();}
        else if(ev.key==='ArrowRight'||ev.key===' '||ev.key==='Enter'){ev.preventDefault();gmStoryNext();}
        else if(ev.key==='ArrowLeft'){ev.preventDefault();gmStoryPrev();}
      });}
  }catch(_){ }
  return true;
}
/* Auto-Start: neueste abgeschlossene Einheit der letzten 48 h, die noch nie als Story
   gezeigt wurde. Genau EIN Versuch je Sitzung — kein wiederholtes Aufpoppen. */
function gmMaybeAutoStory(force){
  try{
    if(!force&&window._gmStoryChecked)return false;
    window._gmStoryChecked=1;
    var host=document.getElementById('gmStory');if(!host||host.classList.contains('on'))return false;
    if(typeof PROFILE==='undefined'||!PROFILE)return false;   /* Profil (und damit „gesehen") noch nicht hydriert */
    var list=[];try{list=listActivitiesUnified(12)||[];}catch(_){ }
    if(!list.length)return false;
    /* Genau EINE Kandidatin: die NEUESTE abgeschlossene Einheit. Ist sie bereits gesehen,
       endet der Versuch — es wird bewusst nicht in aelteren Eintraegen weitergesucht
       (sonst poppt beim ersten Start eine Story zu einer laengst bekannten Einheit auf). */
    var cand=null,candTs=-1;
    for(var i=0;i<list.length;i++){
      var a=list[i];if(!a)continue;
      if(a.status&&a.status!=='completed')continue;
      var ts=Date.parse(a.startedAt||a.createdAt||'');
      if(!isFinite(ts))continue;
      if(ts>candTs){candTs=ts;cand=a;}
    }
    if(!cand)return false;
    if(candTs<Date.now()-48*3600*1000)return false;            /* nicht mehr frisch */
    var id=cand.clientRecordId||cand.id;if(!id)return false;
    if(gmStorySeen().indexOf(id)>=0)return false;              /* bereits erzaehlt */
    if(gmOpenStory(id))return true;
    gmStoryMarkSeen(id);   /* zu wenig echte Daten fuer eine Story: nicht erneut versuchen */
  }catch(_){ }
  return false;
}

/* ====== GM4: Analyse mit vier Segmenten (finale aktive analysisHubView des Golden Masters:
   hdr → seg-nav[Überblick|Ausdauer|Erholung|Körper] → genau EIN Segment → tabspacer).
   Daten AUSSCHLIESSLICH aus kanonischen Quellen: gmDashVM/orviaScore (Decision/Readiness),
   allLoads()+Calc.loadSeries/loadModel/loadConfidenceContract (D1, read-only),
   profileMetricResolver-Tagescache (D2, EIN Snapshot für Kachel+Sheet), weekInsights(),
   weekRunKm/weeklyActivityTotals, ORVIA.gymVolume.getProductiveVolumeModel()+
   explainMuscleVolume() (Muskelengine, 15 kanonische IDs). Keine Demo-Serien, keine
   UI-Ersatzberechnung; A/F/P ändern nur Darstellungstiefe, nie Fachwerte. ====== */
var gmAnaSeg='overview';
var gmBodySide='front';
var gmBodyRange=28;
var _gmMvModel=(typeof window!=='undefined'&&window._gmMvModel)||null;   /* {days,model} — geteilter Engine-Snapshot (auch window._mvModel) */
var _gmMvLoading=false;
var _gmAnaCollecting=false;
var _gmAnaFocusSeg=null;
/* --- GM6.1 §3: produktive Ladezustaende der Analyse ------------------------
   Die Analyse besitzt ZWEI echte, bereits vorhandene asynchrone Grenzen:
     1. gmAnaResolved()  → ORVIA.profileMetricResolver.collect(...)   (Erholung)
     2. gmAnaBodyModel() → ORVIA.gymVolume.getProductiveVolumeModel() (Koerper)
   Beide wurden bisher waehrend des Ladens als „—" bzw. „Keine Daten" gerendert —
   das ist unehrlich, weil unbekannt und leer nicht unterscheidbar waren. Ab hier
   melden beide ihren Lebenszyklus, die Renderer zeigen die GM-Skelette und im
   Fehlerfall die GM-.errbar. Rein visuelle Orchestrierung: kein zusaetzlicher
   Netzwerkaufruf, keine kuenstliche Wartezeit, keine neue Datenlogik.
   _gmAnaReq/_gmMvReq2 sind Anfrage-Sequenzen: eine verspaetet eintreffende
   aeltere Antwort wird verworfen und ueberschreibt keinen neueren Zustand
   (dasselbe Muster wie _mvReq in renderMuscleVolume()). */
var _gmAnaState=null;   /* null | 'loading' | 'error' — Resolver-Snapshot   */
var _gmMvState=null;    /* null | 'loading' | 'error' — Muskelvolumenmodell */
var _gmAnaReq=0;
var _gmMvReq2=0;
/* Retry: setzt ausschliesslich die eigenen Ladezustaende zurueck, verwirft
   laufende (aeltere) Antworten ueber die Sequenznummer und ruft den bereits
   vorhandenen Renderer erneut auf. Keine Engine-, Store- oder Persistenzaktion. */
function gmAnaRetry(){
  /* Phase 1 · KF-006: _gmMvModel wurde NICHT zurueckgesetzt. gmMvModel() liefert
     bei passender Tagesspanne den gecachten Snapshot zurueck (js/ui.js, Zweig
     `if(_gmMvModel&&_gmMvModel.days===gmBodyRange)`) — ein einmal gespeichertes
     Fehlermodell kam damit unveraendert zurueck und „Erneut versuchen" blieb
     wirkungslos. */
  _gmMvModel=null;
  _gmAnaState=null;_gmMvState=null;
  _gmAnaReq++;_gmMvReq2++;
  _gmAnaCollecting=false;_gmMvLoading=false;
  if(typeof renderGMAnalysis==='function'&&document.getElementById('gmAna'))renderGMAnalysis();
}
function gmSetAnaSeg(s){gmAnaSeg=s;_gmAnaFocusSeg=s;renderGMAnalysis();}
function gmSetBodySide(s){gmBodySide=(s==='back')?'back':'front';renderGMAnalysis();}
function gmSetBodyRange(d){gmBodyRange=d;_gmMvModel=null;renderGMAnalysis();}
/* --- gemeinsamer Lastkontext (genau EINE Lastmodell-Abfrage pro Render) --- */
function gmAnaLoadCtx(){
  var out={ld:null,lcc:null,S:null,lm:null,ok:false};
  try{
    out.ld=allLoads();
    out.lcc=(typeof Calc!=='undefined'&&Calc.loadConfidenceContract)?Calc.loadConfidenceContract(out.ld.confidence):{tier:'hoch',suppressNumbers:false,ctlAtlNote:null};
    if(!out.lcc.suppressNumbers&&typeof Calc!=='undefined'&&Calc.loadSeries){
      out.S=Calc.loadSeries(out.ld.loads||[]);
      out.ok=((out.S.ctl||[]).length>=14);
    }
    if(typeof Calc!=='undefined'&&Calc.loadModel)out.lm=Calc.loadModel(out.ld.loads||[]);
  }catch(_){ }
  return out;
}
/* --- Resolver-Snapshot (identischer Tagescache wie D2 — kein Doppel-Collect) --- */
function gmAnaResolved(){
  var c=(typeof window!=='undefined')?window._metricsResolved:null;
  /* GM7: Fenster-Marker — ein 3-Tage-Dashboard-Cache darf die Analyse nicht bedienen
     (VO2max staleDays=90, Schwelle=180 fielen sonst strukturell aus dem Fenster). */
  if(c&&c.date===todayStr()&&c.resolved&&(c.days==null||c.days>=180)){_gmAnaState=null;return c.resolved;}
  var P=window.ORVIA&&ORVIA.profileMetricResolver;
  /* GM6.1 §3: nach einem Fehler wird NICHT automatisch neu geladen. Ohne diesen
     Riegel startet jedes Re-Render sofort den naechsten Collect, der Fehlerzustand
     waere nie sichtbar und ein dauerhaft fehlschlagender Resolver erzeugte eine
     Endlosschleife aus Aufrufen. Aufloesung ausschliesslich ueber gmAnaRetry(),
     das _gmAnaState wieder auf null setzt (bestehende, sichere Aktion). */
  if(P&&typeof P.collect==='function'&&!_gmAnaCollecting&&_gmAnaState!=='error'){
    _gmAnaCollecting=true;var t=todayStr();
    /* GM6.1 §3: ab hier laeuft ein echter, bereits vorhandener Ladevorgang. */
    _gmAnaState='loading';
    var req=++_gmAnaReq;
    var done=function(st){
      if(req!==_gmAnaReq)return;              /* verspaetete aeltere Antwort: verwerfen */
      _gmAnaCollecting=false;_gmAnaState=st;
      if(document.getElementById('gmAna'))renderGMAnalysis();
      try{if(typeof gmRerenderMetricsLibrary==='function')gmRerenderMetricsLibrary();}catch(_){ }
    };
    P.collect({withMeta:true,days:180,today:t}).then(function(r){
      if(req!==_gmAnaReq)return;              /* eine neuere Anfrage besitzt den Zustand */
      if(r&&r.success){try{window._metricsResolved={date:t,days:180,resolved:(r.data&&r.data.resolved)||{},
          entries:(r.data&&r.data.entries)||[],providers:(r.data&&r.data.providers)||[],devices:(r.data&&r.data.devices)||[]};
          /* Provider-Sync-Zeile aus derselben Antwort speisen */
          try{var pv=(r.data&&r.data.providers)||[];if(pv.length){var best=null;
            pv.forEach(function(px){var ts=px.last_sync_at||px.last_sync||null;if(!best||(ts&&(!best.ts||ts>best.ts)))best={provider:px.provider_type||'Gerät',ts:ts};});
            _gmDevSync={state:'ready',provider:best.provider,lastSyncAt:best.ts,fetchedAt:Date.now()};gmApplySyncLine();}}catch(_){ }
        }catch(_){ }
        done(null);return;}
      done('error');                          /* erfolglose Antwort ist ein Fehler, kein „leer" */
    }).catch(function(){done('error');});
  }
  return null;
}
function gmAnaMetric(resolved,id){var r=resolved&&resolved[id];return (r&&(r.value!=null||r.valueText!=null))?r:null;}
function gmAnaChartEmpty(txt){return '<div class="oc2"><div class="gm-chart-empty">'+gmEsc(txt)+'</div></div>';}
/* --- Überblick --- */
function gmAnaOverview(ctx){
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var d=null;try{d=(typeof gmDashVM==='function')?gmDashVM():null;}catch(_){ }
  var heroT=(d&&d.reco&&d.reco.t)?d.reco.t:'—';
  var heroP='';
  if(d){heroP=(lvl==='a'&&d.simpleReco&&(d.simpleReco.d||d.simpleReco.t))?(d.simpleReco.d||d.simpleReco.t):(d.pro||'');}
  var sc=null;try{sc=(typeof orviaScore==='function')?orviaScore():null;}catch(_){ }
  var ctl=(ctx.ok&&ctx.S)?Math.round(ctx.S.ctl[ctx.S.ctl.length-1]):null;
  var atl=(ctx.ok&&ctx.S)?Math.round(ctx.S.atl[ctx.S.atl.length-1]):null;
  var acwrShow=(ctx.lm&&ctx.lm.acwr!=null&&ctx.lm.acwrReliable&&ctx.lcc&&!ctx.lcc.suppressNumbers)?ctx.lm.acwr:null;
  if(d&&lvl==='p'){heroP='Readiness '+(sc&&sc.score!=null?sc.score:'—')+' · CTL '+(ctl!=null?ctl:'—')+' · ACWR '+(acwrShow!=null?fmtDe(acwrShow):'—')+' — alle Werte read-only aus den kanonischen Verträgen. Grenzen setzt weiterhin der Plan. Kein UI-Rechenweg.';}
  if(!heroP)heroP=GM_NA+' — die Entscheidung erscheint nach dem Check-in aus der kanonischen Engine. ORVIA erfindet keine Erkenntnis.';
  var h='<div class="decision-hero"><div class="eyebrow">Wichtigste Erkenntnis heute</div><h2>'+gmEsc(heroT)+'</h2><p>'+gmEsc(heroP)+'</p>'+
    '<div class="decision-actions"><button onclick="gmAnaGoPlan()">Im Plan ansehen</button><button onclick="gmSetAnaSeg(\'endurance\')">Daten prüfen</button></div></div>';
  /* 4 KPI-Slots — nur kanonische Werte */
  var kpis=[
    [sc&&sc.score!=null?String(sc.score):'—','Readiness',sc&&sc.status?gmEsc(sc.status.l):'—'],
    [ctl!=null?String(ctl):'—','Fitness · CTL',lvl==='p'?('sRPE-Skala · ATL '+(atl!=null?atl:'—')):(ctl!=null?'sRPE-Skala · 42 T.':'—')],
    [acwrShow!=null?fmtDe(acwrShow):'—','Belastung ACWR',acwrShow!=null?'Lastmodell':'—'],
    (function(){/* GM7: Planerfuellung aus dem kanonischen Plan-Ist-Abgleich (7 Tage) */
      try{if(typeof planActualResolveForDates==='function'&&Calc.resolvePlanActual){
        var ds=[];var now=new Date();for(var i=6;i>=0;i--){var dd=new Date(now);dd.setDate(now.getDate()-i);ds.push(todayStr(dd));}
        var pr=planActualResolveForDates(ds)||{};var occ=pr.byOcc||{};var tot=0,donec=0;
        Object.keys(occ).forEach(function(k){tot++;if(occ[k]&&occ[k].state==='completed')donec++;});
        if(tot>0)return [Math.round(donec/tot*100)+'%','Planerfüllung','7 Tage · '+donec+'/'+tot];
      }}catch(_){ }
      return ['—','Planerfüllung','kein Plan-Ist-Abgleich'];})()
  ];
  /* Phase 4 (P2-2a): 4 Kacheln als 2×2 — bei repeat(auto-fit) wurden es 4 Spalten à ~62 px
     Inhaltsbreite, „PLANERFÜLLUNG" (≈78 px) lief über. */
  h+='<div class="kpi-row" style="grid-template-columns:repeat(2,1fr)">'+kpis.map(function(k){return '<div class="kpi"><b>'+k[0]+'</b><span>'+k[1]+'</span><small>'+k[2]+'</small></div>';}).join('')+'</div>';
  /* Form & Belastbarkeit — Serie ausschließlich Calc.loadSeries (Form/TSB) */
  h+='<div class="card"><div class="ctitle"><div class="l">'+icon('chart')+' Form &amp; Belastbarkeit</div><span class="more">14 Tage</span></div>'+
    (ctx.ok?'<div class="oc2" id="gmAnaChart"></div>':gmAnaChartEmpty((ctx.lcc&&ctx.lcc.ctlAtlNote)?ctx.lcc.ctlAtlNote:GM_NA+' — die Form-Kurve erscheint ab 14 Tagen belastbarer Lasthistorie. Keine nachgebaute Kurve.'))+'</div>';
  /* 3 Insight-Slots: Safety-Warnung zuerst (in allen Modi), dann weekInsights, Rest Missing */
  h+='<div class="sectlabel" data-gm-slot="analysis-insights">Was ORVIA daraus macht</div>';
  var slots=[];
  if(d&&d.warnings&&d.warnings.length){d.warnings.slice(0,3).forEach(function(w){slots.push({ic:'alert',b:w[1]||'Hinweis',p:w[2]||'',il:'Safety',ir:'Beachten'});});}
  var ins=[];try{ins=(typeof weekInsights==='function')?(weekInsights()||[]):[];}catch(_){ }
  ins.forEach(function(x){if(slots.length<3)slots.push({ic:'activity',b:x.statement,p:x.reason+(x.impact?' '+x.impact:''),il:gmEsc(x.area),ir:x.rec||'—'});});
  /* Phase 3 · E-25: Tip-Engine kontextuell HIER angebunden (statt eines eigenen
     versteckten Heute-Hosts). Regelbasierte Hinweise aus ECHTEN Tagesdaten
     (Beschwerden, Schlaf/HRV, Ruhepuls, Wochenvolumen) mit Konfidenz-Etikett —
     fuellen nur freie Slots, erfinden nichts und ueberstimmen nie die
     Tagesentscheidung (Safety-Gate in tipEngine, P3). */
  if((typeof gmFeatureFlag!=='function'||gmFeatureFlag('anaTips'))&&slots.length<3){
    try{
      var tips=(typeof tipEngine==='function')?(tipEngine()||[]):[];
      tips.forEach(function(t){if(slots.length>=3)return;
        slots.push({ic:t.sev>=4?'alert':t.sev>=3?'gauge':'info',b:t.title,
          p:t.reason+' (Konfidenz: '+t.conf+')',il:'Tip-Engine',ir:t.rec||'—'});});
    }catch(_){ }
  }
  while(slots.length<3)slots.push({ic:'info',b:'—',p:GM_NA+' — ORVIA zeigt hier nur echte, kanonische Muster. Es wird keine Empfehlung erfunden.',il:'Insight',ir:'—'});
  slots.slice(0,3).forEach(function(x){h+='<div class="insight-card"><div class="insight-head"><span>'+icon(x.ic,'sm')+'</span><div><b>'+gmEsc(x.b)+'</b></div></div><p>'+gmEsc(x.p)+'</p><div class="impact"><span>'+x.il+'</span><strong>'+gmEsc(x.ir)+'</strong></div></div>';});
  /* Fortschritt: 2 Mile-Slots — ohne kanonische Daten — + NA-Seite */
  h+='<div class="sectlabel" data-gm-slot="analysis-progress">Fortschritt &amp; nächster Schritt</div>';
  h+=(function(){/* Naechster Meilenstein aus dem gemessenen Achievements-Modell (2026-08-04). */
    var ach=(typeof gmAchievements==='function')?gmAchievements():null;
    var nm=(typeof gmNextMilestone==='function')?gmNextMilestone(ach):null;
    if(!nm)return '<div class="mile" role="button" tabindex="0" onclick="gmOpenAnaTeaserSheet(\'ms\')" onkeydown="if(event.key===\'Enter\')gmOpenAnaTeaserSheet(\'ms\')"><div class="mi-ic">'+icon('target','sm')+'</div><div class="mile-b"><div class="mile-t">Nächster Meilenstein: —</div><div class="mile-d">'+GM_NA+' — folgt mit deinen ersten Aktivitäten.</div><div class="mile-track"><i style="width:0%"></i></div></div>'+icon('chev','sm')+'</div>';
    return '<div class="mile" role="button" tabindex="0" onclick="gmOpenMilestonesEntry()" onkeydown="if(event.key===\'Enter\')gmOpenMilestonesEntry()"><div class="mi-ic">'+icon(nm.icon||'target','sm')+'</div><div class="mile-b"><div class="mile-t">Nächster Meilenstein: '+gmEsc(nm.label)+' '+gmEsc(gmAchFmtVal(nm.next,nm.unit))+'</div><div class="mile-d">Ist '+gmEsc(gmAchFmtVal(nm.current,nm.unit))+' — gemessen aus deinen Aktivitäten.</div><div class="mile-track"><i style="width:'+(nm.progress||0)+'%"></i></div></div>'+icon('chev','sm')+'</div>';})();
  h+=(function(){/* GM7: Bestzeiten aus bestTimes() (kanonisch, gleicher Renderer wie Profil) */
    var bt=null;try{bt=(typeof bestTimes==='function')?bestTimes():null;}catch(_){ }
    var fs0=function(sec){var m2=Math.floor(sec/60),ss=Math.round(sec%60);return m2+':'+String(ss).padStart(2,'0');};
    var t2=(bt&&bt.t5!=null)?('5 km '+fs0(bt.t5)+(bt.real.k5?'':' (Prognose)')):(bt&&bt.t10!=null)?('10 km '+fs0(bt.t10)+(bt.real.k10?'':' (Prognose)')):null;
    /* KF-021: die Unterzeile nennt die tatsaechliche Quelle des angezeigten Werts. */
    var d2=t2?(bt.n+' Läufe ausgewertet · '+gmBtSrcLabel(bt,(bt.t5!=null?'k5':'k10'))):(GM_NA+' — keine erfundene Bestzeit.');
    return '<div class="mile" role="button" tabindex="0" onclick="gmOpenBestTimesEntry()" onkeydown="if(event.key===\'Enter\')gmOpenBestTimesEntry()"><div class="mi-ic">'+icon('bolt','sm')+'</div><div class="mile-b"><div class="mile-t">'+(t2?'Beste Zeit: '+gmEsc(t2):'Letzte Bestzeit: —')+'</div><div class="mile-d">'+gmEsc(d2)+'</div></div>'+icon('chev','sm')+'</div>';})();
  return h;
}
function gmAnaGoPlan(){try{var b=document.querySelector('.tabbar button[data-tab="plan"]');if(b){b.click();return;}}catch(_){ }try{if(typeof showTab==='function')showTab('plan');}catch(_){ }}
/* --- Ausdauer --- */
function gmAnaEndurance(ctx){
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var sub=lvl==='a'?'Deine Fitness und Form auf einen Blick':lvl==='p'?'Form/Fitness-Modell, Schwellen und Prognosen':'Form, Belastung und Entwicklung je Sportart';
  var h='<div class="body-head"><div class="ana-kick">Ausdauer</div><div class="ana-sub">'+sub+'</div></div>';
  /* Form & Fitness — D1-Anbindung (CTL/ATL/TSB read-only) */
  var note=lvl==='a'?'Gold steigend = du wirst fitter.':lvl==='p'?'CTL = 42-Tage-EWMA der Tageslast (sRPE = min × RPE, keine TSS-Skala), ATL = 7-Tage-EWMA, Form = CTL − ATL — read-only.':'Fitness baut sich über Wochen auf, Ermüdung über Tage — Form ist die Differenz. Skala: sRPE-Last.';
  var ffLegend='<div class="dist-leg" style="margin-top:6px"><span><i style="background:var(--gold-soft,#c9ae7c)"></i>CTL (Fitness)</span><span><i style="background:var(--crit)"></i>ATL (Ermüdung)</span><span><i style="background:var(--ready)"></i>Form (TSB)</span></div>';
  h+='<div class="card"><div class="ctitle"><div class="l">'+icon('chart')+' Form &amp; Fitness</div><span class="more">42 Tage</span></div>'+
    (ctx.ok?'<div class="oc2" id="gmFFChart"></div>'+ffLegend:gmAnaChartEmpty((ctx.lcc&&ctx.lcc.ctlAtlNote)?ctx.lcc.ctlAtlNote:GM_NA+' — CTL/ATL erscheinen ab 14 Tagen belastbarer Lasthistorie.'))+
    '<div class="mini-note">'+icon('info','xs')+'<div>'+note+'</div></div></div>';
  /* 4 KPI — VO₂max/Schwelle aus Resolver, Wochen-km/Ausdauerdauer aus Wochenvertrag */
  var res=gmAnaResolved();
  var vo2=gmAnaMetric(res,'vo2max_running');
  var thr=gmAnaMetric(res,'lactate_threshold_pace');
  var rkm=null;try{rkm=weekRunKm(0);}catch(_){ }
  var endMin=null;
  try{var wk=(typeof gmActWeekTotals==='function')?gmActWeekTotals():null;
    if(wk&&wk.bySport){var sum=0,okAll=true,any=false;
      ['running','cycling','swimming','triathlon','rowing','hiking','walking'].forEach(function(sp){var b=wk.bySport[sp];if(!b)return;any=true;
        if(b.completeness&&b.completeness.duration===false)okAll=false;sum+=(b.knownDurationMin||0);});
      if(any&&okAll)endMin=sum;}
  }catch(_){ }
  var kv=[
    [vo2?fmtDe(vo2.value):'—','VO₂max',lvl==='a'?'—':(vo2?'Resolver':'—')],
    [thr?(Calc&&Calc.fmtPace?Calc.fmtPace(thr.value):fmtDe(thr.value)):'—','Schwelle /km',lvl==='a'?'':(thr?'LT-Pace':'—')],
    [rkm!=null?fmtDe(rkm):'—','Wochen-km','Laufen'],
    [endMin!=null?gmActFmtMin(endMin):'—','Ausdauer h','Woche']
  ];
  /* Phase 4 (P2-2a): 4 Kacheln als 2×2 (gleiche Ursache wie Übersicht). */
  h+='<div class="kpi-row" style="grid-template-columns:repeat(2,1fr)">'+kv.map(function(k){return '<div class="kpi"><b>'+gmEsc(k[0])+'</b><span>'+k[1]+'</span><small>'+k[2]+'</small></div>';}).join('')+'</div>';
  /* Wochenvolumen (nur F/P) — ausschließlich weekRunKm; fehlende Wochen ⇒ ehrlicher Zustand */
  if(lvl!=='a'){
    var wkm=[];var wkOk=true;
    for(var o=5;o>=0;o--){var v=null;try{v=weekRunKm(o);}catch(_){ }wkm.push(v);if(v==null)wkOk=false;}
    h+='<div class="card"><div class="ctitle"><div class="l">'+icon('activity')+' Wochenvolumen Laufen</div><span class="more">6 Wochen</span></div>'+
      (wkOk?'<div class="oc2" id="gmVolChart"></div>':gmAnaChartEmpty(GM_NA+' — für Wochen ohne belastbare kanonische Aggregation zeigt ORVIA keinen Balken: '+wkm.map(function(v){return v==null?'—':fmtDe(v);}).join(' · ')))+
      '<div class="mini-note">'+icon('info','xs')+'<div>Ist-Kilometer aus der kanonischen Wochenaggregation — Tageskilometer werden nie als Longrun gewertet.</div></div></div>';
  }
  /* GM7: Wettkampfprognose aus bestTimes() (Riegel-Modell) — klar als Prognose, nie als Messung. */
  h+=(function(){
    var bt=null;try{bt=(typeof bestTimes==='function')?bestTimes():null;}catch(_){ }
    var hmSec=null;try{if(bt&&bt.t10!=null&&Calc.riegelHM){var _m=Calc.riegelHM(10,bt.t10/60);if(_m!=null)hmSec=Math.round(_m*60);}}catch(_){ }
    var fs=function(sec){if(sec==null)return null;var h2=Math.floor(sec/3600),m2=Math.floor((sec%3600)/60),ss=Math.round(sec%60);
      return h2?(h2+':'+String(m2).padStart(2,'0')+':'+String(ss).padStart(2,'0')):(m2+':'+String(ss).padStart(2,'0'));};
    var rows=[['5 km',bt?bt.t5:null,bt&&bt.real.k5],['10 km',bt?bt.t10:null,bt&&bt.real.k10],['Halbmarathon',hmSec,false]];
    var body=rows.map(function(r2){var v=r2[1];
      return '<div class="calc-field" style="margin-bottom:8px"><label>'+r2[0]+'</label><div style="text-align:right"><b style="font-size:16px">'+(v!=null?gmEsc(fs(v)):'—')+'</b><div style="font-size:10px;color:var(--muted)">'+(v!=null?(r2[2]?'echte Bestzeit':'Prognose (Riegel)'):'—')+'</div></div></div>';}).join('');
    var noteP=bt?('Prognose aus deinem schnellsten Lauf ('+bt.n+' Läufe, Riegel-Exponent 1,06). Keine Garantie — Unsicherheit steigt mit der Distanz. „Echte Bestzeit" = gemessene Leistung.'):(GM_NA+' — noch keine auswertbaren Läufe für eine Prognose.');
    return '<div class="sectlabel" data-gm-slot="analysis-race-forecast">Wettkampfprognose</div><div class="card"><div class="link-row">'+body+'</div><div class="mini-note">'+icon('info','xs')+'<div>'+noteP+'</div></div></div>';})();
  /* GM7.4-A: Garmin-eigene Wettkampfprognosen (race_prediction_*, gemessen von der
     Uhr) — separat und quellen-etikettiert neben der Riegel-Prognose. NUR anzeigen,
     wenn tatsächlich Werte gespeichert sind (kein erfundener Platzhalter). */
  h+=(function(){
    var ids=[['5 km','race_prediction_5k'],['10 km','race_prediction_10k'],['Halbmarathon','race_prediction_half'],['Marathon','race_prediction_marathon']];
    var got=ids.map(function(x){var mm=gmMetric(x[1]);return {l:x[0],v:(mm&&mm.value!=null)?mm.value:null};});
    if(!got.some(function(g){return g.v!=null;}))return '';
    var fs2=function(sec){if(sec==null)return '—';var h2=Math.floor(sec/3600),m2=Math.floor((sec%3600)/60),ss=Math.round(sec%60);
      return h2?(h2+':'+String(m2).padStart(2,'0')+':'+String(ss).padStart(2,'0')):(m2+':'+String(ss).padStart(2,'0'));};
    var body2=got.map(function(g){return '<div class="calc-field" style="margin-bottom:8px"><label>'+g.l+'</label><div style="text-align:right"><b style="font-size:16px">'+(g.v!=null?gmEsc(fs2(g.v)):'—')+'</b><div style="font-size:10px;color:var(--muted)">'+(g.v!=null?'Garmin-Prognose':'—')+'</div></div></div>';}).join('');
    return '<div class="sectlabel">Garmin-Wettkampfprognose</div><div class="card"><div class="link-row">'+body2+'</div><div class="mini-note">'+icon('info','xs')+'<div>Von der Uhr gemessene Prognose (Garmin), unabhängig vom Riegel-Modell aus deinen Läufen.</div></div></div>';})();
  /* GM7.4-2: Group-1 Leistungswerte (Worker-produziert, generisches Detail-Sheet).
     Nur Kacheln mit echtem Wert (fehlend ⇒ keine Kachel, nie 0). Stale sichtbar. */
  h+=(function(){
    var perf=[['vo2max_running','VO₂max Lauf','pulse'],['vo2max_cycling','VO₂max Rad','pulse'],['endurance_score','Endurance','activity'],['running_tolerance','Run-Toleranz','activity'],['fitness_age','Fitnessalter','pulse'],['respiration_avg','Atemfrequenz','wind']];
    var tiles='',any=false;
    perf.forEach(function(p){var r=gmAnaMetric(res,p[0]);if(!r||r.value==null)return;any=true;
      var stale=r.stale?' <span class="rcv-stale">veraltet</span>':'';
      tiles+='<div class="kcard tap" role="button" tabindex="0" onclick="openMetric(\''+p[0]+'\')" onkeydown="if(event.key===\'Enter\')openMetric(\''+p[0]+'\')"><div class="kc-h"><span class="kc-ic">'+icon(p[2],'sm')+'</span><span class="kc-l">'+p[1]+'</span></div><div class="kc-v">'+gmEsc(fmtDe(r.value))+stale+'</div></div>';});
    return any?('<div class="sectlabel">Leistungswerte <span class="ana-count">tippen für Details</span></div><div class="kgrid">'+tiles+'</div>'):'';
  })();
  /* Schnellzugriff — bestehende Einstiege bzw. ehrliches NA. Unterzeile Bestzeiten aus
     derselben Quelle wie der Direct-Entry (gmOpenBestTimesEntry) — kein Widerspruch
     zwischen Kachel-Text und Zielseite. */
  var _btSub2=(function(){var b2=null;try{b2=(typeof bestTimes==='function')?bestTimes():null;}catch(_){return '—';}
    if(!b2)return '—';
    var fs2=function(sec){var m=Math.floor(sec/60),ss=Math.round(sec%60);return m+':'+String(ss).padStart(2,'0');};
    if(b2.t5!=null)return '5 km '+fs2(b2.t5)+(b2.real&&b2.real.k5?'':' (Prognose)');
    if(b2.t10!=null)return '10 km '+fs2(b2.t10)+(b2.real&&b2.real.k10?'':' (Prognose)');
    return '—';})();
  h+='<div class="sectlabel" data-gm-slot="analysis-quick-access">Schnellzugriff</div><div class="hub-actions">'+
    '<button class="hub-act" onclick="gmOpenBestTimesEntry()"><span class="ha-ic">'+icon('bolt','sm')+'</span><div><b>Bestzeiten</b><span>'+gmEsc(_btSub2)+'</span></div></button>'+
    '<button class="hub-act" onclick="gmOpenPaceCalcSheet()"><span class="ha-ic">'+icon('gauge','sm')+'</span><div><b>Pace-Rechner</b><span>Zielzeit, Pace und Prognose</span></div></button>'+
    (function(){/* Unterzeilen aus dem gemessenen Achievements-Modell; ohne Daten ehrliches NA-Sheet. */
      var ach=(typeof gmAchievements==='function')?gmAchievements():null;
      var nm=(typeof gmNextMilestone==='function')?gmNextMilestone(ach):null;
      var msSub=nm?(gmEsc(nm.label)+' '+gmEsc(gmAchFmtVal(nm.next,nm.unit))):'—';
      var mdSub=(ach&&ach.medals.length)?(ach.medals.length+' verdient'):'—';
      return '<button class="hub-act" onclick="gmOpenMilestonesEntry()"><span class="ha-ic">'+icon('target','sm')+'</span><div><b>Meilensteine</b><span>'+msSub+'</span></div></button>'+
        '<button class="hub-act" onclick="gmOpenMedalsEntry()"><span class="ha-ic">'+icon('shield','sm')+'</span><div><b>Medaillen</b><span>'+mdSub+'</span></div></button>';})()+'</div>';
  return h;
}
/* --- Erholung --- */
var GM_RCV_TILES=[
  {id:'sleep_duration_min',label:'Schlaf',ic:'moon'},
  {id:'hrv_ms',label:'HRV',ic:'pulse'},
  {id:'resting_hr',label:'Ruhepuls',ic:'heart'},
  {id:'stress_avg',label:'Stress',ic:'gauge'},
  {id:'body_battery',label:'Body Battery',ic:'battery'},
  {id:'recovery_time_h',label:'Recovery Time',ic:'heart'},
  /* GM7.4-2: Group-1 load_recovery (Garmin-Provider-Werte, keine ORVIA-Scores) */
  {id:'training_readiness',label:'Readiness',ic:'bolt'},
  {id:'acute_load',label:'Acute Load',ic:'gauge'},
  {id:'load_ratio',label:'Load Ratio',ic:'gauge'}
];
function gmAnaRecovery(){
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var sub=lvl==='a'?'Wie gut du dich erholst':lvl==='p'?'Resolver-Snapshot: Werte, Quelle, Freshness':'Schlaf, HRV, Stress und Energie im Zusammenhang';
  var h='<div class="body-head"><div class="ana-kick">Erholung</div><div class="ana-sub">'+sub+'</div></div>';
  /* GM7: Es fehlt der kanonische Erholungs-COMPOSITE (den erfindet ORVIA weiterhin nicht).
     Die vier kanonischen Einzelserien existieren und werden hier direkt gezeigt. */
  h+=(function(){
    var defs=[['sleep_duration_min','Schlaf','sleep',function(v){return fmtDe(v/60)+' h';}],
      ['hrv_ms','HRV','ready',function(v){return fmtDe(v)+' ms';}],
      ['resting_hr','Ruhepuls','crit',function(v){return fmtDe(v)+' bpm';}],
      ['body_battery','Body Battery','activity',function(v){return fmtDe(v);}]];
    var rows2='',any=false;
    defs.forEach(function(df){
      var ser=gmMetricSeries(df[0],14);
      if(ser&&ser.values.length>=3){any=true;
        rows2+='<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--hair)"><div style="width:92px;font-size:11.5px;font-weight:700;color:var(--muted)">'+df[1]+'</div><div style="flex:1;min-width:0">'+sparkline(ser.values,SC[df[2]]||'var(--ready)')+'</div><div style="width:70px;text-align:right;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums">'+gmEsc(df[3](ser.values[ser.values.length-1]))+'</div></div>';
      }else{
        rows2+='<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--hair)"><div style="width:92px;font-size:11.5px;font-weight:700;color:var(--muted)">'+df[1]+'</div><div style="flex:1;font-size:10.5px;color:var(--faint)">'+(ser?'erst '+ser.values.length+' Messwert(e)':'keine Serie gespeichert')+'</div><div style="width:70px;text-align:right;font-size:13px;font-weight:800;color:var(--muted)">—</div></div>';
      }});
    var note2=lvl==='p'?'Einzelserien aus dem kanonischen Metrik-Speicher (14 T.). Ein Erholungs-Composite existiert als Vertrag nicht — ORVIA berechnet keinen Ersatz im UI.':'Deine gemessenen Erholungswerte der letzten 14 Tage. Einen zusammengefassten Erholungswert gibt es erst mit dem entsprechenden Datenvertrag.';
    return '<div class="card"><div class="ctitle"><div class="l">'+icon('moon')+' Erholungstrend</div><span class="more">14 Tage</span></div>'+
      (any?rows2:gmAnaChartEmpty(GM_NA+' — noch keine gespeicherten Erholungsserien (min. 3 Messtage je Wert).'))+
      '<div class="mini-note" style="margin-top:8px">'+icon('info','xs')+'<div>'+note2+'</div></div></div>';})();
  /* GM6.1 §3: gmAnaResolved() MUSS vor der Zustandsabfrage laufen — der Aufruf
     startet den bereits vorhandenen Resolver-Ladevorgang und setzt _gmAnaState.
     Danach entscheidet ausschliesslich der gemeldete Lebenszyklus:
       'loading' → GM-Kachelskelette (kcard-Baustein, 1:1 aus loadingView)
       'error'   → GM-.errbar + vorhandene, sichere Re-Render-Aktion
       sonst     → unveraenderte Kachelschleife (byte-identischer Normalzustand)
     Rein visuelle Orchestrierung: kein zusaetzlicher Netzwerkaufruf, keine
     kuenstliche Wartezeit, keine Datenlogik. */
  var res=gmAnaResolved();
  h+='<div class="sectlabel" data-gm-slot="analysis-recovery-all">Alle Erholungswerte <span class="ana-count">'+(_gmAnaState==='loading'?'wird geladen':_gmAnaState==='error'?'nicht verfügbar':'tippen für Details')+'</span></div>';
  if(_gmAnaState==='error'){
    h+=gmStateError({icon:'wifi',title:'Erholungswerte konnten nicht geladen werden.',
      desc:'Die Werte sind unbekannt — ORVIA zeigt hier bewusst keine 0 und keinen Ersatzwert.',
      retry:'gmAnaRetry()'});
  }else if(_gmAnaState==='loading'){
    h+='<div class="kgrid">'+gmStateLoading({kind:'kcard',bare:false,blocks:GM_RCV_TILES.length})+'</div>';
  }else{
    h+='<div class="kgrid">';
    GM_RCV_TILES.forEach(function(t){
      var r=gmAnaMetric(res,t.id);
      var val=r?((typeof _rcvVal==='function')?_rcvVal(r):String(r.value)):'—';
      var stale=(r&&r.stale)?'<span class="rcv-stale">veraltet</span>':'';
      /* GM7.4-2: generisches Detail-Sheet (openMetric) — Quelle/Stand/Stale, funktioniert
         für alle Registry-IDs (auch recovery_time_h + neue load_recovery-Werte). */
      var tap=r?' tap" role="button" tabindex="0" onclick="openMetric(\''+t.id+'\')" onkeydown="if(event.key===\'Enter\')openMetric(\''+t.id+'\')':'"';
      var sp='';try{var ser2=gmMetricSeries(t.id,14);if(ser2&&ser2.values.length>=3)sp=sparkline(ser2.values,'var(--ready)');}catch(_){ }
      h+='<div class="kcard'+(r?tap:'')+'"><div class="kc-h"><span class="kc-ic">'+icon(t.ic,'sm')+'</span><span class="kc-l">'+t.label+'</span></div><div class="kc-v">'+gmEsc(val)+' '+stale+'</div><div class="kc-spark">'+sp+'</div></div>';
    });
    h+='</div>';
  }
  if(lvl!=='a'){
    h+='<div class="insight-card"><div class="insight-head"><span>'+icon('info','sm')+'</span><div><b>Zusammenhang</b></div></div><p>'+(lvl==='p'?GM_NA+' — keine kanonische Zusammenhangsanalyse. ORVIA erfindet keine Korrelation und keine Kausalität — es zählt nur der echte, kanonische Vertrag.':GM_NA+' — keine kanonische Analyse.')+'</p><div class="impact"><span>Empfehlung</span><strong>—</strong></div></div>';
  }
  /* Phase 3 · Block 2 (2026-08-05): Belastungsrisiko + Regenerationsdefizit —
     die strukturierten Produzenten (riskCard/recoveryDebt, intelligence.js)
     kontextuell im Erholungs-Segment angebunden. Heuristiken aus ECHTEN
     Check-in-/HRV-/Ruhepuls-/Volumendaten; Datenbasis und Regelherkunft stehen
     sichtbar dabei; unter 4 Datentagen ehrlicher Leerzustand. Safety-Gate der
     Produzenten bleibt: sie widersprechen nie der Tagesentscheidung. */
  if((typeof gmFeatureFlag!=='function'||gmFeatureFlag('recoveryIntel'))
     &&typeof riskCard==='function'&&typeof recoveryDebt==='function'){
    h+='<div class="sectlabel" data-gm-slot="recovery-risk">Belastungsrisiko &amp; Regeneration</div>';
    var _dd3=0;try{_dd3=(typeof dataDays==='function')?dataDays():0;}catch(_){ }
    if(_dd3<4){
      h+='<div class="card"><p class="muted" style="margin:0">'+GM_NA+' — belastbar ab ~7 Tagen Check-in-Daten (aktuell '+_dd3+').</p></div>';
    }else{
      try{
        var _rk=riskCard(),_rd3=recoveryDebt();
        var _cmap={g:'var(--ready)',y:'var(--attention)',r:'var(--crit)'};
        var _mk3=function(title,d){
          return '<div class="card"><div class="ctitle"><div class="l">'+icon(title==='Belastungsrisiko'?'shield':'heart')+' '+title+'</div>'+
            '<span class="pill-badge" style="background:transparent;color:'+(_cmap[d.state.c]||'var(--muted)')+';border:1px solid currentColor">'+gmEsc(d.state.l)+'</span></div>'+
            '<div class="bar-mini" style="margin:8px 0 10px"><i style="width:'+d.score+'%;background:'+(_cmap[d.state.c]||'var(--muted)')+'"></i></div>'+
            (d.why&&d.why.length?'<p style="margin:0 0 6px;font-size:12px;color:var(--muted)">'+gmEsc(d.why.join(' · '))+'</p>':'')+
            '<div class="mini-note">'+icon('info','xs')+'<div><b>Empfehlung:</b> '+gmEsc(d.rec)+'</div></div></div>';};
        h+=_mk3('Belastungsrisiko',_rk)+_mk3('Regenerationsdefizit',_rd3);
        h+='<div class="mini-note" style="margin:2px 18px 0">'+icon('db','xs')+'<div>Regelbasierte Heuristik aus Check-ins, HRV/Ruhepuls-Baselines und Wochenvolumen · Datenbasis '+_dd3+' Tage · kein Ersatz für die Tagesentscheidung.</div></div>';
      }catch(_){ }
    }
  }
  return h;
}
/* --- Körper: GM-Geometrie, rein visuell auf die 15 kanonischen Engine-IDs abgebildet --- */
var GM_BODY_FRONT=['front_delts','chest','biceps','forearms','abs','side_delts','quads'];
var GM_BODY_BACK=['upper_back','rear_delts','lats','triceps','lower_back','glutes','hamstrings','calves'];
/* GM-BPOS verbatim; Zuordnung: GM shoulders→front_delts, GM obliques→side_delts, GM traps→upper_back */
var GM_BODY_POS={
  front_delts:[[56,66,26,20,9],[158,66,26,20,9]],chest:[[85,74,26,28,9],[129,74,26,28,9]],
  biceps:[[45,92,20,40,9],[175,92,20,40,9]],forearms:[[37,138,18,44,8],[185,138,18,44,8]],
  abs:[[102,106,36,16,6],[102,126,36,16,6],[102,146,36,16,6]],side_delts:[[84,112,15,48,6],[141,112,15,48,6]],
  quads:[[86,214,28,74,12],[126,214,28,74,12]],
  upper_back:[[96,60,48,24,10]],rear_delts:[[56,70,26,18,9],[158,70,26,18,9]],
  lats:[[84,92,24,42,9],[132,92,24,42,9]],triceps:[[45,92,20,42,9],[175,92,20,42,9]],
  lower_back:[[100,136,40,28,8]],glutes:[[88,196,28,26,11],[124,196,28,26,11]],
  hamstrings:[[86,226,28,64,12],[126,226,28,64,12]],calves:[[88,298,24,56,11],[128,298,24,56,11]]
};
/* Statusdarstellung: kanonische Engine-Keys → GM-Farben/-Symbole. KEIN Warn-Status in der
   Engine ⇒ der GM-Legendenslot „Warnung" bleibt strukturell, neutral gekennzeichnet. */
var GM_MV_META={
  below:{l:'Unter Ziel',c:'var(--attention)',t:'rgba(237,180,78,.16)',sym:'▽'},
  in:{l:'Im Ziel',c:'var(--ready)',t:'rgba(67,214,147,.16)',sym:'✓'},
  above:{l:'Über Ziel',c:'var(--activity)',t:'rgba(90,160,240,.16)',sym:'▲'},
  low_history:{l:'Wenig Historie',c:'var(--sleep)',t:'rgba(149,133,237,.16)',sym:'~'},
  no_data:{l:'Keine Daten',c:'var(--faint)',t:'rgba(138,147,161,.14)',sym:'–'}
};
function gmAnaBodyModel(){
  if(_gmMvModel&&_gmMvModel.days===gmBodyRange){_gmMvState=null;return _gmMvModel.model;}
  /* GM6.1 §3: identischer Riegel wie in gmAnaResolved() — kein automatischer
     Neuversuch nach einem Fehler, Aufloesung nur ueber gmAnaRetry(). */
  if(!_gmMvLoading&&_gmMvState!=='error'&&window.ORVIA&&ORVIA.gymVolume&&ORVIA.gymVolume.getProductiveVolumeModel){
    _gmMvLoading=true;var days=gmBodyRange;
    /* GM6.1 §3: echter vorhandener Ladevorgang — Lebenszyklus wird gemeldet.
       Der Fehlerpfad rendert jetzt ebenfalls neu; vorher blieb er stumm und der
       Ladezustand waere unerreichbar bzw. dauerhaft haengen geblieben. */
    _gmMvState='loading';
    var req=++_gmMvReq2;
    var done=function(st,model){
      if(req!==_gmMvReq2)return;              /* verspaetete aeltere Antwort: verwerfen */
      _gmMvLoading=false;_gmMvState=st;
      if(st===null){_gmMvModel={days:days,model:model};
        try{window._mvModel=model;window._mvDays=days;}catch(_){ }}
      if(gmAnaSeg==='body'&&document.getElementById('gmAna'))renderGMAnalysis();
    };
    ORVIA.gymVolume.getProductiveVolumeModel({days:days,refresh:true,experience:(typeof mvExperience==='function')?mvExperience():'beginner'}).then(function(model){
      done(null,model);
    }).catch(function(){done('error',null);});
  }
  return null;
}
function gmMvSt(m){
  var st=(typeof mvStatusModel==='function')?mvStatusModel(m):{key:'no_data',label:'Keine Daten',sym:'–'};
  var meta=GM_MV_META[st.key]||GM_MV_META.no_data;
  return {key:st.key,l:meta.l,c:meta.c,t:meta.t,sym:meta.sym};
}
/* ===== GM7 / Stufe 4: ANATOMISCHE Koerperkarte =====================================
   Reaktiviert die vorhandenen anatomischen Polygone BODY_ANT/BODY_POST (Basis
   react-body-highlighter, MIT — siehe Kommentar an der Definition). KEINE neue
   Blockfigur. Explizites Mapping anatomischer Slug -> kanonische Engine-ID (15).
   Fachliche Korrektur gegenueber der Blockfigur: `obliques` gehoert zu `abs`/Core
   (seitliche BAUCHmuskulatur) — NICHT zu side_delts. side_delts/forearms haben
   keine eigene anatomische Region: side_delts teilt sich die Deltoid-Region mit
   front_delts (Front) bzw. rear_delts (Ruecken) und wird in der Liste einzeln
   gefuehrt; Status auf der Figur = front_/rear_delts.
   Tests: supabase/tests/bodymap_mapping_test.mjs */
var GM_ANAT_MAP={
  front:{chest:'chest','front-deltoids':'front_delts',biceps:'biceps',triceps:'triceps',
    abs:'abs',obliques:'abs',forearm:'forearms',quadriceps:'quads',calves:'calves',
    abductors:null,head:null,neck:null,knees:null},
  back:{trapezius:'upper_back','upper-back':'lats','back-deltoids':'rear_delts',
    triceps:'triceps','lower-back':'lower_back',gluteal:'glutes',hamstring:'hamstrings',
    calves:'calves',forearm:'forearms',abductor:null,head:null,knees:null}
};
/* Kanonische IDs ohne eigene Figur-Region (nur Liste): */
var GM_ANAT_LIST_ONLY={front:['side_delts'],back:[]};
function gmAnatPolyCenter(pts){
  try{var n=pts.trim().split(/\s+/).map(Number);var sx=0,sy=0,c=0;
    for(var i=0;i+1<n.length;i+=2){sx+=n[i];sy+=n[i+1];c++;}
    return c?[sx/c,sy/c]:[0,0];}catch(_){return [0,0];}
}
function gmBodySVG(model,side){
  var data=(side==='back')?BODY_POST:BODY_ANT;
  var map=(side==='back')?GM_ANAT_MAP.back:GM_ANAT_MAP.front;
  var byId={};((model&&model.muscles)||[]).forEach(function(m){byId[m.muscleId]=m;});
  /* Polygone je kanonischer ID buendeln (mehrere Slugs koennen auf eine ID zeigen) */
  var groups={},neutral='';
  Object.keys(data).forEach(function(slug){
    var id=map[slug];
    if(!id){data[slug].forEach(function(pts){neutral+='<polygon points="'+pts+'" fill="var(--surface-2)" stroke="rgba(0,0,0,.45)" stroke-width="0.5"/>';});return;}
    groups[id]=groups[id]||[];groups[id]=groups[id].concat(data[slug]);
  });
  var plates=Object.keys(groups).map(function(id){
    var st=gmMvSt(byId[id]);
    var name=(typeof mvLabelDe==='function')?mvLabelDe(id):id;
    var polys=groups[id].map(function(pts){return '<polygon points="'+pts+'" fill="'+st.c+'" fill-opacity=".82" stroke="rgba(0,0,0,.5)" stroke-width="0.5"/>';}).join('');
    var ctr=gmAnatPolyCenter(groups[id][0]);
    return '<g class="mgrp" role="button" tabindex="0" data-m="'+id+'" aria-label="'+gmEsc(name)+', '+gmEsc(st.l)+'" onclick="gmOpenMuscleSheet(\''+id+'\')" onkeydown="if(event.key===\'Enter\')gmOpenMuscleSheet(\''+id+'\')">'+polys+
      '<text x="'+ctr[0].toFixed(1)+'" y="'+(ctr[1]+2).toFixed(1)+'" class="mglyph" style="font-size:6px">'+st.sym+'</text></g>';
  }).join('');
  return '<svg viewBox="0 0 100 200" class="bodysvg anat" role="img" aria-label="Anatomische Muskelkarte '+(side==='front'?'Vorderseite':'Rückseite')+'">'+neutral+plates+'</svg>';
}
function gmMuscleTile(model,id){
  var byId={};((model&&model.muscles)||[]).forEach(function(m){byId[m.muscleId]=m;});
  var m=byId[id],st=gmMvSt(m);
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var name=(typeof mvLabelDe==='function')?mvLabelDe(id):id;
  var eq=(m&&m.effectiveSetEquivalents!=null)?m.effectiveSetEquivalents:null;
  var lo=(m&&m.targetRange&&m.targetRange.min!=null)?m.targetRange.min:null;
  var hi=(m&&m.targetRange&&m.targetRange.max!=null)?m.targetRange.max:null;
  var conf='—';
  if(m&&m.confidence!=null){conf=(typeof m.confidence==='string')?(CONF_LABEL_DE[m.confidence]||m.confidence):Math.round(m.confidence*100)+'%';}
  /* v8-352: „Ziel" → „Richtwert". Der Korridor ist ein Produktwert ohne
     Quelle; wer ihn „Ziel" nennt, macht ihn zur Vorgabe. */
  var sub=(eq!=null?fmtDe(eq)+' effektive Sätze':'—')+' · Richtwert '+(lo!=null&&hi!=null?lo+'–'+hi+'/Woche':'—')+(lvl==='p'?' · Konfidenz '+conf:'');
  var bar='';
  if(eq!=null&&lo!=null&&hi!=null){
    var scaleMax=Math.max(hi*1.25,eq*1.1);
    var tgtL=lo/scaleMax*100,tgtW=(hi-lo)/scaleMax*100,fill=Math.min(100,eq/scaleMax*100);
    bar='<div class="mbar"><span class="tgt" style="left:'+tgtL+'%;width:'+tgtW+'%"></span><span class="fillm" style="width:'+fill+'%;background:'+st.c+'"></span></div>';
  }else{
    bar='<div class="mbar"><span class="tgt" style="left:0;width:0"></span><span class="fillm" style="width:0"></span></div>';
  }
  return '<button class="mtile" data-m="'+id+'" onclick="gmOpenMuscleSheet(\''+id+'\')"><div class="mtile-b"><div class="mtile-t">'+gmEsc(name)+' <span class="mstat" style="color:'+st.c+';background:'+st.t+'">'+st.sym+' '+st.l+'</span></div>'+
    '<div class="mtile-sub">'+gmEsc(sub)+'</div>'+bar+'</div>'+icon('chev','sm')+'</button>';
}
function gmAnaBody(){
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var sub=lvl==='a'?'So gut deckst du deine Muskeln ab':lvl==='p'?'Effektive Satzäquivalente (direkt + indirekt) vs. Zielkorridor, mit Konfidenz':'Wöchentliches Volumen je Muskelgruppe vs. Zielkorridor';
  var h='<div class="body-head"><div class="ana-kick">Körper · Muskelvolumen</div><div class="ana-sub">'+sub+'</div></div>';
  h+='<div class="range-row">'+[7,14,28,90].map(function(d){return '<button class="range-chip '+(gmBodyRange===d?'on':'')+'" onclick="gmSetBodyRange('+d+')">'+d+' T.</button>';}).join('')+'</div>';
  h+='<div class="body-toggle"><button class="'+(gmBodySide==='front'?'on':'')+'" onclick="gmSetBodySide(\'front\')">Vorderseite</button><button class="'+(gmBodySide==='back'?'on':'')+'" onclick="gmSetBodySide(\'back\')">Rückseite</button></div>';
  /* GM6.1 §3: gmAnaBodyModel() startet den bereits vorhandenen Volumen-Ladevorgang
     und meldet den Lebenszyklus ueber _gmMvState. Kopf, Zeitraumwahl und
     Seitenumschalter bleiben in JEDEM Zustand bedienbar — sie sind reine
     UI-Zustaende und benoetigen das Modell nicht. */
  var model=gmAnaBodyModel();
  var ids=(gmBodySide==='back')?GM_BODY_BACK:GM_BODY_FRONT;
  /* GM7 (§8.3 fail closed): ein aufgeloestes Promise mit Fehler-Status ist ein FEHLER,
     kein „Keine Daten". Vorher wurde load_error/data_unavailable still als leer gerendert. */
  if(model&&(model.status==='load_error'||model.status==='data_unavailable')){
    h+=gmStateError({icon:'wifi',title:'Muskelvolumen konnte nicht geladen werden.',
      desc:(model.status==='data_unavailable'?'Der lokale Speicher war nicht bereit — das Volumen ist unbekannt, nicht null.':'Mindestens eine Datenquelle ist fehlgeschlagen — das Volumen ist unbekannt, nicht null.'),
      retry:'gmAnaRetry()'});
    return h;
  }
  if(_gmMvState==='error'){
    h+=gmStateError({icon:'wifi',title:'Muskelvolumen konnte nicht geladen werden.',
      desc:'Das Volumen ist unbekannt — fehlende Daten bedeuten nicht null Sätze.',
      retry:'gmAnaRetry()'});
    return h;
  }
  if(_gmMvState==='loading'){
    /* Karten- und Kachelbaustein — ausschliesslich die beiden echten
       Golden-Master-Skelette, an denselben Stellen wie die spaeteren Inhalte. */
    h+=gmStateLoading({blocks:1});
    h+='<div class="sectlabel" data-gm-slot="analysis-body-map">'+(gmBodySide==='front'?'Vorderseite':'Rückseite')+' <span class="ana-count">wird geladen</span></div>';
    h+='<div class="kgrid">'+gmStateLoading({kind:'kcard',blocks:ids.length})+'</div>';
    return h;
  }
  /* GM7: Zeitfenster-Fallback — leeres Fenster heisst nicht „nie Daten". */
  var _mvEmpty=!(model&&model.muscles&&model.muscles.length);
  if(_mvEmpty&&gmBodyRange<90){
    var lastGym=null;
    try{Object.keys(DB).filter(isDay).sort().reverse().some(function(k){var g2=DB[k]&&DB[k].sessions&&DB[k].sessions.Gym;if(g2){lastGym=k;return true;}return false;});}catch(_){ }
    var ago=null;try{if(lastGym&&window.ORVIA&&ORVIA.fmt)ago=ORVIA.fmt.daysBetween(lastGym,todayStr());}catch(_){ }
    h+='<div class="mini-note" style="margin-bottom:10px">'+icon('info','xs')+'<div><b>Im gewählten Zeitraum ('+gmBodyRange+' T.) liegen keine Krafttrainingsdaten.</b> '+
      (ago!=null?('Letztes Krafttraining vor '+ago+' Tagen. '):'')+
      '<span class="deeplink" role="button" tabindex="0" onclick="gmSetBodyRange(90)">Zeitraum auf 90 T. stellen</span></div></div>';
  }
  h+='<div class="body-wrap">'+gmBodySVG(model,gmBodySide)+'</div>';
  /* Legende: vollständige GM-Struktur; „Warnung" neutral als nicht verfügbar */
  var legs=[GM_MV_META.below,GM_MV_META.in,GM_MV_META.above,{l:'Warnung',c:'var(--neutral)',sym:'!'},GM_MV_META.low_history,GM_MV_META.no_data];
  h+='<div class="mlegend">'+legs.map(function(v){var na=(v.c==='var(--neutral)')?' aria-label="Warnung — Statusart mit der kanonischen Engine noch nicht verfügbar" title="Noch nicht verfügbar"':'';return '<span class="mleg"'+na+'><i style="background:'+v.c+'"></i>'+v.sym+' '+v.l+'</span>';}).join('')+'</div>';
  h+='<div class="mini-note">'+icon('info','xs')+'<div>Farbe <b>und</b> Symbol zeigen den Status. Fehlende Daten (–) bedeuten <b>nicht</b> zu wenig Training.'+(gmBodySide==='front'?' <b>Seitliche Schulter</b> hat keine eigene anatomische Region und wird unten in der Liste geführt.':'')+'</div></div>';
  h+='<div class="sectlabel" data-gm-slot="analysis-body-map">'+(gmBodySide==='front'?'Vorderseite':'Rückseite')+' <span class="ana-count">'+ids.length+' Gruppen</span></div>';
  h+='<div class="mtiles">'+ids.map(function(id){return gmMuscleTile(model,id);}).join('')+'</div>';
  return h;
}
function gmOpenMuscleSheet(id){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var model=(_gmMvModel&&_gmMvModel.model)||null;
  var byId={};((model&&model.muscles)||[]).forEach(function(m){byId[m.muscleId]=m;});
  var m=byId[id],st=gmMvSt(m);
  var name=(typeof mvLabelDe==='function')?mvLabelDe(id):id;
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var lo=(m&&m.targetRange&&m.targetRange.min!=null)?m.targetRange.min:null;
  var hi=(m&&m.targetRange&&m.targetRange.max!=null)?m.targetRange.max:null;
  var eq=(m&&m.effectiveSetEquivalents!=null)?m.effectiveSetEquivalents:null;
  var ex=null;
  try{if(m&&window.ORVIA&&ORVIA.gymVolume&&ORVIA.gymVolume.explainMuscleVolume){
    var snaps=ORVIA.gymVolume.snapshotsFromStore?ORVIA.gymVolume.snapshotsFromStore({days:gmBodyRange}):[];
    ex=ORVIA.gymVolume.explainMuscleVolume(id,snaps,{days:gmBodyRange,weeks:Math.round(gmBodyRange/7*10)/10,experience:(typeof mvExperience==='function')?mvExperience():'beginner'});
  }}catch(_){ }
  var exNames=[];try{((ex&&ex.contributions)||[]).forEach(function(c){var n=c.exerciseName||c.name;if(n&&exNames.indexOf(n)<0)exNames.push(n);});}catch(_){ }
  var eff=(eq==null||lo==null||hi==null)?(GM_NA+' — ohne Zielkorridor keine Einordnung.')
    :(eq<lo?'Aktuell <b>unter</b> dem wirksamen Bereich für spürbaren Aufbau.':eq>hi?'Aktuell <b>über</b> dem nötigen Bereich – mehr bringt kaum Zusatznutzen, erhöht aber Ermüdung.':'Aktuell im <b>wirksamen</b> Bereich für dein Ziel.')+' Direkt + indirekt zusammengefasst — unverändert aus der Engine.';
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:'+st.t+';color:'+st.c+'">'+icon('dumbbell')+'</div><div><h3>'+gmEsc(name)+'</h3><div class="sh-sub" style="margin:2px 0 0">'+st.sym+' '+st.l+' · letzte '+gmBodyRange+' Tage</div></div></div>'+
    '<div class="statgrid3"><div><div class="n">'+(m&&m.realWorkingSets!=null?m.realWorkingSets:'—')+'</div><div class="l">Arbeitssätze</div></div><div><div class="n">'+(eq!=null?fmtDe(eq):'—')+'</div><div class="l">effektiv</div></div><div><div class="n">'+(lo!=null&&hi!=null?lo+'–'+hi:'—')+'</div><div class="l">Ziel/Woche</div></div></div>'+
    '<div class="sh-block"><div class="bh">Verlauf (Sätze/Woche)</div><div class="oc2"><div class="gm-chart-empty">'+GM_NA+' — eine kanonische Wochenhistorie je Muskel liegt noch nicht vor.</div></div></div>'+
    '<div class="sh-block"><div class="bh">Wirksamkeit fürs Ziel</div><p>'+eff+'</p></div>'+
    '<div class="sh-block"><div class="bh">Zuletzt beteiligte Übungen</div><div class="msheet-ex">'+(exNames.length?exNames.slice(0,6).map(function(e){return '<span>'+gmEsc(e)+'</span>';}).join(''):'<span>—</span>')+'</div></div>'+
    '<div class="sh-block"><div class="bh">Empfehlung nächste Woche</div><p>'+gmEsc((typeof mvNextStep==='function')?mvNextStep(st.key):'—')+'</p></div>'+
    (lvl==='p'?'<div class="sh-block"><div class="bh">Datenqualität</div><div class="confidence"><span class="confchip">'+icon('check','xs')+' Konfidenz <b>'+(m&&m.confidence!=null?Math.round(m.confidence*100)+'%':'—')+'</b></span><span class="confchip">'+icon('db','xs')+' Trend <b>—</b></span></div></div>':'')+
    '<div class="source">'+icon('info','xs')+' Kanonische Muskelengine (effektive Satzäquivalente) — keine medizinische Aussage.</div>';
  gmOpenSheet('detailSheet');
}
/* --- Teaser/NA-Sheets (Analyse) --- */
function gmOpenAnaTeaserSheet(kind){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var t=kind==='best'?'Bestzeiten':kind==='medals'?'Medaillen':'Meilensteine';
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon(kind==='best'?'bolt':kind==='medals'?'shield':'target')+'</div><div><h3>'+t+'</h3><div class="sh-sub" style="margin:2px 0 0">'+GM_NA+'</div></div></div>'+
    '<div class="sh-block"><p>'+t+' erscheinen mit deinen ersten abgeschlossenen Aktivitäten — gemessen, nicht erfunden. ORVIA zeigt keine erfundenen Werte.</p></div>';
  gmOpenSheet('detailSheet');
}
/* --- GM7.5i: Kennzahlenbibliothek (Prototyp openPage('metrics'): anaTile-Grid nach
   Kategorien) — Katalog = kanonische metric-registry (SSOT), Werte = derselbe
   180-T-Resolver-Snapshot wie die Analyse-Segmente (gmAnaResolved, kein Doppel-Collect).
   Nicht aufgeloeste Metriken bleiben als ehrliche "—"-Kachel sichtbar (Regel #12:
   Struktur schrumpft nie); Serien-Sparkline nur aus echter 14-T-Historie. */
function gmOpenMetricsLibrary(){
  var pg=document.getElementById('gmAnaPage');if(!pg)return;
  window._gmMetricsLibOpen=true;
  var reg=window.ORVIA&&ORVIA.metricRegistry;
  var h='<div class="page-head"><div class="page-head-row"><button class="backbtn" onclick="gmCloseMetricsLibrary()" aria-label="Zurück">'+icon('chev')+'</button><div><h2>Kennzahlenbibliothek</h2><p>Alle Rohdaten, Quellen und Trends</p></div></div></div>';
  if(!reg||!reg.METRICS){
    h+='<div class="card"><p>'+GM_NA+' — Metrik-Katalog nicht geladen.</p></div>';
  }else{
    var res=gmAnaResolved();
    if(res==null&&_gmAnaState==='loading'){
      h+='<div class="sectlabel">Kennzahlen <span class="ana-count">wird geladen</span></div><div class="ana-grid">'+gmStateLoading({kind:'kcard',bare:false,blocks:6})+'</div>';
    }else if(res==null&&_gmAnaState==='error'){
      h+=gmStateError({icon:'wifi',title:'Kennzahlen konnten nicht geladen werden.',desc:'Die Werte sind unbekannt — ORVIA zeigt keine 0 und keinen Ersatzwert.',retry:'gmAnaRetry();gmOpenMetricsLibrary()'});
    }else{
      var cats=['body','cardio','sleep','daily_activity','performance','load_recovery'];
      cats.forEach(function(cat){
        var ms=reg.METRICS.filter(function(m){return m.category===cat;});
        if(!ms.length)return;
        var have=0;
        var tiles=ms.map(function(m){
          var r=gmAnaMetric(res,m.id);if(r)have++;
          var val=r?_rcvVal(r):'—';
          var stale=(r&&r.stale)?' <span class="rcv-stale">veraltet</span>':'';
          var sp='';try{var ser=gmMetricSeries(m.id,14);if(ser&&ser.values.length>=3)sp='<div class="mt-spark">'+sparkline(ser.values,'var(--ready)')+'</div>';}catch(_){ }
          var tap=r?' tap" role="button" tabindex="0" onclick="openMetric(\''+m.id+'\')" onkeydown="if(event.key===\'Enter\')openMetric(\''+m.id+'\')':'"';
          return '<div class="mtile'+(r?tap:'')+'"><div class="mt-h"><span class="mt-l">'+gmEsc(m.label)+'</span></div><div class="mt-v" style="font-size:17px;font-weight:800;font-variant-numeric:tabular-nums">'+gmEsc(val)+stale+'</div><div class="mt-d" style="color:var(--faint);font-size:10px">'+(r?'antippen':GM_NA)+'</div>'+sp+'</div>';
        }).join('');
        h+='<div class="sectlabel">'+gmEsc((reg.CATEGORY_LABELS&&reg.CATEGORY_LABELS[cat])||cat)+' <span class="ana-count">'+have+'/'+ms.length+'</span></div><div class="ana-grid">'+tiles+'</div>';
      });
      h+='<div class="mini-note" style="margin:4px 18px 12px">'+icon('info','xs')+'<div>Werte aus dem kanonischen Metrik-Speicher (Resolver-Snapshot). Nicht belegte Kennzahlen bleiben sichtbar und ehrlich leer — keine 0, kein Ersatzwert.</div></div>';
    }
    /* GM7.9i: Die Check-in-Sektionen haengen NICHT am Provider-Resolver — ihre Werte stammen
       aus dem lokalen Check-in. Sie werden daher ausserhalb der Resolver-Verzweigung
       gerendert und bleiben auch dann sichtbar, wenn der Snapshot laedt oder fehlschlaegt. */
    h+=gmLibCheckinSections();
  }
  h+='<div class="tabspacer"></div>';
  pg.innerHTML=h;
  pg.classList.add('on');
  try{pg.scrollTop=0;}catch(_){ }
}
/* GM7.9i: Die beiden Golden-Master-Sektionen „Subjektiv · Check-in" und „Ernährung"
   (SECTIONS-Definition des Prototyps) fehlten in der Bibliothek. Sie werden bewusst NICHT
   in die metric-registry aufgenommen: die Registry ist der Katalog der PROVIDER-aufgeloesten
   Kennzahlen (Resolver-Snapshot). Die hier gezeigten Werte stammen aus dem SELBST ERFASSTEN
   Check-in und haben mit js/checkin-fields.js bereits ihre eigene kanonische Registry —
   Beschriftungen und Wertebereiche werden von dort gelesen, nicht dupliziert. Dadurch bleibt
   die Metrik-Registry unveraendert (keine Nebenwirkung auf Resolver oder Profil-Kennzahlen-
   liste) und es entsteht keine zweite Wahrheit.
   Rein lesend: keine Berechnung, keine Umrechnung, keine Ersatzwerte. Fehlt ein Wert, bleibt
   die Kachel in voller Struktur mit ehrlichem „—". */
function gmLibCheckinRead(where,key){
  /* Juengster tatsaechlich erfasster Wert innerhalb der letzten 14 Tage (heute zuerst).
     Kein Rueckgriff auf aeltere Daten ohne Datumsangabe — das Datum wird mitgeliefert. */
  try{
    if(typeof DB==='undefined'||!DB)return null;
    var d=new Date(),k,e,v;
    for(var i=0;i<14;i++){
      k=(typeof todayStr==='function'&&i===0)?todayStr():new Date(d.getTime()-i*864e5).toISOString().slice(0,10);
      e=DB[k];if(!e)continue;
      var blk=(where==='eve')?e.eve:e.morning;
      if(!blk)continue;
      v=blk[key];
      if(v==null||v==='')continue;
      return {value:v,date:k,ageDays:i};
    }
  }catch(_){ }
  return null;
}
function gmLibCheckinSections(){
  var CF=null;try{CF=(window.ORVIA&&ORVIA.checkinFields)||null;}catch(_){ }
  var lbl=function(list,key,fb){try{var f=CF&&CF.byKey(CF[list],key);return (f&&f.label)||fb;}catch(_){return fb;}};
  var rng=function(list,key){try{var f=CF&&CF.byKey(CF[list],key);return (f&&f.min!=null&&f.max!=null)?(' / '+f.max):'';}catch(_){return '';}};
  /* GM-Reihenfolge und -Beschriftungen; Werte aus dem Check-in, Einheiten aus dessen Registry. */
  var SEC=[
    {t:'Subjektiv · Check-in',rows:[
      {label:'Tagesenergie',where:'eve',key:'energy',unit:rng('EVENING','energy'),src:'Abend-Check-in'},
      {label:'Stimmung',where:'eve',key:'mood',unit:rng('EVENING','mood'),src:'Abend-Check-in'},
      {label:lbl('MORNING','doms','Muskelschmerz / DOMS'),where:'morning',key:'doms',unit:rng('MORNING','doms'),src:'Morgen-Check-in'},
      {label:'Schmerz',where:'morning',key:'knee',unit:rng('MORNING','knee')||' / 10',src:'Morgen-Check-in'},
      {label:'Stress (subj.)',where:'morning',key:'stress',unit:'',src:'Morgen-Check-in'}
    ]},
    {t:'Ernährung',rows:[
      {label:'Tagesumsatz',where:null,key:null,unit:'',src:'Kein Ernährungsvertrag'},
      {label:'Protein',where:'eve',key:'prot',unit:' g',src:'Abend-Check-in'},
      {label:'Kohlenhydrate',where:'eve',key:'carbs',unit:'',src:'Abend-Check-in'},
      {label:'Flüssigkeit',where:'eve',key:'hydL',unit:' l',src:'Abend-Check-in'}
    ]}
  ];
  var out='';
  SEC.forEach(function(s){
    var have=0;
    var tiles=s.rows.map(function(r){
      var got=r.where?gmLibCheckinRead(r.where,r.key):null;
      if(got)have++;
      var val='—',foot=GM_NA;
      if(got){
        val=(typeof got.value==='number')?(fmtDe(got.value)+r.unit):String(got.value);
        /* Phase 4 (P2-4): heute/gestern aus dem zentralen Formatierer; aeltere Werte
           bleiben als „vor N Tagen" (praeziser als ein Wochentagsname in dieser Liste). */
        var _age;
        try{var _F3=(window.ORVIA&&ORVIA.fmt)||null;var _rl3=(_F3&&_F3.dayLabel)?_F3.dayLabel(got.date,todayStr()):null;
          _age=(_rl3==='Heute')?'heute':(_rl3==='Gestern')?'gestern':null;}catch(_){_age=null;}
        if(_age==null)_age=(got.ageDays===0?'heute':(got.ageDays===1?'gestern':('vor '+got.ageDays+' Tagen')));
        foot=r.src+' · '+_age;
      }else if(!r.where){foot=r.src;}
      return '<div class="mtile"><div class="mt-h"><span class="mt-l">'+gmEsc(r.label)+'</span></div>'+
        '<div class="mt-v" style="font-size:17px;font-weight:800;font-variant-numeric:tabular-nums">'+gmEsc(val)+'</div>'+
        '<div class="mt-d" style="color:var(--faint);font-size:10px">'+gmEsc(foot)+'</div></div>';
    }).join('');
    out+='<div class="sectlabel">'+gmEsc(s.t)+' <span class="ana-count">'+have+'/'+s.rows.length+'</span></div><div class="ana-grid">'+tiles+'</div>';
  });
  return out;
}
function gmCloseMetricsLibrary(){window._gmMetricsLibOpen=false;var pg=document.getElementById('gmAnaPage');if(pg)pg.classList.remove('on');}
function gmRerenderMetricsLibrary(){if(window._gmMetricsLibOpen)gmOpenMetricsLibrary();}
/* Phase 1 · KF-009: Dieses Sheet meldete „Noch nicht verfuegbar", obwohl der
   Pace-Rechner seit v8-219 produktiv ist (gmProfPaceCalc, ueber Profil
   erreichbar). Nur der Einstieg aus der Analyse wurde nie nachgezogen — die App
   wies damit eine vorhandene Funktion als fehlend aus.
   Der NA-Zweig bleibt als ehrlicher Fallback, falls der Rechner fehlt. */
function gmOpenPaceCalcSheet(){
  /* gmProfPaceCalc() ist ein RENDERER — es liefert HTML und oeffnet nichts.
     Der Einstieg laeuft daher ueber dieselbe Kette wie gmOpenBestTimesEntry
     (js/ui.js): Profil-Tab oeffnen, Direkteinstieg markieren, Unterseite
     rendern. Nur so ist die Zurueck-Navigation korrekt. */
  try{
    if(typeof gmOpenProfPage==='function'&&typeof gmProfPaceCalc==='function'
       &&document.getElementById('gmProfPage')){
      gmCloseSheets();
      if(typeof openProfile==='function')openProfile();
      try{_gmProfDirectEntry=true;}catch(_e){}
      gmOpenProfPage('paceCalc');
      var pg=document.getElementById('gmProfPage');
      if(pg&&pg.classList.contains('on'))return;
    }
  }catch(_){ }
  var sh=document.getElementById('detailSheet');if(!sh)return;
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('gauge')+'</div><div><h3>Pace-Rechner</h3><div class="sh-sub" style="margin:2px 0 0">'+GM_NA+'</div></div></div>'+
    '<div class="sh-block"><p>Der Pace-Rechner ist gerade nicht erreichbar. ORVIA öffnet keine Demo-Ansicht.</p></div>';
  gmOpenSheet('detailSheet');
}
/* --- Hauptrenderer --- */
function renderGMAnalysis(){
  var host=document.getElementById('gmAna');if(!host)return;
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var dateTxt=lvl==='a'?'Einfach erklärt':lvl==='p'?'Datenlage, Baselines &amp; Konfidenz':'Trends &amp; Zusammenhänge';
  var segs=[['overview','Überblick'],['endurance','Ausdauer'],['recovery','Erholung'],['body','Körper']];
  var h='<div class="hdr"><div><div class="greet">ORVIA Intelligence</div><h1>Analyse</h1><div class="date">'+dateTxt+'</div></div><button class="iconbtn" role="button" aria-label="Kennzahlenbibliothek" onclick="gmOpenMetricsLibrary()">'+icon('chart','sm')+'</button></div>';
  h+='<div class="seg-nav" role="tablist">'+segs.map(function(s){return '<button id="gmSegBtn-'+s[0]+'" class="seg-btn '+(gmAnaSeg===s[0]?'on':'')+'" role="tab" aria-selected="'+(gmAnaSeg===s[0])+'" aria-controls="gmAnaPanel" onclick="gmSetAnaSeg(\''+s[0]+'\')">'+s[1]+'</button>';}).join('')+'</div>';
  var ctx=(gmAnaSeg==='overview'||gmAnaSeg==='endurance')?gmAnaLoadCtx():{ok:false};
  var body=gmAnaSeg==='endurance'?gmAnaEndurance(ctx):gmAnaSeg==='recovery'?gmAnaRecovery():gmAnaSeg==='body'?gmAnaBody():gmAnaOverview(ctx);
  h+='<div id="gmAnaPanel" role="tabpanel" aria-labelledby="gmSegBtn-'+gmAnaSeg+'">'+body+'</div>';
  h+='<div class="tabspacer"></div>';
  host.innerHTML=h;
  /* Charts NUR mit echter kanonischer Serie zeichnen */
  try{
    if(window.ORVIA&&ORVIA.charts&&ORVIA.charts.richChart&&ctx&&ctx.ok&&ctx.S){
      var el1=document.getElementById('gmAnaChart');
      if(el1){var t14=ctx.S.tsb.slice(-14).map(function(v){return Math.round(v);});
        ORVIA.charts.richChart(el1,{label:'Form',series:t14,times:(ctx.ld.labels||[]).slice(-14),unit:'',color:'ready',baseline:0,higherBetter:true,dec:0});}
      var el2=document.getElementById('gmFFChart');
      if(el2){var k=Math.min(28,ctx.S.ctl.length);
        var _win=ctx.S.ctl.slice(-k);var _avg=Math.round(_win.reduce(function(a,b){return a+b;},0)/(_win.length||1));
        ORVIA.charts.richChart(el2,{label:'Fitness (CTL, sRPE)',series:_win.map(function(v){return Math.round(v);}),times:(ctx.ld.labels||[]).slice(-k),unit:'',color:'gold',baseline:_avg,higherBetter:true,dec:0,
          overlays:[{series:ctx.S.atl.slice(-k).map(function(v){return Math.round(v);}),color:'var(--crit)'},{series:ctx.S.tsb.slice(-k).map(function(v){return Math.round(v);}),color:'var(--ready)',dash:'4 3'}]});}
    }
    var el3=document.getElementById('gmVolChart');
    if(el3&&window.ORVIA&&ORVIA.charts&&ORVIA.charts.richChart){
      var ser=[];var okAll=true;
      for(var o=5;o>=0;o--){var v=null;try{v=weekRunKm(o);}catch(_){ }if(v==null){okAll=false;break;}ser.push(v);}
      if(okAll){var _avgV=Math.round(ser.reduce(function(a,b){return a+b;},0)/(ser.length||1)*10)/10;
        ORVIA.charts.richChart(el3,{label:'km',series:ser,times:['−5','−4','−3','−2','−1','akt. (angebrochen)'],unit:' km',color:'ready',baseline:_avgV,higherBetter:true,dec:0});}
    }
  }catch(_){ }
  /* Fokuszustand nach Segmentwechsel erhalten */
  if(_gmAnaFocusSeg){try{var fb=document.getElementById('gmSegBtn-'+_gmAnaFocusSeg);if(fb)fb.focus();}catch(_){ }_gmAnaFocusSeg=null;}
}
/* Aktiver GM4-Pfad: renderDash rendert NUR den GM-Aufbau — unsichtbare Legacy-Analyse
   (weekInsights-DOM, Segmente, ACWR-Boxen, D1/D2-Hosts) wird übersprungen (kein doppelter
   Lastmodell-/Resolver-/Engine-Aufruf, keine versteckten Charts). Abbau bleibt GM7. */
renderDash=function(){
  if(document.getElementById('gmAna')){renderGMAnalysis();return;}
};
/* ====== GM4-ENDE ====== */
/* ====== GM5: Profil + sämtliche verlinkte Unterseiten (finale aktive profileView-Verkettung
   des Golden Masters: Basis-Profil + „Leistung & Fortschritt" + tabspacer; Subpages über das
   GM-pageHead-/setting-group-System). Kein zusätzlicher A/F/P-Schalter auf der Hauptseite —
   Detailtiefe wird auf „Ansicht & Detailtiefe" über den bestehenden uiDetailMode-Vertrag
   gesteuert. Daten NUR aus bestehenden Quellen: PROFILE (Name/Avatar/Sportarten/Milestones),
   Goal-SSOT (goalOf/openGoalEditor), Auth (ORVIA.user/orviaLogout/orviaChangePassword/
   orviaDeleteAccount), orviaSyncState, exportData/DB._lastBackup, bestTimes(),
   ORVIA.profileCenter. Ohne Vertrag: Slot sichtbar, Wert — / NA, Kontrolle deaktiviert —
   keine Scheineinstellung, kein Schein-Toast, keine Ersatzberechnung. ====== */
var _gmProfRoute=null;
var _gmProfScroll=0;
/* GM7.5 Navigations-Stack: merkt sich, aus welcher Route eine Unterseite geoeffnet wurde
   (null = Profil-Hauptseite). gmCloseProfPage geht IMMER genau eine Ebene zurueck statt
   pauschal zur Profil-Hauptseite zu springen (Live-Abnahme-Fund: Zurueck sprang aus jeder
   Einstellungs-Unterseite direkt zur Profilseite statt zur Einstellungsliste). */
var _gmProfStack=[];
/* true = Einstellungen wurden als Direkteinstieg geoeffnet (Dashboard-Zahnrad), OHNE dass
   die Profil-Hauptseite tatsaechlich besucht wurde. Zurueck auf der obersten Ebene fuehrt
   dann zum vorherigen Hauptbildschirm, nie zur Profilseite. */
var _gmProfDirectEntry=false;
/* gmProfDash() entfernt (Phase 1, 1c): Funktion ohne jeden Aufrufer, lieferte konstant '—'. */
function gmPRow(ic,title,desc,value,onclick,dis){
  return '<div class="setting-item'+(dis?' gm-dis':'')+'"'+(onclick&&!dis?' role="button" tabindex="0" onclick="'+onclick+'" onkeydown="if(event.key===\'Enter\')(function(){'+onclick+'})()"':'')+'><span class="setting-icon">'+icon(ic,'sm')+'</span><span class="setting-copy"><b>'+title+'</b><span>'+desc+'</span></span>'+(value?'<span class="setting-value">'+value+'</span>':'')+(onclick&&!dis?icon('chev','sm'):'')+'</div>';
}
/* Phase 1b — Regel: kein sichtbares BEDIENELEMENT ohne funktionierenden
   Endzustand. Ein aria-disabled-Schalter sieht aus wie ein Schalter und
   verspricht eine Handlung, die es nicht gibt.
   Die ZEILE bleibt (Anzeigeslot, „Struktur schrumpft nie"), der Schein-Schalter
   weicht einer ehrlichen Statusangabe. */
function gmPToggleNA(ic,title,desc){
  return '<div class="setting-item gm-dis"><span class="setting-icon">'+icon(ic,'sm')+'</span><span class="setting-copy"><b>'+title+'</b><span>'+desc+'</span></span><span class="setting-value">'+GM_NA+'</span></div>';
}
function gmPPageHead(title,sub,action){
  return '<div class="page-head"><div class="page-head-row"><button class="backbtn" onclick="gmCloseProfPage()" aria-label="Zurück">'+icon('chev')+'</button><div><h2>'+gmEsc(title)+'</h2>'+(sub?'<p>'+gmEsc(sub)+'</p>':'')+'</div>'+(action?'<span class="page-action" role="button" tabindex="0" onclick="'+action.fn+'">'+action.label+'</span>':'')+'</div></div>';
}
function gmProfName(){try{return (typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.name)?String(PROFILE.name):null;}catch(_){return null;}}
function gmProfInitials(){var n=gmProfName();if(!n)return '—';var p=n.trim().split(/\s+/);return ((p[0]||'').charAt(0)+(p[1]||'').charAt(0)).toUpperCase()||'—';}
function gmProfSports(){
  var out=[];try{var sp=(typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.sports))?PROFILE.sports:[];
    sp.forEach(function(s){var id=s&&(s.sportId||s.customName||s);if(!id)return;
      var lbl=null;try{lbl=(window.ORVIA&&ORVIA.activityConfig&&ORVIA.activityConfig.sportLabel)?ORVIA.activityConfig.sportLabel(s.sportId||id):null;}catch(_){ }
      out.push(gmEsc(lbl||s.customName||String(id)));});}catch(_){ }
  return out;
}
function gmProfGoalCard(){
  var g=null;try{g=(typeof goalOf==='function')?goalOf():null;}catch(_){ }
  if(!g||!g.type)return '<div class="goal-card"><div class="goal-top"><div><h4>—</h4><p>'+GM_NA+' — lege dein Hauptziel im Ziel-Editor fest.</p></div><span class="goal-badge">HAUPTZIEL</span></div><div class="goal-line"><i style="width:0%"></i></div></div>';
  var lbl=null;try{lbl=(typeof RACE_LABELS_P!=='undefined'&&RACE_LABELS_P[g.type])||null;}catch(_){ }
  var t=lbl||String(g.type);
  if(g.targetMin){var hh=Math.floor(g.targetMin/60),mm=Math.round(g.targetMin%60);t+=' unter '+hh+':'+String(mm).padStart(2,'0');}
  var sub='—';
  try{if(g.raceDate){var d=new Date(g.raceDate+'T12:00');sub=d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
    if(typeof daysTo==='function'){var w=Math.max(0,Math.ceil(daysTo(g.raceDate)/7));sub+=' · noch '+w+' Wochen';}}}catch(_){ }
  /* Kein Zielprozent im UI — die Fortschrittsspur bleibt als ehrlich leerer Slot. */
  return '<div class="goal-card"><div class="goal-top"><div><h4>'+gmEsc(t)+'</h4><p>'+gmEsc(sub)+'</p></div><span class="goal-badge">HAUPTZIEL</span></div><div class="goal-line"><i style="width:0%"></i></div></div>';
}
function gmProfEdit(){
  if(window.ORVIA&&ORVIA.profileCenter&&typeof ORVIA.profileCenter.open==='function'){ORVIA.profileCenter.open();return;}
  var sh=document.getElementById('detailSheet');if(!sh)return;
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('pen')+'</div><div><h3>Profil bearbeiten</h3><div class="sh-sub" style="margin:2px 0 0">'+GM_NA+'</div></div></div><div class="sh-block"><p>Der Profil-Editor ist gerade nicht verfügbar.</p></div>';
  gmOpenSheet('detailSheet');
}
function gmProfAddGoal(){
  if(typeof openGoalEditor==='function'){gmCloseProfPage();openGoalEditor();return;}
}
function gmProfSyncLabel(){
  /* GM7: kanonische Quelle ist die Geraeteintegration (Provider + last_sync);
     der Cloud-Sync-Status ist eine ANDERE Aussage und nur klar benannter Fallback. */
  try{var dev=(typeof gmDeviceSyncText==='function')?gmDeviceSyncText():null;if(dev!=null)return dev;}catch(_){ }
  try{if(typeof gmDeviceSyncRefresh==='function')gmDeviceSyncRefresh();}catch(_){ }
  try{if(typeof window.orviaSyncState==='function'){var st=window.orviaSyncState();
    return ({local:'Cloud: lokaler Modus',synced:'Cloud synchronisiert',pending:'Cloud-Sync läuft …',error:'Cloud-Sync-Fehler',offline:'Offline – lokal'})[st]||'—';}}catch(_){ }
  return '—';
}
/* ---------- Profilhauptseite ---------- */
function renderGMProfile(){
  var host=document.getElementById('gmProf');if(!host)return;
  var name=gmProfName();
  var avatar='';
  /* Phase 1 · P0-6: las bisher NUR PROFILE.avatar. Ist das Bild in den Storage
     migriert (PROFILE.avatarPath), steht dort nichts mehr — auf einem
     Zweitgeraet zeigte der Profilkopf deshalb dauerhaft die Initialen.
     Kanonische Quelle ist avatarStore.currentSrc(); identisch zu ui.js:3532. */
  try{
    var _av=null;
    try{if(window.ORVIA&&ORVIA.avatarStore&&ORVIA.avatarStore.currentSrc)_av=ORVIA.avatarStore.currentSrc();}catch(_e){}
    if(!_av&&typeof PROFILE!=='undefined'&&PROFILE)_av=PROFILE.avatar||null;
    avatar=_av?'<img src="'+gmEsc(_av)+'" alt="Profilbild">':'<span>'+gmProfInitials()+'</span>';
  }catch(_){avatar='<span>'+gmProfInitials()+'</span>';}
  /* 4 Statistikslots — nur kanonische Werte: Sportarten (vollständige kanonische Liste),
     Fitness (CTL aus Calc.loadSeries). Einheiten/Zielaufbau ohne Vertrag ⇒ — . */
  var sports=gmProfSports();
  var ctl=null;
  try{var ld=allLoads();var lcc=(typeof Calc!=='undefined'&&Calc.loadConfidenceContract)?Calc.loadConfidenceContract(ld.confidence):{suppressNumbers:false};
    if(!lcc.suppressNumbers&&Calc.loadSeries){var S=Calc.loadSeries(ld.loads||[]);if((S.ctl||[]).length>=14)ctl=Math.round(S.ctl[S.ctl.length-1]);}}catch(_){ }
  var h='<div class="profile-cover"></div><div class="ig-profile"><div class="ig-top"><div class="ig-avatar">'+avatar+'</div><div class="ig-actions"><button class="mini-btn primary" onclick="gmProfEdit()">Profil bearbeiten</button><button class="mini-btn" aria-label="Einstellungen" onclick="gmOpenProfPage(\'settings\')">'+icon('gear','sm')+'</button></div></div>'+
    '<div class="ig-name">'+gmEsc(name||'—')+'</div>'+
    /* Phase 4 (P2-5, 0029): Handle + Bio aus dem Profil — leer bleibt ehrlich '—' bzw.
       ein Einrichtungs-Hinweis; beides ist jetzt im Editor (Persönliche Grunddaten) pflegbar. */
    '<div class="ig-handle">'+((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.handle)?'@'+gmEsc(PROFILE.handle):'—')+'</div>'+
    '<div class="ig-bio">'+((typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.bio)?gmEsc(PROFILE.bio):(GM_NA+' — Bio im Profil-Editor (Persönliche Grunddaten) hinterlegen.'))+'</div>'+
    (function(){/* GM7: Einheiten = Gesamtzahl der kanonisch zusammengefuehrten Aktivitaeten (Server+lokal+Legacy, dedupliziert) */
      var units=null;try{if(typeof listActivitiesUnified==='function'){var la=listActivitiesUnified();units=Array.isArray(la)?la.length:null;}}catch(_){ }
      return '<div class="ig-stats"><div class="ig-stat"><b>'+(units!=null?fmtDe(units):'—')+'</b><span>Einheiten</span></div><div class="ig-stat"><b>'+(sports.length?sports.length:'—')+'</b><span>Sportarten</span></div><div class="ig-stat"><b>'+(ctl!=null?ctl:'—')+'</b><span>Fitness (sRPE)</span></div><div class="ig-stat"><b>—</b><span>Zielaufbau</span></div></div></div>';})();
  h+='<div class="sectlabel" data-gm-slot="profile-sports">Deine Sportarten <span class="edit" role="button" tabindex="0" onclick="gmOpenProfPage(\'goals\')">Bearbeiten</span></div>';
  h+='<div class="sport-chips">'+(sports.length?sports.map(function(s){return '<span class="sport-chip on">'+s+'</span>';}).join(''):'<span class="sport-chip">—</span>')+'</div>';
  h+='<div class="sectlabel" data-gm-slot="profile-goal-journey">Zielreise <span class="edit" role="button" tabindex="0" onclick="gmOpenProfPage(\'goals\')">Alle Ziele</span></div><div class="goal-stack">'+gmProfGoalCard()+'</div>';
  h+='<div class="sectlabel" data-gm-slot="profile-control">Profil &amp; Kontrolle</div><div class="setting-group">'+
    gmPRow('target','Ziele &amp; Sportarten','Prioritäten, Rollen und Langfristziele','',"gmOpenProfPage('goals')")+
    gmPRow('link','Geräte &amp; Daten',gmEsc(gmProfSyncLabel()),'',"gmOpenProfPage('connections')")+
    gmPRow('gear','Einstellungen','Ansicht, Training, Datenschutz und Konto','',"gmOpenProfPage('settings')")+'</div>';
  h+='<div class="sectlabel" data-gm-slot="profile-performance">Leistung &amp; Fortschritt</div><div class="setting-group">'+
    gmPRow('gauge','Leistungsdaten',(typeof gmPerfRowSub==='function'?gmPerfRowSub():'Wettkampf, Test und Schwellenwerte'),'',"gmOpenProfPage('performance')")+
    gmPRow('bolt','Bestzeiten','Persönliche Rekorde je Distanz','',"gmOpenProfPage('bestTimes')")+
    gmPRow('shield','Medaillen','Erreichte und offene Auszeichnungen','',"gmOpenProfPage('medals')")+
    gmPRow('target','Meilensteine','Fortschritt Richtung Ziel','',"gmOpenProfPage('milestones')")+
    gmPRow('gauge','Pace-Rechner','Lauf, Rad und Schwimmen','',"gmOpenProfPage('paceCalc')")+'</div>';
  h+='<div class="tabspacer"></div>';
  host.innerHTML=h;
}
/* ---------- Subpages ---------- */
function gmProfSetMode(m){if(typeof setUiDetailMode==='function')setUiDetailMode(m);if(_gmProfRoute)gmOpenProfPage(_gmProfRoute);}
function gmProfModeLabel(){var m=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';return ({anfaenger:'Einfach',fortgeschritten:'Fortgeschritten',profi:'Profi'})[m]||'—';}
function gmProfSettings(){
  return gmPPageHead('Einstellungen','Dein ORVIA, deine Regeln')+
    '<div class="page-intro">Alle Anzeige-, Trainings-, Datenschutz- und Kontoeinstellungen an einem Ort. Aktiv ist nur, was einen echten produktiven Vertrag hat.</div>'+
    '<div class="setting-title">Darstellung</div><div class="setting-group">'+
    gmPRow('sun','Erscheinungsbild','Dunkel, Hell oder automatisch',gmEsc(({dark:'Dunkel',light:'Hell',auto:'Automatisch'})[(typeof orviaThemePref==='function')?orviaThemePref():'dark']||'Dunkel'),"gmOpenProfPage('appearance')")+
    gmPRow('activity','Ansicht &amp; Detailtiefe','Ändert Erklärungen und Informationsdichte',gmEsc(gmProfModeLabel()),"gmOpenProfPage('appearance')")+
    gmPToggleNA('activity','Bewegung reduzieren',GM_NA)+'</div>'+
    '<div class="setting-title">Training &amp; Gesundheit</div><div class="setting-group">'+
    gmPRow('calendar','Plan &amp; Wochenstruktur','Ruhetage, Zeitfenster, Struktur und Doppel-Einheiten',(function(){
      try{var M2=window.ORVIA&&ORVIA.profileModel;if(M2&&M2.availabilitySummary&&typeof PROFILE!=='undefined'&&PROFILE){
        var av=M2.availabilitySummary(PROFILE.availability);
        return gmEsc(av.availableDays+' Tage'+(av.preferredRestDays&&av.preferredRestDays.length?' · Ruhe: '+av.preferredRestDays.join(', '):''));}}catch(_){ }
      return '—';})(),"gmOpenProfPage('planSettings')")+
    gmPRow('target','Ziele &amp; Sportarten','Hauptziel, Nebenziele, Rollen',(gmProfSports().length||'—')+'',"gmOpenProfPage('goals')")+
    gmPRow('heart','Gesundheit &amp; Check-in','Warnzeichen, Schmerz, Schlaf, HRV','—',"gmOpenProfPage('health')")+
    gmPRow('link','Geräte &amp; Datenquellen','Cloud-Sync, Import, manuelle Daten',gmEsc(gmProfSyncLabel()),"gmOpenProfPage('connections')")+
    gmPRow('gauge','Einheiten &amp; Berechnungen','Metrisch, Wochenbeginn, Herzfrequenzzonen','km · kg',"gmOpenProfPage('units')")+'</div>'+
    '<div class="setting-title">Kommunikation</div><div class="setting-group">'+
    gmPRow('bell','Benachrichtigungen','Training, Erholung, Planänderungen','—',"gmOpenProfPage('notifications')")+'</div>'+
    '<div class="setting-title">Konto &amp; Kontrolle</div><div class="setting-group">'+
    gmPRow('lock','Datenschutz &amp; KI','Profil, Einwilligungen, Datenverwendung und Consent','—',"gmOpenProfPage('privacy')")+
    gmPRow('db','Daten verwalten','Export, Sicherung, Löschen','',"gmOpenProfPage('data')")+
    gmPRow('shield','Konto &amp; Sicherheit','E-Mail, Passwort, Geräte','',"gmOpenProfPage('account')")+
    gmPRow('info','Hilfe &amp; über ORVIA','Support, Dokumentation, Version, Build und medizinischer Hinweis','',"gmOpenProfPage('about')")+'</div>'+
    '<div class="danger-link" role="button" tabindex="0" onclick="orviaLogout&&orviaLogout()" onkeydown="if(event.key===\'Enter\')orviaLogout&&orviaLogout()">Abmelden</div>';
}
function gmRerenderAppearance(){
  if(_gmProfRoute!=='appearance')return;
  var pg=document.getElementById('gmProfPage');if(!pg)return;
  pg.innerHTML=gmProfAppearance()+((/tabspacer/.test(pg.innerHTML))?'':'<div class="tabspacer"></div>');
}
function gmProfAppearance(){
  var m=(typeof uiDetailMode==='function')?uiDetailMode():'fortgeschritten';
  var th=(typeof orviaThemePref==='function')?orviaThemePref():'dark';
  return gmPPageHead('Ansicht & Detailtiefe','Persönlich, ohne die Engine zu verändern')+
    '<div class="setting-title">Farbmodus</div><div class="choice-grid">'+
    '<button class="choice '+(th==='dark'?'on':'')+'" onclick="orviaSetThemePref(\'dark\')">Dunkel</button>'+
    '<button class="choice '+(th==='light'?'on':'')+'" onclick="orviaSetThemePref(\'light\')">Hell</button>'+
    '<button class="choice '+(th==='auto'?'on':'')+'" onclick="orviaSetThemePref(\'auto\')">Automatisch</button></div>'+
    '<div class="setting-title">Informationsdichte</div><div class="choice-grid">'+
    '<button class="choice '+(m==='anfaenger'?'on':'')+'" onclick="gmProfSetMode(\'anfaenger\')">Einfach</button>'+
    '<button class="choice '+(m==='fortgeschritten'?'on':'')+'" onclick="gmProfSetMode(\'fortgeschritten\')">Fortgeschritten</button>'+
    '<button class="choice '+(m==='profi'?'on':'')+'" onclick="gmProfSetMode(\'profi\')">Profi</button></div>'+
    '<div class="card"><div class="ctitle"><div class="l">'+icon('info')+' Was ändert sich?</div></div><p class="prescription"><b>Einfach:</b> klare Handlung und wenig Kennzahlen.<br><br><b>Fortgeschritten:</b> Zusammenhänge, Trends und Planwirkung.<br><br><b>Profi:</b> Datenqualität, Lastmodelle, Quellen und Entscheidungsgründe.<br><br>Die Trainingsentscheidung bleibt in allen Ansichten identisch.</p></div>';
}
function gmProfNotifications(){
  return gmPPageHead('Benachrichtigungen','Nur das, was dir wirklich hilft')+
    '<div class="setting-title">Grundsätzlich</div><div class="setting-group">'+gmPToggleNA('bell','Benachrichtigungen erlauben','Master-Schalter — '+GM_NA)+'</div>'+
    '<div class="setting-title">Coaching</div><div class="setting-group">'+
    gmPToggleNA('run','Trainingserinnerungen',GM_NA)+
    gmPToggleNA('calendar','Planänderungen','Noch nicht verfügbar — kein Mitteilungsvertrag')+
    '<div class="setting-item gm-dis"><span class="setting-icon">'+icon('heart','sm')+'</span><span class="setting-copy"><b>Erholung &amp; Warnzeichen</b><span>Nur relevante Veränderungen und Safety-Hinweise</span></span><span class="setting-value" title="Safety-Hinweise sind nicht abschaltbar">Immer aktiv</span></div>'+
    gmPToggleNA('chart','Wochenreview','Noch nicht verfügbar — kein Wochenreview-Vertrag')+'</div>'+
    '<div class="setting-title">Sonstiges</div><div class="setting-group">'+gmPToggleNA('sparkle','Produktneuigkeiten',GM_NA)+'</div>';
}
function gmProfPrivacy(){
  return gmPPageHead('Datenschutz & KI','Du entscheidest über deine Daten')+
    '<div class="setting-title">Sichtbarkeit</div><div class="setting-group">'+
    gmPToggleNA('lock','Privates Profil','Noch nicht verfügbar — kein Sichtbarkeitsvertrag')+
    gmPToggleNA('heart','Gesundheitsfreigabe','Kein Consent-Vertrag — '+GM_NA.toLowerCase())+'</div>'+
    '<div class="setting-title">Intelligente Auswertung</div><div class="setting-group">'+
    gmPToggleNA('sparkle','Personalisierte KI-Analyse','Noch nicht verfügbar — erfordert Consent-Vertrag')+
    gmPRow('shield','Safety-Regeln','Medizinische Warnzeichen überstimmen Leistungsziele','Immer aktiv','',false)+'</div>'+
    '<div class="card"><p class="prescription">ORVIA zeigt nachvollziehbar, welche Daten eine Empfehlung beeinflussen. Fehlende Daten werden nicht als Null interpretiert. Einwilligungen folgen mit dem Consent-Vertrag.</p></div>';
}
/* GM7.9f: Die beiden Zielportfolio-Karten (MITTELFRISTIG/LANGFRISTIG) waren fest auf „—"
   verdrahtet, obwohl die kanonischen Produzenten vorhanden sind: listGoals() (js/profile.js)
   liefert die Ziele, das kanonische Feld timeHorizon (short|mid|long|open, js/profile-model.js)
   bestimmt den Horizont, labelOf()/roleOfGoal() liefern die deutschen Labels. Die Zuordnung
   Horizont→Karte ist damit KANONISCH und nicht im UI erfunden.
   Rein lesend: keine Engine-Berechnung, keine Neubewertung von Prioritaeten, kein
   Fortschrittsprozent (die Spur bleibt wie beim Hauptziel ein ehrlich leerer Slot).
   Das Hauptziel (Rolle „main") ist ausgenommen — es steht bereits als eigene Karte darueber.
   Gibt es fuer einen Horizont kein aktives Ziel, bleibt die Karte in voller Struktur mit
   ehrlichem „—" stehen. */
function gmProfHorizonCard(horizon,badge,adj){
  var goals=[];try{if(typeof listGoals==='function')goals=listGoals()||[];}catch(_){ }
  var M=null;try{M=(window.ORVIA&&ORVIA.profileModel)||null;}catch(_){ }
  var roleOf=function(g){try{return (M&&M.roleOfGoal)?M.roleOfGoal(g):null;}catch(_){return null;}};
  var lab=function(dom,code){try{return (M&&M.labelOf&&code!=null)?M.labelOf(dom,code):null;}catch(_){return null;}};
  var mine=[];
  try{
    mine=goals.filter(function(g){
      return g&&g.status==='active'&&g.timeHorizon===horizon&&roleOf(g)!=='main';
    }).sort(function(a,b){
      /* GM7.9g (Auftraggeber-Entscheidung 2026-08-02): Rangfolge INNERHALB eines Horizonts.
         Zuvor entschied allein die Prioritaet — dadurch stand ein Erhaltungsziel („Kraftbasis
         halten", Prioritaet 3) vor einem echten Leitziel („Ironman-Finish", Prioritaet 4),
         obwohl die Prioritaetsskala die Planungswirkung meint und nicht die Bedeutung im
         Zielportfolio. Neue Rangfolge, alle Kriterien aus vorhandenen Modellfeldern:
           1. Erhaltungsziele (kanonische Rolle „maintain") zuletzt — laut Modell
              unterstuetzende Hintergrundziele, keine Leitziele eines Horizonts.
           2. naechstes Zieldatum zuerst; datierte Ziele vor undatierten.
           3. kanonische Prioritaet als stabiler Tiebreak.
         Keine neue Bewertung, keine Umgewichtung im UI. */
      var ma=(roleOf(a)==='maintain')?1:0,mb=(roleOf(b)==='maintain')?1:0;
      if(ma!==mb)return ma-mb;
      var da=a.targetDate||null,db=b.targetDate||null;
      if(!!da!==!!db)return da?-1:1;
      if(da&&db&&da!==db)return da<db?-1:1;
      var pa=(a.priority!=null?a.priority:9),pb=(b.priority!=null?b.priority:9);
      return pa-pb;
    });
  }catch(_){ mine=[]; }
  var head,sub;
  if(!mine.length){
    head='—';
    sub=GM_NA+' — kein aktives '+adj+' Ziel hinterlegt.';
  }else{
    var g=mine[0],parts=[];
    head=(g.title&&String(g.title).trim())||lab('goalRole',roleOf(g))||'—';
    if(g.targetDate){
      try{var d=new Date(g.targetDate+'T12:00');
        if(!isNaN(d.getTime()))parts.push(d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}));
        if(typeof daysTo==='function'){var w=Math.ceil(daysTo(g.targetDate)/7);
          if(isFinite(w)&&w>0)parts.push('noch '+w+' Wochen');}
      }catch(_){ }
    }
    if(!parts.length){var rl=lab('goalRole',roleOf(g));if(rl)parts.push(rl);}
    if(!parts.length){var hl=lab('timeHorizon',horizon);if(hl)parts.push(hl);}
    if(mine.length>1)parts.push('+'+(mine.length-1)+' weitere');
    sub=parts.length?parts.join(' · '):'—';
  }
  return '<div class="goal-card"><div class="goal-top"><div><h4>'+gmEsc(head)+'</h4><p>'+gmEsc(sub)+'</p></div><span class="goal-badge">'+gmEsc(badge)+'</span></div><div class="goal-line"><i style="width:0%"></i></div></div>';
}
function gmProfGoals(){
  var chips=gmProfSports();
  return gmPPageHead('Ziele & Sportarten','Hierarchie statt Zielchaos',{label:'Hinzufügen',fn:'gmProfAddGoal()'})+
    '<div class="page-intro">Dein Hauptziel steuert die aktuelle Planung. Langfristige Ziele beeinflussen den Aufbau, ohne das nächste Event zu verdrängen.</div>'+
    '<div class="goal-stack">'+gmProfGoalCard()+
    gmProfHorizonCard('mid','MITTELFRISTIG','mittelfristiges')+
    gmProfHorizonCard('long','LANGFRISTIG','langfristiges')+'</div>'+
    '<div class="setting-title">Aktive Sportprofile</div><div class="sport-chips">'+(chips.length?chips.map(function(s){return '<span class="sport-chip on">'+s+'</span>';}).join(''):'<span class="sport-chip">—</span>')+'</div>';
}
function gmProfDailyGoals(){
  var rows=[['Schritte','Dein tägliches Bewegungsziel'],['Aktive Kalorien','Aktivität ohne Grundumsatz'],['Wasser','Tagesziel in Millilitern'],['Schlaf','Persönliche Zielstunden']];
  return gmPPageHead('Tagesziele','Individuell statt starrer Standardwerte',{label:'Fertig',fn:'gmCloseProfPage()'})+
    '<div class="page-intro">Diese Ziele sind Leitplanken. Ein produktiver Tagesziel-Vertrag ist noch nicht verfügbar — ORVIA erzeugt keine Scheineinstellung.</div>'+
    '<div class="setting-group">'+rows.map(function(r){
      /* Phase 1b: die +/- Knoepfe waren Attrappen. Zeile und Wert bleiben als
         Anzeigeslot, die Bedienelemente sind weg. */
      return '<div class="stepper-row"><div class="stepper-info"><b>'+r[0]+'</b><span>'+r[1]+'</span></div><div class="stepper stepper-na"><strong>—</strong></div></div>';}).join('')+'</div>';
}
function gmProfPlanSettings(){
  /* GM7: Zeilen 1–3 aus dem kanonischen Verfügbarkeitsmodell (profile-model.availability).
     Zeile 4 (Max. Tagesbelastung) bleibt ehrlich blockiert — loadCap-Vertrag fehlt. */
  var rest='—',days='—',dbl='—';
  try{var M2=window.ORVIA&&ORVIA.profileModel;
    if(M2&&M2.availabilitySummary&&typeof PROFILE!=='undefined'&&PROFILE){
      var av=M2.availabilitySummary(PROFILE.availability);
      rest=(av.preferredRestDays&&av.preferredRestDays.length)?av.preferredRestDays.join(', '):'Keiner festgelegt';
      days=av.availableDays+' Tage';
      dbl=(av.doubleDays>0)?(av.doubleDays+' Tage erlaubt'):'Aus';}}catch(_){ }
  return gmPPageHead('Plan & Wochenstruktur','Wie ORVIA deine Woche bauen darf')+
    '<div class="setting-title">Konfiguration</div><div class="setting-group">'+
    gmPRow('moon','Fester Ruhetag','Wird vom Planer niemals automatisch belegt',gmEsc(rest),"openAvailabilityEditor&&openAvailabilityEditor()")+
    gmPRow('calendar','Bevorzugte Trainingstage','Für Plan und Wochenreview',gmEsc(days),"openAvailabilityEditor&&openAvailabilityEditor()")+
    gmPRow('activity','Doppel-Einheiten','Nur nach ausdrücklicher Freigabe',gmEsc(dbl),"openAvailabilityEditor&&openAvailabilityEditor()")+
    gmPRow('gauge','Maximale Tagesbelastung','Noch nicht verfügbar — wird später aus Kapazität und Datenqualität abgeleitet (loadCap-Vertrag)','—','',true)+'</div>';
}
function gmProfHealth(){
  var h=gmPPageHead('Gesundheit & Check-in','Safety zuerst')+
    '<div class="setting-title">Konfiguration</div><div class="setting-group">'+
    gmPRow('alert','Warnzeichen','Nur sichtbar, wenn Symptome = Ja','Aktiv','',false)+
    gmPRow('knee','Verletzungshistorie','Aus deinem Check-in','—','',true)+
    gmPRow('moon','Schlafziel','Kein produktiver Zielkorridor-Vertrag','—','',true);
  /* Phase 3 · Block 2: Zyklus — bestehender Editor (extras.js), kontextuell hier.
     Zeile nur bei weiblichem Profil bzw. bereits konfiguriertem Zyklus. */
  try{
    var _sexF=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.sex==='f');
    var _cyc=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.cycle)||null;
    if((typeof gmFeatureFlag!=='function'||gmFeatureFlag('cycle'))&&(_sexF||_cyc)){
      var _cp=null;try{_cp=(typeof cyclePhase==='function')?cyclePhase():null;}catch(_){ }
      h+=gmPRow('calendar','Zyklus',_cp?('Tag '+_cp.day+' · '+_cp.phase):'Optional — unterstützende Hinweise, keine Diagnose',_cyc?'Aktiv':'—','gmCloseSheets&&gmCloseSheets();openCycleEditor&&openCycleEditor()',false);
    }
  }catch(_){ }
  h+='</div>';
  /* Phase 3 · Block 2: Baselines — read-only aus den bestehenden 7/28-Tage-
     Berechnungen (baselineRows, intelligence.js). Unter 4 Datentagen ehrlich NA. */
  if(typeof gmFeatureFlag!=='function'||gmFeatureFlag('baselines')){
    var _bl='';
    try{
      var _rows=(typeof baselineRows==='function')?baselineRows():null;
      if(_rows&&_rows.length){
        _bl=_rows.map(function(r){return gmPRow('pulse',gmEsc(r[0]),gmEsc(r[1]),'','',false);}).join('');
      }else{
        _bl=gmPRow('pulse','Baselines',GM_NA+' — belastbar ab ~7 Tagen Check-in-Daten','—','',true);
      }
    }catch(_){_bl=gmPRow('pulse','Baselines',GM_NA,'—','',true);}
    h+='<div class="setting-title">Baselines (7/28 Tage, read-only)</div><div class="setting-group">'+_bl+'</div>';
  }
  return h;
}
/* GM7.5: „Jetzt synchronisieren“ — POST /sync auf dem produktiven Garmin-Worker (bereits
   live erreichbar). Nutzt die vorhandene Supabase-Session (gleiches Auth-Bearer-Muster wie
   orviaDeleteAccount, js/auth.js). Kein neuer Endpunkt, keine Engine-Aenderung — reine
   Frontend-Anbindung eines bereits produktiven Vertrags (garmin-worker/orvia_worker/api.py). */
var _gmDevSyncNow={state:'idle',error:null};
var _gmDevSyncPollTimer=null;
function gmRerenderConnections(){
  if(_gmProfRoute!=='connections')return;
  var pg=document.getElementById('gmProfPage');if(!pg)return;
  pg.innerHTML=gmProfConnections()+((/tabspacer/.test(pg.innerHTML))?'':'<div class="tabspacer"></div>');
}
async function gmDeviceSyncStatus(base,token){
  var resp=await fetch(base+'/status',{headers:{'Authorization':'Bearer '+token}});
  if(!resp.ok)throw new Error('status_http_'+resp.status);
  return resp.json();
}
function gmDeviceSyncPollStop(){
  if(_gmDevSyncPollTimer){clearTimeout(_gmDevSyncPollTimer);_gmDevSyncPollTimer=null;}
}
function gmDeviceSyncPollFinish(){
  gmDeviceSyncPollStop();
  try{_gmDevSync.fetchedAt=0;gmDeviceSyncRefresh();}catch(_){ }
  if(_gmDevSyncNow.state==='success'){
    try{if(window.ORVIA&&ORVIA.readinessStore&&ORVIA.readinessStore.hydrateRecentScores)ORVIA.readinessStore.hydrateRecentScores(60);}catch(_){ }
    try{if(window.ORVIA&&ORVIA.uiRefresh&&ORVIA.uiRefresh.schedule)ORVIA.uiRefresh.schedule([],{protectInput:true});}catch(_){ }
    /* GM7.8: frisch synchronisierte Einheit direkt erzaehlen (force = erneuter Versuch). */
    try{if(typeof gmMaybeAutoStory==='function')setTimeout(function(){gmMaybeAutoStory(true);},1200);}catch(_){ }
  }
  gmRerenderConnections();
}
/* GM7.5b: Ein 202 heisst „angenommen", nicht „fertig" (api.py queued einen Background-Task).
   Statt sofortigem Fake-Erfolg wird GET /status gepollt (Backoff 2s→6s, 90s Zeitlimit), bis
   lastSuccessfulSyncAt ueber die vor dem POST erfasste Baseline hinaus vorrueckt (Erfolg) oder
   lastErrorCode sich gegenueber der Baseline aendert (Fehler). Timeout meldet ehrlich „laeuft im
   Hintergrund weiter" statt einen unbelegten Erfolg vorzutaeuschen. */
function gmDeviceSyncPoll(base,token,baseline){
  var deadline=Date.now()+90000,delay=2000;
  function tick(){
    if(Date.now()>deadline){
      _gmDevSyncNow={state:'error',error:'Läuft im Hintergrund weiter (Zeitüberschreitung beim Abfragen).'};
      gmDeviceSyncPollFinish();
      return;
    }
    gmDeviceSyncStatus(base,token).then(function(st){
      var errNow=st&&st.lastErrorCode,succNow=st&&st.lastSuccessfulSyncAt;
      if(errNow&&errNow!==baseline.err){
        _gmDevSyncNow={state:'error',error:'Sync fehlgeschlagen ('+errNow+').'};
        gmDeviceSyncPollFinish();
        return;
      }
      if(succNow&&succNow!==baseline.succ){
        _gmDevSyncNow={state:'success',error:null};
        gmDeviceSyncPollFinish();
        return;
      }
      delay=Math.min(delay*1.3,6000);
      _gmDevSyncPollTimer=setTimeout(tick,delay);
    }).catch(function(){
      delay=Math.min(delay*1.3,6000);
      _gmDevSyncPollTimer=setTimeout(tick,delay);
    });
  }
  _gmDevSyncPollTimer=setTimeout(tick,delay);
}
async function gmDeviceSyncNowTrigger(){
  if(_gmDevSyncNow.state==='running')return;
  gmDeviceSyncPollStop();
  _gmDevSyncNow={state:'running',error:null};
  gmRerenderConnections();
  var sb=window.ORVIA&&ORVIA.sb;
  var base=(window.ORVIA_CFG&&ORVIA_CFG.GARMIN_WORKER_URL)||'';
  var token=null;
  try{
    var sess=sb?await sb.auth.getSession():null;
    token=sess&&sess.data&&sess.data.session&&sess.data.session.access_token;
  }catch(_){ }
  if(!token){_gmDevSyncNow={state:'error',error:'Keine aktive Sitzung.'};gmRerenderConnections();return;}
  if(!base){_gmDevSyncNow={state:'error',error:'Worker nicht konfiguriert.'};gmRerenderConnections();return;}
  var baseline=null;
  try{var st0=await gmDeviceSyncStatus(base,token);baseline={succ:st0&&st0.lastSuccessfulSyncAt,err:st0&&st0.lastErrorCode};}catch(_){ }
  if(!baseline){_gmDevSyncNow={state:'error',error:'Status nicht abrufbar (offline oder Netzwerkfehler).'};gmRerenderConnections();return;}
  try{
    var resp=await fetch(base+'/sync',{method:'POST',headers:{'Authorization':'Bearer '+token}});
    if(resp.status===202){gmDeviceSyncPoll(base,token,baseline);return;}
    else if(resp.status===409){_gmDevSyncNow={state:'error',error:'Gerät ist nicht verbunden.'};}
    else{_gmDevSyncNow={state:'error',error:'Synchronisierung fehlgeschlagen ('+resp.status+').'};}
  }catch(e){_gmDevSyncNow={state:'error',error:'Worker nicht erreichbar (offline oder Netzwerkfehler).'};}
  try{_gmDevSync.fetchedAt=0;gmDeviceSyncRefresh();}catch(_){ }
  gmRerenderConnections();
}
function gmProfConnections(){
  var devLbl=null;try{devLbl=(typeof gmDeviceSyncText==='function')?gmDeviceSyncText():null;}catch(_){ }
  var connected=(devLbl!=null);
  /* KF-019: reauth_required ehrlich anzeigen — Sync-Knopf sperren und die
     notwendige Handlung benennen. Die Neuanmeldung geht NUR am eigenen Rechner
     (Garmin blockt Cloud-Logins); der Worker wartet auf ein frisches Token. */
  var reauth=false;try{reauth=(typeof gmDevReauthNeeded==='function')&&gmDevReauthNeeded();}catch(_){ }
  var running=_gmDevSyncNow.state==='running';
  var syncValue=reauth?'Gesperrt':(running?'Läuft …':(_gmDevSyncNow.state==='success'?'Abgeschlossen':(_gmDevSyncNow.state==='error'?'Fehler':'')));
  var syncNote=!connected?'Kein Gerät verbunden':(reauth?'Anmeldung abgelaufen — erst neu anmelden, dann synchronisieren':(running?'Synchronisiert gerade …':(_gmDevSyncNow.state==='error'?_gmDevSyncNow.error:(_gmDevSyncNow.state==='success'?'Neue Daten sind eingetroffen':'Ruft die neuesten Daten vom Garmin-Worker ab'))));
  var reauthRow=reauth?gmPRow('alert','Neuanmeldung erforderlich','Die Garmin-Anmeldung ist abgelaufen. Führe auf deinem Computer das Anmelde-Skript (local_login) aus — danach synchronisiert der Worker automatisch weiter.'+(_gmDevSync.errCode?' · Code: '+gmEsc(_gmDevSync.errCode):''),'','',false):'';
  return gmPPageHead('Geräte & Datenquellen','Eine Wahrheit, klare Herkunft')+
    '<div class="setting-title">Konfiguration</div><div class="setting-group">'+
    gmPRow('check','Cloud-Sync',gmEsc(gmProfSyncLabel()),'',"",false)+
    gmPRow('link','Garmin',connected?gmEsc(devLbl):'—',reauth?'Neuanmeldung nötig':'','',false)+
    reauthRow+
    gmPRow('activity','Jetzt synchronisieren',gmEsc(syncNote),gmEsc(syncValue),(connected&&!running&&!reauth)?'gmDeviceSyncNowTrigger()':'',!connected||running||reauth)+
    gmPRow('link','Apple Health','Zusätzliche Gesundheitsdaten','—','',true)+
    gmPRow('db','Manuelle Daten','Check-in, Training, Körperwerte','Aktiv','',false)+
    /* Phase 3 · Block 2: Equipment-Verschleiss — bestehender km-Zaehler je Schuh/Rad. */
    ((typeof gmFeatureFlag!=='function'||gmFeatureFlag('equipment'))?gmPRow('gauge','Equipment &amp; Verschleiß','Schuhe und Rad — km-Zähler und Wechsel-Limit','',"gmOpenEquipmentSheet()",false):'')+'</div>'+
    gmRxPreviewSection()+gmGateTestSection();
}

/* ============================================================
   v8-328 · Gerätetest G1–G3 — Auslöser IN der App
   ------------------------------------------------------------
   Der Push liess sich bisher nur ueber tools/device-test-push.mjs ausloesen —
   also nur am Rechner. Im Gym ist das unbrauchbar.

   KEIN PRODUKTKNOPF. Der Abschnitt erscheint AUSSCHLIESSLICH, wenn die Seite
   mit ?gate=1 geoeffnet wurde, und der Zustand wird NICHT gespeichert: beim
   naechsten normalen Aufruf ist er wieder weg. Damit bleibt der produktive
   Pfad geschlossen, so wie vereinbart — es gibt keinen Weg, hier
   versehentlich hineinzugeraten.

   Gebaut wird mit denselben ECHTEN Modulen wie im Terminalwerkzeug. Das
   Sitzungs-Token holt sich der Abschnitt selbst aus der laufenden Anmeldung
   (dasselbe Muster wie „Jetzt synchronisieren"), es muss nichts kopiert
   werden. Und es wird zweistufig bedient: erst RECHNEN und die Kontrollwerte
   zeigen, dann — in einem zweiten, ausdruecklichen Griff — senden.
   ============================================================ */
var _gmGate={built:null,state:'idle',msg:'',result:null};
function gmGateOn(){
  try{return new URLSearchParams(location.search).get('gate')==='1';}catch(_){return false;}
}
/* Dieselben zwei Uebungen wie im Terminalwerkzeug und im Protokollblatt —
   absichtlich mit UNTERSCHIEDLICHEN Gewichten, weil eine einzelne Zahl die
   Skalierung nicht belegen kann (Gate G3). */
function gmGatePlanned(){
  return [
    {exerciseId:'devtest-1',slug:'bench_press',sets:2,minReps:8,maxReps:8,targetWeightKg:20,restSeconds:60},
    {exerciseId:'devtest-2',slug:'romanian_deadlift',sets:2,minReps:6,maxReps:6,targetWeightKg:30,restSeconds:90}
  ];
}
function gmGateOcc(){return 'po:'+todayStr()+':ps:devicetest';}
function gmGateRef(){return 'swe:'+gmGateOcc()+':v1';}
function gmGateBuild(){
  var O=window.ORVIA||{};
  var EXP=O.garminWorkoutExport,SP=O.strengthPlan,MAP=O.garminExerciseMap;
  if(!EXP||!SP||!MAP){_gmGate.state='error';_gmGate.msg='Module nicht geladen (Seite neu laden).';return null;}
  var r=EXP.buildGarminStrengthWorkout({
    occurrence:{occurrenceId:gmGateOcc(),l:'Gerätetest G1–G3',t:'Gym'},
    plannedExercises:gmGatePlanned(),
    mapping:MAP,
    /* Beide Gates ausdruecklich geoeffnet — das IST der Zweck dieses Laufs.
       Der Worker verlangt zusaetzlich die serverseitige Freigabe. */
    options:{fillUnverifiedIds:true,includeWeight:true}
  });
  if(!r.ok){_gmGate.state='error';_gmGate.msg='Exporter: '+r.reason;return null;}
  r.payloadHash=SP.fingerprint(gmGatePlanned());
  r.mappingVersion=MAP.VERSION;
  _gmGate.built=r;_gmGate.state='built';_gmGate.msg='';
  return r;
}
function gmGateCheck(){gmGateBuild();gmRerenderConnections();}
async function gmGateSend(){
  if(_gmGate.state==='sending')return;
  var b=_gmGate.built||gmGateBuild();
  if(!b)return gmRerenderConnections();
  _gmGate.state='sending';_gmGate.msg='Sende …';_gmGate.result=null;gmRerenderConnections();
  var base=(window.ORVIA_CFG&&ORVIA_CFG.GARMIN_WORKER_URL)||'';
  var sb=window.ORVIA&&ORVIA.sb,token=null;
  try{var s=sb?await sb.auth.getSession():null;token=s&&s.data&&s.data.session&&s.data.session.access_token;}catch(_){ }
  if(!base){_gmGate.state='error';_gmGate.msg='Worker nicht konfiguriert.';return gmRerenderConnections();}
  if(!token){_gmGate.state='error';_gmGate.msg='Keine aktive Sitzung — bitte neu anmelden.';return gmRerenderConnections();}
  var body={clientRef:gmGateRef(),occurrenceId:gmGateOcc(),payloadVersion:b.version,
    mappingVersion:b.mappingVersion,payloadHash:b.payloadHash,workout:b.workout,
    stepBindings:b.stepBindings,deviceTest:true};
  try{
    var resp=await fetch(base+'/workout/push',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify(body)});
    var txt=await resp.text(),json=null;try{json=JSON.parse(txt);}catch(_){ }
    _gmGate.result={status:resp.status,body:json||{raw:String(txt).slice(0,300)}};
    _gmGate.state=(resp.status===200)?'sent':'error';
    /* Die haeufigsten Faelle im Klartext, damit im Gym niemand raten muss. */
    if(resp.status===200)_gmGate.msg='Übertragen.';
    else if(resp.status===422)_gmGate.msg='Abgelehnt — sehr wahrscheinlich steht STRENGTH_PUSH_DEVICE_TEST im Worker noch auf false.';
    else if(resp.status===409)_gmGate.msg='Dieser clientRef wurde heute schon verwendet.';
    else if(resp.status===401)_gmGate.msg='Anmeldung abgelaufen oder Garmin-Token ungültig.';
    else _gmGate.msg='Worker antwortet mit '+resp.status+'.';
  }catch(e){
    _gmGate.state='error';_gmGate.msg='Worker nicht erreichbar (offline oder Netzwerkfehler).';
  }
  gmRerenderConnections();
}
function gmGateTestSection(){
  if(!gmGateOn())return '';
  var b=_gmGate.built,rows='';
  rows+=gmPRow('activity','Payload prüfen','Rechnet mit den echten Modulen. Kein Netz.','',
    (_gmGate.state==='sending')?'':'gmGateCheck()',_gmGate.state==='sending');
  if(b){
    var lines=[];
    for(var i=0;i<b.stepBindings.length;i++){
      var s=b.stepBindings[i];
      if(s.kind==='repeat')lines.push(s.exerciseName+' · '+s.sets+'×');
      if(s.kind==='set')lines.push('  '+s.reps+' Wdh.');
      if(s.kind==='rest')lines.push('  '+s.seconds+' s Pause');
    }
    rows+=gmPRow('check','Kontrollwerte',gmEsc('clientRef '+gmGateRef()),'',"",false);
    rows+=gmPRow('check','payloadHash',gmEsc(b.payloadHash),'',"",false);
    rows+=gmPRow('dumbbell','Schritte',gmEsc(lines.join(' · ')),'',"",false);
    rows+=gmPRow('gauge','Gewichte','20 kg → 20000 · 30 kg → 30000 (Gramm-Annahme, Gate G3)','',"",false);
  }
  rows+=gmPRow('link','An Garmin senden',
    b?'Sendet mit deviceTest — der Worker muss serverseitig freigeschaltet sein.':'Erst prüfen.',
    (_gmGate.state==='sending')?'Läuft …':(_gmGate.state==='sent'?'Gesendet':''),
    (b&&_gmGate.state!=='sending')?'gmGateSend()':'',!b||_gmGate.state==='sending');
  if(_gmGate.msg)rows+=gmPRow(_gmGate.state==='error'?'alert':'check','Ergebnis',gmEsc(_gmGate.msg),'',"",false);
  var r=_gmGate.result;
  if(r){
    rows+=gmPRow('info','Antwort','HTTP '+r.status+' · '+gmEsc(JSON.stringify(r.body).slice(0,180)),'',"",false);
    if(r.status===200&&r.body&&r.body.workoutId){
      rows+=gmPRow('check','workoutId — NOTIEREN',gmEsc(String(r.body.workoutId)),'',"",false);
    }
  }
  return '<div class="setting-title">Gerätetest G1–G3 (nur mit ?gate=1)</div><div class="setting-group">'+rows+'</div>'+
    '<div class="source">'+icon('info','xs')+' Kein Produktweg. Dieser Abschnitt erscheint nur, solange die Adresse ?gate=1 enthält, und wird nirgends gespeichert.</div>';
}

/* ============================================================
   v8-332 · Trainingsplan-VORSCHAU aus der Engine
   ------------------------------------------------------------
   WOZU. Die Engine rechnet seit Monaten taeglich eine vollstaendige Woche
   samt Verordnung — und wirft sie weg. Wer sie sehen wollte, musste das
   Flag `engine_v2_plan` einschalten; das ERSETZT aber den bestehenden
   Wochenplan. Man musste also seinen Plan aufs Spiel setzen, um zu
   erfahren, ob der Ersatz ueberhaupt taugt.

   Diese Vorschau dreht das um: rechnen und ZEIGEN, ohne irgendetwas zu
   schreiben. Kein Persistieren, kein Protokolleintrag, keine Aktivierung.
   Sie ist deshalb auch kein versteckter Testweg wie der Gate-Abschnitt,
   sondern normal sichtbar — sie kann nichts kaputt machen.

   EHRLICHER LEERZUSTAND. Kann die Engine nichts rechnen, steht der Grund
   da, nicht ein leerer Kasten. Und was in der Verordnung fehlt, wird nicht
   ergaenzt: keine geschaetzten Paces, keine erfundenen Dauern.

   PRAEZISE STATT BEQUEM — die EINE Nebenwirkung, die es doch gibt:
   `engineShadow.buildWeekNow()` schreibt den ueblichen Schattenprotokoll-
   Eintrag der laufenden Woche. Das faellt nicht ins Gewicht, weil der
   Eintrag je Woche ERSETZT und nicht angehaengt wird (shadow-runner:
   `log.filter(x => x.weekKey !== weekKey)` vor dem push) — die Zahl der
   protokollierten Wochen, aus der sich spaeter das ≥14-Tage-Gate speist,
   aendert sich also nicht. Aufgefallen ist das erst im Browsertest; die
   urspruengliche Formulierung "es wird nichts gespeichert" war zu absolut
   und steht deshalb nicht mehr da. Was gilt: der PLAN wird nicht angefasst,
   es entsteht kein Rueckname-Schnappschuss, und es wird nichts aktiviert.
   ============================================================ */
var _gmRxPrev={state:'idle',week:null,msg:'',at:null};

/* Rechnen. Schreibt NICHTS — weder Plan, noch Protokoll, noch Profil. */
function gmRxPreviewBuild(){
  _gmRxPrev.week=null;_gmRxPrev.msg='';_gmRxPrev.at=null;
  var sh=(window.ORVIA&&ORVIA.engineShadow)||null;
  var WP=(window.ORVIA&&ORVIA.weekProjection)||null;
  if(!sh||typeof sh.buildWeekNow!=='function'||!WP){
    _gmRxPrev.state='error';_gmRxPrev.msg='Engine-Module nicht geladen — Seite neu laden.';
    gmRerenderConnections();return null;
  }
  var wk=null;
  try{wk=sh.buildWeekNow();}catch(e){
    _gmRxPrev.state='error';_gmRxPrev.msg='Die Engine konnte nicht rechnen: '+((e&&e.message)||'unbekannter Fehler');
    gmRerenderConnections();return null;
  }
  if(!wk||!wk.result){
    _gmRxPrev.state='error';
    _gmRxPrev.msg='Die Engine hat keine Woche geliefert. Meist fehlen noch Trainingsdaten oder Zielangaben.';
    gmRerenderConnections();return null;
  }
  var proj=null;
  try{proj=WP.projectWeek(wk.result);}catch(e2){
    _gmRxPrev.state='error';_gmRxPrev.msg='Die Woche liess sich nicht darstellen: '+((e2&&e2.message)||'unbekannter Fehler');
    gmRerenderConnections();return null;
  }
  if(!proj||proj.ok!==true){
    _gmRxPrev.state='error';_gmRxPrev.msg='Die Woche liess sich nicht darstellen'+((proj&&proj.error)?(' ('+proj.error+')'):'')+'.';
    gmRerenderConnections();return null;
  }
  _gmRxPrev.week=proj;_gmRxPrev.state='built';
  try{_gmRxPrev.at=new Date().toISOString();}catch(_){ }
  gmRerenderConnections();return proj;
}

/* Eine Einheit als Zeilen. Nutzt AUSSCHLIESSLICH prescription-format —
   hier wird nicht zweitformatiert, damit es nur eine Wahrheit gibt. */
function gmRxPreviewUnitHTML(it){
  var F=(window.ORVIA&&ORVIA.prescriptionFormat)||null;
  var kopf='<div style="font-weight:600">'+gmEsc(it.t+' · '+it.l)+(it.d?(' <span class="muted" style="font-weight:400">· '+gmEsc(it.d)+'</span>'):'')+'</div>';
  if(!F||!it.rx){
    return kopf+'<div class="muted" style="font-size:12px;margin-top:2px">Keine Vorgabe hinterlegt</div>';
  }
  var r=F.formatPrescription(it.rx,{nameOf:(typeof gmExName==='function')?gmExName:null});
  if(!r.ok){
    return kopf+'<div class="muted" style="font-size:12px;margin-top:2px">Keine darstellbare Vorgabe'+
      ((r.warnings&&r.warnings.length)?(' ('+gmEsc(r.warnings[0].code)+')'):'')+'</div>';
  }
  var zeilen=r.lines.map(function(l){
    var stark=(l.kind==='group'||l.kind==='work'||l.kind==='exercise');
    return '<div style="font-size:12px;margin-top:2px;'+(stark?'':'opacity:.7')+'">'+gmEsc(l.text)+'</div>';
  }).join('');
  var warn=(r.warnings&&r.warnings.length)
    ? '<div class="muted" style="font-size:11px;margin-top:3px">'+gmEsc(r.warnings.length+' Block/Bloecke nicht darstellbar')+'</div>' : '';
  /* v8-349: auch die Vorschau zeigt die Hinweise. Zwei Ansichten derselben
     Einheit, von denen eine die Herkunft weglaesst, waeren zwei Wahrheiten
     — und die Vorschau ist genau die Stelle, an der man nachsieht, ob das
     eingespeiste Wissen wirklich ankommt. */
  var hin='';
  if(it.hinweise&&it.hinweise.length&&typeof F.hinweisZeilen==='function'){
    try{
      hin=F.hinweisZeilen(it.hinweise).map(function(h){
        return '<div style="font-size:11px;margin-top:3px;opacity:.85">↳ '+gmEsc(h.text)+
          (h.herkunft?(' <span class="muted">['+gmEsc(h.herkunft)+']</span>'):'')+'</div>';
      }).join('');
    }catch(_){hin='';}
  }
  return kopf+zeilen+warn+hin;
}

function gmRxPreviewSection(){
  var WD=['Mo','Di','Mi','Do','Fr','Sa','So'];
  var rows='';
  rows+=gmPRow('activity','Engine-Woche berechnen',
    'Rechnet die Woche und zeigt sie an. Dein Plan wird NICHT verändert.',
    (_gmRxPrev.state==='built')?'Berechnet':'','gmRxPreviewBuild()',false);
  if(_gmRxPrev.msg)rows+=gmPRow('alert','Kein Ergebnis',gmEsc(_gmRxPrev.msg),'',"",false);
  var p=_gmRxPrev.week;
  if(p){
    var gesamt=0;
    for(var d=0;d<7;d++)gesamt+=((p.days&&p.days[d])||[]).length;
    rows+=gmPRow('check','Einheiten in der Woche',
      gesamt+' geplant'+((p.counts&&p.counts.unmapped)?(' · '+p.counts.unmapped+' nicht darstellbar'):''),'',"",false);
    for(var i=0;i<7;i++){
      var tag=(p.days&&p.days[i])||[];
      if(!tag.length)continue;
      var inhalt=tag.map(gmRxPreviewUnitHTML).join('<div style="height:6px"></div>');
      rows+='<div class="setting-row" style="align-items:flex-start"><div class="sr-ic">'+icon('calendar')+'</div>'+
        '<div class="sr-tx" style="flex:1"><div class="sr-t">'+WD[i]+'</div><div class="sr-s" style="white-space:normal">'+inhalt+'</div></div></div>';
    }
    if(p.unmapped&&p.unmapped.length){
      rows+=gmPRow('info','Nicht darstellbar',
        gmEsc(p.unmapped.map(function(u){return u.reason;}).join(', ')),'',"",false);
    }
  }
  return '<div class="setting-title">Trainingsplan-Vorschau (Engine)</div><div class="setting-group">'+rows+'</div>'+
    '<div class="source">'+icon('info','xs')+' Reine Vorschau: dein Wochenplan wird nicht verändert, nichts wird aktiviert, es entsteht kein Rückweg-Schnappschuss. Die Engine schreibt dabei nur ihren üblichen Schatten-Eintrag für die laufende Woche — der wird ersetzt, nicht vermehrt. Angezeigt wird ausschließlich, was die Engine tatsächlich ausgerechnet hat; fehlende Angaben werden nicht ergänzt.</div>';
}
try{window.ORVIA=window.ORVIA||{};ORVIA.enginePlanPreview=gmRxPreviewBuild;}catch(_){ }
/* Phase 3 · Block 2 (2026-08-05): Equipment-Sheet — identische Quelle wie der
   Legacy-Renderer (equipmentHTML, profile.js). Anlegen/Loeschen nutzt die
   bestehenden produktiven Handler; das Sheet zieht danach automatisch mit. */
function gmOpenEquipmentSheet(){
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var body='';
  try{body=(typeof equipmentHTML==='function')?equipmentHTML():'<p class="muted">'+GM_NA+'</p>';}catch(_){body='<p class="muted">'+GM_NA+'</p>';}
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('gauge')+'</div><div><h3>Equipment &amp; Verschleiß</h3><div class="sh-sub" style="margin:2px 0 0">km je Schuh/Rad — automatisch gezählt bei Auswahl in der Einheit</div></div></div>'+
    '<div class="sh-block" id="gmEquipSheetBody">'+body+'</div>'+
    '<div class="source">'+icon('info','xs')+' Warnung ab 90 % des Wechsel-Limits — kein Limit gesetzt = reiner Zähler, keine erfundene Lebensdauer.</div>';
  gmOpenSheet('detailSheet');
}
function gmRefreshEquipmentSheet(){
  var host=document.getElementById('gmEquipSheetBody');if(!host)return;
  try{host.innerHTML=(typeof equipmentHTML==='function')?equipmentHTML():host.innerHTML;}catch(_){ }
}
function gmProfUnits(){
  return gmPPageHead('Einheiten & Berechnungen','Einheitlich über alle Bereiche')+
    '<div class="setting-title">Konfiguration</div><div class="setting-group">'+
    gmPRow('activity','Distanz &amp; Gewicht','Kilometer, Kilogramm','Metrisch','',false)+
    gmPRow('calendar','Wochenbeginn','Für Plan und Wochenreview','Montag','',false)+
    gmPRow('heart','Herzfrequenzzonen','Keine neue Zonenregel im UI','—','',true)+'</div>';
}
function gmProfData(){
  var lb='—';try{if(typeof DB!=='undefined'&&DB&&DB._lastBackup){var d=new Date(DB._lastBackup);if(!isNaN(d))lb=d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+', '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});}}catch(_){ }
  return gmPPageHead('Daten verwalten','Volle Kontrolle')+
    '<div class="setting-title">Konfiguration</div><div class="setting-group">'+
    gmPRow('db','Daten exportieren','JSON-Export über die Sicherung','Export','exportData&&exportData()')+
    /* Phase 6.5 ② (2026-08-05): vollständiger Cloud-Export (alle nutzerbezogenen
       Tabellen, maschinenlesbar) — schliesst die Art.-20-Lücke des lokalen Exports. */
    gmPRow('db','Cloud-Export (vollständig)','Alle Cloud-Tabellen als JSON — Datenübertragbarkeit','Export','exportCloudData&&exportCloudData()')+
    gmPRow('copy','Lokale Sicherung','Letzte Sicherung: '+gmEsc(lb),'','',false)+
    gmPRow('x','Alle Daten löschen','Nur mit erneuter Bestätigung','','orviaDeleteAccount&&orviaDeleteAccount()')+'</div>';
}
function gmProfAccount(){
  var email='—';try{email=(window.ORVIA&&ORVIA.user&&ORVIA.user.email)?ORVIA.user.email:'—';}catch(_){ }
  return gmPPageHead('Konto & Sicherheit','Persönliche Zugangsdaten')+
    '<div class="setting-title">Konfiguration</div><div class="setting-group">'+
    gmPRow('heart',gmEsc(gmProfName()||'—'),gmEsc(email),'','',false)+
    gmPRow('lock','Passwort &amp; Anmeldung','Über den bestehenden Auth-Flow','—','orviaChangePassword&&orviaChangePassword()')+
    gmPRow('shield','Angemeldete Geräte','Keine kanonische Geräteliste','—','',true)+'</div>';
}
function gmOrviaBuildLabel(){
  try{
    var m=document.querySelector('meta[name="orvia-build"]');
    var v=m&&m.content;
    return v?('Build '+v.replace(/^orvia-/,'')):'—';
  }catch(_){return '—';}
}
function gmProfAbout(){
  return gmPPageHead('Über ORVIA','Das System hinter deinem Training')+
    '<div class="setting-title">Konfiguration</div><div class="setting-group">'+
    gmPRow('info','ORVIA','Progressive Web App',gmOrviaBuildLabel(),'',false)+
    gmPRow('shield','Medizinischer Hinweis','Kein Ersatz für medizinische Diagnose','','',false)+
    gmPRow('book','Hilfe &amp; Support','Dokumentation folgt — '+GM_NA,'—','',true)+'</div>';
}
/* ---------- GM5.3: Zeilenregister der Profil-Unterseiten ----------
   Die beiden Register halten ausschliesslich die Werte, die die jeweilige Zeile
   ohnehin schon gerendert hat bzw. die im kanonischen Datensatz der Zeile bereits
   vorliegen. Es wird nichts berechnet, abgeleitet, ergaenzt oder gespeichert. */
var _gmBtSlots=[],_gmMileSlots=[];
var GM_MS_STATUS={planned:'geplant',in_progress:'in Arbeit',achieved:'erreicht',skipped:'übersprungen'};
function gmProfBestTimes(){
  var b=null;try{b=(typeof bestTimes==='function')?bestTimes():null;}catch(_){ }
  var fp=function(sec){try{return (typeof fmtPace==='function')?fmtPace(sec):(Calc&&Calc.fmtPace?Calc.fmtPace(sec):'—');}catch(_){return '—';}};
  var rows=[
    {d:'1',u:'km',k:'k1',t:b&&b.t1!=null?fp(b.t1):null,real:b&&b.real&&b.real.k1},
    {d:'5',u:'km',k:'k5',t:b&&b.t5!=null?fp(b.t5):null,real:b&&b.real&&b.real.k5},
    {d:'10',u:'km',k:'k10',t:b&&b.t10!=null?fp(b.t10):null,real:b&&b.real&&b.real.k10},
    {d:'21,1',u:'km',t:null},{d:'400',u:'m Schwimm',t:null},{d:'20',u:'km Rad',t:null}
  ];
  var lvl=(typeof gmLevel==='function')?gmLevel():'f';
  var h=gmPPageHead('Bestzeiten','Persönliche Rekorde je Distanz')+'<div style="padding:0 18px">';
  _gmBtSlots=[];
  rows.forEach(function(r,i){
    /* KF-021: Quelle und Messdistanz kommen aus bestTimes().src/.meas — die Zeile
       behauptet nicht mehr pauschal „Import", wo eine Runde gemessen wurde. */
    var m=(r.k&&b&&b.meas)?b.meas[r.k]:null;
    var sub=r.t==null?GM_NA:(r.k?gmBtSrcLabel(b,r.k):(r.real?'eingetragene Bestleistung':'geschätzt (Riegel-Modell, keine Messung)'));
    var subFull=sub+(lvl==='p'&&r.t!=null&&m&&m.laps?' · '+m.laps+(m.laps===1?' Runde':' Runden'):'');
    var timeTxt=(r.t!=null?r.t:'—');
    _gmBtSlots.push({dist:r.d+' '+r.u,time:timeTxt,sub:subFull,
      date:(m&&m.date)?((typeof fmtDate==='function')?fmtDate(m.date):m.date):null,
      meas:m||null,imp:null,has:(r.t!=null)});
    h+='<button type="button" class="bt-row'+(r.t!=null?'':' bt-empty')+'" onclick="gmOpenBtRowSheet('+i+')"><div class="bt-dist"><b>'+r.d+'</b><span>'+r.u+'</span></div><div class="bt-b"><div class="bt-time">'+gmEsc(timeTxt)+'</div><div class="bt-sub">'+gmEsc(subFull)+'</div></div><div class="bt-imp">'+icon('chev','sm')+'</div></button>';
  });
  h+='<div class="mini-note">'+icon('info','xs')+'<div>Gemessene Bestzeiten stammen aus zusammenhängenden Runden deiner Uhr. Das Messfenster darf höchstens 5 % länger sein als die Distanz — die Zeit ist damit eine Obergrenze, nie schöngerechnet. Geschätzte Werte erscheinen nur dort, wo keine Messung existiert.</div></div></div><div class="tabspacer"></div>';
  return h;
}
/* Bestzeiten-Detailsheet: konsumiert exakt die Werte der angetippten Zeile. */
function gmOpenBtRowSheet(i){
  var s=_gmBtSlots[i];if(!s)return;
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var kv=[['Disziplin / Distanz',s.dist],['Leistung',s.has?s.time:GM_NA],['Datum',s.date!=null?s.date:GM_NA]];
  /* KF-021: bei gemessenen Werten die tatsaechlich gemessene Strecke ausweisen —
     5 km aus einem 5,12-km-Fenster ist eine Obergrenze, keine exakte 5-km-Zeit. */
  if(s.meas&&s.meas.km!=null)kv.push(['Gemessene Strecke',(typeof fmtDe==='function'?fmtDe(s.meas.km):s.meas.km)+' km']);
  if(s.meas&&s.meas.laps)kv.push(['Runden im Messfenster',String(s.meas.laps)]);
  if(s.imp!=null)kv.push(['Verbesserung',s.imp]);
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon('bolt')+'</div><div><h3>'+gmEsc(s.dist)+'</h3><div class="sh-sub" style="margin:2px 0 0">Bestzeit</div></div></div>'+
    '<div class="card prestart" style="margin:14px 0 0">'+kv.map(function(r){return '<div class="ps-row"><span>'+gmEsc(r[0])+'</span><b>'+gmEsc(r[1])+'</b></div>';}).join('')+'</div>'+
    '<div class="sh-block"><div class="bh">Herkunft &amp; Einordnung</div><p>'+gmEsc(s.sub)+'</p></div>'+
    '<div class="source">'+icon('info','xs')+' Gleiche Werte wie in der Zeile — keine zusätzliche Berechnung.</div>';
  gmOpenSheet('detailSheet');
}
/* ---------- Meilensteine & Medaillen (Produktentscheidung 2026-08-04) ----------
   Inhalte kommen aus ORVIA.achievements (js/achievements.js): reine Arithmetik
   ueber die vereinheitlichte kanonische Aktivitaetsliste — gemessene Leitern
   (laengster Lauf, Wochenumfang, Konstanz, …) mit Datum je erreichter Stufe.
   Ohne Modul oder ohne Aktivitaeten bleibt exakt der bisherige ehrliche
   Leerzustand. Es wird weiterhin nichts erfunden. */
function gmAchievements(){
  try{
    var A=window.ORVIA&&ORVIA.achievements;
    if(!A||typeof listActivitiesUnified!=='function')return null;
    var r=A.computeAchievements(listActivitiesUnified(400));
    return (r&&r.activityCount>0)?r:null;
  }catch(_){return null;}
}
function gmAchFmtVal(v,unit){
  var s=(typeof fmtDe==='function')?fmtDe(v):String(v);
  return s+(unit||'');
}
function gmOpenMilestonesEntry(){
  if(!gmAchievements()){gmOpenAnaTeaserSheet('ms');return;}
  try{openProfile();_gmProfDirectEntry=true;gmOpenProfPage('milestones');}catch(_){gmOpenAnaTeaserSheet('ms');}
}
function gmOpenMedalsEntry(){
  if(!gmAchievements()){gmOpenAnaTeaserSheet('medals');return;}
  try{openProfile();_gmProfDirectEntry=true;gmOpenProfPage('medals');}catch(_){gmOpenAnaTeaserSheet('medals');}
}
/* Naechster sinnvoller Meilenstein: angefangene Leiter mit dem groessten
   gemessenen Fortschritt zur naechsten Stufe. */
function gmNextMilestone(ach){
  if(!ach)return null;
  for(var i=0;i<ach.milestones.length;i++){
    var m=ach.milestones[i];
    if(m.next!=null&&m.current>0)return m;
  }
  for(var j=0;j<ach.milestones.length;j++){if(ach.milestones[j].next!=null)return ach.milestones[j];}
  return null;
}
function gmProfMedals(){
  var ach=gmAchievements();
  var h=gmPPageHead('Medaillen','Für nachhaltigen Fortschritt – nicht für Raubbau')+'<div class="medal-grid" style="padding:0 18px">';
  if(!ach){
    for(var i=0;i<6;i++){
      h+='<div class="medal locked"><div class="m-badge">'+icon('shield')+'</div><b>—</b><span>'+GM_NA+'</span><div class="m-prog"><i style="width:0%"></i></div></div>';
    }
    h+='</div><div class="mini-note">'+icon('info','xs')+'<div>Medaillen erscheinen mit deinen ersten abgeschlossenen Aktivitäten — keine erfundenen Auszeichnungen, Tiers oder Fortschritte.</div></div><div class="tabspacer"></div>';
    return h;
  }
  /* Bugfix (2026-08-05, Nutzer-Feedback „12 verdient, nur 6 angezeigt"): das Raster
     kappte VERDIENTE Medaillen hart bei 6 (slots.length>=6) — echte, bereits erreichte
     Auszeichnungen verschwanden dadurch kommentarlos, sobald mehr als 6 Stufen erreicht
     waren. .medal-grid ist ein zeilenloses 2-Spalten-Grid (styles.css) und wraeppt von
     selbst — der Deckel war unnoetig. Jetzt: ALLE verdienten Medaillen werden gezeigt,
     danach noch offene naechste Stufen als Ausblick (max. 6, sonst wird die Seite bei
     vielen Medaillen unuebersichtlich lang); Platzhalter fuellen nur auf, wenn insgesamt
     weniger als 6 Kacheln zusammenkommen. */
  var slots=[];
  ach.medals.forEach(function(m){
    var dt=m.date?((typeof fmtDate==='function')?fmtDate(m.date):m.date):'—';
    slots.push('<div class="medal earned"><div class="m-badge">'+icon(m.icon||'shield')+'</div><b>'+gmEsc(gmAchFmtVal(m.step,m.unit))+'</b><span>'+gmEsc(m.label)+' · '+gmEsc(dt)+'</span><div class="m-prog"><i style="width:100%"></i></div></div>');
  });
  var earnedN=slots.length,lockedCap=earnedN+6;
  /* Naechste erreichbare Stufen als gesperrte Slots mit ECHTEM, gemessenem Fortschritt. */
  ach.milestones.forEach(function(m){
    if(slots.length>=lockedCap||m.next==null)return;
    slots.push('<div class="medal locked"><div class="m-badge">'+icon(m.icon||'shield')+'</div><b>'+gmEsc(gmAchFmtVal(m.next,m.unit))+'</b><span>'+gmEsc(m.label)+' · Ist '+gmEsc(gmAchFmtVal(m.current,m.unit))+'</span><div class="m-prog"><i style="width:'+m.progress+'%"></i></div></div>');
  });
  while(slots.length<6)slots.push('<div class="medal locked"><div class="m-badge">'+icon('shield')+'</div><b>—</b><span>'+GM_NA+'</span><div class="m-prog"><i style="width:0%"></i></div></div>');
  h+=slots.join('');
  h+='</div><div class="mini-note">'+icon('info','xs')+'<div>'+gmEsc(ach.provenance)+' '+(earnedN>0?(earnedN+' verdiente '+(earnedN===1?'Medaille':'Medaillen')+'. '):'')+'Gesperrte Medaillen zeigen die nächste Stufe mit deinem gemessenen Ist-Wert.</div></div><div class="tabspacer"></div>';
  return h;
}
/* Liest ausschliesslich bereits vorhandene Felder des Meilenstein-Datensatzes aus.
   Kein Rechnen, kein Ableiten, kein Ersatzwert — fehlende Felder bleiben null. */
function gmMileSlot(m,t,d){
  var g=function(k){try{var v=m?m[k]:null;return (v==null||v==='')?null:v;}catch(_){return null;}};
  var unit=g('unit');
  var val=function(v){return v==null?null:(String(v)+(unit?' '+unit:''));};
  return {title:t,desc:d,present:!!m,
    start:val(g('startValue')),target:val(g('targetValue')),current:val(g('currentValue')),
    status:g('status'),date:g('targetDate')};
}
function gmProfMilestones(){
  var list=[];try{if(typeof PROFILE!=='undefined'&&PROFILE&&Array.isArray(PROFILE.milestones))list=PROFILE.milestones.slice(0,6);}catch(_){ }
  var ach=gmAchievements();
  var h=gmPPageHead('Meilensteine','Fortschritt mit realistischen nächsten Schritten')+'<div style="padding:0 18px">';
  _gmMileSlots=[];
  if(!ach){
    /* Bisheriger ehrlicher Zustand: nur Zielportfolio-Eintraege, kein berechneter Fortschritt. */
    for(var i=0;i<6;i++){
      var m=list[i];
      var t=m?(m.label||m.title||m.name||'—'):'—';
      var d=m?'Aus deinem Zielportfolio':GM_NA;
      _gmMileSlots.push(gmMileSlot(m,t,d));
      h+='<button type="button" class="mile" onclick="gmOpenMileRowSheet('+i+')"><div class="mi-ic">'+icon(m?'target':'info','sm')+'</div><div class="mile-b"><div class="mile-t">'+gmEsc(t)+'</div><div class="mile-d">'+gmEsc(d)+'</div><div class="mile-track"><i style="width:0%"></i></div><div class="mile-meta"><span>Start —</span><span>—</span><span>Ziel —</span></div></div></button>';
    }
    h+='<div class="mini-note">'+icon('info','xs')+'<div>Kein Fortschritt wird im UI berechnet.</div></div></div><div class="tabspacer"></div>';
    return h;
  }
  /* GEMESSENE Leitern zuerst (mit echtem Fortschritt), danach Zielportfolio-
     Eintraege read-only, aufgefuellt bis 6 Slots (Strukturvertrag der Seite). */
  var rows=[];
  ach.milestones.forEach(function(mm){
    var last=mm.lastAchieved;
    rows.push({
      kind:'measured',
      t:mm.label+(mm.next!=null?' · nächste Stufe '+gmAchFmtVal(mm.next,mm.unit):' · alle Stufen erreicht'),
      d:'Ist: '+gmAchFmtVal(mm.current,mm.unit)+' — gemessen',
      prog:mm.progress,icon:mm.icon||'target',
      slot:{title:mm.label,desc:'Gemessen aus deinen abgeschlossenen Aktivitäten.',present:true,
        start:last?gmAchFmtVal(last.step,mm.unit):null,
        target:mm.next!=null?gmAchFmtVal(mm.next,mm.unit):'alle Stufen erreicht',
        current:gmAchFmtVal(mm.current,mm.unit),
        status:mm.done?'achieved':'in_progress',
        date:last&&last.date?((typeof fmtDate==='function')?fmtDate(last.date):last.date):null},
      meta:['Stufe '+(last?gmAchFmtVal(last.step,mm.unit):'—'),gmAchFmtVal(mm.current,mm.unit),(mm.next!=null?'Ziel '+gmAchFmtVal(mm.next,mm.unit):'Erreicht')]
    });
  });
  list.forEach(function(m){
    rows.push({kind:'goal',t:m.label||m.title||m.name||'—',d:'Aus deinem Zielportfolio',prog:0,icon:'target',
      slot:gmMileSlot(m,m.label||m.title||m.name||'—','Aus deinem Zielportfolio'),meta:['Start —','—','Ziel —']});
  });
  while(rows.length<6)rows.push({kind:'na',t:'—',d:GM_NA,prog:0,icon:'info',
    slot:gmMileSlot(null,'—',GM_NA),meta:['Start —','—','Ziel —']});
  rows.slice(0,6).forEach(function(r,i){
    _gmMileSlots.push(r.slot);
    h+='<button type="button" class="mile" onclick="gmOpenMileRowSheet('+i+')"><div class="mi-ic">'+icon(r.icon,'sm')+'</div><div class="mile-b"><div class="mile-t">'+gmEsc(r.t)+'</div><div class="mile-d">'+gmEsc(r.d)+'</div><div class="mile-track"><i style="width:'+(r.prog||0)+'%"></i></div><div class="mile-meta"><span>'+gmEsc(r.meta[0])+'</span><span>'+gmEsc(r.meta[1])+'</span><span>'+gmEsc(r.meta[2])+'</span></div></div></button>';
  });
  h+='<div class="mini-note">'+icon('info','xs')+'<div>'+gmEsc(ach.provenance)+' Zielportfolio-Einträge bleiben read-only.</div></div></div><div class="tabspacer"></div>';
  return h;
}
/* Meilenstein-Detailsheet: vollstaendige, ungekuerzte Zeileninhalte plus die im
   Datensatz bereits vorhandenen Felder. Fehlendes wird ehrlich als NA gezeigt. */
function gmOpenMileRowSheet(i){
  var s=_gmMileSlots[i];if(!s)return;
  var sh=document.getElementById('detailSheet');if(!sh)return;
  var st=(s.status!=null)?(GM_MS_STATUS[s.status]||String(s.status)):null;
  var kv=[['Startwert',s.start],['Zielwert',s.target],['Aktueller Stand',s.current],['Status',st]];
  if(s.date!=null)kv.push(['Zieldatum',s.date]);
  sh.innerHTML='<div class="grab"></div><div class="sh-head"><div class="sh-hic" style="background:var(--surface-2);color:var(--muted)">'+icon(s.present?'target':'info')+'</div><div><h3>'+gmEsc(s.title)+'</h3><div class="sh-sub" style="margin:2px 0 0">Meilenstein</div></div></div>'+
    '<div class="sh-block"><div class="bh">Beschreibung</div><p>'+gmEsc(s.desc)+'</p></div>'+
    '<div class="card prestart" style="margin:14px 0 0">'+kv.map(function(r){return '<div class="ps-row"><span>'+gmEsc(r[0])+'</span><b>'+gmEsc(r[1]!=null?r[1]:GM_NA)+'</b></div>';}).join('')+'</div>'+
    '<div class="source">'+icon('info','xs')+' Werte unverändert aus deinem Zielportfolio — im UI wird kein Fortschritt berechnet.</div>';
  gmOpenSheet('detailSheet');
}
var _gmPcSport='run';
var _gmPcTarget='pace';
function gmProfSetPcSport(s){_gmPcSport=s;_gmPcTarget=(s==='bike')?'speed':'pace';gmOpenProfPage('paceCalc');}
function gmProfSetPcTarget(t){_gmPcTarget=t;gmOpenProfPage('paceCalc');}
/* GM7.9i — Pace-Rechner aktiv (Freigabe Auftraggeber 2026-08-02).
   Der Rechner arbeitet AUSSCHLIESSLICH mit dem, was der Nutzer selbst eintippt: er liest
   keine Trainings-, Plan- oder Aktivitaetsdaten, speichert nichts und beeinflusst keine
   Empfehlung. Pace/Zeit/Distanz bzw. Geschwindigkeit sind reine Arithmetik derselben drei
   Eingabewerte. Die Wettkampfprognose nutzt den KANONISCHEN Rechenkern Calc.riegel()
   (calc.js) — keine im UI nachgebaute Formel.
   Abweichung vom Golden Master, bewusst: der Prototyp belegt die Felder mit Demowerten
   (10 km / 54:00) vor. Hier starten sie leer; Ergebnis und Prognose bleiben „—", bis
   wirklich zwei gueltige Werte eingegeben sind. */
function gmPcNum(s){s=String(s==null?'':s).trim().replace(',','.');if(!s)return null;
  if(!/^\d+(\.\d+)?$/.test(s))return null;var v=parseFloat(s);return (isFinite(v)&&v>0)?v:null;}
function gmPcMin(s){ /* „h:mm:ss" | „mm:ss" | „45" (Minuten) -> Minuten */
  s=String(s==null?'':s).trim();if(!s)return null;
  var p=s.split(':');if(p.length>3)return null;
  for(var i=0;i<p.length;i++){if(!/^\d+([.,]\d+)?$/.test(p[i].trim()))return null;}
  var n=p.map(function(x){return parseFloat(x.trim().replace(',','.'));});
  var m=(n.length===1)?n[0]:(n.length===2)?(n[0]+n[1]/60):(n[0]*60+n[1]+n[2]/60);
  return (isFinite(m)&&m>0)?m:null;}
function gmPcFmtHms(min){if(min==null||!isFinite(min)||min<=0)return '—';
  var t=Math.round(min*60),h=Math.floor(t/3600),m=Math.floor((t-h*3600)/60),s=t-h*3600-m*60;
  return h>0?(h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')):(m+':'+String(s).padStart(2,'0'));}
function gmPcFmtMs(min){if(min==null||!isFinite(min)||min<=0)return '—';
  var t=Math.round(min*60),m=Math.floor(t/60),s=t-m*60;
  return m+':'+String(s).padStart(2,'0');}
function gmPcVal(id){var el=document.getElementById(id);return el?el.value:'';}
function gmPcCompute(){
  var sp=_gmPcSport,tgt=_gmPcTarget;
  var dist=gmPcNum(gmPcVal('pcDist')),time=gmPcMin(gmPcVal('pcTime')),
      pace=gmPcMin(gmPcVal('pcPace')),speed=gmPcNum(gmPcVal('pcSpeed'));
  var res='—',dKm=null,tMin=null;
  if(sp==='bike'){
    if(tgt==='speed'&&dist!=null&&time!=null)res=fmtDe(Math.round(dist/(time/60)*10)/10)+' km/h';
    else if(tgt==='time'&&dist!=null&&speed!=null)res=gmPcFmtHms(dist/speed*60);
    else if(tgt==='dist'&&time!=null&&speed!=null)res=fmtDe(Math.round(speed*(time/60)*100)/100)+' km';
  }else if(sp==='swim'){                       /* Distanz in Metern, Pace je 100 m */
    if(tgt==='pace'&&dist!=null&&time!=null)res=gmPcFmtMs(time/(dist/100))+' /100 m';
    else if(tgt==='time'&&dist!=null&&pace!=null)res=gmPcFmtHms(pace*(dist/100));
    else if(tgt==='dist'&&time!=null&&pace!=null)res=fmtDe(Math.round(time/pace*100))+' m';
  }else{
    if(tgt==='pace'&&dist!=null&&time!=null){res=gmPcFmtMs(time/dist)+' /km';dKm=dist;tMin=time;}
    else if(tgt==='time'&&dist!=null&&pace!=null){tMin=pace*dist;dKm=dist;res=gmPcFmtHms(tMin);}
    else if(tgt==='dist'&&time!=null&&pace!=null){dKm=time/pace;tMin=time;res=fmtDe(Math.round(dKm*100)/100)+' km';}
  }
  var r=document.getElementById('pcResult');if(r)r.textContent=res;
  /* Prognose nur beim Laufen und nur aus einem vollstaendigen, gueltigen Paar. */
  var P={pcP5:5,pcP10:10,pcPHM:null};
  try{P.pcPHM=(window.Calc&&Calc.HM_KM)||21.0975;}catch(_){P.pcPHM=21.0975;}
  Object.keys(P).forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    var v=null;
    try{if(sp==='run'&&dKm!=null&&tMin!=null&&window.Calc&&typeof Calc.riegel==='function')v=Calc.riegel(dKm,tMin,P[id]);}catch(_){ }
    el.textContent=(v!=null)?gmPcFmtHms(v):'—';
  });
}
function gmProfPaceCalc(){
  var sp=_gmPcSport,tgt=_gmPcTarget;
  var sports=[['run','Laufen'],['swim','Schwimmen'],['bike','Radfahren']];
  var targets=sp==='bike'?[['speed','Geschwindigkeit'],['time','Zeit'],['dist','Distanz']]:[['pace','Pace'],['time','Zeit'],['dist','Distanz']];
  var fld=function(id,label,mode,ph){return '<div class="calc-field"><label>'+label+'</label><input id="'+id+'" inputmode="'+mode+'" placeholder="'+ph+'" oninput="gmPcCompute()" autocomplete="off"></div>';};
  var distF=fld('pcDist','Distanz ('+(sp==='swim'?'m':'km')+')','decimal',sp==='swim'?'1500':'10');
  var timeF=fld('pcTime','Zeit (h:mm:ss)','numeric','52:30');
  var paceF=fld('pcPace','Pace ('+(sp==='swim'?'mm:ss/100m':'mm:ss/km')+')','numeric',sp==='swim'?'1:52':'5:15');
  var speedF=fld('pcSpeed','Geschw. (km/h)','decimal','33');
  var fields;
  if(sp==='bike'){fields=tgt==='speed'?distF+timeF:tgt==='time'?distF+speedF:timeF+speedF;}
  else{fields=tgt==='pace'?distF+timeF:tgt==='time'?distF+paceF:timeF+paceF;}
  var h=gmPPageHead('Pace- & Geschwindigkeitsrechner','Zwei Werte eingeben – der dritte wird berechnet')+'<div style="padding:0 18px">';
  h+='<div class="calc-seg">'+sports.map(function(s){return '<button class="'+(sp===s[0]?'on':'')+'" onclick="gmProfSetPcSport(\''+s[0]+'\')">'+s[1]+'</button>';}).join('')+'</div>';
  h+='<div class="calc-target">'+targets.map(function(t){return '<button class="'+(tgt===t[0]?'on':'')+'" onclick="gmProfSetPcTarget(\''+t[0]+'\')">'+t[1]+' berechnen</button>';}).join('')+'</div>';
  h+=fields;
  h+='<div class="calc-field result"><label>Ergebnis</label><b id="pcResult">—</b></div>';
  if(sp==='run'){
    h+='<div class="sectlabel">Wettkampfprognosen</div><div class="card"><div class="link-row">'+
      [['5 km','pcP5'],['10 km','pcP10'],['Halbmarathon','pcPHM']].map(function(r){return '<div class="calc-field" style="margin-bottom:8px"><label>'+r[0]+'</label><b id="'+r[1]+'" style="font-size:16px">—</b></div>';}).join('')+
      '</div><div class="mini-note">'+icon('info','xs')+'<div>Riegel-Schätzung aus deiner Eingabe (kanonischer Rechenkern). Grobe Orientierung, keine Garantie — keine Messung und kein Trainingsziel.</div></div></div>';
  }
  h+='</div><div class="tabspacer"></div>';
  return h;
}
var GM_PROF_ROUTES={
  settings:function(){return gmProfSettings();},appearance:function(){return gmProfAppearance();},
  notifications:function(){return gmProfNotifications();},privacy:function(){return gmProfPrivacy();},
  goals:function(){return gmProfGoals();},dailyGoals:function(){return gmProfDailyGoals();},
  planSettings:function(){return gmProfPlanSettings();},health:function(){return gmProfHealth();},
  connections:function(){return gmProfConnections();},units:function(){return gmProfUnits();},
  data:function(){return gmProfData();},account:function(){return gmProfAccount();},
  about:function(){return gmProfAbout();},bestTimes:function(){return gmProfBestTimes();},
  medals:function(){return gmProfMedals();},milestones:function(){return gmProfMilestones();},
  paceCalc:function(){return gmProfPaceCalc();},
  /* G1 (2026-08-07): Leistungsdaten. Ohne diese Seite bleiben Intensitaet,
     Zielprognose, Wochenkilometer und Tagesziele bei „—". */
  performance:function(){return gmProfPerformance();}
};
function gmOpenProfPage(route){
  var pg=document.getElementById('gmProfPage');if(!pg)return;
  var v=GM_PROF_ROUTES[route];if(!v)return;
  if(route===_gmProfRoute&&pg.classList.contains('on')){
    /* Gleiche Unterseite erneut geoeffnet (z.B. Modus-/Sport-Wechsel, Sync-Status-Refresh) ->
       nur neu zeichnen, NICHT auf den Navigations-Stack legen — sonst haeuft "Zurueck"
       bei jedem Wechsel einen bogus Eintrag an. */
    pg.innerHTML=v()+((/tabspacer/.test(pg.innerHTML))?'':'');
    if(!/tabspacer"><\/div>\s*$/.test(pg.innerHTML))pg.innerHTML=pg.innerHTML+'<div class="tabspacer"></div>';
    return;
  }
  if(_gmProfRoute==null){try{var _sc=document.getElementById('tab-mehr');_gmProfScroll=(_sc&&_sc.scrollTop)||window.scrollY||0;}catch(_){ }}
  _gmProfStack.push(_gmProfRoute);
  _gmProfRoute=route;
  pg.innerHTML=v()+((/tabspacer/.test(pg.innerHTML))?'':'');
  if(!/tabspacer"><\/div>\s*$/.test(pg.innerHTML))pg.innerHTML=pg.innerHTML+'<div class="tabspacer"></div>';
  pg.classList.add('on');
  try{pg.scrollTop=0;}catch(_){ }
}
function gmCloseProfPage(){
  var pg=document.getElementById('gmProfPage');
  var parent=_gmProfStack.length?_gmProfStack.pop():null;
  if(parent){
    /* Eine Ebene zurueck (z.B. Erscheinungsbild -> Einstellungen). Profil-Overlay bleibt offen. */
    var v=GM_PROF_ROUTES[parent];
    if(pg&&v){
      _gmProfRoute=parent;
      pg.innerHTML=v()+((/tabspacer/.test(pg.innerHTML))?'':'');
      if(!/tabspacer"><\/div>\s*$/.test(pg.innerHTML))pg.innerHTML=pg.innerHTML+'<div class="tabspacer"></div>';
      try{pg.scrollTop=0;}catch(_){ }
      return;
    }
  }
  /* Oberste Ebene: Unterseiten-Layer schliessen. */
  if(pg)pg.classList.remove('on');
  _gmProfRoute=null;
  if(_gmProfDirectEntry){
    /* Direkteinstieg (Dashboard-Zahnrad) -> zurueck zum vorherigen Hauptbildschirm, nie zur Profilseite. */
    _gmProfDirectEntry=false;
    closeProfile();
    return;
  }
  renderGMProfile();
  try{var b=document.querySelector('#gmProf .mini-btn');if(b){try{b.focus({preventScroll:true});}catch(_){b.focus();}}}catch(_){ }
  try{var sc=document.getElementById('tab-mehr');if(sc&&sc.scrollHeight>sc.clientHeight)sc.scrollTop=_gmProfScroll||0;else window.scrollTo(0,_gmProfScroll||0);}catch(_){ }
}
/* Aktiver GM5-Pfad: openProfile zeigt NUR den GM-Aufbau. Die Legacy-Overlay-Renderer
   (renderMehr/renderAccountCard/renderNutritionConfig/…) werden übersprungen — keine
   doppelten Profilabfragen, keine versteckten Formulare, keine Nebenwirkungen. Der
   bestehende History-/Overlay-Vertrag (profile-open, Browser-Back) bleibt erhalten.
   Abbau der Legacy-Ansicht ist GM7. */
openProfile=function(){
  document.body.classList.add('profile-open');
  var el=document.getElementById('tab-mehr');if(el)el.classList.remove('hide');
  /* Frischer Einstieg: Unterseiten-Layer + Navigations-Stack immer zuruecksetzen, sonst
     kann ein per Hardware-/Browser-Zurueck uebersprungenes gmCloseProfPage eine alte
     Einstellungs-Unterseite stehen lassen. */
  var pg=document.getElementById('gmProfPage');if(pg)pg.classList.remove('on');
  _gmProfRoute=null;_gmProfStack=[];_gmProfDirectEntry=false;
  try{if(!history.state||!history.state.orviaProfile)history.pushState({orviaProfile:true},'');}catch(_){ }
  renderGMProfile();
  try{window.scrollTo(0,0);}catch(_){ }
};
/* Dashboard-Zahnrad (index.html): oeffnet Einstellungen direkt, ohne Umweg ueber die
   Profil-Hauptseite (vorher: onclick="openProfile()" -> ein zusaetzlicher Tap noetig). */
function gmOpenDashboardSettings(){
  openProfile();
  _gmProfDirectEntry=true;
  gmOpenProfPage('settings');
}
/* ====== GM5-ENDE ====== */

/* ============================================================
   ENTSCHEIDUNGS-LOG · Verdrahtung (Bauplan Stufe 0a, 2026-08-07)

   WARUM HIER UND NICHT IM MODUL: js/engine/decision-log.js ist pur — keine Uhr,
   keine IDs, kein Netz, kein Storage. Genau das ist die Bedingung dafuer, dass
   die nicht gespeicherten Kandidaten spaeter rekonstruierbar bleiben. Die
   unreinen Teile — Zeit, ID-Erzeugung, Supabase, App-Version — gehoeren deshalb
   in diese Schicht.

   WARUM DIE APP-VERSION AUS DEM CACHE KOMMT: Der einzige Ort, an dem die
   Version heute gepflegt wird, ist die Konstante C in sw.js. Eine zweite
   Konstante hier waere eine zweite Stelle zum Vergessen — und ein falscher
   decisionRuntimeHash ist schlimmer als keiner, weil er eine Rekonstruktion
   anbieten wuerde, die aus anderem Code stammt.

   DAS LOG DARF DEN PLAN NICHT BEEINFLUSSEN: Jeder Aufruf hier steht in einem
   eigenen try/catch und gibt nichts an den Aufrufer zurueck. Geprueft in
   decision_log_test.mjs (Z4): Bei defekter oder abgeschalteter Senke ist der
   erzeugte Plan byte-fuer-byte identisch.
   ============================================================ */
(function(){
  var O=window.ORVIA=window.ORVIA||{};

  /* App-Version aus dem Service-Worker-Cache — eine Quelle, keine Kopie. */
  try{
    if(window.caches&&caches.keys){
      caches.keys().then(function(ks){
        var hit=(ks||[]).filter(function(k){return /^orvia-v/.test(k);}).sort().pop();
        if(hit)O.engineVersion=hit.replace(/^orvia-/,'');
      }).catch(function(){});
    }
  }catch(_){ }

  var _n=0;
  function _decisionId(){
    /* Keine Zufallszahl: Die ID muss im Test reproduzierbar sein und der
       Zeitstempel plus Zaehler reicht fuer Eindeutigkeit je Geraet. */
    return 'dec:'+Date.now().toString(36)+':'+(++_n);
  }

  /* Senke: schreibt in engine_decision_log (Migration 0032). Fehler werden
     geschluckt — der Rueckgabewert der Senke interessiert nur das Log selbst.

     v8-305: Die Spaltenabbildung lebt NICHT mehr hier, sondern als reine
     Funktion decisionLog.toRow() — dieselbe, die der Live-Test verwendet.
     Vorher gab es zwei handgepflegte Abbildungen, und die des Live-Tests
     hatte bereits drei Spalten verloren (parent/supersedes/week_id): ein
     gruener Live-Test bewies die App-Senke nicht. toRow() ist fail-closed
     (fehlende NOT-NULL-Quelle ⇒ keine Zeile), die Senke bleibt es auch. */
  function _sink(rec){
    try{
      var sb=O.sb, uid=(O.user&&O.user.id)||null;
      if(!sb||!uid)return false;
      var DL=O.decisionLog;
      if(!DL||typeof DL.toRow!=='function')return false;
      var m=DL.toRow(rec,uid);
      if(!m||m.ok!==true)return false;
      /* v8-306: supabase-js LEHNT bei SQL-/Constraint-Fehlern NICHT AB —
         es loest mit {data,error} auf. Der alte Erfolgszweig ignorierte
         das Argument und meldete jeden Constraint-Tod als true. Erfolg
         ist NUR eine Aufloesung ohne error-Objekt; Rejection (Netz) und
         {error} (SQL) enden beide in false. */
      return sb.from('engine_decision_log').insert(m.row)
        .then(function(res){return !(res&&res.error);},function(){return false;});
    }catch(_){ return false; }
  }
  try{ if(O.decisionLog&&O.decisionLog.setSink)O.decisionLog.setSink(_sink); }catch(_){ }

  /* Aufgerufen aus generateWeekPlan, NACH Designer und Policy. Erzeugt die
     Kette week_design -> policy_move -> final_plan. Der final_plan-Eintrag ist
     die einzige Antwort auf „was wurde tatsaechlich geplant" — die erste
     Auswahl des Designers ist es ausdruecklich nicht. */
  O.logWeekDecision=function(ctx){
    try{
      var DL=O.decisionLog; if(!DL||!DL.logDecision)return;
      var c=ctx||{}, now=new Date().toISOString();
      var weekId=c.weekId||null, planId=c.planId||null;

      var dDesign=_decisionId();
      DL.logDecision({
        timestamp:now, decisionType:'week_design', decisionId:dDesign,
        weekId:weekId, planId:planId, registry:O,
        inputs:c.cfg||null, derivedState:c.derived||null,
        candidates:(c.design&&c.design.candidates)||null,
        selected:(c.design&&{hardDays:c.design.hardDays,restDays:c.design.restDays})||null,
        rulesTriggered:(c.design&&c.design.rules)||[]
      });

      var dPolicy=null;
      if(c.policy){
        dPolicy=_decisionId();
        DL.logDecision({
          timestamp:now, decisionType:'policy_move', decisionId:dPolicy,
          parentDecisionId:dDesign, weekId:weekId, planId:planId, registry:O,
          selected:{changes:c.policy.changes||[],warnings:c.policy.warnings||[]},
          rulesTriggered:(c.policy.changes||[]).map(function(x){return (x&&x.rule)||'unknown';})
        });
      }

      DL.logDecision({
        timestamp:now, decisionType:'final_plan', decisionId:_decisionId(),
        parentDecisionId:dPolicy||dDesign, weekId:weekId, planId:planId, registry:O,
        selected:c.finalSummary||null,
        resolvedFrom:dPolicy?[dDesign,dPolicy]:[dDesign]
      });
    }catch(_){ }
  };

  /* ============================================================
     SCHATTENBETRIEB (v8-279)

     Rechnet C1 -> C2 -> Stufe 5 bei jedem Planlauf mit und schreibt das
     Ergebnis als BEOBACHTUNG ins Decision Log. Der Plan wird nicht angefasst:
     Diese Funktion bekommt ihn als Vergleichsgroesse und gibt nichts zurueck,
     was ihn veraendern koennte. `planMutation: 'none'` ist deshalb keine
     Absprache, sondern die Bauform.

     ALLES IN try/catch UND OHNE RUECKGABEWERT. Faellt hier irgendetwas aus,
     bleibt der Plan byte-fuer-byte derselbe — dieselbe Zusage wie beim
     Entscheidungs-Log (decision_log_test.mjs, Z4).

     DER SNAPSHOT WIRD EINMAL GEBILDET und eingefroren. Wuerde die adaptive
     Rechnung den Live-Zustand lesen, waere eine spaetere Abweichung nicht mehr
     zuzuordnen: Logik oder zwischenzeitliche Datenaenderung?
     ============================================================ */
  var _shadowSeen = [];
  O.logWeekShadow=function(ctx){
    try{
      var SA=O.shadowAdaptive; if(!SA||!SA.observe)return;
      var DL=O.decisionLog; var c=ctx||{};
      /* DER SNAPSHOT ENTSTEHT SYNCHRON — im selben Tick wie der Plan. Nur so
         ist garantiert, dass er exakt den Zustand einfriert, aus dem der Plan
         hervorging. Alles Weitere darf warten. */
      /* KEINE ZWEITE FELDLISTE (v8-304): Der explizite Katalog hier hat
         constraints, inputHash, inputVersion und inputBasis VERWORFEN —
         die Sicherheitsschicht erreichte C2 doch nicht, und das
         fail-closed-Gate haette jede reale Beobachtung ausgeschlossen
         (leere Basis im persistierten Record). Der Kontext geht VOLLSTAENDIG
         durch; SA.snapshot waehlt seine Vertragsfelder selbst. Eine hier
         gepflegte Kopie der Liste war genau die Fehlerklasse. */
      var snap=SA.snapshot(Object.assign({},c,{
        userId:(O.user&&O.user.id)||null
      }));
      /* DIE BEOBACHTUNG LAEUFT NACH DEM SICHTBAREN RENDER. try/catch schuetzt
         den Plan, aber nicht die Fluessigkeit der Oberflaeche — eine teure
         Kette im Render-Tick waere ein Ruckler bei jedem Wochenaufbau. Deshalb
         verzoegert (requestIdleCallback, sonst setTimeout) und IMMER mit Uhr
         und Zeitbudget: Ohne Budget koennte ein pathologischer Datenbestand
         die Kette beliebig lange rechnen lassen. */
      var _defer=(typeof requestIdleCallback==='function')
        ? function(f){requestIdleCallback(f,{timeout:2000});}
        : function(f){setTimeout(f,0);};
      _defer(function(){
        try{
          var obs=SA.observe(snap,{registry:O, now:function(){return Date.now();},
            budgetMs:250, seenKeys:_shadowSeen});
          if(obs.idempotencyKey&&_shadowSeen.indexOf(obs.idempotencyKey)<0){
            _shadowSeen.push(obs.idempotencyKey);
            if(_shadowSeen.length>50)_shadowSeen.splice(0,_shadowSeen.length-50);
          }
          /* Eine Wiederholung wird protokolliert, aber als solche gekennzeichnet —
             nicht unterdrueckt (sonst fehlte der Beleg, dass der Lauf stattfand)
             und nicht als neue Beobachtung gezaehlt. */
          if(DL&&DL.logDecision){
            var e=SA.toLogEntry(obs,{decisionId:_decisionId(),
              timestamp:new Date().toISOString(), registry:O});
            DL.logDecision(e);
          }
          O._lastShadow=obs;
          /* Kontext fuer die sichtbare Erklaerung: Beobachtung UND Snapshot
             zusammen. Die Erklaerung darf nie eine frische Rechnung gegen
             einen inzwischen veraenderten Plan mit einer alten Beobachtung
             mischen — beides muss aus DEMSELBEN Einfrieren stammen. */
          O._lastShadowCtx={snap:snap,obs:obs,at:new Date().toISOString()};
          try{if(typeof gmRenderAdaptiveCard==='function')gmRenderAdaptiveCard();}catch(_e){}
        }catch(_){ }
      });
    }catch(_){ }
  };

  /* ============================================================
     PREDICTION OBSERVER · VERDRAHTUNG (v8-293)

     GESPERRT HINTER DEM SERVERSEITIGEN FLAG 'prediction_observer'
     (feature-flags@2 / Migration 0034): Standard ist AUS, der Client kann
     das Flag nicht setzen, ein Fehler kann das Sammeln nicht einschalten.
     Die Freigabeordnung (v8-292-Review) verlangt den gruenen Live-Test VOR
     der Sammlung — das Flag ist genau diese Reihenfolge als Mechanismus.

     DIESELBEN ZUSAGEN WIE BEIM SCHATTEN: alles in try/catch, kein
     Rueckgabewert, kein Zugriff auf `w` — faellt hier irgendetwas aus oder
     WIRFT der Observer, bleiben Plan und Debrief byte-fuer-byte identisch
     (prediction_wiring_test prueft genau das als Verhalten). Die Auswahl
     der Einheiten entsteht SYNCHRON im Plan-Tick (eingefrorenes Datum je
     Einheit), die Vorhersagen selbst laufen verzoegert und budgetiert.

     NUR EINHEITEN STRIKT NACH HEUTE: fuer heutige Einheiten ist die
     Vor-Ereignis-Garantie ohne Startzeit nicht beweisbar — P.predict()
     wuerde sie ablehnen (predicted_on_or_after_session_day), also werden
     sie gar nicht erst versucht.
     ============================================================ */
  var _predSeen=[];
  function _poIsoAdd(dateIso,days){var d=new Date(String(dateIso).slice(0,10)+'T12:00:00Z');
    if(isNaN(d.getTime()))return null;d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
  function _poMondayOf(dateIso){var d=new Date(String(dateIso).slice(0,10)+'T12:00:00Z');
    if(isNaN(d.getTime()))return null;var off=(d.getUTCDay()+6)%7;
    d.setUTCDate(d.getUTCDate()-off);return d.toISOString().slice(0,10);}
  O.logWeekPredictions=function(ctx){
    try{
      var FF=O.featureFlags;
      if(!FF||typeof FF.isEnabled!=='function'||!FF.isEnabled('prediction_observer'))return;
      var P=O.predictionObserver, DL=O.decisionLog, SD=O.sessionDebrief, DR=O.debriefRecord;
      if(!P||!P.predict||!DL||!DL.logDecision||!SD||!DR)return;
      var c=ctx||{};
      var uid=(O.user&&O.user.id)||null;
      var today=c.today||null, plan=c.currentPlan;
      /* fail-closed: ohne vollstaendige Identitaet entsteht keine Vorhersage —
         P.predict lehnte sie ohnehin ab, wir sparen nur den Leerlauf. */
      if(!uid||c.planId==null||c.planRevision==null||!today||!Array.isArray(plan))return;
      var monday=_poMondayOf(today); if(!monday)return;
      /* SNAPSHOT SYNCHRON: Einheiten + fixiertes Datum, eingefroren im
         selben Tick wie der Plan. */
      var sel=[];
      for(var di=0;di<7&&di<plan.length;di++){
        var dIso=_poIsoAdd(monday,di); if(!dIso||!(dIso>today))continue;
        var day=plan[di]||[];
        for(var j=0;j<day.length;j++){var u=day[j];
          /* TIEFE KOPIE IM TICK (v8-294): sel speicherte REFERENZEN — eine
             Planbearbeitung zwischen Tick und verzoegertem Callback haette
             die Vorhersage aus dem NEUEN Zustand gerechnet, mit dem Stempel
             des alten. Der Snapshot ist erst dann einer, wenn er einfriert. */
          if(u&&typeof u==='object'){
            try{sel.push({unit:JSON.parse(JSON.stringify(u)),dateIso:dIso});}catch(_e){}
          }}
      }
      if(!sel.length)return;
      /* EINGEFRORENE KONSUMQUELLEN (v8-300): Performance und Debriefs kommen
         aus dem Snapshot des Aufrufers — der Callback liest NICHTS Globales
         und NICHTS Lebendes mehr. */
      var perfSnap=(c.performance!==undefined)?c.performance:null;
      var dbSnap=Array.isArray(c.debriefs)?c.debriefs:[];
      var planId=c.planId, planRev=c.planRevision, weekId=c.weekId||null;
      var predictedAt=new Date().toISOString();
      var _defer=(typeof requestIdleCallback==='function')
        ? function(f){requestIdleCallback(f,{timeout:2000});}
        : function(f){setTimeout(f,0);};
      _defer(function(){
        try{
          var t0=Date.now();
          for(var k=0;k<sel.length;k++){
            if(Date.now()-t0>250)break;            /* Budget wie beim Schatten */
            var s=sel[k], u=s.unit;
            var occ=DR.occurrenceIdOf(s.dateIso,u);
            /* C3-PARITAET (v8-297, verschaerft v8-307): Die Prescription
               entsteht NICHT mehr inline, sondern ueber die EINE gemeinsame
               Funktion SD.prescriptionOf — dieselbe, aus der der
               C3-Snapshot und der Live-Test ihre Vertragsfelder beziehen.
               Der Live-Test-Befund: drei Erzeuger (ui inline, C3, Live-rx)
               liefen auseinander, und die Divergenz verdeckte den
               typeOf-Klassifikationsfehler. durationMin aus
               plannedDurationOf (die eine Parserquelle), KEINE Historie
               (C3 uebergibt keine), Zone aus derselben
               paceForUnit-Aufloesung. */
            var zone=null;
            try{
              var _sp=(typeof gmSportIdOfUnit==='function')?gmSportIdOfUnit(u):((u.t==='Laufen')?'running':(u.sportId||null));
              var _all=perfSnap||null;
              var _z=_all&&_all.sports?_all.sports[_sp]:null;
              var _tg=(_z&&O.performanceZones&&O.performanceZones.paceForUnit)?O.performanceZones.paceForUnit(u,_z):null;
              if(_tg&&_tg.ok)zone=_tg.zone!=null?_tg.zone:null;
            }catch(_e3){zone=null;}
            var rx=null;
            try{
              var _pdm=DR.plannedDurationOf?DR.plannedDurationOf(u):null;
              rx=SD.prescriptionOf(u,{durationMin:_pdm,targetZone:zone,history:[]});
            }catch(_e){rx=null;}
            if(!rx||rx.expectedRpe==null)continue; /* keine Erwartung -> keine Vorhersage */
            var hasDb=false;
            try{
              /* Debrief-Lookup im SNAPSHOT: dieselbe Identitaet wie der
                 Speicherpfad (Occurrence-ID, Label-Schluessel nur als
                 Legacy-Rueckfall ohne Template-ID). Fehlerpfad fail-closed. */
              var _oid='db:'+occ.replace(/^(po:|occ:)/,'');
              for(var _q=0;_q<dbSnap.length;_q++){var _r3=dbSnap[_q];
                if(!_r3)continue;
                if(_r3.id===_oid){hasDb=true;break;}
                if(_r3.id==null&&_r3.key===(s.dateIso+'|'+String(u.t||'')+'|'+String(u.l||''))){hasDb=true;break;}}
            }catch(_e2){hasDb=true;}
            var pred=P.predict({userId:uid,sessionId:occ,planId:planId,planRevision:planRev,
              sport:(typeof gmSportIdOfUnit==='function')?gmSportIdOfUnit(u):((u.t==='Laufen')?'running':(u.sportId||null)),
              /* v8-309: KEIN separater sessionType mehr — die Prescription
                 ist die eine autoritative Quelle (predict uebernimmt). */
              prescription:rx,
              predictedAt:predictedAt,sessionDate:s.dateIso,debriefExists:hasDb});
            if(!pred||pred.ok!==true)continue;
            if(_predSeen.indexOf(pred.predictionId)>=0)continue;
            _predSeen.push(pred.predictionId);
            if(_predSeen.length>100)_predSeen.splice(0,_predSeen.length-100);
            /* decisionId = predictionId: dieselbe Vorhersage kann am
               unique-Constraint nie doppelt persistieren — Wiederholungen
               scheitern serverseitig, genau wie gewollt. */
            DL.logDecision({timestamp:predictedAt,decisionType:'prediction_record',
              decisionId:pred.predictionId,weekId:weekId,planId:planId,registry:O,
              inputs:{sessionId:occ,sessionDate:s.dateIso},derivedState:pred});
          }
        }catch(_){ }
      });
    }catch(_){ }
  };

  /* ============================================================
     AUFLOESUNG NACH DEM DEBRIEF — DAS SPEICHERN HAT IMMER VORRANG.

     gmDbSave ruft dies NACH upsert + saveProfile auf; die Aufloesung laeuft
     verzoegert. Fehlt die Vorhersage (predict() lief noch nicht oder nie),
     entsteht ein pending-Eintrag; die Reconciliation verbindet spaeter ueber
     die exakte Identitaet (P.reconcile, key5 + Modellversion DER Vorhersage).
     ============================================================ */
  O.resolveDebriefPrediction=function(rec){
    try{
      var FF=O.featureFlags;
      if(!FF||typeof FF.isEnabled!=='function'||!FF.isEnabled('prediction_observer'))return;
      var P=O.predictionObserver, DL=O.decisionLog;
      if(!P||!P.resolve||!DL||!DL.logDecision||!rec)return;
      var uid=(O.user&&O.user.id)||null; if(!uid)return;
      var _defer=(typeof requestIdleCallback==='function')
        ? function(f){requestIdleCallback(f,{timeout:2000});}
        : function(f){setTimeout(f,0);};
      _defer(function(){
        try{
          var evAt=new Date().toISOString();
          /* KANDIDATENWAHL NACH EXAKTER IDENTITAET (v8-294), nicht nach
             Reihenfolge: Nach einer Planrevision liegen fuer dieselbe
             Session Vorhersagen mehrerer Revisionen im Ring — „die letzte"
             griffe die falsche und produzierte superseded, wo scored
             moeglich waere. Praeferenz: (1) gleiche Revision UND gleicher
             Prescription-Hash, (2) gleiche Revision, (3) neueste der
             Session — resolve() beurteilt die dann ehrlich als superseded. */
          var rxh=null;try{rxh=P.prescriptionHashOf(rec.snapshot||null);}catch(_e){rxh=null;}
          function _poPick(list){
            var same=list.filter(function(p){return p&&p.userId===uid&&p.sessionId===rec.sessionId;});
            if(!same.length)return null;
            var rev=same.filter(function(p){return p.planId===rec.planId&&p.planRevision===rec.planRevision;});
            var hash=rev.filter(function(p){return rxh!=null&&p.prescriptionHash===rxh;});
            var pool=hash.length?hash:(rev.length?rev:same);
            return pool[pool.length-1];
          }
          function _poEmit(evaluation){
            DL.logDecision({timestamp:evAt,decisionType:'prediction_evaluation',
              decisionId:(evaluation.predictionId||'pending')+'#'+String(rec.id||rec.key||'')+'@'+evAt,
              weekId:null,planId:rec.planId||null,registry:O,
              inputs:{debriefId:rec.id||null,sessionId:rec.sessionId||null},
              derivedState:evaluation});
            /* RECONCILIATION: verbindet offene pendings mit inzwischen
               eingetroffenen Vorhersagen — aus dem Ring, budgetlos billig. */
            try{
              var ring=DL.recent();
              var pend=ring.filter(function(r){return r&&r.decisionType==='prediction_evaluation'&&
                r.derivedState&&r.derivedState.resolution==='pending';}).map(function(r){return r.derivedState;});
              var allPreds=ring.filter(function(r){return r&&r.decisionType==='prediction_record'&&
                r.derivedState&&r.derivedState.userId===uid;}).map(function(r){return r.derivedState;});
              if(pend.length&&allPreds.length){
                var rc=P.reconcile(pend,allPreds,[rec],{evaluatedAt:evAt});
                (rc.resolved||[]).forEach(function(ev2){
                  DL.logDecision({timestamp:evAt,decisionType:'prediction_evaluation',
                    decisionId:(ev2.predictionId||'rec')+'#reconciled@'+evAt,
                    weekId:null,planId:rec.planId||null,registry:O,
                    inputs:{reconciled:true},derivedState:ev2});
                });
              }
            }catch(_e){}
          }
          var ringCand=_poPick(DL.recent().filter(function(r){
            return r&&r.decisionType==='prediction_record'&&r.derivedState;
          }).map(function(r){return r.derivedState;}));
          if(ringCand){_poEmit(P.resolve(ringCand,rec,{evaluatedAt:evAt}));return;}
          /* NEUSTART-FALL (v8-294): Der Ring stirbt mit dem Tab, die
             Vorhersage ist aber persistiert. Ohne Rueckgriff wuerde jedes
             Debrief nach einem Neustart pending — und das pending fuer
             immer, weil auch die Reconciliation nur den Ring kennt. Also:
             persistierte Vorhersagen dieser Plan-ID lesen (RLS trennt den
             Nutzer), exakt auswaehlen, sonst ehrlich pending. */
          if(O.sb&&rec.planId!=null){
            O.sb.from('engine_decision_log')
              .select('derived_state')
              .eq('decision_type','prediction_record')
              .eq('plan_id',rec.planId)
              /* SESSION SERVERSEITIG, VOR DEM LIMIT (v8-295): Ohne diesen
                 Filter luden 50 beliebige Plan-Vorhersagen — bei vielen
                 Revisionen laege die gesuchte aeltere Session ausserhalb
                 des Fensters und wuerde still nie gefunden. */
              .eq('derived_state->>sessionId',rec.sessionId)
              .order('decided_at',{ascending:false})
              .limit(50)
              .then(function(res){
                try{
                  var rows=((res&&res.data)||[]).map(function(r){return r&&r.derived_state;})
                    .filter(Boolean).reverse();       /* aelteste zuerst -> pick nimmt die neueste passende */
                  var cand=_poPick(rows);
                  _poEmit(P.resolve(cand||null,rec,{evaluatedAt:evAt}));
                }catch(_e){try{_poEmit(P.resolve(null,rec,{evaluatedAt:evAt}));}catch(_e2){}}
              },function(){
                try{_poEmit(P.resolve(null,rec,{evaluatedAt:evAt}));}catch(_e){}
              });
            return;
          }
          _poEmit(P.resolve(null,rec,{evaluatedAt:evAt}));
        }catch(_){ }
      });
    }catch(_){ }
  };

  /* ============================================================
     RETRY-HERZSCHLAG (v8-295): pending IST KEIN ENDZUSTAND — AUCH NICHT
     IM FEHLERPFAD.

     Bisher wurde ein pending nur beim NAECHSTEN Debrief-Speichern erneut
     versucht, und nur gegen den Tab-Ring. Zwei Luecken: (a) offline beim
     Debrief ⇒ pending, und ohne weiteres Speichern kam nie ein zweiter
     Versuch; (b) nach einem Neustart lag das pending nur noch persistiert —
     unerreichbar fuer eine Ring-Reconciliation.

     Dieser Durchlauf haengt am PLANLAUF (der ohnehin regelmaessig kommt —
     ein natuerlicher Herzschlag, kein Timer): offene pendings einsammeln
     (Ring UND persistierte Auswertungen), das zugehoerige Debrief aus dem
     uebergebenen Profil-Speicher holen, die persistierten Vorhersagen der
     betroffenen Sessions SERVERSEITIG gefiltert laden und ueber P.reconcile
     (exakte Identitaet, Modellversion DER Vorhersage) verbinden.

     DEDUP UEBER DAS ERGEBNIS, NICHT DEN VERSUCH: Ein Debrief, fuer das
     bereits eine NICHT-pending-Auswertung existiert (Ring oder persistiert),
     wird nie erneut aufgeloest — der Herzschlag ist idempotent. Budget:
     hoechstens 10 pendings je Durchlauf, eine Sammelabfrage je Richtung.
     ============================================================ */
  O.reconcilePendingPredictions=function(debriefStore){
    try{
      var FF=O.featureFlags;
      if(!FF||typeof FF.isEnabled!=='function'||!FF.isEnabled('prediction_observer'))return;
      var P=O.predictionObserver, DL=O.decisionLog;
      if(!P||!P.reconcile||!DL||!DL.logDecision)return;
      var uid=(O.user&&O.user.id)||null; if(!uid)return;
      var store=Array.isArray(debriefStore)?debriefStore:[];
      if(!store.length)return;
      var _defer=(typeof requestIdleCallback==='function')
        ? function(f){requestIdleCallback(f,{timeout:2000});}
        : function(f){setTimeout(f,0);};
      _defer(function(){
        try{
          var evAt=new Date().toISOString();
          var byId={};store.forEach(function(d){if(d&&d.id!=null)byId[d.id]=d;});
          var ring=DL.recent();
          var ringEvals=ring.filter(function(r){return r&&r.decisionType==='prediction_evaluation'&&r.derivedState;})
            .map(function(r){return r.derivedState;});
          var ringPreds=ring.filter(function(r){return r&&r.decisionType==='prediction_record'&&
            r.derivedState&&r.derivedState.userId===uid;}).map(function(r){return r.derivedState;});
          function step2(persEvals){
            try{
              var all=ringEvals.concat(persEvals||[]);
              /* NUR scored IST ENDGUELTIG (v8-296): Vorher galt jede
                 nicht-pending-Auswertung als erledigt — ein superseded
                 (alte Revision zuerst aufgeloest) haette das spaetere
                 scored gegen die EXAKTE Vorhersage fuer immer blockiert.
                 superseded/not_comparable sind ehrliche Urteile UEBER EINE
                 KANDIDATIN, kein Endzustand des Debriefs. */
              var done={};
              all.forEach(function(e){if(e&&e.resolution==='scored'&&e.debriefId!=null)done[e.debriefId]=1;});
              var seen={};
              var open=all.filter(function(e){
                if(!e||e.resolution==='scored'||e.debriefId==null)return false;
                if(done[e.debriefId]||seen[e.debriefId])return false;
                if(!byId[e.debriefId])return false;      /* ohne Grundwahrheit kein Versuch */
                seen[e.debriefId]=1;return true;
              }).slice(0,10);                             /* Budget je Durchlauf */
              if(!open.length)return;
              var debriefs=open.map(function(e){return byId[e.debriefId];});
              var sessions=[];
              debriefs.forEach(function(d){if(d.sessionId&&sessions.indexOf(d.sessionId)<0)sessions.push(d.sessionId);});
              function finish(preds){
                try{
                  /* Direkte Aufloesung mit EXAKTER Praeferenz (statt ueber
                     P.reconcile, dessen pending-Filter superseded-Faelle
                     nie wieder anfasste). Geloggt wird NUR ein Upgrade auf
                     scored — kein Urteils-Spam, idempotent per done-Map. */
                  var list=ringPreds.concat(preds||[]);
                  debriefs.forEach(function(d){
                    var same=list.filter(function(p2){return p2&&p2.ok===true&&
                      p2.userId===d.userId&&p2.sessionId===d.sessionId;});
                    if(!same.length)return;
                    var rxh2=null;try{rxh2=P.prescriptionHashOf(d.snapshot||null);}catch(_e){rxh2=null;}
                    var rev=same.filter(function(p2){return p2.planId===d.planId&&p2.planRevision===d.planRevision;});
                    var hash=rev.filter(function(p2){return rxh2!=null&&p2.prescriptionHash===rxh2;});
                    var pool=hash.length?hash:(rev.length?rev:same);
                    var ev2=P.resolve(pool[pool.length-1],d,{evaluatedAt:evAt});
                    if(!ev2||ev2.resolution!=='scored')return;
                    DL.logDecision({timestamp:evAt,decisionType:'prediction_evaluation',
                      decisionId:(ev2.predictionId||'rec')+'#retry@'+evAt,
                      weekId:null,planId:null,registry:O,
                      inputs:{retry:true,debriefId:ev2.debriefId||null},derivedState:ev2});
                  });
                }catch(_e){}
              }
              if(O.sb&&sessions.length){
                O.sb.from('engine_decision_log')
                  .select('derived_state')
                  .eq('decision_type','prediction_record')
                  .in('derived_state->>sessionId',sessions)
                  .order('decided_at',{ascending:false})
                  .limit(100)
                  .then(function(res){
                    finish(((res&&res.data)||[]).map(function(r){return r&&r.derived_state;}).filter(Boolean));
                  },function(){finish([]);});
              } else finish([]);
            }catch(_e){}
          }
          /* Persistierte Auswertungen: liefern die pendings, die den
             Neustart ueberlebt haben, UND das Dedup-Wissen ueber bereits
             Aufgeloestes. Fehlt der Client oder die Abfrage: nur der Ring. */
          if(O.sb){
            O.sb.from('engine_decision_log')
              .select('derived_state')
              .eq('decision_type','prediction_evaluation')
              .order('decided_at',{ascending:false})
              .limit(200)
              .then(function(res){
                step2(((res&&res.data)||[]).map(function(r){return r&&r.derived_state;}).filter(Boolean));
              },function(){step2([]);});
          } else step2([]);
        }catch(_){ }
      });
    }catch(_){ }
  };

  /* ============================================================
     ABNAHMESTAND (v8-284): AUS DEN DAUERHAFTEN EINTRAEGEN, NICHT AUS DEM
     BROWSERZUSTAND. Der lokale Ringpuffer stirbt mit dem Tab — eine Abnahme,
     die nur ihn liest, vergisst jede Woche neu. Gelesen wird deshalb zuerst
     die persistierte Historie (engine_decision_log, RLS auf den Nutzer);
     der Ring ist nur der ausgewiesene Notbehelf. Die Kohortenpruefung
     (gleiche Vertragsversionen) uebernimmt acceptance() selbst.
     ============================================================ */
  function _obsOfDerived(d){
    d=d||{};
    return {mode:d.mode,planMutation:d.planMutation,applied:d.applied,
      status:d.status,stages:d.stages,progression:d.progression,
      deviation:d.deviation,coverage:d.coverage,idempotencyKey:d.idempotencyKey,
      feasibility:d.feasibility,versions:d.versions,
      userId:d.userId||null,observedAt:d.observedAt||null,
      weekId:d.weekId||null,planId:d.planId||null,hashes:d.hashes||null,
      inputHash:d.inputHash||null,inputVersion:d.inputVersion||null,
      inputBasis:d.inputBasis||null};
  }
  O.shadowAcceptance=function(){
    try{
      var SA=O.shadowAdaptive, DL=O.decisionLog;
      if(!SA||!DL)return null;
      var sb=O.sb, uid=(O.user&&O.user.id)||null;
      /* Der lokale Ring ueberlebt einen Nutzerwechsel im selben Tab. Fremde
         Beobachtungen werden deshalb ausgefiltert, bevor sie irgendetwas
         belegen — die persistierte Historie trennt per RLS ohnehin. */
      /* FAIL-CLOSED: Eine Beobachtung ohne eindeutigen Nutzer belegt nichts —
         und ohne bekannten aktuellen Nutzer belegt der lokale Ring gar nichts.
         Lieber eine leere Abnahme als eine, die fremde oder herrenlose
         Eintraege mitzaehlt. */
      var lokal=DL.recent().filter(function(r){return r&&r.decisionType==='shadow_observation';})
        .map(function(r){return _obsOfDerived(r.derivedState);})
        .filter(function(o2){return uid!=null&&o2.userId===uid;});
      if(sb&&uid){
        return sb.from('engine_decision_log')
          .select('derived_state,decided_at')
          .eq('decision_type','shadow_observation')
          /* NEUESTE ZUERST. Aufsteigend + Limit haette die AELTESTEN 500
             geladen — und damit irgendwann ausschliesslich Eintraege fremder
             Kohorten, waehrend die aktuellen unsichtbar blieben. Fuer die
             Abnahme zaehlt die Reihenfolge nicht, die Aktualitaet schon. */
          .order('decided_at',{ascending:false})
          .limit(500)
          .then(function(res){
            var rows=(res&&res.data)||[];
            var obs=rows.map(function(r){return _obsOfDerived(r.derived_state);});
            var acc=SA.acceptance(obs.length?obs:lokal,{registry:O});
            acc.source=obs.length?'persisted':'local_ring_fallback';
            return acc;
          },function(){
            var acc=SA.acceptance(lokal,{registry:O});
            acc.source='local_ring_fallback';
            return acc;
          });
      }
      var acc=SA.acceptance(lokal,{registry:O});
      acc.source='local_ring_offline';
      return acc;
    }catch(_){ return null; }
  };

  O.getAdaptiveExplanation=function(){
    try{
      var AC=O.adaptiveCard;
      if(!AC||!AC.buildView)return {available:false, reason:'no_module'};
      var live=(typeof PROFILE!=='undefined'&&PROFILE&&PROFILE.weekPlan)||null;
      return AC.buildView(O._lastShadowCtx||null, live, O);
    }catch(_){ return {available:false, reason:'error'}; }
  };

  /* Einhaenger der Karte: reine Darstellung des View-Vertrags. Rendern
     veraendert und speichert nichts — der Renderer ist String -> String und
     lebt in js/adaptive-card.js, wo er auch als VERHALTEN getestet wird. */
  globalThis.gmRenderAdaptiveCard=function(){
    try{
      var box=document.getElementById('adaptiveCard'); if(!box)return;
      var AC=O.adaptiveCard;
      box.innerHTML=(AC&&AC.render)?AC.render(O.getAdaptiveExplanation()):'';
    }catch(_){ }
  };

  /* Diagnose fuer die Konsole — IMMER redigiert (keine Schmerzangaben, kein RPE). */
  O.explainWeek=function(weekId){
    try{
      var DL=O.decisionLog; if(!DL)return null;
      return DL.explain(weekId,DL.recent(),O);
    }catch(_){ return null; }
  };
})();

/* ============================================================
   G1 · LEISTUNGSDATEN ERFASSEN (Bauplan Stufe 1, 2026-08-07)

   WARUM DIESE SEITE ZUERST KAM: Ohne erfasste Leistungswerte bleiben
   Intensitaet, Zielprognose, Wochenkilometer und Tagesziele bei „—", egal wie
   gut die Engine dahinter ist. Genau das war der Ausloeser des Umbaus.

   BEDINGUNG, OHNE DIE DIE SEITE IHREN ZWECK VERFEHLT: Der leere Zustand muss in
   EINER Sitzung fuellbar sein. Wer noch nie getestet hat, bekommt das passende
   Protokoll mit Anleitung direkt hier — nicht als Verweis auf eine Hilfeseite.
   Sonst wird die Maske gebaut und nie ausgefuellt; das ist das Hauptrisiko
   dieser Stufe.

   ABLEHNEN STATT UMDEUTEN: Die Pruefung liegt vollstaendig in
   js/engine/performance-input.js (rein, getestet). Diese Schicht sammelt nur
   ein und zeigt an. Ein unplausibler Wert wird benannt, nicht zurechtgebogen —
   und eine mehrdeutige Zeitangabe („1:50") fuehrt zur Rueckfrage, nicht zu
   einer stillen Entscheidung.
   ============================================================ */
function gmPerfToday(){try{return new Date().toISOString().slice(0,10);}catch(_){return null;}}
function gmPerfMod(){try{return (window.ORVIA&&ORVIA.performanceInput)||null;}catch(_){return null;}}
function gmPerfEv(){try{return (window.ORVIA&&ORVIA.evidence)||null;}catch(_){return null;}}

var _gmPerfSport='running';
var _gmPerfTest=null;
var _gmPerfMsg=null;

function gmPerfSetSport(s){_gmPerfSport=s;_gmPerfTest=null;_gmPerfMsg=null;gmOpenProfPage('performance');}
function gmPerfPickTest(id){_gmPerfTest=(_gmPerfTest===id)?null:id;_gmPerfMsg=null;gmOpenProfPage('performance');}

var GM_PERF_SPORTS=[['running','Laufen'],['cycling','Radfahren'],['swimming','Schwimmen']];

/* Klartext fuer Ablehnungen. Eine Fehlermeldung, die nur einen Schluessel
   zeigt, ist fuer den Nutzer wertlos — und eine, die nicht sagt WARUM, laedt
   dazu ein, den Wert so lange zu veraendern, bis er durchgeht. */
var GM_PERF_REASONS={
  out_of_range:'Der Wert liegt ausserhalb des plausiblen Bereichs',
  implausible_pace:'Daraus ergibt sich keine realistische Pace',
  implausible_css:'Daraus ergibt sich keine realistische Schwimmgeschwindigkeit',
  implausible_swim_pace:'Daraus ergibt sich keine realistische Schwimmgeschwindigkeit',
  css_400_not_slower_than_200:'Die 400-m-Zeit muss groesser sein als die 200-m-Zeit',
  date_in_future:'Das Datum liegt in der Zukunft',
  date_too_old:'Das Datum liegt mehr als zehn Jahre zurueck — vertippt?',
  date_unreadable:'Das Datum ist nicht lesbar',
  not_a_time:'Das ist keine lesbare Zeitangabe',
  not_positive:'Der Wert muss groesser als null sein',
  unknown_protocol:'Unbekanntes Testprotokoll',
  unknown_field:'Unbekanntes Feld'
};
function gmPerfReason(e){
  var t=GM_PERF_REASONS[e&&e.reason]||('Ungueltige Eingabe ('+gmEsc(String(e&&e.reason||'?'))+')');
  if(e&&e.expected)t+=' — erwartet '+e.expected[0]+' bis '+e.expected[1]+(e.unit?' '+e.unit:'')+(e.got!=null?', eingetragen '+e.got:'');
  else if(e&&e.got!=null)t+=' — eingetragen '+e.got;
  if(e&&e.detail)t+='. '+e.detail;
  return t;
}
function gmPerfShow(res){
  if(!res)return;
  if(res.status==='ok'){_gmPerfMsg={k:'ok',t:'Gespeichert.'};return;}
  if(res.status==='needs_input'){
    var n=(res.needs||[])[0];
    _gmPerfMsg={k:'need',t:(n&&n.hint)||'Es fehlt noch eine Angabe.',
      alts:(n&&n.alternatives)||null};
    return;
  }
  _gmPerfMsg={k:'bad',t:(res.errors||[]).map(gmPerfReason).join(' · ')||'Eingabe abgelehnt.'};
}
function _gmPerfVal(id){var el=document.getElementById(id);return el?String(el.value||'').trim():'';}
function _gmPerfPersist(){try{if(typeof saveProfile==='function')saveProfile();}catch(_){ }}
function _gmPerfProfile(){
  if(typeof PROFILE==='undefined'||!PROFILE)return null;
  PROFILE.performance=PROFILE.performance||{};
  PROFILE.performance.personalBests=PROFILE.performance.personalBests||[];
  PROFILE.performance.tests=PROFILE.performance.tests||[];
  return PROFILE;
}

/* Wettkampf oder Bestzeit eintragen. */
function gmPerfSaveRace(){
  var PI=gmPerfMod();if(!PI)return;
  var res=PI.validateRace({
    sportId:_gmPerfSport,
    distance:_gmPerfVal('gmPerfDist'),
    time:_gmPerfVal('gmPerfTime'),
    context:_gmPerfVal('gmPerfCtx'),
    measuredAt:_gmPerfVal('gmPerfDate')||null
  },{today:gmPerfToday()});
  if(res.status==='ok'){
    var P=_gmPerfProfile();
    if(P){P.performance.personalBests.push(res.entry);_gmPerfPersist();}
  }
  gmPerfShow(res);
  gmOpenProfPage('performance');
  try{if(typeof renderGMPlan==='function')renderGMPlan();}catch(_){ }
}

/* Testergebnis eintragen. */
function gmPerfSaveTest(){
  var PI=gmPerfMod();if(!PI||!_gmPerfTest)return;
  var proto=PI.protocolById(_gmPerfSport,_gmPerfTest);if(!proto)return;
  var input={sportId:_gmPerfSport,id:_gmPerfTest,date:_gmPerfVal('gmPerfTestDate')||null};
  (proto.needs||[]).forEach(function(f){input[f]=_gmPerfVal('gmPerfT_'+f);});
  var res=PI.validateTest(input,{today:gmPerfToday()});
  if(res.status==='ok'){
    var P=_gmPerfProfile();
    if(P){P.performance.tests.push(res.entry);_gmPerfPersist();}
    _gmPerfTest=null;
  }
  gmPerfShow(res);
  gmOpenProfPage('performance');
  try{if(typeof renderGMPlan==='function')renderGMPlan();}catch(_){ }
}

/* Einzelwert (FTP, Schwellen-HF, 100-m-Pace) — landet im Sportfeld, nicht in
   den Bestzeiten: dort liest ihn der performance-resolver bereits. */
function gmPerfSaveValue(field){
  var PI=gmPerfMod();if(!PI)return;
  var res=PI.validateValue({field:field,value:_gmPerfVal('gmPerfV_'+field),date:_gmPerfVal('gmPerfVDate_'+field)||null},{today:gmPerfToday()});
  if(res.status==='ok'){
    var P=_gmPerfProfile();
    if(P){
      P.sports=Array.isArray(P.sports)?P.sports:[];
      var ent=null,i;
      for(i=0;i<P.sports.length;i++)if(P.sports[i]&&String(P.sports[i].sportId||'').toLowerCase()===res.sportId)ent=P.sports[i];
      if(!ent){ent={sportId:res.sportId,fields:{}};P.sports.push(ent);}
      ent.fields=ent.fields||{};
      ent.fields[res.field]=res.entry.value;
      /* Herkunft getrennt ablegen — das Sportfeld selbst bleibt eine blanke
         Zahl, damit bestehende Leser unveraendert funktionieren. */
      P.performance=P.performance||{};
      P.performance.provenance=P.performance.provenance||{};
      P.performance.provenance[res.sportId+'.'+res.field]=res.entry.evidence||null;
      _gmPerfPersist();
    }
  }
  gmPerfShow(res);
  gmOpenProfPage('performance');
  try{if(typeof renderGMPlan==='function')renderGMPlan();}catch(_){ }
}

function gmPerfDeleteBest(idx){
  var P=_gmPerfProfile();if(!P)return;
  if(idx<0||idx>=P.performance.personalBests.length)return;
  P.performance.personalBests.splice(idx,1);_gmPerfPersist();
  _gmPerfMsg={k:'ok',t:'Eintrag entfernt.'};
  gmOpenProfPage('performance');
}
function gmPerfDeleteTest(idx){
  var P=_gmPerfProfile();if(!P)return;
  if(idx<0||idx>=P.performance.tests.length)return;
  P.performance.tests.splice(idx,1);_gmPerfPersist();
  _gmPerfMsg={k:'ok',t:'Test entfernt.'};
  gmOpenProfPage('performance');
}

/* Belegzeile — eine Quelle fuer die Formulierung (ORVIA.evidence.describe). */
function gmPerfEvLine(hull){
  var EV=gmPerfEv();
  if(!EV||!hull)return '';
  return '<div class="bt-sub">'+gmEsc(EV.describe(hull))+'</div>';
}

function gmProfPerformance(){
  var PI=gmPerfMod(),EV=gmPerfEv();
  var h=gmPPageHead('Leistungsdaten','Wettkampf, Test und Schwellenwerte je Sportart');
  if(!PI){
    return h+'<div style="padding:0 18px"><div class="mini-note">'+icon('info','xs')+'<div>Das Leistungsmodul ist nicht geladen. Bitte die App neu starten.</div></div></div><div class="tabspacer"></div>';
  }
  var P=(typeof PROFILE!=='undefined'&&PROFILE)?PROFILE:null;
  var cov=null;try{cov=PI.coverage(P,{today:gmPerfToday()});}catch(_){ }
  var mine=cov&&cov.sports?cov.sports[_gmPerfSport]:null;

  h+='<div style="padding:0 18px">';

  /* Rueckmeldung der letzten Eingabe — steht oben, damit sie nicht uebersehen wird. */
  if(_gmPerfMsg){
    var cls=_gmPerfMsg.k==='ok'?'ok':(_gmPerfMsg.k==='need'?'warn':'bad');
    h+='<div class="mini-note perf-'+cls+'">'+icon(_gmPerfMsg.k==='ok'?'check':'info','xs')+'<div>'+gmEsc(_gmPerfMsg.t);
    if(_gmPerfMsg.alts){
      h+='<br><span style="color:var(--muted)">Moegliche Lesarten: '+
        Object.keys(_gmPerfMsg.alts).map(function(k){return gmEsc(k)+' = '+gmEsc(String(Math.round(_gmPerfMsg.alts[k]*100)/100))+' min';}).join(' · ')+
        '. Trag die Zeit eindeutig ein, z. B. „1:50:00".</span>';
    }
    h+='</div></div>';
    _gmPerfMsg=null;
  }

  /* Sportartwahl */
  h+='<div class="seg" style="margin:10px 0 14px">';
  GM_PERF_SPORTS.forEach(function(s){
    h+='<button type="button" class="seg-b'+(s[0]===_gmPerfSport?' on':'')+'" onclick="gmPerfSetSport(\''+s[0]+'\')">'+gmEsc(s[1])+'</button>';
  });
  h+='</div>';

  /* ABDECKUNG — beantwortet „warum steht da ein Strich" */
  h+='<div class="sectlabel">Stand</div>';
  if(mine&&mine.ok){
    h+='<div class="bt-row" style="cursor:default"><div class="bt-b"><div class="bt-time">Zonen vorhanden '+gmEsc(EV?EV.marker(mine.evidence):'')+'</div>'+
      '<div class="bt-sub">Beleg: '+gmEsc((EV&&EV.LEVEL_LABEL[mine.evidence])||mine.evidence)+
      (mine.ageDays!=null?' · '+mine.ageDays+(mine.ageDays===1?' Tag':' Tage')+' alt':'')+
      ' · Status: '+gmEsc((EV&&EV.FRESH_LABEL[mine.freshness])||'—')+'</div></div></div>';
    if(mine.staleHint){
      h+='<div class="mini-note">'+icon('info','xs')+'<div>Dieser Wert ist ueber seiner Haltbarkeit. Die Zonen stammen weiterhin daraus — ein neuer Test oder Wettkampf wuerde sie schaerfen.</div></div>';
    }
  }else{
    h+='<div class="mini-note">'+icon('info','xs')+'<div><b>Noch keine Zonen fuer diese Sportart.</b> Solange hier nichts steht, bleiben Intensitaet, Zielprognose und Tagesziele im Plan bei „—". '+
      gmEsc((mine&&mine.suggestion)||'Trag ein Ergebnis ein oder mach einen der Tests unten.')+'</div></div>';
  }

  /* WETTKAMPF / BESTZEIT */
  h+='<div class="sectlabel">Ergebnis eintragen</div>';
  h+='<div class="perf-form">'+
    '<label>Distanz<input id="gmPerfDist" type="text" inputmode="decimal" placeholder="10 km, HM, Marathon"></label>'+
    '<label>Zeit<input id="gmPerfTime" type="text" inputmode="numeric" placeholder="48:30 oder 1:50:00"></label>'+
    '<label>Kontext<select id="gmPerfCtx"><option value="Wettkampf">Wettkampf</option><option value="Test">Test / Trainingsbestzeit</option></select></label>'+
    '<label>Datum<input id="gmPerfDate" type="date"></label>'+
    '<button class="mini-btn primary" onclick="gmPerfSaveRace()">Eintragen</button>'+
    '</div>';
  h+='<div class="mini-note">'+icon('info','xs')+'<div>Ein Wettkampf ist der staerkste Beleg. Eine Trainingsbestzeit zaehlt schwaecher — sie entsteht meist in einem Tempolauf und liegt systematisch ueber der Wettkampfform. Bei mehrdeutigen Zeiten („1:50") fragt die App nach, statt zu raten.</div></div>';

  /* TESTS — mit Anleitung direkt hier */
  var protos=PI.protocolsFor(_gmPerfSport)||[];
  if(protos.length){
    h+='<div class="sectlabel">Test machen</div>';
    protos.forEach(function(p){
      var open=(_gmPerfTest===p.id);
      var suggested=(mine&&mine.level==='beginner'&&p.level==='anfaenger');
      h+='<button type="button" class="bt-row" onclick="gmPerfPickTest(\''+p.id+'\')"><div class="bt-b">'+
        '<div class="bt-time" style="font-size:15px">'+gmEsc(p.label)+(suggested?' <span style="color:var(--muted);font-size:12px">empfohlen</span>':'')+'</div>'+
        '<div class="bt-sub">'+gmEsc(p.level==='anfaenger'?'Einsteiger':'Fortgeschritten')+'</div></div>'+
        '<div class="bt-imp">'+icon('chev','sm')+'</div></button>';
      if(open){
        h+='<div class="perf-form perf-open">';
        h+='<div class="mini-note">'+icon('info','xs')+'<div>'+gmEsc(p.howto)+'</div></div>';
        (p.needs||[]).forEach(function(f){
          h+='<label>'+gmEsc(GM_PERF_FIELD_LABEL[f]||f)+'<input id="gmPerfT_'+f+'" type="text" inputmode="decimal" placeholder="'+gmEsc(GM_PERF_FIELD_HINT[f]||'')+'"></label>';
        });
        h+='<label>Datum<input id="gmPerfTestDate" type="date"></label>';
        h+='<button class="mini-btn primary" onclick="gmPerfSaveTest()">Ergebnis speichern</button></div>';
      }
    });
  }

  /* EINZELWERTE je Sportart */
  var vals=[];
  if(_gmPerfSport==='cycling')vals=['ftp','thresholdHr'];
  if(_gmPerfSport==='swimming')vals=['pace100'];
  if(vals.length){
    h+='<div class="sectlabel">Bekannte Werte</div><div class="perf-form">';
    vals.forEach(function(f){
      var spec=PI.VALUE_FIELDS[f];
      h+='<label>'+gmEsc(spec.label)+' ('+gmEsc(spec.unit)+')<input id="gmPerfV_'+f+'" type="text" inputmode="decimal"></label>'+
        '<label>Datum<input id="gmPerfVDate_'+f+'" type="date"></label>'+
        '<button class="mini-btn" onclick="gmPerfSaveValue(\''+f+'\')">'+gmEsc(spec.label)+' speichern</button>';
    });
    h+='</div>';
    h+='<div class="mini-note">'+icon('info','xs')+'<div>Ein selbst eingetragener Wert zaehlt als Selbstauskunft. Wer den Wert wirklich getestet hat, traegt oben den Test ein — dafuer gibt es die hoehere Belegstufe.</div></div>';
  }

  /* ERFASSTES */
  var pbs=(P&&P.performance&&P.performance.personalBests)||[];
  var tests=(P&&P.performance&&P.performance.tests)||[];
  var mineBests=pbs.map(function(b,i){return {b:b,i:i};}).filter(function(x){return String((x.b&&x.b.sportId)||'running').toLowerCase()===_gmPerfSport;});
  var mineTests=tests.map(function(t,i){return {t:t,i:i};}).filter(function(x){return String((x.t&&x.t.sportId)||'').toLowerCase()===_gmPerfSport;});

  if(mineBests.length||mineTests.length){
    h+='<div class="sectlabel">Erfasst</div>';
    mineBests.forEach(function(x){
      var b=x.b,sec=b.timeSeconds||0;
      var tt=sec?(Math.floor(sec/3600)?Math.floor(sec/3600)+':'+('0'+Math.floor(sec%3600/60)).slice(-2)+':'+('0'+(sec%60)).slice(-2):Math.floor(sec/60)+':'+('0'+(sec%60)).slice(-2)):'—';
      h+='<div class="bt-row" style="cursor:default"><div class="bt-b"><div class="bt-time">'+gmEsc(String(b.distance))+' km · '+gmEsc(tt)+'</div>'+
        (b.evidence?gmPerfEvLine(b.evidence):'<div class="bt-sub">'+gmEsc(b.context||'—')+'</div>')+'</div>'+
        '<span class="edit" role="button" tabindex="0" onclick="gmPerfDeleteBest('+x.i+')">Entfernen</span></div>';
    });
    mineTests.forEach(function(x){
      var t=x.t,proto=PI.protocolById(_gmPerfSport,t.id);
      h+='<div class="bt-row" style="cursor:default"><div class="bt-b"><div class="bt-time" style="font-size:15px">'+gmEsc((proto&&proto.label)||t.id)+'</div>'+
        (t.evidence?gmPerfEvLine(t.evidence):'<div class="bt-sub">'+gmEsc(t.date||'ohne Datum')+'</div>')+'</div>'+
        '<span class="edit" role="button" tabindex="0" onclick="gmPerfDeleteTest('+x.i+')">Entfernen</span></div>';
    });
  }

  h+='</div><div class="tabspacer"></div>';
  return h;
}

var GM_PERF_FIELD_LABEL={
  distanceKm:'Distanz in km',durationMin:'Dauer in Minuten',avgWatts:'Durchschnittsleistung in Watt',
  avgHr:'Durchschnittliche Herzfrequenz',distanceM:'Distanz in Metern',
  t400Sec:'400-m-Zeit in Sekunden',t200Sec:'200-m-Zeit in Sekunden'
};
var GM_PERF_FIELD_HINT={
  distanceKm:'z. B. 2.8',durationMin:'z. B. 22',avgWatts:'z. B. 263',avgHr:'z. B. 172',
  distanceM:'z. B. 520',t400Sec:'z. B. 372',t200Sec:'z. B. 178'
};
/* Untertitel der Profilzeile: nennt beim Namen, was fehlt. „Leistungsdaten" allein
   sagt nicht, dass genau hier die Striche im Plan herkommen. */
function gmPerfRowSub(){
  try{
    var PI=gmPerfMod();if(!PI)return 'Wettkampf, Test und Schwellenwerte';
    var cov=PI.coverage((typeof PROFILE!=='undefined'&&PROFILE)||null,{today:gmPerfToday()});
    if(!cov)return 'Wettkampf, Test und Schwellenwerte';
    var miss=cov.missing||[];
    if(!miss.length)return 'Zonen für alle drei Sportarten vorhanden';
    if(!cov.anyOk)return 'Noch keine Zonen — deshalb steht im Plan „—"';
    var L={running:'Laufen',cycling:'Rad',swimming:'Schwimmen'};
    return 'Fehlt: '+miss.map(function(m){return L[m]||m;}).join(', ');
  }catch(_){return 'Wettkampf, Test und Schwellenwerte';}
}

/* ============================================================
   C3 · DEBRIEF-ERFASSUNG (Bauplan Stufe 2, 2026-08-07)

   WARUM SO WENIG GEFRAGT WIRD: Elf Felder pro Einheit fuellt niemand ueber
   Monate aus — und lueckenhafte Selbstauskunft ist SCHLECHTER als keine, weil
   sie systematisch verzerrt: Schlechte Tage werden seltener geloggt, also saehe
   die Engine einen Athleten, der alles vertraegt. Deshalb genau ZWEI Eingaben
   im Normalfall: RPE und Schmerz ja/nein. Alles andere wird abgeleitet.

   Der Grund einer Abweichung wird NUR erfragt, wenn eine erkannt wurde — und
   dann als Auswahl, nicht als Freitext, sonst ist er nicht auswertbar.

   Die Bewertung selbst liegt vollstaendig in js/engine/session-debrief.js
   (rein, getestet). Diese Schicht sammelt ein, speichert und zeigt an.
   ============================================================ */
function gmDbMod(){try{return (window.ORVIA&&ORVIA.sessionDebrief)||null;}catch(_){return null;}}
var _gmDbCtx=null;   /* {di, ii, planned, actual, zones, key} */
var _gmDbRpe=null, _gmDbPain=false;

function gmDbKey(dateIso,unit){
  return String(dateIso||'')+'|'+String((unit&&unit.t)||'')+'|'+String((unit&&unit.l)||'');
}
function gmDbStore(){
  if(typeof PROFILE==='undefined'||!PROFILE)return null;
  PROFILE.performance=PROFILE.performance||{};
  PROFILE.performance.debriefs=Array.isArray(PROFILE.performance.debriefs)?PROFILE.performance.debriefs:[];
  return PROFILE.performance.debriefs;
}
function gmDbFind(key,unit,dateIso){
  var st=gmDbStore();if(!st)return null;
  /* Zuerst ueber die eindeutige Occurrence-ID — der Schluessel kollidiert bei
     Zwillingen und dient nur noch als Legacy-Rueckfall. */
  try{
    if(unit&&window.ORVIA&&ORVIA.debriefRecord){
      var occ=ORVIA.debriefRecord.occurrenceIdOf(dateIso,unit);
      var id='db:'+occ.replace(/^(po:|occ:)/,'');
      for(var j=0;j<st.length;j++)if(st[j]&&st[j].id===id)return st[j];
      if(ORVIA.debriefRecord.occurrenceBasisOf(unit)==='template_id')return null;
    }
  }catch(_e){}
  for(var i=0;i<st.length;i++)if(st[i]&&st[i].key===key)return st[i];
  return null;
}

/* Oeffnet die Erfassung fuer eine absolvierte Einheit. */
function gmOpenDebrief(dateIso,unit,planned,actual){
  var key=gmDbKey(dateIso,unit);
  var prev=gmDbFind(key,unit,dateIso);
  _gmDbCtx={key:key,date:dateIso,unit:unit,planned:planned||null,actual:actual||null};
  _gmDbRpe=prev?prev.rpe:null;
  _gmDbPain=prev?!!prev.pain:false;
  gmRenderDebriefSheet();
}
function gmDbSetRpe(v){_gmDbRpe=v;gmRenderDebriefSheet();}
function gmDbTogglePain(){_gmDbPain=!_gmDbPain;gmRenderDebriefSheet();}

function gmRenderDebriefSheet(){
  if(!_gmDbCtx)return;
  var c=_gmDbCtx;
  var h='<div class="sheet-head"><h3>Wie war die Einheit?</h3><p>'+gmEsc((c.unit&&c.unit.l)||'')+'</p></div><div class="sheet-body">';
  h+='<div class="sectlabel" style="padding-left:0">Anstrengung</div>';
  h+='<div class="db-rpe">';
  for(var i=1;i<=10;i++){
    h+='<button type="button" class="db-rpe-b'+(_gmDbRpe===i?' on':'')+'" onclick="gmDbSetRpe('+i+')">'+i+'</button>';
  }
  h+='</div><div class="mini-note">'+icon('info','xs')+'<div>1 = sehr locker · 10 = maximal. Das ist die einzige Zahl, die die App nicht selbst ausrechnen kann.</div></div>';
  h+='<div class="sectlabel" style="padding-left:0">Schmerzen?</div>';
  h+='<div class="seg"><button type="button" class="seg-b'+(!_gmDbPain?' on':'')+'" onclick="if('+(_gmDbPain?'true':'false')+')gmDbTogglePain()">Nein</button>'+
     '<button type="button" class="seg-b'+(_gmDbPain?' on':'')+'" onclick="if('+(_gmDbPain?'false':'true')+')gmDbTogglePain()">Ja</button></div>';

  /* Der Grund wird NUR erfragt, wenn eine Abweichung erkannt wurde. */
  var pre=null;try{var SD=gmDbMod();if(SD&&c.planned&&c.actual)pre=SD.debrief({planned:c.planned,actual:c.actual,zones:c.zones||null});}catch(_){ }
  if(pre&&pre.judged&&(pre.adherence==='abgebrochen'||pre.adherence==='zu langsam'||pre.adherence==='zu schnell')){
    h+='<div class="sectlabel" style="padding-left:0">Woran lag es?</div><div class="db-reasons">';
    GM_DB_REASONS.forEach(function(r){
      h+='<button type="button" class="db-reason'+(_gmDbReason===r[0]?' on':'')+'" onclick="gmDbSetReason(\''+r[0]+'\')">'+gmEsc(r[1])+'</button>';
    });
    h+='</div>';
  }
  h+='<button class="mini-btn primary" style="width:100%;margin-top:14px" onclick="gmDbSave()">Speichern</button>';
  h+='</div>';
  try{gmOpenSheet('debrief',h);}catch(_){ }
}

var _gmDbReason=null;
function gmDbSetReason(r){_gmDbReason=(_gmDbReason===r)?null:r;gmRenderDebriefSheet();}
var GM_DB_REASONS=[
  ['fatigue','Müde / schwere Beine'],['time','Zeit gefehlt'],['pain','Beschwerden'],
  ['weather','Wetter / Strecke'],['illness','Krank / angeschlagen'],['felt_good','Ging leicht'],
  ['other','Anderes']
];

function gmDbSave(){
  if(!_gmDbCtx)return;
  var c=_gmDbCtx,st=gmDbStore();if(!st)return;
  var SD=gmDbMod();
  /* KANONISCHER PERSISTENZVERTRAG (v8-289): Der Record entsteht im reinen,
     in Node testbaren Builder — die Tests bauen ihre Debriefs mit DERSELBEN
     Funktion. Er traegt id, userId, planId, planRevision, createdAt,
     completed und die OCCURRENCE-Session-ID (nicht die Template-ID). */
  var _cp=null;
  try{_cp=(typeof _gmCanonPlan!=='undefined'&&_gmCanonPlan&&_gmCanonPlan.plan)?_gmCanonPlan.plan:null;}catch(_e){}
  var rec=(window.ORVIA&&ORVIA.debriefRecord)
    ? ORVIA.debriefRecord.build({
        key:c.key, date:c.date, unit:c.unit,
        planned:c.planned, actual:c.actual, zones:c.zones||null,
        rpe:_gmDbRpe, pain:_gmDbPain, reason:_gmDbReason||null,
        userId:(window.ORVIA&&ORVIA.user&&ORVIA.user.id)||null,
        /* DIESELBE IDENTITAETSQUELLE WIE DIE VORHERSAGE (v8-297): kanonisch,
           sonst weekplan:<Woche des Debrief-Datums> + Inhalts-Revision.
           Vorher blieb beides bei gespeichertem Altplan null — und resolve()
           haette jedes Altplan-Debrief als not_comparable verworfen. */
        planId:(function(){try{return (typeof gmPlanIdentity==='function')?gmPlanIdentity(c.date).planId:(_cp?_cp.planId:null);}catch(_e){return _cp?_cp.planId:null;}})(),
        planRevision:(function(){try{return (typeof gmPlanIdentity==='function')?gmPlanIdentity(c.date).planRevision:(_cp?_cp.revision:null);}catch(_e){return _cp?_cp.revision:null;}})(),
        now:new Date().toISOString(), SD:SD })
    : { key:c.key, date:c.date, rpe:_gmDbRpe, pain:_gmDbPain, reason:_gmDbReason||null };

  /* Dedup nach po:-Identitaet (debrief-record@3): Zwillinge mit
     verschiedenen Template-IDs ueberschreiben sich NIE mehr; Bestandsrecords
     ohne ID werden einmalig per Schluessel migriert. */
  if(window.ORVIA&&ORVIA.debriefRecord&&ORVIA.debriefRecord.upsert){
    ORVIA.debriefRecord.upsert(st,rec);
  } else {
    var prev=gmDbFind(c.key);
    if(prev){for(var k in rec)prev[k]=rec[k];}
    else st.push(rec);
  }
  try{if(typeof saveProfile==='function')saveProfile();}catch(_){ }
  /* DROSSEL-BUST (v8-297): Ein neues Debrief IST ein neuer Datenstand —
     die naechste Beobachtung darf nicht im Minutenfenster haengen. */
  try{if(typeof _gmObsLast!=='undefined'&&_gmObsLast)_gmObsLast.key=null;}catch(_){ }

  /* Entscheidungs-Log: das Debrief ist eine Rueckmeldung, keine Planentscheidung —
     protokolliert wird es trotzdem, weil es spaeter die Grundwahrheit liefert. */
  try{
    if(window.ORVIA&&ORVIA.decisionLog&&ORVIA.decisionLog.logDecision){
      /* IDENTITAET WIE IM PROFIL (v8-292): Das Log ist append-only mit
         unique(user_id, decision_id) — 'db:'+key kollidierte fuer Zwillinge
         (gleiches Datum|Sport|Label) UND fuer jedes erneute Speichern
         derselben Einheit. Jetzt: Occurrence-ID des Records + Ereigniszeit —
         Zwillinge unterscheiden sich per Template-ID, Wiederholungen per
         Zeitstempel, und jede Korrektur ist ein NEUER Eintrag (genau das
         Append-only-Versprechen von 0032). */
      ORVIA.decisionLog.logDecision({
        timestamp:new Date().toISOString(), decisionType:'user_override',
        decisionId:(rec.id||('db:'+c.key))+'@'+(rec.debriefedAt||new Date().toISOString()),
        weekId:null, planId:rec.planId||null, registry:ORVIA,
        inputs:{sessionType:rec.sessionType,rpe:rec.rpe,pain:rec.pain},
        selected:{adherence:rec.adherence,executionScore:rec.executionScore}
      });
    }
  }catch(_){ }

  /* Prediction Observer (v8-293): Aufloesung NACH dem Speichern — das
     Speichern hat Vorrang und ist zu diesem Zeitpunkt abgeschlossen; ein
     werfender Observer kann es nicht mehr beruehren. Hinter demselben
     Flag wie predict(). */
  try{
    if(window.ORVIA&&ORVIA.resolveDebriefPrediction)ORVIA.resolveDebriefPrediction(rec);
  }catch(_){ }

  _gmDbCtx=null;_gmDbRpe=null;_gmDbPain=false;_gmDbReason=null;
  try{gmCloseSheets();}catch(_){ }
  try{renderGMPlan();}catch(_){ }
  try{toast('Rückmeldung gespeichert');}catch(_){ }
}

/* Verträglichkeitsstand — beantwortet „was weiß die App über mich". */
function gmDebriefState(){
  try{
    var SD=gmDbMod();if(!SD)return null;
    var st=gmDbStore()||[];
    return SD.toleranceState(st.filter(function(d){return d&&d.judged;}),{});
  }catch(_){return null;}
}
/* Bindeglied Plankarte -> Debrief. Sammelt Plan, Ist und Zonen an EINER Stelle,
   damit die Karte nur eine Koordinate uebergeben muss. */
function gmOpenDebriefAt(di,ii,clickDateIso){
  try{
    var week=activeWeekPlan()||[];var it=(week[di]||[])[ii];if(!it)return;
    /* v8-310a (Gians P0): Der Datumskontext kommt vom KLICK (gerenderte
       Karte), nicht aus einer erneuten Wochenversatz-Rechnung — der Versatz
       koennte sich zwischen Render und Klick geaendert haben, und genau diese
       Rekonstruktion ist per Vertrag verboten. Legacy-Fallback nur ohne
       Argument. Debrief fuer VERGANGENE absolvierte Einheiten ist der Zweck
       des Zurueckblaetterns; die ZUKUNFT bleibt gesperrt — es gibt nichts
       rueckzumelden, was noch nicht stattgefunden hat. */
    var dateIso=clickDateIso||null;
    /* v8-310a-Haertung: KEINE _wOff-Rekonstruktion mehr — ohne Klick-Datum
       gibt es keine Rueckmeldung (missing_date_context), denn ein erratenes
       Datum wuerde das Debrief an den falschen Tag binden. */
    if(!dateIso){
      if(typeof toast==='function')toast('Keine Rückmeldung möglich — fehlender Datumskontext.');
      return;
    }
    if(dateIso>todayStr()){
      if(typeof toast==='function')toast('Keine Rückmeldung möglich — diese Einheit liegt in der Zukunft.');
      return;
    }

    /* Ist-Werte aus dem Resolver — dieselbe Quelle wie die Anzeige „Absolviert". */
    var actual=null;
    try{
      var r=(planActualResolveForDates([dateIso])||{}).byOcc||{};
      var key=Object.keys(r).filter(function(x){return x.indexOf(dateIso)===0;})[0];
      var res=key?r[key]:null;
      if(res&&res.actual)actual={distanceKm:res.actual.distanceKm,durationMin:res.actual.durationMin,
        paceSecPerKm:(res.actual.distanceKm>0&&res.actual.durationMin>0)?Math.round(res.actual.durationMin*60/res.actual.distanceKm):null};
    }catch(_){ }

    /* Geplante Vorgabe inkl. Zielpace — ohne sie gibt es kein Urteil (C3). */
    /* GEMEINSAME QUELLE (v8-298): identisch zur Vorhersage-Seite. */
    var sportId=(typeof gmSportIdOfUnit==='function')?gmSportIdOfUnit(it)
      :((String(it.t||'').toLowerCase().indexOf('lauf')>=0)?'running':null);
    var zones=null,planned={t:it.t,l:it.l,d:it.d,sportId:sportId};
    try{
      if(window.ORVIA&&ORVIA.performanceZones&&sportId){
        /* Wiederverwendung der Aufloesung aus dem letzten Render — eine Quelle,
           damit das Urteil zur angezeigten Vorgabe passt. */
        var all=ORVIA._lastPlanPerf||null;
        zones=all&&all.sports?all.sports[sportId]:null;
        var tg=zones?ORVIA.performanceZones.paceForUnit(it,zones):null;
        if(tg&&tg.ok){planned.targetLoSecPerKm=tg.loSecPerKm;planned.targetHiSecPerKm=tg.hiSecPerKm;planned.zone=tg.zone;}
      }
    }catch(_){ }
    /* LEAKAGE-FIX (v8-289): planned bekommt NIE Ist-Werte. Vorher stand hier
       planned.durationMin=actual.durationMin — damit diktierte die Ausfuehrung
       rueckwirkend die Erwartung (expectedRpe skaliert mit der Dauer!) und
       completionPct war konstruktionsbedingt 1. Die geplante Dauer kommt aus
       dem Planfeld oder bleibt null (dann Tabellenerwartung, als solche
       ausgewiesen). */
    try{
      var _pd=(window.ORVIA&&ORVIA.debriefRecord)?ORVIA.debriefRecord.plannedDurationOf(it):null;
      if(_pd!=null)planned.durationMin=_pd;
    }catch(_e){}
    gmOpenDebrief(dateIso,it,planned,actual);
    if(_gmDbCtx)_gmDbCtx.zones=zones;
  }catch(_){ }
}
