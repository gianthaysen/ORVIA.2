import fs from 'node:fs';
{
  const f = 'supabase/tests/profile_v14_test.mjs'; let s = fs.readFileSync(f, 'utf8');
  const a = `ok('A2 Saison: aktive Phase markiert, „noch 35 Tage", vier Phasen', /pv-phase on"><b>Aufbau/.test(h) && /noch 35 Tage/.test(h) && (h.match(/class="pv-phase( on)?"/g) || []).length === 4);`;
  if (!s.includes(a)) throw new Error('A2');
  s = s.replace(a, `ok('A2 Saison: aktive Phase markiert, „Wettkampf in 35 Tagen", vier Phasen, Phasenende als „bis …"', /pv-phase on"><b>Aufbau/.test(h) && /Wettkampf in 35 Tagen/.test(h) && (h.match(/class="pv-phase( on)?"/g) || []).length === 4 && /bis 13\\.09\\.2026/.test(h));`);
  const anchor = `/* F · Verdrahtung */`;
  if (!s.includes(anchor)) throw new Error('F');
  s = s.replace(anchor, `/* G · S1b Sichtpruefung v8-371 (13.09.): Titel-nur-Wert, tolerante Zahlen, Zielanteil-Hinweis 1x, Kraftwerte aus Training, Quellenlabel, Ring-Klasse */
{
  const sb = makeSb(); const PV = sb.ORVIA.screens.profileV14;
  const KFA2 = { id: 'g9', category: 'target_bodyfat', title: '12%', status: 'active', priority: 2, unit: '%', targetValue: '12', currentValue: null };
  const d = baseData({ goals: [HM, KFA2], mainGoalId: 'g1' });
  const h = PV.goalsHTML(d);
  ok('G1 Titel „12%" ist kein Titel: Kategorie als Ueberschrift, Zielwert „12" (String) wird als Ziel gelesen', /<h4>Körperfett<\\/h4>/.test(h) && !/<h4>12%<\\/h4>/.test(h) && !/Kein Zielwert/.test(h));
  ok('G2 Zielanteil-Hinweis genau einmal unter der Liste (nicht je Karte)', (h.match(/pv-alloc-note/g) || []).length === 1);
  ok('G3 ohne Fortschritt keine leere Leiste (goal-line none), Hauptziel ohne Engine ebenfalls', /goal-line none/.test(h) && !/goal-line"><i style="width:0%/.test(h));
  const sb2 = makeSb({ ORVIA: { i18n: tStub(), gymVolume: { gymPipeline: () => ({ snapshots: [{ startedAt: '2026-09-02T18:00:00Z', exercises: [{ exerciseNameSnapshot: 'Kniebeuge (Langhantel)', sets: [{ completed: true, set_type: 'working', weight: 100, reps: 5 }, { completed: true, set_type: 'warmup', weight: 60, reps: 8 }] }, { exerciseNameSnapshot: 'Klimmzug', sets: [{ completed: true, set_type: 'working', weight: null, reps: 11 }] }, { exerciseNameSnapshot: 'Bankdrücken', sets: [{ completed: false, set_type: 'working', weight: 80, reps: 5 }] }] }] }) } } });
  const PV2 = sb2.ORVIA.screens.profileV14;
  const p = PV2.performanceHTML(baseData({ strengthRecords: [] }));
  ok('G4 Kraftwerte aus Training: Kniebeuge e1RM 116,7 kg (Epley 100×5), Klimmzuege 11 Wdh., Bankdruecken (Satz nicht abgeschlossen) und Kreuzheben fehlen', /116,7 kg/.test(p) && /11 Wdh\\./.test(p) && /aus Training/.test(p) && /2 fehlende Werte/.test(p));
  ok('G5 manueller Eintrag schlaegt abgeleiteten Wert nur, wenn hoeher (116 < 116,7 ⇒ Training)', /116,7 kg/.test(PV2.performanceHTML(baseData())));
  ok('G6 Rad/Schwimmen: Distanz fett, Sportart als Zusatzzeile', /<b>400 m<\\/b><small>Schwimmen<\\/small>/.test(p));
  ok('G7 Quellenlabel: automatic ⇒ automatisch, garmin_unofficial ⇒ Garmin', /automatisch/.test(PV.performanceHTML(baseData({ vo2: { value: 53, source: 'automatic' } }))) && /Garmin/.test(PV.performanceHTML(baseData({ vo2: { value: 53, source: 'garmin_unofficial' } }))));
  ok('G8 Profilstaerke-Ring: Prozent in eigener Klasse ps-pct (kein globales .pv)', /class="ps-pct"/.test(PV.strengthCardHTML(baseData().strength)) && !/class="pv"/.test(PV.strengthCardHTML(baseData().strength)));
}
/* F · Verdrahtung */`);
  fs.writeFileSync(f, s);
}
{
  const f = 'supabase/tests/gm5_profile_parity_test.mjs'; let s = fs.readFileSync(f, 'utf8');
  const a = `ok('exakt 4 Statistikslots (Einheiten/Sportarten/Fitness/Zielaufbau)', (H.match(/ig-stat"/g)||[]).length===4&&/Einheiten/.test(H)&&/Sportarten/.test(H)&&/Fitness/.test(H)&&/Zielaufbau/.test(H));`;
  if (!s.includes(a)) throw new Error('parity a');
  s = s.replace(a, `ok('exakt 4 Statistikslots (Einheiten/Sportarten/Fitness/Ziele — S1b: aktive Ziele statt leerem Zielaufbau)', (H.match(/ig-stat"/g)||[]).length===4&&/Einheiten/.test(H)&&/Sportarten/.test(H)&&/Fitness/.test(H)&&/Ziele</.test(H));`);
  const b = `ok('Statistiken nur kanonisch: Sportarten 3, Fitness CTL 41, Einheiten/Zielaufbau —', />3<\\/b>/.test(H)&&/>41<\\/b>/.test(H)&&(H.slice(H.indexOf('ig-stats'),H.indexOf('sectlabel')).match(/>—</g)||[]).length===2);`;
  if (!s.includes(b)) throw new Error('parity b');
  s = s.replace(b, `ok('Statistiken nur kanonisch: Sportarten 3, Fitness CTL 41, Einheiten/Ziele ohne Vertrag —', />3<\\/b>/.test(H)&&/>41<\\/b>/.test(H)&&(H.slice(H.indexOf('ig-stats'),H.indexOf('sectlabel')).match(/>—</g)||[]).length>=1);`);
  fs.writeFileSync(f, s);
}
console.log('tests patched');
