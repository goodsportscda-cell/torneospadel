import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Smartphone,
  Laptop,
  Apple,
  Share,
  PlusSquare,
  MoreVertical,
  ShieldAlert,
  Sparkles,
  X,
  CheckCircle2,
} from "lucide-react";

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Detectar si ya corre como PWA instalada
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(isStandaloneMode);
      if (isStandaloneMode) return;

      // Verificar si el usuario lo cerró en esta sesión
      const dismissed = sessionStorage.getItem("padel_id_install_dismissed");
      if (!dismissed) {
        setShowFloatingButton(true);
      }
    };

    checkStandalone();

    // Capturar evento beforeinstallprompt de Chromium (Chrome, Brave, Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowFloatingButton(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Escuchar cuando el usuario instala la app
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowFloatingButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setShowFloatingButton(false);
          setDeferredPrompt(null);
          return;
        }
      } catch (err) {
        console.warn("No se pudo ejecutar deferredPrompt directamente:", err);
      }
    }
    // Si no hay prompt nativo disponible (ej. iOS o Brave con escudos), abrir la guía modal interactiva
    setDialogOpen(true);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    setShowFloatingButton(false);
    sessionStorage.setItem("padel_id_install_dismissed", "true");
  };

  if (isStandalone || !showFloatingButton || isDismissed) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <InstallGuideContent deferredPrompt={deferredPrompt} />
      </Dialog>
    );
  }

  return (
    <>
      {/* Botón Flotante Elegante "Instalar App" */}
      <div className="fixed bottom-4 left-4 z-50 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="relative group">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs shadow-[0_4px_20px_rgba(245,158,11,0.4)] hover:shadow-[0_6px_25px_rgba(245,158,11,0.6)] hover:scale-[1.02] active:scale-95 transition-all border border-amber-300/60"
            title="Instalar Padel ID en tu pantalla de inicio"
          >
            <img
              src="/pwa-192x192.png"
              alt="Padel ID Logo"
              className="h-5 w-5 rounded-full object-cover shadow-sm ring-1 ring-black/20"
            />
            <span className="flex items-center gap-1">
              Instalar App
              <Download className="h-3.5 w-3.5" />
            </span>
          </button>

          <button
            onClick={handleDismiss}
            aria-label="Cerrar sugerencia de instalación"
            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-neutral-900 border border-neutral-700 text-muted-foreground hover:text-white flex items-center justify-center text-[10px] shadow"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <InstallGuideContent deferredPrompt={deferredPrompt} />
      </Dialog>
    </>
  );
}

function InstallGuideContent({ deferredPrompt }: { deferredPrompt: any }) {
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || "");

  const defaultTab = isIOS ? "ios" : "android";

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <img
            src="/pwa-192x192.png"
            alt="Padel ID"
            className="h-10 w-10 rounded-xl shadow-md border border-amber-500/40"
          />
          <div>
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-1.5">
              <span>Instalar Padel ID</span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tené el acceso directo con el icono oficial en la pantalla de inicio de tu celular o PC.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Si hay prompt nativo disponible */}
        {deferredPrompt && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-bold text-amber-600 dark:text-amber-400 block">
                ¡Tu navegador permite instalación directa!
              </span>
              <span className="text-muted-foreground text-[11px]">
                Presioná el botón para agregarlo al instante con el icono dorado.
              </span>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  deferredPrompt.prompt();
                } catch (e) {
                  console.error(e);
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0 text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Instalar Ahora
            </Button>
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="android" className="gap-1.5 text-xs">
              <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
              Android / Brave
            </TabsTrigger>
            <TabsTrigger value="ios" className="gap-1.5 text-xs">
              <Apple className="h-3.5 w-3.5 text-slate-300" />
              iPhone (iOS)
            </TabsTrigger>
            <TabsTrigger value="pc" className="gap-1.5 text-xs">
              <Laptop className="h-3.5 w-3.5 text-sky-400" />
              Computadora
            </TabsTrigger>
          </TabsList>

          {/* TAB ANDROID / BRAVE */}
          <TabsContent value="android" className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/30 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-foreground">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-[11px]">
                  1
                </span>
                Opción Recomendada en Brave / Chrome:
              </div>
              <p className="text-muted-foreground pl-6 text-[11px] leading-relaxed">
                Tocá los <strong>tres puntos verticales (⋮)</strong> del navegador (en la barra superior o inferior) y elegí <strong>"Instalar aplicación"</strong> (o <strong>"Agregar a la pantalla principal"</strong>).
              </p>
            </div>

            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-500">
                <ShieldAlert className="h-4 w-4" />
                ¿Por qué a veces Brave no encuentra el icono?
              </div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                <li>
                  <strong>Escudos de Brave:</strong> Si tenés la protección estricta activada, Brave a veces bloquea temporalmente los manifiestos de iconos de sitios web.
                </li>
                <li>
                  <strong>Solución rápida en Brave:</strong> Tocá el icono del <strong>León naranja</strong> en la barra de URL y desactivá los escudos para esta web, luego volvé a tocar <em>"Instalar aplicación"</em>.
                </li>
                <li>
                  <strong>Alternativa 100% nativa:</strong> Abrir el link en <strong>Google Chrome</strong> en tu celular Android. Chrome genera un <strong>WebAPK automático</strong> con el escudo dorado que aparece directamente en el cajón de apps de tu teléfono.
                </li>
              </ul>
            </div>
          </TabsContent>

          {/* TAB IPHONE / IOS */}
          <TabsContent value="ios" className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/30 space-y-2.5">
              <div className="font-bold text-foreground">
                Pasos para Safari en iPhone / iPad:
              </div>
              <ol className="space-y-2 pl-1 text-muted-foreground text-[11px]">
                <li className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </span>
                  <span>
                    Abrí esta página en el navegador <strong>Safari</strong> (en iOS sólo Safari permite instalar apps PWA en el inicio).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-[10px]">
                    2
                  </span>
                  <span>
                    Tocá el botón <strong>Compartir</strong> <Share className="inline h-3.5 w-3.5 mx-0.5" /> (el cuadrado con la flecha hacia arriba en la barra inferior).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-[10px]">
                    3
                  </span>
                  <span>
                    Deslizá hacia abajo y seleccioná <strong>"Agregar a la pantalla de inicio"</strong> <PlusSquare className="inline h-3.5 w-3.5 mx-0.5" />.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 text-[10px]">
                    4
                  </span>
                  <span>
                    Tocá <strong>"Agregar"</strong> arriba a la derecha. ¡Listo! Tendrás el icono dorado de Padel ID en tu pantalla.
                  </span>
                </li>
              </ol>
            </div>
          </TabsContent>

          {/* TAB COMPUTADORA */}
          <TabsContent value="pc" className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/30 space-y-2">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <Laptop className="h-4 w-4 text-sky-400" />
                Instalar en Windows / Mac / Linux:
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                En Brave, Chrome o Microsoft Edge, mirá el extremo derecho de la barra donde escribís la dirección web:
              </p>
              <div className="p-2.5 rounded bg-background border border-border flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <span className="text-[11px]">
                  Hacé clic en el icono de la <strong>pantallita con flecha ("Instalar Padel ID")</strong>.
                </span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Se creará un acceso directo en tu Escritorio y menú de inicio que abre la app sin barras de navegador.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DialogContent>
  );
}
