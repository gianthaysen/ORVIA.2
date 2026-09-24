import fs from 'node:fs';
let s = fs.readFileSync('app/js/profile.js','utf8');
const old = `var INT_STATUS_DE={not_available:'' + T('pf.nicht_verfuegbar_') + '',not_connected:'' + T('pf.nicht_verbunden') + '',connecting:'' + T('pf.verbindung_wird_hergestellt') + '',connected:'Verbunden',permission_required:'' + T('pf.berechtigung_erforderlich') + '',error:'Fehler',sync_paused:'' + T('pf.synchronisierung_pausiert') + ''};`;
const neu = `var INT_STATUS_DE={not_available:T('pf.nicht_verfuegbar_'),not_connected:T('pf.nicht_verbunden_'),connecting:T('pf.verbindung_wird_hergestellt'),connected:T('pf.verbunden_'),permission_required:T('pf.berechtigung_erforderlich'),error:T('pf.fehler_'),sync_paused:T('pf.synchronisierung_pausiert')};`;
if (!s.includes(old)) { console.log('NOT FOUND'); process.exit(1); }
s = s.replace(old, neu);
fs.writeFileSync('app/js/profile.js', s);
let d = fs.readFileSync('app/locales/de.js','utf8');
d = d.replace(`    'pf.verbunden': 'verbunden',\n`, `    'pf.verbunden': 'verbunden',\n    'pf.verbunden_': 'Verbunden',\n`);
d = d.replace(`    'pf.nicht_verbunden': 'nicht verbunden',\n`, `    'pf.nicht_verbunden': 'nicht verbunden',\n    'pf.nicht_verbunden_': 'Nicht verbunden',\n`);
d = d.replace(`    'pf.fehler': 'Fehler: ',\n`, `    'pf.fehler': 'Fehler: ',\n    'pf.fehler_': 'Fehler',\n`);
fs.writeFileSync('app/locales/de.js', d);
console.log('ok');
