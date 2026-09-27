import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ModeToggle } from "./mode-toggle";

export default function AppLayout() {
  const { signOut, user, isAdmin, isSuperAdmin, isOperador, clubId, clubActivo } = useAuth();

  if (isSuperAdmin && !clubId) {
    return <Navigate to="/super-admin" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sesión cerrada");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="min-w-0 flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b bg-background px-2 sticky top-0 z-10 gap-2 print:hidden">
            <SidebarTrigger />
            <div className="ml-1 flex min-w-0 flex-1 items-center gap-2 truncate">
              <span className="text-sm font-bold text-primary">Padel ID</span>
              {clubActivo && <><span className="text-muted-foreground">·</span><span className="truncate text-sm font-medium">{clubActivo.nombre}</span></>}
            </div>
            {user && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline truncate max-w-[140px]">{user.email}</span>
                {isAdmin && !isSuperAdmin && (
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    Administrador
                  </span>
                )}
                {isSuperAdmin && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Superadmin</span>}
                {isOperador && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Operador</span>}
                <ModeToggle />
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Cerrar sesión">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </header>
          <main className="min-w-0 flex-1 p-4 md:p-6">
            <Outlet />
            <footer className="mt-12 pt-6 border-t text-center text-[10px] sm:text-xs text-muted-foreground print:hidden">
              <p>© {new Date().getFullYear()} <span className="font-bold text-foreground">Padel ID</span> — Todos los derechos reservados.</p>
              <p className="mt-1">Plataforma de gestión deportiva</p>
            </footer>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
