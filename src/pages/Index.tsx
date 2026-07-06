import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Trophy,
  ClipboardList,
  Award,
  ArrowRight,
  MapPin,
  Loader2,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ESTADO_TORNEO_BADGE, type EstadoTorneo } from "@/lib/estadoTorneo";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { activeTenant } from "@/lib/tenant";
import { useAuth } from "@/hooks/useAuth";

type TorneoProx = {
  id: string;
  nombre: string;
  fecha_inicio: string;
  sede: string | null;
  tipo: string;
  estado: string;
  multiplicador_puntos: number;
  numero_fecha: number | null;
};

type InscripcionReciente = {
  id: string;
  fecha_inscripcion: string;
  torneo_nombre: string;
  torneo_id: string;
  jugador1: string;
  jugador2: string;
};

type CategoriaRanking = {
  categoria_id: string;
  categoria_nombre: string;
  genero: string;
  top: { jugador_id: string; nombre: string; apellido: string; puntos: number }[];
};

const labelGenero = (g: string) =>
  g === "caballeros" ? "Caballeros" : g === "damas" ? "Damas" : "Mixto";

const fmtFecha = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });

const Index = () => {
  const { clubId, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [torneos, setTorneos] = useState<TorneoProx[]>([]);
  const [inscripciones, setInscripciones] = useState<InscripcionReciente[]>([]);
  const [ranking, setRanking] = useState<CategoriaRanking[]>([]);
  const anio = new Date().getFullYear();

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const hoy = new Date().toISOString().slice(0, 10);

      let torneosQuery = supabase
          .from("torneos")
          .select("id, nombre, fecha_inicio, sede, tipo, estado, multiplicador_puntos, numero_fecha")
          .in("estado", ["proximamente", "inscripciones_abiertas", "inscripciones_cerradas", "en_curso"])
          .order("fecha_inicio", { ascending: true })
          .limit(5);

      let inscripcionesQuery = supabase
          .from("inscripciones")
          .select(
            "id, fecha_inscripcion, created_at, torneo_id, jugador1_id, jugador2_id, torneos!inner(id, nombre, estado, club_id)"
          )
          .eq("torneos.estado", "inscripciones_abiertas")
          .order("created_at", { ascending: false })
          .limit(8);

      let categoriasQuery = supabase
          .from("categorias")
          .select("id, nombre, genero, orden")
          .eq("activa", true)
          .order("orden");

      // Filter by clubId if not superadmin
      if (!isSuperAdmin && clubId) {
        torneosQuery = torneosQuery.eq("club_id", clubId);
        inscripcionesQuery = inscripcionesQuery.eq("torneos.club_id", clubId);
        categoriasQuery = categoriasQuery.eq("club_id", clubId);
      }

      const [torneosRes, inscRes, catsRes, rankingRes] = await Promise.all([
        torneosQuery,
        inscripcionesQuery,
        categoriasQuery,
        supabase
          .from("ranking_jugadores")
          .select("jugador_id, puntos, categoria_id")
          .eq("anio", anio),
      ]);

      setTorneos((torneosRes.data ?? []) as TorneoProx[]);

      // Cargar nombres de jugadores para inscripciones
      const inscRaw = (inscRes.data ?? []) as Array<{
        id: string;
        fecha_inscripcion: string;
        created_at: string;
        torneo_id: string;
        jugador1_id: string;
        jugador2_id: string;
        torneos: { id: string; nombre: string; estado: string };
      }>;
      const jugadorIds = new Set<string>();
      inscRaw.forEach((i) => {
        jugadorIds.add(i.jugador1_id);
        jugadorIds.add(i.jugador2_id);
      });

      // También necesitamos jugadores del ranking
      const puntosPorCat = new Map<string, Map<string, number>>();
      (rankingRes.data ?? []).forEach((r) => {
        if (!r.categoria_id) return;
        if (!puntosPorCat.has(r.categoria_id)) {
          puntosPorCat.set(r.categoria_id, new Map());
        }
        const m = puntosPorCat.get(r.categoria_id)!;
        m.set(r.jugador_id, (m.get(r.jugador_id) ?? 0) + r.puntos);
      });
      puntosPorCat.forEach((m) => m.forEach((_, id) => jugadorIds.add(id)));

      let jugadores: { id: string; nombre: string; apellido: string }[] = [];
      if (jugadorIds.size > 0) {
        const idsArray = Array.from(jugadorIds);
        const chunkSize = 100;
        const chunks = [];
        for (let i = 0; i < idsArray.length; i += chunkSize) {
          chunks.push(idsArray.slice(i, i + chunkSize));
        }
        try {
          const results = await Promise.all(
            chunks.map(chunk => 
              supabase
                .from("jugadores")
                .select("id, nombre, apellido")
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
      }
      const jMap = new Map(
        jugadores.map((j) => [j.id, j] as const)
      );

      const inscFmt: InscripcionReciente[] = inscRaw.map((i) => {
        const j1 = jMap.get(i.jugador1_id);
        const j2 = jMap.get(i.jugador2_id);
        return {
          id: i.id,
          fecha_inscripcion: i.fecha_inscripcion,
          torneo_id: i.torneo_id,
          torneo_nombre: i.torneos.nombre,
          jugador1: j1 ? `${j1.apellido}, ${j1.nombre}` : "?",
          jugador2: j2 ? `${j2.apellido}, ${j2.nombre}` : "?",
        };
      });
      setInscripciones(inscFmt);

      // Top 3 por categoría
      const cats = (catsRes.data ?? []) as Array<{
        id: string;
        nombre: string;
        genero: string;
      }>;
      const rankingPorCat: CategoriaRanking[] = cats
        .map((c) => {
          const m = puntosPorCat.get(c.id);
          const top = m
            ? Array.from(m.entries())
                .map(([jid, p]) => {
                  const j = jMap.get(jid);
                  return {
                    jugador_id: jid,
                    nombre: j?.nombre ?? "?",
                    apellido: j?.apellido ?? "?",
                    puntos: p,
                  };
                })
                .sort((a, b) => b.puntos - a.puntos)
                .slice(0, 3)
            : [];
          return {
            categoria_id: c.id,
            categoria_nombre: c.nombre,
            genero: c.genero,
            top,
          };
        })
        .filter((c) => c.top.length > 0); // solo categorías con datos
      setRanking(rankingPorCat);

      setLoading(false);
    };
    cargar();
  }, [anio]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <PadelIdLogo size={48} showText={true} />
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          {/* active client info badge */}
          <div className="flex items-center gap-2.5 bg-muted/50 dark:bg-muted/20 border border-border/80 rounded-xl px-4 py-2 w-full sm:w-auto">
            <img
              src={activeTenant.logo}
              alt={activeTenant.name}
              className="h-8 w-8 object-contain shrink-0 rounded"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider leading-none">Organizado por</p>
              <h2 className="text-sm font-bold text-foreground leading-tight mt-0.5">{activeTenant.name}</h2>
              <p className="text-[9px] text-muted-foreground font-medium leading-none mt-0.5">{activeTenant.subtext}</p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 sm:flex-none gap-2 font-semibold shadow-sm"
              onClick={() => {
                const url = `${window.location.origin}/c/${activeTenant.slug}/`;
                navigator.clipboard.writeText(url);
                toast.success("¡Enlace copiado al portapapeles!");
              }}
            >
              <Share2 className="h-4 w-4" />
              Compartir Portal
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Link to={`/c/${activeTenant.slug}/`} target="_blank">
                Ver
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Próximos torneos */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Próximos torneos
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/torneos">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {torneos.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No hay torneos próximos.
                </p>
              ) : (
                <ul className="space-y-2">
                  {torneos.map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/inscripciones?torneo=${t.id}`}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col items-center justify-center bg-muted rounded-md w-12 h-12 shrink-0">
                          <span className="text-[10px] uppercase text-muted-foreground leading-none">
                            {new Date(t.fecha_inicio + "T00:00:00").toLocaleDateString("es-AR", { month: "short" })}
                          </span>
                          <span className="text-base font-bold leading-none mt-0.5">
                            {new Date(t.fecha_inicio + "T00:00:00").getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{t.nombre}</span>
                            {t.numero_fecha != null && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Fecha {t.numero_fecha}
                              </Badge>
                            )}
                            {Number(t.multiplicador_puntos) >= 2 && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">
                                x{Number(t.multiplicador_puntos)}
                              </Badge>
                            )}
                          </div>
                          {t.sede && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3" /> {t.sede}
                            </div>
                          )}
                        </div>
                        <Badge
                          className={`text-[10px] shrink-0 ${ESTADO_TORNEO_BADGE[t.estado as EstadoTorneo]}`}
                        >
                          {t.estado === "inscripciones_abiertas"
                            ? "Inscripciones"
                            : t.estado === "inscripciones_cerradas"
                            ? "Cerrado"
                            : t.estado === "proximamente"
                            ? "Próximamente"
                            : "En curso"}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Inscripciones recientes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Inscripciones recientes
              </CardTitle>
              <CardDescription className="text-xs">
                De torneos con inscripciones abiertas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inscripciones.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  Sin inscripciones recientes.
                </p>
              ) : (
                <ul className="space-y-2">
                  {inscripciones.map((i) => (
                    <li
                      key={i.id}
                      className="text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0"
                    >
                      <div className="font-medium truncate">{i.jugador1}</div>
                      <div className="text-muted-foreground truncate">{i.jugador2}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between gap-2">
                        <span className="truncate">{i.torneo_nombre}</span>
                        <span className="shrink-0">{fmtFecha(i.fecha_inscripcion)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Top ranking por categoría */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  Top 3 del ranking — {anio}
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/ranking">
                    Ver completo <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {ranking.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  Aún no hay puntos cargados este año.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ranking.map((c) => (
                    <div
                      key={c.categoria_id}
                      className="border rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {labelGenero(c.genero)} — {c.categoria_nombre}
                        </span>
                      </div>
                      <ol className="space-y-1">
                        {c.top.map((j, idx) => (
                          <li
                            key={j.jugador_id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span
                              className={`text-xs font-bold w-5 text-center shrink-0 ${
                                idx === 0
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {idx + 1}°
                            </span>
                            <span className="flex-1 truncate">
                              {j.apellido}, {j.nombre}
                            </span>
                            <span className="font-bold text-sm shrink-0">
                              {j.puntos}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Atajos rápidos */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Atajos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link to="/jugadores">Jugadores</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link to="/inscripciones">Inscripciones</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link to="/zonas">Zonas</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link to="/llaves">Llaves</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link to="/posiciones">Posiciones</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link to="/calendario">Calendario</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link to="/master">Master</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <Link to="/importar">Importar</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Index;
