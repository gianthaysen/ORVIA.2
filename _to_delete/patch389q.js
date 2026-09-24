const fs=require('fs');const F='supabase/tests/gm62_input_guard_test.mjs';let s=fs.readFileSync(F,'utf8');
const a = `  ok('A7 Store-API unverändert (13 Exporte, gleiche Namen)',
    /O\\.checkinStore\\s*=\\s*\\{\\s*persistCheckin,\\s*hydrateRecentTypes,\\s*rowToCheckin,\\s*persistMorning,\\s*hydrateRecent,\\s*rowToMorning,\\s*VALID_TYPES,\\s*BLOCK_TYPES,\\s*TYPE_KEY\\s*\\}/
      .test(STORE_CODE.replace(/\\s+/g, ' ')));`;
const b = `  /* v8-389: BEWUSSTE Erweiterung um morningWeightSeries — eine reine Lesefunktion
     ueber die vorhandenen Morgenwerte (kein neuer Abruf, keine Persistenz). Anlass:
     Kraftprofil und relative Kraft lasen das Koerpergewicht bis dahin aus dem
     Profilfeld statt aus dem taeglich gepflegten Morgenbericht. Der Pin bleibt eng —
     er haelt weiterhin jeden anderen Namen und die Reihenfolge fest, damit eine
     Aenderung an der Store-Schnittstelle nicht nebenbei passiert. */
  ok('A7 Store-API unverändert (13 Exporte + morningWeightSeries, gleiche Namen)',
    /O\\.checkinStore\\s*=\\s*\\{\\s*persistCheckin,\\s*hydrateRecentTypes,\\s*rowToCheckin,\\s*morningWeightSeries,\\s*persistMorning,\\s*hydrateRecent,\\s*rowToMorning,\\s*VALID_TYPES,\\s*BLOCK_TYPES,\\s*TYPE_KEY\\s*\\}/
      .test(STORE_CODE.replace(/\\s+/g, ' ')));`;
if(s.indexOf(a)<0) throw new Error('nf A7'); s=s.replace(a,b);
fs.writeFileSync(F,s); console.log('ok');
