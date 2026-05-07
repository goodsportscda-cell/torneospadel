import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const APP_BASE_URL = "https://pocket-claude-buddy.lovable.app";
const DEFAULT_OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9622b5db-dc3a-4fe3-ac36-98d93492508d/id-preview-4a35e3ee--f540858b-a346-4bc6-abfa-4f0996d6159f.lovable.app-1776479379538.png";

const BOT_UA_REGEX =
  /(WhatsApp|facebookexternalhit|Twitterbot|Slackbot|TelegramBot|Discordbot|LinkedInBot|Embedly|Pinterest|SkypeUriPreview|vkShare|W3C_Validator|redditbot|Applebot|bingbot|Googlebot|Bot|crawler|spider|preview)/i;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatFecha(numero: number | null | undefined): string {
  if (!numero) return "";
  return ` · Fecha ${numero}`;
}

function buildHtml(opts: {
  title: string;
  description: string;
  redirectUrl: string;
  image: string;
  canonicalUrl: string;
}) {
  const { title, description, redirectUrl, image, canonicalUrl } = opts;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:site_name" content="Good Padel - Gestión de Torneos" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />

<meta http-equiv="refresh" content="0; url=${escapeHtml(redirectUrl)}" />
<script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</head>
<body>
<p>Redirigiendo a <a href="${escapeHtml(redirectUrl)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    // Path puede ser /og-inscripcion/:torneoId o ?torneo=:id
    const parts = url.pathname.split("/").filter(Boolean);
    const torneoId = parts[parts.length - 1] !== "og-inscripcion"
      ? parts[parts.length - 1]
      : url.searchParams.get("torneo") ?? "";

    const ua = req.headers.get("user-agent") ?? "";
    const isBot = BOT_UA_REGEX.test(ua);

    const redirectUrl = `${APP_BASE_URL}/inscribirse/${torneoId}`;
    const canonicalUrl = `${APP_BASE_URL}/inscribirse/${torneoId}`;

    // Si no es bot y hay torneoId válido, redirigir directo
    if (!isBot && torneoId) {
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      });
    }

    let title = "Inscripción a Torneo · Good Padel";
    let description =
      "Inscribite a los torneos de Good Padel: completá tus datos y los de tu compañero/a en pocos pasos.";

    if (torneoId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: torneo } = await supabase
        .from("torneos")
        .select("nombre, numero_fecha, fecha_inicio, sede, estado")
        .eq("id", torneoId)
        .maybeSingle();

      if (torneo) {
        const fechaTxt = formatFecha(torneo.numero_fecha);
        title = `${torneo.nombre}${fechaTxt} · Good Padel`;
        const fechaInicio = torneo.fecha_inicio
          ? new Date(torneo.fecha_inicio).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "";
        const sedeTxt = torneo.sede ? ` · Sede: ${torneo.sede}` : "";
        description = `Inscribite al torneo ${torneo.nombre}${fechaTxt}${
          fechaInicio ? ` (${fechaInicio})` : ""
        }${sedeTxt}. Completá tus datos y los de tu compañero/a.`;
      }
    }

    const html = buildHtml({
      title,
      description,
      redirectUrl,
      image: DEFAULT_OG_IMAGE,
      canonicalUrl,
    });

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("og-inscripcion error", e);
    return new Response("Error", { status: 500 });
  }
});
