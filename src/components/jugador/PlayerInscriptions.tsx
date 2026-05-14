import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, CalendarClock, MapPin, ExternalLink, CheckCircle2, Clock } from "lucide-react";
const PAGO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
};

const PAGO_BADGE: Record<string, string> = {
  pendiente: "bg-destructive text-destructive-foreground",
  parcial: "bg-secondary text-secondary-foreground",
  pagado: "bg-primary text-primary-foreground",
};

const ESTADO_INSC_LABELS: Record<string, string> = {
  pendiente_confirmacion: "Por confirmar",
  confirmada: "Confirmada",
  lista_espera: "Lista de espera",
  cancelada: "Cancelada",
};

const ESTADO_INSC_BADGE: Record<string, string> = {
  pendiente_confirmacion: "bg-secondary text-secondary-foreground border-border",
  confirmada: "bg-primary/15 text-primary border-primary/30",
  lista_espera: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-destructive/15 text-destructive border-destructive/30",
};

type Props = {
  jugadorId: string;
};

type PartidoProgramado = {
  id: string;
  faseNombre: string;
  fecha_hora: string;
  cancha: string | null;
  torneo_nombre: string;
};

type MiInscripcion = {
  id: string;
  torneo_id: string;
  torneo_nombre: string;
  estado: string;
  estado_pago: string;
  companero_nombre: string;
  partidos: PartidoProgramado[];
};

export function PlayerInscriptions({ jugadorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [inscripciones, setInscripciones] = useState<MiInscripcion[]>([]);

  useEffect(() => {
    if (!jugadorId) return;

    const cargar = async () => {
      setLoading(true);
      try {
        // 1. Obtener torneos activos/próximos
        const { data: torneosActivos } = await supabase
          .from("torneos")
          .select("id, nombre")
          .in("estado", ["proximamente", "inscripciones_abiertas", "inscripciones_cerradas", "en_curso"]);
        
        if (!torneosActivos || torneosActivos.length === 0) {
          setInscripciones([]);
          setLoading(false);
          return;
        }

        const tMap = new Map(torneosActivos.map(t => [t.id, t.nombre]));
        const tIds = Array.from(tMap.keys());

        // 2. Obtener mis inscripciones en esos torneos
        const { data: misInsc } = await supabase
          .from("inscripciones")
          .select("id, torneo_id, jugador1_id, jugador2_id, estado, estado_pago")
          .in("torneo_id", tIds)
          .or(`jugador1_id.eq.${jugadorId},jugador2_id.eq.${jugadorId}`);

        if (!misInsc || misInsc.length === 0) {
          setInscripciones([]);
          setLoading(false);
          return;
        }

        const compaIds = new Set<string>();
        misInsc.forEach(i => {
          compaIds.add(i.jugador1_id === jugadorId ? i.jugador2_id : i.jugador1_id);
        });

        // 3. Obtener nombres de compañeros
        const { data: jugs } = await supabase
          .from("jugadores")
          .select("id, nombre, apellido")
          .in("id", Array.from(compaIds));
          
        const jugMap = new Map((jugs ?? []).map(j => [j.id, `${j.nombre} ${j.apellido}`]));

        // 4. Buscar partidos programados para estas inscripciones (pendientes o programados)
        const inscIds = misInsc.map(i => i.id);
        
        const { data: pz1 } = await supabase.from("partidos_zona").select("id, zona_id, fecha_hora, cancha").in("pareja_local_id", inscIds).in("estado", ["pendiente", "programado"]).not("fecha_hora", "is", null);
        const { data: pz2 } = await supabase.from("partidos_zona").select("id, zona_id, fecha_hora, cancha").in("pareja_visitante_id", inscIds).in("estado", ["pendiente", "programado"]).not("fecha_hora", "is", null);
        
        const { data: pl1 } = await supabase.from("partidos_llave").select("id, llave_id, ronda, fecha_hora, cancha").in("pareja_local_id", inscIds).in("estado", ["pendiente", "programado"]).not("fecha_hora", "is", null);
        const { data: pl2 } = await supabase.from("partidos_llave").select("id, llave_id, ronda, fecha_hora, cancha").in("pareja_visitante_id", inscIds).in("estado", ["pendiente", "programado"]).not("fecha_hora", "is", null);

        // Obtener nombres de las zonas
        const zonasIds = [...new Set([...(pz1 ?? []), ...(pz2 ?? [])].map(p => p.zona_id))];
        const { data: zonas } = await supabase.from("zonas").select("id, nombre, torneo_id").in("id", zonasIds);
        const zMap = new Map((zonas ?? []).map(z => [z.id, { nombre: z.nombre, torneoId: z.torneo_id }]));

        // Obtener torneos de las llaves
        const llavesIds = [...new Set([...(pl1 ?? []), ...(pl2 ?? [])].map(p => p.llave_id))];
        const { data: llaves } = await supabase.from("llaves").select("id, torneo_id").in("id", llavesIds);
        const llMap = new Map((llaves ?? []).map(ll => [ll.id, ll.torneo_id]));

        const partidosProgramados: (PartidoProgramado & { insc_id: string })[] = [];

        [...(pz1 ?? [])].forEach(p => {
          const zInfo = zMap.get(p.zona_id);
          if (zInfo) partidosProgramados.push({ id: p.id, faseNombre: zInfo.nombre, fecha_hora: p.fecha_hora!, cancha: p.cancha, torneo_nombre: tMap.get(zInfo.torneoId) ?? "", insc_id: misInsc.find(i => i.id === p.pareja_local_id)?.id ?? "" });
        });
        [...(pz2 ?? [])].forEach(p => {
          const zInfo = zMap.get(p.zona_id);
          if (zInfo) partidosProgramados.push({ id: p.id, faseNombre: zInfo.nombre, fecha_hora: p.fecha_hora!, cancha: p.cancha, torneo_nombre: tMap.get(zInfo.torneoId) ?? "", insc_id: misInsc.find(i => i.id === p.pareja_visitante_id)?.id ?? "" });
        });
        [...(pl1 ?? [])].forEach(p => {
          const tId = llMap.get(p.llave_id);
          if (tId) partidosProgramados.push({ id: p.id, faseNombre: p.ronda, fecha_hora: p.fecha_hora!, cancha: p.cancha, torneo_nombre: tMap.get(tId) ?? "", insc_id: misInsc.find(i => i.id === p.pareja_local_id)?.id ?? "" });
        });
        [...(pl2 ?? [])].forEach(p => {
          const tId = llMap.get(p.llave_id);
          if (tId) partidosProgramados.push({ id: p.id, faseNombre: p.ronda, fecha_hora: p.fecha_hora!, cancha: p.cancha, torneo_nombre: tMap.get(tId) ?? "", insc_id: misInsc.find(i => i.id === p.pareja_visitante_id)?.id ?? "" });
        });

        // Agrupar
        const finalData = misInsc.map(i => ({
          id: i.id,
          torneo_id: i.torneo_id,
          torneo_nombre: tMap.get(i.torneo_id) ?? "?",
          estado: i.estado,
          estado_pago: i.estado_pago,
          companero_nombre: jugMap.get(i.jugador1_id === jugadorId ? i.jugador2_id : i.jugador1_id) ?? "?",
          partidos: partidosProgramados.filter(p => p.insc_id === i.id).sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
        }));

        setInscripciones(finalData);
      } catch (error) {
        console.error("Error al cargar inscripciones del jugador", error);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [jugadorId]);

  if (loading) {
    return <div className="animate-pulse h-32 bg-muted rounded-xl"></div>;
  }

  if (inscripciones.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <ClipboardList className="h-4 w-4" /> Mis Torneos Actuales
      </h2>
      
      <div className="grid gap-4">
        {inscripciones.map(i => (
          <Card key={i.id} className="overflow-hidden">
            <CardHeader className="p-4 bg-muted/30 border-b flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base font-bold">{i.torneo_nombre}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Con: <span className="font-semibold text-foreground">{i.companero_nombre}</span></p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0" asChild>
                <Link to={`/torneo/${i.torneo_id}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`text-xs ${ESTADO_INSC_BADGE[i.estado as keyof typeof ESTADO_INSC_BADGE]}`}>
                  {ESTADO_INSC_LABELS[i.estado as keyof typeof ESTADO_INSC_LABELS]}
                </Badge>
                <Badge className={`text-xs ${PAGO_BADGE[i.estado_pago as keyof typeof PAGO_BADGE]}`}>
                  {PAGO_LABELS[i.estado_pago as keyof typeof PAGO_LABELS]}
                </Badge>
              </div>

              {i.partidos.length > 0 && (
                <div className="pt-3 border-t">
                  <h3 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-3">
                    Próximos Partidos
                  </h3>
                  <div className="space-y-2">
                    {i.partidos.map(p => {
                      const d = new Date(p.fecha_hora);
                      const isHoy = d.toDateString() === new Date().toDateString();
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/20 border border-secondary/30">
                          <div className={`flex flex-col items-center justify-center p-2 rounded ${isHoy ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <CalendarClock className="h-4 w-4 mb-1" />
                            <span className="text-[10px] font-bold leading-none">
                              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold">{p.faseNombre}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground">
                                {isHoy ? "Hoy" : d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}
                              </span>
                              {p.cancha ? (
                                <>
                                  <span>•</span>
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{p.cancha.includes('Cancha') ? p.cancha : `Cancha ${p.cancha}`}</span>
                                </>
                              ) : (
                                <>
                                  <span>•</span>
                                  <Clock className="h-3 w-3" />
                                  <span>A confirmar</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
