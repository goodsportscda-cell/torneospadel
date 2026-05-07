import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const dni = url.searchParams.get("dni")?.trim();
    const q = url.searchParams.get("q")?.trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Búsqueda exacta por DNI (devuelve datos completos)
    if (dni) {
      if (!/^\d{6,9}$/.test(dni)) {
        return new Response(JSON.stringify({ jugador: null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("jugadores")
        .select("id, dni, nombre, apellido, telefono, email, genero, categoria_id, club")
        .eq("dni", dni)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ jugador: data ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Búsqueda por apellido o DNI parcial (autocompletar compañero)
    if (q && q.length >= 2) {
      const isDigit = /^\d+$/.test(q);
      const query = supabase
        .from("jugadores")
        .select("id, dni, nombre, apellido")
        .limit(10);

      const { data, error } = isDigit
        ? await query.ilike("dni", `${q}%`)
        : await query.ilike("apellido", `${q}%`);

      if (error) throw error;
      return new Response(JSON.stringify({ jugadores: data ?? [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ jugadores: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("buscar-jugador-publico error:", err);
    const message = err instanceof Error ? err.message : "Error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
