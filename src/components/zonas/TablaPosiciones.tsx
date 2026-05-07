import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { StatsPareja } from "@/lib/zonas";

type Props = {
  tabla: StatsPareja[];
  parejaLabel: (id: string) => string;
  clasifican: number;
};

export function TablaPosiciones({ tabla, parejaLabel, clasifican }: Props) {
  if (tabla.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin parejas asignadas</p>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Pareja</TableHead>
            <TableHead className="text-center w-10">PJ</TableHead>
            <TableHead className="text-center w-10">PG</TableHead>
            <TableHead className="text-center w-10">PP</TableHead>
            <TableHead className="text-center w-12">Pts</TableHead>
            <TableHead className="text-center w-14">DifS</TableHead>
            <TableHead className="text-center w-14">DifG</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tabla.map((s, idx) => {
            const clasifica = idx < clasifican;
            return (
              <TableRow key={s.inscripcion_id} className={clasifica ? "bg-primary/5" : ""}>
                <TableCell className="font-medium">
                  {clasifica ? (
                    <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center">
                      {idx + 1}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{idx + 1}</span>
                  )}
                </TableCell>
                <TableCell className="truncate max-w-[200px]">{parejaLabel(s.inscripcion_id)}</TableCell>
                <TableCell className="text-center">{s.pj}</TableCell>
                <TableCell className="text-center">{s.pg}</TableCell>
                <TableCell className="text-center">{s.pp}</TableCell>
                <TableCell className="text-center font-semibold">{s.puntos}</TableCell>
                <TableCell className="text-center">
                  {s.difSets > 0 ? `+${s.difSets}` : s.difSets}
                </TableCell>
                <TableCell className="text-center">
                  {s.difGames > 0 ? `+${s.difGames}` : s.difGames}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
