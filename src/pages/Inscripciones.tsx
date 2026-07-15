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
import {
  Loader2,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Users,
  Clock,
  FileText,
  Hourglass,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


type Inscripcion = Database["public"]["Tables"]["inscripciones"]["Row"];
type JugadorSimple = { id: string; nombre: string; apellido: string; club: string | null; telefono: string | null; dni: string | null; };
type InscripcionConJugadores = Inscripcion & {
  jugador1?: JugadorSimple | null;
  jugador2?: JugadorSimple | null;
};
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
  disponibilidad_horaria: string;
}

import { useAuth } from "@/hooks/useAuth";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): FormState => ({
  torneo_id: "",
  jugador1_id: "",
  jugador2_id: "",
  estado_pago: "pendiente",
  monto_pagado: "",
  fecha_inscripcion: today(),
  notas: "",
  disponibilidad_horaria: "",
});

export default function Inscripciones() {
  const { clubId } = useAuth();
  const [inscripciones, setInscripciones] = useState<InscripcionConJugadores[]>([]);
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJugadores, setLoadingJugadores] = useState(false);
  const [filtroTorneo, setFiltroTorneo] = useState<string>(() => {
    return localStorage.getItem("admin_filtro_torneo") || "todos";
  });
  const [filtroEstado, setFiltroEstado] = useState<EstadoInscripcion | "todos" | "por_confirmar">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Inscripcion | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [tipoImpresion, setTipoImpresion] = useState<"acreditacion" | "disponibilidad" | "sorteo">("acreditacion");

  const handlePrint = (tipo: "acreditacion" | "disponibilidad" | "sorteo") => {
    setTipoImpresion(tipo);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Carga torneos iniciales
  useEffect(() => {
    const fetchTorneos = async () => {
      let tQuery = supabase
        .from("torneos")
        .select("*")
        .order("fecha_inicio", { ascending: false });

      if (clubId) {
        tQuery = tQuery.eq("club_id", clubId);
      }

      const { data, error } = await tQuery;
      
      if (error) {
        toast.error("Error al cargar torneos: " + error.message);
        return;
      }
      setTorneos(data ?? []);

      const savedFilter = localStorage.getItem("admin_filtro_torneo");
      if (!savedFilter && data && data.length > 0) {
        const masReciente = data[0].id;
        setFiltroTorneo(masReciente);
        localStorage.setItem("admin_filtro_torneo", masReciente);
      }
    };
    fetchTorneos();
  }, []);

  // Carga las inscripciones del torneo seleccionado
  const fetchInscripciones = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("inscripciones")
        .select(`
          *,
          jugador1:jugadores!inscripciones_jugador1_id_fkey(id, nombre, apellido, club, telefono, dni),
          jugador2:jugadores!inscripciones_jugador2_id_fkey(id, nombre, apellido, club, telefono, dni)
        `);

      if (filtroTorneo !== "todos") {
        query = query.eq("torneo_id", filtroTorneo);
      } else {
        query = query.order("created_at", { ascending: false }).limit(200);
      }

      const { data, error } = await query;
      if (error) {
        toast.error("Error al cargar inscripciones: " + error.message);
      } else {
        setInscripciones((data ?? []) as InscripcionConJugadores[]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error inesperado al cargar inscripciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInscripciones();
  }, [filtroTorneo]);

  // Carga jugadores bajo demanda al abrir el diálogo
  useEffect(() => {
    if (dialogOpen && jugadores.length === 0) {
      const fetchJugadores = async () => {
        setLoadingJugadores(true);
        const { data, error } = await supabase
          .from("jugadores")
          .select("*")
          .order("apellido");
        
        if (error) {
          toast.error("Error al cargar jugadores: " + error.message);
        } else {
          setJugadores(data ?? []);
        }
        setLoadingJugadores(false);
      };
      fetchJugadores();
    }
  }, [dialogOpen, jugadores.length]);

  const fetchAll = async () => {
    await fetchInscripciones();
  };

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
      disponibilidad_horaria: (i as any).disponibilidad_horaria ?? "",
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
      disponibilidad_horaria: form.disponibilidad_horaria.trim() || null,
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
    // Check if the pairing is already assigned to a zone to prevent orphaned matches
    const { data: assigned, error: checkError } = await supabase
      .from("zonas_parejas")
      .select("id")
      .eq("inscripcion_id", id)
      .maybeSingle();

    if (checkError) {
      return toast.error("Error al comprobar la asignación de la pareja: " + checkError.message);
    }

    if (assigned) {
      return toast.error("No se puede eliminar la inscripción: la pareja ya está asignada a una zona. Quitala de la zona primero.");
    }

    const { error } = await supabase.from("inscripciones").delete().eq("id", id);
    if (error) return toast.error("Error al eliminar: " + error.message);
    toast.success("Inscripción eliminada");
    fetchAll();
  };

  const handleQuickPagoJugador = async (i: Inscripcion, jugador: 1 | 2, estado: string) => {
    const field = jugador === 1 ? "pago_j1_estado" : "pago_j2_estado";
    const { error } = await supabase.from("inscripciones").update({ [field]: estado }).eq("id", i.id);
    if (error) return toast.error("Error: " + error.message);
    toast.success("Estado de pago actualizado");
    fetchAll();
  };

  const handleQuickMetodoJugador = async (i: Inscripcion, jugador: 1 | 2, metodo: string) => {
    const field = jugador === 1 ? "pago_j1_metodo" : "pago_j2_metodo";
    const { error } = await supabase.from("inscripciones").update({ [field]: metodo }).eq("id", i.id);
    if (error) return toast.error("Error: " + error.message);
    toast.success("Método de pago actualizado");
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

  const handleConfirmarTodas = async () => {
    if (filtroTorneo === "todos") return;
    const toastId = toast.loading("Confirmando todas las inscripciones...");
    try {
      const { error } = await supabase
        .from("inscripciones")
        .update({ estado: "confirmada" })
        .eq("torneo_id", filtroTorneo)
        .eq("estado", "pendiente_confirmacion");
      
      if (error) throw error;
      
      toast.success("Todas las inscripciones confirmadas", { id: toastId });
      fetchAll();
    } catch (e: any) {
      toast.error("Error al confirmar: " + e.message, { id: toastId });
    }
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
    
    // Ordenar alfabéticamente por apellido del primer jugador
    return [...arr].sort((a, b) => {
      const j1A = (a as InscripcionConJugadores).jugador1;
      const j1B = (b as InscripcionConJugadores).jugador1;
      const nameA = j1A ? `${j1A.apellido} ${j1A.nombre}`.toLowerCase() : "";
      const nameB = j1B ? `${j1B.apellido} ${j1B.nombre}`.toLowerCase() : "";
      return nameA.localeCompare(nameB);
    });
  }, [inscripciones, filtroTorneo, filtroEstado]);

  const pendientesCount = useMemo(
    () => inscripciones.filter((i) => (i as Inscripcion & { estado: EstadoInscripcion }).estado === "pendiente_confirmacion").length,
    [inscripciones],
  );

  const jugadorLabel = (id: string, i?: InscripcionConJugadores) => {
    if (i) {
      const j = i.jugador1_id === id ? i.jugador1 : i.jugador2;
      if (j) return `${j.apellido}, ${j.nombre}`;
    }
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
      const j1 = (i as InscripcionConJugadores).jugador1;
      const j2 = (i as InscripcionConJugadores).jugador2;
      const n1 = j1 ? `${j1.apellido} ${j1.nombre}` : "—";
      const n2 = j2 ? `${j2.apellido} ${j2.nombre}` : "—";
      texto += `${index + 1}. ${n1} / ${n2}\n`;
    });

    navigator.clipboard.writeText(texto)
      .then(() => toast.success("Lista copiada al portapapeles"))
      .catch(() => toast.error("Error al copiar al portapapeles"));
  };

  const copiarListaSorteo = () => {
    if (filtered.length === 0) {
      toast.error("No hay inscripciones para copiar");
      return;
    }

    let texto = "";
    if (filtroTorneo !== "todos") {
      const torneo = torneoMap.get(filtroTorneo);
      if (torneo) texto += `🏆 *${torneo.nombre} - Lista para Sorteo*\n`;
    } else {
      texto += `📋 *Lista para Sorteo (Con DNI)*\n`;
    }
    
    // Sort players alphabetically
    const players: { name: string; dni: string }[] = [];
    filtered.forEach((i) => {
      const j1 = (i as InscripcionConJugadores).jugador1;
      const j2 = (i as InscripcionConJugadores).jugador2;
      if (j1) players.push({ name: `${j1.apellido}, ${j1.nombre}`, dni: j1.dni || "No registrado" });
      if (j2) players.push({ name: `${j2.apellido}, ${j2.nombre}`, dni: j2.dni || "No registrado" });
    });
    players.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    texto += `Total: ${players.length} jugadores\n\n`;

    players.forEach((p, index) => {
      texto += `${index + 1}. ${p.name} - DNI: ${p.dni}\n`;
    });

    navigator.clipboard.writeText(texto)
      .then(() => toast.success("Lista para sorteo copiada al portapapeles"))
      .catch(() => toast.error("Error al copiar al portapapeles"));
  };

  return (
    <>
    {/* VISTA PANTALLA */}
    <div className="space-y-4 print:hidden">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inscripciones</h1>
          <p className="text-sm text-muted-foreground">
            {inscripciones.length} {inscripciones.length === 1 ? "pareja inscripta" : "parejas inscriptas"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={filtered.length === 0}>
                <Printer className="h-4 w-4 mr-1" />
                Imprimir...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePrint("acreditacion")}>
                Planilla de Cobros/Acreditación
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint("disponibilidad")}>
                Planilla de Disponibilidad Horaria
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint("sorteo")}>
                Planilla para Sorteo (con DNI)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={filtered.length === 0}>
                <Copy className="h-4 w-4 mr-1" />
                Copiar...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copiarLista}>
                Copiar nombres de parejas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copiarListaSorteo}>
                Copiar lista para Sorteo (Nombres y DNI)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {filtroTorneo !== "todos" && pendientesCount > 0 && (
            <Button
              variant="outline"
              className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              onClick={handleConfirmarTodas}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirmar todas ({pendientesCount})
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} disabled={torneos.length === 0}>
                <Plus className="h-4 w-4" />
                Nueva inscripción
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar inscripción" : "Nueva inscripción"}</DialogTitle>
              <DialogDescription>Elegí torneo y los dos jugadores de la pareja.</DialogDescription>
            </DialogHeader>
            {loadingJugadores ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Cargando lista de jugadores...</p>
              </div>
            ) : (
              <>
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
                    <Label htmlFor="disponibilidad">Disponibilidad horaria</Label>
                    <Input
                      id="disponibilidad"
                      placeholder="Ej: Viernes desde las 19hs, Sábado todo el día"
                      value={form.disponibilidad_horaria}
                      onChange={(e) => setForm({ ...form, disponibilidad_horaria: e.target.value })}
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
                  <Button onClick={handleSave} disabled={torneos.length === 0 || jugadores.length === 0}>
                    {editing ? "Guardar cambios" : "Inscribir pareja"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {torneos.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Para crear inscripciones primero necesitás cargar al menos un torneo.
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <Label className="text-sm">Filtrar:</Label>
        <Select value={filtroTorneo} onValueChange={(v) => {
          setFiltroTorneo(v);
          localStorage.setItem("admin_filtro_torneo", v);
        }}>
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
                          {jugadorLabel(i.jugador1_id, i)}
                        </p>
                        {i.jugador1?.club && (
                          <span className="text-[10px] text-muted-foreground truncate border rounded px-1 max-w-[80px]">
                            {i.jugador1.club}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 ml-5">
                        <p className="font-semibold text-sm truncate">
                          {jugadorLabel(i.jugador2_id, i)}
                        </p>
                        {i.jugador2?.club && (
                          <span className="text-[10px] text-muted-foreground truncate border rounded px-1 max-w-[80px]">
                            {i.jugador2.club}
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
                    <div className="mt-1 bg-amber-50 dark:bg-amber-950/20 p-2 rounded text-xs text-amber-800 dark:text-amber-300 italic border border-amber-200 dark:border-amber-900/50">
                      "{i.notas}"
                    </div>
                  )}

                  {i.comprobante_url && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-primary hover:underline">
                      <a href={i.comprobante_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Ver Comprobante Global
                      </a>
                    </div>
                  )}

                  <div className="pt-2 border-t mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Estado de Pagos</p>
                      <Label className="text-[10px] text-muted-foreground mr-1">Estado General</Label>
                    </div>

                    <div className="flex gap-2 items-start">
                      {/* JUGADOR 1 */}
                      <div className="flex-1 flex flex-col gap-1.5 p-2 bg-muted/30 rounded-md border border-border/50">
                        <p className="text-xs font-medium truncate" title={jugadorLabel(i.jugador1_id, i)}>{jugadorLabel(i.jugador1_id, i).split(',')[0]}</p>
                        <div className="flex flex-col gap-1.5">
                          <Select
                            value={i.pago_j1_estado || "pendiente"}
                            onValueChange={(v) => handleQuickPagoJugador(i, 1, v)}
                          >
                            <SelectTrigger className="h-7 text-xs px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendiente" className="text-xs">Pendiente</SelectItem>
                              <SelectItem value="pagado" className="text-xs">Pagado</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={i.pago_j1_metodo || "none"}
                            onValueChange={(v) => handleQuickMetodoJugador(i, 1, v === "none" ? "" : v)}
                          >
                            <SelectTrigger className="h-7 text-xs px-2">
                              <SelectValue placeholder="Método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">S/D</SelectItem>
                              <SelectItem value="efectivo" className="text-xs">Efectivo</SelectItem>
                              <SelectItem value="transferencia" className="text-xs">Transf.</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {i.pago_j1_comprobante && (
                          <a href={i.pago_j1_comprobante} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-1">
                            <FileText className="h-3 w-3" /> Ver comprobante
                          </a>
                        )}
                      </div>

                      {/* JUGADOR 2 */}
                      <div className="flex-1 flex flex-col gap-1.5 p-2 bg-muted/30 rounded-md border border-border/50">
                        <p className="text-xs font-medium truncate" title={jugadorLabel(i.jugador2_id, i)}>{jugadorLabel(i.jugador2_id, i).split(',')[0]}</p>
                        <div className="flex flex-col gap-1.5">
                          <Select
                            value={i.pago_j2_estado || "pendiente"}
                            onValueChange={(v) => handleQuickPagoJugador(i, 2, v)}
                          >
                            <SelectTrigger className="h-7 text-xs px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendiente" className="text-xs">Pendiente</SelectItem>
                              <SelectItem value="pagado" className="text-xs">Pagado</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={i.pago_j2_metodo || "none"}
                            onValueChange={(v) => handleQuickMetodoJugador(i, 2, v === "none" ? "" : v)}
                          >
                            <SelectTrigger className="h-7 text-xs px-2">
                              <SelectValue placeholder="Método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">S/D</SelectItem>
                              <SelectItem value="efectivo" className="text-xs">Efectivo</SelectItem>
                              <SelectItem value="transferencia" className="text-xs">Transf.</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {i.pago_j2_comprobante && (
                          <a href={i.pago_j2_comprobante} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-1">
                            <FileText className="h-3 w-3" /> Ver comprobante
                          </a>
                        )}
                      </div>
                      
                      {/* ESTADO GENERAL */}
                      <div className="flex flex-col gap-1.5 shrink-0 self-stretch">
                        <Select
                          value={(i as Inscripcion & { estado: EstadoInscripcion }).estado as EstadoInscripcion}
                          onValueChange={(v: EstadoInscripcion) => handleCambiarEstado(i, v)}
                        >
                          <SelectTrigger
                            className={`h-7 text-xs px-2 w-[110px] ${ESTADO_INSC_CLASSES[(i as Inscripcion & { estado: EstadoInscripcion }).estado as EstadoInscripcion]}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ESTADO_INSC_LABELS) as EstadoInscripcion[]).map((e) => (
                              <SelectItem key={e} value={e} className="text-xs">
                                {ESTADO_INSC_LABELS[e]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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

    {/* VISTA IMPRESIÓN (Solo visible al imprimir) */}
    <div className="hidden print:block font-sans">
      {tipoImpresion === "acreditacion" ? (
        <>
          <div className="mb-6 flex justify-between items-end border-b pb-4">
            <div>
              <h1 className="text-xl font-semibold uppercase tracking-wider text-gray-600">
                Planilla de Cobros y Acreditación
              </h1>
              <p className="text-3xl font-bold text-black mt-2">
                {filtroTorneo !== "todos" ? torneoMap.get(filtroTorneo)?.nombre : "Todos los torneos"}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Total inscriptos: {filtered.length} parejas</p>
              <p>Fecha: {new Date().toLocaleDateString("es-AR")}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-800">
                <th className="py-2 px-2 text-left font-bold w-8">N°</th>
                <th className="py-2 px-2 text-left font-bold">Pareja</th>
                <th className="py-2 px-2 text-left font-bold w-40">Teléfonos</th>
                <th className="py-2 px-2 text-left font-bold w-32">Falta Pagar</th>
                <th className="py-2 px-2 text-center font-bold w-48">Forma de pago</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i, index) => {
                const j1 = (i as InscripcionConJugadores).jugador1;
                const j2 = (i as InscripcionConJugadores).jugador2;
                const n1 = j1 ? `${j1.apellido} ${j1.nombre}` : "—";
                const n2 = j2 ? `${j2.apellido} ${j2.nombre}` : "—";
                
                return (
                  <tr key={i.id} className="border-b border-gray-300">
                    <td className="py-3 px-2 font-mono text-gray-500">{index + 1}</td>
                    <td className="py-3 px-2 font-semibold">
                      {n1} <br/> <span className="text-gray-500 font-normal">{n2}</span>
                    </td>
                    <td className="py-3 px-2 text-gray-700 text-xs">
                      <div>{j1?.telefono || "—"}</div>
                      <div className="text-gray-500 mt-2">{j2?.telefono || "—"}</div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="h-6 border-b border-dashed border-gray-400 w-20"></div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col gap-2 items-center justify-center text-xs font-medium text-gray-600">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <span>Efe</span>
                            <div className="h-5 w-5 border-2 border-gray-400 rounded"></div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>Trf</span>
                            <div className="h-5 w-5 border-2 border-gray-400 rounded"></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-gray-400">
                          <div className="flex items-center gap-1">
                            <span>Efe</span>
                            <div className="h-5 w-5 border-2 border-gray-300 rounded"></div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>Trf</span>
                            <div className="h-5 w-5 border-2 border-gray-300 rounded"></div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : tipoImpresion === "disponibilidad" ? (
        <>
          <div className="mb-6 flex justify-between items-end border-b pb-4">
            <div>
              <h1 className="text-xl font-semibold uppercase tracking-wider text-gray-600">
                Planilla de Disponibilidad Horaria
              </h1>
              <p className="text-3xl font-bold text-black mt-2">
                {filtroTorneo !== "todos" ? torneoMap.get(filtroTorneo)?.nombre : "Todos los torneos"}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Total inscriptos: {filtered.length} parejas</p>
              <p>Fecha: {new Date().toLocaleDateString("es-AR")}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-800">
                <th className="py-2 px-2 text-left font-bold w-8">N°</th>
                <th className="py-2 px-2 text-left font-bold w-[35%]">Pareja</th>
                <th className="py-2 px-2 text-left font-bold w-[20%]">Teléfonos</th>
                <th className="py-2 px-2 text-left font-bold w-[30%]">Disponibilidad Horaria</th>
                <th className="py-2 px-2 text-left font-bold w-[15%]">Notas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i, index) => {
                const j1 = (i as InscripcionConJugadores).jugador1;
                const j2 = (i as InscripcionConJugadores).jugador2;
                const n1 = j1 ? `${j1.apellido} ${j1.nombre}` : "—";
                const n2 = j2 ? `${j2.apellido} ${j2.nombre}` : "—";
                const t1 = j1?.telefono ? j1.telefono : "—";
                const t2 = j2?.telefono ? j2.telefono : "—";
                
                return (
                  <tr key={i.id} className="border-b border-gray-300">
                    <td className="py-3 px-2 font-mono text-gray-500">{index + 1}</td>
                    <td className="py-3 px-2 font-semibold">
                      {n1} <br/> <span className="text-gray-500 font-normal">{n2}</span>
                    </td>
                    <td className="py-3 px-2 font-mono text-xs">
                      {t1} <br/> <span className="text-gray-500">{t2}</span>
                    </td>
                    <td className="py-3 px-2 font-medium">
                      {i.disponibilidad_horaria || <span className="text-gray-400 italic">No especificada</span>}
                    </td>
                    <td className="py-3 px-2 text-xs text-gray-600 italic">
                      {i.notas || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <div className="mb-6 flex justify-between items-end border-b pb-4">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wider">
                Planilla para Sorteo (con DNI)
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                {filtroTorneo !== "todos" ? torneoMap.get(filtroTorneo)?.nombre : "Todos los torneos"}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Total jugadores: {filtered.reduce((acc, i) => acc + (i.jugador1_id ? 1 : 0) + (i.jugador2_id ? 1 : 0), 0)}</p>
              <p>Fecha: {new Date().toLocaleDateString("es-AR")}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-800">
                <th className="py-2 px-2 text-left font-bold w-12">N°</th>
                <th className="py-2 px-2 text-left font-bold">Apellido y Nombre</th>
                <th className="py-2 px-2 text-left font-bold w-48">DNI</th>
                <th className="py-2 px-2 text-left font-bold w-32">Firma / Control</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: { name: string; dni: string }[] = [];
                filtered.forEach((i) => {
                  const j1 = (i as InscripcionConJugadores).jugador1;
                  const j2 = (i as InscripcionConJugadores).jugador2;
                  if (j1) rows.push({ name: `${j1.apellido}, ${j1.nombre}`, dni: j1.dni || "—" });
                  if (j2) rows.push({ name: `${j2.apellido}, ${j2.nombre}`, dni: j2.dni || "—" });
                });
                rows.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                return rows.map((row, index) => (
                  <tr key={index} className="border-b border-gray-300">
                    <td className="py-3 px-2 font-mono text-gray-500">{index + 1}</td>
                    <td className="py-3 px-2 font-semibold">{row.name}</td>
                    <td className="py-3 px-2 font-mono">{row.dni}</td>
                    <td className="py-3 px-2">
                      <div className="h-6 border-b border-dashed border-gray-400 w-24"></div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </>
      )}
    </div>
    </>
  );
}
