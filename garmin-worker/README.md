# ORVIA Garmin-Sync-Worker

Gehosteter Python-Worker, der Garmin-Daten über `python-garminconnect` (0.3.2,
inoffizielle API) abruft, gegen den kanonischen Metrik-Katalog normalisiert und
validiert und idempotent nach Supabase schreibt (Migration
`0019_provider_metrics_foundation.sql`). Architektur: siehe
`app/docs/GARMIN-INTEGRATION-DESIGN.md`.

## Endpunkte

| Methode | Pfad | Auth | Zweck |
| --- | --- | --- | --- |
| POST | `/connect` | Supabase-JWT | Garmin verbinden (`{email, password, mfa_code?}`); bei MFA → 409 `{mfaRequired:true}` |
| POST | `/connect/mfa` | Supabase-JWT | MFA-Code nachreichen (`{mfa_code}`) |
| POST | `/sync` | Supabase-JWT | Manuellen Sync anstoßen (202, läuft im Hintergrund) |
| DELETE | `/connection` | Supabase-JWT | Verbindung trennen (Tokens löschen; `user_metrics` bleiben) |
| GET | `/status` | Supabase-JWT | Verbindungs-/Sync-Status |
| GET | `/healthz` | keine | Healthcheck |

Das Passwort wird nur transient für den Login-Request verwendet, nie
gespeichert. Session-Tokens werden Fernet-verschlüsselt in
`provider_credentials` abgelegt (service_role-only, keine Nutzer-RLS-Policies).

## Deployment auf Railway

1. Neues Railway-Projekt → "Deploy from GitHub repo" → dieses Repository.
2. In den Service-Settings **Root Directory auf `garmin-worker/`** setzen
   (Railway baut dann das enthaltene `Dockerfile`).
3. Fernet-Key generieren (lokal, Ausgabe nirgends committen):

   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

4. Env-Variablen im Railway-Service setzen (siehe `.env.example`):
   - `SUPABASE_URL` — Projekt-URL
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role-Key (nur hier, nie im Client)
   - `TOKEN_ENCRYPTION_KEY` — der generierte Fernet-Key
   - `ALLOWED_ORIGINS` — z. B. die GitHub-Pages-Origin der App
   - optional: `SYNC_INTERVAL_MINUTES`, `SYNC_BACKFILL_DAYS`,
     `DEFAULT_TIMEZONE`, `LOG_LEVEL`
   `PORT` setzt Railway automatisch.
5. Deploy auslösen; danach `GET https://<service>/healthz` prüfen (`{"ok":true}`).
6. Voraussetzung in Supabase: Migration `0019_provider_metrics_foundation.sql`
   ist eingespielt.

## Lokaler Start

```bash
cd garmin-worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env   # Werte eintragen; .env ist gitignored
set -a; source .env; set +a
uvicorn orvia_worker.main:app --reload --port 8000
```

Tests (offline, Garmin/Supabase vollständig gemockt — Tests gehen nie ins Netz):

```bash
python -m pytest tests/ -q
```

## Metrik-Registry regenerieren

`orvia_worker/metric_registry.json` ist GENERIERT aus dem kanonischen Katalog
`app/js/metrics/metric-registry.js` (Single Source of Truth). Nach jeder
Katalogänderung neu exportieren und mit committen:

```bash
node app/js/metrics/export-registry.mjs > garmin-worker/orvia_worker/metric_registry.json
```

Nicht von Hand editieren. Der Vertragstest
`supabase/tests/metric_registry_test.mjs` erzwingt Gleichstand;
`tests/test_sync_contract.py` prüft zusätzlich die `on_conflict`-Verträge
gegen die 0019-Migration.

## Migrationsweg zur offiziellen Garmin-API

Die inoffizielle API (mobiler SSO-Flow) ist ein Übergangspfad. Beim Wechsel
zum Garmin Developer Program wird ausschließlich ersetzt:

- `orvia_worker/providers/garmin_unofficial.py` → `garmin_official.py` (OAuth),
- `credential_kind` `session_tokens` → `oauth_tokens`,
- `provider_type` `garmin_unofficial` → `garmin_official` (beide bereits in den
  0019-Enums).

`normalize.py`, `validation.py`, `sync.py`, Datenbank, Resolver und UI bleiben
unverändert; historische `user_metrics`-Zeilen behalten ihren Provider —
keine Datenmigration nötig (Design §8).

## Hinweise / Grenzen

- Response-Shapes einzelner Garmin-Endpunkte sind gegen Fixtures getestet;
  im Code mit `FIXTURE-ANNAHME: gegen Live-API verifizieren` markierte Parser
  brauchen vor dem Livegang eine kontrollierte Live-Verifikation (Design §10,
  Phase 9).
- MFA-Fortsetzung nach einem Worker-Neustart nutzt einen serialisierten
  Session-Zustand (Cookie-Rekonstruktion) und ist ebenfalls live zu
  verifizieren; im Normalfall läuft MFA im selben Prozess.
- Keine Logs von Credentials, Tokens oder Garmin-Roh-Payloads.
