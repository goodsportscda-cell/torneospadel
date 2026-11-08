import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Loader2, Radio, Tv } from "lucide-react";

type TorneoTV = {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  fecha_inicio: string;
  categoria_libre: string | null;
  numero_fecha: number | null;
  club_id: string | null;
};

export default function TorneoTvSelector() {
  const [torneos, setTorneos] = useState<TorneoTV[]>([]);
  const [clubes, setClubes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    document.title = "Elegir torneo | Padel ID TV";

    const load = async () => {
      try {
        const { data, error: queryError } = await (supabase as any)
          .from("torneos")
          .select("id, nombre, tipo, estado, fecha_inicio, categoria_libre, numero_fecha, club_id")
          .in("estado", ["en_curso", "proximamente"])
          .order("fecha_inicio", { ascending: true });
        if (queryError) throw queryError;
        const list = (data ?? []) as TorneoTV[];
        if (cancelled) return;
        setTorneos(list.sort((a, b) => Number(b.estado === "en_curso") - Number(a.estado === "en_curso")));

        const clubIds = [...new Set(list.map((torneo) => torneo.club_id).filter(Boolean))] as string[];
        if (clubIds.length) {
          const { data: clubRows, error: clubError } = await (supabase as any)
            .from("clubes")
            .select("id, nombre")
            .in("id", clubIds);
          if (clubError) throw clubError;
          if (cancelled) return;
          setClubes(Object.fromEntries((clubRows ?? []).map((club: any) => [club.id, club.nombre])));
        }
      } catch (loadError) {
        console.error("No se pudieron cargar los torneos para TV", loadError);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-[#080b12] px-5 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center gap-4 border-b border-white/10 pb-6">
          <PadelIdLogo size={52} />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Padel ID · Pantallas</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Elegí un torneo</h1>
            <p className="mt-1 text-sm text-white/55">Seleccioná con las flechas del control remoto y confirmá para abrir la pantalla.</p>
          </div>
        </header>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-white/65"><Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" />Buscando torneos…</div>
        ) : error ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <p className="text-lg font-bold">No pudimos cargar los torneos</p>
            <p className="mt-2 text-sm text-white/55">Revisá la conexión a internet e intentá nuevamente.</p>
            <Button className="mt-5" onClick={() => window.location.reload()}>Reintentar</Button>
          </section>
        ) : torneos.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
            <Tv className="mx-auto mb-4 h-9 w-9 text-primary/70" />
            <p className="text-lg font-bold">No hay torneos activos o próximos</p>
            <p className="mt-2 text-sm text-white/55">Cuando haya un torneo en curso, aparecerá en esta lista.</p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Torneos disponibles">
            {torneos.map((torneo) => {
              const path = torneo.tipo === "americano_individual"
                ? `/torneo-individual/${torneo.id}/tv`
                : `/torneo/${torneo.id}/tv`;
              return (
                <Link
                  key={torneo.id}
                  to={path}
                  className="group flex min-h-36 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 outline-none transition hover:border-primary/50 hover:bg-primary/[0.06] focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/30 sm:p-6"
                >
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge className={torneo.estado === "en_curso" ? "bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15" : "bg-white/10 text-white/65 hover:bg-white/10"}>
                        {torneo.estado === "en_curso" ? <Radio className="mr-1.5 h-3 w-3" /> : <CalendarDays className="mr-1.5 h-3 w-3" />}
                        {torneo.estado === "en_curso" ? "En curso" : "Próximo"}
                      </Badge>
                      {torneo.club_id && clubes[torneo.club_id] && <span className="truncate text-xs text-white/50">{clubes[torneo.club_id]}</span>}
                    </div>
                    <h2 className="truncate text-lg font-black sm:text-xl">{torneo.nombre}</h2>
                    <p className="mt-1 text-sm text-white/55">
                      {[torneo.categoria_libre, torneo.numero_fecha ? `Fecha ${torneo.numero_fecha}` : null, new Date(`${torneo.fecha_inicio}T00:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-slate-950 transition group-hover:scale-105">
                    <Tv className="h-6 w-6" />
                  </span>
                </Link>
              );
            })}
          </section>
        )}

        <footer className="mt-10 border-t border-white/10 pt-4 text-center text-xs text-white/35">Padel ID · Torneos y rankings</footer>
      </div>
    </main>
  );
}
