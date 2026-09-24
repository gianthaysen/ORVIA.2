p='app/js/ui.js'; s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (old[:60], s.count(old)); s=s.replace(old,new)
rep("""function gpR(l,d){return {t:'Laufen',l:l,d:d};}
function gpB(l,d){return {t:'Rad',l:l,d:d};}
function gpG(l){return {t:'Gym',l:l,d:'45 min'};}
function gpS(l,d){return {t:'Schwimmen',l:l,d:d||'~1000 m'};}
function gpM(){return {t:'Mobilität',l:'Mobility',d:'15 min'};}""",
"""/* B-13 Schritt 1 (2026-09-11): Plan-Items tragen ein `kind`-Feld (Code). Bisher
   klassifizierten unitKind()/isHardUnit()/die Engine-Module ueber die WOERTER im
   Label („Long Run", „Intervalle") — eine Uebersetzung der Labels haette die
   Klassifikation gebrochen. Ab jetzt: kind ist die Wahrheit, das Label-Raten
   bleibt nur als Rueckfall fuer gespeicherte Plaene ohne kind. */
function _runKindOf(l,d){var s=String(l||'').toLowerCase();if(d==='iv'||s.indexOf('interval')>=0)return 'interval';if(d==='lr'||s.indexOf('long')>=0)return 'long';if(s.indexOf('tempo')>=0||s.indexOf('schwelle')>=0)return 'tempo';return 'easy';}
function gpR(l,d){return {t:'Laufen',l:l,d:d,kind:_runKindOf(l,d)};}
function gpB(l,d){var s=String(l||'').toLowerCase();return {t:'Rad',l:l,d:d,kind:/long/.test(s)?'bike_long':(/interval/.test(s)?'bike_hard':(/recovery/.test(s)?'bike_recovery':'bike'))};}
function gpG(l){var s=String(l||'').toLowerCase();return {t:'Gym',l:l,d:'45 min',kind:/bein|ganzk|squat|leg/.test(s)?'gym_leg':'gym'};}
function gpS(l,d){return {t:'Schwimmen',l:l,d:d||'~1000 m',kind:'swim'};}
function gpM(){return {t:'Mobilität',l:'Mobility',d:'15 min',kind:'mob'};}""")
rep("""function unitKind(item){
  var l=(item.l||'').toLowerCase(),d=item.d;
  if(item.t==='Gym')return 'gym';if(item.t==='Schwimmen')return 'swim';if(item.t==='Rad')return 'bike';if(item.t==='Mobilität')return 'mob';""",
"""function unitKind(item){
  /* B-13: kind-Feld gewinnt (Lauf-Codes 1:1; Rad/Gym-Feincodes auf die Grobklassen dieser Funktion gefaltet). */
  var k=item&&item.kind;
  if(k==='interval'||k==='long'||k==='tempo'||k==='easy')return k;
  if(k==='gym'||k==='gym_leg')return 'gym';if(k==='swim')return 'swim';if(k==='mob')return 'mob';if(k&&k.indexOf('bike')===0)return 'bike';
  var l=(item.l||'').toLowerCase(),d=item.d;
  if(item.t==='Gym')return 'gym';if(item.t==='Schwimmen')return 'swim';if(item.t==='Rad')return 'bike';if(item.t==='Mobilität')return 'mob';""")
open(p,'w',encoding='utf-8').write(s); print('ui ok')

for p,ver in [('app/js/engine/goal-phase-plan.js',"goal-phase-plan@2"),('app/js/engine/absence-replanner.js',"absence-replanner@3")]:
    s=open(p,encoding='utf-8').read()
    old="""  function _kind(it) {
    if (!it || typeof it !== 'object') return null;"""
    new="""  var KINDS = { interval: 1, long: 1, tempo: 1, easy: 1, gym: 1, gym_leg: 1, mob: 1, swim: 1, bike: 1, bike_long: 1, bike_hard: 1, bike_recovery: 1 };
  function _kind(it) {
    if (!it || typeof it !== 'object') return null;
    if (it.kind && KINDS[it.kind]) return it.kind;   /* B-13: Code gewinnt, Label-Raten nur Rueckfall */"""
    assert s.count(old)==1; s=s.replace(old,new)
    import re
    s=re.sub(r"var VERSION = '[a-z-]+@\d+';", "var VERSION = '"+ver+"';", s, count=1)
    open(p,'w',encoding='utf-8').write(s)
print('engine ok')
