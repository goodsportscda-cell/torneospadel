import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboOption } from "@/components/Combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  Mail,
  Merge,
  Eye,
  Loader2,
  UserCheck,
  Link2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

import FusionarDialog from "@/components/jugadores/FusionarDialog";
import DetalleJugadorDialog from "@/components/jugadores/DetalleJugadorDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  extractLinkedPerfilIdFromNotas,
  extractUnlinkedPerfilIdsFromNotas,
  linkPerfilToJugador,
  normalizeEmail,
  stripPerfilTagsFromNotas,
  unlinkPerfilFromJugador,
  type RawPerfilRow,
  type RawProfileBridgeRow,
} from "@/lib/perfilJugadorLink";

type Jugador = Database["public"]["Tables"]["jugadores"]["Row"] & {
  genero?: Genero | null;
  notas?: string | null;
};
type Categoria = { id: string; nombre: string; genero: Genero; orden: number; activa: boolean; club_id: string };
type Genero = Database["public"]["Enums"]["genero_categoria"];
type FiltroCuentaApp = "todos" | "con_cuenta" | "sin_cuenta";

interface LinkedAppAccount {
  id: string;
  email: string;
  created_at: string | null;
  rol: string;
  jugador_id: string | null;
}

interface FormState {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  genero: Genero | "";
  categoria_id: string;
  club: string;
  notas: string;
}

const emptyForm: FormState = {
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  email: "",
  genero: "",
  categoria_id: "",
  club: "",
  notas: "",
};

export default function Jugadores() {
  const { clubId, isSuperAdmin } = useAuth();
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJugadores, setLoadingJugadores] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroGenero, setFiltroGenero] = useState<Genero | "todos">("todos");
  const [filtroCategoriaMain, setFiltroCategoriaMain] = useState<string>("todas");
  const [letraActiva, setLetraActiva] = useState<string>("");
  const [filtroCuentaApp, setFiltroCuentaApp] = useState<FiltroCuentaApp>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fusionarOpen, setFusionarOpen] = useState(false);
  const [editing, setEditing] = useState<Jugador | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedJugador, setSelectedJugador] = useState<Jugador | null>(null);

  // Registered app accounts state
  const [rawPerfiles, setRawPerfiles] = useState<RawPerfilRow[]>([]);
  const [accountByJugadorId, setAccountByJugadorId] = useState<Map<string, LinkedAppAccount>>(new Map());
  const [accountByEmail, setAccountByEmail] = useState<Map<string, LinkedAppAccount>>(new Map());
  const [accountById, setAccountById] = useState<Map<string, LinkedAppAccount>>(new Map());

  // Link / Unlink profile modal state for a Jugador
  const [linkingJugador, setLinkingJugador] = useState<Jugador | null>(null);
  const [selectedPerfilIdForLink, setSelectedPerfilIdForLink] = useState<string>("");
  const [savingPerfilLink, setSavingPerfilLink] = useState(false);
  const [confirmUnlinkPerfilOpen, setConfirmUnlinkPerfilOpen] = useState(false);

  const fetchCategoriasAndAccounts = useCallback(async () => {
    setLoading(true);

    const fetchPerfilesSafe = async (): Promise<RawPerfilRow[]> => {
      const res = await (supabase as any)
        .from("perfiles")
        .select("id, email, rol, club_id, created_at, jugador_id")
        .order("created_at", { ascending: false });
      if (res.error) {
        const fallback = await supabase
          .from("perfiles")
          .select("id, email, rol, club_id, created_at")
          .order("created_at", { ascending: false });
        return (fallback.data ?? []) as RawPerfilRow[];
      }
      return (res.data ?? []) as RawPerfilRow[];
    };

    const fetchProfilesSafe = async (): Promise<RawProfileBridgeRow[]> => {
      try {
        const res = await (supabase as any)
          .from("profiles")
          .select("user_id, email, jugador_id");
        return (res.data ?? []) as RawProfileBridgeRow[];
      } catch {
        return [];
      }
    };

    const [catsRes, perfilesData, profilesData] = await Promise.all([
      clubId
        ? (supabase as any)
            .from("categorias_jugadores")
            .select("*")
            .eq("club_id", clubId)
            .eq("activa", true)
            .order("orden")
        : Promise.resolve({ data: [], error: null }),
      fetchPerfilesSafe(),
      fetchProfilesSafe(),
    ]);

    if (catsRes.error) {
      toast.error("Error cargando categorías: " + catsRes.error.message);
    }
    setCategorias(catsRes.data ?? []);
    setRawPerfiles(perfilesData);

    const byJugadorId = new Map<string, LinkedAppAccount>();
    const byEmail = new Map<string, LinkedAppAccount>();
    const byId = new Map<string, LinkedAppAccount>();

    const profileLinkByUserId = new Map<string, RawProfileBridgeRow>();
    profilesData.forEach((pr) => {
      if (pr?.user_id) {
        profileLinkByUserId.set(pr.user_id, pr);
      }
    });

    perfilesData.forEach((p) => {
      const prLink = profileLinkByUserId.get(p.id);
      const email = (p.email || prLink?.email || "").trim();
      const jugadorId = p.jugador_id || prLink?.jugador_id || null;
      const item: LinkedAppAccount = {
        id: p.id,
        email,
        created_at: p.created_at ?? null,
        rol: p.rol || "jugador",
        jugador_id: jugadorId,
      };
      byId.set(p.id.toLowerCase(), item);
      if (jugadorId && !byJugadorId.has(jugadorId)) {
        byJugadorId.set(jugadorId, item);
      }
      const norm = normalizeEmail(email);
      if (norm && !byEmail.has(norm)) {
        byEmail.set(norm, item);
      }
    });

    profilesData.forEach((pr) => {
      const email = (pr.email || "").trim();
      const jugadorId = pr.jugador_id || null;
      const item: LinkedAppAccount = {
        id: pr.user_id,
        email,
        created_at: null,
        rol: "jugador",
        jugador_id: jugadorId,
      };
      if (!byId.has(pr.user_id.toLowerCase())) {
        byId.set(pr.user_id.toLowerCase(), item);
      }
      if (jugadorId && !byJugadorId.has(jugadorId)) {
        byJugadorId.set(jugadorId, item);
      }
      const norm = normalizeEmail(email);
      if (norm && !byEmail.has(norm)) {
        byEmail.set(norm, item);
      }
    });

    setAccountByJugadorId(byJugadorId);
    setAccountByEmail(byEmail);
    setAccountById(byId);
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    fetchCategoriasAndAccounts();
  }, [fetchCategoriasAndAccounts]);

  const getLinkedAccount = useCallback(
    (j: Jugador | null): LinkedAppAccount | null => {
      if (!j) return null;
      const unlinkedIds = extractUnlinkedPerfilIdsFromNotas(j.notas);
      const explicitTagId = extractLinkedPerfilIdFromNotas(j.notas);
      if (explicitTagId && accountById.has(explicitTagId)) {
        return accountById.get(explicitTagId)!;
      }

      const byId = accountByJugadorId.get(j.id);
      if (byId && !unlinkedIds.has(byId.id.toLowerCase())) {
        return byId;
      }

      const norm = normalizeEmail(j.email);
      if (norm && accountByEmail.has(norm)) {
        const candidate = accountByEmail.get(norm)!;
        if (!unlinkedIds.has(candidate.id.toLowerCase())) {
          return candidate;
        }
      }
      return null;
    },
    [accountByJugadorId, accountByEmail, accountById]
  );

  const handleSearch = useCallback(
    async (
      queryText: string,
      genero: string,
      categoria: string,
      letra: string,
      accountFilter: FiltroCuentaApp
    ) => {
      const q = queryText.trim();
      if (
        q.length < 3 &&
        categoria === "todas" &&
        genero === "todos" &&
        !letra &&
        accountFilter === "todos"
      ) {
        setJugadores([]);
        return;
      }
      setLoadingJugadores(true);
      try {
        let idsPorCategoria: string[] | null = null;
        if (categoria !== "todas") {
          const { data: asignaciones, error: asignacionesError } = await (supabase as any)
            .from("jugador_categorias_club")
            .select("jugador_id")
            .eq("club_id", clubId)
            .eq("categoria_id", categoria);
          if (asignacionesError) throw asignacionesError;
          idsPorCategoria = (asignaciones ?? []).map((a: { jugador_id: string }) => a.jugador_id);
        }

        let dbQuery = supabase.from("jugadores").select("*");
        if (q.length >= 3) {
          dbQuery = dbQuery.or(
            `nombre.ilike.%${q}%,apellido.ilike.%${q}%,dni.ilike.%${q}%,club.ilike.%${q}%,email.ilike.%${q}%`
          );
        } else if (letra) {
          dbQuery = dbQuery.ilike("apellido", `${letra}%`);
        } else if (accountFilter === "con_cuenta" && !idsPorCategoria) {
          dbQuery = dbQuery.or("email.not.is.null,notas.ilike.%[PERFIL_ID:%");
        }

        if (idsPorCategoria) {
          if (!idsPorCategoria.length) {
            setJugadores([]);
            return;
          }
          dbQuery = dbQuery.in("id", idsPorCategoria);
        } else if (genero !== "todos") {
          dbQuery = dbQuery.eq("genero", genero);
        }

        const { data, error } = await dbQuery
          .order("apellido")
          .limit(accountFilter !== "todos" ? 500 : 100);
        if (error) {
          toast.error("Error al buscar jugadores: " + error.message);
        } else {
          let found = data ?? [];

          if (accountFilter === "con_cuenta") {
            const explicitIds = Array.from(accountByJugadorId.keys());
            const missingIds = explicitIds.filter((id) => !found.some((j) => j.id === id));
            if (missingIds.length > 0 && q.length < 3 && !letra && categoria === "todas") {
              const { data: extraPlayers } = await supabase
                .from("jugadores")
                .select("*")
                .in("id", missingIds);
              if (extraPlayers?.length) {
                found = [...found, ...extraPlayers];
              }
            }

            found = found.filter((j) => {
              if (genero !== "todos" && j.genero !== genero) return false;
              return Boolean(getLinkedAccount(j));
            });
          } else if (accountFilter === "sin_cuenta") {
            found = found.filter((j) => !getLinkedAccount(j));
          }

          const ids = found.map((j) => j.id);
          const { data: asignaciones, error: asignacionesError } =
            ids.length && clubId
              ? await (supabase as any)
                  .from("jugador_categorias_club")
                  .select("jugador_id,categoria_id")
                  .eq("club_id", clubId)
                  .in("jugador_id", ids)
              : { data: [], error: null };
          if (asignacionesError) throw asignacionesError;
          const catByPlayer = new Map(
            (asignaciones ?? []).map((a: { jugador_id: string; categoria_id: string | null }) => [
              a.jugador_id,
              a.categoria_id,
            ])
          );
          setJugadores(
            found.map((j) => ({ ...j, categoria_id: catByPlayer.get(j.id) ?? j.categoria_id ?? null }))
          );
        }
      } catch (err: any) {
        toast.error("Error: " + err.message);
      } finally {
        setLoadingJugadores(false);
      }
    },
    [clubId, accountByJugadorId, getLinkedAccount]
  );

  useEffect(() => {
    const q = search.trim();
    if (
      q.length < 3 &&
      filtroCategoriaMain === "todas" &&
      filtroGenero === "todos" &&
      !letraActiva &&
      filtroCuentaApp === "todos"
    ) {
      setJugadores([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      handleSearch(q, filtroGenero, filtroCategoriaMain, letraActiva, filtroCuentaApp);
    }, 350);
    return () => clearTimeout(delayDebounceFn);
  }, [search, filtroGenero, filtroCategoriaMain, letraActiva, filtroCuentaApp, handleSearch]);

  const refreshSearchList = async () => {
    await fetchCategoriasAndAccounts();
    handleSearch(search, filtroGenero, filtroCategoriaMain, letraActiva, filtroCuentaApp);
  };

  // Options for the Profile Combobox inside the Link Profile modal
  const perfilComboOptions = useMemo<ComboOption[]>(() => {
    const currentLinked = linkingJugador ? getLinkedAccount(linkingJugador) : null;
    return rawPerfiles
      .filter((p) => {
        if (!p.email) return false;
        if (currentLinked && p.id === currentLinked.id) return true;
        // Prevent selecting a profile that is already explicitly tied to another jugador_id
        if (p.jugador_id && p.jugador_id !== linkingJugador?.id) return false;
        return true;
      })
      .map((p) => ({
        value: p.id,
        label: p.email || p.id,
        hint: `Rol: ${p.rol || "jugador"} · ID: ${p.id.slice(0, 8)}…`,
      }));
  }, [rawPerfiles, linkingJugador, getLinkedAccount]);

  const openLinkPerfilModal = (j: Jugador) => {
    const currentAcc = getLinkedAccount(j);
    setLinkingJugador(j);
    setSelectedPerfilIdForLink(currentAcc?.id || "");
    setConfirmUnlinkPerfilOpen(false);
  };

  const handleConfirmLinkPerfilToJugador = async () => {
    if (!linkingJugador || !selectedPerfilIdForLink) {
      toast.error("Seleccioná un perfil registrado por email.");
      return;
    }

    const chosenPerfil = rawPerfiles.find((p) => p.id === selectedPerfilIdForLink);
    if (!chosenPerfil) {
      toast.error("No se encontró el perfil seleccionado.");
      return;
    }

    setSavingPerfilLink(true);
    try {
      const currentAcc = getLinkedAccount(linkingJugador);
      if (currentAcc && currentAcc.id !== chosenPerfil.id) {
        await unlinkPerfilFromJugador({
          perfilId: currentAcc.id,
          perfilEmail: currentAcc.email,
          jugadorId: linkingJugador.id,
        });
      }

      const res = await linkPerfilToJugador({
        perfilId: chosenPerfil.id,
        perfilEmail: chosenPerfil.email || "",
        jugadorId: linkingJugador.id,
        previousJugadorId: chosenPerfil.jugador_id ?? null,
      });

      if (!res.ok) {
        toast.error(res.error || "No se pudo vincular el perfil.");
        return;
      }

      toast.success(
        `Ficha de ${linkingJugador.apellido}, ${linkingJugador.nombre} vinculada con la cuenta ${chosenPerfil.email}.`
      );
      setLinkingJugador(null);
      setSelectedPerfilIdForLink("");
      await refreshSearchList();
    } finally {
      setSavingPerfilLink(false);
    }
  };

  const handleConfirmUnlinkPerfilFromJugador = async () => {
    if (!linkingJugador) return;
    const currentAcc = getLinkedAccount(linkingJugador);
    if (!currentAcc) return;

    setSavingPerfilLink(true);
    try {
      const res = await unlinkPerfilFromJugador({
        perfilId: currentAcc.id,
        perfilEmail: currentAcc.email,
        jugadorId: linkingJugador.id,
      });

      if (!res.ok) {
        toast.error(res.error || "No se pudo desvincular el perfil.");
        return;
      }

      toast.success(
        `Perfil ${currentAcc.email} desvinculado. La ficha deportiva de ${linkingJugador.apellido}, ${linkingJugador.nombre} y su historial se mantienen intactos.`
      );
      setConfirmUnlinkPerfilOpen(false);
      setLinkingJugador(null);
      setSelectedPerfilIdForLink("");
      await refreshSearchList();
    } finally {
      setSavingPerfilLink(false);
    }
  };

  const openDetail = (j: Jugador) => {
    setSelectedJugador(j);
    setDetailOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (j: Jugador) => {
    setEditing(j);
    setForm({
      nombre: j.nombre,
      apellido: j.apellido,
      dni: j.dni ?? "",
      telefono: j.telefono ?? "",
      email: j.email ?? "",
      genero: j.genero ?? "",
      categoria_id: (j as any).categoria_id ?? "",
      club: j.club ?? "",
      notas: stripPerfilTagsFromNotas(j.notas),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) {
      toast.error("Nombre y apellido son obligatorios");
      return;
    }
    if (!form.dni.trim()) {
      toast.error("El DNI es obligatorio");
      return;
    }

    // Preserve any internal profile link/unlink tags stored in editing.notas
    const preservedPerfilLinkId = editing ? extractLinkedPerfilIdFromNotas(editing.notas) : null;
    const preservedUnlinkedIds = editing
      ? Array.from(extractUnlinkedPerfilIdsFromNotas(editing.notas))
      : [];

    let composedNotas = form.notas.trim();
    if (preservedPerfilLinkId) {
      composedNotas = `${composedNotas} [PERFIL_ID:${preservedPerfilLinkId}]`.trim();
    } else if (preservedUnlinkedIds.length > 0) {
      const tags = preservedUnlinkedIds.map((uid) => `[PERFIL_DESVINCULADO:${uid}]`).join(" ");
      composedNotas = `${composedNotas} ${tags}`.trim();
    }

    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      genero: form.genero || null,
      club: form.club.trim() || null,
      notas: composedNotas || null,
    };

    let savedPlayerId = editing?.id;
    if (editing) {
      const { error } = await (supabase as any).from("jugadores").update(payload).eq("id", editing.id);
      if (error) {
        if (error.message.includes("jugadores_dni_unique"))
          return toast.error("Ya existe un jugador con ese DNI");
        return toast.error("Error al guardar: " + error.message);
      }
      toast.success("Jugador actualizado");
    } else {
      const { data: created, error } = await (supabase as any)
        .from("jugadores")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        if (error.message.includes("jugadores_dni_unique"))
          return toast.error("Ya existe un jugador con ese DNI");
        return toast.error("Error al crear: " + error.message);
      }
      savedPlayerId = created.id;
      toast.success("Jugador creado");
    }
    if (savedPlayerId && clubId) {
      const { error: categoryError } = await (supabase as any)
        .from("jugador_categorias_club")
        .upsert(
          {
            jugador_id: savedPlayerId,
            club_id: clubId,
            categoria_id: form.categoria_id || null,
          },
          { onConflict: "jugador_id,club_id" }
        );
      if (categoryError)
        toast.error(
          "Los datos se guardaron, pero no se pudo guardar la categoría de este club: " +
            categoryError.message
        );
    }
    setDialogOpen(false);
    refreshSearchList();
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) return toast.error("Solo superadmin puede eliminar fichas compartidas.");
    const { error } = await supabase.from("jugadores").delete().eq("id", id);
    if (error) return toast.error("Error al eliminar: " + error.message);
    toast.success("Jugador eliminado");
    refreshSearchList();
  };

  const handleCategoriaChange = async (jugadorId: string, nuevaCategoriaId: string) => {
    if (!clubId) return toast.error("Elegí un club para cambiar su categoría deportiva.");
    const isSinCategoria = nuevaCategoriaId === "sin-categoria";
    const payload = { categoria_id: isSinCategoria ? null : nuevaCategoriaId };

    setJugadores((prev) =>
      prev.map((j) => (j.id === jugadorId ? { ...j, categoria_id: payload.categoria_id } : j))
    );

    const { error } = await (supabase as any)
      .from("jugador_categorias_club")
      .upsert({ jugador_id: jugadorId, club_id: clubId, ...payload }, { onConflict: "jugador_id,club_id" });
    if (error) {
      toast.error("Error al actualizar la categoría: " + error.message);
      refreshSearchList();
      return;
    }
    toast.success("Categoría actualizada");
  };

  const categoriasFiltradas = useMemo(() => {
    if (!form.genero) return categorias;
    return categorias.filter((c) => c.genero === form.genero);
  }, [form.genero, categorias]);

  const filtered = jugadores;
  const consultaActiva =
    search.trim().length >= 3 ||
    Boolean(letraActiva) ||
    filtroCategoriaMain !== "todas" ||
    filtroGenero !== "todos" ||
    filtroCuentaApp !== "todos";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jugadores</h1>
          <p className="text-sm text-muted-foreground">
            {!consultaActiva
              ? "Usá la búsqueda o los filtros para consultar jugadores."
              : loadingJugadores
              ? "Buscando jugadores…"
              : jugadores.length >= 100 && filtroCuentaApp === "todos"
              ? "Mostrando los primeros 100 resultados."
              : `${jugadores.length} ${
                  jugadores.length === 1 ? "jugador encontrado" : "jugadores encontrados"
                }${
                  filtroCuentaApp === "con_cuenta"
                    ? " con cuenta activa en Padel ID"
                    : filtroCuentaApp === "sin_cuenta"
                    ? " sin cuenta vinculada"
                    : ""
                }.`}
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Button variant="outline" onClick={() => setFusionarOpen(true)}>
              <Merge className="h-4 w-4" />
              Fusionar
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Nuevo jugador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar jugador" : "Nuevo jugador"}</DialogTitle>
                <DialogDescription>
                  Cargá los datos del jugador. Solo nombre y apellido son obligatorios.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="apellido">Apellido *</Label>
                    <Input
                      id="apellido"
                      value={form.apellido}
                      onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="dni">DNI *</Label>
                    <Input
                      id="dni"
                      inputMode="numeric"
                      value={form.dni}
                      onChange={(e) => setForm({ ...form, dni: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="tel">Teléfono</Label>
                    <Input
                      id="tel"
                      type="tel"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Género</Label>
                    <Select
                      value={form.genero}
                      onValueChange={(v: Genero) => setForm({ ...form, genero: v, categoria_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Elegir" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caballeros">Caballeros</SelectItem>
                        <SelectItem value="damas">Damas</SelectItem>
                        <SelectItem value="mixto">Mixto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Categoría</Label>
                    <Select
                      value={form.categoria_id}
                      onValueChange={(v) => setForm({ ...form, categoria_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Elegir" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriasFiltradas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."}{" "}
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="club">Ciudad</Label>
                  <Input
                    id="club"
                    value={form.club}
                    onChange={(e) => setForm({ ...form, club: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea
                    id="notas"
                    rows={2}
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  />
                </div>

                {editing && (
                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-semibold block">Cuenta de Usuario Padel ID</span>
                      {getLinkedAccount(editing) ? (
                        <span className="text-emerald-500">
                          Vinculada a {getLinkedAccount(editing)?.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin perfil de usuario vinculado</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setDialogOpen(false);
                        openLinkPerfilModal(editing);
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1" />
                      {getLinkedAccount(editing) ? "Cambiar / Desvincular Perfil" : "Vincular Perfil"}
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>{editing ? "Guardar cambios" : "Crear jugador"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <FusionarDialog
        open={fusionarOpen}
        onOpenChange={setFusionarOpen}
        jugadores={jugadores}
        onDone={refreshSearchList}
      />

      <div className="flex flex-col gap-3">
        {/* Barra del abecedario */}
        <div className="flex flex-wrap gap-1">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letra) => (
            <button
              key={letra}
              onClick={() => {
                if (letraActiva === letra) {
                  setLetraActiva("");
                } else {
                  setLetraActiva(letra);
                  setSearch("");
                }
              }}
              className={`h-8 w-8 rounded-md text-xs font-semibold flex items-center justify-center transition-colors ${
                letraActiva === letra
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {letra}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, DNI, email o ciudad..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value.length >= 3) {
                  setLetraActiva("");
                }
              }}
              className="pl-8"
            />
          </div>

          <Select
            value={filtroCuentaApp}
            onValueChange={(v: FiltroCuentaApp) => setFiltroCuentaApp(v)}
          >
            <SelectTrigger className="w-[185px]">
              <SelectValue placeholder="Estado de Cuenta App" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las fichas</SelectItem>
              <SelectItem value="con_cuenta">Con cuenta en la App</SelectItem>
              <SelectItem value="sin_cuenta">Sin cuenta vinculada</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filtroGenero}
            onValueChange={(v: Genero | "todos") => {
              setFiltroGenero(v);
              if (v !== "todos" && filtroCategoriaMain !== "todas") {
                const catSeleccionada = categorias.find((c) => c.id === filtroCategoriaMain);
                if (catSeleccionada && catSeleccionada.genero !== v) {
                  setFiltroCategoriaMain("todas");
                }
              }
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Género" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="caballeros">Caballeros</SelectItem>
              <SelectItem value="damas">Damas</SelectItem>
              <SelectItem value="mixto">Mixto</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCategoriaMain} onValueChange={setFiltroCategoriaMain}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {categorias
                .filter((c) => filtroGenero === "todos" || c.genero === filtroGenero)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."}{" "}
                    {c.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando categorías...</p>
      ) : loadingJugadores ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <p className="text-sm text-muted-foreground">Buscando jugadores...</p>
        </div>
      ) : !consultaActiva ? (
        <Card className="border border-dashed bg-muted/10">
          <CardContent className="py-12 text-center flex flex-col items-center justify-center text-muted-foreground">
            <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold">Consultar Jugadores</p>
            <p className="text-xs max-w-sm mt-1">
              Seleccioná una letra del abecedario, una categoría, el filtro &ldquo;Con cuenta en la App&rdquo; o ingresá al menos 3 letras en el buscador.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No se encontraron jugadores que coincidan con la búsqueda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((j) => {
            const linkedAccount = getLinkedAccount(j);
            const displayEmail = linkedAccount?.email || j.email || null;
            return (
              <Card key={j.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold truncate">
                          {j.apellido}, {j.nombre}
                        </p>
                        {linkedAccount && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4 gap-1 shrink-0"
                            title={`Usuario registrado en Padel ID: ${linkedAccount.email}`}
                          >
                            <UserCheck className="h-2.5 w-2.5" />
                            Cuenta Activa
                          </Badge>
                        )}
                      </div>
                      {j.dni && <p className="text-xs text-muted-foreground">DNI {j.dni}</p>}
                    </div>
                    <Select
                      value={j.categoria_id || "sin-categoria"}
                      onValueChange={(val) => handleCategoriaChange(j.id, val)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[110px] border-dashed shrink-0">
                        <SelectValue placeholder="Categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin-categoria" className="text-muted-foreground italic">
                          Sin categoría
                        </SelectItem>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."}{" "}
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(j.telefono || displayEmail) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {j.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{j.telefono}</span>
                        </div>
                      )}
                      {displayEmail && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{displayEmail}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {j.club && <p className="text-xs text-muted-foreground truncate">📍 {j.club}</p>}
                  <div className="flex gap-1.5 pt-2 border-t mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs font-bold"
                      onClick={() => openDetail(j)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver Detalles
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLinkPerfilModal(j)}
                      title={
                        linkedAccount
                          ? `Cuenta vinculada: ${linkedAccount.email} (clic para cambiar o desvincular)`
                          : "Vincular con perfil de usuario por email"
                      }
                      className={
                        linkedAccount
                          ? "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                          : ""
                      }
                    >
                      {linkedAccount ? (
                        <Unlink className="h-3.5 w-3.5" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(j)}
                      title="Editar jugador"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isSuperAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                            title="Eliminar jugador"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar jugador?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción eliminará a {j.apellido}, {j.nombre} y no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(j.id)}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal para Vincular / Desvincular un Perfil de Usuario por Email desde Jugadores */}
      <Dialog
        open={Boolean(linkingJugador)}
        onOpenChange={(open) => {
          if (!open && !savingPerfilLink) {
            setLinkingJugador(null);
            setSelectedPerfilIdForLink("");
            setConfirmUnlinkPerfilOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              {linkingJugador && getLinkedAccount(linkingJugador)
                ? "Cambiar o Desvincular Cuenta de Usuario"
                : "Vincular Ficha con Perfil de Usuario"}
            </DialogTitle>
            <DialogDescription>
              Jugador:{" "}
              <span className="font-semibold text-foreground">
                {linkingJugador ? `${linkingJugador.apellido}, ${linkingJugador.nombre}` : ""}
              </span>
            </DialogDescription>
          </DialogHeader>

          {linkingJugador && (
            <div className="space-y-4 py-2">
              {(() => {
                const currentAcc = getLinkedAccount(linkingJugador);
                if (!currentAcc) return null;
                return (
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-[11px] uppercase font-bold text-emerald-400">
                          Cuenta actualmente vinculada
                        </p>
                        <p className="text-sm font-semibold break-all">{currentAcc.email}</p>
                      </div>
                      {!confirmUnlinkPerfilOpen && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmUnlinkPerfilOpen(true)}
                          disabled={savingPerfilLink}
                        >
                          <Unlink className="h-3.5 w-3.5 mr-1" />
                          Desvincular
                        </Button>
                      )}
                    </div>

                    {confirmUnlinkPerfilOpen && (
                      <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                        <p className="text-xs text-amber-300">
                          ¿Confirmás desvincular la cuenta <strong>{currentAcc.email}</strong> de{" "}
                          <strong>
                            {linkingJugador.apellido}, {linkingJugador.nombre}
                          </strong>
                          ? La ficha del jugador, sus puntos, inscripciones y partidos NO se borrarán.
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setConfirmUnlinkPerfilOpen(false)}
                            disabled={savingPerfilLink}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleConfirmUnlinkPerfilFromJugador}
                            disabled={savingPerfilLink}
                          >
                            {savingPerfilLink ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Desvinculando…
                              </>
                            ) : (
                              "Confirmar Desvinculación"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label>Buscar perfil registrado por email</Label>
                <Combobox
                  options={perfilComboOptions}
                  value={selectedPerfilIdForLink}
                  onChange={setSelectedPerfilIdForLink}
                  placeholder="Seleccionar cuenta por email..."
                  searchPlaceholder="Escribí el correo electrónico del usuario..."
                  emptyText="No se encontraron perfiles disponibles."
                />
                <p className="text-[11px] text-muted-foreground">
                  Solo se muestran cuentas registradas en Padel ID que no están ocupadas por otro jugador.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkingJugador(null)}
              disabled={savingPerfilLink}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmLinkPerfilToJugador}
              disabled={
                savingPerfilLink ||
                !selectedPerfilIdForLink ||
                selectedPerfilIdForLink === (linkingJugador ? getLinkedAccount(linkingJugador)?.id : "")
              }
            >
              {savingPerfilLink ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Guardando…
                </>
              ) : linkingJugador && getLinkedAccount(linkingJugador) ? (
                "Guardar Cambio de Cuenta"
              ) : (
                "Vincular Cuenta"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedJugador && (
        <DetalleJugadorDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          jugador={selectedJugador}
          categorias={categorias}
          clubId={clubId}
          cuentaApp={getLinkedAccount(selectedJugador)}
        />
      )}
    </div>
  );
}
