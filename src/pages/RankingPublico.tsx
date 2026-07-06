import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Medal, Star, Search, Filter, Loader2, Award, Share2, Check } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { toast } from "sonner";

type RankingRow = {
  jugador_id: string;
  puntos: number;
  torneos: number;
  jugador_nombre: string;
  jugador_apellido: string;
  jugador_club: string | null;
};

type Categoria = { id: string; nombre: string; genero: string };

const GENEROS = [
  { value: "todos", label: "Todos los géneros" },
  { value: "caballeros", label: "Caballeros" },
  { value: "damas", label: "Damas" },
  { value: "mixto", label: "Mixto" },
];

export default function RankingPublico() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aniosDisp, setAniosDisp] = useState<number[]>([]);
  const [cuposMaster, setCuposMaster] = useState<Record<string, number>>({});

  const [filtroAnio, setFiltroAnio] = useState<number>(() => {
    const yr = searchParams.get("anio");
    return yr ? parseInt(yr, 10) : new Date().getFullYear();
  });
  const [filtroCategoria, setFiltroCategoria] = useState<string>(() => {
    return searchParams.get("categoria") ?? "todas";
  });
  const [filtroGenero, setFiltroGenero] = useState<string>(() => {
    return searchParams.get("genero") ?? "todos";
  });
  const [busqueda, setBusqueda] = useState("");
  const [copiado, setCopiado] = useState(false);

  const copiarEnlace = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("¡Enlace copiado al portapapeles! Listo para compartir en WhatsApp.");
    setTimeout(() => setCopiado(false), 2000);
  };

  const cargarFiltros = async () => {
    const [{ data: cats }, { data: anios }, { data: cupos }] = await Promise.all([
      supabase.from("categorias").select("id, nombre, genero").eq("activa", true).order("orden"),
      supabase.from("ranking_jugadores").select("anio"),
      supabase.from("cupos_master").select("categoria_id, cupos"),
    ]);
    
    const activeCats = (cats ?? []) as Categoria[];
    setCategorias(activeCats);
    const anioSet = new Set<number>();
    (anios ?? []).forEach((a: { anio: number }) => anioSet.add(a.anio));
    anioSet.add(new Date().getFullYear());
    setAniosDisp(Array.from(anioSet).sort((a, b) => b - a));
    
    const cuposMap: Record<string, number> = {};
    (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) => {
      cuposMap[c.categoria_id] = c.cupos;
    });
    setCuposMaster(cuposMap);

    // Resolver categoria si viene de la URL como texto o uuid
    const catParam = searchParams.get("categoria");
    const genParam = searchParams.get("genero");
    
    if (catParam && catParam !== "todas") {
      const matchById = activeCats.find(c => c.id === catParam);
      if (matchById) {
        setFiltroCategoria(matchById.id);
      } else {
        const normalized = catParam.toLowerCase().trim().replace(/[-_]/g, " ");
        let matches = activeCats.filter(c => c.nombre.toLowerCase().includes(normalized));
        if (genParam && genParam !== "todos") {
          matches = matches.filter(c => c.genero === genParam);
        }
        if (matches.length > 0) {
          setFiltroCategoria(matches[0].id);
          if (!genParam) {
            setFiltroGenero(matches[0].genero);
          }
        }
      }
    }
  };

  const cargarRanking = async () => {
    setLoading(true);
    let query = supabase
      .from("ranking_jugadores")
      .select("jugador_id, puntos, torneo_id, categoria_id, genero, anio")
      .eq("anio", filtroAnio);

    if (filtroCategoria !== "todas") {
      query = query.eq("categoria_id", filtroCategoria);
    }
    if (filtroGenero !== "todos") {
      query = query.eq("genero", filtroGenero);
    }
    
    const { data, error } = await query;
    if (error) {
      toast.error("Error cargando ranking");
      setLoading(false);
      return;
    }

    // Load ascensos to handle point transfers
    const { data: ascensosData } = await supabase
      .from("ascensos")
      .select("jugador_id, puntos_transferidos, categoria_destino_id, categoria_origen_id")
      .eq("anio", filtroAnio);

    const ascendidosDesde = new Map<string, Set<string>>();
    const ascensoMap = new Map<string, number>();

    (ascensosData ?? []).forEach((a) => {
      // Destino points
      if (filtroCategoria === "todas" || a.categoria_destino_id === filtroCategoria) {
        ascensoMap.set(a.jugador_id, (ascensoMap.get(a.jugador_id) ?? 0) + a.puntos_transferidos);
      }
      // Origin exclusion
      if (!ascendidosDesde.has(a.categoria_origen_id)) ascendidosDesde.set(a.categoria_origen_id, new Set());
      ascendidosDesde.get(a.categoria_origen_id)!.add(a.jugador_id);
    });

    const map = new Map<string, { puntos: number; torneos: number }>();
    (data ?? []).forEach((r) => {
      const catAscendidos = ascendidosDesde.get(r.categoria_id);
      if (catAscendidos && catAscendidos.has(r.jugador_id)) return;
      
      const cur = map.get(r.jugador_id) ?? { puntos: 0, torneos: 0 };
      cur.puntos += r.puntos;
      cur.torneos += 1;
      map.set(r.jugador_id, cur);
    });

    for (const [jId, pts] of ascensoMap.entries()) {
      const cur = map.get(jId) ?? { puntos: 0, torneos: 0 };
      cur.puntos += pts;
      map.set(jId, cur);
    }

    const ids = Array.from(map.keys());
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Chunk ids array to avoid URL length limit in Supabase (.in with many elements)
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      chunks.push(ids.slice(i, i + chunkSize));
    }
    
    let jugadores: { id: string; nombre: string; apellido: string; club: string | null }[] = [];
    try {
      const results = await Promise.all(
        chunks.map(chunk => 
          supabase
            .from("jugadores")
            .select("id, nombre, apellido, club")
            .in("id", chunk)
        )
      );
      
      for (const res of results) {
        if (res.error) {
          console.error("Error fetching chunk of jugadores:", res.error);
        }
        if (res.data) {
          jugadores = [...jugadores, ...res.data];
        }
      }
    } catch (err) {
      console.error("Error fetching jugadores in chunks:", err);
    }

    const result: RankingRow[] = ids.map((id) => {
      const j = jugadores?.find((x) => x.id === id);
      const m = map.get(id)!;
      return {
        jugador_id: id,
        puntos: m.puntos,
        torneos: m.torneos,
        jugador_nombre: j?.nombre ?? "?",
        jugador_apellido: j?.apellido ?? "?",
        jugador_club: j?.club ?? null,
      };
    });
    
    result.sort((a, b) => b.puntos - a.puntos);
    setRows(result);
    setLoading(false);
  };

  useEffect(() => {
    cargarFiltros().then(cargarRanking);
  }, []);

  useEffect(() => {
    cargarRanking();
    
    // Sincronizar filtros con la URL
    const params: Record<string, string> = {};
    if (filtroAnio !== new Date().getFullYear()) {
      params.anio = filtroAnio.toString();
    }
    let catName = "";
    if (filtroCategoria !== "todas") {
      params.categoria = filtroCategoria;
      const cat = categorias.find((c) => c.id === filtroCategoria);
      if (cat) {
        const gen = cat.genero === "caballeros" ? "Cab" : (cat.genero === "damas" ? "Damas" : cat.genero);
        catName = ` - ${cat.nombre} ${gen}`;
      }
    }
    if (filtroGenero !== "todos") {
      params.genero = filtroGenero;
    }
    setSearchParams(params, { replace: true });
    document.title = `Ranking${catName} | Padel ID`;
  }, [filtroAnio, filtroCategoria, filtroGenero, categorias]);

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return rows;
    const q = busqueda.toLowerCase();
    return rows.filter(
      (r) =>
        r.jugador_nombre.toLowerCase().includes(q) ||
        r.jugador_apellido.toLowerCase().includes(q) ||
        (r.jugador_club ?? "").toLowerCase().includes(q)
    );
  }, [rows, busqueda]);

  const cupoActual = useMemo(() => {
    if (filtroCategoria === "todas") return null;
    const cat = categorias.find((c) => c.id === filtroCategoria);
    if (!cat) return null;
    return cuposMaster[filtroCategoria] ?? (cat.nombre.toLowerCase().includes("suma 7") ? 8 : 16);
  }, [filtroCategoria, categorias, cuposMaster]);

  const medalla = (pos: number) => {
    if (pos === 0) return <Medal className="h-5 w-5 text-yellow-500" />;
    if (pos === 1) return <Medal className="h-5 w-5 text-slate-400" />;
    if (pos === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="text-xs font-bold text-muted-foreground">{pos + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-1.5 rounded-lg">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">Padel ID</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Ranking Oficial</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Link to="/auth" className="text-xs font-medium hover:text-primary transition-colors">Admin Login</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl border dark:border-primary/20 bg-gradient-to-br from-primary/10 dark:from-primary/20 via-background to-background p-6 sm:p-10 shadow-sm mb-6 mt-2">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-primary/20 dark:bg-primary/30 blur-3xl pointer-events-none"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-primary/20 text-primary dark:bg-primary/30 dark:text-primary-foreground hover:bg-primary/30 border-none px-3 py-1 text-[10px] uppercase tracking-widest font-black">
                Oficial
              </Badge>
              <Badge variant="outline" className="border-primary/20 dark:border-primary/40 px-3 py-1 text-[10px] uppercase font-bold shadow-sm">
                Temporada {filtroAnio}
              </Badge>
            </div>
            
            <h2 className="text-3xl sm:text-5xl font-black tracking-tighter bg-gradient-to-br from-foreground to-muted-foreground dark:from-foreground dark:to-foreground/60 bg-clip-text text-transparent pb-1">
              Ranking General
            </h2>
            
            <p className="text-sm font-medium text-muted-foreground pt-1 max-w-lg">
              Tabla de posiciones oficial del circuito. Los mejores jugadores de cada categoría clasificarán al Master de fin de año.
            </p>
          </div>
        </section>

        {/* Filters */}
        <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> Categoría
              </label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="bg-background">
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
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> Género
              </label>
              <Select value={filtroGenero} onValueChange={setFiltroGenero}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENEROS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Search className="h-3 w-3" /> Buscar
              </label>
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, apellido o club..."
                className="bg-background"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t dark:border-primary/10">
            <Button
              onClick={copiarEnlace}
              size="sm"
              className="w-full sm:w-auto font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-primary/5"
            >
              {copiado ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copiado ? "¡Enlace Copiado!" : "Copiar Enlace para Compartir esta Categoría"}
            </Button>
          </div>
        </div>

        {cupoActual !== null && (
          <div className="flex items-center gap-4 p-5 rounded-2xl border dark:border-primary/20 bg-gradient-to-r from-primary/10 to-transparent text-sm animate-in fade-in slide-in-from-top-1 mb-2">
            <div className="bg-primary p-2.5 rounded-xl shadow-lg shadow-primary/20">
              <Award className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-base">Carrera al Master</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Clasifican los mejores <span className="text-primary font-black text-sm">{cupoActual}</span> jugadores de la temporada.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Cargando ranking oficial...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <Trophy className="h-10 w-10 mx-auto opacity-20" />
              <p>No se encontraron registros para esta selección.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-none shadow-xl bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-14 text-center">#</TableHead>
                  <TableHead>Jugador / Club</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Torneos</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((r, idx) => {
                  const clasifica = cupoActual !== null && idx < cupoActual && !busqueda.trim();
                  return (
                    <TableRow key={r.jugador_id} className={`group ${clasifica ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : ""}`}>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center h-8">
                          {medalla(idx)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className={`font-bold ${clasifica ? "text-primary" : ""}`}>
                            {r.jugador_apellido}, {r.jugador_nombre}
                            {clasifica && <Star className="h-3 w-3 inline ml-1 fill-primary text-primary" />}
                          </span>
                          {r.jugador_club && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.jugador_club}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <Badge variant="outline" className="font-mono">{r.torneos}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-lg font-black tracking-tight text-primary">
                          {r.puntos}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 pt-12 border-t text-center space-y-2">
        <p className="text-sm font-bold">Padel ID</p>
        <p className="text-xs text-muted-foreground">Anita Quiroga — Gestión de Torneos</p>
        <div className="pt-4 flex justify-center gap-4 text-xs font-medium">
          <Link to="/" className="hover:text-primary transition-colors">Admin Login</Link>
          <Link to="/player/dashboard" className="hover:text-primary transition-colors">Mi Perfil</Link>
        </div>
      </footer>
    </div>
  );
}
