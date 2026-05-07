import { Users, Calendar, Trophy, ClipboardList, LayoutGrid, Upload, GitBranch, BarChart3, Award, Star } from "lucide-react";
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
import goodPadelLogo from "@/assets/good-padel-logo.png";

const items = [
  { title: "Jugadores", url: "/jugadores", icon: Users },
  { title: "Calendario", url: "/calendario", icon: Calendar },
  { title: "Torneos", url: "/torneos", icon: Trophy },
  { title: "Inscripciones", url: "/inscripciones", icon: ClipboardList },
  { title: "Zonas", url: "/zonas", icon: LayoutGrid },
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
      <SidebarHeader className="border-b px-4 py-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <img
              src={goodPadelLogo}
              alt="Good Padel"
              className="h-10 w-10 object-contain shrink-0"
              width={40}
              height={40}
            />
            <div className="min-w-0">
              <h2 className="text-sm font-bold leading-tight truncate">Good Padel</h2>
              <p className="text-xs text-muted-foreground truncate">Panel Admin</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <img
              src={goodPadelLogo}
              alt="Good Padel"
              className="h-6 w-6 object-contain"
              width={24}
              height={24}
            />
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
