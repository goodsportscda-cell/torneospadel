import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trophy, Settings, Save, Medal, Star, Eye, ArrowUpCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { INSTANCIA_LABEL, type Instancia } from "@/lib/ranking";

type DetalleTorneo = {
  torneo_id: string;
  torneo_nombre: string;
  fecha: string;
  numero_fecha: number | null;
  instancia: Instancia;
  puntos: number;
  multiplicador: number;
  puntos_base: number;
};

type RankingRow = {
  jugador_id: string;
  puntos: number;
  puntos_ascenso: number;
  torneos: number;
  jugador_nombre: string;
  jugador_apellido: string;
  jugador_club: string | null;
};

type Ascenso = {
  id: string;
  jugador_id: string;
  categoria_origen_id: string;
  categoria_destino_id: string;
  puntos_origen: number;
  puntos_transferidos: number;
  anio: number;
  fecha: string;
  notas: string | null;
};

type Categoria = { id: string; nombre: string; genero: string };

const GENEROS = [
  { value: "todos", label: "Todos" },
  { value: "caballeros", label: "Caballeros" },
  { value: "damas", label: "Damas" },
  { value: "mixto", label: "Mixto" },
];

const CUPO_DEFAULT = 16;

export default function Ranking() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [aniosDisp, setAniosDisp] = useState<number[]>([]);
  const [cuposMaster, setCuposMaster] = useState<Record<string, number>>({});

  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroGenero, setFiltroGenero] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");

  const [puntosCfg, setPuntosCfg] = useState<{ instancia: Instancia; puntos: number; orden: number }[]>([]);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);

  const [cupoOpen, setCupoOpen] = useState(false);
  const [cupoEdit, setCupoEdit] = useState<string>("");

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleJugador, setDetalleJugador] = useState<RankingRow | null>(null);
  const [detalleData, setDetalleData] = useState<DetalleTorneo[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Ascensos
  const [ascensoOpen, setAscensoOpen] = useState(false);
  const [ascensoJugadorBusqueda, setAscensoJugadorBusqueda] = useState("");
  const [ascensoJugadores, setAscensoJugadores] = useState<{ id: string; nombre: string; apellido: string; categoria_id: string | null; cat_nombre?: string }[]>([]);
  const [ascensoJugadorId, setAscensoJugadorId] = useState<string>("");
  const [ascensoCatOrigen, setAscensoCatOrigen] = useState<string>("");
  const [ascensoCatDestino, setAscensoCatDestino] = useState<string>("");
  const [ascensoPuntosOrigen, setAscensoPuntosOrigen] = useState<number>(0);
  const [ascensoNotas, setAscensoNotas] = useState("");
  const [savingAscenso, setSavingAscenso] = useState(false);
  const [ascensosList, setAscensosList] = useState<(Ascenso & { jugador_nombre?: string; jugador_apellido?: string })[]>([]);

  const cargarTodo = async () => {
    setLoading(true);
    const [{ data: cats }, { data: cfg }, { data: anios }, { data: cupos }] = await Promise.all([
      supabase.from("categorias").select("id, nombre, genero").eq("activa", true).order("orden"),
      supabase.from("puntos_ranking").select("instancia, puntos, orden").order("orden"),
      supabase.from("ranking_jugadores").select("anio"),
      supabase.from("cupos_master").select("categoria_id, cupos"),
    ]);
    setCategorias((cats ?? []) as Categoria[]);
    setPuntosCfg((cfg ?? []) as { instancia: Instancia; puntos: number; orden: number }[]);
    const anioSet = new Set<number>();
    (anios ?? []).forEach((a: { anio: number }) => anioSet.add(a.anio));
    anioSet.add(new Date().getFullYear());
    setAniosDisp(Array.from(anioSet).sort((a, b) => b - a));
    const cuposMap: Record<string, number> = {};
    (cupos ?? []).forEach((c: { categoria_id: string; cupos: number }) => {
      cuposMap[c.categoria_id] = c.cupos;
    });
    setCuposMaster(cuposMap);
    setLoading(false);
  };

  const cargarRanking = async () => {
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
      return;
    }

    // Cargar ascensos DESTINO (puntos transferidos a nueva categoría)
    let ascensosDestinoQuery = supabase
      .from("ascensos")
      .select("jugador_id, puntos_transferidos, categoria_destino_id")
      .eq("anio", filtroAnio);
    if (filtroCategoria !== "todas") {
      ascensosDestinoQuery = ascensosDestinoQuery.eq("categoria_destino_id", filtroCategoria);
    }
    const { data: ascensosDestinoData } = await ascensosDestinoQuery;

    // Cargar ascensos ORIGEN (jugadores que ascendieron DESDE una categoría → excluir sus puntos ahí)
    let ascensosOrigenQuery = supabase
      .from("ascensos")
      .select("jugador_id, categoria_origen_id")
      .eq("anio", filtroAnio);
    if (filtroCategoria !== "todas") {
      ascensosOrigenQuery = ascensosOrigenQuery.eq("categoria_origen_id", filtroCategoria);
    }
    const { data: ascensosOrigenData } = await ascensosOrigenQuery;

    // Set de jugadores que ascendieron desde cada categoría (ya no cuentan ahí)
    const ascendidosDesde = new Map<string, Set<string>>(); // cat_id -> Set<jugador_id>
    (ascensosOrigenData ?? []).forEach((a) => {
      if (!ascendidosDesde.has(a.categoria_origen_id)) {
        ascendidosDesde.set(a.categoria_origen_id, new Set());
      }
      ascendidosDesde.get(a.categoria_origen_id)!.add(a.jugador_id);
    });

    // Mapa de puntos de ascenso por jugador (en categoría destino)
    const ascensoMap = new Map<string, number>();
    (ascensosDestinoData ?? []).forEach((a) => {
      ascensoMap.set(a.jugador_id, (ascensoMap.get(a.jugador_id) ?? 0) + a.puntos_transferidos);
    });

    // Agrupar por jugador, excluyendo puntos de categorías desde las que ascendieron
    const map = new Map<string, { puntos: number; torneos: number }>();
    (data ?? []).forEach((r) => {
      // Si el jugador ascendió desde esta categoría, excluir sus puntos de ella
      const catAscendidos = ascendidosDesde.get(r.categoria_id);
      if (catAscendidos && catAscendidos.has(r.jugador_id)) {
        return; // skip — ya ascendió de esta categoría
      }
      const cur = map.get(r.jugador_id) ?? { puntos: 0, torneos: 0 };
      cur.puntos += r.puntos;
      cur.torneos += 1;
      map.set(r.jugador_id, cur);
    });

    // Incluir jugadores que solo tienen puntos de ascenso
    for (const jId of ascensoMap.keys()) {
      if (!map.has(jId)) {
        map.set(jId, { puntos: 0, torneos: 0 });
      }
    }

    const ids = Array.from(map.keys());
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const { data: jugadores } = await supabase
      .from("jugadores")
      .select("id, nombre, apellido, club")
      .in("id", ids);

    const result: RankingRow[] = ids.map((id) => {
      const j = jugadores?.find((x) => x.id === id);
      const m = map.get(id)!;
      const ptsAscenso = ascensoMap.get(id) ?? 0;
      return {
        jugador_id: id,
        puntos: m.puntos + ptsAscenso,
        puntos_ascenso: ptsAscenso,
        torneos: m.torneos,
        jugador_nombre: j?.nombre ?? "?",
        jugador_apellido: j?.apellido ?? "?",
        jugador_club: j?.club ?? null,
      };
    });
    result.sort((a, b) => b.puntos - a.puntos);
    setRows(result);
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  useEffect(() => {
    if (!loading) cargarRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio, filtroCategoria, filtroGenero, loading]);

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

  // Cupos al Master en la categoría filtrada (si aplica)
  const cupoActual = useMemo(() => {
    if (filtroCategoria === "todas") return null;
    const cat = categorias.find((c) => c.id === filtroCategoria);
    if (!cat) return null;
    const def = cat.nombre.toLowerCase().includes("suma 7") ? 8 : CUPO_DEFAULT;
    return cuposMaster[filtroCategoria] ?? def;
  }, [filtroCategoria, categorias, cuposMaster]);

  const guardarPuntos = async () => {
    setSavingCfg(true);
    try {
      for (const p of puntosCfg) {
        const { error } = await supabase
          .from("puntos_ranking")
          .update({ puntos: p.puntos })
          .eq("instancia", p.instancia);
        if (error) throw error;
      }
      toast.success("Puntos actualizados. Recalculá los torneos finalizados para aplicar.");
      setCfgOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar puntos");
    } finally {
      setSavingCfg(false);
    }
  };

  const updatePunto = (instancia: Instancia, valor: string) => {
    const num = parseInt(valor, 10);
    setPuntosCfg((prev) =>
      prev.map((p) =>
        p.instancia === instancia ? { ...p, puntos: isNaN(num) ? 0 : num } : p
      )
    );
  };

  const guardarCupo = async () => {
    if (filtroCategoria === "todas") return;
    const num = parseInt(cupoEdit, 10);
    if (isNaN(num) || num < 1) {
      toast.error("Ingresá un número válido");
      return;
    }
    const { error } = await supabase
      .from("cupos_master")
      .upsert({ categoria_id: filtroCategoria, cupos: num }, { onConflict: "categoria_id" });
    if (error) {
      toast.error("Error al guardar: " + error.message);
      return;
    }
    setCuposMaster((prev) => ({ ...prev, [filtroCategoria]: num }));
    toast.success("Cupos al Master actualizados");
    setCupoOpen(false);
  };

  const abrirDetalle = async (jugador: RankingRow) => {
    setDetalleJugador(jugador);
    setDetalleOpen(true);
    setLoadingDetalle(true);
    setDetalleData([]);
    try {
      let q = supabase
        .from("ranking_jugadores")
        .select("torneo_id, instancia, puntos")
        .eq("jugador_id", jugador.jugador_id)
        .eq("anio", filtroAnio);
      if (filtroCategoria !== "todas") q = q.eq("categoria_id", filtroCategoria);
      if (filtroGenero !== "todos") q = q.eq("genero", filtroGenero);
      const { data: rj, error } = await q;
      if (error) throw error;

      const torneoIds = Array.from(new Set((rj ?? []).map((r) => r.torneo_id)));
      const { data: torneos } = await supabase
        .from("torneos")
        .select("id, nombre, fecha_inicio, numero_fecha, multiplicador_puntos")
        .in("id", torneoIds);

      const { data: puntosCfg } = await supabase
        .from("puntos_ranking")
        .select("instancia, puntos");
      const puntosBaseMap = new Map<string, number>();
      (puntosCfg ?? []).forEach((p) => puntosBaseMap.set(p.instancia, p.puntos));

      const detalle: DetalleTorneo[] = (rj ?? []).map((r) => {
        const t = torneos?.find((x) => x.id === r.torneo_id);
        const mult = Number(t?.multiplicador_puntos ?? 1) || 1;
        return {
          torneo_id: r.torneo_id,
          torneo_nombre: t?.nombre ?? "Torneo",
          fecha: t?.fecha_inicio ?? "",
          numero_fecha: t?.numero_fecha ?? null,
          instancia: r.instancia as Instancia,
          puntos: r.puntos,
          multiplicador: mult,
          puntos_base: puntosBaseMap.get(r.instancia) ?? 0,
        };
      });
      detalle.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      setDetalleData(detalle);
    } catch (e) {
      console.error(e);
      toast.error("Error cargando el detalle");
    } finally {
      setLoadingDetalle(false);
    }
  };

  const medalla = (pos: number) => {
    if (pos === 0) return <Medal className="h-4 w-4 text-primary" />;
    if (pos === 1) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (pos === 2) return <Medal className="h-4 w-4 text-accent-foreground" />;
    return <span className="text-xs text-muted-foreground w-4 text-center">{pos + 1}</span>;
  };

  // --- Ascensos ---
  const buscarJugadoresAscenso = async (q: string) => {
    setAscensoJugadorBusqueda(q);
    if (q.length < 2) { setAscensoJugadores([]); return; }
    const { data } = await supabase
      .from("jugadores")
      .select("id, nombre, apellido, categoria_id")
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
      .limit(10);
    if (!data || data.length === 0) { setAscensoJugadores([]); return; }
    const catIds = [...new Set(data.filter(j => j.categoria_id).map(j => j.categoria_id!))];
    const { data: catsJ } = catIds.length > 0
      ? await supabase.from("categorias_jugadores").select("id, nombre").in("id", catIds)
      : { data: [] };
    const catMap = new Map((catsJ ?? []).map(c => [c.id, c.nombre]));
    setAscensoJugadores(data.map(j => ({
      ...j,
      cat_nombre: j.categoria_id ? catMap.get(j.categoria_id) ?? undefined : undefined,
    })));
  };

  const seleccionarJugadorAscenso = async (j: { id: string; nombre: string; apellido: string; categoria_id: string | null }) => {
    setAscensoJugadorId(j.id);
    setAscensoJugadorBusqueda(`${j.apellido}, ${j.nombre}`);
    setAscensoJugadores([]);

    // Buscar categorías de torneo donde el jugador tiene puntos
    const { data: rankData } = await supabase
      .from("ranking_jugadores")
      .select("categoria_id, puntos")
      .eq("jugador_id", j.id)
      .eq("anio", filtroAnio);

    // Agrupar puntos por categoría de torneo
    const puntosXCat = new Map<string, number>();
    (rankData ?? []).forEach((r) => {
      if (!r.categoria_id) return;
      puntosXCat.set(r.categoria_id, (puntosXCat.get(r.categoria_id) ?? 0) + r.puntos);
    });

    // Sumar ascensos previos a cada categoría
    const { data: ascPrev } = await supabase
      .from("ascensos")
      .select("categoria_destino_id, puntos_transferidos")
      .eq("jugador_id", j.id)
      .eq("anio", filtroAnio);
    (ascPrev ?? []).forEach((a) => {
      puntosXCat.set(a.categoria_destino_id, (puntosXCat.get(a.categoria_destino_id) ?? 0) + a.puntos_transferidos);
    });

    // Auto-seleccionar la categoría con más puntos como origen
    let mejorCat = "";
    let mejorPts = 0;
    for (const [catId, pts] of puntosXCat) {
      if (pts > mejorPts) {
        mejorCat = catId;
        mejorPts = pts;
      }
    }

    if (mejorCat) {
      setAscensoCatOrigen(mejorCat);
      setAscensoPuntosOrigen(mejorPts);
    } else {
      // Sin puntos en ranking, intentar mapear por nombre de categoría del jugador
      setAscensoCatOrigen("");
      setAscensoPuntosOrigen(0);
    }
  };

  const guardarAscenso = async () => {
    if (!ascensoJugadorId || !ascensoCatOrigen || !ascensoCatDestino) {
      toast.error("Completá todos los campos");
      return;
    }
    if (ascensoCatOrigen === ascensoCatDestino) {
      toast.error("La categoría destino debe ser diferente a la origen");
      return;
    }
    setSavingAscenso(true);
    const ptsTransferidos = Math.floor(ascensoPuntosOrigen / 2);
    const { error } = await supabase.from("ascensos").insert({
      jugador_id: ascensoJugadorId,
      categoria_origen_id: ascensoCatOrigen,
      categoria_destino_id: ascensoCatDestino,
      puntos_origen: ascensoPuntosOrigen,
      puntos_transferidos: ptsTransferidos,
      anio: filtroAnio,
      notas: ascensoNotas || null,
    });
    if (error) {
      toast.error("Error al guardar: " + error.message);
      setSavingAscenso(false);
      return;
    }
    // Actualizar categoría del jugador
    await supabase.from("jugadores").update({ categoria_id: ascensoCatDestino }).eq("id", ascensoJugadorId);
    toast.success(`Ascenso registrado. ${ptsTransferidos} puntos transferidos.`);
    setSavingAscenso(false);
    setAscensoOpen(false);
    resetAscensoForm();
    cargarRanking();
    cargarAscensos();
  };

  const resetAscensoForm = () => {
    setAscensoJugadorId("");
    setAscensoCatOrigen("");
    setAscensoCatDestino("");
    setAscensoPuntosOrigen(0);
    setAscensoNotas("");
    setAscensoJugadorBusqueda("");
    setAscensoJugadores([]);
  };

  const cargarAscensos = async () => {
    const { data } = await supabase
      .from("ascensos")
      .select("*")
      .eq("anio", filtroAnio)
      .order("fecha", { ascending: false });
    if (!data || data.length === 0) { setAscensosList([]); return; }
    const jugIds = Array.from(new Set(data.map((a) => a.jugador_id)));
    const { data: jugs } = await supabase.from("jugadores").select("id, nombre, apellido").in("id", jugIds);
    setAscensosList(data.map((a) => {
      const j = jugs?.find((x) => x.id === a.jugador_id);
      return { ...a, jugador_nombre: j?.nombre, jugador_apellido: j?.apellido };
    }));
  };

  const eliminarAscenso = async (id: string) => {
    const { error } = await supabase.from("ascensos").delete().eq("id", id);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Ascenso eliminado");
    cargarAscensos();
    cargarRanking();
  };

  useEffect(() => {
    if (!loading) cargarAscensos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio, loading]);

  // Categorías del mismo género para ascensos
  const categoriasOrigenGenero = useMemo(() => {
    if (!ascensoCatOrigen) return categorias;
    const catOrigen = categorias.find(c => c.id === ascensoCatOrigen);
    if (!catOrigen) return categorias;
    return categorias.filter(c => c.genero === catOrigen.genero);
  }, [ascensoCatOrigen, categorias]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Ranking
          </h1>
          <p className="text-sm text-muted-foreground">
            Puntaje acumulado por jugador. Define quiénes clasifican al Master de fin de año.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { resetAscensoForm(); setAscensoOpen(true); }}>
            <ArrowUpCircle className="h-4 w-4" />
            Registrar ascenso
          </Button>
          <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
                Tabla de puntos
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Puntos por instancia</DialogTitle>
                <DialogDescription>
                  Define cuántos puntos otorga cada instancia alcanzada en un torneo. La 4ta fecha
                  multiplica los puntos x2 (configurable por torneo). Después de cambiar los valores,
                  recalculá los torneos finalizados para aplicar la nueva tabla.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {puntosCfg.map((p) => (
                  <div key={p.instancia} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{INSTANCIA_LABEL[p.instancia]}</span>
                    <Input
                      type="number"
                      min="0"
                      value={p.puntos}
                      onChange={(e) => updatePunto(p.instancia, e.target.value)}
                      className="w-24 h-8 text-right"
                    />
                    <span className="text-xs text-muted-foreground w-10">pts</span>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCfgOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={guardarPuntos} disabled={savingCfg}>
                  <Save className="h-4 w-4" />
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Año</label>
            <Select value={String(filtroAnio)} onValueChange={(v) => setFiltroAnio(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aniosDisp.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Categoría</label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Género</label>
            <Select value={filtroGenero} onValueChange={setFiltroGenero}>
              <SelectTrigger>
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
          <div>
            <label className="text-xs text-muted-foreground">Buscar jugador</label>
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, apellido o club"
            />
          </div>
        </CardContent>
      </Card>

      {cupoActual !== null && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-primary" />
              <span>
                Clasifican al <strong>Master</strong> los primeros{" "}
                <strong>{cupoActual}</strong> jugadores de esta categoría.
              </span>
            </div>
            <Dialog
              open={cupoOpen}
              onOpenChange={(o) => {
                setCupoOpen(o);
                if (o) setCupoEdit(String(cupoActual));
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Settings className="h-3.5 w-3.5" />
                  Editar cupos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cupos al Master</DialogTitle>
                  <DialogDescription>
                    ¿Cuántos jugadores de esta categoría clasifican al Master? Por defecto son 16,
                    salvo Suma 7 que son 8.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  type="number"
                  min="1"
                  value={cupoEdit}
                  onChange={(e) => setCupoEdit(e.target.value)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCupoOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={guardarCupo}>
                    <Save className="h-4 w-4" />
                    Guardar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando...</p>
          ) : filtradas.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay puntos cargados con esos filtros. Finalizá un torneo y recalculá su ranking
              desde la página de Torneos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Jugador</TableHead>
                  <TableHead className="hidden sm:table-cell">Club</TableHead>
                  <TableHead className="text-center">Torneos</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((r, idx) => {
                  const clasifica = cupoActual !== null && idx < cupoActual && !busqueda.trim();
                  return (
                    <TableRow key={r.jugador_id} className={clasifica ? "bg-primary/5" : ""}>
                      <TableCell>
                        <div className="flex items-center justify-center">{medalla(idx)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          {r.jugador_apellido}, {r.jugador_nombre}
                          {clasifica && <Star className="h-3 w-3 text-primary fill-primary" />}
                        </div>
                        {r.jugador_club && (
                          <div className="sm:hidden text-xs text-muted-foreground">{r.jugador_club}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {r.jugador_club ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{r.torneos}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {r.puntos}
                        {r.puntos_ascenso > 0 && (
                          <span className="text-xs text-primary ml-1" title="Incluye puntos por ascenso">
                            (+{r.puntos_ascenso})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => abrirDetalle(r)}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detalleJugador
                ? `${detalleJugador.jugador_apellido}, ${detalleJugador.jugador_nombre}`
                : "Detalle"}
            </DialogTitle>
            <DialogDescription>
              Desglose de puntos por torneo en {filtroAnio}
              {detalleJugador?.jugador_club ? ` · ${detalleJugador.jugador_club}` : ""}
            </DialogDescription>
          </DialogHeader>
          {loadingDetalle ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Cargando...</p>
          ) : detalleData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay torneos cargados para este jugador con los filtros actuales.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {detalleData.map((d, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{d.torneo_nombre}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      {d.fecha && <span>{new Date(d.fecha).toLocaleDateString()}</span>}
                      {d.numero_fecha && (
                        <Badge variant="outline" className="h-4 px-1 text-[10px]">
                          Fecha {d.numero_fecha}
                        </Badge>
                      )}
                      <span>· {INSTANCIA_LABEL[d.instancia]}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-base">{d.puntos}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {d.puntos_base}
                      {d.multiplicador !== 1 && ` × ${d.multiplicador}`}
                    </div>
                  </div>
                </div>
              ))}
              {detalleJugador && detalleJugador.puntos_ascenso > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      <ArrowUpCircle className="h-3.5 w-3.5 text-primary" />
                      Puntos por ascenso
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Transferidos de categoría anterior (50%)</div>
                  </div>
                  <div className="font-bold text-base">{detalleJugador.puntos_ascenso}</div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t font-semibold">
                <span>Total</span>
                <span>{(detalleData.reduce((acc, d) => acc + d.puntos, 0) + (detalleJugador?.puntos_ascenso ?? 0))} pts</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Ascenso */}
      <Dialog open={ascensoOpen} onOpenChange={(o) => { setAscensoOpen(o); if (!o) resetAscensoForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5" />
              Registrar ascenso
            </DialogTitle>
            <DialogDescription>
              El jugador sube de categoría y se transfiere la mitad de sus puntos a la nueva categoría.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Buscar jugador</label>
              <Input
                value={ascensoJugadorBusqueda}
                onChange={(e) => buscarJugadoresAscenso(e.target.value)}
                placeholder="Nombre o apellido..."
              />
              {ascensoJugadores.length > 0 && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                  {ascensoJugadores.map((j) => {
                    const catLabel = j.cat_nombre;
                    return (
                      <button
                        key={j.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between"
                        onClick={() => seleccionarJugadorAscenso(j)}
                      >
                        <span>{j.apellido}, {j.nombre}</span>
                        {catLabel && <span className="text-muted-foreground text-xs">{catLabel}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {ascensoJugadorId && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Categoría origen</label>
                  <Select value={ascensoCatOrigen} onValueChange={async (catId) => {
                    setAscensoCatOrigen(catId);
                    // Recalcular puntos para la categoría seleccionada
                    const { data: rd } = await supabase
                      .from("ranking_jugadores")
                      .select("puntos")
                      .eq("jugador_id", ascensoJugadorId)
                      .eq("categoria_id", catId)
                      .eq("anio", filtroAnio);
                    const totalT = (rd ?? []).reduce((acc, r) => acc + r.puntos, 0);
                    const { data: ap } = await supabase
                      .from("ascensos")
                      .select("puntos_transferidos")
                      .eq("jugador_id", ascensoJugadorId)
                      .eq("categoria_destino_id", catId)
                      .eq("anio", filtroAnio);
                    const totalA = (ap ?? []).reduce((acc, a) => acc + a.puntos_transferidos, 0);
                    setAscensoPuntosOrigen(totalT + totalA);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Categoría destino (a la que asciende)</label>
                  <Select value={ascensoCatDestino} onValueChange={setAscensoCatDestino}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {categoriasOrigenGenero.filter(c => c.id !== ascensoCatOrigen).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md border p-3 bg-muted/30 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Puntos en categoría origen</span>
                    <span className="font-bold">{ascensoPuntosOrigen}</span>
                  </div>
                  <div className="flex justify-between text-sm text-primary">
                    <span>Puntos transferidos (50%)</span>
                    <span className="font-bold">{Math.floor(ascensoPuntosOrigen / 2)}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notas (opcional)</label>
                  <Input value={ascensoNotas} onChange={(e) => setAscensoNotas(e.target.value)} placeholder="Ej: Ascenso por decisión del comité" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAscensoOpen(false)}>Cancelar</Button>
            <Button onClick={guardarAscenso} disabled={savingAscenso || !ascensoJugadorId}>
              <Save className="h-4 w-4" />
              Confirmar ascenso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista de ascensos */}
      {ascensosList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Ascensos registrados ({filtroAnio})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jugador</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>A</TableHead>
                  <TableHead className="text-right">Pts transferidos</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ascensosList.map((a) => {
                  const catOr = categorias.find(c => c.id === a.categoria_origen_id);
                  const catDe = categorias.find(c => c.id === a.categoria_destino_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.jugador_apellido}, {a.jugador_nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{catOr?.nombre ?? "?"}</TableCell>
                      <TableCell className="text-sm">{catDe?.nombre ?? "?"}</TableCell>
                      <TableCell className="text-right font-bold">{a.puntos_transferidos}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => eliminarAscenso(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
