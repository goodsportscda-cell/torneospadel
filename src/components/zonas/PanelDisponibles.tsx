import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Pareja = {
  inscripcion_id: string;
  label: string;
};

function ParejaStatic({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded border bg-card px-2 py-1.5 text-sm shadow-sm select-none"
    >
      <span className="flex-1 truncate">{label}</span>
    </div>
  );
}

export function PanelDisponibles({ parejas }: { parejas: Pareja[] }) {
  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Parejas disponibles</CardTitle>
        <p className="text-xs text-muted-foreground">{parejas.length} sin asignar</p>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
        {parejas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todas las parejas están asignadas a una zona.</p>
        ) : (
          parejas.map((p) => (
            <ParejaStatic key={p.inscripcion_id} label={p.label} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
