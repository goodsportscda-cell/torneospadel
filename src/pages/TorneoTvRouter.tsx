import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import TorneoTvView from "@/pages/TorneoTvView";
import TorneoTvZonasLlaves from "@/pages/TorneoTvZonasLlaves";

export default function TorneoTvRouter() {
  const { id } = useParams<{ id: string }>();
  const [type, setType] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setType(null);
    setMissing(false);
    if (!id) {
      setMissing(true);
      return;
    }
    supabase
      .from("torneos")
      .select("tipo")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setMissing(true);
        else setType(data.tipo);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (missing) return <div className="flex min-h-screen items-center justify-center bg-[#080b12] px-6 text-center text-white">No encontramos ese torneo o no está disponible públicamente.</div>;
  if (!type) return <div className="flex min-h-screen items-center justify-center bg-[#080b12] text-white"><Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" />Abriendo pantalla del torneo…</div>;
  return type === "americano_individual" ? <TorneoTvView /> : <TorneoTvZonasLlaves />;
}
