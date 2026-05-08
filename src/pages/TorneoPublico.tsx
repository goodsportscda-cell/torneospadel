import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, MapPin, Loader2, AlertCircle, Users, LayoutGrid, GitBranch } from "lucide-react";
import { ZonaCard, type Zona } from "@/components/zonas/ZonaCard";
import { PartidoCard } from "@/components/zonas/PartidoCard";
import { TablaPosiciones } from "@/components/zonas/TablaPosiciones";
import { calcularTabla, type PartidoConSets } from "@/lib/zonas";
import { NOMBRE_RONDA, ORDEN_RONDA, type RondaLlave } from "@/lib/llaves";
import type { Database } from "@/integrations/supabase/types";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Inscripcion = Database["public"]["Tables"]["inscripciones"]["Row"];
type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];
type PartidoLlaveRow = Database["public"]["Tables"]["partidos_llave"]["Row"];

export default function TorneoPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Data for Zonas and Llaves
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [inscripciones, setInscripciones] = useState<any[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidosLlave, setPartidosLlave] = useState<PartidoLlaveRow[]>([]);
  const [setsLlave, setSetsLlave] = useState<Record<string, any[]>>({});

  const fetchTorneo = useCallback(async () => {
    if (!slug) return;
    
    // 1. Fetch Torneo by slug or ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    
    let tQuery = supabase.from("torneos").select("*");
    
    if (isUUID) {
      tQuery = tQuery.or(`id.eq.${slug},slug.eq.${slug}`);
    } else {
      tQuery = tQuery.eq("slug", slug);
    }
    
    const { data: tData, error: tErr } = await tQuery.maybeSingle();
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
      supabase.from("zonas").select("*").eq("torneo_id", tData.id).order("orden"),
      supabase.from("inscripciones").select("*, jugador1:jugadores!inscripciones_jugador1_id_fkey(nombre, apellido), jugador2:jugadores!inscripciones_jugador2_id_fkey(nombre, apellido)").eq("torneo_id", tData.id),
      supabase.from("jugadores").select("*"),
      supabase.from("llaves").select("*").eq("torneo_id", tData.id).maybeSingle(),
      supabase.from("partidos_llave").select("*").order("numero")
    ]);

    setZonas((zData ?? []) as Zona[]);
    setInscripciones(iData ?? []);
    setJugadores(jData ?? []);
    
    if (lData) {
      const filteredPartidos = (llavesData ?? []).filter(p => p.llave_id === lData.id);
      setPartidosLlave(filteredPartidos as PartidoLlaveRow[]);
      
      if (filteredPartidos.length > 0) {
        const pIds = filteredPartidos.map(p => p.id);
        const { data: sData } = await supabase.from("sets_partido").select("*").in("partido_llave_id", pIds);
        const map: Record<string, any[]> = {};
        (sData ?? []).forEach(s => {
          if (!map[s.partido_llave_id!]) map[s.partido_llave_id!] = [];
          map[s.partido_llave_id!].push(s);
        });
        setSetsLlave(map);
      }
    }
    
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchTorneo();
  }, [fetchTorneo]);

  const jugadorMap = useMemo(() => new Map(jugadores.map(j => [j.id, j])), [jugadores]);

  const parejaLabel = (id: string | null) => {
    if (!id) return "— por definir —";
    const i = inscripciones.find(x => x.id === id);
    if (!i) return "?";
    const n1 = i.jugador1?.apellido ?? "?";
    const n2 = i.jugador2?.apellido ?? "?";
    return `${n1} / ${n2}`;
  };

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
          <Badge variant="outline" className="capitalize">{torneo.estado.replace(/_/g, " ")}</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tournament Hero */}
        <section className="space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight">{torneo.nombre}</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(torneo.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR", { day: 'numeric', month: 'long' })}
            </div>
            {torneo.sede && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {torneo.sede}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {inscripciones.length} parejas
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
                      <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Categoría</p>
                      <p className="text-sm capitalize">{torneo.categoria_libre || "Oficial"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Género</p>
                      <p className="text-sm capitalize">{torneo.genero || "Libre"}</p>
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
            {zonas.length === 0 ? (
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
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: LLAVES */}
          <TabsContent value="llaves" className="mt-6">
            {partidosLlave.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                  <GitBranch className="h-10 w-10 mx-auto opacity-20" />
                  <p>El cuadro final se publicará al terminar la fase de zonas.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto pb-6">
                <div className="flex gap-6 min-w-fit">
                  {partidosPorRonda.map(([ronda, partidos]) => (
                    <div key={ronda} className="flex flex-col gap-4 min-w-[280px]">
                      <h3 className="text-sm font-bold text-center uppercase tracking-widest text-primary sticky top-0 bg-background/95 backdrop-blur py-2 z-10 border-b">
                        {NOMBRE_RONDA[ronda]}
                      </h3>
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
                                    label: `(${p.ref_local})`,
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
                                    label: `(${p.ref_visitante})`,
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
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="max-w-5xl mx-auto px-4 pt-12 border-t text-center space-y-2">
        <p className="text-sm font-bold">Padel ID</p>
        <p className="text-xs text-muted-foreground">Sistema de Gestión de Torneos por <span className="font-semibold text-primary">Anita Quiroga</span></p>
        <div className="pt-4 flex justify-center gap-4 text-xs font-medium">
          <Link to="/" className="hover:text-primary transition-colors">Admin Login</Link>
          <Link to="/mi-panel" className="hover:text-primary transition-colors">Mi Perfil Jugador</Link>
        </div>
      </footer>
    </div>
  );
}
