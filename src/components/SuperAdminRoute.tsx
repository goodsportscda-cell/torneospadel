import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    // Si no es super admin, lo enviamos al dashboard normal de jugador o club
    return <Navigate to="/player/dashboard" replace />;
  }

  return <>{children}</>;
}
