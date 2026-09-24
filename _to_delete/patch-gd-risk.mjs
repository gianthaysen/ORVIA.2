import fs from 'node:fs';
let s = fs.readFileSync('app/js/goal-detail.js', 'utf8'); let n = 0;
function rep(a, b) { if (!s.includes(a)) throw new Error('anchor: ' + a.slice(0, 70)); s = s.replace(a, b); n++; }
rep(`    m.milestones = ms.map(function (x) { return { title: x.title || x.label || '', date: x.targetDate || null, status: x.status || 'planned', value: x.targetValue != null ? fmtGoalValue(x, x.targetValue) : null }; });`,
`    /* Stufe D: Meilensteine, deren Datum vor dem geschaetzten Ende der Rueckkehr-Leiter liegt, sind gefaehrdet (Anzeige, kein Statuswechsel) */
    var riskUntil = o.returnFreeDate || null;
    m.milestones = ms.map(function (x) { var st = x.status || 'planned', atRisk = !!(riskUntil && x.targetDate && st !== 'achieved' && x.targetDate <= riskUntil); return { title: x.title || x.label || '', date: x.targetDate || null, status: st, atRisk: atRisk, value: x.targetValue != null ? fmtGoalValue(x, x.targetValue) : null }; });`);
rep(`        return '<div class="gd-msrow' + cls + '"><div class="m-rail"><div class="m-dot">' + (x.status === 'achieved' ? ic('check', 'xs') : (x.status === 'in_progress' ? ic('target', 'xs') : '')) + '</div><div class="m-line"></div></div><div class="m-b"><div class="m-t">' + esc(x.title) + '</div><div class="m-d">' + esc(x.date ? (x.status === 'achieved' ? deDate(x.date) : T('gd.ms_planned', { d: deDate(x.date) })) : T('common.noDate')) + '</div>' + (x.value ? '<div class="m-v">' + esc(x.value) + '</div>' : '') + '</div></div>'; }).join('') + '</div></div>';`,
`        return '<div class="gd-msrow' + cls + (x.atRisk ? ' risk' : '') + '"><div class="m-rail"><div class="m-dot">' + (x.status === 'achieved' ? ic('check', 'xs') : (x.status === 'in_progress' ? ic('target', 'xs') : (x.atRisk ? ic('alert', 'xs') : ''))) + '</div><div class="m-line"></div></div><div class="m-b"><div class="m-t">' + esc(x.title) + '</div><div class="m-d">' + esc(x.date ? (x.status === 'achieved' ? deDate(x.date) : T('gd.ms_planned', { d: deDate(x.date) })) : T('common.noDate')) + (x.atRisk ? ' · <span class="m-risk">' + esc(T('gd.ms_at_risk')) + '</span>' : '') + '</div>' + (x.value ? '<div class="m-v">' + esc(x.value) + '</div>' : '') + '</div></div>'; }).join('') + '</div></div>';`);
rep(`    var m = buildModel({ goal: goal, planInput: pi, engine: eng, feasibility: feas, strength: str, catLabel: root.goalCatLabel || null, raceMatch: rm, isMain: isMain, today: today,`,
`    var returnFree = null;
    try { var AR = O.absenceReplanner, RL = O.returnLadder; if (AR && RL && root.PROFILE) { var inj = AR.injuryFromConstraints(root.PROFILE.constraintsList); if (inj && inj.active && inj.id) { var cc = (root.PROFILE.constraintsList || []).filter(function (x) { return x && x.id === inj.id; })[0]; if (cc) { var ev = RL.evaluate(cc, { today: today, painDays: typeof root.gmPlanLadderPainDays === 'function' ? root.gmPlanLadderPainDays(cc.bodyRegion) : [] }); returnFree = isoAdd(today, ev.estimatedDaysToFree); } } } } catch (e) { returnFree = null; }
    var m = buildModel({ goal: goal, planInput: pi, engine: eng, feasibility: feas, strength: str, catLabel: root.goalCatLabel || null, raceMatch: rm, isMain: isMain, today: today, returnFreeDate: returnFree,`);
fs.writeFileSync('app/js/goal-detail.js', s);
let c = fs.readFileSync('app/styles.css', 'utf8');
c += `.gd-msrow.risk .m-dot{border-color:var(--attention);background:var(--attention-t);color:var(--attention)}
.gd-msrow .m-risk{color:var(--attention);font-weight:700}
`;
fs.writeFileSync('app/styles.css', c);
console.log('ok', n);
