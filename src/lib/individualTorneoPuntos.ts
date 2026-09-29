export interface PuntosFechaIndividualInput {
  fecha: number;
  cancha: string;
  canchasCount: number;
  setsPropios: number;
  setsRival: number;
  puntosPorSet: boolean;
  ausente: boolean;
  numeroAusencias: number;
}

/** Mirrors the public/admin scoring rules for an individual challenge match. */
export function calcularPuntosFechaIndividual({
  fecha,
  cancha,
  canchasCount,
  setsPropios,
  setsRival,
  puntosPorSet,
  ausente,
  numeroAusencias,
}: PuntosFechaIndividualInput): number {
  if (ausente && numeroAusencias > 2) return 0;
  if (puntosPorSet) return setsPropios;

  const courtMatch = cancha.match(/\d+/);
  const courtIndex = courtMatch ? Number(courtMatch[0]) : 1;
  let pointsWinner = canchasCount - courtIndex + 2;
  let pointsLoser = 1;

  if (fecha === 9) {
    pointsWinner = 4;
  } else if (fecha === 10) {
    pointsWinner = 6;
    pointsLoser = 2;
  }

  return setsPropios > setsRival ? pointsWinner : pointsLoser;
}
