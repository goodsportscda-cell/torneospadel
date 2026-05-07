import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Merge, Search, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jugadores: Jugador[];
  onDone: () => void;
}

type Step = "select" | "confirm";

export default function FusionarDialog({ open, onOpenChange, jugadores, onDone }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");
  const [jugador1, setJugador1] = useState<Jugador | null>(null);
  const [jugador2, setJugador2] = useState<Jugador | null>(null);
  const [mantener, setMantener] = useState<"1" | "2">("1");
  const [loading, setLoading] = useState(false);

  const resetState = () => {
    setStep("select");
    setSearch1("");
    setSearch2("");
    setJugador1(null);
    setJugador2(null);
    setMantener("1");
    setLoading(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const filtrar = (q: string, exclude?: string) => {
    if (q.trim().length < 2) return [];
    const lower = q.toLowerCase();
    return jugadores
      .filter((j) => j.id !== exclude)
      .filter(
        (j) =>
          j.apellido.toLowerCase().includes(lower) ||
          j.nombre.toLowerCase().includes(lower) ||
          (j.dni ?? "").includes(q.trim()),
      )
      .slice(0, 6);
  };

  const sugerencias1 = useMemo(() => filtrar(search1, jugador2?.id), [search1, jugadores, jugador2]);
  const sugerencias2 = useMemo(() => filtrar(search2, jugador1?.id), [search2, jugadores, jugador1]);

  const canContinue = jugador1 && jugador2 && jugador1.id !== jugador2.id;

  const jugadorMantener = mantener === "1" ? jugador1 : jugador2;
  const jugadorEliminar = mantener === "1" ? jugador2 : jugador1;

  const handleFusionar = async () => {
    if (!jugadorMantener || !jugadorEliminar) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fusionar-jugadores`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            mantener_id: jugadorMantener.id,
            eliminar_id: jugadorEliminar.id,
          }),
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Error al fusionar");
      toast.success(
        `Jugadores fusionados. Se conservó a ${jugadorMantener.apellido}, ${jugadorMantener.nombre}.`,
      );
      handleOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const JugadorLabel = ({ j }: { j: Jugador }) => (
    <div>
      <p className="font-medium text-sm">
        {j.apellido}, {j.nombre}
      </p>
      <p className="text-xs text-muted-foreground">
        {j.dni ? `DNI ${j.dni}` : "Sin DNI"} {j.club ? `· ${j.club}` : ""}
      </p>
    </div>
  );

  const SearchField = ({
    label,
    value,
    onChange,
    selected,
    onSelect,
    onClear,
    suggestions,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    selected: Jugador | null;
    onSelect: (j: Jugador) => void;
    onClear: () => void;
    suggestions: Jugador[];
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selected ? (
        <div className="flex items-center gap-2 rounded-md border p-2.5 bg-muted/30">
          <JugadorLabel j={selected} />
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={onClear}>
            Cambiar
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, apellido o DNI..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pl-8"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md divide-y max-h-48 overflow-y-auto">
              {suggestions.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  className="w-full text-left p-2.5 hover:bg-accent transition-colors"
                  onClick={() => {
                    onSelect(j);
                    onChange("");
                  }}
                >
                  <JugadorLabel j={j} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Fusionar jugadores
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Seleccioná los dos jugadores que querés unificar."
              : "Confirmá cuál registro conservar. Todas las inscripciones y puntos del eliminado se transferirán al conservado."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4 py-2">
            <SearchField
              label="Jugador 1"
              value={search1}
              onChange={setSearch1}
              selected={jugador1}
              onSelect={setJugador1}
              onClear={() => setJugador1(null)}
              suggestions={sugerencias1}
            />
            <SearchField
              label="Jugador 2"
              value={search2}
              onChange={setSearch2}
              selected={jugador2}
              onSelect={setJugador2}
              onClear={() => setJugador2(null)}
              suggestions={sugerencias2}
            />
          </div>
        )}

        {step === "confirm" && jugador1 && jugador2 && (
          <div className="space-y-4 py-2">
            <Label>¿Cuál registro querés conservar?</Label>
            <RadioGroup value={mantener} onValueChange={(v) => setMantener(v as "1" | "2")}>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="1" className="mt-0.5" />
                <JugadorLabel j={jugador1} />
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="2" className="mt-0.5" />
                <JugadorLabel j={jugador2} />
              </label>
            </RadioGroup>

            {jugadorMantener && jugadorEliminar && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Resumen de la fusión
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    Se elimina
                  </Badge>
                  <span>
                    {jugadorEliminar.apellido}, {jugadorEliminar.nombre}
                    {jugadorEliminar.dni ? ` (DNI ${jugadorEliminar.dni})` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Inscripciones, ranking y datos se transfieren a{" "}
                    <strong>
                      {jugadorMantener.apellido}, {jugadorMantener.nombre}
                    </strong>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={!canContinue} onClick={() => setStep("confirm")}>
                Continuar
              </Button>
            </>
          )}
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>
                Volver
              </Button>
              <Button variant="destructive" disabled={loading} onClick={handleFusionar}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Fusionar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
