const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = "https://ijhxmckhntfquhxmussa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaHhtY2tobnRmcXVoeG11c3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzMxMjMsImV4cCI6MjA5MjAwOTEyM30.2UmiCPsbpeBj9d1dEqac7axcVoRxaNX3CE3NmGrjUYw";

module.exports = async (req, res) => {
  try {
    const { type, id, slug, categoria } = req.query;

    let title = "Padel ID - Gestión de Torneos";
    let description = "Inscribite a los torneos con Padel ID: completá tus datos y los de tu compañero/a en pocos pasos.";

    try {
      if (type === 'inscribirse' && id) {
        // Fetch tournament details
        const response = await fetch(`${SUPABASE_URL}/rest/v1/torneos?id=eq.${id}&select=nombre,numero_fecha`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (response.ok) {
          const torneos = await response.json();
          if (torneos && torneos.length > 0) {
            const torneo = torneos[0];
            const fechaText = torneo.numero_fecha ? ` - Fecha ${torneo.numero_fecha}` : "";
            title = `Inscripción: ${torneo.nombre}${fechaText} | Padel ID`;
            description = `Inscribite al torneo ${torneo.nombre} de forma simple y rápida en Padel ID.`;
          }
        }
      } else if (type === 'torneo' && slug) {
        // Fetch tournament details
        const response = await fetch(`${SUPABASE_URL}/rest/v1/torneos?id=eq.${slug}&select=nombre,numero_fecha,categoria_libre,tipo,categoria_id`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (response.ok) {
          const torneos = await response.json();
          if (torneos && torneos.length > 0) {
            const torneo = torneos[0];
            let catName = torneo.categoria_libre || "";
            
            if (!catName && torneo.tipo === 'oficial' && torneo.categoria_id) {
              const catResponse = await fetch(`${SUPABASE_URL}/rest/v1/categorias?id=eq.${torneo.categoria_id}&select=nombre,genero`, {
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
              });
              if (catResponse.ok) {
                const cats = await catResponse.json();
                if (cats && cats.length > 0) {
                  const cat = cats[0];
                  const gen = cat.genero === 'caballeros' ? 'Cab' : (cat.genero === 'damas' ? 'Damas' : cat.genero);
                  catName = `${cat.nombre} ${gen}`;
                }
              }
            }

            const catText = catName ? ` (${catName})` : "";
            const fechaText = torneo.numero_fecha ? ` - Fecha ${torneo.numero_fecha}` : "";
            title = `Torneo: ${torneo.nombre}${fechaText}${catText} | Padel ID`;
            description = `Seguí los resultados, zonas, llaves, cuadros y posiciones en vivo de ${torneo.nombre} en Padel ID.`;
          }
        }
      } else if (type === 'ranking') {
        if (categoria) {
          // Fetch category details for the ranking
          const response = await fetch(`${SUPABASE_URL}/rest/v1/categorias?id=eq.${categoria}&select=nombre,genero`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          });
          if (response.ok) {
            const cats = await response.json();
            if (cats && cats.length > 0) {
              const cat = cats[0];
              const gen = cat.genero === 'caballeros' ? 'Cab' : (cat.genero === 'damas' ? 'Damas' : cat.genero);
              title = `Ranking ${cat.nombre} ${gen} | Padel ID`;
              description = `Consultá la tabla de posiciones y puntos del Ranking oficial para la categoría ${cat.nombre} ${gen} en Padel ID.`;
            }
          }
        } else {
          title = "Ranking Público | Padel ID";
          description = "Consultá los rankings, estadísticas y puntajes oficiales de los jugadores en Padel ID.";
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
      // Basic fallback HTML if files aren't found
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

    // Replace Title & Description tags in the index.html content
    html = html
      .replace(/<title>.*?<\/title>/gi, `<title>${title}</title>`)
      // Replace Open Graph title
      .replace(/<meta\s+property="og:title"\s+content=".*?"/gi, `<meta property="og:title" content="${title}"`)
      .replace(/<meta\s+name="twitter:title"\s+content=".*?"/gi, `<meta name="twitter:title" content="${title}"`)
      // Replace Descriptions
      .replace(/<meta\s+name="description"\s+content=".*?"/gi, `<meta name="description" content="${description}"`)
      .replace(/<meta\s+property="og:description"\s+content=".*?"/gi, `<meta property="og:description" content="${description}"`)
      .replace(/<meta\s+name="twitter:description"\s+content=".*?"/gi, `<meta name="twitter:description" content="${description}"`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send(`Serverless Function Error:\n${err.message}\nStack:\n${err.stack}`);
  }
};
