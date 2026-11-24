import { supabase } from "@/integrations/supabase/client";
import {
  aplicarReglasMaster,
  construirContextoAscensosYTorneos,
  fetchAllRankingRowsYear,
  getNivelCategoriaPura,
  isAscenso,
} from "@/lib/ranking";
import {
  computeMasterQualifiersOrder,
  determinarGanadorBestOf3,
  formarParejasPuras,
  getNextMasterMatchTarget,
  MASTER_2026_CATEGORIES,
  MASTER_BRACKET_TEMPLATE,
  matchMasterCategorySpec,
  ordenarSeedsParejas,
  type BestOf3Score,
  type MasterCategorySpec,
  type MasterMatchEstado,
  type MasterQualifierComputed,
  type MasterQualifierEstado,
  type MasterRonda,
} from "@/lib/master2026";

export type MasterEditionRow = {
  id: string;
  club_id: string;
  anio: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: "borrador" | "activo" | "finalizado";
};

export type MasterCategoryMapping = {
  spec: MasterCategorySpec;
  categoria_id: string;
  categoria_nombre: string;
  genero: string;
};

export type JugadorBasic = {
  id: string;
  nombre: string;
  apellido: string;
  club: string | null;
  categoria_id: string | null;
  categoria_nivel: number | null;
  categoria_nombre: string | null;
};

export type MasterQualifierDB = {
  id: string;
  edition_id: string;
  categoria_id: string;
  jugador_id: string;
  ranking_posicion_original: number;
  puntos_anuales: number;
  torneos_jugados: number;
  torneos_categoria_anterior: number;
  ascenso_validado: boolean;
  estado: MasterQualifierEstado;
  orden_manual: number | null;
  posicion_final: number | null;
  es_suplente: boolean;
  jugador?: JugadorBasic | null;
};

export type MasterQualifierView = MasterQualifierComputed<MasterQualifierDB>;

export type MasterTeamDB = {
  id: string;
  edition_id: string;
  categoria_id: string;
  seed: number;
  cruce_label: string;
  jugador1_id: string;
  jugador2_id: string | null;
  jugador2_nombre_manual: string | null;
  jugador2_categoria_nivel: number | null;
  puntos_combinados: number;
  mejor_ranking_individual: number;
  jugador1?: JugadorBasic | null;
  jugador2?: JugadorBasic | null;
};

export type MasterMatchDB = {
  id: string;
  edition_id: string;
  categoria_id: string;
  ronda: MasterRonda;
  numero_partido: number;
  team_local_id: string | null;
  team_visitante_id: string | null;
  ref_local: string | null;
  ref_visitante: string | null;
  set1_local: number | null;
  set1_visitante: number | null;
  set2_local: number | null;
  set2_visitante: number | null;
  set3_local: number | null;
  set3_visitante: number | null;
  ganador_team_id: string | null;
  estado: MasterMatchEstado;
  dia: string | null;
  hora: string | null;
  cancha: number | null;
};

export type MasterCategoryVisibilityDB = {
  id?: string;
  edition_id: string;
  categoria_id: string;
  publicar_clasificados: boolean;
  publicar_parejas: boolean;
  publicar_llaves: boolean;
};

export async function fetchClubMasterCategories(clubId: string): Promise<MasterCategoryMapping[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre, genero, orden")
    .eq("club_id", clubId)
    .eq("activa", true)
    .order("orden");

  if (error) throw error;

  const mapped = new Map<string, MasterCategoryMapping>();
  (data ?? []).forEach((cat) => {
    const spec = matchMasterCategorySpec(cat);
    if (spec && !mapped.has(spec.key)) {
      mapped.set(spec.key, {
        spec,
        categoria_id: cat.id,
        categoria_nombre: cat.nombre,
        genero: cat.genero,
      });
    }
  });

  return MASTER_2026_CATEGORIES.map((spec) => mapped.get(spec.key)).filter(
    (x): x is MasterCategoryMapping => Boolean(x)
  );
}

export async function getOrCreateMasterEdition(
  clubId: string,
  anio: number = 2026,
  createIfMissing: boolean = true
): Promise<MasterEditionRow | null> {
  const { data, error } = await (supabase as any)
    .from("master_editions")
    .select("*")
    .eq("club_id", clubId)
    .eq("anio", anio)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as MasterEditionRow;
  if (!createIfMissing) return null;

  const { data: created, error: insertError } = await (supabase as any)
    .from("master_editions")
    .insert({
      club_id: clubId,
      anio,
      nombre: `Good Padel Master ${anio}`,
      fecha_inicio: `${anio}-12-03`,
      fecha_fin: `${anio}-12-06`,
      estado: "activo",
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return created as MasterEditionRow;
}

export async function fetchJugadoresBasicosMap(
  clubId: string,
  jugadorIds?: string[]
): Promise<Map<string, JugadorBasic>> {
  const [{ data: cats }, { data: playerCats }] = await Promise.all([
    supabase.from("categorias").select("id, nombre, genero").eq("club_id", clubId),
    (supabase as any)
      .from("jugador_categorias_publicas")
      .select("jugador_id, categoria_id, categoria_nombre, genero"),
  ]);

  const catNameById = new Map<string, string>();
  (cats ?? []).forEach((c) => catNameById.set(c.id, c.nombre));

  const playerCatMap = new Map<string, { categoria_id: string | null; categoria_nombre: string | null }>();
  (playerCats ?? []).forEach((pc: any) => {
    if (pc.jugador_id && (!pc.categoria_id || catNameById.has(pc.categoria_id))) {
      playerCatMap.set(pc.jugador_id, {
        categoria_id: pc.categoria_id ?? null,
        categoria_nombre: pc.categoria_nombre ?? (pc.categoria_id ? catNameById.get(pc.categoria_id) ?? null : null),
      });
    }
  });

  let rows: any[] = [];
  if (jugadorIds && jugadorIds.length > 0) {
    const unique = Array.from(new Set(jugadorIds));
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      const { data } = await (supabase as any)
        .from("jugadores_publicos")
        .select("id, nombre, apellido, club, categoria_id")
        .in("id", chunk);
      if (data) rows = rows.concat(data);
    }
  } else {
    const { data } = await (supabase as any)
      .from("jugadores_publicos")
      .select("id, nombre, apellido, club, categoria_id")
      .order("apellido");
    rows = data ?? [];
  }

  const map = new Map<string, JugadorBasic>();
  rows.forEach((j) => {
    const clubCat = playerCatMap.get(j.id);
    const catId = clubCat?.categoria_id ?? j.categoria_id ?? null;
    const catName = clubCat?.categoria_nombre ?? (catId ? catNameById.get(catId) ?? null : null);
    map.set(j.id, {
      id: j.id,
      nombre: j.nombre ?? "",
      apellido: j.apellido ?? "",
      club: j.club ?? null,
      categoria_id: catId,
      categoria_nombre: catName,
      categoria_nivel: getNivelCategoriaPura(catName),
    });
  });

  return map;
}

export async function fetchMasterEditionData(editionId: string, clubId: string) {
  const [
    { data: qualifiers, error: qErr },
    { data: teams, error: tErr },
    { data: matches, error: mErr },
    { data: visibility, error: vErr },
  ] = await Promise.all([
    (supabase as any)
      .from("master_qualifiers")
      .select("*")
      .eq("edition_id", editionId)
      .order("posicion_final", { ascending: true, nullsFirst: false }),
    (supabase as any)
      .from("master_teams")
      .select("*")
      .eq("edition_id", editionId)
      .order("seed", { ascending: true }),
    (supabase as any)
      .from("master_matches")
      .select("*")
      .eq("edition_id", editionId)
      .order("numero_partido", { ascending: true }),
    (supabase as any)
      .from("master_category_visibility")
      .select("*")
      .eq("edition_id", editionId),
  ]);

  if (qErr) throw qErr;
  if (tErr) throw tErr;
  if (mErr) throw mErr;
  if (vErr) {
    console.warn("master_category_visibility no disponible aún:", vErr.message);
  }

  const ids = new Set<string>();
  (qualifiers ?? []).forEach((q: any) => ids.add(q.jugador_id));
  (teams ?? []).forEach((t: any) => {
    if (t.jugador1_id) ids.add(t.jugador1_id);
    if (t.jugador2_id) ids.add(t.jugador2_id);
  });

  const jugadoresMap = ids.size > 0 ? await fetchJugadoresBasicosMap(clubId, Array.from(ids)) : new Map();

  const qualifiersWithPlayers: MasterQualifierDB[] = (qualifiers ?? []).map((q: any) => ({
    ...q,
    jugador: jugadoresMap.get(q.jugador_id) ?? null,
  }));

  const teamsWithPlayers: MasterTeamDB[] = (teams ?? []).map((t: any) => ({
    ...t,
    jugador1: jugadoresMap.get(t.jugador1_id) ?? null,
    jugador2: t.jugador2_id ? jugadoresMap.get(t.jugador2_id) ?? null : null,
  }));

  return {
    qualifiers: qualifiersWithPlayers,
    teams: teamsWithPlayers,
    matches: (matches ?? []) as MasterMatchDB[],
    visibility: (visibility ?? []) as MasterCategoryVisibilityDB[],
  };
}

export async function upsertCategoryVisibility(params: {
  editionId: string;
  categoriaId: string;
  patch: Partial<Pick<MasterCategoryVisibilityDB, "publicar_clasificados" | "publicar_parejas" | "publicar_llaves">>;
  current?: MasterCategoryVisibilityDB | null;
}) {
  const { editionId, categoriaId, patch, current } = params;
  const payload = {
    edition_id: editionId,
    categoria_id: categoriaId,
    publicar_clasificados: patch.publicar_clasificados ?? current?.publicar_clasificados ?? false,
    publicar_parejas: patch.publicar_parejas ?? current?.publicar_parejas ?? false,
    publicar_llaves: patch.publicar_llaves ?? current?.publicar_llaves ?? false,
  };

  const { error } = await (supabase as any)
    .from("master_category_visibility")
    .upsert(payload, { onConflict: "edition_id,categoria_id" });

  if (error) throw error;
}

/**
 * Lee el ranking anual existente en modo SOLO LECTURA y puebla `master_qualifiers`
 * para una categoría específica (o todas si no se especifica).
 */
export async function syncQualifiersFromAnnualRanking(params: {
  editionId: string;
  clubId: string;
  anio: number;
  categoryMappings: MasterCategoryMapping[];
  targetCategoriaId?: string;
}) {
  const { editionId, clubId, anio, categoryMappings, targetCategoriaId } = params;

  const [{ data: cats }, { data: ascensos }, { data: playerCats }] = await Promise.all([
    supabase
      .from("categorias")
      .select("id, nombre, genero, orden")
      .eq("club_id", clubId)
      .eq("activa", true)
      .order("orden"),
    supabase
      .from("ascensos")
      .select("jugador_id, puntos_transferidos, categoria_destino_id, categoria_origen_id, created_at, fecha")
      .eq("anio", anio),
    (supabase as any)
      .from("jugador_categorias_publicas")
      .select("jugador_id, categoria_id, categoria_nombre, genero"),
  ]);

  const activeCats = (cats ?? []) as { id: string; nombre: string; genero: string; orden: number }[];
  const ranking = await fetchAllRankingRowsYear(
    anio,
    activeCats.map((c) => c.id)
  );

  const { ascendidosDesde, coincideFilaConCategoria, obtenerMetricasMasterJugador } =
    construirContextoAscensosYTorneos({
      categorias: activeCats,
      ascensos: (ascensos ?? []) as any[],
      rankingRows: ranking,
      jugadorCategorias: (playerCats ?? []) as any[],
    });

  const mappingsToSync = targetCategoriaId
    ? categoryMappings.filter((m) => m.categoria_id === targetCategoriaId)
    : categoryMappings;

  for (const mapping of mappingsToSync) {
    const catId = mapping.categoria_id;
    const catAscendidos = ascendidosDesde.get(catId);
    const catRows = (ranking ?? []).filter((r) => coincideFilaConCategoria(r, catId));

    const puntosMap = new Map<string, { ptsTorneos: number; ptsAscenso: number }>();
    catRows.forEach((r) => {
      if (!r.categoria_id) return;
      const rowAscendidos = ascendidosDesde.get(r.categoria_id);
      if ((catAscendidos && catAscendidos.has(r.jugador_id)) || (rowAscendidos && rowAscendidos.has(r.jugador_id))) {
        return;
      }
      const cur = puntosMap.get(r.jugador_id) ?? { ptsTorneos: 0, ptsAscenso: 0 };
      if (isAscenso(r.instancia)) {
        cur.ptsAscenso = Math.max(cur.ptsAscenso, r.puntos);
      } else {
        cur.ptsTorneos += r.puntos;
      }
      puntosMap.set(r.jugador_id, cur);
    });

    const rawList = Array.from(puntosMap.entries())
      .map(([jugador_id, pObj]) => {
        const metricas = obtenerMetricasMasterJugador(jugador_id, catId);
        const puntos_anuales = pObj.ptsTorneos + pObj.ptsAscenso;
        const torneosBase = metricas.torneos_en_categoria + metricas.torneos_categoria_superior;
        const torneosAnt = metricas.torneos_categoria_anterior;

        return {
          jugador_id,
          puntos_anuales,
          torneos_jugados: metricas.torneos_jugados,
          torneos_base: torneosBase,
          torneos_categoria_anterior: torneosAnt,
          es_ascendido: metricas.es_ascendido,
          master_status: metricas.master_status,
        };
      })
      .sort((a, b) => b.puntos_anuales - a.puntos_anuales)
      .map((r, idx) => ({
        ...r,
        ranking_posicion_original: idx + 1,
      }));

    const conReglas = aplicarReglasMaster(rawList, mapping.spec.cupos);
    const soloTitulares = conReglas.filter((r) => r.clasifica_master);

    // Borrar clasificados anteriores de esa categoría antes de reinsertar limpio
    await (supabase as any)
      .from("master_qualifiers")
      .delete()
      .eq("edition_id", editionId)
      .eq("categoria_id", catId);

    const rowsToInsert = soloTitulares.map((r, idx) => ({
      edition_id: editionId,
      categoria_id: catId,
      jugador_id: r.jugador_id,
      ranking_posicion_original: r.ranking_posicion_original,
      puntos_anuales: r.puntos_anuales,
      torneos_jugados: r.torneos_base,
      torneos_categoria_anterior: r.torneos_categoria_anterior,
      ascenso_validado: r.es_ascendido || r.master_status === "ascendido_habilitado",
      estado: "confirmado" as MasterQualifierEstado,
      orden_manual: null,
      posicion_final: r.posicion_master ?? idx + 1,
      es_suplente: false,
    }));

    if (rowsToInsert.length > 0) {
      const { error: insErr } = await (supabase as any)
        .from("master_qualifiers")
        .insert(rowsToInsert);
      if (insErr) throw insErr;
    }
  }
}

export async function recomputeAndPersistQualifiers(
  qualifiers: MasterQualifierDB[],
  cupos: number
) {
  const computed = computeMasterQualifiersOrder(qualifiers, cupos);
  await Promise.all(
    computed.map((q) =>
      (supabase as any)
        .from("master_qualifiers")
        .update({
          estado: q.estado,
          ascenso_validado: q.ascenso_validado,
          orden_manual: q.orden_manual,
          posicion_final: q.posicion_final,
          es_suplente: q.es_suplente,
        })
        .eq("id", q.id)
    )
  );
  return computed;
}

export async function generatePurasTeamsForCategory(params: {
  editionId: string;
  categoriaId: string;
  qualifiers: MasterQualifierView[];
}) {
  const { editionId, categoriaId, qualifiers } = params;
  const titulares = qualifiers.filter(
    (q) => !q.es_suplente && q.posicion_final !== null && q.posicion_final <= 16 && q.estado !== "baja"
  );
  const drafts = formarParejasPuras(
    titulares.map((t) => ({
      jugador_id: t.jugador_id,
      puntos_anuales: t.puntos_anuales,
      posicion_final: t.posicion_final!,
    }))
  );

  // Limpiar llaves y parejas previas de esta categoría
  await (supabase as any)
    .from("master_matches")
    .delete()
    .eq("edition_id", editionId)
    .eq("categoria_id", categoriaId);
  await (supabase as any)
    .from("master_teams")
    .delete()
    .eq("edition_id", editionId)
    .eq("categoria_id", categoriaId);

  const { error } = await (supabase as any).from("master_teams").insert(
    drafts.map((d) => ({
      edition_id: editionId,
      categoria_id: categoriaId,
      ...d,
    }))
  );
  if (error) throw error;
}

export async function saveSuma7TeamsForCategory(params: {
  editionId: string;
  categoriaId: string;
  pairs: {
    cruce_label: string;
    jugador1_id: string;
    jugador2_id: string | null;
    jugador2_nombre_manual: string | null;
    jugador2_categoria_nivel: number | null;
    puntos_combinados: number;
    mejor_ranking_individual: number;
  }[];
}) {
  const { editionId, categoriaId, pairs } = params;
  const seeded = ordenarSeedsParejas(pairs);

  await (supabase as any)
    .from("master_matches")
    .delete()
    .eq("edition_id", editionId)
    .eq("categoria_id", categoriaId);
  await (supabase as any)
    .from("master_teams")
    .delete()
    .eq("edition_id", editionId)
    .eq("categoria_id", categoriaId);

  const { error } = await (supabase as any).from("master_teams").insert(
    seeded.map((p) => ({
      edition_id: editionId,
      categoria_id: categoriaId,
      ...p,
    }))
  );
  if (error) throw error;
}

export async function resetTeamsAndMatchesForCategory(editionId: string, categoriaId: string) {
  await (supabase as any)
    .from("master_matches")
    .delete()
    .eq("edition_id", editionId)
    .eq("categoria_id", categoriaId);
  await (supabase as any)
    .from("master_teams")
    .delete()
    .eq("edition_id", editionId)
    .eq("categoria_id", categoriaId);
}

export async function resetMatchesForCategory(editionId: string, categoriaId: string) {
  await (supabase as any)
    .from("master_matches")
    .delete()
    .eq("edition_id", editionId)
    .eq("categoria_id", categoriaId);
}

export async function generateBracketForCategory(params: {
  editionId: string;
  categoriaId: string;
  teams: MasterTeamDB[];
  diaCuartosSemis: string;
}) {
  const { editionId, categoriaId, teams, diaCuartosSemis } = params;
  if (teams.length < 8) {
    throw new Error("Se necesitan las 8 parejas sembradas (Seed #1 a #8) para generar las llaves.");
  }

  const teamBySeed = new Map<number, MasterTeamDB>();
  teams.forEach((t) => teamBySeed.set(t.seed, t));

  await resetMatchesForCategory(editionId, categoriaId);

  const matchesToInsert = MASTER_BRACKET_TEMPLATE.map((tpl) => {
    const localTeam = tpl.seedLocal ? teamBySeed.get(tpl.seedLocal) : null;
    const visitTeam = tpl.seedVisitante ? teamBySeed.get(tpl.seedVisitante) : null;
    return {
      edition_id: editionId,
      categoria_id: categoriaId,
      ronda: tpl.ronda,
      numero_partido: tpl.numero_partido,
      team_local_id: localTeam?.id ?? null,
      team_visitante_id: visitTeam?.id ?? null,
      ref_local: tpl.ref_local,
      ref_visitante: tpl.ref_visitante,
      estado: "pendiente" as MasterMatchEstado,
      dia: tpl.ronda === "final" ? "2026-12-06" : diaCuartosSemis,
      hora: null,
      cancha: null,
    };
  });

  const { error } = await (supabase as any).from("master_matches").insert(matchesToInsert);
  if (error) throw error;
}

export async function saveMatchScoreAndAdvance(params: {
  match: MasterMatchDB;
  allCategoryMatches: MasterMatchDB[];
  score: BestOf3Score;
}) {
  const { match, allCategoryMatches, score } = params;
  const winnerSide = determinarGanadorBestOf3(score);
  const ganadorTeamId =
    winnerSide === "local"
      ? match.team_local_id
      : winnerSide === "visitante"
        ? match.team_visitante_id
        : null;

  const newEstado: MasterMatchEstado = ganadorTeamId
    ? "finalizado"
    : match.dia && match.hora && match.cancha
      ? "programado"
      : "pendiente";

  const { error } = await (supabase as any)
    .from("master_matches")
    .update({
      ...score,
      ganador_team_id: ganadorTeamId,
      estado: newEstado,
    })
    .eq("id", match.id);
  if (error) throw error;

  const target = getNextMasterMatchTarget(match.numero_partido);
  if (target) {
    const nextMatch = allCategoryMatches.find((m) => m.numero_partido === target.nextNumero);
    if (nextMatch) {
      const { error: advErr } = await (supabase as any)
        .from("master_matches")
        .update({
          [target.slot]: ganadorTeamId,
        })
        .eq("id", nextMatch.id);
      if (advErr) throw advErr;
    }
  }
}

export async function updateMatchSchedule(params: {
  matchId: string;
  dia: string | null;
  hora: string | null;
  cancha: number | null;
  currentEstado: MasterMatchEstado;
}) {
  const { matchId, dia, hora, cancha, currentEstado } = params;
  const nextEstado: MasterMatchEstado =
    currentEstado === "finalizado"
      ? "finalizado"
      : dia && hora && cancha
        ? "programado"
        : "pendiente";

  const { error } = await (supabase as any)
    .from("master_matches")
    .update({
      dia: dia || null,
      hora: hora || null,
      cancha: cancha || null,
      estado: nextEstado,
    })
    .eq("id", matchId);
  if (error) throw error;
}

export function formatTeamDisplayName(team: MasterTeamDB | undefined | null): string {
  if (!team) return "Por definir";
  const j1 = team.jugador1
    ? `${team.jugador1.apellido}, ${team.jugador1.nombre.charAt(0)}.`
    : "Jugador 1";
  const j2 = team.jugador2
    ? `${team.jugador2.apellido}, ${team.jugador2.nombre.charAt(0)}.`
    : team.jugador2_nombre_manual
      ? team.jugador2_nombre_manual
      : "Invitado";
  return `${j1} / ${j2}`;
}

export type PlayerMasterMatchItem = {
  id: string;
  ronda: MasterRonda;
  numero_partido: number;
  rivalNombre: string;
  dia: string | null;
  hora: string | null;
  cancha: number | null;
  marcador: string | null;
  gano: boolean | null;
  estado: MasterMatchEstado;
};

export type PlayerMasterCategoryParticipation = {
  categoria_id: string;
  categoria_label: string;
  clasificado: boolean;
  posicion_final: number | null;
  publicar_clasificados: boolean;
  publicar_parejas: boolean;
  publicar_llaves: boolean;
  team: {
    seed: number;
    cruce_label: string;
    companeroNombre: string;
    puntos_combinados: number;
  } | null;
  matches: PlayerMasterMatchItem[];
};

export async function fetchPlayerMasterParticipation(
  clubId: string,
  jugadorId: string
): Promise<PlayerMasterCategoryParticipation[]> {
  if (!clubId || !jugadorId) return [];

  const edition = await getOrCreateMasterEdition(clubId, 2026, false);
  if (!edition) return [];

  const [cats, { data: visRows }, { data: qualRows }, { data: myTeams }] = await Promise.all([
    fetchClubMasterCategories(clubId),
    (supabase as any).from("master_category_visibility").select("*").eq("edition_id", edition.id),
    (supabase as any)
      .from("master_qualifiers")
      .select("*")
      .eq("edition_id", edition.id)
      .eq("jugador_id", jugadorId),
    (supabase as any)
      .from("master_teams")
      .select("*")
      .eq("edition_id", edition.id)
      .or(`jugador1_id.eq.${jugadorId},jugador2_id.eq.${jugadorId}`),
  ]);

  const catMap = new Map(cats.map((c) => [c.categoria_id, c]));
  const visMap = new Map<string, MasterCategoryVisibilityDB>(
    (visRows ?? []).map((v: any) => [v.categoria_id, v])
  );

  const relevantCatIds = new Set<string>();
  (qualRows ?? []).forEach((q: any) => {
    if (!q.es_suplente && q.estado !== "baja" && q.posicion_final !== null) {
      relevantCatIds.add(q.categoria_id);
    }
  });
  (myTeams ?? []).forEach((t: any) => relevantCatIds.add(t.categoria_id));

  if (relevantCatIds.size === 0) return [];

  const catIdsArr = Array.from(relevantCatIds);
  const [{ data: allCatTeams }, { data: allCatMatches }] = await Promise.all([
    (supabase as any)
      .from("master_teams")
      .select("*")
      .eq("edition_id", edition.id)
      .in("categoria_id", catIdsArr),
    (supabase as any)
      .from("master_matches")
      .select("*")
      .eq("edition_id", edition.id)
      .in("categoria_id", catIdsArr)
      .order("numero_partido", { ascending: true }),
  ]);

  const playerIds = new Set<string>();
  (allCatTeams ?? []).forEach((t: any) => {
    if (t.jugador1_id) playerIds.add(t.jugador1_id);
    if (t.jugador2_id) playerIds.add(t.jugador2_id);
  });

  const jugadoresMap =
    playerIds.size > 0 ? await fetchJugadoresBasicosMap(clubId, Array.from(playerIds)) : new Map();

  const teamWithPlayersMap = new Map<string, MasterTeamDB>();
  (allCatTeams ?? []).forEach((t: any) => {
    teamWithPlayersMap.set(t.id, {
      ...t,
      jugador1: jugadoresMap.get(t.jugador1_id) ?? null,
      jugador2: t.jugador2_id ? jugadoresMap.get(t.jugador2_id) ?? null : null,
    });
  });

  const result: PlayerMasterCategoryParticipation[] = [];

  for (const catId of catIdsArr) {
    const catInfo = catMap.get(catId);
    if (!catInfo) continue;

    const vis = visMap.get(catId);
    const publicar_clasificados = Boolean(vis?.publicar_clasificados);
    const publicar_parejas = Boolean(vis?.publicar_parejas);
    const publicar_llaves = Boolean(vis?.publicar_llaves);

    if (!publicar_clasificados && !publicar_parejas && !publicar_llaves) continue;

    const qual = (qualRows ?? []).find(
      (q: any) => q.categoria_id === catId && !q.es_suplente && q.estado !== "baja"
    );
    const rawMyTeam = (myTeams ?? []).find((t: any) => t.categoria_id === catId);
    const myTeam = rawMyTeam ? teamWithPlayersMap.get(rawMyTeam.id) : undefined;

    let teamInfo: PlayerMasterCategoryParticipation["team"] = null;
    if (publicar_parejas && myTeam) {
      const isJ1 = myTeam.jugador1_id === jugadorId;
      const partner = isJ1 ? myTeam.jugador2 : myTeam.jugador1;
      const partnerName = partner
        ? `${partner.apellido}, ${partner.nombre}`
        : !isJ1
          ? "Compañero"
          : myTeam.jugador2_nombre_manual || "Invitado";
      teamInfo = {
        seed: myTeam.seed,
        cruce_label: myTeam.cruce_label,
        companeroNombre: partnerName,
        puntos_combinados: myTeam.puntos_combinados,
      };
    }

    const matchItems: PlayerMasterMatchItem[] = [];
    if (publicar_llaves && myTeam) {
      const myMatches = (allCatMatches ?? []).filter(
        (m: any) =>
          m.categoria_id === catId &&
          (m.team_local_id === myTeam.id || m.team_visitante_id === myTeam.id)
      );

      for (const m of myMatches) {
        const isLocal = m.team_local_id === myTeam.id;
        const rivalTeamId = isLocal ? m.team_visitante_id : m.team_local_id;
        const rivalTeam = rivalTeamId ? teamWithPlayersMap.get(rivalTeamId) : undefined;
        const rivalNombre = rivalTeam
          ? formatTeamDisplayName(rivalTeam)
          : (isLocal ? m.ref_visitante : m.ref_local) || "Por definir";

        const sets = [
          m.set1_local !== null && m.set1_visitante !== null
            ? isLocal
              ? `${m.set1_local}-${m.set1_visitante}`
              : `${m.set1_visitante}-${m.set1_local}`
            : null,
          m.set2_local !== null && m.set2_visitante !== null
            ? isLocal
              ? `${m.set2_local}-${m.set2_visitante}`
              : `${m.set2_visitante}-${m.set2_local}`
            : null,
          m.set3_local !== null && m.set3_visitante !== null
            ? isLocal
              ? `${m.set3_local}-${m.set3_visitante}`
              : `${m.set3_visitante}-${m.set3_local}`
            : null,
        ].filter(Boolean);

        matchItems.push({
          id: m.id,
          ronda: m.ronda,
          numero_partido: m.numero_partido,
          rivalNombre,
          dia: m.dia,
          hora: m.hora,
          cancha: m.cancha,
          marcador: sets.length > 0 ? sets.join(" / ") : null,
          gano: m.ganador_team_id ? m.ganador_team_id === myTeam.id : null,
          estado: m.estado,
        });
      }
    }

    result.push({
      categoria_id: catId,
      categoria_label: catInfo.spec.label,
      clasificado: Boolean(qual) || Boolean(myTeam),
      posicion_final: qual?.posicion_final ?? null,
      publicar_clasificados,
      publicar_parejas,
      publicar_llaves,
      team: teamInfo,
      matches: matchItems,
    });
  }

  return result;
}
