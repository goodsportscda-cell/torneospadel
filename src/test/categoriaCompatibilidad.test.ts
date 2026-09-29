import { describe, expect, it } from "vitest";
import { extraerNivelCategoria, puedeAnotarseEnCategoria } from "@/lib/categoriaCompatibilidad";

describe("compatibilidad de categorías de inscripción", () => {
  it("extrae categorías ordinales aunque incluyan género", () => {
    expect(extraerNivelCategoria("6ta Caballeros")).toBe(6);
    expect(extraerNivelCategoria("8va")).toBe(8);
  });

  it("impide bajar de categoría y permite anotarse en una superior", () => {
    expect(puedeAnotarseEnCategoria("6ta", "7ma")).toBe(false);
    expect(puedeAnotarseEnCategoria("6ta", "8va")).toBe(false);
    expect(puedeAnotarseEnCategoria("8va", "6ta")).toBe(true);
  });

  it("deja pasar categorías especiales para revisión manual", () => {
    expect(puedeAnotarseEnCategoria("6ta", "Suma 7")).toBe(true);
  });
});
