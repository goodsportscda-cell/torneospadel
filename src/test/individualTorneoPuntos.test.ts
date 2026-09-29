import { describe, expect, it } from "vitest";
import { calcularPuntosFechaIndividual } from "@/lib/individualTorneoPuntos";

const base = {
  fecha: 3,
  cancha: "Cancha 2: Desafío",
  canchasCount: 3,
  setsPropios: 2,
  setsRival: 0,
  puntosPorSet: false,
  ausente: false,
  numeroAusencias: 0,
};

describe("puntaje de desafíos individuales", () => {
  it("transfiere el puntaje del suplente durante las dos primeras ausencias", () => {
    expect(calcularPuntosFechaIndividual({ ...base, ausente: true, numeroAusencias: 1 })).toBe(3);
    expect(calcularPuntosFechaIndividual({ ...base, setsPropios: 0, setsRival: 2, ausente: true, numeroAusencias: 2 })).toBe(1);
  });

  it("no suma puntos desde la tercera ausencia", () => {
    expect(calcularPuntosFechaIndividual({ ...base, ausente: true, numeroAusencias: 3 })).toBe(0);
  });

  it("aplica los puntajes especiales de las fechas 9 y 10", () => {
    expect(calcularPuntosFechaIndividual({ ...base, fecha: 9 })).toBe(4);
    expect(calcularPuntosFechaIndividual({ ...base, fecha: 10 })).toBe(6);
  });

  it("suma sets cuando el torneo usa puntos por set", () => {
    expect(calcularPuntosFechaIndividual({ ...base, puntosPorSet: true })).toBe(2);
  });
});
