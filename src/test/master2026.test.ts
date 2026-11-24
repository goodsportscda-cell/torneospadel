import { describe, expect, it } from "vitest";
import {
  computeMasterQualifiersOrder,
  detectarConflictosCronograma,
  determinarGanadorBestOf3,
  formarParejasPuras,
  getNextMasterMatchTarget,
  MASTER_BRACKET_TEMPLATE,
  matchMasterCategorySpec,
  validarSuma7,
  type MasterQualifierInput,
} from "@/lib/master2026";

describe("master2026", () => {
  it("matches the 8 official Master 2026 categories", () => {
    expect(matchMasterCategorySpec({ nombre: "5ta", genero: "caballeros" })?.key).toBe("caballeros_5ta");
    expect(matchMasterCategorySpec({ nombre: "6ta", genero: "caballeros" })?.key).toBe("caballeros_6ta");
    expect(matchMasterCategorySpec({ nombre: "7ma", genero: "caballeros" })?.key).toBe("caballeros_7ma");
    expect(matchMasterCategorySpec({ nombre: "8va", genero: "caballeros" })?.key).toBe("caballeros_8va");
    expect(matchMasterCategorySpec({ nombre: "6ta", genero: "damas" })?.key).toBe("damas_6ta");
    expect(matchMasterCategorySpec({ nombre: "7ma", genero: "damas" })?.key).toBe("damas_7ma");
    expect(matchMasterCategorySpec({ nombre: "8va", genero: "damas" })?.key).toBe("damas_8va");
    expect(matchMasterCategorySpec({ nombre: "Suma 7", genero: "caballeros" })?.key).toBe("caballeros_suma7");
    expect(matchMasterCategorySpec({ nombre: "4ta", genero: "caballeros" })).toBeNull();
    expect(matchMasterCategorySpec({ nombre: "5ta", genero: "damas" })).toBeNull();
  });

  it("shifts all correlative positions up when a titular becomes baja and promotes first suplente", () => {
    const base: MasterQualifierInput[] = Array.from({ length: 18 }, (_, i) => ({
      jugador_id: `p${i + 1}`,
      ranking_posicion_original: i + 1,
      puntos_anuales: 1000 - i * 10,
      torneos_jugados: 5,
      torneos_categoria_anterior: 0,
      ascenso_validado: false,
      estado: i === 1 ? "baja" : "confirmado", // #2 drops out
      orden_manual: null,
    }));

    const result = computeMasterQualifiersOrder(base, 16);
    const p2 = result.find((r) => r.jugador_id === "p2")!;
    const p3 = result.find((r) => r.jugador_id === "p3")!;
    const p17 = result.find((r) => r.jugador_id === "p17")!;
    const p18 = result.find((r) => r.jugador_id === "p18")!;

    expect(p2.posicion_final).toBeNull();
    expect(p3.posicion_final).toBe(2); // shifted up from 3 to 2
    expect(p17.posicion_final).toBe(16); // promoted from #17 to #16 titular
    expect(p17.es_suplente).toBe(false);
    expect(p18.posicion_final).toBe(17); // becomes Suplente #1
    expect(p18.es_suplente).toBe(true);
    expect(p18.orden_suplente).toBe(1);
  });

  it("allows ascenso_validado to count previous category tournaments toward minimum 4", () => {
    const rows: MasterQualifierInput[] = [
      {
        jugador_id: "asc1",
        ranking_posicion_original: 1,
        puntos_anuales: 500,
        torneos_jugados: 2,
        torneos_categoria_anterior: 3,
        ascenso_validado: true,
        estado: "confirmado",
        orden_manual: null,
      },
      {
        jugador_id: "no_asc",
        ranking_posicion_original: 2,
        puntos_anuales: 450,
        torneos_jugados: 2,
        torneos_categoria_anterior: 3,
        ascenso_validado: false,
        estado: "pendiente",
        orden_manual: null,
      },
    ];

    const res = computeMasterQualifiersOrder(rows, 16);
    expect(res.find((r) => r.jugador_id === "asc1")?.elegible).toBe(true);
    expect(res.find((r) => r.jugador_id === "asc1")?.posicion_final).toBe(1);
    expect(res.find((r) => r.jugador_id === "no_asc")?.elegible).toBe(false);
    expect(res.find((r) => r.jugador_id === "no_asc")?.posicion_final).toBeNull();
  });

  it("forms 8 extreme-crossover pairs and seeds them by combined points", () => {
    const titulares = Array.from({ length: 16 }, (_, i) => ({
      jugador_id: `p${i + 1}`,
      puntos_anuales: (16 - i) * 100,
      posicion_final: i + 1,
    }));

    const pairs = formarParejasPuras(titulares);
    expect(pairs).toHaveLength(8);
    expect(pairs.map((p) => p.cruce_label)).toContain("1° + 16°");
    expect(pairs.map((p) => p.cruce_label)).toContain("8° + 9°");
    // All pairs here sum 1700, so tie-breaker is mejor_ranking_individual (1..8)
    expect(pairs[0].seed).toBe(1);
    expect(pairs[0].cruce_label).toBe("1° + 16°");
    expect(pairs[7].seed).toBe(8);
    expect(pairs[7].cruce_label).toBe("8° + 9°");
  });

  it("validates Suma 7 rule (>= 7)", () => {
    expect(validarSuma7(3, 4).ok).toBe(true);
    expect(validarSuma7(2, 5).ok).toBe(true);
    expect(validarSuma7(3, 3).ok).toBe(false);
    expect(validarSuma7(null, 4).ok).toBe(false);
  });

  it("builds official QF->SF->F bracket template and determines best-of-3 winners", () => {
    expect(MASTER_BRACKET_TEMPLATE).toHaveLength(7);
    expect(MASTER_BRACKET_TEMPLATE[0]).toMatchObject({ numero_partido: 1, seedLocal: 1, seedVisitante: 8 });
    expect(MASTER_BRACKET_TEMPLATE[1]).toMatchObject({ numero_partido: 2, seedLocal: 4, seedVisitante: 5 });
    expect(MASTER_BRACKET_TEMPLATE[2]).toMatchObject({ numero_partido: 3, seedLocal: 3, seedVisitante: 6 });
    expect(MASTER_BRACKET_TEMPLATE[3]).toMatchObject({ numero_partido: 4, seedLocal: 2, seedVisitante: 7 });

    expect(
      determinarGanadorBestOf3({
        set1_local: 6,
        set1_visitante: 4,
        set2_local: 3,
        set2_visitante: 6,
        set3_local: 6,
        set3_visitante: 2,
      })
    ).toBe("local");

    expect(
      determinarGanadorBestOf3({
        set1_local: 4,
        set1_visitante: 6,
        set2_local: 2,
        set2_visitante: 6,
        set3_local: null,
        set3_visitante: null,
      })
    ).toBe("visitante");

    expect(getNextMasterMatchTarget(1)).toEqual({ nextNumero: 5, slot: "team_local_id" });
    expect(getNextMasterMatchTarget(2)).toEqual({ nextNumero: 5, slot: "team_visitante_id" });
    expect(getNextMasterMatchTarget(6)).toEqual({ nextNumero: 7, slot: "team_visitante_id" });
    expect(getNextMasterMatchTarget(7)).toBeNull();
  });

  it("detects court and player schedule conflicts", () => {
    const conflicts = detectarConflictosCronograma([
      {
        id: "m1",
        categoriaLabel: "5ta Caballeros",
        rondaLabel: "QF1",
        dia: "2026-12-03",
        hora: "18:30",
        cancha: 1,
        playerIds: ["j1", "j2", "j3", "j4"],
      },
      {
        id: "m2",
        categoriaLabel: "7ma Damas",
        rondaLabel: "QF1",
        dia: "2026-12-03",
        hora: "19:00",
        cancha: 1,
        playerIds: ["j5", "j6", "j7", "j8"],
      },
      {
        id: "m3",
        categoriaLabel: "Suma 7",
        rondaLabel: "QF1",
        dia: "2026-12-03",
        hora: "19:00",
        cancha: 2,
        playerIds: ["j1", "j9", "j10", "j11"],
      },
    ]);

    expect(conflicts.some((c) => c.type === "cancha")).toBe(true);
    expect(conflicts.some((c) => c.type === "jugador")).toBe(true);
  });
});
