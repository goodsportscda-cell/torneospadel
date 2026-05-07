import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is admin
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Check admin role
    const { data: roleRow } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mantener_id, eliminar_id } = await req.json();
    if (!mantener_id || !eliminar_id || mantener_id === eliminar_id) {
      return new Response(
        JSON.stringify({ error: "IDs inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify both players exist
    const { data: players } = await svc
      .from("jugadores")
      .select("id")
      .in("id", [mantener_id, eliminar_id]);

    if (!players || players.length !== 2) {
      return new Response(
        JSON.stringify({ error: "No se encontraron ambos jugadores" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update all references from eliminar_id -> mantener_id
    // 1. inscripciones
    await svc.from("inscripciones").update({ jugador1_id: mantener_id }).eq("jugador1_id", eliminar_id);
    await svc.from("inscripciones").update({ jugador2_id: mantener_id }).eq("jugador2_id", eliminar_id);

    // 2. ranking_jugadores
    await svc.from("ranking_jugadores").update({ jugador_id: mantener_id }).eq("jugador_id", eliminar_id);

    // 3. ascensos
    await svc.from("ascensos").update({ jugador_id: mantener_id }).eq("jugador_id", eliminar_id);

    // 4. profiles (jugador_id link)
    await svc.from("profiles").update({ jugador_id: mantener_id }).eq("jugador_id", eliminar_id);

    // 5. Delete the duplicate player
    const { error: delErr } = await svc.from("jugadores").delete().eq("id", eliminar_id);
    if (delErr) throw delErr;

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("fusionar-jugadores error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
