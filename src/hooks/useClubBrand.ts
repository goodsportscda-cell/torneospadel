import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOptionalTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

type ClubBrand = { id: string; nombre: string; logo_url: string | null };

/** Identidad del club para encabezados y materiales compartidos. */
export function useClubBrand(explicitClubId?: string | null) {
  const { clubActivo } = useAuth();
  const tenantContext = useOptionalTenant();
  const tenantClub = tenantContext?.club ?? null;
  const [queriedClub, setQueriedClub] = useState<ClubBrand | null>(null);

  useEffect(() => {
    if (!explicitClubId || tenantClub?.id === explicitClubId || clubActivo?.id === explicitClubId) {
      setQueriedClub(null);
      return;
    }

    setQueriedClub(null);
    let cancelled = false;
    supabase
      .from("clubes")
      .select("id, nombre, logo_url")
      .eq("id", explicitClubId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setQueriedClub(error ? null : data);
      });

    return () => { cancelled = true; };
  }, [explicitClubId, tenantClub?.id, clubActivo?.id]);

  const club = explicitClubId
    ? (tenantClub?.id === explicitClubId ? tenantClub : clubActivo?.id === explicitClubId ? clubActivo : queriedClub)
    : tenantClub ?? clubActivo;

  return {
    club,
    nombre: club?.nombre ?? "Padel ID",
    logoUrl: club?.logo_url ?? null,
  };
}
