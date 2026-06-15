import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle, Trophy, ArrowLeft, ArrowRight, Send, Clock } from "lucide-react";
import { toast } from "sonner";
import { activeTenant } from "@/lib/tenant";
import JugadorStep, { type JugadorForm, emptyJugador } from "@/components/inscripcion/JugadorStep";
import JugadorCompaneroStep from "@/components/inscripcion/JugadorCompaneroStep";
import type { Database } from "@/integrations/supabase/types";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type Resultado = {
  ok: boolean;
  estado: "pendiente_confirmacion" | "lista_espera";
  torneo: string;
};

export default function InscripcionPublica() {
  const { torneoId } = useParams<{ torneoId: string }>();
  const { user } = useAuth();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [j1, setJ1] = useState<JugadorForm>(emptyJugador());
  const [j2, setJ2] = useState<JugadorForm>(emptyJugador());
  const [disponibilidad, setDisponibilidad] = useState("");
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!torneoId) {
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from("torneos")
        .select("*")
        .eq("id", torneoId)
        .maybeSingle();
      if (error) console.error(error);
      setTorneo(data ?? null);
      
      // Auto-fill user if logged in
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("jugador_id")
          .eq("user_id", user.id)
          .maybeSingle();
          
        if (profile?.jugador_id) {
          const { data: jug } = await supabase
            .from("jugadores")
            .select("*")
            .eq("id", profile.jugador_id)
            .maybeSingle();
            
          if (jug) {
            setJ1({
              dni: jug.dni || "",
              nombre: jug.nombre || "",
              apellido: jug.apellido || "",
              telefono: jug.telefono || "",
              email: jug.email || user.email || "",
              club: jug.club || "",
              categoria_id: jug.categoria_id || "ninguna",
            });
            // Auto skip step 1 since it's pre-filled
            if (jug.dni && jug.nombre && jug.apellido && jug.telefono) {
              setPaso(2);
            }
          }
        }
      }
      
      setLoading(false);
    };
    load();
  }, [torneoId, user]);

  // Título dinámico de la pestaña/preview al compartir
  useEffect(() => {
    const base = `${activeTenant.platformName} - Gestión de Torneos`;
    if (torneo) {
      const fechaTxt = torneo.numero_fecha ? ` - Fecha ${torneo.numero_fecha}` : "";
      document.title = `${torneo.nombre}${fechaTxt} | ${activeTenant.name}`;
    } else {
      document.title = `Inscripción a torneo | ${activeTenant.name}`;
    }
    return () => {
      document.title = base;
    };
  }, [torneo]);

  const validarJugador1 = (j: JugadorForm): boolean => {
    if (!/^\d{7,9}$/.test(j.dni)) {
      toast.error("Jugador 1: DNI inválido (7 a 9 dígitos)");
      return false;
    }
    if (!j.nombre.trim()) return toast.error("Jugador 1: falta el nombre"), false;
    if (!j.apellido.trim()) return toast.error("Jugador 1: falta el apellido"), false;
    if (!j.telefono.trim() || j.telefono.trim().length < 6) {
      toast.error("Jugador 1: teléfono obligatorio (mín. 6 dígitos)");
      return false;
    }
    if (!j.club.trim()) {
      toast.error("Jugador 1: la ciudad es obligatoria");
      return false;
    }
    return true;
  };

  const validarJugador2 = (j: JugadorForm): boolean => {
    if (!j.dni.trim() || !/^\d{7,9}$/.test(j.dni.trim())) {
      toast.error("Compañero: DNI obligatorio (7 a 9 dígitos)");
      return false;
    }
    if (!j.apellido.trim()) return toast.error("Compañero: falta el apellido"), false;
    if (!j.nombre.trim()) return toast.error("Compañero: falta el nombre"), false;
    if (!j.telefono.trim() || j.telefono.trim().length < 6) {
      toast.error("Compañero: teléfono obligatorio (mín. 6 dígitos)");
      return false;
    }
    return true;
  };

  const irPaso2 = () => {
    if (!validarJugador1(j1)) return;
    setPaso(2);
  };

  const irPaso3 = () => {
    if (!validarJugador2(j2)) return;
    if (j1.dni && j2.dni && j1.dni === j2.dni) {
      toast.error("Los dos jugadores deben tener DNI distinto");
      return;
    }
    setPaso(3);
  };

  const irPaso4 = () => {
    if (!disponibilidad.trim() || disponibilidad.trim().length < 3) {
      toast.error("La disponibilidad horaria es obligatoria");
      return;
    }
    setPaso(4);
  };

  const enviar = async () => {
    if (!torneo) return;
    setEnviando(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/inscripcion-publica`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          torneo_id: torneo.id, // Usamos el ID real del torneo cargado
          jugador1: { ...j1, dni: j1.dni.trim(), email: j1.email.trim() || undefined, club: j1.club.trim() || undefined },
          jugador2: {
            ...j2,
            dni: j2.dni.trim() || undefined,
            email: j2.email.trim() || undefined,
            club: j2.club.trim() || undefined,
          },
          disponibilidad_horaria: disponibilidad.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al enviar la inscripción");
        return;
      }
      setResultado(data);
    } catch (err) {
      console.error(err);
      toast.error("No pudimos conectar. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ---------- Renders ----------
  if (loading) {
    return (
      <Wrapper>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando torneo...</p>
        </div>
      </Wrapper>
    );
  }

  if (!torneo) {
    return (
      <Wrapper>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Torneo no encontrado</h2>
            <p className="text-sm text-muted-foreground">
              El link puede estar mal o el torneo fue eliminado.
            </p>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  if (torneo.estado !== "inscripciones_abiertas") {
    return (
      <Wrapper torneo={torneo}>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Inscripciones cerradas</h2>
            <p className="text-sm text-muted-foreground">
              Las inscripciones para este torneo no están abiertas en este momento.
            </p>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  if (resultado) {
    const esListaEspera = resultado.estado === "lista_espera";

    return (
      <Wrapper torneo={torneo}>
        <Card className="overflow-hidden border-t-4 border-t-primary shadow-lg max-w-lg mx-auto">
          <CardContent className="py-10 px-6 text-center space-y-6">
            
            {esListaEspera ? (
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center animate-pulse">
                <Clock className="h-10 w-10 text-amber-500" />
              </div>
            ) : (
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            )}

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {esListaEspera ? "¡En Lista de Espera!" : "¡Inscripción Registrada!"}
              </h2>
              <p className="text-sm text-muted-foreground px-4">
                {esListaEspera 
                  ? "El cupo máximo del torneo ha sido completado. Su pareja ha quedado guardada como suplente."
                  : "Tu pre-inscripción ha sido recibida con éxito y el lugar de la pareja ha sido reservado."
                }
              </p>
            </div>

            {/* Cuadro de Estado Destacado */}
            <div className={`rounded-xl border p-4 text-left space-y-3 ${
              esListaEspera 
                ? "bg-amber-500/5 border-amber-500/20 text-amber-900 dark:text-amber-200"
                : "bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
            }`}>
              <div className="flex items-center gap-2">
                {esListaEspera ? (
                  <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                )}
                <p className="text-sm font-bold uppercase tracking-wider">
                  {esListaEspera ? "Estado: Suplentes / Lista de Espera" : "Estado: Pre-inscriptos (Por Confirmar)"}
                </p>
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {esListaEspera 
                  ? "No es necesario realizar ningún pago en este momento. Si se libera un cupo en el torneo, nos contactaremos con ustedes inmediatamente por WhatsApp para confirmar su ingreso."
                  : "Para confirmar su participación de forma definitiva y asegurar su lugar en el cuadro, deberán realizar el pago de la inscripción. Nos contactaremos con ustedes por WhatsApp para coordinar los detalles."
                }
              </p>
            </div>

            {/* Resumen de Pareja */}
            <div className="bg-muted/40 rounded-xl p-4 text-left border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumen de la Pareja</p>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Jugador 1</p>
                  <p className="text-sm font-semibold truncate">{j1.apellido}, {j1.nombre}</p>
                  <p className="text-xs text-muted-foreground">{j1.telefono}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Compañero/a</p>
                  <p className="text-sm font-semibold truncate">{j2.apellido}, {j2.nombre}</p>
                  <p className="text-xs text-muted-foreground">{j2.telefono}</p>
                </div>
              </div>
            </div>

            {/* No requiere accion */}
            <p className="text-xs text-muted-foreground italic bg-muted/20 py-2 rounded-lg">
              ✨ La inscripción ya está ingresada en el sistema. Su compañero no necesita confirmar ningún dato en la web.
            </p>

            <div className="border-t pt-4 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Torneo</p>
              <p className="text-xs font-medium text-foreground">{resultado.torneo}</p>
            </div>

          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  return (
    <Wrapper torneo={torneo}>
      <PasoIndicador paso={paso} />

      {paso === 1 && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <header>
              <h2 className="text-lg font-semibold">Datos del Jugador 1</h2>
              <p className="text-sm text-muted-foreground">
                Empezá ingresando el DNI. Si ya jugaste antes, traemos tus datos automáticamente.
              </p>
            </header>
            <JugadorStep value={j1} onChange={setJ1} />
            <Button className="w-full" size="lg" onClick={irPaso2}>
              Siguiente <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {paso === 2 && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <header>
              <h2 className="text-lg font-semibold">Datos del compañero/a</h2>
              <p className="text-sm text-muted-foreground">
                Buscalo por DNI o apellido. Si no está registrado, lo cargás en el momento.
              </p>
            </header>
            <JugadorCompaneroStep value={j2} onChange={setJ2} excludeDni={j1.dni} />
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={() => setPaso(1)}>
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
              <Button className="flex-1" size="lg" onClick={irPaso3}>
                Siguiente <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {paso === 3 && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <header>
              <h2 className="text-lg font-semibold">Disponibilidad y notas</h2>
              <p className="text-sm text-muted-foreground">
                Contanos cuándo pueden jugar y cualquier dato extra.
              </p>
            </header>
            <div className="grid gap-1.5">
              <Label htmlFor="disp">Disponibilidad horaria *</Label>
              <Textarea
                id="disp"
                rows={3}
                placeholder="Ej: jueves a la noche, viernes a partir de las 20hs"
                value={disponibilidad}
                onChange={(e) => setDisponibilidad(e.target.value)}
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                ℹ️ Las zonas se juegan <strong>jueves y viernes</strong>. Si la cantidad
                de parejas es menor a 24, podrían jugarse también el <strong>sábado</strong>.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="obs">Observaciones (opcional)</Label>
              <Textarea
                id="obs"
                rows={2}
                placeholder="Cualquier cosa que quieras avisar"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={() => setPaso(2)}>
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
              <Button className="flex-1" size="lg" onClick={irPaso4}>
                Revisar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {paso === 4 && (
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <header>
              <h2 className="text-lg font-semibold">Revisá la inscripción</h2>
            </header>
            <div className="space-y-3 text-sm">
              <ResumenItem label="Torneo" value={torneo.nombre} />
              <ResumenItem
                label="Jugador 1"
                value={`${j1.apellido}, ${j1.nombre} (DNI ${j1.dni})`}
              />
              <ResumenItem label="Tel. Jugador 1" value={j1.telefono} />
              <ResumenItem
                label="Compañero/a"
                value={`${j2.apellido}, ${j2.nombre} (DNI ${j2.dni})`}
              />
              <ResumenItem label="Tel. Compañero" value={j2.telefono} />
              {disponibilidad && (
                <ResumenItem label="Disponibilidad" value={disponibilidad} />
              )}
              {observaciones && (
                <ResumenItem label="Observaciones" value={observaciones} />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={() => setPaso(3)} disabled={enviando}>
                <ArrowLeft className="h-4 w-4" />
                Atrás
              </Button>
              <Button className="flex-1" size="lg" onClick={enviar} disabled={enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Confirmar inscripción
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </Wrapper>
  );
}

function Wrapper({ children, torneo }: { children: React.ReactNode; torneo?: Torneo }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Trophy className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Padel ID</p>
            {torneo && (
              <h1 className="text-base font-semibold truncate flex items-center gap-1.5">
                {torneo.nombre}
              </h1>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">{children}</main>
      <footer className="max-w-2xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground border-t mt-8">
        <p>© {new Date().getFullYear()} Padel ID</p>
        <p className="mt-1">Sistema de Gestión por <span className="font-semibold text-primary">Anita Quiroga</span></p>
      </footer>
    </div>
  );
}

function PasoIndicador({ paso }: { paso: number }) {
  const pasos = ["Jugador 1", "Jugador 2", "Disponibilidad", "Confirmar"];
  return (
    <div className="flex items-center justify-between gap-1 mb-1">
      {pasos.map((label, i) => {
        const n = i + 1;
        const activo = n === paso;
        const completo = n < paso;
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`h-1.5 w-full rounded-full ${
                completo || activo ? "bg-primary" : "bg-muted"
              }`}
            />
            <span
              className={`text-[10px] sm:text-xs ${
                activo ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ResumenItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-words">{value}</span>
    </div>
  );
}
