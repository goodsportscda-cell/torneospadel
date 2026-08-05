import fs from 'fs';
import path from 'path';

const filePath = path.join('src', 'pages', 'TorneoIndividualDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// The block to replace is in `handleGenerarFechaRegular`
const targetBlock = `      } else {
        // Individual logic
        const sortedIds = standings.map((s) => s.jugador_id);
        for (let c = 1; c <= courtsCount; c++) {
          const offset = (c - 1) * 4;
          const courtPlayers = sortedIds.slice(offset, offset + 4);
          const matchPayload = {
            torneo_id: id,
            fecha: fechaNum,
            cancha: \`Cancha \${c}: \${c === 1 ? "Élite" : c === 2 ? "Desafío" : "Base"}\`,
            jugador1_id: courtPlayers[0],
            jugador2_id: courtPlayers[3],
            jugador3_id: courtPlayers[1],
            jugador4_id: courtPlayers[2],
            estado: "pendiente" as const,
          };
          matchPromises.push(supabase.from("partidos_individuales").insert(matchPayload));
        }
      }`;

const newBlock = `      } else {
        // Individual logic - Ascensos y Descensos directos
        const prevMatches = partidos.filter((p) => p.fecha === fechaNum - 1);
        
        // Helper para obtener ganadores/perdedores de una cancha (1-indexed)
        const getCourtResult = (cNum: number) => {
          const m = prevMatches.find((p) => p.cancha.includes(\`Cancha \${cNum}\`));
          if (!m) return null;
          const p1Won = m.sets_pareja1 > m.sets_pareja2;
          if (p1Won) {
            return {
              winner: [m.jugador1_id, m.jugador2_id],
              loser: [m.jugador3_id, m.jugador4_id],
            };
          } else {
            return {
              winner: [m.jugador3_id, m.jugador4_id],
              loser: [m.jugador1_id, m.jugador2_id],
            };
          }
        };

        // Standings map for sorting within court
        const standingsMap = new Map(standings.map((s) => [s.jugador_id, s]));

        for (let c = 1; c <= courtsCount; c++) {
          let courtPlayerIds: string[] = [];

          if (c === 1) {
            // Cancha 1: Ganadores C1 + Ganadores C2
            const res1 = getCourtResult(1);
            const res2 = getCourtResult(2);
            if (res1) courtPlayerIds.push(...res1.winner);
            if (res2) courtPlayerIds.push(...res2.winner);
          } else if (c === courtsCount) {
            // Cancha Última: Perdedores C_prev + Perdedores C_current
            const resPrev = getCourtResult(c - 1);
            const resCurr = getCourtResult(c);
            if (resPrev) courtPlayerIds.push(...resPrev.loser);
            if (resCurr) courtPlayerIds.push(...resCurr.loser);
          } else {
            // Canchas Intermedias: Perdedores C_prev + Ganadores C_next
            const resPrev = getCourtResult(c - 1);
            const resNext = getCourtResult(c + 1);
            if (resPrev) courtPlayerIds.push(...resPrev.loser);
            if (resNext) courtPlayerIds.push(...resNext.winner);
          }

          // Fallback: If for some reason we don't have exactly 4 players (e.g. missing prev match), 
          // we fallback to general standings for this specific court
          if (courtPlayerIds.length !== 4) {
            const sortedIds = standings.map((s) => s.jugador_id);
            const offset = (c - 1) * 4;
            courtPlayerIds = sortedIds.slice(offset, offset + 4);
          } else {
            // Sort the 4 players by their overall standings
            courtPlayerIds.sort((a, b) => {
              const standA = standingsMap.get(a);
              const standB = standingsMap.get(b);
              if (!standA || !standB) return 0;
              if (standB.puntos !== standA.puntos) return standB.puntos - standA.puntos;
              if (standB.difSets !== standA.difSets) return (standB.difSets || 0) - (standA.difSets || 0);
              return standB.difGames - standA.difGames;
            });
          }

          const matchPayload = {
            torneo_id: id,
            fecha: fechaNum,
            cancha: \`Cancha \${c}: \${c === 1 ? "Élite" : c === 2 ? "Desafío" : "Base"}\`,
            jugador1_id: courtPlayerIds[0],
            jugador2_id: courtPlayerIds[3],
            jugador3_id: courtPlayerIds[1],
            jugador4_id: courtPlayerIds[2],
            estado: "pendiente" as const,
          };
          matchPromises.push(supabase.from("partidos_individuales").insert(matchPayload));
        }
      }`;

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, newBlock);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("Success: Replaced Individual logic block.");
} else {
  console.log("Error: Could not find target block.");
}
