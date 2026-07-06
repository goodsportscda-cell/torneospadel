import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { Plus, Pencil, Trash2, Calendar as CalIcon, MapPin, Award, Link2, Globe, ExternalLink, Settings } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
  canchas_count: string;
  costo_fecha_jugador: string;
  costo_fecha_cancha: string;
  porcentaje_premios: string;
  desafio_semanas: string;
  ingresos_sponsors: string;
  gastos_trofeos: string;
  gastos_regalos: string;
  modalidad: string;
  datos_bancarios: string;
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
  canchas_count: "3",
  costo_fecha_jugador: "10000",
  costo_fecha_cancha: "22000",
  porcentaje_premios: "60",
  desafio_semanas: "8",
  ingresos_sponsors: "0",
  gastos_trofeos: "0",
  gastos_regalos: "0",
  modalidad: "individual",
  datos_bancarios: "",
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
  const { clubId, isSuperAdmin } = useAuth();
  const [torneos, setTorneos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchAll = async () => {
    setLoading(true);
    let torneosQuery = supabase.from("torneos").select("*").order("fecha_inicio", { ascending: false });
    let categoriasQuery = supabase.from("categorias").select("*").eq("activa", true).order("orden");
    
    if (!isSuperAdmin && clubId) {
      torneosQuery = torneosQuery.eq("club_id", clubId);
      categoriasQuery = categoriasQuery.eq("club_id", clubId);
    }

    const [{ data: t, error: et }, { data: c, error: ec }] = await Promise.all([torneosQuery, categoriasQuery]);
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
      canchas_count: t.canchas_count?.toString() ?? "3",
      costo_fecha_jugador: t.costo_fecha_jugador?.toString() ?? "10000",
      costo_fecha_cancha: t.costo_fecha_cancha?.toString() ?? "22000",
      porcentaje_premios: t.porcentaje_premios?.toString() ?? "60",
      desafio_semanas: t.desafio_semanas?.toString() ?? "8",
      ingresos_sponsors: t.ingresos_sponsors?.toString() ?? "0",
      gastos_trofeos: t.gastos_trofeos?.toString() ?? "0",
      gastos_regalos: t.gastos_regalos?.toString() ?? "0",
      modalidad: t.modalidad ?? "individual",
      datos_bancarios: t.datos_bancarios ?? "",
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
    if ((form.tipo === "americano" || form.tipo === "americano_individual") && !form.categoria_libre.trim()) {
      toast.error("Indicá la categoría del torneo");
      return;
    }
    if (form.tipo === "americano_individual") {
      if (!form.canchas_count || Number(form.canchas_count) < 1) {
        toast.error("Indicá una cantidad válida de canchas");
        return;
      }
      if (!form.costo_fecha_jugador || Number(form.costo_fecha_jugador) < 0) {
        toast.error("Indicá un costo por jugador válido");
        return;
      }
      if (!form.costo_fecha_cancha || Number(form.costo_fecha_cancha) < 0) {
        toast.error("Indicá un costo de cancha válido");
        return;
      }
      if (!form.porcentaje_premios || Number(form.porcentaje_premios) < 0 || Number(form.porcentaje_premios) > 100) {
        toast.error("Indicá un porcentaje de premios válido (0-100)");
        return;
      }
      if ((Number(form.desafio_semanas) || 0) < 7) {
        toast.error("La duración del torneo Desafío debe ser de al menos 7 semanas.");
        return;
      }
    }

    // Generamos el slug si no existe o si cambió el nombre
    const slug = generateSlug(form.nombre);

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

    const payload: any = {
      nombre: form.nombre.trim(),
      // slug, // Temporalmente deshabilitado por error de cache en Supabase
      tipo: form.tipo,
      categoria_id: form.tipo === "oficial" ? form.categoria_id : null,
      categoria_libre: (form.tipo === "americano" || form.tipo === "americano_individual") ? form.categoria_libre.trim() : null,
      genero: form.genero || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: computedFechaFin,
      sede: form.sede.trim() || null,
      costo_inscripcion: form.costo_inscripcion ? Number(form.costo_inscripcion) : null,
      premios: form.premios.trim() || null,
      estado: form.estado,
      notas: form.notas.trim() || null,
      numero_fecha: form.numero_fecha ? Number(form.numero_fecha) : null,
      multiplicador_puntos: form.multiplicador_puntos ? Number(form.multiplicador_puntos) : 1,
      cupo_maximo: form.cupo_maximo ? Number(form.cupo_maximo) : null,
      canchas_count: form.tipo === "americano_individual" ? Number(form.canchas_count) : null,
      costo_fecha_jugador: form.tipo === "americano_individual" ? Number(form.costo_fecha_jugador) : null,
      costo_fecha_cancha: form.tipo === "americano_individual" ? Number(form.costo_fecha_cancha) : null,
      porcentaje_premios: form.tipo === "americano_individual" ? Number(form.porcentaje_premios) : null,
      desafio_semanas: form.tipo === "americano_individual" ? Math.max(7, Number(form.desafio_semanas) || 8) : null,
      ingresos_sponsors: form.tipo === "americano_individual" ? Number(form.ingresos_sponsors) || 0 : null,
      gastos_trofeos: form.tipo === "americano_individual" ? Number(form.gastos_trofeos) || 0 : null,
      gastos_regalos: form.tipo === "americano_individual" ? Number(form.gastos_regalos) || 0 : null,
      modalidad: form.tipo === "americano_individual" ? (form.modalidad || "individual") : null,
      datos_bancarios: form.datos_bancarios || null,
      club_id: clubId, // Se asigna automáticamente al club del admin
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
    // Si es el torneo con problemas (7ma Cab 1° fecha), actualizamos los partidos llave primero
    if (t.id === "b48f2420-d6fa-433a-9344-3b5683664828") {
      try {
        toast.loading("Corrigiendo cruces de partidos del torneo en la base de datos...", { id: "fix-llave" });
        
        // Inscription IDs
        const emilioGuillermo = "f332b83b-47a9-4c56-a217-24b0211f739d";
        const felipePena = "44a41ac7-19f0-4a85-a6db-c42b2bcb517a";
        const benjaminLorenzo = "2de442ac-efcb-4ca8-84a6-d4f2fc84b48d";
        const arielCamilo = "a371dac5-528e-48c0-bfe7-5ee7c0e69b30";
        const jesusLucio = "20c45d6d-d3b8-485d-b26f-d7d67898f96d";
        const guidoMiguel = "abff7577-f137-4b32-a494-7f42ae8fb22c";
        const joseAlexis = "9975e6f7-fad0-4e36-a8ab-aa9bc51907df";
        const jeremiasJulian = "02117a32-5557-41e9-8af1-8645fe852ae8";
        const facundoGerardo = "8e06608b-634a-4e15-9be9-5958a987b2bf";
        const ramiroFranco = "8149f3cf-59a4-48fa-b3dc-c790aeb36b86";
        const facundoEnzo = "56de8bdd-35f1-4928-9b50-a26a48c5d6b6";

        await Promise.all([
          supabase.from("partidos_llave").update({ pareja_local_id: emilioGuillermo, pareja_visitante_id: felipePena, ganador_id: emilioGuillermo }).eq("id", "4ebbd752-b9e4-455c-b512-9525d557133d"),
          supabase.from("partidos_llave").update({ pareja_local_id: benjaminLorenzo, pareja_visitante_id: arielCamilo, ganador_id: benjaminLorenzo }).eq("id", "24900453-17e8-4dc4-ba3c-516f2b20b5ee"),
          supabase.from("partidos_llave").update({ pareja_local_id: jesusLucio, pareja_visitante_id: guidoMiguel, ganador_id: jesusLucio }).eq("id", "1589f28f-9041-4e70-858c-9708bf03cb0d"),
          supabase.from("partidos_llave").update({ pareja_local_id: joseAlexis, pareja_visitante_id: jeremiasJulian, ganador_id: joseAlexis }).eq("id", "679e8249-67e2-48de-b921-843a4272f307"),
          supabase.from("partidos_llave").update({ pareja_local_id: facundoGerardo, pareja_visitante_id: ramiroFranco, ganador_id: facundoGerardo }).eq("id", "3e3afc8c-d3a6-4bbe-b954-00456f6042e2"),
          supabase.from("partidos_llave").update({ pareja_local_id: emilioGuillermo, pareja_visitante_id: benjaminLorenzo, ganador_id: benjaminLorenzo }).eq("id", "9aca934c-2567-4c08-b8a5-a88e2a9e8861"),
          supabase.from("partidos_llave").update({ pareja_local_id: jesusLucio, pareja_visitante_id: facundoEnzo, ganador_id: jesusLucio }).eq("id", "9cda33c1-b662-45a2-b939-4742388a3a69"),
          supabase.from("partidos_llave").update({ pareja_local_id: joseAlexis, pareja_visitante_id: facundoGerardo, ganador_id: joseAlexis }).eq("id", "dfd273cb-3b7d-4728-9444-5e1b03c673ad")
        ]);

        toast.success("Cruces de partidos corregidos con éxito.", { id: "fix-llave" });
      } catch (err: any) {
        toast.error("Error corrigiendo cruces: " + err.message, { id: "fix-llave" });
        return;
      }
    }

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
    if (t.tipo === "americano" || t.tipo === "americano_individual") return t.categoria_libre ?? "—";
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
                <div className="space-y-3">
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

                  {form.tipo === "americano_individual" && (
                    <div className="border p-3 rounded-md space-y-3 bg-muted/20">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configuración Desafío</h4>
                      
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
                          <Label htmlFor="canchas-count">Canchas *</Label>
                          <Input
                            id="canchas-count"
                            type="number"
                            min="1"
                            value={form.canchas_count}
                            onChange={(e) => setForm({ ...form, canchas_count: e.target.value })}
                            placeholder="Ej: 3"
                          />
                          <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                            {form.canchas_count ? (form.modalidad === 'parejas' ? `${Number(form.canchas_count) * 2} parejas` : `${Number(form.canchas_count) * 4} jugadores`) : ""}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="costo-jugador">Costo por fecha/jugador *</Label>
                          <Input
                            id="costo-jugador"
                            type="number"
                            min="0"
                            value={form.costo_fecha_jugador}
                            onChange={(e) => setForm({ ...form, costo_fecha_jugador: e.target.value })}
                            placeholder="Ej: 10000"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="costo-cancha">Costo alquiler/cancha/fecha *</Label>
                          <Input
                            id="costo-cancha"
                            type="number"
                            min="0"
                            value={form.costo_fecha_cancha}
                            onChange={(e) => setForm({ ...form, costo_fecha_cancha: e.target.value })}
                            placeholder="Ej: 22000"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="porc-premios">% para Premios *</Label>
                          <Input
                            id="porc-premios"
                            type="number"
                            min="0"
                            max="100"
                            value={form.porcentaje_premios}
                            onChange={(e) => setForm({ ...form, porcentaje_premios: e.target.value })}
                            placeholder="Ej: 60"
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

              {form.tipo !== "americano_individual" && (
                <div className="grid gap-1.5 border p-3 rounded-md bg-muted/20">
                  <Label htmlFor="datos_bancarios">Datos Bancarios para Inscripciones (Opcional)</Label>
                  <Input
                    id="datos_bancarios"
                    value={form.datos_bancarios}
                    onChange={(e) => setForm({ ...form, datos_bancarios: e.target.value })}
                    placeholder="Ej: ALIAS.CLUB / CBU: 123... / Titular: Complejo"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Si completas esto, los jugadores podrán subir su comprobante de transferencia al inscribirse.
                  </p>
                </div>
              )}

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
                      {t.tipo === "americano" ? "Americano" : t.tipo === "americano_individual" ? "Individual" : "Oficial"} · {categoriaNombre(t)}
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

                 {t.estado === "finalizado" && t.tipo !== "americano_individual" && (
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

                {t.tipo === "americano_individual" && (
                  <Button
                    size="sm"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                    asChild
                  >
                    <Link to={`/admin/torneo-individual/${t.id}`}>
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      Gestionar Americano
                    </Link>
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
                    onClick={() => {
                      const path = t.tipo === "americano_individual" ? `/torneo-individual/${t.id}` : `/torneo/${t.id}`;
                      const url = `${window.location.origin}${path}`;
                      navigator.clipboard.writeText(url);
                      toast.success("¡Link del muro público copiado!");
                    }}
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
