import { describe, it, expect } from "vitest";
import { generarFixture, calcularTabla, type PartidoConSets } from "../lib/zonas";

describe("Zonas de 4 - Cascada y Clasificación", () => {
  it("debe generar el fixture correcto para zona de 4", () => {
    const fixture = generarFixture(4);
    expect(fixture).toHaveLength(4);
    expect(fixture[0]).toEqual({ orden: 1, tipo: "directo", posicion_local: 1, posicion_visitante: 4 });
    expect(fixture[1]).toEqual({ orden: 2, tipo: "directo", posicion_local: 2, posicion_visitante: 3 });
    expect(fixture[2]).toEqual({ orden: 3, tipo: "ganadores", posicion_local: null, posicion_visitante: null });
    expect(fixture[3]).toEqual({ orden: 4, tipo: "perdedores", posicion_local: null, posicion_visitante: null });
  });

  it("debe calcular la tabla de posiciones por bracket cuando Ganadores y Perdedores finalizan", () => {
    const parejas = [
      { inscripcion_id: "p1", posicion_siembra: 1 },
      { inscripcion_id: "p2", posicion_siembra: 2 },
      { inscripcion_id: "p3", posicion_siembra: 3 },
      { inscripcion_id: "p4", posicion_siembra: 4 },
    ];

    // M1: p1 le gana a p4
    // M2: p2 le gana a p3
    // Ganadores: p1 vs p2 -> Gana p1 (p1 es 1°, p2 es 2°)
    // Perdedores: p4 vs p3 -> Gana p3 (p3 es 3°, p4 es 4°)
    const partidos: PartidoConSets[] = [
      {
        id: "m1",
        tipo: "directo",
        pareja_local_id: "p1",
        pareja_visitante_id: "p4",
        ganador_id: "p1",
        estado: "finalizado",
        sets: [{ numero_set: 1, games_local: 6, games_visitante: 2 }],
      },
      {
        id: "m2",
        tipo: "directo",
        pareja_local_id: "p2",
        pareja_visitante_id: "p3",
        ganador_id: "p2",
        estado: "finalizado",
        sets: [{ numero_set: 1, games_local: 6, games_visitante: 3 }],
      },
      {
        id: "m3",
        tipo: "ganadores",
        pareja_local_id: "p1",
        pareja_visitante_id: "p2",
        ganador_id: "p1",
        estado: "finalizado",
        sets: [{ numero_set: 1, games_local: 6, games_visitante: 4 }],
      },
      {
        id: "m4",
        tipo: "perdedores",
        pareja_local_id: "p4",
        pareja_visitante_id: "p3",
        ganador_id: "p3",
        estado: "finalizado",
        sets: [{ numero_set: 1, games_local: 4, games_visitante: 6 }],
      },
    ];

    const tabla = calcularTabla(parejas, partidos);
    expect(tabla).toHaveLength(4);
    expect(tabla[0].inscripcion_id).toBe("p1"); // 1° Campeón de Zona
    expect(tabla[1].inscripcion_id).toBe("p2"); // 2° Subcampeón de Zona
    expect(tabla[2].inscripcion_id).toBe("p3"); // 3° Ganador de Perdedores
    expect(tabla[3].inscripcion_id).toBe("p4"); // 4° Eliminado
  });

  it("debe actualizar la clasificación si se corrige el ganador del primer partido", () => {
    const parejas = [
      { inscripcion_id: "p1", posicion_siembra: 1 },
      { inscripcion_id: "p2", posicion_siembra: 2 },
      { inscripcion_id: "p3", posicion_siembra: 3 },
      { inscripcion_id: "p4", posicion_siembra: 4 },
    ];

    // CORRECCIÓN: En M1, gana p4 (p4 vence a p1)
    // Entonces a Ganadores fue p4 (en lugar de p1), y a Perdedores fue p1.
    // Ganadores: p4 vs p2 -> Gana p2 (p2 es 1°, p4 es 2°)
    // Perdedores: p1 vs p3 -> Gana p1 (p1 es 3°, p3 es 4°)
    const partidosCorregidos: PartidoConSets[] = [
      {
        id: "m1",
        tipo: "directo",
        pareja_local_id: "p1",
        pareja_visitante_id: "p4",
        ganador_id: "p4", // <--- Corregido
        estado: "finalizado",
        sets: [{ numero_set: 1, games_local: 2, games_visitante: 6 }],
      },
      {
        id: "m2",
        tipo: "directo",
        pareja_local_id: "p2",
        pareja_visitante_id: "p3",
        ganador_id: "p2",
        estado: "finalizado",
        sets: [{ numero_set: 1, games_local: 6, games_visitante: 3 }],
      },
      {
        id: "m3",
        tipo: "ganadores",
        pareja_local_id: "p4", // <--- Cascada actualizada
        pareja_visitante_id: "p2",
        ganador_id: "p2",
        estado: "finalizado",
        sets: [{ numero_set: 1, games_local: 3, games_visitante: 6 }],
      },
      {
        id: "m4",
        tipo: "perdedores",
        pareja_local_id: "p1", // <--- Cascada actualizada
        pareja_visitante_id: "p3",
        ganador_id: "p1",
        estado: "finalizado",
        sets: [{ numero_set: 1, games_local: 6, games_visitante: 4 }],
      },
    ];

    const tabla = calcularTabla(parejas, partidosCorregidos);
    expect(tabla).toHaveLength(4);
    expect(tabla[0].inscripcion_id).toBe("p2"); // 1° Ganador del partido de ganadores
    expect(tabla[1].inscripcion_id).toBe("p4"); // 2° Perdedor del partido de ganadores
    expect(tabla[2].inscripcion_id).toBe("p1"); // 3° Ganador del partido de perdedores
    expect(tabla[3].inscripcion_id).toBe("p3"); // 4° Perdedor del partido de perdedores
  });
});
