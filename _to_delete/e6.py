p='js/profile-model.js'; s=open(p,encoding='utf-8').read()
a="      { key: 'injuryHistory', label: 'Verletzungshistorie', type: 'text' }"; assert a in s
s=s.replace(a,"      /* S1/E6 (12.09.2026): Verletzungen gehoeren zu den Beschwerden/Einschraenkungen (constraintsList) — dort liest sie\n         B-09 (absence-replanner). Als Zielfeld wurde der Text nirgends gelesen. type 'link' rendert einen Verweis. */\n      { key: 'injuryHistory', label: 'Verletzungen / Beschwerden', type: 'link', target: 'constraints' }")
open(p,'w',encoding='utf-8').write(s)
p='js/profile.js'; s=open(p,encoding='utf-8').read()
a="function _gwField(f,cd){var id='gwf_'+f.key;var v=cd[f.key];"; assert a in s
s=s.replace(a,"function _gwField(f,cd){var id='gwf_'+f.key;var v=cd[f.key];\n  if(f.type==='link')return '<div class=\"gm-field\"><label>'+escH(f.label)+'</label><button type=\"button\" class=\"gmc-b\" onclick=\"openProfileSection(\\''+escH(f.target||'constraints')+'\\')\">'+T('pf.in_beschwerden_pflegen')+'</button><div class=\"gmc-meta\">'+T('pf.beschwerden_liest_der_plan')+'</div></div>';")
a="  if(key==='details'){var fields=M.categoryFieldsFor(d.category);var html='';"; assert a in s
s=s.replace(a,"  if(key==='details'){var fields=M.categoryFieldsFor(d.category);var html='';\n    /* S1/E7 (12.09.2026): Feld-Audit — kein Konsument in Engine/Planer liest categoryData (77 Felder). Ehrlicher Hinweis statt stiller Eingabe. */\n    if(fields.length)html+='<p class=\"note gw-audit\" style=\"text-align:left\">' + T('pf.details_ohne_planwirkung') + '</p>';")
# _gwCollect: link-Felder ueberspringen
a="  else if(st==='details'){var M=pmModel();M.categoryFieldsFor(d.category).forEach(function(f){if(f.type==='select'){"; assert a in s
s=s.replace(a,"  else if(st==='details'){var M=pmModel();M.categoryFieldsFor(d.category).forEach(function(f){if(f.type==='link')return;if(f.type==='select'){")
open(p,'w',encoding='utf-8').write(s)
d=open('locales/de.js',encoding='utf-8').read()
a="    'pf.rr_keine_passende_aktivitaet': 'Keine passende Aktivität mehr gefunden.',\n"; assert a in d
d=d.replace(a,a+"    'pf.in_beschwerden_pflegen': 'In Beschwerden & Einschränkungen pflegen',\n    'pf.beschwerden_liest_der_plan': 'Beschwerden liest der Plan (Ausfall- und Belastungslogik) — ein Text am Ziel nicht.',\n    'pf.details_ohne_planwirkung': 'Diese Angaben werden gespeichert, fließen aber derzeit nicht in die Planung ein. Was den Plan steuert: Zielart, Zielwert, Datum, Priorität — und deine Verfügbarkeit, Leistungswerte und Beschwerden im Profil.',\n")
open('locales/de.js','w',encoding='utf-8').write(d)
print('ok')
