import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trophy, Medal, Star, Search, Filter, Loader2, Award } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aniosDisp, setAniosDisp] = useState<number[]>([]);
  const [cuposMaster, setCuposMaster] = useState<Record<string, number>>({});

  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroGenero, setFiltroGenero] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");

  const cargarFiltros = async () => {
    const [{ data: cats }, { data: anios }, { data: cupos }] = await Promise.all([
      supabase.from("categorias").select("id, nombre, genero").eq("activa", true).order("orden"),
      supabase.from("ranking_jugadores").select("anio"),
      supabase.from("cupos_master").select("categoria_id, cupos"),
    ]);
    
    setCategorias((cats ?? []) as Categoria[]);
    const anioSet = new Set<number>();
    (anios ?? []).forEach((a: { anio: number }) => anioSet.add(a.anio));
    anioSet.add(new Date().getFullYear());
    setAniosDisp(Array.from(anioSet).sort((a, b) => b - a));
    
    const cuposMap: Record<string, number> = {};
    (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) => {
      cuposMap[c.categoria_id] = c.cupos;
    });
    setCuposMaster(cuposMap);
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

    const { data: jugadores } = await supabase
      .from("jugadores")
      .select("id, nombre, apellido, club")
      .in("id", ids);

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
  }, [filtroAnio, filtroCategoria, filtroGenero]);

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
          <Link to="/auth" className="text-xs font-medium hover:text-primary transition-colors">Admin Login</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold tracking-tight">Ranking {filtroAnio}</h2>
          <p className="text-sm text-muted-foreground">Anita Quiroga — Gestión de Torneos</p>
        </div>

        {/* Filters */}
        <div className="grid gap-4 p-4 rounded-xl border bg-muted/20 sm:grid-cols-3">
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

        {cupoActual !== null && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 text-sm animate-in fade-in slide-in-from-top-1">
            <div className="bg-primary/10 p-2 rounded-full">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold">Carrera al Master</p>
              <p className="text-muted-foreground text-xs">
                Clasifican los mejores <span className="text-primary font-bold">{cupoActual}</span> jugadores de esta categoría.
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
          <Link to="/mi-panel" className="hover:text-primary transition-colors">Mi Perfil</Link>
        </div>
      </footer>
    </div>
  );
}
