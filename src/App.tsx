import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import SuperAdminRoute from "@/components/SuperAdminRoute";
import AppLayout from "@/components/AppLayout";
import { TenantProvider } from "@/contexts/TenantContext";
import Auth from "./pages/Auth.tsx";
import Index from "./pages/Index.tsx";
import ClubHome from "./pages/ClubHome.tsx";
import PlayerDashboard from "./pages/PlayerDashboard.tsx";
import Jugadores from "./pages/Jugadores.tsx";
import Calendario from "./pages/Calendario.tsx";
import Torneos from "./pages/Torneos.tsx";
import Inscripciones from "./pages/Inscripciones.tsx";
import Zonas from "./pages/Zonas.tsx";
import Importar from "./pages/Importar.tsx";
import Llaves from "./pages/Llaves.tsx";
import Posiciones from "./pages/Posiciones.tsx";
import Ranking from "./pages/Ranking.tsx";
import Master from "./pages/Master.tsx";
import InscripcionPublica from "./pages/InscripcionPublica.tsx";
import TorneoPublico from "./pages/TorneoPublico.tsx";
import RankingPublico from "./pages/RankingPublico.tsx";
import CanchasEnVivo from "./pages/CanchasEnVivo.tsx";
import TorneoIndividualDashboard from "./pages/TorneoIndividualDashboard.tsx";
import TorneoIndividualPublico from "./pages/TorneoIndividualPublico.tsx";
import SuperAdminDashboard from "./pages/SuperAdminDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" enableSystem attribute="class">
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            {/* Rutas Publicas Hibridas - Especificas por Club */}
            <Route path="/c/:clubSlug/*" element={
              <TenantProvider>
                <Routes>
                  <Route path="/" element={<ClubHome />} />
                  <Route path="/torneo/:slug" element={<TorneoPublico />} />
                  <Route path="/torneo-individual/:id" element={<TorneoIndividualPublico />} />
                  <Route path="/ranking-publico" element={<RankingPublico />} />
                  <Route path="/inscribirse/:torneoId" element={<InscripcionPublica />} />
                </Routes>
              </TenantProvider>
            } />

            {/* Legacy Public Routes (Fallback o redirect en el futuro) */}
            <Route path="/inscribirse/:torneoId" element={<InscripcionPublica />} />
            <Route path="/torneo/:slug" element={<TorneoPublico />} />
            <Route path="/torneo-individual/:id" element={<TorneoIndividualPublico />} />
            <Route path="/ranking-publico" element={<RankingPublico />} />
            <Route path="/mi-panel" element={<Navigate to="/player/dashboard" replace />} />

            {/* Player dashboard */}
            <Route
              path="/player/dashboard"
              element={
                <ProtectedRoute>
                  <PlayerDashboard />
                </ProtectedRoute>
              }
            />

            {/* Super Admin Dashboard (Standalone) */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute>
                  <SuperAdminRoute>
                    <SuperAdminDashboard />
                  </SuperAdminRoute>
                </ProtectedRoute>
              }
            />

            {/* Admin routes (Club Level) */}
            <Route
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AppLayout />
                  </AdminRoute>
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Index />} />
              <Route path="/jugadores" element={<Jugadores />} />
              <Route path="/calendario" element={<Calendario />} />
              <Route path="/torneos" element={<Torneos />} />
              <Route path="/inscripciones" element={<Inscripciones />} />
              <Route path="/zonas" element={<Zonas />} />
              <Route path="/canchas-en-vivo" element={<CanchasEnVivo />} />
              <Route path="/importar" element={<Importar />} />
              <Route path="/llaves" element={<Llaves />} />
              <Route path="/posiciones" element={<Posiciones />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/master" element={<Master />} />
              <Route path="/admin/torneo-individual/:id" element={<TorneoIndividualDashboard />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
);

export default App;
