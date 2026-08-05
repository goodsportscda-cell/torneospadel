import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Plus, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Franja = Database["public"]["Tables"]["torneo_franjas_horarias"]["Row"];

export function TorneoFranjasDialog({ torneo, onUpdateCanchas }: { torneo: any, onUpdateCanchas: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canchas, setCanchas] = useState(torneo.canchas_disponibles?.toString() || "3");
  const [franjas, setFranjas] = useState<Partial<Franja>[]>([]);

  const fetchFranjas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("torneo_franjas_horarias")
      .select("*")
      .eq("torneo_id", torneo.id)
      .order("dia_nombre")
      .order("hora_inicio");
    if (!error && data) {
      setFranjas(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setCanchas(torneo.canchas_disponibles?.toString() || "3");
      fetchFranjas();
    }
  }, [open, torneo]);

  const handleAdd = () => {
    setFranjas([
      ...franjas,
      {
        torneo_id: torneo.id,
        dia_nombre: "Jueves",
        hora_inicio: "17:00",
        hora_fin: "19:00",
        label_franja: "Jueves 17:00 a 19:00 hs",
      }
    ]);
  };

  const handleRemove = async (index: number) => {
    const f = franjas[index];
    if (f.id) {
      const { error } = await supabase.from("torneo_franjas_horarias").delete().eq("id", f.id);
      if (error) {
        toast.error("Error al eliminar franja");
        return;
      }
    }
    const newFranjas = [...franjas];
    newFranjas.splice(index, 1);
    setFranjas(newFranjas);
  };

  const handleChange = (index: number, field: keyof Franja, value: string) => {
    const newFranjas = [...franjas];
    newFranjas[index] = { ...newFranjas[index], [field]: value };
    
    // Auto-update label
    if (field === "dia_nombre" || field === "hora_inicio" || field === "hora_fin") {
      const f = newFranjas[index];
      f.label_franja = `${f.dia_nombre} ${f.hora_inicio?.substring(0,5)} a ${f.hora_fin?.substring(0,5)} hs`;
    }
    
    setFranjas(newFranjas);
  };

  const handleSave = async () => {
    setLoading(true);
    // 1. Guardar canchas_disponibles
    const numCanchas = parseInt(canchas, 10);
    if (!isNaN(numCanchas) && numCanchas > 0) {
      await supabase.from("torneos").update({ canchas_disponibles: numCanchas }).eq("id", torneo.id);
      onUpdateCanchas();
    }

    // 2. Guardar franjas (upsert no funciona bien sin PK exacta con PostgREST sometimes, hacemos insert/update manual)
    try {
      for (const f of franjas) {
        if (f.id) {
          await supabase.from("torneo_franjas_horarias").update({
            dia_nombre: f.dia_nombre,
            hora_inicio: f.hora_inicio,
            hora_fin: f.hora_fin,
            label_franja: f.label_franja
          }).eq("id", f.id);
        } else {
          await supabase.from("torneo_franjas_horarias").insert({
            torneo_id: f.torneo_id,
            dia_nombre: f.dia_nombre,
            hora_inicio: f.hora_inicio,
            hora_fin: f.hora_fin,
            label_franja: f.label_franja
          });
        }
      }
      toast.success("Configuración de franjas guardada");
      fetchFranjas();
    } catch (err: any) {
      toast.error("Error guardando franjas: " + err.message);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full mt-2" title="Configurar Franjas Horarias">
          <Clock className="h-3.5 w-3.5 mr-1" />
          Franjas Horarias
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Franjas Horarias de Zonas</DialogTitle>
          <DialogDescription>
            Configurá las franjas horarias y canchas para este torneo. Si no hay franjas, los inscriptos usarán texto libre.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid gap-2 border-b pb-4">
            <Label htmlFor="canchas_disponibles" className="text-sm font-semibold">Canchas Disponibles para Zonas</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="canchas_disponibles"
                type="number"
                min="1"
                value={canchas}
                onChange={(e) => setCanchas(e.target.value)}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">Utilizado para el armado automático de zonas.</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Franjas Horarias</Label>
            <Button size="sm" onClick={handleAdd} variant="secondary">
              <Plus className="h-4 w-4 mr-1" /> Añadir Franja
            </Button>
          </div>

          {loading && franjas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando franjas...</p>
          ) : franjas.length === 0 ? (
            <div className="bg-muted/20 border border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No hay franjas configuradas. Las inscripciones pedirán disponibilidad con texto libre.
            </div>
          ) : (
            <div className="space-y-3">
              {franjas.map((f, i) => (
                <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2 items-start border p-3 rounded-lg bg-card relative">
                  <div className="grid gap-1.5 w-full sm:w-1/3">
                    <Label className="text-xs">Día</Label>
                    <Select value={f.dia_nombre} onValueChange={(v) => handleChange(i, "dia_nombre", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Jueves">Jueves</SelectItem>
                        <SelectItem value="Viernes">Viernes</SelectItem>
                        <SelectItem value="Sábado">Sábado</SelectItem>
                        <SelectItem value="Domingo">Domingo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5 w-full sm:w-1/4">
                    <Label className="text-xs">Inicio</Label>
                    <Input type="time" className="h-8 text-xs" value={f.hora_inicio?.substring(0,5)} onChange={(e) => handleChange(i, "hora_inicio", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5 w-full sm:w-1/4">
                    <Label className="text-xs">Fin</Label>
                    <Input type="time" className="h-8 text-xs" value={f.hora_fin?.substring(0,5)} onChange={(e) => handleChange(i, "hora_fin", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5 w-full sm:w-1/3">
                    <Label className="text-xs">Etiqueta (Auto)</Label>
                    <Input className="h-8 text-xs" value={f.label_franja} onChange={(e) => handleChange(i, "label_franja", e.target.value)} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive absolute top-2 right-2 sm:static sm:mt-5" onClick={() => handleRemove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>Guardar Cambios</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
