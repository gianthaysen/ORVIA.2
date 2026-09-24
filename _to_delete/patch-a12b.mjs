import fs from 'node:fs';
function patch(f, pairs) { let s = fs.readFileSync(f, 'utf8'); pairs.forEach(([a, b]) => { if (!s.includes(a)) throw new Error(f + ' anchor: ' + a.slice(0, 70)); s = s.replace(a, b); }); fs.writeFileSync(f, s); }
/* Revert: duenne Datenlage ist KEINE Warnung (Batch 2c/2d, „Datenluecke ≠ Wert") */
patch('app/js/engine/decision-engine-v2.js', [[
`      /* Gate A-12 (Shadow-Divergenz 2026-08-21): duenne Datenlage ist fuer sich ein Grund zur Vorsicht —
         v1 stand auf YELLOW, v2 auf GREEN. Zustand mindestens YELLOW; die Aktion wird nur bei harter
         Einheit begrenzt (eine lockere Einheit bleibt KEEP). */
      escalate('YELLOW');
      if (sessionIsHard(planned)) {
        limitAction('REDUCE_INTENSITY');`,
`      /* Gate A-12 (13.09.): BEWUSST kein YELLOW bei duenner Datenlage — Batch 2c/2d: eine Datenluecke
         ist keine Warnung, die Unsicherheit traegt das Feld confidence. Die Shadow-Divergenz vom 21.08.
         (v1 YELLOW, v2 GREEN, beide KEEP) wird im Auswerter als confidence-getragen eingestuft. */
      if (sessionIsHard(planned)) {
        escalate('YELLOW'); limitAction('REDUCE_INTENSITY');`],
[`      missing.push('load_history');
      escalate('YELLOW');   /* Gate A-12: ohne belastbare Lasthistorie kein GREEN */
      reasons.push(`,
 `      missing.push('load_history');
      reasons.push(`]]);
/* shadow-eval: state-only Divergenz, gleiche Aktion, v2 nur mit Info-Gruenden zur Datenqualitaet ⇒ nicht safety-relevant */
patch('app/js/engine/shadow-eval.js', [[
`    var laxerState = s2 < s1;
    var laxerAction = (a1 != null && a2 != null) ? a2 < a1 : false;
    if (laxerState || laxerAction) {`,
`    var laxerState = s2 < s1;
    var laxerAction = (a1 != null && a2 != null) ? a2 < a1 : false;
    /* v1.1 (A-12, 13.09.2026): v1 stufte fehlende/duenne Daten als YELLOW ein; v2 traegt dieselbe
       Unsicherheit bewusst im Feld confidence statt im Zustand (Batch 2c/2d: Datenluecke ≠ Warnung).
       Ist NUR der Zustand lockerer, die Aktion identisch und nennt v2 ausschliesslich Info-Gruende
       zur Datenqualitaet, ist das keine Sicherheitsluecke, sondern die vereinbarte Semantik. */
    if (laxerState && !laxerAction && a1 != null && a2 != null && a1 === a2) {
      var rs = Array.isArray(e.v2.reasons) ? e.v2.reasons : [];
      var onlyData = rs.length > 0 && rs.every(function (r) { return r && r.severity === 'info' && DATA_QUALITY_CODES.indexOf(r.code) >= 0; });
      if (onlyData) return { date: e.date || null, kind: 'v2_confidence_carried', safetyRelevant: false,
        v1: e.v1.state || null, v2: e.v2.state || null, v1Action: e.v1.action || null, v2Action: e.v2.action || null,
        v2reasons: rs.slice(0, 4), reason: 'v2_data_gap_in_confidence_not_state' };
    }
    if (laxerState || laxerAction) {`],
[`  function classifyDivergence(e) {`,
 `  var DATA_QUALITY_CODES = ['low_data_confidence', 'insufficient_chronic_history', 'missing_checkin'];
  function classifyDivergence(e) {`],
[`      if (d.safetyRelevant) permissive.push(d);
      else if (d.kind === 'unknown') unknown++;
      else conservative++;`,
 `      if (d.safetyRelevant) permissive.push(d);
      else if (d.kind === 'unknown') unknown++;
      else if (d.kind === 'v2_confidence_carried') explained++;
      else conservative++;`],
[`    var divs = [], permissive = [], conservative = 0, unknown = 0;`,
 `    var divs = [], permissive = [], conservative = 0, unknown = 0, explained = 0;`],
[`      { divergencesTotal: divs.length, conservativeDivergences: conservative,`,
 `      { divergencesTotal: divs.length, conservativeDivergences: conservative, confidenceCarriedDivergences: explained,`],
[`  var VERSION = 'shadow-eval-v1.0.0';`, `  var VERSION = 'shadow-eval-v1.1.0';`]]);
/* engine_v2_test: D2c/D2d zurueck auf die Batch-2c/2d-Semantik */
patch('supabase/tests/engine_v2_test.mjs', [[
`  ok('D2c duenne Lastdatenlage → mindestens YELLOW, lockere Einheit bleibt KEEP', dq.dayState === 'YELLOW' && dq.action === 'KEEP' && dq.reasons.some(r => r.code === 'low_data_confidence' || r.code === 'insufficient_chronic_history'));`,
`  ok('D2c duenne Lastdatenlage + lockere Einheit → GREEN/KEEP, Unsicherheit in confidence (Batch 2c/2d bleibt)', dq.dayState === 'GREEN' && dq.action === 'KEEP' && dq.confidence !== 'high' && dq.reasons.some(r => r.code === 'low_data_confidence' || r.code === 'insufficient_chronic_history'));`],
[`  ok('D2d fehlende Lasthistorie → YELLOW statt GREEN', dh.dayState === 'YELLOW');`,
 `  ok('D2d fehlende Lasthistorie → GREEN mit missingData load_history (keine erfundene Warnung)', dh.dayState === 'GREEN' && dh.missingData.indexOf('load_history') >= 0);`]]);
console.log('ok');
