/* ============================================================
   ORVIA · pb-sync — gemessene Bestzeiten aus Aktivitaeten ins Profil (S1/E4, 12.09.2026)

   BEFUND (Produktionskonto): Der Leistungs-Resolver liest ausschliesslich
   profile.performance.personalBests[] und .tests[] — beides manuell gepflegt.
   Ein real gelaufener Halbmarathon zaehlte deshalb weder als Leistungsbeleg
   (Zonen, Prognose) noch fuer die Profilstaerke („Leistungsreferenz fehlt").

   VERTRAG:
     • Quelle sind ausschliesslich gemessene Fenster aus run-bests (measuredAllBests):
       Runden > Messreihe > Gesamtaktivitaet. Nichts wird hochgerechnet.
     • Ein Eintrag je (Sport, Distanz) mit source 'activity'; Schluessel activityId.
       Manuelle Eintraege (source != 'activity') werden NIE veraendert oder entfernt.
     • Verschwindet die Aktivitaet (Tombstone/Loeschung), verschwindet ihr Eintrag.
     • merge() ist rein: gleiche Eingabe ⇒ gleiche Ausgabe, keine Seiteneffekte.
       Das Schreiben ins Profil uebernimmt der Aufrufer (profile.js).
   ============================================================ */
(function (root) {
  root.ORVIA = root.ORVIA || {};
  var O = root.ORVIA;
  var VERSION = 'pb-sync@1';
  var SOURCE = 'activity';

  var LABEL = { running: { k1: '1 km', k5: '5 km', k10: '10 km', k21: '21.0975 km', k42: '42.195 km' },
                cycling: { k20: '20 km', k40: '40 km', k90: '90 km', k180: '180 km' },
                swimming: { m400: '400 m', m750: '750 m', m1500: '1500 m', m1900: '1900 m', m3800: '3800 m' } };

  function _id(sport, key, activityId) { return 'pb:' + sport + ':' + key + ':' + String(activityId || '-'); }

  /* entries(measuredAll, opts) → Liste kanonischer personalBests-Eintraege aus den Messungen.
     opts.raceActivityIds: Set/Array von Aktivitaets-IDs, die als Wettkampf gelten (E2) — diese
     Eintraege bekommen context 'Wettkampf' (der Resolver stuft sie als 'race' ein). */
  function entries(measuredAll, opts) {
    var o = opts || {}, races = {};
    (Array.isArray(o.raceActivityIds) ? o.raceActivityIds : (o.raceActivityIds && typeof o.raceActivityIds.forEach === 'function' ? Array.from(o.raceActivityIds) : []))
      .forEach(function (id) { races[String(id)] = true; });
    var out = [];
    Object.keys(LABEL).forEach(function (sport) {
      var m = measuredAll && measuredAll[sport]; if (!m) return;
      Object.keys(LABEL[sport]).forEach(function (key) {
        var b = m[key]; if (!b || !(b.sec > 0) || !b.activityId) return;
        out.push({
          id: _id(sport, key, b.activityId), sportId: sport, discipline: '', distance: LABEL[sport][key],
          timeSeconds: Math.round(b.sec), context: races[String(b.activityId)] ? 'Wettkampf' : 'Aktivität (gemessen)',
          measuredAt: b.date || null, source: SOURCE, notes: '',
          extra: { activityId: String(b.activityId), method: b.method || null, measuredKm: b.km != null ? b.km : null, targetKey: key }
        });
      });
    });
    return out;
  }

  /* merge(existing, measuredAll, opts) → { list, added, removed, changed }
     existing: profile.performance.personalBests (beliebige Reihenfolge). */
  function merge(existing, measuredAll, opts) {
    var manual = [], oldAuto = {};
    (Array.isArray(existing) ? existing : []).forEach(function (b) {
      if (!b) return;
      if (b.source === SOURCE) oldAuto[b.id] = b; else manual.push(b);
    });
    var fresh = entries(measuredAll, opts), added = 0, kept = 0;
    var freshIds = {};
    fresh.forEach(function (e) {
      freshIds[e.id] = true;
      var prev = oldAuto[e.id];
      if (!prev) added++;
      else if (prev.timeSeconds === e.timeSeconds && prev.context === e.context && prev.measuredAt === e.measuredAt) kept++;
    });
    var removed = Object.keys(oldAuto).filter(function (id) { return !freshIds[id]; }).length;
    var changed = added > 0 || removed > 0 || (fresh.length - kept) > added;
    return { list: manual.concat(fresh), added: added, removed: removed, changed: changed };
  }

  var api = { VERSION: VERSION, SOURCE: SOURCE, LABEL: LABEL, entries: entries, merge: merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  O.pbSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
