# ORVIA-Masterplan — Band 6: Store- und Technik-Checklisten

**Stand:** 15.08.2026 · Bezug: Band 1, Phasen C und D · Sprache der App: DE+EN ab Launch
**Hinweis zu Quellen:** Store-Richtlinien ändern sich; alle Guideline-Nummern und Prozessdetails entsprechen dem bekannten Stand und sind vor Einreichung gegen die jeweils aktuelle Fassung der App Store Review Guidelines bzw. Play-Richtlinien zu prüfen (Spalte „Status" enthält dafür den Punkt „aktueller Wortlaut geprüft"). Eigene Annahmen sind als „Schätzung" markiert.

---

## a) Capacitor-Migration Schritt für Schritt

### a.1 Ausgangslage und Zielarchitektur

| Aspekt | Ist (PWA) | Soll (Capacitor) | Begründung |
|---|---|---|---|
| Auslieferung | GitHub Pages `/ORVIA.2/` | Alle Assets im App-Binary gebündelt | Apple verbietet Remote-Loading der App-Logik; Offline-Start ist zudem 4.2-Argument |
| Build | Kein Build-Schritt, 141 Script-Tags | Weiterhin ohne Bundler möglich; Assets werden 1:1 nach `www/` kopiert | Vanilla-JS-Prinzip beibehalten, Migrationsrisiko minimieren |
| Offline | Service Worker mit Versions-Cache | Im Wrapper übernimmt das Binary die Asset-Auslieferung; SW-Rolle reduzieren | Doppel-Caching (SW + Binary) erzeugt Versionskonflikte |
| Backend | Supabase | unverändert | Kein Migrationsbedarf |

### a.2 Schrittfolge

| # | Schritt | Konkret | Prüfpunkt (DoD) |
|---|---|---|---|
| 1 | Projektsetup | `npm init` im lokalen Repo (`app/`); `@capacitor/core`, `@capacitor/cli` installieren; `npx cap init` (App-ID z. B. `com.orvia.app` — einmalig, danach nie ändern); `webDir` auf den kopierten App-Ordner (`www/`) | `npx cap doctor` ohne Fehler |
| 2 | Asset-Kopierskript | Skript, das `app/` nach `www/` kopiert und dabei: Basis-Pfad `/ORVIA.2/` → relativ umschreibt; die handgepflegte SW-Asset-Liste gegen die 141 Script-Tags in `index.html` abgleicht (Wiederverwendung Prüfskript A-11) | Diff Script-Tags ↔ kopierte Dateien = leer |
| 3 | Plattformen anlegen | `npx cap add ios`, `npx cap add android`; Xcode- und Android-Studio-Projekte in Git aufnehmen (Dual-Repo-Regel beachten: nur im lokalen Layout, kein Force-Push) | Beide Projekte bauen „Hello ORVIA" |
| 4 | Offline-Vollständigkeit | App im Flugmodus starten; DevTools-Netzwerk-Log: kein Request auf `github.io` | 0 externe Requests beim Kaltstart |
| 5 | SW-Strategie im Wrapper | Entscheidung: SW im nativen Kontext deaktivieren oder auf reines Daten-Caching reduzieren; die PWA-Version behält den SW unverändert | Kein doppeltes Update-Verhalten; Versionsanzeige eindeutig |
| 6 | Plugins installieren | `@capgo/capacitor-health` (HealthKit + Health Connect), `@capacitor/push-notifications`, `@revenuecat/purchases-capacitor`, ggf. `@capacitor/app`, `@capacitor/preferences` | Jedes Plugin mit Minimalbeispiel auf beiden Plattformen verifiziert |
| 7 | Native Anpassungen iOS | `Info.plist`: HealthKit-Nutzungsbeschreibungen (DE+EN via `InfoPlist.strings`), Push-Capability, HealthKit-Entitlement; iPad-Layout prüfen (C-09) | Archive-Build ohne Warnungen zu fehlenden Purpose-Strings |
| 8 | Native Anpassungen Android | `AndroidManifest.xml`: Health-Connect-Permissions (nur Lese-Scopes, die genutzt werden), POST_NOTIFICATIONS; Target-API-Level auf aktuelle Play-Vorgabe (vor Einreichung prüfen) | `bundletool`-Build ohne Manifest-Warnungen; Health-Connect-Berechtigungsdialog erscheint korrekt |
| 9 | Statusleiste/Safe-Areas | Notch/Insets via CSS `env(safe-area-inset-*)`; Splashscreen; Dark-Status-Bar | Kein UI-Element unter Notch/Home-Indicator |
| 10 | Deep-Links/Universal Links | Nur wenn für RevenueCat/Passwort-Reset nötig (Supabase-Mail-Links!) | Passwort-Reset-Flow endet in der App, nicht im Browser |
| 11 | Versionierung | App-Version (Marketing) + Build-Nummer je Store; Mapping zur internen v8-Zählung dokumentieren | Versionsmatrix in Repo-Doku |

### a.3 Grenzen von Live-Updates (verbindlich)

- **Erlaubt** ist nach Apple 3.1.2/2.5.2-Logik nur, was den App-Zweck nicht verändert: Inhalte/Daten via Supabase, Konfigurationsflags (z. B. `engine_v2_plan`) sind unkritisch, da serverseitige Logik-Flags keine Code-Nachladung sind.
- **Nicht erlaubt:** JS-Bundles nachladen, die Features verändern oder Review-Ergebnisse umgehen. Live-Update-Dienste (z. B. Capgo/Appflow) nur für Bugfixes im Rahmen der Store-Regeln einsetzen — Entscheidung für ORVIA: **zum Launch keine Live-Updates**, alle Code-Änderungen gehen durch Store-Review. Begründung: geringes Risiko wichtiger als Update-Tempo; die PWA bleibt als schneller Kanal für Web-Nutzer bestehen.
- Konsequenz für den Prozess: Hotfixes brauchen einen Expedited-Review-Pfad (h) und der Release-Train bündelt Fixes.

### a.4 Typische Migrationsfallen (Vorab-Prüfliste)

| Falle | Symptom | Ursache im ORVIA-Kontext | Gegenmaßnahme |
|---|---|---|---|
| Absolute Pfade | Weiße Seite im Wrapper, PWA läuft | Pfade sind auf `/ORVIA.2/` (GitHub Pages) ausgelegt; im Wrapper ist die Wurzel eine andere | Kopierskript (a.2 #2) schreibt Pfade um; Testfall „Kaltstart Flugmodus" in CI-Checkliste |
| SW kämpft gegen Binary | Nutzer sehen nach App-Update alte UI | Versions-Cache des SW liefert gebündelte, aber veraltete Assets aus | SW-Strategie a.2 #5: im nativen Kontext deaktivieren/reduzieren; Versionsanzeige aus Binary, nicht aus SW |
| Vergessene Assets | Einzelne Screens leer, Rest funktioniert | Handgepflegte Asset-Liste deckt nicht alle 141 Script-Tags + Locales + Fonts ab | Automatischer Diff (a.2 #2), erweitert um `locales/*.json` (e.2 #5) |
| Supabase-Redirects | Login/Passwort-Reset landet im Browser statt in der App | Auth-Redirect-URLs zeigen auf GitHub Pages | Redirect-/Deep-Link-Konfiguration (a.2 #10) je Umgebung; Testfall in f.2 „Konto" |
| CORS/Origin | API-Fehler nur im Wrapper | Capacitor-Origin (`capacitor://` bzw. `https://localhost`) nicht in Supabase erlaubt | Erlaubte Origins vor erstem Gerätetest eintragen |
| Doppelte Codebasis | Web und App driften auseinander | Fixes nur in einem Kanal deployt | Eine Quelle (lokales `app/`), zwei Auslieferungen; Versionsmatrix a.2 #11 verbindlich |
| iOS-Keyboard/Scroll | Eingabefelder unter Tastatur, Scroll-Sprünge im Workout-Player | WebView-Verhalten ≠ Safari-PWA | Gerätetest je Kernformular (f.1-Matrix), nicht nur Simulator |

---

## b) Apple-Review-Checkliste

Konto: Apple Developer Program 99 €/Jahr; **Small Business Program (15 % Provision)** nach Kontoerstellung aktiv beantragen. IAP-Pflicht für alle digitalen Käufe. Status-Spalte: ☐ offen · ◐ in Arbeit · ☑ erledigt.

| Guideline | Anforderung | ORVIA-Maßnahme | Status |
|---|---|---|---|
| 1.4.1 (Physical Harm) | Keine gefährlichen medizinischen Ratschläge | Trainings-, keine Medizin-App; MDR-Formulierungsaudit (C-07) deckt auch diese Perspektive ab | ☐ |
| 2.1 (App Completeness) | Keine Bugs, Platzhalter, toten Links; Demo-Zugang | Beta-getesteter Build; Demo-Account mit gefüllten Trainingsdaten in Review-Notes | ☐ |
| 2.3.x (Accurate Metadata) | Screenshots/Beschreibung entsprechen der App | Store-Assets (C-12) aus finalem Build erzeugen; keine Feature-Versprechen aus Phase E | ☐ |
| 2.5.1 | Nur öffentliche APIs | Capacitor + gelistete Plugins; keine privaten APIs | ☐ |
| 2.5.2 | Kein Nachladen von Code, der die App verändert | Alle Assets gebündelt (a.2 #4); keine Live-Updates zum Launch (a.3) | ☐ |
| **4.2 (Minimum Functionality)** | Web-Wrapper ohne Mehrwert werden abgelehnt — **Hauptrisiko** | Native Mehrwerte einbauen und in Review-Notes explizit benennen: HealthKit-Integration, Push-Notifications, vollständige Offline-Fähigkeit; zusätzlich native UI-Qualität (Safe-Areas, Haptik optional) | ☐ |
| 4.0 (Design) / iPad | App muss auf iPad benutzbar sein | iPad-Layout-Prüfung und -Screenshots (C-09) | ☐ |
| 3.1.1 (In-App Purchase) | Digitale Käufe nur via IAP; keine externen Kauflinks in der App (Ausnahmen-Rechtslage vor Einreichung prüfen) | RevenueCat/StoreKit für Pro-Abo + Founder-Lifetime; Paywall ohne externe Zahlungshinweise | ☐ |
| 3.1.2 (Subscriptions) | Abo-Transparenz: Preis, Laufzeit, Trial-Bedingungen, Kündigungshinweis; Restore-Button | Paywall zeigt 9,99 €/Mo, 79,99 €/Jahr, 14 d Trial mit klarer Trial-Ende-Info; „Käufe wiederherstellen" in Einstellungen | ☐ |
| 5.1.1 (Privacy: Collection) | Datenschutzerklärung, Zweckbindung, Einwilligung | DSE DE+EN verlinkt (App + Store); Art.-9-Consent vor Gesundheitsdatenerhebung (C-06) | ☐ |
| **5.1.1(v) (Account Deletion)** | In-App-Kontolöschung Pflicht, wenn Kontoerstellung möglich | Supabase Edge Function löscht Auth + Daten vollständig; Einstieg in Einstellungen (C-05) | ☐ |
| 5.1.2 (Data Use/Sharing) | Keine Weitergabe ohne Einwilligung; Privacy Nutrition Labels korrekt | Labels konsistent mit DSE (C-12); Supabase als Auftragsverarbeiter in DSE | ☐ |
| 5.1.3 (Health Data) | Gesundheitsdaten nicht für Werbung; keine Speicherung in iCloud; HealthKit-Zweck klar | HealthKit nur lesend für Training; kein Ad-Tracking; Purpose-Strings präzise | ☐ |
| Review-Prozess | Review-Notes, Demo-Account, Kontaktdaten | Notes-Text: Architektur (nativ gebündelt), 4.2-Mehrwerte, Demo-Zugang, Test-Hinweise für Health-Freigaben | ☐ |
| Organisatorisch | 99 €/Jahr aktiv; Small Business Program bestätigt; Verträge/Steuer/Banking in App Store Connect vollständig | Vor erster Einreichung abschließen (sonst keine Paid-Features testbar) | ☐ |
| Alle Zeilen | — | **Aktueller Wortlaut jeder Guideline vor Einreichung geprüft** | ☐ |

---

## c) Google-Play-Checkliste

Konto: 25 $ einmalig. **Achtung Kalender:** Neue persönliche Entwicklerkonten müssen vor Produktionszugang einen Closed Test mit **12 Testern über 14 Tage** durchlaufen — dieser Prozess ist der zeitkritischste Play-Schritt (Details c.3).

### c.1 Richtlinien-Checkliste

| Bereich | Anforderung | ORVIA-Maßnahme | Status |
|---|---|---|---|
| Health Apps Declaration | Deklaration als Health-&-Fitness-App; Health-Connect-Nutzung begründen; ggf. Freigabeprozess je Datentyp | Nur benötigte Lese-Scopes deklarieren; Zweck „Trainingssteuerung" je Scope dokumentieren | ☐ |
| Health Connect Policy | Gesundheitsdaten: keine Werbung, keine Weitergabe, Löschpfad | Deckungsgleich mit Art.-9-Consent und DSE; Kontolöschung löscht auch synchronisierte Kopien | ☐ |
| Data Safety Form | Vollständige, DSE-konsistente Angaben (c.2) | Abgleichtabelle DSE ↔ Data Safety pflegen | ☐ |
| Account Deletion | In-App-Löschung + Web-Löschpfad-URL im Store-Eintrag | Edge Function (C-05) + Lösch-Info-Seite auf der Website | ☐ |
| Play Billing | Digitale Käufe über Play Billing | RevenueCat nutzt Play Billing automatisch; keine externen Kauflinks | ☐ |
| Abo-Transparenz | Preis, Laufzeit, Trial, Kündigung klar vor Kauf | Identische Paywall-Inhalte wie iOS | ☐ |
| Target API Level | Aktuelle Vorgabe erfüllen (jährlich steigend — vor Upload prüfen) | Capacitor-Android-Projekt aktuell halten (a.2 #8) | ☐ |
| Berechtigungen | Jede Permission begründbar; keine ungenutzten | Manifest-Audit vor jedem Release | ☐ |
| Store-Eintrag | Screenshots, Kurz-/Langbeschreibung DE+EN, Kategorie Gesundheit & Fitness | C-12 | ☐ |
| Impressum/Kontakt | Entwickleradresse, Support-Kontakt (Gewerbedaten aus A-10) | Eintragen und mit Impressum abgleichen | ☐ |

### c.2 Data-Safety-Felder (Vorbefüllung)

| Feld | ORVIA-Angabe | Begründung |
|---|---|---|
| Erhobene Daten | E-Mail (Konto), Gesundheits-/Fitnessdaten (Workouts, ggf. Herzfrequenz), App-Aktivität (Nutzung) | Supabase-Konto + Trainingsfunktion |
| Zweck | App-Funktionalität, Konto-Verwaltung | Kein Werbe-/Analytics-Tracking zum Launch |
| Weitergabe an Dritte | Keine (Supabase = Auftragsverarbeiter, RevenueCat = Kaufabwicklung — genaue Einordnung mit Steuer-/Rechtsberatung bzw. aktueller Play-Definition von „Sharing" prüfen) | Konservativ und konsistent zur DSE deklarieren |
| Verschlüsselung bei Übertragung | Ja (TLS zu Supabase) | Standard |
| Löschung beantragbar | Ja, in-App + Web-Pfad | C-05 |

### c.3 12-Tester-Prozess mit Zeitplan

| Tag | Schritt |
|---|---|
| T0 | Play-Konto anlegen (25 $), Identitätsprüfung abschließen; App anlegen; Declarations ausfüllen |
| T0–T3 | Closed-Test-Track: erstes AAB hochladen; 12+ Tester einladen (Beta-Pool aus C-11; 14 einladen als Reserve — Schätzung/Empfehlung) |
| T3 | Alle Tester haben angenommen und App installiert (nachfassen — nur aktive Tester zählen) |
| T3–T17 | **14 Tage ununterbrochen** ≥ 12 aktive Tester; wöchentlich neue Builds möglich, Zähler läuft weiter |
| T17 | Produktionszugang beantragen; Fragen zum Testverlauf beantworten |
| T17+X | Google-Prüfung abwarten (Dauer außerhalb eigener Kontrolle) → deshalb Start in C-Sprint 1 (Band 1, C.2) |

---

## d) RevenueCat-Setup

### d.1 Produkt- und Entitlement-Struktur

| Ebene | Objekt | Wert | Begründung |
|---|---|---|---|
| Store-Produkte iOS | `orvia_pro_monthly` (Auto-Renewable, 9,99 €), `orvia_pro_yearly` (Auto-Renewable, 79,99 €, 14 d Intro-Trial), `orvia_founder_lifetime` (**Non-Consumable**, 149 €) | Preise sind Entscheidungsstand | Lifetime darf kein Abo sein (Anti-Pattern aus Band 1, C.5) |
| Store-Produkte Android | identische IDs/Preise; Trial als Angebot auf dem Jahres-Basisplan; Lifetime als In-App-Produkt (einmalig) | — | ID-Parität vereinfacht Support und Auswertung |
| RevenueCat Entitlement | `pro` | schaltet alle Pro-Features | Ein Entitlement genügt; Lifetime und Abos hängen am selben `pro` |
| RevenueCat Offering | `default` mit Packages `$rc_monthly`, `$rc_annual`, `$rc_lifetime` | — | Paywall liest Offering dynamisch → Preisänderungen ohne App-Update |
| Trial | 14 Tage auf Jahresabo (auf Monatsabo bewusst nicht — Schätzung/Empfehlung: Trial soll ins Jahresabo konvertieren; final in C entscheiden) | — | Höherer LTV pro Trial |

### d.2 Anbindung in der App

| # | Schritt | Prüfpunkt |
|---|---|---|
| 1 | `@revenuecat/purchases-capacitor` installieren; API-Keys je Plattform konfigurieren | SDK initialisiert beim App-Start ohne Fehler |
| 2 | App-User-ID = Supabase-User-ID setzen (`logIn` nach Auth) | Kauf auf Gerät A schaltet `pro` auf Gerät B frei |
| 3 | Paywall-UI liest Offering; zeigt Preis/Trial/Kündigungshinweis aus Store-Daten, nicht hartkodiert | Preisdarstellung folgt Store-Locale (DE/EN) |
| 4 | Feature-Gates: zentrale Funktion `hasPro()` auf Entitlement `pro`; keine verstreuten Checks | Ein Gate, per Test abschaltbar |
| 5 | „Käufe wiederherstellen" in Einstellungen | Restore setzt `pro` ohne Neukauf |
| 6 | Webhooks → Supabase Edge Function (optional Launch, sonst E): Server kennt Abo-Status | Statusfeld in DB entspricht RevenueCat-Dashboard |
| 7 | Kontolöschung: RevenueCat-Kundendaten in Löschprozess einbeziehen (C-05) | Löschprotokoll umfasst RevenueCat-`delete` |

### d.3 Testablauf Sandbox

| Testfall | Plattform | Erwartung |
|---|---|---|
| Monatsabo kaufen | iOS Sandbox + Play-Lizenztester | `pro` aktiv; Ablauf in Sandbox-Zeitraffer → `pro` erlischt |
| Jahresabo mit Trial | beide | Trial startet ohne Belastung; Konversion nach (verkürzter) Trialzeit; Abbruch im Trial → `pro` endet zum Trialende |
| Lifetime kaufen | beide | `pro` dauerhaft; erneuter Kaufversuch sauber abgefangen |
| Restore nach Neuinstallation | beide | `pro` ohne Kauf wiederhergestellt |
| Upgrade Monat→Jahr | beide | Proration laut Store; nur ein aktives Abo |
| Kauf abbrechen | beide | Kein Entitlement; UI ohne Fehlzustand |
| Offline-Kaufversuch | beide | Verständliche Fehlermeldung; kein hängender Spinner |
| Familien-/Zweitgerät | iOS | Entitlement folgt App-User-ID (Schritt d.2 #2) |

---

## e) i18n-Plan für die Vanilla-JS-App

### e.1 Struktur

| Element | Entscheidung | Begründung |
|---|---|---|
| Format | `locales/de.json`, `locales/en.json` — flache Keys mit Namespace-Präfix (`workout.set.addExercise`) | Kein Build-Schritt nötig; JSON per `fetch`/Bundle ladbar; flach = grep-bar |
| Laufzeit | Mini-Modul `i18n.js` (~100 Zeilen, Schätzung): `t(key, params)`, Platzhalter `{count}`, Fallback-Kette EN→DE→Key | Keine Abhängigkeit; Key-Ausgabe als sichtbarer Fehlerindikator |
| Referenzsprache | DE (die App ist DE-first entwickelt) | Übersetzung DE→EN als gerichteter Workflow |
| Sprachwahl | Gerätesprache, überschreibbar in Einstellungen; Persistenz via Preferences/localStorage | Store-Erwartung |
| Pluralisierung | `Intl.PluralRules` | Standard-API, kein Zusatzcode |
| Daten/Zahlen | `Intl.DateTimeFormat`/`NumberFormat`; kg/lb getrennt von Sprache (Einheiten sind Trainings-, keine Sprachfrage) | Verhindert das klassische „EN = lb"-Fehlmapping |

### e.2 Extraktionsstrategie bei 12.300 Zeilen `ui.js`

| # | Schritt | Konkret |
|---|---|---|
| 1 | Inventur | Skript sammelt String-Literale aus `ui.js` + weiteren UI-Modulen (`workout-ui.js` …) und aus `index.html` (Legacy-DOM! — auch dessen Texte müssen durch `t()`, solange GM7-Abbau aussteht); Heuristik: Literale mit Leerzeichen/Umlauten, `innerHTML`/`textContent`-Zuweisungen, Template-Strings |
| 2 | Triage | Liste klassifizieren: nutzersichtbar / technisch (Selektoren, Keys, Logs) — nur Ersteres wird Key |
| 3 | Modulweise Extraktion | Nicht Datei-global Suchen/Ersetzen, sondern Screen für Screen (Onboarding → Plan → Workout → Einstellungen), je Screen ein PR durch CI; Begründung: Template-Strings mit eingebetteter Logik brechen bei mechanischem Ersetzen |
| 4 | Schutznetz | Pseudo-Locale `xx` (Keys mit Präfix `⟦…⟧` umbrochen): App in `xx` starten — jeder Klartext-Rest fällt optisch auf; zusätzlich Testregel: keine Umlaut-Literale in UI-Zuweisungen (Lint-Skript) |
| 5 | SW-/Asset-Pflege | `locales/*.json` in SW-Asset-Liste und Capacitor-Bundle aufnehmen (Prüfskript A-11 erweitern) |
| 6 | Aufwandseinordnung | In Band 1 als B-13 = 30 h budgetiert; bei > 1.500 nutzersichtbaren Strings (Schätzung) Cut auf Kernflows zuerst |

### e.3 Übersetzungs-Workflow DE→EN und QA

| Schritt | Inhalt | Qualitätskriterium |
|---|---|---|
| Glossar zuerst | Trainingsbegriffe fixieren (Satz=set, Wdh.=reps, Ausbelastung, Deload, Taper …) | Glossar vor erster Übersetzung eingefroren |
| Übersetzung | DE→EN key-weise mit Kontextspalte (Screenshot/Screen-Name je Key) | Kein Key ohne Kontextangabe übersetzt |
| Review | Zweitperson (englisch trainingsaffin) prüft Stichprobe + alle Paywall-/Rechts-/Health-Texte vollständig | Kauf-/Consent-Texte 100 % reviewt (rechtsrelevant) |
| Technisches QA | Skript: Key-Parität de↔en (fehlend/verwaist), Platzhalter-Parität `{…}` | 0 Differenzen, in CI verankert |
| Visuelles QA | EN-Durchlauf aller Kernflows: Textüberläufe (EN oft länger), Umbrüche, Buttons | Screenshot-Abnahmeprotokoll DE+EN |

---

## f) QA-/Testplan vor Submission

### f.1 Geräte-Matrix (Minimalumfang; Schätzung/Empfehlung)

| Gerät | Warum |
|---|---|
| iPhone mit aktuellem iOS | Review-Referenz |
| Älteres iPhone (kleines Display, älteste unterstützte iOS-Version) | Layout-/Performance-Grenzfall |
| iPad | Pflichtprüfung wegen 4.0/iPad-Nutzbarkeit (C-09) |
| Android-Flaggschiff (aktuelles OS, Health Connect installiert) | Health-Connect-Referenz |
| Android-Budgetgerät (ältere API, wenig RAM) | Performance mit 141 Skripten/12.300-Zeilen-`ui.js` |
| Zusätzlich | PWA im Browser als Regressionsreferenz (Web-Kanal bleibt bestehen) |

### f.2 Testfälle

| Bereich | Testfall | Erwartung |
|---|---|---|
| Offline | Kaltstart im Flugmodus | App vollständig nutzbar mit lokalen Daten; kein Request auf GitHub Pages |
| Offline | Workout offline durchführen, danach online | Alle Sätze synchronisiert, keine Duplikate |
| Sync-Konflikt | Gleiches Workout auf 2 Geräten offline bearbeiten, beide online bringen | Definiertes Konfliktverhalten (dokumentierte Strategie), kein Datenverlust, kein Crash |
| Sync-Konflikt | Ziel auf Gerät A ändern, Plan auf B generieren | Plan nutzt nach Sync das neue Ziel (Ziel→Plan-Kette, M1-Kern) |
| Konto | Registrierung, Login, Passwort-Reset (Mail-Link → App, a.2 #10), Kontolöschung | Löschung entfernt Login + Daten nachweislich |
| Health | Berechtigung erteilen/verweigern/später ändern | App funktioniert in allen drei Zuständen ohne Fehlerdialog-Schleife |
| Push | Opt-in, Empfang, Opt-out, System-Einstellungen widerrufen | Kein Zombie-Push nach Opt-out |
| IAP | Alle Fälle aus d.3 auf finalem Build wiederholen | Identisches Ergebnis wie Sandbox-Erstlauf |
| Sprache | Gerätesprache EN/DE, Umschalten in-App, Kauf-/Consent-Texte je Sprache | Keine fehlenden Keys, kein Mischtext |
| Update | Installation über vorherige Version (Migration lokaler Daten) | Daten bleiben erhalten; Versionsanzeige korrekt |
| Stabilität | 30-min-Dauernutzung Workout-Player auf Budgetgerät | Kein Speicher-/Performance-Einbruch (subjektiv flüssig, keine Abstürze) |

### f.3 Abnahmekriterien vor Einreichung

1. 0 offene P1/P2-Bugs aus f.2; 2. CI grün (Suite ≥ 268 + Mutationsproben); 3. Beta-Crash-freie Rate ≥ 99 % (Zielwert Schätzung, deckungsgleich mit Gate C); 4. Checklisten b) und c) ohne ☐ in Pflichtzeilen.

---

## g) Launch-Day-Runbook (M2, Stunde für Stunde)

Voraussetzung: Apple approved mit „Manual Release"; Android-Produktionsfreigabe erteilt, Rollout auf gestufte Freigabe konfiguriert.

### g.1 Vorwoche (T−7 bis T−2)

| Zeitpunkt | Aktion | Warum |
|---|---|---|
| T−7 | Release-Kandidat einfrieren; f.2-Testplan vollständig auf finalem Build durchlaufen | Jede spätere Änderung invalidiert die Abnahme |
| T−6 | Rollback-Drills nach h.4 durchführen (mind. Serverflag + Web-Rollback) | Hebel müssen vor dem Ernstfall einmal gezogen worden sein |
| T−5 | Store-Einträge final prüfen: Preise, Trial-Text, Screenshots DE+EN, Data Safety ↔ DSE-Abgleich | Letzte Chance ohne Review-Risiko |
| T−4 | Founder-Landingpage + Mail-Entwurf fertigstellen, aber nicht senden | Entkoppelt Marketing von Technik-Go |
| T−3 | Support-FAQ DE+EN, Statusvorlagen (h.4) bereitlegen; Schwellenblatt mit Beta-Baseline füllen | Launch-Tag darf keine Schreibarbeit enthalten |
| T−2 | Ruhetag/Reserve — keine Änderungen | Puffer für Funde aus T−7…T−3; Einzelperson braucht Reserve |

### g.2 Launch-Tag

| Zeit | Aktion | Abbruchkriterium |
|---|---|---|
| T−1 Tag | Freeze: kein Deploy, kein DB-Schema-Change; Backups Supabase verifiziert; Monitoring-Alarme testweise ausgelöst; Support-FAQ DE+EN live | Backup nicht verifizierbar → Launch verschieben |
| 08:00 | Statuscheck: Supabase (Auth, DB, Edge Functions), RevenueCat-Dashboard, Store-Status beider Apps | Ein Dienst rot → Launch verschieben (Kriterium: Kernflow betroffen) |
| 08:30 | Android: gestaffelten Rollout starten (kleine Stufe, z. B. 10 % — Schätzung/Empfehlung) | — |
| 09:00 | iOS: Manual Release auslösen | — |
| 09:30 | Selbsttest Produktion: Neuregistrierung, Onboarding inkl. Zielwert, erster Plan, Probekauf Monatsabo (echtes Geld, danach stornieren), Restore | Kauf oder Onboarding defekt → h) Incident-Plan, Rollout-Stufe einfrieren |
| 10:30 | Founder-Kampagne aktivieren: Landingpage live, Mail an Beta-Tester (C-11-Pool) | — |
| 11:00–13:00 | Monitoring-Fenster 1: Crash-Rate, Supabase-Fehlerquote, RevenueCat-Events, Store-Rezensionen | Crash-Rate > 2 % (Schätzung als Schwelle) → Stufe einfrieren, Analyse |
| 13:00 | Lagebeurteilung: Android-Stufe erhöhen oder halten; Entscheidung dokumentieren | — |
| 14:00–18:00 | Support-Triage im 2-h-Takt; Antwort-Vorlagen DE+EN; Bug-Board pflegen | P1-Bug → h) |
| 18:00 | Tagesabschluss: Kennzahlen notieren (Installs, Registrierungen, Trials, Founder-Käufe, Crash-Rate) als Baseline für Phase E | — |
| T+1 bis T+7 | Täglich 09:00 Statuscheck + Triage; Android-Rollout schrittweise auf 100 %; keine neuen Features, nur Hotfix-Train | Jede Schwellenverletzung → h) |

---

## h) Rollback-/Incident-Plan

### h.1 Schweregrade und Reaktionen

| Grad | Definition (messbar) | Reaktion | Zielzeit (Schätzung) |
|---|---|---|---|
| P1 | Kernflow defekt für > 10 % der Nutzer (Login, Plan, Workout-Speichern, Kauf) oder Datenverlust | Sofortmaßnahme nach h.2; Arbeit an allem anderen stoppt | Erste Maßnahme < 2 h |
| P2 | Kernflow beeinträchtigt mit Workaround, oder Nebenflow defekt | Hotfix im nächsten Train (≤ 72 h) | Fix eingereicht < 72 h |
| P3 | Kosmetik, Einzelgeräte | Normales Backlog | nächster Release |

### h.2 Rollback-Hebel nach Ebene (in dieser Reihenfolge prüfen — vom billigsten zum teuersten)

| Ebene | Hebel | Grenzen |
|---|---|---|
| Serverflags | `engine_v2_plan` u. a. zurücksetzen; defektes Verhalten serverseitig deaktivieren | Nur für flag-gesteuerte Logik; v1-Fallback existiert nur bis B-12 (danach entfällt dieser Hebel — bewusste Entscheidung, im Incident-Fall dokumentiert) |
| Supabase | Edge-Function-Version zurückrollen; Datenreparatur per Migration; Restore aus Backup (letzter Ausweg, Datenverlust-Fenster!) | Restore niemals ohne Sicherung des Ist-Zustands davor |
| Android | Gestufter Rollout: Stufe einfrieren oder Halt; vorherige Version als neues Release hochschieben | Kein echtes „Downgrade" bei Nutzern, die schon aktualisiert haben |
| iOS | Kein Rollback möglich — nur neue Version einreichen; bei P1 Expedited Review beantragen (sparsam einsetzen, Begründung mitliefern) | Reviewdauer außerhalb eigener Kontrolle → serverseitige Hebel haben Vorrang |
| PWA/Web | Vorherige Version deployen (Dual-Repo-Regeln, **kein Force-Push**; Rollback = neuer Commit mit altem Stand); SW-Versions-Cache springt mit | Nur Web-Kanal; native Apps unberührt |
| Kauf/Abo | RevenueCat: Angebot deaktivieren, defektes Produkt aus Offering nehmen | Bestandskäufe bleiben; Erstattungen laufen über die Stores |

### h.3 Incident-Ablauf (Einzelperson, deshalb strikt sequenziell)

1. **Erfassen (≤ 15 min):** Symptom, betroffener Flow, Plattform(en), Version, Nutzeranteil; Statusnotiz in Support-Kanal („bekannt, in Arbeit") — Begründung: reduziert Ticketflut sofort.
2. **Eindämmen:** billigsten wirksamen Hebel aus h.2 ziehen; nie zwei Hebel gleichzeitig (Ursachenzuordnung bleibt möglich).
3. **Diagnose:** Reproduktion lokal; verdächtige Version über Versionsmatrix (a.2 #11) eingrenzen.
4. **Fix:** über CI/Branch-Protection wie jeder Change — auch unter Druck kein Direkt-Push; für iOS ggf. Expedited Review.
5. **Verifikation:** Testfall aus f.2 erweitern, sodass der Fall künftig automatisch abgedeckt ist.
6. **Post-Mortem (≤ 1 Seite, binnen 1 Woche):** Ursache, Zeitlinie, welcher Hebel wirkte, welche Schwelle/Alarm gefehlt hat; Maßnahmen als Backlog-Items.

### h.4 Vorbereitete Artefakte (vor Launch anlegen, Teil von D-04)

| Artefakt | Inhalt |
|---|---|
| Kontaktliste | Apple/Google-Support-Pfade, Supabase-Status, RevenueCat-Status, Steuerberater |
| Statusvorlagen | DE+EN-Textbausteine für Störung/Behebung |
| Rollback-Drill-Protokoll | Ein geübter Dry-Run je Hebel aus h.2 (mind. Serverflag + Web-Rollback) vor Launch-Tag |
| Schwellenblatt | Alarm-Schwellen (Crash-Rate, Fehlerquote, Kaufabbrüche) mit Werten aus Beta-Baseline |
