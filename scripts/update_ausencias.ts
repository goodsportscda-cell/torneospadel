import fs from 'fs';
import path from 'path';

const filePath = path.join('src', 'pages', 'TorneoIndividualDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');

// 1. Remove the "pendiente" restriction for Action Buttons (Cargar Resultado)
// Find the exact block in the file
const buttonsTarget = `{selectedFecha?.estado === "pendiente" && (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => handleOpenScoreDialog(p)}>
                            {hasWinner ? "Modificar Resultado" : "Cargar Resultado"}
                          </Button>
                        )}`;

const buttonsNew = `                        <Button size="sm" variant="outline" className="w-full" onClick={() => handleOpenScoreDialog(p)}>
                          {hasWinner ? "Modificar Resultado" : "Cargar Resultado"}
                        </Button>`;

if (content.includes(buttonsTarget)) {
  content = content.replace(buttonsTarget, buttonsNew);
  console.log("Success: applied edit button unblock for Match Card");
} else {
  console.log("Error: edit button unblock not found");
}

// 2. Modify `computedStandings` for Individual mode logic
// Around line 560
const logicTarget = `    const finalizedMatches = partidos.filter((p) => p.estado === "finalizado");

    finalizedMatches.forEach((p) => {
      const canchaNumMatch = p.cancha.match(/\\d+/);
      const courtIndex = canchaNumMatch ? parseInt(canchaNumMatch[0], 10) : 1;

      const ptsWinner = countCanchas - courtIndex + 2;
      const ptsLoser = 1;

      let gamesP1 = 0;
      let gamesP2 = 0;
      p.sets?.forEach((s) => {
        gamesP1 += s.games_pareja1;
        gamesP2 += s.games_pareja2;
      });

      const p1Won = p.sets_pareja1 > p.sets_pareja2;

      const awardStats = (
        jugId: string | null,
        isWinner: boolean,
        wasAbsent: boolean,
        gamesOwn: number,
        gamesOpp: number,
        setsOwn: number,
        setsOpp: number
      ) => {
        if (!jugId) return;
        const s = standingsMap.get(jugId);
        if (!s) return;

        s.partidosJugados++;
        if (wasAbsent) {
          s.puntos += 0;
        } else {
          s.puntos += isWinner ? ptsWinner : ptsLoser;
          s.setsGanados += setsOwn;
          s.setsPerdidos += setsOpp;
          s.gamesGanados += gamesOwn;
          s.gamesPerdidos += gamesOpp;
        }
      };

      awardStats(p.jugador1_id, p1Won, !!p.suplente1_nombre, gamesP1, gamesP2, p.sets_pareja1, p.sets_pareja2);
      awardStats(p.jugador2_id, p1Won, !!p.suplente2_nombre, gamesP1, gamesP2, p.sets_pareja1, p.sets_pareja2);
      awardStats(p.jugador3_id, !p1Won, !!p.suplente3_nombre, gamesP2, gamesP1, p.sets_pareja2, p.sets_pareja1);
      awardStats(p.jugador4_id, !p1Won, !!p.suplente4_nombre, gamesP2, gamesP1, p.sets_pareja2, p.sets_pareja1);
    });`;

const logicNew = `    const finalizedMatches = partidos.filter((p) => p.estado === "finalizado");
    // Ordenar por fecha para procesar cronológicamente las ausencias
    finalizedMatches.sort((a, b) => (a.fecha || 0) - (b.fecha || 0));

    // Contador de ausencias por jugador
    const absenceCountMap = new Map<string, number>();

    finalizedMatches.forEach((p) => {
      const canchaNumMatch = p.cancha.match(/\\d+/);
      const courtIndex = canchaNumMatch ? parseInt(canchaNumMatch[0], 10) : 1;

      const ptsWinner = countCanchas - courtIndex + 2;
      const ptsLoser = 1;

      let gamesP1 = 0;
      let gamesP2 = 0;
      p.sets?.forEach((s) => {
        gamesP1 += s.games_pareja1;
        gamesP2 += s.games_pareja2;
      });

      const p1Won = p.sets_pareja1 > p.sets_pareja2;

      const awardStats = (
        jugId: string | null,
        isWinner: boolean,
        wasAbsent: boolean,
        gamesOwn: number,
        gamesOpp: number,
        setsOwn: number,
        setsOpp: number
      ) => {
        if (!jugId) return;
        const s = standingsMap.get(jugId);
        if (!s) return;

        s.partidosJugados++;
        
        if (wasAbsent) {
          // Contabilizar ausencia
          const prevAbsences = absenceCountMap.get(jugId) || 0;
          const newAbsences = prevAbsences + 1;
          absenceCountMap.set(jugId, newAbsences);

          if (newAbsences > 2) {
            // Ausencia 3+: 0 puntos y pierde 6-0 6-0 (-12 games, 0 sets)
            s.puntos += 0;
            s.setsGanados += 0;
            s.setsPerdidos += 2;
            s.gamesGanados += 0;
            s.gamesPerdidos += 12;
          } else {
            // Ausencia 1 o 2: se lleva los puntos y games del suplente (resultado real)
            s.puntos += isWinner ? ptsWinner : ptsLoser;
            s.setsGanados += setsOwn;
            s.setsPerdidos += setsOpp;
            s.gamesGanados += gamesOwn;
            s.gamesPerdidos += gamesOpp;
          }
        } else {
          // Asistió normalmente
          s.puntos += isWinner ? ptsWinner : ptsLoser;
          s.setsGanados += setsOwn;
          s.setsPerdidos += setsOpp;
          s.gamesGanados += gamesOwn;
          s.gamesPerdidos += gamesOpp;
        }
      };

      awardStats(p.jugador1_id, p1Won, !!p.suplente1_nombre, gamesP1, gamesP2, p.sets_pareja1, p.sets_pareja2);
      awardStats(p.jugador2_id, p1Won, !!p.suplente2_nombre, gamesP1, gamesP2, p.sets_pareja1, p.sets_pareja2);
      awardStats(p.jugador3_id, !p1Won, !!p.suplente3_nombre, gamesP2, gamesP1, p.sets_pareja2, p.sets_pareja1);
      awardStats(p.jugador4_id, !p1Won, !!p.suplente4_nombre, gamesP2, gamesP1, p.sets_pareja2, p.sets_pareja1);
    });`;

if (content.includes(logicTarget)) {
  content = content.replace(logicTarget, logicNew);
  console.log("Success: applied absence logic");
} else {
  console.log("Error: absence logic target not found");
}

fs.writeFileSync(filePath, content, 'utf-8');
