import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GripVertical } from "lucide-react";

type Pareja = {
  inscripcion_id: string;
  label: string;
};

function ParejaDraggable({ inscripcionId, label }: { inscripcionId: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `disponible-${inscripcionId}`,
    data: { inscripcionId, label },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ ...style, touchAction: "none" }}
      className={`flex items-center gap-2 rounded border bg-card px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing select-none transition-shadow ${
        isDragging ? "opacity-30 shadow-sm" : "shadow-sm hover:shadow-md"
      }`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
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
            <ParejaDraggable key={p.inscripcion_id} inscripcionId={p.inscripcion_id} label={p.label} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
