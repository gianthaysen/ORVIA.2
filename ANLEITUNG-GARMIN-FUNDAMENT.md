# Schritt-für-Schritt: Garmin-Fundament in Betrieb nehmen

Stand: 2026-07-17 · Dauer: ca. 30–45 Minuten (ohne Live-Garmin-Test) · Voraussetzungen: Mac mit Terminal, Zugang zum Supabase-Dashboard, das Zip `orvia-garmin-foundation-2026-07-17.zip` aus dem Chat.

Reihenfolge ist verbindlich: erst Dateien, dann Datenbank, dann Worker, dann (optional, separat) Live-Verbindung. Jeder Schritt hat eine Kontrolle — erst weitermachen, wenn sie erfüllt ist.

---

## Schritt 1 — Zip ins Projekt entpacken

1. Lade das Zip aus dem Chat herunter (liegt danach in `~/Downloads`).
2. Terminal öffnen und ausführen:

```bash
cd /Users/gianthaysen/Claude/Projects/Strava
unzip -o ~/Downloads/orvia-garmin-foundation-2026-07-17.zip
```

Das Zip enthält nur NEUE Dateien (`app/js/metrics/…`, `app/js/repos/metricsRepository.js`, `app/supabase/migrations/0019…`, `app/supabase/tests/…`, `app/docs/…`, `garmin-worker/…`). Bestehende Dateien werden nicht verändert.

**Kontrolle:**

```bash
ls app/js/metrics garmin-worker/orvia_worker | head
```

→ Du siehst u. a. `metric-registry.js`, `metric-resolver.js` bzw. `sync.py`, `metric_registry.json`.

## Schritt 2 — Offline-Tests lokal bestätigen (2 Minuten, empfohlen)

```bash
cd /Users/gianthaysen/Claude/Projects/Strava/app
node supabase/tests/metric_registry_test.mjs
node supabase/tests/metric_resolver_test.mjs
node supabase/tests/provider_metrics_0019_test.mjs
```

**Kontrolle:** dreimal `OK <n> Tests` (13 / 33 / 19). Falls nicht: nichts weiter tun, Fehlermeldung in die nächste Session geben.

Optional auch die Worker-Tests (braucht einmalig ein Python-venv):

```bash
cd ../garmin-worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest tests/ -q          # Erwartung: 72 passed
deactivate
```

## Schritt 3 — Migration 0019 in Supabase ausführen

1. Supabase-Dashboard → dein ORVIA-Projekt → **SQL Editor** → New query.
2. Inhalt von `app/supabase/migrations/0019_provider_metrics_foundation.sql` komplett hineinkopieren → **Run**.
   Die Migration ist idempotent (mehrfaches Ausführen schadet nicht) und löscht keine Nutzerdaten.
3. **Kontrolle** — im SQL Editor ausführen:

```sql
select version from schema_migrations where version = '0019_provider_metrics_foundation';
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('data_providers','provider_credentials','connected_devices',
                      'device_capabilities','user_metrics','profile_metric_settings',
                      'daily_energy_expenditure','metric_anomalies')
 order by table_name;
```

→ 1 Zeile Version + 8 Tabellen. Wichtig: `provider_credentials` darf im Table Editor als eingeloggter App-Nutzer NICHT lesbar sein (keine Policies — das ist Absicht).

## Schritt 4 — Fernet-Schlüssel generieren

Der Worker verschlüsselt Garmin-Tokens mit diesem Schlüssel. Einmal generieren, sicher ablegen (Passwortmanager), nirgends committen:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Falls `cryptography` fehlt: vorher `pip3 install cryptography` (oder das venv aus Schritt 2 aktivieren).

**Kontrolle:** eine Zeile ähnlich `xk3J…=` (44 Zeichen). Verlierst du den Key später, müssen sich alle Nutzer einmal neu mit Garmin verbinden — mehr passiert nicht.

## Schritt 5 — Worker auf Railway deployen

Zwei Wege; Weg A braucht kein Git-Repo und passt zu deinem Setup (der Strava-Ordner hat kein `.git`).

### Weg A: Railway CLI direkt aus dem Ordner (empfohlen)

```bash
# 1. CLI installieren (einmalig)
brew install railway          # alternativ: npm i -g @railway/cli

# 2. Einloggen (öffnet Browser)
railway login

# 3. Projekt anlegen und Worker hochladen
cd /Users/gianthaysen/Claude/Projects/Strava/garmin-worker
railway init                  # neues Projekt, Name z. B. "orvia-garmin-worker"
railway up                    # baut das Dockerfile und deployt
```

### Weg B: über GitHub

Nur wenn du den Worker ohnehin in ein Repo legst: Railway → New Project → Deploy from GitHub repo → in den Service-Settings **Root Directory = `garmin-worker/`**. Achtung: Liegt das Repo hinter deinen GitHub Pages und Pages veröffentlicht den Repo-Root, würde der Worker-Quellcode mit veröffentlicht (keine Secrets im Code, aber unnötig) — dann lieber Weg A oder ein separates privates Repo.

### Env-Variablen setzen (beide Wege)

Railway-Dashboard → dein Service → **Variables**:

| Variable | Wert |
| --- | --- |
| `SUPABASE_URL` | `https://<projekt-ref>.supabase.co` (Dashboard → Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role-Key (gleiche Seite; NIE in App/Repo) |
| `TOKEN_ENCRYPTION_KEY` | der Fernet-Key aus Schritt 4 |
| `ALLOWED_ORIGINS` | deine App-Origin, z. B. `https://<dein-user>.github.io` |
| optional `SYNC_INTERVAL_MINUTES` | Default 30 |
| optional `SYNC_BACKFILL_DAYS` | Default 30 (Erstsync-Rückblick) |
| optional `DEFAULT_TIMEZONE` | Default `Europe/Vienna` |

`PORT` setzt Railway automatisch. Danach **Redeploy** auslösen und unter Settings → Networking eine **öffentliche Domain generieren** (z. B. `orvia-garmin-worker.up.railway.app`).

**Kontrolle:**

```bash
curl https://<deine-worker-domain>/healthz
```

→ `{"ok":true}`. Kosten: Hobby-Plan ~5 $/Monat (Stand prüfen), der Worker ist genügsam.

## Schritt 6 — Live-Verbindung mit deinem Garmin-Konto (separater, kontrollierter Schritt)

Erst machen, wenn Schritte 1–5 sauber sind. Deine Garmin-Zugangsdaten gehen dabei ausschließlich per HTTPS an DEINEN Worker; gespeichert werden nur verschlüsselte Session-Tokens, nie das Passwort.

1. **Supabase-JWT holen**: ORVIA im Browser öffnen, einloggen, Entwicklerkonsole (⌥⌘I) →

```js
(await ORVIA.sb.auth.getSession()).data.session.access_token
```

→ langen Token kopieren (gültig ~1 h).

2. **Verbinden** (Terminal; `read -s` verhindert, dass das Passwort in der Shell-History landet):

```bash
JWT='<token hier einfügen>'
read -s GPW   # Garmin-Passwort eintippen, Enter
curl -s -X POST https://<worker-domain>/connect \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"email\":\"<deine-garmin-mail>\",\"password\":\"$GPW\"}"
unset GPW
```

3. **Antworten:**
   - `{"ok":true,…}` → verbunden, Erstsync (Backfill 30 Tage) läuft im Hintergrund.
   - HTTP 409 `{"mfaRequired":true}` → Garmin hat einen MFA-Code geschickt; nachreichen mit:

```bash
curl -s -X POST https://<worker-domain>/connect/mfa \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"mfa_code":"123456"}'
```

4. **Status prüfen** (nach 1–2 Minuten):

```bash
curl -s https://<worker-domain>/status -H "Authorization: Bearer $JWT"
```

→ `connection_status:"connected"` und ein `last_successful_sync_at`.

## Schritt 6B — Token-Import statt Cloud-Login (nötig bei 429/IP-Block)

Hintergrund: Garmin/Cloudflare blockt Passwort-Logins von Rechenzentrums-IPs (Railway) mit `429 — IP rate limited`. Der Passwort-Login aus Schritt 6.2 schlägt dann mit `AUTH_FAILED` fehl, obwohl die Zugangsdaten stimmen. Lösung: Login einmalig lokal vom eigenen Rechner (Residential-IP), nur das Session-Token geht an den Worker.

1. Worker muss den Endpunkt `POST /connect/token-import` haben (ab Version 2026-07-17b) — sonst erst `railway up` mit dem aktualisierten Code.
2. Supabase-JWT holen wie in Schritt 6.1.
3. Lokal ausführen:

```bash
cd /Users/gianthaysen/Claude/Projects/Strava/garmin-worker
source .venv/bin/activate
python scripts/local_login.py
deactivate
```

Das Skript fragt nacheinander: Worker-URL (Enter für Default), Garmin-E-Mail, Garmin-Passwort (unsichtbar), ggf. MFA-Code, Supabase-JWT (unsichtbar). Es zeigt weder Passwort noch Token an und speichert nichts lokal.

**Kontrolle:** Ausgabe `Worker-Antwort: {"ok":true,"connectionStatus":"connected","syncQueued":true}` → weiter mit Schritt 7. Bei `TOKEN_INVALID` das Skript einfach erneut ausführen (frischer Login).

## Schritt 7 — Daten kontrollieren

Supabase → Table Editor:

- `connected_devices` → deine vívoactive 5 sollte als `watch` mit `is_primary_wearable` auftauchen.
- `user_metrics` → Zeilen mit `metric_type` wie `resting_hr`, `hrv_ms`, `sleep_duration_min`, `steps`, `vo2max_running` — jede mit `source_record_id`, `measured_at`, `validity`.
- `metric_anomalies` → idealerweise leer; Einträge bedeuten: Wert gespeichert, aber als auffällig markiert und nicht aktiv (gewollt).
- `device_capabilities` → beobachtete Metriken deiner Uhr mit Status `observed`.

Wichtig: Einzelne Parser sind im Code mit `FIXTURE-ANNAHME: gegen Live-API verifizieren` markiert (z. B. Body-Battery-Punktstruktur, Intensitätsminuten-Felder). Fehlen nach dem ersten Live-Sync bestimmte Metriken, ist das der erste Verdächtige — Railway-Logs plus Tabelleninhalt in die nächste Session geben, das ist ein erwarteter Feinschliff, kein Architekturproblem.

## Fehlerbilder (Kurzreferenz)

| Symptom | Ursache / Maßnahme |
| --- | --- |
| `401` an jedem Endpunkt | JWT abgelaufen (~1 h) → neu aus der Browser-Konsole holen |
| `409 mfaRequired` | normal bei aktivierter MFA → Schritt 6.3 |
| `/healthz` nicht erreichbar | Deploy-Log in Railway prüfen; meist fehlende Pflicht-Env-Variable (Worker startet dann bewusst nicht) |
| `connection_status:"error"` + `last_error_code` | Garmin nicht erreichbar / Rate Limit → Worker versucht es im nächsten Intervall erneut |
| `reauth_required` | Tokens ungültig geworden → Schritt 6.2 einmal wiederholen |
| Kein einziger `user_metrics`-Eintrag trotz `connected` | Railway-Logs ansehen; vermutlich Response-Shape-Abweichung (FIXTURE-ANNAHME) |

## Was danach kommt (nicht Teil dieser Anleitung)

Die neuen JS-Module sind bewusst noch NICHT in `index.html`/`sw.js` eingebunden — im Profil ändert sich also noch nichts Sichtbares. Das passiert in Phase 5 (Profil-UI mit gesperrten/überschreibbaren Feldern und Quellenanzeige) mit genau einem Service-Worker-Bump; danach Phasen 6–8 (Check-in-Reduktion, Kalorienrechner, Engine-Input) laut `app/docs/GARMIN-INTEGRATION-DESIGN.md` §9 und dem Session-Handoff.
