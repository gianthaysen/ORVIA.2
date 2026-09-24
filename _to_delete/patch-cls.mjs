import fs from 'node:fs';
let c = fs.readFileSync('app/js/engine/run-classifier.js', 'utf8');
c = c.replace(`  var api = { VERSION: VERSION, DEFAULTS: DEFAULTS, classifyRun: classifyRun };`,
`  /* App-Adapter: Kontext (Schwellenpace, 10-km-Bestpace, HFmax) aus injizierten Abhaengigkeiten,
     5 s gecacht — _storeRunsByDay ist ein heisser Pfad, resolveAll ist es nicht. Reine Eingabe,
     kein Zugriff auf Globals: deps = { profile, today, performanceResolver, runBests, activityStore, hrMax, now }. */
  var _ctxCache = { at: 0, key: null, ctx: null };
  function appContext(deps) {
    deps = deps || {};
    var now = num(deps.now) != null ? deps.now : Date.now(), key = String(deps.today || '') + '|' + String(deps.hrMax == null ? '' : deps.hrMax);
    if (_ctxCache.ctx && _ctxCache.key === key && now - _ctxCache.at < 5000) return _ctxCache.ctx;
    var ctx = { hrMax: num(deps.hrMax) };
    try { var pr = deps.performanceResolver && deps.performanceResolver.resolveAll ? deps.performanceResolver.resolveAll(deps.profile || null, { today: deps.today || null }) : null;
      var run = pr && pr.sports && pr.sports.running; if (run && run.ok && run.thresholdPaceSecPerKm > 0) ctx.thresholdPaceSec = run.thresholdPaceSecPerKm; } catch (e) {}
    if (ctx.thresholdPaceSec == null) { try { var rb = deps.runBests, st = deps.activityStore;
      var mb = (rb && rb.measuredRunBests && st && st.listActivities) ? rb.measuredRunBests(st.listActivities(), { isTombstoned: st.isTombstoned || null }) : null;
      if (mb && mb.k10 && mb.k10.sec > 0) ctx.best10kPaceSec = mb.k10.sec / 10; } catch (e) {} }
    _ctxCache = { at: now, key: key, ctx: ctx };
    return ctx;
  }

  var api = { VERSION: VERSION, DEFAULTS: DEFAULTS, classifyRun: classifyRun, appContext: appContext };`);
fs.writeFileSync('app/js/engine/run-classifier.js', c);
let u = fs.readFileSync('app/js/ui.js', 'utf8');
const a = u.indexOf('  var _cls=null,_ctx=null;'), b = u.indexOf('  Object.keys(map).forEach(function(k){var e=map[k];', a);
if (a < 0 || b < 0) throw new Error('ui anchors');
u = u.slice(0, a) + `  var _cls=null,_ctx=null;
  try{_cls=window.ORVIA&&ORVIA.runClassifier;if(_cls&&_cls.appContext){_ctx=_cls.appContext({profile:(typeof PROFILE!=='undefined'?PROFILE:null),today:todayStr(),
    performanceResolver:ORVIA.performanceResolver||null,runBests:ORVIA.runBests||null,activityStore:ORVIA.activityStore||null,
    hrMax:(typeof Calc!=='undefined'&&Calc._hrMax)?Calc._hrMax():null});}}catch(_){_cls=null;}
` + u.slice(b);
fs.writeFileSync('app/js/ui.js', u);
let g = fs.readFileSync('app/js/goal-detail.js', 'utf8');
const ga = `    else if (num(g.targetValue) != null || (typeof g.targetValue === 'string' && g.targetValue !== '')) { m.targetText = fmtGoalValue(g, +g.targetValue); }`;
if (!g.includes(ga)) throw new Error('gd anchor');
g = g.replace(ga, `    else if (num(g.targetValue) != null || (typeof g.targetValue === 'string' && g.targetValue !== '')) { m.targetText = fmtGoalValue(g, g.targetValue); }`);
fs.writeFileSync('app/js/goal-detail.js', g);
console.log('ok');
