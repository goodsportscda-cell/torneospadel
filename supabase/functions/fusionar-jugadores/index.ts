import { createClient } from "npm:@supabase/supabase-js@2.103.3";

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
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const accessToken = authHeader.match(/^Bearer\s+(\S+)$/i)?.[1];
    const { data: { claims }, error: authErr } = accessToken
      ? await supabaseAnon.auth.getClaims(accessToken)
      : { data: { claims: null }, error: new Error("Missing bearer token") };
    const userId = claims?.sub;
    if (authErr || !userId) {
      console.warn("fusionar-jugadores authentication rejected", authErr?.message ?? "missing subject");
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
      .eq("user_id", userId)
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

    const { error: mergeError } = await svc.rpc("fusionar_jugadores", {
      p_mantener_id: mantener_id,
      p_eliminar_id: eliminar_id,
    });
    if (mergeError) {
      console.warn("fusionar-jugadores merge rejected", mergeError.code, mergeError.message);
      return new Response(JSON.stringify({ error: mergeError.message }), {
        status: mergeError.code === "P0002" ? 404 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
