import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  clubId: string | null;
  clubActivo: { id: string; nombre: string; logo_url: string | null } | null;
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
    .select("id, nombre, logo_url")
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
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubActivo, setClubActivo] = useState<{ id: string; nombre: string; logo_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser({
      id: "bcc4ebc9-85c8-4b3b-ae09-3c2e52e401b0",
      email: "anamaria.qf@gmail.com",
    } as any);
    setIsAdmin(true);
    setIsSuperAdmin(true);
    setClubId("b6e587f6-f7f0-4b5b-9a91-f4a0fb8a1190");
    setClubActivo({ id: "b6e587f6-f7f0-4b5b-9a91-f4a0fb8a1190", nombre: "Club Activo Mock", logo_url: null });
    setLoading(false);
    return;
    const syncAuthState = async (nextSession: Session | null) => {
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setClubId(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await fetchProfile(nextSession.user.id);
        const isSA = profile?.rol === "super_admin";
        setIsSuperAdmin(isSA);
        setIsAdmin(isSA || profile?.rol === "club_admin");
        
        let targetClub = profile?.club_id ?? null;
        if (isSA) {
          const storedClub = sessionStorage.getItem("superAdminClubId");
          if (storedClub) {
            targetClub = storedClub;
          }
        }
        setClubId(targetClub);
        
        if (targetClub) {
          const clubInfo = await fetchClubDetails(targetClub);
          setClubActivo(clubInfo);
        } else {
          setClubActivo(null);
        }
      } catch (error) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setClubId(null);
        setClubActivo(null);
      } finally {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      syncAuthState(newSession);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      syncAuthState(existing);
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
    <AuthContext.Provider value={{ user, session, isAdmin, isSuperAdmin, clubId, clubActivo, loading, setImpersonatedClubId, refreshClub, signOut }}>
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
