/* ============================================================
   ORVIA · register-with-invite / handler — testbarer Kern (P1, TEST-GAP-PLAN)
   - Reines ESM ohne externe Imports: läuft unter Deno (Edge) UND Node (Tests).
   - Deno.serve in index.ts ist nur ein dünner Wrapper; alle Abhängigkeiten
     werden injiziert: { admin, log }.
   - Erfolgs-Vertrag (verbindlich, Client: auth-logic.js acceptRegistration):
       { ok: true, flowVersion: 2, status: 'confirmation_required', email, emailSent }
     emailSent ist NUR true, wenn GoTrue den Versand ohne Fehler bestätigt hat.
   - Fehler-Verträge: { code, message } mit stabilen Codes:
       method_not_allowed(405) · server_not_configured(500) · invalid_invite(400)
       · weak_password(400) · invite_expired(400) · invite_used(400) · invite_only(500)
   - Logging: NIE Passwörter, Tokens oder Roh-Payloads — nur safeError()-Auszüge.
   ============================================================ */

export const MESSAGES = {
  inviteOnly: 'Registrierung ist aktuell nur mit gültigem Beta-Code möglich.',
  invalidInvite: 'Beta-Code ungültig.',
  inviteUsed: 'Beta-Code wurde zu oft verwendet.',
  inviteExpired: 'Beta-Code abgelaufen.',
  weakPassword: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
  emailTaken: 'Diese E-Mail kann nicht verwendet werden.'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FIELDS = 'id,assigned_email,code,code_hash,used,used_count,max_uses,expires_at,status,role';

export async function handleRegister(req, deps) {
  deps = deps || {};
  const admin = deps.admin || null;
  const log = deps.log || console;

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ code: 'method_not_allowed', message: MESSAGES.inviteOnly }, 405);

  try {
    if (!admin) {
      log.error('register-with-invite: admin client missing (env not configured).');
      return json({ code: 'server_not_configured', message: MESSAGES.inviteOnly }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const betaCode = normalizeCode(body.betaCode || body.inviteCode || body.code);
    const password = String(body.password || '');
    const redirectTo = normalizeRedirect(body.redirectTo);

    if (!email || !betaCode) return json({ code: 'invalid_invite', message: MESSAGES.invalidInvite }, 400);
    if (password.length < 8) return json({ code: 'weak_password', message: MESSAGES.weakPassword }, 400);

    const invite = await lookupInvite(admin, email, betaCode, log);
    if (!invite.ok && !invite.exhaustedOnly) return json({ code: invite.code, message: invite.message }, 400);

    // Nutzungslimit erreicht: NUR als Wiederaufnahme (Resume) für einen existierenden,
    // UNBESTÄTIGTEN Nutzer zulässig, der genau diesen Code bereits eingelöst hat.
    if (invite.exhaustedOnly) {
      const existing = await getUserByEmail(admin, email, log);
      if (!existing || isConfirmed(existing)) return json({ code: 'invite_used', message: MESSAGES.inviteUsed }, 400);
      const redeemed = await hasRedemption(admin, invite.row.id, existing.id, log);
      if (!redeemed) return json({ code: 'invite_used', message: MESSAGES.inviteUsed }, 400);
      return resumeUnconfirmed(admin, { user: existing, invite: invite.row, email, redirectTo, needsCompletion: false }, log);
    }

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Vertrag §8: unbestätigt anlegen, Bestätigungslink folgt per E-Mail.
      user_metadata: { beta_role: invite.row.role || 'tester' }
    });

    if (created.error || !created.data || !created.data.user) {
      const msg = String((created.error && created.error.message) || '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        // Produktregel (P1): existiert die E-Mail bereits …
        const existing = await getUserByEmail(admin, email, log);
        if (!existing) {
          // Nicht auflösbar → neutral ablehnen (keine Account-Offenlegung).
          log.error('register: duplicate email, user not resolvable.');
          return json({ code: 'invalid_invite', message: MESSAGES.emailTaken }, 400);
        }
        if (isConfirmed(existing)) {
          // … als BESTÄTIGTER Nutzer: keine neue Registrierung, kein Invite-Verbrauch, neutral.
          return json({ code: 'invalid_invite', message: MESSAGES.emailTaken }, 400);
        }
        // … als UNBESTÄTIGTER Nutzer: kein zweiter Nutzer, Invite gültig geprüft (oben),
        // kein erneuter Verbrauch (außer Orphan-Heilung), Bestätigung erneut senden.
        const redeemed = await hasRedemption(admin, invite.row.id, existing.id, log);
        return resumeUnconfirmed(admin, { user: existing, invite: invite.row, email, redirectTo, needsCompletion: !redeemed }, log);
      }
      log.error('createUser failed', safeError(created.error));
      return json({ code: 'invalid_invite', message: MESSAGES.invalidInvite }, 400);
    }

    const userId = created.data.user.id;
    const completed = await admin.rpc('orvia_complete_invite_registration', {
      p_invite_id: invite.row.id,
      p_user_id: userId,
      p_email: email
    });

    if (completed.error) {
      // RPC ist eine plpgsql-Transaktion (schema.sql): bei Exception KEINE Teileffekte
      // (kein used_count-Inkrement, keine redemption, kein profiles-Upsert).
      // Sicherer Cleanup = frisch angelegten Auth-User wieder löschen.
      log.error('complete invite failed', safeError(completed.error));
      try {
        const del = await admin.auth.admin.deleteUser(userId);
        if (del && del.error) log.error('cleanup deleteUser failed', safeError(del.error));
      } catch (e) {
        log.error('cleanup deleteUser threw', safeError(e));
      }
      return json(errorFromRpc(completed.error.message), 400);
    }

    const emailSent = await sendConfirmation(admin, email, redirectTo, log);
    return json({ ok: true, flowVersion: 2, status: 'confirmation_required', email, emailSent }, 200);
  } catch (error) {
    log.error('register-with-invite failed', safeError(error));
    return json({ code: 'invite_only', message: MESSAGES.inviteOnly }, 500);
  }
}

/* Wiederaufnahme für einen existierenden UNBESTÄTIGTEN Nutzer.
   SICHERHEITSREGEL (Freigabe Gian, 2026-07-02): Das bestehende Passwort wird NICHT
   geändert. E-Mail + Beta-Code sind KEIN ausreichender Besitznachweis für eine
   Passwortänderung — die ist nur nach bestätigter Session, Recovery-Link oder anderem
   kryptografischem Besitznachweis erlaubt. Bei vergessenem/falsch eingegebenem Passwort
   ist der Passwort-Reset der Wiederherstellungsweg. Resume macht ausschließlich:
   Invite validieren, ggf. Registrierung nachholen (Orphan), Bestätigung erneut senden. */
async function resumeUnconfirmed(admin, ctx, log) {
  if (ctx.needsCompletion) {
    // Orphan-Heilung: Auth-User existiert, aber Profil/Redemption fehlen → Registrierung abschließen.
    const completed = await admin.rpc('orvia_complete_invite_registration', {
      p_invite_id: ctx.invite.id,
      p_user_id: ctx.user.id,
      p_email: ctx.email
    });
    if (completed.error) {
      // Race mit parallelem Request: Redemption inzwischen vorhanden → als Erfolg werten.
      const redeemed = await hasRedemption(admin, ctx.invite.id, ctx.user.id, log);
      if (!redeemed) {
        log.error('resume completion failed', safeError(completed.error));
        return json(errorFromRpc(completed.error.message), 400);
      }
    }
  }

  const emailSent = await sendConfirmation(admin, ctx.email, ctx.redirectTo, log);
  return json({ ok: true, flowVersion: 2, status: 'confirmation_required', email: ctx.email, emailSent }, 200);
}

/* Invite-Lookup und -Prüfung. Liefert bei erreichtem Nutzungslimit exhaustedOnly:true
   mitsamt row, damit der Resume-Pfad die Einlösung durch DENSELBEN Nutzer prüfen kann. */
async function lookupInvite(admin, email, betaCode, log) {
  const codeHash = await sha256Hex(betaCode);
  let row = null;
  const byHash = await admin.from('invite_codes').select(FIELDS).eq('code_hash', codeHash).limit(1).maybeSingle();
  if (byHash.error) {
    log.error('beta lookup (hash) failed', safeError(byHash.error));
    return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  }
  row = byHash.data || null;
  if (!row) {
    const byCode = await admin.from('invite_codes').select(FIELDS).eq('code', betaCode).limit(1).maybeSingle();
    if (!byCode.error) row = byCode.data || null;
  }
  if (!row) return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  if (row.status !== 'active') return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: 'invite_expired', message: MESSAGES.inviteExpired };
  }
  if (row.assigned_email && normalizeEmail(row.assigned_email) !== email) {
    return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  }
  const role = row.role === 'owner' ? 'owner' : 'tester';
  const usedCount = Number(row.used_count || 0);
  const maxUses = Math.max(Number(row.max_uses || 1), 1);
  if (usedCount >= maxUses) {
    return { ok: false, exhaustedOnly: true, row: { ...row, role }, code: 'invite_used', message: MESSAGES.inviteUsed };
  }
  return { ok: true, row: { ...row, role } };
}

/* Nutzer per E-Mail auflösen: zuerst profiles.email (eigene Registrierung),
   dann listUsers-Scan als Orphan-Fallback (Beta-Skala; O(n) dokumentiert). */
async function getUserByEmail(admin, email, log) {
  try {
    const prof = await admin.from('profiles').select('user_id').eq('email', email).limit(1).maybeSingle();
    if (!prof.error && prof.data && prof.data.user_id) {
      const u = await admin.auth.admin.getUserById(prof.data.user_id);
      if (!u.error && u.data && u.data.user) return u.data.user;
    }
  } catch (e) { log.error('getUserByEmail (profiles) threw', safeError(e)); }
  try {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (!list.error && list.data && Array.isArray(list.data.users)) {
      return list.data.users.find(u => String(u.email || '').toLowerCase() === email) || null;
    }
  } catch (e) { log.error('getUserByEmail (listUsers) threw', safeError(e)); }
  return null;
}

function isConfirmed(user) {
  return !!(user && (user.email_confirmed_at || user.confirmed_at));
}

async function hasRedemption(admin, inviteId, userId, log) {
  try {
    const r = await admin.from('invite_redemptions').select('id')
      .eq('invite_code_id', inviteId).eq('user_id', userId).limit(1).maybeSingle();
    return !!(r && !r.error && r.data);
  } catch (e) {
    log.error('redemption lookup threw', safeError(e));
    return false;
  }
}

/* Bestätigungs-E-Mail über GoTrue /resend (Signup-Confirmation-Template).
   Fehler (inkl. Rate-Limit 429) ist KEIN Registrierungsfehler: Konto existiert korrekt
   unbestätigt; der Client bietet „Bestätigung erneut senden". Ehrliches Rückgabe-Flag. */
async function sendConfirmation(admin, email, redirectTo, log) {
  try {
    const sent = await admin.auth.resend({
      type: 'signup',
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined
    });
    if (sent && sent.error) { log.error('confirmation email dispatch failed', safeError(sent.error)); return false; }
    return true;
  } catch (e) {
    log.error('confirmation email dispatch threw', safeError(e));
    return false;
  }
}

function errorFromRpc(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('invite_used')) return { code: 'invite_used', message: MESSAGES.inviteUsed };
  if (m.includes('invite_expired')) return { code: 'invite_expired', message: MESSAGES.inviteExpired };
  if (m.includes('invalid_invite')) return { code: 'invalid_invite', message: MESSAGES.invalidInvite };
  return { code: 'invite_only', message: MESSAGES.inviteOnly };
}

/* Log-sicherer Fehlerauszug: nur message/status/code — nie Payloads, nie Credentials. */
function safeError(e) {
  if (!e) return null;
  return {
    message: String(e.message || e),
    status: e.status != null ? e.status : null,
    code: e.code != null ? e.code : null
  };
}

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function normalizeCode(value) { return String(value || '').trim(); }
/* Nur wohlgeformte http(s)-URLs durchreichen; die Redirect-Allowlist erzwingt GoTrue. */
function normalizeRedirect(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.toString() : null;
  } catch (_) {
    return null;
  }
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}
