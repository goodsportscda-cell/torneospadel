import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function AppLayout() {
  const { signOut, user, isAdmin } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sesión cerrada");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b bg-background px-2 sticky top-0 z-10 gap-2">
            <SidebarTrigger />
            <h1 className="ml-1 text-sm font-semibold flex-1 truncate">Gestión de Torneos</h1>
            {user && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline truncate max-w-[140px]">{user.email}</span>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    Admin
                  </span>
                )}
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Cerrar sesión">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
