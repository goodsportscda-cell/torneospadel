import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");
const SOURCE_BUCKET = "comprobantes";
const DESTINATION_BUCKET = "fotos-partidos";
const OLD_PUBLIC_PREFIX = "/storage/v1/object/public/comprobantes/";
const NEW_PUBLIC_PREFIX = "/storage/v1/object/public/fotos-partidos/";
const PAGE_SIZE = 100;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Definí SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listFolderRecursively(prefix) {
  const entries = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from(SOURCE_BUCKET)
      .list(prefix, { limit: PAGE_SIZE, offset });
    if (error) throw new Error(`No se pudo listar ${prefix}: ${error.message}`);

    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (!item.id && !item.metadata) {
        entries.push(...await listFolderRecursively(path));
      } else {
        entries.push({ path, metadata: item.metadata });
      }
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return entries;
}

function rewritePhotoUrl(value) {
  return typeof value === "string" && value.includes(OLD_PUBLIC_PREFIX)
    ? value.replaceAll(OLD_PUBLIC_PREFIX, NEW_PUBLIC_PREFIX)
    : value;
}

async function updatePhotoColumn() {
  let updated = 0;
  for (let offset = 0; ; offset = APPLY ? 0 : offset + PAGE_SIZE) {
    const { data, error } = await supabase
      .from("partidos_individuales")
      .select("id, foto_url")
      .like("foto_url", `%${OLD_PUBLIC_PREFIX}%`)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") {
        console.warn("partidos_individuales.foto_url no existe; se actualizarán las notas de torneos.");
        return updated;
      }
      throw new Error(`No se pudieron leer las fotos de partidos: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (APPLY) {
        const { error: updateError } = await supabase
          .from("partidos_individuales")
          .update({ foto_url: rewritePhotoUrl(row.foto_url) })
          .eq("id", row.id);
        if (updateError) throw new Error(`No se pudo actualizar foto_url ${row.id}: ${updateError.message}`);
      }
      updated += 1;
    }
    if (!data || data.length === 0 || (!APPLY && data.length < PAGE_SIZE)) break;
  }
  return updated;
}

async function updateTournamentNotes() {
  let updated = 0;
  for (let offset = 0; ; offset = APPLY ? 0 : offset + PAGE_SIZE) {
    const { data, error } = await supabase
      .from("torneos")
      .select("id, notas")
      .like("notas", `%${OLD_PUBLIC_PREFIX}%`)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`No se pudieron leer las notas de torneos: ${error.message}`);

    for (const row of data ?? []) {
      if (APPLY) {
        const { error: updateError } = await supabase
          .from("torneos")
          .update({ notas: rewritePhotoUrl(row.notas) })
          .eq("id", row.id);
        if (updateError) throw new Error(`No se pudieron actualizar las notas del torneo ${row.id}: ${updateError.message}`);
      }
      updated += 1;
    }
    if (!data || data.length === 0 || (!APPLY && data.length < PAGE_SIZE)) break;
  }
  return updated;
}

const photos = await listFolderRecursively("partidos");
console.log(`${APPLY ? "Aplicando" : "Vista previa:"} ${photos.length} foto(s) de partidos encontradas.`);

for (const photo of photos) {
  if (APPLY) {
    const { data: file, error: downloadError } = await supabase.storage
      .from(SOURCE_BUCKET)
      .download(photo.path);
    if (downloadError || !file) {
      throw new Error(`No se pudo descargar ${photo.path}: ${downloadError?.message ?? "archivo vacío"}`);
    }
    const { error: uploadError } = await supabase.storage
      .from(DESTINATION_BUCKET)
      .upload(photo.path, file, {
        upsert: true,
        contentType: file.type || photo.metadata?.mimetype || "image/jpeg",
      });
    if (uploadError) throw new Error(`No se pudo copiar ${photo.path}: ${uploadError.message}`);
  }
}

const photoRows = await updatePhotoColumn();
const tournamentRows = await updateTournamentNotes();
console.log(`${photoRows} fila(s) de partidos y ${tournamentRows} torneo(s) contienen URLs antiguas.`);
console.log(APPLY
  ? "Copia y referencias actualizadas."
  : "No se modificó nada. Volvé a ejecutar con --apply para copiar archivos y actualizar referencias.");
