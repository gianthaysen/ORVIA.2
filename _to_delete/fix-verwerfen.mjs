import fs from 'node:fs';
let s = fs.readFileSync('app/js/profile.js','utf8');
// Buttons: '>' + T('pf.aenderungen_verwerfen') + '</button>' → eigener Key ohne '?'
const before = s.split(`T('pf.aenderungen_verwerfen') + '</button>`).length-1;
s = s.split(`T('pf.aenderungen_verwerfen') + '</button>`).join(`T('pf.aenderungen_verwerfen_btn') + '</button>`);
fs.writeFileSync('app/js/profile.js', s);
let d = fs.readFileSync('app/locales/de.js','utf8');
d = d.replace(`    'pf.aenderungen_verwerfen': 'Änderungen verwerfen?',\n`, `    'pf.aenderungen_verwerfen': 'Änderungen verwerfen?',\n    'pf.aenderungen_verwerfen_btn': 'Änderungen verwerfen',\n`);
fs.writeFileSync('app/locales/de.js', d);
console.log('buttons', before);
