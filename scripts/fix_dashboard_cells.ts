import fs from 'fs';
import path from 'path';

const dashboardPath = path.join('src', 'pages', 'TorneoIndividualDashboard.tsx');
let dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

// The exact string that is currently in the file for the Parejas branch (lines 2865+)
const parejasCellsOld = `<TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {s.setsGanados} - {s.setsPerdidos}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold text-indigo-600 text-sm">
                              {s.puntos}
                            </TableCell>`;

// The exact string that is currently in the file for the Individual branch (lines 2916+)
const individualCellsOld = `<TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {s.setsGanados} - {s.setsPerdidos}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold text-indigo-600 text-sm">
                              {s.puntos}
                            </TableCell>`;

const newCells = `<TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {s.setsGanados} - {s.setsPerdidos}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">{s.gamesGanados}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{s.gamesPerdidos}</TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold text-indigo-600 text-sm">
                              {s.puntos}
                            </TableCell>`;

let count = 0;
// Because both branches have the exact same old cells string in dashboard (I checked), we can replace all occurrences.
// To be safe, we split by the old string and join with the new string.
if (dashboardContent.includes(parejasCellsOld)) {
  const parts = dashboardContent.split(parejasCellsOld);
  count = parts.length - 1;
  dashboardContent = parts.join(newCells);
  console.log(`Success: Replaced ${count} occurrences of the missing cells in dashboard.`);
} else {
  console.log("Error: Could not find the target string in dashboard.");
}

fs.writeFileSync(dashboardPath, dashboardContent, 'utf-8');
