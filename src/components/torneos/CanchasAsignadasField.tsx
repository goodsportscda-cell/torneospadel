import { Label } from "@/components/ui/label";

type Props = {
  value: number[];
  onChange: (value: number[]) => void;
  cantidad?: number;
};

export function CanchasAsignadasField({ value, onChange, cantidad = 3 }: Props) {
  const canchas = Array.from({ length: Math.max(1, cantidad) }, (_, index) => index + 1);

  const toggle = (cancha: number) => {
    const next = value.includes(cancha)
      ? value.filter((id) => id !== cancha)
      : [...value, cancha].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <fieldset className="grid gap-2 rounded-md border p-3">
      <Label>Canchas que puede usar este torneo *</Label>
      <div className="flex flex-wrap gap-4">
        {canchas.map((cancha) => (
          <label key={cancha} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(cancha)}
              onChange={() => toggle(cancha)}
              className="h-4 w-4 accent-primary"
            />
            Cancha {cancha}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        El asignador reservará solo estas canchas y respetará las reservas de los demás torneos.
      </p>
    </fieldset>
  );
}
