p='app/js/engine/goal-shadow.js'; s=open(p,encoding='utf-8').read()
old="  var VERSION = 'goal-shadow@1';"
assert old in s; s=s.replace(old,"  var VERSION = 'goal-shadow@2';   /* @2: 'session' — Laufzeit-Beleg ohne Zielmutation (12.09.2026) */")
old2="  var TYPES = ['add', 'update', 'remove', 'status'];"
assert old2 in s
s=s.replace(old2,"""  /* 'session' (@2, Migration 0043): einmal je Geraet und Kalendertag nach dem Login.
     Befund 12.09.2026: acht Tage Flag-Betrieb ohne Zielmutation ergaben NULL Zeilen —
     ein reines Mutations-Log belegt keine Laufzeit. 'session' vergleicht dieselben
     Felder, nur ausgeloest durch Nutzung statt durch Bearbeitung. */
  var TYPES = ['add', 'update', 'remove', 'status', 'session'];""")
open(p,'w',encoding='utf-8').write(s)
p='app/js/profile.js'; s=open(p,encoding='utf-8').read()
old="function _goalShadowId(){"
assert old in s
s=s.replace(old,"""/* A-06 Nachtrag (12.09.2026): Laufzeit-Beleg. Einmal je Geraet und Kalendertag nach
   orvia:auth-ready (Profil und Ziele sind dann hydriert) ein 'session'-Ereignis — abseits
   des kritischen Login-Pfads (setTimeout). Ohne Migration 0043 lehnt der CHECK die Zeile
   ab: das ist ein gezaehlter Schreibfehler, kein Verhalten. */
function _goalShadowSession(){
  try{
    var k='orvia_gs_session_day',today=new Date().toISOString().slice(0,10);
    if(localStorage.getItem(k)===today)return false;
    localStorage.setItem(k,today);
    _goalShadowNote('session');
    return true;
  }catch(e){return false;}
}
try{window.addEventListener('orvia:auth-ready',function(){setTimeout(_goalShadowSession,1500);});}catch(e){}
function _goalShadowId(){""")
open(p,'w',encoding='utf-8').write(s)
print('ok')
