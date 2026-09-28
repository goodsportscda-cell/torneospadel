import { Link } from "react-router-dom";
import { MessageCircle, ShieldCheck, Building2 } from "lucide-react";
import { SUPPORT_URL, whatsappUrl, SUPPORT_PHONE } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LegalLinks from "@/components/LegalLinks";

export default function Help() {
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-10 space-y-8">
    <Link to="/" className="text-sm text-primary hover:underline">← Ir a Padel ID</Link>
    <div><p className="text-sm font-semibold text-primary">PADEL ID</p><h1 className="mt-2 text-3xl font-bold">¿En qué podemos ayudarte?</h1><p className="mt-3 text-muted-foreground">Elegí el contacto según tu consulta.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Consultas sobre tu club</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Para revisar puntos, categorías, horarios, pagos o inscripciones, contactá al club organizador desde el pie de su portal o de la página del torneo. Si todavía no publicó un contacto, solicitáselo directamente al organizador.</p><Button asChild variant="outline"><Link to="/">Buscar mi club</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />Soporte de Padel ID</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Problemas para ingresar, errores de la plataforma o consultas generales. Contanos qué pasó y en qué pantalla. Nunca compartas tu contraseña ni códigos de acceso.</p><Button asChild><a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a></Button><p className="text-xs text-muted-foreground">+54 9 11 6594-2709 · Se abre WhatsApp. El mensaje se envía cuando vos lo confirmás.</p></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Tus datos personales</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Podés solicitar acceso, corrección o eliminación de tus datos. Indicá qué necesitás; te orientaremos sobre la verificación de identidad y el alcance de la solicitud.</p><Button asChild variant="outline"><a href={whatsappUrl(SUPPORT_PHONE, "Hola, quiero hacer una consulta sobre mis datos personales en Padel ID.")!} target="_blank" rel="noopener noreferrer">Consultar sobre mis datos</a></Button></CardContent></Card>
    <LegalLinks />
  </main>;
}
