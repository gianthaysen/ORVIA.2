#!/usr/bin/env node
/* ============================================================================
   ORVIA · build_gm6_harness.mjs — repo-interner Ersatz fuer den verlorenen
   /tmp/gm6_build.mjs (KF-013-Klasse: der Harness-Builder lag nie im Repo).

   Erzeugt supabase/tests/fixtures/gm6h.html: eine selbststaendige Seite aus dem
   PRODUKTIVEN index.html + styles.css + saemtlichen produktiven js/-Dateien
   (inline, keine Netzabhaengigkeit), plus einer Fixture-/Instrumentierungs-
   schicht, die die Vertragstests gm6_state_contract_test.mjs (Teil B) und
   gm61_contract_test.mjs (Teil F) erwarten:

     window.setState(state, modus)   15 Zustaende × anfaenger/fortgeschritten/profi
     window.setVM('base'|'empty')    Datenfixture wechseln
     window.setSignals(sync, online) NUR Signale wechseln — KEINE Neuberechnung
     window.CURFIX / FIXEMPTY        aktuelle Fixture (gm61 §4 mutiert sie direkt)
     window.__gm6                    { calls, resetCalls(), paint(), listeners }

   WICHTIG — Ehrlichkeitsprinzip des Harness:
     • Die REFERENZ ist docs/gm-ref/gm6/gm6_gm_domspec.json (md5-versiegelt,
       im Repo). Der Harness liefert nur EINGABEN; gerendert wird ausschliesslich
       mit dem Produktivcode. Falsche Fixtures ⇒ Sequenz-Mismatch ⇒ Test ROT.
     • gmDashVM wird je paint() GENAU EINMAL berechnet und gecacht. Ein reiner
       Signalwechsel (setSignals) rendert mit dem Cache — „Es wird NICHTS neu
       berechnet" (GM6.1 §2) ist damit mechanisch garantiert und die Zaehler
       (engine/persist/score/…) sind Stolperdraehte an den echten Eintrittspunkten.

   Aufruf:  node tools/build_gm6_harness.mjs [appRoot] [outFile]
   Export:  buildHarness(appRoot?, outFile?) → outFile
   ============================================================================ */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

import { existsSync } from 'node:fs';
/* Zwei Layouts: Cloud-Checkout (alles unter app/, tools/ = app/tools) und
   Geraete-Layout (Dev-Material unter _dev/, App unter ../app). Probe statt Annahme. */
function defaultAppRoot() {
  const flat = join(HERE, '..');
  if (existsSync(join(flat, 'index.html'))) return flat;
  return join(HERE, '..', '..', 'app');
}
export function buildHarness(appRoot, outFile) {
  const APP = appRoot ? normalize(appRoot) : defaultAppRoot();
  const OUT = outFile || join(APP, 'supabase', 'tests', 'fixtures', 'gm6h.html');
  let html = readFileSync(join(APP, 'index.html'), 'utf8');

  /* ---- 1) Netzabhaengigkeiten entfernen (file://, keine Konsolenfehler) ---- */
  html = html
    .replace(/<link[^>]+rel="(manifest|icon|apple-touch-icon|mask-icon|preconnect)"[^>]*>\s*/g, '')
    .replace(/<link[^>]+fonts\.googleapis[^>]*>\s*/g, '')
    .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com[^"]*"><\/script>/,
      '<script>/* Harness-Stub statt CDN */window.Chart=function(){this.destroy=function(){}};window.Chart.register=function(){};window.Chart.defaults={plugins:{}};</script>')
    .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]*"><\/script>/,
      '<script>/* Harness-Stub statt CDN (supabase-js) */</script>')
    .replace(/<script src="env\.js"><\/script>/,
      '<script>/* Harness: unkonfiguriert = lokaler Modus */</script>');

  /* ---- 2) Instrumentierungs-Prelude VOR allen App-Skripten ----
     Listener-Zaehler muss existieren, BEVOR ui.js erste Listener bindet. */
  const prelude = `<script>/* gm6-Harness-Prelude: Listener-Zaehler + Tripwires */
window.__gm6={listeners:0,calls:{},resetCalls:function(){var c=this.calls;
  ['renderDay','engine','persist','score','schedulePush','flushSync','syncStart','showGate'].forEach(function(k){c[k]=0;});},paint:null};
window.__gm6.resetCalls();
(function(){
  var wa=window.addEventListener.bind(window),da=document.addEventListener.bind(document);
  window.addEventListener=function(){window.__gm6.listeners++;return wa.apply(null,arguments);};
  document.addEventListener=function(){window.__gm6.listeners++;return da.apply(null,arguments);};
})();
</script>`;
  html = html.replace('<script>/* Harness-Stub statt CDN */', prelude + '<script>/* Harness-Stub statt CDN */');

  /* ---- 3) styles.css inline; Asset-URLs auf das echte assets/ umbiegen ---- */
  const rel = '../../../';   /* fixtures/ → appRoot */
  let css = readFileSync(join(APP, 'styles.css'), 'utf8')
    .replace(/url\(\s*(['"]?)assets\//g, 'url($1' + rel + 'assets/');
  html = html.replace(/<link rel="stylesheet" href="styles.css">/,
    '<style>/* inline: styles.css */\n' + css.replace(/<\/style/gi, '<\\/style') + '\n</style>');
  html = html.replace(/(src|href)="assets\//g, '$1="' + rel + 'assets/');

  /* ---- 4) lokale Skripte inline (identische Reihenfolge wie produktiv) ---- */
  html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, p) => {
    const src = readFileSync(join(APP, p), 'utf8').replace(/<\/script/gi, '<\\/script');
    return '<script>/* inline: ' + p + ' */\n' + src + '\n</script>';
  });

  /* ---- 5) Fixture-/Zustandsschicht ---- */
  const layer = readFileSync(join(HERE, 'gm6_harness_layer.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace(/<\/body>/i, '<script>/* gm6-Harness-Fixture-Schicht */\n' + layer + '\n</script></body>');

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  return OUT;
}

if (process.argv[1] && process.argv[1].endsWith('build_gm6_harness.mjs')) {
  const out = buildHarness(process.argv[2], process.argv[3]);
  console.log('gm6-Harness geschrieben: ' + out);
}
