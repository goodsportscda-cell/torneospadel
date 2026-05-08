import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth.tsx";
import Index from "./pages/Index.tsx";
import UserDashboard from "./pages/UserDashboard.tsx";
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
            <Route path="/inscribirse/:torneoId" element={<InscripcionPublica />} />
            <Route path="/torneo/:slug" element={<TorneoPublico />} />
            <Route path="/ranking-publico" element={<RankingPublico />} />
            {/* User dashboard - authenticated but not admin */}
            <Route
              path="/mi-panel"
              element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              }
            />
            {/* Admin routes */}
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
              <Route path="/importar" element={<Importar />} />
              <Route path="/llaves" element={<Llaves />} />
              <Route path="/posiciones" element={<Posiciones />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/master" element={<Master />} />
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
