p='js/goal-detail.js'; s=open(p,encoding='utf-8').read()
# Modell: race { kind:'result'|'match', ... }
a="      feasibilityText: null, feasibilityWarn: false, gaps: [], milestones: Array.isArray(g.milestones) ? g.milestones : [] };"; assert a in s
s=s.replace(a,"      feasibilityText: null, feasibilityWarn: false, gaps: [], milestones: Array.isArray(g.milestones) ? g.milestones : [],\n      status: g.status || 'active', race: raceModel(g, o.raceMatch || null) };")
a="  function html(m) {"; assert a in s
s=s.replace(a,"""  /* S1/E2 (13.09.2026): Wettkampf am Ziel — bestaetigtes Ergebnis oder erkannte Aktivitaet. */
  function fmtSec(sec) { if (sec == null) return '—'; sec = Math.round(Math.abs(sec)); var h = Math.floor(sec / 3600), mi = Math.floor((sec % 3600) / 60), x = sec % 60; return h ? h + ':' + String(mi).padStart(2, '0') + ':' + String(x).padStart(2, '0') : mi + ':' + String(x).padStart(2, '0'); }
  function raceModel(g, match) {
    var r = g && g.result && g.result.verdict ? g.result : null;
    if (r) return { kind: 'result', verdict: r.verdict, timeText: fmtSec(r.timeSec), deltaText: r.deltaSec != null ? ((r.deltaSec <= 0 ? '−' : '+') + fmtSec(r.deltaSec)) : null, distanceKm: r.distanceKm, date: r.date, activityId: r.activityId };
    if (match) return { kind: 'match', verdict: match.verdict, timeText: fmtSec(match.timeSec), deltaText: match.deltaSec != null ? ((match.deltaSec <= 0 ? '−' : '+') + fmtSec(match.deltaSec)) : null, distanceKm: match.distanceKm, date: match.date, activityId: match.activityId };
    return null;
  }
  function raceHTML(m) {
    var r = m.race; if (!r) return '';
    var verdict = T('goal.race.' + r.verdict);
    var line = esc(fmtNum(r.distanceKm) + ' km · ' + r.timeText + (r.deltaText ? ' · ' + r.deltaText : '') + (r.date ? ' · ' + (deDate(r.date) || r.date) : ''));
    if (r.kind === 'result') return '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.race.title')) + '</div><div class="gd-race gd-race-' + esc(r.verdict) + '"><b>' + esc(verdict) + '</b> · ' + line + '</div></div>';
    return '<div class="gd-sec"><div class="gd-h">' + esc(T('goal.race.detected')) + '</div><div class="gd-race gd-race-match">' + line + (r.verdict !== 'finished' ? ' · ' + esc(verdict) : '') +
      '<div class="gd-race-acts"><button type="button" class="btn" id="gd-race-ok">' + esc(T('goal.race.confirm')) + '</button><button type="button" class="btn sec" id="gd-race-no">' + esc(T('goal.race.dismiss')) + '</button></div></div></div>';
  }
  function fmtNum(n) { return (typeof n === 'number') ? String(Math.round(n * 100) / 100).replace('.', ',') : String(n == null ? '' : n); }
  function html(m) {""")
a="      '<div class=\"gd-sec\"><div class=\"gd-h\">' + esc(T('goal.detail.progress')) + '</div>' + bar + '<p class=\"gd-note\">' + esc(p.note || '') + '</p></div>' +"; assert a in s
s=s.replace(a,"      raceHTML(m) +\n"+a)
# open(): raceMatch berechnen, Buttons binden
a="    var m = buildModel({ goal: goal, planInput: pi, engine: eng, feasibility: feas, strength: str, catLabel: root.goalCatLabel || null });"; assert a in s
s=s.replace(a,"""    var rm = null;
    try { if (O.raceResult && O.activityStore && O.activityStore.listActivities && !(goal.result && goal.result.verdict)) rm = O.raceResult.match(goal, O.activityStore.listActivities() || [], { isTombstoned: O.activityStore.isTombstoned || null }); } catch (e) {}
    var m = buildModel({ goal: goal, planInput: pi, engine: eng, feasibility: feas, strength: str, catLabel: root.goalCatLabel || null, raceMatch: rm });""")
a="      var eb = document.getElementById('gd-edit'); if (eb) eb.onclick = function () { close(); try { root.openGoalEditor(goal.id); } catch (e) {} };"; assert a in s
s=s.replace(a,a+"""
      var rok = document.getElementById('gd-race-ok'); if (rok && rm) rok.onclick = function () { close(); try { root.goalConfirmResult(goal.id, rm.activityId); } catch (e) {} setTimeout(function () { try { open(goal.id); } catch (e) {} }, 50); };
      var rno = document.getElementById('gd-race-no'); if (rno && rm) rno.onclick = function () { close(); try { root.goalDismissRace(goal.id, rm.activityId); } catch (e) {} setTimeout(function () { try { open(goal.id); } catch (e) {} }, 50); };""")
open(p,'w',encoding='utf-8').write(s)
d=open('locales/de.js',encoding='utf-8').read()
import re
m=re.search(r"^\s*'goal\.detail\.title': .*\n", d, re.M); assert m
d=d[:m.end()]+"    'goal.race.title': 'Wettkampfergebnis',\n    'goal.race.detected': 'Wettkampf erkannt',\n    'goal.race.achieved': 'Erreicht',\n    'goal.race.missed': 'Verfehlt',\n    'goal.race.finished': 'Gefinisht',\n    'goal.race.confirm': 'Als Ergebnis übernehmen',\n    'goal.race.dismiss': 'Nicht mein Rennen',\n"+d[m.end():]
open('locales/de.js','w',encoding='utf-8').write(d)
c=open('styles.css',encoding='utf-8').read()
a=".gmc-rr-achieved{color:#43D693}.gmc-rr-missed{color:#EDB44E}.gmc-rr-match{color:#5AA0F0}\n"; assert a in c
c=c.replace(a,a+".gd-race{padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.04);font-size:13px;line-height:1.45}\n.gd-race-achieved{border-color:rgba(67,214,147,.45);background:rgba(67,214,147,.10)}.gd-race-missed{border-color:rgba(237,180,78,.45);background:rgba(237,180,78,.10)}.gd-race-match{border-color:rgba(90,160,240,.45);background:rgba(90,160,240,.10)}\n.gd-race-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.gd-race-acts .btn{padding:8px 12px;font-size:13px;margin:0}\n")
open('styles.css','w',encoding='utf-8').write(c)
print('ok')
