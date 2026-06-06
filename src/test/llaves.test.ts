import { describe, it, expect } from "vitest";
import { obtenerPlantilla, CASOS_SOPORTADOS } from "../lib/llaves";

describe("llaves - 23 parejas draw template", () => {
  it("should support 23 parejas in CASOS_SOPORTADOS", () => {
    expect(CASOS_SOPORTADOS).toContain(23);
  });

  it("should return correct template for 23 parejas", () => {
    const plantilla = obtenerPlantilla(23);
    expect(plantilla).not.toBeNull();
    if (!plantilla) return;

    expect(plantilla.cantidad).toBe(23);
    expect(plantilla.partidos).toHaveLength(15); // 8 octavos + 4 cuartos + 2 semis + 1 final = 15

    // Verify first round (octavos de final) matches (Matches 49 to 56)
    const octavos = plantilla.partidos.filter(p => p.ronda === "octavos");
    expect(octavos).toHaveLength(8);

    // Order matches by their sequential number
    const sortedOctavos = [...octavos].sort((a, b) => a.numero - b.numero);

    expect(sortedOctavos[0]).toEqual({
      numero: 49,
      ronda: "octavos",
      ref_local: "1°A",
      ref_visitante: "3°B",
    });

    expect(sortedOctavos[1]).toEqual({
      numero: 50,
      ronda: "octavos",
      ref_local: "2°F",
      ref_visitante: "2°G",
    });

    expect(sortedOctavos[2]).toEqual({
      numero: 51,
      ronda: "octavos",
      ref_local: "1°E",
      ref_visitante: "2°C",
    });

    expect(sortedOctavos[3]).toEqual({
      numero: 52,
      ronda: "octavos",
      ref_local: "2°B",
      ref_visitante: "1°D",
    });

    expect(sortedOctavos[4]).toEqual({
      numero: 53,
      ronda: "octavos",
      ref_local: "1°C",
      ref_visitante: "2°A",
    });

    expect(sortedOctavos[5]).toEqual({
      numero: 54,
      ronda: "octavos",
      ref_local: "2°D",
      ref_visitante: "1°F",
    });

    expect(sortedOctavos[6]).toEqual({
      numero: 55,
      ronda: "octavos",
      ref_local: "1°G",
      ref_visitante: "2°E",
    });

    expect(sortedOctavos[7]).toEqual({
      numero: 56,
      ronda: "octavos",
      ref_local: "3°A",
      ref_visitante: "1°B",
    });

    // Verify quarter finals (Matches 57 to 60)
    const cuartos = plantilla.partidos.filter(p => p.ronda === "cuartos");
    expect(cuartos).toHaveLength(4);
    const sortedCuartos = [...cuartos].sort((a, b) => a.numero - b.numero);

    expect(sortedCuartos[0]).toEqual({
      numero: 57,
      ronda: "cuartos",
      ref_local: "G:49",
      ref_visitante: "G:50",
    });

    expect(sortedCuartos[1]).toEqual({
      numero: 58,
      ronda: "cuartos",
      ref_local: "G:51",
      ref_visitante: "G:52",
    });

    expect(sortedCuartos[2]).toEqual({
      numero: 59,
      ronda: "cuartos",
      ref_local: "G:53",
      ref_visitante: "G:54",
    });

    expect(sortedCuartos[3]).toEqual({
      numero: 60,
      ronda: "cuartos",
      ref_local: "G:55",
      ref_visitante: "G:56",
    });

    // Verify semifinals (Matches 61 & 62)
    const semis = plantilla.partidos.filter(p => p.ronda === "semifinal");
    expect(semis).toHaveLength(2);
    const sortedSemis = [...semis].sort((a, b) => a.numero - b.numero);

    expect(sortedSemis[0]).toEqual({
      numero: 61,
      ronda: "semifinal",
      ref_local: "G:57",
      ref_visitante: "G:58",
    });

    expect(sortedSemis[1]).toEqual({
      numero: 62,
      ronda: "semifinal",
      ref_local: "G:59",
      ref_visitante: "G:60",
    });

    // Verify final (Match 64)
    const final = plantilla.partidos.find(p => p.ronda === "final");
    expect(final).toEqual({
      numero: 64,
      ronda: "final",
      ref_local: "G:61",
      ref_visitante: "G:62",
    });
  });
});
