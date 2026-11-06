import { Component, lazy, Suspense, type ComponentType, type ErrorInfo, type ReactNode } from "react";
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

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Unable to preload CSS") ||
    msg.includes("Loading chunk") ||
    msg.includes("error loading dynamically imported module")
  );
}

async function clearCachesAndReloadOnce() {
  const reloadKey = "padel_lazy_reload_ts";
  const lastReload = Number(sessionStorage.getItem(reloadKey) || "0");
  if (Date.now() - lastReload > 10_000) {
    sessionStorage.setItem(reloadKey, String(Date.now()));
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch {
      // ignore cache cleanup errors
    }
    window.location.reload();
  }
}

function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err)) {
        await clearCachesAndReloadOnce();
      }
      throw err;
    }
  });
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AppErrorBoundary caught error:", error, info);
    if (isChunkLoadError(error)) {
      clearCachesAndReloadOnce();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
          <div className="max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">
              Actualización disponible
            </h2>
            <p className="text-sm text-muted-foreground">
              Se publicó una nueva versión del sistema. Recargá la página para continuar.
            </p>
            {this.state.error?.message && (
              <p className="rounded bg-muted p-2 font-mono text-[11px] text-muted-foreground break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  sessionStorage.removeItem("padel_lazy_reload_ts");
                  sessionStorage.removeItem("padel_chunk_reload_ts");
                  try {
                    if ("caches" in window) {
                      const names = await caches.keys();
                      await Promise.all(names.map((n) => caches.delete(n)));
                    }
                  } catch {
                    // ignore
                  }
                  window.location.reload();
                }}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
              >
                Recargar ahora
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Auth = lazyWithRetry(() => import("./pages/Auth.tsx"));
const Help = lazyWithRetry(() => import("./pages/Help.tsx"));
const Legal = lazyWithRetry(() => import("./pages/Legal.tsx"));
const PublicHome = lazyWithRetry(() => import("./pages/PublicHome.tsx"));
const Index = lazyWithRetry(() => import("./pages/Index.tsx"));
const ClubHome = lazyWithRetry(() => import("./pages/ClubHome.tsx"));
const PlayerDashboard = lazyWithRetry(() => import("./pages/PlayerDashboard.tsx"));
const Jugadores = lazyWithRetry(() => import("./pages/Jugadores.tsx"));
const Calendario = lazyWithRetry(() => import("./pages/Calendario.tsx"));
const Torneos = lazyWithRetry(() => import("./pages/Torneos.tsx"));
const Inscripciones = lazyWithRetry(() => import("./pages/Inscripciones.tsx"));
const Zonas = lazyWithRetry(() => import("./pages/Zonas.tsx"));
const Importar = lazyWithRetry(() => import("./pages/Importar.tsx"));
const Llaves = lazyWithRetry(() => import("./pages/Llaves.tsx"));
const Ranking = lazyWithRetry(() => import("./pages/Ranking.tsx"));
const InscripcionPublica = lazyWithRetry(() => import("./pages/InscripcionPublica.tsx"));
const TorneoPublico = lazyWithRetry(() => import("./pages/TorneoPublico.tsx"));
const RankingPublico = lazyWithRetry(() => import("./pages/RankingPublico.tsx"));
const CanchasEnVivo = lazyWithRetry(() => import("./pages/CanchasEnVivo.tsx"));
const TorneoIndividualDashboard = lazyWithRetry(() => import("./pages/TorneoIndividualDashboard.tsx"));
const TorneoIndividualPublico = lazyWithRetry(() => import("./pages/TorneoIndividualPublico.tsx"));
const TorneoTvView = lazyWithRetry(() => import("./pages/TorneoTvView.tsx"));
const TorneoTvRouter = lazyWithRetry(() => import("./pages/TorneoTvRouter.tsx"));
const TorneoTvSelector = lazyWithRetry(() => import("./pages/TorneoTvSelector.tsx"));
const TorneoTvCanchas = lazyWithRetry(() => import("./pages/TorneoTvCanchas.tsx"));
const SuperAdminDashboard = lazyWithRetry(() => import("./pages/SuperAdminDashboard.tsx"));
const Configuracion = lazyWithRetry(() => import("./pages/Configuracion.tsx"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound.tsx"));
const Marcador = lazyWithRetry(() => import("./pages/Marcador.tsx"));
const DraftPublico = lazyWithRetry(() => import("./pages/DraftPublico.tsx"));

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
            <AppErrorBoundary>
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
                  <Route
                    path="/c/:clubSlug/*"
                    element={
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
                    }
                  />

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
            </AppErrorBoundary>
            <InstallPwaPrompt />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
