export const TIPOS_TORNEO_TV = ["oficial", "americano", "americano_individual"] as const;
export const ESTADOS_TORNEO_ACTIVOS_TV = ["en_curso", "inscripciones_cerradas"] as const;

export function partidoEsVisibleEnTvCanchas(partido: {
  cancha: string | null;
  estado: string;
  torneoTipo?: string;
  fechaHora: string | null;
}, cancha: string, numeroCancha: (value: string | null) => string | null, esHoy: (value: string | null) => boolean) {
  if (numeroCancha(partido.cancha) !== cancha) return false;
  if (partido.estado === "en_juego") return true;
  if (partido.estado !== "programado" && partido.estado !== "pendiente") return false;
  return (
    partido.torneoTipo === "americano_individual" ||
    partido.torneoTipo === "americano" ||
    esHoy(partido.fechaHora)
  );
}
