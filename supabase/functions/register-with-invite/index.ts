import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ============================================================
   ORVIA · register-with-invite (globaler Beta-Code)
   - Ein allgemeiner Beta-Code (nicht an E-Mail gebunden).
   - Code wird SERVERSEITIG geprüft (code_hash, status, expires_at,
     used_count < max_uses). assigned_email ist optional (Legacy).
   - Auth-User wird per Admin-API erstellt; Profil + used_count via RPC.
   - E-Mail-Bestätigung: REQUIRE_EMAIL_CONFIRM = true → User muss seine
     E-Mail bestätigen, bevor Login möglich ist. Auf false stellen für
     Sofort-Zugang ohne Bestätigung.
   ============================================================ */

const REQUIRE_EMAIL_CONFIRM = true;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MESSAGES = {
  inviteOnly: 'Registrierung ist aktuell nur mit gültigem Beta-Code möglich.',
  invalidInvite: 'Beta-Code ungültig.',
  inviteUsed: 'Beta-Code wurde zu oft verwendet.',
  inviteExpired: 'Beta-Code abgelaufen.',
  weakPassword: 'Das Passwort muss mindestens 8 Zeichen lang sein.'
};

type InviteRow = {
  id: string;
  assigned_email: string | null;
  code: string | null;
  code_hash: string | null;
  used: boolean;
  used_count: number | null;
  max_uses: number | null;
  expires_at: string | null;
  status: string | null;
  role: string | null;
};

type InviteLookup =
  | { ok: true; row: InviteRow & { role: 'owner' | 'tester' } }
  | { ok: false; code: string; message: string };

const FIELDS = 'id,assigned_email,code,code_hash,used,used_count,max_uses,expires_at,status,role';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ code: 'method_not_allowed', message: MESSAGES.inviteOnly }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
      return json({ code: 'server_not_configured', message: MESSAGES.inviteOnly }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const betaCode = normalizeCode(body.betaCode || body.inviteCode || body.code);
    const password = String(body.password || '');

    if (!email || !betaCode) {
      return json({ code: 'invalid_invite', message: MESSAGES.invalidInvite }, 400);
    }
    if (password.length < 8) {
      return json({ code: 'weak_password', message: MESSAGES.weakPassword }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const invite = await findBetaCode(admin, email, betaCode);
    if (!invite.ok) {
      return json({ code: invite.code, message: invite.message }, 400);
    }

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: !REQUIRE_EMAIL_CONFIRM,
      user_metadata: { beta_role: invite.row.role || 'tester' }
    });

    if (created.error || !created.data.user) {
      const msg = String(created.error?.message || '').toLowerCase();
      // E-Mail bereits registriert: nicht verraten, ob sie existiert.
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return json({ code: 'invalid_invite', message: 'Diese E-Mail kann nicht verwendet werden.' }, 400);
      }
      console.error('createUser failed', created.error);
      return json({ code: 'invalid_invite', message: MESSAGES.invalidInvite }, 400);
    }

    const userId = created.data.user.id;
    const completed = await admin.rpc('orvia_complete_invite_registration', {
      p_invite_id: invite.row.id,
      p_user_id: userId,
      p_email: email
    });

    if (completed.error) {
      console.error('complete invite failed', completed.error);
      await admin.auth.admin.deleteUser(userId).catch((e) => console.error('cleanup deleteUser failed', e));
      return json(errorFromRpc(completed.error.message), 400);
    }

    return json({
      ok: true,
      userId,
      role: invite.row.role || 'tester',
      needsConfirmation: REQUIRE_EMAIL_CONFIRM
    }, 200);
  } catch (error) {
    console.error('register-with-invite failed', error);
    return json({ code: 'invite_only', message: MESSAGES.inviteOnly }, 500);
  }
});

async function findBetaCode(
  admin: ReturnType<typeof createClient>,
  email: string,
  betaCode: string
): Promise<InviteLookup> {
  const codeHash = await sha256Hex(betaCode);

  // Globaler Code: NICHT auf assigned_email filtern. Erst per code_hash, dann Klartext-Fallback.
  let row: InviteRow | null = null;
  const byHash = await admin.from('invite_codes').select(FIELDS).eq('code_hash', codeHash).limit(1).maybeSingle();
  if (byHash.error) {
    console.error('beta lookup (hash) failed', byHash.error);
    return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  }
  row = (byHash.data as InviteRow) || null;
  if (!row) {
    const byCode = await admin.from('invite_codes').select(FIELDS).eq('code', betaCode).limit(1).maybeSingle();
    if (!byCode.error) row = (byCode.data as InviteRow) || null;
  }

  if (!row) return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  if (row.status !== 'active') return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: 'invite_expired', message: MESSAGES.inviteExpired };
  }
  // Falls der Code doch an eine E-Mail gebunden ist (Legacy): muss passen.
  if (row.assigned_email && normalizeEmail(row.assigned_email) !== email) {
    return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  }
  const usedCount = Number(row.used_count || 0);
  const maxUses = Math.max(Number(row.max_uses || 1), 1);
  if (usedCount >= maxUses) {
    return { ok: false, code: 'invite_used', message: MESSAGES.inviteUsed };
  }

  const role = row.role === 'owner' ? 'owner' : 'tester';
  return { ok: true, row: { ...row, role } };
}

function errorFromRpc(message: string) {
  const m = String(message || '').toLowerCase();
  if (m.includes('invite_used')) return { code: 'invite_used', message: MESSAGES.inviteUsed };
  if (m.includes('invite_expired')) return { code: 'invite_expired', message: MESSAGES.inviteExpired };
  if (m.includes('invalid_invite')) return { code: 'invalid_invite', message: MESSAGES.invalidInvite };
  return { code: 'invite_only', message: MESSAGES.inviteOnly };
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}
function normalizeCode(value: unknown) {
  return String(value || '').trim();
}
async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}
