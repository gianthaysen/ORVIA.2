/* ============================================================
   ORVIA · run-bests — GEMESSENE Laufbestzeiten (KF-021)

   PROBLEM (Baseline):
     bestTimes() in ui.js las ausschliesslich den Legacy-Tagesblob
     DB[datum].sessions.Laufen. Reine Garmin-Synchronisationen waren dort nie
     enthalten (siehe Kommentar ui.js: „erfasst reine Garmin-Synchronisationen
     ueberhaupt nicht"). Fehlte ein manuell gepflegter .best-Wert, fiel die
     Anzeige auf eine RIEGEL-SCHAETZUNG aus der DURCHSCHNITTSPACE des
     schnellsten Laufs zurueck. Ein real gelaufener 1-km-Intervallsplit von
     4:20 wurde dadurch als „4:37" ausgewiesen — eine Schaetzung, die eine
     vorhandene Messung ueberschrieb.

     Die Runden lagen die ganze Zeit kanonisch vor: der Garmin-Worker speichert
     splitSummaries/laps in metrics.splits. Gelesen wurden sie bisher nur in
     der Aktivitaetsdetailansicht.

   VERTRAG DIESES MODULS:
     • Es wird NICHTS extrapoliert, skaliert oder hochgerechnet.
     • Eine Bestzeit entsteht nur aus ZUSAMMENHAENGENDEN Runden, deren
       Summendistanz die Zieldistanz TATSAECHLICH ERREICHT.
     • Das Fenster darf hoechstens SLACK laenger sein als die Zieldistanz.
       Die gemessene Zeit ist damit eine OBERGRENZE fuer die Zieldistanz —
       konservativ, nie beschoenigend: wer 5,2 km in 23:50 laeuft, hat 5,0 km
       garantiert nicht langsamer als 23:50 zurueckgelegt.
     • Runden mit 0 km (Uebergaenge, Pausenrunden) brechen ein Fenster NICHT
       auf, ihre Zeit zaehlt aber mit. Sie zu ueberspringen wuerde zwei nicht
       zusammenhaengende Abschnitte verketten und die Zeit zu gut ausweisen.
     • Ohne Runden zaehlt die Gesamtaktivitaet als Messung, aber nur wenn ihre
       Distanz selbst im Zielfenster liegt.
     • Ergebnis ist immer quellenetikettiert (method/date/activityId), damit
       die Oberflaeche Messung und Schaetzung nicht verwechseln kann.

   Kein DOM, kein Store, kein Supabase — reine Funktionen, in node testbar.
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;

  /* Zieldistanzen des Bestzeitenvertrags (identisch zu bestTimes()). */
  var TARGETS = [{ key: 'k1', km: 1 }, { key: 'k5', km: 5 }, { key: 'k10', km: 10 }];
  /* Zulaessiger Ueberhang eines Messfensters. 5 % => die Zeit bleibt eine
     belastbare Obergrenze, ohne dass ein 6-km-Stueck als 5-km-Bestzeit gilt. */
  var SLACK = 0.05;

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  /* Kanonische Normalisierung der Garmin-Runden auf {km, sec, hr}.
     EINE Quelle fuer Aktivitaetsdetail (activity.js) und Bestzeiten.
     Ausschliesslich echte Felder des Rohobjekts — keine Interpolation,
     keine erfundene Runde. */
  function normalizeSplits(raw) {
    if (!Array.isArray(raw) || !raw.length) return null;
    var out = [];
    raw.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var distM = num(r.distance) != null ? num(r.distance) : num(r.distanceInMeters);
      var sec = num(r.duration) != null ? num(r.duration)
        : (num(r.elapsedDuration) != null ? num(r.elapsedDuration) : num(r.movingDuration));
      if (distM == null || sec == null || sec <= 0) return;
      out.push({
        km: Math.round(distM / 1000 * 100) / 100, sec: Math.round(sec),
        hr: num(r.averageHR) != null ? Math.round(num(r.averageHR))
          : (num(r.avgHr) != null ? Math.round(num(r.avgHr)) : null)
      });
    });
    return out.length ? out : null;
  }

  /* Schnellstes zusammenhaengendes Rundenfenster, dessen Summendistanz
     >= targetKm und <= targetKm * (1 + slack) ist.
     Rueckgabe: {sec, km, laps, fromLap} oder null. */
  function bestWindow(splits, targetKm, slack) {
    if (!Array.isArray(splits) || !splits.length || !(targetKm > 0)) return null;
    var maxKm = targetKm * (1 + (slack == null ? SLACK : slack));
    var best = null;
    for (var i = 0; i < splits.length; i++) {
      var km = 0, sec = 0, n = 0;
      for (var j = i; j < splits.length; j++) {
        var s = splits[j];
        if (!s || !(s.sec > 0)) break;                  /* unbrauchbare Runde bricht das Fenster ab */
        km += (s.km > 0 ? s.km : 0); sec += s.sec; n++;
        if (km > maxKm + 1e-9) break;                   /* jedes laengere Fenster ab i ist ebenfalls zu lang */
        if (km + 1e-9 >= targetKm) {
          if (!best || sec < best.sec) {
            best = { sec: sec, km: Math.round(km * 100) / 100, laps: n, fromLap: i + 1 };
          }
          break;                                        /* ein laengeres Fenster ab i kostet nur Zeit */
        }
      }
    }
    return best;
  }

  /* Schnellstes Messfenster ueber die kanonischen Detail-Streams (metrics.streams):
     distM = kumulative Distanz in Metern je Sample, timeSec = kumulative Zeit in
     Sekunden je Sample. Zwei-Zeiger-Fenster OHNE Interpolation: genommen wird das
     kleinste Sample-Fenster, dessen Distanz die Zieldistanz erreicht — die Zeit ist
     damit wieder eine echte OBERGRENZE (bei Garmin-Sampleabstaenden im Sekunden-
     bereich liegt der Ueberhang bei wenigen Metern). Derselbe 5-%-Slack-Guard wie
     beim Rundenfenster: streut ein Stream so grob, dass selbst das engste Fenster
     mehr als 5 % ueberschiesst, wird verworfen statt heruntergerechnet.

     WICHTIG: Es wird KEINE Zeitachse aus dem Speed-Stream abgeleitet. Der Worker
     speichert heute distance/speed/heart_rate/cadence/elevation, aber keinen
     Zeitstempel-Stream — eine aus Δd/v integrierte Zeit waere eine Schaetzung,
     keine Messung, und wuerde hier faelschlich als „gemessen" etikettiert. Das
     Stream-Fenster aktiviert sich automatisch, sobald der Worker eine Zeitachse
     (time/elapsed, Sekunden) mitliefert. */
  function bestWindowFromStreams(distM, timeSec, targetKm, slack) {
    if (!Array.isArray(distM) || !Array.isArray(timeSec)) return null;
    var n = Math.min(distM.length, timeSec.length);
    if (n < 2 || !(targetKm > 0)) return null;
    var targetM = targetKm * 1000;
    var maxM = targetM * (1 + (slack == null ? SLACK : slack));
    /* Monotonie-Guard: kumulative Achsen muessen (schwach) steigen — ein Stream,
       der zurueckspringt, ist kein belastbarer Messtraeger. Einzelne kaputte
       Samples (null/NaN) beenden die Auswertung fail-closed. */
    var i, best = null, j = 0;
    for (i = 1; i < n; i++) {
      var dOk = typeof distM[i] === 'number' && isFinite(distM[i]) && distM[i] >= distM[i - 1] - 1e-6;
      var tOk = typeof timeSec[i] === 'number' && isFinite(timeSec[i]) && timeSec[i] >= timeSec[i - 1] - 1e-6;
      if (!dOk || !tOk) return null;
    }
    for (i = 0; i < n; i++) {
      if (j < i + 1) j = i + 1;
      while (j < n && distM[j] - distM[i] < targetM - 1e-6) j++;
      if (j >= n) break;
      var dm = distM[j] - distM[i];
      if (dm > maxM + 1e-6) continue;                 /* engstes Fenster ab i schiesst zu weit ueber */
      var sec = timeSec[j] - timeSec[i];
      if (!(sec > 0)) continue;
      if (!best || sec < best.sec) {
        best = { sec: Math.round(sec), km: Math.round(dm / 10) / 100, samples: j - i + 1, fromSample: i };
      }
    }
    return best;
  }

  /* Zeitachse eines Aktivitaets-Streams auffinden — NUR echte kumulative
     Sekunden-Achsen, keine Ableitung aus Geschwindigkeit. */
  function streamTimeAxis(streams) {
    if (!streams || typeof streams !== 'object') return null;
    var cands = ['time', 'elapsed', 'elapsed_time', 'timestamp', 'duration'];
    for (var i = 0; i < cands.length; i++) {
      var a = streams[cands[i]];
      if (Array.isArray(a) && a.length >= 2) return a;
    }
    return null;
  }

  /* ============================================================
     Ersatz-Zeitachse bei gleichmaessiger Abtastung (2026-08-05, Nutzerwunsch:
     „das sollte auch einzelne Abschnitte aus laengeren Einheiten nehmen")

     AUSGANGSLAGE: Ein 5-km-Abschnitt aus einem 7-km-Lauf ist genau der Fall, den
     bestWindow (Runden) und bestWindowFromStreams (Messreihe) abdecken sollen. Der
     Rundenweg braucht Runden, der Streamweg eine echte Zeitachse — der Sync-Worker
     liefert heute aber weder zwingend Runden noch einen Zeitstempel-Stream. Ohne
     beides fiel die Anzeige auf die Riegel-SCHAETZUNG aus der Durchschnittspace
     zurueck, also auf einen langsameren Wert als tatsaechlich gelaufen.

     WAS HIER PASSIERT: Liegt eine kumulative Distanzreihe und die Gesamtdauer der
     Aktivitaet vor, wird die Zeit GLEICHMAESSIG auf die Samples verteilt.

     WARUM DAS DEN „NIE BESCHOENIGEN"-VERTRAG NICHT BRICHT: Verteilt wird die
     VOLLSTAENDIGE Aktivitaetsdauer, also inklusive aller Pausen-/Stehzeiten. Jedes
     Teilfenster traegt dadurch seinen Anteil an dieser Zeit mit — die berechnete
     Zeit ist im Zweifel zu LANGSAM, nie zu schnell. Ein so ermittelter Wert bleibt
     damit eine belastbare Obergrenze, genau wie beim Rundenfenster.

     GRENZE, die offen benannt wird: Bei ungleichmaessiger Abtastung („Smart
     Recording") ist die Annahme ungenau. Das Ergebnis traegt deshalb eine EIGENE
     Methode ('stream_uniform') und ein eigenes Quellenetikett — es wird nirgends
     als Rundenmessung ausgegeben, und der Rundenweg gewinnt immer, wenn er greift.
     ============================================================ */
  function uniformTimeAxis(nSamples, totalSeconds) {
    var n = Math.round(+nSamples), t = +totalSeconds;
    if (!(n >= 2) || !(t > 0)) return null;
    var out = new Array(n), step = t / (n - 1);
    for (var i = 0; i < n; i++) out[i] = i * step;
    return out;
  }

  function normSport(v) {
    try {
      if (O.trainingDomain && O.trainingDomain.normSport) return O.trainingDomain.normSport(v);
    } catch (e) {}
    return String(v == null ? '' : v).toLowerCase();
  }
  function isRunning(a) { return !!(a && a.sportId != null && normSport(a.sportId) === 'running'); }

  function distanceKm(a) {
    var s = (a && a.summary) || {};
    var m = num(s.distance_m) != null ? num(s.distance_m) : num(s.distanceM);
    if (m != null) return m / 1000;
    return num(s.distanceKm);
  }

  /* Gemessene Bestzeiten ueber alle kanonischen Laufaktivitaeten.
     activities: Ergebnis von ORVIA.activityStore.listActivities()
     opts.isTombstoned: optionale Praedikatsfunktion des Stores */
  function measuredRunBests(activities, opts) {
    opts = opts || {};
    var isTomb = (typeof opts.isTombstoned === 'function') ? opts.isTombstoned : null;
    var slack = (typeof opts.slack === 'number') ? opts.slack : SLACK;
    /* withStreams/withDerivedTime (2026-08-05): machen nachvollziehbar, WORAUF die
       Auswertung beruht — ohne diese Zaehler liess sich „keine Bestzeit gefunden"
       nicht von „keine auswertbaren Daten vorhanden" unterscheiden. */
    var res = { k1: null, k5: null, k10: null, scanned: 0, withSplits: 0,
                withStreams: 0, withDerivedTime: 0, slack: slack };
    var list = Array.isArray(activities) ? activities : [];
    list.forEach(function (a) {
      if (!isRunning(a)) return;
      if (a.status && a.status !== 'completed') return;
      if (isTomb) { try { if (isTomb(a)) return; } catch (e) {} }
      res.scanned++;
      var splits = normalizeSplits(a.metrics && a.metrics.splits);
      if (splits) res.withSplits++;
      /* Sekundengenaues Stream-Fenster — nur mit ECHTER Zeitachse (siehe
         bestWindowFromStreams). Rundenfenster bleibt der Rueckfall. */
      var id = a.clientRecordId || a.id || a.sourceRecordId || null;
      var day = a.startedAt ? String(a.startedAt).slice(0, 10) : null;
      var totalKm = distanceKm(a);
      var totalSec = num(a.durationSeconds);
      var sDist = null, sTime = null, sMethod = 'stream_window';
      try {
        var strm = a.metrics && a.metrics.streams;
        if (strm && Array.isArray(strm.distance) && strm.distance.length >= 2) {
          sTime = streamTimeAxis(strm);
          if (sTime) { sDist = strm.distance; }
          else {
            /* Keine echte Zeitachse: konservative Ersatzachse aus der Gesamtdauer
               (siehe uniformTimeAxis — verteilt inkl. Pausen, Ergebnis ist eine
               Obergrenze). Eigene Methode, damit die Oberflaeche die Herkunft
               nicht mit einer Rundenmessung verwechseln kann. */
            var ut = uniformTimeAxis(strm.distance.length, totalSec);
            if (ut) { sDist = strm.distance; sTime = ut; sMethod = 'stream_uniform'; res.withDerivedTime++; }
          }
          if (sDist) res.withStreams++;
        }
      } catch (e) {}
      TARGETS.forEach(function (t) {
        var cand = null;
        if (sDist) {
          var sw = bestWindowFromStreams(sDist, sTime, t.km, slack);
          if (sw) cand = { sec: sw.sec, km: sw.km, laps: null, fromLap: null,
                           samples: sw.samples, method: sMethod };
        }
        if (splits) {
          var w = bestWindow(splits, t.km, slack);
          /* Vorrangregel: Ein Rundenfenster ist eine ECHTE Messung, die Ersatzachse
             ('stream_uniform') nur eine begruendete Annahme. Greift der Rundenweg,
             gewinnt er deshalb IMMER — auch wenn die Annahme zufaellig eine schnellere
             Zeit ergaebe. Gegen eine echte Zeitachse ('stream_window') entscheidet
             wie bisher allein die kuerzere Zeit (beides Messungen). */
          if (w && (!cand || cand.method === 'stream_uniform' || w.sec < cand.sec)) {
            cand = { sec: w.sec, km: w.km, laps: w.laps, fromLap: w.fromLap, method: 'lap_window' };
          }
        }
        /* Ohne passende Runden: die Aktivitaet selbst, aber nur wenn ihre eigene
           Distanz im Zielfenster liegt. Keine Hochrechnung ueber laengere Laeufe. */
        if (totalKm != null && totalSec != null && totalSec > 0
            && totalKm + 1e-9 >= t.km && totalKm <= t.km * (1 + slack) + 1e-9) {
          if (!cand || totalSec < cand.sec) {
            cand = { sec: Math.round(totalSec), km: Math.round(totalKm * 100) / 100,
                     laps: null, fromLap: null, method: 'activity_total' };
          }
        }
        if (!cand) return;
        cand.targetKm = t.km; cand.activityId = id; cand.date = day;
        if (!res[t.key] || cand.sec < res[t.key].sec) res[t.key] = cand;
      });
    });
    return res;
  }

  var api = {
    TARGETS: TARGETS, SLACK: SLACK,
    normalizeSplits: normalizeSplits, bestWindow: bestWindow,
    bestWindowFromStreams: bestWindowFromStreams, streamTimeAxis: streamTimeAxis,
    measuredRunBests: measuredRunBests
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.runBests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
