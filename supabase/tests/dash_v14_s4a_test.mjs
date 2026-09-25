/* ============================================================
   ORVIA · dash_v14_s4a — Tagesentscheidung (Prototyp v14 dashAdp) + Score-Sheet
   ------------------------------------------------------------
     A. gmDecisionCard: Kopf/Zustand, Heute, Vermeiden, Wahl je nach todayAction
     B. Wahl persistiert in entry.adaptChoice + Entscheidungs-Log (append-only)
     C. gmNextKeyUnit: naechster Kernreiz nur aus der Engine-Einstufung
     D. Verdrahtung: renderDay rendert #adaptBox, Legacy-Karte delegiert
     E. Score-Sheet: Basis-Zeile + „Was der Score NICHT ist" mit echten Schwellen
   node supabase/tests/dash_v14_s4a_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _ex } from 'node:fs';
import { tStub } from './_i18n-src.mjs';
const _APPREL = _ex(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const ui = rd('js/ui.js'); const de = rd('locales/de.js'); const css = rd('styles.css'); const calc = rd('js/calc.js');
const fn = name => { const m = ui.match(new RegExp('\\n(function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\})\\n')); if (!m) throw new Error('fn ' + name); return m[1]; };
const g = globalThis; g.window = g; g.ORVIA = {};
g._uiT = tStub().t;
g.icon = (n) => '<svg data-i="' + n + '"></svg>';
g.gmEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
g.gmLevel = () => 'f';
g.todayStr = () => '2026-09-23';   /* Mittwoch */
g.DB = {}; g.entry = k => (g.DB[k] = g.DB[k] || {});
g.save = () => { g._saved = (g._saved || 0) + 1; };
g.toast = () => {};
g.document = { getElementById: () => null };
g.STATE_LABELS = { GREEN: 'GRÜN', YELLOW: 'GELB', ORANGE: 'ORANGE', RED: 'ROT' };
g.DECISION_WORD = { GREEN: 'Trainieren', YELLOW: 'Reduzieren', ORANGE: 'Ersetzen', RED: 'Pausieren' };
g.weekAdjustmentsApplied = () => false;
g.gmPlanIsKeyUnit = it => !!(it && it.key);
g.activeWeekPlan = () => [[], [], [{ t: 'Laufen', l: 'Locker 40 min' }], [{ t: 'Laufen', l: 'Tempolauf 4×8', key: true }], [], [{ t: 'Laufen', l: 'Long Run', key: true }], []];
let DEC = null; g.getDecision = () => DEC; g.currentDecision = () => DEC;
(0, eval)(['gmNextKeyUnit', 'gmAdpChoice', 'gmAdpLog', 'gmAdpChoose', 'gmAdpReopen', 'gmAdpTime', 'gmDecisionCard', 'gmRenderDecisionCard'].map(fn).join('\n') +
  '\nglobalThis.gmNextKeyUnit=gmNextKeyUnit;globalThis.gmDecisionCard=gmDecisionCard;globalThis.gmAdpChoose=gmAdpChoose;globalThis.gmAdpReopen=gmAdpReopen;globalThis.gmRenderDecisionCard=gmRenderDecisionCard;');
const keep = { dayState: 'GREEN', todayAction: 'KEEP', score: 82, recommendedSession: { label: 'Tempolauf 4×8 min', detail: '@ 4:37 /km' }, avoidedSession: null, readinessReasons: ['Readiness 82, keine Warnzeichen'], safety: { triggered: false }, weekAdjustments: [] };
const change = { dayState: 'ORANGE', todayAction: 'REPLACE_WITH_RECOVERY', score: 48, recommendedSession: { label: 'Lockerer Lauf 30 min', detail: 'Zone 1–2' }, avoidedSession: { label: 'Tempolauf 4×8 min', detail: 'harter Reiz' }, readinessReasons: ['HRV deutlich unter Baseline'], safety: { triggered: true, advice: 'Knie 4/10 — keine Sprünge.' }, weekAdjustments: [{ action: 'MOVE_SESSION', day: 4, reason: 'Abstand' }] };

sec('A · Karte');
{
  const h = g.gmDecisionCard(keep);
  ok('A1 Kopf: Tagesentscheidung + Zustand GRÜN · Trainieren', /Tagesentscheidung/.test(h) && /adp-state-green/.test(h) && /GRÜN · Trainieren/.test(h));
  ok('A2 Heute: empfohlene Einheit + Detail + Grund', /<b>Tempolauf 4×8 min<\/b>/.test(h) && /@ 4:37 \/km — Readiness 82/.test(h));
  ok('A3 Vermeiden (KEEP): Standardtext + naechster Kernreiz Do', /Zusätzliche härtere Reize/.test(h) && /Kernreiz: Do · Tempolauf 4×8/.test(h));
  ok('A4 KEEP: „Wie geplant" + Check-in-Weg, KEIN Tauschen-Knopf', /gmAdpChoose\('planned'\)/.test(h) && /adaptFeelDifferent\(\)/.test(h) && !/Tauschen/.test(h) && !/gmAdpChoose\('accepted'\)/.test(h));
  ok('A5 Protokoll-Hinweis (KEEP)', /Entscheidungs-Log/.test(h));
  const h2 = g.gmDecisionCard(change);
  ok('A6 Aenderung: Uebernehmen + Nur als Hinweis + Vermeiden = vermiedene Einheit', /gmAdpChoose\('accepted'\)/.test(h2) && /gmAdpChoose\('original'\)/.test(h2) && /adp-muted">Tempolauf 4×8 min/.test(h2) && /adp-state-orange/.test(h2));
  ok('A7 Sicherheitshinweis sichtbar', /adp-caution">Knie 4\/10/.test(h2));
  ok('A8 Wochenverschiebung: Vorschlag + Knopf applyWeekAdjustments(true)', /Wochenplan-Vorschlag/.test(h2) && /Harte Einheit → Fr/.test(h2) && /applyWeekAdjustments\(true\)/.test(h2));
  g.weekAdjustmentsApplied = () => true;
  ok('A9 angewendet: Rueckgaengig statt Vorschlag', /revertWeekAdjustments\(\)/.test(g.gmDecisionCard(change)) && !/applyWeekAdjustments\(true\)/.test(g.gmDecisionCard(change)));
  g.weekAdjustmentsApplied = () => false;
  ok('A10 ohne Entscheidung ⇒ leer', g.gmDecisionCard(null) === '' && g.gmDecisionCard({}) === '');
  g.gmLevel = () => 'a';
  ok('A11 Stufe a: kein Kernreiz-Block (Vermeiden nur bei echter vermiedener Einheit)', !/Vermeiden/.test(g.gmDecisionCard(keep)) && /Vermeiden/.test(g.gmDecisionCard(change)));
  g.gmLevel = () => 'f';
}

sec('B · Wahl + Log');
{
  const logged = [];
  g.ORVIA.decisionLog = { logDecision: r => { logged.push(r); return { stored: true }; } };
  DEC = keep; g.DB = {}; g._saved = 0;
  g.gmAdpChoose('planned');
  const e = g.DB['2026-09-23'];
  ok('B1 persistiert in entry.adaptChoice {action:KEEP, choice:planned, at}', e && e.adaptChoice && e.adaptChoice.action === 'KEEP' && e.adaptChoice.choice === 'planned' && /^\d{4}-/.test(e.adaptChoice.at) && g._saved === 1);
  ok('B2 Entscheidungs-Log: user_override, adp:<tag>@<ts>, inputs/selected', logged.length === 1 && logged[0].decisionType === 'user_override' && /^adp:2026-09-23@/.test(logged[0].decisionId) && logged[0].inputs.todayAction === 'KEEP' && logged[0].selected.choice === 'planned' && logged[0].registry === g.ORVIA);
  const h = g.gmDecisionCard(keep);
  ok('B3 Erledigt-Zeile „Wie geplant bestätigt · hh:mm Uhr" + aendern', /Wie geplant bestätigt · \d{2}:\d{2} Uhr/.test(h) && /gmAdpReopen\(\)/.test(h) && !/adp-btns/.test(h));
  g.gmAdpReopen();
  ok('B4 aendern loescht die Wahl ⇒ Knoepfe wieder da', !g.DB['2026-09-23'].adaptChoice && /adp-btns/.test(g.gmDecisionCard(keep)));
  DEC = change; g.gmAdpChoose('original');
  ok('B5 „Nur als Hinweis" ⇒ Hinweis-Zeile, Plan bleibt', /Nur als Hinweis · Plan bleibt/.test(g.gmDecisionCard(change)) && logged[1].selected.choice === 'original');
  ok('B6 Wahl haengt an der Aktion: andere todayAction ⇒ keine gespeicherte Wahl', /adp-btns/.test(g.gmDecisionCard(keep)));
  g.ORVIA.decisionLog = { logDecision: () => { throw new Error('boom'); } };
  DEC = keep; g.DB = {};
  let threw = false; try { g.gmAdpChoose('planned'); } catch (_) { threw = true; }
  ok('B7 werfendes Log beruehrt die Wahl nicht (Beobachter, nie Beteiligter)', !threw && g.DB['2026-09-23'].adaptChoice.choice === 'planned');
  delete g.ORVIA.decisionLog;
}

sec('C · naechster Kernreiz');
{
  const nk = g.gmNextKeyUnit();
  ok('C1 heute Mi ⇒ Do · Tempolauf (Engine-Einstufung), gapDays 1', nk && nk.dayLbl === 'Do' && /Tempolauf/.test(nk.label) && nk.gapDays === 1);
  g.gmPlanIsKeyUnit = () => false;
  ok('C2 ohne Engine-Einstufung ⇒ null (keine Label-Heuristik)', g.gmNextKeyUnit() === null);
  g.gmPlanIsKeyUnit = it => !!(it && it.key);
  g.activeWeekPlan = () => [[], [], [], [], [], [], []];
  ok('C3 leere Woche ⇒ null', g.gmNextKeyUnit() === null);
  ok('C4 Karte ohne Kernreiz: kein Vermeiden-Block bei KEEP', !/Vermeiden/.test(g.gmDecisionCard(keep)));
}

sec('D · Verdrahtung');
{
  ok('D1 renderDay loescht #adaptBox nicht mehr, sondern rendert die GM-Karte', !/\['adaptBox','confBox','insights'\]/.test(ui) && /gmRenderDecisionCard\(\);\}catch\(_\)\{ \}\n/.test(ui.slice(ui.indexOf('function renderDay('), ui.indexOf('function renderDay(') + 4000)));
  const legacy = ui.slice(ui.indexOf('function renderAdaptCard(){'), ui.indexOf('function adaptChoose(choice){'));
  ok('D2 Legacy renderAdaptCard delegiert an gmRenderDecisionCard und rendert kein Legacy-Markup', /gmRenderDecisionCard\(\);return;/.test(legacy) && !/adapt-card adp-/.test(legacy));
  ok('D3 Automatikmodus bleibt: Auto-Uebernahme + applyWeekAdjustments(false)', /mode==='automatic'&&hasChange&&!ch/.test(legacy) && /applyWeekAdjustments\(false\)/.test(legacy));
  g.document = { getElementById: id => id === 'adaptBox' ? g._box = { style: {}, innerHTML: '' } : null };
  g.cur = '2026-09-23'; g.gmDashState = () => 'normal'; DEC = keep; g.DB = {};
  g.gmRenderDecisionCard();
  ok('D4 gmRenderDecisionCard: normal ⇒ Karte sichtbar', /gmAdp/.test(g._box.innerHTML) && g._box.style.display === '');
  g.gmDashState = () => 'error'; g.gmRenderDecisionCard();
  ok('D5 error ⇒ leer/versteckt', g._box.innerHTML === '' && g._box.style.display === 'none');
  g.gmDashState = () => 'normal'; DEC = null; g.gmRenderDecisionCard();
  ok('D6 ohne Entscheidung (vor Check-in) ⇒ leer', g._box.innerHTML === '');
  g.cur = '2026-09-20'; DEC = keep; g.gmRenderDecisionCard();
  ok('D7 vergangener Tag ⇒ leer', g._box.innerHTML === '');
  ok('D8 CSS: .card.adx-decision Knoepfe, Erledigt-Zeile, Hinweis', /\.card\.adx-decision \.adp-btns button\.pri\{/.test(css) && /\.card\.adx-decision \.adp-done\{/.test(css) && /\.card\.adx-decision \.adp-interf\{/.test(css));
  ok('D9 alle neuen Texte ueber T-Keys (de.js)', ['ui.tagesentscheidung', 'ui.adp_heute', 'ui.adp_avoid_default', 'ui.adp_next_key', 'ui.adp_wie_geplant', 'ui.adp_change_accept', 'ui.adp_hint_only', 'ui.adp_done_planned', 'ui.adp_done_accepted', 'ui.adp_done_hint', 'ui.adp_change', 'ui.adp_protocol_change', 'ui.adp_protocol_keep', 'ui.adp_woche'].every(k => de.indexOf("'" + k + "'") >= 0));
}

sec('E · Score-Sheet');
{
  const os = ui.slice(ui.indexOf('function openScore(){'), ui.indexOf('function openMetric(key){'));
  ok('E1 Basis-Zeile aus Konfidenz-VM (d.conf.levelLabel)', /_uiT\('ui\.score_basis',\{conf:\(d\.conf&&d\.conf\.levelLabel\)\|\|GM_NA\}\)/.test(os));
  ok('E2 Block „Was der Score NICHT ist" vor der Engine-Quellzeile', os.indexOf('ui.score_not_title') > 0 && os.indexOf('ui.score_not_title') < os.indexOf('ORVIA-Engine · Anzeige ohne Neuberechnung'));
  const body = (de.match(/'ui\.score_not_body': '([^']*)'/) || [])[1] || '';
  ok('E3 Text nennt die echten Schwellen 70/55/40 und Peak 85', /unter 70/.test(body) && /unter 55/.test(body) && /unter 40/.test(body) && /ab 85/.test(body));
  ok('E4 Schwellen stimmen mit calc.dayStateEngine ueberein', /readiness<40\)/.test(calc) && /readiness<55\)/.test(calc) && /readiness<70\)/.test(calc) && /score>=85/.test(calc));
  ok('E5 Basis-Text: 28 Tage + Konfidenz-Platzhalter', /28 Tagen/.test(de.match(/'ui\.score_basis': '([^']*)'/)[1]) && /\{conf\}/.test(de.match(/'ui\.score_basis': '([^']*)'/)[1]));
}

console.log('\n' + (fail ? '❌' : '✅') + ' dash_v14_s4a: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
