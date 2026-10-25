type PartidoTvFecha = {
  fecha: number;
  cancha: string | null;
  estado: string;
};

type FechaTv = {
  fecha: number;
  publicado: boolean;
};

export function seleccionarFechaTv(
  partidos: PartidoTvFecha[],
  fechas: FechaTv[],
  fechaActual: number,
  torneoFinalizado: boolean,
): number {
  if (!torneoFinalizado) {
    const fechasActivas = partidos
      .filter((partido) => partido.cancha?.trim() && partido.estado !== "finalizado")
      .map((partido) => partido.fecha);
    if (fechasActivas.length > 0) return Math.max(...fechasActivas);
  }

  if (fechas.some((fecha) => fecha.fecha === fechaActual)) return fechaActual;
  const publicadas = fechas.filter((fecha) => fecha.publicado).map((fecha) => fecha.fecha);
  if (publicadas.length > 0) return Math.max(...publicadas);
  return fechas.length > 0 ? Math.min(...fechas.map((fecha) => fecha.fecha)) : fechaActual;
}
