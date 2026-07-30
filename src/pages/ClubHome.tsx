import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Calendar, MapPin, Loader2, User, ChevronRight, AlertCircle, Medal, Share2, Check, Clock } from "lucide-react";
import { ESTADO_TORNEO_BADGE, ESTADO_TORNEO_LABELS, type EstadoTorneo } from "@/lib/estadoTorneo";
import { ModeToggle } from "@/components/mode-toggle";
import PublicFooter from "@/components/PublicFooter";

type Torneo = {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  sede: string | null;
  estado: string;
  numero_fecha: number | null;
};

type RankingRow = {
  jugador_id: string;
  puntos: number;
  torneos: number;
  jugador_nombre: string;
  jugador_apellido: string;
};

type Categoria = { id: string; nombre: string; genero: string };

const GENEROS = [
  { value: "todos", label: "Todos los géneros" },
  { value: "caballeros", label: "Caballeros" },
  { value: "damas", label: "Damas" },
  { value: "mixto", label: "Mixto" },
];

export default function ClubHome() {
  const { club, loading: tenantLoading } = useTenant();
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [loadingTorneos, setLoadingTorneos] = useState(false);
  
  // Rankings state
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroGenero, setFiltroGenero] = useState<string>("todos");
  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [aniosDisp, setAniosDisp] = useState<number[]>([new Date().getFullYear()]);
  const [rankingRows, setRankingRows] = useState<RankingRow[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (club) {
      document.title = `${club.nombre} | Padel ID`;
      cargarTorneos();
      cargarFiltrosRanking();
    }
  }, [club]);

  useEffect(() => {
    if (club) {
      cargarRanking();
    }
  }, [club, filtroAnio, filtroCategoria, filtroGenero]);

  const cargarTorneos = async () => {
    if (!club) return;
    setLoadingTorneos(true);
    const { data } = await supabase
      .from("torneos")
      .select("id, nombre, fecha_inicio, fecha_fin, sede, estado, numero_fecha")
      .eq("club_id", club.id)
      .order("fecha_inicio", { ascending: false });
    
    setTorneos(data || []);
    setLoadingTorneos(false);
  };

  const cargarFiltrosRanking = async () => {
    if (!club) return;
    const { data: cats } = await supabase
      .from("categorias")
      .select("id, nombre, genero")
      .eq("club_id", club.id)
      .order("orden");
    
    if (cats) setCategorias(cats);

    // Obtener años disponibles de torneos jugados en el club
    const { data: torneosAnios } = await supabase
      .from("torneos")
      .select("fecha_inicio")
      .eq("club_id", club.id);
    
    const anioSet = new Set<number>();
    anioSet.add(new Date().getFullYear());
    (torneosAnios || []).forEach(t => {
      if (t.fecha_inicio) anioSet.add(new Date(t.fecha_inicio).getFullYear());
    });
    setAniosDisp(Array.from(anioSet).sort((a, b) => b - a));
  };

  const cargarRanking = async () => {
    if (!club) return;
    setLoadingRankings(true);
    
    // Obtener puntos solo de torneos de este club (Inner join manual o filtrando)
    let query = supabase
      .from("ranking_jugadores")
      .select("jugador_id, puntos, categoria_id, genero, torneos!inner(club_id)")
      .eq("torneos.club_id", club.id)
      .eq("anio", filtroAnio);

    if (filtroCategoria !== "todas") {
      query = query.eq("categoria_id", filtroCategoria);
    }
    if (filtroGenero !== "todos") {
      query = query.eq("genero", filtroGenero);
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
      setLoadingRankings(false);
      return;
    }

    // Agrupar puntos
    const map = new Map<string, { puntos: number; torneos: number }>();
    (data || []).forEach((r) => {
      const cur = map.get(r.jugador_id) ?? { puntos: 0, torneos: 0 };
      cur.puntos += r.puntos;
      cur.torneos += 1;
      map.set(r.jugador_id, cur);
    });

    const ids = Array.from(map.keys());
    if (ids.length === 0) {
      setRankingRows([]);
      setLoadingRankings(false);
      return;
    }

    // Cargar nombres de jugadores
    const chunkSize = 100;
    let jugadores: any[] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data: jData } = await supabase
        .from("jugadores")
        .select("id, nombre, apellido")
        .in("id", chunk);
      if (jData) jugadores = [...jugadores, ...jData];
    }

    const result: RankingRow[] = ids.map((id) => {
      const j = jugadores.find((x) => x.id === id);
      const m = map.get(id)!;
      return {
        jugador_id: id,
        puntos: m.puntos,
        torneos: m.torneos,
        jugador_nombre: j?.nombre ?? "?",
        jugador_apellido: j?.apellido ?? "?",
      };
    });
    
    result.sort((a, b) => b.puntos - a.puntos);
    setRankingRows(result);
    setLoadingRankings(false);
  };

  const inscripcionesAbiertas = useMemo(() => {
    return torneos.filter(t => t.estado === "inscripciones_abiertas");
  }, [torneos]);

  const torneosEnCurso = useMemo(() => {
    return torneos.filter(t => t.estado === "en_curso");
  }, [torneos]);

  const copiarEnlace = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Club no encontrado</h1>
          <p className="text-muted-foreground">La dirección a la que intentas acceder no existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header / Branding */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.nombre} className="h-10 w-10 object-contain rounded-full border bg-background" />
            ) : (
              <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center">
                <span className="font-black text-primary text-lg">{club.nombre.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h1 className="text-base font-bold leading-tight line-clamp-1">{club.nombre}</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Portal Público</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ModeToggle />
            <Button size="sm" asChild className="hidden sm:inline-flex text-xs font-bold">
              <Link to="/auth">Iniciar Sesión</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild className="sm:hidden w-9 h-9 p-0">
              <Link to="/auth">
                <User className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-4 pb-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-tr from-primary via-primary/50 to-transparent rounded-full blur opacity-40"></div>
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 bg-background border shadow-lg rounded-full flex items-center justify-center overflow-hidden p-2">
              {club.logo_url ? (
                <img src={club.logo_url} alt={club.nombre} className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full w-full bg-muted/20 rounded-full">
                  <span className="text-4xl font-black text-primary opacity-80">{club.nombre.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{club.nombre}</h2>
            <p className="text-sm text-muted-foreground font-medium mt-1">Torneos y Ranking Oficial</p>
          </div>
        </div>

        <Tabs defaultValue="torneos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="torneos" className="text-xs sm:text-sm font-bold">Torneos</TabsTrigger>
            <TabsTrigger value="rankings" className="text-xs sm:text-sm font-bold">Ranking</TabsTrigger>
            <TabsTrigger value="inscripciones" className="text-xs sm:text-sm font-bold relative">
              Inscripciones
              {inscripcionesAbiertas.length > 0 && (
                <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB: TORNEOS */}
          <TabsContent value="torneos" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Torneos y Resultados</h2>
            </div>
            
            {loadingTorneos ? (
              <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : torneosEnCurso.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No hay torneos en curso en este momento.
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {torneosEnCurso.map((t) => (
                  <Link key={t.id} to={`/c/${club.slug}/torneo/${t.id}`}>
                    <Card className="hover:border-primary/50 transition-colors h-full flex flex-col group cursor-pointer">
                      <CardHeader className="pb-3 flex-row items-start justify-between space-y-0 gap-2">
                        <div className="space-y-1 pr-4">
                          <CardTitle className="text-base line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                            {t.nombre}
                          </CardTitle>
                          {t.numero_fecha != null && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background">
                              Fecha {t.numero_fecha}
                            </Badge>
                          )}
                        </div>
                        <Badge className={`shrink-0 text-[10px] capitalize ${ESTADO_TORNEO_BADGE[t.estado as EstadoTorneo]}`}>
                          {ESTADO_TORNEO_LABELS[t.estado as EstadoTorneo]}
                        </Badge>
                      </CardHeader>
                      <CardContent className="mt-auto pb-4">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(t.fecha_inicio).toLocaleDateString("es-AR", { month: "short", day: "numeric" })}
                          </div>
                          {t.sede && (
                            <div className="flex items-center gap-1 line-clamp-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {t.sede}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB: RANKING */}
          <TabsContent value="rankings" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="border-none shadow-md overflow-hidden bg-card">
              <CardHeader className="bg-muted/30 pb-4 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Ranking Interno</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copiarEnlace}
                    disabled={torneosEnCurso.length > 0}
                    title={torneosEnCurso.length > 0 ? "El ranking estará disponible para compartir cuando finalicen los torneos en curso" : ""}
                    className="h-8 text-xs font-bold gap-1"
                  >
                    {copiado ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                    Compartir Ranking
                  </Button>
                </div>
                {torneosEnCurso.length > 0 && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200 rounded-md p-3 flex items-start gap-2">
                    <span className="mt-0.5 text-base leading-none">ℹ️</span>
                    <p className="text-xs sm:text-sm">Ranking en actualización. Se actualizará oficialmente al finalizar la fecha en curso.</p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Categoría</label>
                    <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas las categorías</SelectItem>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Género</label>
                    <Select value={filtroGenero} onValueChange={setFiltroGenero}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GENEROS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Temporada</label>
                    <Select value={filtroAnio.toString()} onValueChange={(v) => setFiltroAnio(parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aniosDisp.map((a) => (
                          <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingRankings ? (
                  <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : rankingRows.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    No hay puntos registrados para esta categoría.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead className="text-right">Puntos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankingRows.map((r, idx) => (
                        <TableRow key={r.jugador_id}>
                          <TableCell className="text-center font-bold">
                            {idx === 0 ? <Medal className="h-4 w-4 text-yellow-500 mx-auto" /> :
                             idx === 1 ? <Medal className="h-4 w-4 text-slate-400 mx-auto" /> :
                             idx === 2 ? <Medal className="h-4 w-4 text-amber-700 mx-auto" /> :
                             idx + 1}
                          </TableCell>
                          <TableCell className="font-semibold text-sm">
                            {r.jugador_apellido}, {r.jugador_nombre}
                          </TableCell>
                          <TableCell className="text-right font-black text-primary">
                            {torneosEnCurso.length > 0 ? (
                              <div className="flex items-center justify-end gap-1.5 opacity-50" title="Puntos en actualización">
                                <Clock className="h-3.5 w-3.5" />
                                <span>-</span>
                              </div>
                            ) : (
                              r.puntos
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: INSCRIPCIONES */}
          <TabsContent value="inscripciones" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-lg font-bold mb-4">Inscripciones Abiertas</h2>
            {inscripcionesAbiertas.length === 0 ? (
              <Card className="border-dashed bg-muted/20">
                <CardContent className="py-12 text-center space-y-2">
                  <Calendar className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
                  <p className="font-medium">No hay torneos con inscripciones abiertas</p>
                  <p className="text-sm text-muted-foreground">Revisá más tarde para nuevos torneos.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {inscripcionesAbiertas.map((t) => (
                  <Card key={t.id} className="flex flex-col border-primary/20 shadow-sm">
                    <CardHeader className="pb-3 space-y-1">
                      <CardTitle className="text-base leading-tight">{t.nombre}</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Inicia el {new Date(t.fecha_inicio).toLocaleDateString("es-AR", { month: "short", day: "numeric" })}
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto pt-0 pb-4">
                      <Button className="w-full font-bold shadow-md" asChild>
                        <Link to={`/c/${club.slug}/inscribirse/${t.id}`}>
                          Inscribirse Ahora <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <PublicFooter />
    </div>
  );
}
