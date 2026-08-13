/* ============================================================
   ORVIA · delete-account — serverseitige Konto- und Datenlöschung (H4).
   Vertrag:
   - Aufruf NUR mit gültigem Nutzer-JWT (Authorization: Bearer <access_token>).
   - Body { confirm: true } ist Pflicht (Schutz vor versehentlichen Aufrufen).
   - Löscht den Auth-User über die Admin-API; ALLE Nutzertabellen hängen mit
     `references auth.users(id) on delete cascade` daran (0002 ff.) und werden
     dadurch vollständig mitgelöscht (user_profiles, daily_checkins, user_sports,
     weekly_availability, user_goals, user_constraints, activities, workout_*,
     readiness_*, app_state, orvia_migrations …).
   - Antwort: { ok: true } bzw. { ok: false, code, message } — der Client löscht
     lokale Daten NUR nach ok:true (fail-closed).
   - SERVICE_ROLE_KEY existiert ausschließlich hier (Function-Secret), nie im Client.
   Deploy: supabase functions deploy delete-account   (manuell durch den Betreiber;
   Secrets SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY sind im Functions-Standard gesetzt).
   ============================================================ */
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, code: "method_not_allowed", message: "POST erwartet." });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { ok: false, code: "misconfigured", message: "Function nicht konfiguriert." });

  // 1) Identität aus dem NUTZER-JWT bestimmen (niemals aus dem Body — kein Fremdlöschen).
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return json(401, { ok: false, code: "no_token", message: "Keine Sitzung." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user?.id) return json(401, { ok: false, code: "invalid_token", message: "Sitzung ungültig." });
  const uid = userData.user.id;

  // 2) Explizite Bestätigung verlangen.
  let body: { confirm?: boolean } = {};
  try { body = await req.json(); } catch (_) { /* leer */ }
  if (body.confirm !== true) return json(400, { ok: false, code: "not_confirmed", message: "Löschung nicht bestätigt." });

  // 3) Storage ZUERST leeren (Phase 6.5 ②, 2026-08-05): deleteUser kaskadiert nur
  //    DB-Zeilen — Objekte im privaten Bucket 'avatars' ({uid}/profile.jpg) blieben
  //    sonst als verwaiste personenbezogene Daten liegen (DSGVO-Löschlücke).
  //    Fail-closed: schlägt die Storage-Löschung fehl, wird der User NICHT gelöscht
  //    (lieber ein wiederholbarer Fehler als eine unvollständige Löschung).
  try {
    const { data: objs, error: listErr } = await admin.storage.from("avatars").list(uid, { limit: 1000 });
    if (listErr) throw new Error("storage_list: " + listErr.message);
    if (objs && objs.length) {
      const paths = objs.map((o: { name: string }) => `${uid}/${o.name}`);
      const { error: rmErr } = await admin.storage.from("avatars").remove(paths);
      if (rmErr) throw new Error("storage_remove: " + rmErr.message);
    }
  } catch (e) {
    console.error("[delete-account] Storage-Löschung fehlgeschlagen:", (e as Error).message);
    return json(500, { ok: false, code: "storage_delete_failed", message: "Löschung fehlgeschlagen (Storage). Es wurde nichts gelöscht — bitte erneut versuchen." });
  }

  // 4) Auth-User löschen → alle Tabellen kaskadieren (on delete cascade; verifiziert
  //    2026-08-05 gegen Migrationen 0002–0030: jede Nutzertabelle hängt direkt oder
  //    transitiv an auth.users; 'equipment' u. a. sind globale Referenztabellen).
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) {
    console.error("[delete-account] Löschung fehlgeschlagen:", delErr.message);
    return json(500, { ok: false, code: "delete_failed", message: "Löschung fehlgeschlagen." });
  }
  return json(200, { ok: true });
});
