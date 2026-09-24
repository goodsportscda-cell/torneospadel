import { supabase } from "@/integrations/supabase/client";
import { updateFotoInNotas } from "@/logic/torneoStandings";

/**
 * Comprime una imagen en el navegador a máximo 1280px y calidad óptima
 * para carga ultrarrápida y mínimo consumo de datos.
 */
export async function compressImage(file: File, maxWidth = 1280, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Convierte un Blob a DataURL (base64) como fallback resiliente
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sube la foto del partido a Supabase Storage (bucket comprobantes)
 * con fallback a DataURL ultra comprimido si hay problemas de red o storage.
 */
export async function uploadPartidoPhoto(
  file: File,
  torneoId: string,
  matchId: string
): Promise<string> {
  const compressedBlob = await compressImage(file);
  const ext = "jpg";
  const fileName = `partidos/${torneoId}/${matchId}_${Date.now()}.${ext}`;

  try {
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("comprobantes")
      .upload(fileName, compressedBlob, {
        upsert: true,
        contentType: "image/jpeg",
      });

    if (uploadErr) {
      console.warn("Storage upload warning, fallback to compressed DataURL:", uploadErr.message);
      return await blobToDataUrl(compressedBlob);
    }

    if (uploadData) {
      const { data: publicUrlData } = supabase.storage
        .from("comprobantes")
        .getPublicUrl(fileName);
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (err) {
    console.warn("Error en upload storage, fallback a DataURL:", err);
  }

  return await blobToDataUrl(compressedBlob);
}

/**
 * Persistencia dual resiliente:
 * 1. Intenta actualizar `partidos_individuales.foto_url`.
 * 2. Actualiza la etiqueta `[FOTO_matchId:url]` en `torneos.notas`.
 */
export async function persistPartidoPhoto(
  torneoId: string,
  matchId: string,
  photoUrl: string | null,
  currentNotas: string | null | undefined
): Promise<string> {
  const cleanUrl = photoUrl && photoUrl.trim().length > 0 ? photoUrl.trim() : null;

  // 1. Actualizar tabla partidos_individuales
  try {
    await (supabase as any)
      .from("partidos_individuales")
      .update({ foto_url: cleanUrl })
      .eq("id", matchId);
  } catch (colErr: any) {
    console.warn("Columna foto_url pendiente en cache, persistido en notas:", colErr?.message);
  }

  // 2. Actualizar torneos.notas
  const updatedNotas = updateFotoInNotas(currentNotas, matchId, cleanUrl);
  if (updatedNotas !== (currentNotas || "")) {
    try {
      await (supabase as any)
        .from("torneos")
        .update({ notas: updatedNotas || null })
        .eq("id", torneoId);
    } catch (notasErr: any) {
      console.error("Error al actualizar torneos.notas:", notasErr?.message);
    }
  }

  return updatedNotas;
}
