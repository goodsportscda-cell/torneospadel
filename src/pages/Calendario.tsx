import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  List as ListIcon,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import {
  ESTADO_TORNEO_LABELS as ESTADO_LABELS,
  ESTADO_TORNEO_BADGE as ESTADO_CLASS,
  ESTADO_TORNEO_DOT as ESTADO_DOT,
  ESTADO_TORNEO_ORDEN,
  type EstadoTorneo,
} from "@/lib/estadoTorneo";

type Torneo = Database["public"]["Tables"]["torneos"]["Row"];
type Categoria = Database["public"]["Tables"]["categorias"]["Row"];
type TipoTorneo = Database["public"]["Enums"]["tipo_torneo"];
type Genero = Database["public"]["Enums"]["genero_categoria"];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
  estado: EstadoTorneo;
  notas: string;
  numero_fecha: string;
  multiplicador_puntos: string;
  desafio_semanas: string;
  ingresos_sponsors: string;
  gastos_trofeos: string;
  gastos_regalos: string;
  canchas_count: string;
  costo_fecha_jugador: string;
  costo_fecha_cancha: string;
  porcentaje_premios: string;
  modalidad: string;
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
  estado: "inscripciones_abiertas",
  notes: "", // keep backwards compatibility or use notes
  notas: "",
  numero_fecha: "",
  multiplicador_puntos: "1",
  desafio_semanas: "8",
  ingresos_sponsors: "0",
  gastos_trofeos: "0",
  gastos_regalos: "0",
  canchas_count: "3",
  costo_fecha_jugador: "10000",
  costo_fecha_cancha: "22000",
  porcentaje_premios: "60",
  modalidad: "individual",
};

// helpers fecha (YYYY-MM-DD locales sin TZ)
const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function Calendario() {
  const { clubId } = useAuth();
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [vista, setVista] = useState<"grilla" | "lista">("grilla");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Torneo | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchAll = async () => {
    setLoading(true);
    let tQuery = supabase.from("torneos").select("*").order("fecha_inicio", { ascending: true });
    let cQuery = supabase.from("categorias").select("*").eq("activa", true).order("orden");

    if (clubId) {
      tQuery = tQuery.eq("club_id", clubId);
      cQuery = cQuery.eq("club_id", clubId);
    }

    const [{ data: t }, { data: c }] = await Promise.all([tQuery, cQuery]);
    setTorneos(t ?? []);
    setCategorias(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const categoriaNombre = (t: Torneo) => {
    if (t.tipo === "americano" || t.tipo === "americano_individual") return t.categoria_libre ?? "—";
    const c = categorias.find((c) => c.id === t.categoria_id);
    if (!c) return "—";
    return `${c.genero === "caballeros" ? "Cab." : c.genero === "damas" ? "Dam." : "Mix."} ${c.nombre}`;
  };

  // Torneos del año/mes (mostrados en grilla)
  const torneosDelMes = useMemo(() => {
    const inicio = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const fin = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return torneos.filter((t) => {
      const ti = parseYmd(t.fecha_inicio);
      const tf = t.fecha_fin ? parseYmd(t.fecha_fin) : ti;
      return tf >= inicio && ti <= fin;
    });
  }, [torneos, cursor]);

  // Para vista lista: agrupar por mes, año del cursor
  const torneosPorMes = useMemo(() => {
    const anio = cursor.getFullYear();
    const map = new Map<number, Torneo[]>();
    torneos
      .filter((t) => parseYmd(t.fecha_inicio).getFullYear() === anio)
      .forEach((t) => {
        const m = parseYmd(t.fecha_inicio).getMonth();
        const arr = map.get(m) ?? [];
        arr.push(t);
        map.set(m, arr);
      });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [torneos, cursor]);

  // Construir grilla del mes (Lunes a Domingo)
  const gridDias = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    // Lunes = 0
    const startOffset = (first.getDay() + 6) % 7;
    const dias: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) dias.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      dias.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    while (dias.length % 7 !== 0) dias.push(null);
    return dias;
  }, [cursor]);

  const torneosEnDia = (d: Date) =>
    torneos.filter((t) => {
      const ti = parseYmd(t.fecha_inicio);
      
      if (t.tipo === "americano_individual") {
        const semanas = t.desafio_semanas ?? 8;
        const startDay = new Date(ti.getFullYear(), ti.getMonth(), ti.getDate());
        const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        
        // Calculate difference in days
        const diffTime = targetDay.getTime() - startDay.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays >= 0 && diffDays % 7 === 0 && diffDays < (semanas * 7);
      }
      
      const tf = t.fecha_fin ? parseYmd(t.fecha_fin) : ti;
      return d >= new Date(ti.getFullYear(), ti.getMonth(), ti.getDate()) &&
        d <= new Date(tf.getFullYear(), tf.getMonth(), tf.getDate());
    });

  const openCreateOnDate = (fecha: string) => {
    setEditing(null);
    setForm({ ...emptyForm, fecha_inicio: fecha });
    setDialogOpen(true);
  };

  const openEdit = (t: Torneo) => {
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
      estado: t.estado,
      notas: t.notas ?? "",
      numero_fecha: t.numero_fecha?.toString() ?? "",
      multiplicador_puntos: t.multiplicador_puntos?.toString() ?? "1",
      desafio_semanas: t.desafio_semanas?.toString() ?? "8",
      ingresos_sponsors: t.ingresos_sponsors?.toString() ?? "0",
      gastos_trofeos: t.gastos_trofeos?.toString() ?? "0",
      gastos_regalos: t.gastos_regalos?.toString() ?? "0",
      canchas_count: t.canchas_count?.toString() ?? "3",
      costo_fecha_jugador: t.costo_fecha_jugador?.toString() ?? "10000",
      costo_fecha_cancha: t.costo_fecha_cancha?.toString() ?? "22000",
      porcentaje_premios: t.porcentaje_premios?.toString() ?? "60",
      modalidad: t.modalidad ?? "individual",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return toast.error("El nombre es obligatorio");
    if (!form.fecha_inicio) return toast.error("La fecha de inicio es obligatoria");
    if (form.tipo === "oficial" && !form.categoria_id)
      return toast.error("Seleccioná una categoría");
    if ((form.tipo === "americano" || form.tipo === "americano_individual") && !form.categoria_libre.trim())
      return toast.error("Indicá la categoría del torneo");
    if (form.tipo === "americano_individual" && (Number(form.desafio_semanas) || 0) < 7) {
      return toast.error("La duración del torneo Desafío debe ser de al menos 7 semanas.");
    }

    let computedFechaFin = form.fecha_fin || null;
    if (form.tipo === "americano_individual") {
      const semanasVal = Math.max(7, Number(form.desafio_semanas) || 8);
      const start = new Date(form.fecha_inicio + "T00:00:00");
      const end = new Date(start.getTime() + (semanasVal - 1) * 7 * 24 * 60 * 60 * 1000);
      const ey = end.getFullYear();
      const em = String(end.getMonth() + 1).padStart(2, "0");
      const ed = String(end.getDate()).padStart(2, "0");
      computedFechaFin = `${ey}-${em}-${ed}`;
    }

    const payload = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      categoria_id: form.tipo === "oficial" ? form.categoria_id : null,
      categoria_libre: (form.tipo === "americano" || form.tipo === "americano_individual") ? form.categoria_libre.trim() : null,
      genero: form.genero || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: computedFechaFin,
      sede: form.sede.trim() || null,
      costo_inscripcion: form.costo_inscripcion ? Number(form.costo_inscripcion) : null,
      estado: form.estado,
      notas: form.notas.trim() || null,
      numero_fecha: form.numero_fecha ? Number(form.numero_fecha) : null,
      multiplicador_puntos: form.multiplicador_puntos ? Number(form.multiplicador_puntos) : 1,
      desafio_semanas: form.tipo === "americano_individual" ? Math.max(7, Number(form.desafio_semanas) || 8) : null,
      ingresos_sponsors: form.tipo === "americano_individual" ? Number(form.ingresos_sponsors) || 0 : null,
      gastos_trofeos: form.tipo === "americano_individual" ? Number(form.gastos_trofeos) || 0 : null,
      gastos_regalos: form.tipo === "americano_individual" ? Number(form.gastos_regalos) || 0 : null,
      canchas_count: form.tipo === "americano_individual" ? Number(form.canchas_count) || 3 : null,
      costo_fecha_jugador: form.tipo === "americano_individual" ? Number(form.costo_fecha_jugador) || 10000 : null,
      costo_fecha_cancha: form.tipo === "americano_individual" ? Number(form.costo_fecha_cancha) || 22000 : null,
      porcentaje_premios: form.tipo === "americano_individual" ? Number(form.porcentaje_premios) || 60 : null,
      modalidad: form.tipo === "americano_individual" ? (form.modalidad || "individual") : null,
      club_id: clubId,
    };

    if (editing) {
      const { error } = await supabase.from("torneos").update(payload).eq("id", editing.id);
      if (error) return toast.error("Error: " + error.message);
      toast.success("Torneo actualizado");
    } else {
      const { error } = await supabase.from("torneos").insert(payload);
      if (error) return toast.error("Error: " + error.message);
      toast.success("Torneo creado");
    }
    setDialogOpen(false);
    fetchAll();
  };

  const cambiarMes = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };
  const irHoy = () => {
    const t = new Date();
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  const hoy = new Date();
  const tituloMes = `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalIcon className="h-6 w-6" />
            Calendario
          </h1>
          <p className="text-sm text-muted-foreground">
            Vista mensual de torneos. Hacé click en un día para crear, o en un torneo para editarlo.
          </p>
        </div>
        <Button
          onClick={() => openCreateOnDate(ymd(new Date()))}
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Nuevo torneo
        </Button>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {ESTADO_TORNEO_ORDEN.map((e) => (
          <div key={e} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${ESTADO_DOT[e]}`} />
            <span>{ESTADO_LABELS[e]}</span>
          </div>
        ))}
      </div>

      <Tabs value={vista} onValueChange={(v) => setVista(v as "grilla" | "lista")}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="grilla">
              <LayoutGrid className="h-4 w-4" />
              Grilla
            </TabsTrigger>
            <TabsTrigger value="lista">
              <ListIcon className="h-4 w-4" />
              Lista
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cambiarMes(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={irHoy}>Hoy</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cambiarMes(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-sm font-semibold capitalize min-w-[140px] text-right">
              {vista === "grilla" ? tituloMes : cursor.getFullYear()}
            </span>
          </div>
        </div>

        {/* GRILLA MENSUAL */}
        <TabsContent value="grilla" className="mt-3">
          <Card>
            <CardContent className="p-2 sm:p-3">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="text-[10px] sm:text-xs font-semibold text-muted-foreground text-center py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {gridDias.map((d, idx) => {
                  if (!d) {
                    return <div key={idx} className="aspect-square sm:aspect-auto sm:min-h-24 rounded-md bg-muted/20" />;
                  }
                  const tDia = torneosEnDia(d);
                  const esHoy = sameDay(d, hoy);
                  return (
                    <button
                      key={idx}
                      onClick={() => openCreateOnDate(ymd(d))}
                      className={`text-left rounded-md border p-1 sm:p-1.5 min-h-[60px] sm:min-h-24 hover:bg-accent/40 transition-colors ${
                        esHoy ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className={`text-[11px] sm:text-xs font-semibold mb-1 ${esHoy ? "text-primary" : ""}`}>
                        {d.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {tDia.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(t);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.stopPropagation();
                                openEdit(t);
                              }
                            }}
                            className={`text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded truncate border flex items-center gap-1 ${ESTADO_CLASS[t.estado]}`}
                            title={`${t.nombre} — ${ESTADO_LABELS[t.estado]}${Number(t.multiplicador_puntos) >= 2 ? ` (x${t.multiplicador_puntos} puntos)` : ""}`}
                          >
                            <span className="truncate flex-1">
                              {t.numero_fecha ? `F${t.numero_fecha} ` : ""}{t.nombre}
                            </span>
                            {Number(t.multiplicador_puntos) >= 2 && (
                              <span className="shrink-0 font-bold bg-background/30 px-1 rounded text-[8px] sm:text-[9px]">
                                x{Number(t.multiplicador_puntos)}
                              </span>
                            )}
                          </div>
                        ))}
                        {tDia.length > 2 && (
                          <div className="text-[9px] sm:text-[10px] text-muted-foreground px-1">
                            +{tDia.length - 2} más
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {torneosDelMes.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              {torneosDelMes.length} torneo{torneosDelMes.length === 1 ? "" : "s"} en {tituloMes}
            </div>
          )}
        </TabsContent>

        {/* LISTA POR MES */}
        <TabsContent value="lista" className="mt-3 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : torneosPorMes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No hay torneos cargados en {cursor.getFullYear()}.
              </CardContent>
            </Card>
          ) : (
            torneosPorMes.map(([mes, lista]) => (
              <div key={mes} className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {MESES[mes]}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {lista.map((t) => {
                    const ti = parseYmd(t.fecha_inicio);
                    const tf = t.fecha_fin ? parseYmd(t.fecha_fin) : null;
                    return (
                      <button
                        key={t.id}
                        onClick={() => openEdit(t)}
                        className="text-left rounded-lg border p-3 hover:bg-accent/40 transition-colors flex items-start gap-3"
                      >
                        <div className="flex flex-col items-center justify-center bg-muted rounded-md px-2 py-1 min-w-[44px]">
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {MESES[ti.getMonth()].slice(0, 3)}
                          </span>
                          <span className="text-lg font-bold leading-none">{ti.getDate()}</span>
                          {tf && tf.getDate() !== ti.getDate() && (
                            <span className="text-[9px] text-muted-foreground">→ {tf.getDate()}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`h-2 w-2 rounded-full ${ESTADO_DOT[t.estado]}`} />
                            <span className="font-medium text-sm truncate">{t.nombre}</span>
                            {t.numero_fecha && (
                              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                Fecha {t.numero_fecha}
                              </Badge>
                            )}
                            {Number(t.multiplicador_puntos) >= 2 && (
                              <Badge className="h-4 px-1 text-[10px] bg-primary text-primary-foreground">
                                x{Number(t.multiplicador_puntos)}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {categoriaNombre(t)}
                            {t.sede && (
                              <>
                                <span className="mx-1">·</span>
                                <MapPin className="inline h-3 w-3 mr-0.5" />
                                {t.sede}
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Crear/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar torneo" : "Nuevo torneo"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Modificá los datos del torneo."
                : "Completá los datos. Podés cargar todas las fechas oficiales del año desde acá."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: 1ra Fecha 2026"
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oficial">Oficial</SelectItem>
                    <SelectItem value="americano">Americano</SelectItem>
                    <SelectItem value="americano_individual">Americano Individual (Crown)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Estado *</Label>
                <Select
                  value={form.estado}
                  onValueChange={(v: EstadoTorneo) => setForm({ ...form, estado: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADO_TORNEO_ORDEN.map((e) => (
                      <SelectItem key={e} value={e}>{ESTADO_LABELS[e]}</SelectItem>
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
                  <SelectTrigger><SelectValue placeholder="Elegir categoría" /></SelectTrigger>
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
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
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

            {form.tipo === "americano_individual" && (
              <div className="border p-3 rounded-md space-y-3 bg-muted/30">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configuración Desafío</h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="modalidad">Modalidad *</Label>
                    <Select
                      value={form.modalidad || "individual"}
                      onValueChange={(v) => setForm({ ...form, modalidad: v })}
                    >
                      <SelectTrigger id="modalidad">
                        <SelectValue placeholder="Modalidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="parejas">Parejas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="semanas">Semanas *</Label>
                    <Input
                      id="semanas"
                      type="number"
                      min="7"
                      value={form.desafio_semanas}
                      onChange={(e) => setForm({ ...form, desafio_semanas: e.target.value })}
                      placeholder="Mínimo 7"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="canchas">Canchas *</Label>
                    <Input
                      id="canchas"
                      type="number"
                      min="1"
                      value={form.canchas_count}
                      onChange={(e) => setForm({ ...form, canchas_count: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="costo-jug">Costo por fecha/jugador *</Label>
                    <Input
                      id="costo-jug"
                      type="number"
                      value={form.costo_fecha_jugador}
                      onChange={(e) => setForm({ ...form, costo_fecha_jugador: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="costo-can">Costo alquiler/cancha/fecha *</Label>
                    <Input
                      id="costo-can"
                      type="number"
                      value={form.costo_fecha_cancha}
                      onChange={(e) => setForm({ ...form, costo_fecha_cancha: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="premios-porc">% para Premios *</Label>
                    <Input
                      id="premios-porc"
                      type="number"
                      min="0"
                      max="100"
                      value={form.porcentaje_premios}
                      onChange={(e) => setForm({ ...form, porcentaje_premios: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sponsors">Ingresos Sponsors</Label>
                    <Input
                      id="sponsors"
                      type="number"
                      value={form.ingresos_sponsors}
                      onChange={(e) => setForm({ ...form, ingresos_sponsors: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="trofeos">Gastos Trofeos</Label>
                    <Input
                      id="trofeos"
                      type="number"
                      value={form.gastos_trofeos}
                      onChange={(e) => setForm({ ...form, gastos_trofeos: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="regalos">Gastos Regalos / Extras</Label>
                    <Input
                      id="regalos"
                      type="number"
                      value={form.gastos_regalos}
                      onChange={(e) => setForm({ ...form, gastos_regalos: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Guardar cambios" : "Crear torneo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
