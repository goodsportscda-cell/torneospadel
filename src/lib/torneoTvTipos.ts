export const TIPOS_TORNEO_TV = ["oficial", "americano_individual"] as const;

export function partidoEsVisibleEnTvCanchas(partido: {
  cancha: string | null;
  estado: string;
  torneoTipo?: string;
  fechaHora: string | null;
}, cancha: string, numeroCancha: (value: string | null) => string | null, esHoy: (value: string | null) => boolean) {
  if (numeroCancha(partido.cancha) !== cancha) return false;
  if (partido.estado === "en_juego") return true;
  if (partido.estado !== "programado" && partido.estado !== "pendiente") return false;
  return partido.torneoTipo === "americano_individual" || esHoy(partido.fechaHora);
}
