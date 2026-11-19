import { createClient } from "npm:@supabase/supabase-js@2";

const originAllowed = "https://jleonesl.github.io";
const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": originAllowed,
  "Access-Control-Allow-Headers": "content-type,apikey,authorization,x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders });
const general = { message: "Si existe una cuenta ciudadana habilitada, se enviará un enlace a su correo registrado." };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST" || (req.headers.get("origin") && req.headers.get("origin") !== originAllowed))
    return reply({ error: "Operación no permitida" }, 403);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({ error: "Servicio temporalmente no disponible." }, 503);
  let form: Record<string, unknown>;
  try { form = await req.json(); } catch { return reply(general); }
  const type = String(form.type || "");
  const raw = String(form.identification || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!["V", "E", "J", "C"].includes(type) || raw.length < 5 || raw.length > 20) return reply(general);
  const identity = ["V","E"].includes(type) ? raw.replace(/^[VE]/,"") : raw;
  const bytes = new TextEncoder().encode(type + ":" + identity);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rateAllowed, error: rateError } = await admin.rpc("allow_citizen_recovery_request", { p_hash: hash });
  if (rateError) return reply({ error: "Servicio de recuperación temporalmente no disponible." }, 503);
  if (!rateAllowed) return reply(general);
  const { data: matches, error: lookupError } = await admin.rpc("resolve_citizen_login_identity", {
    p_type: type, p_identity: identity
  });
  if (lookupError || !matches || matches.length !== 1) return reply(general);
  const record = matches[0];
  const { data: userLookup, error: userError } = await admin.auth.admin.getUserById(record.linked_user_id);
  const authUser = userLookup?.user;
  if (userError || !authUser?.email_confirmed_at || 
     String(authUser.email || "").toLowerCase() !== String(record.registered_email || "").toLowerCase()) return reply(general);
  const { data: staffUser } = await admin.from("staff_profiles")
    .select("user_id").eq("user_id",record.linked_user_id).eq("is_active",true).maybeSingle();
  if (staffUser) return reply(general);
  const { error: mailError } = await admin.auth.resetPasswordForEmail(
    String(record.registered_email), { redirectTo: originAllowed + "/IMAUD/activar-contribuyente.html" }
  );
  if (mailError) console.warn("Citizen password recovery email failed:", mailError.message);
  return reply(general);
});