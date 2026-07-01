import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PadelIdLogo } from "@/components/PadelIdLogo";
import { activeTenant } from "@/lib/tenant";

export default function Auth() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dni, setDni] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      navigate(isAdmin ? "/" : "/mi-panel", { replace: true });
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message);
    } else {
      toast.success("¡Bienvenido!");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `https://torneospadel-sigma.vercel.app`,
        data: { 
          display_name: displayName || email.split("@")[0],
          dni: dni.trim()
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cuenta creada. Iniciando sesión...");
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) toast.error(loginError.message);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <PadelIdLogo size={56} showText={true} />
          </div>
          <CardDescription>Plataforma de gestión de torneos y ranking</CardDescription>
          
          {/* Tenant indicator */}
          <div className="flex items-center justify-center gap-2 border-t pt-3 mt-1">
            <img
              src={activeTenant.logo}
              alt={activeTenant.name}
              className="h-6 w-6 object-contain rounded"
            />
            <span className="text-xs text-muted-foreground font-semibold">
              Accediendo al espacio de: <strong className="text-foreground">{activeTenant.name}</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-pass">Contraseña</Label>
                  <Input id="login-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Entrar
                </Button>
                <Button 
                  type="button" 
                  variant="link" 
                  className="w-full text-xs text-muted-foreground"
                  onClick={async () => {
                    if (!email) return toast.error("Ingresa tu email primero para recuperar la contraseña");
                    setLoading(true);
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: "https://torneospadel-sigma.vercel.app",
                    });
                    setLoading(false);
                    if (error) toast.error(error.message);
                    else toast.success("Se ha enviado un correo de recuperación a tu email.");
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Nombre</Label>
                  <Input id="su-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pass">Contraseña</Label>
                  <Input id="su-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-dni">DNI (Opcional — vincula tu ranking automático)</Label>
                  <Input id="su-dni" type="text" value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Ej: 35123456" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
