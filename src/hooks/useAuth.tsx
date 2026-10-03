import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isOperador: boolean;
  clubId: string | null;
  clubActivo: { id: string; nombre: string; slug: string; logo_url: string | null } | null;
  loading: boolean;
  setImpersonatedClubId: (id: string | null) => void;
  refreshClub: () => Promise<void>;
  signOut: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("perfiles")
    .select("rol, club_id")
    .eq("id", userId)
    .maybeSingle();
    
  if (error) {
    console.error("Error al obtener perfil desde public.perfiles:", error);
  }
  
  return data;
}

async function fetchClubDetails(clubId: string) {
  const { data, error } = await supabase
    .from("clubes")
    .select("id, nombre, slug, logo_url")
    .eq("id", clubId)
    .maybeSingle();
    
  if (error) {
    console.error("Error al obtener detalles del club:", error);
  }
  
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isOperador, setIsOperador] = useState(false);
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubActivo, setClubActivo] = useState<{ id: string; nombre: string; slug: string; logo_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const profileLoadedForUserRef = useRef<string | null>(null);
  const syncGenerationRef = useRef(0);

  useEffect(() => {
    const syncAuthState = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        syncGenerationRef.current += 1;
        profileLoadedForUserRef.current = null;
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsOperador(false);
        setClubId(null);
        setClubActivo(null);
        setLoading(false);
        return;
      }

      // Auth events can repeat for the same user; don't fetch the same profile twice.
      if (profileLoadedForUserRef.current === nextSession.user.id) return;

      const generation = ++syncGenerationRef.current;
      profileLoadedForUserRef.current = nextSession.user.id;
      setLoading(true);

      try {
        const profile = await fetchProfile(nextSession.user.id);
        if (generation !== syncGenerationRef.current) return;
        const isSA = profile?.rol === "super_admin";
        setIsSuperAdmin(isSA);
        setIsAdmin(isSA || profile?.rol === "club_admin");
        setIsOperador(profile?.rol === "operador");
        
        let targetClub = profile?.club_id ?? null;
        if (isSA) {
          const storedClub = sessionStorage.getItem("superAdminClubId");
          if (storedClub) {
            targetClub = storedClub;
          }
        }
        setClubId(targetClub);
        
        // Roles are enough to route the user into the app. Load club details in
        // the background so a second network round trip does not block login.
        setClubActivo(null);
        setLoading(false);
        if (targetClub) {
          void fetchClubDetails(targetClub).then((clubInfo) => {
            if (generation === syncGenerationRef.current) setClubActivo(clubInfo);
          }).catch((error) => {
            if (generation === syncGenerationRef.current) setClubActivo(null);
            console.error("Error al cargar los datos del club:", error);
          });
        }
      } catch (error) {
        if (generation !== syncGenerationRef.current) return;
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsOperador(false);
        setClubId(null);
        setClubActivo(null);
      } finally {
        if (generation === syncGenerationRef.current) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Defer Supabase queries until the auth callback releases its internal lock.
      queueMicrotask(() => void syncAuthState(newSession));
    });

    return () => subscription.unsubscribe();
  }, []);

  const setImpersonatedClubId = (id: string | null) => {
    if (!isSuperAdmin) return;
    if (id) {
      sessionStorage.setItem("superAdminClubId", id);
      setClubId(id);
      fetchClubDetails(id).then(data => setClubActivo(data));
    } else {
      sessionStorage.removeItem("superAdminClubId");
      setClubId(null);
      setClubActivo(null);
    }
  };

  const refreshClub = async () => {
    if (clubId) {
      const clubInfo = await fetchClubDetails(clubId);
      setClubActivo(clubInfo);
    }
  };

  const signOut = async () => {
    sessionStorage.removeItem("superAdminClubId");
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isSuperAdmin, isOperador, clubId, clubActivo, loading, setImpersonatedClubId, refreshClub, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
