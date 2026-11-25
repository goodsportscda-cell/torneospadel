import fs from 'fs';
import path from 'path';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://okmmwahmhxuyojdtksnr.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbW13YWhtaHh1eW9qZHRrc25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzkxMTIsImV4cCI6MjA5ODIxNTExMn0.6uMhhEhAI2dodSNglzieAlRP7HtrKH46wLbd4XL6C9Q";

const supaHeaders = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

function formatGeneroLabel(g) {
  if (g === 'caballeros') return 'Caballeros';
  if (g === 'damas') return 'Damas';
  if (g === 'mixto') return 'Mixto';
  return g || '';
}

export default async function handler(req, res) {
  try {
    const { type, id, slug, categoria, torneo, clubSlug, tab } = req.query;

    let clubNombre = "";
    if (clubSlug) {
      try {
        const clubResp = await fetch(`${SUPABASE_URL}/rest/v1/clubes?slug=eq.${encodeURIComponent(clubSlug)}&select=nombre`, {
          headers: supaHeaders
        });
        if (clubResp.ok) {
          const clubs = await clubResp.json();
          if (clubs && clubs.length > 0 && clubs[0].nombre) {
            clubNombre = clubs[0].nombre;
          }
        }
      } catch {
        // ignore club fetch error
      }
    }

    const clubSuffix = clubNombre ? ` - ${clubNombre}` : "";
    let title = clubNombre ? `${clubNombre} | Padel ID` : "Padel ID - Gestión de Torneos";
    let description = clubNombre
      ? `Torneos, ranking oficial y resultados en vivo de ${clubNombre} en Padel ID.`
      : "Padel ID - Gestión de torneos de pádel: inscripciones, zonas, llaves y posiciones.";

    try {
      if (type === 'club') {
        if (tab === 'master') {
          title = `Good Padel Master 2026${clubSuffix} | Padel ID`;
          description = `Seguí los clasificados, parejas, llaves y cronograma del Master Diciembre 2026${clubSuffix}.`;
        } else if (tab === 'rankings' || tab === 'ranking') {
          title = `Ranking Oficial${clubSuffix} | Padel ID`;
          description = `Consultá la tabla de posiciones y puntos del Ranking oficial${clubSuffix} en Padel ID.`;
        } else {
          title = clubNombre ? `${clubNombre} · Torneos y Ranking | Padel ID` : "Portal del Club | Padel ID";
        }
      } else if (type === 'master') {
        title = `Good Padel Master 2026${clubSuffix} | Padel ID`;
        description = `Clasificados, parejas, llaves eliminatorias y orden de juego del Master Diciembre 2026${clubSuffix}.`;
      } else if (type === 'inscribirse' && id) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/torneos?id=eq.${id}&select=nombre,numero_fecha`, {
          headers: supaHeaders
        });
        if (response.ok) {
          const torneos = await response.json();
          if (torneos && torneos.length > 0) {
            const t = torneos[0];
            const fechaText = t.numero_fecha ? ` - Fecha ${t.numero_fecha}` : "";
            title = `Inscripción: ${t.nombre}${fechaText}${clubSuffix} | Padel ID`;
            description = `Inscribite al torneo ${t.nombre} de forma simple y rápida en Padel ID.`;
          }
        }
      } else if (type === 'torneo' && slug) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/torneos?id=eq.${slug}&select=nombre,numero_fecha,categoria_libre,tipo,categoria_id`, {
          headers: supaHeaders
        });
        if (response.ok) {
          const torneos = await response.json();
          if (torneos && torneos.length > 0) {
            const t = torneos[0];
            let catName = t.categoria_libre || "";
            if (!catName && t.tipo === 'oficial' && t.categoria_id) {
              const catResponse = await fetch(`${SUPABASE_URL}/rest/v1/categorias?id=eq.${t.categoria_id}&select=nombre,genero`, {
                headers: supaHeaders
              });
              if (catResponse.ok) {
                const cats = await catResponse.json();
                if (cats && cats.length > 0) {
                  catName = `${cats[0].nombre} ${formatGeneroLabel(cats[0].genero)}`.trim();
                }
              }
            }
            const catText = catName ? ` (${catName})` : "";
            const fechaText = t.numero_fecha ? ` - Fecha ${t.numero_fecha}` : "";
            title = `Torneo: ${t.nombre}${fechaText}${catText}${clubSuffix} | Padel ID`;
            description = `Seguí los resultados, zonas, llaves y posiciones en vivo de ${t.nombre} en Padel ID.`;
          }
        }
      } else if (type === 'ranking') {
        if (torneo && String(torneo).toLowerCase().includes('suma')) {
          const labelSuma = String(torneo).replace(/^modalidad:/i, '').trim();
          title = `Ranking ${labelSuma}${clubSuffix} | Padel ID`;
          description = `Consultá la tabla de posiciones y puntos del Ranking oficial de ${labelSuma}${clubSuffix} en Padel ID.`;
        } else if (categoria && categoria !== 'todas') {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/categorias?id=eq.${categoria}&select=nombre,genero`, {
            headers: supaHeaders
          });
          if (response.ok) {
            const cats = await response.json();
            if (cats && cats.length > 0) {
              const cat = cats[0];
              const gen = formatGeneroLabel(cat.genero);
              title = `Ranking ${cat.nombre} ${gen}${clubSuffix} | Padel ID`;
              description = `Consultá la tabla de posiciones y puntos del Ranking oficial para ${cat.nombre} ${gen}${clubSuffix} en Padel ID.`;
            }
          }
        } else {
          title = `Ranking Oficial${clubSuffix} | Padel ID`;
          description = `Consultá los rankings, estadísticas y puntajes oficiales de los jugadores${clubSuffix} en Padel ID.`;
        }
      }
    } catch (error) {
      console.error("Error fetching SEO data:", error);
    }

    // Load index.html
    let html = "";
    const distHtmlPath = path.join(process.cwd(), 'dist', 'index.html');
    const srcHtmlPath = path.join(process.cwd(), 'index.html');

    if (fs.existsSync(distHtmlPath)) {
      html = fs.readFileSync(distHtmlPath, 'utf8');
    } else if (fs.existsSync(srcHtmlPath)) {
      html = fs.readFileSync(srcHtmlPath, 'utf8');
    } else {
      html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
    }

    html = html
      .replace(/<title>.*?<\/title>/gi, `<title>${title}</title>`)
      .replace(/<meta\s+property="og:title"\s+content=".*?"/gi, `<meta property="og:title" content="${title}"`)
      .replace(/<meta\s+name="twitter:title"\s+content=".*?"/gi, `<meta name="twitter:title" content="${title}"`)
      .replace(/<meta\s+name="description"\s+content=".*?"/gi, `<meta name="description" content="${description}"`)
      .replace(/<meta\s+property="og:description"\s+content=".*?"/gi, `<meta property="og:description" content="${description}"`)
      .replace(/<meta\s+name="twitter:description"\s+content=".*?"/gi, `<meta name="twitter:description" content="${description}"`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send(`Serverless Function Error:\n${err.message}\nStack:\n${err.stack}`);
  }
}
