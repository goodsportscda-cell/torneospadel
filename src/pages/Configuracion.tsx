import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Configuracion() {
  const { clubActivo, refreshClub } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <p className="text-muted-foreground">Gestiona la información pública y la identidad visual de tu club.</p>
      </div>

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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre del Club</label>
            <Input value={clubActivo?.nombre || ''} readOnly className="bg-muted/30" />
            <p className="text-[10px] text-muted-foreground">Para modificar el nombre, contacta a soporte.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
