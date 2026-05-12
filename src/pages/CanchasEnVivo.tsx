import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, MapPin, SearchX, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Torneo = { id: string; nombre: string };
type Inscripcion = { id: string; jugador1_id: string; jugador2_id: string };
type Jugador = { id: string; nombre: string; apellido: string };

type Partido = {
  id: string;
  origen: "zona" | "llave";
  faseNombre: string;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  estado: string;
  cancha: string | null;
  fecha_hora: string | null;
  ganador_id: string | null;
};

export default function CanchasEnVivo() {
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [torneoId, setTorneoId] = useState<string>("");
  const [cantidadCanchas, setCantidadCanchas] = useState(4);
  
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar torneos
  useEffect(() => {
    supabase
      .from("torneos")
      .select("id, nombre")
      .in("estado", ["en_curso", "inscripciones_cerradas", "proximamente"])
      .order("fecha_inicio", { ascending: false })
      .then(({ data }) => {
        setTorneos(data ?? []);
        if (data && data.length > 0 && !torneoId) setTorneoId(data[0].id);
      });
  }, []);

  // Cargar datos del torneo
  useEffect(() => {
    if (!torneoId) return;
    const cargarDatos = async () => {
      setLoading(true);
      try {
        const [{ data: ins }, { data: jugs }] = await Promise.all([
          supabase.from("inscripciones").select("id, jugador1_id, jugador2_id").eq("torneo_id", torneoId),
          supabase.from("jugadores").select("id, nombre, apellido"),
        ]);
        setInscripciones((ins ?? []) as Inscripcion[]);
        setJugadores((jugs ?? []) as Jugador[]);

        // Traer zonas y llaves para luego traer partidos
        const { data: zs } = await supabase.from("zonas").select("id, nombre").eq("torneo_id", torneoId);
        const { data: lls } = await supabase.from("llaves").select("id, tamanio_cuadro").eq("torneo_id", torneoId);

        let partsArr: Partido[] = [];

        if (zs && zs.length > 0) {
          const zMap = new Map(zs.map(z => [z.id, z.nombre]));
          const { data: pz } = await supabase.from("partidos_zona").select("*").in("zona_id", zs.map(z => z.id));
          if (pz) {
            partsArr = partsArr.concat(pz.map(p => ({
              id: p.id,
              origen: "zona",
              faseNombre: zMap.get(p.zona_id) || "Zona",
              pareja_local_id: p.pareja_local_id,
              pareja_visitante_id: p.pareja_visitante_id,
              estado: p.estado,
              cancha: p.cancha,
              fecha_hora: p.fecha_hora,
              ganador_id: p.ganador_id
            })));
          }
        }

        if (lls && lls.length > 0) {
          const { data: pl } = await supabase.from("partidos_llave").select("*").in("llave_id", lls.map(l => l.id));
          if (pl) {
            partsArr = partsArr.concat(pl.map(p => ({
              id: p.id,
              origen: "llave",
              faseNombre: p.ronda,
              pareja_local_id: p.pareja_local_id,
              pareja_visitante_id: p.pareja_visitante_id,
              estado: p.estado,
              cancha: p.cancha,
              fecha_hora: p.fecha_hora,
              ganador_id: p.ganador_id
            })));
          }
        }

        setPartidos(partsArr);
      } catch (e) {
        console.error("Error al cargar partidos", e);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, [torneoId]);

  const jugadorMap = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);

  const parejaLabel = (inscripcionId: string | null): string => {
    if (!inscripcionId) return "Por definir";
    const ins = inscripciones.find((i) => i.id === inscripcionId);
    if (!ins) return "—";
    const j1 = jugadorMap.get(ins.jugador1_id);
    const j2 = jugadorMap.get(ins.jugador2_id);
    return `${j1?.apellido ?? "?"} / ${j2?.apellido ?? "?"}`;
  };

  // Filtrar partidos que nos importan (programados, en juego, pendientes con cancha)
  const partidosActivos = useMemo(() => {
    return partidos.filter(p => p.estado === "en_juego" || p.estado === "programado" || (p.estado === "pendiente" && p.cancha));
  }, [partidos]);

  const canchas = Array.from({ length: cantidadCanchas }, (_, i) => (i + 1).toString());

  if (loading && !torneoId) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Torre de Control</h1>
          <p className="text-sm text-muted-foreground">Monitor en vivo de canchas</p>
        </div>
        <div className="flex gap-2 items-center">
          <Label className="text-xs">Cant. Canchas:</Label>
          <Input 
            type="number" 
            className="w-16 h-8" 
            value={cantidadCanchas} 
            onChange={e => setCantidadCanchas(Number(e.target.value) || 1)} 
            min={1} 
            max={20} 
          />
          <Select value={torneoId} onValueChange={setTorneoId}>
            <SelectTrigger className="w-[200px] h-8">
              <SelectValue placeholder="Seleccioná un torneo" />
            </SelectTrigger>
            <SelectContent>
              {torneos.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse">Cargando canchas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {canchas.map(numeroCancha => {
            const partidosEnCancha = partidosActivos.filter(p => p.cancha === numeroCancha || p.cancha === `Cancha ${numeroCancha}`);
            const enJuego = partidosEnCancha.find(p => p.estado === "en_juego");
            const proximos = partidosEnCancha.filter(p => p.estado !== "en_juego").sort((a, b) => new Date(a.fecha_hora || 0).getTime() - new Date(b.fecha_hora || 0).getTime());

            return (
              <Card key={numeroCancha} className={`border-t-4 ${enJuego ? 'border-t-destructive' : 'border-t-primary/20'} overflow-hidden flex flex-col h-full shadow-sm`}>
                <CardHeader className="p-3 bg-muted/30 border-b flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    Cancha {numeroCancha}
                  </CardTitle>
                  {enJuego ? (
                    <Badge variant="destructive" className="animate-pulse flex gap-1">
                      <Play className="h-3 w-3" /> En Juego
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Libre
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-0 flex-1 bg-card">
                  {enJuego ? (
                    <div className="p-4 space-y-4 border-b-4 border-b-destructive/10">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">
                        {enJuego.origen === "zona" ? "Zona " : "Llave - "}{enJuego.faseNombre}
                      </div>
                      <div className="space-y-3">
                        <div className="font-semibold text-sm truncate">{parejaLabel(enJuego.pareja_local_id)}</div>
                        <div className="text-xs text-muted-foreground text-center italic">vs</div>
                        <div className="font-semibold text-sm truncate">{parejaLabel(enJuego.pareja_visitante_id)}</div>
                      </div>
                      <Button variant="secondary" className="w-full mt-4 text-xs h-8">
                        Cargar Resultado
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center text-center text-muted-foreground h-32">
                      <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-xs">Cancha disponible</p>
                    </div>
                  )}

                  {proximos.length > 0 && (
                    <div className="p-3 bg-muted/10 border-t">
                      <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Próximos
                      </p>
                      <div className="space-y-2">
                        {proximos.map(p => (
                          <div key={p.id} className="text-xs border p-2 rounded bg-background">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-[10px] text-primary">
                                {p.fecha_hora ? new Date(p.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sin hora'}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                {p.origen === "zona" ? "Zona" : "Llave"}
                              </span>
                            </div>
                            <p className="truncate" title={parejaLabel(p.pareja_local_id)}>{parejaLabel(p.pareja_local_id)}</p>
                            <p className="truncate" title={parejaLabel(p.pareja_visitante_id)}>{parejaLabel(p.pareja_visitante_id)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
