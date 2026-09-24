import re
p='app/js/insights.js'; s=open(p,encoding='utf-8').read()
reps=[
("'' + _insT('ins.in') + '' + bad + ' von ' + cases + '' + _insT('ins.faellen_stieg_am_folgetag_der') + ''", "_insT('ins.grund_folgetag_knie_hrv', { bad: bad, cases: cases })"),
("'' + _insT('ins.nach') + '' + cases + '' + _insT('ins.gym_lauf_folgen_stieg_in') + '' + bad + '' + _insT('ins.faellen_am_lauftag_der_knie') + ''", "_insT('ins.grund_gym_lauf_knie', { bad: bad, cases: cases })"),
("over.length + '' + _insT('ins.easy_laeufe_lagen') + '' + avg + '' + _insT('ins.s_km_unter_dem_easy') + '' + Calc.fmtPace(easy.lo) + '–' + Calc.fmtPace(easy.hi) + ').'", "_insT('ins.grund_easy_zu_schnell', { n: over.length, avg: avg, lo: Calc.fmtPace(easy.lo), hi: Calc.fmtPace(easy.hi) })"),
("'' + _insT('ins.easy_konsequent') + '' + Calc.fmtPace(easy.lo) + '/km oder langsamer laufen.'", "_insT('ins.rec_easy_konsequent', { lo: Calc.fmtPace(easy.lo) })"),
("'' + _insT('ins.aktuell') + '' + c.hrvDevPct.toFixed(0) + '% unter dem 7-Tage-Schnitt.'", "_insT('ins.grund_hrv_unter_schnitt', { pct: c.hrvDevPct.toFixed(0) })"),
("Math.round(c.weekKm) + ' von ' + c.targetKm + '' + _insT('ins.km_soll') + '' + Math.round((c.weekKm / c.targetKm - 1) * 100) + '% drüber).'", "_insT('ins.grund_volumen_ueber_plan', { km: Math.round(c.weekKm), soll: c.targetKm, pct: Math.round((c.weekKm / c.targetKm - 1) * 100) })"),
("'' + _insT('ins.nur') + '' + w.proteinDays + '' + _insT('ins.7_tage_im_zielbereich') + ''", "_insT('ins.grund_protein_tage', { days: w.proteinDays })"),
("' + _insT('ins.nach') + '~7 Tagen Daten erkennt ORVIA erste Muster. ' + _insT('ins.aktuell') + '' + n + ' Tage.</p>", "' + _insT('ins.leer_nach_7_tagen', { n: n }) + '</p>"),
]
for a,b in reps:
    assert a in s, a[:50]; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
d=open('app/locales/de.js',encoding='utf-8').read()
add={
"ins.grund_folgetag_knie_hrv":"In {bad} von {cases} Fällen stieg am Folgetag der Knie-Schmerz oder die HRV fiel deutlich.",
"ins.grund_gym_lauf_knie":"Nach {cases} Gym→Lauf-Folgen stieg in {bad} Fällen am Lauftag der Knie-Schmerz.",
"ins.grund_easy_zu_schnell":"{n} Easy-Läufe lagen Ø {avg} s/km unter dem Easy-Bereich ({lo}–{hi}).",
"ins.rec_easy_konsequent":"Easy konsequent {lo}/km oder langsamer laufen.",
"ins.grund_hrv_unter_schnitt":"Aktuell {pct}% unter dem 7-Tage-Schnitt.",
"ins.grund_volumen_ueber_plan":"{km} von {soll} km Soll ({pct}% drüber).",
"ins.grund_protein_tage":"Nur {days}/7 Tage im Zielbereich.",
"ins.leer_nach_7_tagen":"Nach ~7 Tagen Daten erkennt ORVIA erste Muster. Aktuell {n} Tage.",
}
old="    /* ---- ins.* — Insights-Karten (B-13, 12.09.) ---- */\n"; assert old in d
d=d.replace(old, old+"".join("    '%s': '%s',\n"%(k,v) for k,v in add.items()))
for k in ['ins.in','ins.faellen_stieg_am_folgetag_der','ins.nach','ins.gym_lauf_folgen_stieg_in','ins.faellen_am_lauftag_der_knie','ins.easy_laeufe_lagen','ins.s_km_unter_dem_easy','ins.easy_konsequent','ins.aktuell','ins.km_soll','ins.nur','ins.7_tage_im_zielbereich']:
    if ("'%s'"%k) not in s:
        d,n=re.subn(r"^\s*'%s': .*\n"%re.escape(k),'',d,flags=re.M); assert n==1,k
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('ok')
