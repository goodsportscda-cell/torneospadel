import type { DragEndEvent } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ZonaPareja = {
  id: string;
  zona_id: string;
  inscripcion_id: string;
  posicion_siembra: number;
};

/**
 * Maneja el drop de una pareja sobre un slot de zona.
 * Soporta:
 *  - Mover desde el panel de disponibles a un slot vacío.
 *  - Reemplazar el contenido de un slot ocupado (la pareja anterior vuelve a disponibles).
 *  - Mover entre slots dentro de la MISMA zona (con swap si el destino está ocupado).
 */
export async function handleDropPareja(
  event: DragEndEvent,
  zonaParejasGlobal: ZonaPareja[],
): Promise<{ ok: boolean; zonaId?: string }> {
  const { active, over } = event;
  if (!over) return { ok: false };

  const activeData = active.data.current as
    | { inscripcionId: string; zonaParejaId?: string }
    | undefined;
  const overData = over.data.current as { zonaId: string; posicion: number } | undefined;
  if (!activeData || !overData) return { ok: false };

  const zonaDestinoId = overData.zonaId;

  // Buscar quién ocupa actualmente el slot destino
  const existente = zonaParejasGlobal.find(
    (zp) => zp.zona_id === zonaDestinoId && zp.posicion_siembra === overData.posicion,
  );
  if (existente?.inscripcion_id === activeData.inscripcionId) {
    return { ok: false };
  }

  try {
    if (activeData.zonaParejaId) {
      // Movimiento desde otra zona/slot existente
      const origen = zonaParejasGlobal.find((zp) => zp.id === activeData.zonaParejaId);
      if (!origen) return { ok: false };

      // Solo soportamos swap dentro de la misma zona; cross-zona = mover (sin swap)
      const mismaZona = origen.zona_id === zonaDestinoId;

      if (existente && mismaZona) {
        // Swap usando -1 como posición temporal para no chocar con índices únicos
        await supabase.from("zonas_parejas").update({ posicion_siembra: -1 }).eq("id", existente.id);
        await supabase
          .from("zonas_parejas")
          .update({ posicion_siembra: overData.posicion, zona_id: zonaDestinoId })
          .eq("id", origen.id);
        await supabase
          .from("zonas_parejas")
          .update({ posicion_siembra: origen.posicion_siembra })
          .eq("id", existente.id);
      } else {
        // Si destino ocupado y zonas distintas, mandamos la existente a disponibles (delete)
        if (existente) {
          await supabase.from("zonas_parejas").delete().eq("id", existente.id);
        }
        await supabase
          .from("zonas_parejas")
          .update({ posicion_siembra: overData.posicion, zona_id: zonaDestinoId })
          .eq("id", origen.id);
      }
    } else {
      // Viene del panel de disponibles
      if (existente) {
        await supabase.from("zonas_parejas").delete().eq("id", existente.id);
      }
      const { error } = await supabase.from("zonas_parejas").insert({
        zona_id: zonaDestinoId,
        inscripcion_id: activeData.inscripcionId,
        posicion_siembra: overData.posicion,
      });
      if (error) throw error;
    }
    return { ok: true, zonaId: zonaDestinoId };
  } catch (e) {
    console.error(e);
    toast.error("Error al asignar pareja");
    return { ok: false };
  }
}
