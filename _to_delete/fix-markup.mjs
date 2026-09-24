import fs from 'node:fs';
let s = fs.readFileSync('app/js/profile.js','utf8');
const rep = {
  "pf.aria_label_schliessen": `" aria-label="' + T('pf.schliessen') + '">`,
  "pf.id_ovc_ok_style_margin": `" id="ovc-ok" style="margin-top:10px" onclick="_orviaConfirmOk()">`,
  "pf.onclick_gmtoggle_this": `" onclick="gmToggle(this)">`,
  "pf.onclick_segpick_this": `" onclick="segPick(this)">`,
  "pf.onclick_segpick_this_": `" onclick="segPick(this)`,
};
let n=0;
for (const [k,v] of Object.entries(rep)) {
  const needle = `' + T('${k}') + '`;
  const c = s.split(needle).length-1; n+=c;
  s = s.split(needle).join(v);
}
fs.writeFileSync('app/js/profile.js', s);
let d = fs.readFileSync('app/locales/de.js','utf8');
for (const k of Object.keys(rep)) d = d.replace(new RegExp(`^\\s*'${k.replace('.','\\.')}': .*\\n`, 'm'), '');
fs.writeFileSync('app/locales/de.js', d);
console.log('replaced', n);
