# ORVIA · Rechtliche Produkt- und Datenklassifikation — Ist-Erhebung (Phase 6.5)

**Stand:** 2026-08-05 · **Status:** IST-ERHEBUNG AUS DEM CODE + ENTSCHEIDUNGSVORLAGE.
Erhoben aus Migrationen 0002–0030, `js/data.js`, `js/auth.js`, Garmin-Worker-Registry.
Finale Texte (Datenschutzerklärung, Impressum, Consent-Flows) = Phase 10.
**Kein Rechtsrat** — die offenen Punkte unten brauchen vor Launch eine juristische
Prüfung (der Ersteller dieses Dokuments ist kein Anwalt).

---

## Frage 1 · Produktklassifikation — ENTSCHIEDEN (E-18)

ORVIA ist **Fitness- und Trainingsplanungssoftware** — kein Medizinprodukt, kein
Diagnosewerkzeug. Testbar durchgesetzt via `phase6_e18_language_test.mjs`
(Sprachmuster-Scan über alle 96 nutzersichtbaren Quelldateien, läuft in jeder
Auslieferungskette).

## Frage 2 · Aussagen über Regeneration / Verletzungsrisiko / Trainingseignung

Ist-Stand: ORVIA formuliert Belastungs-, nie Gesundheitsaussagen (E-18-Tabelle).
Safety-Regeln sperren Training (RED), erklären die Datenlage und verweisen bei
Beschwerden auf professionelle Abklärung (`RUN-SAFE-001`: „ORVIA diagnostiziert
nicht."). Absicherung: E-18-Sprachtest + Vertrag 7 (ENGINE-VERTRAEGE §7).

## Frage 3 · Verarbeitete personenbezogene und gesundheitsnahe Daten (IST)

**45 Supabase-Tabellen** (RLS auf Nutzergrenze). Kategorisierung:

| Kategorie | Tabellen/Felder | Einstufung |
|---|---|---|
| Stammdaten | user_profiles (Name, Alter/Geburtsdatum, Geschlecht, Größe, Gewicht, Ort, handle, bio, Avatar) | personenbezogen |
| **Gesundheitsnah (Art.-9-grenznah!)** | daily_checkins (Schmerz, Beschwerden, red_flags, Schlaf, Stimmung), user_profiles.issues (Verletzungs-/Beschwerdehistorie), readiness_* , user_metric_series + user_metrics (47 Garmin-Metriktypen: Schlafphasen, HRV, Ruhepuls, SpO₂, Stress, Body Battery, Körperzusammensetzung inkl. Körperfett/Viszeralfett, Atemfrequenz) | **besondere Kategorie wahrscheinlich — ausdrückliche Einwilligung erforderlich** |
| Training | activities, workout_*, training_load_daily, user_week_plans, user_goals, weekly_availability, user_constraints, equipment | personenbezogen |
| Technisch | connected_devices, device_capabilities, data_providers, app_state | personenbezogen |
| **Zugangsdaten Dritter** | **provider_credentials** (Garmin-Login für den inoffiziellen Worker; service_role-only) | **HOCHRISIKO — siehe offene Entscheidung ③** |

## Frage 4 · Datenempfänger (IST)

| Empfänger | Was | Status |
|---|---|---|
| Supabase (Auftragsverarbeiter) | alle 45 Tabellen + Storage (Avatare) | **AVV + Hosting-Region klären (offen ①)** |
| Garmin (via inoffiziellen Worker) | Login-Credentials hin, 47 Metriktypen + Aktivitäten zurück | Prototyp-Pfad; offizieller OAuth-Weg geplant (E-27) |
| GitHub Pages | App-Hosting, keine Nutzerdaten | ok |
| cdnjs / jsdelivr | Chart-Bibliothek (IP-Adresse beim Laden) | in Datenschutzerklärung nennen (Phase 10) |
| Keine Analytics, keine Werbe-Tracker | — | ok |

## Frage 5 · Erforderliche Einwilligungen (VORLAGE, Entscheidung offen)

1. Kontoerstellung/Vertrag: Basis der Kernverarbeitung.
2. **Gesundheitsnahe Daten (Art. 9): ausdrückliche, getrennte Einwilligung** —
   VOR Garmin-Kopplung und VOR Beschwerden-/Check-in-Erfassung. Aktuell existiert
   kein Consent-Flow → Phase 10, aber die Architektur (getrennte Tabellen) ist vorbereitet.
3. Später: Female-Athlete-Daten (nur opt-in), Bewegungsanalyse-Videos (nur opt-in).

## Frage 6 · Lösch- und Exportpfade (IST + Lücken)

| Pfad | Ist-Stand | Lücke |
|---|---|---|
| Konto löschen | `orviaDeleteAccount` (auth.js) → Edge Function `delete-account` serverseitig (inkl. Avatar-Storage, v8-234) + lokaler Wipe; fail-closed | ✅ Cascade maschinell verifiziert; ⚠️ Function-Redeploy durch Betreiber ausstehend (s. ②) |
| Datenexport | `exportData()` (lokal) + `exportCloudData()` (alle 32 Cloud-Tabellen, v8-234) | ✅ geschlossen (offen war ②) |
| Backup/Import | JSON-Export/-Import mit Deep-Merge | ok (lokal) |

## Frage 7 · Erklärung automatisierter Empfehlungen (IST + Ziel)

Ist: Entscheidungstexte nennen Datenlage + Grund (Score-Aufschlüsselung, Konfidenz-
Labels, Quellenkennzeichnung E-02). Ziel (Vision §17, Vertrag 7): jede Entscheidung
auditierbar mit `reason_codes`, `policy_version`, `knowledge_claim_ids`, `confidence`.
Keine reine „ORVIA hat deinen Plan angepasst"-Meldung.

---

## Offene Entscheidungen (Stand nach Umsetzung 2026-08-05, v8-234)

1. **① Supabase-AVV + Hosting-Region — VORBEREITET, 10-Minuten-Aufgabe für den
   Betreiber:** (a) Supabase-Dashboard → Project Settings → General: **Region
   ablesen** und hier eintragen: `Region: ______` (EU-Region, z. B. eu-central-1,
   ist für DSGVO-Außendarstellung die einfachste Lage). (b) Der Supabase-AVV
   („Data Processing Addendum") ist Bestandteil der Terms; unter
   supabase.com/legal/dpa abrufen, Kopie in `_dev/legal/` ablegen. Kein Code nötig.
2. **② Löschumfang + Cloud-Export — ✅ UMGESETZT (v8-234):**
   - Cascade-Verifikation maschinell bewiesen: jede der 32 Export-Tabellen hängt
     direkt/transitiv per `on delete cascade` an auth.users
     (`phase6_export_delete_test.mjs`, inkl. Negativkontrolle).
   - **Gefundene und geschlossene Löschlücke:** der Avatar im privaten
     Storage-Bucket wurde beim Konto-Löschen NICHT entfernt (deleteUser
     kaskadiert nur DB-Zeilen). Edge Function löscht jetzt `avatars/{uid}/*`
     VOR dem User-Delete, fail-closed.
     **⚠️ AKTION BETREIBER: `supabase functions deploy delete-account`
     einmalig neu ausführen — vorher bleibt die Lücke live bestehen.**
   - **Vollständiger Cloud-Export gebaut:** `exportCloudData()` (Profil →
     Daten verwalten → „Cloud-Export (vollständig)") — 32 Tabellen + eigene
     Übungen (is_system=false), Paging à 1000, Fehler pro Tabelle ehrlich im
     Manifest, provider_credentials dokumentiert ausgeschlossen.
3. **③ provider_credentials / Garmin — VORBEREITET:** Zielzustand offizieller
   OAuth (E-27). Nächster konkreter Schritt für den Betreiber: Antrag im
   **Garmin Connect Developer Program** (developer.garmin.com → Connect Developer
   Program → Request Access; Angaben: App-Name ORVIA, Zweck Trainings-App,
   benötigte APIs: Health, Activity, Training, Courses; Vorlaufzeit unbekannt →
   früh stellen). Bis zur Freischaltung: Worker bleibt dokumentierter Prototyp,
   keine Fremdnutzer auf diesem Pfad.
4. **④ Consent-Flow Art. 9** vor Multi-User-Betrieb (Phase 10 baut die Texte,
   die Notwendigkeit ist HIER festgestellt). Braucht ggf. anwaltliche Prüfung.
5. **⑤ Impressum-Anschrift** (bereits als offener Punkt geführt, Phase 10).
