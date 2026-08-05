import fs from 'fs';
import path from 'path';

// --- UPDATE PUBLIC WALL ---
const publicPath = path.join('src', 'pages', 'TorneoIndividualPublico.tsx');
let publicContent = fs.readFileSync(publicPath, 'utf-8');

// 1. Update computedStandings for Individual in Public
const publicStandingsTarget = `    const finalizedMatches = partidos.filter((p) => p.estado === "finalizado");

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

const publicStandingsNew = `    const finalizedMatches = partidos.filter((p) => p.estado === "finalizado");
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

if (publicContent.includes(publicStandingsTarget)) {
  publicContent = publicContent.replace(publicStandingsTarget, publicStandingsNew);
  console.log("Success: applied new absence logic to public wall");
} else {
  console.log("Error: could not find public standings target");
}

// 2. Add GF/GC headers to Public Wall Table
const headersTarget = `<TableHead className="text-center w-[80px]">Sets G-P</TableHead>
                        <TableHead className="text-center w-[80px]">Games Diff</TableHead>
                        <TableHead className="text-right w-[90px]">Puntos</TableHead>`;
const headersNew = `<TableHead className="text-center w-[80px]">Sets G-P</TableHead>
                        <TableHead className="text-center w-[50px]">GF</TableHead>
                        <TableHead className="text-center w-[50px]">GC</TableHead>
                        <TableHead className="text-center w-[80px]">DG</TableHead>
                        <TableHead className="text-right w-[90px]">Puntos</TableHead>`;

if (publicContent.includes(headersTarget)) {
  publicContent = publicContent.replace(headersTarget, headersNew);
  console.log("Success: added GF/GC to headers in public wall");
} else {
  console.log("Error: could not find headers target in public wall");
}

// 3. Add GF/GC cells to Public Wall Table (Parejas branch)
const parejasCellsTarget = `<TableCell className="text-center font-mono text-muted-foreground">
                                {s.setsGanados}-{s.setsPerdidos}
                              </TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                  {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                {s.puntos} pts
                              </TableCell>`;
const parejasCellsNew = `<TableCell className="text-center font-mono text-muted-foreground">
                                {s.setsGanados}-{s.setsPerdidos}
                              </TableCell>
                              <TableCell className="text-center font-mono">{s.gamesGanados}</TableCell>
                              <TableCell className="text-center font-mono">{s.gamesPerdidos}</TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                  {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                {s.puntos} pts
                              </TableCell>`;
if (publicContent.includes(parejasCellsTarget)) {
  publicContent = publicContent.replace(parejasCellsTarget, parejasCellsNew);
  console.log("Success: added GF/GC cells for Parejas branch in public wall");
} else {
  console.log("Error: could not find Parejas cells in public wall");
}

// 4. Add GF/GC cells to Public Wall Table (Individual branch)
const individualCellsTarget = `<TableCell className="text-center font-mono text-muted-foreground">
                                {s.setsGanados}-{s.setsPerdidos}
                              </TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                  {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                                {s.puntos} pts
                              </TableCell>`;
// Replace exactly the second match (first was already replaced)
// Actually we can just do a replace since string replace only replaces the first occurrence!
if (publicContent.includes(individualCellsTarget)) {
  publicContent = publicContent.replace(individualCellsTarget, parejasCellsNew);
  console.log("Success: added GF/GC cells for Individual branch in public wall");
} else {
  console.log("Error: could not find Individual cells in public wall");
}

fs.writeFileSync(publicPath, publicContent, 'utf-8');

// --- UPDATE DASHBOARD ---
const dashboardPath = path.join('src', 'pages', 'TorneoIndividualDashboard.tsx');
let dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

if (dashboardContent.includes(headersTarget)) {
  dashboardContent = dashboardContent.replace(headersTarget, headersNew);
  console.log("Success: added GF/GC to headers in dashboard");
}

if (dashboardContent.includes(parejasCellsTarget)) {
  dashboardContent = dashboardContent.replace(parejasCellsTarget, parejasCellsNew);
  console.log("Success: added GF/GC cells for Parejas branch in dashboard");
}

if (dashboardContent.includes(individualCellsTarget)) {
  dashboardContent = dashboardContent.replace(individualCellsTarget, parejasCellsNew);
  console.log("Success: added GF/GC cells for Individual branch in dashboard");
}

fs.writeFileSync(dashboardPath, dashboardContent, 'utf-8');
