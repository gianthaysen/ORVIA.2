import fs from 'node:fs'; import vm from 'node:vm';
const sb={window:null};sb.window=sb;vm.createContext(sb);
vm.runInContext(fs.readFileSync('app/js/i18n.js','utf8'),sb);vm.runInContext(fs.readFileSync('app/locales/de.js','utf8'),sb);
const de=sb.ORVIA.locales.de;
let s=fs.readFileSync('app/js/profile.js','utf8');
const missing=new Set();
const esc=v=>v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
s=s.replace(/' \+ T\('(pf\.[^']+)'(?:, ?\{[^}]*\})?\) \+ '/g,(m,k)=>{ if(!(k in de)){missing.add(k);return m;} return esc(de[k]); });
s=s.replace(/T\('(pf\.[^']+)'\)/g,(m,k)=>{ if(!(k in de)){missing.add(k);return m;} return "'"+esc(de[k])+"'"; });
// strip T header
s=s.replace(/^function T\(k,p\)\{[^\n]*\n/m,'');
fs.writeFileSync('_to_delete/profile.recon.js',s);
console.log('missing keys:',[...missing]);
