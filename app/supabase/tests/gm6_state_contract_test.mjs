/* ORVIA · GM6 — globale Zustände und systemweites Verhalten, Vertragstest.
   Referenz: orvia_dashboard_5_1.html (md5 1b93e15e23054318c8848d5cb10e6bcb),
             docs/gm-ref/gm6/gm6_gm_domspec.json (18 GM-Zustände × 2 Viewports),
             docs/gm-ref/gm6/gm6_ground_truth.md (Signal→Zustand-Zuordnung).

   Teil A  statische Quellverträge (js/ui.js, styles.css, index.html)
   Teil B  Verhaltensverträge im Harness /tmp/gm6h.html (Playwright)

   Der Harness speist ausschliesslich produktiv vorhandene Signale
   (orviaSyncState(), navigator.onLine, gmDashVM(), _gmStateOverride) und ruft
   die echten produktiven Renderer. Fixtures existieren NUR im Harness.

   Aufruf:  node /tmp/gm6_build.mjs && node supabase/tests/gm6_state_contract_test.mjs   */
import fs from 'fs';
/* Playwright liegt in dieser Umgebung ausserhalb des Repo-Baums; bare specifier
   zuerst, danach der bekannte globale Pfad. Kein Verhaltensunterschied. */
const _pw = await (async () => {
  try { return await import('playwright'); }
  catch (_) { return await import('/tmp/node_modules/playwright/index.js'); }
})();
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const R  = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 66 - t.length)));

const ui  = R('../../js/ui.js');
const css = R('../../styles.css');
const SPEC = JSON.parse(R('../../docs/gm-ref/gm6/gm6_gm_domspec.json'));

const GM1 = (() => { const a = ui.indexOf('/* ====== GM1:'), b = ui.indexOf('/* ====== GM1-ENDE'); return (a >= 0 && b > a) ? ui.slice(a, b) : ''; })();

/* ══════════════════════════════════════════════════════════════════════════
   TEIL A · statische Quellverträge
   ══════════════════════════════════════════════════════════════════════════ */
sec('A · Quellverträge (js/ui.js, styles.css)');

ok('Golden-Master-Domspec unverändert (md5 der Referenz)',
   SPEC.gm_md5 === '1b93e15e23054318c8848d5cb10e6bcb', SPEC.gm_md5);

/* A1 — keine sichtbaren Legacy-Zustandsrenderer mehr in der Quelle.
   Beide Blöcke sind heute bereits tot (Hoisting), sollen aber nicht als
   latenter Rückfallpfad in der Datei verbleiben (§3 „kein Legacy zurück"). */
ok('kein Legacy-Zustandsmarkup .occ mehr in js/ui.js',
   !/class="occ(\s|")/.test(ui), (ui.match(/class="occ(\s|")/g) || []).length + ' Treffer');
ok('kein Legacy-Check-in-Markup .cic- mehr in js/ui.js',
   !/class="cic-|"cic-b"|cic-pill/.test(ui), (ui.match(/cic-/g) || []).length + ' Treffer');

/* A1b — inventarisierte Legacy-Zustandsrenderer aus docs/gm-ref/gm6/gm6_ground_truth.md §6.1.
   Jede Stelle muss auf die GM-Komponenten (.sk / .empty / .errbar) umgestellt sein. */
const LEGACY = [
  ['<p class="note">Check-in-Modul nicht geladen', /class="note"[^>]*>\s*Check-in-Modul nicht geladen/],
  ['Legacy-Retry-Button .btn.sec „Erneut versuchen"', /class="btn sec"[^>]*>\s*Erneut versuchen/],
  ['<p class="muted">Diagramm-Modul nicht geladen', /class="muted"[^>]*>\s*Diagramm-Modul nicht geladen/],
  ['<p class="muted">Metrik-Modul nicht geladen', /class="muted"[^>]*>\s*Metrik-Modul nicht geladen/],
  ['_rcvError als .muted-Absatz', /_rcvError[\s\S]{0,120}class="muted"/],
  ['Legacy-Ladezeile „… werden geladen …" als .muted', /class="muted"[^>]*>[^<]*werden geladen/],
  /* GM6.1 §5: verschaerft von „Noch keine" auf „Noch kein" — der zuletzt
     verbliebene Legacy-Leerzustand war der Supplement-Absatz
     <p class="muted">Noch kein Stack angelegt…</p>. Er ist durch die
     GM-Empty-Komponente ersetzt; das Muster deckt jetzt beide Schreibweisen. */
  ['Legacy-Empty „Noch kein(e) …" als .muted-Absatz', /<p class="muted"[^>]*>\s*Noch kein/],
  ['Legacy-Fehlerzeile .mv-note statt GM-.errbar', /class="mv-note"[^>]*>[^<]*(nicht|Fehler|offline)/i]
];
LEGACY.forEach(([label, re]) => ok('Legacy-Zustandsrenderer ersetzt: ' + label, !re.test(ui),
  re.test(ui) ? (ui.match(new RegExp(re.source, 'g')) || []).length + ' Treffer' : ''));

ok('GM-Zustandskomponenten stehen systemweit zur Verfügung (gmStateLoading/Empty/Error)',
   /function gmStateLoading\s*\(/.test(ui) && /function gmStateEmpty\s*\(/.test(ui) && /function gmStateError\s*\(/.test(ui));

/* A2 — Zustandsableitung: Offline/Fehler wird VOR der noData-Prüfung bewertet. */
const dashState = (() => { const a = ui.indexOf('function gmDashState()'); return a < 0 ? '' : ui.slice(a, ui.indexOf('\nfunction ', a + 10)); })();
ok('gmDashState() existiert', dashState.length > 0);
ok('gmDashState() wertet navigator.onLine als produktives Offline-Signal aus',
   /navigator\s*\.\s*onLine/.test(dashState));
/* GM6.1 §2 — der Auftraggeber hat entschieden, dass „Hard-Error" und „Offline mit
   verwendbarem Cache" ZWEI getrennte Zustände sind. Die frühere GM6-Fassung prüfte
   genau einen gemeinsamen Fehlerzustand; diese Fassung ist strikt schärfer, nicht
   schwächer: sie fordert weiterhin, dass das Degradationssignal VOR den Datenzweigen
   entschieden wird, verlangt jetzt aber ZUSÄTZLICH die saubere Trennung. */
ok('gmDashState(): Degradationssignal wird VOR der noData-Prüfung entschieden',
   dashState.indexOf("return 'offline'") >= 0 &&
   dashState.indexOf("return 'error'") >= 0 &&
   dashState.indexOf("return 'offline'") < dashState.indexOf("return 'empty'") &&
   dashState.indexOf("return 'error'") < dashState.indexOf("return 'empty'"));
ok("gmDashState(): 'offline' entsteht NUR mit verwendbaren Daten (degraded && !noData)",
   /degraded\s*&&\s*!\s*noData\s*\)\s*return\s*'offline'/.test(dashState.replace(/\s+/g, ' ')));
ok("gmDashState(): Hard-Error ist der Zweig OHNE verwendbare Daten",
   /return 'offline';\s*if\s*\(\s*degraded\s*\)\s*return\s*'error'/.test(dashState.replace(/\s+/g, ' ')));
ok('gmDashState(): sync-Zustände local/pending gelten NICHT als Fehler',
   !/sync\s*===\s*'local'/.test(dashState) && !/sync\s*===\s*'pending'/.test(dashState));

/* A3 — Skeleton-Anzahl ist stufenabhängig (GM: repeat(level==='a'?2:4)). */
const loadMods = (() => { const a = ui.indexOf('function gmLoadingMods()'); return a < 0 ? '' : ui.slice(a, ui.indexOf('\nfunction ', a + 10)); })();
ok('gmLoadingMods() erzeugt stufenabhängig 2 bzw. 4 Skeleton-Kacheln',
   /gmLevel\(\)\s*===\s*'a'/.test(loadMods) && !/'\+k\+k\+k\+k\+'/.test(loadMods));

/* A4 — Retry ruft ausschliesslich bestehende, sichere Aktionen auf. */
const errHero = (() => { const a = ui.indexOf('function gmErrorHero()'); return a < 0 ? '' : ui.slice(a, ui.indexOf('\nfunction ', a + 10)); })();
ok('Retry-Button ruft nur den bestehenden Re-Render (renderDay) auf',
   /onclick="renderDay&&renderDay\(\)"/.test(errHero));
ok('Retry löst keine Engine-, Plan-, Persistenz- oder Löschaktion aus',
   !/(runEngine|recalc|rebuildPlan|saveDB|deleteD|orviaSchedulePush|persist)\s*\(/.test(errHero));
ok('Retry-Button ist fokussierbar und identifizierbar (id=gmRetryBtn)',
   /id="gmRetryBtn"/.test(errHero));

/* A5 — Empty ohne eduhint (der GM zeigt eduhint ausschliesslich im Normalzweig). */
const modsFn = (() => { const a = ui.indexOf('function renderModules()'); return a < 0 ? '' : ui.slice(a, ui.indexOf('\nfunction ', a + 10)); })();
ok("renderModules(): eduhint wird im Empty-Zweig nicht ausgegeben",
   /state\s*===\s*'empty'/.test(modsFn) &&
   !new RegExp("state\\s*===\\s*'empty'[\\s\\S]{0,200}?head\\s*\\+").test(modsFn));

/* A6 — Level-a-Check-in in GM-Struktur (.ci-simple in .card OHNE .tight). */
const ciFn = (() => { const a = ui.indexOf('function renderCheckinCompact()'); return a < 0 ? '' : ui.slice(a, ui.indexOf('\nfunction ', a + 10)); })();
ok('renderCheckinCompact(): GM-Stimmungsauswahl .ci-simple für Stufe a vorhanden',
   /ci-simple/.test(ciFn) && /class="mood'/.test(ciFn));
/* GM6.1 §4: die Auswahl traegt jetzt zusaetzlich den GM-Zustand .on. Der
   Sicherheitsnachweis wird dadurch nicht schwaecher, sondern praeziser: erlaubt
   ist ausschliesslich gotoCheckinForm() + gmSetMood() (beide rein visuell, beide
   unten einzeln geprueft). Jede Persistenz-, Engine- oder Schreibaktion bleibt
   verboten; das frueher pauschale Muster setMood\( haette gmSetMood( faelschlich
   miterfasst und wird deshalb praezise gegen den GM-Namen window.setMood
   abgegrenzt. */
ok('renderCheckinCompact(): Stimmungsauswahl ruft nur bestehende sichere Aktionen',
   !/ci-simple/.test(ciFn) || (/gotoCheckinForm\(\)/.test(ciFn) && /gmSetMood\(this\)/.test(ciFn) &&
     !/saveDB|runEngine|(^|[^m])\bsetMood\s*\(|fetch\(|supabase|localStorage/.test(ciFn.replace(/gmSetMood/g, 'GMSETMOOD'))));

/* GM6.1 §4 — Zustand .on stammt AUSSCHLIESSLICH aus dem kanonischen Check-in-Wert,
   es gibt keinen zweiten Zustandsspeicher. */
ok('renderCheckinCompact(): .on wird aus dem View-Model-Feld d.mood abgeleitet',
   /d\.mood\s*===\s*m\[2\]/.test(ciFn) && /\(on\?' on':''\)/.test(ciFn));
ok('renderCheckinCompact(): Bedienbarkeit per Tastatur (Enter und Space) ist verdrahtet',
   /onkeydown=/.test(ciFn) && /Enter/.test(ciFn) && /tabindex="0"/.test(ciFn) &&
   /role="button"/.test(ciFn) && /aria-pressed=/.test(ciFn));

const moodKeyFn = (() => { const a = ui.indexOf('function gmMoodKey('); return a < 0 ? '' : ui.slice(a, ui.indexOf('\nfunction ', a + 10)); })();
ok('gmMoodKey(): reine Projektion von morning.feel auf die GM-Schlüssel top/ok/tired',
   /'top'/.test(moodKeyFn) && /'ok'/.test(moodKeyFn) && /'tired'/.test(moodKeyFn) &&
   !/saveDB|runEngine|DB\[|localStorage|fetch\(/.test(moodKeyFn));
ok('gmMoodKey(): fehlender Wert ergibt null (kein Feld erhält .on) — unbekannt ist nicht „Geht so"',
   /return null/.test(moodKeyFn));

const setMoodFn = (() => { const a = ui.indexOf('function gmSetMood('); return a < 0 ? '' : ui.slice(a, ui.indexOf('\nfunction ', a + 10)); })();
ok('gmSetMood(): entspricht dem Golden Master (Geschwister entmarkieren, Ziel markieren)',
   /classList\.remove\('on'\)/.test(setMoodFn) && /classList\.add\('on'\)/.test(setMoodFn) &&
   /querySelectorAll\('\.mood'\)/.test(setMoodFn));
ok('gmSetMood(): rein visuell — keine Persistenz, keine Engine, kein zweiter Zustandsspeicher',
   !/saveDB|runEngine|DB\[|localStorage|fetch\(|supabase|\.feel\s*=/.test(setMoodFn));
/* Die Aktion wurde aus dem HTML-Attribut in eine benannte Funktion gehoben —
   deshalb wird sie hier zusaetzlich selbst auf Sicherheit geprueft (Verschaerfung,
   keine Abschwaechung: der Nachweis „nur aufklappen + scrollen" bleibt lueckenlos). */
const gcfFn = (() => { const a = ui.indexOf('function gotoCheckinForm()'); return a < 0 ? '' : ui.slice(a, ui.indexOf('\n', a)); })();
ok('gotoCheckinForm(): nur expandCheckinCard() + scrollIntoView, keine Persistenz/Engine',
   /expandCheckinCard\(\)/.test(gcfFn) && /scrollIntoView/.test(gcfFn) &&
   !/saveDB|runEngine|setMood\s*\(|fetch\(|supabase|localStorage/.test(gcfFn));

/* A7 — Reduced Motion für Skeletons (GM-Lücke R1, bewusst geschlossen). */
const rmBlocks = (() => {
  const out = []; const s = css; let i = 0;
  while ((i = s.indexOf('prefers-reduced-motion', i)) >= 0) {
    const o = s.indexOf('{', i); if (o < 0) break;
    let d = 0, j = o;
    for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { d--; if (!d) break; } }
    out.push(s.slice(o, j + 1)); i = j + 1;
  }
  return out.join('\n');
})();
ok('styles.css: .sk-Shimmer wird bei prefers-reduced-motion abgeschaltet',
   /(^|[,{\s])\.sk\b[^{}]*\{[^}]*animation\s*:\s*none/.test(rmBlocks.replace(/\s+/g, ' ')));

/* A8 — keine neuen Demo-Daten, keine neue Fachlogik im GM1-Block. */
ok('keine Demo-Hardcodes im GM1-Block (07:14 / 9:41 / feste Beispielwerte)',
   !/07:14|9:41|vívoactive/.test(GM1));
ok('keine neue fachliche Bewertung im UI (kein Score-/ACWR-Nachrechnen)',
   !/function\s+gm(Calc|Score|Acwr|Recalc)/.test(GM1));

/* ══════════════════════════════════════════════════════════════════════════
   TEIL B · Verhaltensverträge im Harness
   ══════════════════════════════════════════════════════════════════════════ */
const HARNESS = '/tmp/gm6h.html';
if (!fs.existsSync(HARNESS)) { console.log('\n❌ Harness fehlt: ' + HARNESS + ' (node /tmp/gm6_build.mjs)'); process.exit(1); }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const consoleErrs = [];
const page = await b.newPage({ viewportSize: { width: 430, height: 900 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
page.on('pageerror', e => consoleErrs.push('PAGEERROR ' + String(e)));
await page.goto('file://' + HARNESS);
await page.waitForTimeout(200);

const MODEOF = { a: 'anfaenger', f: 'fortgeschritten', p: 'profi' };
const setState = (s, lvl) => page.evaluate(`(${((n, m) => window.setState(n, m)).toString()})(${JSON.stringify(s)},${JSON.stringify(MODEOF[lvl])})`);
const ev = fn => page.evaluate(`(${fn.toString()})()`);
const evA = (fn, arg) => page.evaluate(`(${fn.toString()})(${JSON.stringify(arg)})`);

/* Sichtbare Top-Level-Sequenz — identische Regel wie tools/gm1_parity.mjs. */
const SEQFN = () => {
  const scr = document.querySelector('#prodScreen'); const kids = [];
  const push = el => {
    if (el.id === 'tab-heute' || el.id === 'command' || el.id === 'modules') { [...el.children].forEach(push); return; }
    const r = el.getBoundingClientRect();
    if (r.height <= 1 || getComputedStyle(el).display === 'none') return;
    kids.push(el);
  };
  [...scr.children].forEach(push);
  return kids.map(el => [...el.classList].join(' '));
};
const DROP = new Set(['ci-compact', 'ci-full', 'ci-collapsed', 'v3date']);
const normCls = c => String(c || '').split(/\s+/).filter(x => x && !DROP.has(x)).join('.');
const normSeq = arr => arr.map(normCls).filter(c => c && !/^(statusbar|lvlbadge|demobar)/.test(c));
const gmSeq = (vp, lvl, scen) => normSeq(SPEC.viewports[vp][lvl + '/' + scen].top.map(n => n.c || n.t));
const prodSeq = async () => normSeq(await ev(SEQFN));

/* Klassenzähler — dieselben Klassen wie im Domspec. */
const COUNTFN = () => {
  const keys = ['sk', 'empty', 'e-ic', 'et', 'ed', 'eb', 'gapnote', 'errbar', 'placeholder', 'hero',
    'card', 'kgrid', 'kcard', 'sectlabel', 'addmod', 'ring-wrap', 'cta', 'wide-ghost', 'eduhint', 'ci-simple', 'mood'];
  const o = {}; const root = document.getElementById('tab-heute');
  keys.forEach(k => { o[k] = root.querySelectorAll('.' + k).length; });
  return o;
};

/* Zustand → GM-Domspec-Szenario (nur strukturgleiche Zuordnung). */
/* GM6.1 §2: „offline mit Cache" hat KEIN einzelnes GM-Szenario mehr als Vorlage —
   der Golden Master kennt diesen Zustand nicht. Die Erwartung wird deshalb in B1c
   AUS DEM GM ABGELEITET (Fehler-Kopf + Normal-Rumpf), statt hier auf ein
   unpassendes Szenario abgebildet zu werden. null = „nicht über die naive
   1:1-Zuordnung prüfbar"; die Zustände bleiben in B3/B13/B14/B15 vollständig
   enthalten und werden in B1c/B2c strenger geprüft als vorher. */
/* Alle vier Zustaende dieser Liste tragen das 'base'-Fixture, besitzen also
   verwendbare Daten. 'error' gehoert dazu: ein Sync-Fehlerobjekt bei vorhandenem
   Cache ist nach §2 KEIN Hard-Error. Hard-Error sind ausschliesslich die beiden
   *_nodata-Zustaende. */
const OFFLINE_CACHE = ['offline_cache', 'offline_cache_nav', 'offline_cache_sync', 'error'];
const HARD_ERROR = ['offline_nodata', 'error_nodata'];
const TOGM = {
  loading: 'loading', empty: 'empty',
  offline_cache: null, offline_cache_nav: null, offline_cache_sync: null,
  offline_nodata: 'error', error: null, error_nodata: 'error',
  good: 'good', attention: 'attention', crit: 'crit',
  partial: 'good', ciopen: null, local_only: 'good', pending: 'good'
};

/* ── B1 · DOM-Reihenfolge je Zustand gegen den Golden Master ─────────────── */
sec('B1 · GM-DOM-Reihenfolge je Zustand (430 px)');
for (const st of Object.keys(TOGM)) {
  const scen = TOGM[st]; if (!scen) continue;
  for (const lvl of ['a', 'f', 'p']) {
    await setState(st, lvl);
    const p = await prodSeq(), g = gmSeq('430', lvl, scen);
    ok(`${st}/${lvl}: Sequenz identisch zum GM-Zustand „${scen}"`,
       JSON.stringify(p) === JSON.stringify(g),
       JSON.stringify(p) === JSON.stringify(g) ? '' : 'GM ' + JSON.stringify(g) + '\n            PROD ' + JSON.stringify(p));
  }
}

sec('B1b · GM-DOM-Reihenfolge je Zustand (390 px)');
await page.setViewportSize({ width: 390, height: 900 });
for (const st of ['loading', 'empty', 'offline_nodata', 'partial', 'good']) {
  const scen = TOGM[st];
  for (const lvl of ['a', 'f', 'p']) {
    await setState(st, lvl);
    const p = await prodSeq(), g = gmSeq('390', lvl, scen);
    ok(`390 ${st}/${lvl}: Sequenz identisch zum GM-Zustand „${scen}"`,
       JSON.stringify(p) === JSON.stringify(g),
       JSON.stringify(p) === JSON.stringify(g) ? '' : 'GM ' + JSON.stringify(g) + '\n            PROD ' + JSON.stringify(p));
  }
}
await page.setViewportSize({ width: 430, height: 900 });

/* ── B1c · GM6.1 §2: abgeleitete GM-Sequenz für „offline mit Cache" ─────────
   Kein neuer Referenzzustand, keine Maske, keine Erfindung: die Erwartung ist
   die WÖRTLICHE Verkettung zweier vorhandener Golden-Master-Sequenzen —
   der GM-Fehlerkopf BIS EINSCHLIESSLICH .errbar, danach der KOMPLETTE
   GM-Normalzustand ab seinem Hero. Genau das fordert §2: „behält die vorhandenen
   Module und Werte sichtbar, zeigt ZUSÄTZLICH den Offline-Hinweis" — additiv,
   nicht ersetzend. Der reduzierte Fehler-Hero des GM bleibt damit ausschliesslich
   dem Hard-Error vorbehalten. */
sec('B1c · Offline mit Cache = GM-Offline-Hinweis + vollständiger GM-Normalzustand');
const offSeq = (vp, lvl) => {
  const e = gmSeq(vp, lvl, 'error'), g = gmSeq(vp, lvl, 'good');
  const eb = e.indexOf('errbar'), gh = g.findIndex(c => /^hero/.test(c));
  if (eb < 0 || gh < 0) throw new Error('GM-Domspec: errbar/hero nicht gefunden (' + vp + '/' + lvl + ')');
  return e.slice(0, eb + 1).concat(g.slice(gh));
};
for (const vp of ['430', '390']) {
  await page.setViewportSize({ width: Number(vp), height: 900 });
  for (const st of OFFLINE_CACHE) {
    for (const lvl of ['a', 'f', 'p']) {
      await setState(st, lvl);
      const p = await prodSeq(), g = offSeq(vp, lvl);
      ok(`${vp} ${st}/${lvl}: GM-Fehlerkopf + vollständiger GM-Normalrumpf`,
         JSON.stringify(p) === JSON.stringify(g),
         JSON.stringify(p) === JSON.stringify(g) ? '' : 'ERW ' + JSON.stringify(g) + '\n            PROD ' + JSON.stringify(p));
    }
  }
}
await page.setViewportSize({ width: 430, height: 900 });

/* ── B2 · exakte Klassen und Slotanzahlen ───────────────────────────────── */
sec('B2 · Klassen- und Slotanzahlen');
for (const lvl of ['a', 'f', 'p']) {
  await setState('loading', lvl);
  const c = await ev(COUNTFN);
  const g = SPEC.viewports['430'][lvl + '/loading'].classCounts;
  ok(`loading/${lvl}: Skeleton-Anzahl exakt wie GM (${g.sk})`, c.sk === g.sk, 'prod ' + c.sk);
  ok(`loading/${lvl}: kcard-Anzahl exakt wie GM (${g.kcard})`, c.kcard === g.kcard, 'prod ' + c.kcard);
  ok(`loading/${lvl}: keine Empty-/Error-Komponente sichtbar`, c.empty === 0 && c.errbar === 0 && c.gapnote === 0);
}
for (const lvl of ['a', 'f', 'p']) {
  await setState('empty', lvl);
  const c = await ev(COUNTFN);
  const g = SPEC.viewports['430'][lvl + '/empty'].classCounts;
  ok(`empty/${lvl}: empty/e-ic/et/ed/eb exakt wie GM`,
     c.empty === g.empty && c['e-ic'] === g['e-ic'] && c.et === g.et && c.ed === g.ed && c.eb === g.eb,
     `prod ${c.empty}/${c['e-ic']}/${c.et}/${c.ed}/${c.eb} · GM ${g.empty}/${g['e-ic']}/${g.et}/${g.ed}/${g.eb}`);
  ok(`empty/${lvl}: genau eine gapnote wie GM`, c.gapnote === g.gapnote, 'prod ' + c.gapnote);
  ok(`empty/${lvl}: kein eduhint (GM zeigt eduhint nur im Normalzweig)`, c.eduhint === 0, 'prod ' + c.eduhint);
  ok(`empty/${lvl}: keine Skeletons`, c.sk === 0);
}
/* Hard-Error (kein verwendbarer Cache): exakt die reduzierte GM-errorView. */
for (const st of HARD_ERROR) {
  for (const lvl of ['a', 'f', 'p']) {
    await setState(st, lvl);
    const c = await ev(COUNTFN);
    const g = SPEC.viewports['430'][lvl + '/error'].classCounts;
    ok(`${st}/${lvl}: errbar + hero + Retry-CTA exakt wie GM`,
       c.errbar === g.errbar && c.hero === g.hero && c['ring-wrap'] === g['ring-wrap'] && c.cta === g.cta && c['wide-ghost'] === g['wide-ghost'],
       `prod errbar${c.errbar}/hero${c.hero}/ring${c['ring-wrap']}/cta${c.cta}/ghost${c['wide-ghost']}`);
    ok(`${st}/${lvl}: nach dem Hero folgt nichts (GM-Errorview endet dort)`,
       c.sectlabel === 0 && c.addmod === 0 && c.kgrid === 0, `sectlabel${c.sectlabel}/addmod${c.addmod}/kgrid${c.kgrid}`);
  }
}

/* ── B2c · GM6.1 §2: Offline mit Cache behält den kompletten Modulrumpf ──── */
sec('B2c · Offline mit Cache: Hinweis + vollständige Module');
for (const st of OFFLINE_CACHE) {
  for (const lvl of ['a', 'f', 'p']) {
    await setState(st, lvl);
    const c = await ev(COUNTFN);
    const ge = SPEC.viewports['430'][lvl + '/error'].classCounts;
    const gg = SPEC.viewports['430'][lvl + '/good'].classCounts;
    /* §2 additiv: GENAU der eine GM-.errbar aus dem Fehlerzustand kommt hinzu —
       alles Übrige (Hero, Ring, CTA) bleibt exakt der GM-Normalzustand. Ein
       zusätzlicher Retry-Button wäre eine Erfindung ohne GM-Entsprechung und ist
       deshalb ausgeschlossen (cta/wide-ghost = GM-Normalzustand). */
    ok(`${st}/${lvl}: genau ein GM-Offline-Hinweis, Hero/Ring/CTA unverändert wie im GM-Normalzustand`,
       c.errbar === ge.errbar && c.hero === gg.hero && c['ring-wrap'] === gg['ring-wrap'] &&
       c.cta === gg.cta && c['wide-ghost'] === gg['wide-ghost'],
       `prod errbar${c.errbar}/hero${c.hero}/ring${c['ring-wrap']}/cta${c.cta}/ghost${c['wide-ghost']}` +
       ` · GM errbar${ge.errbar}/hero${gg.hero}/ring${gg['ring-wrap']}/cta${gg.cta}/ghost${gg['wide-ghost']}`);
    ok(`${st}/${lvl}: Modulrumpf bleibt vollständig (kgrid/sectlabel/addmod wie GM-Normalzustand)`,
       c.kgrid === gg.kgrid && c.sectlabel === gg.sectlabel && c.addmod === gg.addmod,
       `prod kgrid${c.kgrid}/sectlabel${c.sectlabel}/addmod${c.addmod} · GM ${gg.kgrid}/${gg.sectlabel}/${gg.addmod}`);
    ok(`${st}/${lvl}: Check-in bleibt erhalten (wird nicht entfernt)`,
       await ev(() => { const x = document.getElementById('checkinCompact'); return !!x && getComputedStyle(x).display !== 'none'; }));
  }
}

/* Level-a-Check-in: GM rendert .card > .ci-simple (ohne .tight) bei offenem Check-in. */
sec('B2b · Level-a-Check-in (GM-Struktur .ci-simple)');
for (const st of ['ciopen', 'empty']) {
  await setState(st, 'a');
  const r = await ev(() => {
    const box = document.getElementById('checkinCompact');
    return { cls: box ? box.className : null, simple: box ? box.querySelectorAll('.ci-simple').length : -1,
             moods: box ? box.querySelectorAll('.mood').length : -1, q: box ? box.querySelectorAll('.q').length : -1 };
  });
  ok(`${st}/a: Check-in als .card > .ci-simple (GM), nicht .card.tight`,
     r.simple === 1 && !/\btight\b/.test(r.cls || ''), JSON.stringify(r));
  ok(`${st}/a: genau drei .mood-Optionen wie im GM`, r.moods === 3, 'prod ' + r.moods);
}
await setState('good', 'a');
const ciDoneA = await ev(() => { const b2 = document.getElementById('checkinCompact'); return { cls: b2.className, simple: b2.querySelectorAll('.ci-simple').length }; });
ok('good/a: erledigter Check-in bleibt .card.tight (GM)', /\btight\b/.test(ciDoneA.cls) && ciDoneA.simple === 0, JSON.stringify(ciDoneA));

/* ── B3 · Fakten und Zustände in A/F/P identisch ────────────────────────── */
sec('B3 · Zustandswahrheit über alle Erklärtiefen identisch');
for (const st of Object.keys(TOGM)) {
  const vals = [];
  for (const lvl of ['a', 'f', 'p']) {
    await setState(st, lvl);
    vals.push(await ev(() => ({
      state: (window._gmStateOverride || gmDashState()),
      score: (document.querySelector('#command .ring-c .big') || {}).textContent || null,
      sync: window.orviaSyncState()
    })));
  }
  const same = vals.every(v => v.state === vals[0].state && v.score === vals[0].score);
  ok(`${st}: Zustand + Score über a/f/p identisch`, same, JSON.stringify(vals));
}

/* ── B4 · Missingness niemals als 0 ─────────────────────────────────────── */
sec('B4 · Missingness wird nie als 0 dargestellt');
for (const st of ['partial', 'empty']) {
  for (const lvl of ['a', 'f', 'p']) {
    await setState(st, lvl);
    const bad = await ev(() => {
      const sel = '.kv,.dn,.sc-big,.bv,.sc-v,.mv,.kbig,.big';
      const out = [];
      document.querySelectorAll('#tab-heute ' + sel).forEach(e => {
        const t = (e.textContent || '').trim();
        if (t === '0' || t === '0 %' || t === '0%') out.push((e.className || e.tagName) + ':' + t);
      });
      return out;
    });
    ok(`${st}/${lvl}: kein fehlender Wert als „0" gerendert`, bad.length === 0, bad.join(' | '));
  }
}
await setState('partial', 'f');
const naCount = await ev(() => {
  let n = 0; document.querySelectorAll('#tab-heute .kv,#tab-heute .dn,#tab-heute .sc-big,#tab-heute .bv,#tab-heute .sc-v')
    .forEach(e => { const t = (e.textContent || '').trim(); if (t === '—' || /Noch nicht verf/.test(t)) n++; });
  return n;
});
ok('partial/f: fehlende Einzelwerte erscheinen als GM-Missingness (—)', naCount > 0, 'Treffer ' + naCount);

/* ── B5 · Partial hält vorhandene Module sichtbar ───────────────────────── */
sec('B5 · Partial-Zustand behält die Seitenstruktur');
for (const lvl of ['a', 'f', 'p']) {
  await setState('good', lvl); const full = await prodSeq();
  await setState('partial', lvl); const part = await prodSeq();
  ok(`partial/${lvl}: Modulplätze bleiben vollständig erhalten`,
     JSON.stringify(full) === JSON.stringify(part),
     JSON.stringify(full) === JSON.stringify(part) ? '' : 'good ' + full.length + ' vs partial ' + part.length);
}

/* ── B6 · Offline mit Cache bleibt sichtbar, alle drei Signalquellen ────── */
sec('B6 · Degradationssignal MIT verwendbarem Cache → Zustand \'offline\' (kein Hard-Error)');
for (const st of OFFLINE_CACHE) {
  await setState(st, 'f');
  const r = await ev(() => ({
    state: gmDashState(),
    errbar: document.querySelectorAll('#command .errbar').length,
    score: (document.querySelector('#command .ring-c .big') || {}).textContent,
    unit: (document.querySelector('#command .ring-c .u') || {}).textContent,
    dim: (() => { const w = document.querySelector('#command .ring-wrap'); return w ? getComputedStyle(w).opacity : null; })()
  }));
  /* GM6.1 §2: getrennte Zustände. Alle vier Einträge dieser Schleife tragen das
     'base'-Fixture, besitzen also verwendbare Daten — unabhängig davon, ob das
     Degradationssignal aus navigator.onLine oder aus orviaSyncState() stammt.
     Sie MÜSSEN deshalb 'offline' liefern und dürfen NIE auf den Hard-Error-
     Renderer fallen. Die echten Hard-Errors sind offline_nodata/error_nodata
     und werden direkt darunter bzw. in B2 geprüft. */
  ok(`${st}: gmDashState() liefert 'offline' (Degradation MIT Cache), nicht 'error'`,
     r.state === 'offline', JSON.stringify(r));
  ok(`${st}: zwischengespeicherter Wert bleibt sichtbar (kein erfundener Wert)`, r.score === '82', 'score ' + r.score);
  /* GM6.1 §2: der ehrliche Veraltet-Hinweis ist der GM-.errbar („Offline —
     zwischengespeicherter Stand."). Der Hero selbst bleibt der unveränderte
     Normal-Hero: Ring NICHT gedimmt, Einheit NICHT ersetzt. Genau das ist der
     Unterschied zum Hard-Error, dessen gedimmter Ring + „ZULETZT" direkt darunter
     geprüft werden — die Prüfung ist also verschoben, nicht entfallen. */
  ok(`${st}: genau ein GM-konformer Offline-Hinweis (.errbar) zusätzlich`, r.errbar === 1, 'errbar ' + r.errbar);
  ok(`${st}: Hero bleibt der unveränderte Normal-Hero (kein Hard-Error-Ersatz)`,
     r.dim === '1' && !/ZULETZT/.test(r.unit || ''), r.dim + ' / ' + r.unit);
}
/* Hard-Error: hier — und nur hier — gilt der reduzierte GM-Ersatz-Hero. */
for (const st of HARD_ERROR) {
  await setState(st, 'f');
  const noCache = await ev(() => ({
    state: gmDashState(),
    score: (document.querySelector('#command .ring-c .big') || {}).textContent,
    unit: (document.querySelector('#command .ring-c .u') || {}).textContent,
    dim: (() => { const w = document.querySelector('#command .ring-wrap'); return w ? getComputedStyle(w).opacity : null; })(),
    errbar: document.querySelectorAll('#command .errbar').length
  }));
  ok(`${st}: ehrlicher Hard-Error ohne erfundenen Wert (— statt 0)`,
     noCache.state === 'error' && noCache.score === '—' && noCache.errbar === 1, JSON.stringify(noCache));
  ok(`${st}: Ring gedimmt + Einheit „ZULETZT" wie im GM-errorView`,
     noCache.dim === '0.55' && /ZULETZT/.test(noCache.unit || ''), noCache.dim + ' / ' + noCache.unit);
}

sec('B6b · Negativkontrolle: local/pending sind kein Fehlerzustand');
for (const st of ['local_only', 'pending']) {
  await setState(st, 'f');
  const s = await ev(() => gmDashState());
  ok(`${st}: bleibt 'normal' (kein Fehler-Fehlalarm)`, s === 'normal', s);
}

/* ── B6c · GM6.1 §2 · Direktnachweise der Zustandstrennung ──────────────── */
/* Der Auftraggeber verlangt vier explizite Nachweise:
     (1) Offline+Cache und Hard-Error erzeugen UNTERSCHIEDLICHE DOM-Signaturen.
     (2) Offline+Cache enthaelt die zuvor vorhandenen Fixture-Werte
         BYTE-IDENTISCH; der Hard-Error enthaelt diese Werte NICHT.
     (3) online → offline → online verliert keine Cache-Inhalte.
     (4) Es erfolgt kein Engine-, Store- oder Resolver-Aufruf zur Neuberechnung.
   „Wert" ist hier jeder sichtbare Blatt-Textknoten, der mindestens eine Ziffer
   enthaelt — das ist genau die Menge, die bei falschem Fallback auf den
   Hard-Error-Renderer verloren ginge oder durch 0 ersetzt wuerde. */
sec('B6c · §2-Direktnachweise: Signatur, Byte-Identität, Transition, keine Neuberechnung');

/* Bewusst NUR die Datenregion (#command + #modules). Die Kopfzeile (#tab-heute
   > .hdr) traegt das Tagesdatum und ist in JEDEM Zustand identisch — sie waere
   ein falsch positiver „Leak" im Hard-Error-Nachweis und ist keine Cache-Groesse. */
const VALFN = () => {
  const roots = [document.getElementById('command'), document.getElementById('modules')].filter(Boolean);
  const out = [];
  for (const root of roots) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue.trim();
    if (!t || !/\d/.test(t)) continue;
    const el = n.parentElement;
    if (!el || el.getBoundingClientRect().height <= 1) continue;
    out.push(t);
  }
  }
  return out;
};
const SIGFN = () => {
  const root = document.getElementById('tab-heute');
  return [...root.querySelectorAll('*')]
    .filter(e => e.getBoundingClientRect().height > 1 && getComputedStyle(e).display !== 'none')
    .map(e => e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].join('.') : ''))
    .join('|');
};
/* Multimengen-Enthaltensein: jeder Wert aus a muss byte-identisch (inkl.
   Vielfachheit) in b vorkommen. Kein Trimmen, kein Normalisieren. */
const contains = (a, b) => {
  const bag = new Map(); b.forEach(v => bag.set(v, (bag.get(v) || 0) + 1));
  const miss = [];
  a.forEach(v => { const c = bag.get(v) || 0; if (c > 0) bag.set(v, c - 1); else miss.push(v); });
  return miss;
};

for (const lvl of ['a', 'f', 'p']) {
  await setState('good', lvl);
  await ev(() => window.__gm6.resetCalls());
  const onVals = await ev(VALFN), onSig = await ev(SIGFN);

  /* NUR das Signal wechseln — dieselbe Fixture, kein neuer Datenweg. */
  await ev(() => window.setSignals(null, false));
  const offVals = await ev(VALFN), offSig = await ev(SIGFN);
  const offState = await ev(() => gmDashState());
  const callsAfterOff = await ev(() => window.__gm6.calls);

  await setState('offline_nodata', lvl);
  const hardVals = await ev(VALFN), hardSig = await ev(SIGFN);
  const hardState = await ev(() => gmDashState());

  ok(`§2/${lvl}: Offline+Cache ('${offState}') und Hard-Error ('${hardState}') haben unterschiedliche DOM-Signaturen`,
     offState === 'offline' && hardState === 'error' && offSig !== hardSig,
     offSig === hardSig ? 'IDENTISCHE Signatur — Fallback auf den Hard-Error-Renderer' : '');

  const missing = contains(onVals, offVals);
  ok(`§2/${lvl}: Offline+Cache enthält alle ${onVals.length} zuvor vorhandenen Werte byte-identisch`,
     missing.length === 0, missing.length ? 'fehlen: ' + JSON.stringify(missing.slice(0, 8)) : '');

  /* Der Hard-Error darf die Cache-Werte NICHT zeigen. Geprueft wird an den
     wertetragenden Zeichenketten des Normalzustands, die im Leer-Fixture
     nachweislich nicht existieren (Score, Modulwerte). */
  const leaked = onVals.filter(v => v.length >= 2 && hardVals.includes(v));
  ok(`§2/${lvl}: Hard-Error zeigt KEINE der Cache-Werte (keine alten, keine erfundenen)`,
     leaked.length === 0, leaked.length ? 'geleakt: ' + JSON.stringify(leaked.slice(0, 8)) : '');

  ok(`§2/${lvl}: Übergang online→offline löst keinen Engine-, Store- oder Resolver-Aufruf aus`,
     callsAfterOff.engine === 0 && callsAfterOff.persist === 0 && callsAfterOff.score === 0 &&
     callsAfterOff.schedulePush === 0 && callsAfterOff.flushSync === 0 && callsAfterOff.syncStart === 0,
     JSON.stringify(callsAfterOff));

  /* (3) vollstaendiger Zyklus online → offline → online auf DERSELBEN Fixture. */
  await setState('good', lvl);
  const c1 = await ev(VALFN);
  await ev(() => window.setSignals(null, false));
  await ev(() => window.setSignals(null, true));
  const c2 = await ev(VALFN), sig2 = await ev(SIGFN);
  ok(`§2/${lvl}: online → offline → online verliert keinen Cache-Inhalt (Werte identisch)`,
     JSON.stringify(c1) === JSON.stringify(c2), c1.length + ' → ' + c2.length);
  ok(`§2/${lvl}: online → offline → online kehrt exakt in die Ausgangs-Signatur zurück`,
     sig2 === onSig, sig2 === onSig ? '' : 'Signatur weicht ab');
}

/* ── B7 · Retry löst genau einen bestehenden Aufruf aus ─────────────────── */
sec('B7 · Retry-Vertrag');
/* GM6.1 §2: der Retry-Button gehoert ausschliesslich zum Hard-Error — nur dort
   existiert der GM-Ersatz-Hero mit #gmRetryBtn. Im Zustand 'offline' (Cache
   vorhanden) waere ein zusaetzlicher Button eine Erfindung ohne GM-Entsprechung;
   die Rueckkehr erfolgt dort automatisch. Der Vertrag ist damit verschoben, nicht
   entfallen — und B7b prueft ausdruecklich, dass 'offline' KEINEN Button zeigt. */
await setState('error_nodata', 'f');
await ev(() => window.__gm6.resetCalls());
const retryPresent = await ev(() => !!document.getElementById('gmRetryBtn'));
ok('Retry-Button existiert im Fehlerzustand', retryPresent);
if (retryPresent) {
  await page.click('#gmRetryBtn');
  await page.waitForTimeout(80);
  const c = await ev(() => window.__gm6.calls);
  ok('Retry ruft genau einmal den bestehenden Re-Render auf', c.renderDay === 1, JSON.stringify(c));
  ok('Retry erzeugt keinen Engine-, Persistenz- oder Push-Aufruf',
     c.engine === 0 && c.persist === 0 && c.schedulePush === 0 && c.flushSync === 0 && c.showGate === 0, JSON.stringify(c));
}
await setState('good', 'f');
const noGhostBtn = await ev(() => document.querySelectorAll('#tab-heute button,#tab-heute .cta').length >= 0 &&
  [...document.querySelectorAll('#tab-heute button')].filter(x => /Erneut versuchen/.test(x.textContent) && !x.onclick).length);
ok('kein funktionsloser Retry-Button ausserhalb des Fehlerzustands', noGhostBtn === 0, 'Treffer ' + noGhostBtn);

/* ── B8 · Fokus auf Retry und Rückkehr nach erfolgreicher Aktion ────────── */
sec('B8 · Fokusvertrag');
await setState('error_nodata', 'f');
const focusable = await ev(() => {
  const el = document.getElementById('gmRetryBtn'); if (!el) return null;
  el.focus(); return document.activeElement === el;
});
ok('Retry-Button ist per Tastatur fokussierbar', focusable === true);
await ev(() => { window.__gm6.resetCalls(); window.setSignals('synced', true); });
await page.waitForTimeout(60);
const focusBack = await ev(() => {
  const a = document.activeElement;
  return { inBody: a === document.body, host: a && a.id === 'command', tag: a ? (a.id || a.tagName) : null };
});
ok('nach erfolgreicher Aktion landet der Fokus im #command-Host, nicht auf <body>',
   focusBack.host === true, JSON.stringify(focusBack));

/* ── B9 · sechs Re-Renders ohne DOM-/Listener-Duplikate ─────────────────── */
sec('B9 · Idempotenz über sechs Re-Renders');
for (const st of ['good', 'partial', 'empty', 'offline_cache', 'loading']) {
  await setState(st, 'f');
  const before = await ev(() => ({ n: document.querySelectorAll('#tab-heute *').length, l: window.__gm6.listeners,
                                   html: document.getElementById('command').innerHTML.length + document.getElementById('modules').innerHTML.length }));
  for (let i = 0; i < 6; i++) await ev(() => window.__gm6.paint());
  const after = await ev(() => ({ n: document.querySelectorAll('#tab-heute *').length, l: window.__gm6.listeners,
                                  html: document.getElementById('command').innerHTML.length + document.getElementById('modules').innerHTML.length }));
  ok(`${st}: DOM-Knotenzahl nach 6 Re-Renders unverändert`, before.n === after.n, before.n + ' → ' + after.n);
  ok(`${st}: keine neuen globalen Listener nach 6 Re-Renders`, before.l === after.l, before.l + ' → ' + after.l);
  ok(`${st}: Markup nach 6 Re-Renders identisch lang`, before.html === after.html, before.html + ' → ' + after.html);
}

/* ── B10 · Zustandsübergänge ────────────────────────────────────────────── */
sec('B10 · Übergänge');
const snap = () => ev(() => ({
  state: (window._gmStateOverride || gmDashState()),
  sk: document.querySelectorAll('#tab-heute .sk').length,
  errbar: document.querySelectorAll('#tab-heute .errbar').length,
  empty: document.querySelectorAll('#tab-heute .empty').length,
  mods: document.getElementById('modules').children.length
}));

await setState('loading', 'f'); const t1a = await snap();
await ev(() => { window._gmStateOverride = null; window.setVM('base'); }); const t1b = await snap();
ok('Loading → Daten: Skeletons verschwinden, Module erscheinen',
   t1a.sk > 0 && t1b.sk === 0 && t1b.state === 'normal' && t1b.mods > 0, JSON.stringify([t1a, t1b]));

await setState('loading', 'f'); const t2a = await snap();
await ev(() => { window._gmStateOverride = null; window.setVM('empty'); }); const t2b = await snap();
ok('Loading → Empty: GM-Empty-Komponente statt Skeletons',
   t2a.sk > 0 && t2b.sk === 0 && t2b.state === 'empty' && t2b.empty >= 2, JSON.stringify([t2a, t2b]));

await setState('good', 'f'); const t3a = await snap();
await ev(() => window.setSignals(null, false)); const t3b = await snap();
/* GM6.1 §2: der Übergang landet im getrennten Zustand 'offline' — NICHT im
   Hard-Error. Zusätzlich zur Errorbar muss der Modulrumpf vollständig erhalten
   bleiben (mods > 0); genau daran unterscheidet sich 'offline' vom Hard-Error,
   der die Module abräumt. */
ok('Daten → Offline mit Cache: Hinweis erscheint, Daten und Module bleiben erhalten',
   t3a.errbar === 0 && t3b.errbar === 1 && t3b.state === 'offline' && t3b.mods === t3a.mods && t3b.mods > 0,
   JSON.stringify([t3a, t3b]));

await ev(() => window.setSignals('synced', true)); const t3c = await snap();
ok('Offline → wieder online: Rückkehr in den vollständigen Normalzustand',
   t3c.state === 'normal' && t3c.errbar === 0 && t3c.mods > 0, JSON.stringify(t3c));

await setState('error_nodata', 'f');
await ev(() => window.__gm6.resetCalls());
await page.click('#gmRetryBtn').catch(() => {});
await ev(() => window.setVM('base'));
await ev(() => window.setSignals('synced', true));
const t4 = await snap();
ok('Error → erfolgreicher Retry: vollständige Seite kehrt zurück',
   t4.state === 'normal' && t4.errbar === 0 && t4.mods > 0, JSON.stringify(t4));

/* ── B11 · Escape-Verhalten bestehender Sheets ──────────────────────────── */
sec('B11 · Escape und Sheet-Verhalten');
await setState('good', 'f');
await ev(() => { const r = document.querySelector('#command .ring-wrap'); r.focus(); r.click(); });
await page.waitForTimeout(120);
const sheetOpen = await ev(() => document.querySelectorAll('.sheet.on').length);
await page.keyboard.press('Escape');
await page.waitForTimeout(120);
const sheetClosed = await ev(() => ({ on: document.querySelectorAll('.sheet.on').length, focus: document.activeElement && document.activeElement.className }));
ok('Score-Sheet öffnet über den GM-Ring', sheetOpen === 1, 'offen ' + sheetOpen);
ok('Escape schliesst das Sheet und führt den Fokus zurück',
   sheetClosed.on === 0 && /ring-wrap/.test(sheetClosed.focus || ''), JSON.stringify(sheetClosed));

/* ── B12 · Reduced Motion ───────────────────────────────────────────────── */
sec('B12 · Reduced Motion der Skeletons');
await setState('loading', 'f');
const animNormal = await ev(() => getComputedStyle(document.querySelector('#tab-heute .sk')).animationName);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.waitForTimeout(60);
const animReduce = await ev(() => getComputedStyle(document.querySelector('#tab-heute .sk')).animationName);
await page.emulateMedia({ reducedMotion: null });
ok('ohne Präferenz behält .sk den GM-Shimmer', animNormal !== 'none' && !!animNormal, String(animNormal));
ok('bei prefers-reduced-motion:reduce ist der .sk-Shimmer abgeschaltet', animReduce === 'none', String(animReduce));

/* ── B13 · keine horizontalen Überläufe ─────────────────────────────────── */
sec('B13 · Layoutintegrität');
for (const vw of [430, 390]) {
  await page.setViewportSize({ width: vw, height: 900 });
  for (const st of Object.keys(TOGM)) {
    for (const lvl of ['a', 'f', 'p']) {
      await setState(st, lvl);
      const over = await evA(w => {
        const out = [];
        document.querySelectorAll('#tab-heute *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 0 && (r.right > w + 0.6 || r.left < -0.6)) out.push(e.className || e.tagName); });
        return out.slice(0, 4);
      }, vw);
      ok(`${vw} ${st}/${lvl}: kein horizontaler Überlauf`, over.length === 0, over.join(' | '));
    }
  }
}
await page.setViewportSize({ width: 430, height: 900 });

/* ── B14 · keine sichtbaren Legacy-Komponenten ──────────────────────────── */
sec('B14 · keine Legacy-Komponenten sichtbar');
for (const st of Object.keys(TOGM)) {
  for (const lvl of ['a', 'f', 'p']) {
    await setState(st, lvl);
    const leg = await ev(() => {
      const sel = '.occ, .cic-b, .cic-pill, .ci-compact-legacy, .rcv-grid, .headrow, .placeholder';
      return [...document.querySelectorAll('#tab-heute ' + sel)].filter(e => e.getBoundingClientRect().height > 1).map(e => e.className);
    });
    ok(`${st}/${lvl}: keine Legacy-Komponente sichtbar`, leg.length === 0, leg.join(' | '));
  }
}

/* ── B15 · Shell bleibt in jedem Zustand erhalten ───────────────────────── */
sec('B15 · Shell-Invarianz');
for (const st of Object.keys(TOGM)) {
  await setState(st, 'f');
  const shell = await ev(() => ({
    tabs: document.querySelectorAll('.tabbar .tabwrap > *').length,
    tabbar: getComputedStyle(document.querySelector('.tabbar')).display,
    fab: getComputedStyle(document.getElementById('navPlus')).display,
    hdr: document.querySelectorAll('#tab-heute > .hdr').length
  }));
  ok(`${st}: Tabbar (5), FAB und Header bleiben erhalten`,
     shell.tabs === 5 && shell.tabbar !== 'none' && shell.fab !== 'none' && shell.hdr === 1, JSON.stringify(shell));
}

/* ── B16 · keine Konsolenfehler ─────────────────────────────────────────── */
sec('B16 · Konsole');
ok('keine Konsolen-/Laufzeitfehler über den gesamten Durchlauf', consoleErrs.length === 0, consoleErrs.slice(0, 3).join(' | '));

await b.close();
console.log('\n' + (fail ? fail + ' FAILED' : 'gm6_state_contract: ALL PASSED') + ' (' + pass + ' ok)');
if (fail) process.exit(1);
