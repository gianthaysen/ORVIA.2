import re
p='app/js/adaptive-card.js'; s=open(p,encoding='utf-8').read()
reps=[
("return teile.length ? teile.join(' · ') : 'unbestimmt — wirkt nicht';","return teile.length ? teile.join(' · ') : _adcT('adc.unbestimmt_wirkt_nicht');"),
("function tag(ix) { return tage[ix] || ('' + _adcT('adc.tag') + '' + (ix + 1)); }","function tag(ix) { return tage[ix] || _adcT('adc.tag_n', { n: ix + 1 }); }"),
("(v.current.sessions != null ? _esc(v.current.sessions) + '' + _adcT('adc.einheiten') + '' : '—') +\n        (v.current.weeklyLoad != null ? '' + _adcT('adc.wochenlast') + '' + _esc(_r1(v.current.weeklyLoad)) : '') + '</b></p>');",
 "(v.current.sessions != null ? _adcT('adc.n_einheiten', { n: _esc(v.current.sessions) }) : '—') +\n        (v.current.weeklyLoad != null ? _adcT('adc.wochenlast_n', { n: _esc(_r1(v.current.weeklyLoad)) }) : '') + '</b></p>');"),
("h.push('<p class=\"adx-why\">Geschätzter Zeitraum: etwa ' + _esc(f.estimatedWeeksRange.min) +\n          (f.estimatedWeeksRange.max != null ? ' bis ' + _esc(f.estimatedWeeksRange.max) + '' + _adcT('adc.wochen') + ''\n            : '' + _adcT('adc.wochen_oder_deutlich_mehr') + '') + ' — Spanne, keine Terminzusage.</p>');",
 "h.push('<p class=\"adx-why\">' + (f.estimatedWeeksRange.max != null\n          ? _adcT('adc.zeitraum_min_bis_max', { min: _esc(f.estimatedWeeksRange.min), max: _esc(f.estimatedWeeksRange.max) })\n          : _adcT('adc.zeitraum_min_oder_mehr', { min: _esc(f.estimatedWeeksRange.min) })) + '</p>');"),
("h.push('<p class=\"adx-model\">Grundlage: Erfahrungswerte vergleichbarer Sportler' +\n          (f.evidence === 'weak' ? '' + _adcT('adc.beleglage_schwach') + '' : '') +\n          ' — kein auf dich individualisiertes Modell.</p>');",
 "h.push('<p class=\"adx-model\">' + _adcT(f.evidence === 'weak' ? 'adc.modell_population_schwach' : 'adc.modell_population') + '</p>');"),
("': würde entfallen <i>(' + _esc(c.scope) + ')</i></p>');","': ' + _adcT('adc.wuerde_entfallen') + ' <i>(' + _esc(c.scope) + ')</i></p>');"),
("_esc(c.unit) + '' + _adcT('adc.intensitaet') + '' +\n          _esc(c.from) + ' → ' + _esc(c.to) + ' <i>(' + _esc(c.scope) + ')</i></p>');",
 "_esc(c.unit) + ': ' + _adcT('adc.intensitaet_von_nach', { from: _esc(c.from), to: _esc(c.to) }) + ' <i>(' + _esc(c.scope) + ')</i></p>');"),
("h.push('<p class=\"adx-gap\">Restlücke: ' + _esc(_r1(v.residualGap.value)) +\n        ' (' + _esc(v.residualGap.status === 'under_target' ? '' + _adcT('adc.unter_dem_ziel') + '' : '' + _adcT('adc.ueber_dem_ziel') + '') + ')' +\n        (v.residualGap.reasons.length ? '' + _adcT('adc.grund') + '' + v.residualGap.reasons.map(_esc).join(', ') : '') + '</p>');",
 "h.push('<p class=\"adx-gap\">' + _adcT('adc.restluecke', { value: _esc(_r1(v.residualGap.value)), status: _esc(_adcT(v.residualGap.status === 'under_target' ? 'adc.unter_dem_ziel' : 'adc.ueber_dem_ziel')) }) +\n        (v.residualGap.reasons.length ? _adcT('adc.grund_liste', { reasons: v.residualGap.reasons.map(_esc).join(', ') }) : '') + '</p>');"),
]
for a,b in reps:
    assert a in s, a[:60]; s=s.replace(a,b)
open(p,'w',encoding='utf-8').write(s)
d=open('app/locales/de.js',encoding='utf-8').read()
add={
"adc.unbestimmt_wirkt_nicht":"unbestimmt — wirkt nicht",
"adc.tag_n":"Tag {n}",
"adc.n_einheiten":"{n} Einheiten",
"adc.wochenlast_n":" · Wochenlast {n}",
"adc.zeitraum_min_bis_max":"Geschätzter Zeitraum: etwa {min} bis {max} Wochen — Spanne, keine Terminzusage.",
"adc.zeitraum_min_oder_mehr":"Geschätzter Zeitraum: etwa {min} Wochen oder deutlich mehr — Spanne, keine Terminzusage.",
"adc.modell_population":"Grundlage: Erfahrungswerte vergleichbarer Sportler — kein auf dich individualisiertes Modell.",
"adc.modell_population_schwach":"Grundlage: Erfahrungswerte vergleichbarer Sportler, Beleglage schwach — kein auf dich individualisiertes Modell.",
"adc.wuerde_entfallen":"würde entfallen",
"adc.intensitaet_von_nach":"Intensität {from} → {to}",
"adc.restluecke":"Restlücke: {value} ({status})",
"adc.grund_liste":" — Grund: {reasons}",
}
old="    /* ---- adc.* — Adaptive-Karte (B-13, 12.09.) ---- */\n"; assert old in d
d=d.replace(old, old+"".join("    '%s': '%s',\n"%(k,v) for k,v in add.items()))
for k in ['adc.tag','adc.einheiten','adc.wochenlast','adc.wochen','adc.wochen_oder_deutlich_mehr','adc.beleglage_schwach','adc.intensitaet','adc.grund']:
    if ("'%s'"%k) not in s:
        d,n=re.subn(r"^\s*'%s': .*\n"%re.escape(k),'',d,flags=re.M); assert n==1,k
open('app/locales/de.js','w',encoding='utf-8').write(d)
print('ok')
