#!/usr/bin/env node
/* ============================================================
   ORVIA · Generator fuer app/docs/SPORT-CATALOG-STATUS.md (v8-447.1)

   Eine Zeile je Katalog-Sportart, gelesen aus dem Code — nicht von Hand gepflegt:
     kanonische ID · Anzeigename · Normalisierung (App-Aliasse, Serverfunktion 0049) ·
     Garmin-Typen des Workers · manuelle Erfassung · Signatur
   Ein Test vergleicht Datei und Ausgabe.

   Aufruf:  node app/tools/gen-sport-catalog-doc.mjs [--check]
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const REPO = join(APP, '..');
const OUT = join(APP, 'docs', 'SPORT-CATALOG-STATUS.md');
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
globalThis.ORVIA = globalThis.ORVIA || {};
const O = globalThis.ORVIA;
require(join(APP, 'js', 'activity-effective.js'));
require(join(APP, 'js', 'activity-normalize.js'));
require(join(APP, 'js', 'training-domain.js'));
/* training-domain exportiert nicht ueber module.exports, sondern haengt sich an ORVIA. */
const TD = O.trainingDomain;
if (!TD || !Array.isArray(TD.ACTIVITY_SPORTS) || TD.ACTIVITY_SPORTS.length === 0) {
  console.error('Sport-Katalog nicht lesbar (ORVIA.trainingDomain.ACTIVITY_SPORTS fehlt) — kein Dokument geschrieben.');
  process.exit(2);
}
O.onboardingSportsLogic = require(join(APP, 'js', 'onboarding', 'onboarding-sports-logic.js'));
const C = require(join(APP, 'js', 'activity-config.js'));
require(join(APP, 'js', 'sport-signatures.js'));
const SIG = O.sportSignatures;

const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : null);

/* Garmin-Typen des Workers (normalize.SPORT_MAP) — per Text gelesen, der Worker ist Python. */
export function workerSportMap() {
  const src = read(join(REPO, 'garmin-worker', 'orvia_worker', 'normalize.py'));
  if (!src) return null;
  const a = src.indexOf('SPORT_MAP: dict[str, str] = {'), b = src.indexOf('\n}\n', a);
  const by = {};
  for (const m of src.slice(a, b).matchAll(/^\s*"([a-z0-9_]+)":\s*"([a-z_]+)",/gm)) (by[m[2]] = by[m[2]] || []).push(m[1]);
  return by;
}
/* Sportarten, die die Serverfunktion nach 0049 kennt (Zielwerte der CASE-Zweige). */
export function serverSports() {
  const src = read(join(REPO, 'supabase', 'migrations', '0049_norm_sport_catalog.sql'));
  if (!src) return null;
  const body = src.slice(src.indexOf('select case'), src.indexOf('$$;'));
  return new Set([...body.matchAll(/then '([a-z_]+)'/g)].map(m => m[1]));
}

export function rows() {
  const ids = (TD.ACTIVITY_SPORTS || []).map(x => (x && x.id) || x);
  const garmin = workerSportMap(), server = serverSports();
  const manual = new Set([].concat(...C.moreActivityGroups([]).map(g => g.items.map(i => i.sportId))));
  const aliasCount = id => { let n = 0; for (const k of ALIASES) if (TD.normSportStrict(k) === id) n++; return n; };
  return ids.map(id => {
    const s = SIG && SIG.get ? SIG.get(id) : null;
    const norm = TD.normSportStrict(id) === id;
    return {
      id, label: C.sportLabel(id), normalized: norm, aliases: aliasCount(id),
      server: server ? server.has(id) : null,
      garmin: garmin ? (garmin[id] || []) : null,
      manual: manual.has(id),
      profile: (C.formSchemaForSport && C.formSchemaForSport(id) && C.formSchemaForSport(id).detailProfile) || '—',
      signature: s ? (s.status + (s.renderer ? ' (' + s.renderer + ')' : '')) : 'fehlt'
    };
  });
}
/* Alias-Schluessel der App — aus dem Quelltext, weil die Tabelle nicht exportiert ist. */
const ALIASES = (() => {
  const src = readFileSync(join(APP, 'js', 'training-domain.js'), 'utf8');
  const a = src.indexOf('const SPORT_ALIASES = {'), b = src.indexOf('};', a);
  return [...src.slice(a, b).matchAll(/['"]?([a-zäöüß_ ]+)['"]?\s*:\s*'[a-z_]+'/g)].map(m => m[1].trim());
})();

export function render() {
  const r = rows();
  const sig = { implemented: 0, defined: 0, fallback: 0, other: 0 };
  r.forEach(x => { const k = x.signature.split(' ')[0]; if (k in sig) sig[k]++; else sig.other++; });
  const garminTotal = r.reduce((n, x) => n + (x.garmin ? x.garmin.length : 0), 0);
  const noGarmin = r.filter(x => x.garmin && !x.garmin.length).map(x => x.id);
  const yn = v => (v === null ? 'nicht prüfbar' : v ? 'ja' : '**nein**');
  const out = [`# Sport-Katalog — Stand je Sportart

**Status: IMPLEMENTED** · Stand v8-447.1 · erzeugt durch \`node app/tools/gen-sport-catalog-doc.mjs\` aus dem Code. Nicht von Hand ändern.

Der Katalog hat **${r.length}** Sportarten. Jede ist in der App eine eigene kanonische ID; \`other\` ist der Rückfall.

| canonical ID | displayName | normalisiert (App) | Aliasse (App) | Serverfunktion (0049) | Garmin-Typen | manuell erfassbar | Formular-Profil | Signatur |
|---|---|---|---|---|---|---|---|---|`];
  for (const x of r) {
    out.push(`| \`${x.id}\` | ${x.label} | ${yn(x.normalized)} | ${x.aliases} | ${yn(x.server)} | ${x.garmin === null ? 'nicht prüfbar' : (x.garmin.length ? x.garmin.length + ': ' + x.garmin.map(k => '`' + k + '`').join(', ') : '0')} | ${yn(x.manual)} | ${x.profile} | ${x.signature} |`);
  }
  out.push(`
## Zusammenfassung

- **Normalisierung App:** ${r.filter(x => x.normalized).length} von ${r.length} IDs sind kanonisch gültig.
- **Serverfunktion nach Migration 0049:** ${r.filter(x => x.server).length} von ${r.length}. Ohne 0049 kennt der Server 16 — acht Katalog-Sportarten würden beim Abschluss eines ORVIA-Workouts als \`other\` gespeichert.
- **Garmin:** ${garminTotal} Typen führen auf ${r.filter(x => x.garmin && x.garmin.length).length} Sportarten. Ohne eigenen Garmin-Typ: ${noGarmin.map(x => '`' + x + '`').join(', ') || '—'} (Leichtathletik zeichnet Garmin als Lauf auf; \`other\` ist der Rückfall selbst).
- **Manuell erfassbar** (Auswahl „Weitere Aktivität"): ${r.filter(x => x.manual).length} von ${r.length}.
- **Signaturen:** ${r.length} im Katalog · ${sig.defined + sig.implemented} ausdrücklich definiert, davon ${sig.implemented} gezeichnet · ${sig.fallback} dokumentierter Rückfall · ${sig.other} fehlend.

## Was noch auf \`other\` führt

1. **Garmin-Typen ohne Zuordnung.** Jeder Typ, der nicht in der Tabelle steht — aus Tests bekannt: \`ice_hockey\`, \`american_football\`, \`hiit\`, \`pilates\`. Bewusst nicht zugeordnet, weil ORVIA dafür keine Sportart hat (Katalog-Hockey ist Feldhockey).
   Welche Typen **tatsächlich** in den Daten vorkommen, zeigt nur der Feldzensus (Zeilen \`typ | other | <typ>\`). Der Typ bleibt in jedem Fall erhalten (\`metrics.garmin.type_key\`).
2. **Altbestand.** Zeilen, die vor v8-447 als \`other\` gespeichert wurden: Migration 0050 stellt um, was die Serverfunktion kennt und dessen Rohtyp erhalten ist; Garmin-Untertypen (\`track_running\` …) stellt der Worker um.
3. **Echter Rückfall.** Vom Nutzer gewählte „Andere Aktivität", eigene Sportarten ohne Katalog-Entsprechung, Zeilen ohne erhaltenen Rohtyp.

Vorher/Nachher-Zählung: \`supabase/scripts/0050_sport_backfill_dryrun.sql\` (nur lesend).
`);
  return out.join('\n').trimEnd() + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = render();
  if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (cur !== text) { console.error('SPORT-CATALOG-STATUS.md ist veraltet — node app/tools/gen-sport-catalog-doc.mjs'); process.exit(1); }
    console.log('Sport-Katalog-Dokument aktuell.');
  } else {
    writeFileSync(OUT, text);
    console.log('geschrieben: ' + OUT + ' (' + text.length + ' Zeichen)');
  }
}
