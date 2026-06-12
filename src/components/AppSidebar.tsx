import { Users, Calendar, Trophy, ClipboardList, LayoutGrid, Upload, GitBranch, BarChart3, Award, Star, Activity } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { activeTenant } from "@/lib/tenant";

const items = [
  { title: "Jugadores", url: "/jugadores", icon: Users },
  { title: "Calendario", url: "/calendario", icon: Calendar },
  { title: "Torneos", url: "/torneos", icon: Trophy },
  { title: "Inscripciones", url: "/inscripciones", icon: ClipboardList },
  { title: "Zonas", url: "/zonas", icon: LayoutGrid },
  { title: "Canchas en vivo", url: "/canchas-en-vivo", icon: Activity },
  { title: "Importar inscriptos", url: "/importar", icon: Upload },
  { title: "Llaves", url: "/llaves", icon: GitBranch },
  { title: "Posiciones", url: "/posiciones", icon: BarChart3 },
  { title: "Ranking", url: "/ranking", icon: Award },
  { title: "Master", url: "/master", icon: Star },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3 flex flex-col gap-2">
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between">
              <PadelIdLogo size={32} showText={true} />
            </div>
            
            {/* Cliente Tenant Badge */}
            <div className="flex items-center gap-2.5 bg-muted/65 dark:bg-muted/30 border border-border/80 rounded-lg p-2 mt-1">
              <img
                src={activeTenant.logo}
                alt={activeTenant.name}
                className="h-6 w-6 object-contain shrink-0 rounded"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-muted-foreground font-semibold leading-none uppercase tracking-wider">Cliente Activo</p>
                <p className="text-xs font-bold truncate leading-tight mt-0.5 text-foreground">{activeTenant.name}</p>
                <p className="text-[9px] text-muted-foreground truncate leading-none mt-0.5 font-medium">{activeTenant.subtext}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-1">
             <PadelIdLogo size={24} showText={false} />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
