/* ORVIA · v8-314 — Die adaptive Einschätzung wird sichtbar.

   BEFUND: js/adaptive-card.js rendert seit v8-283 die vollstaendige Ausgabe des
   Schattenbetriebs (Anpassungsrichtung, Delta, Zielload, Sperrgruende,
   Begruendung, Zielaussicht). Geschrieben wurde sie ausschliesslich in
   #adaptiveCard — ein direktes Kind von #tab-plan, das styles.css
   `#tab-plan > :not(#gmPlan):not(#gmPage){display:none}` ausblendet —
   angestossen aus renderWeekPlan(), das nur vom UEBERSCHRIEBENEN renderPlan()
   gerufen wird. Der Nutzer hat diese Ausgabe nie gesehen.

   Vertrag dieser Runde:
     A1 der GM-Plan ruft den BESTEHENDEN Renderer (keine zweite Darstellung)
     A2 ohne Beobachtung entfaellt der Abschnitt ERSATZLOS (kein leerer Titel)
     A3 mit Beobachtung erscheinen Titel + echte Inhalte
     A4 Sperrgruende und „vorlaeufig" werden NICHT verschwiegen
     A5 der Legacy-Container bleibt unangetastet (die CSS-Regel wird nicht
        aufgeweicht — sie haelt die gesamte Legacy-Planansicht zurueck)

   node supabase/tests/adaptive_visibility_test.mjs [appRoot] */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const _flat = join(HERE, '..', '..');
const APP = process.argv[2] ? normalize(process.argv[2])
  : ([_flat, join(_flat, 'app'), join(_flat, '..', 'app')]
      .find(p => existsSync(join(p, 'index.html')) && existsSync(join(p, 'js', 'engine'))) || _flat);

let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));

const uiRaw = readFileSync(join(APP, 'js/ui.js'), 'utf8');
const cssRaw = readFileSync(join(APP, 'styles.css'), 'utf8');

function sliceBalanced(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('Slice fehlt: ' + marker);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') { d++; started = true; }
    else if (ch === '}') { d--; if (started && d === 0) {
      let k = j + 1; while (k < src.length && /\s/.test(src[k])) k++;
      return src.slice(i, src[k] === ';' ? k + 1 : j + 1);
    } }
  }
  throw new Error('unbalancierter Slice: ' + marker);
}

/* ---- ECHTER Renderer, keine Attrappe ---- */
globalThis.ORVIA = globalThis.ORVIA || {};
globalThis.window = globalThis;
await import(pathToFileURL(join(APP, 'js/adaptive-card.js')).href);
const AC = globalThis.ORVIA.adaptiveCard;
ok('echter adaptive-card-Renderer geladen', !!(AC && typeof AC.render === 'function' && typeof AC.buildView === 'function'));

const sectionSrc = sliceBalanced(uiRaw, 'function gmAdaptiveSection(');
const mkSection = explain => new Function('window', 'ORVIA',
  sectionSrc + '\nreturn gmAdaptiveSection;')(globalThis, Object.assign({}, globalThis.ORVIA, { getAdaptiveExplanation: () => explain }));

/* ══════════════════════════════════════════════════════════════ */
sec('A1 · Der GM-Plan nutzt den BESTEHENDEN Renderer');
{
  ok('renderGMPlan ruft gmAdaptiveSection auf (kein toter Zweig)', /h\+=gmAdaptiveSection\(\);/.test(uiRaw));
  ok('gmAdaptiveSection delegiert an ORVIA.adaptiveCard.render — keine eigene Darstellung',
    /AC\.render\(ORVIA\.getAdaptiveExplanation\(\)\)/.test(sectionSrc));
  /* Es darf KEINE zweite Formatierung der Engine-Felder in ui.js entstehen:
     die Feldnamen des View-Vertrags duerfen in der Sektion nicht vorkommen. */
  ok('kein Nachbau der Kartenlogik in ui.js (keine View-Felder angefasst)',
    !/recommendation|deltaPct|targetLoad|autoApplicable|wouldChange/.test(sectionSrc));
}

/* ══════════════════════════════════════════════════════════════ */
sec('A2 · Ohne Beobachtung: ersatzlos, kein leerer Titel');
{
  ok('render() liefert bei nicht verfuegbarer Erklaerung leer (Fail-soft der Karte)',
    AC.render({ available: false, reason: 'no_observation' }) === '');
  ok('kein Abschnitt, wenn die Karte leer ist', mkSection({ available: false })() === '');
  ok('auch bei null/Fehler kein Abschnitt', mkSection(null)() === '');
  ok('… und insbesondere KEIN Titel ohne Inhalt',
    mkSection({ available: false })().indexOf('Adaptive Einschätzung') < 0);
}

/* ══════════════════════════════════════════════════════════════ */
sec('A3/A4 · Mit Beobachtung: Titel, Inhalte, und nichts verschwiegen');
{
  const view = {
    available: true, stale: false, createdAt: '2026-08-11T06:00:00.000Z',
    observationStatus: 'complete',
    current: { sessions: 5, weeklyLoad: 420 },
    recommendation: { direction: 'up', deltaPct: 5, targetLoad: 441, provisional: true,
      autoApplicable: false, blocked: ['low_evidence'], selectionReason: 'conservative_band',
      rationale: 'Belastung stabil, Erholung ausreichend.' },
    feasibility: { status: 'within_modeled_corridor', evidence: 'moderate',
      estimatedWeeksRange: { min: 8, max: 12 }, limitingFactors: [] },
    wouldChange: null
  };
  const html = mkSection(view)();
  ok('Abschnitt erscheint mit Titel', html.indexOf('Adaptive Einschätzung') >= 0);
  ok('Slot-Kennzeichnung fuer die Paritaetspruefung vorhanden', /data-gm-slot="plan-adaptive"/.test(html));
  ok('die Kartenausgabe steckt im Abschnitt', /data-adx="1"/.test(html));
  ok('die Anpassung wird beziffert (Delta sichtbar)', /5/.test(html) && /adx-row/.test(html));
  ok('A4: Sperrgrund wird NICHT verschwiegen', /adx-blocked/.test(html), 'blocked=low_evidence');
  ok('A4: „vorlaeufig, wird nicht angewendet" steht da, wenn es so ist',
    /vorläufig|vorlaeufig/.test(html));
  ok('die Begruendung wird mitgezeigt', html.indexOf('Belastung stabil') >= 0);
  ok('die Zielaussicht erscheint (dieselbe Quelle wie v8-313)', /Zielaussicht/.test(html));

  /* Der veraltete Zustand darf nicht als aktuell durchgehen. */
  const staleHtml = mkSection(Object.assign({}, view, { stale: true }))();
  ok('veralteter Stand wird als solcher gekennzeichnet',
    staleHtml !== html && /adx-head/.test(staleHtml));
}

/* ══════════════════════════════════════════════════════════════ */
sec('A5 · Der Legacy-Weg bleibt unangetastet');
{
  ok('die CSS-Regel, die die Legacy-Planansicht zurueckhaelt, ist UNVERAENDERT',
    /#tab-plan>:not\(#gmPlan\):not\(#gmPage\)\{display:none/.test(cssRaw.replace(/\s/g, '')));
  ok('#adaptiveCard wird weiterhin bedient (kein Rueckbau des bestehenden Pfads)',
    /getElementById\('adaptiveCard'\)/.test(uiRaw));
  ok('gmRenderAdaptiveCard existiert unveraendert weiter', /globalThis\.gmRenderAdaptiveCard=function/.test(uiRaw));
}

console.log('\nadaptive_visibility: ' + (fail === 0 ? 'ALL PASSED' : fail + ' FAILED') + ' (' + pass + ' ok)');
process.exit(fail === 0 ? 0 : 1);
