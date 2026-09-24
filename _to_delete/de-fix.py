p='app/locales/de.js'; s=open(p,encoding='utf-8').read()
old="    'pf.zusammenfassung': 'Zusammenfassung'\n  \n\n    /* ---- auth.*"
assert old in s
s=s.replace(old,"    'pf.zusammenfassung': 'Zusammenfassung',\n\n    /* ---- auth.*")
s=s.replace("    'auth.zugang_wird_gerade_vorbereitet_bitte': 'Zugang wird gerade vorbereitet. Bitte später erneut versuchen.',\n};","    'auth.zugang_wird_gerade_vorbereitet_bitte': 'Zugang wird gerade vorbereitet. Bitte später erneut versuchen.'\n  };")
open(p,'w',encoding='utf-8').write(s)
