/* ============================================================
   ORVIA · Rechtemodell für Funktionen (EXECUTE) aus schema.sql + Migrationen
   ------------------------------------------------------------
   WARUM. `revoke … from public` sah in den Dateien sicher aus und war in
   Supabase wirkungslos: Supabase vergibt EXECUTE auf neue Funktionen in
   `public` per Default Privileges DIREKT an anon, authenticated, service_role
   (zusätzlich zum PostgreSQL-Standard für PUBLIC). Ein Test, der nur nach
   „kein expliziter grant an anon" sucht, ist deshalb falsch-grün (D2 bis 0052).

   MODELL. Reihenfolge: schema.sql, dann supabase/migrations/*.sql aufsteigend.
     create function (neu)        → {public, anon, authenticated, service_role}
     create or replace (existiert)→ Rechte bleiben (PostgreSQL-Semantik)
     drop function                → Eintrag weg (nächstes create setzt Defaults)
     revoke … on function … from  → Rollen entfernen
     grant execute on function …  → Rollen hinzufügen
     … on all functions in schema public → auf alle bekannten Funktionen
   Wirksam:  darf(rolle) = set.has(rolle) || set.has('public')
   Schlüssel: name/arity (Überladungen gleicher Stelligkeit gibt es im Repo nicht).

   GRENZEN. Kein `alter default privileges`, keine Rollenvererbung jenseits
   PUBLIC, keine dynamischen execute-format()-Grants. Das Modell ersetzt die
   Live-Prüfung nicht (_verify-0052.sql / _verify-0053.sql), es macht die
   Dateien prüfbar.
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT = ['public', 'anon', 'authenticated', 'service_role'];

export function bereinigen(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, ' __body__ ')   // Funktionsrümpfe raus
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/* Argumentliste → Stelligkeit (Defaults zählen mit, wie in PostgreSQL). */
function stelligkeit(args) {
  const t = args.trim();
  if (!t) return 0;
  let tiefe = 0, n = 1;
  for (const c of t) { if (c === '(') tiefe++; else if (c === ')') tiefe--; else if (c === ',' && tiefe === 0) n++; }
  return n;
}
/* "public.a(uuid), public.b()" → ['a/1','b/0'] */
function funktionsListe(txt) {
  const out = [];
  for (const m of txt.matchAll(/(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) out.push(m[1] + '/' + stelligkeit(m[2]));
  return out;
}
const rollenListe = t => t.split(',').map(r => r.trim().replace(/"/g, '')).filter(Boolean);

export function quellen(supaDir) {
  const out = [];
  const schema = join(supaDir, 'schema.sql');
  if (existsSync(schema)) out.push({ datei: 'schema.sql', sql: readFileSync(schema, 'utf8') });
  const mig = join(supaDir, 'migrations');
  for (const f of readdirSync(mig).filter(f => f.endsWith('.sql')).sort())
    out.push({ datei: f, sql: readFileSync(join(mig, f), 'utf8') });
  return out;
}

/* bis: Dateiname (exklusiv) — Zustand VOR dieser Migration; null = ganze Kette. */
export function modell(qs, opt) {
  opt = opt || {};
  const rechte = new Map();      // key -> Set(rollen)
  const definer = new Map();     // key -> bool (security definer, zuletzt gesehen)
  const herkunft = new Map();    // key -> datei der Erstanlage
  for (const q of qs) {
    if (opt.bis && q.datei === opt.bis) break;
    const s = bereinigen(q.sql);
    for (const st of s.split(';')) {
      const x = st.trim();
      let m;
      if ((m = x.match(/^create (or replace )?function (?:public\.)?"?([a-z_][a-z0-9_]*)"? ?\(([^()]*(?:\([^()]*\)[^()]*)*)\)(.*)$/))) {
        const key = m[2] + '/' + stelligkeit(m[3]);
        if (!rechte.has(key)) { rechte.set(key, new Set(DEFAULT)); herkunft.set(key, q.datei); }
        definer.set(key, /\bsecurity definer\b/.test(m[4]));
        continue;
      }
      if ((m = x.match(/^drop function (?:if exists )?(.*)$/))) {
        for (const k of funktionsListe(m[1])) { rechte.delete(k); definer.delete(k); }
        continue;
      }
      if ((m = x.match(/^revoke (?:execute|all(?: privileges)?) on all functions in schema public from (.*)$/))) {
        for (const set of rechte.values()) rollenListe(m[1]).forEach(r => set.delete(r));
        continue;
      }
      if ((m = x.match(/^grant (?:execute|all(?: privileges)?) on all functions in schema public to (.*)$/))) {
        for (const set of rechte.values()) rollenListe(m[1]).forEach(r => set.add(r));
        continue;
      }
      if ((m = x.match(/^revoke (?:execute|all(?: privileges)?) on function (.*?) from (.*)$/))) {
        for (const k of funktionsListe(m[1])) if (rechte.has(k)) rollenListe(m[2]).forEach(r => rechte.get(k).delete(r));
        continue;
      }
      if ((m = x.match(/^grant (?:execute|all(?: privileges)?) on function (.*?) to (.*)$/))) {
        for (const k of funktionsListe(m[1])) if (rechte.has(k)) rollenListe(m[2]).forEach(r => rechte.get(k).add(r.replace(/ with grant option$/, '')));
        continue;
      }
    }
  }
  const darf = (key, rolle) => { const s = rechte.get(key); return !!s && (s.has(rolle) || s.has('public')); };
  return { rechte, definer, herkunft, darf };
}

/* Bequem: Modell direkt aus dem Repo. */
export function modellAusRepo(supaDir, opt) { return modell(quellen(supaDir), opt); }
