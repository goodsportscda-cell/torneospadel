import { Link } from "react-router-dom";

export default function PrivacyNotice({ registration = false }: { registration?: boolean }) {
  return <aside className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
    {registration
      ? "Padel ID y el club organizador usan los datos ingresados para gestionar la inscripción y comunicarse sobre el torneo. Nombres, categorías, participaciones, resultados y puntos forman parte de la actividad pública del torneo. Si inscribís a otra persona, compartile este aviso y asegurate de tener su autorización. No incluyas datos de salud ni información sensible en observaciones. "
      : "Padel ID usa tus datos para crear y administrar tu cuenta. El DNI es opcional y permite vincular tu historial deportivo. "}
    Consultá la <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="text-primary underline">política de privacidad</Link> y los <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="text-primary underline">términos de uso</Link>. Podés solicitar acceso, corrección o eliminación desde <Link to="/ayuda" target="_blank" rel="noopener noreferrer" className="text-primary underline">Ayuda</Link>.
  </aside>;
}
