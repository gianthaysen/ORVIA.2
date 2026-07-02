import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleRegister } from './handler.mjs';

/* ============================================================
   ORVIA · register-with-invite — DÜNNER Deno-Wrapper (P1-DI-Refactor)
   Die gesamte Logik (Invite-Prüfung, Nutzeranlage, Idempotenz/Resume,
   E-Mail-Bestätigung, Verträge) liegt testbar in ./handler.mjs und wird
   offline getestet: supabase/tests/register_with_invite_test.mjs.
   Hier passiert NUR: Env lesen → Admin-Client bauen → delegieren.
   Fehlende Env → handler antwortet 500 server_not_configured (admin: null).
   ============================================================ */

Deno.serve((req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const admin = (supabaseUrl && serviceRoleKey)
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return handleRegister(req, { admin, log: console });
});
