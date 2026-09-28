import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Loader2, LogIn, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import LegalLinks from "@/components/LegalLinks";

type PublicClub = { id: string; nombre: string; slug: string; logo_url: string | null };

export default function PublicHome() {
  const [clubs, setClubs] = useState<PublicClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const loadClubs = async () => {
      const { data, error } = await supabase
        .from("clubes")
        .select("id, nombre, slug, logo_url")
        .order("nombre");
      if (error) setLoadError(true);
      else setClubs(data ?? []);
      setLoading(false);
    };
    loadClubs();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <PadelIdLogo size={38} showText />
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button asChild variant="outline" size="sm">
              <Link to="/auth"><LogIn className="mr-2 h-4 w-4" />Ingresar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Trophy className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Padel ID</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Torneos, resultados y rankings</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Encontrá la actividad pública de tu club o ingresá a tu cuenta para gestionar torneos y consultar tu perfil.
          </p>
        </section>

        <section className="mx-auto mt-12 max-w-4xl">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Elegí un club</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : clubs.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {clubs.map((club) => (
                <Card key={club.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                      {club.logo_url ? <img src={club.logo_url} alt={`Logo de ${club.nombre}`} className="h-10 w-10 rounded-lg object-contain" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <CardTitle className="text-lg">{club.nombre}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full">
                      <Link to={`/c/${club.slug}`}>
                        Ver torneos y ranking <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : loadError ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No pudimos cargar los clubes ahora. Probá de nuevo más tarde.</CardContent></Card>
          ) : (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Todavía no hay clubes públicos disponibles.</CardContent></Card>
          )}
        </section>
      </main>
      <footer className="border-t py-6 px-4 text-muted-foreground"><LegalLinks /></footer>
    </div>
  );
}
