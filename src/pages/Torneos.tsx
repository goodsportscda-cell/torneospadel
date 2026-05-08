import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Calendar as CalIcon, MapPin, Award, Link2, Globe, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { calcularRankingTorneo } from "@/lib/ranking";
import type { Database } from "@/integrations/supabase/types";

import {
  ESTADO_TORNEO_LABELS as ESTADO_LABELS,
  ESTADO_TORNEO_BADGE,
  ESTADO_TORNEO_ORDEN,
  type EstadoTorneo,
} from "@/lib/estadoTorneo";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Categoria = Database["public"]["Tables"]["categorias"]["Row"];
type TipoTorneo = Database["public"]["Enums"]["tipo_torneo"];
type Genero = Database["public"]["Enums"]["genero_categoria"];

interface FormState {
  nombre: string;
  tipo: TipoTorneo;
  categoria_id: string;
  categoria_libre: string;
  genero: Genero | "";
  fecha_inicio: string;
  fecha_fin: string;
  sede: string;
  costo_inscripcion: string;
  premios: string;
  estado: EstadoTorneo;
  notas: string;
  numero_fecha: string;
  multiplicador_puntos: string;
  cupo_maximo: string;
}

const emptyForm: FormState = {
  nombre: "",
  tipo: "oficial",
  categoria_id: "",
  categoria_libre: "",
  genero: "",
  fecha_inicio: "",
  fecha_fin: "",
  sede: "",
  costo_inscripcion: "",
  premios: "",
  estado: "inscripciones_abiertas",
  notas: "",
  numero_fecha: "",
  multiplicador_puntos: "1",
  cupo_maximo: "",
};

const generateSlug = (nombre: string) => {
  return nombre
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9]+/g, "-") // reemplazar no-alfanumericos por guion
    .replace(/^-+|-+$/g, ""); // limpiar guiones al inicio/fin
};

export default function Torneos() {
  const [torneos, setTorneos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: t, error: et }, { data: c, error: ec }] = await Promise.all([
      supabase.from("torneos").select("*").order("fecha_inicio", { ascending: false }),
      supabase.from("categorias").select("*").eq("activa", true).order("orden"),
    ]);
    if (et) toast.error("Error cargando torneos: " + et.message);
    if (ec) toast.error("Error cargando categorías: " + ec.message);
    setTorneos(t ?? []);
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

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({
      nombre: t.nombre,
      tipo: t.tipo,
      categoria_id: t.categoria_id ?? "",
      categoria_libre: t.categoria_libre ?? "",
      genero: t.genero ?? "",
      fecha_inicio: t.fecha_inicio,
      fecha_fin: t.fecha_fin ?? "",
      sede: t.sede ?? "",
      costo_inscripcion: t.costo_inscripcion?.toString() ?? "",
      premios: t.premios ?? "",
      estado: t.estado,
      notas: t.notas ?? "",
      numero_fecha: t.numero_fecha?.toString() ?? "",
      multiplicador_puntos: t.multiplicador_puntos?.toString() ?? "1",
      cupo_maximo: t.cupo_maximo?.toString() ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (!form.fecha_inicio) {
      toast.error("La fecha de inicio es obligatoria");
      return;
    }
    if (form.tipo === "oficial" && !form.categoria_id) {
      toast.error("Seleccioná una categoría para el torneo oficial");
      return;
    }
    if (form.tipo === "americano" && !form.categoria_libre.trim()) {
      toast.error("Indicá la categoría del americano");
      return;
    }

    // Generamos el slug si no existe o si cambió el nombre
    const slug = generateSlug(form.nombre);

    const payload: any = {
      nombre: form.nombre.trim(),
      // slug, // Temporalmente deshabilitado por error de cache en Supabase
      tipo: form.tipo,
      categoria_id: form.tipo === "oficial" ? form.categoria_id : null,
      categoria_libre: form.tipo === "americano" ? form.categoria_libre.trim() : null,
      genero: form.genero || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin || null,
      sede: form.sede.trim() || null,
      costo_inscripcion: form.costo_inscripcion ? Number(form.costo_inscripcion) : null,
      premios: form.premios.trim() || null,
      estado: form.estado,
      notas: form.notas.trim() || null,
      numero_fecha: form.numero_fecha ? Number(form.numero_fecha) : null,
      multiplicador_puntos: form.multiplicador_puntos ? Number(form.multiplicador_puntos) : 1,
      cupo_maximo: form.cupo_maximo ? Number(form.cupo_maximo) : null,
    };

    if (editing) {
      const { error } = await supabase.from("torneos").update(payload).eq("id", editing.id);
      if (error) return toast.error("Error al guardar: " + error.message);
      toast.success("Torneo actualizado");
    } else {
      const { error } = await supabase.from("torneos").insert(payload);
      if (error) return toast.error("Error al crear: " + error.message);
      toast.success("Torneo creado");
    }
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("torneos").delete().eq("id", id);
    if (error) return toast.error("Error al eliminar: " + error.message);
    toast.success("Torneo eliminado");
    fetchAll();
  };

  const handleQuickEstado = async (t: any, estado: EstadoTorneo) => {
    const { error } = await supabase.from("torneos").update({ estado }).eq("id", t.id);
    if (error) return toast.error("Error: " + error.message);
    // Si pasa a finalizado, calcular ranking automáticamente
    if (estado === "finalizado") {
      const res = await calcularRankingTorneo(t.id);
      if (res.ok) {
        toast.success(`Estado actualizado. Ranking calculado (${res.jugadoresConPuntos} registros).`);
      } else {
        toast.error("Estado actualizado, pero falló el cálculo de ranking: " + res.error);
      }
    } else {
      toast.success("Estado actualizado");
    }
    fetchAll();
  };

  const handleRecalcularRanking = async (t: any) => {
    const res = await calcularRankingTorneo(t.id);
    if (res.ok) {
      toast.success(`Ranking recalculado: ${res.jugadoresConPuntos} registros.`);
    } else {
      toast.error("Error al recalcular: " + res.error);
    }
  };

  // URLs dinámicas
  const SHARE_INSCRIPCION_URL = `${window.location.origin}/inscribirse`;
  const SHARE_TORNEO_URL = `${window.location.origin}/torneo`;

  const handleCopiarLinkInscripcion = async (t: any) => {
    // Si hay error con el slug, usamos el ID para asegurar que funcione
    const identificador = t.id; 
    const url = `${SHARE_INSCRIPCION_URL}/${identificador}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de inscripción (por ID) copiado");
    } catch {
      window.prompt("Copiá el link:", url);
    }
  };

  const handleCopiarLinkPublico = async (t: any) => {
    const identificador = t.id;
    const url = `${SHARE_TORNEO_URL}/${identificador}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link del muro (por ID) copiado");
    } catch {
      window.prompt("Copiá el link:", url);
    }
  };

  const categoriaNombre = (t: Torneo) => {
    if (t.tipo === "americano") return t.categoria_libre ?? "—";
    const c = categorias.find((c) => c.id === t.categoria_id);
    if (!c) return "—";
    return `${c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} ${c.nombre}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Torneos</h1>
          <p className="text-sm text-muted-foreground">
            Crear, editar y cambiar el estado de los torneos.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo torneo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar torneo" : "Nuevo torneo"}</DialogTitle>
              <DialogDescription>
                Completá los datos del torneo. Los campos marcados son obligatorios.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Torneo de Otoño 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Tipo *</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v: TipoTorneo) =>
                      setForm({ ...form, tipo: v, categoria_id: "", categoria_libre: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oficial">Oficial</SelectItem>
                      <SelectItem value="americano">Americano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Estado *</Label>
                  <Select
                    value={form.estado}
                    onValueChange={(v: EstadoTorneo) => setForm({ ...form, estado: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADO_TORNEO_ORDEN.map((e) => (
                        <SelectItem key={e} value={e}>
                          {ESTADO_LABELS[e]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.tipo === "oficial" ? (
                <div className="grid gap-1.5">
                  <Label>Categoría *</Label>
                  <Select
                    value={form.categoria_id}
                    onValueChange={(v) => setForm({ ...form, categoria_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegir categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.genero === "caballeros" ? "Caballeros" : c.genero === "damas" ? "Damas" : "Mixto"} — {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="cat-libre">Categoría *</Label>
                    <Input
                      id="cat-libre"
                      value={form.categoria_libre}
                      onChange={(e) => setForm({ ...form, categoria_libre: e.target.value })}
                      placeholder="Ej: 4ta-5ta"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Género</Label>
                    <Select
                      value={form.genero}
                      onValueChange={(v: Genero) => setForm({ ...form, genero: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caballeros">Caballeros</SelectItem>
                        <SelectItem value="damas">Damas</SelectItem>
                        <SelectItem value="mixto">Mixto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="fi">Fecha inicio *</Label>
                  <Input
                    id="fi"
                    type="date"
                    value={form.fecha_inicio}
                    onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ff">Fecha fin</Label>
                  <Input
                    id="ff"
                    type="date"
                    value={form.fecha_fin}
                    onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sede">Sede</Label>
                <Input
                  id="sede"
                  value={form.sede}
                  onChange={(e) => setForm({ ...form, sede: e.target.value })}
                  placeholder="Club / dirección"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="costo">Costo inscripción</Label>
                  <Input
                    id="costo"
                    type="number"
                    inputMode="decimal"
                    value={form.costo_inscripcion}
                    onChange={(e) => setForm({ ...form, costo_inscripcion: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="premios">Premios</Label>
                  <Input
                    id="premios"
                    value={form.premios}
                    onChange={(e) => setForm({ ...form, premios: e.target.value })}
                    placeholder="Ej: $50.000 + trofeos"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="nfecha">N° de fecha (1-7)</Label>
                  <Input
                    id="nfecha"
                    type="number"
                    min="1"
                    max="7"
                    value={form.numero_fecha}
                    onChange={(e) => {
                      const v = e.target.value;
                      const mult = v === "4" ? "2" : (form.multiplicador_puntos === "2" && form.numero_fecha === "4") ? "1" : form.multiplicador_puntos;
                      setForm({ ...form, numero_fecha: v, multiplicador_puntos: mult });
                    }}
                    placeholder="Ej: 1, 2, 3..."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="mult">Multiplicador puntos</Label>
                  <Input
                    id="mult"
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={form.multiplicador_puntos}
                    onChange={(e) => setForm({ ...form, multiplicador_puntos: e.target.value })}
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cupo">Cupo máximo (opcional)</Label>
                <Input
                  id="cupo"
                  type="number"
                  min="1"
                  value={form.cupo_maximo}
                  onChange={(e) => setForm({ ...form, cupo_maximo: e.target.value })}
                  placeholder="Ej: 16. Vacío = sin límite"
                />
                <p className="text-xs text-muted-foreground">
                  Las inscripciones públicas que superen el cupo quedan en lista de espera.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>{editing ? "Guardar cambios" : "Crear torneo"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : torneos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Todavía no hay torneos cargados. Hacé clic en "Nuevo torneo" para crear el primero.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {torneos.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CardTitle className="text-base truncate">{t.nombre}</CardTitle>
                      {Number(t.multiplicador_puntos) >= 2 && (
                        <Badge className="shrink-0 bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-5">
                          x{Number(t.multiplicador_puntos)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.tipo === "americano" ? "Americano" : "Oficial"} · {categoriaNombre(t)}
                      {t.numero_fecha && ` · Fecha ${t.numero_fecha}`}
                    </p>
                  </div>
                  <Badge className={`shrink-0 ${ESTADO_TORNEO_BADGE[t.estado]}`}>
                    {ESTADO_LABELS[t.estado]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalIcon className="h-3.5 w-3.5" />
                  <span>
                    {new Date(t.fecha_inicio).toLocaleDateString("es-AR")}
                    {t.fecha_fin && ` → ${new Date(t.fecha_fin).toLocaleDateString("es-AR")}`}
                  </span>
                </div>
                {t.sede && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{t.sede}</span>
                  </div>
                )}

                <div className="grid gap-1.5 pt-1">
                  <Label className="text-xs text-muted-foreground">Cambiar estado</Label>
                  <Select value={t.estado} onValueChange={(v: EstadoTorneo) => handleQuickEstado(t, v)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADO_TORNEO_ORDEN.map((e) => (
                        <SelectItem key={e} value={e}>
                          {ESTADO_LABELS[e]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {t.estado === "finalizado" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => handleRecalcularRanking(t)}
                  >
                    <Award className="h-3.5 w-3.5" />
                    Recalcular ranking
                  </Button>
                )}

                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopiarLinkInscripcion(t)}
                    title="Copiar link de inscripción"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopiarLinkPublico(t)}
                    title="Copiar link del muro de resultados"
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar torneo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará "{t.nombre}" y no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(t.id)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
