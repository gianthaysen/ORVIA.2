import fs from 'node:fs';
const files = ['devices_4h','performance_4f','recovery_prefs_4g','sport_editor_4c2','profile_ui','sheet_4j1'];
for (const f of files) {
  const p = f + '_test.mjs';
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  // pattern A (compact)
  s = s.replace(/^(vm\.runInContext\(readFileSync\(new URL\('profile-model\.js',base\),'utf8'\),sb\);)/m,
    "vm.runInContext(readFileSync(new URL('i18n.js',base),'utf8'),sb);\nvm.runInContext(readFileSync(new URL('../locales/de.js',base),'utf8'),sb);\n$1");
  // pattern B (spaced, sandbox var)
  s = s.replace(/^(vm\.runInContext\(readFileSync\(new URL\('profile-model\.js', base\), 'utf8'\), sandbox, \{ filename: 'profile-model\.js' \}\);)/m,
    "vm.runInContext(readFileSync(new URL('i18n.js', base), 'utf8'), sandbox, { filename: 'i18n.js' });\nvm.runInContext(readFileSync(new URL('../locales/de.js', base), 'utf8'), sandbox, { filename: 'de.js' });\n$1");
  if (s === before) console.log('NO CHANGE', p); else { fs.writeFileSync(p, s); console.log('patched', p); }
}
