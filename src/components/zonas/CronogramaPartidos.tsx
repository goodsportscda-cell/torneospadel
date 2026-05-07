import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, MapPin, Trophy } from "lucide-react";

type Props = {
  torneoId: string;
  inscripciones: { id: string; jugador1_id: string; jugador2_id: string }[];
  jugadorMap: Map<string, { apellido: string; nombre: string }>;
};

type PartidoZona = {
  id: string;
  zona_id: string;
  orden: number;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  estado: string;
  ganador_id: string | null;
  fecha_hora: string | null;
  cancha: string | null;
};

type ZonaInfo = { id: string; nombre: string };

export function CronogramaPartidos({ torneoId, inscripciones, jugadorMap }: Props) {
  const [partidos, setPartidos] = useState<PartidoZona[]>([]);
  const [zonas, setZonas] = useState<ZonaInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const { data: zs } = await supabase
        .from("zonas")
        .select("id, nombre")
        .eq("torneo_id", torneoId);

      setZonas((zs ?? []) as ZonaInfo[]);

      if (zs && zs.length > 0) {
        const ids = zs.map((z) => z.id);
        const { data: parts } = await supabase
          .from("partidos_zona")
          .select("id, zona_id, orden, pareja_local_id, pareja_visitante_id, estado, ganador_id, fecha_hora, cancha")
          .in("zona_id", ids)
          .order("fecha_hora", { ascending: true, nullsFirst: false });
        setPartidos((parts ?? []) as PartidoZona[]);
      } else {
        setPartidos([]);
      }
      setLoading(false);
    };
    cargar();
  }, [torneoId]);

  const zonaMap = useMemo(() => new Map(zonas.map((z) => [z.id, z.nombre])), [zonas]);

  const parejaLabel = (inscripcionId: string | null): string => {
    if (!inscripcionId) return "— por definir —";
    const ins = inscripciones.find((i) => i.id === inscripcionId);
    if (!ins) return "—";
    const j1 = jugadorMap.get(ins.jugador1_id);
    const j2 = jugadorMap.get(ins.jugador2_id);
    return `${j1?.apellido ?? "?"} / ${j2?.apellido ?? "?"}`;
  };

  // Only show matches with fecha_hora
  const programados = useMemo(
    () => partidos.filter((p) => p.fecha_hora),
    [partidos],
  );

  // Group by day
  const porDia = useMemo(() => {
    const map = new Map<string, PartidoZona[]>();
    programados.forEach((p) => {
      const day = new Date(p.fecha_hora!).toLocaleDateString("es-AR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(p);
    });
    return map;
  }, [programados]);

  const sinProgramar = useMemo(
    () => partidos.filter((p) => !p.fecha_hora),
    [partidos],
  );

  const estadoBadge = (e: string) => {
    switch (e) {
      case "finalizado": return { variant: "default" as const, label: "Finalizado" };
      case "en_juego": return { variant: "destructive" as const, label: "En juego" };
      case "programado": return { variant: "secondary" as const, label: "Programado" };
      default: return { variant: "outline" as const, label: "Pendiente" };
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando cronograma...</p>;

  if (partidos.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No hay partidos de zona para este torneo.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {programados.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Ningún partido tiene fecha/hora asignada todavía.
          </CardContent>
        </Card>
      )}

      {Array.from(porDia.entries()).map(([dia, partsDia]) => {
        // Sort by hora first, then cancha
        const sorted = [...partsDia].sort((a, b) => {
          const diff = new Date(a.fecha_hora!).getTime() - new Date(b.fecha_hora!).getTime();
          if (diff !== 0) return diff;
          return (a.cancha ?? "").localeCompare(b.cancha ?? "");
        });

        return (
          <div key={dia} className="space-y-3">
            <h3 className="text-sm font-semibold capitalize border-b pb-1">{dia}</h3>
            <div className="space-y-1.5">
              {sorted.map((p) => {
                const hora = new Date(p.fecha_hora!).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const eb = estadoBadge(p.estado);
                return (
                  <Card key={p.id} className="border">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="text-sm font-mono font-semibold w-12 shrink-0 text-center">
                        {hora}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className={`text-sm truncate ${p.ganador_id === p.pareja_local_id && p.ganador_id ? "font-semibold text-primary" : ""}`}>
                          {p.ganador_id === p.pareja_local_id && p.ganador_id && <Trophy className="h-3 w-3 inline mr-1" />}
                          {parejaLabel(p.pareja_local_id)}
                        </div>
                        <div className={`text-sm truncate ${p.ganador_id === p.pareja_visitante_id && p.ganador_id ? "font-semibold text-primary" : ""}`}>
                          {p.ganador_id === p.pareja_visitante_id && p.ganador_id && <Trophy className="h-3 w-3 inline mr-1" />}
                          {parejaLabel(p.pareja_visitante_id)}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {p.cancha && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {p.cancha}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          Zona {zonaMap.get(p.zona_id) ?? "?"}
                        </Badge>
                        {p.estado !== "pendiente" && (
                          <Badge variant={eb.variant} className="text-[10px]">
                            {eb.label}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {sinProgramar.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">
            <CalendarClock className="h-4 w-4 inline mr-1" />
            Sin programar ({sinProgramar.length})
          </h3>
          <div className="space-y-1.5 pl-2">
            {sinProgramar.map((p) => (
              <Card key={p.id} className="border border-dashed">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="text-xs text-muted-foreground w-12 shrink-0 text-center">--:--</div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-sm truncate">{parejaLabel(p.pareja_local_id)}</div>
                    <div className="text-sm truncate">{parejaLabel(p.pareja_visitante_id)}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Zona {zonaMap.get(p.zona_id) ?? "?"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
