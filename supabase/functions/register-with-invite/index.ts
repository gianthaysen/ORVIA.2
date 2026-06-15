import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MESSAGES = {
  inviteOnly: 'Dieser Zugang ist aktuell nur für eingeladene Beta-Tester freigeschaltet.',
  invalidInvite: 'E-Mail oder Invite-Code ist ungültig.',
  inviteUsed: 'Dieser Invite-Code wurde bereits verwendet.',
  inviteExpired: 'Dieser Invite-Code ist abgelaufen.',
  weakPassword: 'Das Passwort muss mindestens 8 Zeichen lang sein.'
};

type InviteRow = {
  id: string;
  assigned_email: string | null;
  code: string | null;
  code_hash: string | null;
  used: boolean;
  expires_at: string | null;
  status: string | null;
  role: string | null;
};

type InviteLookup =
  | { ok: true; row: InviteRow & { role: 'owner' | 'tester' } }
  | { ok: false; code: string; message: string };

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
    const inviteCode = normalizeCode(body.inviteCode || body.code);
    const password = String(body.password || '');

    if (!email || !inviteCode) {
      return json({ code: 'invalid_invite', message: MESSAGES.invalidInvite }, 400);
    }
    if (password.length < 8) {
      return json({ code: 'weak_password', message: MESSAGES.weakPassword }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const invite = await findInvite(admin, email, inviteCode);
    if (!invite.ok) {
      return json({ code: invite.code, message: invite.message }, 400);
    }

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { beta_role: invite.row.role || 'tester' }
    });

    if (created.error || !created.data.user) {
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
      await admin.auth.admin.deleteUser(userId).catch((deleteError) => {
        console.error('cleanup deleteUser failed', deleteError);
      });
      return json(errorFromRpc(completed.error.message), 400);
    }

    return json({
      ok: true,
      userId,
      role: invite.row.role || 'tester'
    }, 200);
  } catch (error) {
    console.error('register-with-invite failed', error);
    return json({ code: 'invite_only', message: MESSAGES.inviteOnly }, 500);
  }
});

async function findInvite(
  admin: ReturnType<typeof createClient>,
  email: string,
  inviteCode: string
): Promise<InviteLookup> {
  const codeHash = await sha256Hex(inviteCode);
  const { data, error } = await admin
    .from('invite_codes')
    .select('id,assigned_email,code,code_hash,used,expires_at,status,role')
    .eq('assigned_email', email);

  if (error) {
    console.error('invite lookup failed', error);
    return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  }

  const rows = (Array.isArray(data) ? data : []) as InviteRow[];
  const match = rows.find((row) => {
    const plain = row.code ? normalizeCode(row.code) === inviteCode : false;
    const hashed = row.code_hash ? String(row.code_hash).toLowerCase() === codeHash : false;
    return plain || hashed;
  });

  if (!match) return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  if (match.used) return { ok: false, code: 'invite_used', message: MESSAGES.inviteUsed };
  if (match.status !== 'active') return { ok: false, code: 'invalid_invite', message: MESSAGES.invalidInvite };
  if (match.expires_at && new Date(match.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: 'invite_expired', message: MESSAGES.inviteExpired };
  }
  const role = match.role === 'owner' ? 'owner' : 'tester';

  return { ok: true, row: { ...match, role } };
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
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
}
