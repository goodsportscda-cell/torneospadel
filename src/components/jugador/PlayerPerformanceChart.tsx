import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, TrendingUp } from "lucide-react";

type Props = {
  jugadorId: string;
};

type ChartData = {
  nombreShort: string;
  nombreCompleto: string;
  fecha: string;
  puntos: number;
  acumulado: number;
};

export function PlayerPerformanceChart({ jugadorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const anio = new Date().getFullYear();

  useEffect(() => {
    if (!jugadorId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Obtener registros de ranking del jugador para el año actual
        const { data: rankData } = await supabase
          .from("ranking_jugadores")
          .select("torneo_id, puntos")
          .eq("jugador_id", jugadorId)
          .eq("anio", anio);

        if (!rankData || rankData.length === 0) {
          setChartData([]);
          setLoading(false);
          return;
        }

        // Agrupar puntos por torneo por si hay duplicados
        const puntosMap = new Map<string, number>();
        rankData.forEach((r) => {
          puntosMap.set(r.torneo_id, (puntosMap.get(r.torneo_id) ?? 0) + r.puntos);
        });

        const torneoIds = Array.from(puntosMap.keys());

        // 2. Obtener nombres y fechas de inicio de los torneos correspondientes
        const { data: torneosData } = await supabase
          .from("torneos")
          .select("id, nombre, fecha_inicio")
          .in("id", torneoIds);

        if (!torneosData || torneosData.length === 0) {
          setChartData([]);
          setLoading(false);
          return;
        }

        // 3. Mapear y ordenar cronológicamente
        const formatted = torneosData
          .map((t) => {
            const pts = puntosMap.get(t.id) ?? 0;
            return {
              id: t.id,
              nombreCompleto: t.nombre,
              // Nombre abreviado para el eje X (ej: "Torneo 1" -> "T1")
              nombreShort: t.nombre.length > 15 ? `${t.nombre.substring(0, 12)}...` : t.nombre,
              fecha: t.fecha_inicio,
              puntos: pts,
            };
          })
          // Ordenar por fecha de inicio ascendente (más viejos a más nuevos)
          .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

        // 4. Calcular los puntos acumulados secuencialmente
        let runningTotal = 0;
        const finalData: ChartData[] = formatted.map((item) => {
          runningTotal += item.puntos;
          return {
            nombreShort: item.nombreShort,
            nombreCompleto: item.nombreCompleto,
            fecha: new Date(item.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
            puntos: item.puntos,
            acumulado: runningTotal,
          };
        });

        setChartData(finalData);
      } catch (error) {
        console.error("Error al cargar gráfico de rendimiento:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [jugadorId, anio]);

  if (loading) {
    return (
      <Card className="h-[350px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="border border-primary/15 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Mi Evolución de Puntos ({anio})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
              <XAxis 
                dataKey="nombreShort" 
                tick={{ fontSize: 10 }} 
                stroke="currentColor" 
                opacity={0.35}
                dy={6}
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                stroke="currentColor" 
                opacity={0.35}
                dx={-4}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ChartData;
                    return (
                      <div className="bg-popover border text-popover-foreground p-3 rounded-lg shadow-md text-xs space-y-1.5">
                        <p className="font-bold border-b pb-1 text-foreground max-w-[180px] truncate">{data.nombreCompleto}</p>
                        <p className="text-muted-foreground">{data.fecha}</p>
                        <div className="flex justify-between gap-6 pt-1 font-medium">
                          <span>Ganados:</span>
                          <span className="text-primary font-bold">+{data.puntos} pts</span>
                        </div>
                        <div className="flex justify-between gap-6 font-medium border-t pt-1">
                          <span>Total Acumulado:</span>
                          <span className="text-green-500 font-bold">{data.acumulado} pts</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                name="Puntos Acumulados"
                dataKey="acumulado"
                stroke="var(--primary)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAcumulado)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
