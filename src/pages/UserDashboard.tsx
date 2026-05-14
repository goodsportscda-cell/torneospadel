import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Trophy,
  Award,
  MapPin,
  Loader2,
  User,
  LogOut,
  Search,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ESTADO_TORNEO_BADGE, ESTADO_TORNEO_LABELS, type EstadoTorneo } from "@/lib/estadoTorneo";
import { ModeToggle } from "@/components/mode-toggle";
import { PlayerStats } from "@/components/jugador/PlayerStats";
import { HeadToHead } from "@/components/jugador/HeadToHead";
import { PlayerInscriptions } from "@/components/jugador/PlayerInscriptions";

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
};

type MiTorneo = {
  torneo_id: string;
  torneo_nombre: string;
  instancia: string;
  puntos: number;
};

type RankingEntry = {
  categoria_nombre: string;
  genero: string;
  puntos_totales: number;
  posicion: number;
};

const fmtFecha = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function UserDashboard() {
  const { user, signOut, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [jugadorId, setJugadorId] = useState<string | null>(null);
  const [jugadorNombre, setJugadorNombre] = useState("");
  const [misTorneos, setMisTorneos] = useState<MiTorneo[]>([]);
  const [miRanking, setMiRanking] = useState<RankingEntry[]>([]);
  const [linking, setLinking] = useState(false);
  const [searchDni, setSearchDni] = useState("");
  const [searchNombre, setSearchNombre] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; nombre: string; apellido: string; dni: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const anio = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      // Get profile to check if linked to jugador
      const { data: profile } = await supabase
        .from("profiles")
        .select("jugador_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const jId = profile?.jugador_id ?? null;
      setJugadorId(jId);

      // Get jugador name
      if (jId) {
        const { data: jug } = await supabase
          .from("jugadores")
          .select("nombre, apellido")
          .eq("id", jId)
          .maybeSingle();
        if (jug) setJugadorNombre(`${jug.nombre} ${jug.apellido}`);
      }

      // Get upcoming/active tournaments
      const { data: torneosData } = await supabase
        .from("torneos")
        .select("id, nombre, fecha_inicio, fecha_fin, sede, estado, multiplicador_puntos, numero_fecha, cupo_maximo, costo_inscripcion")
        .in("estado", ["proximamente", "inscripciones_abiertas", "inscripciones_cerradas", "en_curso"])
        .order("fecha_inicio", { ascending: true })
        .limit(10);
      setTorneos((torneosData ?? []) as Torneo[]);

      // If linked, get performance data
      if (jId) {
        // My tournament results
        const { data: rankData } = await supabase
          .from("ranking_jugadores")
          .select("torneo_id, instancia, puntos, categoria_id")
          .eq("jugador_id", jId)
          .eq("anio", anio);

        if (rankData && rankData.length > 0) {
          const torneoIds = [...new Set(rankData.map(r => r.torneo_id))];
          const { data: torneoNames } = await supabase
            .from("torneos")
            .select("id, nombre")
            .in("id", torneoIds);
          const nameMap = new Map((torneoNames ?? []).map(t => [t.id, t.nombre]));

          const grouped = new Map<string, MiTorneo>();
          rankData.forEach(r => {
            const existing = grouped.get(r.torneo_id);
            if (existing) {
              existing.puntos += r.puntos;
            } else {
              grouped.set(r.torneo_id, {
                torneo_id: r.torneo_id,
                torneo_nombre: nameMap.get(r.torneo_id) ?? "?",
                instancia: r.instancia,
                puntos: r.puntos,
              });
            }
          });
          setMisTorneos(Array.from(grouped.values()));

          // My ranking position per category
          const catIds = [...new Set(rankData.filter(r => r.categoria_id).map(r => r.categoria_id!))];
          if (catIds.length > 0) {
            const { data: cats } = await supabase
              .from("categorias")
              .select("id, nombre, genero")
              .in("id", catIds);
            const catMap = new Map((cats ?? []).map(c => [c.id, c]));

            // Get all ranking for those categories to compute position
            const { data: allRank } = await supabase
              .from("ranking_jugadores")
              .select("jugador_id, puntos, categoria_id")
              .eq("anio", anio)
              .in("categoria_id", catIds);

            const puntosPorCat = new Map<string, Map<string, number>>();
            (allRank ?? []).forEach(r => {
              if (!r.categoria_id) return;
              if (!puntosPorCat.has(r.categoria_id)) puntosPorCat.set(r.categoria_id, new Map());
              const m = puntosPorCat.get(r.categoria_id)!;
              m.set(r.jugador_id, (m.get(r.jugador_id) ?? 0) + r.puntos);
            });

            const rankings: RankingEntry[] = [];
            puntosPorCat.forEach((m, catId) => {
              const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
              const pos = sorted.findIndex(([id]) => id === jId);
              const cat = catMap.get(catId);
              if (pos >= 0 && cat) {
                rankings.push({
                  categoria_nombre: cat.nombre,
                  genero: cat.genero,
                  puntos_totales: m.get(jId) ?? 0,
                  posicion: pos + 1,
                });
              }
            });
            setMiRanking(rankings);
          }
        }
      }

      setLoading(false);
    };
    load();
  }, [user, anio]);

  const handleSearch = async () => {
    if (!searchDni.trim() && !searchNombre.trim()) return;
    setSearching(true);
    let query = supabase.from("jugadores").select("id, nombre, apellido, dni");
    if (searchDni.trim()) {
      query = query.eq("dni", searchDni.trim());
    } else {
      query = query.ilike("apellido", `%${searchNombre.trim()}%`);
    }
    const { data } = await query.limit(5);
    setSearchResults(data ?? []);
    setSearching(false);
  };

  const handleLink = async (jid: string) => {
    if (!user) return;
    setLinking(true);
    const { error } = await supabase
      .from("profiles")
      .update({ jugador_id: jid })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Error al vincular perfil");
    } else {
      toast.success("¡Perfil vinculado!");
      setJugadorId(jid);
      const j = searchResults.find(r => r.id === jid);
      if (j) setJugadorNombre(`${j.nombre} ${j.apellido}`);
      setSearchResults([]);
    }
    setLinking(false);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sesión cerrada");
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
    return <Navigate to="/" replace />;
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
            <p className="text-[10px] text-muted-foreground uppercase">Anita Quiroga</p>
          </div>
          <ModeToggle />
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Cerrar sesión">
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
                      Vinculá tu cuenta con tu ficha de jugador en Padel ID para ver tu rendimiento y ranking.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">DNI</Label>
                        <Input
                          placeholder="Ej: 35123456"
                          value={searchDni}
                          onChange={(e) => setSearchDni(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Apellido</Label>
                        <Input
                          placeholder="Ej: García"
                          value={searchNombre}
                          onChange={(e) => setSearchNombre(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <Button size="sm" onClick={handleSearch} disabled={searching} className="w-full">
                      <Search className="h-3.5 w-3.5 mr-1" />
                      {searching ? "Buscando..." : "Buscar mi ficha"}
                    </Button>
                    {searchResults.length > 0 && (
                      <ul className="space-y-1">
                        {searchResults.map((j) => (
                          <li
                            key={j.id}
                            className="flex items-center justify-between p-2 rounded-md border text-sm"
                          >
                            <span>{j.apellido}, {j.nombre} {j.dni ? `(${j.dni})` : ""}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLink(j.id)}
                              disabled={linking}
                            >
                              Vincular
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {searchResults.length === 0 && (searchDni || searchNombre) && !searching && (
                      <p className="text-xs text-muted-foreground text-center">
                        No se encontraron resultados
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
              {jugadorId && miRanking.length > 0 && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-bold" asChild>
                    <Link to="/ranking-publico">
                      Ver ranking completo <Award className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Global Stats */}
            {jugadorId && (
              <PlayerStats jugadorId={jugadorId} />
            )}

            {/* Active Inscriptions and Matches */}
            {jugadorId && (
              <PlayerInscriptions jugadorId={jugadorId} />
            )}

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
                            Posición #{r.posicion}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{r.puntos_totales}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">puntos</p>
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
                          <p className="text-xs text-muted-foreground capitalize">{t.instancia}</p>
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
                            {new Date(t.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR", { month: "short" })}
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
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
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
                                <Link to={`/torneo/${t.id}`}>
                                  Ver muro <ExternalLink className="h-3 w-3" />
                                </Link>
                              </Button>
                              {t.estado === "inscripciones_abiertas" && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-7 text-[10px] px-2 bg-primary/90 hover:bg-primary"
                                  asChild
                                >
                                  <Link to={`/inscribirse/${t.id}`}>Inscribirme</Link>
                                </Button>
                              )}
                            </div>
                          </div>
                          {t.sede && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {t.sede}
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[10px] ${ESTADO_TORNEO_BADGE[t.estado as EstadoTorneo]}`}>
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
    </div>
  );
}
