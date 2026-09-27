import { useClubBrand } from "@/hooks/useClubBrand";

export default function PublicFooter({ clubId }: { clubId?: string | null }) {
  const { club } = useClubBrand(clubId);
  return (
    <footer className="mt-auto border-t py-6 bg-muted/10 text-center space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">
        © {new Date().getFullYear()} Padel ID. Todos los derechos reservados.
      </p>
      <p className="text-[10px] text-muted-foreground max-w-md mx-auto leading-relaxed px-4">
        {club ? `Portal público de ${club.nombre} · ` : ""}Torneos y rankings.
      </p>
    </footer>
  );
}
