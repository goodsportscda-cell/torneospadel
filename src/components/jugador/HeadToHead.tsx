import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Swords, Trophy, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Props = {
  jugadorId: string;
  jugadorNombre: string;
};

type Rival = {
  id: string;
  nombre: string;
  apellido: string;
};

type PartidoH2H = {
  id: string;
  ganador_id: string | null;
  mi_inscripcion_id: string;
  su_inscripcion_id: string;
  fecha_hora: string | null;
  torneo: string;
};

export function HeadToHead({ jugadorId, jugadorNombre }: Props) {
  const [searchRival, setSearchRival] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Rival[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [rivalSeleccionado, setRivalSeleccionado] = useState<Rival | null>(null);
  const [loadingH2H, setLoadingH2H] = useState(false);
  
  const [misVictorias, setMisVictorias] = useState(0);
  const [susVictorias, setSusVictorias] = useState(0);
  const [partidosH2H, setPartidosH2H] = useState<PartidoH2H[]>([]);

  const buscarRival = async () => {
    if (!searchRival.trim() || searchRival.length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from("jugadores")
      .select("id, nombre, apellido")
      .ilike("apellido", `%${searchRival.trim()}%`)
      .neq("id", jugadorId)
      .limit(5);
      
    setResultadosBusqueda(data ?? []);
    setSearching(false);
  };

  const calcularH2H = async (rival: Rival) => {
    setRivalSeleccionado(rival);
    setLoadingH2H(true);
    setResultadosBusqueda([]);
    
    try {
      // 1. Mis inscripciones
      const { data: misIns1 } = await supabase.from("inscripciones").select("id").eq("jugador1_id", jugadorId);
      const { data: misIns2 } = await supabase.from("inscripciones").select("id").eq("jugador2_id", jugadorId);
      const misIds = [...(misIns1?.map(i => i.id) || []), ...(misIns2?.map(i => i.id) || [])];

      // 2. Sus inscripciones
      const { data: susIns1 } = await supabase.from("inscripciones").select("id").eq("jugador1_id", rival.id);
      const { data: susIns2 } = await supabase.from("inscripciones").select("id").eq("jugador2_id", rival.id);
      const susIds = [...(susIns1?.map(i => i.id) || []), ...(susIns2?.map(i => i.id) || [])];

      if (misIds.length === 0 || susIds.length === 0) {
        setPartidosH2H([]);
        setMisVictorias(0);
        setSusVictorias(0);
        setLoadingH2H(false);
        return;
      }

      // 3. Buscar cruzados
      // a) Yo local, El visitante
      const { data: z1 } = await supabase.from("partidos_zona").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora, zona_id").in("pareja_local_id", misIds).in("pareja_visitante_id", susIds).eq("estado", "finalizado");
      const { data: l1 } = await supabase.from("partidos_llave").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora, llave_id").in("pareja_local_id", misIds).in("pareja_visitante_id", susIds).eq("estado", "finalizado");
      
      // b) El local, Yo visitante
      const { data: z2 } = await supabase.from("partidos_zona").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora, zona_id").in("pareja_local_id", susIds).in("pareja_visitante_id", misIds).eq("estado", "finalizado");
      const { data: l2 } = await supabase.from("partidos_llave").select("id, ganador_id, pareja_local_id, pareja_visitante_id, fecha_hora, llave_id").in("pareja_local_id", susIds).in("pareja_visitante_id", misIds).eq("estado", "finalizado");

      const todos = [...(z1 || []), ...(l1 || []), ...(z2 || []), ...(l2 || [])];

      let mV = 0;
      let sV = 0;
      const historial: PartidoH2H[] = [];

      todos.forEach(p => {
        const yoLocal = misIds.includes(p.pareja_local_id);
        const miInsc = yoLocal ? p.pareja_local_id : p.pareja_visitante_id;
        const suInsc = yoLocal ? p.pareja_visitante_id : p.pareja_local_id;
        
        if (p.ganador_id === miInsc) mV++;
        if (p.ganador_id === suInsc) sV++;

        historial.push({
          id: p.id,
          ganador_id: p.ganador_id,
          mi_inscripcion_id: miInsc,
          su_inscripcion_id: suInsc,
          fecha_hora: p.fecha_hora,
          torneo: "Torneo Oficial" // Simplificación para no hacer joins infinitos
        });
      });

      // Sort by date
      historial.sort((a, b) => new Date(b.fecha_hora || 0).getTime() - new Date(a.fecha_hora || 0).getTime());

      setPartidosH2H(historial);
      setMisVictorias(mV);
      setSusVictorias(sV);

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingH2H(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          Head to Head
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <div className="flex gap-2">
          <Input 
            placeholder="Buscar rival por apellido..." 
            value={searchRival}
            onChange={(e) => setSearchRival(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscarRival()}
            className="text-sm"
          />
          <Button onClick={buscarRival} disabled={searching} size="icon" variant="secondary" className="shrink-0">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {resultadosBusqueda.length > 0 && (
          <ul className="space-y-1 border rounded-md p-1 bg-muted/20">
            {resultadosBusqueda.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-sm text-sm cursor-pointer" onClick={() => calcularH2H(r)}>
                <span>{r.apellido}, {r.nombre}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </li>
            ))}
          </ul>
        )}

        {loadingH2H && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {rivalSeleccionado && !loadingH2H && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-3 items-center gap-2">
              <div className="text-center p-3 bg-muted rounded-xl relative overflow-hidden">
                {misVictorias > susVictorias && <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>}
                <div className="text-3xl font-black">{misVictorias}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{jugadorNombre.split(' ')[0]}</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <span className="text-xs text-muted-foreground font-bold">VS</span>
                <Swords className="h-5 w-5 text-muted-foreground opacity-50 my-1" />
                <Badge variant="outline" className="text-[10px]">{partidosH2H.length} Partidos</Badge>
              </div>
              <div className="text-center p-3 bg-muted rounded-xl relative overflow-hidden">
                {susVictorias > misVictorias && <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>}
                <div className="text-3xl font-black">{susVictorias}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{rivalSeleccionado.nombre.split(' ')[0]}</div>
              </div>
            </div>

            {partidosH2H.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Últimos Enfrentamientos</p>
                {partidosH2H.slice(0, 3).map(p => {
                  const ganeYo = p.ganador_id === p.mi_inscripcion_id;
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2.5 border rounded-lg bg-card">
                      <div className={`w-1 h-8 rounded-full ${ganeYo ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold">{ganeYo ? "Victoria" : "Derrota"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground italic py-4">No hay enfrentamientos previos registrados.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
