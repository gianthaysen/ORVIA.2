# -*- coding: utf-8 -*-
import json, re
p='app/js/workout-ui.js'; s=open(p,encoding='utf-8').read()
# (exakter Text im Literal, Key, Katalogwert)  — Reihenfolge: laengere Texte zuerst
M=[
 ("Aktion konnte nicht abgeschlossen werden. Bitte erneut versuchen.","wo.err.generic",None),
 ("Es läuft bereits ein Workout. Es wurde geöffnet.","wo.err.activeExists",None),
 ("Zugriff nicht möglich. Bitte melde dich erneut an.","wo.err.auth",None),
 ("Die App schreibt ein Feld, das diese Datenbank nicht kennt — eine Migration fehlt. Wiederholen hilft nicht.","wo.err.schema",None),
 ("Verbindung unterbrochen. Änderungen werden lokal gespeichert.","wo.err.offline",None),
 ("Die Einheit konnte nicht vollständig geladen werden.","wo.err.fk",None),
 ("Eingabe prüfen.","wo.err.validation",None),
 ("Dauer nicht erfasst","wo.durationMissing",None),
 ("Training öffnen","wo.openTraining",None),
 ("Nicht bestimmbar","wo.notAssessable",None),
 ("Heutige Aktivität","wo.today.title",None),
 ("Training läuft · ","wo.today.runningWith",None),
 ("Noch keine Aktivität erfasst.","wo.today.none",None),
 ("Pausiert seit deiner letzten Aktion — die Wartezeit zählt nicht als Trainingszeit.","wo.resume.pausedNote",None),
 ("Pausiert · bisher ","wo.resume.pausedFor",None),
 (" min trainiert","wo.resume.minTrained",None),
 ("Läuft · ","wo.resume.runningFor",None),
 (" läuft noch","wo.resume.stillRunning",None),
 ("Übungsbibliothek & eigene Übungen","wo.hub.libSub",None),
 ("<b>Übungen</b>","<b>' + T('wo.hub.lib') + '</b>","__RAW__"),
 (" Minuten · ","wo.hub.minutesSep",None),
 ("Altes aktives Training gefunden","wo.hub.orphan",None),
 ("Training läuft","wo.hub.running",None),
 ("Gestartet vor ","wo.hub.startedAgo",None),
 (" Minuten","wo.hub.minutes",None),
 ("Festhängendes Training beenden","wo.hub.endStuck",None),
 ("Training verwerfen (löschen)","wo.opt.discardDelete",None),
 ("Training verwerfen","wo.hub.discard",None),
 ("Endgültig löschen","wo.deleteForever",None),
 ("Weitere Aktivität","wo.tiles.more",None),
 ("Alle Sportarten","wo.tiles.all",None),
 ("Krafttraining","wo.tiles.gym",None),
 ("Training starten","wo.hub.start",None),
 ("Freie Einheit oder Schnellstart wählen","wo.hub.startSub",None),
 ("Verlauf offline nicht verfügbar.","wo.hist.offline",None),
 ("Workout löschen","wo.det.delete",None),
 ("Workout-Details","wo.det.title",None),
 ("Workout wirklich löschen?","wo.det.deleteQ",None),
 ("Das Workout inkl. Übungen und Sätzen wird dauerhaft entfernt.","wo.det.deleteBody",None),
 ("Workout gelöscht","wo.det.deleted",None),
 (" Arbeitssätze","wo.det.workingSets",None),
 ("Keine Sätze","wo.det.noSets",None),
 ("Kein aktives Workout mehr.","wo.noActive",None),
 ("Workout beenden?","wo.stuck.endQ",None),
 ("Es wird als „abgebrochen\" beendet, damit du ein neues starten kannst.","wo.stuck.endBody",None),
 ("Starte zuerst ein Workout, um Übungen hinzuzufügen.","wo.startFirst",None),
 ("Offline gestartet – wird synchronisiert ⏳","wo.startedOffline",None),
 (" geplanten Übungen übernommen — ","wo.planned.appliedSep",None),
 (" fehlgeschlagen.","wo.planned.failedSuffix",None),
 ("Keine der ","wo.planned.noneOf",None),
 (" geplanten Übungen konnte übernommen werden.","wo.planned.noneApplied",None),
 ("(Kontext — ändert den Morgen-Score nicht)","wo.ready.ctx",None),
 ("Tagesform <b>","' + T('wo.ready.label') + ' <b>","__RAW__"),
 ("⏸ Training pausiert — die Dauer läuft nicht weiter. ","wo.paused.note",None),
 ("Plan für heute","wo.plan.today",None),
 ("Geführter Modus ohne GPS — Distanz hier oder beim Beenden eintragen. Pace wird daraus berechnet.","wo.guided.distance",None),
 ("Geführter Modus — Dauer läuft. Beim Beenden Anstrengung (RPE) erfassen.","wo.guided.duration",None),
 ("Noch keine Übung.","wo.empty",None),
 ("Übung hinzufügen","wo.addExercise",None),
 ("Ziel: ","wo.target.prefix",None),
 (" Sätze","wo.sets",None),
 (" Übungen","wo.exercises",None),
 (" Wdh","wo.reps",None),
 ("Überspringen","wo.timer.skip",None),
 ("+ Übung","wo.foot.addExercise",None),
 ("Nächste ›","wo.foot.next",None),
 ("Abschließen","wo.foot.finish",None),
 ("Beckenlänge wählen, je Bahn antippen. Distanz/Pace berechnen sich automatisch.","wo.swim.note",None),
 ("Intervalle abschließen","wo.iv.finish",None),
 ("Schritt abschließen ›","wo.iv.next",None),
 ("Übernehmen & starten","wo.iv.apply",None),
 ("Keine frühere Leistung.","wo.last.none",None),
 ("Satz löschen?","wo.set.deleteQ",None),
 ("Der abgeschlossene Satz wird entfernt.","wo.set.deleteBody",None),
 ("Löschen wartet auf Sync ⏳","wo.set.deletePending",None),
 ("Übung entfernen?","wo.ex.removeQ",None),
 ("Die Übung samt ihrer Sätze wird entfernt.","wo.ex.removeBody",None),
 ("Training beendet ✓","wo.finished",None),
 (" (Last nicht gespeichert)","wo.finishedNoLoad",None),
 ("Training fortsetzen","wo.opt.resume",None),
 ("Training pausieren","wo.opt.pause",None),
 ("Training abbrechen?","wo.abort.q",None),
 ("Die Einheit bleibt im Verlauf als „abgebrochen\" erhalten.","wo.abort.body",None),
 ("Training abbrechen","wo.abort.confirm",None),
 ("Weiter trainieren","wo.abort.cancel",None),
 ("Training wirklich verwerfen?","wo.discard.q",None),
 ("Die bisher erfassten Trainingsdaten dieser Einheit werden dauerhaft gelöscht.","wo.discard.body",None),
 ("Übung auswählen","wo.pick.title",None),
 ("Übung suchen…","wo.pick.searchPh",None),
 ("Übung suchen","wo.pick.search",None),
 ("Suche eingrenzen, um weitere zu sehen.","wo.pick.narrow",None),
 ("Keine Übung gefunden.","wo.pick.none",None),
 ("Schließen","common.close",None),
 ("Zurück","common.back",None),
 ("Abbrechen","common.cancel",None),
 ("Beenden","common.end",None),
 ("Löschen","common.delete",None),
 ("Entfernen","common.remove",None),
 ("Fortsetzen","common.resume",None),
 ("Ersetzen","wo.ex.replace",None),
 ("Satz speichern","wo.set.save",None),
 ("Satz bearbeiten","wo.set.edit",None),
 ("Speichern","common.save",None),
 ("Letztes Training (","wo.last.prefix",None),
 ("Letzte Leistung wird geladen…","wo.last.loading",None),
 ("Satzpause","wo.timer.rest",None),
 ("Aktive Dauer","wo.duration.active",None),
 ("Dauer-Modus","wo.duration.mode",None),
]
catalog={}
count=0
M=sorted(M,key=lambda x:-len(x[0]))
# Plural-Sonderfall vorab
s=s.replace("list.length + ' Übung' + (list.length === 1 ? '' : 'en')","T('wo.pick.count', { count: list.length })")
for text,key,mode in M:
    if mode=="__RAW__":
        n=s.count(text); assert n>=1, text
        s=s.replace(text,key); count+=n; continue
    # nur innerhalb einfach-quotierter Literale ersetzen: Text durch ' + T('key') + '
    n=s.count(text)
    if n==0: continue
    s=s.replace(text,"' + T('"+key+"') + '"); count+=n; catalog[key]=text
# T definieren
s=s.replace("  function WS() { return O.workoutStore; }\n","  function WS() { return O.workoutStore; }\n  /* B-13: nutzersichtbare Texte ueber t() (locales/de.js); ohne i18n-Modul bleibt der Key sichtbar. */\n  function T(k, p) { try { if (O.i18n && typeof O.i18n.t === 'function') return O.i18n.t(k, p); } catch (e) {} return String(k); }\n",1)
open(p,'w',encoding='utf-8').write(s)
# Katalog anhaengen
catalog['wo.hub.lib']='Übungen'; catalog['wo.ready.label']='Tagesform'; catalog['wo.pick.count.one']='{count} Übung'; catalog['wo.pick.count.other']='{count} Übungen'
open('_to_delete/wo-catalog.json','w',encoding='utf-8').write(json.dumps(catalog,ensure_ascii=False,indent=1))
print('replacements',count,'keys',len(catalog))
