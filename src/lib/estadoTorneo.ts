import type { Database } from "@/integrations/supabase/types";

export type EstadoTorneo = Database["public"]["Enums"]["estado_torneo"];

export const ESTADO_TORNEO_LABELS: Record<EstadoTorneo, string> = {
  proximamente: "Próximamente",
  inscripciones_abiertas: "Inscripciones abiertas",
  inscripciones_cerradas: "Inscripciones cerradas",
  en_curso: "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

/**
 * Clases Tailwind para badge full (fondo + texto + borde) por estado.
 * Colores fijos pedidos por el cliente:
 *  - Próximamente: gris
 *  - Inscripciones abiertas: verde
 *  - Inscripciones cerradas: amarillo
 *  - En curso: azul
 *  - Finalizado: negro
 *  - Cancelado: rojo
 */
export const ESTADO_TORNEO_BADGE: Record<EstadoTorneo, string> = {
  proximamente: "bg-gray-500 text-white border-gray-500 hover:bg-gray-500/90",
  inscripciones_abiertas: "bg-green-600 text-white border-green-600 hover:bg-green-600/90",
  inscripciones_cerradas: "bg-yellow-400 text-black border-yellow-400 hover:bg-yellow-400/90",
  en_curso: "bg-blue-600 text-white border-blue-600 hover:bg-blue-600/90",
  finalizado: "bg-black text-white border-black hover:bg-black/90",
  cancelado: "bg-red-600 text-white border-red-600 hover:bg-red-600/90",
};

/** Punto de color (para listas/leyendas). */
export const ESTADO_TORNEO_DOT: Record<EstadoTorneo, string> = {
  proximamente: "bg-gray-500",
  inscripciones_abiertas: "bg-green-600",
  inscripciones_cerradas: "bg-yellow-400",
  en_curso: "bg-blue-600",
  finalizado: "bg-black",
  cancelado: "bg-red-600",
};

/** Orden lógico para selects/listados. */
export const ESTADO_TORNEO_ORDEN: EstadoTorneo[] = [
  "proximamente",
  "inscripciones_abiertas",
  "inscripciones_cerradas",
  "en_curso",
  "finalizado",
  "cancelado",
];
