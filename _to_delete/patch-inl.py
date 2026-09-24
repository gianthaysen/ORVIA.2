import re
def addimp(s, name):
    if "from './_i18n-src.mjs'" in s:
        m=re.search(r"import \{([^}]*)\} from './_i18n-src.mjs';", s)
        names=[x.strip() for x in m.group(1).split(',') if x.strip()]
        if name not in names: names.append(name)
        return s[:m.start()]+"import { "+", ".join(names)+" } from './_i18n-src.mjs';"+s[m.end():]
    last=None
    for mm in re.finditer(r"^import [^\n]*\n", s, re.M): last=mm
    return s[:last.end()]+"import { %s } from './_i18n-src.mjs';\n"%name+s[last.end():]
reps={
 'analysis_endurance_v5_test.mjs':[("ui=R(_APPREL + 'js/ui.js')","ui=inlined(R(_APPREL + 'js/ui.js'))")],
 'analysis_recovery_v5_test.mjs':[("ui=R(_APPREL + 'js/ui.js')","ui=inlined(R(_APPREL + 'js/ui.js'))")],
 'engine_i3a6_confidence_normalize_test.mjs':[("const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');","const uiSrc = inlined(readFileSync(new URL('ui.js', base), 'utf8'));")],
 'engine_program_e_test.mjs':[("  const ui = readFileSync(new URL('ui.js', base), 'utf8');","  const ui = inlined(readFileSync(new URL('ui.js', base), 'utf8'));")],
 'goal_editor_g0_test.mjs':[("const uiSrc = readFileSync(new URL('ui.js', base), 'utf8');","const uiSrc = inlined(readFileSync(new URL('ui.js', base), 'utf8'));")],
 'muscle_map_pilot_test.mjs':[("const ui=fs.readFileSync(new URL(_APPREL + 'js/ui.js',import.meta.url),'utf8');","const ui=inlined(fs.readFileSync(new URL(_APPREL + 'js/ui.js',import.meta.url),'utf8'));")],
 'phase1a_trust_test.mjs':[("const ui = readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8');","const ui = inlined(readFileSync(new URL(_APPREL + 'js/ui.js', import.meta.url), 'utf8'));")],
 'phase4_quality_test.mjs':[("const ui = R('js/ui.js');","const ui = inlined(R('js/ui.js'));")],
 'phase1b_attrappen_test.mjs':[("const ui = R('js/ui.js');","const ui = inlined(R('js/ui.js'));")],
 'phase6_contracts_test.mjs':[("R('js/ui.js').indexOf('ohne gemessenen Ruhepuls bzw. HFmax kein TRIMP (kein Fallback)') >= 0","inlined(R('js/ui.js')).indexOf('ohne gemessenen Ruhepuls bzw. HFmax kein TRIMP (kein Fallback)') >= 0")],
 'quickadd_v8_test.mjs':[("const ui = R(_APPREL + 'js/ui.js');","const ui = inlined(R(_APPREL + 'js/ui.js'));")],
}
for f,rs in reps.items():
    s=open(f,encoding='utf-8').read(); o=s
    for a,b in rs:
        if a not in s: print('MISS',f,a[:50]); continue
        s=s.replace(a,b)
    if s!=o: s=addimp(s,'inlined'); open(f,'w',encoding='utf-8').write(s); print('ok',f)
