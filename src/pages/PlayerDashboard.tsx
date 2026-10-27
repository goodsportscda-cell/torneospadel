import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calendar,
  Trophy,
  Award,
  MapPin,
  Loader2,
  User,
  LogOut,
  ExternalLink,
  Star,
  Sparkles,
  Users,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { ESTADO_TORNEO_BADGE, ESTADO_TORNEO_LABELS, type EstadoTorneo } from "@/lib/estadoTorneo";
import {
  isAscenso,
  construirContextoAscensosYTorneos,
  aplicarReglasMaster,
  getCupoDefaultCategoria,
  isCategoriaSuma,
  TORNEOS_REQUERIDOS_MASTER,
  TORNEOS_TOTALES_ANIO,
  type EstadoMasterTipo,
} from "@/lib/ranking";
import { MasterPlacaModal, type PlacaJugadorItem } from "@/components/ranking/MasterPlacaModal";
import { ModeToggle } from "@/components/mode-toggle";
import { PlayerStats } from "@/components/jugador/PlayerStats";
import { HeadToHead } from "@/components/jugador/HeadToHead";
import { PlayerInscriptions } from "@/components/jugador/PlayerInscriptions";
import { PlayerPerformanceChart } from "@/components/jugador/PlayerPerformanceChart";
import { PlayerMatchHistory } from "@/components/jugador/PlayerMatchHistory";
import { PlayerUpcomingMatches } from "@/components/jugador/PlayerUpcomingMatches";
import LegalLinks from "@/components/LegalLinks";

type Torneo = {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  sede: string | null;
  estado: string;
  multiplicador_puntos: number;
  numero_fecha: number | null;
  cupo_maximo: number | null;
  costo_inscripcion: number | null;
  tipo: string;
};

type MiTorneo = {
  torneo_id: string;
  torneo_nombre: string;
  instancia: string;
  puntos: number;
};

type RankingEntry = {
  categoria_id: string;
  categoria_nombre: string;
  genero: string;
  puntos_totales: number;
  posicion: number;
  cupo_master: number;
  es_suma: boolean;
  torneos_jugados: number;
  torneos_en_categoria: number;
  torneos_categoria_anterior: number;
  clasifica_master: boolean;
  es_suplente_master: boolean;
  posicion_master: number | null;
  orden_suplente: number | null;
  estado_master_tipo: EstadoMasterTipo;
  clasificados_lista: PlacaJugadorItem[];
  suplentes_lista: PlacaJugadorItem[];
};

export default function PlayerDashboard() {
  const { user, signOut, isAdmin, isOperador, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [jugadorId, setJugadorId] = useState<string | null>(null);
  const [jugadorNombre, setJugadorNombre] = useState("");
  const [misTorneos, setMisTorneos] = useState<MiTorneo[]>([]);
  const [miRanking, setMiRanking] = useState<RankingEntry[]>([]);
  const [placaEntry, setPlacaEntry] = useState<RankingEntry | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profile, setProfile] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    ciudad: "",
  });
  const anio = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      const { data: linkResult, error: linkError } = await (supabase as any).rpc(
        "get_or_link_my_player"
      );
      if (linkError) console.error("Error al verificar la ficha del jugador:", linkError);
      const jId = linkResult?.ok ? linkResult.jugador_id : null;
      setLinkMessage(linkResult?.ok ? null : linkResult?.error ?? null);
      setJugadorId(jId);

      // Get jugador name
      if (jId) {
        setJugadorNombre(`${linkResult.nombre} ${linkResult.apellido}`);
        setProfile({
          nombre: linkResult.nombre ?? "",
          apellido: linkResult.apellido ?? "",
          dni: linkResult.dni ?? "",
          telefono: linkResult.telefono ?? "",
          ciudad: linkResult.club ?? "",
        });
      }

      // Get upcoming/active tournaments
      const { data: torneosData } = await supabase
        .from("torneos")
        .select(
          "id, nombre, fecha_inicio, fecha_fin, sede, estado, multiplicador_puntos, numero_fecha, cupo_maximo, costo_inscripcion, tipo"
        )
        .in("estado", [
          "proximamente",
          "inscripciones_abiertas",
          "inscripciones_cerradas",
          "en_curso",
        ])
        .order("fecha_inicio", { ascending: true })
        .limit(10);
      const hoyArgentina = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      setTorneos(
        ((torneosData ?? []) as Torneo[]).filter((torneo) => {
          const ultimaFecha = torneo.fecha_fin || torneo.fecha_inicio;
          return ultimaFecha >= hoyArgentina;
        })
      );

      // If linked, get performance data & Master Race progress
      if (jId) {
        const [{ data: torneosPub }, { data: allCatsData }, { data: cuposData }, { data: ascData }] =
          await Promise.all([
            supabase.from("torneos").select("id, nombre").eq("ranking_publicado", true),
            supabase.from("categorias").select("id, nombre, genero").eq("activa", true),
            supabase.from("cupos_master").select("categoria_id, cupos"),
            supabase
              .from("ascensos")
              .select(
                "jugador_id, categoria_origen_id, categoria_destino_id, created_at, fecha"
              )
              .eq("anio", anio),
          ]);

        const idsPub = new Set((torneosPub ?? []).map((t) => t.id));
        const nameMap = new Map((torneosPub ?? []).map((t) => [t.id, t.nombre]));
        const allCats = (allCatsData ?? []) as { id: string; nombre: string; genero: string }[];
        const catMap = new Map(allCats.map((c) => [c.id, c]));
        const cuposMap = new Map<string, number>();
        (cuposData ?? []).forEach((c: { categoria_id: string; cupos: number }) =>
          cuposMap.set(c.categoria_id, c.cupos)
        );

        let allYearRank: any[] = [];
        const { data: rData, error: rErr } = await (supabase as any)
          .from("ranking_jugadores")
          .select("jugador_id, torneo_id, instancia, puntos, categoria_id, master_status")
          .eq("anio", anio);
        if (rErr && String(rErr.message || "").includes("master_status")) {
          const { data: rFallback } = await supabase
            .from("ranking_jugadores")
            .select("jugador_id, torneo_id, instancia, puntos, categoria_id")
            .eq("anio", anio);
          allYearRank = rFallback ?? [];
        } else {
          allYearRank = rData ?? [];
        }

        const validYearRank = allYearRank.filter(
          (r) => isAscenso(r.instancia) || (r.torneo_id && idsPub.has(r.torneo_id))
        );

        const myRankRows = validYearRank.filter((r) => r.jugador_id === jId);

        if (myRankRows.length > 0) {
          const grouped = new Map<string, MiTorneo>();
          myRankRows
            .filter((r) => !isAscenso(r.instancia) && r.torneo_id)
            .forEach((r) => {
              const existing = grouped.get(r.torneo_id);
              if (existing) {
                existing.puntos += r.puntos;
              } else {
                grouped.set(r.torneo_id, {
                  torneo_id: r.torneo_id,
                  torneo_nombre: nameMap.get(r.torneo_id) ?? "Torneo Oficial",
                  instancia: r.instancia,
                  puntos: r.puntos,
                });
              }
            });
          setMisTorneos(Array.from(grouped.values()));

          const { ascendidosDesde, obtenerMetricasMasterJugador } =
            construirContextoAscensosYTorneos({
              categorias: allCats,
              ascensos: (ascData ?? []) as any[],
              rankingRows: validYearRank,
            });

          // Categorías activas del jugador (excluyendo categorías de origen desde las que ascendió)
          const myActiveCatIds = [
            ...new Set(
              myRankRows
                .filter(
                  (r) =>
                    r.categoria_id && !ascendidosDesde.get(r.categoria_id)?.has(jId)
                )
                .map((r) => r.categoria_id as string)
            ),
          ];

          if (myActiveCatIds.length > 0) {
            const rankings: RankingEntry[] = [];

            for (const catId of myActiveCatIds) {
              const cat = catMap.get(catId);
              if (!cat) continue;

              const catRows = validYearRank.filter((r) => r.categoria_id === catId);
              const catAscendidos = ascendidosDesde.get(catId) ?? new Set<string>();

              const puntosMap = new Map<string, { ptsTorneos: number; ptsAscenso: number }>();
              catRows.forEach((r) => {
                if (catAscendidos.has(r.jugador_id)) return;
                const cur = puntosMap.get(r.jugador_id) ?? {
                  ptsTorneos: 0,
                  ptsAscenso: 0,
                };
                if (isAscenso(r.instancia)) {
                  cur.ptsAscenso = Math.max(cur.ptsAscenso, r.puntos);
                } else {
                  cur.ptsTorneos += r.puntos;
                }
                puntosMap.set(r.jugador_id, cur);
              });

              const jugIdsCat = Array.from(puntosMap.keys());
              const jugNamesMap = new Map<
                string,
                { id: string; nombre: string; apellido: string; club: string | null }
              >();
              for (let i = 0; i < jugIdsCat.length; i += 100) {
                const chunk = jugIdsCat.slice(i, i + 100);
                const { data: jData } = await supabase
                  .from("jugadores_publicos" as any)
                  .select("id, nombre, apellido, club")
                  .in("id", chunk);
                (jData ?? []).forEach((j: any) => jugNamesMap.set(j.id, j));
              }

              const sortedBase = Array.from(puntosMap.entries())
                .map(([playerId, pObj]) => {
                  const m = obtenerMetricasMasterJugador(playerId, catId);
                  const jInfo = jugNamesMap.get(playerId);
                  return {
                    jugador_id: playerId,
                    nombre: jInfo?.nombre ?? "?",
                    apellido: jInfo?.apellido ?? "?",
                    club: jInfo?.club ?? null,
                    puntos_totales: pObj.ptsTorneos + pObj.ptsAscenso,
                    torneos_jugados: m.torneos_jugados,
                    torneos_en_categoria: m.torneos_en_categoria,
                    torneos_categoria_anterior: m.torneos_categoria_anterior,
                    master_status: m.master_status,
                  };
                })
                .sort((a, b) => b.puntos_totales - a.puntos_totales)
                .map((row, idx) => ({
                  ...row,
                  posicion: idx + 1,
                }));

              const cupoMaster =
                cuposMap.get(catId) ?? getCupoDefaultCategoria(cat.nombre);
              const evaluados = aplicarReglasMaster(sortedBase, cupoMaster);
              const miFila = evaluados.find((e) => e.jugador_id === jId);

              if (miFila) {
                const clasificadosLista: PlacaJugadorItem[] = evaluados
                  .filter((e) => e.clasifica_master)
                  .map((e) => ({
                    jugador_id: e.jugador_id,
                    nombre: e.nombre,
                    apellido: e.apellido,
                    club: e.club,
                    puntos: e.puntos_totales,
                    torneos_jugados: e.torneos_jugados,
                    posicion_general: e.posicion,
                    posicion_master: e.posicion_master ?? e.posicion,
                  }));

                const suplentesLista: PlacaJugadorItem[] = evaluados
                  .filter((e) => e.es_suplente_master)
                  .map((e) => ({
                    jugador_id: e.jugador_id,
                    nombre: e.nombre,
                    apellido: e.apellido,
                    club: e.club,
                    puntos: e.puntos_totales,
                    torneos_jugados: e.torneos_jugados,
                    posicion_general: e.posicion,
                    posicion_master: e.posicion_master ?? e.posicion,
                    orden_suplente: e.orden_suplente,
                  }));

                rankings.push({
                  categoria_id: catId,
                  categoria_nombre: cat.nombre,
                  genero: cat.genero,
                  puntos_totales: miFila.puntos_totales,
                  posicion: miFila.posicion,
                  cupo_master: cupoMaster,
                  es_suma: isCategoriaSuma(cat.nombre),
                  torneos_jugados: miFila.torneos_jugados,
                  torneos_en_categoria: miFila.torneos_en_categoria,
                  torneos_categoria_anterior: miFila.torneos_categoria_anterior,
                  clasifica_master: miFila.clasifica_master,
                  es_suplente_master: miFila.es_suplente_master,
                  posicion_master: miFila.posicion_master,
                  orden_suplente: miFila.orden_suplente,
                  estado_master_tipo: miFila.estado_master_tipo,
                  clasificados_lista: clasificadosLista,
                  suplentes_lista: suplentesLista,
                });
              }
            }

            setMiRanking(rankings);
          }
        }
      }

      setLoading(false);
    };
    load();
  }, [user, anio]);

  const handleLinkMyPlayer = async () => {
    if (!user) return;
    setLinking(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_or_link_my_player");
      if (error) throw error;
      if (!data?.ok) {
        setLinkMessage(data?.error ?? "No se pudo vincular la ficha");
        return;
      }
      setJugadorId(data.jugador_id);
      setJugadorNombre(`${data.nombre} ${data.apellido}`);
      setProfile({
        nombre: data.nombre ?? "",
        apellido: data.apellido ?? "",
        dni: data.dni ?? "",
        telefono: data.telefono ?? "",
        ciudad: data.club ?? "",
      });
      setLinkMessage(null);
      toast.success("¡Perfil vinculado exitosamente!");
    } catch (err: any) {
      toast.error("Error al vincular perfil: " + (err?.message || "Intente nuevamente"));
    } finally {
      setLinking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sesión cerrada");
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("update_my_player_profile", {
        p_nombre: profile.nombre,
        p_apellido: profile.apellido,
        p_dni: profile.dni,
        p_telefono: profile.telefono,
        p_ciudad: profile.ciudad,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "No se pudieron guardar los datos");
      setJugadorNombre(`${data.nombre} ${data.apellido}`);
      setProfile({
        nombre: data.nombre ?? "",
        apellido: data.apellido ?? "",
        dni: data.dni ?? "",
        telefono: data.telefono ?? "",
        ciudad: data.club ?? "",
      });
      setProfileOpen(false);
      toast.success("Tus datos personales se actualizaron");
    } catch (err: any) {
      toast.error(err.message ?? "No se pudieron guardar tus datos");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleQuickEnroll = async (torneoId: string) => {
    if (!jugadorId) {
      toast.error("Debes vincular tu ficha de jugador primero.");
      return;
    }

    setLoading(true);
    const { data: existing } = await supabase
      .from("torneo_individual_jugadores")
      .select("id")
      .eq("torneo_id", torneoId)
      .eq("jugador_id", jugadorId)
      .maybeSingle();

    if (existing) {
      toast.info("Ya estás inscrito en este torneo.");
      setLoading(false);
      return;
    }

    const { data, error } = await (supabase as any).rpc(
      "inscribir_mi_americano_individual",
      {
        p_torneo_id: torneoId,
      }
    );

    setLoading(false);
    if (error || !data?.ok) {
      toast.error(
        "Error al inscribirte: " +
          (error?.message || data?.error || "Intente nuevamente")
      );
    } else {
      toast.success(
        data.estado === "lista_espera"
          ? "El cupo está completo. Quedaste en lista de espera."
          : "¡Inscripción confirmada exitosamente!"
      );
      window.location.reload();
    }
  };

  const labelGenero = (g: string) =>
    g === "caballeros" ? "Cab." : g === "damas" ? "Damas" : "Mixto";

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/panel" replace />;
  }
  if (isOperador) {
    return <Navigate to="/inscripciones" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="bg-primary p-1 rounded-md">
            <Trophy className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold leading-none">Padel ID</h1>
            <p className="text-[10px] text-muted-foreground uppercase">
              Padel ID · Perfil de jugador
            </p>
          </div>
          <ModeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Welcome + Profile Link */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">¡Hola!</p>
                  <p className="font-semibold truncate">
                    {jugadorNombre || user?.email?.split("@")[0] || "Jugador"}
                  </p>
                </div>
              </div>

              {!jugadorId && (
                <Card className="border-dashed">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Vinculá tu cuenta usando el mismo correo verificado que figura en tu
                      ficha de jugador.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleLinkMyPlayer}
                      disabled={linking}
                      className="w-full"
                    >
                      {linking ? "Verificando correo..." : "Verificar y vincular mi ficha"}
                    </Button>
                    {linkMessage && (
                      <p
                        className="text-xs text-muted-foreground text-center"
                        role="status"
                      >
                        {linkMessage}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {jugadorId && (
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {miRanking.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-bold"
                      asChild
                    >
                      <Link to="/ranking-publico">
                        Ver ranking completo <Award className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                  <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        Editar mis datos
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Mis datos personales</DialogTitle>
                        <DialogDescription>
                          Podés actualizar tus datos de contacto. Tu categoría y rendimiento
                          deportivo se administran por club.
                        </DialogDescription>
                      </DialogHeader>
                      <p className="text-xs text-muted-foreground">
                        Usamos estos datos para identificar tu ficha y comunicarnos con vos.{" "}
                        <Link
                          to="/privacidad"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Consultar privacidad
                        </Link>
                        .
                      </p>
                      <div className="grid gap-3">
                        {(
                          [
                            ["nombre", "Nombre"],
                            ["apellido", "Apellido"],
                            ["dni", "DNI"],
                            ["telefono", "Teléfono"],
                            ["ciudad", "Ciudad"],
                          ] as const
                        ).map(([key, label]) => (
                          <div className="grid gap-1.5" key={key}>
                            <Label htmlFor={`perfil-${key}`}>{label}</Label>
                            <Input
                              id={`perfil-${key}`}
                              value={profile[key]}
                              onChange={(e) =>
                                setProfile({ ...profile, [key]: e.target.value })
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setProfileOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveProfile} disabled={profileSaving}>
                          {profileSaving ? "Guardando…" : "Guardar"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            {/* TARJETA DESTACADA: CAMINO AL MASTER DICIEMBRE */}
            {jugadorId && miRanking.length > 0 && (
              <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary fill-primary" />
                    Camino al Master Diciembre {anio}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {miRanking.map((r) => {
                    const progresoPct = Math.min(
                      100,
                      Math.round((r.torneos_jugados / TORNEOS_REQUERIDOS_MASTER) * 100)
                    );
                    const faltanTorneos = Math.max(
                      0,
                      TORNEOS_REQUERIDOS_MASTER - r.torneos_jugados
                    );

                    return (
                      <div
                        key={r.categoria_id}
                        className="rounded-xl border bg-card/80 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-bold">
                              {labelGenero(r.genero)} — {r.categoria_nombre}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {r.puntos_totales} puntos acumulados en la temporada
                            </p>
                          </div>

                          {r.estado_master_tipo === "clasificando" ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-bold">
                              <Star className="h-3 w-3 fill-current" />
                              Clasificando al Master (#{r.posicion_master} de{" "}
                              {r.cupo_master})
                            </Badge>
                          ) : r.estado_master_tipo === "suplente" ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-bold"
                            >
                              Suplente Master #{r.orden_suplente}
                            </Badge>
                          ) : r.estado_master_tipo === "baja" ? (
                            <Badge
                              variant="outline"
                              className="border-destructive/40 text-destructive bg-destructive/5 gap-1"
                            >
                              <Ban className="h-3 w-3" />
                              Baja Master
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Faltan {faltanTorneos} torneo{faltanTorneos === 1 ? "" : "s"}{" "}
                              ({r.torneos_jugados}/{TORNEOS_REQUERIDOS_MASTER})
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          <div className="rounded-lg bg-muted/50 p-2.5 border">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">
                              Puesto Ranking Real
                            </p>
                            <p className="text-lg font-black mt-0.5">#{r.posicion}</p>
                          </div>
                          <div className="rounded-lg bg-primary/5 p-2.5 border border-primary/20">
                            <p className="text-[10px] uppercase text-primary font-bold">
                              Puesto Efectivo Master
                            </p>
                            <p className="text-lg font-black text-primary mt-0.5">
                              {r.posicion_master != null
                                ? `#${r.posicion_master} / ${r.cupo_master}`
                                : `Pendiente (${r.torneos_jugados}/${TORNEOS_REQUERIDOS_MASTER} T)`}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-2.5 border col-span-2 sm:col-span-1">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">
                              Torneos del Año
                            </p>
                            <p className="text-lg font-black mt-0.5">
                              {r.torneos_jugados} / {TORNEOS_TOTALES_ANIO}
                            </p>
                          </div>
                        </div>

                        {/* Barra de progreso X/4 torneos requeridos */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold">
                              Requisito de torneos:{" "}
                              <strong className="text-primary">
                                {Math.min(r.torneos_jugados, TORNEOS_REQUERIDOS_MASTER)}/
                                {TORNEOS_REQUERIDOS_MASTER} requeridos
                              </strong>{" "}
                              ({r.torneos_jugados}/{TORNEOS_TOTALES_ANIO} jugados en el año)
                            </span>
                            <span className="text-muted-foreground font-mono">
                              {progresoPct}%
                            </span>
                          </div>
                          <Progress value={progresoPct} className="h-2.5" />
                          {r.torneos_categoria_anterior > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              Incluye {r.torneos_en_categoria} torneo(s) en esta categoría +{" "}
                              {r.torneos_categoria_anterior} en tu categoría anterior por
                              ascenso.
                            </p>
                          )}
                        </div>

                        {r.es_suma && (
                          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 font-medium">
                            <Users className="h-4 w-4 shrink-0" />
                            <span>
                              En Suma 8 clasifican los Top 8 titulares y cada uno elige
                              compañero/a respetando que sus categorías sumen 8.
                            </span>
                          </div>
                        )}

                        {r.clasifica_master && (
                          <div className="pt-1">
                            <Button
                              size="sm"
                              className="w-full gap-2 font-bold"
                              onClick={() => setPlacaEntry(r)}
                            >
                              <Sparkles className="h-4 w-4" />
                              Descargar mi pase al Master
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Global Stats */}
            {jugadorId && <PlayerStats jugadorId={jugadorId} />}

            {/* Próximos Partidos */}
            {jugadorId && <PlayerUpcomingMatches jugadorId={jugadorId} />}

            {/* Evolución de Rendimiento */}
            {jugadorId && <PlayerPerformanceChart jugadorId={jugadorId} />}

            {/* Active Inscriptions and Matches */}
            {jugadorId && <PlayerInscriptions jugadorId={jugadorId} />}

            {/* Historial Completo de Partidos */}
            {jugadorId && <PlayerMatchHistory jugadorId={jugadorId} />}

            {/* My Ranking */}
            {jugadorId && miRanking.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    Mi ranking — {anio}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {miRanking.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {labelGenero(r.genero)} — {r.categoria_nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Posición General #{r.posicion} · {r.torneos_jugados}/
                            {TORNEOS_TOTALES_ANIO} torneos
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">
                            {r.puntos_totales}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            puntos
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* My Tournament Results */}
            {jugadorId && misTorneos.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    Mis torneos — {anio}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {misTorneos.map((t) => (
                      <li
                        key={t.torneo_id}
                        className="flex items-center justify-between p-2 border-b border-border/40 last:border-0 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{t.torneo_nombre}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {t.instancia}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 font-bold">
                          {t.puntos} pts
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Head to Head */}
            {jugadorId && (
              <HeadToHead jugadorId={jugadorId} jugadorNombre={jugadorNombre} />
            )}

            {/* Upcoming Tournaments */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Torneos próximos y en curso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  Al inscribirte, el organizador usa tu ficha para gestionar el torneo. Tu
                  nombre, participación, resultados y puntos integran la actividad pública.{" "}
                  <Link
                    to="/privacidad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Consultar privacidad
                  </Link>
                  .
                </p>
                {torneos.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">
                    No hay torneos programados.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {torneos.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 group"
                      >
                        <div className="flex flex-col items-center justify-center bg-muted rounded-md w-12 h-12 shrink-0">
                          <span className="text-[10px] uppercase text-muted-foreground leading-none">
                            {new Date(t.fecha_inicio + "T00:00:00").toLocaleDateString(
                              "es-AR",
                              { month: "short" }
                            )}
                          </span>
                          <span className="text-base font-bold leading-none mt-0.5">
                            {new Date(t.fecha_inicio + "T00:00:00").getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{t.nombre}</span>
                              {t.numero_fecha != null && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  Fecha {t.numero_fecha}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] gap-1 px-2"
                                asChild
                              >
                                <Link
                                  to={
                                    t.tipo === "americano_individual"
                                      ? `/torneo-individual/${t.id}`
                                      : `/torneo/${t.id}`
                                  }
                                >
                                  Ver muro <ExternalLink className="h-3 w-3" />
                                </Link>
                              </Button>
                              {t.estado === "inscripciones_abiertas" && (
                                <>
                                  {t.tipo === "americano_individual" ? (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 text-[10px] px-2 bg-green-600 hover:bg-green-700 text-white"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (
                                          window.confirm(
                                            "¿Confirmás tu inscripción a este torneo?"
                                          )
                                        ) {
                                          handleQuickEnroll(t.id);
                                        }
                                      }}
                                    >
                                      Inscripción Rápida (1 Clic)
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 text-[10px] px-2 bg-primary/90 hover:bg-primary"
                                      asChild
                                    >
                                      <Link
                                        to={`/inscribirse/${t.id}${
                                          jugadorId ? `?j1=${jugadorId}` : ""
                                        }`}
                                      >
                                        Inscribirme
                                      </Link>
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {t.sede && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {t.sede}
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className={`text-[10px] ${
                                ESTADO_TORNEO_BADGE[t.estado as EstadoTorneo]
                              }`}
                            >
                              {ESTADO_TORNEO_LABELS[t.estado as EstadoTorneo]}
                            </Badge>
                            {t.costo_inscripcion != null && (
                              <span className="text-xs text-muted-foreground">
                                ${t.costo_inscripcion}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {placaEntry && (
        <MasterPlacaModal
          open={Boolean(placaEntry)}
          onOpenChange={(o) => {
            if (!o) setPlacaEntry(null);
          }}
          categoriaNombre={placaEntry.categoria_nombre}
          categoriaGenero={placaEntry.genero}
          anio={anio}
          cupo={placaEntry.cupo_master}
          clasificados={placaEntry.clasificados_lista}
          suplentes={placaEntry.suplentes_lista}
          jugadorDestacadoId={jugadorId}
          modoInicial="individual"
        />
      )}

      <footer className="border-t px-4 py-6 text-muted-foreground">
        <LegalLinks />
      </footer>
    </div>
  );
}
