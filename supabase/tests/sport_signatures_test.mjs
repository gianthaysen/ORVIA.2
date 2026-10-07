/* ============================================================
   ORVIA · sport_signatures (v8-446) — jede Sportart des Katalogs hat eine Signatur
   ------------------------------------------------------------
   Gians Auftrag 6.10. („Activity Experience Architecture"): Das Bildsystem darf nicht nur
   fuer Laufen / Rad / Schwimmen / Kraft gelten. Die Sportarten-Liste im CODE ist die
   Wahrheit — kommt eine Sportart dazu, muss das auffallen.

   Wahrheit ist onboardingSportsLogic.SPORT_CATALOG (24 Eintraege). Dieser Test schlaegt an,
   wenn dort eine Sportart steht, die in js/sport-signatures.js keinen Eintrag hat
   (oder umgekehrt), und haelt fest, was eine Signatur mindestens sagen muss.

   A  Abdeckung: Katalog ⇄ Signaturen, auch die acht, die normSport auf „other" legt
   B  Inhalt eines Eintrags; keine Sportart erbt stillschweigend die Lauf-Signatur
   C  Stand der Umsetzung: was gezeichnet ist, steht hier UND in ui.js gleich
   D  Uebrige Registry-Abdeckung je Sportart: Name, Farbthema, Eingabeschema
   node supabase/tests/sport_signatures_test.mjs
   ============================================================ */
import fs from 'fs';
import { existsSync as _exApp } from 'node:fs';
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const rd = f => fs.readFileSync(new URL(_APPREL + f, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const sec = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 58 - t.length)));
const J = v => JSON.stringify(v);

globalThis.window = globalThis; globalThis.ORVIA = {};
const imp = async f => (await import(new URL(_APPREL + f, import.meta.url))).default;
await imp('js/training-domain.js'); const TD = globalThis.ORVIA.trainingDomain;
const SL = await imp('js/onboarding/onboarding-sports-logic.js'); globalThis.ORVIA.onboardingSportsLogic = SL;
const TH = await imp('js/activity-theme.js');
const AC = await imp('js/activity-config.js');
const SG = await imp('js/sport-signatures.js');
const CAT = SL.SPORT_CATALOG, IDS = CAT.map(s => s.id);

sec('A · Abdeckung');
{
  const a = SG.audit();
  ok('A1 der Katalog im Code hat ' + IDS.length + ' Sportarten — jede hat einen Signatur-Eintrag', a.known && a.missing.length === 0, 'ohne Eintrag: ' + a.missing.join(', '));
  ok('A2 kein Eintrag ohne Sportart im Katalog', a.orphan.length === 0 && SG.ids().length === IDS.length, 'verwaist: ' + a.orphan.join(', '));
  const plus = SG.audit(IDS.concat(['kitesurfen']));
  ok('A3 eine NEUE Katalog-Sportart ohne Eintrag wird gemeldet (hier nachgestellt: „kitesurfen")', plus.ok === false && J(plus.missing) === J(['kitesurfen']));
  const minus = SG.audit(IDS.filter(x => x !== 'golf'));
  ok('A4 eine aus dem Katalog entfernte Sportart wird als verwaister Eintrag gemeldet', minus.ok === false && J(minus.orphan) === J(['golf']));
  const collapsed = IDS.filter(id => TD.normSport(id) === 'other' && id !== 'other');
  /* v8-447: bis v8-446 legte normSport acht Katalog-Sportarten auf „other"; jetzt keine mehr. */
  ok('A5 keine Katalog-Sportart faellt in normSport auf „other" — und jede behaelt ihre eigene Signatur', collapsed.length === 0 && IDS.filter(id => id !== 'other').every(id => SG.get(id).sportId === id && SG.get(id).status !== 'fallback'), collapsed.join(','));
  ok('A6 Anzeigenamen und Schreibweisen fuehren zur richtigen Sportart; Unbekanntes und Leeres zum dokumentierten Rueckfall',
    SG.get('Laufen').sportId === 'running' && SG.get('Krafttraining').sportId === 'gym' && SG.get(' RADFAHREN ').sportId === 'cycling' && SG.get('soccer').sportId === 'football'
    && SG.get('unterwasserrugby').sportId === 'other' && SG.get(null).sportId === 'other' && SG.get('').sportId === 'other');
  ok('A7 has() fragt genau nach der Katalog-ID (keine Alias-Aufloesung)', SG.has('running') && !SG.has('Laufen') && !SG.has('kitesurfen'));
}

sec('B · Inhalt');
{
  const all = IDS.map(id => SG.get(id));
  ok('B1 jeder Eintrag nennt Familie, Bewegung und einen gueltigen Stand', all.every(d => d.family && d.motion && ['implemented', 'defined', 'fallback'].indexOf(d.status) >= 0));
  const fb = all.filter(d => d.status === 'fallback');
  ok('B2 genau EIN bewusster Rueckfall („other") — und er sagt, warum', fb.length === 1 && fb[0].sportId === 'other' && fb[0].reason && fb[0].reason.length > 30, J(fb.map(d => d.sportId)));
  const pairs = all.map(d => d.family + '/' + d.motion);
  ok('B3 keine zwei Sportarten tragen dieselbe Signatur (Familie + Bewegung ist eindeutig)', new Set(pairs).size === pairs.length, pairs.filter((p, i) => pairs.indexOf(p) !== i).join(','));
  ok('B4 keine Sportart wird stillschweigend wie Laufen behandelt: nur Laufen hat „alternating-impact"; Gehen teilt die Familie, hat aber eine eigene Bewegung und sagt das',
    all.filter(d => d.motion === 'alternating-impact').length === 1 && SG.get('walking').family === 'stride' && SG.get('walking').motion !== SG.get('running').motion && !!SG.get('walking').note);
  ok('B5 Mannschafts- und Rueckschlagsportarten haben je eine eigene Geometrie', ['football', 'handball', 'basketball', 'volleyball', 'hockey', 'rugby', 'tennis', 'padel', 'badminton'].every(id => SG.get(id).family !== 'stride' && SG.get(id).family !== 'pulse'));
  ok('B6 drei Zustaende sind benannt: static, ambient, reactive', J(SG.STATES) === J(['static', 'ambient', 'reactive']));
  ok('B7 datenreaktiv nur, wo der Messwert heute wirklich gespeichert wird — sonst steht der Grund dabei',
    all.every(d => !d.reactiveReady || !!d.reactiveMetric) && SG.get('swimming').reactiveReady === false && !!SG.get('swimming').note && SG.get('running').reactiveReady === false && !!SG.get('running').note && SG.get('cycling').reactiveReady === false && !!SG.get('cycling').note);
  ok('B8 mindestens zehn verschiedene Bildideen (Familien)', SG.families().length >= 10, SG.families().join(', '));
}

sec('C · Stand der Umsetzung');
{
  const ui = rd('js/ui.js'), css = rd('styles.css');
  const impl = IDS.filter(id => SG.get(id).status === 'implemented');
  ok('C1 gezeichnet ist heute genau eine Signatur: Schwimmen (Wellenfeld)', J(impl) === J(['swimming']) && SG.renderer('swimming') === 'waves');
  ok('C2 fuer alle anderen gibt es noch keinen Zeichner — die App zeigt dort wie bisher nichts Erfundenes', IDS.filter(id => id !== 'swimming').every(id => SG.renderer(id) === null && SG.get(id).states.length === 0));
  ok('C3 angebotene Zustaende von Schwimmen: static + ambient (reactive erst mit Zugfrequenz)', J(SG.get('swimming').states) === J(['static', 'ambient']));
  ok('C4 ui.js entscheidet ueber den Zeichner NUR ueber das Register (zwei Stellen: Seite und Highlights)',
    (ui.match(/gmActSignatureRenderer\(vm\.sportId\)==='waves'/g) || []).length === 2 && !/gmActThemeId\(vm\.sportId\)==='swimming'/.test(ui) && /S\.renderer\(sportId\)/.test(ui));
  const names = Array.from(new Set(IDS.map(id => SG.renderer(id)).filter(Boolean)));
  ok('C5 jeder im Register genannte Zeichner existiert in ui.js', names.every(n => new RegExp("gmActSignatureRenderer\\(vm\\.sportId\\)==='" + n + "'").test(ui)) && /function gmActWaves\(/.test(ui), names.join(','));
  ok('C6 „Bewegung reduzieren": das Wellenfeld steht dann still und ist vollstaendig gezeichnet', /@media \(prefers-reduced-motion:reduce\)\{\.act-waves path\{animation:none;stroke-dashoffset:0\}/.test(css));
  ok('C7 das Wellenfeld ist rein dekorativ (aria-hidden) — Bewegung ist nie Voraussetzung fuers Verstehen', (ui.match(/class="(?:act-hero|wst-waves) act-waves" aria-hidden="true"/g) || []).length === 2);
  ok('C8 Modul ist geladen und liegt im Vorrat des Service Workers', /<script src="js\/sport-signatures\.js"><\/script>/.test(rd('index.html')) && /'\.\/js\/sport-signatures\.js'/.test(rd('sw.js')));
}

sec('D · Uebrige Abdeckung je Sportart');
{
  ok('D1 jede Sportart hat einen deutschen Anzeigenamen (Katalog) — sportLabel liefert ihn', CAT.every(s => s.label && AC.sportLabel(s.id) === s.label));
  const themes = TH.themes();
  const own = IDS.filter(id => TH.id(id) !== TH.FALLBACK);
  ok('D2 jede Sportart loest zu einem Farbthema auf; ohne eigenes Thema gilt der dokumentierte Rueckfall „brand"', IDS.every(id => themes.indexOf(TH.id(id)) >= 0), 'eigenes Thema: ' + own.join(', '));
  ok('D3 Stand Farbthemen (bewusst festgehalten): eigene Farbe haben 7 von 24 — die uebrigen 17 tragen ORVIA-Gold, bis sie eine bekommen', own.length === 7 && J(own.slice().sort()) === J(['cycling', 'gym', 'hiking', 'rowing', 'running', 'swimming', 'walking']), own.join(','));
  ok('D4 jede Sportart hat ein Eingabeschema (welche Felder sie kennt)', IDS.every(id => { const f = AC.formSchemaForSport(id); return f && (f.sportId === id || id === 'other'); }));
  ok('D5 jede Sportart nennt ihr Kennzahlen-Profil (metricsProfile) im Katalog', CAT.every(s => typeof s.metricsProfile === 'string' && s.metricsProfile.length > 0));
}

console.log('\n' + (fail ? '❌' : '✅') + ' sport_signatures: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
