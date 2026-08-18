import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, MapPin, Loader2, AlertCircle, Users, LayoutGrid, GitBranch, Share2 } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { ZonaCard, type Zona } from "@/components/zonas/ZonaCard";
import { PartidoCard } from "@/components/zonas/PartidoCard";
import { TablaPosiciones } from "@/components/zonas/TablaPosiciones";
import { calcularTabla, type PartidoConSets } from "@/lib/zonas";
import { NOMBRE_RONDA, ORDEN_RONDA, parseRef, type RondaLlave } from "@/lib/llaves";
import type { Database } from "@/integrations/supabase/types";
import { CompartirLlaveDialog } from "@/components/llaves/CompartirLlaveDialog";
import PublicFooter from "@/components/PublicFooter";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Inscripcion = Database["public"]["Tables"]["inscripciones"]["Row"];
type Jugador = any; // Database["public"]["Tables"]["jugadores"]["Row"]
type PartidoLlaveRow = any; // Database["public"]["Tables"]["partidos_llave"]["Row"]

export default function TorneoPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [categoriaNombre, setCategoriaNombre] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  // Data for Zonas and Llaves
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [inscripciones, setInscripciones] = useState<any[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidosLlave, setPartidosLlave] = useState<PartidoLlaveRow[]>([]);
  const [setsLlave, setSetsLlave] = useState<Record<string, any[]>>({});
  const [isCompartirOpen, setIsCompartirOpen] = useState(false);

  const fetchTorneo = useCallback(async () => {
    if (!slug) return;
    
    // Buscamos solo por ID para evitar el error de cache del slug
    const { data: tData, error: tErr } = await supabase
      .from("torneos")
      .select("*")
      .eq("id", slug)
      .maybeSingle();
    if (tErr || !tData) {
      setLoading(false);
      return;
    }
    setTorneo(tData);

    // 2. Fetch everything else in parallel
    const [
      { data: zData },
      { data: iData },
      { data: jData },
      { data: lData },
      { data: llavesData }
    ] = await Promise.all([
      (supabase as any).from("zonas").select("*").eq("torneo_id", tData.id).order("orden"),
      (supabase as any).from("inscripciones").select("*, jugador1:jugadores!inscripciones_jugador1_id_fkey(nombre, apellido), jugador2:jugadores!inscripciones_jugador2_id_fkey(nombre, apellido)").eq("torneo_id", tData.id).eq("estado", "confirmada"),
      (supabase as any).from("jugadores").select("*"),
      (supabase as any).from("llaves").select("*").eq("torneo_id", tData.id).maybeSingle(),
      (supabase as any).from("partidos_llave").select("*").order("numero")
    ]);

    setZonas((zData ?? []) as Zona[]);
    setInscripciones(iData ?? []);
    setJugadores(jData ?? []);
    
    if (lData) {
      const filteredPartidos = (llavesData ?? []).filter(p => p.llave_id === lData.id);
      setPartidosLlave(filteredPartidos as PartidoLlaveRow[]);
      
      if (filteredPartidos.length > 0) {
        const pIds = filteredPartidos.map(p => p.id);
        const { data: sData } = await (supabase as any).from("sets_partido").select("*").in("partido_llave_id", pIds);
        const map: Record<string, any[]> = {};
        (sData ?? []).forEach(s => {
          if (!map[s.partido_llave_id!]) map[s.partido_llave_id!] = [];
          map[s.partido_llave_id!].push(s);
        });
        setSetsLlave(map);
      }
    }

    // Fetch Category Name if official
    if (tData.tipo === "oficial" && tData.categoria_id) {
      const { data: cData } = await (supabase as any).from("categorias").select("nombre").eq("id", tData.categoria_id).maybeSingle();
      if (cData) setCategoriaNombre(cData.nombre);
    }
    
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchTorneo();
  }, [fetchTorneo]);

  useEffect(() => {
    if (torneo) {
      const catText = torneo.categoria_libre || categoriaNombre ? ` (${torneo.categoria_libre || categoriaNombre})` : "";
      const fechaTxt = torneo.numero_fecha ? ` - Fecha ${torneo.numero_fecha}` : "";
      document.title = `${torneo.nombre}${fechaTxt}${catText} | Padel ID`;
    } else {
      document.title = "Padel ID - Torneo";
    }
  }, [torneo, categoriaNombre]);

  const jugadorMap = useMemo(() => new Map(jugadores.map(j => [j.id, j])), [jugadores]);

  const parejaLabel = (id: string | null) => {
    if (!id) return "— por definir —";
    const i = inscripciones.find(x => x.id === id);
    if (!i) return "?";
    const n1 = i.jugador1?.apellido ?? "?";
    const n2 = i.jugador2?.apellido ?? "?";
    return `${n1} / ${n2}`;
  };
  const formatRefLabel = useCallback((ref: string | null) => {
    if (!ref) return "— por definir —";
    const parsed = parseRef(ref);
    if (parsed.tipo === "clasificado") return `${parsed.posicion}° Zona ${parsed.zona}`;
    if (parsed.tipo === "ganador") return `Ganador P${parsed.numeroPartido}`;
    return `(${ref})`;
  }, []);
  const partidosPorRonda = useMemo(() => {
    const map = new Map<RondaLlave, PartidoLlaveRow[]>();
    partidosLlave.forEach((p) => {
      const arr = map.get(p.ronda as RondaLlave) ?? [];
      arr.push(p);
      map.set(p.ronda as RondaLlave, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => ORDEN_RONDA[a] - ORDEN_RONDA[b]);
  }, [partidosLlave]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!torneo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Torneo no encontrado</h1>
        <p className="text-muted-foreground">El link es incorrecto o el torneo ya no existe.</p>
        <Button asChild><Link to="/">Volver al inicio</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Public Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-1.5 rounded-lg">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">Padel ID</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Anita Quiroga</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Badge variant="outline" className="capitalize">{torneo.estado.replace(/_/g, " ")}</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tournament Hero */}
        <section className="relative overflow-hidden rounded-3xl border dark:border-primary/20 bg-gradient-to-br from-primary/10 dark:from-primary/20 via-background to-background p-6 sm:p-10 shadow-sm mb-6 mt-2">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-primary/20 dark:bg-primary/30 blur-3xl pointer-events-none"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary-foreground hover:bg-primary/30 border-none px-3 py-1 text-[10px] uppercase tracking-widest font-black">
                {torneo.tipo === 'oficial' ? 'Torneo Oficial' : 'Torneo Libre'}
              </Badge>
              {(torneo.categoria_libre || categoriaNombre) && (
                <Badge variant="outline" className="border-primary/20 dark:border-primary/40 px-3 py-1 text-[10px] uppercase font-bold shadow-sm">
                  {torneo.categoria_libre || categoriaNombre}
                </Badge>
              )}
            </div>
            
            <h2 className="text-3xl sm:text-5xl font-black tracking-tighter bg-gradient-to-br from-foreground to-muted-foreground dark:from-foreground dark:to-foreground/60 bg-clip-text text-transparent pb-1">
              {torneo.nombre}
            </h2>
            
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-medium text-muted-foreground pt-2">
              <div className="flex items-center gap-2 bg-background/60 dark:bg-black/40 rounded-full px-3 py-1.5 border dark:border-primary/20 shadow-sm backdrop-blur-md">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {new Date(torneo.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR", { day: 'numeric', month: 'long' })}
              </div>
              {torneo.sede && (
                <div className="flex items-center gap-2 bg-background/60 dark:bg-black/40 rounded-full px-3 py-1.5 border dark:border-primary/20 shadow-sm backdrop-blur-md">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {torneo.sede}
                </div>
              )}
              <div className="flex items-center gap-2 bg-background/60 dark:bg-black/40 rounded-full px-3 py-1.5 border dark:border-primary/20 shadow-sm backdrop-blur-md">
                <Users className="h-3.5 w-3.5 text-primary" />
                {inscripciones.length} parejas
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="zonas" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="info" className="gap-2">
              <AlertCircle className="h-4 w-4 hidden sm:inline" /> Info
            </TabsTrigger>
            <TabsTrigger value="zonas" className="gap-2">
              <LayoutGrid className="h-4 w-4 hidden sm:inline" /> Zonas
            </TabsTrigger>
            <TabsTrigger value="llaves" className="gap-2">
              <GitBranch className="h-4 w-4 hidden sm:inline" /> Cuadros
            </TabsTrigger>
          </TabsList>

          {/* Tab: INFO */}
          <TabsContent value="info" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {torneo.notas && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Notas</p>
                      <p className="text-sm whitespace-pre-wrap">{torneo.notas}</p>
                    </div>
                  )}
                  {torneo.premios && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Premios</p>
                      <p className="text-sm">{torneo.premios}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Torneo</p>
                      <p className="text-sm capitalize">{torneo.tipo || "Oficial"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Categoría</p>
                      <p className="text-sm capitalize">{torneo.categoria_libre || categoriaNombre || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Puntaje</p>
                      <p className="text-sm">{torneo.multiplicador_puntos === 2 ? "Doble" : "Simple"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Parejas Inscriptas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                    {inscripciones.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No hay parejas confirmadas.</p>
                    ) : (
                      inscripciones.map((ins, i) => (
                        <div key={ins.id} className="flex items-center gap-3 p-2 rounded border bg-muted/20 text-sm">
                          <span className="text-muted-foreground font-mono w-4">{i + 1}.</span>
                          <span className="font-medium truncate">{parejaLabel(ins.id)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: ZONAS */}
          <TabsContent value="zonas" className="mt-6 space-y-6">
            {torneo?.estado !== "en_curso" && torneo?.estado !== "finalizado" ? (
              <Card className="border-dashed bg-muted/20">
                <CardContent className="py-12 text-center text-muted-foreground space-y-3">
                  <LayoutGrid className="h-10 w-10 mx-auto opacity-40 text-primary" />
                  <h3 className="font-bold text-base text-foreground">Fixture en Preparación</h3>
                  <p className="text-sm max-w-md mx-auto">
                    Las zonas, cruces y programación están siendo organizados por la administración del club.
                    Se publicarán oficialmente en este muro en cuanto el torneo pase a estado <strong>En Curso</strong>.
                  </p>
                </CardContent>
              </Card>
            ) : zonas.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                  <LayoutGrid className="h-10 w-10 mx-auto opacity-20" />
                  <p>Las zonas se publicarán cuando comience el torneo.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {zonas.map((z) => (
                  <ZonaCard 
                    key={z.id} 
                    zona={z} 
                    parejasDisponibles={[]} 
                    parejaLabel={parejaLabel}
                    onChanged={() => {}} 
                    onDeleted={() => {}}
                    readOnly={true}
                    torneoNombre={torneo?.nombre || ""}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: LLAVES */}
          <TabsContent value="llaves" className="mt-6">
            {torneo?.estado !== "en_curso" && torneo?.estado !== "finalizado" ? (
              <Card className="border-dashed bg-muted/20">
                <CardContent className="py-12 text-center text-muted-foreground space-y-3">
                  <GitBranch className="h-10 w-10 mx-auto opacity-40 text-primary" />
                  <h3 className="font-bold text-base text-foreground">Cuadro Final en Preparación</h3>
                  <p className="text-sm max-w-md mx-auto">
                    El cuadro de eliminatorias se habilitará una vez que comience el torneo y finalicen los partidos de zona.
                  </p>
                </CardContent>
              </Card>
            ) : partidosLlave.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                  <GitBranch className="h-10 w-10 mx-auto opacity-20" />
                  <p>El cuadro final se publicará al terminar la fase de zonas.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsCompartirOpen(true)}
                  >
                    <Share2 className="h-4 w-4" />
                    Compartir Cuadro
                  </Button>
                </div>
                <div className="overflow-x-auto pb-6">
                  <div className="flex gap-6 min-w-fit items-stretch">
                  {partidosPorRonda.map(([ronda, partidos]) => (
                    <div key={ronda} className="flex flex-col min-w-[280px]">
                      <h3 className="text-sm font-bold text-center uppercase tracking-widest text-primary sticky top-0 bg-background/95 backdrop-blur py-2 z-10 border-b mb-4">
                        {NOMBRE_RONDA[ronda]}
                      </h3>
                      <div className="flex-1 flex flex-col justify-around gap-6 py-4 min-h-[350px]">
                        {partidos.map((p) => (
                          <PartidoCard
                            key={p.id}
                            partidoId={p.id}
                            orden={p.numero}
                            labelPartido={`Partido ${p.numero}`}
                            tabla="partidos_llave"
                            parejaLocal={
                              p.pareja_local_id
                                ? {
                                    inscripcion_id: p.pareja_local_id,
                                    posicion_siembra: 0,
                                    label: parejaLabel(p.pareja_local_id),
                                  }
                                : p.ref_local
                                  ? {
                                      inscripcion_id: "",
                                      posicion_siembra: 0,
                                      label: formatRefLabel(p.ref_local),
                                    }
                                  : null
                            }
                            parejaVisitante={
                              p.pareja_visitante_id
                                ? {
                                    inscripcion_id: p.pareja_visitante_id,
                                    posicion_siembra: 0,
                                    label: parejaLabel(p.pareja_visitante_id),
                                  }
                                : p.ref_visitante
                                  ? {
                                      inscripcion_id: "",
                                      posicion_siembra: 0,
                                      label: formatRefLabel(p.ref_visitante),
                                    }
                                  : null
                            }
                            estado={p.estado}
                            ganadorId={p.ganador_id}
                            setsExistentes={setsLlave[p.id] ?? []}
                            onUpdated={() => {}}
                            fechaHora={p.fecha_hora}
                            cancha={p.cancha}
                            showProgramacion
                            readOnly={true}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <PublicFooter />

      <CompartirLlaveDialog
        isOpen={isCompartirOpen}
        onOpenChange={setIsCompartirOpen}
        torneo={torneo}
        categoriaNombre={categoriaNombre}
        partidos={partidosLlave}
        setsLlave={setsLlave}
        inscripciones={inscripciones}
      />
    </div>
  );
}
