import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  User,
  Phone,
  Mail,
  MapPin,
  Award,
  Calendar,
  Trophy,
  Info,
  Hash,
  MessageSquareCode,
  UserCheck,
  ArrowUpCircle
} from "lucide-react";
import { PlayerStats } from "@/components/jugador/PlayerStats";
import { PlayerMatchHistory } from "@/components/jugador/PlayerMatchHistory";
import type { Database } from "@/integrations/supabase/types";

type Jugador = Database["public"]["Tables"]["jugadores"]["Row"] & { notas?: string | null };
type Categoria = Database["public"]["Tables"]["categorias"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jugador: Jugador;
  categorias: Categoria[];
}

interface TournamentResult {
  torneoId: string;
  torneoNombre: string;
  fechaInicio: string | null;
  partnerId: string | null;
  partnerNombre: string;
  instancia: string;
  puntos: number;
  estadoTorneo: string;
}

interface AscensoItem {
  id: string;
  catOrigenNombre: string;
  catDestinoNombre: string;
  puntosOrigen: number;
  puntosTransferidos: number;
  anio: number;
  fecha: string | null;
  notas: string | null;
}

const INSTANCIA_BADGE_STYLE: Record<string, string> = {
  campeon: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-black",
  subcampeon: "bg-slate-400/10 text-slate-600 dark:text-slate-300 border-slate-400/20 font-bold",
  semifinal: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  cuartos: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  octavos: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  dieciseisavos: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  treintaidosavos: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  zona: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
};

const INSTANCIA_LABEL: Record<string, string> = {
  campeon: "🏆 Campeón",
  subcampeon: "🥈 Subcampeón",
  semifinal: "Semifinal",
  cuartos: "Cuartos",
  octavos: "Octavos",
  dieciseisavos: "1/16 Final",
  treintaidosavos: "1/32 Final",
  zona: "Zona / Grupos",
};

export default function DetalleJugadorDialog({
  open,
  onOpenChange,
  jugador,
  categorias,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [torneosJugados, setTorneosJugados] = useState<TournamentResult[]>([]);
  const [ascensosHistorial, setAscensosHistorial] = useState<AscensoItem[]>([]);

  useEffect(() => {
    if (!open || !jugador.id) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // 1. Obtener todas las inscripciones del jugador
        const { data: inscripciones, error: errInsc } = await supabase
          .from("inscripciones")
          .select(`
            id,
            torneo_id,
            estado,
            torneos (
              nombre,
              estado,
              fecha_inicio
            ),
            jugador1:jugadores!inscripciones_jugador1_id_fkey (
              id,
              nombre,
              apellido
            ),
            jugador2:jugadores!inscripciones_jugador2_id_fkey (
              id,
              nombre,
              apellido
            )
          `)
          .or(`jugador1_id.eq.${jugador.id},jugador2_id.eq.${jugador.id}`);

        if (errInsc) throw errInsc;

        // 2. Obtener puntos de ranking otorgados a este jugador
        const { data: rankingPoints, error: errRank } = await supabase
          .from("ranking_jugadores")
          .select("id, torneo_id, inscripcion_id, instancia, puntos")
          .eq("jugador_id", jugador.id);

        if (errRank) throw errRank;

        const rankMap = new Map(
          (rankingPoints ?? []).map((r) => [r.inscripcion_id || r.torneo_id, r])
        );

        // 3. Procesar las inscripciones y unirlas al ranking de torneos
        const results: TournamentResult[] = (inscripciones ?? []).map((ins: any) => {
          const torneo = ins.torneos;

          // Resolver compañero
          const isJ1 = ins.jugador1?.id === jugador.id;
          const partner = isJ1 ? ins.jugador2 : ins.jugador1;
          const partnerNombre = partner
            ? `${partner.nombre} ${partner.apellido}`
            : "—";
          const partnerId = partner?.id ?? null;

          // Buscar instancia y puntos
          const rankEntry = rankMap.get(ins.id) || rankMap.get(ins.torneo_id);

          let instancia = "—";
          let puntos = 0;

          if (rankEntry) {
            instancia = rankEntry.instancia;
            puntos = rankEntry.puntos;
          } else {
            // No hay registro de ranking, calcular aproximado por estado
            if (torneo?.estado === "finalizado") {
              instancia = "zona"; // Asumir fase de grupos si finalizó sin puntos extra
            } else if (torneo?.estado === "en_curso") {
              instancia = "En curso";
            } else if (torneo?.estado === "inscripciones_cerradas") {
              instancia = "Inscripciones cerradas";
            } else if (torneo?.estado === "inscripciones_abiertas") {
              instancia = "Inscripto";
            } else if (torneo?.estado === "proximamente") {
              instancia = "Programado";
            } else {
              instancia = "Pendiente";
            }
          }

          return {
            torneoId: ins.torneo_id,
            torneoNombre: torneo?.nombre ?? "Torneo Desconocido",
            fechaInicio: torneo?.fecha_inicio ?? null,
            partnerId,
            partnerNombre,
            instancia,
            puntos,
            estadoTorneo: torneo?.estado ?? "desconocido",
          };
        });

        // Ordenar cronológicamente (más recientes primero)
        results.sort((a, b) => {
          if (!a.fechaInicio) return 1;
          if (!b.fechaInicio) return -1;
          return new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime();
        });

        setTorneosJugados(results);

        // 4. Obtener ascensos del jugador
        const { data: ascData } = await (supabase as any)
          .from("ascensos")
          .select("*")
          .eq("jugador_id", jugador.id)
          .order("anio", { ascending: false });

        const { data: catsAll } = await (supabase as any).from("categorias").select("id, nombre, genero");
        const { data: catsJugAll } = await (supabase as any).from("categorias_jugadores").select("id, nombre, genero");

        const catNameMap = new Map<string, string>();
        (catsAll ?? []).forEach((c: any) => catNameMap.set(c.id, `${c.nombre}${c.genero ? ' (' + c.genero + ')' : ''}`));
        (catsJugAll ?? []).forEach((c: any) => catNameMap.set(c.id, `${c.nombre}${c.genero ? ' (' + c.genero + ')' : ''}`));

        const ascResult: AscensoItem[] = (ascData ?? []).map((a: any) => ({
          id: a.id,
          catOrigenNombre: catNameMap.get(a.categoria_origen_id) || "Categoría Origen",
          catDestinoNombre: catNameMap.get(a.categoria_destino_id) || "Categoría Destino",
          puntosOrigen: a.puntos_origen || 0,
          puntosTransferidos: a.puntos_transferidos || 0,
          anio: a.anio,
          fecha: a.fecha || a.created_at || null,
          notas: a.notas || null,
        }));

        setAscensosHistorial(ascResult);
      } catch (err) {
        console.error("Error al obtener historial del jugador:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [open, jugador.id]);

  const categoriaLabel = () => {
    const c = categorias.find((c) => c.id === jugador.categoria_id);
    if (!c) return null;
    return `${
      c.genero === "caballeros"
        ? "Caballeros"
        : c.genero === "damas"
        ? "Damas"
        : "Mixto"
    } — ${c.nombre}`;
  };

  const getInstanciaBadge = (instancia: string) => {
    const normalized = instancia.toLowerCase();
    const style =
      INSTANCIA_BADGE_STYLE[normalized] ||
      "bg-muted text-muted-foreground border-border";
    const label = INSTANCIA_LABEL[normalized] || instancia;
    return (
      <Badge
        variant="outline"
        className={`px-2.5 py-0.5 text-xs font-bold rounded-md uppercase tracking-wider ${style}`}
      >
        {label}
      </Badge>
    );
  };

  const fmtFecha = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const hasPersonalData =
    jugador.dni || jugador.telefono || jugador.email || jugador.club || jugador.notas;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-6 overflow-hidden bg-background">
        <DialogHeader className="pb-3 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-black text-lg shadow-sm border border-primary/20">
                {jugador.nombre[0]}
                {jugador.apellido[0]}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {jugador.apellido}, {jugador.nombre}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <User className="h-3 w-3" /> Ficha de Administrador
                  {categoriaLabel() && (
                    <>
                      <span>·</span>
                      <Badge variant="secondary" className="text-[10px] font-bold py-0 h-4 px-1.5">
                        {categoriaLabel()}
                      </Badge>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="datos" className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0 bg-muted/60 max-w-lg">
            <TabsTrigger value="datos" className="text-xs font-bold">Datos y Stats</TabsTrigger>
            <TabsTrigger value="torneos" className="text-xs font-bold">Torneos y Parejas</TabsTrigger>
            <TabsTrigger value="ascensos" className="text-xs font-bold flex items-center gap-1">
              Ascensos {ascensosHistorial.length > 0 && <Badge variant="secondary" className="px-1 py-0 text-[10px] font-extrabold h-4">{ascensosHistorial.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="partidos" className="text-xs font-bold">Partidos</TabsTrigger>
          </TabsList>

          {/* TAB 1: DATOS PERSONALES Y ESTADÍSTICAS */}
          <TabsContent
            value="datos"
            className="flex-1 overflow-y-auto pr-1 mt-3 space-y-4 focus-visible:outline-none focus-visible:ring-0"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Información Personal */}
              <Card className="border shadow-sm md:col-span-1 h-fit">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Datos Personales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2 text-sm">
                  {jugador.dni && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                        <Hash className="h-3 w-3" /> DNI
                      </p>
                      <p className="font-semibold text-foreground">{jugador.dni}</p>
                    </div>
                  )}

                  {jugador.telefono && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Teléfono
                      </p>
                      <p className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                        {jugador.telefono}
                        <a
                          href={`https://wa.me/${jugador.telefono.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          title="Enviar WhatsApp"
                        >
                          <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer">
                            WhatsApp
                          </Badge>
                        </a>
                      </p>
                    </div>
                  )}

                  {jugador.email && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                        <Mail className="h-3 w-3" /> Email
                      </p>
                      <p className="font-semibold text-foreground truncate">{jugador.email}</p>
                    </div>
                  )}

                  {jugador.club && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Ciudad / Club
                      </p>
                      <p className="font-semibold text-foreground">{jugador.club}</p>
                    </div>
                  )}

                  {jugador.notas && (
                    <div className="space-y-1 pt-1 border-t">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                        <MessageSquareCode className="h-3 w-3" /> Notas
                      </p>
                      <p className="text-xs text-muted-foreground italic bg-muted/30 p-2.5 rounded-lg border border-dashed">
                        {jugador.notas}
                      </p>
                    </div>
                  )}

                  {!hasPersonalData && (
                    <p className="text-xs text-muted-foreground italic text-center py-4">
                      No hay datos adicionales registrados.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Estadísticas Globales */}
              <div className="md:col-span-2">
                <PlayerStats jugadorId={jugador.id} />
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: TORNEOS Y COMPAÑEROS */}
          <TabsContent
            value="torneos"
            className="flex-1 flex flex-col overflow-hidden mt-3 focus-visible:outline-none focus-visible:ring-0"
          >
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : torneosJugados.length === 0 ? (
              <div className="flex-1 border border-dashed rounded-xl flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Trophy className="h-10 w-10 text-muted-foreground/45 mb-2.5" />
                <p className="text-sm font-semibold">Sin torneos jugados</p>
                <p className="text-xs max-w-xs mt-1">Este jugador aún no tiene inscripciones registradas en el sistema.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto border rounded-xl shadow-sm bg-card">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground">Torneo</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground">Fecha</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground">Compañero</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground text-center">Instancia</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-muted-foreground text-right">Puntos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {torneosJugados.map((t, index) => (
                      <TableRow key={index} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-bold text-sm text-foreground max-w-[240px] truncate font-sans">
                          {t.torneoNombre}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                          {fmtFecha(t.fechaInicio)}
                        </TableCell>
                        <TableCell className="text-sm text-foreground font-sans">
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {t.partnerNombre}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {getInstanciaBadge(t.instancia)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-sm text-primary">
                          {t.puntos > 0 ? `+${t.puntos} pts` : "0 pts"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: ASCENSOS */}
          <TabsContent
            value="ascensos"
            className="flex-1 overflow-y-auto pr-1 mt-3 focus-visible:outline-none focus-visible:ring-0"
          >
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ascensosHistorial.length === 0 ? (
              <div className="flex-1 border border-dashed rounded-xl flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <ArrowUpCircle className="h-10 w-10 text-muted-foreground/45 mb-2.5" />
                <p className="text-sm font-semibold">Sin ascensos registrados</p>
                <p className="text-xs max-w-xs mt-1">Este jugador no registra ascensos de categoría en el sistema.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ascensosHistorial.map((asc) => (
                  <Card key={asc.id} className="border shadow-sm overflow-hidden bg-card">
                    <CardHeader className="p-3 bg-muted/30 pb-2 border-b">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <ArrowUpCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="font-bold text-sm text-foreground">
                            {asc.catOrigenNombre} <span className="text-muted-foreground">→</span> {asc.catDestinoNombre}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-semibold">
                            Año {asc.anio}
                          </Badge>
                          {asc.fecha && (
                            <span className="text-xs text-muted-foreground">
                              {fmtFecha(asc.fecha)}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-2 text-xs space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2 text-muted-foreground">
                        <span>Puntos acumulados en categoría origen: <strong className="text-foreground">{asc.puntosOrigen} pts</strong></span>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold">
                          +{asc.puntosTransferidos} pts transferidos (50%)
                        </Badge>
                      </div>
                      {asc.notas && (
                        <div className="p-2 rounded bg-muted/50 text-muted-foreground text-[11px] border border-border/50">
                          <strong>Observaciones:</strong> {asc.notas}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: PARTIDOS */}
          <TabsContent
            value="partidos"
            className="flex-1 overflow-y-auto pr-1 mt-3 focus-visible:outline-none focus-visible:ring-0"
          >
            <PlayerMatchHistory jugadorId={jugador.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
