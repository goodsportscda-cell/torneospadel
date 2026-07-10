import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const dniRegex = /^\d{7,9}$/;

const JugadorSchema = z.object({
  dni: z
    .string()
    .trim()
    .regex(dniRegex, "DNI inválido (7 a 9 dígitos)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nombre: z.string().trim().min(1).max(80),
  apellido: z.string().trim().min(1).max(80),
  telefono: z.string().trim().min(6).max(30),
  email: z
    .string()
    .trim()
    .email()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  genero: z.enum(["caballeros", "damas", "mixto"]).optional(),
  categoria_id: z.string().uuid().optional().nullable(),
  club: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
});

const BodySchema = z.object({
  torneo_id: z.string().uuid(),
  jugador1: JugadorSchema,
  jugador2: JugadorSchema,
  disponibilidad_horaria: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
  observaciones: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
  comprobante_url: z.string().url().optional(),
});

type JugadorInput = z.infer<typeof JugadorSchema>;

// Rate limit muy básico en memoria (por isolate). Mitigación de spam grosero.
const recentRequests = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = recentRequests.get(key) ?? [];
  const recent = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  recentRequests.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (rateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Demasiados intentos, esperá un minuto." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Datos inválidos",
          details: parsed.error.flatten().fieldErrors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const data = parsed.data;

    if (
      data.jugador1.dni &&
      data.jugador2.dni &&
      data.jugador1.dni === data.jugador2.dni
    ) {
      return new Response(
        JSON.stringify({ error: "Los dos jugadores deben tener DNI distinto." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1. Validar torneo
    const { data: torneo, error: errTorneo } = await supabase
      .from("torneos")
      .select("id, nombre, estado, cupo_maximo")
      .eq("id", data.torneo_id)
      .maybeSingle();

    if (errTorneo) throw errTorneo;
    if (!torneo) {
      return new Response(
        JSON.stringify({ error: "Torneo no encontrado." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (torneo.estado !== "inscripciones_abiertas") {
      return new Response(
        JSON.stringify({
          error: "Las inscripciones para este torneo no están abiertas.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Buscar o crear jugadores
    const upsertJugador = async (j: JugadorInput): Promise<string> => {
      // Si vino DNI, intento matchear por DNI
      if (j.dni) {
        const { data: existing, error: errFind } = await supabase
          .from("jugadores")
          .select("id")
          .eq("dni", j.dni)
          .maybeSingle();
        if (errFind) throw errFind;

        if (existing) {
          await supabase
            .from("jugadores")
            .update({
              telefono: j.telefono,
              email: j.email ?? null,
              club: j.club ?? null,
              ...(j.genero ? { genero: j.genero } : {}),
              ...(j.categoria_id ? { categoria_id: j.categoria_id } : {}),
            })
            .eq("id", existing.id);
          return existing.id;
        }
      }

      const { data: nuevo, error: errIns } = await supabase
        .from("jugadores")
        .insert({
          dni: j.dni ?? null,
          nombre: j.nombre,
          apellido: j.apellido,
          telefono: j.telefono,
          email: j.email ?? null,
          genero: j.genero ?? null,
          categoria_id: j.categoria_id ?? null,
          club: j.club ?? null,
        })
        .select("id")
        .single();
      if (errIns) throw errIns;
      return nuevo.id;
    };

    const jugador1Id = await upsertJugador(data.jugador1);
    const jugador2Id = await upsertJugador(data.jugador2);

    // 3. Verificar duplicado de inscripción (misma pareja en mismo torneo)
    const { data: dup } = await supabase
      .from("inscripciones")
      .select("id")
      .eq("torneo_id", data.torneo_id)
      .or(
        `and(jugador1_id.eq.${jugador1Id},jugador2_id.eq.${jugador2Id}),and(jugador1_id.eq.${jugador2Id},jugador2_id.eq.${jugador1Id})`,
      )
      .maybeSingle();

    if (dup) {
      return new Response(
        JSON.stringify({
          error: "Esta pareja ya está inscripta en este torneo.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Determinar estado según cupo
    let estadoInscripcion: "pendiente_confirmacion" | "lista_espera" =
      "pendiente_confirmacion";
    if (torneo.cupo_maximo && torneo.cupo_maximo > 0) {
      const { count } = await supabase
        .from("inscripciones")
        .select("id", { count: "exact", head: true })
        .eq("torneo_id", data.torneo_id)
        .in("estado", ["confirmada", "pendiente_confirmacion"]);
      if ((count ?? 0) >= torneo.cupo_maximo) {
        estadoInscripcion = "lista_espera";
      }
    }

    // 5. Crear inscripción
    const { error: errInsc } = await supabase.from("inscripciones").insert({
      torneo_id: data.torneo_id,
      jugador1_id: jugador1Id,
      jugador2_id: jugador2Id,
      estado: estadoInscripcion,
      estado_pago: "pendiente",
      disponibilidad_horaria: data.disponibilidad_horaria ?? null,
      notas: data.observaciones ?? null,
      comprobante_url: data.comprobante_url ?? null,
    });
    if (errInsc) throw errInsc;

    return new Response(
      JSON.stringify({
        ok: true,
        estado: estadoInscripcion,
        torneo: torneo.nombre,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("inscripcion-publica error:", err);
    const message = err instanceof Error ? err.message : "Error inesperado";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
