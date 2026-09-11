import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Trash2, UserPlus, ShieldAlert, Shield } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];

export function StaffManager() {
  const { clubActivo } = useAuth();
  const queryClient = useQueryClient();
  const [emailSearch, setEmailSearch] = useState("");

  const { data: operadores, isLoading } = useQuery({
    queryKey: ["operadores", clubActivo?.id],
    queryFn: async () => {
      if (!clubActivo) return [];
      const { data, error } = await supabase
        .from("perfiles")
        .select("*")
        .eq("club_id", clubActivo.id)
        .eq("rol", "operador");

      if (error) throw error;
      return data as Perfil[];
    },
    enabled: !!clubActivo,
  });

  const promoteMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!clubActivo) throw new Error("No hay club activo");
      
      // 1. Buscar al usuario por email (ya que email está visible públicamente)
      const { data: user, error: userError } = await supabase
        .from("perfiles")
        .select("*")
        .eq("email", email)
        .single();

      if (userError || !user) {
        throw new Error("No se encontró ningún usuario con ese correo electrónico");
      }

      if (user.rol === "super_admin" || user.rol === "club_admin") {
        throw new Error("Este usuario es administrador y no puede ser convertido en operador");
      }

      if (user.club_id && user.club_id !== clubActivo.id) {
        throw new Error("Este usuario ya pertenece a otro club");
      }

      // 2. Actualizar el perfil
      const { error: updateError } = await supabase
        .from("perfiles")
        .update({
          rol: "operador",
          club_id: clubActivo.id
        })
        .eq("id", user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return user;
    },
    onSuccess: (data) => {
      toast.success(`Usuario ${data.email || ''} promovido a Operador exitosamente`);
      setEmailSearch("");
      queryClient.invalidateQueries({ queryKey: ["operadores", clubActivo?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const demoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("perfiles")
        .update({
          rol: "jugador",
          club_id: null
        })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("El usuario ha sido removido del equipo");
      queryClient.invalidateQueries({ queryKey: ["operadores", clubActivo?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const handlePromote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSearch.trim()) return;
    promoteMutation.mutate(emailSearch.trim());
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Añadir Operador</CardTitle>
          <CardDescription>
            Busca a un usuario por su correo electrónico para darle acceso al panel de carga de resultados.
            El usuario debe haberse registrado previamente en la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePromote} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                className="pl-9"
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={promoteMutation.isPending}>
              {promoteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invitar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipo de Operadores</CardTitle>
          <CardDescription>
            Usuarios con permiso para cargar resultados y horarios en tu club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : operadores?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
              <ShieldAlert className="h-10 w-10 opacity-20 mb-3" />
              <p>No tienes operadores en tu equipo.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {operadores?.map((op) => (
                <div key={op.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{op.email || "Usuario sin correo"}</p>
                      <p className="text-xs text-muted-foreground capitalize">Operador</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => demoteMutation.mutate(op.id)}
                    disabled={demoteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
