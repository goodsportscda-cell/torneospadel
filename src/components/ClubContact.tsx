import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { whatsappUrl } from "@/lib/contact";

export default function ClubContact({ clubId }: { clubId?: string | null }) {
  const { data: club } = useQuery({
    queryKey: ["club-contact", clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase.from("clubes").select("nombre, contacto_whatsapp, contacto_email").eq("id", clubId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
  const url = club?.contacto_whatsapp ? whatsappUrl(club.contacto_whatsapp, `Hola, tengo una consulta sobre puntos o torneos de ${club.nombre}.`) : null;
  if (!club || (!url && !club.contacto_email)) return null;
  return <section className="mx-auto max-w-xl px-4 pb-3 space-y-2 print:hidden" aria-label="Contacto del club">
    <p className="text-sm font-medium">¿Dudas sobre puntos, categorías o torneos de {club.nombre}?</p>
    <div className="flex flex-wrap justify-center gap-4 text-sm text-primary">
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Contactar al club por WhatsApp</a>}
      {club.contacto_email && <a href={`mailto:${club.contacto_email}`} className="underline">Escribir al club por email</a>}
    </div>
  </section>;
}
