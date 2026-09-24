import re
p='app/js/race.js'; s=open(p,encoding='utf-8').read()
reps=[
("'' + _raceT('race.warm_up_10_15_min') + '' + (dist <= 10 ? '' + _raceT('race.4_5_strides') + '' : '' + _raceT('race.2_3_strides') + '')", "_raceT(dist <= 10 ? 'race.warmup_strides_4_5' : 'race.warmup_strides_2_3')"),
("'' + _raceT('race.start_erste') + '' + (dist >= 21 ? '3 km' : dist >= 10 ? '2 km' : '1 km') + ' bewusst bei ~' + Calc.fmtPace(tp + 8) + '' + _raceT('race.km_8_s_km_unter') + ''", "_raceT('race.start_bewusst', { km: dist >= 21 ? 3 : dist >= 10 ? 2 : 1, pace: Calc.fmtPace(tp + 8) })"),
("'' + _raceT('race.hauptteil_in_zielpace') + '' + Calc.fmtPace(tp) + '' + _raceT('race.km_einpendeln_gleichmaessig_laufen') + ''", "_raceT('race.hauptteil_zielpace', { pace: Calc.fmtPace(tp) })"),
("head = '' + _raceT('race.heute_ist_dein') + '' + label + '. Vertrau dem Plan.'", "head = _raceT('race.heute_ist_dein_label', { label: label })"),
("head = '' + _raceT('race.noch') + '' + d + '' + _raceT('race.tag') + '' + (d === 1 ? '' : 'e') + '.'", "head = _raceT('race.noch_n_tage', { count: d })"),
("head = '' + _raceT('race.race_week_noch') + '' + d + '' + _raceT('race.tage') + ''", "head = _raceT('race.race_week_noch_n', { n: d })"),
("head = '' + _raceT('race.taper_phase_noch') + '' + d + '' + _raceT('race.tage') + ''", "head = _raceT('race.taper_noch_n', { n: d })"),
("head = '' + _raceT('race.noch') + '' + d + '' + _raceT('race.tage_bis') + '' + label + '.'", "head = _raceT('race.noch_n_tage_bis', { n: d, label: label })"),
]
for a,b in reps:
    assert a in s, a[:50]; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
d=open('app/locales/de.js',encoding='utf-8').read()
add={
"race.warmup_strides_4_5":"Warm-up: 10–15 min locker + 4–5 Strides",
"race.warmup_strides_2_3":"Warm-up: 10–15 min locker + 2–3 Strides",
"race.start_bewusst":"Start: erste {km} km bewusst bei ~{pace}/km (8 s/km unter Zielpace)",
"race.hauptteil_zielpace":"Hauptteil: in Zielpace {pace}/km einpendeln, gleichmäßig laufen",
"race.heute_ist_dein_label":"Heute ist dein {label}. Vertrau dem Plan.",
"race.noch_n_tage.one":"Noch {count} Tag.",
"race.noch_n_tage.other":"Noch {count} Tage.",
"race.race_week_noch_n":"Race Week — noch {n} Tage.",
"race.taper_noch_n":"Taper-Phase — noch {n} Tage.",
"race.noch_n_tage_bis":"Noch {n} Tage bis {label}.",
}
old="    /* ---- race.* — Wettkampf-Karte (B-13, 12.09.) ---- */\n"; assert old in d
d=d.replace(old, old+"".join("    '%s': '%s',\n"%(k,v) for k,v in add.items()))
for k in ['race.warm_up_10_15_min','race.4_5_strides','race.2_3_strides','race.start_erste','race.km_8_s_km_unter','race.hauptteil_in_zielpace','race.km_einpendeln_gleichmaessig_laufen','race.heute_ist_dein','race.noch','race.tag','race.tage','race.race_week_noch','race.taper_phase_noch','race.tage_bis']:
    if ("'%s'"%k) not in s:
        d,n=re.subn(r"^\s*'%s': .*\n"%re.escape(k),'',d,flags=re.M); assert n==1,k
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('ok')
