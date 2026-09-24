const fs=require('fs');
function rep(file, from, to){ let s=fs.readFileSync(file,'utf8'); if(s.indexOf(from)<0) throw new Error('not found in '+file+': '+from.slice(0,70)); if(s.indexOf(from)!==s.lastIndexOf(from)) throw new Error('ambiguous: '+from.slice(0,70)); fs.writeFileSync(file, s.replace(from,to)); }
rep('app/js/activity-store.js',
`  function listActivities(filters) {
    filters = filters || {};
    var all = readAll().slice();
    all.sort(function (a, b) { return String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || '')); });
    var out = all.filter(function (a) {`,
`  /* S2c (v8-388): Gekoppelte Geraeteaufzeichnungen sind KEINE eigenstaendigen
     Einheiten — sie haengen als a.recording am Primaerdatensatz (activityConfig.
     attachRecordings). Alle Konsumenten (Last, Prognose, Zaehler) lesen ueber diese
     Funktion und sehen damit genau EINE Einheit. filters.includeLinked = true liefert
     die Rohliste (Diagnose). Faellt activityConfig aus, bleibt die Rohliste. */
  function attachRec(list) {
    try { var AC = O.activityConfig; if (AC && typeof AC.attachRecordings === 'function') return AC.attachRecordings(list); } catch (e) {}
    return list;
  }
  function listActivities(filters) {
    filters = filters || {};
    var all = readAll().slice();
    all.sort(function (a, b) { return String(b.startedAt || b.createdAt || '').localeCompare(String(a.startedAt || a.createdAt || '')); });
    if (!filters.includeLinked) all = attachRec(all);
    var out = all.filter(function (a) {`);
console.log('ok');
