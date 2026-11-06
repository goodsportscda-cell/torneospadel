import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Search, Phone, Mail, Merge, Eye, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

import FusionarDialog from "@/components/jugadores/FusionarDialog";
import DetalleJugadorDialog from "@/components/jugadores/DetalleJugadorDialog";
import { useAuth } from "@/hooks/useAuth";

type Jugador = Database["public"]["Tables"]["jugadores"]["Row"] & { genero?: Genero | null; notas?: string | null };
type Categoria = { id: string; nombre: string; genero: Genero; orden: number; activa: boolean; club_id: string };
type Genero = Database["public"]["Enums"]["genero_categoria"];

interface LinkedAppAccount {
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

function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

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
  const [soloConCuentaApp, setSoloConCuentaApp] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fusionarOpen, setFusionarOpen] = useState(false);
  const [editing, setEditing] = useState<Jugador | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedJugador, setSelectedJugador] = useState<Jugador | null>(null);

  // Registered app accounts maps
  const [accountByJugadorId, setAccountByJugadorId] = useState<Map<string, LinkedAppAccount>>(new Map());
  const [accountByEmail, setAccountByEmail] = useState<Map<string, LinkedAppAccount>>(new Map());

  const fetchCategoriasAndAccounts = useCallback(async () => {
    setLoading(true);

    const fetchPerfilesSafe = async () => {
      const res = await (supabase as any)
        .from("perfiles")
        .select("id, email, rol, created_at, jugador_id");
      if (res.error) {
        const fallback = await supabase
          .from("perfiles")
          .select("id, email, rol, created_at");
        return fallback.data ?? [];
      }
      return res.data ?? [];
    };

    const fetchProfilesSafe = async () => {
      try {
        const res = await (supabase as any)
          .from("profiles")
          .select("user_id, email, jugador_id");
        return res.data ?? [];
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

    const byJugadorId = new Map<string, LinkedAppAccount>();
    const byEmail = new Map<string, LinkedAppAccount>();

    const profileLinkByUserId = new Map<string, { email?: string | null; jugador_id?: string | null }>();
    (profilesData as any[]).forEach((pr) => {
      if (pr?.user_id) {
        profileLinkByUserId.set(pr.user_id, pr);
      }
    });

    (perfilesData as any[]).forEach((p) => {
      const prLink = profileLinkByUserId.get(p.id);
      const email = (p.email || prLink?.email || "").trim();
      const jugadorId = p.jugador_id || prLink?.jugador_id || null;
      const item: LinkedAppAccount = {
        email,
        created_at: p.created_at ?? null,
        rol: p.rol || "jugador",
        jugador_id: jugadorId,
      };
      if (jugadorId) {
        byJugadorId.set(jugadorId, item);
      }
      const norm = normalizeEmail(email);
      if (norm) {
        byEmail.set(norm, item);
      }
    });

    // Also include any profiles row that might not be in perfilesData
    (profilesData as any[]).forEach((pr) => {
      const email = (pr.email || "").trim();
      const jugadorId = pr.jugador_id || null;
      const item: LinkedAppAccount = {
        email,
        created_at: null,
        rol: "jugador",
        jugador_id: jugadorId,
      };
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
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    fetchCategoriasAndAccounts();
  }, [fetchCategoriasAndAccounts]);

  const getLinkedAccount = useCallback(
    (j: Jugador | null): LinkedAppAccount | null => {
      if (!j) return null;
      const byId = accountByJugadorId.get(j.id);
      if (byId) return byId;
      const norm = normalizeEmail(j.email);
      if (norm && accountByEmail.has(norm)) {
        return accountByEmail.get(norm)!;
      }
      return null;
    },
    [accountByJugadorId, accountByEmail]
  );

  const handleSearch = useCallback(
    async (
      queryText: string,
      genero: string,
      categoria: string,
      letra: string,
      onlyWithAccount: boolean
    ) => {
      const q = queryText.trim();
      if (
        q.length < 3 &&
        categoria === "todas" &&
        genero === "todos" &&
        !letra &&
        !onlyWithAccount
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
        } else if (onlyWithAccount && !idsPorCategoria) {
          // Traer jugadores que tienen email cargado o vínculo directo para cruzar con cuentas activas
          dbQuery = dbQuery.not("email", "is", null);
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
          .limit(onlyWithAccount ? 500 : 100);
        if (error) {
          toast.error("Error al buscar jugadores: " + error.message);
        } else {
          let found = data ?? [];

          // Si se activó el filtro "Con cuenta en la App", también aseguramos traer cualquier jugador vinculado por jugador_id aunque no tuviera email
          if (onlyWithAccount) {
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
              return Boolean(
                accountByJugadorId.has(j.id) ||
                (j.email && accountByEmail.has(normalizeEmail(j.email)))
              );
            });
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
          setJugadores(found.map((j) => ({ ...j, categoria_id: catByPlayer.get(j.id) ?? j.categoria_id ?? null })));
        }
      } catch (err: any) {
        toast.error("Error: " + err.message);
      } finally {
        setLoadingJugadores(false);
      }
    },
    [clubId, accountByJugadorId, accountByEmail]
  );

  useEffect(() => {
    const q = search.trim();
    if (
      q.length < 3 &&
      filtroCategoriaMain === "todas" &&
      filtroGenero === "todos" &&
      !letraActiva &&
      !soloConCuentaApp
    ) {
      setJugadores([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      handleSearch(q, filtroGenero, filtroCategoriaMain, letraActiva, soloConCuentaApp);
    }, 350);
    return () => clearTimeout(delayDebounceFn);
  }, [search, filtroGenero, filtroCategoriaMain, letraActiva, soloConCuentaApp, handleSearch]);

  const refreshSearchList = () => {
    handleSearch(search, filtroGenero, filtroCategoriaMain, letraActiva, soloConCuentaApp);
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
      notas: j.notas ?? "",
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

    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      genero: form.genero || null,
      club: form.club.trim() || null,
      notas: form.notas.trim() || null,
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

    // Optimistic UI update
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
    soloConCuentaApp;

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
                : jugadores.length >= 100 && !soloConCuentaApp
                  ? "Mostrando los primeros 100 resultados."
                  : `${jugadores.length} ${jugadores.length === 1 ? "jugador encontrado" : "jugadores encontrados"
                  }${soloConCuentaApp ? " con cuenta activa en Padel ID" : ""}.`}
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
              className={`h-8 w-8 rounded-md text-xs font-semibold flex items-center justify-center transition-colors ${letraActiva === letra
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
          <Button
            type="button"
            variant={soloConCuentaApp ? "default" : "outline"}
            onClick={() => setSoloConCuentaApp((prev) => !prev)}
            className={
              soloConCuentaApp
                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                : "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
            }
          >
            <UserCheck className="h-4 w-4 mr-1.5" />
            Con cuenta en la App
          </Button>
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
            const displayEmail = j.email || linkedAccount?.email || null;
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
                  <div className="flex gap-2 pt-2 border-t mt-2">
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
