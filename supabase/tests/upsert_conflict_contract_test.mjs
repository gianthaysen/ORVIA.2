/* ORVIA · INCIDENT 2026-07-16 — Upsert-Konfliktvertrag (statischer Konsistenztest).
   Root Cause des Check-in-Sync-Fehlers: checkinRepository upsertet daily_checkins mit
   ON CONFLICT (user_id, local_date, checkin_type), aber KEINE Migration legte je einen
   passenden Unique-Index an → Postgres 42P10, jeder Online-Check-in-Save scheiterte
   („Check-in lokal gespeichert (Cloud-Sync fehlgeschlagen)"). Fix: Migration 0017.
   Dieser Test verhindert die FEHLERKLASSE: jeder im JS-Code verwendete
   onConflict-Schlüssel (upsert/upsertMany/enqueue) muss in den Migrationen durch
   einen Unique-Index, Unique-Constraint oder Primary Key gedeckt sein.
   node supabase/tests/upsert_conflict_contract_test.mjs */
import fs from 'fs';
import path from 'path';
import { existsSync as _exApp } from 'node:fs';
import { dirname as _dH } from 'node:path';
import { fileURLToPath as _fH } from 'node:url';
const HERE = _dH(_fH(import.meta.url));
/* Layoutrobuste App-Basis: kanonisch liegt js/ unter HERE/../.., umstrukturiert unter HERE/../../app. */
const _APPREL = _exApp(new URL('../../js/', import.meta.url)) ? '../../' : '../../app/';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const APP = new URL(_APPREL + '', import.meta.url).pathname;

/* ---- 1) Alle (Tabelle, Konfliktschlüssel)-Paare aus dem JS-Code sammeln ---- */
function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...jsFiles(path.join(dir, e.name))); }
    else if (e.name.endsWith('.js')) out.push(path.join(dir, e.name));
  }
  return out;
}
const pairs = new Map();   // 'table|cols' → [fundstellen]
const CALL_RE = /(?:upsert|upsertMany|enqueue)\(\s*['"]([a-z_]+)['"]\s*,[\s\S]{0,600}?['"]((?:user_id|id)[a-z_,]*)['"]/g;
for (const f of jsFiles(path.join(APP, 'js'))) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  const re = new RegExp(CALL_RE.source, 'g');
  while ((m = re.exec(src)) !== null) {
    // Nur echte Konfliktschlüssel (Spaltenlisten), keine zufälligen Strings.
    const cols = m[2].split(',').map(s => s.trim()).filter(Boolean);
    if (!cols.length) continue;
    const key = m[1] + '|' + cols.slice().sort().join(',');
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(path.relative(APP, f));
  }
}
ok('Extraktion: onConflict-Verträge im Code gefunden', pairs.size >= 6, pairs.size + ' Verträge');

/* ---- 2) Unique-Deckung aus den Migrationen ermitteln ---- */
const sql = fs.readdirSync(path.join(HERE, '..', 'migrations'))
  .filter(f => f.endsWith('.sql'))
  .map(f => fs.readFileSync(path.join(HERE, '..', 'migrations', f), 'utf8'))
  .join('\n')
  .toLowerCase();

function norm(cols) { return cols.map(s => s.trim()).filter(Boolean).sort().join(','); }
const covered = new Set();   // 'table|cols'
// a) create unique index ... on public.<t> (c1, c2 [where ...])
let m;
const IDX_RE = /create\s+unique\s+index[^;]*?\bon\s+(?:public\.)?([a-z_]+)\s*\(([^)]+)\)/g;
while ((m = IDX_RE.exec(sql)) !== null) covered.add(m[1] + '|' + norm(m[2].split(',').map(s => s.replace(/\s+(asc|desc).*$/, ''))));
// b) Primary Keys / Inline-Unique: create table <t> ( ... <col> uuid primary key ... | primary key (a,b) | unique (a,b) )
const TBL_RE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\);/g;
while ((m = TBL_RE.exec(sql)) !== null) {
  const t = m[1], body = m[2];
  let mm;
  const PK_COL = /^\s*([a-z_]+)\s+[a-z_ ()]*?primary\s+key/gm;
  while ((mm = PK_COL.exec(body)) !== null) covered.add(t + '|' + mm[1]);
  const PK_MULTI = /primary\s+key\s*\(([^)]+)\)/g;
  while ((mm = PK_MULTI.exec(body)) !== null) covered.add(t + '|' + norm(mm[1].split(',')));
  const UQ_MULTI = /unique\s*\(([^)]+)\)/g;
  while ((mm = UQ_MULTI.exec(body)) !== null) covered.add(t + '|' + norm(mm[1].split(',')));
  const UQ_COL = /^\s*([a-z_]+)\s+[a-z_ ()]*?\bunique\b/gm;
  while ((mm = UQ_COL.exec(body)) !== null) covered.add(t + '|' + mm[1]);
}

/* ---- 3) Jeder Code-Vertrag muss gedeckt sein ---- */
for (const [key, files] of pairs) {
  const [table, cols] = key.split('|');
  ok('Vertrag gedeckt: ' + table + ' ON CONFLICT (' + cols + ')', covered.has(key),
    covered.has(key) ? '' : 'FEHLT in Migrationen — Upsert bricht live mit 42P10. Verwendet in: ' + [...new Set(files)].join(', '));
}

/* ---- 4) Der konkrete Incident-Fall bleibt explizit abgesichert ---- */
ok('0017: daily_checkins (user_id, local_date, checkin_type) unique', covered.has('daily_checkins|checkin_type,local_date,user_id'));

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
