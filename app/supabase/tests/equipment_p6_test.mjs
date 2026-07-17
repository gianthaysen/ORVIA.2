/* ============================================================
   ORVIA · P6 — sportartspezifisches, konsolidiertes Equipment.
   Verträge:
   - Katalog: compatibleSports-Filter (running ⇒ Laufschuhe/Trailschuhe/Uhr;
     kein Neoprenanzug ohne swimming/triathlon); leere compatibleSports immer.
   - normalizeEquipment: sports aus Katalog, wear{limitKm,startKm,since}.
   - migrateGearToEquipment: idempotent, ID-erhaltend (km-Zuordnung bleibt),
     gear bleibt liegen (kein Datenverlust), Doppel-Lauf ändert nichts.
   - Alle ALT-Typcodes (EQUIP_GROUPS) existieren im Katalog (keine Typ-Migration).
   - profile.js: Verschleiß-View liest devices.equipment; Editor filtert nach
     aktiven Sportarten und hält bestehende (inaktive) Typen wählbar.
   node supabase/tests/equipment_p6_test.mjs
   ============================================================ */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let pass = 0, fail = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i ? '  — ' + i : '')); c ? pass++ : fail++; };
const base = new URL('../../js/', import.meta.url);

function model() {
  const sb = { window: null, console }; sb.window = sb; sb.ORVIA = {};
  vm.createContext(sb);
  vm.runInContext(readFileSync(new URL('profile-model.js', base), 'utf8'), sb, { filename: 'profile-model.js' });
  return sb.ORVIA.profileModel;
}

/* ---------- 1) Katalog + Filter ---------- */
{
  const M = model();
  const flat = g => g.map(x => x[1].map(p => p[0])).flat();
  const run = flat(M.equipmentCatalogFor(['running']));
  ok('K1 running ⇒ Laufschuhe/Trailschuhe/Uhr', ['running_shoes', 'trail_shoes', 'sports_watch'].every(x => run.indexOf(x) >= 0));
  ok('K2 running ⇒ KEIN Neoprenanzug/Helm/Fußballschuh', ['wetsuit', 'helmet', 'football_boots'].every(x => run.indexOf(x) < 0));
  const tri = flat(M.equipmentCatalogFor(['triathlon']));
  ok('K3 triathlon ⇒ Rad+Helm+Powermeter+Neo+Brille+Laufschuhe', ['road_bike', 'helmet', 'powermeter', 'wetsuit', 'goggles', 'running_shoes'].every(x => tri.indexOf(x) >= 0));
  const gym = flat(M.equipmentCatalogFor(['gym']));
  ok('K4 gym ⇒ Gürtel/Zughilfen/Langhantel', ['lifting_belt', 'lifting_straps', 'barbell'].every(x => gym.indexOf(x) >= 0));
  ok('K5 „other" immer wählbar', flat(M.equipmentCatalogFor([])).indexOf('other') >= 0);
  const fb = flat(M.equipmentCatalogFor(['football']));
  ok('K6 football ⇒ Fußballschuhe, kein Powermeter', fb.indexOf('football_boots') >= 0 && fb.indexOf('powermeter') < 0);
  // Alle Alt-Typcodes existieren im Katalog
  const legacy = ['road_bike', 'gravel_bike', 'mtb', 'indoor_trainer', 'treadmill', 'row_erg', 'ski_erg', 'air_bike', 'cross_trainer', 'gym_access', 'barbell', 'dumbbells', 'machines', 'cable', 'kettlebells', 'pullup_bar', 'bands', 'home_gym', 'pool25', 'pool50', 'open_water', 'pullbuoy', 'paddles', 'fins', 'hx_ski', 'hx_row', 'hx_sled_push', 'hx_sled_pull', 'hx_wallball', 'hx_sandbag', 'hx_farmers', 'other'];
  const ids = M.EQUIPMENT_CATALOG.map(c => c.id);
  ok('K7 alle Alt-Typcodes im Katalog (keine Typ-Migration nötig)', legacy.every(x => ids.indexOf(x) >= 0));
}

/* ---------- 2) normalizeEquipment + wear ---------- */
{
  const M = model();
  const e = M.normalizeEquipment({ type: 'running_shoes', label: 'Vomero 18', wear: { limitKm: 800, startKm: 120 } });
  ok('N1 sports aus Katalog übernommen', JSON.stringify(e.sports) === JSON.stringify(['running', 'triathlon', 'athletics']));
  ok('N2 wear normalisiert', e.wear.limitKm === 800 && e.wear.startKm === 120 && e.wear.since === null);
  const p = M.normalizeEquipment({ type: 'barbell' });
  ok('N3 ohne wear ⇒ wear null', p.wear === null && p.sports[0] === 'gym');
  ok('N4 unbekannter Typ ⇒ sports leer, kein Crash', Array.isArray(M.normalizeEquipment({ type: 'zzz' }).sports));
}

/* ---------- 3) Migration gear → equipment ---------- */
{
  const M = model();
  const prof = { gear: [{ id: 'g1', name: 'Nike Vomero', type: 'shoe', limitKm: 800, startKm: 120, since: '2026-01-01' }, { id: 'g2', name: 'Canyon', type: 'bike', limitKm: null, startKm: 0, since: '2026-02-01' }], devices: {} };
  const changed = M.migrateGearToEquipment(prof);
  ok('G1 Migration meldet Änderung', changed === true);
  const eq = prof.devices.equipment;
  ok('G2 beide Einträge migriert', eq.length === 2);
  ok('G3 IDs erhalten (km-Zuordnung bleibt)', eq[0].id === 'g1' && eq[1].id === 'g2');
  ok('G4 Typen gemappt shoe→running_shoes, bike→road_bike', eq[0].type === 'running_shoes' && eq[1].type === 'road_bike');
  ok('G5 wear übernommen', eq[0].wear.limitKm === 800 && eq[0].wear.startKm === 120 && eq[0].wear.since === '2026-01-01');
  ok('G6 gear bleibt liegen (Datenerhalt)', prof.gear.length === 2);
  const again = M.migrateGearToEquipment(prof);
  ok('G7 idempotent: zweiter Lauf ändert nichts', again === false && prof.devices.equipment.length === 2);
  ok('G8 leeres Profil ⇒ false, kein Crash', M.migrateGearToEquipment({}) === false);
}

/* ---------- 4) profile.js-Verträge ---------- */
{
  const src = readFileSync(new URL('profile.js', base), 'utf8');
  ok('P1 Verschleiß-View liest devices.equipment (_wearItems)', /_wearItems\(\)/.test(src.split('function renderEquipment')[1].slice(0, 400)));
  ok('P2 Migration-Hook vorhanden (_eqEnsureMigrated)', /migrateGearToEquipment\(PROFILE\)/.test(src));
  ok('P3 saveGear schreibt kanonisch (kein PROFILE.gear.push mehr)', !/PROFILE\.gear\.push/.test(src));
  ok('P4 Editor filtert Katalog nach aktiven Sportarten', /equipmentCatalogFor\(actIds\)/.test(src));
  ok('P5 bestehender inaktiver Typ bleibt wählbar', /Sportart inaktiv/.test(src));
  ok('P6 Editor mit wear-Feldern (Limit/Start-km)', /eq_limitkm/.test(src) && /eq_startkm/.test(src));
  ok('P7 Bike-Erkennung deckt Katalogtypen', /road_bike','gravel_bike','mtb/.test(src));
}

console.log('\nErgebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
