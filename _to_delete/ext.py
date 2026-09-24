p='app/tools/i18n-extract.mjs'; s=open(p,encoding='utf-8').read()
old="  if (/^\\s*(\\/\\/|\\*|\\/\\*)/.test(line) || /console\\./.test(line)) return;"
assert old in s
s=s.replace(old,"  /* Kommentare, Logs, Perf-Marken (_P.mark('…')), HTTP-Header: keine Nutzertexte (Befund auth.js 12.09.: 13 Perf-Labels + 'Bearer ' erfasst). */\n  if (/^\\s*(\\/\\/|\\*|\\/\\*)/.test(line) || /console\\./.test(line) || /\\.mark\\(/.test(line) || /headers\\s*:/.test(line)) return;")
open(p,'w',encoding='utf-8').write(s); print('ok')
