import { createClient } from "npm:@supabase/supabase-js@2.57.4";

export default async function serve(req: Request) {
  // Webhooks are usually POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    // MercadoPago sends 'data.id' and 'type' as query parameters or in body
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const id = url.searchParams.get("data.id") || url.searchParams.get("id");

    if (topic !== "payment" || !id) {
      // Ignoramos notificaciones que no sean de pago creado
      return new Response("OK", { status: 200 });
    }

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("El sistema no tiene configurado el token de MercadoPago");
    }

    // 1. Consultar el pago en MercadoPago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      }
    });

    if (!mpResponse.ok) {
      throw new Error("No se pudo consultar el pago en MercadoPago");
    }

    const payment = await mpResponse.json();

    // 2. Si el pago fue aprobado, actualizamos la base de datos
    if (payment.status === "approved" && payment.external_reference) {
      // external_reference tiene el formato torneoId_jugadorId
      const parts = payment.external_reference.split("_");
      if (parts.length === 2) {
        const torneoId = parts[0];
        const jugadorId = parts[1];

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Cambiar el estado a "confirmada" (que implica pago exitoso en este flujo)
        const { error } = await supabase
          .from("torneo_individual_jugadores")
          .update({ estado: "confirmada" })
          .eq("torneo_id", torneoId)
          .eq("jugador_id", jugadorId);

        if (error) {
          console.error("Error actualizando jugador en base de datos:", error);
          throw error;
        }
      }
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
    });
  }
}

Deno.serve(serve);
