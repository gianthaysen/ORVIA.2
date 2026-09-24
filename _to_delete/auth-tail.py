p='app/js/auth.js'; s=open(p,encoding='utf-8').read()
i=s.index("})();\n\n/* ============================================================\n   Konto-/Sync-Karte im Profil")
head,tail=s[:i],s[i:]
n=tail.count("T('auth.")
tail=tail.replace("T('auth.","_authT('auth.")
tail=tail.replace("})();\n\n/* ============================================================\n   Konto-/Sync-Karte im Profil","})();\n\n/* B-13: Texte der globalen Konto-Karte ueber t(); eigener Name, weil dieser Teil ausserhalb\n   der IIFE liegt und profile.js bereits ein globales T fuehrt (kein Redeclare-Risiko). */\nvar _authT = function (k, p) { try { var I = window.ORVIA && window.ORVIA.i18n; if (I && typeof I.t === 'function') return I.t(k, p); } catch (e) {} return String(k); };\n\n/* ============================================================\n   Konto-/Sync-Karte im Profil",1)
open(p,'w',encoding='utf-8').write(head+tail); print('tail refs',n)
