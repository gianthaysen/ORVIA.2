# Engine-Plan aktivieren

Der Wochenplan aus der Engine ersetzt deinen bisherigen Plan. Das ist
rücknehmbar, aber es ist ein echter Eingriff — deshalb hängt er an einem
serverseitigen Schalter und nicht an einem Knopf in der App.

**Warum kein Knopf:** `engine_v2_plan` liegt in `user_feature_flags` und wird
bei jedem Start vom Server geholt. Das ist bewusst so: ein serverseitig
abgeschaltetes Feature bleibt abgeschaltet, auch wenn die App offline ist oder
jemand am lokalen Zustand dreht. Ein App-Knopf, der das umgeht, würde den
Kill-Switch entwerten. Deshalb: der Schalter bleibt, wo er hingehört.

---

## Vorher: die Vorschau ansehen

Profil → **Geräte & Datenquellen** → **Trainingsplan-Vorschau (Engine)** →
*Engine-Woche berechnen*.

Das ändert nichts. Wenn dort Unsinn steht, brauchst du die nächsten Schritte
gar nicht.

---

## Schritt 1 · Schalter setzen

Im Supabase-SQL-Editor:

```sql
insert into public.user_feature_flags (user_id, flag, enabled, reason)
values (auth.uid(), 'engine_v2_plan', true, 'manuelle Freigabe durch Nutzer')
on conflict (user_id, flag)
do update set enabled = true, reason = excluded.reason;
```

Falls du nicht als der Nutzer eingeloggt bist, dessen Plan es betrifft, setz
statt `auth.uid()` die konkrete `user_id` ein.

## Schritt 2 · App neu laden

Der Schalter wird beim Start geholt und hat eine Gültigkeitsdauer. Ohne Neuladen
merkt die laufende App nichts davon.

## Schritt 3 · Aktivieren

In der Browser-Konsole:

```js
ORVIA.enginePlanActivate()
```

Das Ergebnis sagt, was passiert ist:

| `reason` | Bedeutung |
|---|---|
| `applied` | die Engine-Woche ist jetzt dein Plan |
| `unchanged` | die Engine rechnet dieselbe Woche wie bisher — nichts zu tun |
| `flag_off` | Schritt 1 oder 2 fehlt |
| `would_drop_overrides` | ein von dir geänderter Termin ginge verloren — **nicht** aktiviert |
| `projection_empty` | die Engine liefert keine Woche — dein Plan bleibt |
| `no_canonical_plan` | es gibt noch keinen Plan im neuen Format |

---

## Rückweg

```js
ORVIA.enginePlanRevert()
```

Stellt den Zustand von vor der Aktivierung wieder her. Der Schnappschuss
entsteht bei der Aktivierung und ist eine echte Kopie — geprüft in
`phase8_plan_activation` (A5/A6).

Danach ggf. den Schalter wieder ausmachen:

```sql
update public.user_feature_flags set enabled = false
where user_id = auth.uid() and flag = 'engine_v2_plan';
```

---

## Was dabei geschützt ist

- **Deine eigenen Änderungen.** Ginge auch nur ein Override verloren, wird
  nicht aktiviert (`would_drop_overrides`). Die Buchhaltung muss aufgehen:
  jeder Override ist danach entweder erhalten, verschoben oder als Konflikt
  benannt — nie still verschwunden.
- **Eine leere Woche.** Sie zu schreiben hieße, dir den Plan wortlos
  wegzunehmen. Wird abgelehnt.
- **Doppelte Aktivierung.** Rechnet die Engine dieselbe Woche, passiert nichts
  (`unchanged`) — keine Revisionsnummer, die bei jedem Öffnen hochzählt. Seit
  v8-333 erkennt der Vergleich auch geänderte Verordnungen bei gleicher Dauer.

## Was dabei nicht geschützt ist

Der Engine-Plan ist inhaltlich nur so gut wie das hinterlegte Wissen. Aktuell
ist das **eine** Sportart (Laufen), wissenschaftlich ungeprüft. Für Gym gibt es
noch kein Paket. Erwarte keine sinnvollen Kraftvorgaben, solange du keine
Quellen eingespeist hast.
