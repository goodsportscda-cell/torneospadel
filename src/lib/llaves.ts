// Cruces de llave según manual APA (Federación Argentina de Pádel)
// Cada caso define los partidos del cuadro: ronda, referencias a clasificados de zona
// (formato "1°A", "2°B", etc.) o a ganador de partido previo (formato "G:N°partido").
//
// Casos implementados: 6, 8, 12, 16, 24, 32 parejas.
// Para cantidades intermedias: usar el caso superior más cercano con BYE.

export type RondaLlave = "previa" | "dieciseisavos" | "octavos" | "cuartos" | "semifinal" | "final";

export type PartidoLlavePlantilla = {
  numero: number; // identificador secuencial dentro del cuadro
  ronda: RondaLlave;
  // Referencia a un clasificado de zona ("1°A", "2°B"...) o ganador de partido ("G:50") o BYE
  ref_local: string;
  ref_visitante: string;
};

// Helper para parsear referencias del tipo "1°A" o "G:50"
export type RefParsed =
  | { tipo: "clasificado"; posicion: number; zona: string } // 1°A => {1, 'A'}
  | { tipo: "ganador"; numeroPartido: number }
  | { tipo: "bye" };

export function parseRef(ref: string): RefParsed {
  if (ref === "BYE") return { tipo: "bye" };
  if (ref.startsWith("G:")) {
    return { tipo: "ganador", numeroPartido: parseInt(ref.slice(2), 10) };
  }
  // formato "1°A" o "1A" o "2°B"
  const m = ref.match(/^(\d+)°?([A-Z]+)$/);
  if (!m) throw new Error(`Referencia inválida: ${ref}`);
  return { tipo: "clasificado", posicion: parseInt(m[1], 10), zona: m[2] };
}

// 6 parejas (2 zonas de 3) → 4 clasificados → semis directas
function llave6(): PartidoLlavePlantilla[] {
  return [
    { numero: 1, ronda: "semifinal", ref_local: "1°A", ref_visitante: "2°B" },
    { numero: 2, ronda: "semifinal", ref_local: "2°A", ref_visitante: "1°B" },
    { numero: 3, ronda: "final", ref_local: "G:1", ref_visitante: "G:2" },
  ];
}

// 8 parejas (2 zonas de 4) → 6 clasificados → ronda previa de 2 + 4 cabezas → semis → final
// Manual APA: 1°A pasa directo. 3°A vs 2°B (#1). 1°B pasa directo. 2°A vs 3°B (#2).
// Semis: 1°A vs G:1 (#3), 1°B vs G:2 (#4). Final: G:3 vs G:4 (#5).
function llave8(): PartidoLlavePlantilla[] {
  return [
    { numero: 1, ronda: "previa", ref_local: "3°A", ref_visitante: "2°B" },
    { numero: 2, ronda: "previa", ref_local: "2°A", ref_visitante: "3°B" },
    { numero: 3, ronda: "semifinal", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 4, ronda: "semifinal", ref_local: "G:2", ref_visitante: "1°B" },
    { numero: 5, ronda: "final", ref_local: "G:3", ref_visitante: "G:4" },
  ];
}

// 12 parejas (4 zonas de 3) → 8 clasificados → cuartos directos
// Manual APA: 1°A vs 2°B, 2°C vs 1°D, 1°C vs 2°D, 2°A vs 1°B
function llave12(): PartidoLlavePlantilla[] {
  return [
    { numero: 1, ronda: "cuartos", ref_local: "1°A", ref_visitante: "2°B" },
    { numero: 2, ronda: "cuartos", ref_local: "2°C", ref_visitante: "1°D" },
    { numero: 3, ronda: "cuartos", ref_local: "1°C", ref_visitante: "2°D" },
    { numero: 4, ronda: "cuartos", ref_local: "2°A", ref_visitante: "1°B" },
    { numero: 5, ronda: "semifinal", ref_local: "G:1", ref_visitante: "G:2" },
    { numero: 6, ronda: "semifinal", ref_local: "G:3", ref_visitante: "G:4" },
    { numero: 7, ronda: "final", ref_local: "G:5", ref_visitante: "G:6" },
  ];
}

// 14 parejas (2 zonas de 4 + 2 zonas de 3 = A,B de 4, C,D de 3) → 10 clasificados
// Manual APA pág 130: 1°A y 1°B pasan a cuartos.
// Previa: 3°A vs 2°B (#1), 2°A vs 3°B (#2)
// Cuartos: 1°A vs G:1 (#3), 2°C vs 1°D (#4), 1°C vs 2°D (#5), G:2 vs 1°B (#6)
function llave14(): PartidoLlavePlantilla[] {
  return [
    { numero: 1, ronda: "previa", ref_local: "3°A", ref_visitante: "2°B" },
    { numero: 2, ronda: "previa", ref_local: "2°A", ref_visitante: "3°B" },
    { numero: 3, ronda: "cuartos", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 4, ronda: "cuartos", ref_local: "2°C", ref_visitante: "1°D" },
    { numero: 5, ronda: "cuartos", ref_local: "1°C", ref_visitante: "2°D" },
    { numero: 6, ronda: "cuartos", ref_local: "G:2", ref_visitante: "1°B" },
    { numero: 7, ronda: "semifinal", ref_local: "G:3", ref_visitante: "G:4" },
    { numero: 8, ronda: "semifinal", ref_local: "G:5", ref_visitante: "G:6" },
    { numero: 9, ronda: "final", ref_local: "G:7", ref_visitante: "G:8" },
  ];
}

// 16 parejas (5 o 6 zonas) → distintas configuraciones según APA.
// Caso típico APA pág 132: 5 zonas (3 de 3 + 2 de 4) → ~10 clasificados → ronda previa + octavos
// Por simplicidad implemento el cuadro con 8 cabezas: cuartos directos con cruce APA.
// Nota: este caso varía mucho según distribución exacta. Implementación base con 8 clasificados.
function llave16(): PartidoLlavePlantilla[] {
  // Asumimos 5 zonas (configuración 4+4+3+3+3 = 16 parejas) → 11 clasificados aprox.
  // Simplificado: tomamos los 8 mejores (1° de cada zona + 3 mejores 2°)
  // Ronda previa: 2°B vs 2°C (#1), 3°A vs 2°E (#2), 2°D vs 2°A (#3)
  // Cuartos: 1°A vs G:1, 1°E vs 1°D, 1°C vs G:2, G:3 vs 1°B
  return [
    { numero: 1, ronda: "previa", ref_local: "2°B", ref_visitante: "2°C" },
    { numero: 2, ronda: "previa", ref_local: "3°A", ref_visitante: "2°E" },
    { numero: 3, ronda: "previa", ref_local: "2°D", ref_visitante: "2°A" },
    { numero: 4, ronda: "cuartos", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 5, ronda: "cuartos", ref_local: "1°E", ref_visitante: "1°D" },
    { numero: 6, ronda: "cuartos", ref_local: "1°C", ref_visitante: "G:2" },
    { numero: 7, ronda: "cuartos", ref_local: "G:3", ref_visitante: "1°B" },
    { numero: 8, ronda: "semifinal", ref_local: "G:4", ref_visitante: "G:5" },
    { numero: 9, ronda: "semifinal", ref_local: "G:6", ref_visitante: "G:7" },
    { numero: 10, ronda: "final", ref_local: "G:8", ref_visitante: "G:9" },
  ];
}

// 18 parejas (6 zonas de 3) → 12 clasificados → ronda previa + cuartos
// Manual APA: 4 cabezas de serie (1°A, 1°B, 1°C, 1°D) pasan directo a cuartos.
// Las otras 8 (1°E, 1°F y los 6 segundos) juegan ronda previa de 4 partidos.
// Cruces (siembra cruzada APA): los mejores enfrentan a los peores.
function llave18(): PartidoLlavePlantilla[] {
  return [
    // Ronda previa (4 partidos) - 8 equipos por 4 lugares en cuartos
    { numero: 1, ronda: "previa", ref_local: "2°C", ref_visitante: "2°F" },
    { numero: 2, ronda: "previa", ref_local: "1°E", ref_visitante: "2°B" },
    { numero: 3, ronda: "previa", ref_local: "2°A", ref_visitante: "1°F" },
    { numero: 4, ronda: "previa", ref_local: "2°E", ref_visitante: "2°D" },
    // Cuartos (4 partidos) - 4 cabezas + 4 ganadores de previa
    { numero: 5, ronda: "cuartos", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 6, ronda: "cuartos", ref_local: "1°D", ref_visitante: "G:2" },
    { numero: 7, ronda: "cuartos", ref_local: "1°C", ref_visitante: "G:3" },
    { numero: 8, ronda: "cuartos", ref_local: "1°B", ref_visitante: "G:4" },
    // Semifinales
    { numero: 9, ronda: "semifinal", ref_local: "G:5", ref_visitante: "G:6" },
    { numero: 10, ronda: "semifinal", ref_local: "G:7", ref_visitante: "G:8" },
    // Final
    { numero: 11, ronda: "final", ref_local: "G:9", ref_visitante: "G:10" },
  ];
}

// 24 parejas (8 zonas de 3) → 16 clasificados → octavos
// Manual APA pág 140: 1°A vs 2°B, 2°G vs 1°H, 1°E vs 2°F, 2°C vs 1°D,
// 1°C vs 2°D, 2°E vs 1°F, 1°G vs 2°H, 2°A vs 1°B
function llave24(): PartidoLlavePlantilla[] {
  return [
    { numero: 1, ronda: "octavos", ref_local: "1°A", ref_visitante: "2°B" },
    { numero: 2, ronda: "octavos", ref_local: "2°G", ref_visitante: "1°H" },
    { numero: 3, ronda: "octavos", ref_local: "1°E", ref_visitante: "2°F" },
    { numero: 4, ronda: "octavos", ref_local: "2°C", ref_visitante: "1°D" },
    { numero: 5, ronda: "octavos", ref_local: "1°C", ref_visitante: "2°D" },
    { numero: 6, ronda: "octavos", ref_local: "2°E", ref_visitante: "1°F" },
    { numero: 7, ronda: "octavos", ref_local: "1°G", ref_visitante: "2°H" },
    { numero: 8, ronda: "octavos", ref_local: "2°A", ref_visitante: "1°B" },
    { numero: 9, ronda: "cuartos", ref_local: "G:1", ref_visitante: "G:2" },
    { numero: 10, ronda: "cuartos", ref_local: "G:3", ref_visitante: "G:4" },
    { numero: 11, ronda: "cuartos", ref_local: "G:5", ref_visitante: "G:6" },
    { numero: 12, ronda: "cuartos", ref_local: "G:7", ref_visitante: "G:8" },
    { numero: 13, ronda: "semifinal", ref_local: "G:9", ref_visitante: "G:10" },
    { numero: 14, ronda: "semifinal", ref_local: "G:11", ref_visitante: "G:12" },
    { numero: 15, ronda: "final", ref_local: "G:13", ref_visitante: "G:14" },
  ];
}

// 25 parejas (1 zona de 4 + 7 zonas de 3 = A-H) → 16 clasificados → ronda previa de 1 + octavos
// Manual APA pág 141. Cuadro oficial FAP.
// Previa: 3°A vs 2°B → ganador enfrenta a 1°A en octavos.
function llave25(): PartidoLlavePlantilla[] {
  return [
    // Ronda previa (1 partido)
    { numero: 1, ronda: "previa", ref_local: "3°A", ref_visitante: "2°B" },
    // Octavos
    { numero: 2, ronda: "octavos", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 3, ronda: "octavos", ref_local: "2°G", ref_visitante: "1°H" },
    { numero: 4, ronda: "octavos", ref_local: "1°E", ref_visitante: "2°F" },
    { numero: 5, ronda: "octavos", ref_local: "2°C", ref_visitante: "1°D" },
    { numero: 6, ronda: "octavos", ref_local: "1°C", ref_visitante: "2°D" },
    { numero: 7, ronda: "octavos", ref_local: "2°E", ref_visitante: "1°F" },
    { numero: 8, ronda: "octavos", ref_local: "1°G", ref_visitante: "2°H" },
    { numero: 9, ronda: "octavos", ref_local: "2°A", ref_visitante: "1°B" },
    // Cuartos
    { numero: 10, ronda: "cuartos", ref_local: "G:2", ref_visitante: "G:3" },
    { numero: 11, ronda: "cuartos", ref_local: "G:4", ref_visitante: "G:5" },
    { numero: 12, ronda: "cuartos", ref_local: "G:6", ref_visitante: "G:7" },
    { numero: 13, ronda: "cuartos", ref_local: "G:8", ref_visitante: "G:9" },
    // Semis
    { numero: 14, ronda: "semifinal", ref_local: "G:10", ref_visitante: "G:11" },
    { numero: 15, ronda: "semifinal", ref_local: "G:12", ref_visitante: "G:13" },
    // Final
    { numero: 16, ronda: "final", ref_local: "G:14", ref_visitante: "G:15" },
  ];
}

// 26 parejas (2 zonas de 4 + 6 zonas de 3 = A-H) → 17 clasificados → ronda previa de 2 + octavos
// Manual APA pág 142. Cuadro oficial FAP.
// Previa: 3°A vs 2°B (G→1°A), 2°A vs 3°B (G→1°B).
function llave26(): PartidoLlavePlantilla[] {
  return [
    // Ronda previa (2 partidos)
    { numero: 1, ronda: "previa", ref_local: "3°A", ref_visitante: "2°B" },
    { numero: 2, ronda: "previa", ref_local: "2°A", ref_visitante: "3°B" },
    // Octavos
    { numero: 3, ronda: "octavos", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 4, ronda: "octavos", ref_local: "2°G", ref_visitante: "1°H" },
    { numero: 5, ronda: "octavos", ref_local: "1°E", ref_visitante: "2°F" },
    { numero: 6, ronda: "octavos", ref_local: "2°C", ref_visitante: "1°D" },
    { numero: 7, ronda: "octavos", ref_local: "1°C", ref_visitante: "2°D" },
    { numero: 8, ronda: "octavos", ref_local: "2°E", ref_visitante: "1°F" },
    { numero: 9, ronda: "octavos", ref_local: "1°G", ref_visitante: "2°H" },
    { numero: 10, ronda: "octavos", ref_local: "G:2", ref_visitante: "1°B" },
    // Cuartos
    { numero: 11, ronda: "cuartos", ref_local: "G:3", ref_visitante: "G:4" },
    { numero: 12, ronda: "cuartos", ref_local: "G:5", ref_visitante: "G:6" },
    { numero: 13, ronda: "cuartos", ref_local: "G:7", ref_visitante: "G:8" },
    { numero: 14, ronda: "cuartos", ref_local: "G:9", ref_visitante: "G:10" },
    // Semis
    { numero: 15, ronda: "semifinal", ref_local: "G:11", ref_visitante: "G:12" },
    { numero: 16, ronda: "semifinal", ref_local: "G:13", ref_visitante: "G:14" },
    // Final
    { numero: 17, ronda: "final", ref_local: "G:15", ref_visitante: "G:16" },
  ];
}

// 28 parejas (1 zona de 4 + 8 zonas de 3 = A-I) → ronda previa + octavos
// Manual APA pág 144. Reconstrucción del cuadro oficial.
// Clasificados: 1°A, 2°A, 3°A (zona A de 4), y 1°/2° de zonas B-I.
function llave28(): PartidoLlavePlantilla[] {
  return [
    // Ronda previa
    { numero: 1, ronda: "previa", ref_local: "2°B", ref_visitante: "2°C" },
    { numero: 2, ronda: "previa", ref_local: "3°A", ref_visitante: "2°E" },
    { numero: 3, ronda: "previa", ref_local: "2°D", ref_visitante: "2°A" },
    // Octavos
    { numero: 4, ronda: "octavos", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 5, ronda: "octavos", ref_local: "1°I", ref_visitante: "1°H" },
    { numero: 6, ronda: "octavos", ref_local: "1°E", ref_visitante: "2°G" },
    { numero: 7, ronda: "octavos", ref_local: "2°F", ref_visitante: "1°D" },
    { numero: 8, ronda: "octavos", ref_local: "1°C", ref_visitante: "G:2" },
    { numero: 9, ronda: "octavos", ref_local: "2°H", ref_visitante: "1°F" },
    { numero: 10, ronda: "octavos", ref_local: "1°G", ref_visitante: "2°I" },
    { numero: 11, ronda: "octavos", ref_local: "G:3", ref_visitante: "1°B" },
    // Cuartos
    { numero: 12, ronda: "cuartos", ref_local: "G:4", ref_visitante: "G:5" },
    { numero: 13, ronda: "cuartos", ref_local: "G:6", ref_visitante: "G:7" },
    { numero: 14, ronda: "cuartos", ref_local: "G:8", ref_visitante: "G:9" },
    { numero: 15, ronda: "cuartos", ref_local: "G:10", ref_visitante: "G:11" },
    // Semis
    { numero: 16, ronda: "semifinal", ref_local: "G:12", ref_visitante: "G:13" },
    { numero: 17, ronda: "semifinal", ref_local: "G:14", ref_visitante: "G:15" },
    // Final
    { numero: 18, ronda: "final", ref_local: "G:16", ref_visitante: "G:17" },
  ];
}

// 30 parejas (10 zonas de 3 → 20 clasificados directos + 10 terceros, se toman 4) →
// Cuadro APA oficial: ronda previa de 4 partidos + octavos con 8 cabezas que pasan directo.
// Cruces según cuadro oficial FAP/APA de 30 parejas.
function llave30(): PartidoLlavePlantilla[] {
  return [
    // Ronda previa (4 partidos)
    { numero: 1, ronda: "previa", ref_local: "2°C", ref_visitante: "2°F" },
    { numero: 2, ronda: "previa", ref_local: "2°G", ref_visitante: "2°B" },
    { numero: 3, ronda: "previa", ref_local: "2°A", ref_visitante: "2°H" },
    { numero: 4, ronda: "previa", ref_local: "2°E", ref_visitante: "2°D" },
    // Octavos
    { numero: 5, ronda: "octavos", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 6, ronda: "octavos", ref_local: "1°I", ref_visitante: "1°H" },
    { numero: 7, ronda: "octavos", ref_local: "1°E", ref_visitante: "2°J" },
    { numero: 8, ronda: "octavos", ref_local: "G:2", ref_visitante: "1°D" },
    { numero: 9, ronda: "octavos", ref_local: "1°C", ref_visitante: "G:3" },
    { numero: 10, ronda: "octavos", ref_local: "2°I", ref_visitante: "1°F" },
    { numero: 11, ronda: "octavos", ref_local: "1°G", ref_visitante: "1°J" },
    { numero: 12, ronda: "octavos", ref_local: "G:4", ref_visitante: "1°B" },
    // Cuartos
    { numero: 13, ronda: "cuartos", ref_local: "G:5", ref_visitante: "G:6" },
    { numero: 14, ronda: "cuartos", ref_local: "G:7", ref_visitante: "G:8" },
    { numero: 15, ronda: "cuartos", ref_local: "G:9", ref_visitante: "G:10" },
    { numero: 16, ronda: "cuartos", ref_local: "G:11", ref_visitante: "G:12" },
    // Semis
    { numero: 17, ronda: "semifinal", ref_local: "G:13", ref_visitante: "G:14" },
    { numero: 18, ronda: "semifinal", ref_local: "G:15", ref_visitante: "G:16" },
    // Final
    { numero: 19, ronda: "final", ref_local: "G:17", ref_visitante: "G:18" },
  ];
}

// 32 parejas (~10 zonas) → ronda previa + octavos
// Manual APA pág 148. Implementación basada en el cuadro mostrado.
function llave32(): PartidoLlavePlantilla[] {
  return [
    { numero: 1, ronda: "previa", ref_local: "2°C", ref_visitante: "2°F" },
    { numero: 2, ronda: "previa", ref_local: "3°B", ref_visitante: "2°J" },
    { numero: 3, ronda: "previa", ref_local: "2°G", ref_visitante: "2°B" },
    { numero: 4, ronda: "previa", ref_local: "2°A", ref_visitante: "2°H" },
    { numero: 5, ronda: "previa", ref_local: "2°I", ref_visitante: "3°A" },
    { numero: 6, ronda: "previa", ref_local: "2°E", ref_visitante: "2°D" },
    { numero: 7, ronda: "octavos", ref_local: "1°A", ref_visitante: "G:1" },
    { numero: 8, ronda: "octavos", ref_local: "1°I", ref_visitante: "1°H" },
    { numero: 9, ronda: "octavos", ref_local: "1°E", ref_visitante: "G:2" },
    { numero: 10, ronda: "octavos", ref_local: "G:3", ref_visitante: "1°D" },
    { numero: 11, ronda: "octavos", ref_local: "1°C", ref_visitante: "G:4" },
    { numero: 12, ronda: "octavos", ref_local: "G:5", ref_visitante: "1°F" },
    { numero: 13, ronda: "octavos", ref_local: "1°G", ref_visitante: "1°J" },
    { numero: 14, ronda: "octavos", ref_local: "G:6", ref_visitante: "1°B" },
    { numero: 15, ronda: "cuartos", ref_local: "G:7", ref_visitante: "G:8" },
    { numero: 16, ronda: "cuartos", ref_local: "G:9", ref_visitante: "G:10" },
    { numero: 17, ronda: "cuartos", ref_local: "G:11", ref_visitante: "G:12" },
    { numero: 18, ronda: "cuartos", ref_local: "G:13", ref_visitante: "G:14" },
    { numero: 19, ronda: "semifinal", ref_local: "G:15", ref_visitante: "G:16" },
    { numero: 20, ronda: "semifinal", ref_local: "G:17", ref_visitante: "G:18" },
    { numero: 21, ronda: "final", ref_local: "G:19", ref_visitante: "G:20" },
  ];
}

const PLANTILLAS: Record<number, PartidoLlavePlantilla[]> = {
  6: llave6(),
  8: llave8(),
  12: llave12(),
  14: llave14(),
  16: llave16(),
  18: llave18(),
  24: llave24(),
  25: llave25(),
  26: llave26(),
  28: llave28(),
  30: llave30(),
  32: llave32(),
};

// Devuelve los casos soportados
export const CASOS_SOPORTADOS = Object.keys(PLANTILLAS).map(Number).sort((a, b) => a - b);

// Encuentra la plantilla más cercana hacia abajo (si hay 13 parejas, usa 12; si hay 18, usa 16)
export function obtenerPlantilla(totalParejas: number): {
  cantidad: number;
  partidos: PartidoLlavePlantilla[];
} | null {
  // Buscamos exact match primero
  if (PLANTILLAS[totalParejas]) {
    return { cantidad: totalParejas, partidos: PLANTILLAS[totalParejas] };
  }
  // Buscamos la mayor cantidad ≤ totalParejas
  const candidatos = CASOS_SOPORTADOS.filter((n) => n <= totalParejas);
  if (candidatos.length === 0) return null;
  const cantidad = Math.max(...candidatos);
  return { cantidad, partidos: PLANTILLAS[cantidad] };
}

// Resuelve referencia a inscripcion_id real, dado el ranking de clasificados por zona
// y el mapa de ganadores de partidos previos.
// rankingPorZona["A"] = [inscId del 1°, inscId del 2°, inscId del 3°]
export function resolverRef(
  ref: string,
  rankingPorZona: Record<string, string[]>,
  ganadoresPorPartido: Record<number, string | null>,
): string | null {
  const parsed = parseRef(ref);
  if (parsed.tipo === "bye") return null;
  if (parsed.tipo === "clasificado") {
    const zona = rankingPorZona[parsed.zona];
    if (!zona) return null;
    return zona[parsed.posicion - 1] ?? null;
  }
  // ganador
  return ganadoresPorPartido[parsed.numeroPartido] ?? null;
}

export const NOMBRE_RONDA: Record<RondaLlave, string> = {
  previa: "Ronda previa",
  dieciseisavos: "16vos de final",
  octavos: "Octavos de final",
  cuartos: "Cuartos de final",
  semifinal: "Semifinales",
  final: "Final",
};

export const ORDEN_RONDA: Record<RondaLlave, number> = {
  previa: 0,
  dieciseisavos: 1,
  octavos: 2,
  cuartos: 3,
  semifinal: 4,
  final: 5,
};
