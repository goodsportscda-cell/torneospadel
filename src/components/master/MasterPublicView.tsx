import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, Loader2, MapPin, RefreshCw, Sparkles, Trophy, Tv, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { MASTER_DIAS, MASTER_RONDA_LABELS } from "@/lib/master2026";
import {
  fetchClubMasterCategories,
  fetchMasterEditionData,
  formatTeamDisplayName,
  getOrCreateMasterEdition,
  type MasterCategoryMapping,
  type MasterCategoryVisibilityDB,
  type MasterEditionRow,
  type MasterMatchDB,
  type MasterQualifierDB,
  type MasterTeamDB,
} from "@/lib/masterService";
import { MasterBracketView } from "@/components/master/MasterBracketView";

type Props = {
  clubId: string;
  clubNombre?: string;
  initialTvMode?: boolean;
};

export function MasterPublicView({ clubId, clubNombre, initialTvMode = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [tvMode, setTvMode] = useState(initialTvMode);
  const [edition, setEdition] = useState<MasterEditionRow | null>(null);
  const [categories, setCategories] = useState<MasterCategoryMapping[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [qualifiers, setQualifiers] = useState<MasterQualifierDB[]>([]);
  const [teams, setTeams] = useState<MasterTeamDB[]>([]);
  const [matches, setMatches] = useState<MasterMatchDB[]>([]);
  const [visibilityRows, setVisibilityRows] = useState<MasterCategoryVisibilityDB[]>([]);
  const [diaFiltro, setDiaFiltro] = useState<string>("todos");
  const [soloCatCronograma, setSoloCatCronograma] = useState<boolean>(false);

  const loadData = useCallback(async (silent = false) => {
    if (!clubId) return;
    if (!silent) setLoading(true);
    try {
      const [cats, ed] = await Promise.all([
        fetchClubMasterCategories(clubId),
        getOrCreateMasterEdition(clubId, 2026, false),
      ]);
      setCategories(cats);
      setEdition(ed);
      if (cats.length > 0) {
        setSelectedCatId((prev) => (prev && cats.some((c) => c.categoria_id === prev) ? prev : cats[0].categoria_id));
      }
      if (ed) {
        const data = await fetchMasterEditionData(ed.id, clubId);
        setQualifiers(data.qualifiers);
        setTeams(data.teams);
        setMatches(data.matches);
        setVisibilityRows(data.visibility);
      }
    } catch (err) {
      console.error("Error cargando Master 2026:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  // Auto-refresh en tiempo real cada 30s cuando está en Modo TV o activo
  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadData(true);
    }, tvMode ? 15000 : 30000);
    return () => window.clearInterval(interval);
  }, [loadData, tvMode]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.categoria_id === selectedCatId) ?? null,
    [categories, selectedCatId]
  );

  const visibilityByCatId = useMemo(
    () => new Map(visibilityRows.map((v) => [v.categoria_id, v])),
    [visibilityRows]
  );

  const activeVisibility = useMemo(() => {
    const found = visibilityByCatId.get(selectedCatId);
    return (
      found ?? {
        edition_id: edition?.id ?? "",
        categoria_id: selectedCatId,
        publicar_clasificados: false,
        publicar_parejas: false,
        publicar_llaves: false,
      }
    );
  }, [visibilityByCatId, selectedCatId, edition?.id]);

  const anySectionPublishedInClub = useMemo(
    () =>
      visibilityRows.some(
        (v) => v.publicar_clasificados || v.publicar_parejas || v.publicar_llaves
      ),
    [visibilityRows]
  );

  const catQualifiers = useMemo(() => {
    if (!activeCategory) return [];
    return qualifiers.filter(
      (q) =>
        q.categoria_id === selectedCatId &&
        !q.es_suplente &&
        q.estado !== "baja" &&
        q.posicion_final !== null &&
        q.posicion_final <= activeCategory.spec.cupos
    );
  }, [qualifiers, selectedCatId, activeCategory]);

  const catTeams = useMemo(
    () => teams.filter((t) => t.categoria_id === selectedCatId).sort((a, b) => a.seed - b.seed),
    [teams, selectedCatId]
  );

  const catMatches = useMemo(
    () => matches.filter((m) => m.categoria_id === selectedCatId).sort((a, b) => a.numero_partido - b.numero_partido),
    [matches, selectedCatId]
  );

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.categoria_id, c])), [categories]);

  const scheduleMatches = useMemo(() => {
    return matches
      .filter((m) => {
        const vis = visibilityByCatId.get(m.categoria_id);
        if (!vis?.publicar_llaves) return false;
        if (soloCatCronograma && m.categoria_id !== selectedCatId) return false;
        if (diaFiltro !== "todos" && m.dia !== diaFiltro) return false;
        return Boolean(m.dia || m.hora || m.cancha);
      })
      .sort((a, b) => {
        const da = a.dia ?? "9999-99-99";
        const db = b.dia ?? "9999-99-99";
        if (da !== db) return da.localeCompare(db);
        const ha = a.hora ?? "99:99";
        const hb = b.hora ?? "99:99";
        if (ha !== hb) return ha.localeCompare(hb);
        return (a.cancha ?? 99) - (b.cancha ?? 99);
      });
  }, [matches, diaFiltro, soloCatCronograma, selectedCatId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-5 transition-colors",
        tvMode && "rounded-2xl bg-[#080b12] p-4 sm:p-6 text-white border border-white/10"
      )}
    >
      {/* Header Banner */}
      <div
        className={cn(
          "rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
          tvMode
            ? "border-amber-400/30 bg-gradient-to-r from-amber-500/15 via-primary/10 to-transparent"
            : "border-primary/25 bg-gradient-to-r from-primary/10 via-amber-500/10 to-transparent"
        )}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-amber-500 text-slate-950 font-black hover:bg-amber-500">
              <Sparkles className="h-3 w-3 mr-1" /> 3 AL 6 DE DICIEMBRE 2026
            </Badge>
            {clubNombre && (
              <span className={cn("text-xs font-semibold uppercase tracking-wider", tvMode ? "text-white/60" : "text-muted-foreground")}>
                {clubNombre}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500 shrink-0" />
            {edition?.nombre || "Good Padel Master 2026"}
          </h2>
          <p className={cn("text-xs sm:text-sm", tvMode ? "text-white/65" : "text-muted-foreground")}>
            8 categorías · Cuartos de Final, Semifinales y Finales en 6 canchas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant={tvMode ? "secondary" : "outline"}
            onClick={() => void loadData(true)}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </Button>
          <Button
            size="sm"
            variant={tvMode ? "default" : "outline"}
            onClick={() => setTvMode((v) => !v)}
            className="gap-1.5 font-bold"
          >
            <Tv className="h-3.5 w-3.5" /> {tvMode ? "Vista Normal" : "Modo Pantalla TV"}
          </Button>
        </div>
      </div>

      {!edition || !anySectionPublishedInClub ? (
        <Card className={cn("border-dashed", tvMode && "bg-white/[0.03] border-white/15 text-white")}>
          <CardContent className="py-12 text-center space-y-2">
            <Trophy className="h-10 w-10 mx-auto text-amber-500/70" />
            <p className="text-lg font-black">Próximamente · Good Padel Master 2026</p>
            <p className={cn("text-sm", tvMode ? "text-white/60" : "text-muted-foreground")}>
              Estamos preparando los clasificados, parejas y llaves oficiales (3 al 6 de diciembre).
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Selector de Categoría */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map((c) => (
                <Button
                  key={c.categoria_id}
                  size="sm"
                  variant={selectedCatId === c.categoria_id ? "default" : tvMode ? "ghost" : "outline"}
                  onClick={() => setSelectedCatId(c.categoria_id)}
                  className={cn(
                    "font-bold text-xs",
                    tvMode && selectedCatId !== c.categoria_id && "text-white/75 hover:text-white hover:bg-white/10"
                  )}
                >
                  {c.spec.label}
                </Button>
              ))}
            </div>
          </div>

          {!activeVisibility.publicar_clasificados &&
          !activeVisibility.publicar_parejas &&
          !activeVisibility.publicar_llaves ? (
            <Card className={cn("border-dashed", tvMode && "bg-white/[0.03] border-white/15 text-white")}>
              <CardContent className="py-12 text-center space-y-2">
                <Trophy className="h-9 w-9 mx-auto text-amber-500/60" />
                <p className="font-bold">Próximamente · {activeCategory?.spec.label}</p>
                <p className={cn("text-sm", tvMode ? "text-white/60" : "text-muted-foreground")}>
                  La información de esta categoría se publicará muy pronto.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Tabs
              key={selectedCatId}
              defaultValue={
                activeVisibility.publicar_llaves
                  ? "llaves"
                  : activeVisibility.publicar_parejas
                    ? "parejas"
                    : "clasificados"
              }
              className="w-full"
            >
              <TabsList className={cn("flex flex-wrap w-full h-auto p-1 gap-1", tvMode && "bg-white/10")}>
                {activeVisibility.publicar_clasificados && (
                  <TabsTrigger value="clasificados" className="flex-1 min-w-[110px] text-xs sm:text-sm font-bold py-2">
                    Clasificados
                  </TabsTrigger>
                )}
                {activeVisibility.publicar_parejas && (
                  <TabsTrigger value="parejas" className="flex-1 min-w-[110px] text-xs sm:text-sm font-bold py-2">
                    Parejas (8)
                  </TabsTrigger>
                )}
                {activeVisibility.publicar_llaves && (
                  <TabsTrigger value="llaves" className="flex-1 min-w-[110px] text-xs sm:text-sm font-bold py-2">
                    Llaves
                  </TabsTrigger>
                )}
                {activeVisibility.publicar_llaves && (
                  <TabsTrigger value="cronograma" className="flex-1 min-w-[110px] text-xs sm:text-sm font-bold py-2">
                    Orden de Juego
                  </TabsTrigger>
                )}
              </TabsList>

            {/* 1. CLASIFICADOS */}
            <TabsContent value="clasificados" className="mt-4">
              <Card className={cn(tvMode && "bg-white/[0.03] border-white/15 text-white")}>
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Clasificados · {activeCategory?.spec.label}
                  </CardTitle>
                  <Badge variant="outline" className={cn(tvMode && "border-white/20 text-white")}>
                    {activeCategory?.spec.isSuma ? "8 Titulares + 8 Invitados" : `Top ${activeCategory?.spec.cupos ?? 16}`}
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {catQualifiers.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      Todavía no hay clasificados cargados para esta categoría.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className={cn(tvMode && "border-white/10")}>
                            <TableHead className="w-16 text-center">Puesto</TableHead>
                            <TableHead>Jugador</TableHead>
                            <TableHead className="text-center">Torneos</TableHead>
                            <TableHead className="text-right">Puntos</TableHead>
                            <TableHead className="text-right">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {catQualifiers.map((q) => {
                            const totalTorneos = q.ascenso_validado
                              ? q.torneos_jugados + q.torneos_categoria_anterior
                              : q.torneos_jugados;
                            const teamSuma7 = activeCategory?.spec.isSuma
                              ? catTeams.find((tm) => tm.jugador1_id === q.jugador_id)
                              : undefined;
                            const invitadoNombre = teamSuma7?.jugador2
                              ? `${teamSuma7.jugador2.apellido}, ${teamSuma7.jugador2.nombre}`
                              : teamSuma7?.jugador2_nombre_manual;

                            return (
                              <TableRow key={q.id} className={cn(tvMode && "border-white/10")}>
                                <TableCell className="text-center font-black">
                                  <span className="text-primary">{q.posicion_final}°</span>
                                </TableCell>
                                <TableCell className="font-semibold">
                                  <div>{q.jugador ? `${q.jugador.apellido}, ${q.jugador.nombre}` : "Jugador"}</div>
                                  {invitadoNombre && (
                                    <div className="text-xs text-emerald-500 font-medium">
                                      + Invitado: {invitadoNombre}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-center text-xs">
                                  {totalTorneos}/7
                                </TableCell>
                                <TableCell className="text-right font-bold tabular-nums">
                                  {q.puntos_anuales}
                                </TableCell>
                                <TableCell className="text-right">
                                  {q.estado === "confirmado" ? (
                                    <Badge className="bg-emerald-600 text-white text-[10px]">Titular Confirmado</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px]">Titular</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. PAREJAS DEL MASTER */}
            <TabsContent value="parejas" className="mt-4">
              <Card className={cn(tvMode && "bg-white/[0.03] border-white/15 text-white")}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Parejas y Preclasificación · {activeCategory?.spec.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {catTeams.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      Las parejas de esta categoría aún no fueron confirmadas.
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {catTeams.map((team) => (
                        <div
                          key={team.id}
                          className={cn(
                            "rounded-xl border p-3.5 flex items-center justify-between gap-3",
                            tvMode ? "border-white/15 bg-white/[0.04]" : "bg-card"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">
                              #{team.seed}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm truncate">{formatTeamDisplayName(team)}</div>
                              <div className={cn("text-xs", tvMode ? "text-white/60" : "text-muted-foreground")}>
                                Cruce: {team.cruce_label || `Seed #${team.seed}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-black text-primary tabular-nums">{team.puntos_combinados} pts</div>
                            <div className={cn("text-[10px] uppercase", tvMode ? "text-white/50" : "text-muted-foreground")}>
                              Seed #{team.seed}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. LLAVES ELIMINATORIAS */}
            <TabsContent value="llaves" className="mt-4">
              <MasterBracketView matches={catMatches} teams={catTeams} tvMode={tvMode} />
            </TabsContent>

            {/* 4. ORDEN DE JUEGO / CRONOGRAMA */}
            <TabsContent value="cronograma" className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={diaFiltro === "todos" ? "default" : "outline"}
                    onClick={() => setDiaFiltro("todos")}
                    className="text-xs font-bold"
                  >
                    Todos los días
                  </Button>
                  {MASTER_DIAS.map((d) => (
                    <Button
                      key={d.key}
                      size="sm"
                      variant={diaFiltro === d.key ? "default" : "outline"}
                      onClick={() => setDiaFiltro(d.key)}
                      className="text-xs font-bold"
                    >
                      {d.shortLabel}
                    </Button>
                  ))}
                </div>
                <Select
                  value={soloCatCronograma ? "categoria" : "todas"}
                  onValueChange={(v) => setSoloCatCronograma(v === "categoria")}
                >
                  <SelectTrigger className={cn("w-full sm:w-52 h-9 text-xs", tvMode && "bg-white/10 border-white/20 text-white")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las categorías</SelectItem>
                    <SelectItem value="categoria">Solo {activeCategory?.spec.label}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scheduleMatches.length === 0 ? (
                <Card className={cn("border-dashed", tvMode && "bg-white/[0.03] border-white/15 text-white")}>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    No hay partidos programados para los filtros seleccionados.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {scheduleMatches.map((m) => {
                    const cat = catById.get(m.categoria_id);
                    const localTeam = m.team_local_id ? teamById.get(m.team_local_id) : undefined;
                    const visitTeam = m.team_visitante_id ? teamById.get(m.team_visitante_id) : undefined;
                    const diaInfo = MASTER_DIAS.find((d) => d.key === m.dia);
                    const scoreStr = [
                      m.set1_local !== null && m.set1_visitante !== null ? `${m.set1_local}-${m.set1_visitante}` : null,
                      m.set2_local !== null && m.set2_visitante !== null ? `${m.set2_local}-${m.set2_visitante}` : null,
                      m.set3_local !== null && m.set3_visitante !== null ? `${m.set3_local}-${m.set3_visitante}` : null,
                    ]
                      .filter(Boolean)
                      .join(" / ");

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded-xl border p-3.5 space-y-2",
                          tvMode ? "border-white/15 bg-white/[0.04]" : "bg-card shadow-sm"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="default" className="text-[10px]">
                              {cat?.spec.label ?? "Categoría"}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[10px]", tvMode && "border-white/20 text-white")}>
                              {MASTER_RONDA_LABELS[m.ronda]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold">
                            {diaInfo && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-primary" /> {diaInfo.shortLabel}
                              </span>
                            )}
                            {m.hora && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3 text-primary" /> {m.hora}
                              </span>
                            )}
                            {m.cancha && (
                              <Badge variant="secondary" className="text-[10px]">
                                <MapPin className="h-2.5 w-2.5 mr-0.5" /> Cancha {m.cancha}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="text-sm font-semibold">
                          <span>{localTeam ? formatTeamDisplayName(localTeam) : m.ref_local || "Por definir"}</span>
                          <span className="mx-2 text-xs text-muted-foreground">vs</span>
                          <span>{visitTeam ? formatTeamDisplayName(visitTeam) : m.ref_visitante || "Por definir"}</span>
                        </div>

                        {scoreStr && (
                          <div className="text-xs font-black text-emerald-500">
                            Resultado: {scoreStr}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
