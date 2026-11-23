import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isAscenso,
  construirContextoAscensosYTorneos,
  aplicarReglasMaster,
  getCupoDefaultCategoria,
  normalizarFilasRankingConSincronizacion,
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
  torneos_categoria_superior?: number;
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

export type TorneoFiltroOption = {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
  genero: string | null;
};

export function useClubRanking(
  clubId: string | null | undefined,
  filtroCategoria: string,
  filtroGenero: string,
  filtroAnio: number,
  cupoOverride?: number | null,
  filtroTorneo: string = "todos"
) {
  const [loading, setLoading] = useState(true);
  const [rankingRows, setRankingRows] = useState<RankingRowUnified[]>([]);
  const [torneosDisponibles, setTorneosDisponibles] = useState<TorneoFiltroOption[]>([]);
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
        .select("id, nombre, fecha_inicio, fecha_fin, estado, ranking_publicado, club_id, categoria_id, genero, tipo, notas")
        .eq("club_id", clubId);
      if (torneosError) throw torneosError;
      const clubTournamentIds = new Set((torneosData || []).map((t) => t.id));
      const torneosNotasMap = new Map<string, string | null>();

      const torneosMap = new Map<
        string,
        {
          nombre: string;
          fecha_fin: string | null;
          fecha_inicio: string | null;
          estado: string;
          ranking_publicado: boolean | null;
          club_id: string | null;
          categoria_id: string | null;
          genero: string | null;
          tipo: string | null;
        }
      >();

      (torneosData || []).forEach((t: any) => {
        torneosNotasMap.set(t.id, t.notas ?? null);
        torneosMap.set(t.id, {
          nombre: t.nombre,
          fecha_fin: t.fecha_fin,
          fecha_inicio: t.fecha_inicio,
          estado: t.estado,
          ranking_publicado: t.ranking_publicado,
          club_id: t.club_id,
          categoria_id: t.categoria_id ?? null,
          genero: t.genero ?? null,
          tipo: t.tipo ?? null,
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

      allRankingData = normalizarFilasRankingConSincronizacion(
        allRankingData,
        torneosNotasMap
      );

      // Filtrar torneos cuyo ranking aún no fue publicado por el Admin
      const validAllRankingRows = allRankingData.filter((r) => {
        if (isAscenso(r.instancia)) return true;
        const tInfo = r.torneo_id ? torneosMap.get(r.torneo_id) : undefined;
        if (tInfo && tInfo.ranking_publicado === false) {
          return false;
        }
        return true;
      });

      // 4. Obtener Ascensos del año y Categorías personales de los jugadores en el club
      const [{ data: ascensosData, error: ascensosError }, { data: allPlayerCatsData }] =
        await Promise.all([
          categoryIds.size === 0
            ? Promise.resolve({ data: [], error: null })
            : supabase
              .from("ascensos")
              .select(
                "jugador_id, categoria_origen_id, categoria_destino_id, created_at, fecha, notas, puntos_transferidos"
              )
              .eq("anio", filtroAnio)
              .in("categoria_origen_id", Array.from(categoryIds)),
          (supabase as any)
            .from("jugador_categorias_publicas")
            .select("jugador_id, categoria_id, categoria_nombre, genero")
            .eq("club_id", clubId),
        ]);

      if (ascensosError) throw ascensosError;

      const validAscensos = (ascensosData || []).filter(
        (a) => categoryIds.has(a.categoria_origen_id) && categoryIds.has(a.categoria_destino_id)
      );

      // Construir contexto de ascensos y conteo de torneos
      const {
        ascendidosDesde,
        coincideFilaConCategoria,
        obtenerCategoriaAgrupacionFila,
        obtenerMetricasMasterJugador,
      } = construirContextoAscensosYTorneos({
        categorias: categoriasList,
        ascensos: validAscensos,
        rankingRows: validAllRankingRows,
        jugadorCategorias: (allPlayerCatsData ?? []) as any[],
      });

      // Construir lista de torneos con puntos publicados en este año para el selector "Torneo"
      const torneosConPuntosIds = new Set<string>();
      validAllRankingRows.forEach((r) => {
        if (!isAscenso(r.instancia) && r.torneo_id) {
          torneosConPuntosIds.add(r.torneo_id);
        }
      });
      const torneosOpts: TorneoFiltroOption[] = Array.from(torneosConPuntosIds)
        .map((tId) => {
          const t = torneosMap.get(tId);
          const cat = t?.categoria_id ? categoriasMap.get(t.categoria_id) : undefined;
          return {
            id: tId,
            nombre: t?.nombre ?? "Torneo Oficial",
            fecha_inicio: t?.fecha_inicio ?? null,
            categoria_id: t?.categoria_id ?? null,
            categoria_nombre: cat?.nombre ?? null,
            genero: t?.genero ?? cat?.genero ?? null,
          };
        })
        .sort((a, b) => (b.fecha_inicio || "").localeCompare(a.fecha_inicio || ""));
      setTorneosDisponibles(torneosOpts);

      // Si hay un filtroTorneo activo (ej. "modalidad:suma 7", "modalidad:suma 8", "modalidad:suma 6", "cat_torneo:<id>" o "torneo:<id>"),
      // restringir estrictamente TANTO los jugadores COMO las filas de puntos a la categoría de ese torneo/modalidad
      let jugadoresEnTorneoFiltro: Set<string> | null = null;
      let torneoEspecificoId: string | null = null;
      let categoriasTorneoFiltro: Set<string> | null = null;

      if (filtroTorneo && filtroTorneo !== "todos") {
        jugadoresEnTorneoFiltro = new Set<string>();
        categoriasTorneoFiltro = new Set<string>();
        if (filtroTorneo.startsWith("torneo:")) {
          torneoEspecificoId = filtroTorneo.slice("torneo:".length);
          const tInfo = torneosMap.get(torneoEspecificoId);
          if (tInfo?.categoria_id) {
            categoriasTorneoFiltro.add(tInfo.categoria_id);
          }
          validAllRankingRows.forEach((r) => {
            if (!isAscenso(r.instancia) && r.torneo_id === torneoEspecificoId) {
              jugadoresEnTorneoFiltro!.add(r.jugador_id);
              if (r.categoria_id) categoriasTorneoFiltro!.add(r.categoria_id);
            }
          });
        } else if (filtroTorneo.startsWith("cat_torneo:")) {
          const targetCatTorneoId = filtroTorneo.slice("cat_torneo:".length);
          categoriasTorneoFiltro.add(targetCatTorneoId);
          validAllRankingRows.forEach((r) => {
            if (!isAscenso(r.instancia) && r.categoria_id === targetCatTorneoId) {
              jugadoresEnTorneoFiltro!.add(r.jugador_id);
            }
          });
        } else if (filtroTorneo.startsWith("modalidad:")) {
          const modKey = filtroTorneo.slice("modalidad:".length).toLowerCase().trim();
          categoriasList
            .filter((c) => c.nombre.toLowerCase().includes(modKey))
            .forEach((c) => categoriasTorneoFiltro!.add(c.id));
          validAllRankingRows.forEach((r) => {
            if (
              !isAscenso(r.instancia) &&
              r.categoria_id &&
              categoriasTorneoFiltro!.has(r.categoria_id)
            ) {
              jugadoresEnTorneoFiltro!.add(r.jugador_id);
            }
          });
        }
      }

      const singleTorneoCatId =
        categoriasTorneoFiltro && categoriasTorneoFiltro.size === 1
          ? Array.from(categoriasTorneoFiltro)[0]
          : null;
      const tieneFiltroTorneoActivo =
        Boolean(categoriasTorneoFiltro && categoriasTorneoFiltro.size > 0) ||
        Boolean(torneoEspecificoId);
      const effectiveFiltroCategoria = tieneFiltroTorneoActivo
        ? singleTorneoCatId ?? "todas"
        : filtroCategoria !== "todas"
          ? filtroCategoria
          : "todas";

      // Filtrar las filas que aplican a la vista actual:
      // Si hay un torneo o modalidad Suma seleccionada en filtroTorneo, es independiente de filtroCategoria (no se cruza con Categoría del jugador)
      const filteredRankingRows = validAllRankingRows.filter((r) => {
        if (tieneFiltroTorneoActivo) {
          if (
            categoriasTorneoFiltro &&
            categoriasTorneoFiltro.size > 0 &&
            !Array.from(categoriasTorneoFiltro).some((cId) => coincideFilaConCategoria(r, cId))
          ) {
            return false;
          }
        } else if (filtroCategoria !== "todas") {
          if (!coincideFilaConCategoria(r, filtroCategoria)) {
            return false;
          }
        } else if (!coincideFilaConCategoria(r, "todas")) {
          return false;
        }
        if (filtroGenero !== "todos" && r.genero !== filtroGenero) return false;
        if (jugadoresEnTorneoFiltro && !jugadoresEnTorneoFiltro.has(r.jugador_id)) return false;
        if (torneoEspecificoId && !isAscenso(r.instancia) && r.torneo_id !== torneoEspecificoId) {
          return false;
        }
        return true;
      });

      // 5. Construcción de Desgloses y Puntos usando la categoría efectiva del filtro
      const map = new Map<
        string,
        {
          primaryCatId: string | null;
          porCat: Map<
            string,
            {
              ptsTorneos: number;
              ptsAscenso: number;
              desglose: DesglosePunto[];
            }
          >;
        }
      >();

      filteredRankingRows.forEach((r) => {
        // EXCLUSIÓN: Si el jugador ascendió DESDE esta categoría, no sumamos sus puntos en ella
        const ascendedSet = r.categoria_id ? ascendidosDesde.get(r.categoria_id) : undefined;
        if (ascendedSet && ascendedSet.has(r.jugador_id)) {
          return;
        }

        const catKey = obtenerCategoriaAgrupacionFila(r, effectiveFiltroCategoria);
        const cur = map.get(r.jugador_id) ?? {
          primaryCatId: catKey === "sin_categoria" ? null : catKey,
          porCat: new Map(),
        };

        const catEntry = cur.porCat.get(catKey) ?? {
          ptsTorneos: 0,
          ptsAscenso: 0,
          desglose: [],
        };

        if (isAscenso(r.instancia)) {
          catEntry.ptsAscenso = Math.max(catEntry.ptsAscenso, r.puntos);
          const existingAsc = catEntry.desglose.find((d) => d.tipo === "ascenso");
          if (existingAsc) {
            existingAsc.puntos = Math.max(existingAsc.puntos, r.puntos);
          } else {
            catEntry.desglose.push({
              tipo: "ascenso",
              nombre: "Puntos por Ascenso",
              puntos: r.puntos,
              nota: "Transferencia de categoría anterior (50%)",
            });
          }
        } else {
          const tInfo = r.torneo_id ? torneosMap.get(r.torneo_id) : undefined;
          catEntry.ptsTorneos += r.puntos;
          catEntry.desglose.push({
            tipo: "torneo",
            nombre: tInfo?.nombre || "Torneo Oficial",
            puntos: r.puntos,
            fecha: tInfo?.fecha_fin || tInfo?.fecha_inicio || undefined,
          });
        }

        cur.porCat.set(catKey, catEntry);
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
          effectiveFiltroCategoria !== "todas" ? effectiveFiltroCategoria : m.primaryCatId;
        if (effectiveFiltroCategoria === "todas" && m.porCat.size > 0) {
          const assignedCatId = categoryByPlayer.get(id)?.id ?? null;
          if (assignedCatId && m.porCat.has(assignedCatId)) {
            evalCatId = assignedCatId;
          } else {
            let bestPts = -1;
            m.porCat.forEach((entry, cId) => {
              const totalCat = entry.ptsTorneos + entry.ptsAscenso;
              if (totalCat > bestPts) {
                bestPts = totalCat;
                evalCatId = cId === "sin_categoria" ? null : cId;
              }
            });
          }
        }

        const catStats = m.porCat.get(evalCatId ?? "sin_categoria") ??
          Array.from(m.porCat.values())[0] ?? {
          ptsTorneos: 0,
          ptsAscenso: 0,
          desglose: [],
        };

        const metricasMaster = obtenerMetricasMasterJugador(id, evalCatId);
        const desgloseSeguro = [...(catStats.desglose || [])];

        desgloseSeguro.sort((a, b) => {
          if (!a.fecha) return 1;
          if (!b.fecha) return -1;
          return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });

        const puntos_totales = catStats.ptsTorneos + catStats.ptsAscenso;
        const evalCatInfo = evalCatId ? categoriasMap.get(evalCatId) : undefined;
        const assignedCatInfo = categoryByPlayer.get(id);

        return {
          posicion: 0,
          jugador_id: id,
          jugador_nombre: j?.nombre ?? "?",
          jugador_apellido: j?.apellido ?? "?",
          jugador_club: j?.club ?? null,
          jugador_categoria_id: evalCatInfo?.id ?? assignedCatInfo?.id ?? null,
          jugador_categoria_nombre: evalCatInfo?.nombre ?? assignedCatInfo?.nombre ?? null,
          jugador_categoria_genero: evalCatInfo?.genero ?? assignedCatInfo?.genero ?? null,
          categoria_ranking_id: evalCatId,
          puntos_totales,
          puntos_torneos: catStats.ptsTorneos,
          puntos_ascenso: catStats.ptsAscenso,
          torneos_jugados: metricasMaster.torneos_jugados,
          torneos_en_categoria: metricasMaster.torneos_en_categoria,
          torneos_categoria_anterior: metricasMaster.torneos_categoria_anterior,
          torneos_categoria_superior: metricasMaster.torneos_categoria_superior,
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

      // Aplicar reglas de clasificación al Master (corrimiento de cupo sin alterar orden de puntos: 8 en Suma, 16 en Puras)
      const catSel =
        effectiveFiltroCategoria !== "todas"
          ? categoriasMap.get(effectiveFiltroCategoria)
          : undefined;
      const esFiltroSuma =
        isCategoriaSuma(catSel?.nombre) ||
        (filtroTorneo.startsWith("modalidad:") && filtroTorneo.toLowerCase().includes("suma"));
      const cupoDefault = esFiltroSuma
        ? 8
        : getCupoDefaultCategoria(catSel?.nombre ?? null);
      const cupoEfectivo = cupoOverride ?? cupoDefault;

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
  }, [clubId, filtroCategoria, filtroGenero, filtroAnio, cupoOverride, filtroTorneo]);

  return { rankingRows, torneosDisponibles, loading, error, reload: fetchRanking };
}
