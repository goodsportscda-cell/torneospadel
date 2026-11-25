import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Tv,
  Users,
} from "lucide-react";
import {
  computeMasterQualifiersOrder,
  detectarConflictosCronograma,
  MASTER_CANCHAS,
  MASTER_DIAS,
  MASTER_RONDA_LABELS,
  validarSuma7,
  type MasterQualifierEstado,
} from "@/lib/master2026";
import {
  fetchClubMasterCategories,
  fetchMasterEditionData,
  fetchSuma7RankingPlayers,
  formatTeamDisplayName,
  generateBracketForCategory,
  generatePurasTeamsForCategory,
  getOrCreateMasterEdition,
  recomputeAndPersistQualifiers,
  resetMatchesForCategory,
  resetTeamsAndMatchesForCategory,
  saveMatchScoreAndAdvance,
  saveSuma7TeamsForCategory,
  syncQualifiersFromAnnualRanking,
  updateMatchSchedule,
  upsertCategoryVisibility,
  type MasterCategoryMapping,
  type MasterCategoryVisibilityDB,
  type MasterEditionRow,
  type MasterMatchDB,
  type MasterQualifierDB,
  type MasterTeamDB,
  type Suma7RankingPlayerOption,
} from "@/lib/masterService";
import { MasterBracketView } from "@/components/master/MasterBracketView";

type Suma7Draft = {
  titular_id: string;
  titular_pos: number;
  titular_pts: number;
  titular_nivel: number | null;
  invitado_jugador_id: string;
  invitado_nombre_manual: string;
  invitado_nivel: string;
  invitado_puntos: string;
};

const NIVELES_CATEGORIA = [
  { value: "1", label: "1ra" },
  { value: "2", label: "2da" },
  { value: "3", label: "3ra" },
  { value: "4", label: "4ta" },
  { value: "5", label: "5ta" },
  { value: "6", label: "6ta" },
  { value: "7", label: "7ma" },
  { value: "8", label: "8va" },
];

export default function Master2026Admin() {
  const { clubId, clubActivo } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [edition, setEdition] = useState<MasterEditionRow | null>(null);
  const [categories, setCategories] = useState<MasterCategoryMapping[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [mainTab, setMainTab] = useState<"categoria" | "cronograma">("categoria");
  const [catTab, setCatTab] = useState<"clasificados" | "parejas" | "llaves">("clasificados");

  const [qualifiers, setQualifiers] = useState<MasterQualifierDB[]>([]);
  const [teams, setTeams] = useState<MasterTeamDB[]>([]);
  const [matches, setMatches] = useState<MasterMatchDB[]>([]);
  const [visibilityRows, setVisibilityRows] = useState<MasterCategoryVisibilityDB[]>([]);
  const [suma7Players, setSuma7Players] = useState<Suma7RankingPlayerOption[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Suma 7 drafts
  const [suma7Drafts, setSuma7Drafts] = useState<Record<string, Suma7Draft>>({});

  // Score modal
  const [scoreMatch, setScoreMatch] = useState<MasterMatchDB | null>(null);
  const [s1L, setS1L] = useState("");
  const [s1V, setS1V] = useState("");
  const [s2L, setS2L] = useState("");
  const [s2V, setS2V] = useState("");
  const [s3L, setS3L] = useState("");
  const [s3V, setS3V] = useState("");

  // Schedule filter
  const [diaFiltro, setDiaFiltro] = useState<string>("todos");

  const loadAll = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const [cats, ed] = await Promise.all([
        fetchClubMasterCategories(clubId),
        getOrCreateMasterEdition(clubId, 2026, true),
      ]);
      setCategories(cats);
      setEdition(ed);

      const suma7Cat = cats.find((c) => c.spec.isSuma);
      const suma7Promise = suma7Cat
        ? fetchSuma7RankingPlayers(clubId, suma7Cat.categoria_id, ed?.anio ?? 2026)
        : Promise.resolve([]);

      if (cats.length > 0) {
        setSelectedCatId((prev) => (prev && cats.some((c) => c.categoria_id === prev) ? prev : cats[0].categoria_id));
      }
      if (ed) {
        const [data, s7List] = await Promise.all([
          fetchMasterEditionData(ed.id, clubId),
          suma7Promise,
        ]);
        setQualifiers(data.qualifiers);
        setTeams(data.teams);
        setMatches(data.matches);
        setVisibilityRows(data.visibility);
        setSuma7Players(s7List);
      } else {
        setSuma7Players(await suma7Promise);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Error al cargar el módulo Master 2026");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.categoria_id === selectedCatId) ?? null,
    [categories, selectedCatId]
  );

  const activeVisibility = useMemo(() => {
    const found = visibilityRows.find((v) => v.categoria_id === selectedCatId);
    return (
      found ?? {
        edition_id: edition?.id ?? "",
        categoria_id: selectedCatId,
        publicar_clasificados: false,
        publicar_parejas: false,
        publicar_llaves: false,
      }
    );
  }, [visibilityRows, selectedCatId, edition?.id]);

  const catQualifiers = useMemo(() => {
    if (!activeCategory) return [];
    const list = qualifiers.filter((q) => q.categoria_id === activeCategory.categoria_id);
    return computeMasterQualifiersOrder(list, activeCategory.spec.cupos).filter(
      (q) => !q.es_suplente && q.posicion_final !== null && q.posicion_final <= activeCategory.spec.cupos
    );
  }, [qualifiers, activeCategory]);

  const catTeams = useMemo(
    () => teams.filter((t) => t.categoria_id === selectedCatId).sort((a, b) => a.seed - b.seed),
    [teams, selectedCatId]
  );

  const catMatches = useMemo(
    () => matches.filter((m) => m.categoria_id === selectedCatId).sort((a, b) => a.numero_partido - b.numero_partido),
    [matches, selectedCatId]
  );

  // Inicializar drafts de Suma 7 cuando cambia la categoría
  useEffect(() => {
    if (!activeCategory?.spec.isSuma) return;
    const titulares = catQualifiers.filter((q) => !q.es_suplente && q.posicion_final !== null && q.posicion_final <= 8);
    const next: Record<string, Suma7Draft> = {};
    titulares.forEach((t) => {
      const existingTeam = catTeams.find((tm) => tm.jugador1_id === t.jugador_id);
      const s7Match = existingTeam?.jugador2_id
        ? suma7Players.find((p) => p.id === existingTeam.jugador2_id)
        : undefined;
      const derivedGuestPts = existingTeam
        ? Math.max(0, existingTeam.puntos_combinados - t.puntos_anuales)
        : s7Match
          ? s7Match.puntos_suma7
          : 0;
      next[t.jugador_id] = {
        titular_id: t.jugador_id,
        titular_pos: t.posicion_final!,
        titular_pts: t.puntos_anuales,
        titular_nivel: t.jugador?.categoria_nivel ?? null,
        invitado_jugador_id: existingTeam?.jugador2_id ?? "",
        invitado_nombre_manual: existingTeam?.jugador2_nombre_manual ?? "",
        invitado_nivel: existingTeam?.jugador2_categoria_nivel
          ? String(existingTeam.jugador2_categoria_nivel)
          : existingTeam?.jugador2?.categoria_nivel
            ? String(existingTeam.jugador2.categoria_nivel)
            : "",
        invitado_puntos: String(derivedGuestPts),
      };
    });
    setSuma7Drafts(next);
  }, [activeCategory, catQualifiers, catTeams, suma7Players]);

  const handleSyncAll = async (onlyCategoryId?: string) => {
    if (!edition || !clubId) return;
    setBusy(true);
    try {
      await syncQualifiersFromAnnualRanking({
        editionId: edition.id,
        clubId,
        anio: edition.anio,
        categoryMappings: categories,
        targetCategoriaId: onlyCategoryId,
      });
      await loadAll();
      toast.success(
        onlyCategoryId
          ? "Clasificados reseteados y sincronizados desde el ranking anual."
          : "Todas las categorías sincronizadas desde el ranking anual."
      );
    } catch (err: any) {
      toast.error(err?.message || "No se pudo sincronizar desde el ranking");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleVisibility = async (
    field: "publicar_clasificados" | "publicar_parejas" | "publicar_llaves",
    value: boolean
  ) => {
    if (!edition || !activeCategory) return;
    setBusy(true);
    try {
      await upsertCategoryVisibility({
        editionId: edition.id,
        categoriaId: activeCategory.categoria_id,
        patch: { [field]: value },
        current: activeVisibility,
      });
      await loadAll();
      toast.success("Visibilidad pública actualizada");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo actualizar la visibilidad (¿falta correr la migración SQL?)");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateQualifier = async (
    q: MasterQualifierDB,
    patch: Partial<Pick<MasterQualifierDB, "estado" | "ascenso_validado">>
  ) => {
    if (!activeCategory) return;
    setBusy(true);
    try {
      const updatedCatList = qualifiers
        .filter((item) => item.categoria_id === activeCategory.categoria_id)
        .map((item) => (item.id === q.id ? { ...item, ...patch } : item));
      await recomputeAndPersistQualifiers(updatedCatList, activeCategory.spec.cupos);
      await loadAll();
      toast.success("Clasificación actualizada y reacomodada");
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar clasificado");
    } finally {
      setBusy(false);
    }
  };

  const handleMoveQualifier = async (idx: number, dir: -1 | 1) => {
    if (!activeCategory) return;
    const activos = catQualifiers.filter((q) => q.elegible && q.estado !== "baja");
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= activos.length) return;

    setBusy(true);
    try {
      const reordered = [...activos];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(targetIdx, 0, moved);
      const withManualOrder = reordered.map((item, i) => ({
        ...item,
        orden_manual: i + 1,
      }));
      const inactivos = catQualifiers.filter((q) => !q.elegible || q.estado === "baja");
      await recomputeAndPersistQualifiers([...withManualOrder, ...inactivos], activeCategory.spec.cupos);
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo reordenar");
    } finally {
      setBusy(false);
    }
  };

  const handleFormarParejasPuras = async () => {
    if (!edition || !activeCategory) return;
    setBusy(true);
    try {
      await generatePurasTeamsForCategory({
        editionId: edition.id,
        categoriaId: activeCategory.categoria_id,
        qualifiers: catQualifiers,
      });
      await loadAll();
      toast.success("8 parejas formadas y sembradas (1°+16° ... 8°+9°)");
    } catch (err: any) {
      toast.error(err?.message || "Error al formar parejas");
    } finally {
      setBusy(false);
    }
  };

  const handleGuardarSuma7 = async () => {
    if (!edition || !activeCategory) return;
    const drafts = Object.values(suma7Drafts).sort((a, b) => a.titular_pos - b.titular_pos);
    if (drafts.length < 8) {
      toast.error(`Se necesitan 8 titulares en Suma 7 (hay ${drafts.length}).`);
      return;
    }

    const pairsToSave = [];
    for (const d of drafts) {
      const guestPlayer = d.invitado_jugador_id
        ? suma7Players.find((p) => p.id === d.invitado_jugador_id) ?? null
        : null;
      const guestLevel = d.invitado_nivel ? parseInt(d.invitado_nivel, 10) : guestPlayer?.categoria_nivel ?? null;
      const check = validarSuma7(d.titular_nivel, guestLevel);
      if (!check.ok) {
        toast.error(`Titular #${d.titular_pos}: ${check.error}`);
        return;
      }
      if (!guestPlayer && !d.invitado_nombre_manual.trim()) {
        toast.error(`Titular #${d.titular_pos}: seleccioná un jugador de Suma 7 o escribí el nombre del invitado.`);
        return;
      }
      const guestPts = Math.max(0, parseInt(d.invitado_puntos || "0", 10) || 0);
      pairsToSave.push({
        cruce_label: `Titular #${d.titular_pos} + Invitado`,
        jugador1_id: d.titular_id,
        jugador2_id: guestPlayer ? guestPlayer.id : null,
        jugador2_nombre_manual: guestPlayer ? null : d.invitado_nombre_manual.trim(),
        jugador2_categoria_nivel: guestLevel,
        puntos_combinados: d.titular_pts + guestPts,
        mejor_ranking_individual: d.titular_pos,
      });
    }

    setBusy(true);
    try {
      await saveSuma7TeamsForCategory({
        editionId: edition.id,
        categoriaId: activeCategory.categoria_id,
        pairs: pairsToSave,
      });
      await loadAll();
      toast.success("Parejas de Suma 7 guardadas y sembradas");
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar parejas Suma 7");
    } finally {
      setBusy(false);
    }
  };

  const handleSwapSeed = async (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= catTeams.length) return;
    const teamA = catTeams[idx];
    const teamB = catTeams[targetIdx];
    setBusy(true);
    try {
      // Seed has unique constraint (edition_id, categoria_id, seed) -> swap via temp seed
      await (supabase as any).from("master_teams").update({ seed: 99 }).eq("id", teamA.id);
      await (supabase as any).from("master_teams").update({ seed: teamA.seed }).eq("id", teamB.id);
      await (supabase as any).from("master_teams").update({ seed: teamB.seed }).eq("id", teamA.id);
      await loadAll();
      toast.success("Orden de preclasificación actualizado");
    } catch (err: any) {
      toast.error(err?.message || "No se pudo cambiar el seed");
    } finally {
      setBusy(false);
    }
  };

  const handleResetParejas = async () => {
    if (!edition || !activeCategory) return;
    setBusy(true);
    try {
      await resetTeamsAndMatchesForCategory(edition.id, activeCategory.categoria_id);
      await loadAll();
      toast.success("Parejas y llaves reseteadas para esta categoría");
    } catch (err: any) {
      toast.error(err?.message || "Error al resetear parejas");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerarLlaves = async () => {
    if (!edition || !activeCategory) return;
    setBusy(true);
    try {
      await generateBracketForCategory({
        editionId: edition.id,
        categoriaId: activeCategory.categoria_id,
        teams: catTeams,
        diaCuartosSemis: activeCategory.spec.diaCuartosSemis,
      });
      await loadAll();
      toast.success("Cuadro de Cuartos → Semis → Final generado");
    } catch (err: any) {
      toast.error(err?.message || "Error al generar llaves");
    } finally {
      setBusy(false);
    }
  };

  const handleResetLlaves = async () => {
    if (!edition || !activeCategory) return;
    setBusy(true);
    try {
      await resetMatchesForCategory(edition.id, activeCategory.categoria_id);
      await loadAll();
      toast.success("Llaves reseteadas");
    } catch (err: any) {
      toast.error(err?.message || "Error al resetear llaves");
    } finally {
      setBusy(false);
    }
  };

  const openScoreDialog = (m: MasterMatchDB) => {
    setScoreMatch(m);
    setS1L(m.set1_local !== null ? String(m.set1_local) : "");
    setS1V(m.set1_visitante !== null ? String(m.set1_visitante) : "");
    setS2L(m.set2_local !== null ? String(m.set2_local) : "");
    setS2V(m.set2_visitante !== null ? String(m.set2_visitante) : "");
    setS3L(m.set3_local !== null ? String(m.set3_local) : "");
    setS3V(m.set3_visitante !== null ? String(m.set3_visitante) : "");
  };

  const handleSaveScore = async () => {
    if (!scoreMatch) return;
    const parseOpt = (v: string) => (v.trim() === "" ? null : parseInt(v, 10));
    setBusy(true);
    try {
      await saveMatchScoreAndAdvance({
        match: scoreMatch,
        allCategoryMatches: catMatches,
        score: {
          set1_local: parseOpt(s1L),
          set1_visitante: parseOpt(s1V),
          set2_local: parseOpt(s2L),
          set2_visitante: parseOpt(s2V),
          set3_local: parseOpt(s3L),
          set3_visitante: parseOpt(s3V),
        },
      });
      setScoreMatch(null);
      await loadAll();
      toast.success("Resultado guardado y ganador avanzado");
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar resultado");
    } finally {
      setBusy(false);
    }
  };

  const handleScheduleChange = async (
    match: MasterMatchDB,
    patch: { dia?: string | null; hora?: string | null; cancha?: number | null }
  ) => {
    const nextDia = patch.dia !== undefined ? patch.dia : match.dia;
    const nextHora = patch.hora !== undefined ? patch.hora : match.hora;
    const nextCancha = patch.cancha !== undefined ? patch.cancha : match.cancha;
    const nextEstado =
      match.estado === "finalizado"
        ? "finalizado"
        : nextDia && nextHora && nextCancha
          ? "programado"
          : "pendiente";

    // Actualización optimista inmediata para sincronizar Llaves y Cronograma al instante
    setMatches((prev) =>
      prev.map((m) =>
        m.id === match.id
          ? { ...m, dia: nextDia, hora: nextHora, cancha: nextCancha, estado: nextEstado }
          : m
      )
    );

    try {
      await updateMatchSchedule({
        matchId: match.id,
        dia: nextDia,
        hora: nextHora,
        cancha: nextCancha,
        currentEstado: match.estado,
      });
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar el horario en la base de datos");
      await loadAll();
    }
  };

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.categoria_id, c])), [categories]);

  const scheduleConflicts = useMemo(() => {
    const payload = matches.map((m) => {
      const cat = catById.get(m.categoria_id);
      const tL = m.team_local_id ? teamById.get(m.team_local_id) : undefined;
      const tV = m.team_visitante_id ? teamById.get(m.team_visitante_id) : undefined;
      const pIds = [tL?.jugador1_id, tL?.jugador2_id, tV?.jugador1_id, tV?.jugador2_id].filter(
        (x): x is string => Boolean(x)
      );
      return {
        id: m.id,
        categoriaLabel: cat?.spec.label ?? "Categoría",
        rondaLabel: `${MASTER_RONDA_LABELS[m.ronda]} #${m.numero_partido}`,
        dia: m.dia,
        hora: m.hora,
        cancha: m.cancha,
        playerIds: pIds,
      };
    });
    return detectarConflictosCronograma(payload);
  }, [matches, catById, teamById]);

  const conflictMatchIds = useMemo(() => {
    const ids = new Set<string>();
    scheduleConflicts.forEach((c) => {
      ids.add(c.matchIdA);
      ids.add(c.matchIdB);
    });
    return ids;
  }, [scheduleConflicts]);

  const filteredScheduleMatches = useMemo(() => {
    return matches
      .filter((m) => (diaFiltro === "todos" ? true : m.dia === diaFiltro))
      .sort((a, b) => {
        const da = a.dia ?? "9999-99-99";
        const db = b.dia ?? "9999-99-99";
        if (da !== db) return da.localeCompare(db);
        const ha = a.hora ?? "99:99";
        const hb = b.hora ?? "99:99";
        if (ha !== hb) return ha.localeCompare(hb);
        return a.numero_partido - b.numero_partido;
      });
  }, [matches, diaFiltro]);

  const copyLink = (key: string, path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    toast.success("Enlace copiado");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const slug = clubActivo?.slug || "goodsports";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-black tracking-tight">Good Padel Master 2026</h1>
            <Badge className="bg-amber-500 text-slate-950 font-bold">3 al 6 Dic</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión integral aislada del Master anual · Lectura segura sin alterar historiales ni puntajes del club.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyLink("public", `/c/${slug}/master`)}
            className="gap-1.5"
          >
            {copiedKey === "public" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            Copiar Link Público
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <a href={`/c/${slug}/master/tv`} target="_blank" rel="noreferrer">
              <Tv className="h-3.5 w-3.5" /> Abrir Modo TV <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
          <Button size="sm" onClick={() => void handleSyncAll()} disabled={busy} className="gap-1.5 font-bold">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar Todo desde Ranking
          </Button>
        </div>
      </div>

      {/* Main Tabs: Gestión por Categoría vs Cronograma Global 6 Canchas */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="categoria" className="font-bold">
            Por Categoría (8)
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="font-bold relative">
            Cronograma 6 Canchas
            {scheduleConflicts.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">
                {scheduleConflicts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: POR CATEGORÍA */}
        <TabsContent value="categoria" className="mt-5 space-y-5">
          {/* Selector de las 8 categorías */}
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Button
                key={c.categoria_id}
                size="sm"
                variant={selectedCatId === c.categoria_id ? "default" : "outline"}
                onClick={() => setSelectedCatId(c.categoria_id)}
                className="font-bold text-xs"
              >
                {c.spec.label}
              </Button>
            ))}
          </div>

          {activeCategory && (
            <>
              {/* Control de Visibilidad Pública por Categoría */}
              <Card className="border-primary/20 bg-muted/20">
                <CardContent className="py-3 px-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {activeVisibility.publicar_clasificados ||
                      activeVisibility.publicar_parejas ||
                      activeVisibility.publicar_llaves ? (
                      <Eye className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold flex items-center gap-2">
                        Visibilidad en Link Público · {activeCategory.spec.label}
                        {!activeVisibility.publicar_clasificados &&
                          !activeVisibility.publicar_parejas &&
                          !activeVisibility.publicar_llaves ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Borrador / Oculto
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            Publicado
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Todo inicia oculto ("Próximamente"). Activá cada sección cuando esté lista.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <Switch
                        checked={activeVisibility.publicar_clasificados}
                        disabled={busy}
                        onCheckedChange={(v) => void handleToggleVisibility("publicar_clasificados", v)}
                      />
                      Publicar Clasificados
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <Switch
                        checked={activeVisibility.publicar_parejas}
                        disabled={busy}
                        onCheckedChange={(v) => void handleToggleVisibility("publicar_parejas", v)}
                      />
                      Publicar Parejas Armadas
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <Switch
                        checked={activeVisibility.publicar_llaves}
                        disabled={busy}
                        onCheckedChange={(v) => void handleToggleVisibility("publicar_llaves", v)}
                      />
                      Publicar Llaves y Cronograma
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Tabs value={catTab} onValueChange={(v) => setCatTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="clasificados" className="font-bold text-xs sm:text-sm">
                    1. Clasificados ({activeCategory.spec.cupos})
                  </TabsTrigger>
                  <TabsTrigger value="parejas" className="font-bold text-xs sm:text-sm">
                    2. Parejas ({catTeams.length}/8)
                  </TabsTrigger>
                  <TabsTrigger value="llaves" className="font-bold text-xs sm:text-sm">
                    3. Llaves ({catMatches.length}/7)
                  </TabsTrigger>
                </TabsList>

                {/* PASO 1: CLASIFICADOS Y SUPLENTES */}
                <TabsContent value="clasificados" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          {activeCategory.spec.label} · Clasificados Confirmados ({activeCategory.spec.isSuma ? "8 Titulares + 8 Invitados" : "16 Titulares"})
                        </CardTitle>
                        <CardDescription>
                          Solo se muestran los jugadores confirmados que juegan el Master. Si hubo bajas en el Ranking general, presioná "Sincronizar Todo desde Ranking" o "Resetear Clasificados".
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleSyncAll(activeCategory.categoria_id)}
                        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Resetear Clasificados
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      {catQualifiers.length === 0 ? (
                        <div className="py-12 text-center space-y-3">
                          <p className="text-sm text-muted-foreground">
                            No hay clasificados cargados todavía para {activeCategory.spec.label}.
                          </p>
                          <Button size="sm" onClick={() => void handleSyncAll(activeCategory.categoria_id)} disabled={busy}>
                            Cargar desde Ranking Anual
                          </Button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-20 text-center">Puesto</TableHead>
                                <TableHead>Jugador</TableHead>
                                <TableHead className="text-center">Torneos</TableHead>
                                <TableHead className="text-right">Puntos</TableHead>
                                <TableHead className="w-44">Estado</TableHead>
                                <TableHead className="w-24 text-center">Orden</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {catQualifiers.map((q) => {
                                const activos = catQualifiers.filter((x) => x.elegible && x.estado !== "baja");
                                const activeIdx = activos.findIndex((x) => x.id === q.id);
                                const teamSuma7 = activeCategory.spec.isSuma
                                  ? catTeams.find((tm) => tm.jugador1_id === q.jugador_id)
                                  : undefined;
                                const invitadoNombre = teamSuma7?.jugador2
                                  ? `${teamSuma7.jugador2.apellido}, ${teamSuma7.jugador2.nombre}`
                                  : teamSuma7?.jugador2_nombre_manual;

                                return (
                                  <TableRow key={q.id}>
                                    <TableCell className="text-center font-black">
                                      <Badge className="bg-primary text-primary-foreground text-xs">
                                        {q.posicion_final}°
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-semibold text-sm">
                                        {q.jugador ? `${q.jugador.apellido}, ${q.jugador.nombre}` : q.jugador_id}
                                      </div>
                                      {invitadoNombre && (
                                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                          + Invitado: {invitadoNombre}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center text-xs font-medium">
                                      {q.torneos_computados}/7
                                    </TableCell>
                                    <TableCell className="text-right font-bold tabular-nums">
                                      {q.puntos_anuales}
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={q.estado}
                                        disabled={busy}
                                        onValueChange={(val) =>
                                          void handleUpdateQualifier(q, { estado: val as MasterQualifierEstado })
                                        }
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="confirmado">Titular Confirmado</SelectItem>
                                          <SelectItem value="pendiente">Pendiente</SelectItem>
                                          <SelectItem value="baja">Baja</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {activeIdx >= 0 && (
                                        <div className="flex items-center justify-center gap-1">
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            disabled={busy || activeIdx === 0}
                                            onClick={() => void handleMoveQualifier(activeIdx, -1)}
                                          >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            disabled={busy || activeIdx === activos.length - 1}
                                            onClick={() => void handleMoveQualifier(activeIdx, 1)}
                                          >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
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

                {/* PASO 2: PAREJAS & SEEDING */}
                <TabsContent value="parejas" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                          Armado de Parejas y Siembra · {activeCategory.spec.label}
                        </CardTitle>
                        <CardDescription>
                          {activeCategory.spec.isSuma
                            ? "Cada uno de los 8 titulares invita 1 compañero validando Cat_Titular + Cat_Invitado >= 7."
                            : "Cruce automático de extremos (1°+16°, 2°+15°, ..., 8°+9°) ordenado por suma de puntos (Seed #1 a #8)."}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {catTeams.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleResetParejas()}
                            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Resetear Parejas
                          </Button>
                        )}
                        {!activeCategory.spec.isSuma && (
                          <Button size="sm" disabled={busy} onClick={() => void handleFormarParejasPuras()}>
                            Armar 8 Parejas Automáticamente
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {activeCategory.spec.isSuma && (
                        <div className="space-y-3 rounded-xl border p-4 bg-muted/20">
                          <div className="text-sm font-bold">Asignar Invitados de Suma 7 (8 Titulares)</div>
                          {Object.values(suma7Drafts)
                            .sort((a, b) => a.titular_pos - b.titular_pos)
                            .map((d) => {
                              const titular = catQualifiers.find((q) => q.jugador_id === d.titular_id);
                              const guestObj = d.invitado_jugador_id
                                ? suma7Players.find((p) => p.id === d.invitado_jugador_id)
                                : null;
                              const guestLevelNum = d.invitado_nivel
                                ? parseInt(d.invitado_nivel, 10)
                                : guestObj?.categoria_nivel ?? null;
                              const guestPtsNum = Math.max(0, parseInt(d.invitado_puntos || "0", 10) || 0);
                              const check = validarSuma7(d.titular_nivel, guestLevelNum);

                              return (
                                <div
                                  key={d.titular_id}
                                  className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-lg border bg-card p-3"
                                >
                                  <div className="md:col-span-3">
                                    <div className="text-xs font-black text-primary">Titular #{d.titular_pos}</div>
                                    <div className="text-sm font-bold truncate">
                                      {titular?.jugador
                                        ? `${titular.jugador.apellido}, ${titular.jugador.nombre}`
                                        : d.titular_id}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {d.titular_pts} pts · Cat:{" "}
                                      {d.titular_nivel ? `${d.titular_nivel}ta/ma` : "Sin asignar"}
                                    </div>
                                  </div>
                                  <div className="md:col-span-3">
                                    <Label className="text-[10px]">Jugador de Suma 7 ({suma7Players.length})</Label>
                                    <Select
                                      value={d.invitado_jugador_id || "__manual__"}
                                      onValueChange={(val) => {
                                        const pid = val === "__manual__" ? "" : val;
                                        const found = suma7Players.find((p) => p.id === pid);
                                        setSuma7Drafts((prev) => ({
                                          ...prev,
                                          [d.titular_id]: {
                                            ...prev[d.titular_id],
                                            invitado_jugador_id: pid,
                                            invitado_nivel: found?.categoria_nivel
                                              ? String(found.categoria_nivel)
                                              : prev[d.titular_id].invitado_nivel,
                                            invitado_puntos: found ? String(found.puntos_suma7) : "0",
                                          },
                                        }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Manual / Suma 7" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__manual__">Carga manual (sin registro)</SelectItem>
                                        {suma7Players.map((p) => (
                                          <SelectItem key={p.id} value={p.id}>
                                            {p.apellido}, {p.nombre} — {p.puntos_suma7} pts
                                            {p.categoria_nombre ? ` (${p.categoria_nombre})` : ""}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label className="text-[10px]">Nombre manual</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="Nombre y Apellido"
                                      disabled={Boolean(d.invitado_jugador_id)}
                                      value={d.invitado_nombre_manual}
                                      onChange={(e) =>
                                        setSuma7Drafts((prev) => ({
                                          ...prev,
                                          [d.titular_id]: {
                                            ...prev[d.titular_id],
                                            invitado_nombre_manual: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <Label className="text-[10px]">Pts Inv.</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      className="h-8 text-xs px-2"
                                      value={d.invitado_puntos}
                                      onChange={(e) =>
                                        setSuma7Drafts((prev) => ({
                                          ...prev,
                                          [d.titular_id]: {
                                            ...prev[d.titular_id],
                                            invitado_puntos: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label className="text-[10px]">Cat. Invitado</Label>
                                    <Select
                                      value={d.invitado_nivel}
                                      onValueChange={(val) =>
                                        setSuma7Drafts((prev) => ({
                                          ...prev,
                                          [d.titular_id]: {
                                            ...prev[d.titular_id],
                                            invitado_nivel: val,
                                          },
                                        }))
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Cat." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {NIVELES_CATEGORIA.map((nv) => (
                                          <SelectItem key={nv.value} value={nv.value}>
                                            {nv.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="md:col-span-1 text-right space-y-1">
                                    {check.ok ? (
                                      <Badge className="bg-emerald-600 text-white text-[10px]">
                                        Σ {check.suma} ✓
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" className="text-[10px]">
                                        {check.suma ? `Σ ${check.suma}` : "Falta"}
                                      </Badge>
                                    )}
                                    <div className="text-[10px] font-bold text-primary tabular-nums">
                                      {d.titular_pts + guestPtsNum} pts
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          <div className="flex justify-end pt-2">
                            <Button onClick={() => void handleGuardarSuma7()} disabled={busy}>
                              Guardar Parejas Suma 7 y Calcular Seeds
                            </Button>
                          </div>
                        </div>
                      )}

                      {catTeams.length > 0 && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-20 text-center">Seed</TableHead>
                                <TableHead>Pareja</TableHead>
                                <TableHead>Cruce</TableHead>
                                <TableHead className="text-right">Pts Combinados</TableHead>
                                <TableHead className="w-24 text-center">Ajustar Seed</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {catTeams.map((team, idx) => (
                                <TableRow key={team.id}>
                                  <TableCell className="text-center font-black text-primary">
                                    Seed #{team.seed}
                                  </TableCell>
                                  <TableCell className="font-bold">{formatTeamDisplayName(team)}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{team.cruce_label}</TableCell>
                                  <TableCell className="text-right font-black tabular-nums">
                                    {team.puntos_combinados}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        disabled={busy || idx === 0}
                                        onClick={() => void handleSwapSeed(idx, -1)}
                                      >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        disabled={busy || idx === catTeams.length - 1}
                                        onClick={() => void handleSwapSeed(idx, 1)}
                                      >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* PASO 3: LLAVES ELIMINATORIAS */}
                <TabsContent value="llaves" className="mt-4 space-y-4">
                  <Card>
                    <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-primary" />
                          Cuadro Eliminatorio · {activeCategory.spec.label}
                        </CardTitle>
                        <CardDescription>
                          QF1 (1v8), QF2 (4v5), QF3 (3v6), QF4 (2v7) → Semifinales → Final. Hacé clic en un partido para cargar el resultado (al mejor de 3 sets).
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {catMatches.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleResetLlaves()}
                            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Resetear Llaves
                          </Button>
                        )}
                        <Button size="sm" disabled={busy || catTeams.length < 8} onClick={() => void handleGenerarLlaves()}>
                          Generar Llaves desde Cuartos
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {catMatches.some((m) => conflictMatchIds.has(m.id)) && (
                        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>
                            Aviso: Hay partidos de esta categoría con superposición de cancha u horario (puedes guardar igual o ajustarlo abajo).
                          </span>
                        </div>
                      )}
                      <MasterBracketView
                        matches={catMatches}
                        teams={catTeams}
                        editable
                        onSelectMatch={openScoreDialog}
                        onScheduleChange={handleScheduleChange}
                        conflictMatchIds={conflictMatchIds}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </TabsContent>

        {/* TAB 2: CRONOGRAMA GLOBAL 6 CANCHAS */}
        <TabsContent value="cronograma" className="mt-5 space-y-4">
          {scheduleConflicts.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-3 px-4 space-y-1">
                <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Se detectaron {scheduleConflicts.length} superposiciones en el cronograma:
                </div>
                <ul className="list-disc pl-5 text-xs text-destructive/90 space-y-0.5">
                  {scheduleConflicts.slice(0, 6).map((c, idx) => (
                    <li key={idx}>{c.message}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={diaFiltro === "todos" ? "default" : "outline"}
              onClick={() => setDiaFiltro("todos")}
            >
              Todos los días
            </Button>
            {MASTER_DIAS.map((d) => (
              <Button
                key={d.key}
                size="sm"
                variant={diaFiltro === d.key ? "default" : "outline"}
                onClick={() => setDiaFiltro(d.key)}
              >
                {d.shortLabel}
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Asignación de Días, Horarios y 6 Canchas
              </CardTitle>
              <CardDescription>
                Jue 3/12 (7ma Damas, 5ta Cab) · Vie 4/12 (8va Damas, 8va Cab, 6ta Cab) · Sáb 5/12 (6ta Damas, 7ma Cab, Suma 7) · Dom 6/12 (8 Finales).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredScheduleMatches.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No hay partidos generados para mostrar. Generá primero las llaves de cada categoría.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Instancia</TableHead>
                        <TableHead>Enfrentamiento</TableHead>
                        <TableHead className="w-40">Día</TableHead>
                        <TableHead className="w-28">Horario</TableHead>
                        <TableHead className="w-32">Cancha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScheduleMatches.map((m) => {
                        const cat = catById.get(m.categoria_id);
                        const localTeam = m.team_local_id ? teamById.get(m.team_local_id) : undefined;
                        const visitTeam = m.team_visitante_id ? teamById.get(m.team_visitante_id) : undefined;
                        const hasConflict = scheduleConflicts.some(
                          (c) => c.matchIdA === m.id || c.matchIdB === m.id
                        );

                        return (
                          <TableRow key={m.id} className={hasConflict ? "bg-destructive/10" : ""}>
                            <TableCell className="font-bold text-xs">{cat?.spec.label ?? "-"}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline">{MASTER_RONDA_LABELS[m.ronda]}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {localTeam ? formatTeamDisplayName(localTeam) : m.ref_local || "Por definir"}
                              <span className="mx-1.5 text-muted-foreground">vs</span>
                              {visitTeam ? formatTeamDisplayName(visitTeam) : m.ref_visitante || "Por definir"}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={m.dia ?? "__none__"}
                                onValueChange={(val) =>
                                  void handleScheduleChange(m, { dia: val === "__none__" ? null : val })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Día" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sin asignar</SelectItem>
                                  {MASTER_DIAS.map((d) => (
                                    <SelectItem key={d.key} value={d.key}>
                                      {d.shortLabel}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="time"
                                className="h-8 text-xs"
                                value={m.hora ?? ""}
                                onChange={(e) =>
                                  void handleScheduleChange(m, { hora: e.target.value || null })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={m.cancha ? String(m.cancha) : "__none__"}
                                onValueChange={(val) =>
                                  void handleScheduleChange(m, {
                                    cancha: val === "__none__" ? null : parseInt(val, 10),
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Cancha" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sin asignar</SelectItem>
                                  {MASTER_CANCHAS.map((c) => (
                                    <SelectItem key={c} value={String(c)}>
                                      Cancha {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
      </Tabs>

      {/* Dialog: Cargar Resultado Mejor de 3 Sets */}
      <Dialog open={Boolean(scoreMatch)} onOpenChange={(open) => !open && setScoreMatch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cargar Resultado · Mejor de 3 Sets</DialogTitle>
            <DialogDescription>
              {scoreMatch ? `${MASTER_RONDA_LABELS[scoreMatch.ronda]} (Partido #${scoreMatch.numero_partido})` : ""}
            </DialogDescription>
          </DialogHeader>
          {scoreMatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-xs font-bold text-center text-muted-foreground">
                <div className="text-left">Pareja</div>
                <div>Local</div>
                <div>Visitante</div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center text-xs font-semibold">
                <div>Parejas</div>
                <div className="truncate text-center">
                  {scoreMatch.team_local_id
                    ? formatTeamDisplayName(teamById.get(scoreMatch.team_local_id))
                    : scoreMatch.ref_local || "Local"}
                </div>
                <div className="truncate text-center">
                  {scoreMatch.team_visitante_id
                    ? formatTeamDisplayName(teamById.get(scoreMatch.team_visitante_id))
                    : scoreMatch.ref_visitante || "Visitante"}
                </div>
              </div>
              {[
                { label: "Set 1", l: s1L, setL: setS1L, v: s1V, setV: setS1V },
                { label: "Set 2", l: s2L, setL: setS2L, v: s2V, setV: setS2V },
                { label: "Set 3 (opcional)", l: s3L, setL: setS3L, v: s3V, setV: setS3V },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-xs">{row.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={7}
                    value={row.l}
                    onChange={(e) => row.setL(e.target.value)}
                    className="h-9 text-center font-bold"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={7}
                    value={row.v}
                    onChange={(e) => row.setV(e.target.value)}
                    className="h-9 text-center font-bold"
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreMatch(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveScore()} disabled={busy}>
              Guardar y Avanzar Ganador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
