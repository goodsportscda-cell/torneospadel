import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
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
import { InstallPwaPrompt } from "./components/InstallPwaPrompt";

const Auth = lazy(() => import("./pages/Auth.tsx"));
const Help = lazy(() => import("./pages/Help.tsx"));
const Legal = lazy(() => import("./pages/Legal.tsx"));
const PublicHome = lazy(() => import("./pages/PublicHome.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const ClubHome = lazy(() => import("./pages/ClubHome.tsx"));
const PlayerDashboard = lazy(() => import("./pages/PlayerDashboard.tsx"));
const Jugadores = lazy(() => import("./pages/Jugadores.tsx"));
const Calendario = lazy(() => import("./pages/Calendario.tsx"));
const Torneos = lazy(() => import("./pages/Torneos.tsx"));
const Inscripciones = lazy(() => import("./pages/Inscripciones.tsx"));
const Zonas = lazy(() => import("./pages/Zonas.tsx"));
const Importar = lazy(() => import("./pages/Importar.tsx"));
const Llaves = lazy(() => import("./pages/Llaves.tsx"));
const Ranking = lazy(() => import("./pages/Ranking.tsx"));
const InscripcionPublica = lazy(() => import("./pages/InscripcionPublica.tsx"));
const TorneoPublico = lazy(() => import("./pages/TorneoPublico.tsx"));
const RankingPublico = lazy(() => import("./pages/RankingPublico.tsx"));
const CanchasEnVivo = lazy(() => import("./pages/CanchasEnVivo.tsx"));
const TorneoIndividualDashboard = lazy(() => import("./pages/TorneoIndividualDashboard.tsx"));
const TorneoIndividualPublico = lazy(() => import("./pages/TorneoIndividualPublico.tsx"));
const TorneoTvView = lazy(() => import("./pages/TorneoTvView.tsx"));
const TorneoTvRouter = lazy(() => import("./pages/TorneoTvRouter.tsx"));
const TorneoTvSelector = lazy(() => import("./pages/TorneoTvSelector.tsx"));
  const TorneoTvCanchas = lazy(() => import("./pages/TorneoTvCanchas.tsx"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard.tsx"));
const Configuracion = lazy(() => import("./pages/Configuracion.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Marcador = lazy(() => import("./pages/Marcador.tsx"));
const DraftPublico = lazy(() => import("./pages/DraftPublico.tsx"));

const queryClient = new QueryClient();

const RouteAwareSpeedInsights = () => {
  const { pathname } = useLocation();
  return <SpeedInsights route={pathname} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" enableSystem attribute="class">
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteAwareSpeedInsights />
        <AuthProvider>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
                Cargando Padel ID...
              </div>
            }
          >
            <Routes>
            <Route path="/" element={<PublicHome />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/ayuda" element={<Help />} />
            <Route path="/privacidad" element={<Legal />} />
            <Route path="/terminos" element={<Legal />} />
            <Route path="/cookies" element={<Legal />} />
            
            {/* Rutas Publicas Hibridas - Especificas por Club */}
            <Route path="/c/:clubSlug/*" element={
              <TenantProvider>
                <Routes>
                  <Route path="/" element={<ClubHome />} />
                  <Route path="/torneo/:slug" element={<TorneoPublico />} />
                  <Route path="/torneo-individual/:id" element={<TorneoIndividualPublico />} />
                  <Route path="/torneo-individual/:id/tv" element={<TorneoTvView />} />
                  <Route path="/torneo/:id/tv" element={<TorneoTvRouter />} />
                  <Route path="/tv/:id" element={<TorneoTvRouter />} />
                  <Route path="/tv/canchas" element={<TorneoTvCanchas />} />
                  <Route path="/ranking-publico" element={<RankingPublico />} />
                  <Route path="/inscribirse/:torneoId" element={<InscripcionPublica />} />
                  <Route path="/draft/:id" element={<DraftPublico />} />
                </Routes>
              </TenantProvider>
            } />

            {/* Legacy Public Routes (Fallback o redirect en el futuro) */}
            <Route path="/inscribirse/:torneoId" element={<InscripcionPublica />} />
            <Route path="/torneo/:slug" element={<TorneoPublico />} />
            <Route path="/torneo-individual/:id" element={<TorneoIndividualPublico />} />
            <Route path="/torneo-individual/:id/tv" element={<TorneoTvView />} />
            <Route path="/torneo/:id/tv" element={<TorneoTvRouter />} />
            <Route path="/tv/:id" element={<TorneoTvRouter />} />
            <Route path="/tv" element={<TorneoTvSelector />} />
            <Route path="/tv/canchas" element={<TorneoTvCanchas />} />
            <Route path="/ranking-publico" element={<RankingPublico />} />
            <Route path="/mi-panel" element={<Navigate to="/player/dashboard" replace />} />
            <Route path="/draft/:id" element={<DraftPublico />} />

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
              <Route path="/panel" element={<Index />} />
              <Route path="/jugadores" element={<Jugadores />} />
              <Route path="/calendario" element={<Calendario />} />
              <Route path="/torneos" element={<Torneos />} />
              <Route path="/inscripciones" element={<Inscripciones />} />
              <Route path="/zonas" element={<Zonas />} />
              <Route path="/canchas-en-vivo" element={<CanchasEnVivo />} />
              <Route path="/importar" element={<Importar />} />
              <Route path="/llaves" element={<Llaves />} />
              <Route path="/posiciones" element={<Navigate to="/ranking" replace />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/master" element={<Navigate to="/ranking" replace />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/marcador" element={<Marcador />} />
              <Route path="/admin/torneo-individual/:id" element={<TorneoIndividualDashboard />} />
              <Route path="/admin/torneo-individual/:id/tv" element={<TorneoTvView />} />
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <InstallPwaPrompt />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
);

export default App;
