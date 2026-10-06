/* ============================================================
   ORVIA · activity_theme — Farbsystem v6 (v8-439)
   Gians Auftrag 5.10.: EIN Farbsystem fuer die Sportarten statt mehrerer Tabellen.
     · Werte stehen an EINER Stelle (styles.css), genau wie im Auftrag vorgegeben
     · Bausteine benutzen nur --activity-*, nie --run-primary & Co.
     · die Zuordnung Sportart → Thema steht an EINER Stelle (js/activity-theme.js)
     · keine fest verdrahteten Sportfarben mehr in den Bausteinen
     · Start/Ziel und Zustaende sind nie sportartspezifisch
   Der echte Browserlauf (berechnete Farben je Sportart) steht in activity_theme_e2e_test.mjs.
   node supabase/tests/activity_theme_test.mjs
   ============================================================ */
import fs from 'fs';
import vm from 'node:vm';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const _APPREL = existsSync(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const APP = fileURLToPath(new URL(_APPREL, import.meta.url));
const rd = f => fs.readFileSync(join(APP, f), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i != null ? '  — ' + i : '')); c ? pass++ : fail++; };
const css = rd('styles.css'), ui = rd('js/ui.js'), src = rd('js/activity-theme.js'), idx = rd('index.html'), sw = rd('sw.js');
const rm = rd('js/route-map.js'), rmv = rd('js/route-map-view.js'), act = rd('js/activity.js'), charts = rd('js/orvia-charts.js');

/* Modul wie im Browser laden: erst die Sport-Normalisierung, dann das Farbthema */
const c = { ORVIA: {}, console, String, Object, Array, Math, JSON };
c.window = c; c.globalThis = c; vm.createContext(c);
vm.runInContext(rd('js/training-domain.js'), c);
vm.runInContext(src, c);
const T = c.ORVIA.activityTheme;

/* ---------- A) Zuordnung Sportart → Thema ---------- */
{
  const m = s => T.id(s);
  ok('A1 kanonische Sport-IDs: Laufen, Rad, Schwimmen, Kraft', m('running') === 'running' && m('cycling') === 'cycling' && m('swimming') === 'swimming' && m('gym') === 'strength');
  ok('A2 Anzeigenamen und Import-Bezeichnungen landen auf demselben Thema (bestehende Alias-Tabelle der Sport-Normalisierung)',
    ['run', 'Laufen', 'lauf', 'RUNNING'].every(s => m(s) === 'running') && ['ride', 'Radfahren', 'rad', 'bike'].every(s => m(s) === 'cycling') &&
    ['swim', 'Schwimmen'].every(s => m(s) === 'swimming') && ['strength', 'Kraft', 'Krafttraining', 'strength_training', 'weight_training'].every(s => m(s) === 'strength'),
    JSON.stringify(['run', 'Laufen', 'ride', 'Radfahren', 'swim', 'Schwimmen', 'Kraft', 'Krafttraining'].map(m)));
  ok('A3 Gehen, Wandern und Trail teilen das Lauf-Thema (wie bisher die Story)', ['walking', 'hiking', 'trail_running', 'Wandern', 'Gehen'].every(s => m(s) === 'running'));
  ok('A4 Rudern behaelt sein bestehendes Thema', m('rowing') === 'rowing' && m('Rudern') === 'rowing');
  ok('A5 Sportarten ohne eigenes Thema ⇒ ORVIA-Gold („brand"), nie ein geratenes Thema', ['football', 'Fußball', 'mobility', 'triathlon', 'tennis', 'other', 'Sonstiges', 'xyz', '', null, undefined, 42].every(s => m(s) === 'brand'));
  ok('A6 attr() liefert das Attribut fuer den HTML-Bau; apply() setzt es am Element', T.attr('cycling') === 'data-activity="cycling"' && T.attr(null) === 'data-activity="brand"' &&
    (() => { const el = { a: {}, setAttribute(k, v) { this.a[k] = v; } }; T.apply(el, 'Laufen'); return el.a['data-activity'] === 'running' && T.apply(null, 'x') === null; })());
  ok('A7 cssVar(): Bausteine bekommen nur die allgemeinen Namen; unbekannte Rolle ⇒ primary', T.cssVar() === 'var(--activity-primary)' && T.cssVar('glow-strong') === 'var(--activity-glow-strong)' && T.cssVar('nope') === 'var(--activity-primary)' && T.PRIMARY === 'var(--activity-primary)');
  ok('A8 color(): Farbe EINER bestimmten Sportart fuer Uebersichten (Werte-Token, kein Farbwert)', T.color('running') === 'var(--run-primary)' && T.color('Radfahren', 'light') === 'var(--bike-light)' && T.color('swimming', 'tint-strong') === 'var(--swim-tint-strong)' &&
    T.color('gym') === 'var(--strength-primary)' && T.color('rowing') === 'var(--row-primary)' && T.color('football') === 'var(--orvia-brand-gold)' && T.color('football', 'glow') === 'var(--orvia-brand-glow)');
  ok('A9 das Modul enthaelt KEINEN Farbwert (weder Hex noch rgb) — Werte stehen nur in styles.css', !/#[0-9a-fA-F]{3,8}\b/.test(src.replace(/\/\*[^]*?\*\//g, '')) && !/rgba?\(/.test(src.replace(/\/\*[^]*?\*\//g, '')));
  ok('A10 read() ohne Dokument/Element ⇒ null (kein Fehler)', T.read(null, 'primary') === null && T.read({}, 'primary') === null);
}

/* ---------- B) Werte in styles.css — genau die Vorgabe ---------- */
const decl = (name) => { const m = new RegExp('(?:^|[;{\\s])' + name.replace(/[-]/g, '\\-') + ':([^;}]+)[;}]').exec(css); return m ? m[1].trim() : null; };
{
  const SPEC = {
    run: ['#FF9A5C', '#D97B3F', '#FFB47D', 'rgba(255,154,92,0.08)', 'rgba(255,154,92,0.14)', 'rgba(255,154,92,0.22)', 'rgba(255,154,92,0.32)'],
    bike: ['#5DAAFF', '#3D84D6', '#8AC2FF', 'rgba(93,170,255,0.08)', 'rgba(93,170,255,0.14)', 'rgba(93,170,255,0.22)', 'rgba(93,170,255,0.32)'],
    swim: ['#48D8CF', '#29ACA6', '#7BE7E0', 'rgba(72,216,207,0.08)', 'rgba(72,216,207,0.14)', 'rgba(72,216,207,0.22)', 'rgba(72,216,207,0.32)'],
    strength: ['#D8BB7A', '#B29458', '#E8D19A', 'rgba(216,187,122,0.08)', 'rgba(216,187,122,0.14)', 'rgba(216,187,122,0.20)', 'rgba(216,187,122,0.28)']
  };
  const ROLES = ['primary', 'secondary', 'light', 'tint', 'tint-strong', 'glow', 'glow-strong'];
  Object.keys(SPEC).forEach((p, i) => {
    const got = ROLES.map(r => decl('--' + p + '-' + r));
    ok('B' + (i + 1) + ' Werte „' + p + '" genau wie vorgegeben (7 Rollen)', JSON.stringify(got) === JSON.stringify(SPEC[p]), JSON.stringify(got));
  });
  const CORE = { 'bg-base': '#050910', 'bg-primary': '#070C14', 'bg-secondary': '#0B111A', 'surface-1': '#0E151F', 'surface-2': '#121B26', 'surface-3': '#17212D',
    'border-subtle': '#202A36', 'border-default': '#2B3643', 'border-strong': '#3B4857', 'text-primary': '#F4F2ED', 'text-secondary': '#ADB5C1', 'text-tertiary': '#737E8C', 'text-disabled': '#505966',
    'brand-gold': '#D8BB7A', 'brand-gold-soft': '#B99A5D', 'brand-gold-light': '#E8D19A', 'success': '#43D69E', 'warning': '#F1B75A', 'error': '#FF6464', 'info': '#67AFFF', 'neutral-info': '#8996A5' };
  const bad = Object.keys(CORE).filter(k => decl('--orvia-' + k) !== CORE[k]);
  ok('B5 Grundfarben und Zustandsfarben (--orvia-*) genau wie vorgegeben', bad.length === 0, bad.join(', '));
  ok('B6 jeder Werte-Name ist genau EINMAL definiert (eine Stelle)', ['run', 'bike', 'swim', 'strength', 'row'].every(p => ROLES.every(r => (css.match(new RegExp('--' + p + '-' + r + ':', 'g')) || []).length === 1)));
  ok('B7 Start und Ziel sind Zustandsfarben (Gruen/Rot), nicht Teil eines Sportart-Themas', decl('--orvia-route-start') === 'var(--orvia-success)' && decl('--orvia-route-finish') === 'var(--orvia-error)');
  ok('B8 die Farbwerte der Sportarten stehen in styles.css NUR im Werte-Block (je Hex genau einmal)', ['#FF9A5C', '#5DAAFF', '#48D8CF'].every(h => (css.match(new RegExp(h, 'gi')) || []).length === 1));
}

/* ---------- C) Zuordnung data-activity → --activity-* ---------- */
{
  const ROLES = ['primary', 'secondary', 'light', 'tint', 'tint-strong', 'glow', 'glow-strong'];
  const blk = t => (new RegExp('\\[data-activity="' + t + '"\\]\\{([^}]*)\\}').exec(css) || [])[1] || '';
  const MAP = { running: 'run', cycling: 'bike', swimming: 'swim', strength: 'strength', rowing: 'row' };
  Object.keys(MAP).forEach((t, i) => {
    const b = blk(t);
    ok('C' + (i + 1) + ' [data-activity="' + t + '"] setzt alle 7 Rollen aus --' + MAP[t] + '-*', ROLES.every(r => b.indexOf('--activity-' + r + ':var(--' + MAP[t] + '-' + r + ')') >= 0), b.slice(0, 80));
  });
  const br = blk('brand');
  ok('C6 [data-activity="brand"] = ORVIA-Gold (auch innerhalb eines Sportart-Bereichs)', /--activity-primary:var\(--orvia-brand-gold\)/.test(br) && /--activity-glow-strong:var\(--orvia-brand-glow-strong\)/.test(br) && ROLES.every(r => br.indexOf('--activity-' + r + ':') >= 0));
  const root = css.slice(css.indexOf('ORVIA FARBSYSTEM v6'), css.indexOf('[data-activity="running"]'));
  ok('C7 Vorgabe ohne data-activity: ORVIA-Gold (alle 7 Rollen in :root)', ROLES.every(r => new RegExp('--activity-' + r + ':var\\(--orvia-brand-').test(root)));
  ok('C8 jedes Thema des Moduls hat seinen Block in styles.css (und umgekehrt)', (() => { const inCss = [...css.matchAll(/\[data-activity="([a-z]+)"\]\{/g)].map(m => m[1]).sort(); return JSON.stringify(inCss) === JSON.stringify(Array.from(T.themes()).sort()); })(), JSON.stringify(Array.from(T.themes())));
  /* jede benutzte Variable des Systems ist auch definiert */
  const used = new Set([...(css + ui + rm + rmv + act + charts).matchAll(/var\(--((?:orvia|activity|run|bike|swim|strength|row)-[a-z0-9-]+)/g)].map(m => m[1]));
  const LEGACY = /^orvia-(glass|tab|fab|tabbar)/;   /* aeltere Layout-Tokens der Navigation — nicht Teil des Farbsystems */
  const undef = [...used].filter(n => !LEGACY.test(n) && !new RegExp('--' + n + ':').test(css));
  ok('C9 keine fehlende Variable: alles, was benutzt wird, ist definiert', undef.length === 0, undef.join(', '));
}

/* ---------- D) Bausteine kennen nur --activity-* ---------- */
{
  const body = css.slice(css.indexOf('[data-activity="brand"]'));          /* alles NACH dem Werte-/Zuordnungs-Block */
  ok('D1 kein Baustein in styles.css benutzt --run-/--bike-/--swim-/--strength-/--row- direkt', !/var\(--(run|bike|swim|strength|row)-/.test(body));
  const jsDirect = (s) => (s.replace(/\/\*[^]*?\*\//g, '').match(/var\(--(run|bike|swim|strength|row)-[a-z-]+\)/g) || []);
  const startLine = (/^var GM_START_SPORTS=.*$/m.exec(ui) || [''])[0];
  ok('D2 in den Bausteinen (JS) stehen Sportart-Tokens nur in der Start-Auswahl (Uebersicht ueber mehrere Sportarten)', jsDirect(ui.replace(startLine, '')).length === 0 && jsDirect(rm).length === 0 && jsDirect(rmv).length === 0 && jsDirect(act).length === 0 && jsDirect(charts).length === 0, jsDirect(ui.replace(startLine, '')).join(' '));
  /* Start-Auswahl: dieselben Tokens wie das Modul */
  const rows = (() => { const cc = {}; vm.createContext(cc); vm.runInContext(startLine + ';var __r=GM_START_SPORTS;', cc); return cc.__r; })();
  const want = { Laufen: 'running', Krafttraining: 'gym', Radfahren: 'cycling', Schwimmen: 'swimming' };
  ok('D3 Start-Auswahl: Laufen, Kraft, Rad, Schwimmen tragen genau die Farbe ihres Themas', rows.filter(r => want[r[0]]).length === 4 && rows.filter(r => want[r[0]]).every(r => r[2] === T.color(want[r[0]])), JSON.stringify(rows.map(r => r[2])));
  const OLD = ['#FF8A4C', '#FF9B52', '#4FB0FF', '#3ED6C4', '#35E6D2', '#F0D28A', '#7FA2FF', '#3FE89A'];
  const NEW = ['#FF9A5C', '#D97B3F', '#FFB47D', '#5DAAFF', '#3D84D6', '#8AC2FF', '#48D8CF', '#29ACA6', '#7BE7E0'];
  const jsAll = (() => { const out = []; const walk = d => readdirSync(d).forEach(f => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.js$/.test(f)) out.push(fs.readFileSync(p, 'utf8')); }); walk(join(APP, 'js')); return out.join('\n'); })();
  ok('D4 die frueheren Story-Toene (zwei je Sportart) sind restlos weg — in JS und CSS', OLD.every(h => !new RegExp(h, 'i').test(jsAll + css)));
  ok('D5 kein JS-Modul traegt einen Farbwert der Sportarten (Lauf-, Rad-, Schwimm-Toene nur in styles.css)', NEW.every(h => !new RegExp(h, 'i').test(jsAll)));
  ok('D6 --acchi/--accsoft (Story-eigene Farbvariablen) sind weg; gmStoryTheme ebenso', !/--acchi|--accsoft/.test(css + ui + rm + rmv) && !/gmStoryTheme/.test(ui.replace(/\/\*[^]*?\*\//g, '')));
}

/* ---------- E) Verdrahtung ---------- */
{
  ok('E1 Modul wird VOR ui.js geladen und liegt im Offline-Vorrat', idx.indexOf('<script src="js/activity-theme.js"></script>') > 0 && idx.indexOf('js/activity-theme.js') < idx.indexOf('<script src="js/ui.js">') && /'\.\/js\/activity-theme\.js'/.test(sw));
  ok('E2 Aktivitaetsseite traegt das Thema der Sportart (vor dem Einsetzen des Inhalts)', /pg\.setAttribute\('data-activity',gmActThemeId\(vm\.sportId\)\);\s*pg\.innerHTML=h;/.test(ui));
  ok('E3 Story: jede Seite traegt das Thema; Bestzeit-Seiten ausdruecklich ORVIA-Gold', /var actAttr=gmActThemeAttr\(vm\.sportId\);/.test(ui) && (ui.match(/<div class="wst-bg pr" data-activity="brand"><\/div><div class="wst-in" data-activity="brand">/g) || []).length === 2 && !/style="--acc:/.test(ui));
  ok('E4 Kartenansicht bekommt das Thema mit (haengt am body, erbt es nicht)', /V\.open\(route,\{activity:gmActThemeId\(vm&&vm\.sportId\),/.test(ui) && /if \(opts\.activity\) el\.setAttribute\('data-activity', String\(opts\.activity\)\);/.test(rmv));
  ok('E5 Strecke: Farbe aus dem Thema (Karte, Kartenansicht, Zeichnung ohne Karte)', /var col = opts\.color \? esc\(opts\.color\) : 'var\(--activity-primary\)';/.test(rm) && /class="rmx-line" fill="none" stroke="var\(--activity-primary\)" stroke-width="' \+ R\.ROUTE_W \+ '"/.test(rmv) && /stroke="var\(--activity-primary,#D8BB7A\)"/.test(act));
  ok('E6 Strecke (v8-441): 4,5 px Linie, dunkler Rand 7,5 px bei 65 % (Rand = Linie + 3), kein farbiges Leuchten — nur ein kleiner dunkler Schatten', /var sw = \+opts\.width \|\| ROUTE_W;/.test(rm) && /var ROUTE_W = 4\.5, CASE_W = 3, CASE_OPACITY = 0\.65;/.test(rm) && /class="rmx-case" fill="none" stroke-width="' \+ \(R\.ROUTE_W \+ R\.CASE_W\) \+ '"/.test(rmv) && /\.rmx-case\{stroke:#000;stroke-opacity:\.65\}/.test(css) && /\.rmx-route\{[^}]*filter:drop-shadow\(0 1px 3px rgba\(0,0,0,\.45\)\)\}/.test(css));
  ok('E7 Messreihen der Aktivitaetsseite: EINE Farbe (die der Sportart), Hoechst-/Tiefstwert neutral', /var GM_ACT_CHART_COLOR='var\(--activity-primary\)';/.test(ui) && (() => { const b = ui.slice(ui.indexOf('function gmActStreamDefs(sportId){'), ui.indexOf('function gmActCardKpis(')); return (b.match(/color:GM_ACT_CHART_COLOR/g) || []).length === 9 && !/color:'/.test(b); })() && /neutralMarks:true\}\);/.test(ui) && /cfg\.neutralMarks\?'var\(--orvia-text-secondary,#ADB5C1\)'/.test(charts));
  ok('E8 Aktivitaetsliste: Kartenkopf traegt das Thema, Zeichen in --activity-primary', /'<div class="activity-visual" '\+gmActThemeAttr\(a\.sportId\)\+' data-sport="'/.test(ui) && /var c='var\(--activity-primary\)';/.test(ui) && !/\.activity-visual\[data-sport=/.test(css.replace(/:before|:after/g, '§').replace(/\.activity-visual\[data-sport="[^"]+"\]§/g, '')));
  ok('E9 Sportartenverteilung und Last je Sportart: Farben aus dem Farbsystem; „Sonstiges" neutral', /var _distCol=\[gmActThemeColor\('running'\),gmActThemeColor\('gym'\),gmActThemeColor\('cycling'\),'var\(--orvia-neutral-info\)'\];/.test(ui) && /background:'\+gmActThemeColor\(s\[2\]\)\+'/.test(ui) && /\['Laufen',pct\('running'\),'running'\],\['Kraft',pct\('gym'\),'gym'\],\['Rad',pct\('cycling'\),'cycling'\]/.test(ui));
  ok('E10 hoechstens EINE farbige Hauptkennzahl (Distanz bzw. Kraft-Volumen) — Seite und Story', /var _keyLbl=\(_fam==='gym'\)\?'VOLUMEN':'DISTANZ';/.test(ui) && /#gmActPage\[data-activity\] \.detail-kpis div\.key b\{color:var\(--activity-primary\)\}/.test(css) && /\.gm-story \.wst-cell\.key b\{color:var\(--activity-primary\)\}/.test(css) && (ui.match(/,1\]\);/g) || []).length >= 2);
  ok('E11 Stimmung der Sportart: ein leiser Schein von oben (Tint 14 % → 8 % → aus), fester Grund', /\.gm-story \.wst-bg\{background:\s*radial-gradient\(90% 45% at 50% 0%,var\(--activity-tint-strong\) 0%,var\(--activity-tint\) 45%,transparent 75%\),\s*var\(--orvia-bg-base\)\}/.test(css) && /#gmActPage\[data-activity\]\{background:\s*radial-gradient\(90% 45% at 50% 0%,var\(--activity-tint-strong\) 0%,var\(--activity-tint\) 45%,transparent 75%\),\s*var\(--orvia-bg-primary\)\}/.test(css));
  ok('E12 Uebungskarten der Kraft-Story bleiben neutral (Volumen je Uebung nicht in Gold)', /\.gm-story \.wst-exh span\{font-size:11px;color:var\(--orvia-text-secondary\);/.test(css));
}
console.log('\n' + (fail ? '❌' : '✅') + ' activity_theme: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
