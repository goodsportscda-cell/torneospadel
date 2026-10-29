import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { COMPLEX_COURT_IDS } from "@/lib/activeCourts";

type CanchasAsignadasFieldProps = {
  value: number[];
  onChange: (value: number[]) => void;
  cantidad?: number;
  label?: string;
  helperText?: string;
};

export function CanchasAsignadasField({
  value,
  onChange,
  cantidad = COMPLEX_COURT_IDS.length,
  label = "Canchas activas para el torneo *",
  helperText = "Solo estas canchas se cargarán y mostrarán en la Torre de Control y en el Modo Pantalla TV.",
}: CanchasAsignadasFieldProps) {
  const canchas = Array.from({ length: cantidad }, (_, index) => index + 1);
  const sortedSelected = [...value].sort((a, b) => a - b);

  const toggleCancha = (cancha: number, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...value, cancha])).sort((a, b) => a - b)
      : value.filter((item) => item !== cancha);
    onChange(next);
  };

  const applyPreset = (preset: number[]) => {
    onChange([...preset].sort((a, b) => a - b));
  };

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="font-semibold">{label}</Label>
          <Badge variant="secondary" className="text-[11px] font-mono">
            {sortedSelected.length} de {cantidad} activa{sortedSelected.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => applyPreset([1, 2, 3])}
          >
            Canchas 1-3
          </Button>
          {cantidad >= 6 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => applyPreset([4, 5, 6])}
            >
              Canchas 4-6
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => applyPreset(canchas)}
          >
            Todas (1-{cantidad})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {canchas.map((cancha) => {
          const checked = value.includes(cancha);
          return (
            <label
              key={cancha}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                checked
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-input bg-background/60 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(nextChecked) => toggleCancha(cancha, Boolean(nextChecked))}
              />
              <span>Cancha {cancha}</span>
            </label>
          );
        })}
      </div>
      {helperText && (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
