import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, MapPin, CheckCircle2, Share2, Plus, Loader2, Tv, ExternalLink, Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { activeTenant } from "@/lib/tenant";
import { uploadPartidoPhoto, persistPartidoPhoto } from "@/lib/partidoPhotoUpload";

type Torneo = { id: string; nombre: string; estado?: string; modalidad?: string; canchas_count?: number };
type Inscripcion = { id: string; jugador1_id: string; jugador2_id: string };
type Jugador = { id: string; nombre: string; apellido: string };

type Partido = {
  id: string;
  origen: "zona" | "llave" | "individual";
  faseNombre: string;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  pareja_local_label?: string;
  pareja_visitante_label?: string;
  estado: string;
  cancha: string | null;
  fecha_hora: string | null;
  hora_display?: string | null;
  ganador_id: string | null;
  torneo_id?: string;
  fecha_num?: number;
  partido_individual_raw?: any;
};

export default function CanchasEnVivo() {
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [torneoId, setTorneoId] = useState<string>("");
  const [cantidadCanchas, setCantidadCanchas] = useState(4);
  const [tvSelectModalOpen, setTvSelectModalOpen] = useState(false);
  
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
  const [fotoCanchaEnVivo, setFotoCanchaEnVivo] = useState<string>("");
  const [isUploadingFotoCancha, setIsUploadingFotoCancha] = useState(false);
  
  const [descargando, setDescargando] = useState(false);
  const flyerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("torneos")
      .select("id, nombre, estado, modalidad, canchas_count")
      .neq("estado", "cancelado")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const torneosData = (data as Torneo[]) ?? [];
        setTorneos(torneosData);
        if (torneosData.length > 0 && !torneoId) {
          setTorneoId(torneosData[0].id);
          if (torneosData[0].canchas_count) {
            setCantidadCanchas(torneosData[0].canchas_count);
          }
        }
      });
  }, []);

  const torneoActivoSeleccionado = useMemo(() => {
    return torneos.find(t => t.id === torneoId);
  }, [torneos, torneoId]);

  useEffect(() => {
    if (torneoActivoSeleccionado?.canchas_count) {
      setCantidadCanchas(torneoActivoSeleccionado.canchas_count);
    }
  }, [torneoActivoSeleccionado]);

  const handleOpenTvMode = (targetTorneoId?: string) => {
    const selectedId = targetTorneoId || (torneoId !== "todos" && torneoId ? torneoId : torneos[0]?.id);
    if (!selectedId) {
      toast.error("No hay torneos registrados para proyectar en TV");
      return;
    }
    if (!targetTorneoId && (torneoId === "todos" || !torneoId) && torneos.length > 1) {
      setTvSelectModalOpen(true);
      return;
    }
    window.open(`/torneo-individual/${selectedId}/tv`, "_blank");
  };

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

      const [{ data: zs }, { data: lls }, { data: pInd }] = await Promise.all([
        supabase.from("zonas").select("id, nombre, torneo_id").in("torneo_id", torneoIds),
        supabase.from("llaves").select("id, tamanio_cuadro, torneo_id").in("torneo_id", torneoIds),
        supabase.from("partidos_individuales").select("*").in("torneo_id", torneoIds).order("fecha", { ascending: false }),
      ]);

      const tMap = new Map(torneos.map(t => [t.id, t.nombre]));
      const jugsMap = new Map((jugs ?? []).map(j => [j.id, j]));
      let partsArr: Partido[] = [];

      // 1. Partidos tradicionales por Zonas
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
              origen: "zona" as const,
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

      // 2. Partidos tradicionales por Llaves
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
              origen: "llave" as const,
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

      // 3. Partidos de Torneos Semanales / Individuales / Desafíos / Liga de Parejas
      if (pInd && pInd.length > 0) {
        partsArr = partsArr.concat(pInd.map(p => {
          const tNombre = tMap.get(p.torneo_id) || "";
          const prefix = torneoId === "todos" && tNombre ? `${tNombre.split(' ')[0]} - ` : "";

          const j1 = jugsMap.get(p.jugador1_id);
          const j2 = jugsMap.get(p.jugador2_id);
          const j3 = jugsMap.get(p.jugador3_id);
          const j4 = jugsMap.get(p.jugador4_id);

          const pareja1Label = `${j1 ? `${j1.apellido}, ${j1.nombre}` : (p.suplente1_nombre || "?")} / ${j2 ? `${j2.apellido}, ${j2.nombre}` : (p.suplente2_nombre || "?")}`;
          const pareja2Label = `${j3 ? `${j3.apellido}, ${j3.nombre}` : (p.suplente3_nombre || "?")} / ${j4 ? `${j4.apellido}, ${j4.nombre}` : (p.suplente4_nombre || "?")}`;

          let fechaHoraStr = null;
          if (p.fecha_programada) {
            fechaHoraStr = p.hora_programada 
              ? `${p.fecha_programada}T${p.hora_programada}` 
              : `${p.fecha_programada}T00:00:00`;
          }

          const horaDisplay = p.hora_programada ? p.hora_programada.substring(0, 5) + " hs" : null;

          return {
            id: p.id,
            origen: "individual" as const,
            faseNombre: `${prefix}Fecha ${p.fecha || 1}`,
            pareja_local_id: p.id + "-p1",
            pareja_visitante_id: p.id + "-p2",
            pareja_local_label: pareja1Label,
            pareja_visitante_label: pareja2Label,
            estado: p.estado,
            cancha: p.cancha,
            fecha_hora: fechaHoraStr,
            hora_display: horaDisplay,
            ganador_id: (p.sets_pareja1 ?? 0) > (p.sets_pareja2 ?? 0) ? p.id + "-p1" : (p.sets_pareja2 ?? 0) > (p.sets_pareja1 ?? 0) ? p.id + "-p2" : null,
            torneo_id: p.torneo_id,
            fecha_num: p.fecha,
            partido_individual_raw: p,
          };
        }));
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

  const parseCanchaNum = (canchaStr: string | null | undefined): string | null => {
    if (!canchaStr) return null;
    const match = canchaStr.match(/\d+/);
    return match ? match[0] : null;
  };

  const parejaLabel = (pIdOrInsId: string | null, partido?: Partido): string => {
    if (!pIdOrInsId) return "Por definir";
    if (partido?.origen === "individual") {
      if (pIdOrInsId === partido.pareja_local_id) return partido.pareja_local_label || "Pareja 1";
      if (pIdOrInsId === partido.pareja_visitante_id) return partido.pareja_visitante_label || "Pareja 2";
    }
    const found = partidos.find(p => p.pareja_local_id === pIdOrInsId || p.pareja_visitante_id === pIdOrInsId);
    if (found && found.origen === "individual") {
      return pIdOrInsId === found.pareja_local_id 
        ? (found.pareja_local_label || "Pareja 1")
        : (found.pareja_visitante_label || "Pareja 2");
    }
    const ins = inscripciones.find((i) => i.id === pIdOrInsId);
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
    
    const toastId = toast.loading("Asignando...");
    try {
      if (p.origen === "individual") {
        const { error } = await supabase
          .from("partidos_individuales")
          .update({ cancha: `Cancha ${cancha}`, estado: "en_juego" })
          .eq("id", p.id);
        if (error) throw error;
      } else {
        const tabla = p.origen === "zona" ? "partidos_zona" : "partidos_llave";
        const { error } = await supabase.from(tabla).update({ cancha: cancha, estado: "en_juego" }).eq("id", p.id);
        if (error) throw error;
      }
      toast.success("Partido en juego", { id: toastId });
      setAsignarCanchaNum(null);
      cargarDatos();
    } catch (err: any) {
      toast.error("Error al asignar: " + (err?.message || ""), { id: toastId });
    }
  };

  const abrirCargarResultado = (p: Partido) => {
    setPartidoCargar(p);
    setSets([{ local: "", visitante: "" }, { local: "", visitante: "" }, { local: "", visitante: "" }]);
    setGanadorSeleccionado(null);
    setFotoCanchaEnVivo(p.partido_individual_raw?.foto_url || "");
    setIsUploadingFotoCancha(false);
  };

  const tieneSetCargado = useMemo(() => {
    return sets.some(s => s.local !== "" && s.visitante !== "");
  }, [sets]);

  const guardarResultadoParcial = async () => {
    if (!partidoCargar) return;
    const toastId = toast.loading("Guardando resultado parcial...");
    
    try {
      if (partidoCargar.origen === "individual") {
        await supabase
          .from("sets_partido_individual")
          .delete()
          .eq("partido_individual_id", partidoCargar.id);

        const inserts = sets
          .map((s, i) => ({
            partido_individual_id: partidoCargar.id,
            numero_set: i + 1,
            games_pareja1: parseInt(s.local),
            games_pareja2: parseInt(s.visitante),
          }))
          .filter(s => !isNaN(s.games_pareja1) && !isNaN(s.games_pareja2));

        if (inserts.length > 0) {
          await supabase.from("sets_partido_individual").insert(inserts);
        }

        await supabase
          .from("partidos_individuales")
          .update({ estado: "en_juego" })
          .eq("id", partidoCargar.id);
      } else {
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
      }

      toast.success("Resultado guardado", { id: toastId });
      setPartidoCargar(null);
      cargarDatos();
    } catch (e: any) {
      toast.error("Ocurrió un error: " + (e?.message || ""), { id: toastId });
    }
  };

  const guardarResultado = async () => {
    if (!partidoCargar || !ganadorSeleccionado) return;
    const toastId = toast.loading("Guardando...");
    
    try {
      if (partidoCargar.origen === "individual") {
        await supabase
          .from("sets_partido_individual")
          .delete()
          .eq("partido_individual_id", partidoCargar.id);

        const inserts = sets
          .map((s, i) => ({
            partido_individual_id: partidoCargar.id,
            numero_set: i + 1,
            games_pareja1: parseInt(s.local),
            games_pareja2: parseInt(s.visitante),
          }))
          .filter(s => !isNaN(s.games_pareja1) && !isNaN(s.games_pareja2));

        if (inserts.length === 0) {
          toast.error("Debe ingresar los resultados de los sets para marcar un ganador.", { id: toastId });
          return;
        }

        await supabase.from("sets_partido_individual").insert(inserts);

        const setsP1 = inserts.filter(s => s.games_pareja1 > s.games_pareja2).length;
        const setsP2 = inserts.filter(s => s.games_pareja2 > s.games_pareja1).length;

        await supabase
          .from("partidos_individuales")
          .update({
            estado: "finalizado",
            sets_pareja1: setsP1,
            sets_pareja2: setsP2,
          })
          .eq("id", partidoCargar.id);

        if (fotoCanchaEnVivo) {
          const tId = partidoCargar.torneo_id || (torneoId !== "todos" ? torneoId : "");
          if (tId) {
            const { data: tData } = await supabase.from("torneos").select("notas").eq("id", tId).single();
            await persistPartidoPhoto(tId, partidoCargar.id, fotoCanchaEnVivo, tData?.notas);
          }
        }
      } else {
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
      }

      toast.success("Resultado guardado y partido finalizado", { id: toastId });
      setPartidoCargar(null);
      cargarDatos();
    } catch (e: any) {
      toast.error("Ocurrió un error: " + (e?.message || ""), { id: toastId });
    }
  };

  const liberarCancha = async (p: Partido) => {
    try {
      if (p.origen === "individual") {
        await supabase
          .from("partidos_individuales")
          .update({ cancha: null, estado: "pendiente" })
          .eq("id", p.id);
      } else {
        const tabla = p.origen === "zona" ? "partidos_zona" : "partidos_llave";
        await supabase.from(tabla).update({ cancha: null, estado: "programado" }).eq("id", p.id);
      }
      cargarDatos();
    } catch (err) {
      console.error(err);
    }
  };

  const descargarImagen = async () => {
    if (!flyerRef.current) return;
    setDescargando(true);
    try {
      const dataUrl = await toPng(flyerRef.current, {
        cacheBust: true,
        backgroundColor: "#0f172a", // Dark bg
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: flyerRef.current.offsetWidth + "px",
          height: flyerRef.current.offsetHeight + "px",
          opacity: "1",
          position: "relative",
          top: "0",
          left: "0"
        },
        pixelRatio: 2,
        fontEmbedCSS: ''
      });
      const link = document.createElement("a");
      link.download = `Canchas-En-Vivo.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Flyer descargado");
    } catch (error) {
      toast.error("Error al generar flyer");
    } finally {
      setDescargando(false);
    }
  };

  const compartirImagen = async () => {
    if (!flyerRef.current) return;
    setDescargando(true);
    try {
      const dataUrl = await toPng(flyerRef.current, {
        cacheBust: true,
        backgroundColor: "#0f172a", // Dark bg
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
          width: flyerRef.current.offsetWidth + "px",
          height: flyerRef.current.offsetHeight + "px",
          opacity: "1",
          position: "relative",
          top: "0",
          left: "0"
        },
        pixelRatio: 2,
        fontEmbedCSS: ''
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `Canchas-En-Vivo.png`, { type: "image/png" });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Torre de Control",
          text: "Mirá los partidos en vivo",
          files: [file],
        });
      } else {
        toast.error("Tu navegador no soporta compartir directamente. Se descargará la imagen.");
        const link = document.createElement("a");
        link.download = `Canchas-En-Vivo.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      toast.error("Error al compartir flyer");
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
          <Button
            size="sm"
            onClick={() => handleOpenTvMode()}
            className="h-8 border border-cyan-500/60 bg-gradient-to-r from-cyan-500/20 via-purple-600/20 to-cyan-500/20 hover:from-cyan-500/30 hover:to-cyan-500/30 text-cyan-600 dark:text-[#00f5d4] hover:text-cyan-700 dark:hover:text-[#00f5d4] font-bold text-xs gap-1.5 shadow-[0_0_15px_rgba(0,245,212,0.2)] transition-all shrink-0"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f5d4] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f5d4]"></span>
            </span>
            <Tv className="h-4 w-4 text-[#00f5d4]" />
            <span>Abrir Modo Pantalla TV</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </Button>

          <Button variant="outline" size="sm" onClick={descargarImagen} disabled={descargando} className="gap-2 text-xs h-7">
            {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>}
            Descargar
          </Button>
          <Button variant="outline" size="sm" onClick={compartirImagen} disabled={descargando} className="gap-2 text-xs h-7">
            {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Compartir IG
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

      {/* Banner Cyber Neon de Acceso Directo a Modo Pantalla TV */}
      <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-[#0a0a14] via-[#0f172a] to-[#0a0a14] p-4 shadow-[0_0_20px_rgba(0,245,212,0.08)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-[#8338ec] to-[#00f5d4] p-[1.5px] shadow-[0_0_15px_rgba(0,245,212,0.25)] shrink-0">
            <div className="w-full h-full bg-[#0a0a14] rounded-[10px] flex items-center justify-center">
              <Tv className="h-5 w-5 text-[#00f5d4] animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm md:text-base font-extrabold text-white tracking-wide">
                Modo Pantalla TV Gigante
              </h2>
              <Badge className="bg-[#00f5d4]/20 text-[#00f5d4] border border-[#00f5d4]/40 text-[9px] uppercase font-bold tracking-wider">
                Cyber Neon · Smart TV 16:9
              </Badge>
              {torneoActivoSeleccionado && (
                <Badge variant="outline" className="text-[10px] text-neutral-300 border-white/20">
                  {torneoActivoSeleccionado.nombre}
                </Badge>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Transmisión optimizada para el Smart TV o proyector del complejo: marcador LED en tiempo real, fotos multimedia de parejas, reloj digital y tabla rotativa.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
          <Button
            onClick={() => handleOpenTvMode()}
            className="w-full md:w-auto border border-cyan-500/60 bg-gradient-to-r from-cyan-500/25 via-purple-600/25 to-cyan-500/25 hover:from-cyan-500/40 hover:to-cyan-500/40 text-cyan-600 dark:text-[#00f5d4] hover:text-cyan-700 dark:hover:text-[#00f5d4] font-bold text-xs gap-2 shadow-[0_0_20px_rgba(0,245,212,0.25)] transition-all h-9"
          >
            <Tv className="h-4 w-4 text-[#00f5d4]" />
            <span>Abrir Modo Pantalla TV</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </Button>
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
            const partidosEnCancha = partidosActivos.filter(p => {
              const cNum = parseCanchaNum(p.cancha);
              return cNum === numeroCancha || p.cancha === numeroCancha || p.cancha === `Cancha ${numeroCancha}`;
            });
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
                          {parejaLabel(enJuego.pareja_local_id, enJuego)}
                        </div>
                        <div className="text-[10px] text-muted-foreground text-center italic font-bold uppercase tracking-widest">Versus</div>
                        <div className="font-semibold text-sm truncate p-2 bg-muted/30 rounded border border-border/50">
                          {parejaLabel(enJuego.pareja_visitante_id, enJuego)}
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
                                {p.hora_display || (p.fecha_hora ? new Date(p.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sin hora')}
                              </span>
                              <span className="text-[9px] text-muted-foreground uppercase font-bold">
                                {p.faseNombre}
                              </span>
                            </div>
                            <p className="truncate text-foreground font-semibold text-xs">{parejaLabel(p.pareja_local_id, p)}</p>
                            <p className="truncate text-foreground font-semibold text-xs">{parejaLabel(p.pareja_visitante_id, p)}</p>
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
                    <p className="text-sm font-medium truncate">{parejaLabel(p.pareja_local_id, p)}</p>
                    <p className="text-sm font-medium truncate">{parejaLabel(p.pareja_visitante_id, p)}</p>
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
                  <span className="text-xs whitespace-normal line-clamp-2">{parejaLabel(partidoCargar.pareja_local_id, partidoCargar)}</span>
                </Button>
                <span className="text-muted-foreground text-xs font-bold px-2">VS</span>
                <Button 
                  variant={ganadorSeleccionado === partidoCargar.pareja_visitante_id ? "default" : "outline"}
                  className="h-auto py-2 flex flex-col gap-1"
                  onClick={() => setGanadorSeleccionado(partidoCargar.pareja_visitante_id)}
                >
                  <span className="text-[10px] uppercase opacity-70">Ganador</span>
                  <span className="text-xs whitespace-normal line-clamp-2">{parejaLabel(partidoCargar.pareja_visitante_id, partidoCargar)}</span>
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

              {/* Foto de Partido para Pantalla TV */}
              <div className="space-y-2 p-2.5 rounded-lg border border-border/60 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-primary" /> Foto del Partido (TV)
                  </span>
                  {fotoCanchaEnVivo && (
                    <span className="text-[9px] font-bold text-[#00f5d4]">✓ Adjunta</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold cursor-pointer shrink-0">
                    <Upload className="h-3 w-3" />
                    {isUploadingFotoCancha ? "..." : "Subir Foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingFotoCancha}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        const tId = partidoCargar.torneo_id || (torneoId !== "todos" ? torneoId : "");
                        if (!file || !tId) return;
                        try {
                          setIsUploadingFotoCancha(true);
                          const url = await uploadPartidoPhoto(file, tId, partidoCargar.id);
                          setFotoCanchaEnVivo(url);
                          toast.success("Foto cargada con éxito");
                        } catch (err: any) {
                          toast.error("Error al procesar foto: " + (err?.message || ""));
                        } finally {
                          setIsUploadingFotoCancha(false);
                        }
                      }}
                    />
                  </label>
                  <Input
                    value={fotoCanchaEnVivo}
                    onChange={(e) => setFotoCanchaEnVivo(e.target.value)}
                    placeholder="URL directa de foto..."
                    className="text-xs h-8 flex-1"
                  />
                  {fotoCanchaEnVivo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive px-1.5"
                      onClick={() => setFotoCanchaEnVivo("")}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
                {fotoCanchaEnVivo && (
                  <div className="w-full h-20 rounded-md overflow-hidden border border-border">
                    <img src={fotoCanchaEnVivo} alt="Foto" className="w-full h-full object-cover" />
                  </div>
                )}
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

      {/* Modal Cyber Neon para seleccionar torneo al transmitir a TV */}
      <Dialog open={tvSelectModalOpen} onOpenChange={setTvSelectModalOpen}>
        <DialogContent className="max-w-md bg-[#0a0a14] border border-[#00f5d4]/40 text-white shadow-[0_0_30px_rgba(0,245,212,0.15)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-white font-extrabold text-base">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#8338ec] to-[#00f5d4] p-[1.5px] flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(0,245,212,0.3)]">
                <div className="w-full h-full bg-[#0a0a14] rounded-[9px] flex items-center justify-center">
                  <Tv className="h-4 w-4 text-[#00f5d4]" />
                </div>
              </div>
              Seleccionar Torneo para Pantalla TV
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-neutral-400">
            Elige el torneo que deseas proyectar en la pantalla gigante o Smart TV del club:
          </p>
          <div className="space-y-2 mt-2 max-h-[320px] overflow-y-auto pr-1">
            {torneos.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTvSelectModalOpen(false);
                  window.open(`/torneo-individual/${t.id}/tv`, "_blank");
                }}
                className="w-full text-left p-3 rounded-lg border border-white/10 hover:border-[#00f5d4]/50 bg-white/5 hover:bg-[#00f5d4]/10 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-[#00f5d4] transition-colors">
                    {t.nombre}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {t.modalidad === "liga_parejas"
                      ? "🏆 Liga de Parejas (11 Semanas)"
                      : t.modalidad === "parejas"
                      ? "Desafío Parejas"
                      : "Americano Individual / Torneo"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#00f5d4] font-bold opacity-80 group-hover:opacity-100 shrink-0 ml-2">
                  <span>Proyectar TV</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTvSelectModalOpen(false)}
              className="text-neutral-400 hover:text-white"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contenedor oculto para exportar a Flyer IG (Relación de aspecto 9:16 aprox) */}
      <div 
        ref={flyerRef}
        className="fixed top-0 left-0 opacity-[0.0001] pointer-events-none w-[540px] h-[960px] bg-slate-900 text-slate-50 flex flex-col p-8 z-[-100]"
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
            const enJuego = partidosActivos.find(p => p.estado === "en_juego" && (parseCanchaNum(p.cancha) === numeroCancha || p.cancha === numeroCancha || p.cancha === `Cancha ${numeroCancha}`));
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
                    {parejaLabel(enJuego.pareja_local_id, enJuego)}
                  </div>
                  <div className="text-slate-500 font-black text-xs italic">VS</div>
                  <div className="text-left font-bold text-sm leading-tight text-slate-200">
                    {parejaLabel(enJuego.pareja_visitante_id, enJuego)}
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

