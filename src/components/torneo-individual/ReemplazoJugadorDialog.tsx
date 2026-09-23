import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox, ComboOption } from "@/components/Combobox";
import {
  ArrowRight,
  UserCheck,
  UserPlus,
  RefreshCw,
  Trophy,
  ShieldCheck,
  Info,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Jugador = Database["public"]["Tables"]["jugadores"]["Row"];

export interface JugadorSalienteInfo {
  id?: string; // ID en torneo_individual_jugadores
  jugador_id: string;
  nombre: string;
  apellido: string;
  club?: string | null;
  telefono?: string | null;
  dni?: string | null;
  puntos: number;
  partidosJugados?: number;
  pareja_id?: string;
}

interface ReemplazoJugadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  torneoId: string;
  torneoNotas?: string | null;
  isModalidadParejas?: boolean;
  jugadorSaliente: JugadorSalienteInfo | null;
  todosJugadores: Jugador[];
  jugadoresInscriptosIds: string[];
  onSuccess: () => void;
}

export function ReemplazoJugadorDialog({
  open,
  onOpenChange,
  torneoId,
  torneoNotas,
  isModalidadParejas = false,
  jugadorSaliente,
  todosJugadores,
  jugadoresInscriptosIds,
  onSuccess,
}: ReemplazoJugadorDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"existente" | "nuevo">("existente");
  const [selectedNuevoJugadorId, setSelectedNuevoJugadorId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form para crear nuevo jugador
  const [nuevoJugadorForm, setNuevoJugadorForm] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    club: "",
  });

  // Puntos calculados
  const puntosAcumulados = jugadorSaliente?.puntos ?? 0;
  const puntos50PorCiento = Math.round(puntosAcumulados * 0.5);
  const [puntosHeredadosInput, setPuntosHeredadosInput] = useState<number>(puntos50PorCiento);

  // Sincronizar puntos cuando cambia el jugador saliente
  useEffect(() => {
    if (jugadorSaliente) {
      const pts = Math.round((jugadorSaliente.puntos || 0) * 0.5);
      setPuntosHeredadosInput(pts);
      setSelectedNuevoJugadorId("");
      setNuevoJugadorForm({
        nombre: "",
        apellido: "",
        dni: "",
        telefono: "",
        club: "",
      });
    }
  }, [jugadorSaliente]);

  // Opciones de combobox: excluir a jugadores ya inscriptos en el torneo
  const availableJugadoresOptions: ComboOption[] = useMemo(() => {
    return todosJugadores
      .filter((j) => !jugadoresInscriptosIds.includes(j.id))
      .sort((a, b) => a.apellido.localeCompare(b.apellido))
      .map((j) => ({
        value: j.id,
        label: `${j.apellido}, ${j.nombre}${j.club ? ` (${j.club})` : ""}`,
        hint: j.dni ? `DNI: ${j.dni}` : undefined,
      }));
  }, [todosJugadores, jugadoresInscriptosIds]);

  const nuevoJugadorSeleccionadoObj = useMemo(() => {
    if (!selectedNuevoJugadorId) return null;
    return todosJugadores.find((j) => j.id === selectedNuevoJugadorId) || null;
  }, [selectedNuevoJugadorId, todosJugadores]);

  const handleConfirmarReemplazo = async () => {
    if (!jugadorSaliente) return;
    setIsSubmitting(true);

    try {
      let finalNuevoJugadorId = selectedNuevoJugadorId;

      // 1. Si eligió crear nuevo jugador, insertarlo primero
      if (activeTab === "nuevo") {
        if (!nuevoJugadorForm.nombre.trim() || !nuevoJugadorForm.apellido.trim()) {
          toast.error("Por favor completa el nombre y apellido del nuevo jugador");
          setIsSubmitting(false);
          return;
        }

        const { data: createdPlayer, error: createErr } = await (supabase as any)
          .from("jugadores")
          .insert({
            nombre: nuevoJugadorForm.nombre.trim(),
            apellido: nuevoJugadorForm.apellido.trim(),
            dni: nuevoJugadorForm.dni.trim() || null,
            telefono: nuevoJugadorForm.telefono.trim() || null,
            club: nuevoJugadorForm.club.trim() || null,
          })
          .select()
          .single();

        if (createErr) {
          console.error("Error al crear nuevo jugador:", createErr);
          throw new Error("No se pudo crear el jugador en la base de datos");
        }

        finalNuevoJugadorId = createdPlayer.id;
      }

      if (!finalNuevoJugadorId) {
        toast.error("Debes seleccionar o crear un jugador para el reemplazo");
        setIsSubmitting(false);
        return;
      }

      const puntosHeredados = Number(puntosHeredadosInput) || 0;
      const oldJugadorId = jugadorSaliente.jugador_id;
      const nowIso = new Date().toISOString();

      // 2. Actualizar registro en torneo_individual_jugadores
      // Si la columna puntos_iniciales / reemplaza_a_jugador_id existen en la BD, se actualizan
      const updatePayload: any = {
        jugador_id: finalNuevoJugadorId,
        puntos_iniciales: puntosHeredados,
        reemplaza_a_jugador_id: oldJugadorId,
        fecha_reemplazo: nowIso,
      };

      const { error: updateTjErr } = await (supabase as any)
        .from("torneo_individual_jugadores")
        .update(updatePayload)
        .eq("torneo_id", torneoId)
        .eq("jugador_id", oldJugadorId);

      if (updateTjErr) {
        console.warn("Error al actualizar torneo_individual_jugadores (intentando sin columnas nuevas si hubo caché):", updateTjErr);
        // Fallback en caso de que PostgREST cache no haya refrescado aún
        const fallbackPayload: any = { jugador_id: finalNuevoJugadorId };
        const { error: fallbackErr } = await (supabase as any)
          .from("torneo_individual_jugadores")
          .update(fallbackPayload)
          .eq("torneo_id", torneoId)
          .eq("jugador_id", oldJugadorId);

        if (fallbackErr) throw fallbackErr;
      }

      // 3. Si es modalidad parejas, actualizar torneo_individual_parejas
      if (isModalidadParejas && jugadorSaliente.pareja_id) {
        const { data: parejaData } = await (supabase as any)
          .from("torneo_individual_parejas")
          .select("*")
          .eq("id", jugadorSaliente.pareja_id)
          .single();

        if (parejaData) {
          const updateField = parejaData.jugador1_id === oldJugadorId ? "jugador1_id" : "jugador2_id";
          try {
            await (supabase as any)
              .from("torneo_individual_parejas")
              .update({
                [updateField]: finalNuevoJugadorId,
                puntos_iniciales: puntosHeredados,
              })
              .eq("id", jugadorSaliente.pareja_id);
          } catch (pErr) {
            // Fallback si puntos_iniciales no está en schema cache
            await (supabase as any)
              .from("torneo_individual_parejas")
              .update({ [updateField]: finalNuevoJugadorId })
              .eq("id", jugadorSaliente.pareja_id);
          }
        }
      }

      // 4. Actualizar notas del torneo con tags resilientes
      const currentNotas = torneoNotas || "";
      const puntosTag = `[PUNTOS_INICIALES_${finalNuevoJugadorId}:${puntosHeredados}]`;
      const histTag = `[REEMPLAZO_${nowIso.slice(0, 10)}:${oldJugadorId}->${finalNuevoJugadorId}:${puntosHeredados}pts]`;
      const updatedNotas = `${currentNotas} ${puntosTag} ${histTag}`.trim();

      await (supabase as any)
        .from("torneos")
        .update({ notas: updatedNotas })
        .eq("id", torneoId);

      // 5. Transferir partidos PENDIENTES al nuevo jugador (los finalizados se mantienen intactos para preservar el historial)
      const { data: pendingMatches, error: pmErr } = await (supabase as any)
        .from("partidos_individuales")
        .select("id, jugador1_id, jugador2_id, jugador3_id, jugador4_id")
        .eq("torneo_id", torneoId)
        .eq("estado", "pendiente");

      if (!pmErr && pendingMatches && pendingMatches.length > 0) {
        for (const m of pendingMatches) {
          let needsUpdate = false;
          const matchUpdates: any = {};

          if (m.jugador1_id === oldJugadorId) {
            matchUpdates.jugador1_id = finalNuevoJugadorId;
            needsUpdate = true;
          }
          if (m.jugador2_id === oldJugadorId) {
            matchUpdates.jugador2_id = finalNuevoJugadorId;
            needsUpdate = true;
          }
          if (m.jugador3_id === oldJugadorId) {
            matchUpdates.jugador3_id = finalNuevoJugadorId;
            needsUpdate = true;
          }
          if (m.jugador4_id === oldJugadorId) {
            matchUpdates.jugador4_id = finalNuevoJugadorId;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await (supabase as any)
              .from("partidos_individuales")
              .update(matchUpdates)
              .eq("id", m.id);
          }
        }
      }

      // 6. Transferir o asociar pagos de fechas del torneo si correspondiera
      try {
        await (supabase as any)
          .from("torneo_individual_pagos")
          .update({ jugador_id: finalNuevoJugadorId })
          .eq("torneo_id", torneoId)
          .eq("jugador_id", oldJugadorId);
      } catch (err) {
        console.warn("No se actualizaron pagos automáticos:", err);
      }

      // 7. Invalidar cachés de React Query para sincronización inmediata
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["torneos"] }),
        queryClient.invalidateQueries({ queryKey: ["torneo", torneoId] }),
        queryClient.invalidateQueries({ queryKey: ["partidos"] }),
        queryClient.invalidateQueries({ queryKey: ["jugadores"] }),
      ]);

      const nuevoNombre = activeTab === "nuevo"
        ? `${nuevoJugadorForm.apellido}, ${nuevoJugadorForm.nombre}`
        : `${nuevoJugadorSeleccionadoObj?.apellido}, ${nuevoJugadorSeleccionadoObj?.nombre}`;

      toast.success(
        `Sustitución confirmada: ${nuevoNombre} ingresó con ${puntosHeredados} pts (50% heredado).`
      );

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error en reemplazo de jugador:", err);
      toast.error(err.message || "Ocurrió un error al procesar la sustitución.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!jugadorSaliente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight">
                Sustitución de Jugador a Mitad de Torneo
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Reemplaza un jugador preservando el historial de fechas anteriores y heredando el 50% de sus puntos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Resumen de Transferencia de Puntos */}
          <div className="p-3.5 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-neutral-900/50 to-indigo-500/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Regla de Herencia Competitiva (50%)
              </span>
              <Badge variant="outline" className="border-purple-500/40 text-purple-400 bg-purple-500/10 text-[10px]">
                Reglamento Padel ID
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 items-center text-center">
              {/* Saliente */}
              <div className="sm:col-span-3 p-2.5 rounded-lg bg-background/80 border border-border/60 text-left">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                  Jugador Saliente
                </span>
                <div className="font-bold text-sm truncate">
                  {jugadorSaliente.apellido}, {jugadorSaliente.nombre}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    {puntosAcumulados} pts acumulados
                  </Badge>
                  {jugadorSaliente.partidosJugados !== undefined && (
                    <span className="text-[10px] text-muted-foreground">
                      ({jugadorSaliente.partidosJugados} PJ)
                    </span>
                  )}
                </div>
              </div>

              {/* Flecha y % */}
              <div className="sm:col-span-1 flex flex-col items-center justify-center my-1 sm:my-0">
                <div className="h-7 w-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shadow-inner">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <span className="text-[9px] font-black text-purple-400 mt-0.5">50%</span>
              </div>

              {/* Entrante */}
              <div className="sm:col-span-3 p-2.5 rounded-lg bg-background/80 border border-border/60 text-left">
                <span className="text-[10px] font-bold text-purple-400 uppercase block">
                  Puntaje Inicial Heredado
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="text-xl font-black text-primary">
                    +{puntosHeredadosInput} pts
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    (de {puntosAcumulados} pts)
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground block mt-0.5">
                  Redondeo reglamentario al 50%
                </span>
              </div>
            </div>

            {/* Ajuste manual opcional de puntos */}
            <div className="flex items-center gap-2 pt-1 border-t border-purple-500/20">
              <Label htmlFor="puntos-heredados" className="text-xs text-muted-foreground shrink-0">
                Ajuste manual de puntos a heredar:
              </Label>
              <Input
                id="puntos-heredados"
                type="number"
                min={0}
                max={puntosAcumulados}
                value={puntosHeredadosInput}
                onChange={(e) => setPuntosHeredadosInput(Number(e.target.value))}
                className="h-7 w-20 text-center font-bold text-xs"
              />
              <span className="text-[10px] text-muted-foreground">
                (Por defecto: Math.round({puntosAcumulados} × 0.5) = {puntos50PorCiento})
              </span>
            </div>
          </div>

          {/* Selector de Nuevo Jugador */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Seleccionar o Registrar el Nuevo Jugador
            </Label>

            <Tabs
              value={activeTab}
              onValueChange={(val: any) => setActiveTab(val)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="existente" className="gap-1.5 text-xs">
                  <UserCheck className="h-3.5 w-3.5" />
                  Elegir de la Base de Datos
                </TabsTrigger>
                <TabsTrigger value="nuevo" className="gap-1.5 text-xs">
                  <UserPlus className="h-3.5 w-3.5" />
                  Crear Nuevo Jugador
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: ELEGIR EXISTENTE */}
              <TabsContent value="existente" className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="combo-jugador" className="text-xs">
                    Buscar Jugador Disponible
                  </Label>
                  <Combobox
                    options={availableJugadoresOptions}
                    value={selectedNuevoJugadorId}
                    onChange={setSelectedNuevoJugadorId}
                    placeholder="Escribe el apellido o nombre..."
                    searchPlaceholder="Buscar por apellido o nombre..."
                    emptyText="No se encontraron jugadores no inscriptos."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Solo se muestran jugadores que no están participando actualmente de este torneo.
                  </p>
                </div>

                {nuevoJugadorSeleccionadoObj && (
                  <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-1">
                    <div className="font-bold text-foreground">
                      Jugador seleccionado: {nuevoJugadorSeleccionadoObj.apellido}, {nuevoJugadorSeleccionadoObj.nombre}
                    </div>
                    <div className="text-muted-foreground text-[11px] flex gap-3 flex-wrap">
                      <span>DNI: {nuevoJugadorSeleccionadoObj.dni || "—"}</span>
                      <span>Tel: {nuevoJugadorSeleccionadoObj.telefono || "—"}</span>
                      <span>Club: {nuevoJugadorSeleccionadoObj.club || "—"}</span>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: CREAR NUEVO */}
              <TabsContent value="nuevo" className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="nuevo-nombre" className="text-xs">
                      Nombre <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="nuevo-nombre"
                      placeholder="Ej. Lucas"
                      value={nuevoJugadorForm.nombre}
                      onChange={(e) =>
                        setNuevoJugadorForm((prev) => ({ ...prev, nombre: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nuevo-apellido" className="text-xs">
                      Apellido <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="nuevo-apellido"
                      placeholder="Ej. Gómez"
                      value={nuevoJugadorForm.apellido}
                      onChange={(e) =>
                        setNuevoJugadorForm((prev) => ({ ...prev, apellido: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nuevo-dni" className="text-xs">
                      DNI (opcional)
                    </Label>
                    <Input
                      id="nuevo-dni"
                      placeholder="Ej. 38123456"
                      value={nuevoJugadorForm.dni}
                      onChange={(e) =>
                        setNuevoJugadorForm((prev) => ({ ...prev, dni: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nuevo-telefono" className="text-xs">
                      Teléfono / WhatsApp
                    </Label>
                    <Input
                      id="nuevo-telefono"
                      placeholder="Ej. 3834123456"
                      value={nuevoJugadorForm.telefono}
                      onChange={(e) =>
                        setNuevoJugadorForm((prev) => ({ ...prev, telefono: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label htmlFor="nuevo-club" className="text-xs">
                      Club / Ciudad
                    </Label>
                    <Input
                      id="nuevo-club"
                      placeholder="Ej. La Cancha Padel Club"
                      value={nuevoJugadorForm.club}
                      onChange={(e) =>
                        setNuevoJugadorForm((prev) => ({ ...prev, club: e.target.value }))
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Garantías y Transparencia */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border text-muted-foreground text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Transparencia Histórica y Fixture</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>
                <strong>Historial intacto:</strong> Todos los partidos finalizados en fechas anteriores mantendrán el nombre de {jugadorSaliente.apellido}, {jugadorSaliente.nombre}.
              </li>
              <li>
                <strong>Partidos futuros:</strong> Las fechas y cruces pendientes de jugar serán asignados automáticamente al nuevo jugador.
              </li>
              <li>
                <strong>Tabla de Posiciones:</strong> El nuevo jugador figurará inmediatamente en el ranking con los +{puntosHeredadosInput} pts calculados.
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmarReemplazo}
            disabled={
              isSubmitting ||
              (activeTab === "existente" && !selectedNuevoJugadorId) ||
              (activeTab === "nuevo" && (!nuevoJugadorForm.nombre.trim() || !nuevoJugadorForm.apellido.trim()))
            }
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                Confirmar Sustitución (+{puntosHeredadosInput} pts)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
