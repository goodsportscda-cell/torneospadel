import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle, Trophy, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/good-padel-logo.png";
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
    const base = "Good Padel - Gestión de Torneos";
    if (torneo) {
      const fechaTxt = torneo.numero_fecha ? ` - Fecha ${torneo.numero_fecha}` : "";
      document.title = `${torneo.nombre}${fechaTxt} | ${base}`;
    } else {
      document.title = `Inscripción a torneo | ${base}`;
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
    if (!j.apellido.trim()) return toast.error("Compañero: falta el apellido"), false;
    if (!j.nombre.trim()) return toast.error("Compañero: falta el nombre"), false;
    if (!j.telefono.trim() || j.telefono.trim().length < 6) {
      toast.error("Compañero: teléfono obligatorio (mín. 6 dígitos)");
      return false;
    }
    if (j.dni && !/^\d{7,9}$/.test(j.dni)) {
      toast.error("Compañero: el DNI debe tener entre 7 y 9 dígitos");
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
    return (
      <Wrapper torneo={torneo}>
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">¡Inscripción recibida!</h2>
            {resultado.estado === "lista_espera" ? (
              <p className="text-sm text-muted-foreground">
                El torneo ya alcanzó el cupo, quedaste en <strong>lista de espera</strong>.
                Te contactamos por WhatsApp para confirmar.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Te vamos a contactar por WhatsApp al teléfono que dejaste para confirmar
                la inscripción y coordinar el pago.
              </p>
            )}

            <div className="rounded-lg border-2 border-warning/60 bg-warning/15 p-4 text-left mt-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-warning-foreground">
                    Inscripción PENDIENTE
                  </p>
                  <p className="text-sm text-warning-foreground/90">
                    Tu compañero debe confirmar sus datos. Por favor, pasanos los datos
                    por WhatsApp para confirmar la inscripción.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              Torneo: <strong>{resultado.torneo}</strong>
            </p>
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
                value={`${j2.apellido}, ${j2.nombre}${j2.dni ? ` (DNI ${j2.dni})` : " (sin DNI)"}`}
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
