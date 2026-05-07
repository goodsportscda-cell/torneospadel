import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, CheckCircle2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface JugadorForm {
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  club: string;
  encontrado: boolean;
}

export const emptyJugador = (): JugadorForm => ({
  dni: "",
  nombre: "",
  apellido: "",
  telefono: "",
  email: "",
  club: "",
  encontrado: false,
});

interface Props {
  value: JugadorForm;
  onChange: (v: JugadorForm) => void;
  excludeDni?: string;
}

export default function JugadorStep({ value, onChange, excludeDni }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const dni = value.dni.trim();
    if (!/^\d{7,9}$/.test(dni)) {
      setBuscado(false);
      return;
    }
    if (excludeDni && dni === excludeDni.trim()) return;

    debounceRef.current = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/buscar-jugador-publico?dni=${encodeURIComponent(dni)}`,
        );
        const data = await res.json();
        setBuscado(true);
        if (data.jugador) {
          onChange({
            dni,
            nombre: data.jugador.nombre ?? "",
            apellido: data.jugador.apellido ?? "",
            telefono: data.jugador.telefono ?? "",
            email: data.jugador.email ?? "",
            club: data.jugador.club ?? "",
            encontrado: true,
          });
        } else {
          // No encontrado: mantener lo que escribió pero marcar no encontrado
          onChange({ ...value, dni, encontrado: false });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setBuscando(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.dni]);

  const update = (patch: Partial<JugadorForm>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor="dni">DNI *</Label>
        <div className="relative">
          <Input
            id="dni"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Sin puntos"
            value={value.dni}
            onChange={(e) => update({ dni: e.target.value.replace(/\D/g, "") })}
            maxLength={9}
            className="pr-9"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {buscando ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : value.encontrado ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </div>
        {value.encontrado && (
          <p className="text-xs text-primary">
            ¡Te encontramos! Revisá que los datos sigan vigentes.
          </p>
        )}
        {buscado && !value.encontrado && /^\d{7,9}$/.test(value.dni) && (
          <p className="text-xs text-muted-foreground">
            No encontramos este DNI. Completá tus datos para registrarte.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input
            id="nombre"
            value={value.nombre}
            onChange={(e) => update({ nombre: e.target.value })}
            autoComplete="given-name"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="apellido">Apellido *</Label>
          <Input
            id="apellido"
            value={value.apellido}
            onChange={(e) => update({ apellido: e.target.value })}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="tel">Teléfono (WhatsApp) *</Label>
        <Input
          id="tel"
          type="tel"
          inputMode="tel"
          placeholder="Ej: 11 5555 5555"
          value={value.telefono}
          onChange={(e) => update({ telefono: e.target.value })}
          autoComplete="tel"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="email">Email (opcional)</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          value={value.email}
          onChange={(e) => update({ email: e.target.value })}
          autoComplete="email"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="club">Ciudad *</Label>
        <Input
          id="club"
          value={value.club}
          onChange={(e) => update({ club: e.target.value })}
          placeholder="Ej: La Plata"
        />
      </div>
    </div>
  );
}
