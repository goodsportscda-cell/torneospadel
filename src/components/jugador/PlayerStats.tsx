import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Target, Trophy, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  jugadorId: string;
};

type PartidoJugado = {
  id: string;
  ganador_id: string | null;
  pareja_local_id: string | null;
  pareja_visitante_id: string | null;
  fecha_hora: string | null;
};

export function PlayerStats({ jugadorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    jugados: 0,
    ganados: 0,
    winRate: 0,
    forma: [] as ("V" | "D")[]
  });

  useEffect(() => {
    if (!jugadorId) return;

    const cargar = async () => {
      setLoading(true);
      try {
        // 1. Obtener todas las inscripciones de este jugador
        const { data: ins1 } = await supabase.from("inscripciones").select("id").eq("jugador1_id", jugadorId);
        const { data: ins2 } = await supabase.from("inscripciones").select("id").eq("jugador2_id", jugadorId);
        
        const inscripcionesIds = [
          ...(ins1?.map(i => i.id) || []),
          ...(ins2?.map(i => i.id) || [])
        ];

        if (inscripcionesIds.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Buscar partidos de zona
        const { data: pz1 } = await supabase.from("partidos_zona").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora").in("pareja_local_id", inscripcionesIds).eq("estado", "finalizado");
        const { data: pz2 } = await supabase.from("partidos_zona").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora").in("pareja_visitante_id", inscripcionesIds).eq("estado", "finalizado");

        // 3. Buscar partidos de llave
        const { data: pl1 } = await supabase.from("partidos_llave").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora").in("pareja_local_id", inscripcionesIds).eq("estado", "finalizado");
        const { data: pl2 } = await supabase.from("partidos_llave").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora").in("pareja_visitante_id", inscripcionesIds).eq("estado", "finalizado");

        // Unificar y deduplicar por las dudas
        const todosPartidos: PartidoJugado[] = [
          ...(pz1 || []), ...(pz2 || []), ...(pl1 || []), ...(pl2 || [])
        ];

        // Deduplicar por ID
        const uniquePartidosMap = new Map();
        todosPartidos.forEach(p => uniquePartidosMap.set(p.id, p));
        const partidos = Array.from(uniquePartidosMap.values()) as PartidoJugado[];

        // Ordenar por fecha para calcular la forma reciente (últimos 5)
        partidos.sort((a, b) => {
          if (!a.fecha_hora) return 1;
          if (!b.fecha_hora) return -1;
          return new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime(); // Más recientes primero
        });

        let ganados = 0;
        const forma: ("V" | "D")[] = [];

        partidos.forEach((p, idx) => {
          const gano = p.ganador_id && inscripcionesIds.includes(p.ganador_id);
          if (gano) ganados++;
          
          if (idx < 5) {
            forma.unshift(gano ? "V" : "D"); // unshift para que el más reciente quede a la derecha [D, V, V]
          }
        });

        const jugados = partidos.length;
        const winRate = jugados > 0 ? Math.round((ganados / jugados) * 100) : 0;

        setStats({
          jugados,
          ganados,
          winRate,
          forma
        });

      } catch (error) {
        console.error("Error al cargar estadisticas", error);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [jugadorId]);

  if (loading) {
    return <div className="animate-pulse h-32 bg-muted rounded-xl"></div>;
  }

  if (stats.jugados === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Mi Rendimiento Global
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col items-center justify-center p-3 bg-card rounded-lg border shadow-sm">
            <Trophy className="h-5 w-5 text-amber-500 mb-1" />
            <span className="text-2xl font-black">{stats.ganados}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Victorias</span>
          </div>
          
          <div className="flex flex-col items-center justify-center p-3 bg-card rounded-lg border shadow-sm">
            <Target className="h-5 w-5 text-blue-500 mb-1" />
            <span className="text-2xl font-black">{stats.jugados}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Partidos</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 bg-primary/10 rounded-lg border border-primary/30 shadow-sm col-span-2 md:col-span-1">
            <Flame className="h-5 w-5 text-destructive mb-1" />
            <span className="text-2xl font-black text-primary">{stats.winRate}%</span>
            <span className="text-[10px] text-primary/80 uppercase font-bold tracking-wider">Win Rate</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 bg-card rounded-lg border shadow-sm col-span-2 md:col-span-1">
            <span className="text-sm font-bold mb-2">Últimos 5</span>
            <div className="flex gap-1.5">
              {stats.forma.length > 0 ? (
                stats.forma.map((r, i) => (
                  <Badge 
                    key={i} 
                    variant={r === "V" ? "default" : "secondary"}
                    className={`w-6 h-6 p-0 flex items-center justify-center ${r === "V" ? "bg-green-600 hover:bg-green-600" : ""}`}
                  >
                    {r}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1.5">Forma</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
