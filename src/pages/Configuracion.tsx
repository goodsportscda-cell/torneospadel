import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Image as ImageIcon, Users, Settings, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffManager } from "@/components/configuracion/StaffManager";
import ClubContactSettings from "@/components/configuracion/ClubContactSettings";

export default function Configuracion() {
  const { clubActivo, refreshClub } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [clubName, setClubName] = useState(clubActivo?.nombre ?? "");
  const [clubSlug, setClubSlug] = useState(clubActivo?.slug ?? "");
  const [isSavingClubName, setIsSavingClubName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClubName(clubActivo?.nombre ?? "");
    setClubSlug(clubActivo?.slug ?? "");
  }, [clubActivo?.id, clubActivo?.nombre, clubActivo?.slug]);

  const handleSaveClubName = async () => {
    if (!clubActivo) return;
    const nombre = clubName.trim();
    if (!nombre) {
      toast.error("El nombre del club no puede quedar vacío.");
      return;
    }
    if (!clubSlug) {
      toast.error("La dirección corta no puede quedar vacía.");
      return;
    }
    if (nombre === clubActivo.nombre && clubSlug === clubActivo.slug) return;

    setIsSavingClubName(true);
    try {
      const { error } = await supabase.from("clubes").update({ nombre, slug: clubSlug }).eq("id", clubActivo.id);
      if (error?.code === "23505") throw new Error("Esa dirección corta ya está en uso. Elegí otra.");
      if (error) throw error;

      await refreshClub();
      toast.success("Nombre del club actualizado.");
    } catch (error: any) {
      console.error("No se pudo actualizar el nombre del club:", error);
      toast.error(`No se pudo guardar el nombre: ${error?.message || "Error de conexión"}`);
    } finally {
      setIsSavingClubName(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !clubActivo) return;

    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen (JPG, PNG)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe pesar más de 2MB');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clubActivo.id}_${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Subir la imagen al bucket
      const { error: uploadError } = await supabase.storage
        .from('club-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // 2. Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from('club-logos')
        .getPublicUrl(filePath);

      const logoUrl = publicUrlData.publicUrl;

      // 3. Actualizar la tabla clubes
      const { error: updateError } = await supabase
        .from('clubes')
        .update({ logo_url: logoUrl })
        .eq('id', clubActivo.id);

      if (updateError) {
        throw updateError;
      }

      // 4. Actualizar el contexto para reflejar el cambio inmediato
      await refreshClub();
      
      toast.success('Logotipo actualizado correctamente');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(`Error al subir la imagen: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configuración del Club</h2>
        <p className="text-muted-foreground">Gestiona la información pública, la identidad visual y tu equipo de trabajo.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="equipo" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipo / Staff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <ClubContactSettings key={clubActivo?.id} clubId={clubActivo?.id} />
          <Card>
            <CardHeader>
              <CardTitle>Logotipo Oficial</CardTitle>
              <CardDescription>
                Este logotipo aparecerá en la cabecera del portal público, en el panel de administración y en las llaves de torneos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="flex-shrink-0">
                  <div className="relative h-32 w-32 bg-muted/30 border-2 border-dashed border-border rounded-full flex flex-col items-center justify-center overflow-hidden">
                    {clubActivo?.logo_url ? (
                      <img 
                        src={clubActivo.logo_url} 
                        alt={`Logo de ${clubActivo.nombre}`} 
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground opacity-50" />
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h4 className="text-sm font-semibold">{clubActivo?.nombre}</h4>
                    <p className="text-xs text-muted-foreground mt-1">Recomendamos imágenes PNG o JPG cuadradas (ej. 512x512) con fondo transparente. Tamaño máximo 2MB.</p>
                  </div>
                  
                  <div className="flex items-center justify-center sm:justify-start gap-3">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isUploading}
                      className="shadow-sm font-semibold"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Subir Nuevo Logotipo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
              <CardDescription>
                Datos básicos del club en la plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="club-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre del Club</label>
                <Input
                  id="club-name"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                  maxLength={100}
                  disabled={!clubActivo || isSavingClubName}
                  aria-label="Nombre del club"
                />
                <label htmlFor="club-slug" className="mt-3 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dirección corta del sitio</label>
                <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="shrink-0 pl-3 text-sm text-muted-foreground">/c/</span>
                  <Input
                    id="club-slug"
                    value={clubSlug}
                    onChange={(event) => setClubSlug(event.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))}
                    maxLength={60}
                    disabled={!clubActivo || isSavingClubName}
                    aria-label="Dirección corta del sitio"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Enlace público: /c/{clubSlug || "nombre-del-club"}. Si cambiás esta dirección, los enlaces anteriores dejarán de funcionar.</p>
                <Button
                  type="button"
                  onClick={handleSaveClubName}
                  disabled={!clubActivo || isSavingClubName || !clubName.trim() || !clubSlug || (clubName.trim() === clubActivo?.nombre && clubSlug === clubActivo?.slug)}
                >
                  {isSavingClubName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSavingClubName ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipo" className="space-y-6">
          <StaffManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

