import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trophy, Trash2, Sparkles, AlertCircle, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calcularTabla, type PartidoConSets } from "@/lib/zonas";
import {
  obtenerPlantilla,
  CASOS_SOPORTADOS,
  parseRef,
  resolverRef,
  NOMBRE_RONDA,
  ORDEN_RONDA,
  type RondaLlave,
} from "@/lib/llaves";
import { PartidoCard } from "@/components/zonas/PartidoCard";
import { CompartirLlaveDialog } from "@/components/llaves/CompartirLlaveDialog";

type Torneo = { id: string; nombre: string; multiplicador_puntos: number; numero_fecha: number | null; sede?: string | null };

type Inscripcion = {
  id: string;
  jugador1: { nombre: string; apellido: string } | null;
  jugador2: { nombre: string; apellido: string } | null;
};

type ZonaRow = { id: string; nombre: string; tamanio: number; orden: number };
type ZonaParejaRow = { id: string; zona_id: string; inscripcion_id: string; posicion_siembra: number };
type PartidoZonaRow = {
  id: string;
  zona_id: string;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  ganador_id: string | null;
  estado: string;
};

type Llave = { id: string; torneo_id: string; cantidad_parejas: number; tamanio_cuadro: number };
type PartidoLlaveRow = {
  id: string;
  llave_id: string;
  numero: number;
  ronda: RondaLlave;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  ref_local: string | null;
  ref_visitante: string | null;
  partido_siguiente_id: string | null;
  posicion_siguiente: string | null;
  ganador_id: string | null;
  estado: string;
  fecha_hora: string | null;
  cancha: string | null;
};

export default function Llaves() {
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [torneoId, setTorneoId] = useState<string>(() => {
    return localStorage.getItem("ultimo_torneo_consultado") || "";
  });
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [zonas, setZonas] = useState<ZonaRow[]>([]);
  const [zonasParejas, setZonasParejas] = useState<ZonaParejaRow[]>([]);
  const [partidosZona, setPartidosZona] = useState<PartidoZonaRow[]>([]);
  const [setsZona, setSetsZona] = useState<
    Record<string, { numero_set: number; games_local: number; games_visitante: number }[]>
  >({});

  const [llave, setLlave] = useState<Llave | null>(null);
  const [partidosLlave, setPartidosLlave] = useState<PartidoLlaveRow[]>([]);
  const [autoAvance, setAutoAvance] = useState(true);
  const [setsLlave, setSetsLlave] = useState<
    Record<string, { numero_set: number; games_local: number; games_visitante: number }[]>
  >({});
  const [isCompartirOpen, setIsCompartirOpen] = useState(false);

  // Carga torneos
  useEffect(() => {
    supabase
      .from("torneos")
      .select("id, nombre, multiplicador_puntos, numero_fecha, sede")
      .eq("tipo", "oficial")
      .order("fecha_inicio", { ascending: false })
      .then(({ data }) => {
        setTorneos((data ?? []) as Torneo[]);
        
        const savedId = localStorage.getItem("ultimo_torneo_consultado");
        const exists = data?.some((t) => t.id === savedId);
        if (exists && savedId) {
          setTorneoId(savedId);
        } else if (data && data.length > 0) {
          setTorneoId(data[0].id);
          localStorage.setItem("ultimo_torneo_consultado", data[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarTodo = useCallback(async () => {
    if (!torneoId) return;

    const [{ data: insc }, { data: zs }, { data: ll }] = await Promise.all([
      supabase
        .from("inscripciones")
        .select("id, jugador1:jugadores!inscripciones_jugador1_id_fkey(nombre, apellido), jugador2:jugadores!inscripciones_jugador2_id_fkey(nombre, apellido)")
        .eq("torneo_id", torneoId)
        .eq("estado", "confirmada"),
      supabase.from("zonas").select("*").eq("torneo_id", torneoId).order("orden"),
      supabase.from("llaves").select("*").eq("torneo_id", torneoId).maybeSingle(),
    ]);

    setInscripciones((insc ?? []) as unknown as Inscripcion[]);
    setZonas((zs ?? []) as ZonaRow[]);
    setLlave((ll ?? null) as Llave | null);

    if (zs && zs.length > 0) {
      const zonaIds = zs.map((z) => z.id);
      const [{ data: zp }, { data: pz }] = await Promise.all([
        supabase.from("zonas_parejas").select("*").in("zona_id", zonaIds),
        supabase.from("partidos_zona").select("*").in("zona_id", zonaIds),
      ]);
      setZonasParejas((zp ?? []) as ZonaParejaRow[]);
      setPartidosZona((pz ?? []) as PartidoZonaRow[]);

      if (pz && pz.length > 0) {
        const ids = pz.map((p) => p.id);
        const { data: sets } = await supabase.from("sets_partido").select("*").in("partido_id", ids);
        const map: typeof setsZona = {};
        (sets ?? []).forEach((s) => {
          const key = s.partido_id;
          if (!key) return;
          if (!map[key]) map[key] = [];
          map[key].push({ numero_set: s.numero_set, games_local: s.games_local, games_visitante: s.games_visitante });
        });
        Object.keys(map).forEach((k) => map[k].sort((a, b) => a.numero_set - b.numero_set));
        setSetsZona(map);
      } else {
        setSetsZona({});
      }
    } else {
      setZonasParejas([]);
      setPartidosZona([]);
      setSetsZona({});
    }

    if (ll) {
      const { data: pl } = await supabase
        .from("partidos_llave")
        .select("*")
        .eq("llave_id", ll.id)
        .order("numero");
      setPartidosLlave((pl ?? []) as PartidoLlaveRow[]);

      if (pl && pl.length > 0) {
        const ids = pl.map((p) => p.id);
        const { data: sets } = await supabase
          .from("sets_partido")
          .select("*")
          .in("partido_llave_id", ids);
        const map: typeof setsLlave = {};
        (sets ?? []).forEach((s) => {
          const key = s.partido_llave_id;
          if (!key) return;
          if (!map[key]) map[key] = [];
          map[key].push({ numero_set: s.numero_set, games_local: s.games_local, games_visitante: s.games_visitante });
        });
        Object.keys(map).forEach((k) => map[k].sort((a, b) => a.numero_set - b.numero_set));
        setSetsLlave(map);
      } else {
        setSetsLlave({});
      }
    } else {
      setPartidosLlave([]);
      setSetsLlave({});
    }
  }, [torneoId]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const parejaLabel = useCallback(
    (id: string | null) => {
      if (!id) return "— por definir —";
      const i = inscripciones.find((x) => x.id === id);
      if (!i) return "?";
      const j1 = i.jugador1 ? `${i.jugador1.apellido}` : "?";
      const j2 = i.jugador2 ? `${i.jugador2.apellido}` : "?";
      return `${j1} / ${j2}`;
    },
    [inscripciones],
  );

  const obtenerRankingsFinalizados = useCallback(() => {
    const map: Record<string, string[]> = {};
    zonas.forEach((z) => {
      const partidosDeEstaZona = partidosZona.filter((p) => p.zona_id === z.id);
      const estaFinalizada =
        partidosDeEstaZona.length > 0 &&
        partidosDeEstaZona.every((p) => p.estado === "finalizado");

      if (estaFinalizada) {
        const parejas = zonasParejas.filter((zp) => zp.zona_id === z.id);
        const partidos = partidosDeEstaZona.map<PartidoConSets>((p) => ({
          id: p.id,
          tipo: p.tipo as any,
          pareja_local_id: p.pareja_local_id,
          pareja_visitante_id: p.pareja_visitante_id,
          ganador_id: p.ganador_id,
          estado: p.estado,
          sets: setsZona[p.id] ?? [],
        }));
        const tabla = calcularTabla(
          parejas.map((zp) => ({
            inscripcion_id: zp.inscripcion_id,
            posicion_siembra: zp.posicion_siembra,
          })),
          partidos,
        );
        
        let ordenIds = tabla.map((t) => t.inscripcion_id);
        
        // Aplicar orden manual si el usuario lo ajustó en la zona
        try {
          const raw = localStorage.getItem(`zona-orden-manual-${z.id}`);
          if (raw) {
            const saved: string[] = JSON.parse(raw);
            const tablaIds = [...ordenIds].sort().join(",");
            const savedIds = [...saved].sort().join(",");
            if (tablaIds === savedIds) {
              ordenIds = saved;
            }
          }
        } catch {
          // ignorar errores de localStorage
        }
        
        map[z.nombre.trim()] = ordenIds;
      }
    });
    return map;
  }, [zonas, partidosZona, zonasParejas, setsZona]);

  const resolverRefSiFinalizada = useCallback((ref: string | null, rankings: Record<string, string[]>) => {
    if (!ref) return null;
    const parsed = parseRef(ref);
    if (parsed.tipo !== "clasificado") return null;

    // Buscar zona normalizando nombre
    const zonaNombreNorm = parsed.zona.trim().toUpperCase();
    const ranking = Object.entries(rankings).find(([nombre]) => {
      const n = nombre.trim().toUpperCase().replace(/ZONA\s+/i, "");
      return n === zonaNombreNorm;
    })?.[1];

    if (!ranking) return null;
    return ranking[parsed.posicion - 1] || null;
  }, []);

  const formatRefLabel = useCallback((ref: string | null) => {
    if (!ref) return "— por definir —";
    const parsed = parseRef(ref);
    if (parsed.tipo === "clasificado") return `${parsed.posicion}° Zona ${parsed.zona}`;
    if (parsed.tipo === "ganador") return `Ganador P${parsed.numeroPartido}`;
    if (parsed.tipo === "manual") return parsed.label;
    return `(${ref})`;
  }, []);


  const totalParejas = inscripciones.length;
  const plantilla = useMemo(() => obtenerPlantilla(totalParejas), [totalParejas]);

  // Genera el cuadro
  const generarCuadro = async () => {
    if (!torneoId || !plantilla) return;
    try {
      // Crear llave
      const { data: nuevaLlave, error: errLlave } = await supabase
        .from("llaves")
        .insert({
          torneo_id: torneoId,
          cantidad_parejas: totalParejas,
          tamanio_cuadro: plantilla.cantidad,
        })
        .select()
        .single();
      if (errLlave) throw errLlave;

      // Crear partidos (sin pareja_local/visitante todavía, luego rellenamos)
      const partidosToInsert = plantilla.partidos.map((p) => ({
        llave_id: nuevaLlave.id,
        numero: p.numero,
        ronda: p.ronda,
        ref_local: p.ref_local,
        ref_visitante: p.ref_visitante,
      }));
      const { data: insertedPartidos, error: errPartidos } = await supabase
        .from("partidos_llave")
        .insert(partidosToInsert)
        .select();
      if (errPartidos) throw errPartidos;

      // Mapear numero → id para enlazar partido_siguiente
      const numeroToId = new Map<number, string>();
      (insertedPartidos ?? []).forEach((p) => numeroToId.set(p.numero, p.id));

      // Calcular partido_siguiente: para cada partido cuyo ref es "G:N", el partido N
      // tiene como siguiente al que lo refería. Posición = local/visitante según el slot.
      const updates: Promise<unknown>[] = [];
      for (const p of plantilla.partidos) {
        const localRef = parseRef(p.ref_local);
        const visiRef = parseRef(p.ref_visitante);
        if (localRef.tipo === "ganador") {
          const origenId = numeroToId.get(localRef.numeroPartido);
          if (origenId) {
            updates.push(
              Promise.resolve(
                supabase
                  .from("partidos_llave")
                  .update({
                    partido_siguiente_id: numeroToId.get(p.numero)!,
                    posicion_siguiente: "local",
                  })
                  .eq("id", origenId),
              ),
            );
          }
        }
        if (visiRef.tipo === "ganador") {
          const origenId = numeroToId.get(visiRef.numeroPartido);
          if (origenId) {
            updates.push(
              Promise.resolve(
                supabase
                  .from("partidos_llave")
                  .update({
                    partido_siguiente_id: numeroToId.get(p.numero)!,
                    posicion_siguiente: "visitante",
                  })
                  .eq("id", origenId),
              ),
            );
          }
        }
      }
      await Promise.all(updates);

      // Resolver refs a clasificados de zona y rellenar parejas iniciales
      // Sólo si las zonas están terminadas. Si no, se queda en blanco mostrando "1° Zona A"
      // 3. Rellenar parejas iniciales solo de zonas finalizadas
      const rankingPorZona = obtenerRankingsFinalizados();
      const rellenoUpdates: Promise<unknown>[] = [];
      
      for (const p of plantilla.partidos) {
        const localId = resolverRefSiFinalizada(p.ref_local, rankingPorZona);
        const visiId = resolverRefSiFinalizada(p.ref_visitante, rankingPorZona);
        
        if (localId || visiId) {
          rellenoUpdates.push(
            supabase
              .from("partidos_llave")
              .update({ 
                pareja_local_id: localId || null, 
                pareja_visitante_id: visiId || null 
              })
              .eq("id", numeroToId.get(p.numero)!)
          );
        }
      }
      
      if (rellenoUpdates.length > 0) {
        await Promise.all(rellenoUpdates);
      }

      toast.success(`Cuadro de ${plantilla.cantidad} parejas generado`);
      cargarTodo();
    } catch (e) {
      console.error(e);
      toast.error("Error al generar el cuadro");
    }
  };

  // Avanza ganadores cuando cambia el estado
  useEffect(() => {
    if (!autoAvance) return;
    const sync = async () => {
      const updates: Promise<unknown>[] = [];
      for (const p of partidosLlave) {
        if (p.estado !== "finalizado" || !p.ganador_id || !p.partido_siguiente_id) continue;
        const siguiente = partidosLlave.find((x) => x.id === p.partido_siguiente_id);
        if (!siguiente) continue;
        const esLocal = p.posicion_siguiente === "local";
        const valorActual = esLocal ? siguiente.pareja_local_id : siguiente.pareja_visitante_id;
        if (valorActual !== p.ganador_id) {
          const payload = esLocal
            ? { pareja_local_id: p.ganador_id }
            : { pareja_visitante_id: p.ganador_id };
          updates.push(
            Promise.resolve(
              supabase.from("partidos_llave").update(payload).eq("id", siguiente.id),
            ),
          );
        }
      }
      if (updates.length > 0) {
        await Promise.all(updates);
        cargarTodo();
      }
    };
    if (partidosLlave.length > 0) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidosLlave, autoAvance]);

  const eliminarLlave = async () => {
    if (!llave) return;
    await supabase.from("llaves").delete().eq("id", llave.id);
    toast.success("Cuadro eliminado");
    cargarTodo();
  };

  // Recalcula las parejas iniciales (las que dependen de zona) usando el ranking actual.
  // Sólo modifica partidos cuyo ref es de zona (no "G:N") y que NO tengan ganador todavía.
  const recalcularDesdeZonas = useCallback(async (silencioso = false) => {
    if (!torneoId || !partidosLlave.length) return;

    const toastId = !silencioso ? toast.loading("Recalculando parejas desde zonas...") : null;
    const rankings = obtenerRankingsFinalizados();
    let actualizados = 0;

    try {
      const updates: Promise<unknown>[] = [];

      for (const p of partidosLlave) {
        if (p.ganador_id) continue;

        const payload: any = {};
        const nuevoLocal = resolverRefSiFinalizada(p.ref_local, rankings);
        const nuevoVisi = resolverRefSiFinalizada(p.ref_visitante, rankings);

        if (nuevoLocal !== undefined && nuevoLocal !== p.pareja_local_id) {
          payload.pareja_local_id = nuevoLocal;
        }
        if (nuevoVisi !== undefined && nuevoVisi !== p.pareja_visitante_id) {
          payload.pareja_visitante_id = nuevoVisi;
        }

        if (Object.keys(payload).length > 0) {
          actualizados++;
          updates.push(
            supabase.from("partidos_llave").update(payload).eq("id", p.id)
          );
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        await cargarTodo();
      }

      if (!silencioso && toastId) {
        if (actualizados > 0) {
          toast.success(`Sincronización completada. Se actualizaron ${actualizados} partidos.`, { id: toastId });
        } else {
          toast.info("No hubo cambios necesarios.", { id: toastId });
        }
      }
    } catch (e: any) {
      console.error(e);
      if (!silencioso && toastId) toast.error("Error al recalcular");
    }
  }, [torneoId, partidosLlave, obtenerRankingsFinalizados, resolverRefSiFinalizada, cargarTodo]);

  // Se eliminó el auto-recalcular desde zonas automático para evitar que
  // sobrescriba las ediciones manuales de los cruces de la llave.
  // El usuario debe usar el botón "Recalcular desde zonas" si desea sincronizar.

  // Agrupar partidos por ronda
  const partidosPorRonda = useMemo(() => {
    const map = new Map<RondaLlave, PartidoLlaveRow[]>();
    partidosLlave.forEach((p) => {
      const arr = map.get(p.ronda) ?? [];
      arr.push(p);
      map.set(p.ronda, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => ORDEN_RONDA[a] - ORDEN_RONDA[b]);
  }, [partidosLlave]);

  const campeon = useMemo(() => {
    const final = partidosLlave.find((p) => p.ronda === "final");
    if (!final?.ganador_id) return null;
    return parejaLabel(final.ganador_id);
  }, [partidosLlave, parejaLabel]);

  const todasZonasFinalizadas = useMemo(() => {
    if (zonas.length === 0) return true;
    if (partidosZona.length === 0) return false;
    return partidosZona.every((p) => p.estado === "finalizado");
  }, [zonas, partidosZona]);

  if (torneos.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Llaves</h1>
        <p className="text-muted-foreground">No hay torneos oficiales creados todavía.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">Llaves</h1>
            {(() => {
              const t = torneos.find((x) => x.id === torneoId);
              if (!t || Number(t.multiplicador_puntos) < 2) return null;
              return (
                <Badge className="bg-primary text-primary-foreground">
                  x{Number(t.multiplicador_puntos)} puntos
                </Badge>
              );
            })()}
          </div>
          <p className="text-sm text-muted-foreground">
            Cuadro eliminatorio según manual APA.
          </p>
        </div>
        <Select value={torneoId} onValueChange={(val) => {
          setTorneoId(val);
          localStorage.setItem("ultimo_torneo_consultado", val);
        }}>
          <SelectTrigger className="w-full md:w-[280px]">
            <SelectValue placeholder="Elegí un torneo" />
          </SelectTrigger>
          <SelectContent>
            {torneos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nombre}{Number(t.multiplicador_puntos) >= 2 ? ` · x${Number(t.multiplicador_puntos)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!llave && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generar cuadro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Parejas inscriptas</p>
                <p className="font-semibold text-lg">{totalParejas}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Zonas armadas</p>
                <p className="font-semibold text-lg">{zonas.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Partidos zona</p>
                <p className="font-semibold text-lg">
                  {partidosZona.filter((p) => p.estado === "finalizado").length}/{partidosZona.length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cuadro APA</p>
                <p className="font-semibold text-lg">
                  {plantilla ? `${plantilla.cantidad} parejas` : totalParejas >= 6 && totalParejas <= 48 ? `${totalParejas} (manual)` : "—"}
                </p>
              </div>
            </div>

            {!plantilla && totalParejas >= 6 && totalParejas <= 48 && (
              <div className="flex items-start gap-2 rounded border border-muted bg-muted/30 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Cuadro APA disponible para consulta</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Los cruces automáticos están cargados para {CASOS_SOPORTADOS.join(", ")} parejas.
                    Para {totalParejas} parejas, consultá la imagen oficial del manual APA debajo y
                    cargá los partidos manualmente. Estamos agregando más cuadros progresivamente.
                  </p>
                </div>
              </div>
            )}

            {!plantilla && (totalParejas < 6 || totalParejas > 48) && (
              <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Cantidad fuera de rango</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    El manual APA cubre cuadros de 6 a 48 parejas. Tenés {totalParejas}.
                  </p>
                </div>
              </div>
            )}

            {plantilla && !todasZonasFinalizadas && (
              <div className="flex items-start gap-2 rounded border border-muted bg-muted/30 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Hay partidos de zona pendientes</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Podés generar el cuadro igual: las parejas se irán resolviendo a medida que
                    finalicen los partidos de zona.
                  </p>
                </div>
              </div>
            )}

            {plantilla && (
              <Button onClick={generarCuadro} className="w-full md:w-auto">
                <Sparkles className="h-4 w-4 mr-2" />
                Generar cuadro de {plantilla.cantidad} parejas
              </Button>
            )}

            {totalParejas >= 6 && totalParejas <= 48 && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">
                  Cuadro APA oficial — {totalParejas} parejas
                </p>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img
                    src={`/cuadros-apa/cuadro-${totalParejas}.jpg`}
                    alt={`Cuadro APA para ${totalParejas} parejas`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Imagen oficial del manual APA (Federación Argentina de Pádel) para guiar el armado del cuadro.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {llave && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">Cuadro de {llave.tamanio_cuadro}</Badge>
              <Badge variant="secondary">{llave.cantidad_parejas} parejas</Badge>
              {campeon && (
                <Badge className="gap-1">
                  <Trophy className="h-3 w-3" /> {campeon}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4 bg-muted/30 px-3 py-1.5 rounded-md border">
                <input
                  type="checkbox"
                  id="autoAvance"
                  checked={autoAvance}
                  onChange={(e) => setAutoAvance(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="autoAvance" className="text-sm font-medium cursor-pointer" title="Si se desactiva, el sistema no empujará automáticamente a los ganadores a la siguiente ronda (útil para hacer correcciones manuales)">
                  Auto-avance de ganadores
                </label>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsCompartirOpen(true)}>
                <Share2 className="h-4 w-4 mr-1" />
                Compartir llave
              </Button>
              <Button variant="outline" size="sm" onClick={() => recalcularDesdeZonas(false)}>
                <Sparkles className="h-4 w-4 mr-1" />
                Recalcular desde zonas
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar cuadro
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar el cuadro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borrarán todos los partidos de llave y resultados cargados. Las zonas no se
                      modifican.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={eliminarLlave}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-fit items-stretch">
              {partidosPorRonda.map(([ronda, partidos]) => (
                <div key={ronda} className="flex flex-col min-w-[260px]">
                  <h3 className="text-sm font-semibold text-center sticky top-0 bg-background py-1 mb-3 border-b">
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
                        ref_local={p.ref_local}
                        ref_visitante={p.ref_visitante}
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
                        onUpdated={cargarTodo}
                        fechaHora={p.fecha_hora}
                        cancha={p.cancha}
                        showProgramacion
                        parejasZona={inscripciones.map((i) => ({
                          inscripcion_id: i.id,
                          label: parejaLabel(i.id),
                        }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      <CompartirLlaveDialog
        isOpen={isCompartirOpen}
        onOpenChange={setIsCompartirOpen}
        torneo={torneos.find((x) => x.id === torneoId) || null}
        partidos={partidosLlave}
        setsLlave={setsLlave}
        inscripciones={inscripciones}
      />
    </div>
  );
}
