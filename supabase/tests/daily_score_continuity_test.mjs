/* ORVIA · v8-317 — Der Tagesscore wird stetig, regional und baseline-relativ.

   GIANS BEFUND, am Code reproduziert: Der angezeigte Score war KEINE Messung,
   sondern die Obergrenze des Tageszustands. `applyDecisionCaps` endete auf
     {GREEN:100, YELLOW:79, ORANGE:64, RED:44}[state]
   und weil die physiologische Readiness fast immer darueber lag, sah man exakt
   diese vier Zahlen. Seine Messreihe (Hueftschmerz 0–10 ⇒ 79/79/79/79/64/64/
   44/44) ist genau diese Treppe. Jede Verbesserung bei Schlaf, Stress oder HRV
   wurde von derselben Zahl abgeschnitten — wochenlang „79".

   Drei weitere Befunde, alle bestaetigt:
     - Garmins HRV-Status kennt Balanced · Unbalanced · Low · Poor. Ein 'Good'
       gibt es NICHT (Garmin-Doku) — der 100er-Zweig war toter Code, ueber
       diesen Pfad war bei 88 Schluss. 'Unbalanced' (leicht neben der Baseline)
       lag mit 'Low' (deutlich darunter) gemeinsam auf 45; 'Poor' fiel ganz
       durch und landete dadurch in BESSEREN Zustaenden als 'Low'.
     - Muskelkater wirkte global: Beinmuskelkater 7/10 setzte auch an einem
       Oberkoerpertag ORANGE — und ORANGE verbietet Krafttraining komplett.
     - 100 war praktisch unerreichbar.

   node supabase/tests/daily_score_continuity_test.mjs [appRoot] */
import { existsSync, readFileSync } from 'node:fs';
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

globalThis.window = globalThis;
const Calc = (await import(pathToFileURL(join(APP, 'js/calc.js')).href)).default || globalThis.Calc;
ok('echtes calc.js geladen', !!(Calc && Calc.buildTrainingDecision && Calc.readiness));

const CTX = { hrvBase7: null, hrvSd28: null, hrvN: 0, rhrBase: 55, sleepDebtH: null, hrvLowStreak: 0 };
const M = o => Object.assign({ knee: 0, doms: 0, feel: 8, sleepMin: 450, sleepQ: 8,
  stress: 'Low', hrv: 'Balanced', rhr: 54, bb: 80 }, o || {});
const UNIT = { t: 'Laufen', l: 'Z2 Dauerlauf', d: 'ez' };

/* End-to-end wie im Produkt: readiness() speist components.recovery UND
   checkin.readiness — genau die Verdrahtung aus ui.js getDecision(). */
function endToEnd(m, opts) {
  const o = opts || {};
  const unit = o.unit || UNIT;
  const tt = Calc.classifyTrainingType(unit);
  const hits = m.domsRegion ? Calc.evaluateDomsImpact({ doms: m.doms, domsRegion: m.domsRegion }, tt).hits : null;
  /* recoveryCtx liefert seit v8-317 painToday (groesster Schmerz ueber ALLE
     Regionen) — ohne ihn kannte readiness() nur den Knieschmerz. Der Harness
     muss dieselbe Verdrahtung abbilden, sonst prueft er einen Pfad, den das
     Produkt so nicht hat. */
  const ctx = Object.assign({}, CTX, { domsHitsToday: hits, painToday: o.pain != null ? o.pain : m.knee });
  const r = Calc.readiness(m, ctx);
  const d = Calc.buildTrainingDecision({
    checkin: { pain: o.pain || 0, painRegion: o.painRegion || '', doms: m.doms, domsRegion: m.domsRegion || '',
      sleepH: m.sleepMin / 60, sleepQ: m.sleepQ, feel: m.feel, stress: m.stress, hrv: m.hrv, readiness: r.score },
    loads: { load3: 100, load7: 100, load14: 100 }, plannedToday: unit,
    components: { recovery: r.score } });
  /* Die Trainingserlaubnis (hard/strength/impact) liefert dayStateEngine, nicht
     buildTrainingDecision — der erste Testentwurf griff auf ein Feld zu, das es
     nie gab (d.decisionAllow === undefined), und war deshalb rot. Hier wird die
     ECHTE Quelle mit demselben Zustand befragt. */
  const allow = Calc.dayStateEngine({ pain: o.pain || 0, doms: m.doms,
    domsHits: m.domsRegion ? hits : undefined, sleepH: m.sleepMin / 60, sleepQ: m.sleepQ,
    feel: m.feel, stress: m.stress, hrv: m.hrv, readiness: r.score }).allow;
  return { readiness: r.score, state: d.dayState, score: d.score, allow: allow };
}

/* ══════════════════════════════════════════════════════════════ */
sec('S1 · Die Treppe 79/64/44 ist weg');
{
  /* Wieder ohne Kommentare pruefen: der Modulkommentar ZITIERT die alte Zeile,
     um den Fund zu dokumentieren. Die Probe darf die Dokumentation des Fehlers
     nicht verbieten — gesucht ist ausfuehrbarer Code. */
  const strip = x => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const src = strip(Calc.applyDecisionCaps.toString());
  ok('DER ALTE CODE IST WEG: keine feste Stufenliste {GREEN:100,YELLOW:79,ORANGE:64,RED:44} mehr',
    !/YELLOW\s*:\s*79\s*,\s*ORANGE\s*:\s*64\s*,\s*RED\s*:\s*44/.test(src.replace(/\s/g, ' ')));
  const seen = [];
  for (let p = 0; p <= 10; p++) seen.push(endToEnd(M(), { pain: p, painRegion: 'hip' }).score);
  const distinct = new Set(seen).size;
  ok('Gians Messreihe liefert jetzt mehr als drei verschiedene Werte',
    distinct > 3, seen.join(' · ') + ' (' + distinct + ' verschieden)');
  ok('die Reihe faellt monoton (mehr Schmerz ⇒ nie besser)',
    seen.every((v, idx) => idx === 0 || v <= seen[idx - 1]), seen.join(' ≥ '));
  ok('kein Wert klebt auf exakt 79/64/44 als Dauerplateau',
    !(seen.filter(v => v === 79).length >= 3 || seen.filter(v => v === 64).length >= 3));
  /* LUECKE, DIE DIE MUTATIONSPROBE AUFDECKTE: Die obige Reihe variierte auch
     dann noch, wenn readiness() den Schmerz gar nicht sieht — allein der
     Banddeckel erzeugte genug verschiedene Werte. Damit haette „Schmerz zaehlt
     nur am Knie" unbemerkt zurueckkommen koennen. Deshalb wird jetzt die
     READINESS SELBST geprueft: Huftschmerz muss den Rohwert bewegen, nicht nur
     die Obergrenze. */
  const rawByPain = [0, 3, 6, 9].map(p =>
    Calc.readiness(M(), Object.assign({}, CTX, { painToday: p })).score);
  ok('Schmerz AUSSERHALB des Knies erreicht die Readiness selbst',
    new Set(rawByPain).size === 4, rawByPain.join(' · '));
  ok('… und senkt sie monoton', rawByPain.every((v, i) => i === 0 || v <= rawByPain[i - 1]));
  ok('der Knieschmerz bleibt dabei gueltig (kein Rueckschritt fuer Altaufrufer)',
    Calc.readiness(M({ knee: 8 }), CTX).score < Calc.readiness(M({ knee: 0 }), CTX).score);
}

/* ══════════════════════════════════════════════════════════════ */
sec('S2 · Schlaf, Stress und Befinden bewegen die Zahl');
{
  const sleepQ = [2, 4, 6, 8, 10].map(q => endToEnd(M({ sleepQ: q })).score);
  ok('Schlafqualität 2→10 veraendert den Score', new Set(sleepQ).size >= 4, sleepQ.join(' · '));
  ok('besserer Schlaf ⇒ nie schlechterer Score', sleepQ.every((v, i) => i === 0 || v >= sleepQ[i - 1]));
  const sleepH = [300, 360, 420, 480].map(mi => endToEnd(M({ sleepMin: mi })).score);
  ok('Schlafdauer 5h→8h veraendert den Score', new Set(sleepH).size >= 3, sleepH.join(' · '));
  const stress = ['High', 'Med', 'Low'].map(s => endToEnd(M({ stress: s })).score);
  ok('Stress hoch→niedrig veraendert den Score', new Set(stress).size === 3, stress.join(' · '));
  ok('weniger Stress ⇒ nie schlechterer Score', stress[2] >= stress[1] && stress[1] >= stress[0]);
  const feel = [3, 5, 7, 9].map(f => endToEnd(M({ feel: f })).score);
  ok('Befinden 3→9 veraendert den Score', new Set(feel).size >= 3, feel.join(' · '));
  /* DER KERN VON GIANS BESCHWERDE: bei gleichbleibendem Zustand (leichter
     Schmerz) muss Schlaf trotzdem wirken — vorher war hier ueberall 79. */
  const inState = [2, 6, 10].map(q => endToEnd(M({ sleepQ: q }), { pain: 3, painRegion: 'hip' }).score);
  ok('AUCH INNERHALB desselben Tageszustands wirkt besserer Schlaf',
    new Set(inState).size >= 2, inState.join(' · '));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S3 · Garmins echte HRV-Kategorien');
{
  ok('es gibt genau EINE Lesart im Produkt', typeof Calc.hrvBelowBaseline === 'function');
  /* KOMMENTARE ENTFERNEN: die erste Fassung war rot, weil der erklaerende
     Kommentar im Modul selbst „Ein 'Good' gibt es NICHT" sagt. Gesucht ist der
     VERGLEICH, nicht die Erwaehnung — sonst verbietet die Probe ausgerechnet
     die Dokumentation des Fundes. Gleiche Korrektur wie in v8-315. */
  const stripComments = x => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok("'Good' wird nirgends mehr VERGLICHEN (Garmin kennt die Kategorie nicht)",
    !/===\s*'Good'|===\s*"Good"|'good'/.test(stripComments(Calc.hrvScoreOf.toString())));
  const s = h => Calc.hrvScoreOf({ hrv: h }, null);
  ok('Balanced > Unbalanced > Low > Poor — vier unterscheidbare Stufen',
    s('Balanced') > s('Unbalanced') && s('Unbalanced') > s('Low') && s('Low') > s('Poor'),
    [s('Balanced'), s('Unbalanced'), s('Low'), s('Poor')].join(' > '));
  ok("DER ALTE FEHLER: 'Unbalanced' liegt nicht mehr mit 'Low' gleichauf",
    s('Unbalanced') !== s('Low'));
  ok("'Poor' wird ueberhaupt bewertet (fiel vorher auf null)", s('Poor') != null);
  ok('unbekannte Kennung wird nicht geraten, sondern faellt aus der Gewichtung',
    Calc.hrvScoreOf({ hrv: 'Fantasiewert' }, null) === null);
  ok('hrvBelowBaseline trifft Low UND Poor, aber nicht Unbalanced/Balanced',
    Calc.hrvBelowBaseline('Low') && Calc.hrvBelowBaseline('Poor') &&
    !Calc.hrvBelowBaseline('Unbalanced') && !Calc.hrvBelowBaseline('Balanced'));
  /* Die Gegenprobe, die den Poor-Fehler ueberhaupt aufgedeckt hat. */
  const byStatus = ['Balanced', 'Unbalanced', 'Low', 'Poor'].map(h => endToEnd(M({ hrv: h })).score);
  ok('RANGFOLGE END-TO-END: Poor ist nie besser als Low', byStatus[3] <= byStatus[2],
    byStatus.join(' · '));
  ok('… und Balanced ist der beste Status', byStatus[0] === Math.max.apply(null, byStatus));
  /* Der gemessene Pfad bleibt vorrangig und ist gegen die EIGENE, mitwachsende
     Baseline gerechnet — er kann 100 erreichen, der Statuspfad nicht. */
  const measured = Calc.hrvScoreOf({ hrvMs: 70, hrv: 'Low' },
    { hrvN: 20, hrvBase7: Math.log(65), hrvSd28: 0.1 });
  ok('gemessene HRV ueber der eigenen Baseline schlaegt den Status und erreicht 100',
    measured === 100, String(measured));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S4 · Muskelkater ist regional (Gians Beispiel wortwoertlich)');
{
  const legDoms = M({ doms: 7, domsRegion: 'Beine' });
  const upper = endToEnd(legDoms, { unit: { t: 'Gym', l: 'Oberkörper', d: '45 min' } });
  const legs = endToEnd(legDoms, { unit: { t: 'Gym', l: 'Beine', d: '45 min' } });
  const iv = endToEnd(legDoms, { unit: { t: 'Laufen', l: 'Intervalle', d: 'iv' } });
  ok('Beinmuskelkater 7/10 + OBERKÖRPER ⇒ Krafttraining bleibt erlaubt',
    upper.allow && upper.allow.strength === true, upper.state + ' / Score ' + upper.score);
  ok('DER ALTE FEHLER: der Oberkörpertag landet nicht mehr in ORANGE',
    upper.state !== 'ORANGE' && upper.state !== 'RED', upper.state);
  ok('Beinmuskelkater 7/10 + BEINE ⇒ weiterhin gebremst', legs.state === 'ORANGE',
    legs.state + ' / Score ' + legs.score);
  ok('Beinmuskelkater 7/10 + INTERVALLE ⇒ weiterhin gebremst', iv.state === 'ORANGE');
  ok('der Score unterscheidet die beiden Tage deutlich', upper.score > legs.score,
    upper.score + ' vs ' + legs.score);
  /* Sicherheitsseite: der Muskelkater verschwindet NICHT ganz — starker
     Muskelkater ist auch systemische Ermuedung. */
  const none = endToEnd(M({ doms: 0, domsRegion: 'Beine' }), { unit: { t: 'Gym', l: 'Oberkörper', d: '45 min' } });
  ok('… aber er wirkt noch: ohne Muskelkater ist der Oberkörpertag besser',
    none.score > upper.score, none.score + ' vs ' + upper.score);
}

/* ══════════════════════════════════════════════════════════════ */
sec('S5 · 100 ist erreichbar — und die Bänder bleiben getrennt');
{
  const best = endToEnd(M({ knee: 0, doms: 0, feel: 10, sleepMin: 480, sleepQ: 10,
    stress: 'Low', hrv: 'Balanced', rhr: 50, bb: 100 }));
  ok('ein rundum guter Tag kommt deutlich ueber die alte 85er-Decke',
    best.score >= 95, String(best.score));
  /* Mit gemessener HRV ueber der eigenen Baseline ist die Decke ganz weg. */
  const rBest = Calc.readiness({ knee: 0, doms: 0, feel: 10, sleepMin: 480, sleepQ: 10,
    stress: 'Low', hrvMs: 70, rhr: 50, bb: 100 },
    { hrvN: 20, hrvBase7: Math.log(65), hrvSd28: 0.1, rhrBase: 55 });
  ok('mit eigener HRV-Messreihe erreicht die Readiness 100', rBest.score === 100, String(rBest.score));

  /* SICHERHEIT BLEIBT: Die Baender duerfen sich nicht ueberlappen. */
  const green = endToEnd(M()).score;
  const orangeCase = endToEnd(M(), { pain: 5, painRegion: 'knee' });
  const redCase = endToEnd(M(), { pain: 8, painRegion: 'knee' });
  ok('ein ORANGE-Tag sieht nie aus wie ein guter Tag', orangeCase.score < green,
    green + ' → ' + orangeCase.score + ' (' + orangeCase.state + ')');
  ok('ein RED-Tag bleibt klar darunter', redCase.score < orangeCase.score,
    orangeCase.score + ' → ' + redCase.score + ' (' + redCase.state + ')');
  ok('Krankheit deckelt weiterhin hart',
    endToEnd(M(), {}).score > 55 && Calc.buildTrainingDecision({
      checkin: { pain: 0, illness: true, sleepH: 7.5, sleepQ: 8, feel: 8, stress: 'Low', hrv: 'Balanced', readiness: 95 },
      loads: { load3: 100, load7: 100 }, plannedToday: UNIT, components: { recovery: 95 } }).score <= 55);
  /* LUECKE, DIE DIE MUTATIONSPROBE AUFDECKTE: `<= 44` war zu weich — das RED-Band
     endet ohnehin bei 49, die Zusage galt also auch OHNE den harten Deckel.
     Geprueft wird jetzt die Grenze, die NUR der Sicherheitsdeckel erzwingt (40),
     und zwar an einem Tag, an dem sonst alles bestens ist: ohne den Deckel
     wuerde die hohe Readiness bis an die Bandobergrenze durchschlagen. */
  const painPerfectRest = Calc.buildTrainingDecision({
    checkin: { pain: 8, painRegion: 'knee', doms: 0, sleepH: 8, sleepQ: 10, feel: 10,
      stress: 'Low', hrv: 'Balanced', readiness: 98 },
    loads: { load3: 100, load7: 100 }, plannedToday: UNIT, components: { recovery: 98 } }).score;
  ok('Schmerz ≥8 deckelt hart auf 40 — auch wenn sonst alles perfekt ist',
    painPerfectRest <= 40, String(painPerfectRest));
  /* BEFUND AUS DER MUTATIONSPROBE (kein Testfehler, sondern eine Erkenntnis):
     Ueber buildTrainingDecision ist der Deckel `pain>=8 ⇒ 40` derzeit
     REDUNDANT — pain>=8 erzwingt dort ohnehin RED, und das RED-Band endet bei
     49, was zusammen mit der Schwere immer unter 40 landet. Ein Entfernen des
     Deckels blieb deshalb ueber diesen Weg unsichtbar.
     Der Deckel ist trotzdem kein toter Code: er ist die Absicherung der
     FUNKTION SELBST gegen jeden anderen Aufrufer, der einen milderen Zustand
     uebergibt. Genau das wird hier direkt geprueft — sonst waere die Zusage
     „Schmerz ≥8 deckelt hart" nirgends gedeckt. */
  const capDirect = Calc.applyDecisionCaps(98, { pain: 8, doms: 0, hardPlanned: false },
    { safety: { level: 'none' }, pdm: { pain: { hits: false }, doms: { hits: false } }, load: {} }, 'YELLOW');
  ok('der harte Schmerzdeckel bindet auch, wenn der Zustand milder gemeldet wird',
    capDirect <= 40, String(capDirect));
  ok('… und der RED-Fall aus der Reihe bleibt ebenfalls darunter', redCase.score <= 44, String(redCase.score));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S6 · Reinheit und Stetigkeit der Schwere-Funktion');
{
  ok('stateSeverity ist exportiert und pur', typeof Calc.stateSeverity === 'function');
  const base = { pain: 0, doms: 0, sleepH: 8, sleepQ: 9, feel: 9, hrv: 'Balanced', stress: 'Low', readiness: 90 };
  const ev = { pdm: { pain: { hits: true }, doms: { hits: true } } };
  const a = Calc.stateSeverity(base, ev, 'YELLOW');
  ok('ein rundum guter Zustand hat Schwere 0', a === 0, String(a));
  ok('Schwere bleibt im Bereich 0..1 auch bei allem gleichzeitig',
    (() => { const s = Calc.stateSeverity({ pain: 10, doms: 10, sleepH: 2, sleepQ: 1, feel: 1,
      hrv: 'Poor', stress: 'High', illness: true, readiness: 5 }, ev, 'RED'); return s >= 0 && s <= 1; })());
  /* Stetigkeit: kleine Aenderung ⇒ kleine Wirkung, keine Sprungstelle. */
  const steps = [];
  for (let p = 0; p <= 10; p++) steps.push(Calc.stateSeverity(Object.assign({}, base, { pain: p }), ev, 'YELLOW'));
  const jumps = steps.slice(1).map((v, i) => v - steps[i]);
  ok('Schmerz wirkt stetig, ohne Sprungstelle', Math.max.apply(null, jumps) < 0.1,
    'groesster Einzelschritt ' + Math.max.apply(null, jumps).toFixed(3));
  ok('gleiche Eingabe ⇒ gleiche Schwere (pur)',
    Calc.stateSeverity(base, ev, 'YELLOW') === Calc.stateSeverity(base, ev, 'YELLOW'));
  ok('Schmerz, der die heutige Einheit NICHT trifft, wiegt weniger',
    Calc.stateSeverity(Object.assign({}, base, { pain: 6 }), { pdm: { pain: { hits: false }, doms: {} } }, 'YELLOW') <
    Calc.stateSeverity(Object.assign({}, base, { pain: 6 }), ev, 'YELLOW'));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S7 · v8-318 · Referenzen wachsen mit — kein fester Idealwert');
{
  /* DER DAUERBREMSER: sleepDebt rechnete mit fest verdrahteten 480 min. Wer
     gewohnheitsmaessig 7 h schlaeft, sammelte JEDE Nacht 1 h „Schuld" —
     7 h/Woche, Beitrag 100−7·12 = 16 statt 100, und zwar unbehebbar. Bei
     Gewicht 12 zieht das den Tagesscore dauerhaft um rund 8 Punkte. */
  const week7h = [420, 420, 420, 420, 420, 420, 420];
  ok('DER ALTE FEHLER: ohne eigenen Bedarf gilt weiterhin 8 h (Altaufrufer unveraendert)',
    Calc.sleepDebt(week7h) === 7, String(Calc.sleepDebt(week7h)));
  ok('mit eigenem Bedarf 7 h ist die Schuld eines 7-h-Schlaefers null',
    Calc.sleepDebt(week7h, 420) === 0, String(Calc.sleepDebt(week7h, 420)));
  ok('eine einzelne schlechte Nacht erzeugt weiterhin Schuld',
    Calc.sleepDebt([420, 420, 240, 420, 420, 420, 420], 420) === 3);
  /* [A] Die Referenz darf NICHT unbegrenzt mitwandern — sonst erklaert sich
     chronischer Schlafmangel selbst zur Norm. Deckel 7–8 h. */
  ok('chronischer Schlafmangel wird NICHT zur neuen Norm (Referenz bei 7 h gedeckelt)',
    Calc.sleepDebt([300, 300, 300, 300, 300, 300, 300], 300) > 10,
    String(Calc.sleepDebt([300, 300, 300, 300, 300, 300, 300], 300)));
  ok('… und ein Langschlaefer bekommt keine Referenz ueber 8 h',
    Calc.sleepDebt([540, 540, 540, 540, 540, 540, 540], 600) === 0);

  /* Schlafdauer-Subscore relativ zum eigenen Bedarf. */
  const own = { rhrBase: 55, sleepBase: 420, sleepSd: 40, sleepN: 20, bbBase: 75, bbN: 20 };
  const none = { rhrBase: 55 };
  const at7 = M({ sleepMin: 420 });
  ok('7 h Schlaf bei eigenem Bedarf 7 h wird besser bewertet als gegen die feste Rampe',
    Calc.readiness(at7, own).score > Calc.readiness(at7, none).score,
    Calc.readiness(at7, none).score + ' → ' + Calc.readiness(at7, own).score);
  const byDur = [300, 360, 420, 480].map(x => Calc.readiness(M({ sleepMin: x }), own).score);
  ok('weniger als der eigene Bedarf senkt den Wert', byDur[0] < byDur[2], byDur.join(' · '));
  ok('mehr als der eigene Bedarf wird nicht zusaetzlich belohnt (kein Ideal-Jagen)',
    byDur[3] === byDur[2], byDur[2] + ' vs ' + byDur[3]);

  /* Body Battery gegen den eigenen Morgenwert. */
  const bbOwn = Calc.readiness(M({ bb: 75 }), own).score;
  const bbRaw = Calc.readiness(M({ bb: 75 }), none).score;
  ok('Body Battery auf dem EIGENEN Normalwert zaehlt voll, nicht als 75 %',
    bbOwn > bbRaw, bbRaw + ' → ' + bbOwn);
  ok('unter dem eigenen Normalwert sinkt sie weiterhin',
    Calc.readiness(M({ bb: 50 }), own).score < bbOwn);
  /* Direkt am Bauteil statt nur am Gesamtwert — sonst faellt ein Entfernen des
     Baseline-Zweigs nur ueber die Summe auf (so geschehen bei Mutationsprobe 4). */
  const bbPart = c => (Calc.readiness(M({ bb: 75 }), c).parts || []).filter(p => p[0] === 'Body Battery')[0];
  ok('Body Battery auf dem eigenen Normalwert ergibt den Vollwert 100',
    bbPart(own) && bbPart(own)[1] === 100, String(bbPart(own) && bbPart(own)[1]));
  ok('ohne eigene Baseline bleibt es beim Rohwert 75',
    bbPart(none) && bbPart(none)[1] === 75, String(bbPart(none) && bbPart(none)[1]));

  /* FAIL-CLOSED: zu wenig eigene Historie ⇒ altes Verhalten, keine erfundene
     Baseline. Das ist die Zusage, die verhindert, dass ein neuer Nutzer eine
     Referenz aus drei Tagen bekommt. */
  const thin = { rhrBase: 55, sleepBase: null, sleepSd: null, sleepN: 6, bbBase: null, bbN: 6 };
  ok('ohne ausreichende Historie bleibt alles beim bisherigen Verhalten',
    Calc.readiness(at7, thin).score === Calc.readiness(at7, none).score,
    Calc.readiness(at7, thin).score + ' vs ' + Calc.readiness(at7, none).score);
  /* LUECKE, DIE DIE MUTATIONSPROBE AUFDECKTE: Die Zusage oben prueft nur, wie
     calc.js mit einer FEHLENDEN Baseline umgeht. WER entscheidet, ob eine
     Baseline ueberhaupt entsteht, steht in ui.js (recoveryCtx) — dort haette
     die Mindestmenge unbemerkt von 14 auf 1 Tag sinken koennen, und der
     Calc-Test waere gruen geblieben. Die Schwelle ist der eigentliche Schutz
     davor, dass ein neuer Nutzer eine Referenz aus drei Tagen bekommt. */
  const uiSrc = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  /* v8-319 hat die Median-Regel in den Helfer _sleepNeed verschoben (der
     gemessene Bedarf hat jetzt Vorrang). Die ZUSAGE ist unveraendert — sie
     wird an ihrem neuen Ort geprueft, nicht an der alten Zeile. Genau das ist
     der Unterschied zwischen einer Eigenschaft und einer Momentaufnahme. */
  ok('die Median-Baseline entsteht erst ab 14 eigenen Tagen (Helfer _sleepNeed)',
    /hist&&hist\.length>=14\)\?Calc\.median\(hist\):null/.test(uiSrc));
  ok('Schlaf-Baseline und Schlafschuld benutzen BEIDE denselben Helfer',
    /sleepBase:_sleepNeed\(sleep28\)/.test(uiSrc) && /Calc\.sleepDebt\(sleep7,_sleepNeed\(sleep28\)\)/.test(uiSrc));
  ok('… dasselbe 14-Tage-Minimum fuer Streuung und Body-Battery-Baseline',
    /sleepSd:\s*sleep28\.length>=14\?/.test(uiSrc) && /bbBase:\s*bb28\.length>=14\?/.test(uiSrc));

  /* Der Gesamteffekt auf Gians typischen Tag. */
  const gianAlt = { rhrBase: 55, sleepDebtH: Calc.sleepDebt(week7h) };
  const gianNeu = Object.assign({}, own, { sleepDebtH: Calc.sleepDebt(week7h, 420) });
  /* v9 (2026-08-16): Die ZUSAGE ist unveraendert — wer 7 h braucht und 7 h
     schlaeft, darf nicht wie jemand bewertet werden, der 8 h braucht. Die
     Schwelle 8 war die Groesse dieses Effekts auf der ALTEN Skala; v9 hat den
     Schlafblock bewusst entzerrt (Skala 8 statt 12 Punkte/h, Gewicht 25 von 131
     statt 32 von 138). Damit faellt derselbe Effekt kleiner aus, ohne schwaecher
     zu sein: gemessen 87 → 94. Die Schwelle wird auf 6 skaliert
     (8 × 19/23 ≈ 6,6) — nicht auf den Ist-Wert gesenkt, sonst prueft sie nichts.

     NICHT VERWECHSELN (geklaert am 17.08.): Diese 87 → 94 sind KEIN v8→v9-
     Vergleich. Verglichen werden zwei KONTEXTE innerhalb von v9 — links eine
     falsche Fremdbaseline (rhrBase 55) plus 7 h Schlafschuld aus einem
     unterstellten 8-h-Bedarf, rechts die eigene Baseline plus gemessenen
     Bedarf. Gemessen wird also der Wert personalisierter Baselines, nicht der
     Effekt der Score-Ueberarbeitung.
     Die v9-Notiz nennt daneben „87 → 83". Das ist die ANGEZEIGTE Headline und
     ebenfalls korrekt: bis v8 war rawScore = recovery (calc.js: rawScore =
     _compIn.recovery != null ? _compIn.recovery : combineScore(...)), die
     Headline war also identisch mit der Erholung. Seit v9 aggregiert
     combineHeadline 60/25/15: 0,60·87 + 0,25·74 + 0,15·80 = 82,7 → 83.
     Beide Zahlen sind richtig, sie messen verschiedene Groessen; die 87 auf
     beiden Seiten ist Zufall. */
  ok('Gians typischer Tag (7 h gewohnt, 7 h geschlafen) kommt deutlich hoeher heraus',
    Calc.readiness(M(), gianNeu).score - Calc.readiness(M(), gianAlt).score >= 6,
    Calc.readiness(M(), gianAlt).score + ' → ' + Calc.readiness(M(), gianNeu).score);
}

/* ══════════════════════════════════════════════════════════════ */
sec('S8 · v8-319 · Gemessene Schlafdaten statt Ersatzwerte');
{
  const uiSrc2 = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  const week7h2 = [420, 420, 420, 420, 420, 420, 420];
  /* BEFUND: Der Worker synchronisiert sleep_need_min (Garmins eigenen,
     personalisierten Schlafbedarf) seit Langem — im Produkt hatte die Metrik
     NULL Verwendungsstellen. Der 28-Tage-Median aus v8-318 war ein Hilfswert
     fuer genau diesen Fall. */
  ok('sleep_need_min wird ueberhaupt gelesen (vorher null Verwendungsstellen)',
    /sleep_need_min/.test(uiSrc2));
  ok('RANGFOLGE: der gemessene Bedarf wird ueberhaupt zurueckgegeben (nicht nur gelesen)',
    /if\(measured!=null&&[^)]*\)return measured;/.test(uiSrc2));
  ok('… und der Median ist ausdruecklich nur der Rueckfall danach',
    /return measured;[\s\S]{0,120}return\s*\(hist&&hist\.length>=14\)/.test(uiSrc2));
  ok('… und ein unplausibler gemessener Bedarf faellt auf den Median zurueck',
    /measured>240&&measured<720/.test(uiSrc2));
  ok('der 7–8-h-Deckel gilt AUCH fuer den gemessenen Bedarf',
    Calc.sleepDebt(week7h2, 300) === 0 && Calc.sleepDebt(week7h2, 600) === 7,
    Calc.sleepDebt(week7h2, 300) + ' / ' + Calc.sleepDebt(week7h2, 600));

  /* Garmins Sleep Score — Gians ausdrueckliche Forderung. */
  const b = { rhrBase: 55, sleepBase: 420, sleepSd: 40, bbBase: 75 };
  const byScore = [40, 60, 80, 95].map(sc => Calc.readiness(M({ sleepMin: 420 }), Object.assign({}, b, { sleepScore: sc })).score);
  ok('Garmins Sleep Score bewegt die Readiness', new Set(byScore).size >= 3, byScore.join(' · '));
  ok('besserer Sleep Score ⇒ nie schlechter', byScore.every((v, i) => i === 0 || v >= byScore[i - 1]));
  ok('ohne gemessenen Score bleibt alles beim bisherigen Verhalten',
    Calc.readiness(M({ sleepMin: 420 }), b).score ===
    Calc.readiness(M({ sleepMin: 420 }), Object.assign({}, b, { sleepScore: null })).score);
  /* DOPPELZAEHLUNG: Sleep Score enthaelt Dauer und Phasen bereits. Liegt er
     vor, teilen sich gemessen und subjektiv das bisherige Gewicht 14. */
  const part = (c, name) => (Calc.readiness(M({ sleepMin: 420 }), c).parts || []).filter(p => p[0] === name)[0];
  /* v9 (2026-08-16): Postennamen umbenannt — „Schlafqualität" → „Schlafgefühl",
     „Schlafqualität (gemessen)" → „Schlaf-Score (Gerät)". Die geprüfte
     Eigenschaft ist dieselbe geblieben: liegt ein gemessener Score vor, faellt
     das Gewicht der subjektiven Angabe (14 → 5). Neu ist, WER die Luecke fuellt:
     der geraetegemessene Score fuehrt jetzt mit 14, und die separat gezaehlte
     Schlafdauer halbiert sich von 12 auf 6 — weil der Score die Dauer bereits
     enthaelt. Genau das ist die Zusage „keine Doppelzaehlung", nur an der
     richtigen Stelle: geprueft wird die Dauer, nicht mehr eine Summe von 14. */
  ok('mit gemessenem Score sinkt das Gewicht der SUBJEKTIVEN Angabe von 14 auf 5',
    part(b, 'Schlafgefühl')[2] === 14 &&
    part(Object.assign({}, b, { sleepScore: 80 }), 'Schlafgefühl')[2] === 5);
  ok('… der gemessene Score fuehrt mit 14',
    part(Object.assign({}, b, { sleepScore: 80 }), 'Schlaf-Score (Gerät)')[2] === 14);
  ok('… und die Schlafdauer halbiert sich (12 → 6), weil der Score sie enthaelt — keine Doppelzaehlung',
    part(b, 'Schlafdauer')[2] === 12 &&
    part(Object.assign({}, b, { sleepScore: 80 }), 'Schlafdauer')[2] === 6);

  /* Schlafphasen gegen die EIGENE Verteilung.
     v9 (2026-08-16): Liegt ein geraetegemessener Sleep Score vor, entfaellt der
     Phasen-Posten ERSATZLOS — der Score enthaelt die Phasen bereits, alles
     andere waere Doppelzaehlung. Die Phasen-Eigenschaften werden deshalb ohne
     `sleepScore` geprueft; dass sie MIT Score verschwinden, ist eine eigene
     Zusicherung (direkt darunter). */
  ok('mit gemessenem Sleep Score entfaellt der Phasen-Posten (keine Doppelzaehlung)',
    !(Calc.readiness(M({ sleepMin: 420 }), Object.assign({}, b, { sleepScore: 80, phaseShareToday: 0.42, phaseShareBase: 0.42 })).parts || [])
      .some(p => p[0] === 'Schlafphasen'));
  const ph = t => Calc.readiness(M({ sleepMin: 420 }),
    Object.assign({}, b, { phaseShareToday: t, phaseShareBase: 0.42 })).score;
  ok('Tief-/REM-Anteil unter der eigenen Quote senkt den Wert', ph(0.28) < ph(0.42),
    ph(0.28) + ' → ' + ph(0.42));
  ok('auf der eigenen Quote zaehlt er voll',
    (Calc.readiness(M({ sleepMin: 420 }), Object.assign({}, b, { phaseShareToday: 0.42, phaseShareBase: 0.42 })).parts || [])
      .filter(p => p[0] === 'Schlafphasen')[0][1] === 100);
  ok('MEHR als die eigene Quote wird nicht zusaetzlich belohnt', ph(0.50) === ph(0.42));
  /* LUECKE, DIE DIE MUTATIONSPROBE AUFDECKTE: Mit einer Testquote nahe an einer
     denkbaren Lehrbuchkonstante (0,42 vs. 0,40) ist beides ununterscheidbar.
     GIANS PRINZIP steht und faellt aber genau hier: Wer von Natur aus eine
     niedrige Tief-/REM-Quote hat, muss auf SEINER Quote den Vollwert bekommen —
     gegen eine feste Zahl wuerde er dauerhaft abgewertet. Also mit einer Quote
     pruefen, die weit weg von jeder plausiblen Konstante liegt. */
  const lowSleeper = Calc.readiness(M({ sleepMin: 420 }),
    Object.assign({}, b, { phaseShareToday: 0.26, phaseShareBase: 0.26 }));
  const lowPart = (lowSleeper.parts || []).filter(p => p[0] === 'Schlafphasen')[0];
  ok('wer von Natur aus wenig Tief-/REM-Schlaf hat, bekommt auf SEINER Quote den Vollwert',
    lowPart && lowPart[1] === 100, String(lowPart && lowPart[1]));
  const highSleeper = Calc.readiness(M({ sleepMin: 420 }),
    Object.assign({}, b, { phaseShareToday: 0.44, phaseShareBase: 0.58 }));
  const highPart = (highSleeper.parts || []).filter(p => p[0] === 'Schlafphasen')[0];
  ok('… und wer gewohnt viel hat, wird bei 0,44 gegen SEINE 0,58 abgewertet',
    highPart && highPart[1] < 100 && highPart[1] > 0, String(highPart && highPart[1]));
  ok('ohne Phasenhistorie entfaellt der Beitrag ersatzlos',
    !(Calc.readiness(M({ sleepMin: 420 }), b).parts || []).some(p => p[0] === 'Schlafphasen'));
  ok('die Phasen wiegen bewusst wenig (unsicherste Groesse: Handgelenkmessung)',
    (Calc.readiness(M({ sleepMin: 420 }), Object.assign({}, b, { phaseShareToday: 0.42, phaseShareBase: 0.42 })).parts || [])
      .filter(p => p[0] === 'Schlafphasen')[0][2] === 6);
  ok('die Phasen-Historie braucht 14 eigene Naechte', /if\s*\(shares\.length<14\)/.test(uiSrc2) || /shares\.length<14/.test(uiSrc2));
}

/* ══════════════════════════════════════════════════════════════ */
sec('S9 · v8-320 · Wiedereinstieg nach Krankheit statt Ja/Nein');
{
  /* BEFUND: `illness` war ein Ja/Nein. An dem Tag, an dem der Haken verschwand,
     war man sofort wieder voll belastbar — der Score sprang von gedeckelt auf
     ungebremst. Nach einem Infekt steigt die Belastbarkeit graduell. */
  ok('illnessReturnWindow ist exportiert und pur', typeof Calc.illnessReturnWindow === 'function');
  const w = (since, dur) => Calc.illnessReturnWindow(since, dur);
  ok('ohne Krankheit kein Fenster', w(null, 0).inWindow === false && w(null, 5).inWindow === false);
  ok('waehrend der Krankheit selbst kein Fenster (die bestehenden Deckel greifen)',
    w(0, 4).inWindow === false);
  ok('am ersten Tag danach ist das Fenster offen und deutlich gebremst',
    w(1, 4).inWindow === true && w(1, 4).ceiling <= 70, String(w(1, 4).ceiling));
  const ramp = [1, 2, 3, 4].map(d => w(d, 4).ceiling);
  ok('die Obergrenze steigt ueber das Fenster monoton an',
    ramp.every((v, i) => i === 0 || v > ramp[i - 1]), ramp.join(' → '));
  ok('nach dem Fenster ist die Bremse vollstaendig weg',
    w(5, 4).inWindow === false && w(5, 4).ceiling === 100);
  /* [A] Faustregel: etwa ein Tag je Krankheitstag, gedeckelt bei 7. */
  ok('die Fensterlaenge folgt der Krankheitsdauer', w(1, 1).days === 1 && w(1, 3).days === 3);
  ok('… ist aber bei 7 Tagen gedeckelt (lange Krankheit bremst nicht wochenlang)',
    w(1, 14).days === 7 && w(1, 30).days === 7, w(1, 30).days + ' Tage');
  ok('gleiche Eingabe ⇒ gleiche Ausgabe (pur)',
    JSON.stringify(w(2, 5)) === JSON.stringify(w(2, 5)));
  /* Die Scheinunterscheidung, die beim Durchmessen aufgefallen ist. */
  ok('kein eigenes blocksHard mehr — der Zustand traegt die Schutzwirkung',
    w(1, 4).blocksHard === undefined);

  /* End-to-end: Zustand, Score und Begruendung. */
  const ctxB = { rhrBase: 55, sleepBase: 420, sleepSd: 40, bbBase: 75 };
  const day = (since, dur) => {
    const r = Calc.readiness(M({ sleepMin: 420 }), ctxB);
    const d = Calc.buildTrainingDecision({
      checkin: { pain: 0, doms: 0, sleepH: 7, sleepQ: 8, feel: 8, stress: 'Low', hrv: 'Balanced',
        readiness: r.score, illness: since === 0, illSinceEnd: since, illDuration: dur },
      loads: { load3: 100, load7: 100 }, plannedToday: { t: 'Laufen', l: 'Intervalle', d: 'iv' },
      components: { recovery: r.score } });
    const ds = Calc.dayStateEngine({ pain: 0, doms: 0, sleepH: 7, sleepQ: 8, feel: 8, stress: 'Low',
      hrv: 'Balanced', readiness: r.score, illness: since === 0, illSinceEnd: since, illDuration: dur });
    return { state: d.dayState, score: d.score, hard: ds.allow.hard, reasons: ds.reasons };
  };
  const series = [1, 2, 3, 4, 5].map(d => day(d, 4).score);
  ok('DER ALTE FEHLER: kein Sprung von gedeckelt auf ungebremst mehr',
    series.every((v, i) => i === 0 || v >= series[i - 1]) && series[0] < series[4],
    series.join(' · '));
  ok('der Score steigt ueber das Fenster in mehreren Stufen', new Set(series).size >= 4, series.join(' · '));
  ok('waehrend des ganzen Fensters keine harten Einheiten',
    [1, 2, 3, 4].every(d => day(d, 4).hard === false));
  ok('… und danach wieder frei', day(5, 4).hard === true);
  ok('der Grund wird benannt, nicht nur die Zahl gesenkt',
    /Wiedereinstieg nach Krankheit \(Tag 2 von 4\)/.test(day(2, 4).reasons.join(' | ')),
    day(2, 4).reasons.join(' | '));
  ok('ohne Krankheitsverlauf bleibt alles beim bisherigen Verhalten',
    day(null, 0).state === 'GREEN' && day(null, 0).hard === true);
  ok('am Krankheitstag selbst gilt weiterhin der harte Deckel', day(0, 4).score <= 55,
    String(day(0, 4).score));
  /* Eine Erkaeltung vor drei Wochen darf heute nichts mehr bremsen. */
  ok('eine lange zurueckliegende Krankheit bremst nicht mehr',
    day(20, 4).state === 'GREEN' && day(20, 4).score === day(null, 0).score);
  /* LUECKE, DIE DIE MUTATIONSPROBE AUFDECKTE (zum zweiten Mal dieselbe Klasse):
     Der Test baut den checkin selbst und prueft damit nur calc.js. WER den
     Verlauf ueberhaupt hineingibt, steht in ui.js — faellt die Verdrahtung weg,
     bleibt calc.js korrekt und der Test gruen, waehrend im Produkt gar nichts
     mehr passiert. Deshalb hier ausdruecklich die Kette. */
  const uiSrc3 = readFileSync(join(APP, 'js/ui.js'), 'utf8');
  ok('recoveryCtx leitet den Krankheitsverlauf ab',
    /illSinceEnd:illSinceEnd,illDuration:illDuration/.test(uiSrc3));
  ok('… und getDecision reicht ihn an die Engine weiter',
    /illSinceEnd:\(ctx\?ctx\.illSinceEnd:null\),illDuration:\(ctx\?ctx\.illDuration:0\)/.test(uiSrc3));
  ok('… nur die letzte zusammenhaengende Krankheitsphase zaehlt (nicht irgendeine im Monat)',
    /const last=Math\.min\.apply\(null,illDays\)/.test(uiSrc3));
}

console.log('\ndaily_score_continuity: ' + (fail === 0 ? 'ALL PASSED' : fail + ' FAILED') + ' (' + pass + ' ok)');
process.exit(fail === 0 ? 0 : 1);
