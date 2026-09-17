import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAscenso } from "@/lib/ranking";

export type DesglosePunto = {
  tipo: "torneo" | "ascenso";
  nombre: string;
  puntos: number;
  nota?: string;
  fecha?: string;
};

export type RankingRowUnified = {
  posicion: number;
  jugador_id: string;
  jugador_nombre: string;
  jugador_apellido: string;
  jugador_club: string | null;
  jugador_categoria_id: string | null;
  puntos_totales: number;
  puntos_torneos: number;
  puntos_ascenso: number;
  torneos_jugados: number;
  desglose: DesglosePunto[];
};

export function useClubRanking(
  clubId: string | null | undefined,
  filtroCategoria: string,
  filtroGenero: string,
  filtroAnio: number
) {
  const [loading, setLoading] = useState(true);
  const [rankingRows, setRankingRows] = useState<RankingRowUnified[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Obtener Torneos Publicados
      let torneosQuery = supabase
        .from("torneos")
        .select("id, nombre, fecha_fin, estado")
        .eq("ranking_publicado", true);

      if (clubId) {
        torneosQuery = torneosQuery.eq("club_id", clubId);
      }

      const { data: torneosData, error: torneosError } = await torneosQuery;
      
      if (torneosError) throw new Error("Error obteniendo torneos");
      
      // Si el club no tiene torneos (y estamos filtrando por club), terminamos temprano
      if (clubId && (!torneosData || torneosData.length === 0)) {
        setRankingRows([]);
        return;
      }

      const torneosMap = new Map<string, { nombre: string; fecha_fin: string | null; estado: string }>();
      (torneosData || []).forEach(t => {
        torneosMap.set(t.id, { nombre: t.nombre, fecha_fin: t.fecha_fin, estado: t.estado });
      });

      const torneosIds = Array.from(torneosMap.keys());

      // 2. Obtener Ranking Jugadores (Puntos de Torneos y Ascensos)
      let rankingData: any[] = [];
      let isFetchingRanking = true;
      let rankingOffset = 0;
      const step = 1000;

      while (isFetchingRanking) {
        let rankingQuery = supabase
          .from("ranking_jugadores")
          .select("jugador_id, puntos, torneo_id, categoria_id, genero, anio, instancia")
          .eq("anio", filtroAnio)
          .order("id")
          .range(rankingOffset, rankingOffset + step - 1);

        if (torneosIds.length > 0) {
          // No filtramos estrictamente por torneosIds para permitir 'ascenso' (torneo_id nulo o ausente)
          // Usamos un OR: torneo_id IN (torneosIds) OR instancia = 'ascenso'
          const torneosInStr = `(${torneosIds.map(id => `"${id}"`).join(",")})`;
          rankingQuery = rankingQuery.or(`torneo_id.in.${torneosInStr},instancia.eq.ascenso`);
        } else {
          // Si no hay torneos, solo traemos los ascensos
          rankingQuery = rankingQuery.eq("instancia", "ascenso");
        }

        if (filtroCategoria !== "todas") {
          rankingQuery = rankingQuery.eq("categoria_id", filtroCategoria);
        }
        if (filtroGenero !== "todos") {
          rankingQuery = rankingQuery.eq("genero", filtroGenero);
        }

        const { data: chunk, error: rankingError } = await rankingQuery;
        if (rankingError) throw new Error("Error obteniendo puntos de torneos");

        if (chunk && chunk.length > 0) {
          rankingData = rankingData.concat(chunk);
        }
        
        if (!chunk || chunk.length < step) {
          isFetchingRanking = false;
        } else {
          rankingOffset += step;
        }
      }

      // 3. Obtener Ascensos (solo para exclusión visual de categorías anteriores)
      let ascensosQuery = supabase
        .from("ascensos")
        .select("jugador_id, categoria_origen_id, categoria_destino_id, created_at, fecha")
        .eq("anio", filtroAnio);
        
      const { data: ascensosData, error: ascensosError } = await ascensosQuery;
      if (ascensosError) throw new Error("Error obteniendo ascensos");

      // Deduplicar ascensos para poder saber qué puntos ignorar de categorías viejas
      const ascensosDeduplicados = new Map<string, any>();
      (ascensosData || []).forEach((a) => {
        const key = `${a.jugador_id}_${a.categoria_origen_id}_${a.categoria_destino_id}`;
        const existing = ascensosDeduplicados.get(key);
        if (!existing || new Date(a.created_at || a.fecha).getTime() > new Date(existing.created_at || existing.fecha).getTime()) {
          ascensosDeduplicados.set(key, a);
        }
      });

      const ascendidosDesde = new Map<string, Set<string>>();
      ascensosDeduplicados.forEach((a) => {
        if (!ascendidosDesde.has(a.categoria_origen_id)) {
          ascendidosDesde.set(a.categoria_origen_id, new Set());
        }
        ascendidosDesde.get(a.categoria_origen_id)!.add(a.jugador_id);
      });

      // 4. Construcción de Desgloses y Puntos
      const map = new Map<string, { desglose: DesglosePunto[] }>();

      (rankingData || []).forEach((r) => {
        // EXCLUSIÓN: Si el jugador ascendió DESDE esta categoría, no sumamos sus torneos en ella
        const ascendedSet = ascendidosDesde.get(r.categoria_id);
        if (ascendedSet && ascendedSet.has(r.jugador_id)) {
          return;
        }

        const cur = map.get(r.jugador_id) ?? { desglose: [] };
        
        if (isAscenso(r.instancia)) {
          const existingAsc = cur.desglose.find(d => d.tipo === "ascenso");
          if (existingAsc) {
            existingAsc.puntos = Math.max(existingAsc.puntos, r.puntos);
          } else {
            cur.desglose.push({
              tipo: "ascenso",
              nombre: "Puntos por Ascenso",
              puntos: r.puntos,
              nota: "Transferencia de categoría anterior (50%)",
            });
          }
        } else {
          const tInfo = torneosMap.get(r.torneo_id);
          if (tInfo) {
            cur.desglose.push({
              tipo: "torneo",
              nombre: tInfo.nombre,
              puntos: r.puntos,
              fecha: tInfo.fecha_fin || undefined
            });
          }
        }
        
        map.set(r.jugador_id, cur);
      });

      const ids = Array.from(map.keys());
      if (ids.length === 0) {
        setRankingRows([]);
        return;
      }

      // 6. Cargar nombres de jugadores
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
      }
      
      let jugadores: { id: string; nombre: string; apellido: string; club: string | null; categoria_id: string | null }[] = [];
      const results = await Promise.all(
        chunks.map(chunk => 
          supabase
            .from("jugadores")
            .select("id, nombre, apellido, club, categoria_id")
            .in("id", chunk)
        )
      );
      
      for (const res of results) {
        if (res.data) jugadores = [...jugadores, ...res.data];
      }

      // 7. Mapear y Ordenar
      const finalResult: RankingRowUnified[] = (ids || []).map((id) => {
        const j = (jugadores || []).find((x) => x.id === id);
        const m = map.get(id)!;
        
        const desgloseSeguro = m.desglose || [];

        // Sort desglose by date descending (rough approximation if fecha is present)
        desgloseSeguro.sort((a, b) => {
          if (!a.fecha) return 1;
          if (!b.fecha) return -1;
          return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        const puntos_totales = desgloseSeguro.reduce((sum, item) => sum + item.puntos, 0);
        const torneos_jugados = desgloseSeguro.filter(item => item.tipo === 'torneo').length;
        const puntos_ascenso = desgloseSeguro.filter(d => d.tipo === "ascenso").reduce((acc, curr) => acc + curr.puntos, 0);
        const puntos_torneos = desgloseSeguro.filter(d => d.tipo === "torneo").reduce((acc, curr) => acc + curr.puntos, 0);

        return {
          posicion: 0, // se calcula después de ordenar
          jugador_id: id,
          jugador_nombre: j?.nombre ?? "?",
          jugador_apellido: j?.apellido ?? "?",
          jugador_club: j?.club ?? null,
          jugador_categoria_id: j?.categoria_id ?? null,
          puntos_totales,
          puntos_torneos,
          puntos_ascenso,
          torneos_jugados,
          desglose: desgloseSeguro,
        };
      });

      finalResult.sort((a, b) => b.puntos_totales - a.puntos_totales);
      
      // Asignar posiciones
      let currentPos = 1;
      finalResult.forEach((r, idx) => {
        if (idx > 0 && finalResult[idx - 1].puntos_totales < r.puntos_totales) {
          currentPos = idx + 1;
        } else if (idx > 0 && finalResult[idx - 1].puntos_totales > r.puntos_totales) {
          currentPos = idx + 1;
        }
        r.posicion = currentPos;
      });

      setRankingRows(finalResult);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error desconocido");
      setRankingRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, filtroCategoria, filtroGenero, filtroAnio]);

  return { rankingRows, loading, error, reload: fetchRanking };
}
