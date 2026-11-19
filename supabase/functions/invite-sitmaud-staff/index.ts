import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://jleonesl.github.io"]);
function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin || "") ? origin! : "https://jleonesl.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Vary": "Origin",
  };
}
function response(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return response({ error: "Método no permitido" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return response({ error: "Origen no permitido" }, 403, origin);
  const jwt = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt.length > 6000) return response({ error: "Sesión requerida" }, 401, origin);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return response({ error: "El servicio administrativo no está configurado." }, 503, origin);
  const staffClient = createClient(url, anon, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
  const { data: userData, error: authError } = await staffClient.auth.getUser(jwt);
  if (authError || !userData.user) return response({ error: "Sesión no válida" }, 401, origin);
  const { data: allowed, error: permissionError } = await staffClient.rpc("is_sitmaud_master");
  if (permissionError || allowed !== true) return response({ error: "Solo el superusuario maestro puede registrar funcionarios." }, 403, origin);
  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return response({ error: "Datos inválidos." }, 400, origin); }
  const first = String(payload.first_name || "").trim().replace(/\s+/g," ");
  const last = String(payload.last_name || "").trim().replace(/\s+/g," ");
  const email = String(payload.email || "").trim().toLowerCase();
  const identity = String(payload.identification_number || "").trim().toUpperCase();
  const phone = String(payload.phone || "").trim();
  const title = String(payload.job_title || "").trim();
  const role = String(payload.role || "");
  if (!first || !last || first.length > 90 || last.length > 90 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180 ||
    !/^[VE]-?\d{6,10}$/.test(identity) ||
    phone.length > 30 || title.length < 3 || title.length > 120 ||
    !["intendente","recaudador","administrador_analista"].includes(role)) {
    return response({ error: "Verifica nombre, apellido, correo, cédula, cargo y rol de funcionario." }, 400, origin);
  }
  const admin = createClient(url, service, { auth: { autoRefreshToken:false, persistSession:false } });
  const { data: existing, error: existingError } = await admin.from("staff_profiles")
    .select("user_id").eq("identification_number", identity).limit(1);
  if (existingError) return response({ error: "No se pudo verificar la cédula del funcionario." }, 503, origin);
  if (existing?.length) return response({ error: "Ya existe un funcionario con esa cédula." }, 409, origin);
  if (role === "intendente") {
    // Máximo cinco intendentes activos, incluido el superusuario maestro.
    // El rol por sí solo NO añade el usuario a private.sitmaud_master_owner.
    const {count, error: countError} = await admin.from("staff_profiles")
      .select("user_id", {head:true, count:"exact"})
      .eq("role","intendente").eq("is_active",true);
    if(countError) return response({error:"No se pudo verificar el límite de intendentes."},503,origin);
    if((count ?? 0) >= 5) return response({error:"Se alcanzó el máximo de cinco intendentes activos."},409,origin);
  }
  // El envío de la invitación se realiza en Supabase Auth, nunca desde el navegador.
  const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: first+" "+last, staff_pending_activation: true },
    redirectTo: "https://jleonesl.github.io/IMAUD/funcionario.html"
  });
  if (invitationError || !invitation.user) {
    return response({ error: "No se pudo enviar la invitación. Verifica el correo y la configuración de Auth." }, 409, origin);
  }
  const { error: profileError } = await admin.from("staff_profiles").insert({
    user_id: invitation.user.id,display_name: first+" "+last,role,
    job_title: title, identification_number: identity,contact_phone: phone||null,is_active:true
  });
  if (profileError) {
    // No borrar cuentas de Auth preexistentes. El operador debe revisar la invitación.
    return response({ error: "La invitación se creó, pero no se guardó el perfil. No se asignaron permisos; solicita revisión administrativa." }, 409, origin);
  }
  // Registro de creación sin cédula ni correo dentro de la bitácora.
  const { error: logError } = await admin.from("audit_log").insert({
    actor_user_id: userData.user.id,
    action: "staff_user_invited",
    entity_table: "staff_profiles", entity_id: invitation.user.id,
    after_data: {role,job_title:title,permission_count:0,channel:"admin_invite"}
  });
  if (logError) {
    // Se mantiene la cuenta sin permisos. El incidente exige atención en los logs.
    return response({ error: "El funcionario fue invitado, pero falló la bitácora; requiere revisión administrativa." }, 503, origin);
  }
  return response({ ok:true, user_id:invitation.user.id, role, invited:true, permissions_assigned:0 }, 201, origin);
});
