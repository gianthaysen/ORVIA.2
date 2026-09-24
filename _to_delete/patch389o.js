const fs=require('fs');const F='supabase/tests/strength_profile_test.mjs';let s=fs.readFileSync(F,'utf8');
const pairs=[
["const mFlat = S.build(flat, { today: d(5), gymVolume: GV, strengthProgression: SPG }).exerciseModel('brustpresse');",
 "const bFlat = S.build(flat, { today: d(5), gymVolume: GV, strengthProgression: SPG });\n  const mFlat = bFlat.exerciseModel(bFlat.exercises[0].key);"],
["const mStale = S.build(flat, { today: '2026-11-01', gymVolume: GV, strengthProgression: SPG }).exerciseModel('brustpresse');",
 "const bStale = S.build(flat, { today: '2026-11-01', gymVolume: GV, strengthProgression: SPG });\n  const mStale = bStale.exerciseModel(bStale.exercises[0].key);"],
["const mJump = S.build(jump, { today: d(4), gymVolume: GV, strengthProgression: SPG }).exerciseModel('trizepsdruecken');",
 "const bJump = S.build(jump, { today: d(4), gymVolume: GV, strengthProgression: SPG });\n  const mJump = bJump.exerciseModel(bJump.exercises[0].key);"],
["const mPu = S.build(pu, { today: d(3), gymVolume: GV, strengthProgression: SPG, bodyweightSeries: [{ date: '2026-05-01', kg: 71 }] }).exerciseModel('klimmzuege');",
 "const bPu = S.build(pu, { today: d(3), gymVolume: GV, strengthProgression: SPG, bodyweightSeries: [{ date: '2026-05-01', kg: 71 }] });\n  const mPu = bPu.exerciseModel(bPu.exercises[0].key);"],
["const mMix = S.build(puMixed, { today: d(2), gymVolume: GV, strengthProgression: SPG }).exerciseModel('klimmzuege');",
 "const bMix = S.build(puMixed, { today: d(2), gymVolume: GV, strengthProgression: SPG });\n  const mMix = bMix.exerciseModel(bMix.exercises[0].key);"],
["const mLt = S.build(lightTest, { today: d(2), gymVolume: GV, strengthProgression: SPG }).exerciseModel('seitheben');",
 "const bLt = S.build(lightTest, { today: d(2), gymVolume: GV, strengthProgression: SPG });\n  const mLt = bLt.exerciseModel(bLt.exercises[0].key);"]
];
for(const [a,b] of pairs){ if(s.indexOf(a)<0) throw new Error('nf: '+a.slice(0,40)); s=s.replace(a,b); }
fs.writeFileSync(F,s); console.log('ok');
