import fs from 'node:fs';
const f = 'app/js/engine/absence-replanner.js'; let s = fs.readFileSync(f, 'utf8'); let n = 0;
function rep(a, b) { if (!s.includes(a)) throw new Error('anchor: ' + a.slice(0, 70)); s = s.replace(a, b); n++; }
rep(`  var VERSION = 'absence-replanner@3';`, `  var VERSION = 'absence-replanner@4';`);
rep(`    /* 3 · Verletzung: kein Aufprall */
    if (injury) {
      strategy = strategy || 'shorten';
      for (var f = today; f < 7; f++) {
        w[f] = w[f].map(function (it) {
          var k = _kind(it);
          if (it.t === 'Laufen') { note(f, 'replaced_no_impact', it); return _mob(); }
          if (k === 'gym_leg') { note(f, 'replaced_no_leg', it); return _copy(it, { l: 'Oberkörper', kind: 'gym' }); }
          return it;
        });
      }
      out.notes.push('injury_criteria_return');
    }`,
`    /* 3 · Verletzung: Ersetzung nach Rueckkehr-Leiter (Stufe D, 14.09.2026).
       inj.policy = { run: none|walkrun|easy_short|easy|all, legStrength, impact } (engine/return-ladder);
       ohne policy gilt 'none' (Bestand @3). inj.label = „Knie links" fuer die Anzeige;
       inj.noImpactSports = Sportarten aus affectedActivities, die ebenfalls ausfallen. */
    if (injury) {
      strategy = strategy || 'shorten';
      var pol = (inj.policy && typeof inj.policy === 'object') ? inj.policy : { run: 'none', legStrength: false, impact: false };
      var runPol = pol.run || 'none', tag = function (it) { it.absenceReason = 'injury'; if (inj.label) it.absenceLabel = inj.label; return it; };
      var noImpact = Array.isArray(inj.noImpactSports) ? inj.noImpactSports : [];
      var replaced = 0;
      if (runPol !== 'all') {
        for (var f = today; f < 7; f++) {
          w[f] = w[f].map(function (it) {
            var k = _kind(it);
            if (it.t === 'Laufen') {
              if (runPol === 'none') { note(f, 'replaced_no_impact', it); replaced++; return tag(_mob()); }
              if (runPol === 'walkrun') { note(f, 'replaced_walkrun', it); replaced++; return tag({ t: 'Laufen', l: 'Geh-Lauf', d: 'walkrun', kind: 'easy', absenceAdjusted: true }); }
              if (runPol === 'easy_short') { if (k === 'easy' && /kurz/.test(String(it.l))) return it; note(f, 'replaced_easy_short', it); replaced++; return tag(_easyRun('Z2 Dauerlauf kurz')); }
              if (runPol === 'easy') { if (k === 'interval' || k === 'tempo') { note(f, 'replaced_easy', it); replaced++; return tag(_easyRun()); } if (k === 'long') { note(f, 'long_shortened', it); replaced++; return tag(_copy(it, { l: 'Long Run kurz' })); } return it; }
              return it;
            }
            if (k === 'gym_leg' && !pol.legStrength) { note(f, 'replaced_no_leg', it); replaced++; return tag(_copy(it, { l: 'Oberkörper', kind: 'gym' })); }
            if (noImpact.length && ((it.t === 'Rad' && noImpact.indexOf('cycling') >= 0) || (it.t === 'Schwimmen' && noImpact.indexOf('swimming') >= 0))) { note(f, 'replaced_affected_sport', it); replaced++; return tag(_mob()); }
            return it;
          });
        }
      }
      out.notes.push('injury_criteria_return');
      out.injury = { label: inj.label || null, policy: runPol, replaced: replaced, stage: inj.stage != null ? inj.stage : null };
    }`);
rep(`  var LOWER = { hip: 1, thigh: 1, knee: 1, lower_leg: 1, ankle: 1, foot: 1 };
  function injuryFromConstraints(list) {
    var arr = Array.isArray(list) ? list : [], hits = [];
    arr.forEach(function (c) {
      if (!c || c.status !== 'active') return;
      var it = (c.intensity != null) ? parseInt(c.intensity, 10) : null;
      var aff = Array.isArray(c.affectedActivities) ? c.affectedActivities : [];
      var why = c.currentlyTrainable === false ? 'not_trainable'
        : (aff.indexOf('running') >= 0 ? 'affects_running'
        : (LOWER[c.bodyRegion] && it != null && it >= 7 ? 'lower_body_high' : null));
      if (why) hits.push({ id: c.id || null, bodyRegion: c.bodyRegion || null, intensity: it, why: why });
    });
    return { active: hits.length > 0, hits: hits };
  }`,
`  var LOWER = { hip: 1, thigh: 1, knee: 1, lower_leg: 1, ankle: 1, foot: 1 };
  var REGION_DE = { head_neck: 'Kopf/Nacken', shoulder: 'Schulter', elbow: 'Ellenbogen', wrist_hand: 'Handgelenk', chest: 'Brust', back: 'Rücken', hip: 'Hüfte', thigh: 'Oberschenkel', knee: 'Knie', lower_leg: 'Unterschenkel', ankle: 'Sprunggelenk', foot: 'Fuß' };
  var SIDE_DE = { left: 'links', right: 'rechts', both: 'beidseitig' };
  function constraintLabel(c) { if (!c) return null; var r = REGION_DE[c.bodyRegion] || c.title || c.bodyRegion || null; var sd = SIDE_DE[c.side]; return r ? (r + (sd ? ' ' + sd : '')) : null; }
  /* Stufe D: auch Beschwerden, deren Rueckkehr-Leiter laeuft (Status 'improved', Stufe < 5), bleiben
     fuer die Planung wirksam — sonst faellt mit dem ersten Fortschritt sofort der ganze Schutz weg. */
  function injuryFromConstraints(list, opts) {
    var arr = Array.isArray(list) ? list : [], hits = [], o = opts || {};
    var L = o.ladder || (typeof O.returnLadder === 'object' ? O.returnLadder : null);
    arr.forEach(function (c) {
      if (!c) return;
      var onLadder = c.status === 'improved' && c.returnStage != null && parseInt(c.returnStage, 10) < 5;
      if (c.status !== 'active' && !onLadder) return;
      var it = (c.intensity != null) ? parseInt(c.intensity, 10) : null;
      var aff = Array.isArray(c.affectedActivities) ? c.affectedActivities : [];
      var why = c.currentlyTrainable === false ? 'not_trainable'
        : (aff.indexOf('running') >= 0 ? 'affects_running'
        : (LOWER[c.bodyRegion] && it != null && it >= 7 ? 'lower_body_high'
        : (onLadder ? 'return_ladder' : null)));
      if (why) hits.push({ id: c.id || null, bodyRegion: c.bodyRegion || null, side: c.side || null, intensity: it, why: why, label: constraintLabel(c),
        stage: L ? L.stageOf(c) : null, policy: L ? L.policyFor(c) : null, noImpactSports: aff.filter(function (a) { return a === 'cycling' || a === 'swimming'; }) });
    });
    if (!hits.length) return { active: false, hits: [] };
    /* Fuehrend ist die Beschwerde mit der strengsten Policy (niedrigste Stufe), bei Gleichstand die hoechste Intensitaet */
    var lead = hits.slice().sort(function (a, b) { return ((a.stage == null ? 0 : a.stage) - (b.stage == null ? 0 : b.stage)) || ((b.intensity || 0) - (a.intensity || 0)); })[0];
    return { active: true, hits: hits, id: lead.id, label: lead.label, stage: lead.stage, policy: lead.policy, noImpactSports: lead.noImpactSports };
  }`);
rep(`  var api = { VERSION: VERSION, replan: replan, illnessFromHistory: illnessFromHistory, injuryFromConstraints: injuryFromConstraints };`,
    `  var api = { VERSION: VERSION, replan: replan, illnessFromHistory: illnessFromHistory, injuryFromConstraints: injuryFromConstraints, constraintLabel: constraintLabel };`);
fs.writeFileSync(f, s); console.log('ok', n);
