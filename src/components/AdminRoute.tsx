import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isOperador, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin && !isOperador) {
    return <Navigate to="/player/dashboard" replace />;
  }

  const rutasOperativas = [
    "/inscripciones",
    "/zonas",
    "/llaves",
    "/canchas-en-vivo",
    "/marcador",
  ];
  const puedeOperarEnRuta = rutasOperativas.some((ruta) => location.pathname === ruta || location.pathname.startsWith(`${ruta}/`));
  if (!isAdmin && isOperador && !puedeOperarEnRuta) {
    return <Navigate to="/inscripciones" replace />;
  }

  return <>{children}</>;
}
