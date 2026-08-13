# ORVIA · Engine-Masterplan

**Stand 2026-08-06 · Grundlage: Anforderung „die Engine muss so tief und individuell wie möglich sein"**

Dieses Dokument ist die Antwort auf die Frage, was „so individuell wie möglich" technisch
bedeutet, was davon heute trägt, was fehlt — und in welcher Reihenfolge es gebaut werden
muss, damit am Ende kein System entsteht, das viel kann und wenig davon richtig.

---

## 0. Der eine Satz, an dem alles hängt

> **Eine Engine kann nur so individuell sein wie ihre Eingangsdaten.**

Das ist keine Floskel, sondern die härteste Beschränkung des ganzen Vorhabens. Zwei
Athleten mit identischem Profil bekommen aus jedem Algorithmus denselben Plan — egal wie
tief er rechnet. Individualisierung entsteht **nicht** im Algorithmus, sondern an der
Stelle, an der sich zwei Athleten in den Daten unterscheiden.

**Befund heute:** Die App kennt von einem Nutzer im Wesentlichen
Sportarten, Wunsch-Häufigkeiten, Verfügbarkeit und Check-in-Werte. Sie kennt **nicht**:

| fehlt | Folge |
|---|---|
| Schwellenwerte (Pace/HF/FTP/CSS) | jede Intensitätsvorgabe bleibt RPE-basiert (`no_pace_evidence`) |
| VO2max belastbar gemessen | keine Leistungsprognose möglich |
| 1RM je Hauptübung | Kraftvorgaben bleiben unspezifisch |
| Belastungshistorie im Zugriff der Planung | Plan reagiert nicht auf letzte Woche |
| Verletzungs-/Beschwerdehistorie strukturiert | Einschränkungen wirken nicht auf den Plan |

Solange diese fünf fehlen, ist **jede** weitere Tiefe im Algorithmus wirkungslos: Sie
verfeinert eine Rechnung, deren Eingaben geraten sind. Das ist der Grund, warum die
Reihenfolge unten so aussieht, wie sie aussieht — und nicht mit Sportartenbreite beginnt.

---

## 1. Die vier Ebenen der Individualisierung

Individualisierung ist kein einzelnes Merkmal, sondern vier voneinander unabhängige
Ebenen. Jede kann fehlen, ohne dass die anderen es merken — deshalb müssen sie einzeln
benannt und einzeln gebaut werden.

### Ebene 1 · Kapazität — was verträgt dieser Körper?
Aktuelle Belastbarkeit je Sportart und je Muskelgruppe. Ableitbar aus Trainingshistorie
(Umfänge, Frequenzen, Progression), nicht aus Wunschangaben.
*Status: Adapter existiert (`capacity-adapter`), liefert seit dem P0-Fix echte Werte.*

### Ebene 2 · Leistung — was kann dieser Körper abrufen?
Schwellen, Zonen, Maximalwerte. Das ist die Ebene, die heute vollständig fehlt und ohne
die keine Vorgabe konkret werden kann („Z2 Dauerlauf" statt „45 min @ 5:40–6:05/km").
*Status: Felder vorhanden, Daten nicht. Kein Messweg in der App.*

### Ebene 3 · Anforderung — was verlangt das Ziel?
Was ein Halbmarathon unter 1:50 verlangt, unterscheidet sich grundlegend von dem, was ein
Handball-Kreisläufer braucht. Diese Ebene ist sportart- **und** zielspezifisch.
*Status: 1 Knowledge Pack (Running, unreviewed). Für alle anderen Sportarten:
`plannerSupport: false`.*

### Ebene 4 · Tagesform — was ist heute möglich?
Schlaf, Erholung, Krankheit, Schmerz. Die einzige Ebene, die bereits funktioniert.
*Status: `decision-engine-v2` läuft im Shadow, fünf Gate-Kriterien messbar.*

**Die Engine ist so stark wie ihre schwächste Ebene.** Heute ist das Ebene 2.

---

## 2. Was heute existiert — ohne Beschönigung

| Baustein | Zustand |
|---|---|
| Entscheidungs-Engine (Tagesform) | ✅ gebaut, im Shadow, messbar |
| Wochenaufbau (Rhythmus, Kernreize) | ✅ neu gebaut (`week-plan-designer`) |
| Lastmodell auf Muskelebene | ✅ neu gebaut (`load-profile`), 15 Gruppen |
| Kapazitätsableitung | ✅ gebaut, seit P0-Fix mit echten Daten |
| Scheduler v2 | ✅ gebaut, shadow-only |
| Feature-Flag-Kanal + Canary-Gate | ✅ gebaut, fail-closed |
| Knowledge Pack Running | ⚠️ vorhanden, **unreviewed** |
| Knowledge Packs übrige Sportarten | ❌ existieren nicht |
| Leistungsdiagnostik (Ebene 2) | ❌ existiert nicht |
| Historie → Planung | ❌ Planung liest keine absolvierten Einheiten |
| Verletzungsmodell | ⚠️ Beschwerden erfassbar, wirken nicht auf den Plan |
| Positionsprofile | ❌ existieren nicht |
| Garmin-Export | ❌ nicht möglich (siehe §5) |
| Push-Benachrichtigungen | ❌ nicht gebaut |

---

## 3. Die entscheidende Priorisierungsfrage: Tiefe oder Breite?

Die Anforderung nennt beides: jede Sportart, jede Position — **und** maximale Tiefe.
Beides gleichzeitig ist nicht möglich, und zwar nicht aus Bequemlichkeit, sondern
rechnerisch:

- **Breite:** 24 Sportarten × je ein belastbares Anforderungsprofil × je 3–8 Positionen
  ≈ 100+ Profile. Jedes braucht Recherche, Review und Test. Bei realistisch 1–2 Tagen je
  Profil sind das **6–12 Monate Vollzeit** — und am Ende hat kein einziges davon eine
  Leistungsdiagnostik, auf der es aufsetzen könnte.
- **Tiefe:** Vier Sportarten (Laufen, Rad, Schwimmen, Kraft) mit vollständiger Kette von
  Messung über Zonen bis Vorgabe ≈ **6–10 Wochen** — und deckt 100 % des eigenen
  Trainings ab.

**Empfehlung, klar: Tiefe zuerst.** Begründung in Zahlen:

1. Die eigenen Ziele (HM < 1:50, später Ironman) berühren ausschließlich diese vier
   Sportarten. Ein Handball-Positionsprofil verbessert das eigene Training um **null**.
2. Ohne Ebene 2 ist jedes zusätzliche Sportprofil ein weiteres flaches Profil. Zwanzig
   flache Profile sind schlechter als vier tiefe — sie erzeugen den Eindruck von
   Abdeckung, wo keine ist.
3. Die Architektur für Profil Nummer fünf entsteht beim Bau der ersten vier. Wer mit
   Breite beginnt, baut sie zwanzigmal falsch.

**Was das für Positionsprofile heißt:** Sie sind fachlich richtig gedacht — ein
Kreisläufer braucht Duellkraft und Antritt, ein Rechtsaußen Sprung und Wurfarm. Aber sie
gehören an das **Ende** der Kette, nicht an den Anfang. Ohne Ebene 2 wüsste die App nicht
einmal, wie stark der Antritt heute ist.

---

## 4. Reihenfolge — mit Abhängigkeiten, nicht nach Wunsch

### Stufe A · Die Engine erreicht den Nutzer (Voraussetzung für alles)
Ohne diese Stufe rechnet jede Verbesserung ins Leere — sie kommt nicht an.
- Shadow-Gate schließen (14 Tage Daten, läuft)
- Canary aktivieren, Aktivierungspfad scharf schalten
- **Ergebnis:** Was die Engine rechnet, steht im Plan des Nutzers.

### Stufe B · Ebene 2 — Leistungsdiagnostik *(der eigentliche Engpass)*
- Schwellen-Bestimmung Laufen: Feldtest (30 min TT) + Ableitung aus Wettkampfleistungen
  + Ableitung aus Trainingsdaten (Pace/HF-Verhältnis über Zeit)
- Zonenmodell je Sportart (Lauf-Pace, Rad-Leistung/HF, Schwimm-CSS, Kraft-1RM)
- Konfidenz je Wert — ein geschätzter Wert darf nie wie ein gemessener wirken
- **Ergebnis:** Aus „Z2 Dauerlauf" wird „45 min @ 5:40–6:05/km, HF 135–148".

### Stufe C · Historie wirkt auf die Planung
- Absolvierte Einheiten (inkl. Sätze/Gewichte) fließen in das Lastmodell
- Rollende Belastung je Muskelgruppe über 7/14/28 Tage
- Progression statt Wiederholung: Volumen und Intensität wachsen nachvollziehbar
- **Ergebnis:** Die kommende Woche kennt die vergangene.

### Stufe D · Verletzungs- und Beschwerdemodell
- Strukturierte Erfassung (Ort, Art, Schmerz, Verlauf) — teilweise vorhanden
- Wirkung auf den Plan: betroffene Muskelgruppen/Bewegungsmuster werden gesperrt oder
  gedämpft, Alternativen automatisch eingesetzt
- Red Flags → ärztliche Abklärung, nie stillschweigend weitertrainieren
- **Ergebnis:** Beschwerden ändern den Plan, statt nur dokumentiert zu werden.

### Stufe E · Anforderungsprofile vertiefen (eigene Sportarten)
- Running Pack reviewen (steht als `unreviewed` — das ist ein Sicherheitsthema)
- Rad, Schwimmen, Kraft als vollwertige Packs
- Zielprofile innerhalb einer Sportart: Sprint ≠ 10 km ≠ Marathon ≠ Ultra
- **Ergebnis:** Der Plan folgt dem Ziel, nicht einem Durchschnitt.

### Stufe F · Ausgabe: Uhr und Benachrichtigung
- Garmin-Export (siehe §5 — mit echter Hürde)
- Push-Benachrichtigungen zu geplanten Einheiten
- **Ergebnis:** Der Plan liegt dort, wo trainiert wird.

### Stufe G · Breite — weitere Sportarten und Positionen
Erst hier. Mit der Architektur aus B–E ist jedes weitere Profil Fleißarbeit statt
Neuentwicklung.

---

## 5. Zwei Punkte, bei denen die Erwartung korrigiert werden muss

**Garmin-Export.** „Trainings auf die Uhr spielen" setzt Schreibzugriff auf Garmin Connect
voraus. Den gibt es ausschließlich über das **Garmin Developer Program** (Connect IQ /
Training API) — mit Antrag, Prüfung und Vertrag; für private Projekte in der Regel nicht
freigegeben. Das ist keine Programmieraufgabe, sondern eine Freigabefrage, und sie steht
im Projekt bereits als offene Entscheidung. **Realistische Zwischenlösung:** Export als
`.FIT`- oder `.TCX`-Datei, die manuell in Garmin Connect importiert wird. Weniger elegant,
aber sofort machbar und ohne Abhängigkeit von einer Freigabe.

**„Alle Faktoren, die es gibt."** Als Ziel unerreichbar — nicht wegen mangelnden
Aufwands, sondern weil die Menge nicht definierbar ist und viele Faktoren keine belegte
Wirkung auf die Trainingssteuerung haben. Das erreichbare und ehrlichere Ziel:

> **Jeder Faktor, der messbar erhoben wird, wirkt nachvollziehbar auf den Plan — und
> jeder Faktor, der fehlt, ist als fehlend sichtbar statt stillschweigend geraten.**

Das ist strenger als es klingt: Es verbietet Platzhalter, geratene Werte und Anzeigen ohne
Datengrundlage. Genau daran ist die bisherige Version mehrfach gescheitert.

---

## 6. Was zuerst passieren sollte

**Stufe B, Teilschritt 1: Schwellen für Laufen.** Grund: höchster Hebel bei geringstem
Aufwand. Sobald eine belastbare Schwellenpace existiert, werden aus allen Laufeinheiten
konkrete Vorgaben — und die Zielprognose für den Halbmarathon wird erstmals rechenbar
statt „—".

Konkret nötig:
1. Feldtest-Protokoll in der App (30 min Zeitfahren oder 5-km-Test)
2. Ableitung Schwellenpace → Zonen (bestehende `calc.js`-Riegel-Logik nutzbar)
3. Konfidenzmodell: gemessen / abgeleitet / geschätzt — sichtbar getrennt
4. Anbindung an `prescription-factory`, damit Vorgaben Pace statt RPE tragen

---

## 7. Realistische Zeitachse

| Stufe | Aufwand | Voraussetzung |
|---|---|---|
| A · Engine erreicht Nutzer | 2 Wochen Wartezeit + 2 Tage | läuft |
| B · Leistungsdiagnostik | 2–3 Wochen | keine |
| C · Historie wirkt | 1–2 Wochen | B |
| D · Verletzungsmodell | 1–2 Wochen | C |
| E · Anforderungsprofile | 3–4 Wochen | B |
| F · Uhr + Benachrichtigung | 1 Woche (FIT/TCX) | A |
| G · Breite | offen | B–E |

**Bis eine Engine, die den eigenen Sport vollständig und individuell steuert:
realistisch 8–12 Wochen.** Nicht 8–12 Wochen bis „fertig" — bis zu dem Punkt, an dem sie
das eigene Training besser steuert als ein Standardplan.

---

## 8. Der Maßstab, an dem gemessen wird

Nicht „ist es tief genug", sondern:

1. **Nachvollziehbarkeit** — jede Vorgabe hat eine benennbare Quelle
2. **Ehrlichkeit** — fehlende Daten führen zu weniger Automatik, nie zu mehr Heuristik
3. **Sicherheit** — im Zweifel die konservativere Vorgabe
4. **Wirksamkeit** — der Plan verändert sich messbar, wenn sich die Person verändert

Punkt 4 ist der eigentliche Test für „individuell": Wenn zwei verschiedene Athleten
denselben Plan bekommen, ist die Engine nicht individuell — egal wie viel sie rechnet.
