# ORVIA · Phase 1 — Backend einrichten (Supabase)

Dauer: ~10–15 Min. Danach hat ORVIA echten **geschützten Zugang (Invite-Code),
Accounts (Login bleibt erhalten) und Cloud-Sync**. Ohne diese Schritte läuft die
App weiter im **lokalen Modus** (wie bisher, nur dieses Gerät, kein Login).

> Wichtig: Solange in `js/config.js` die Platzhalter stehen, ist nichts „kaputt" —
> die App startet normal lokal. Das Gate/Login erscheint erst nach Schritt 5.

---

## Schritt 1 — Supabase-Projekt anlegen
1. Auf https://supabase.com mit GitHub/E-Mail anmelden (kostenlos).
2. **New project** → Name z. B. `orvia`, Region **Frankfurt (eu-central)** (DSGVO/Latenz).
3. Ein **Datenbank-Passwort** vergeben (notieren). Projekt wird erstellt (~1–2 Min).

## Schritt 2 — Datenbank-Schema einspielen
1. Im Projekt: linkes Menü **SQL Editor** → **New query**.
2. Den **kompletten Inhalt von `supabase/schema.sql`** hineinkopieren.
3. **Run**. Erwartung: „Success". Damit existieren alle Tabellen, die
   Row-Level-Security (jeder sieht nur eigene Daten) und die Invite-Funktionen.
   (Das Skript ist mehrfach ausführbar — Wiederholen schadet nicht.)

## Schritt 3 — Invite-Code(s) anlegen
Im **SQL Editor** ausführen (Code frei wählbar, `max_uses` = wie oft nutzbar):
```sql
insert into public.invite_codes(code_hash, label, max_uses)
values (encode(digest('ORVIA-BETA-2026','sha256'),'hex'), 'Beta 1', 25);
```
Für weitere Personen einfach weitere Zeilen mit anderem Code einfügen.
Den **Klartext-Code** (`ORVIA-BETA-2026`) gibst du an erlaubte Nutzer weiter — in
der Datenbank liegt nur der Hash.

## Schritt 4 — E-Mail-Bestätigung (für die Beta empfohlen: aus)
**Authentication → Providers → Email** → „**Confirm email**" **deaktivieren**.
Dann funktioniert Registrieren → sofort eingeloggt. (Lässt du es an, müssen
Nutzer erst die Bestätigungs-Mail anklicken und sich danach einloggen.)

## Schritt 5 — Schlüssel in die App eintragen
1. **Project Settings → API**. Dort:
   - **Project URL** (z. B. `https://abcdxyz.supabase.co`)
   - **anon public** Key (langer Schlüssel)
2. In `app/js/config.js` eintragen:
```js
window.ORVIA_CFG = {
  SUPABASE_URL:      'https://abcdxyz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...DEIN_ANON_KEY...'
};
```
> Der **anon**-Key gehört ins Frontend und ist durch RLS abgesichert — er darf
> öffentlich sein. Den **service_role**-Key NIEMALS hier eintragen.

## Schritt 6 — Hochladen & testen
1. `app/`-Inhalt wie gewohnt zu GitHub Pages hochladen (inkl. neuem Ordner
   `js/` mit `config.js`, `sync.js`, `auth.js` — `supabase/` und diese `.md`
   müssen nicht mit hoch).
2. App öffnen → es erscheint das **ORVIA-Gate**:
   - **Registrieren**: Invite-Code + E-Mail + Passwort → Account wird erstellt.
   - Beim nächsten Start: direkt drin (Session bleibt), **kein Code mehr nötig**.
3. Hast du auf dem Gerät schon lokale Daten, fragt ORVIA einmalig:
   **„Lokale Daten übernehmen?"** → in den Account hochladen oder Cloud laden.

---

## Wie der Schutz wirklich funktioniert
- **Zugang**: Registrieren nur mit gültigem Invite-Code (serverseitig geprüft).
- **Daten-Isolation**: Row-Level-Security — jeder Account sieht ausschließlich
  eigene Daten. Das ist der echte Schutz, nicht das Frontend.
- **Hinweis**: Die statische HTML-Datei selbst bleibt bei GitHub Pages abrufbar.
  Geschützt sind die **Daten** (hinter Login + RLS), nicht die Auslieferung der
  Seite. Wer „die Seite soll gar nicht laden" will, braucht später ein Hosting
  mit serverseitigem Zugangscheck (z. B. Vercel/Cloudflare Access).

## Was Phase 1 kann / noch nicht
**Aktiv:** Invite-Gate, Accounts, Login bleibt erhalten, Logout, Cloud-Sync von
Check-ins + Profil (+ Consent), lokale Migration, Sync-Status im Profil.

**Vorbereitet (Datenmodell steht, Logik folgt):** Strava-OAuth & Auto-Sync,
Garmin-Integration, Aktivitäten/Routen, Trends, Activity-Detail, Legal-Center,
Konto-Löschung serverseitig.

**Sync-Modell Phase 1:** verlustfreier Gesamt-Snapshot mit „neuere Version
gewinnt". Für mehrere Geräte gleichzeitig kommt später ein Feinmerge.

> Diese Schicht wurde sorgfältig gebaut, aber **noch nicht live gegen ein echtes
> Supabase-Projekt getestet** (das geht erst mit deinen Schlüsseln). Wenn beim
> ersten Login etwas hakt: Browser-Konsole offen lassen — die Fehler sind dort
> klar lesbar, und wir fixen sie gezielt.
