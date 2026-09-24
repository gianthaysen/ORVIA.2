import re,sys
files=sys.argv[1:]
def addimp(s):
    if "from './_i18n-src.mjs'" in s:
        if 'tStub' in s.split("from './_i18n-src.mjs'")[0].rsplit('import',1)[1]: return s
        return s.replace("import { srcHasText } from './_i18n-src.mjs';","import { srcHasText, tStub } from './_i18n-src.mjs';").replace("import { catalog } from './_i18n-src.mjs';","import { catalog, tStub } from './_i18n-src.mjs';")
    m=None
    for mm in re.finditer(r"^import [^\n]*\n", s, re.M): m=mm
    if not m: return "import { tStub } from './_i18n-src.mjs';\n"+s
    return s[:m.end()]+"import { tStub } from './_i18n-src.mjs';\n"+s[m.end():]
for f in files:
    p=f+'_test.mjs'; s=open(p,encoding='utf-8').read(); o=s
    # createContext
    s=re.sub(r"^(\s*)vm\.createContext\((\w+)\);", lambda m: "%s%s._uiT = tStub().t;   // B-13: ui.js-Ausschnitte lesen Texte ueber _uiT\n%svm.createContext(%s);"%(m.group(1),m.group(2),m.group(1),m.group(2)) if ('_uiT' not in s) else m.group(0), s, flags=re.M)
    # global eval
    if re.search(r"\(0, ?eval\)|runInThisContext", s) and 'globalThis._uiT' not in s:
        lines=s.split('\n'); last=0
        for i,l in enumerate(lines):
            if l.startswith('import '): last=i
        lines.insert(last+1, "globalThis._uiT = tStub().t;   // B-13: ui.js-Ausschnitte lesen Texte ueber _uiT")
        s='\n'.join(lines)
    if s!=o:
        s=addimp(s); open(p,'w',encoding='utf-8').write(s); print('patched',p)
    else: print('unchanged',p)
