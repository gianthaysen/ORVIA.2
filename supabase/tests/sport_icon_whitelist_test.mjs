/* ============================================================
   ORVIA · v8-312 — Sport-Icon-Whitelist-Vertrag (Fußball/'ball').
   Kontext: ORVIA.activityConfig.sportIcon(sportId) liefert kanonisch aus dem
   Sport-Katalog (js/onboarding/onboarding-sports-logic.js) 'ball' für Fußball —
   identisch zum bereits im Sprite-Set vorhandenen Symbol #i-ball (index.html).
   ZWEI Konsumenten dieses Werts fuehren aber je eine EIGENE, handgepflegte
   Whitelist ('Sprite-Icons sind begrenzt'), die frueher 'ball' nicht enthielt:
     - js/activity.js  SPRITE_ICONS  (Aktivitätenliste, _iconForSport)
     - js/workout-ui.js HUB_SPRITE   (Schnellstart-Kacheln, hubIcon)
   Fehlt 'ball' in einer dieser Listen, faellt der jeweilige Konsument still auf
   'pulse' zurueck — der Sprite #i-ball existiert, wird aber nie gezeigt. Dieser
   Test ist eine reine Quelltext-Vertragsprüfung (kein DOM/VM-Sandbox nötig für
   zwei Objektliteral-Whitelists) — Muster uebernommen vom SW-Versions-Check in
   gm3_activity_parity_test.mjs.
   node supabase/tests/sport_icon_whitelist_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
const R = (p) => readFileSync(new URL(_APPREL + p, import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };

const act = R('js/activity.js');
const wui = R('js/workout-ui.js');
const dom = R('index.html');

ok('index.html definiert das Sprite-Symbol #i-ball (kanonische Fussball-Ikone)', /id="i-ball"/.test(dom));
ok('index.html definiert das Sprite-Symbol #i-stretch (kanonische Mobility-Ikone)', /id="i-stretch"/.test(dom));

(function () {
  const m = act.match(/var SPRITE_ICONS\s*=\s*\{([^}]*)\}/);
  ok('js/activity.js: SPRITE_ICONS gefunden', !!m);
  if (m) ok("js/activity.js: SPRITE_ICONS enthält 'ball' (sonst Fallback 'pulse' für Fußball-Aktivitäten)", /\bball\s*:\s*1\b/.test(m[1]));
})();

(function () {
  const m = wui.match(/const HUB_SPRITE\s*=\s*\{([^}]*)\}/);
  ok('js/workout-ui.js: HUB_SPRITE gefunden', !!m);
  if (m) ok("js/workout-ui.js: HUB_SPRITE enthält 'ball' (sonst Fallback 'pulse' in Schnellstart-Kacheln)", /\bball\s*:\s*1\b/.test(m[1]));
})();

console.log('\nsport_icon_whitelist: ' + (fail === 0 ? 'ALL PASSED' : fail + ' FAILED') + ' (' + pass + ' ok)');
process.exit(fail === 0 ? 0 : 1);
