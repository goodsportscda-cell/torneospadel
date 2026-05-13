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
import { Combobox } from "@/components/Combobox";
import { Plus, Pencil, Trash2, Users, CheckCircle2, Clock, Hourglass, Copy } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Inscripcion = Database["public"]["Tables"]["inscripciones"]["Row"];
type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];
type EstadoPago = Database["public"]["Enums"]["estado_pago"];
type EstadoInscripcion = Database["public"]["Enums"]["estado_inscripcion"];

const PAGO_LABELS: Record<EstadoPago, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
};

const PAGO_VARIANT: Record<EstadoPago, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "destructive",
  parcial: "secondary",
  pagado: "default",
};

const ESTADO_INSC_LABELS: Record<EstadoInscripcion, string> = {
  pendiente_confirmacion: "Por confirmar",
  confirmada: "Confirmada",
  lista_espera: "Lista de espera",
  cancelada: "Cancelada",
};

const ESTADO_INSC_CLASSES: Record<EstadoInscripcion, string> = {
  pendiente_confirmacion: "bg-secondary text-secondary-foreground border-border",
  confirmada: "bg-primary/15 text-primary border-primary/30",
  lista_espera: "bg-muted text-muted-foreground border-border",
  cancelada: "bg-destructive/15 text-destructive border-destructive/30",
};

interface FormState {
  torneo_id: string;
  jugador1_id: string;
  jugador2_id: string;
  estado_pago: EstadoPago;
  monto_pagado: string;
  fecha_inscripcion: string;
  notas: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  torneo_id: "",
  jugador1_id: "",
  jugador2_id: "",
  estado_pago: "pendiente",
  monto_pagado: "",
  fecha_inscripcion: today(),
  notas: "",
});

export default function Inscripciones() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTorneo, setFiltroTorneo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<EstadoInscripcion | "todos" | "por_confirmar">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Inscripcion | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const fetchAll = async () => {
    setLoading(true);
    const [insc, tor, jug] = await Promise.all([
      supabase.from("inscripciones").select("*").order("created_at", { ascending: false }),
      supabase.from("torneos").select("*").order("fecha_inicio", { ascending: false }),
      supabase.from("jugadores").select("*").order("apellido"),
    ]);
    if (insc.error) toast.error("Error inscripciones: " + insc.error.message);
    if (tor.error) toast.error("Error torneos: " + tor.error.message);
    if (jug.error) toast.error("Error jugadores: " + jug.error.message);
    setInscripciones(insc.data ?? []);
    setTorneos(tor.data ?? []);
    setJugadores(jug.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const torneoMap = useMemo(() => new Map(torneos.map((t) => [t.id, t])), [torneos]);
  const jugadorMap = useMemo(() => new Map(jugadores.map((j) => [j.id, j])), [jugadores]);

  const torneoOptions = torneos.map((t) => ({
    value: t.id,
    label: t.nombre,
    hint: new Date(t.fecha_inicio).toLocaleDateString("es-AR"),
  }));

  const jugadorOptions = (excludeId?: string) =>
    jugadores
      .filter((j) => j.id !== excludeId)
      .map((j) => ({
        value: j.id,
        label: `${j.apellido}, ${j.nombre}`,
        hint: j.dni ? `DNI ${j.dni}` : j.club ?? undefined,
      }));

  const openCreate = () => {
    setEditing(null);
    const initial = emptyForm();
    if (filtroTorneo !== "todos") initial.torneo_id = filtroTorneo;
    setForm(initial);
    setDialogOpen(true);
  };

  const openEdit = (i: Inscripcion) => {
    setEditing(i);
    setForm({
      torneo_id: i.torneo_id,
      jugador1_id: i.jugador1_id,
      jugador2_id: i.jugador2_id,
      estado_pago: i.estado_pago,
      monto_pagado: i.monto_pagado?.toString() ?? "",
      fecha_inscripcion: i.fecha_inscripcion,
      notas: i.notas ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.torneo_id) return toast.error("Elegí un torneo");
    if (!form.jugador1_id || !form.jugador2_id) return toast.error("Elegí los dos jugadores");
    if (form.jugador1_id === form.jugador2_id) return toast.error("Los jugadores deben ser distintos");

    const payload = {
      torneo_id: form.torneo_id,
      jugador1_id: form.jugador1_id,
      jugador2_id: form.jugador2_id,
      estado_pago: form.estado_pago,
      monto_pagado: form.monto_pagado ? Number(form.monto_pagado) : 0,
      fecha_inscripcion: form.fecha_inscripcion || today(),
      notas: form.notas.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from("inscripciones").update(payload).eq("id", editing.id);
      if (error) return toast.error("Error al guardar: " + error.message);
      toast.success("Inscripción actualizada");
    } else {
      const { error } = await supabase.from("inscripciones").insert(payload);
      if (error) {
        if (error.code === "23505") {
          return toast.error("Esa pareja ya está inscripta en este torneo");
        }
        return toast.error("Error al crear: " + error.message);
      }
      toast.success("Inscripción creada");
    }
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("inscripciones").delete().eq("id", id);
    if (error) return toast.error("Error al eliminar: " + error.message);
    toast.success("Inscripción eliminada");
    fetchAll();
  };

  const handleQuickPago = async (i: Inscripcion, estado: EstadoPago) => {
    const { error } = await supabase.from("inscripciones").update({ estado_pago: estado }).eq("id", i.id);
    if (error) return toast.error("Error: " + error.message);
    toast.success("Pago actualizado");
    fetchAll();
  };

  const handleConfirmar = async (i: Inscripcion) => {
    const { error } = await supabase
      .from("inscripciones")
      .update({ estado: "confirmada" })
      .eq("id", i.id);
    if (error) return toast.error("Error: " + error.message);
    toast.success("Inscripción confirmada");
    fetchAll();
  };

  const handleCambiarEstado = async (i: Inscripcion, estado: EstadoInscripcion) => {
    const { error } = await supabase
      .from("inscripciones")
      .update({ estado })
      .eq("id", i.id);
    if (error) return toast.error("Error: " + error.message);
    toast.success(`Estado cambiado a ${ESTADO_INSC_LABELS[estado]}`);
    fetchAll();
  };

  const filtered = useMemo(() => {
    let arr = inscripciones;
    if (filtroTorneo !== "todos") arr = arr.filter((i) => i.torneo_id === filtroTorneo);
    if (filtroEstado === "por_confirmar") {
      arr = arr.filter((i) => (i as Inscripcion & { estado: EstadoInscripcion }).estado === "pendiente_confirmacion");
    } else if (filtroEstado !== "todos") {
      arr = arr.filter((i) => (i as Inscripcion & { estado: EstadoInscripcion }).estado === filtroEstado);
    }
    return arr;
  }, [inscripciones, filtroTorneo, filtroEstado]);

  const pendientesCount = useMemo(
    () => inscripciones.filter((i) => (i as Inscripcion & { estado: EstadoInscripcion }).estado === "pendiente_confirmacion").length,
    [inscripciones],
  );

  const jugadorLabel = (id: string) => {
    const j = jugadorMap.get(id);
    return j ? `${j.apellido}, ${j.nombre}` : "—";
  };

  const noHayDatos = torneos.length === 0 || jugadores.length === 0;

  const copiarLista = () => {
    if (filtered.length === 0) {
      toast.error("No hay inscripciones para copiar");
      return;
    }

    let texto = "";
    if (filtroTorneo !== "todos") {
      const torneo = torneoMap.get(filtroTorneo);
      if (torneo) texto += `🏆 *${torneo.nombre}*\n`;
    } else {
      texto += `📋 *Lista de Inscriptos*\n`;
    }
    
    texto += `Total: ${filtered.length} parejas\n\n`;

    filtered.forEach((i, index) => {
      const j1 = jugadorMap.get(i.jugador1_id);
      const j2 = jugadorMap.get(i.jugador2_id);
      const n1 = j1 ? `${j1.apellido} ${j1.nombre}` : "—";
      const n2 = j2 ? `${j2.apellido} ${j2.nombre}` : "—";
      texto += `${index + 1}. ${n1} / ${n2}\n`;
    });

    navigator.clipboard.writeText(texto)
      .then(() => toast.success("Lista copiada al portapapeles"))
      .catch(() => toast.error("Error al copiar al portapapeles"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inscripciones</h1>
          <p className="text-sm text-muted-foreground">
            {inscripciones.length} {inscripciones.length === 1 ? "pareja inscripta" : "parejas inscriptas"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copiarLista} disabled={filtered.length === 0}>
            <Copy className="h-4 w-4" />
            Copiar Lista
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} disabled={noHayDatos}>
                <Plus className="h-4 w-4" />
                Nueva inscripción
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar inscripción" : "Nueva inscripción"}</DialogTitle>
              <DialogDescription>Elegí torneo y los dos jugadores de la pareja.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label>Torneo *</Label>
                <Combobox
                  options={torneoOptions}
                  value={form.torneo_id}
                  onChange={(v) => setForm({ ...form, torneo_id: v })}
                  placeholder="Elegir torneo"
                  searchPlaceholder="Buscar torneo..."
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Jugador 1 *</Label>
                <Combobox
                  options={jugadorOptions(form.jugador2_id)}
                  value={form.jugador1_id}
                  onChange={(v) => setForm({ ...form, jugador1_id: v })}
                  placeholder="Elegir jugador 1"
                  searchPlaceholder="Buscar por apellido o DNI..."
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Jugador 2 *</Label>
                <Combobox
                  options={jugadorOptions(form.jugador1_id)}
                  value={form.jugador2_id}
                  onChange={(v) => setForm({ ...form, jugador2_id: v })}
                  placeholder="Elegir jugador 2"
                  searchPlaceholder="Buscar por apellido o DNI..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Estado de pago</Label>
                  <Select
                    value={form.estado_pago}
                    onValueChange={(v: EstadoPago) => setForm({ ...form, estado_pago: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAGO_LABELS) as EstadoPago[]).map((e) => (
                        <SelectItem key={e} value={e}>
                          {PAGO_LABELS[e]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="monto">Monto pagado</Label>
                  <Input
                    id="monto"
                    type="number"
                    inputMode="decimal"
                    value={form.monto_pagado}
                    onChange={(e) => setForm({ ...form, monto_pagado: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fi">Fecha de inscripción</Label>
                <Input
                  id="fi"
                  type="date"
                  value={form.fecha_inscripcion}
                  onChange={(e) => setForm({ ...form, fecha_inscripcion: e.target.value })}
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
              <Button onClick={handleSave}>{editing ? "Guardar cambios" : "Inscribir pareja"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {noHayDatos && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Para crear inscripciones primero necesitás cargar al menos{" "}
            {torneos.length === 0 && "un torneo"}
            {torneos.length === 0 && jugadores.length === 0 && " y "}
            {jugadores.length === 0 && "dos jugadores"}.
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <Label className="text-sm">Filtrar:</Label>
        <Select value={filtroTorneo} onValueChange={setFiltroTorneo}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los torneos</SelectItem>
            {torneos.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="por_confirmar">
              Por confirmar{pendientesCount > 0 ? ` (${pendientesCount})` : ""}
            </SelectItem>
            <SelectItem value="confirmada">Confirmadas</SelectItem>
            <SelectItem value="lista_espera">Lista de espera</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        {pendientesCount > 0 && filtroEstado === "todos" && (
          <Badge
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setFiltroEstado("por_confirmar")}
          >
            <Hourglass className="h-3 w-3" />
            {pendientesCount} por confirmar
          </Badge>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay inscripciones {filtroTorneo !== "todos" ? "para este torneo" : "todavía"}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => {
            const torneo = torneoMap.get(i.torneo_id);
            return (
              <Card key={i.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs text-muted-foreground truncate">{torneo?.nombre ?? "—"}</p>
                        {torneo && Number(torneo.multiplicador_puntos) >= 2 && (
                          <Badge className="h-4 px-1 text-[10px] bg-primary text-primary-foreground">
                            x{Number(torneo.multiplicador_puntos)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="font-semibold text-sm truncate">
                          {jugadorLabel(i.jugador1_id)}
                        </p>
                        {jugadorMap.get(i.jugador1_id)?.club && (
                          <span className="text-[10px] text-muted-foreground truncate border rounded px-1 max-w-[80px]">
                            {jugadorMap.get(i.jugador1_id)?.club}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 ml-5">
                        <p className="font-semibold text-sm truncate">
                          {jugadorLabel(i.jugador2_id)}
                        </p>
                        {jugadorMap.get(i.jugador2_id)?.club && (
                          <span className="text-[10px] text-muted-foreground truncate border rounded px-1 max-w-[80px]">
                            {jugadorMap.get(i.jugador2_id)?.club}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={PAGO_VARIANT[i.estado_pago]}>
                        {PAGO_LABELS[i.estado_pago]}
                      </Badge>
                    </div>
                  </div>

                  {i.disponibilidad_horaria && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground line-clamp-2" title={i.disponibilidad_horaria}>
                        <span className="font-medium text-foreground">Disponibilidad:</span> {i.disponibilidad_horaria}
                      </p>
                    </div>
                  )}

                  {i.notas && (
                    <div className="mt-1 bg-muted/30 p-2 rounded text-xs text-muted-foreground italic border border-muted">
                      "{i.notas}"
                    </div>
                  )}

                  {(i.monto_pagado ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Pagado: ${Number(i.monto_pagado).toLocaleString("es-AR")}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Estado</Label>
                      <Select
                        value={(i as Inscripcion & { estado: EstadoInscripcion }).estado as EstadoInscripcion}
                        onValueChange={(v: EstadoInscripcion) => handleCambiarEstado(i, v)}
                      >
                        <SelectTrigger
                          className={`h-8 ${ESTADO_INSC_CLASSES[(i as Inscripcion & { estado: EstadoInscripcion }).estado as EstadoInscripcion]}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ESTADO_INSC_LABELS) as EstadoInscripcion[]).map((e) => (
                            <SelectItem key={e} value={e}>
                              {ESTADO_INSC_LABELS[e]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Pago</Label>
                      <Select
                        value={i.estado_pago}
                        onValueChange={(v: EstadoPago) => handleQuickPago(i, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PAGO_LABELS) as EstadoPago[]).map((e) => (
                            <SelectItem key={e} value={e}>
                              {PAGO_LABELS[e]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(i as Inscripcion & { estado: EstadoInscripcion }).estado === "pendiente_confirmacion" && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleConfirmar(i)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirmar inscripción
                    </Button>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(i)}>
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
                          <AlertDialogTitle>¿Eliminar inscripción?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se quitará la pareja del torneo. Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(i.id)}>
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
