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

export function extraerSumaCategoriaPareja(categoriaTorneo: string | null | undefined): number | null {
  if (!categoriaTorneo) return null;
  const suma = categoriaTorneo.match(/\bsuma\s*(\d+)\b|\bs(\d+)\b/i);
  if (suma) return Number(suma[1] ?? suma[2]);

  // Some clubs label pair categories as "5ta-6ta" instead of "Suma 11".
  const niveles = [...categoriaTorneo.matchAll(/(?:^|[^\p{L}\d])([1-8])\s*(?:ra|da|ta|va|ma|º|°)(?=$|[^\p{L}\d])/giu)]
    .map((match) => Number(match[1]));
  return niveles.length === 2 ? niveles[0] + niveles[1] : null;
}

/** In Suma N tournaments, eligibility belongs to the pair, not each player. */
export function puedeAnotarseParejaEnCategoria(
  categoriaJugador1: string | null | undefined,
  categoriaJugador2: string | null | undefined,
  categoriaTorneo: string | null | undefined,
): boolean {
  const suma = extraerSumaCategoriaPareja(categoriaTorneo);
  if (suma === null) {
    return puedeAnotarseEnCategoria(categoriaJugador1, categoriaTorneo)
      && puedeAnotarseEnCategoria(categoriaJugador2, categoriaTorneo);
  }

  const nivel1 = extraerNivelCategoria(categoriaJugador1);
  const nivel2 = extraerNivelCategoria(categoriaJugador2);
  // Unknown/special categories continue to require manual review, as before.
  if (nivel1 === null || nivel2 === null) return true;
  return nivel1 + nivel2 === suma;
}
