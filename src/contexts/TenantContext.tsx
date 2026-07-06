import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Club {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
}

interface TenantContextType {
  club: Club | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { clubSlug } = useParams<{ clubSlug: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClub() {
      if (!clubSlug) {
        setClub(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("clubes")
        .select("*")
        .eq("slug", clubSlug)
        .maybeSingle();

      if (error || !data) {
        setError("Club no encontrado");
        setClub(null);
      } else {
        setClub(data as Club);
      }
      setLoading(false);
    }

    fetchClub();
  }, [clubSlug]);

  return (
    <TenantContext.Provider value={{ club, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
