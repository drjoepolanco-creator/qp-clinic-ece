// ══════════════════════════════════════════════════════════════════════════════
//  fijar-contrasena — Edge Function del ECE QP Clinic
//
//  Permite que un ADMINISTRADOR fije directamente la contraseña de otra persona
//  de su misma unidad, sin depender del correo electrónico.
//
//  Por qué existe: el navegador solo puede cambiar la contraseña de la sesión
//  abierta. Todo lo demás pasa por un enlace enviado por correo, y el servicio
//  de correo del proyecto no entrega mensajes a direcciones externas. Eso dejaba
//  al personal sin forma de recuperar el acceso.
//
//  La llave de servicio (SUPABASE_SERVICE_ROLE_KEY) vive aquí, en el servidor.
//  Nunca viaja al navegador.
//
//  Resguardos:
//    · Solo rol «admin» activo puede invocarla.
//    · Un administrador solo alcanza a personal de su propia unidad.
//      amfa queda aislada de QP, igual que el padrón de pacientes.
//    · Las cuentas de dirección (usuarios.oculto = true) no pueden ser tocadas.
//    · Todo cambio queda asentado en bitacora_accesos (NOM-024, artículo 8).
// ══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Misma política de contraseñas que el manual del SIEC, apartado 6.1.
function validarContrasena(p: string): string | null {
  if (!p || p.length < 8) return "Debe tener al menos 8 caracteres";
  if (!/[A-Z]/.test(p)) return "Debe incluir al menos una mayúscula";
  if (!/[a-z]/.test(p)) return "Debe incluir al menos una minúscula";
  if (!/[0-9]/.test(p)) return "Debe incluir al menos un número";
  if (!/[^A-Za-z0-9]/.test(p)) return "Debe incluir al menos un símbolo";
  return null;
}

// ¿La unidad del administrador alcanza a la del destinatario?
// amfa solo alcanza amfa. Cualquier otra unidad alcanza todo menos amfa.
function alcanza(sedeAdmin: string | null, sedeDestino: string | null): boolean {
  const a = sedeAdmin || "clinic";
  const d = sedeDestino || "clinic";
  return a === "amfa" ? d === "amfa" : d !== "amfa";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);

  const URL_SB = Deno.env.get("SUPABASE_URL")!;
  const LLAVE_SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!URL_SB || !LLAVE_SERVICIO) {
    return responder({ error: "La función no está configurada correctamente" }, 500);
  }

  const admin = createClient(URL_SB, LLAVE_SERVICIO, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 1. Identificar a quien hace la petición ───────────────────────────────
  const cabecera = req.headers.get("Authorization") || "";
  const jwt = cabecera.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return responder({ error: "Falta la sesión de quien solicita" }, 401);

  const { data: sesion, error: errSesion } = await admin.auth.getUser(jwt);
  if (errSesion || !sesion?.user) {
    return responder({ error: "Sesión no válida o expirada" }, 401);
  }
  const solicitanteId = sesion.user.id;

  // ── 2. Comprobar que es administrador activo ──────────────────────────────
  const { data: solicitante } = await admin
    .from("usuarios")
    .select("id,rol,sede,activo,titulo,nombre,apellidos")
    .eq("id", solicitanteId)
    .maybeSingle();

  if (!solicitante) return responder({ error: "No se encontró su perfil de usuario" }, 403);
  if (solicitante.activo === false) return responder({ error: "Su cuenta está desactivada" }, 403);
  if (solicitante.rol !== "admin") {
    return responder({ error: "Solo un administrador puede fijar contraseñas" }, 403);
  }

  // ── 3. Leer la petición ───────────────────────────────────────────────────
  let cuerpo: { usuario_id?: string; contrasena?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "Petición mal formada" }, 400);
  }
  const destinoId = (cuerpo.usuario_id || "").trim();
  const contrasena = cuerpo.contrasena || "";
  if (!destinoId) return responder({ error: "Falta indicar el usuario" }, 400);

  const errPass = validarContrasena(contrasena);
  if (errPass) return responder({ error: "Contraseña insegura: " + errPass }, 400);

  // ── 4. Comprobar el destinatario ──────────────────────────────────────────
  const { data: destino } = await admin
    .from("usuarios")
    .select("id,rol,sede,activo,oculto,titulo,nombre,apellidos,username")
    .eq("id", destinoId)
    .maybeSingle();

  if (!destino) return responder({ error: "No se encontró a esa persona" }, 404);

  if (destino.oculto === true && destino.id !== solicitanteId) {
    return responder({ error: "Esta cuenta no puede modificarse desde el sistema" }, 403);
  }
  if (!alcanza(solicitante.sede, destino.sede)) {
    return responder({ error: "Esa persona pertenece a otra unidad" }, 403);
  }

  // ── 5. Fijar la contraseña ────────────────────────────────────────────────
  // Se marca el correo como confirmado en el mismo movimiento. Las cuentas
  // creadas antes de apagar la confirmación quedaron pendientes, y eso impedía
  // entrar aunque la contraseña fuera correcta.
  const { error: errCambio } = await admin.auth.admin.updateUserById(destinoId, {
    password: contrasena,
    email_confirm: true,
  });
  if (errCambio) {
    return responder({ error: "No se pudo cambiar la contraseña: " + errCambio.message }, 400);
  }

  // ── 6. Dejar constancia ───────────────────────────────────────────────────
  // Quien puede fijar una contraseña puede entrar como esa persona. Sin este
  // registro no habría forma de saberlo después.
  const nombreAdmin = `${solicitante.titulo || ""} ${solicitante.nombre || ""} ${solicitante.apellidos || ""}`.trim();
  const nombreDestino = `${destino.titulo || ""} ${destino.nombre || ""} ${destino.apellidos || ""}`.trim();
  try {
    await admin.from("bitacora_accesos").insert({
      usuario_id: solicitanteId,
      usuario_nombre: nombreAdmin || "Administrador",
      usuario_rol: solicitante.rol,
      accion: "CAMBIO DE CONTRASEÑA",
      detalle: `Fijó la contraseña de ${nombreDestino} (${destino.username || destino.id})`,
      ip_referencia: req.headers.get("x-forwarded-for") || "edge-function",
      timestamp: new Date().toISOString(),
    });
  } catch (_e) {
    // El cambio ya ocurrió; no se revierte por un fallo de bitácora.
  }

  return responder({
    ok: true,
    mensaje: `Contraseña actualizada para ${nombreDestino}`,
    usuario: destino.username || null,
  });
});
