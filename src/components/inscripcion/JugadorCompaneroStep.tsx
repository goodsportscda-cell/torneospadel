import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, CheckCircle2, UserPlus, X } from "lucide-react";
import type { JugadorForm } from "./JugadorStep";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Sugerencia {
  id: string;
  dni: string | null;
  nombre: string;
  apellido: string;
}

interface Props {
  value: JugadorForm;
  onChange: (v: JugadorForm) => void;
  excludeDni?: string;
}

export default function JugadorCompaneroStep({ value, onChange, excludeDni }: Props) {
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [modoAlta, setModoAlta] = useState(false);
  const [seleccionado, setSeleccionado] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const cleanQuery = query.replace(/\D/g, "").slice(0, 9);

  // Búsqueda en vivo (solo DNI)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (seleccionado || modoAlta) {
      setSugerencias([]);
      return;
    }
    if (cleanQuery.length < 7) {
      setSugerencias([]);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/buscar-jugador-publico?dni=${encodeURIComponent(cleanQuery)}`,
        );
        const data = await res.json();
        if (data.jugador && (!excludeDni || data.jugador.dni !== excludeDni.trim())) {
          setSugerencias([data.jugador]);
        } else {
          setSugerencias([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setBuscando(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [cleanQuery, seleccionado, modoAlta, excludeDni]);

  const elegir = async (s: Sugerencia) => {
    // Traer datos completos por DNI si los tiene
    if (s.dni) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/buscar-jugador-publico?dni=${encodeURIComponent(s.dni)}`,
        );
        const data = await res.json();
        if (data.jugador) {
          onChange({
            dni: data.jugador.dni ?? "",
            nombre: data.jugador.nombre ?? "",
            apellido: data.jugador.apellido ?? "",
            telefono: data.jugador.telefono ?? "",
            email: data.jugador.email ?? "",
            club: data.jugador.club ?? "",
            encontrado: true,
          });
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      onChange({
        dni: "",
        nombre: s.nombre,
        apellido: s.apellido,
        telefono: "",
        email: "",
        club: "",
        encontrado: true,
      });
    }
    setSeleccionado(true);
    setSugerencias([]);
    setQuery(`${s.apellido}, ${s.nombre}${s.dni ? ` · DNI ${s.dni}` : ""}`);
  };

  const limpiar = () => {
    setSeleccionado(false);
    setModoAlta(false);
    setQuery("");
    onChange({
      dni: "",
      nombre: "",
      apellido: "",
      telefono: "",
      email: "",
      club: "",
      encontrado: false,
    });
  };

  const activarAltaConDni = (dniVal: string) => {
    setModoAlta(true);
    setSeleccionado(false);
    setSugerencias([]);
    onChange({
      dni: dniVal,
      nombre: "",
      apellido: "",
      telefono: "",
      email: "",
      club: "",
      encontrado: false,
    });
  };

  const update = (patch: Partial<JugadorForm>) => onChange({ ...value, ...patch });

  // Vista cuando ya está seleccionado uno existente
  if (seleccionado) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {value.apellido}, {value.nombre}
            </p>
            {value.dni && (
              <p className="text-xs text-muted-foreground">DNI {value.dni}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={limpiar} className="h-7 px-2">
            <X className="h-4 w-4" />
            Cambiar
          </Button>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="tel-c">Teléfono del compañero (WhatsApp) *</Label>
          <Input
            id="tel-c"
            type="tel"
            inputMode="tel"
            placeholder="Ej: 11 5555 5555"
            value={value.telefono}
            onChange={(e) => update({ telefono: e.target.value })}
            autoComplete="tel"
          />
          <p className="text-xs text-muted-foreground">
            Si lo tenés a mano, así lo contactamos para confirmar.
          </p>
        </div>
      </div>
    );
  }

  // Vista alta manual
  if (modoAlta) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Cargar compañero nuevo</p>
          <Button variant="ghost" size="sm" onClick={limpiar} className="h-7 px-2">
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ape-c">Apellido *</Label>
            <Input
              id="ape-c"
              value={value.apellido}
              onChange={(e) => update({ apellido: e.target.value })}
              autoComplete="family-name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nom-c">Nombre *</Label>
            <Input
              id="nom-c"
              value={value.nombre}
              onChange={(e) => update({ nombre: e.target.value })}
              autoComplete="given-name"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="tel-c-new">Teléfono (WhatsApp) *</Label>
          <Input
            id="tel-c-new"
            type="tel"
            inputMode="tel"
            placeholder="Ej: 11 5555 5555"
            value={value.telefono}
            onChange={(e) => update({ telefono: e.target.value })}
            autoComplete="tel"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="dni-c-mandatory">DNI *</Label>
          <Input
            id="dni-c-mandatory"
            value={value.dni}
            disabled
            className="bg-muted text-muted-foreground cursor-not-allowed"
          />
          <p className="text-[10px] text-muted-foreground">
            El DNI proviene de la búsqueda anterior y se bloquea para evitar errores.
          </p>
        </div>
      </div>
    );
  }

  // Vista buscador
  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor="buscar-c">Buscar compañero por DNI *</Label>
        <div className="relative">
          <Input
            id="buscar-c"
            type="tel"
            inputMode="numeric"
            placeholder="Ej: 30123456 (sin puntos)"
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/\D/g, ""))}
            className="pr-9"
            autoComplete="off"
            maxLength={9}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {buscando ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Ingresá los 7 u 8 dígitos del DNI de tu compañero para buscarlo o registrarlo.
        </p>
      </div>

      {sugerencias.length > 0 && (
        <div className="rounded-md border bg-card divide-y">
          {sugerencias.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => elegir(s)}
              className="w-full text-left p-3 hover:bg-accent transition-colors flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {s.apellido}, {s.nombre}
                </p>
                {s.dni && (
                  <p className="text-xs text-muted-foreground">DNI {s.dni}</p>
                )}
              </div>
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            </button>
          ))}
        </div>
      )}

      {cleanQuery.length > 0 && cleanQuery.length < 7 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          El DNI debe tener al menos 7 dígitos para realizar la búsqueda.
        </p>
      )}

      {cleanQuery.length >= 7 && !buscando && sugerencias.length === 0 && (
        <div className="space-y-2 pt-2 border-t border-dashed">
          <p className="text-xs text-muted-foreground">
            DNI no registrado en el sistema. ¿Querés registrar a tu compañero como nuevo jugador?
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => activarAltaConDni(cleanQuery)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Registrar nuevo compañero con DNI {cleanQuery}
          </Button>
        </div>
      )}
    </div>
  );
}
