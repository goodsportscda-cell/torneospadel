import { describe, expect, it } from "vitest";
import { seleccionarFechaTv } from "@/lib/torneoTvFecha";

describe("selección de fecha en la TV del torneo individual", () => {
  const fechas = [
    { fecha: 4, publicado: true },
    { fecha: 5, publicado: false },
    { fecha: 6, publicado: false },
  ];

  it("elige la fecha más reciente con partidos de cancha no finalizados", () => {
    const partidos = [
      { fecha: 5, cancha: "Cancha 1", estado: "finalizado" },
      { fecha: 6, cancha: "Cancha 1: Élite", estado: "pendiente" },
      { fecha: 6, cancha: "Cancha 2: Desafío", estado: "en_juego" },
    ];

    expect(seleccionarFechaTv(partidos, fechas, 4, false)).toBe(6);
  });

  it("conserva la fecha elegida si no hay partidos activos asignados", () => {
    const partidos = [{ fecha: 5, cancha: "Cancha 1", estado: "finalizado" }];

    expect(seleccionarFechaTv(partidos, fechas, 5, false)).toBe(5);
  });

  it("en un torneo finalizado conserva la fecha válida seleccionada", () => {
    expect(seleccionarFechaTv([], fechas, 5, true)).toBe(5);
  });
});
