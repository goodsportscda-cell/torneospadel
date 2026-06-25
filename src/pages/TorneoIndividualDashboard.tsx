import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/Combobox";
import {
  Trophy,
  Calendar,
  Users,
  DollarSign,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Settings,
  CheckCircle2,
  CalendarDays,
  UserCheck,
  Award,
  AlertTriangle,
  HelpCircle,
  Globe
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];
type TorneoJugador = Database["public"]["Tables"]["torneo_individual_jugadores"]["Row"] & { jugador?: Jugador };
type PartidoInd = Database["public"]["Tables"]["partidos_individuales"]["Row"] & {
  jugador1?: Jugador | null;
  jugador2?: Jugador | null;
  jugador3?: Jugador | null;
  jugador4?: Jugador | null;
  sets?: SetPartidoInd[];
};
type SetPartidoInd = Database["public"]["Tables"]["sets_partido_individual"]["Row"];
type TorneoFecha = Database["public"]["Tables"]["torneo_individual_fechas"]["Row"];
type TorneoPago = Database["public"]["Tables"]["torneo_individual_pagos"]["Row"];

interface PlayerStanding {
  jugador_id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  puntos: number;
  setsGanados: number;
  setsPerdidos: number;
  gamesGanados: number;
  gamesPerdidos: number;
  difGames: number;
  partidosJugados: number;
}

export default function TorneoIndividualDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [torneo, setTorneo] = useState<Torneo | null>(null);
  const [loading, setLoading] = useState(true);

  // Data lists
  const [jugadoresInscriptos, setJugadoresInscriptos] = useState<TorneoJugador[]>([]);
  const [todosJugadores, setTodosJugadores] = useState<Jugador[]>([]);
  const [fechas, setFechas] = useState<TorneoFecha[]>([]);
  const [pagos, setPagos] = useState<TorneoPago[]>([]);
  const [partidos, setPartidos] = useState<PartidoInd[]>([]);
  const [standings, setStandings] = useState<PlayerStanding[]>([]);

  // Active selections
  const [activeTab, setActiveTab] = useState("resumen");
  const [selectedFechaNum, setSelectedFechaNum] = useState<number>(1);
  const [selectedJugadorId, setSelectedJugadorId] = useState<string>("");

  // Modals state
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [selectedPartido, setSelectedPartido] = useState<PartidoInd | null>(null);
  const [setsInput, setSetsInput] = useState<{
    set1_local: string;
    set1_visitante: string;
    set2_local: string;
    set2_visitante: string;
    set3_local: string;
    set3_visitante: string;
  }>({
    set1_local: "",
    set1_visitante: "",
    set2_local: "",
    set2_visitante: "",
    set3_local: "",
    set3_visitante: "",
  });

  const [suplentesInput, setSuplentesInput] = useState({
    suplente1: "",
    suplente2: "",
    suplente3: "",
    suplente4: "",
  });

  // Week 8 Draft modal state
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftChoices, setDraftChoices] = useState<Record<string, string>>({
    finalista1_partner: "",
    finalista2_partner: "",
    tercero1_partner: "",
    tercero2_partner: "",
  });

  // Settings modification state
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    canchas_count: "3",
    costo_fecha_jugador: "10000",
    costo_fecha_cancha: "22000",
    porcentaje_premios: "60",
  });

  const fetchTournamentData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [
        { data: tRes },
        { data: tjRes },
        { data: jRes },
        { data: fRes },
        { data: pRes },
        { data: partRes },
      ] = await Promise.all([
        supabase.from("torneos").select("*").eq("id", id).maybeSingle(),
        supabase.from("torneo_individual_jugadores").select("*, jugador:jugadores(*)").eq("torneo_id", id),
        supabase.from("jugadores").select("*").order("apellido"),
        supabase.from("torneo_individual_fechas").select("*").eq("torneo_id", id).order("fecha"),
        supabase.from("torneo_individual_pagos").select("*").eq("torneo_id", id),
        supabase.from("partidos_individuales").select("*").eq("torneo_id", id),
      ]);

      if (!tRes) {
        toast.error("No se encontró el torneo");
        navigate("/torneos");
        return;
      }

      setTorneo(tRes);
      setSettingsForm({
        canchas_count: tRes.canchas_count?.toString() ?? "3",
        costo_fecha_jugador: tRes.costo_fecha_jugador?.toString() ?? "10000",
        costo_fecha_cancha: tRes.costo_fecha_cancha?.toString() ?? "22000",
        porcentaje_premios: tRes.porcentaje_premios?.toString() ?? "60",
      });

      setJugadoresInscriptos((tjRes as TorneoJugador[]) ?? []);
      setTodosJugadores(jRes ?? []);
      setFechas(fRes ?? []);
      setPagos(pRes ?? []);

      // Fetch sets for each match
      if (partRes && partRes.length > 0) {
        const pIds = partRes.map((p) => p.id);
        const { data: setsRes } = await supabase
          .from("sets_partido_individual")
          .select("*")
          .in("partido_individual_id", pIds)
          .order("numero_set");

        const setsMap: Record<string, SetPartidoInd[]> = {};
        (setsRes ?? []).forEach((s) => {
          if (!setsMap[s.partido_individual_id]) setsMap[s.partido_individual_id] = [];
          setsMap[s.partido_individual_id].push(s);
        });

        const fullPartidos: PartidoInd[] = partRes.map((p) => ({
          ...p,
          jugador1: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador1_id)?.jugador ?? null,
          jugador2: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador2_id)?.jugador ?? null,
          jugador3: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador3_id)?.jugador ?? null,
          jugador4: (tjRes as TorneoJugador[])?.find((tj) => tj.jugador_id === p.jugador4_id)?.jugador ?? null,
          sets: setsMap[p.id] ?? [],
        }));

        setPartidos(fullPartidos);
      } else {
        setPartidos([]);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Error al cargar los datos del torneo: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchTournamentData();
  }, [fetchTournamentData]);

  // General ranking / standings calculation logic
  const computedStandings = useMemo((): PlayerStanding[] => {
    if (!torneo) return [];
    const countCanchas = torneo.canchas_count ?? 3;

    // Initialize standings map
    const standingsMap = new Map<string, PlayerStanding>();
    jugadoresInscriptos.forEach((tj) => {
      if (tj.jugador) {
        standingsMap.set(tj.jugador_id, {
          jugador_id: tj.jugador_id,
          nombre: tj.jugador.nombre,
          apellido: tj.jugador.apellido,
          dni: tj.jugador.dni,
          puntos: 0,
          setsGanados: 0,
          setsPerdidos: 0,
          gamesGanados: 0,
          gamesPerdidos: 0,
          difGames: 0,
          partidosJugados: 0,
        });
      }
    });

    // Process all finalized matches
    const finalizedMatches = partidos.filter((p) => p.estado === "finalizado");

    finalizedMatches.forEach((p) => {
      // Determine the court number (extract number, e.g. "Cancha 1: Élite" -> 1)
      const canchaNumMatch = p.cancha.match(/\d+/);
      const courtIndex = canchaNumMatch ? parseInt(canchaNumMatch[0], 10) : 1;

      // Puntos Ganador = canchas_count - courtIndex + 2. Puntos Perdedor = 1
      const ptsWinner = countCanchas - courtIndex + 2;
      const ptsLoser = 1;

      // Sets won
      const setsWinner = Math.max(p.sets_pareja1, p.sets_pareja2);
      const setsLoser = Math.min(p.sets_pareja1, p.sets_pareja2);

      // Games sum
      let gamesP1 = 0;
      let gamesP2 = 0;
      p.sets?.forEach((s) => {
        gamesP1 += s.games_pareja1;
        gamesP2 += s.games_pareja2;
      });

      const p1Won = p.sets_pareja1 > p.sets_pareja2;

      // Helper to award points and stats
      const awardStats = (
        jugId: string | null,
        isWinner: boolean,
        wasAbsent: boolean,
        gamesOwn: number,
        gamesOpp: number,
        setsOwn: number,
        setsOpp: number
      ) => {
        if (!jugId) return;
        const s = standingsMap.get(jugId);
        if (!s) return;

        s.partidosJugados++;
        if (wasAbsent) {
          // Absent player gets 0 points, keeps accumulated
          s.puntos += 0;
        } else {
          s.puntos += isWinner ? ptsWinner : ptsLoser;
          s.setsGanados += setsOwn;
          s.setsPerdidos += setsOpp;
          s.gamesGanados += gamesOwn;
          s.gamesPerdidos += gamesOpp;
        }
      };

      // Pareja 1: J1 + J2. Pareja 2: J3 + J4
      const p1Absent = !!(p.suplente1_nombre || p.suplente2_nombre);
      const p2Absent = !!(p.suplente3_nombre || p.suplente4_nombre);

      awardStats(p.jugador1_id, p1Won, !!p.suplente1_nombre, gamesP1, gamesP2, p.sets_pareja1, p.sets_pareja2);
      awardStats(p.jugador2_id, p1Won, !!p.suplente2_nombre, gamesP1, gamesP2, p.sets_pareja1, p.sets_pareja2);
      awardStats(p.jugador3_id, !p1Won, !!p.suplente3_nombre, gamesP2, gamesP1, p.sets_pareja2, p.sets_pareja1);
      awardStats(p.jugador4_id, !p1Won, !!p.suplente4_nombre, gamesP2, gamesP1, p.sets_pareja2, p.sets_pareja1);
    });

    const list = Array.from(standingsMap.values()).map((s) => ({
      ...s,
      difGames: s.gamesGanados - s.gamesPerdidos,
    }));

    // Sort according to tiebreakers:
    // 1. Points
    // 2. Sets won
    // 3. Games difference
    // 4. Alphabetical / ID fallback
    list.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.setsGanados !== a.setsGanados) return b.setsGanados - a.setsGanados;
      if (b.difGames !== a.difGames) return b.difGames - a.difGames;
      return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`);
    });

    return list;
  }, [torneo, jugadoresInscriptos, partidos]);

  useEffect(() => {
    setStandings(computedStandings);
  }, [computedStandings]);

  // Financial summary calculations
  const finanzasResumen = useMemo(() => {
    if (!torneo) return { esperado: 0, cobrado: 0, costoCanchas: 0, gananciaNeta: 0, pozoPremios: 0, gananciaOrg: 0 };

    const costoPorJugador = torneo.costo_fecha_jugador ?? 10000;
    const costoPorCancha = torneo.costo_fecha_cancha ?? 22000;
    const porcentajePremios = torneo.porcentaje_premios ?? 60;
    const totalJugadores = jugadoresInscriptos.length;
    const totalCanchas = torneo.canchas_count ?? 3;

    // Total expected for 8 weeks
    const esperado = totalJugadores * costoPorJugador * 8;

    // Total actually collected
    const cobrado = pagos.reduce((acc, curr) => acc + Number(curr.monto_pagado), 0);

    // Court expenses: depends on weeks played (which have dates marked as completed or created)
    const activeWeeks = fechas.length; // dates created so far
    const costoCanchas = activeWeeks * totalCanchas * costoPorCancha;

    const gananciaNeta = Math.max(0, cobrado - costoCanchas);
    const pozoPremios = (gananciaNeta * porcentajePremios) / 100;
    const gananciaOrg = gananciaNeta - pozoPremios;

    return {
      esperado,
      cobrado,
      costoCanchas,
      gananciaNeta,
      pozoPremios,
      gananciaOrg,
    };
  }, [torneo, jugadoresInscriptos, pagos, fechas]);

  // Match list filter for the selected week
  const partidosDeFecha = useMemo(() => {
    return partidos.filter((p) => p.fecha === selectedFechaNum).sort((a, b) => a.cancha.localeCompare(b.cancha));
  }, [partidos, selectedFechaNum]);

  // Date object for the selected week
  const selectedFecha = useMemo(() => {
    return fechas.find((f) => f.fecha === selectedFechaNum);
  }, [fechas, selectedFechaNum]);

  // Actions: Add player
  const handleAgregarJugador = async () => {
    if (!id || !selectedJugadorId) return;

    // Check limit: 4 * courts
    const maxPlayers = (torneo?.canchas_count ?? 3) * 4;
    if (jugadoresInscriptos.length >= maxPlayers) {
      toast.error(`El cupo está completo para ${torneo?.canchas_count} canchas (${maxPlayers} jugadores)`);
      return;
    }

    const exists = jugadoresInscriptos.some((tj) => tj.jugador_id === selectedJugadorId);
    if (exists) {
      toast.error("El jugador ya está inscripto en este torneo");
      return;
    }

    const { error } = await supabase.from("torneo_individual_jugadores").insert({
      torneo_id: id,
      jugador_id: selectedJugadorId,
      estado: "confirmada",
    });

    if (error) {
      toast.error("Error al inscribir jugador: " + error.message);
    } else {
      toast.success("Jugador inscripto con éxito");
      setSelectedJugadorId("");
      fetchTournamentData();
    }
  };

  // Actions: Remove player
  const handleQuitarJugador = async (jugId: string) => {
    // Check if matches have already been generated
    if (partidos.length > 0) {
      toast.error("No se puede desinscribir jugadores una vez generado el fixture del torneo");
      return;
    }

    const { error } = await supabase
      .from("torneo_individual_jugadores")
      .delete()
      .eq("torneo_id", id)
      .eq("jugador_id", jugId);

    if (error) {
      toast.error("Error al desinscribir jugador: " + error.message);
    } else {
      toast.success("Jugador desinscripto");
      fetchTournamentData();
    }
  };

  // Actions: Modify Finance settings
  const handleSaveSettings = async () => {
    if (!id) return;
    setUpdatingSettings(true);
    const { error } = await supabase
      .from("torneos")
      .update({
        canchas_count: Number(settingsForm.canchas_count),
        costo_fecha_jugador: Number(settingsForm.costo_fecha_jugador),
        costo_fecha_cancha: Number(settingsForm.costo_fecha_cancha),
        porcentaje_premios: Number(settingsForm.porcentaje_premios),
      })
      .eq("id", id);

    if (error) {
      toast.error("Error al guardar configuración: " + error.message);
    } else {
      toast.success("Configuración actualizada");
      fetchTournamentData();
    }
    setUpdatingSettings(false);
  };

  // Actions: Toggle / Set Payment for a cell
  const handleSetPago = async (jugId: string, fechaNum: number, currentPago: TorneoPago | undefined) => {
    if (!id) return;
    const fee = torneo?.costo_fecha_jugador ?? 10000;

    if (currentPago && currentPago.estado_pago === "pagado") {
      // Toggle to Pendiente (delete or update to 0)
      const { error } = await supabase
        .from("torneo_individual_pagos")
        .delete()
        .eq("id", currentPago.id);

      if (error) toast.error(error.message);
      else fetchTournamentData();
    } else {
      // Set to Pagado
      const payload = {
        torneo_id: id,
        fecha: fechaNum,
        jugador_id: jugId,
        monto_pagado: fee,
        estado_pago: "pagado" as const,
      };

      const { error } = await supabase
        .from("torneo_individual_pagos")
        .upsert(payload, { onConflict: "torneo_id,fecha,jugador_id" });

      if (error) toast.error(error.message);
      else fetchTournamentData();
    }
  };

  // Matchmaking engine: Sorteo / Generation of Week 1
  const handleGenerarFecha1 = async () => {
    if (!id || !torneo) return;
    const courtsCount = torneo.canchas_count ?? 3;
    const reqPlayers = courtsCount * 4;

    if (jugadoresInscriptos.length !== reqPlayers) {
      toast.error(`Para generar el fixture se necesitan exactamente ${reqPlayers} jugadores inscriptos (tienes ${jugadoresInscriptos.length})`);
      return;
    }

    const listIds = jugadoresInscriptos.map((j) => j.jugador_id);
    // Shuffle listIds
    const shuffled = [...listIds].sort(() => Math.random() - 0.5);

    try {
      const { data: dateRow, error: fErr } = await supabase
        .from("torneo_individual_fechas")
        .insert({
          torneo_id: id,
          fecha: 1,
          costo_canchas: (torneo.costo_fecha_cancha ?? 22000) * courtsCount,
          estado: "pendiente",
        })
        .select()
        .single();

      if (fErr) throw fErr;

      // Group into groups of 4 and create matches
      const matchPromises = [];
      for (let c = 1; c <= courtsCount; c++) {
        const offset = (c - 1) * 4;
        const courtPlayers = shuffled.slice(offset, offset + 4);
        // Shuffle internally to define partners randomly
        const courtShuffled = [...courtPlayers].sort(() => Math.random() - 0.5);

        // J1, J2, J3, J4
        // Cruce: J1 + J4 vs J2 + J3
        const matchPayload = {
          torneo_id: id,
          fecha: 1,
          cancha: `Cancha ${c}: ${c === 1 ? "Élite" : c === 2 ? "Desafío" : "Base"}`,
          jugador1_id: courtShuffled[0],
          jugador2_id: courtShuffled[3],
          jugador3_id: courtShuffled[1],
          jugador4_id: courtShuffled[2],
          estado: "pendiente" as const,
        };

        matchPromises.push(supabase.from("partidos_individuales").insert(matchPayload));
      }

      await Promise.all(matchPromises);
      toast.success("Fecha 1 generada con éxito");
      fetchTournamentData();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al generar la Fecha 1: " + e.message);
    }
  };

  // Matchmaking engine: Weeks 2-6 (Ascensos/Descensos + Ranking order) and Week 7 (Semifinales)
  const handleGenerarFechaRegular = async (fechaNum: number) => {
    if (!id || !torneo) return;
    const courtsCount = torneo.canchas_count ?? 3;

    // Check if the previous week was completed
    const prevFecha = fechas.find((f) => f.fecha === fechaNum - 1);
    if (!prevFecha || prevFecha.estado !== "completada") {
      toast.error(`Debes completar y cerrar la Fecha ${fechaNum - 1} antes de generar la Fecha ${fechaNum}`);
      return;
    }

    try {
      const { data: dateRow, error: fErr } = await supabase
        .from("torneo_individual_fechas")
        .insert({
          torneo_id: id,
          fecha: fechaNum,
          costo_canchas: (torneo.costo_fecha_cancha ?? 22000) * courtsCount,
          estado: "pendiente",
        })
        .select()
        .single();

      if (fErr) throw fErr;

      // Group in courts based on standings ranking
      // Standings is already computed, sorted from 1st to Nth
      const sortedIds = standings.map((s) => s.jugador_id);

      const matchPromises = [];
      for (let c = 1; c <= courtsCount; c++) {
        const offset = (c - 1) * 4;
        const courtPlayers = sortedIds.slice(offset, offset + 4);

        // Within court, ranks are 1 (courtPlayers[0]), 2 (courtPlayers[1]), 3 (courtPlayers[2]), 4 (courtPlayers[3])
        // Cruce: J1 + J4 vs J2 + J3
        const matchPayload = {
          torneo_id: id,
          fecha: fechaNum,
          cancha: `Cancha ${c}: ${c === 1 ? "Élite" : c === 2 ? "Desafío" : "Base"}`,
          jugador1_id: courtPlayers[0],
          jugador2_id: courtPlayers[3],
          jugador3_id: courtPlayers[1],
          jugador4_id: courtPlayers[2],
          estado: "pendiente" as const,
        };

        matchPromises.push(supabase.from("partidos_individuales").insert(matchPayload));
      }

      await Promise.all(matchPromises);
      toast.success(`Fecha ${fechaNum} generada con éxito`);
      fetchTournamentData();
    } catch (e: any) {
      console.error(e);
      toast.error(`Error al generar la Fecha ${fechaNum}: ` + e.message);
    }
  };

  // Matchmaking engine: Week 8 Draft modal trigger
  const handleOpenDraftWeek8 = () => {
    // Check if Week 7 is completed
    const prevFecha = fechas.find((f) => f.fecha === 7);
    if (!prevFecha || prevFecha.estado !== "completada") {
      toast.error("Debes completar y cerrar la Fecha 7 antes de armar la Gran Final");
      return;
    }

    // Get Finalists and 3rd place contenders from Week 7, Cancha 1
    const w7c1Matches = partidos.filter((p) => p.fecha === 7 && p.cancha.startsWith("Cancha 1"));
    if (w7c1Matches.length === 0 || w7c1Matches[0].estado !== "finalizado") {
      toast.error("No se encontró el partido de Cancha 1 en la Fecha 7");
      return;
    }

    const match = w7c1Matches[0];
    const p1Won = match.sets_pareja1 > match.sets_pareja2;

    const finalists = p1Won
      ? [match.jugador1_id!, match.jugador2_id!]
      : [match.jugador3_id!, match.jugador4_id!];
    
    const thirdPlaceContenders = p1Won
      ? [match.jugador3_id!, match.jugador4_id!]
      : [match.jugador1_id!, match.jugador2_id!];

    // Prefill draftChoices
    setDraftChoices({
      finalista1_id: finalists[0],
      finalista2_id: finalists[1],
      tercero1_id: thirdPlaceContenders[0],
      tercero2_id: thirdPlaceContenders[1],
      finalista1_partner: "",
      finalista2_partner: "",
      tercero1_partner: "",
      tercero2_partner: "",
    });

    setDraftDialogOpen(true);
  };

  // Matchmaking engine: Week 8 Draft save
  const handleSaveDraftWeek8 = async () => {
    const {
      finalista1_id,
      finalista2_id,
      tercero1_id,
      tercero2_id,
      finalista1_partner,
      finalista2_partner,
      tercero1_partner,
      tercero2_partner,
    } = draftChoices;

    if (!finalista1_partner || !finalista2_partner || !tercero1_partner || !tercero2_partner) {
      toast.error("Debes seleccionar todos los compañeros del draft");
      return;
    }

    // Verify no overlaps in partners
    const partners = [finalista1_partner, finalista2_partner, tercero1_partner, tercero2_partner];
    const uniquePartners = new Set(partners);
    if (uniquePartners.size !== 4) {
      toast.error("Las parejas deben elegir compañeros distintos");
      return;
    }

    // Create the Date 8 entry
    const courtsCount = torneo?.canchas_count ?? 3;
    try {
      const { data: dateRow, error: fErr } = await supabase
        .from("torneo_individual_fechas")
        .insert({
          torneo_id: id,
          fecha: 8,
          costo_canchas: (torneo?.costo_fecha_cancha ?? 22000) * courtsCount,
          estado: "pendiente",
        })
        .select()
        .single();

      if (fErr) throw fErr;

      const matchPromises = [];

      // Match 1: La Final (Cancha 1)
      matchPromises.push(
        supabase.from("partidos_individuales").insert({
          torneo_id: id,
          fecha: 8,
          cancha: "Cancha 1: Élite (Gran Final)",
          jugador1_id: finalista1_id,
          jugador2_id: finalista1_partner,
          jugador3_id: finalista2_id,
          jugador4_id: finalista2_partner,
          estado: "pendiente" as const,
        })
      );

      // Match 2: Tercer Puesto (Cancha 2)
      matchPromises.push(
        supabase.from("partidos_individuales").insert({
          torneo_id: id,
          fecha: 8,
          cancha: "Cancha 2: Desafío (Tercer Puesto)",
          jugador1_id: tercero1_id,
          jugador2_id: tercero1_partner,
          jugador3_id: tercero2_id,
          jugador4_id: tercero2_partner,
          estado: "pendiente" as const,
        })
      );

      // Match 3 (or remaining matches): Partido de Honor
      // Find remaining players: all 12 except final 4 and 4 partners
      const usedIds = [
        finalista1_id,
        finalista2_id,
        tercero1_id,
        tercero2_id,
        finalista1_partner,
        finalista2_partner,
        tercero1_partner,
        tercero2_partner,
      ];
      
      const remainingIds = standings
        .map((s) => s.jugador_id)
        .filter((jid) => !usedIds.includes(jid));

      if (remainingIds.length >= 4) {
        matchPromises.push(
          supabase.from("partidos_individuales").insert({
            torneo_id: id,
            fecha: 8,
            cancha: "Cancha 3: Base (Partido de Honor)",
            jugador1_id: remainingIds[0],
            jugador2_id: remainingIds[3],
            jugador3_id: remainingIds[1],
            jugador4_id: remainingIds[2],
            estado: "pendiente" as const,
          })
        );
      }

      await Promise.all(matchPromises);
      toast.success("Fecha 8 (Finales) generada con éxito");
      setDraftDialogOpen(false);
      fetchTournamentData();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al generar la Fecha 8: " + e.message);
    }
  };

  // Save / Update Match Result
  const handleOpenScoreDialog = (p: PartidoInd) => {
    setSelectedPartido(p);
    setSuplentesInput({
      suplente1: p.suplente1_nombre ?? "",
      suplente2: p.suplente2_nombre ?? "",
      suplente3: p.suplente3_nombre ?? "",
      suplente4: p.suplente4_nombre ?? "",
    });

    // Populate set scores
    const s1 = p.sets?.find((s) => s.numero_set === 1);
    const s2 = p.sets?.find((s) => s.numero_set === 2);
    const s3 = p.sets?.find((s) => s.numero_set === 3);

    setSetsInput({
      set1_local: s1?.games_pareja1?.toString() ?? "",
      set1_visitante: s1?.games_pareja2?.toString() ?? "",
      set2_local: s2?.games_pareja1?.toString() ?? "",
      set2_visitante: s2?.games_pareja2?.toString() ?? "",
      set3_local: s3?.games_pareja1?.toString() ?? "",
      set3_visitante: s3?.games_pareja2?.toString() ?? "",
    });

    setScoreDialogOpen(true);
  };

  const handleSaveScore = async () => {
    if (!selectedPartido) return;

    const { set1_local, set1_visitante, set2_local, set2_visitante, set3_local, set3_visitante } = setsInput;

    const g1_local = parseInt(set1_local, 10);
    const g1_visi = parseInt(set1_visitante, 10);
    const g2_local = parseInt(set2_local, 10);
    const g2_visi = parseInt(set2_visitante, 10);

    if (isNaN(g1_local) || isNaN(g1_visi) || isNaN(g2_local) || isNaN(g2_visi)) {
      toast.error("Los scores de Set 1 y Set 2 son obligatorios");
      return;
    }

    // Determine sets won
    let setsLocal = 0;
    let setsVisi = 0;

    if (g1_local > g1_visi) setsLocal++;
    else setsVisi++;

    if (g2_local > g2_visi) setsLocal++;
    else setsVisi++;

    // Set 3 (Supertiebreak)
    const g3_local = parseInt(set3_local, 10);
    const g3_visi = parseInt(set3_visitante, 10);

    if (setsLocal === 1 && setsVisi === 1) {
      if (isNaN(g3_local) || isNaN(g3_visi)) {
        toast.error("Se requiere Supertiebreak (Set 3) en caso de empate 1-1");
        return;
      }
      if (g3_local > g3_visi) setsLocal++;
      else setsVisi++;
    }

    try {
      // Update match record
      const { error: matchErr } = await supabase
        .from("partidos_individuales")
        .update({
          sets_pareja1: setsLocal,
          sets_pareja2: setsVisi,
          suplente1_nombre: suplentesInput.suplente1.trim() || null,
          suplente2_nombre: suplentesInput.suplente2.trim() || null,
          suplente3_nombre: suplentesInput.suplente3.trim() || null,
          suplente4_nombre: suplentesInput.suplente4.trim() || null,
          estado: "finalizado",
        })
        .eq("id", selectedPartido.id);

      if (matchErr) throw matchErr;

      // Upsert set detailed records
      const setPromises = [];

      // Set 1
      setPromises.push(
        supabase
          .from("sets_partido_individual")
          .upsert(
            { partido_individual_id: selectedPartido.id, numero_set: 1, games_pareja1: g1_local, games_pareja2: g1_visi },
            { onConflict: "partido_individual_id,numero_set" }
          )
      );

      // Set 2
      setPromises.push(
        supabase
          .from("sets_partido_individual")
          .upsert(
            { partido_individual_id: selectedPartido.id, numero_set: 2, games_pareja1: g2_local, games_pareja2: g2_visi },
            { onConflict: "partido_individual_id,numero_set" }
          )
      );

      // Set 3
      if (setsLocal === 2 && setsVisi === 2) {
        // Tie set 3
      }
      if (!isNaN(g3_local) && !isNaN(g3_visi)) {
        setPromises.push(
          supabase
            .from("sets_partido_individual")
            .upsert(
              { partido_individual_id: selectedPartido.id, numero_set: 3, games_pareja1: g3_local, games_pareja2: g3_visi },
              { onConflict: "partido_individual_id,numero_set" }
            )
        );
      } else {
        // delete set 3 if it existed but was cleared
        await supabase
          .from("sets_partido_individual")
          .delete()
          .eq("partido_individual_id", selectedPartido.id)
          .eq("numero_set", 3);
      }

      await Promise.all(setPromises);
      toast.success("Resultado guardado");
      setScoreDialogOpen(false);
      fetchTournamentData();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al guardar resultado: " + e.message);
    }
  };

  // Close Date / Complete Date
  const handleCerrarFecha = async () => {
    if (!selectedFecha) return;

    // Verify all matches are finalized
    const allFinalized = partidosDeFecha.every((p) => p.estado === "finalizado");
    if (!allFinalized) {
      toast.error("Todos los partidos de la fecha deben finalizarse antes de cerrarla");
      return;
    }

    const { error } = await supabase
      .from("torneo_individual_fechas")
      .update({ estado: "completada" })
      .eq("id", selectedFecha.id);

    if (error) {
      toast.error("Error al cerrar la fecha: " + error.message);
    } else {
      toast.success(`Fecha ${selectedFechaNum} cerrada con éxito`);
      fetchTournamentData();
    }
  };

  // Helpers for combobox
  const comboboxOptions = useMemo(() => {
    return todosJugadores
      .filter((j) => !jugadoresInscriptos.some((tj) => tj.jugador_id === j.id))
      .map((j) => ({
        value: j.id,
        label: `${j.apellido}, ${j.nombre}`,
        hint: j.club ? `Club: ${j.club}` : undefined,
      }));
  }, [todosJugadores, jugadoresInscriptos]);

  return (
    <div className="container mx-auto p-4 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/torneos">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{torneo?.nombre || "Cargando..."}</h1>
              <Badge className="bg-indigo-600 text-white">Americano Individual</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Sede: {torneo?.sede || "No especificada"} · Categoría: {torneo?.categoria_libre || "Libre"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {torneo && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/torneo-individual/${torneo.id}`} target="_blank">
                <Globe className="h-4 w-4 mr-1.5" />
                Muro Público
              </Link>
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando consola del torneo...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="inscriptos">Inscriptos ({jugadoresInscriptos.length})</TabsTrigger>
            <TabsTrigger value="finanzas">Finanzas y Pagos</TabsTrigger>
            <TabsTrigger value="fixture">Fixture y Resultados</TabsTrigger>
            <TabsTrigger value="ranking">Posiciones Generales</TabsTrigger>
          </TabsList>

          {/* TAB 1: RESUMEN */}
          <TabsContent value="resumen" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-950 border border-indigo-100 dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Pozo de Premios Acumulado</CardTitle>
                  <DollarSign className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-200">
                    ${finanzasResumen.pozoPremios.toLocaleString("es-AR")}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Correspondiente al {torneo?.porcentaje_premios || 60}% de la ganancia neta.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Jugadores Inscriptos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {jugadoresInscriptos.length} / {(torneo?.canchas_count ?? 3) * 4}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Canchas definidas: {torneo?.canchas_count ?? 3} canchas.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Última Fecha Jugada</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {fechas.filter((f) => f.estado === "completada").length} / 8
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Semanas totales de competencia.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Estado del Torneo</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">
                    {torneo?.estado.replace("_", " ")}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Creado el {new Date(torneo?.created_at ?? "").toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick configuration card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  Configuración del Torneo Americano Individual
                </CardTitle>
                <CardDescription>
                  Define las variables para calcular automáticamente los cruces y el pozo de premios.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="canchas">Cantidad de Canchas</Label>
                    <Select
                      value={settingsForm.canchas_count}
                      onValueChange={(v) => setSettingsForm({ ...settingsForm, canchas_count: v })}
                    >
                      <SelectTrigger id="canchas">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 Canchas (8 jugadores)</SelectItem>
                        <SelectItem value="3">3 Canchas (12 jugadores)</SelectItem>
                        <SelectItem value="4">4 Canchas (16 jugadores)</SelectItem>
                        <SelectItem value="5">5 Canchas (20 jugadores)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="costo-jug">Precio por Jugador ($)</Label>
                    <Input
                      id="costo-jug"
                      type="number"
                      value={settingsForm.costo_fecha_jugador}
                      onChange={(e) => setSettingsForm({ ...settingsForm, costo_fecha_jugador: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="costo-cancha-t">Costo Cancha por Fecha ($)</Label>
                    <Input
                      id="costo-cancha-t"
                      type="number"
                      value={settingsForm.costo_fecha_cancha}
                      onChange={(e) => setSettingsForm({ ...settingsForm, costo_fecha_cancha: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="porc">% Pozo de Premios</Label>
                    <Input
                      id="porc"
                      type="number"
                      min="0"
                      max="100"
                      value={settingsForm.porcentaje_premios}
                      onChange={(e) => setSettingsForm({ ...settingsForm, porcentaje_premios: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={handleSaveSettings} disabled={updatingSettings}>
                    <Save className="h-4 w-4 mr-1.5" />
                    Guardar Configuración
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: INSCRIPTOS */}
          <TabsContent value="inscriptos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Agregar Jugador al Torneo
                </CardTitle>
                <CardDescription>
                  El torneo requiere exactamente {(torneo?.canchas_count ?? 3) * 4} jugadores para jugarse.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap sm:flex-nowrap max-w-md">
                  <div className="flex-1">
                    <Combobox
                      options={comboboxOptions}
                      value={selectedJugadorId}
                      onChange={setSelectedJugadorId}
                      placeholder="Seleccionar jugador..."
                      searchPlaceholder="Buscar por apellido o nombre..."
                    />
                  </div>
                  <Button onClick={handleAgregarJugador} disabled={!selectedJugadorId}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Inscribir
                  </Button>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>DNI</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Club/Ciudad</TableHead>
                        <TableHead className="w-[100px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jugadoresInscriptos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                            No hay jugadores inscriptos todavía.
                          </TableCell>
                        </TableRow>
                      ) : (
                        jugadoresInscriptos.map((tj) => (
                          <TableRow key={tj.id}>
                            <TableCell className="font-medium">
                              {tj.jugador?.apellido}, {tj.jugador?.nombre}
                            </TableCell>
                            <TableCell>{tj.jugador?.dni || "—"}</TableCell>
                            <TableCell>{tj.jugador?.telefono || "—"}</TableCell>
                            <TableCell>{tj.jugador?.club || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleQuitarJugador(tj.jugador_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: FINANZAS */}
          <TabsContent value="finanzas" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Payments Grid */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Cuadrícula de Pagos de Inscripción</span>
                    <Badge variant="outline" className="border-emerald-500/20 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20">
                      Costo por Fecha: ${torneo?.costo_fecha_jugador ?? 10000}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Haz clic en cada celda para marcar que el jugador ha pagado la inscripción de esa fecha (semanal).
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jugador</TableHead>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <TableHead key={i} className="text-center w-[60px] p-2 text-xs">
                            Sem {i + 1}
                          </TableHead>
                        ))}
                        <TableHead className="text-right w-[100px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jugadoresInscriptos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                            Inscribe jugadores primero para poder ver la grilla de pagos.
                          </TableCell>
                        </TableRow>
                      ) : (
                        jugadoresInscriptos.map((tj) => {
                          const jugPagos = pagos.filter((p) => p.jugador_id === tj.jugador_id);
                          const totalPagado = jugPagos.reduce((acc, curr) => acc + Number(curr.monto_pagado), 0);

                          return (
                            <TableRow key={tj.id}>
                              <TableCell className="font-medium text-xs max-w-[150px] truncate">
                                {tj.jugador?.apellido}, {tj.jugador?.nombre}
                              </TableCell>
                              {Array.from({ length: 8 }).map((_, idx) => {
                                const fNum = idx + 1;
                                const isPaid = jugPagos.some((p) => p.fecha === fNum && p.estado_pago === "pagado");
                                const pData = jugPagos.find((p) => p.fecha === fNum);

                                return (
                                  <TableCell key={idx} className="text-center p-1">
                                    <button
                                      type="button"
                                      className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border ${
                                        isPaid
                                          ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
                                          : "bg-muted border-border hover:bg-emerald-500/20 hover:border-emerald-400"
                                      }`}
                                      onClick={() => handleSetPago(tj.jugador_id, fNum, pData)}
                                      title={isPaid ? "Marcado como PAGADO. Clic para quitar" : "Pendiente de pago. Clic para marcar pagado"}
                                    >
                                      {isPaid ? <UserCheck className="h-3.5 w-3.5" /> : `${fNum}`}
                                    </button>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right font-semibold text-xs">
                                ${totalPagado.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Financial Dashboard */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    Caja y Ganancias del Torneo
                  </CardTitle>
                  <CardDescription>
                    Resumen en base a los pagos cobrados hasta el momento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 border-b pb-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Recaudado / Total esperado</span>
                      <span className="font-semibold text-foreground">
                        ${finanzasResumen.cobrado.toLocaleString()} / ${finanzasResumen.esperado.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{
                          width: `${(finanzasResumen.cobrado / (finanzasResumen.esperado || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingresos (Caja cobrada):</span>
                      <span className="font-medium text-foreground">${finanzasResumen.cobrado.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gastos de cancha ({fechas.length} fechas):</span>
                      <span className="font-medium text-destructive">-${finanzasResumen.costoCanchas.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-sm font-bold">
                      <span>Ganancia Neta Actual:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">${finanzasResumen.gananciaNeta.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border p-3 rounded-md space-y-2 bg-indigo-50/30 dark:bg-indigo-950/10 text-xs">
                    <h4 className="font-semibold text-indigo-700 dark:text-indigo-400 border-b pb-1 flex items-center justify-between">
                      <span>Repartición del Pozo ({torneo?.porcentaje_premios || 60}%)</span>
                      <Award className="h-3.5 w-3.5" />
                    </h4>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fondo para Premios (Total):</span>
                      <span className="font-bold text-foreground">${finanzasResumen.pozoPremios.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span className="text-muted-foreground">1º Puesto (70%):</span>
                      <span className="font-semibold text-foreground">${((finanzasResumen.pozoPremios * 70) / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pl-2">
                      <span className="text-muted-foreground">2º Puesto (30%):</span>
                      <span className="font-semibold text-foreground">${((finanzasResumen.pozoPremios * 30) / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-semibold text-indigo-600 dark:text-indigo-300">
                      <span>Ganancia de Organización (40%):</span>
                      <span>${finanzasResumen.gananciaOrg.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 4: FIXTURE Y RESULTADOS */}
          <TabsContent value="fixture" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Seleccionar Fecha:</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const fNum = i + 1;
                    const fObj = fechas.find((f) => f.fecha === fNum);
                    const isCompleted = fObj?.estado === "completada";

                    return (
                      <Button
                        key={i}
                        variant={selectedFechaNum === fNum ? "default" : "outline"}
                        size="sm"
                        className={`h-8 w-12 text-xs font-semibold ${
                          isCompleted && selectedFechaNum !== fNum
                            ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10"
                            : ""
                        }`}
                        onClick={() => setSelectedFechaNum(fNum)}
                      >
                        F{fNum}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Closure button */}
              {selectedFecha && selectedFecha.estado === "pendiente" && partidosDeFecha.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  onClick={handleCerrarFecha}
                  disabled={!partidosDeFecha.every((p) => p.estado === "finalizado")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Cerrar Fecha {selectedFechaNum}
                </Button>
              )}
            </div>

            {/* If not generated yet */}
            {partidosDeFecha.length === 0 ? (
              <Card>
                <CardContent className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
                  <div>
                    <h3 className="text-lg font-bold">Fecha {selectedFechaNum} sin fixture</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                      El fixture para esta fecha aún no ha sido generado. Genera los enfrentamientos para comenzar a jugar.
                    </p>
                  </div>
                  {selectedFechaNum === 1 ? (
                    <Button onClick={handleGenerarFecha1}>
                      <Settings className="h-4 w-4 mr-1.5" />
                      Sorteo Inicial e Inaugurar Fecha 1
                    </Button>
                  ) : selectedFechaNum === 8 ? (
                    <Button onClick={handleOpenDraftWeek8}>
                      <Trophy className="h-4 w-4 mr-1.5" />
                      Abrir Asistente de Draft de Finales
                    </Button>
                  ) : (
                    <Button onClick={() => handleGenerarFechaRegular(selectedFechaNum)}>
                      <Settings className="h-4 w-4 mr-1.5" />
                      Generar Cruces por Ranking (Fecha {selectedFechaNum})
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {partidosDeFecha.map((p) => {
                  const hasWinner = p.estado === "finalizado";

                  return (
                    <Card key={p.id} className="relative overflow-hidden">
                      <div className="bg-muted px-3 py-1.5 text-xs font-semibold flex items-center justify-between border-b">
                        <span>{p.cancha}</span>
                        {hasWinner && (
                          <Badge variant="outline" className="border-emerald-600 text-emerald-600 py-0 text-[10px] h-4">
                            Finalizado
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4 space-y-4">
                        {/* Team A */}
                        <div className={`p-2.5 rounded-md border ${hasWinner && p.sets_pareja1 > p.sets_pareja2 ? "bg-primary/5 border-primary/20" : "bg-card border-transparent"}`}>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-muted-foreground uppercase text-[10px]">Pareja A</span>
                            {hasWinner && p.sets_pareja1 > p.sets_pareja2 && (
                              <Badge className="bg-primary/10 text-primary border-none shadow-none text-[10px] px-1 h-4">
                                Ganadores
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 text-sm font-medium space-y-0.5">
                            <div>
                              {p.jugador1?.apellido}, {p.jugador1?.nombre}
                              {p.suplente1_nombre && <span className="text-xs text-muted-foreground ml-1">(Suplente: {p.suplente1_nombre})</span>}
                            </div>
                            <div>
                              {p.jugador2?.apellido}, {p.jugador2?.nombre}
                              {p.suplente2_nombre && <span className="text-xs text-muted-foreground ml-1">(Suplente: {p.suplente2_nombre})</span>}
                            </div>
                          </div>
                        </div>

                        {/* VS Divider */}
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-[1px] bg-muted flex-1" />
                          <span className="text-[10px] text-muted-foreground font-bold">VS</span>
                          <div className="h-[1px] bg-muted flex-1" />
                        </div>

                        {/* Team B */}
                        <div className={`p-2.5 rounded-md border ${hasWinner && p.sets_pareja2 > p.sets_pareja1 ? "bg-primary/5 border-primary/20" : "bg-card border-transparent"}`}>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-muted-foreground uppercase text-[10px]">Pareja B</span>
                            {hasWinner && p.sets_pareja2 > p.sets_pareja1 && (
                              <Badge className="bg-primary/10 text-primary border-none shadow-none text-[10px] px-1 h-4">
                                Ganadores
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 text-sm font-medium space-y-0.5">
                            <div>
                              {p.jugador3?.apellido}, {p.jugador3?.nombre}
                              {p.suplente3_nombre && <span className="text-xs text-muted-foreground ml-1">(Suplente: {p.suplente3_nombre})</span>}
                            </div>
                            <div>
                              {p.jugador4?.apellido}, {p.jugador4?.nombre}
                              {p.suplente4_nombre && <span className="text-xs text-muted-foreground ml-1">(Suplente: {p.suplente4_nombre})</span>}
                            </div>
                          </div>
                        </div>

                        {/* Score display */}
                        {hasWinner && p.sets && p.sets.length > 0 ? (
                          <div className="flex justify-center gap-3 border-t pt-3 text-center">
                            {p.sets.map((s) => (
                              <div key={s.id} className="text-xs bg-muted/60 px-2.5 py-1 rounded">
                                <div className="font-semibold text-muted-foreground text-[8px] uppercase tracking-wider mb-0.5">Set {s.numero_set}</div>
                                <div className="font-mono text-sm font-bold text-foreground">
                                  {s.games_pareja1} - {s.games_pareja2}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-xs text-muted-foreground italic border-t pt-3">
                            Partido pendiente
                          </div>
                        )}

                        {/* Action buttons */}
                        {selectedFecha?.estado === "pendiente" && (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => handleOpenScoreDialog(p)}>
                            {hasWinner ? "Modificar Resultado" : "Cargar Resultado"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 5: STANDINGS */}
          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Tabla de Posiciones Generales</span>
                  <Badge variant="secondary">Cálculo en Tiempo Real</Badge>
                </CardTitle>
                <CardDescription>
                  Ordenado por Puntos (W1-8), Sets Ganados y Diferencia de Games.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px] text-center">Pos</TableHead>
                      <TableHead>Jugador</TableHead>
                      <TableHead>DNI</TableHead>
                      <TableHead className="text-center">PJ</TableHead>
                      <TableHead className="text-center">Sets G - P</TableHead>
                      <TableHead className="text-center">Games Diff</TableHead>
                      <TableHead className="text-right w-[120px]">Puntos Totales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                          Los resultados cargados en la pestaña "Fixture" generarán las posiciones automáticamente.
                        </TableCell>
                      </TableRow>
                    ) : (
                      standings.map((s, idx) => (
                        <TableRow key={s.jugador_id}>
                          <TableCell className="text-center font-bold">
                            {idx === 0 ? (
                              <span className="flex justify-center text-amber-500"><Trophy className="h-4 w-4" /></span>
                            ) : (
                              `${idx + 1}º`
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{s.apellido}, {s.nombre}</TableCell>
                          <TableCell>{s.dni || "—"}</TableCell>
                          <TableCell className="text-center">{s.partidosJugados}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground font-mono">
                            {s.setsGanados} - {s.setsPerdidos}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            <span className={s.difGames > 0 ? "text-emerald-600" : s.difGames < 0 ? "text-destructive" : ""}>
                              {s.difGames > 0 ? `+${s.difGames}` : s.difGames}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-indigo-600 dark:text-indigo-400">
                            {s.puntos} pts
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog: Score Input */}
      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cargar Resultado - {selectedPartido?.cancha}</DialogTitle>
            <DialogDescription>
              Introduce los games por set de cada pareja y la lista opcional de suplentes si algún titular faltó.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Score Grid */}
            <div className="grid grid-cols-4 gap-2 text-center items-center">
              <div className="text-xs font-semibold text-muted-foreground col-span-1 text-left">Equipo</div>
              <div className="text-xs font-semibold text-muted-foreground">Set 1</div>
              <div className="text-xs font-semibold text-muted-foreground">Set 2</div>
              <div className="text-xs font-semibold text-muted-foreground">Set 3 (STB)</div>

              {/* Pareja A */}
              <div className="text-xs font-bold text-left truncate">
                Pareja A (J1+J2)
              </div>
              <Input
                type="number"
                min="0"
                className="text-center h-8"
                value={setsInput.set1_local}
                onChange={(e) => setSetsInput({ ...setsInput, set1_local: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                className="text-center h-8"
                value={setsInput.set2_local}
                onChange={(e) => setSetsInput({ ...setsInput, set2_local: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                className="text-center h-8"
                placeholder="STB"
                value={setsInput.set3_local}
                onChange={(e) => setSetsInput({ ...setsInput, set3_local: e.target.value })}
              />

              {/* Pareja B */}
              <div className="text-xs font-bold text-left truncate">
                Pareja B (J3+J4)
              </div>
              <Input
                type="number"
                min="0"
                className="text-center h-8"
                value={setsInput.set1_visitante}
                onChange={(e) => setSetsInput({ ...setsInput, set1_visitante: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                className="text-center h-8"
                value={setsInput.set2_visitante}
                onChange={(e) => setSetsInput({ ...setsInput, set2_visitante: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                className="text-center h-8"
                placeholder="STB"
                value={setsInput.set3_visitante}
                onChange={(e) => setSetsInput({ ...setsInput, set3_visitante: e.target.value })}
              />
            </div>

            {/* Substitutes form section */}
            <div className="border-t pt-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Control de Ausencias (Suplentes)
              </h4>
              <p className="text-[10px] text-muted-foreground">
                Si un jugador titular faltó, escribe su nombre de suplente abajo. El titular recibirá 0 puntos de fecha.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <Label className="text-[10px]">{selectedPartido?.jugador1?.apellido || "Jugador 1"}</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Nombre suplente 1"
                    value={suplentesInput.suplente1}
                    onChange={(e) => setSuplentesInput({ ...suplentesInput, suplente1: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">{selectedPartido?.jugador2?.apellido || "Jugador 2"}</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Nombre suplente 2"
                    value={suplentesInput.suplente2}
                    onChange={(e) => setSuplentesInput({ ...suplentesInput, suplente2: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">{selectedPartido?.jugador3?.apellido || "Jugador 3"}</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Nombre suplente 3"
                    value={suplentesInput.suplente3}
                    onChange={(e) => setSuplentesInput({ ...suplentesInput, suplente3: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">{selectedPartido?.jugador4?.apellido || "Jugador 4"}</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Nombre suplente 4"
                    value={suplentesInput.suplente4}
                    onChange={(e) => setSuplentesInput({ ...suplentesInput, suplente4: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setScoreDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveScore}>Guardar Resultado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Week 8 Guided Draft */}
      <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-indigo-600" />
              Draft de Compañeros - Semana 8
            </DialogTitle>
            <DialogDescription>
              Selecciona los compañeros para los finalistas y los que jugarán por el 3º y 4º puesto, de entre los jugadores eliminados (puestos 3 al 12).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* Draft choice 1: Finalist 1 */}
            <div className="space-y-1">
              <Label className="font-semibold text-xs">
                Compañero para Finalista 1 (
                {standings.find((s) => s.jugador_id === draftChoices.finalista1_id)?.apellido || "Finalista 1"})
              </Label>
              <Select
                value={draftChoices.finalista1_partner}
                onValueChange={(v) => setDraftChoices({ ...draftChoices, finalista1_partner: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Elegir compañero..." />
                </SelectTrigger>
                <SelectContent>
                  {standings
                    .filter(
                      (s) =>
                        s.jugador_id !== draftChoices.finalista1_id &&
                        s.jugador_id !== draftChoices.finalista2_id &&
                        s.jugador_id !== draftChoices.tercero1_id &&
                        s.jugador_id !== draftChoices.tercero2_id
                    )
                    .map((s) => (
                      <SelectItem key={s.jugador_id} value={s.jugador_id}>
                        {s.apellido}, {s.nombre} (Puesto {standings.indexOf(s) + 1}º)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Draft choice 2: Finalist 2 */}
            <div className="space-y-1">
              <Label className="font-semibold text-xs">
                Compañero para Finalista 2 (
                {standings.find((s) => s.jugador_id === draftChoices.finalista2_id)?.apellido || "Finalista 2"})
              </Label>
              <Select
                value={draftChoices.finalista2_partner}
                onValueChange={(v) => setDraftChoices({ ...draftChoices, finalista2_partner: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Elegir compañero..." />
                </SelectTrigger>
                <SelectContent>
                  {standings
                    .filter(
                      (s) =>
                        s.jugador_id !== draftChoices.finalista1_id &&
                        s.jugador_id !== draftChoices.finalista2_id &&
                        s.jugador_id !== draftChoices.tercero1_id &&
                        s.jugador_id !== draftChoices.tercero2_id &&
                        s.jugador_id !== draftChoices.finalista1_partner
                    )
                    .map((s) => (
                      <SelectItem key={s.jugador_id} value={s.jugador_id}>
                        {s.apellido}, {s.nombre} (Puesto {standings.indexOf(s) + 1}º)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Draft choice 3: 3rd Place 1 */}
            <div className="space-y-1">
              <Label className="font-semibold text-xs">
                Compañero para 3º Contendiente 1 (
                {standings.find((s) => s.jugador_id === draftChoices.tercero1_id)?.apellido || "Contendiente 1"})
              </Label>
              <Select
                value={draftChoices.tercero1_partner}
                onValueChange={(v) => setDraftChoices({ ...draftChoices, tercero1_partner: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Elegir compañero..." />
                </SelectTrigger>
                <SelectContent>
                  {standings
                    .filter(
                      (s) =>
                        s.jugador_id !== draftChoices.finalista1_id &&
                        s.jugador_id !== draftChoices.finalista2_id &&
                        s.jugador_id !== draftChoices.tercero1_id &&
                        s.jugador_id !== draftChoices.tercero2_id &&
                        s.jugador_id !== draftChoices.finalista1_partner &&
                        s.jugador_id !== draftChoices.finalista2_partner
                    )
                    .map((s) => (
                      <SelectItem key={s.jugador_id} value={s.jugador_id}>
                        {s.apellido}, {s.nombre} (Puesto {standings.indexOf(s) + 1}º)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Draft choice 4: 3rd Place 2 */}
            <div className="space-y-1">
              <Label className="font-semibold text-xs">
                Compañero para 3º Contendiente 2 (
                {standings.find((s) => s.jugador_id === draftChoices.tercero2_id)?.apellido || "Contendiente 2"})
              </Label>
              <Select
                value={draftChoices.tercero2_partner}
                onValueChange={(v) => setDraftChoices({ ...draftChoices, tercero2_partner: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Elegir compañero..." />
                </SelectTrigger>
                <SelectContent>
                  {standings
                    .filter(
                      (s) =>
                        s.jugador_id !== draftChoices.finalista1_id &&
                        s.jugador_id !== draftChoices.finalista2_id &&
                        s.jugador_id !== draftChoices.tercero1_id &&
                        s.jugador_id !== draftChoices.tercero2_id &&
                        s.jugador_id !== draftChoices.finalista1_partner &&
                        s.jugador_id !== draftChoices.finalista2_partner &&
                        s.jugador_id !== draftChoices.tercero1_partner
                    )
                    .map((s) => (
                      <SelectItem key={s.jugador_id} value={s.jugador_id}>
                        {s.apellido}, {s.nombre} (Puesto {standings.indexOf(s) + 1}º)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDraftDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSaveDraftWeek8}>Generar Finales</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
