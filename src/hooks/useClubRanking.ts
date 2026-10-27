import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isAscenso,
  construirContextoAscensosYTorneos,
  aplicarReglasMaster,
  getCupoDefaultCategoria,
  type MasterStatus,
  type EstadoMasterTipo,
  type CategoriaBasica,
} from "@/lib/ranking";

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
  jugador_categoria_nombre: string | null;
  jugador_categoria_genero: string | null;
  categoria_ranking_id?: string | null;
  puntos_totales: number;
  puntos_torneos: number;
  puntos_ascenso: number;
  torneos_jugados: number;
  torneos_en_categoria?: number;
  torneos_categoria_anterior?: number;
  es_ascendido?: boolean;
  master_status?: MasterStatus;
  elegible_master?: boolean;
  clasifica_master?: boolean;
  es_suplente_master?: boolean;
  posicion_master?: number | null;
  orden_suplente?: number | null;
  estado_master_tipo?: EstadoMasterTipo;
  desglose: DesglosePunto[];
};

export function useClubRanking(
  clubId: string | null | undefined,
  filtroCategoria: string,
  filtroGenero: string,
  filtroAnio: number,
  cupoOverride?: number | null
) {
  const [loading, setLoading] = useState(true);
  const [rankingRows, setRankingRows] = useState<RankingRowUnified[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = async () => {
    try {
      setLoading(true);
      setError(null);
      setRankingRows([]);
      if (!clubId) return;

      // 1. Obtener Categorías del club
      const { data: categories, error: categoriesError } = await supabase
        .from("categorias")
        .select("id, nombre, genero")
        .eq("club_id", clubId);
      if (categoriesError) throw categoriesError;
      const categoriasList = (categories || []) as CategoriaBasica[];
      const categoryIds = new Set(categoriasList.map((c) => c.id));
      const categoriasMap = new Map(categoriasList.map((c) => [c.id, c]));

      // 2. Obtener Torneos del club para mapear nombres y fechas
      const { data: torneosData, error: torneosError } = await supabase
        .from("torneos")
        .select("id, nombre, fecha_inicio, fecha_fin, estado, ranking_publicado, club_id")
        .eq("club_id", clubId);
      if (torneosError) throw torneosError;
      const clubTournamentIds = new Set((torneosData || []).map((t) => t.id));

      const torneosMap = new Map<
        string,
        {
          nombre: string;
          fecha_fin: string | null;
          fecha_inicio: string | null;
          estado: string;
          ranking_publicado: boolean | null;
          club_id: string | null;
        }
      >();

      (torneosData || []).forEach((t) => {
        torneosMap.set(t.id, {
          nombre: t.nombre,
          fecha_fin: t.fecha_fin,
          fecha_inicio: t.fecha_inicio,
          estado: t.estado,
          ranking_publicado: t.ranking_publicado,
          club_id: t.club_id,
        });
      });

      // 3. Obtener todas las filas de ranking_jugadores del club en el año
      // (Traemos todas las categorías del año para poder contar los torneos jugados en categoría origen si hubo ascenso)
      let allRankingData: any[] = [];
      let isFetchingRanking = true;
      let rankingOffset = 0;
      const step = 1000;
      let includeMasterStatusCol = true;

      while (isFetchingRanking) {
        const scopeFilters = [
          clubTournamentIds.size ? `torneo_id.in.(${Array.from(clubTournamentIds).join(",")})` : null,
          categoryIds.size ? `categoria_id.in.(${Array.from(categoryIds).join(",")})` : null,
        ].filter(Boolean);

        if (!scopeFilters.length) break;

        const cols = includeMasterStatusCol
          ? "jugador_id, puntos, torneo_id, categoria_id, genero, anio, instancia, master_status"
          : "jugador_id, puntos, torneo_id, categoria_id, genero, anio, instancia";

        const { data: chunk, error: rankingError } = await (supabase as any)
          .from("ranking_jugadores")
          .select(cols)
          .eq("anio", filtroAnio)
          .or(scopeFilters.join(","))
          .order("id")
          .range(rankingOffset, rankingOffset + step - 1);

        if (rankingError) {
          if (includeMasterStatusCol && String(rankingError.message || "").includes("master_status")) {
            includeMasterStatusCol = false;
            continue;
          }
          throw rankingError;
        }

        if (chunk && chunk.length > 0) {
          allRankingData = allRankingData.concat(
            chunk.filter((row: any) =>
              isAscenso(row.instancia)
                ? categoryIds.has(row.categoria_id)
                : Boolean(row.torneo_id && clubTournamentIds.has(row.torneo_id))
            )
          );
        }

        if (!chunk || chunk.length < step) {
          isFetchingRanking = false;
        } else {
          rankingOffset += step;
        }
      }

      // Filtrar torneos ocultos (no publicados y no finalizados)
      const validAllRankingRows = allRankingData.filter((r) => {
        if (isAscenso(r.instancia)) return true;
        const tInfo = r.torneo_id ? torneosMap.get(r.torneo_id) : undefined;
        if (tInfo && tInfo.ranking_publicado === false && tInfo.estado !== "finalizado") {
          return false;
        }
        return true;
      });

      // 4. Obtener Ascensos del año
      const { data: ascensosData, error: ascensosError } =
        categoryIds.size === 0
          ? { data: [], error: null }
          : await supabase
              .from("ascensos")
              .select(
                "jugador_id, categoria_origen_id, categoria_destino_id, created_at, fecha, notas, puntos_transferidos"
              )
              .eq("anio", filtroAnio)
              .in("categoria_origen_id", Array.from(categoryIds));

      if (ascensosError) throw ascensosError;

      const validAscensos = (ascensosData || []).filter(
        (a) => categoryIds.has(a.categoria_origen_id) && categoryIds.has(a.categoria_destino_id)
      );

      // Construir contexto de ascensos y conteo de torneos (categoría actual + categoría origen si ascendió)
      const { ascendidosDesde, obtenerMetricasMasterJugador } = construirContextoAscensosYTorneos({
        categorias: categoriasList,
        ascensos: validAscensos,
        rankingRows: validAllRankingRows,
      });

      // Filtrar las filas que aplican a la vista actual (filtroCategoria / filtroGenero)
      const filteredRankingRows = validAllRankingRows.filter((r) => {
        if (filtroCategoria !== "todas" && r.categoria_id !== filtroCategoria) return false;
        if (filtroGenero !== "todos" && r.genero !== filtroGenero) return false;
        return true;
      });

      // 5. Construcción de Desgloses y Puntos
      const map = new Map<
        string,
        {
          desglose: DesglosePunto[];
          ptsTorneos: number;
          ptsAscenso: number;
          torneosDirectos: number;
          primaryCatId: string | null;
          ptsPorCat: Map<string, number>;
        }
      >();

      filteredRankingRows.forEach((r) => {
        // EXCLUSIÓN: Si el jugador ascendió DESDE esta categoría, no sumamos sus puntos en ella
        const ascendedSet = r.categoria_id ? ascendidosDesde.get(r.categoria_id) : undefined;
        if (ascendedSet && ascendedSet.has(r.jugador_id)) {
          return;
        }

        const cur = map.get(r.jugador_id) ?? {
          desglose: [],
          ptsTorneos: 0,
          ptsAscenso: 0,
          torneosDirectos: 0,
          primaryCatId: r.categoria_id ?? null,
          ptsPorCat: new Map<string, number>(),
        };

        if (r.categoria_id) {
          cur.ptsPorCat.set(r.categoria_id, (cur.ptsPorCat.get(r.categoria_id) ?? 0) + r.puntos);
        }

        if (isAscenso(r.instancia)) {
          cur.ptsAscenso = Math.max(cur.ptsAscenso, r.puntos);
          const existingAsc = cur.desglose.find((d) => d.tipo === "ascenso");
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
          const tInfo = r.torneo_id ? torneosMap.get(r.torneo_id) : undefined;
          cur.ptsTorneos += r.puntos;
          cur.torneosDirectos += 1;
          cur.desglose.push({
            tipo: "torneo",
            nombre: tInfo?.nombre || "Torneo Oficial",
            puntos: r.puntos,
            fecha: tInfo?.fecha_fin || tInfo?.fecha_inicio || undefined,
          });
        }

        map.set(r.jugador_id, cur);
      });

      const ids = Array.from(map.keys());
      if (ids.length === 0) {
        setRankingRows([]);
        return;
      }

      // 6. Cargar nombres de jugadores en chunks
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
      }

      let jugadores: {
        id: string;
        nombre: string;
        apellido: string;
        club: string | null;
        categoria_id: string | null;
      }[] = [];
      const results = await Promise.all(
        chunks.map((chunk) =>
          supabase
            .from("jugadores_publicos" as any)
            .select("id, nombre, apellido, club, categoria_id")
            .in("id", chunk)
        )
      );

      for (const res of results) {
        if (res.data) jugadores = [...jugadores, ...res.data];
      }

      const categoryByPlayer = new Map<string, { id: string; nombre: string; genero: string }>();
      if (clubId) {
        const { data: playerCategories, error: playerCategoriesError } = await (supabase as any)
          .from("jugador_categorias_publicas")
          .select("jugador_id, categoria_id, categoria_nombre, genero")
          .eq("club_id", clubId)
          .in("jugador_id", ids);
        if (playerCategoriesError) throw playerCategoriesError;
        (playerCategories ?? []).forEach(
          (row: {
            jugador_id: string;
            categoria_id: string;
            categoria_nombre: string;
            genero: string;
          }) => {
            categoryByPlayer.set(row.jugador_id, {
              id: row.categoria_id,
              nombre: row.categoria_nombre,
              genero: row.genero,
            });
          }
        );
      }

      // 7. Mapear y Ordenar
      const baseResult: RankingRowUnified[] = ids.map((id) => {
        const j = (jugadores || []).find((x) => x.id === id);
        const m = map.get(id)!;

        // Determinar categoría efectiva de evaluación para este jugador
        let evalCatId: string | null =
          filtroCategoria !== "todas" ? filtroCategoria : m.primaryCatId;
        if (filtroCategoria === "todas" && m.ptsPorCat.size > 0) {
          let bestPts = -1;
          m.ptsPorCat.forEach((pts, cId) => {
            if (pts > bestPts) {
              bestPts = pts;
              evalCatId = cId;
            }
          });
        }

        const metricasMaster = obtenerMetricasMasterJugador(id, evalCatId);
        const desgloseSeguro = m.desglose || [];

        desgloseSeguro.sort((a, b) => {
          if (!a.fecha) return 1;
          if (!b.fecha) return -1;
          return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        const puntos_totales = m.ptsTorneos + m.ptsAscenso;

        return {
          posicion: 0,
          jugador_id: id,
          jugador_nombre: j?.nombre ?? "?",
          jugador_apellido: j?.apellido ?? "?",
          jugador_club: j?.club ?? null,
          jugador_categoria_id: categoryByPlayer.get(id)?.id ?? null,
          jugador_categoria_nombre: categoryByPlayer.get(id)?.nombre ?? null,
          jugador_categoria_genero: categoryByPlayer.get(id)?.genero ?? null,
          categoria_ranking_id: evalCatId,
          puntos_totales,
          puntos_torneos: m.ptsTorneos,
          puntos_ascenso: m.ptsAscenso,
          torneos_jugados: metricasMaster.torneos_jugados,
          torneos_en_categoria: metricasMaster.torneos_en_categoria,
          torneos_categoria_anterior: metricasMaster.torneos_categoria_anterior,
          es_ascendido: metricasMaster.es_ascendido,
          master_status: metricasMaster.master_status,
          desglose: desgloseSeguro,
        };
      });

      baseResult.sort((a, b) => b.puntos_totales - a.puntos_totales);

      // Asignar posiciones reales del Ranking General respetando empates
      let currentPos = 1;
      baseResult.forEach((r, idx) => {
        if (idx > 0 && baseResult[idx - 1].puntos_totales > r.puntos_totales) {
          currentPos = idx + 1;
        }
        r.posicion = currentPos;
      });

      // Aplicar reglas de clasificación al Master (corrimiento de cupo sin alterar orden de puntos)
      const catSel = filtroCategoria !== "todas" ? categoriasMap.get(filtroCategoria) : undefined;
      const cupoEfectivo =
        cupoOverride ?? getCupoDefaultCategoria(catSel?.nombre ?? null);

      const finalResult = aplicarReglasMaster(baseResult, cupoEfectivo);

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
  }, [clubId, filtroCategoria, filtroGenero, filtroAnio, cupoOverride]);

  return { rankingRows, loading, error, reload: fetchRanking };
}
