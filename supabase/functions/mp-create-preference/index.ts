import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async function serve(req: Request) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { torneoId, jugadorId, monto } = await req.json();

    if (!torneoId || !jugadorId || !monto) {
      throw new Error("Faltan parámetros obligatorios: torneoId, jugadorId, monto");
    }

    // Get MP Access Token from environment
    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("El sistema no tiene configurado el token de MercadoPago");
    }

    // Create Preference in MercadoPago API
    const preferenceData = {
      items: [
        {
          id: torneoId,
          title: "Inscripción a Torneo Desafío (Padel ID)",
          quantity: 1,
          unit_price: Number(monto),
          currency_id: "ARS",
        }
      ],
      back_urls: {
        success: `${req.headers.get("origin")}/torneo-individual/${torneoId}?pago=exitoso`,
        failure: `${req.headers.get("origin")}/torneo-individual/${torneoId}?pago=fallido`,
        pending: `${req.headers.get("origin")}/torneo-individual/${torneoId}?pago=pendiente`
      },
      auto_return: "approved",
      external_reference: `${torneoId}_${jugadorId}`, // We will use this in the webhook to identify the payment
      statement_descriptor: "PADEL ID",
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" } // Excluir pago en efectivo (Rapipago/PagoFácil) porque demoran
        ],
        installments: 1
      }
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preferenceData)
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("Error MercadoPago:", errorText);
      throw new Error("Error al comunicarse con MercadoPago");
    }

    const mpData = await mpResponse.json();

    return new Response(JSON.stringify({ init_point: mpData.init_point, id: mpData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
}

Deno.serve(serve);
