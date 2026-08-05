import fs from 'fs';
import path from 'path';

const dashboardPath = path.join('src', 'pages', 'TorneoIndividualDashboard.tsx');
let dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');

const regex = /<TableCell className="text-center font-mono text-xs">\s*<span className=\{s\.difGames > 0 \? "text-emerald-600" : s\.difGames < 0 \? "text-destructive" : ""\}>\s*\{s\.difGames > 0 \? `\+\$\{s\.difGames\}` : s\.difGames\}\s*<\/span>\s*<\/TableCell>/g;

const replacement = `<TableCell className="text-center font-mono text-xs">{s.gamesGanados}</TableCell>
                            <TableCell className="text-center font-mono text-xs">{s.gamesPerdidos}</TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                                {s.difGames > 0 ? \`+\${s.difGames}\` : s.difGames}
                              </span>
                            </TableCell>`;

const matches = dashboardContent.match(regex);
if (matches) {
  console.log(`Found ${matches.length} occurrences to replace.`);
  dashboardContent = dashboardContent.replace(regex, replacement);
  fs.writeFileSync(dashboardPath, dashboardContent, 'utf-8');
  console.log("Success: Replaced correctly.");
} else {
  console.log("Error: Regex didn't match.");
}
