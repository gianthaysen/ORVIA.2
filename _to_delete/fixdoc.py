p='app/docs/B-09-STAND.md'; s=open(p,encoding='utf-8').read()
i=s.index('- **Verletzungs-Meldung in der UI**'); j=s.index('\n', i)
new='- ~~Verletzungs-Meldung in der UI~~ **erledigt 11.09.** (`absence-replanner@2`): Verletzung wird aus den Profil-Beschwerden abgeleitet (`constraintsList`, nur `status: active`): `currentlyTrainable === false`, **oder** Laufen unter „betroffene Sportarten", **oder** untere Extremität mit Intensität ≥ 7/10. Schulter 9/10 oder „beobachtet" sind keine Verletzung — sonst verlöre jeder mit einer Notiz seinen Laufplan. Keine neue UI: der bestehende Beschwerden-Editor ist die Meldung.'
s=s[:i]+new+s[j:]; open(p,'w',encoding='utf-8').write(s); print('ok')
