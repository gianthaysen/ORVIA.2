/* ============================================================
   ORVIA · visual_v3 — Feinschliff der Gestaltungssprache (v8-444)
   Gians Auftrag 6.10. abends („visual refinement V3"): kein Umbau, keine Logik — die App soll als EIN System
   lesbar werden. Dieser Test haelt die REGELN fest (der echte Browserlauf steht in visual_v3_e2e_test.mjs):
     · die V3-Sprache steht an EINER Stelle (Block am Ende von styles.css), mit festen Bausteinen
     · Gold kennzeichnet Rahmen/Bedienung und ORVIAs eigene Stimme — nie Daten (Strecke, Kurve, Kennzahl)
     · Sportfarben, Start/Ziel und Zahlen bleiben unberuehrt
     · das Wellenfeld ist reine Zeichnung (keine Daten), nur fuer Schwimmen ohne Strecke
     · keine Unschaerfe-Flaechen, keine Masken ueber bewegten Zeichnungen
   node supabase/tests/visual_v3_test.mjs
   ============================================================ */
import fs from 'fs';
import vm from 'node:vm';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const APP = fileURLToPath(new URL(_APPREL, import.meta.url));
const rd = f => fs.readFileSync(join(APP, f), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const css = rd('styles.css'), ui = rd('js/ui.js');
const iV3 = css.indexOf('v8-444 · ORVIA V3');
/* Der V3-Block endet am naechsten Versions-Block (v8-445 haengt die Stile des Dauer-Dialogs an). */
const iNext = iV3 > 0 ? css.indexOf('/* ====', iV3 + 400) : -1;
const v3 = iV3 > 0 ? css.slice(css.lastIndexOf('/*', iV3), iNext > 0 ? iNext : css.length) : '';
const rules = v3.replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------- A) Bausteine ---------- */
{
  ok('A1 die V3-Sprache steht als EIN zusammenhaengender Block in styles.css (danach nur spaetere Versions-Bloecke)', iV3 > 0 && v3.length > 4000 && css.indexOf('v8-444 · ORVIA V3', iV3 + 20) < 0 && (iNext < 0 || /v8-4[4-9]\d · /.test(css.slice(iNext, iNext + 200))), String(v3.length));
  ok('A2 Gold-Stufen nach Vorgabe: 10 %, 16 %, 24 % — und nur diese drei als Bausteine', /--orvia-gold-10:rgba\(216,187,122,0\.10\);--orvia-gold-16:rgba\(216,187,122,0\.16\);--orvia-gold-24:rgba\(216,187,122,0\.24\);/.test(rules) && (rules.match(/--orvia-gold-\d+:/g) || []).length === 3);
  ok('A3 Gold-Haarlinie: 1 Baustein, laeuft zu beiden Seiten aus (0 → 24 % → 24 % → 0)', /--orvia-hairline:linear-gradient\(90deg,transparent 0,var\(--orvia-gold-24\) 22%,var\(--orvia-gold-24\) 78%,transparent 100%\);/.test(rules));
  ok('A4 EIN Material fuer Tafeln (Verlauf, Rand, helle Oberkante + weicher Schatten) und EINES fuer Bedienelemente', /--orvia-panel-bg:linear-gradient\(180deg,rgba\(255,255,255,\.045\) 0,rgba\(255,255,255,\.012\) 100%\);/.test(rules) && /--orvia-panel-border:rgba\(150,172,198,\.15\);/.test(rules) && /--orvia-panel-shadow:inset 0 1px 0 rgba\(255,255,255,\.06\),/.test(rules) && /--orvia-ctl-bg:linear-gradient\(/.test(rules) && /--orvia-ctl-shadow:inset 0 1px 0 rgba\(255,255,255,\.08\),/.test(rules));
  ok('A5 Zurueck-Knopf, Story schliessen, Kartenknoepfe und Oeffnen-Zeichen teilen sich EINE Regel (Flaeche, Goldrand der Ruhe, Schatten)', /#gmActPage \.backbtn,\.gm-story \.wst-x,\.rmv-btn,\.route-map \.rmx-open\{\s*background:var\(--orvia-ctl-bg\);border:1px solid var\(--map-gold-rest\);box-shadow:var\(--orvia-ctl-shadow\);color:var\(--orvia-text-primary\)\}/.test(rules) && /--map-gold-rest:rgba\(216,187,122,0\.16\);/.test(css));
  ok('A6 Kennzahl-Kacheln, Karten der Seite, Story-Kacheln: alle aus dem Tafel-Material', /#gmActPage \.detail-kpis div\{[^}]*background:var\(--orvia-panel-bg\),var\(--orvia-surface-1\);\s*border:1px solid var\(--orvia-panel-border\);box-shadow:var\(--orvia-panel-shadow\)\}/.test(rules) && /#gmActPage \.card\{background:var\(--orvia-panel-bg\),var\(--orvia-surface-1\);border-color:var\(--orvia-panel-border\);box-shadow:var\(--orvia-panel-shadow\)\}/.test(rules) && /\.gm-story \.wst-cell,\.gm-story \.wst-ex\{background:var\(--orvia-panel-bg\),var\(--orvia-surface-1\);border:1px solid var\(--orvia-panel-border\);box-shadow:var\(--orvia-panel-shadow\)\}/.test(rules));
}

/* ---------- B) Wo Gold steht — und wo nie ---------- */
{
  /* jede Regel des Blocks, die Gold benutzt */
  const blocks = rules.split('}').map(r => r.trim()).filter(r => r && r.indexOf('{') > 0).map(r => ({ sel: r.slice(0, r.indexOf('{')).trim(), body: r.slice(r.indexOf('{') + 1) }));
  const gold = blocks.filter(b => /gold|hairline|216,187,122/i.test(b.body) && b.sel !== ':root');
  const DATA = /\.wst-line|\.wst-glow|\.wst-area|\.wst-em|\.rmx-line|\.rmx-case|\.rmx-start|\.rmx-end|\.detail-kpis b|\.wst-cell b|\.wst-heronum b|\.wst-bignum b|\.act-waves path|\.act-wvg/;
  ok('B1 Gold steht nur an Rahmen, Bedienung, Haarlinien, Kennzeichen-Strich der Story und ORVIAs Stimme (Story-Knopf, Debrief) — an KEINER Datenregel (Kurve, Strecke, Zahl, Wellen)', gold.length >= 10 && gold.every(b => !DATA.test(b.sel)), gold.filter(b => DATA.test(b.sel)).map(b => b.sel).join(' | ') || gold.length + ' Regeln');
  ok('B2 der Block legt keine Sportfarbe fest und aendert weder Start/Ziel noch die Streckenmasse', !/#FF9A5C|#5DAAFF|#48D8CF|#43D69E|#FF6464/i.test(rules) && !/--(run|bike|swim|strength)-|--orvia-route-|\.rmx-(line|case|start|end)\b/.test(rules));
  ok('B3 Kennzeichen-Strich: auf der Seite in der Farbe der Sportart (currentColor), in der Story in Gold', /#gmActPage \.plan-kicker::before\{[^}]*width:14px;height:1\.5px;[^}]*background:currentColor\}/.test(rules) && /\.gm-story \.wst-kick:not\(\.pr\)::before\{[^}]*width:16px;height:1px;background:var\(--orvia-brand-gold\);opacity:\.8\}/.test(rules));
  ok('B4 Fortschritt der Story: goldene Spitze nur am laufenden Abschnitt', /\.gm-story \.wst-bars i\.act b\{background:linear-gradient\(90deg,rgba\(244,242,237,\.92\) 0,rgba\(244,242,237,\.92\) 58%,var\(--map-gold-light\) 100%\)\}/.test(rules) && /\.gm-story \.wst-bars i b\{border-radius:3px;background:rgba\(244,242,237,\.92\)\}/.test(rules));
  ok('B5 die Bestzeit-Seite der Story (.pr) behaelt ihren eigenen Grund und ihr eigenes Kennzeichen', /\.gm-story \.wst-bg:not\(\.pr\)\{/.test(rules) && /\.gm-story \.wst-kick:not\(\.pr\)\{/.test(rules) && !/\.wst-bg\.pr|\.wst-kick\.pr/.test(rules));
  ok('B6 keine Unschaerfe-Flaechen (backdrop-filter) und keine Masken im ganzen Block', !/backdrop-filter/.test(rules) && !/mask-image|mask:/.test(rules));
  ok('B7 Bewegung reduziert: Wellen stehen sofort, nichts blendet ein', /@media \(prefers-reduced-motion:reduce\)\{\.act-waves path\{animation:none;stroke-dashoffset:0\}/.test(rules));
}

/* ---------- C) Wellenfeld (Schwimmen ohne Strecke) ---------- */
{
  const a = ui.indexOf('var _gmActWaveSeq=0;'), b = ui.indexOf('/* GM-SVG-Visualisierung');
  const c = { Math, String };
  vm.createContext(c); vm.runInContext(ui.slice(a, b) + ';this.gmActWaves=gmActWaves;', c);
  const W = c.gmActWaves;
  const s1 = W(390, 150, 7, 'x'), s2 = W(390, 150, 7, 'x');
  const paths = s1.match(/<path [^>]*>/g) || [];
  ok('C1 reine Zeichnung: gleiche Eingabe ⇒ gleiche Ausgabe; n Linien; ohne Namen wird gezaehlt (eindeutige Verlaeufe im Dokument)', s1 === s2 && paths.length === 7 && (W(390, 300, 9).match(/<path /g) || []).length === 9 && W(390, 150, 7) !== W(390, 150, 7) && /id="actWv\d+"/.test(W(390, 150, 7)));
  const ys = paths.map(p => { const pts = /d="([^"]+)"/.exec(p)[1].split(' L').map(q => q.replace('M', '').split(',').map(Number)); const y = pts.map(q => q[1]); return { mid: (Math.max(...y) + Math.min(...y)) / 2, amp: (Math.max(...y) - Math.min(...y)) / 2, x0: pts[0][0], x1: pts[pts.length - 1][0], n: pts.length, minY: Math.min(...y), maxY: Math.max(...y) }; });
  const op = paths.map(p => +/--wo:([\d.]+)/.exec(p)[1]);
  ok('C2 Perspektive: von oben nach unten weiterer Abstand, hoehere Welle, kraeftigere Linie', ys.every((y, i) => i === 0 || (y.mid > ys[i - 1].mid && y.amp >= ys[i - 1].amp - 0.01 && op[i] > op[i - 1])) && (ys[6].mid - ys[5].mid) > (ys[1].mid - ys[0].mid) * 2, JSON.stringify([ys.map(y => +y.mid.toFixed(0)), op]));
  ok('C3 die Linien laufen ueber die ganze Breite und bleiben in der Flaeche (kein Anschnitt oben/unten)', ys.every(y => y.x0 === 0 && y.x1 === 390 && y.n === 73 && y.minY >= 4 && y.maxY <= 146), JSON.stringify([ys[0].minY, ys[6].maxY]));
  ok('C4 Farbe kommt aus dem Thema (Verlauf im Strich, Farbe per CSS), seitlicher Auslauf 0 → 1 → 1 → 0; kein Farbwert im Markup', /<linearGradient id="x" class="act-wvg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="390" y2="0"><stop offset="0" stop-opacity="0"\/><stop offset="0\.16" stop-opacity="1"\/><stop offset="0\.84" stop-opacity="1"\/><stop offset="1" stop-opacity="0"\/><\/linearGradient>/.test(s1) && paths.every(p => /stroke="url\(#x\)"/.test(p)) && !/#[0-9A-Fa-f]{6}|rgb\(/.test(s1) && /\.act-wvg stop\{stop-color:var\(--activity-primary\)\}/.test(rules));
  ok('C5 unsinnige Eingaben werden abgefangen (Breite/Hoehe ≤ 0, Linienzahl 0 oder 99; Name wird entschaerft)', /viewBox="0 0 390 150"/.test(W(0, -5, 7, 'a')) && (W(390, 150, 0, 'a').match(/<path /g) || []).length === 7 && (W(390, 150, 99, 'a').match(/<path /g) || []).length === 12 && /id="ab"/.test(W(390, 150, 7, 'a"<b')));
  ok('C6 Aktivitaetsseite: Wellenfeld NUR fuer die Signatur „waves" (Schwimmen, js/sport-signatures.js) und NUR ohne Karte — im selben Platz, rein dekorativ', /if\(run\|\|route\)\{[\s\S]{0,700}?\}\s*\/\*[\s\S]*?\*\/\s*else if\(gmActSignatureRenderer\(vm\.sportId\)==='waves'\)\{\s*h\+='<div class="act-hero act-waves" aria-hidden="true">'\+gmActWaves\(390,150,7\)\+'<\/div>';\s*\}/.test(ui));
  ok('C7 Story-Abschluss: Wellenfeld nur ohne Strecke und nur fuer Schwimmen; die Zahl bleibt die echte Distanz', /var _waves=\(!coverPage&&!route&&gmActSignatureRenderer\(vm\.sportId\)==='waves'\)\?'<div class="wst-waves act-waves" aria-hidden="true">'\+gmActWaves\(390,300,9\)\+'<\/div>':'';/.test(ui) && /pages\.push\(coverPage\|\|page\(_waves\+'<div class="wst-kick'/.test(ui));
  ok('C8 eigene Ebene statt Maske; Deckkraft je Linie als stroke-opacity', /#gmActPage \.act-hero\{position:relative;height:150px;overflow:hidden;transform:translateZ\(0\)\}/.test(rules) && /\.gm-story \.wst-waves\{[^}]*transform:translate3d\(0,-46%,0\);z-index:0;pointer-events:none\}/.test(rules) && /\.act-waves path\{[^}]*stroke-opacity:var\(--wo,\.4\);/.test(rules) && !/\.act-waves path\{[^}]*[^-]opacity:var/.test(rules));
}

/* ---------- D) Seite und Story: Markup ---------- */
{
  const iStory = ui.indexOf('class="cta wide-ghost gm-story-cta"'), iCorr = ui.indexOf('<div class="gm-corr"');
  ok('D1 Story-Knopf steht im Quelltext VOR den Korrekturwegen und traegt eine eigene Klasse', iStory > 0 && iCorr > iStory, [iStory, iCorr].join(' '));
  ok('D2 die drei Korrekturwege bleiben getrennt und unveraendert verdrahtet (Loesen ≠ Loeschen)', /unlinkActivityPlanCanonical\(/.test(ui.slice(iCorr, iCorr + 900)) && /deleteActivityCanonical\(/.test(ui.slice(iCorr, iCorr + 900)) && (ui.match(/onclick="deleteActivityCanonical\(/g) || []).length === 1);
  ok('D3 Abschluss mit Strecke: die Hauptzahl bekommt ihren Namen (Distanz bzw. Dauer) — nur wenn es eine Hauptzahl gibt', /\(_dm\?'<div class="wst-kick">'\+gmEsc\(vm\.distanceLabel\?_uiT\('ui\.distanz_'\):'Dauer'\)\+'<\/div>':''\)\+\s*\(_dm\?'<div class="wst-heronum">/.test(ui));
  ok('D4 Textlink „Dauer korrigieren" hat eine Klasse statt Browser-Blau', /class="gm-inline-link" style="font-weight:700">' \+ _uiT\('ui\.dauer_korrigieren'\)/.test(ui) && /#gmActPage \.gm-inline-link\{color:var\(--orvia-text-primary\);text-decoration:underline;text-decoration-color:var\(--orvia-gold-24\);/.test(rules));
  ok('D5 Diagramm-Tafel: Raster aus Punkten, senkrechte Linien zurueckgenommen, Kurve 2,2 px, Schein weicher', /\.gm-story \.wst-grid line\{stroke-dasharray:1 5;stroke-linecap:round\}/.test(rules) && /\.gm-story \.wst-grid line\[y1="0"\]\{opacity:\.45\}/.test(rules) && /\.gm-story \.wst-line\{stroke-width:2\.2\}/.test(rules) && /\.gm-story \.wst-halo\{-webkit-filter:blur\(5px\);filter:blur\(5px\);opacity:\.8\}/.test(rules));
  ok('D6 der Diagramm-Aufbau selbst ist unveraendert (5 waagerechte + 8 senkrechte Rasterlinien, Max/Min/Ø in der Flaeche)', /for\(g=1;g<=5;g\+\+\)\{var gy=/.test(ui) && /for\(g=1;g<=8;g\+\+\)\{var gx=/.test(ui) && /class="wst-avgpill"/.test(ui) && /class="wst-ref wst-refmax'/.test(ui));
}
console.log('\n' + (fail ? '❌' : '✅') + ' visual_v3: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
