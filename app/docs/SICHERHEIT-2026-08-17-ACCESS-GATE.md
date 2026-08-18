# Sicherheitsbefund 17.08.2026 · Rechte-Eskalation über `profiles.role`

**Status: geschlossen.** Migration `0036_access_gate_haerten.sql` eingespielt, Wirkung an der
Produktionsinstanz und im laufenden Client verifiziert.

---

## 1 · Der Befund

Ein beliebiger **angemeldeter** Nutzer konnte sich mit einem einzigen Request Lese- und
Schreibzugriff auf die Daten **aller** Nutzer verschaffen:

```js
await ORVIA.sb.from('profiles').update({ role: 'owner' }).eq('user_id', <eigene id>)
```

### Die Kette

| # | Glied | Beleg |
|---|---|---|
| 1 | Policy `own_rows` auf `profiles` ist `ALL` für `{authenticated}`, `qual`/`with_check` = `auth.uid() = user_id` | `pg_policies` |
| 2 | Sie prüft, **wessen** Zeile geändert wird — nicht **welche Spalte** | RLS kann den alten Wert nicht sehen |
| 3 | `authenticated` hatte `UPDATE` auf **jeder** Spalte, auch `role` und `is_active` | `information_schema.column_privileges`, 13 Spalten × UPDATE |
| 4 | `orvia_user_role()` liest `profiles.role`; `orvia_is_owner()` = `role = 'owner'` | `schema.sql:370` / `:383` |
| 5 | `owner_all` hängt mit `qual = orvia_is_owner()` **ohne** `user_id`-Bedingung an ~20 Tabellen | `pg_policies` |

**Zwei Nebenwirkungen derselben Lücke:** `is_active` war ebenfalls selbst setzbar — ein
gesperrter Zugang konnte sich reaktivieren. Und `own_rows` schloss `INSERT` ein, womit sich
ein Auth-Konto seine Profilzeile mit `role='tester'`, `is_active=true` selbst hätte anlegen
können; der Beta-Code-Gate wäre umgehbar gewesen.

### Zwei weitere Funde aus demselben Audit

- **`schema_migrations`** — einzige Tabelle **ohne RLS**, mit Rechten für `anon`. Der anon-Key
  steht öffentlich in `env.js`: ein unauthentifizierter Schreibpfad in die Produktionsdatenbank.
- **`oauth_tokens`** — RLS aktiv, 0 Policies, aber Rechte für anon/authenticated noch vorhanden.
  Heute durch RLS geblockt, aber **eine Policy** von einem Token-Leak entfernt.
  `provider_credentials` zeigt in Migration 0019, wie es richtig aussieht: Rechte **entzogen**.

### Einordnung

Zum Zeitpunkt des Fundes existierten zwei Produktionskonten, beide dem Betreiber gehörend —
der reale Schaden war null. Der Zeitpunkt ist der Punkt: Der Pfad wird mit dem **ersten
fremden Beta-Tester** ausnutzbar, und Beta-Tester sind der nächste geplante Schritt.

---

## 2 · Warum Rechte und nicht Policy

Eine RLS-`with_check` sieht den **alten** Wert einer Zeile nicht. Die Bedingung „`role` darf
sich nicht ändern" ist als Policy nicht ausdrückbar. Der einzige Ort, an dem sie durchsetzbar
ist, sind Tabellen- bzw. Spaltenrechte.

**Der Entzug bricht nichts**, und das ist nicht geschätzt, sondern geprüft: Profilzeilen legt
ausschließlich `orvia_complete_invite_registration()` an — `security definer`, `grant execute`
nur an `service_role`. Im gesamten Frontend gibt es genau **eine** Fundstelle für
`from('profiles')`: den `select` in `auth.js:330`.

---

## 3 · Die Maßnahme (Migration 0036)

| Ziel | Maßnahme |
|---|---|
| `profiles` | `revoke all … from anon`; `revoke insert, update, delete, truncate … from authenticated`; `grant select … to authenticated` |
| `oauth_tokens` | `revoke all from anon, authenticated` |
| `schema_migrations` | `enable row level security`; Rechte entzogen |
| `anon` gesamt | `revoke all on all tables in schema public` |
| Versionierung | `create table if not exists` für `profiles` und `oauth_tokens` — beide waren in **keiner** Migration und fehlten damit im Schema-Abgleich |

Punkt 4 ist **verhaltensneutral per Konstruktion**: Außer `schema_migrations` hat jede Tabelle
RLS aktiv, und keine Policy nennt `anon` — anon erhielt dort bereits null Zeilen. Der Entzug
nimmt nichts weg, was funktioniert, sondern die Grundlage, auf die sich eine künftige
unvorsichtige Policy stützen könnte.

---

## 4 · Verifikation nach dem Einspielen

| Prüfung | Ergebnis |
|---|---|
| `profiles`, Rechte für anon/authenticated | **eine Zeile: `authenticated | SELECT`** |
| `oauth_tokens` + `schema_migrations` | `Success. No rows returned` |
| Anzahl Tabellen mit anon-Rechten | **0** |
| Tabellen ohne RLS **oder** mit anon-Leserecht | `Success. No rows returned` |

**Der Angriff selbst, in der Konsole der eingeloggten App:**

```
> await ORVIA.sb.from('profiles').update({ role: 'owner' }).eq('user_id', (await ORVIA.sb.auth.getUser()).data.user.id)

Failed to load resource: the server responded with a status of 403
{success: false, error: Object, data: null, count: null, status: 403, …}
```

**403 ist der Beleg.** PostgREST bildet `42501 permission denied` genau darauf ab: Der
Schreibvorgang wurde **abgewiesen**. Ein `data: []` mit `error: null` wäre ein anderer,
schlechterer Zustand gewesen — dann wäre der Vorgang erlaubt und lediglich durch die Policy
auf null Zeilen reduziert worden.

**Gegenprobe:** Dashboard lädt, Session besteht, Score wird angezeigt. `grant select` ist
wirksam — ohne dieses Recht fände `loadAccessProfile()` keine Zeile und würde jeden aussperren,
auch den Betreiber.

**Regressionsschutz:** `supabase/tests/access_gate_grants_test.mjs` (15 Prüfungen) hält die
Zusagen der Migration fest und schlägt an, sobald Frontend-Code beginnt, `profiles` zu
beschreiben — denn das wäre der Anlass, die Rechte wieder aufzuweichen.

---

## 5 · Bewusst offen geblieben

**`owner_all` bleibt bestehen.** Ein Konto mit `role = 'owner'` sieht weiterhin die Daten aller
Nutzer. Das ist für Support beabsichtigt und technisch kein Fehler — aber es ist eine
personenbezogene Datenverarbeitung. Spätestens mit dem ersten fremden Beta-Tester gehört sie
in die Datenschutzerklärung: **wer** in welcher Rolle **welche** Daten einsehen kann, und zu
welchem Zweck. Offener Punkt, kein technischer Rest.

**Zwei Policies nennen `{public}` statt `{authenticated}`** (`engine_decision_log`,
`user_feature_flags`). Sie sind heute wirkungslos für `anon`, weil `auth.uid()` dort `null`
ist und `null = user_id` nie wahr wird — sie sind also durch NULL-Semantik sicher, nicht durch
Absicht. Nach dem Entzug der anon-Rechte ist das doppelt abgesichert. Aufräumen bei
Gelegenheit, keine Dringlichkeit.
