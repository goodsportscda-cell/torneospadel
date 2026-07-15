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
  if (!m) return { tipo: "manual", label: ref };
  return { tipo: "clasificado", posicion: parseInt(m[1], 10), zona: m[2] };
}

// Actualizamos el tipo RefParsed
export type RefParsed =
  | { tipo: "clasificado"; posicion: number; zona: string }
  | { tipo: "ganador"; numeroPartido: number }
  | { tipo: "bye" }
  | { tipo: "manual"; label: string };

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

// 23 parejas (2 zonas de 4 + 5 zonas de 3 = A-G) → 16 clasificados → octavos directos
// Según manual APA/FAP (cuadro oficial de 23 parejas)
function llave23(): PartidoLlavePlantilla[] {
  return [
    { numero: 49, ronda: "octavos", ref_local: "1°A", ref_visitante: "3°B" },
    { numero: 50, ronda: "octavos", ref_local: "2°F", ref_visitante: "2°G" },
    { numero: 51, ronda: "octavos", ref_local: "1°E", ref_visitante: "2°C" },
    { numero: 52, ronda: "octavos", ref_local: "2°B", ref_visitante: "1°D" },
    { numero: 53, ronda: "octavos", ref_local: "1°C", ref_visitante: "2°A" },
    { numero: 54, ronda: "octavos", ref_local: "2°D", ref_visitante: "1°F" },
    { numero: 55, ronda: "octavos", ref_local: "1°G", ref_visitante: "2°E" },
    { numero: 56, ronda: "octavos", ref_local: "3°A", ref_visitante: "1°B" },

    { numero: 57, ronda: "cuartos", ref_local: "G:49", ref_visitante: "G:50" },
    { numero: 58, ronda: "cuartos", ref_local: "G:51", ref_visitante: "G:52" },
    { numero: 59, ronda: "cuartos", ref_local: "G:53", ref_visitante: "G:54" },
    { numero: 60, ronda: "cuartos", ref_local: "G:55", ref_visitante: "G:56" },

    { numero: 61, ronda: "semifinal", ref_local: "G:57", ref_visitante: "G:58" },
    { numero: 62, ronda: "semifinal", ref_local: "G:59", ref_visitante: "G:60" },

    { numero: 64, ronda: "final", ref_local: "G:61", ref_visitante: "G:62" },
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
// Cuadro de 32 parejas (31 partidos) - Formato estándar 16vos -> Final
// Ideal para cuando hay entre 11 y 16 zonas.
// 32 parejas (Manual Oficial APA - 10 zonas + mejores terceros)
// Según imagen proporcionada: 6 previas + 8 octavos + 4 cuartos + 2 semis + 1 final.
// 32 parejas (Cuadro completo de 16vos de final)
// Manual APA: Cuadro estándar para 11-16 zonas o 32 equipos.
// Se usa numeración 33-64 según el manual oficial.
function llave32(): PartidoLlavePlantilla[] {
  return [
    // Dieciseisavos (16 partidos: 33-48)
    { numero: 33, ronda: "dieciseisavos", ref_local: "1°A", ref_visitante: "2°P" },
    { numero: 34, ronda: "dieciseisavos", ref_local: "2°H", ref_visitante: "1°I" },
    { numero: 35, ronda: "dieciseisavos", ref_local: "1°E", ref_visitante: "2°L" },
    { numero: 36, ronda: "dieciseisavos", ref_local: "2°D", ref_visitante: "1°M" },
    { numero: 37, ronda: "dieciseisavos", ref_local: "1°C", ref_visitante: "2°N" },
    { numero: 38, ronda: "dieciseisavos", ref_local: "2°F", ref_visitante: "1°K" },
    { numero: 39, ronda: "dieciseisavos", ref_local: "1°G", ref_visitante: "2°J" },
    { numero: 40, ronda: "dieciseisavos", ref_local: "2°B", ref_visitante: "1°O" },
    
    { numero: 41, ronda: "dieciseisavos", ref_local: "1°B", ref_visitante: "2°O" },
    { numero: 42, ronda: "dieciseisavos", ref_local: "2°G", ref_visitante: "1°J" },
    { numero: 43, ronda: "dieciseisavos", ref_local: "1°F", ref_visitante: "2°K" },
    { numero: 44, ronda: "dieciseisavos", ref_local: "2°C", ref_visitante: "1°N" },
    { numero: 45, ronda: "dieciseisavos", ref_local: "1°D", ref_visitante: "2°M" },
    { numero: 46, ronda: "dieciseisavos", ref_local: "2°E", ref_visitante: "1°L" },
    { numero: 47, ronda: "dieciseisavos", ref_local: "1°H", ref_visitante: "2°I" },
    { numero: 48, ronda: "dieciseisavos", ref_local: "2°A", ref_visitante: "1°P" },

    // Octavos (49-56)
    { numero: 49, ronda: "octavos", ref_local: "G:33", ref_visitante: "G:34" },
    { numero: 50, ronda: "octavos", ref_local: "G:35", ref_visitante: "G:36" },
    { numero: 51, ronda: "octavos", ref_local: "G:37", ref_visitante: "G:38" },
    { numero: 52, ronda: "octavos", ref_local: "G:39", ref_visitante: "G:40" },
    { numero: 53, ronda: "octavos", ref_local: "G:41", ref_visitante: "G:42" },
    { numero: 54, ronda: "octavos", ref_local: "G:43", ref_visitante: "G:44" },
    { numero: 55, ronda: "octavos", ref_local: "G:45", ref_visitante: "G:46" },
    { numero: 56, ronda: "octavos", ref_local: "G:47", ref_visitante: "G:48" },

    // Cuartos (57-60)
    { numero: 57, ronda: "cuartos", ref_local: "G:49", ref_visitante: "G:50" },
    { numero: 58, ronda: "cuartos", ref_local: "G:51", ref_visitante: "G:52" },
    { numero: 59, ronda: "cuartos", ref_local: "G:53", ref_visitante: "G:54" },
    { numero: 60, ronda: "cuartos", ref_local: "G:55", ref_visitante: "G:56" },

    // Semis (61-62)
    { numero: 61, ronda: "semifinal", ref_local: "G:57", ref_visitante: "G:58" },
    { numero: 62, ronda: "semifinal", ref_local: "G:59", ref_visitante: "G:60" },

    // Final (64)
    { numero: 64, ronda: "final", ref_local: "G:61", ref_visitante: "G:62" },
  ];
}

// 36 parejas (Federación Argentina de Padel)
// 12 zonas de 3 (A-L). Clasifican 1° y 2° de todas = 24 clasificados.
// 8 byes (1°A-1°H pasan a octavos), 16 juegan dieciseisavos (previa).
function llave36(): PartidoLlavePlantilla[] {
  return [
    // Dieciseisavos (Previa)
    { numero: 34, ronda: "dieciseisavos", ref_local: "2°G", ref_visitante: "2°J" },
    { numero: 35, ronda: "dieciseisavos", ref_local: "1°I", ref_visitante: "2°B" },
    { numero: 38, ronda: "dieciseisavos", ref_local: "2°C", ref_visitante: "1°L" },
    { numero: 39, ronda: "dieciseisavos", ref_local: "2°K", ref_visitante: "2°F" },
    { numero: 42, ronda: "dieciseisavos", ref_local: "2°E", ref_visitante: "2°L" },
    { numero: 43, ronda: "dieciseisavos", ref_local: "1°K", ref_visitante: "2°D" },
    { numero: 46, ronda: "dieciseisavos", ref_local: "2°A", ref_visitante: "1°J" },
    { numero: 47, ronda: "dieciseisavos", ref_local: "2°I", ref_visitante: "2°H" },

    // Octavos
    { numero: 49, ronda: "octavos", ref_local: "1°A", ref_visitante: "G:34" },
    { numero: 50, ronda: "octavos", ref_local: "G:35", ref_visitante: "1°H" },
    { numero: 51, ronda: "octavos", ref_local: "1°E", ref_visitante: "G:38" },
    { numero: 52, ronda: "octavos", ref_local: "G:39", ref_visitante: "1°D" },
    { numero: 53, ronda: "octavos", ref_local: "1°C", ref_visitante: "G:42" },
    { numero: 54, ronda: "octavos", ref_local: "G:43", ref_visitante: "1°F" },
    { numero: 55, ronda: "octavos", ref_local: "1°G", ref_visitante: "G:46" },
    { numero: 56, ronda: "octavos", ref_local: "G:47", ref_visitante: "1°B" },

    // Cuartos
    { numero: 57, ronda: "cuartos", ref_local: "G:49", ref_visitante: "G:50" },
    { numero: 58, ronda: "cuartos", ref_local: "G:51", ref_visitante: "G:52" },
    { numero: 59, ronda: "cuartos", ref_local: "G:53", ref_visitante: "G:54" },
    { numero: 60, ronda: "cuartos", ref_local: "G:55", ref_visitante: "G:56" },

    // Semis
    { numero: 61, ronda: "semifinal", ref_local: "G:57", ref_visitante: "G:58" },
    { numero: 62, ronda: "semifinal", ref_local: "G:59", ref_visitante: "G:60" },

    // Final
    { numero: 64, ronda: "final", ref_local: "G:61", ref_visitante: "G:62" },
  ];
}

// 41 parejas (Manual Oficial FAP/APA)
// 13 zonas (A-M). Clasifican 1° y 2° de todas, más 3°A y 3°B.
// 4 cabezas de serie (1°A, 1°B, 1°C, 1°D) pasan directo a octavos.
// Total 27 partidos (12 previas + 8 octavos + 4 cuartos + 2 semis + 1 final).
function llave41(): PartidoLlavePlantilla[] {
  return [
    // Previa (12 partidos)
    { numero: 34, ronda: "previa", ref_local: "2°J", ref_visitante: "2°K" },
    { numero: 35, ronda: "previa", ref_local: "1°I", ref_visitante: "2°C" },
    { numero: 36, ronda: "previa", ref_local: "2°B", ref_visitante: "2°G" },
    { numero: 37, ronda: "previa", ref_local: "1°H", ref_visitante: "1°E" },
    { numero: 38, ronda: "previa", ref_local: "3°B", ref_visitante: "2°F" },
    { numero: 39, ronda: "previa", ref_local: "1°L", ref_visitante: "1°M" },
    { numero: 42, ronda: "previa", ref_local: "2°H", ref_visitante: "2°M" },
    { numero: 43, ronda: "previa", ref_local: "1°K", ref_visitante: "2°E" },
    { numero: 44, ronda: "previa", ref_local: "3°A", ref_visitante: "1°F" },
    { numero: 45, ronda: "previa", ref_local: "1°G", ref_visitante: "2°A" },
    { numero: 46, ronda: "previa", ref_local: "2°D", ref_visitante: "1°J" },
    { numero: 47, ronda: "previa", ref_local: "2°L", ref_visitante: "2°I" },
    // Octavos (basado en números 49-56 del diagrama)
    { numero: 49, ronda: "octavos", ref_local: "1°A", ref_visitante: "G:34" },
    { numero: 50, ronda: "octavos", ref_local: "G:35", ref_visitante: "G:36" },
    { numero: 51, ronda: "octavos", ref_local: "G:37", ref_visitante: "G:38" },
    { numero: 52, ronda: "octavos", ref_local: "G:39", ref_visitante: "1°D" },
    { numero: 53, ronda: "octavos", ref_local: "1°C", ref_visitante: "G:42" },
    { numero: 54, ronda: "octavos", ref_local: "G:43", ref_visitante: "G:44" },
    { numero: 55, ronda: "octavos", ref_local: "G:45", ref_visitante: "G:46" },
    { numero: 56, ronda: "octavos", ref_local: "G:47", ref_visitante: "1°B" },
    // Cuartos (57-60)
    { numero: 57, ronda: "cuartos", ref_local: "G:49", ref_visitante: "G:50" },
    { numero: 58, ronda: "cuartos", ref_local: "G:51", ref_visitante: "G:52" },
    { numero: 59, ronda: "cuartos", ref_local: "G:53", ref_visitante: "G:54" },
    { numero: 60, ronda: "cuartos", ref_local: "G:55", ref_visitante: "G:56" },
    // Semis (61-62)
    { numero: 61, ronda: "semifinal", ref_local: "G:57", ref_visitante: "G:58" },
    { numero: 62, ronda: "semifinal", ref_local: "G:59", ref_visitante: "G:60" },
    // Final (64)
    { numero: 64, ronda: "final", ref_local: "G:61", ref_visitante: "G:62" },
  ];
}

// 42 parejas (Manual Oficial APA pág 156/157)
// 14 zonas (A-N).
// 4 primeros pasan directo a octavos: 1ºA, 1ºD, 1ºC, 1ºB.
// Los demás (24 parejas) juegan 16avos de final.
function llave42(): PartidoLlavePlantilla[] {
  return [
    // 16avos de final (12 partidos)
    { numero: 34, ronda: "dieciseisavos", ref_local: "2°N", ref_visitante: "2°K" },
    { numero: 35, ronda: "dieciseisavos", ref_local: "1°I", ref_visitante: "2°F" },
    { numero: 36, ronda: "dieciseisavos", ref_local: "2°C", ref_visitante: "1°H" },
    { numero: 37, ronda: "dieciseisavos", ref_local: "1°E", ref_visitante: "2°B" },
    { numero: 38, ronda: "dieciseisavos", ref_local: "2°G", ref_visitante: "1°L" },
    { numero: 39, ronda: "dieciseisavos", ref_local: "1°M", ref_visitante: "2°J" },
    { numero: 42, ronda: "dieciseisavos", ref_local: "2°I", ref_visitante: "1°N" },
    { numero: 43, ronda: "dieciseisavos", ref_local: "1°K", ref_visitante: "2°H" },
    { numero: 44, ronda: "dieciseisavos", ref_local: "2°A", ref_visitante: "1°F" },
    { numero: 45, ronda: "dieciseisavos", ref_local: "1°G", ref_visitante: "2°D" },
    { numero: 46, ronda: "dieciseisavos", ref_local: "2°E", ref_visitante: "1°J" },
    { numero: 47, ronda: "dieciseisavos", ref_local: "2°M", ref_visitante: "2°L" },
    // Octavos de final (8 partidos)
    { numero: 49, ronda: "octavos", ref_local: "1°A", ref_visitante: "G:34" },
    { numero: 50, ronda: "octavos", ref_local: "G:35", ref_visitante: "G:36" },
    { numero: 51, ronda: "octavos", ref_local: "G:37", ref_visitante: "G:38" },
    { numero: 52, ronda: "octavos", ref_local: "G:39", ref_visitante: "1°D" },
    { numero: 53, ronda: "octavos", ref_local: "1°C", ref_visitante: "G:42" },
    { numero: 54, ronda: "octavos", ref_local: "G:43", ref_visitante: "G:44" },
    { numero: 55, ronda: "octavos", ref_local: "G:45", ref_visitante: "G:46" },
    { numero: 56, ronda: "octavos", ref_local: "G:47", ref_visitante: "1°B" },
    // Cuartos de final (4 partidos)
    { numero: 57, ronda: "cuartos", ref_local: "G:49", ref_visitante: "G:50" },
    { numero: 58, ronda: "cuartos", ref_local: "G:51", ref_visitante: "G:52" },
    { numero: 59, ronda: "cuartos", ref_local: "G:53", ref_visitante: "G:54" },
    { numero: 60, ronda: "cuartos", ref_local: "G:55", ref_visitante: "G:56" },
    // Semifinales (2 partidos)
    { numero: 61, ronda: "semifinal", ref_local: "G:57", ref_visitante: "G:58" },
    { numero: 62, ronda: "semifinal", ref_local: "G:59", ref_visitante: "G:60" },
    // Final (1 partido)
    { numero: 64, ronda: "final", ref_local: "G:61", ref_visitante: "G:62" },
  ];
}

// 21 parejas (Manual Oficial APA)
// 7 zonas de 3 (A-G) -> Clasifican 1° y 2° de todas, más 3°A y 3°B = 16 clasificados
// Exactamente la misma estructura de zonas que 23 parejas.
function llave21(): PartidoLlavePlantilla[] {
  return [
    // Octavos (49-56)
    { numero: 49, ronda: "octavos", ref_local: "1°A", ref_visitante: "3°B" },
    { numero: 50, ronda: "octavos", ref_local: "2°F", ref_visitante: "2°G" },
    { numero: 51, ronda: "octavos", ref_local: "1°E", ref_visitante: "2°C" },
    { numero: 52, ronda: "octavos", ref_local: "2°B", ref_visitante: "1°D" },
    { numero: 53, ronda: "octavos", ref_local: "1°C", ref_visitante: "2°A" },
    { numero: 54, ronda: "octavos", ref_local: "2°D", ref_visitante: "1°F" },
    { numero: 55, ronda: "octavos", ref_local: "1°G", ref_visitante: "2°E" },
    { numero: 56, ronda: "octavos", ref_local: "3°A", ref_visitante: "1°B" },

    // Cuartos (57-60)
    { numero: 57, ronda: "cuartos", ref_local: "G:49", ref_visitante: "G:50" },
    { numero: 58, ronda: "cuartos", ref_local: "G:51", ref_visitante: "G:52" },
    { numero: 59, ronda: "cuartos", ref_local: "G:53", ref_visitante: "G:54" },
    { numero: 60, ronda: "cuartos", ref_local: "G:55", ref_visitante: "G:56" },

    // Semis (61-62)
    { numero: 61, ronda: "semifinal", ref_local: "G:57", ref_visitante: "G:58" },
    { numero: 62, ronda: "semifinal", ref_local: "G:59", ref_visitante: "G:60" },

    // Final (64)
    { numero: 64, ronda: "final", ref_local: "G:61", ref_visitante: "G:62" },
  ];
}

// 47 parejas (Manual Oficial APA)
// 15 zonas (A-O: A y B de 4, C-O de 3) -> Clasifican 1° y 2° de todas, más 3°A y 3°B.
// Total 32 clasificados (16avos de final directos)
function llave47(): PartidoLlavePlantilla[] {
  return [
    // Dieciseisavos (16 partidos: 33-48)
    { numero: 33, ronda: "dieciseisavos", ref_local: "1°A", ref_visitante: "3°B" },
    { numero: 34, ronda: "dieciseisavos", ref_local: "2°N", ref_visitante: "2°O" },
    { numero: 35, ronda: "dieciseisavos", ref_local: "1°I", ref_visitante: "2°G" },
    { numero: 36, ronda: "dieciseisavos", ref_local: "2°F", ref_visitante: "1°H" },
    { numero: 37, ronda: "dieciseisavos", ref_local: "1°E", ref_visitante: "2°C" },
    { numero: 38, ronda: "dieciseisavos", ref_local: "2°J", ref_visitante: "1°L" },
    { numero: 39, ronda: "dieciseisavos", ref_local: "1°M", ref_visitante: "2°K" },
    { numero: 40, ronda: "dieciseisavos", ref_local: "2°B", ref_visitante: "1°D" },
    { numero: 41, ronda: "dieciseisavos", ref_local: "1°C", ref_visitante: "2°A" },
    { numero: 42, ronda: "dieciseisavos", ref_local: "2°L", ref_visitante: "1°N" },
    { numero: 43, ronda: "dieciseisavos", ref_local: "1°K", ref_visitante: "2°I" },
    { numero: 44, ronda: "dieciseisavos", ref_local: "2°D", ref_visitante: "1°F" },
    { numero: 45, ronda: "dieciseisavos", ref_local: "1°G", ref_visitante: "2°E" },
    { numero: 46, ronda: "dieciseisavos", ref_local: "2°H", ref_visitante: "1°J" },
    { numero: 47, ronda: "dieciseisavos", ref_local: "1°O", ref_visitante: "2°M" },
    { numero: 48, ronda: "dieciseisavos", ref_local: "3°A", ref_visitante: "1°B" },

    // Octavos (49-56)
    { numero: 49, ronda: "octavos", ref_local: "G:33", ref_visitante: "G:34" },
    { numero: 50, ronda: "octavos", ref_local: "G:35", ref_visitante: "G:36" },
    { numero: 51, ronda: "octavos", ref_local: "G:37", ref_visitante: "G:38" },
    { numero: 52, ronda: "octavos", ref_local: "G:39", ref_visitante: "G:40" },
    { numero: 53, ronda: "octavos", ref_local: "G:41", ref_visitante: "G:42" },
    { numero: 54, ronda: "octavos", ref_local: "G:43", ref_visitante: "G:44" },
    { numero: 55, ronda: "octavos", ref_local: "G:45", ref_visitante: "G:46" },
    { numero: 56, ronda: "octavos", ref_local: "G:47", ref_visitante: "G:48" },

    // Cuartos (57-60)
    { numero: 57, ronda: "cuartos", ref_local: "G:49", ref_visitante: "G:50" },
    { numero: 58, ronda: "cuartos", ref_local: "G:51", ref_visitante: "G:52" },
    { numero: 59, ronda: "cuartos", ref_local: "G:53", ref_visitante: "G:54" },
    { numero: 60, ronda: "cuartos", ref_local: "G:55", ref_visitante: "G:56" },

    // Semis (61-62)
    { numero: 61, ronda: "semifinal", ref_local: "G:57", ref_visitante: "G:58" },
    { numero: 62, ronda: "semifinal", ref_local: "G:59", ref_visitante: "G:60" },

    // Final (64)
    { numero: 64, ronda: "final", ref_local: "G:61", ref_visitante: "G:62" },
  ];
}

const PLANTILLAS: Record<number, PartidoLlavePlantilla[]> = {
  6: llave6(),
  8: llave8(),
  12: llave12(),
  14: llave14(),
  16: llave16(),
  18: llave18(),
  21: llave21(),
  23: llave23(),
  24: llave24(),
  25: llave25(),
  26: llave26(),
  28: llave28(),
  30: llave30(),
  32: llave32(),
  36: llave36(),
  41: llave41(),
  42: llave42(),
  47: llave47(),
};

// Devuelve los casos soportados por defecto
export const CASOS_SOPORTADOS = Object.keys(PLANTILLAS).map(Number).sort((a, b) => a - b);

export function generarCuadroGenerico(totalParejas: number): PartidoLlavePlantilla[] {
  const Z = Math.floor(totalParejas / 3);
  const zonesOf4 = totalParejas % 3;
  
  function getZoneName(index: number): string {
    let name = "";
    let i = index;
    while (i >= 0) {
      name = String.fromCharCode(65 + (i % 26)) + name;
      i = Math.floor(i / 26) - 1;
    }
    return name;
  }
  
  const firsts: string[] = [];
  const seconds: string[] = [];
  const thirds: string[] = [];
  
  for(let i=0; i<Z; i++) {
    const zName = getZoneName(i);
    firsts.push(`1°${zName}`);
    seconds.push(`2°${zName}`);
    if (i < zonesOf4) {
      thirds.push(`3°${zName}`);
    }
  }
  
  if (seconds.length > 1) {
    const shift = Math.floor(seconds.length / 2);
    const spliced = seconds.splice(0, shift);
    seconds.push(...spliced);
  }
  if (thirds.length > 1) {
    thirds.unshift(thirds.pop()!);
  }
  
  const seeds = [...firsts, ...seconds, ...thirds];
  const Q = seeds.length;
  
  let N = 2;
  while (N < Q) N *= 2;
  
  let rounds = [1, 2];
  for (let i = 4; i <= N; i *= 2) {
      let nextRounds = [];
      for (let j = 0; j < rounds.length; j++) {
          nextRounds.push(rounds[j]);
          nextRounds.push(i + 1 - rounds[j]);
      }
      rounds = nextRounds;
  }
  
  const partidos: PartidoLlavePlantilla[] = [];
  let numPartido = 1;
  let currentRefs: string[] = [];
  
  const standardRoundNames: RondaLlave[] = ["final", "semifinal", "cuartos", "octavos", "dieciseisavos", "previa"];
  let numRounds = Math.log2(N);
  let currentLevelRoundNameIndex = numRounds - 1;
  
  for (let i = 0; i < N; i += 2) {
    const seedLocal = rounds[i];
    const seedVisi = rounds[i+1];
    
    const localEsBye = seedLocal > Q;
    const visiEsBye = seedVisi > Q;
    
    if (localEsBye && visiEsBye) {
        currentRefs.push("BYE");
    } else if (visiEsBye) {
        currentRefs.push(seeds[seedLocal - 1]);
    } else if (localEsBye) {
        currentRefs.push(seeds[seedVisi - 1]);
    } else {
        const ronda = standardRoundNames[currentLevelRoundNameIndex] || "previa";
        const p: PartidoLlavePlantilla = {
            numero: numPartido++,
            ronda: ronda as RondaLlave,
            ref_local: seeds[seedLocal - 1],
            ref_visitante: seeds[seedVisi - 1]
        };
        partidos.push(p);
        currentRefs.push(`G:${p.numero}`);
    }
  }
  
  const firstRoundMatches = partidos.filter(p => !p.ref_local.startsWith("G:") && !p.ref_visitante.startsWith("G:"));
  for (let i = 0; i < firstRoundMatches.length; i++) {
     const p = firstRoundMatches[i];
     if (p.ref_local !== "BYE" && p.ref_visitante !== "BYE") {
         const localZone = p.ref_local.match(/°([A-Z]+)/)?.[1];
         const visiZone = p.ref_visitante.match(/°([A-Z]+)/)?.[1];
         if (localZone && visiZone && localZone === visiZone) {
             for (let j = 0; j < firstRoundMatches.length; j++) {
                 if (i === j) continue;
                 const p2 = firstRoundMatches[j];
                 if (p2.ref_local !== "BYE" && p2.ref_visitante !== "BYE") {
                     const l2Zone = p2.ref_local.match(/°([A-Z]+)/)?.[1];
                     const v2Zone = p2.ref_visitante.match(/°([A-Z]+)/)?.[1];
                     if (localZone !== v2Zone && l2Zone !== visiZone) {
                         const temp = p.ref_visitante;
                         p.ref_visitante = p2.ref_visitante;
                         p2.ref_visitante = temp;
                         break;
                     }
                 }
             }
         }
     }
  }
  
  let nodesInCurrentRound = N / 2;
  currentLevelRoundNameIndex--;
  
  while (nodesInCurrentRound > 1) {
      const nextRefs: string[] = [];
      const rondaActual = standardRoundNames[currentLevelRoundNameIndex] || "previa";
      
      for (let i = 0; i < nodesInCurrentRound; i += 2) {
          const local = currentRefs[i];
          const visi = currentRefs[i+1];
          
          if (local === "BYE" && visi === "BYE") {
              nextRefs.push("BYE");
          } else if (visi === "BYE") {
              nextRefs.push(local);
          } else if (local === "BYE") {
              nextRefs.push(visi);
          } else {
              const p: PartidoLlavePlantilla = {
                  numero: numPartido++,
                  ronda: rondaActual as RondaLlave,
                  ref_local: local,
                  ref_visitante: visi
              };
              partidos.push(p);
              nextRefs.push(`G:${p.numero}`);
          }
      }
      currentRefs = nextRefs;
      nodesInCurrentRound /= 2;
      currentLevelRoundNameIndex--;
  }
  
  return partidos;
}

// Encuentra la plantilla exacta o genera el cuadro dinámicamente según manual APA
export function obtenerPlantilla(totalParejas: number): {
  cantidad: number;
  partidos: PartidoLlavePlantilla[];
} | null {
  if (totalParejas < 6) return null;
  
  // Buscamos exact match primero (para respetar estructuras especiales)
  if (PLANTILLAS[totalParejas]) {
    return { cantidad: totalParejas, partidos: PLANTILLAS[totalParejas] };
  }
  
  // Generamos el cuadro dinámicamente para cualquier otra cantidad
  return { cantidad: totalParejas, partidos: generarCuadroGenerico(totalParejas) };
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
