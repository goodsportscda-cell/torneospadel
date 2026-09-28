import { Link, useLocation } from "react-router-dom";
import { DATA_CONTROLLER, LEGAL_VERSION } from "@/lib/contact";
import LegalLinks from "@/components/LegalLinks";

const privacy = [
  ["Responsable y contacto", `Padel ID es una plataforma administrada por ${DATA_CONTROLLER}, persona física, con actividad inicial en Argentina. Podés comunicarte al WhatsApp +54 9 11 6594-2709 para consultas sobre tus datos. El club organizador gestiona la información y las decisiones deportivas de sus torneos; sus canales de contacto se muestran en su portal cuando los configura.`],
  ["Datos y finalidades", "Según el servicio que uses, se solicitan nombre, apellido, DNI, email, teléfono, ciudad, categoría, disponibilidad horaria y datos de inscripción. También se registran participaciones, resultados y puntos. Estos datos permiten administrar cuentas, identificar jugadores, vincular su historial, organizar competencias y comunicarse sobre ellas. El DNI es opcional al crear una cuenta y se solicita en el formulario de inscripción para identificar la ficha del jugador. Los campos obligatorios se indican en cada formulario; sin ellos puede no ser posible completar la operación."],
  ["Información pública y destinatarios", "El portal publica información deportiva: nombres de jugadores, categorías, participaciones, posiciones, puntos, partidos y resultados. Los administradores y operadores autorizados acceden a la información necesaria para gestionar sus torneos. La publicación deportiva no tiene como finalidad divulgar DNI, email, teléfono ni comprobantes. No incluyas datos sensibles, como información de salud, en observaciones o archivos adjuntos."],
  ["Inscripciones, pagos y terceros", "Si aportás datos de tu compañero, informale sobre su uso y compartile esta política antes de inscribirlo. Los comprobantes se utilizan para gestionar pagos de inscripción. Cuando se ofrece un pago mediante Mercado Pago, el procesamiento se realiza en ese servicio, sujeto también a sus propias condiciones. WhatsApp se abre solo al elegir un enlace de contacto; la comunicación queda sujeta a las políticas de ese proveedor."],
  ["Servicios tecnológicos", "La plataforma utiliza Supabase para autenticación, base de datos y almacenamiento, y servicios de alojamiento para entregar el sitio. Las fuentes tipográficas se solicitan a Google Fonts, lo que genera una conexión con ese proveedor. Estos servicios pueden tratar datos técnicos de conexión. La ubicación de los proveedores, sus subencargados y las garantías aplicables a eventuales transferencias internacionales deben considerarse al utilizar estos servicios."],
  ["Conservación y solicitudes", "Los datos se conservan mientras sean necesarios para las finalidades informadas y las obligaciones que correspondan. Podés solicitar acceso, rectificación, actualización o supresión a través de Ayuda y contacto. Se podrá verificar tu identidad para proteger tu información. Cada solicitud se evaluará considerando las obligaciones legales y los derechos de otras personas; se informará si algún dato debe conservarse y el motivo."],
  ["Autoridad de control", "La Agencia de Acceso a la Información Pública (AAIP) es la autoridad de control de la Ley 25.326. Podés acudir a ella para realizar consultas o reclamos sobre la protección de tus datos personales."],
  ["Menores y cambios", "Si la inscripción involucra a una persona menor de edad, contactá al organizador para coordinar la intervención de su representante cuando corresponda. Las modificaciones de este aviso se identificarán con una nueva versión y fecha. Los cambios de finalidad que requieran autorización deberán informarse antes de aplicar el nuevo uso."],
];
const terms = [
  ["Uso de la plataforma", "Padel ID facilita la gestión y consulta de torneos y rankings. Mantené tus datos correctos, cuidá tus credenciales y utilizá únicamente cuentas y datos para los que tengas autorización. No uses la plataforma para suplantar personas o acceder a información ajena."],
  ["Organización de torneos", "Cada club u organizador define categorías, reglamentos, horarios, cupos, precios, confirmaciones de pago, cancelaciones y devoluciones. Consultá esas condiciones antes de inscribirte. Las consultas o reclamos deportivos se dirigen al organizador; los problemas técnicos se comunican al soporte de Padel ID."],
  ["Inscripciones y resultados", "El envío de una inscripción puede quedar pendiente de confirmación, pago o disponibilidad de cupo. Revisá el estado informado. Los resultados y puntos dependen de la información cargada por el organizador y pueden corregirse cuando se detecten errores."],
  ["Disponibilidad y derechos", "El servicio puede requerir mantenimiento o sufrir interrupciones. Podés reportar problemas desde Ayuda. Estas condiciones no limitan los derechos que te reconozca la normativa aplicable, incluidos los de protección de datos y defensa del consumidor."],
];
const cookies = [
  ["Sesión y preferencias", "Padel ID usa almacenamiento local del navegador para mantener la sesión iniciada y recordar preferencias como el tema visual, filtros y opciones de torneos. La barra lateral utiliza una cookie de preferencia con una duración de siete días. El aviso de instalación de la aplicación guarda su estado durante la sesión del navegador."],
  ["Aplicación instalada y caché", "La aplicación puede guardar recursos en la caché del navegador para facilitar su carga e instalación. Borrar esos datos puede requerir una nueva descarga de recursos. La información local de sesión y preferencias puede permanecer hasta que se cierre la sesión, se reemplace o la elimines desde el navegador."],
  ["Control desde el navegador", "Podés borrar cookies, almacenamiento local y caché desde la configuración del navegador. Esto puede cerrar tu sesión o restablecer preferencias. En esta versión no se integraron herramientas de publicidad ni analítica de comportamiento; si se incorporan, se deberá actualizar este aviso y habilitar las opciones de consentimiento que correspondan."],
  ["Conexiones externas", "El sitio carga tipografías desde Google Fonts. Los enlaces de WhatsApp y los pagos externos abren servicios con políticas propias. El uso de almacenamiento técnico no equivale a una autorización para recibir publicidad."],
];

export default function Legal() {
  const { pathname } = useLocation();
  const title = pathname === "/privacidad" ? "Política de privacidad" : pathname === "/cookies" ? "Cookies y almacenamiento" : "Términos de uso";
  const sections = pathname === "/privacidad" ? privacy : pathname === "/cookies" ? cookies : terms;
  return <main className="mx-auto max-w-3xl px-4 py-10 space-y-7">
    <Link to="/" className="text-sm text-primary hover:underline">← Ir a Padel ID</Link>
    <header><h1 className="text-3xl font-bold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">Versión {LEGAL_VERSION} · Argentina</p></header>
    <aside className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Borrador para revisión antes de su publicación definitiva. Falta completar el domicilio de contacto del responsable y confirmar los plazos de conservación y las condiciones de los proveedores.</aside>
    {sections.map(([heading, body]) => <section key={heading} className="space-y-2"><h2 className="text-lg font-semibold">{heading}</h2><p className="text-sm leading-7 text-muted-foreground">{body}</p></section>)}
    <p className="text-sm"><Link to="/ayuda" className="text-primary underline">Ayuda y solicitudes sobre tus datos</Link></p>
    {pathname === "/privacidad" && <p className="text-sm">Más información: <a className="text-primary underline" href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noopener noreferrer">Derechos de los titulares — AAIP</a>.</p>}
    <div className="border-t pt-6"><LegalLinks /></div>
  </main>;
}
