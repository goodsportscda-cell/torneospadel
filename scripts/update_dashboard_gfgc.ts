import fs from 'fs';
import path from 'path';

const dashboardPath = path.join('src', 'pages', 'TorneoIndividualDashboard.tsx');
let dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

const dashboardHeadersTarget = `<TableHead className="text-center">Sets G - P</TableHead>
                      <TableHead className="text-center">Games Diff</TableHead>
                      <TableHead className="text-right w-[120px]">Puntos Totales</TableHead>`;

const dashboardHeadersNew = `<TableHead className="text-center">Sets G - P</TableHead>
                      <TableHead className="text-center">GF</TableHead>
                      <TableHead className="text-center">GC</TableHead>
                      <TableHead className="text-center">DG</TableHead>
                      <TableHead className="text-right w-[120px]">Puntos Totales</TableHead>`;

if (dashboardContent.includes(dashboardHeadersTarget)) {
  dashboardContent = dashboardContent.replace(dashboardHeadersTarget, dashboardHeadersNew);
  console.log("Success: Dashboard headers updated");
} else {
  console.log("Error: Dashboard headers target not found");
}

const dashboardParejasCellsTarget = `<TableCell className="text-center font-mono text-muted-foreground">
                                {s.setsGanados} - {s.setsPerdidos}
                              </TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                  {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-indigo-600 text-sm">
                                {s.puntos}
                              </TableCell>`;
                              
const dashboardParejasCellsNew = `<TableCell className="text-center font-mono text-muted-foreground">
                                {s.setsGanados} - {s.setsPerdidos}
                              </TableCell>
                              <TableCell className="text-center font-mono">{s.gamesGanados}</TableCell>
                              <TableCell className="text-center font-mono">{s.gamesPerdidos}</TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                  {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-indigo-600 text-sm">
                                {s.puntos}
                              </TableCell>`;

if (dashboardContent.includes(dashboardParejasCellsTarget)) {
  dashboardContent = dashboardContent.replace(dashboardParejasCellsTarget, dashboardParejasCellsNew);
  console.log("Success: Dashboard Parejas cells updated");
} else {
  console.log("Error: Dashboard Parejas cells target not found");
}

const dashboardIndividualCellsTarget = `<TableCell className="text-center font-mono text-muted-foreground">
                                {s.setsGanados} - {s.setsPerdidos}
                              </TableCell>
                              <TableCell className="text-center font-mono font-medium">
                                <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                  {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-bold text-indigo-600 text-sm">
                                {s.puntos}
                              </TableCell>`;

// Replace second match (Individual)
if (dashboardContent.includes(dashboardIndividualCellsTarget)) {
  dashboardContent = dashboardContent.replace(dashboardIndividualCellsTarget, dashboardParejasCellsNew);
  console.log("Success: Dashboard Individual cells updated");
} else {
  console.log("Error: Dashboard Individual cells target not found");
}

fs.writeFileSync(dashboardPath, dashboardContent, 'utf-8');
