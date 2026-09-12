import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

export const DraftPublico = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [torneo, setTorneo] = useState<any>(null);
  const [partidosFinal, setPartidosFinal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDraftData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      // Fetch Torneo
      const { data: tData, error: tErr } = await supabase
        .from("torneos")
        .select("*")
        .eq("id", id)
        .single();
      
      if (tErr) throw tErr;
      setTorneo(tData);

      const finalWeek = tData.desafio_semanas ?? 8;

      // Fetch Partidos de la Final
      const { data: pData, error: pErr } = await supabase
        .from("partidos_individuales")
        .select(`
          *,
          jugador1:torneo_individual_jugadores!jugador1_id(jugador_id, jugador:jugadores(nombre, apellido)),
          jugador2:torneo_individual_jugadores!jugador2_id(jugador_id, jugador:jugadores(nombre, apellido)),
          jugador3:torneo_individual_jugadores!jugador3_id(jugador_id, jugador:jugadores(nombre, apellido)),
          jugador4:torneo_individual_jugadores!jugador4_id(jugador_id, jugador:jugadores(nombre, apellido))
        `)
        .eq("torneo_id", id)
        .eq("fecha", finalWeek)
        .order("cancha");

      if (pErr) throw pErr;
      setPartidosFinal(pData || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Error cargando el draft en vivo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraftData();

    // Suscripción a cambios en los partidos (para que se actualice en tiempo real si el operador los cambia o la Gran Final se genera)
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partidos_individuales',
          filter: `torneo_id=eq.${id}`,
        },
        () => {
          fetchDraftData(); // Refrescar en cada cambio
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center">
        <RefreshCcw className="h-10 w-10 animate-spin text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold animate-pulse">Cargando Draft en Vivo...</h2>
      </div>
    );
  }

  if (!torneo) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center">
        <h2>Torneo no encontrado</h2>
      </div>
    );
  }

  const getPlayerName = (j: any) => {
    if (!j?.jugador) return "---";
    return `${j.jugador.apellido}, ${j.jugador.nombre}`;
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white overflow-hidden relative selection:bg-amber-500/30">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-600/20 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 py-8 relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex flex-col items-center justify-center mb-12 mt-4 space-y-4">
          <div className="bg-amber-500/10 p-4 rounded-full border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <Trophy className="h-16 w-16 text-amber-500" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 uppercase tracking-tighter text-center">
            Draft Gran Final
          </h1>
          <h2 className="text-2xl md:text-3xl text-slate-300 font-semibold tracking-wide uppercase">
            {torneo.nombre}
          </h2>
        </header>

        {/* Content */}
        <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col justify-center">
          {partidosFinal.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-sm">
              <RefreshCcw className="h-12 w-12 text-slate-500 mx-auto mb-4 animate-spin-slow" />
              <h3 className="text-2xl font-medium text-slate-400">Esperando selecciones del Draft...</h3>
              <p className="text-slate-500 mt-2">La pantalla se actualizará automáticamente cuando el organizador inicie el Draft.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:gap-12">
              <div className="grid grid-cols-1 gap-8 md:gap-12">
                {partidosFinal.map((partido, index) => {
                  const isGranFinal = partido.cancha.includes("Gran Final") || index === 0;
                  const isDesafio = partido.cancha.includes("Tercer Puesto") || index === 1;

                  let cardGradient = "from-slate-900 to-slate-800 border-slate-700";
                  let titleColor = "text-slate-300";
                  
                  if (isGranFinal) {
                    cardGradient = "from-amber-950/40 to-slate-900 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.1)]";
                    titleColor = "text-amber-400";
                  } else if (isDesafio) {
                    cardGradient = "from-slate-800 to-slate-900 border-slate-600";
                    titleColor = "text-slate-200";
                  }

                  return (
                    <div
                      key={partido.id}
                      className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br ${cardGradient} p-1 animate-in fade-in zoom-in duration-700`}
                      style={{ animationFillMode: "both", animationDelay: `${index * 200}ms` }}
                    >
                      <div className="bg-slate-950/80 backdrop-blur-xl rounded-[1.8rem] p-6 md:p-8 flex flex-col h-full">
                        <div className="text-center mb-8 relative z-10">
                          <h3 className={`text-2xl md:text-3xl font-black uppercase tracking-widest ${titleColor}`}>
                            {partido.cancha}
                          </h3>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                          {/* Pareja 1 */}
                          <div className="flex-1 w-full bg-slate-900/60 rounded-2xl p-6 border border-slate-700/50 flex flex-col items-center justify-center min-h-[140px] shadow-inner">
                            <span className="text-sm uppercase tracking-widest text-slate-500 font-semibold mb-2 block">Capitán / Seleccionado</span>
                            <div className="text-xl md:text-2xl font-bold text-white text-center">
                              {getPlayerName(partido.jugador1)}
                            </div>
                            <div className="text-slate-400 font-medium text-lg mt-1 text-center">
                              & {getPlayerName(partido.jugador2)}
                            </div>
                          </div>

                          <div className="text-4xl font-black text-slate-700 italic px-4">
                            VS
                          </div>

                          {/* Pareja 2 */}
                          <div className="flex-1 w-full bg-slate-900/60 rounded-2xl p-6 border border-slate-700/50 flex flex-col items-center justify-center min-h-[140px] shadow-inner">
                            <span className="text-sm uppercase tracking-widest text-slate-500 font-semibold mb-2 block">Capitán / Seleccionado</span>
                            <div className="text-xl md:text-2xl font-bold text-white text-center">
                              {getPlayerName(partido.jugador3)}
                            </div>
                            <div className="text-slate-400 font-medium text-lg mt-1 text-center">
                              & {getPlayerName(partido.jugador4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
        
        <footer className="mt-12 text-center text-slate-600 pb-4">
          <p className="uppercase tracking-widest text-xs font-semibold">Padel ID • Modo Draft Live</p>
        </footer>
      </div>
    </div>
  );
};

export default DraftPublico;
