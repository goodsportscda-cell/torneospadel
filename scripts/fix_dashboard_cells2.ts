import fs from 'fs';
import path from 'path';

const dashboardPath = path.join('src', 'pages', 'TorneoIndividualDashboard.tsx');
let dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

const target1 = `<TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {s.setsGanados} - {s.setsPerdidos}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold text-indigo-600 dark:text-indigo-400">
                              {s.puntos} pts
                            </TableCell>`;

const replacement1 = `<TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {s.setsGanados} - {s.setsPerdidos}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">{s.gamesGanados}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{s.gamesPerdidos}</TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold text-indigo-600 dark:text-indigo-400">
                              {s.puntos} pts
                            </TableCell>`;

if (dashboardContent.includes(target1)) {
  const parts = dashboardContent.split(target1);
  dashboardContent = parts.join(replacement1);
  console.log(`Success: Replaced ${parts.length - 1} occurrences in Dashboard.`);
} else {
  console.log("Error: Target not found in Dashboard.");
}

fs.writeFileSync(dashboardPath, dashboardContent, 'utf-8');
