import { useEffect, useMemo, useState } from "react";
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
import { Plus, Pencil, Trash2, Search, Phone, Mail, Merge } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

import FusionarDialog from "@/components/jugadores/FusionarDialog";

type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];
type Categoria = Database["public"]["Tables"]["categorias_jugadores"]["Row"];
type Genero = Database["public"]["Enums"]["genero_categoria"];

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
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroGenero, setFiltroGenero] = useState<Genero | "todos">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fusionarOpen, setFusionarOpen] = useState(false);
  const [editing, setEditing] = useState<Jugador | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: j, error: ej }, { data: c, error: ec }] = await Promise.all([
      supabase.from("jugadores").select("*").order("apellido"),
      supabase.from("categorias_jugadores").select("*").eq("activa", true).order("orden"),
    ]);
    if (ej) toast.error("Error cargando jugadores: " + ej.message);
    if (ec) toast.error("Error cargando categorías: " + ec.message);
    setJugadores(j ?? []);
    setCategorias(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

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
      categoria_id: j.categoria_id ?? "",
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
      categoria_id: form.categoria_id || null,
      club: form.club.trim() || null,
      notas: form.notas.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from("jugadores").update(payload).eq("id", editing.id);
      if (error) {
        if (error.message.includes("jugadores_dni_unique"))
          return toast.error("Ya existe un jugador con ese DNI");
        return toast.error("Error al guardar: " + error.message);
      }
      toast.success("Jugador actualizado");
    } else {
      const { error } = await supabase.from("jugadores").insert(payload);
      if (error) {
        if (error.message.includes("jugadores_dni_unique"))
          return toast.error("Ya existe un jugador con ese DNI");
        return toast.error("Error al crear: " + error.message);
      }
      toast.success("Jugador creado");
    }
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("jugadores").delete().eq("id", id);
    if (error) return toast.error("Error al eliminar: " + error.message);
    toast.success("Jugador eliminado");
    fetchAll();
  };

  const categoriasFiltradas = useMemo(() => {
    if (!form.genero) return categorias;
    return categorias.filter((c) => c.genero === form.genero);
  }, [form.genero, categorias]);

  const categoriaLabel = (j: Jugador) => {
    const c = categorias.find((c) => c.id === j.categoria_id);
    if (!c) return null;
    return `${c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} ${c.nombre}`;
  };

  const filtered = useMemo(() => {
    return jugadores.filter((j) => {
      if (filtroGenero !== "todos" && j.genero !== filtroGenero) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        j.nombre.toLowerCase().includes(q) ||
        j.apellido.toLowerCase().includes(q) ||
        (j.dni ?? "").toLowerCase().includes(q) ||
        (j.club ?? "").toLowerCase().includes(q)
      );
    });
  }, [jugadores, search, filtroGenero]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jugadores</h1>
          <p className="text-sm text-muted-foreground">
            {jugadores.length} {jugadores.length === 1 ? "jugador" : "jugadores"} en el sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFusionarOpen(true)}>
            <Merge className="h-4 w-4" />
            Fusionar
          </Button>
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
                          {c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} {c.nombre}
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
        onDone={fetchAll}
      />

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, DNI o ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filtroGenero} onValueChange={(v: Genero | "todos") => setFiltroGenero(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="caballeros">Caballeros</SelectItem>
            <SelectItem value="damas">Damas</SelectItem>
            <SelectItem value="mixto">Mixto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {jugadores.length === 0
              ? 'Todavía no hay jugadores cargados. Hacé clic en "Nuevo jugador".'
              : "No se encontraron jugadores con esos filtros."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((j) => {
            const cat = categoriaLabel(j);
            return (
              <Card key={j.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {j.apellido}, {j.nombre}
                      </p>
                      {j.dni && <p className="text-xs text-muted-foreground">DNI {j.dni}</p>}
                    </div>
                    {cat && <Badge variant="secondary" className="shrink-0">{cat}</Badge>}
                  </div>
                  {(j.telefono || j.email) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {j.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{j.telefono}</span>
                        </div>
                      )}
                      {j.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{j.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {j.club && <p className="text-xs text-muted-foreground truncate">📍 {j.club}</p>}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(j)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
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
                          <AlertDialogAction onClick={() => handleDelete(j.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
