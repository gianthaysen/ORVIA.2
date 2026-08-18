# Gate A · Kriterium 1 — Neufassung für Band 1

**Zum Übernehmen in Band 1.** Ersetzt die bisherige Fassung, die ausschließlich die
Übereinstimmung der Service-Worker-Version prüfte.

---

## Warum die alte Fassung nicht ausreichte

Sie lautete sinngemäß: *„Live-Version == lokale Version"*, geprüft an der Versionsnummer im
Service Worker. Drei Vorfälle innerhalb von zwei Tagen sind an dieser Prüfung vorbeigelaufen,
und zwar **bei grüner Testsuite** — die Nummer stimmte in allen drei Fällen:

| Datum | Was passierte | Warum Kriterium 1 es nicht sah |
|---|---|---|
| 16.08. | Migration 0035 war nie in der Produktionsinstanz; `target_weight_kg` fehlte, jedes Speichern im Gym-Workout schlug fehl | Kriterium 1 prüft **Code**, nicht **Schema** |
| 16.08. | `styles.css` kam beim Upload nicht mit, `sw.js` meldete trotzdem die neue Version | Die Nummer war identisch — die **Dateien** waren es nicht |
| 17.08. | Der Upload ersetzte die Historie von `main` per Force-Push | Der Inhalt der Wurzel war zufällig korrekt; die Nummer stimmte |

Die Lehre ist nicht „mehr testen", sondern: **Eine Versionsnummer ist eine Behauptung über
den Stand, kein Beleg für ihn.**

---

## Neufassung

> **Gate A · Kriterium 1 — Parität zwischen lokalem Stand und Produktion.**
>
> Ein Bündel gilt erst als ausgeliefert, wenn **alle vier** Paritäten belegt sind. Jede
> verlangt einen eigenen Nachweis; keine ersetzt eine andere. Eine grüne Testsuite ist für
> keine der vier ein Beleg — sie prüft den lokalen Stand gegen sich selbst.
>
> **1.1 Code-Parität.** Die aktive Service-Worker-Version am Gerät entspricht der lokalen.
> *Nachweis:* Versionsnummer in den DevTools, gelesen mit Cache-Buster (`…/sw.js?p=<nr>`),
> plus der `<meta name="orvia-build">`-Marker in `index.html`. Beide müssen übereinstimmen —
> der Marker stand nachweislich schon einmal 136 Versionen still.
>
> **1.2 Datei-Parität der ausgelieferten Wurzel.** Jede Datei des Upload-Satzes ist oben, und
> zwar inhaltsgleich. *Nachweis:* `bash app/tools/deploy-verify.sh` meldet Exit 0. Das Skript
> vergleicht alle Dateien byteweise über den Git-Blob-Hash zwischen `app/` und `origin/main`.
> Sichtprüfung, Dateizahlen und „müsste passen" gelten ausdrücklich **nicht** als Nachweis.
>
> **1.3 Schema-Parität.** Alles, was die Migrationsdateien anlegen, existiert in der
> Produktionsinstanz. *Nachweis:* `supabase/tests/_live-check.sql` im SQL-Editor der
> Produktionsinstanz ausgeführt liefert **kein Ergebnis**. Jede zurückgegebene Zeile ist ein
> fehlendes Objekt. Die Datei wird aus `supabase/migrations/` erzeugt
> (`node app/tools/gen-live-check.mjs`); `live_schema_parity_test.mjs` schlägt fehl, sobald
> sie veraltet ist. `public.schema_migrations` ist als Wahrheitsquelle unzulässig — ein
> erheblicher Teil der Migrationen trägt sich dort nicht ein.
>
> **1.4 Historien-Integrität.** Der Auslieferungszweig wurde fortgeschrieben, nicht ersetzt.
> *Nachweis:* `deploy-verify.sh` meldet „Historie fortgeschrieben"; der gemerkte Stand aus der
> letzten Abnahme ist ein Vorfahre des aktuellen. Ein `forced update` im Fetch-Protokoll ist
> ein Gate-A-Verstoß, auch wenn der Inhalt danach korrekt aussieht.
>
> **Reihenfolge.** Die Service-Worker-Version steigt **nach** bestandener Datei-Parität, nicht
> davor. Ein Cache, der unter einer neuen Nummer mit altem Inhalt gefüllt wurde, ist auf den
> betroffenen Geräten nicht mehr korrigierbar — nur eine weitere Versionsnummer bricht ihn auf.
>
> **Bei Abweichung.** Nicht nachbessern, sondern den vorherigen Stand als **neuen Commit**
> wiederherstellen. Force-Push ist in jeder Form ausgeschlossen und serverseitig gesperrt
> (siehe Kriterium 2).

---

## Was sich dadurch operativ ändert

| | vorher | nachher |
|---|---|---|
| Prüfungen vor der Freigabe | 1 (Versionsnummer) | 4, jede mit eigenem Nachweis |
| Aufwand | Blick in die DevTools | ein Skriptlauf + eine SQL-Abfrage, ~2 Minuten |
| Schema | ungeprüft | 112 Objekte |
| Ausgelieferte Dateien | ungeprüft | 159, byteweise |
| Historie | ungeprüft | Vorfahren-Prüfung bei jeder Abnahme |

---

## Anmerkung zu Kriterium 2

Kriterium 2 (Branch-Schutz) ist seit 17.08.2026 erfüllt und belegt: Rulesets `Schutz
Auslieferung` und `Schutz Entwicklung`, jeweils *Block force pushes* und *Restrict deletions*,
Bypass-Liste leer, Nachweis über zwei abgelehnte Pushes in
`docs/GATE-A-NACHWEIS-BRANCHSCHUTZ.md`.

Ausdrücklich **nicht** Teil von Kriterium 2 sind PR-Pflicht und erzwungene Statuschecks: Beide
würden den Upload-Weg in die Wurzel bzw. `git push origin main:entwicklung` blockieren, ohne
einen der drei tatsächlich eingetretenen Vorfälle zu verhindern.
