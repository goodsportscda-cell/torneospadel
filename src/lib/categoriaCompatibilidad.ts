export function extraerNivelCategoria(nombre: string | null | undefined): number | null {
  if (!nombre) return null;
  const match = nombre.toLocaleLowerCase("es-AR").match(/(?:^|[^\p{L}\d])([1-8])\s*(?:ra|da|ta|va|ma|º|°)(?=$|[^\p{L}\d])/u);
  return match ? Number(match[1]) : null;
}

export function puedeAnotarseEnCategoria(
  categoriaAsignada: string | null | undefined,
  categoriaTorneo: string | null | undefined,
): boolean {
  const nivelJugador = extraerNivelCategoria(categoriaAsignada);
  const nivelTorneo = extraerNivelCategoria(categoriaTorneo);

  // Si la categoría es especial o no tiene equivalencia numérica, requiere revisión manual.
  if (nivelJugador === null || nivelTorneo === null) return true;
  return nivelTorneo <= nivelJugador;
}
