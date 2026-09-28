import { Link } from "react-router-dom";

export default function LegalLinks() {
  return <nav aria-label="Ayuda e información legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs print:hidden">
    <Link className="hover:underline" to="/ayuda">Ayuda y contacto</Link>
    <Link className="hover:underline" to="/privacidad">Privacidad</Link>
    <Link className="hover:underline" to="/terminos">Términos de uso</Link>
    <Link className="hover:underline" to="/cookies">Cookies y almacenamiento</Link>
  </nav>;
}
