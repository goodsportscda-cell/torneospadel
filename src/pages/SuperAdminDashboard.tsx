import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Trophy, Users, Search, Plus, Shield, LogOut, History } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

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

export default function SuperAdminDashboard() {
  const { signOut, setImpersonatedClubId } = useAuth();
  const [stats, setStats] = useState({ clubes: 0, torneos: 0, perfiles: 0 });
  const [clubes, setClubes] = useState<Club[]>([]);
  const [roleAudit, setRoleAudit] = useState<RoleAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningRole, setAssigningRole] = useState(false);

  // New club form
  const [newClub, setNewClub] = useState({ nombre: "", slug: "", logo_url: "" });
  const [isNewClubOpen, setIsNewClubOpen] = useState(false);

  // Assign admin form
  const [searchEmail, setSearchEmail] = useState("");
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
  const [selectedClubId, setSelectedClubId] = useState("");

  const loadData = async () => {
    setLoading(true);
    
    // Stats
    const { count: clubesCount } = await supabase.from("clubes").select("*", { count: "exact", head: true });
    const { count: torneosCount } = await supabase.from("torneos").select("*", { count: "exact", head: true });
    const { count: perfilesCount } = await supabase.from("perfiles").select("*", { count: "exact", head: true });
    const { data: auditData } = await (supabase as any)
      .from("auditoria_roles_perfiles")
      .select("id, email_actor, email_objetivo, rol_anterior, rol_nuevo, club_anterior_id, club_nuevo_id, cambiado_en")
      .order("cambiado_en", { ascending: false })
      .limit(10);
    
    setStats({
      clubes: clubesCount || 0,
      torneos: torneosCount || 0,
      perfiles: perfilesCount || 0,
    });

    // Clubes
    const { data: clubesData } = await supabase.from("clubes").select("*").order("created_at", { ascending: false });
    if (clubesData) {
      setClubes(clubesData);
    }
    setRoleAudit(auditData ?? []);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail) return;

    // La búsqueda queda disponible solo para superadmins por la política RLS de perfiles.
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

    setSearchedUser({
      id: data.id,
      email: data.email || searchEmail,
      rol: data.rol,
      club_id: data.club_id,
      nombre: "",
      apellido: "",
    });
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
    toast.success(data.ya_asignado ? "Ese usuario ya es administrador de ese club." : "Administrador asignado. El cambio quedó registrado.");
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
                  <div className="text-2xl font-bold">{stats.clubes}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Todos los clubes cargados en Padel ID.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Torneos cargados</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.torneos}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Todos los registros, sin filtrar por fecha ni estado.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cuentas de usuario</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.perfiles}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Perfiles de jugadores y administradores.</p>
                </CardContent>
              </Card>
            </div>

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
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo Club</Button>
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
                            onChange={(e) => setNewClub({...newClub, nombre: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="slug">Dirección corta del club</Label>
                          <Input 
                            id="slug" 
                            placeholder="Ej: el-galpon" 
                            value={newClub.slug}
                            onChange={(e) => setNewClub({...newClub, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                          />
                          <p className="text-[10px] text-muted-foreground">La página pública quedará como: /c/{newClub.slug || 'nombre-del-club'}/</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="logo">URL del Logo (Opcional)</Label>
                          <Input 
                            id="logo" 
                            placeholder="/logo.png o https://..." 
                            value={newClub.logo_url}
                            onChange={(e) => setNewClub({...newClub, logo_url: e.target.value})}
                          />
                        </div>
                        <Button type="submit" className="w-full">Registrar Club</Button>
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
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Asignador de Roles */}
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Asignar Rol de Administrador</CardTitle>
                  <CardDescription>Busca a un jugador registrado por email y conviértelo en el Club Admin de un complejo.</CardDescription>
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
                    <Button type="submit" variant="secondary"><Search className="h-4 w-4" /></Button>
                  </form>

                  {searchedUser && (
                    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                      <div className="flex flex-col gap-1">
                        <h4 className="font-semibold">Usuario encontrado</h4>
                        <p className="text-sm"><strong>ID:</strong> <span className="text-xs text-muted-foreground">{searchedUser.id}</span></p>
                        <p className="text-sm"><strong>Email:</strong> {searchedUser.email}</p>
                        <p className="text-sm">
                          <strong>Rol actual:</strong> <span className="uppercase text-xs font-bold tracking-wider">{searchedUser.rol}</span>
                        </p>
                        {searchedUser.club_id && (
                          <p className="text-sm">
                            <strong>Club actual:</strong> {clubes.find(c => c.id === searchedUser.club_id)?.nombre || searchedUser.club_id}
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
                          {clubes.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
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
                <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Cambios recientes de roles</CardTitle>
                <CardDescription>Las asignaciones y cambios de club quedan registrados automáticamente.</CardDescription>
              </CardHeader>
              <CardContent>
                {roleAudit.length ? (
                  <div className="space-y-3">
                    {roleAudit.map((event) => (
                      <div key={event.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{event.email_objetivo}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.rol_anterior} → {event.rol_nuevo}
                            {event.club_nuevo_id ? ` · ${clubes.find((club) => club.id === event.club_nuevo_id)?.nombre ?? "Club"}` : " · Sin club"}
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
          </>
        )}
      </main>
    </div>
  );
}

