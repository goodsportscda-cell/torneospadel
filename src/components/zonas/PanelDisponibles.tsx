import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Pareja = {
  inscripcion_id: string;
  label: string;
  disponibilidad?: string | null;
};

function ParejaStatic({ label, disponibilidad }: { label: string; disponibilidad?: string | null }) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded border bg-card px-2.5 py-1.5 text-sm shadow-sm select-none min-w-0"
    >
      <span className="font-medium truncate">{label}</span>
      {disponibilidad && (
        <span className="text-[10px] text-muted-foreground truncate" title={disponibilidad}>
          Disp: {disponibilidad}
        </span>
      )}
    </div>
  );
}

export function PanelDisponibles({ parejas, parejaDisponibilidad }: { parejas: Pareja[]; parejaDisponibilidad?: (id: string) => string | null }) {
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
            <ParejaStatic 
              key={p.inscripcion_id} 
              label={p.label} 
              disponibilidad={p.disponibilidad || (parejaDisponibilidad ? parejaDisponibilidad(p.inscripcion_id) : null)} 
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
