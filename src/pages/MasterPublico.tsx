import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import PublicFooter from "@/components/PublicFooter";
import { MasterPublicView } from "@/components/master/MasterPublicView";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function MasterPublico() {
  const { club, loading } = useTenant();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialTvMode = location.pathname.endsWith("/tv") || searchParams.get("tv") === "1";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Club no encontrado</h1>
          <p className="text-muted-foreground">La dirección a la que intentas acceder no existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to={`/c/${club.slug}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            {club.logo_url && (
              <img
                src={club.logo_url}
                alt={club.nombre}
                className="h-9 w-9 object-contain rounded-full border bg-background"
              />
            )}
            <div>
              <h1 className="text-sm sm:text-base font-bold leading-tight">{club.nombre}</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Master Diciembre 2026</p>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <MasterPublicView clubId={club.id} clubNombre={club.nombre} initialTvMode={initialTvMode} />
      </main>

      <PublicFooter clubId={club.id} />
    </div>
  );
}
