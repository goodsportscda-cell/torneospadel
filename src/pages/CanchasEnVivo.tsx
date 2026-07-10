import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, MapPin, CheckCircle2, Share2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { activeTenant } from "@/lib/tenant";

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
  
  // Modales
  const [asignarCanchaNum, setAsignarCanchaNum] = useState<string | null>(null);
  const [partidoCargar, setPartidoCargar] = useState<Partido | null>(null);
  
  const [sets, setSets] = useState<{ local: string; visitante: string }[]>([
    { local: "", visitante: "" }, { local: "", visitante: "" }, { local: "", visitante: "" }
  ]);
  const [ganadorSeleccionado, setGanadorSeleccionado] = useState<string | null>(null);
  
  const [descargando, setDescargando] = useState(false);
  const flyerRef = useRef<HTMLDivElement>(null);

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

  const cargarDatos = async () => {
    if (!torneoId) return;
    setLoading(true);
    try {
      const torneoIds = torneoId === "todos" ? torneos.map(t => t.id) : [torneoId];
      if (torneoIds.length === 0) {
        setPartidos([]);
        setLoading(false);
        return;
      }

      const [{ data: ins }, { data: jugs }] = await Promise.all([
        supabase.from("inscripciones").select("id, jugador1_id, jugador2_id").in("torneo_id", torneoIds).eq("estado", "confirmada"),
        supabase.from("jugadores").select("id, nombre, apellido"),
      ]);
      setInscripciones((ins ?? []) as Inscripcion[]);
      setJugadores((jugs ?? []) as Jugador[]);

      const { data: zs } = await supabase.from("zonas").select("id, nombre, torneo_id").in("torneo_id", torneoIds);
      const { data: lls } = await supabase.from("llaves").select("id, tamanio_cuadro, torneo_id").in("torneo_id", torneoIds);

      const tMap = new Map(torneos.map(t => [t.id, t.nombre]));
      let partsArr: Partido[] = [];

      if (zs && zs.length > 0) {
        const zMap = new Map(zs.map(z => [z.id, { nombre: z.nombre, torneo_id: z.torneo_id }]));
        const { data: pz } = await supabase.from("partidos_zona").select("*").in("zona_id", zs.map(z => z.id));
        if (pz) {
          partsArr = partsArr.concat(pz.map(p => {
            const zInfo = zMap.get(p.zona_id);
            const tNombre = zInfo ? tMap.get(zInfo.torneo_id) : "";
            const prefix = torneoId === "todos" && tNombre ? `${tNombre.split(' ')[0]} - ` : "";
            return {
              id: p.id,
              origen: "zona",
              faseNombre: `${prefix}${zInfo?.nombre || "Zona"}`,
              pareja_local_id: p.pareja_local_id,
              pareja_visitante_id: p.pareja_visitante_id,
              estado: p.estado,
              cancha: p.cancha,
              fecha_hora: p.fecha_hora,
              ganador_id: p.ganador_id
            };
          }));
        }
      }

      if (lls && lls.length > 0) {
        const llMap = new Map(lls.map(l => [l.id, l.torneo_id]));
        const { data: pl } = await supabase.from("partidos_llave").select("*").in("llave_id", lls.map(l => l.id));
        if (pl) {
          partsArr = partsArr.concat(pl.map(p => {
            const tId = llMap.get(p.llave_id);
            const tNombre = tId ? tMap.get(tId) : "";
            const prefix = torneoId === "todos" && tNombre ? `${tNombre.split(' ')[0]} - ` : "";
            return {
              id: p.id,
              origen: "llave",
              faseNombre: `${prefix}${p.ronda}`,
              pareja_local_id: p.pareja_local_id,
              pareja_visitante_id: p.pareja_visitante_id,
              estado: p.estado,
              cancha: p.cancha,
              fecha_hora: p.fecha_hora,
              ganador_id: p.ganador_id
            };
          }));
        }
      }

      setPartidos(partsArr);
    } catch (e) {
      console.error("Error al cargar", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [torneoId, torneos]);

  const jugadorMap = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);

  const parejaLabel = (inscripcionId: string | null): string => {
    if (!inscripcionId) return "Por definir";
    const ins = inscripciones.find((i) => i.id === inscripcionId);
    if (!ins) return "—";
    const j1 = jugadorMap.get(ins.jugador1_id);
    const j2 = jugadorMap.get(ins.jugador2_id);
    return `${j1?.apellido ?? "?"} / ${j2?.apellido ?? "?"}`;
  };

  const partidosActivos = useMemo(() => {
    return partidos.filter(p => p.estado === "en_juego" || p.estado === "programado" || (p.estado === "pendiente" && p.cancha));
  }, [partidos]);

  const partidosLibres = useMemo(() => {
    // Partidos que tienen rivales definidos, no están finalizados y no están en juego
    return partidos.filter(p => p.estado !== "finalizado" && p.estado !== "en_juego" && p.pareja_local_id && p.pareja_visitante_id);
  }, [partidos]);

  const canchas = Array.from({ length: cantidadCanchas }, (_, i) => (i + 1).toString());

  const handleAsignarCancha = async (partidoId: string, cancha: string) => {
    const p = partidos.find(x => x.id === partidoId);
    if (!p) return;
    
    const tabla = p.origen === "zona" ? "partidos_zona" : "partidos_llave";
    const toastId = toast.loading("Asignando...");
    const { error } = await supabase.from(tabla).update({ cancha: cancha, estado: "en_juego" }).eq("id", p.id);
    if (error) {
      toast.error("Error al asignar", { id: toastId });
    } else {
      toast.success("Partido en juego", { id: toastId });
      setAsignarCanchaNum(null);
      cargarDatos();
    }
  };

  const abrirCargarResultado = (p: Partido) => {
    setPartidoCargar(p);
    setSets([{ local: "", visitante: "" }, { local: "", visitante: "" }, { local: "", visitante: "" }]);
    setGanadorSeleccionado(null);
  };

  const tieneSetCargado = useMemo(() => {
    return sets.some(s => s.local !== "" && s.visitante !== "");
  }, [sets]);

  const guardarResultadoParcial = async () => {
    if (!partidoCargar) return;
    const toastId = toast.loading("Guardando resultado parcial...");
    
    try {
      const tabla = partidoCargar.origen === "zona" ? "partidos_zona" : "partidos_llave";
      
      await supabase.from("sets_partido").delete().eq(partidoCargar.origen === "zona" ? "partido_id" : "partido_llave_id", partidoCargar.id);
      
      const inserts = sets
        .map((s, i) => ({
          numero_set: i + 1,
          games_local: parseInt(s.local),
          games_visitante: parseInt(s.visitante),
          partido_id: partidoCargar.origen === "zona" ? partidoCargar.id : null,
          partido_llave_id: partidoCargar.origen === "llave" ? partidoCargar.id : null,
        }))
        .filter(s => !isNaN(s.games_local) && !isNaN(s.games_visitante));

      if (inserts.length > 0) {
        await supabase.from("sets_partido").insert(inserts as never);
      }

      await supabase.from(tabla).update({
        estado: "en_juego",
        ganador_id: null
      }).eq("id", partidoCargar.id);

      toast.success("Resultado parcial guardado", { id: toastId });
      setPartidoCargar(null);
      cargarDatos();
    } catch (e) {
      toast.error("Ocurrió un error", { id: toastId });
    }
  };

  const guardarResultado = async () => {
    if (!partidoCargar || !ganadorSeleccionado) return;
    const toastId = toast.loading("Guardando...");
    
    try {
      const tabla = partidoCargar.origen === "zona" ? "partidos_zona" : "partidos_llave";
      
      const inserts = sets
        .map((s, i) => ({
          numero_set: i + 1,
          games_local: parseInt(s.local),
          games_visitante: parseInt(s.visitante),
          partido_id: partidoCargar.origen === "zona" ? partidoCargar.id : null,
          partido_llave_id: partidoCargar.origen === "llave" ? partidoCargar.id : null,
        }))
        .filter(s => !isNaN(s.games_local) && !isNaN(s.games_visitante));

      if (inserts.length === 0) {
        toast.error("Debe ingresar los resultados de los sets para marcar un ganador.", { id: toastId });
        return;
      }

      await supabase.from("sets_partido").delete().eq(partidoCargar.origen === "zona" ? "partido_id" : "partido_llave_id", partidoCargar.id);

      if (inserts.length > 0) {
        await supabase.from("sets_partido").insert(inserts as never);
      }

      await supabase.from(tabla).update({
        estado: "finalizado",
        ganador_id: ganadorSeleccionado
      }).eq("id", partidoCargar.id);

      toast.success("Resultado guardado", { id: toastId });
      setPartidoCargar(null);
      cargarDatos();
    } catch (e) {
      toast.error("Ocurrió un error", { id: toastId });
    }
  };

  const liberarCancha = async (p: Partido) => {
    const tabla = p.origen === "zona" ? "partidos_zona" : "partidos_llave";
    await supabase.from(tabla).update({ cancha: null, estado: "programado" }).eq("id", p.id);
    cargarDatos();
  };

  const descargarImagen = async () => {
    if (!flyerRef.current) return;
    setDescargando(true);
    try {
      const canvas = await html2canvas(flyerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0f172a", // Dark bg
      });
      const link = document.createElement("a");
      link.download = `Canchas-En-Vivo.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Flyer descargado");
    } catch (error) {
      toast.error("Error al generar flyer");
    } finally {
      setDescargando(false);
    }
  };

  if (loading && !torneoId) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Torre de Control</h1>
          <p className="text-sm text-muted-foreground">Monitor en vivo de canchas</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="outline" size="sm" onClick={descargarImagen} disabled={descargando} className="gap-2">
            {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Flyer IG
          </Button>
          <div className="flex items-center gap-2 border px-3 py-1 rounded-md">
            <Label className="text-xs">Canchas:</Label>
            <Input 
              type="number" 
              className="w-14 h-7 text-xs" 
              value={cantidadCanchas} 
              onChange={e => setCantidadCanchas(Number(e.target.value) || 1)} 
              min={1} max={20} 
            />
          </div>
          <Select value={torneoId} onValueChange={setTorneoId}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Seleccioná un torneo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los torneos</SelectItem>
              {torneos.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {canchas.map(numeroCancha => {
            const partidosEnCancha = partidosActivos.filter(p => p.cancha === numeroCancha || p.cancha === `Cancha ${numeroCancha}`);
            const enJuego = partidosEnCancha.find(p => p.estado === "en_juego");
            const proximos = partidosEnCancha.filter(p => p.estado !== "en_juego").sort((a, b) => new Date(a.fecha_hora || 0).getTime() - new Date(b.fecha_hora || 0).getTime());

            return (
              <Card key={numeroCancha} className={`border-t-4 ${enJuego ? 'border-t-destructive shadow-md shadow-destructive/10' : 'border-t-primary/20'} overflow-hidden flex flex-col h-full`}>
                <CardHeader className="p-3 bg-muted/30 border-b flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    Cancha {numeroCancha}
                  </CardTitle>
                  {enJuego ? (
                    <Badge variant="destructive" className="animate-pulse flex gap-1">
                      <Play className="h-3 w-3 fill-current" /> En Juego
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Libre</Badge>
                  )}
                </CardHeader>
                
                <CardContent className="p-0 flex-1 bg-card flex flex-col">
                  {enJuego ? (
                    <div className="p-4 space-y-4 border-b-4 border-b-destructive/10 flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider bg-muted px-2 py-0.5 rounded">
                          {enJuego.faseNombre}
                        </div>
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1 text-muted-foreground" onClick={() => liberarCancha(enJuego)}>
                          Liberar
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <div className="font-semibold text-sm truncate p-2 bg-muted/30 rounded border border-border/50">
                          {parejaLabel(enJuego.pareja_local_id)}
                        </div>
                        <div className="text-[10px] text-muted-foreground text-center italic font-bold uppercase tracking-widest">Versus</div>
                        <div className="font-semibold text-sm truncate p-2 bg-muted/30 rounded border border-border/50">
                          {parejaLabel(enJuego.pareja_visitante_id)}
                        </div>
                      </div>
                      <Button onClick={() => abrirCargarResultado(enJuego)} className="w-full mt-4 text-xs h-9 bg-primary/90 hover:bg-primary font-bold">
                        Cargar Resultado Final
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center text-center text-muted-foreground h-40 flex-1">
                      <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-xs mb-3">Cancha disponible para jugar</p>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setAsignarCanchaNum(numeroCancha)}>
                        <Plus className="h-3 w-3" /> Asignar Partido
                      </Button>
                    </div>
                  )}

                  {proximos.length > 0 && (
                    <div className="p-3 bg-muted/10 border-t">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1 tracking-wider">
                        <Clock className="h-3 w-3" /> En espera ({proximos.length})
                      </p>
                      <div className="space-y-2">
                        {proximos.map(p => (
                          <div key={p.id} className="text-xs border p-2 rounded bg-background shadow-sm space-y-1.5">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-[10px] text-primary bg-primary/10 px-1.5 rounded">
                                {p.fecha_hora ? new Date(p.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sin hora'}
                              </span>
                              <span className="text-[9px] text-muted-foreground uppercase font-bold">
                                {p.faseNombre}
                              </span>
                            </div>
                            <p className="truncate text-muted-foreground">{parejaLabel(p.pareja_local_id)}</p>
                            <p className="truncate text-muted-foreground">{parejaLabel(p.pareja_visitante_id)}</p>
                            <div className="flex justify-end pt-1 border-t border-muted/50">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 text-primary border-primary/20 hover:bg-primary/5"
                                onClick={() => handleAsignarCancha(p.id, numeroCancha)}
                              >
                                <Play className="h-2.5 w-2.5 mr-1 fill-current" /> Iniciar
                              </Button>
                            </div>
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

      {/* Modal Asignar Cancha */}
      <Dialog open={!!asignarCanchaNum} onOpenChange={(o) => !o && setAsignarCanchaNum(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignar a Cancha {asignarCanchaNum}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {partidosLibres.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No hay partidos pendientes listos para jugar.</p>
            ) : (
              partidosLibres.map(p => (
                <div key={p.id} className="border p-3 rounded-lg flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Badge variant="secondary" className="text-[9px] mb-1">{p.faseNombre}</Badge>
                    <p className="text-sm font-medium truncate">{parejaLabel(p.pareja_local_id)}</p>
                    <p className="text-sm font-medium truncate">{parejaLabel(p.pareja_visitante_id)}</p>
                  </div>
                  <Button size="sm" onClick={() => handleAsignarCancha(p.id, asignarCanchaNum!)}>
                    Jugar
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Cargar Resultado */}
      <Dialog open={!!partidoCargar} onOpenChange={(o) => !o && setPartidoCargar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resultado Final</DialogTitle>
          </DialogHeader>
          {partidoCargar && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <Button 
                  variant={ganadorSeleccionado === partidoCargar.pareja_local_id ? "default" : "outline"}
                  className="h-auto py-2 flex flex-col gap-1"
                  onClick={() => setGanadorSeleccionado(partidoCargar.pareja_local_id)}
                >
                  <span className="text-[10px] uppercase opacity-70">Ganador</span>
                  <span className="text-xs whitespace-normal line-clamp-2">{parejaLabel(partidoCargar.pareja_local_id)}</span>
                </Button>
                <span className="text-muted-foreground text-xs font-bold px-2">VS</span>
                <Button 
                  variant={ganadorSeleccionado === partidoCargar.pareja_visitante_id ? "default" : "outline"}
                  className="h-auto py-2 flex flex-col gap-1"
                  onClick={() => setGanadorSeleccionado(partidoCargar.pareja_visitante_id)}
                >
                  <span className="text-[10px] uppercase opacity-70">Ganador</span>
                  <span className="text-xs whitespace-normal line-clamp-2">{parejaLabel(partidoCargar.pareja_visitante_id)}</span>
                </Button>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Sets (Games)</Label>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-12 text-muted-foreground">Set {i + 1}</span>
                    <Input 
                      type="number" min="0" max="7" className="w-16 h-8 text-center" placeholder="0"
                      value={sets[i].local} onChange={e => { const n = [...sets]; n[i].local = e.target.value; setSets(n); }}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input 
                      type="number" min="0" max="7" className="w-16 h-8 text-center" placeholder="0"
                      value={sets[i].visitante} onChange={e => { const n = [...sets]; n[i].visitante = e.target.value; setSets(n); }}
                    />
                  </div>
                ))}
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" disabled={!tieneSetCargado} onClick={guardarResultadoParcial} className="flex-1 text-xs">
                  Guardar Parcial
                </Button>
                <Button disabled={!ganadorSeleccionado} onClick={guardarResultado} className="flex-1 text-xs bg-primary text-primary-foreground">
                  Finalizar Partido
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contenedor oculto para exportar a Flyer IG (Relación de aspecto 9:16 aprox) */}
      <div 
        ref={flyerRef}
        className="fixed top-[-9999px] left-[-9999px] w-[540px] h-[960px] bg-slate-900 text-slate-50 flex flex-col p-8 z-[-10]"
      >
        <div className="flex justify-center mb-6">
          <img src={activeTenant.logo} alt={activeTenant.name} className="h-16 object-contain" />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">PARTIDOS EN VIVO</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
            {torneos.find(t => t.id === torneoId)?.nombre}
          </p>
        </div>

        <div className="flex-1 space-y-4">
          {canchas.map(numeroCancha => {
            const enJuego = partidosActivos.find(p => p.estado === "en_juego" && (p.cancha === numeroCancha || p.cancha === `Cancha ${numeroCancha}`));
            if (!enJuego) return null;
            return (
              <div key={numeroCancha} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-3 py-1 uppercase tracking-wider rounded-bl-lg">
                  En Juego
                </div>
                <h3 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Cancha {numeroCancha}
                </h3>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  <div className="text-right font-bold text-sm leading-tight text-slate-200">
                    {parejaLabel(enJuego.pareja_local_id)}
                  </div>
                  <div className="text-slate-500 font-black text-xs italic">VS</div>
                  <div className="text-left font-bold text-sm leading-tight text-slate-200">
                    {parejaLabel(enJuego.pareja_visitante_id)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-auto pt-6 border-t border-slate-800">
          <p className="font-black text-slate-300 tracking-widest">{activeTenant.name.toUpperCase()}</p>
          <p className="text-xs text-slate-500 mt-1">Sigue los resultados en la app</p>
        </div>
      </div>
    </div>
  );
}
