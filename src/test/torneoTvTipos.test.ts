import { describe, expect, it } from "vitest";
import { partidoEsVisibleEnTvCanchas, TIPOS_TORNEO_TV } from "@/lib/torneoTvTipos";

describe("tipos de torneo disponibles en TV conjunta", () => {
  it("incluye torneos oficiales y americanos individuales", () => {
    expect(TIPOS_TORNEO_TV).toContain("oficial");
    expect(TIPOS_TORNEO_TV).toContain("americano_individual");
  });

  it("muestra partidos próximos asignados a cancha de un americano aunque no tengan horario de hoy", () => {
    expect(partidoEsVisibleEnTvCanchas({
      cancha: "Cancha 2: Desafío",
      estado: "pendiente",
      torneoTipo: "americano_individual",
      fechaHora: null,
    }, "2", (value) => value?.match(/\d+/)?.[0] ?? null, () => false)).toBe(true);
  });

  it("sigue ocultando partidos futuros de torneos oficiales", () => {
    expect(partidoEsVisibleEnTvCanchas({
      cancha: "Cancha 2",
      estado: "programado",
      torneoTipo: "oficial",
      fechaHora: "2026-10-26T15:00:00",
    }, "2", (value) => value?.match(/\d+/)?.[0] ?? null, () => false)).toBe(false);
  });
});
