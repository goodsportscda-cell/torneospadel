import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboOption } from "@/components/Combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Trophy,
  Users,
  Search,
  Plus,
  Shield,
  LogOut,
  History,
  Trash2,
  UserCheck,
  UserX,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Link2,
  Unlink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
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
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  linkPerfilToJugador,
  unlinkPerfilFromJugador,
  resolvePerfilesJugadorLinks,
} from "@/lib/perfilJugadorLink";

type Club = {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string;
};

type UserProfile = {
  id: string;
  email: string;
  rol: string;
  club_id: string | null;
  nombre: string;
  apellido: string;
};

type LinkedJugadorInfo = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  email: string | null;
  club: string | null;
  genero: string | null;
  categoriaLabel: string | null;
  clubesParticipacion: string[];
};

type DirectoryProfileItem = {
  id: string;
  email: string;
  rol: string;
  club_id: string | null;
  created_at: string | null;
  jugador: LinkedJugadorInfo | null;
};

type DirectoryFilter = "todos" | "administradores" | "con_ficha" | "sin_ficha";

type RoleAudit = {
  id: string;
  email_actor: string;
  email_objetivo: string;
  rol_anterior: string;
  rol_nuevo: string;
  club_anterior_id: string | null;
  club_nuevo_id: string | null;
  cambiado_en: string;
};

function formatDateDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function SuperAdminDashboard() {
  const { signOut, setImpersonatedClubId } = useAuth();
  const [stats, setStats] = useState<{ clubes: number | null; torneos: number | null; perfiles: number | null }>({
    clubes: null,
    torneos: null,
    perfiles: null,
  });
  const [clubes, setClubes] = useState<Club[]>([]);
  const [allJugadores, setAllJugadores] = useState<LinkedJugadorInfo[]>([]);
  const [perfilesDirectory, setPerfilesDirectory] = useState<DirectoryProfileItem[]>([]);
  const [roleAudit, setRoleAudit] = useState<RoleAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningRole, setAssigningRole] = useState(false);
  const [clubToDelete, setClubToDelete] = useState<Club | null>(null);
  const [isDeletingClub, setIsDeletingClub] = useState(false);

  // Directory UI state
  const [directoryExpanded, setDirectoryExpanded] = useState(true);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>("todos");
  const directorySectionRef = useRef<HTMLDivElement | null>(null);
  const assignRoleCardRef = useRef<HTMLDivElement | null>(null);

  // Link / Unlink modal state
  const [linkingProfile, setLinkingProfile] = useState<DirectoryProfileItem | null>(null);
  const [selectedJugadorIdForLink, setSelectedJugadorIdForLink] = useState<string>("");
  const [savingLink, setSavingLink] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);

  // New club form
  const [newClub, setNewClub] = useState({ nombre: "", slug: "", logo_url: "" });
  const [isNewClubOpen, setIsNewClubOpen] = useState(false);

  // Assign admin form
  const [searchEmail, setSearchEmail] = useState("");
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
  const [selectedClubId, setSelectedClubId] = useState("");

  const loadData = async () => {
    setLoading(true);

    const fetchPerfilesRows = async () => {
      const res = await (supabase as any)
        .from("perfiles")
        .select("id, email, rol, club_id, created_at, jugador_id")
        .order("created_at", { ascending: false });
      if (res.error) {
        const fallback = await supabase
          .from("perfiles")
          .select("id, email, rol, club_id, created_at")
          .order("created_at", { ascending: false });
        return fallback;
      }
      return res;
    };

    const fetchProfilesLinks = async () => {
      try {
        const res = await (supabase as any)
          .from("profiles")
          .select("user_id, email, display_name, jugador_id");
        return res.data ?? [];
      } catch {
        return [];
      }
    };

    const [
      { count: clubesCount, error: clubesError },
      { count: torneosCount, error: torneosError },
      perfilesRes,
      profilesLinks,
      { data: auditData },
      { data: clubesData },
      { data: jugadoresData },
      { data: asignacionesClubData },
      { data: categoriasJugadoresData },
    ] = await Promise.all([
      supabase.from("clubes").select("*", { count: "exact", head: true }),
      supabase.from("torneos").select("*", { count: "exact", head: true }),
      fetchPerfilesRows(),
      fetchProfilesLinks(),
      (supabase as any)
        .from("auditoria_roles_perfiles")
        .select("id, email_actor, email_objetivo, rol_anterior, rol_nuevo, club_anterior_id, club_nuevo_id, cambiado_en")
        .order("cambiado_en", { ascending: false })
        .limit(10),
      supabase.from("clubes").select("*").order("created_at", { ascending: false }),
      supabase
        .from("jugadores")
        .select("id, nombre, apellido, dni, email, club, genero, categoria_id, notas")
        .order("apellido")
        .limit(5000),
      (supabase as any)
        .from("jugador_categorias_club")
        .select("jugador_id, club_id, categoria_id")
        .limit(10000),
      (supabase as any)
        .from("categorias_jugadores")
        .select("id, nombre, genero, club_id")
        .limit(1000),
    ]);

    const rawPerfiles = (perfilesRes?.data ?? []) as any[];
    const rawJugadores = (jugadoresData ?? []) as any[];
    const clubesList = (clubesData ?? []) as Club[];
    const clubNameById = new Map<string, string>(clubesList.map((c) => [c.id, c.nombre]));

    const catById = new Map<string, { nombre: string; genero: string; club_id: string }>();
    ((categoriasJugadoresData ?? []) as any[]).forEach((c) => {
      catById.set(c.id, { nombre: c.nombre, genero: c.genero, club_id: c.club_id });
    });

    const playerClubsMap = new Map<string, string[]>();
    const playerCatLabelMap = new Map<string, string>();
    ((asignacionesClubData ?? []) as any[]).forEach((asig) => {
      const jId = asig.jugador_id;
      const cName = clubNameById.get(asig.club_id);
      if (jId && cName) {
        const prev = playerClubsMap.get(jId) ?? [];
        if (!prev.includes(cName)) {
          prev.push(cName);
          playerClubsMap.set(jId, prev);
        }
      }
      if (jId && asig.categoria_id && !playerCatLabelMap.has(jId)) {
        const cat = catById.get(asig.categoria_id);
        if (cat) {
          const genPrefix =
            cat.genero === "caballeros" ? "Cab." : cat.genero === "damas" ? "Dam." : "Mix.";
          playerCatLabelMap.set(jId, `${genPrefix} ${cat.nombre}`);
        }
      }
    });

    const jugadorById = new Map<string, LinkedJugadorInfo>();
    const jugadoresList: LinkedJugadorInfo[] = [];

    rawJugadores.forEach((j) => {
      let catLabel = playerCatLabelMap.get(j.id) ?? null;
      if (!catLabel && j.categoria_id) {
        const cat = catById.get(j.categoria_id);
        if (cat) {
          const genPrefix =
            cat.genero === "caballeros" ? "Cab." : cat.genero === "damas" ? "Dam." : "Mix.";
          catLabel = `${genPrefix} ${cat.nombre}`;
        }
      }

      const info: LinkedJugadorInfo = {
        id: j.id,
        nombre: j.nombre,
        apellido: j.apellido,
        dni: j.dni ?? null,
        email: j.email ?? null,
        club: j.club ?? null,
        genero: j.genero ?? null,
        categoriaLabel: catLabel,
        clubesParticipacion: playerClubsMap.get(j.id) ?? [],
      };

      jugadorById.set(j.id, info);
      jugadoresList.push(info);
    });

    setAllJugadores(jugadoresList);

    const { jugadorIdByPerfilId } = resolvePerfilesJugadorLinks({
      perfiles: rawPerfiles,
      profilesBridge: profilesLinks as any[],
      jugadores: rawJugadores,
    });

    const profileLinkByUserId = new Map<string, { email?: string | null }>();
    (profilesLinks as any[]).forEach((pr) => {
      if (pr?.user_id) {
        profileLinkByUserId.set(pr.user_id, pr);
      }
    });

    const enrichedPerfiles: DirectoryProfileItem[] = rawPerfiles.map((p) => {
      const prLink = profileLinkByUserId.get(p.id);
      const effectiveEmail = p.email || prLink?.email || "";
      const linkedJugadorId = jugadorIdByPerfilId.get(p.id) || null;
      const linkedJugador = linkedJugadorId ? jugadorById.get(linkedJugadorId) ?? null : null;

      return {
        id: p.id,
        email: effectiveEmail,
        rol: p.rol || "jugador",
        club_id: p.club_id ?? null,
        created_at: p.created_at ?? null,
        jugador: linkedJugador,
      };
    });

    setPerfilesDirectory(enrichedPerfiles);
    setStats({
      clubes: clubesError ? null : clubesCount ?? 0,
      torneos: torneosError ? null : torneosCount ?? 0,
      perfiles: perfilesRes.error ? null : rawPerfiles.length,
    });

    if (clubesData) {
      setClubes(clubesData);
    }
    setRoleAudit(auditData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const directoryCounts = useMemo(() => {
    const total = perfilesDirectory.length;
    const administradores = perfilesDirectory.filter(
      (p) => p.rol === "super_admin" || p.rol === "club_admin" || p.rol === "operador"
    ).length;
    const conFicha = perfilesDirectory.filter((p) => Boolean(p.jugador)).length;
    const sinFicha = total - conFicha;
    return { total, administradores, conFicha, sinFicha };
  }, [perfilesDirectory]);

  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    return perfilesDirectory.filter((item) => {
      if (directoryFilter === "administradores") {
        if (item.rol !== "super_admin" && item.rol !== "club_admin" && item.rol !== "operador") {
          return false;
        }
      } else if (directoryFilter === "con_ficha") {
        if (!item.jugador) return false;
      } else if (directoryFilter === "sin_ficha") {
        if (item.jugador) return false;
      }

      if (!q) return true;

      const emailMatch = (item.email || "").toLowerCase().includes(q);
      const idMatch = item.id.toLowerCase().includes(q);
      const nombreMatch = item.jugador
        ? `${item.jugador.nombre} ${item.jugador.apellido} ${item.jugador.apellido} ${item.jugador.nombre}`
            .toLowerCase()
            .includes(q)
        : false;
      const dniMatch = item.jugador?.dni ? item.jugador.dni.toLowerCase().includes(q) : false;

      return emailMatch || idMatch || nombreMatch || dniMatch;
    });
  }, [perfilesDirectory, directorySearch, directoryFilter]);

  // Options for the Jugador Combobox inside the Link Modal
  const jugadorComboOptions = useMemo<ComboOption[]>(() => {
    const occupiedJugadorMap = new Map<string, string>();
    perfilesDirectory.forEach((p) => {
      if (p.jugador && p.id !== linkingProfile?.id) {
        occupiedJugadorMap.set(p.jugador.id, p.email || p.id.slice(0, 8));
      }
    });

    return allJugadores
      .filter((j) => !occupiedJugadorMap.has(j.id))
      .map((j) => {
        const parts: string[] = [];
        if (j.dni) parts.push(`DNI ${j.dni}`);
        if (j.categoriaLabel) parts.push(j.categoriaLabel);
        if (j.club) parts.push(j.club);
        return {
          value: j.id,
          label: `${j.apellido}, ${j.nombre}`,
          hint: parts.length > 0 ? parts.join(" · ") : "Sin localidad / DNI",
        };
      });
  }, [allJugadores, perfilesDirectory, linkingProfile]);

  const handleOpenLinkModal = (item: DirectoryProfileItem) => {
    setLinkingProfile(item);
    setSelectedJugadorIdForLink(item.jugador?.id || "");
    setConfirmUnlinkOpen(false);
  };

  const handleConfirmLinkJugador = async () => {
    if (!linkingProfile || !selectedJugadorIdForLink) {
      toast.error("Seleccioná un jugador de la lista para vincular.");
      return;
    }

    setSavingLink(true);
    try {
      const res = await linkPerfilToJugador({
        perfilId: linkingProfile.id,
        perfilEmail: linkingProfile.email,
        jugadorId: selectedJugadorIdForLink,
        previousJugadorId: linkingProfile.jugador?.id ?? null,
      });

      if (!res.ok) {
        toast.error(res.error || "No se pudo vincular el jugador.");
        return;
      }

      const targetJug = allJugadores.find((j) => j.id === selectedJugadorIdForLink);
      toast.success(
        `Perfil ${linkingProfile.email} vinculado a ${targetJug ? `${targetJug.apellido}, ${targetJug.nombre}` : "la ficha seleccionada"}.`
      );
      setLinkingProfile(null);
      setSelectedJugadorIdForLink("");
      await loadData();
    } finally {
      setSavingLink(false);
    }
  };

  const handleConfirmUnlinkJugador = async () => {
    if (!linkingProfile || !linkingProfile.jugador) return;
    setSavingLink(true);
    try {
      const res = await unlinkPerfilFromJugador({
        perfilId: linkingProfile.id,
        perfilEmail: linkingProfile.email,
        jugadorId: linkingProfile.jugador.id,
      });

      if (!res.ok) {
        toast.error(res.error || "No se pudo desvincular el perfil.");
        return;
      }

      toast.success(
        `Se desvinculó la cuenta ${linkingProfile.email}. La ficha deportiva de ${linkingProfile.jugador.apellido}, ${linkingProfile.jugador.nombre} y todo su historial permanecen intactos.`
      );
      setConfirmUnlinkOpen(false);
      setLinkingProfile(null);
      setSelectedJugadorIdForLink("");
      await loadData();
    } finally {
      setSavingLink(false);
    }
  };

  const handleSelectProfileForRoleAssignment = (item: DirectoryProfileItem) => {
    setSearchEmail(item.email || "");
    setSearchedUser({
      id: item.id,
      email: item.email || "Sin correo visible",
      rol: item.rol,
      club_id: item.club_id,
      nombre: item.jugador?.nombre ?? "",
      apellido: item.jugador?.apellido ?? "",
    });
    setSelectedClubId(item.club_id || "");
    toast.info(`Usuario ${item.email || item.id.slice(0, 8)} cargado en el asignador de roles`);
    assignRoleCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const renderRoleBadge = (rol: string) => {
    if (rol === "super_admin") {
      return (
        <Badge
          variant="outline"
          className="bg-violet-500/15 text-violet-400 border-violet-500/30 font-semibold"
        >
          Super Admin
        </Badge>
      );
    }
    if (rol === "club_admin") {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold"
        >
          Club Admin
        </Badge>
      );
    }
    if (rol === "operador") {
      return (
        <Badge
          variant="outline"
          className="bg-sky-500/15 text-sky-400 border-sky-500/30 font-semibold"
        >
          Operador
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-slate-500/15 text-slate-300 border-slate-500/30 font-medium"
      >
        Jugador
      </Badge>
    );
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClub.nombre || !newClub.slug) {
      toast.error("El nombre y el slug son obligatorios");
      return;
    }

    const { error } = await supabase.from("clubes").insert([newClub]);
    if (error) {
      toast.error(`Error al crear el club: ${error.message}`);
    } else {
      toast.success("Club creado exitosamente");
      setIsNewClubOpen(false);
      setNewClub({ nombre: "", slug: "", logo_url: "" });
      loadData();
    }
  };

  const handleDeleteClub = async () => {
    if (!clubToDelete) return;
    setIsDeletingClub(true);
    try {
      const [tournamentsResult, categoriesResult] = await Promise.all([
        supabase.from("torneos").select("id", { count: "exact", head: true }).eq("club_id", clubToDelete.id),
        supabase.from("categorias").select("id", { count: "exact", head: true }).eq("club_id", clubToDelete.id),
      ]);
      if (tournamentsResult.error) throw tournamentsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      const linkedItems = [
        (tournamentsResult.count ?? 0) > 0 && `${tournamentsResult.count} torneo(s)`,
        (categoriesResult.count ?? 0) > 0 && `${categoriesResult.count} categoría(s)`,
      ].filter(Boolean);
      if (linkedItems.length) {
        toast.error(`No se puede eliminar ${clubToDelete.nombre}: todavía tiene ${linkedItems.join(" y ")}.`);
        return;
      }

      const { data, error } = await supabase
        .from("clubes")
        .delete()
        .eq("id", clubToDelete.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("No se eliminó el club. Aplicá primero la migración de permisos para eliminar clubes.");
        return;
      }

      toast.success(`Se eliminó el club ${clubToDelete.nombre}.`);
      setClubToDelete(null);
      await loadData();
    } catch (error: any) {
      console.error("No se pudo eliminar el club:", error);
      toast.error(`No se pudo eliminar el club: ${error?.message || "Error de conexión"}`);
    } finally {
      setIsDeletingClub(false);
    }
  };

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail) return;

    const { data, error } = await supabase
      .from("perfiles")
      .select("id, email, rol, club_id")
      .ilike("email", searchEmail.trim())
      .maybeSingle();

    if (error) {
      toast.error("Error al buscar el usuario");
      return;
    }

    if (!data) {
      toast.error("No se encontró ningún usuario con ese email");
      setSearchedUser(null);
      return;
    }

    const dirMatch = perfilesDirectory.find((p) => p.id === data.id);
    setSearchedUser({
      id: data.id,
      email: data.email || searchEmail,
      rol: data.rol,
      club_id: data.club_id,
      nombre: dirMatch?.jugador?.nombre ?? "",
      apellido: dirMatch?.jugador?.apellido ?? "",
    });
    setSelectedClubId(data.club_id || "");
  };

  const handleAssignAdmin = async () => {
    if (!searchedUser || !selectedClubId) {
      toast.error("Debes seleccionar un club");
      return;
    }

    setAssigningRole(true);
    const { data, error } = await (supabase as any).rpc("assign_club_admin", {
      p_perfil_id: searchedUser.id,
      p_club_id: selectedClubId,
    });
    setAssigningRole(false);
    if (error) return toast.error(`No se pudo asignar el rol: ${error.message}`);
    if (!data?.ok) return toast.error(data?.error ?? "No se pudo asignar el rol.");
    toast.success(
      data.ya_asignado
        ? "Ese usuario ya es administrador de ese club."
        : "Administrador asignado. El cambio quedó registrado."
    );
    setSearchedUser({ ...searchedUser, rol: "club_admin", club_id: selectedClubId });
    await loadData();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PadelIdLogo size={32} showText={false} />
            <span className="font-bold text-lg text-primary">Administración de plataforma</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Panel Global</h1>
            <p className="text-muted-foreground">Gestioná los clubes, las cuentas y sus permisos.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando datos globales...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clubes registrados</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.clubes ?? "—"}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.clubes === null ? "No se pudo consultar este total." : "Registros de clubes en Padel ID."}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Torneos cargados</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.torneos ?? "—"}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.torneos === null
                      ? "No se pudo consultar este total."
                      : "Registros de torneos; incluye todas las fechas y estados."}
                  </p>
                </CardContent>
              </Card>
              <Card
                role="button"
                tabIndex={0}
                onClick={() => {
                  setDirectoryExpanded(true);
                  directorySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDirectoryExpanded((prev) => !prev);
                  }
                }}
                className="cursor-pointer transition-all hover:border-primary/60 hover:bg-muted/20 hover:shadow-md group"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">
                    Perfiles registrados
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-2xl font-bold">{stats.perfiles ?? "—"}</div>
                    <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Ver listado completo <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.perfiles === null
                      ? "No se pudo consultar este total."
                      : `${directoryCounts.conFicha} vinculados a ficha · ${directoryCounts.sinFicha} sin ficha vinculada.`}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Directorio de Perfiles Registrados */}
            <Card ref={directorySectionRef} className="border-border/80">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Directorio de Perfiles Registrados
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {perfilesDirectory.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Vinculá o desvinculá cuentas de usuario con su ficha deportiva en jugadores y administrá sus roles.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDirectoryExpanded((prev) => !prev)}
                    className="self-start sm:self-auto"
                  >
                    {directoryExpanded ? (
                      <>
                        Ocultar directorio <ChevronUp className="h-4 w-4 ml-1.5" />
                      </>
                    ) : (
                      <>
                        Mostrar directorio <ChevronDown className="h-4 w-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </div>

                {directoryExpanded && (
                  <div className="pt-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por email, nombre, apellido o DNI..."
                        value={directorySearch}
                        onChange={(e) => setDirectorySearch(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={directoryFilter === "todos" ? "default" : "outline"}
                        onClick={() => setDirectoryFilter("todos")}
                        className="h-8 text-xs"
                      >
                        Todos ({directoryCounts.total})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={directoryFilter === "administradores" ? "default" : "outline"}
                        onClick={() => setDirectoryFilter("administradores")}
                        className="h-8 text-xs"
                      >
                        Administradores ({directoryCounts.administradores})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={directoryFilter === "con_ficha" ? "default" : "outline"}
                        onClick={() => setDirectoryFilter("con_ficha")}
                        className="h-8 text-xs"
                      >
                        Vinculados a Jugador ({directoryCounts.conFicha})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={directoryFilter === "sin_ficha" ? "default" : "outline"}
                        onClick={() => setDirectoryFilter("sin_ficha")}
                        className="h-8 text-xs"
                      >
                        Sin ficha vinculada ({directoryCounts.sinFicha})
                      </Button>
                    </div>
                  </div>
                )}
              </CardHeader>

              {directoryExpanded && (
                <CardContent>
                  <div className="rounded-md border overflow-x-auto max-h-[560px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/40 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>Usuario / Email</TableHead>
                          <TableHead>Jugador Vinculado</TableHead>
                          <TableHead>Rol Actual</TableHead>
                          <TableHead>Club Asignado</TableHead>
                          <TableHead>Fecha de Alta</TableHead>
                          <TableHead className="text-right">Acciones Rápidas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDirectory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No se encontraron perfiles que coincidan con el filtro seleccionado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDirectory.map((item) => {
                            const assignedClubName =
                              item.rol === "super_admin"
                                ? "Global"
                                : item.club_id
                                ? clubes.find((c) => c.id === item.club_id)?.nombre || item.club_id
                                : null;
                            const participationClubs = item.jugador?.clubesParticipacion ?? [];

                            return (
                              <TableRow key={item.id} className="hover:bg-muted/30">
                                {/* 1. Usuario / Email */}
                                <TableCell className="align-middle">
                                  <div className="font-medium text-sm break-all">
                                    {item.email || (
                                      <span className="text-muted-foreground italic">Sin email registrado</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono text-muted-foreground" title={item.id}>
                                    ID: {item.id.slice(0, 8)}…
                                  </div>
                                </TableCell>

                                {/* 2. Jugador Vinculado */}
                                <TableCell className="align-middle">
                                  {item.jugador ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <UserCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                        <span className="font-semibold text-sm">
                                          {item.jugador.apellido}, {item.jugador.nombre}
                                        </span>
                                        {item.jugador.categoriaLabel && (
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                            {item.jugador.categoriaLabel}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                        {item.jugador.dni && <span>DNI {item.jugador.dni}</span>}
                                        {item.jugador.club && (
                                          <span className="inline-flex items-center gap-0.5">
                                            <MapPin className="h-3 w-3" /> {item.jugador.club}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-500/15 text-amber-400 border-amber-500/30 font-medium gap-1"
                                    >
                                      <UserX className="h-3 w-3" />
                                      Sin ficha vinculada
                                    </Badge>
                                  )}
                                </TableCell>

                                {/* 3. Rol Actual */}
                                <TableCell className="align-middle">{renderRoleBadge(item.rol)}</TableCell>

                                {/* 4. Club Asignado */}
                                <TableCell className="align-middle text-sm">
                                  {assignedClubName ? (
                                    <span className="font-medium text-foreground">{assignedClubName}</span>
                                  ) : participationClubs.length > 0 ? (
                                    <span className="text-xs text-muted-foreground">
                                      {participationClubs.join(", ")}
                                    </span>
                                  ) : item.jugador?.club ? (
                                    <span className="text-xs text-muted-foreground">{item.jugador.club}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>

                                {/* 5. Fecha de Alta */}
                                <TableCell className="align-middle text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDateDDMMYYYY(item.created_at)}
                                </TableCell>

                                {/* 6. Acciones Rápidas (Vinculación y Roles) */}
                                <TableCell className="align-middle text-right">
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    {item.jugador ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                                        onClick={() => handleOpenLinkModal(item)}
                                      >
                                        <Unlink className="h-3 w-3 mr-1" />
                                        Cambiar / Desvincular
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                        onClick={() => handleOpenLinkModal(item)}
                                      >
                                        <Link2 className="h-3 w-3 mr-1" />
                                        Vincular Jugador
                                      </Button>
                                    )}

                                    {item.rol !== "super_admin" && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => handleSelectProfileForRoleAssignment(item)}
                                      >
                                        <Shield className="h-3 w-3 mr-1" />
                                        Asignar Rol
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Modal para Vincular / Cambiar / Desvincular Jugador */}
            <Dialog
              open={Boolean(linkingProfile)}
              onOpenChange={(open) => {
                if (!open && !savingLink) {
                  setLinkingProfile(null);
                  setSelectedJugadorIdForLink("");
                  setConfirmUnlinkOpen(false);
                }
              }}
            >
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-primary" />
                    {linkingProfile?.jugador
                      ? "Cambiar o Desvincular Ficha Deportiva"
                      : "Vincular Perfil con Ficha de Jugador"}
                  </DialogTitle>
                  <DialogDescription>
                    Asociá la cuenta de acceso{" "}
                    <span className="font-semibold text-foreground">{linkingProfile?.email}</span> con su ficha en la base de jugadores.
                  </DialogDescription>
                </DialogHeader>

                {linkingProfile && (
                  <div className="space-y-4 py-2">
                    {linkingProfile.jugador && (
                      <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-[11px] uppercase font-bold text-emerald-400">
                              Ficha actualmente vinculada
                            </p>
                            <p className="text-sm font-semibold">
                              {linkingProfile.jugador.apellido}, {linkingProfile.jugador.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {linkingProfile.jugador.dni ? `DNI ${linkingProfile.jugador.dni}` : "Sin DNI"}
                              {linkingProfile.jugador.categoriaLabel
                                ? ` · ${linkingProfile.jugador.categoriaLabel}`
                                : ""}
                              {linkingProfile.jugador.club ? ` · ${linkingProfile.jugador.club}` : ""}
                            </p>
                          </div>
                          {!confirmUnlinkOpen && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-destructive/50 text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmUnlinkOpen(true)}
                              disabled={savingLink}
                            >
                              <Unlink className="h-3.5 w-3.5 mr-1" />
                              Desvincular
                            </Button>
                          )}
                        </div>

                        {confirmUnlinkOpen && (
                          <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                            <p className="text-xs text-amber-300">
                              ¿Confirmás desvincular la cuenta <strong>{linkingProfile.email}</strong> de{" "}
                              <strong>
                                {linkingProfile.jugador.apellido}, {linkingProfile.jugador.nombre}
                              </strong>
                              ? La ficha del jugador, sus puntos, inscripciones y partidos NO se borrarán.
                            </p>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setConfirmUnlinkOpen(false)}
                                disabled={savingLink}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleConfirmUnlinkJugador}
                                disabled={savingLink}
                              >
                                {savingLink ? (
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
                    )}

                    <div className="space-y-2">
                      <Label>
                        {linkingProfile.jugador
                          ? "Reasignar a otra ficha de jugador"
                          : "Buscar ficha de jugador (por apellido, nombre, DNI o localidad)"}
                      </Label>
                      <Combobox
                        options={jugadorComboOptions}
                        value={selectedJugadorIdForLink}
                        onChange={setSelectedJugadorIdForLink}
                        placeholder="Seleccionar jugador..."
                        searchPlaceholder="Escribí nombre, apellido, DNI o ciudad..."
                        emptyText="No se encontraron jugadores disponibles."
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Solo se listan fichas que no están ocupadas por otra cuenta registrada.
                      </p>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLinkingProfile(null)}
                    disabled={savingLink}
                  >
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmLinkJugador}
                    disabled={
                      savingLink ||
                      !selectedJugadorIdForLink ||
                      selectedJugadorIdForLink === linkingProfile?.jugador?.id
                    }
                  >
                    {savingLink ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Guardando…
                      </>
                    ) : linkingProfile?.jugador ? (
                      "Guardar Cambio de Ficha"
                    ) : (
                      "Vincular Jugador"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Lista de Clubes */}
              <Card className="md:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-xl">Directorio de Clubes</CardTitle>
                    <CardDescription>Clubes que actualmente usan el sistema.</CardDescription>
                  </div>

                  <Dialog open={isNewClubOpen} onOpenChange={setIsNewClubOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Nuevo Club
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Registrar un nuevo club</DialogTitle>
                        <DialogDescription>
                          El club podrá empezar a publicar y gestionar sus torneos en Padel ID.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateClub} className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label htmlFor="nombre">Nombre Oficial del Complejo</Label>
                          <Input
                            id="nombre"
                            placeholder="Ej: El Galpón Padel"
                            value={newClub.nombre}
                            onChange={(e) => setNewClub({ ...newClub, nombre: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="slug">Dirección corta del club</Label>
                          <Input
                            id="slug"
                            placeholder="Ej: el-galpon"
                            value={newClub.slug}
                            onChange={(e) =>
                              setNewClub({
                                ...newClub,
                                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                              })
                            }
                          />
                          <p className="text-[10px] text-muted-foreground">
                            La página pública quedará como: /c/{newClub.slug || "nombre-del-club"}/
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="logo">URL del Logo (Opcional)</Label>
                          <Input
                            id="logo"
                            placeholder="/logo.png o https://..."
                            value={newClub.logo_url}
                            onChange={(e) => setNewClub({ ...newClub, logo_url: e.target.value })}
                          />
                        </div>
                        <Button type="submit" className="w-full">
                          Registrar Club
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {clubes.map((c) => (
                      <div key={c.id} className="flex items-center gap-4 border p-3 rounded-lg">
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.nombre} className="max-h-full max-w-full object-contain" />
                          ) : (
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{c.nombre}</h4>
                          <p className="text-xs text-muted-foreground truncate">/c/{c.slug}/</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setImpersonatedClubId(c.id);
                              window.location.href = "/panel";
                            }}
                          >
                            Administrar Club
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Eliminar club ${c.nombre}`}
                            title="Eliminar club vacío"
                            onClick={() => setClubToDelete(c)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Asignador de Roles */}
              <Card ref={assignRoleCardRef} className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" /> Asignar Rol de Administrador
                  </CardTitle>
                  <CardDescription>
                    Busca a un jugador registrado por email o selecciónalo desde el Directorio de Perfiles para asignarle un complejo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSearchUser} className="flex gap-2">
                    <Input
                      placeholder="Correo electrónico del usuario..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      type="email"
                      required
                    />
                    <Button type="submit" variant="secondary">
                      <Search className="h-4 w-4" />
                    </Button>
                  </form>

                  {searchedUser && (
                    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                      <div className="flex flex-col gap-1">
                        <h4 className="font-semibold">Usuario seleccionado</h4>
                        <p className="text-sm">
                          <strong>ID:</strong> <span className="text-xs text-muted-foreground">{searchedUser.id}</span>
                        </p>
                        <p className="text-sm">
                          <strong>Email:</strong> {searchedUser.email}
                        </p>
                        {(searchedUser.nombre || searchedUser.apellido) && (
                          <p className="text-sm">
                            <strong>Jugador vinculado:</strong> {searchedUser.apellido}, {searchedUser.nombre}
                          </p>
                        )}
                        <p className="text-sm">
                          <strong>Rol actual:</strong>{" "}
                          <span className="uppercase text-xs font-bold tracking-wider">{searchedUser.rol}</span>
                        </p>
                        {searchedUser.club_id && (
                          <p className="text-sm">
                            <strong>Club actual:</strong>{" "}
                            {clubes.find((c) => c.id === searchedUser.club_id)?.nombre || searchedUser.club_id}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t">
                        <Label>Seleccionar Club a Asignar</Label>
                        <select
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={selectedClubId}
                          onChange={(e) => setSelectedClubId(e.target.value)}
                        >
                          <option value="">Selecciona un club...</option>
                          {clubes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                        <Button
                          className="w-full mt-2"
                          onClick={handleAssignAdmin}
                          disabled={!selectedClubId || assigningRole}
                        >
                          {assigningRole ? "Guardando asignación…" : "Hacer Administrador del Club"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Cambios recientes de roles
                </CardTitle>
                <CardDescription>Las asignaciones y cambios de club quedan registrados automáticamente.</CardDescription>
              </CardHeader>
              <CardContent>
                {roleAudit.length ? (
                  <div className="space-y-3">
                    {roleAudit.map((event) => (
                      <div
                        key={event.id}
                        className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{event.email_objetivo}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.rol_anterior} → {event.rol_nuevo}
                            {event.club_nuevo_id
                              ? ` · ${clubes.find((club) => club.id === event.club_nuevo_id)?.nombre ?? "Club"}`
                              : " · Sin club"}
                          </p>
                          <p className="text-xs text-muted-foreground">Por {event.email_actor || "usuario del sistema"}</p>
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.cambiado_en}>
                          {new Date(event.cambiado_en).toLocaleString("es-AR")}
                        </time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Todavía no hay cambios de roles registrados.</p>
                )}
              </CardContent>
            </Card>

            <AlertDialog
              open={Boolean(clubToDelete)}
              onOpenChange={(open) => {
                if (!open && !isDeletingClub) setClubToDelete(null);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar el club {clubToDelete?.nombre}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Solo se puede eliminar si no tiene torneos ni categorías asociadas. Esta acción es permanente; la configuración deportiva propia del club también se eliminará.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeletingClub}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      void handleDeleteClub();
                    }}
                    disabled={isDeletingClub}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeletingClub ? "Eliminando…" : "Eliminar club"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </main>
    </div>
  );
}
