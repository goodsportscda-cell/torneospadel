import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeWhatsApp } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ClubContactSettings({ clubId }: { clubId?: string | null }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["club-contact-settings", clubId], enabled: !!clubId,
    queryFn: async () => {
      const result = await supabase.from("clubes").select("contacto_whatsapp, contacto_email").eq("id", clubId!).single();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  useEffect(() => { setPhone(data?.contacto_whatsapp ?? ""); setEmail(data?.contacto_email ?? ""); }, [data, clubId]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!clubId || !data || saving) return;
    const normalized = normalizeWhatsApp(phone);
    if (phone.trim() && !normalized) return void toast.error("Ingresá el número completo con código de país y área, sin 00 ni el 15 local.");
    setSaving(true);
    try {
      const result = await supabase.from("clubes").update({ contacto_whatsapp: normalized, contacto_email: email.trim() || null }).eq("id", clubId).select("id").single();
      if (result.error) throw result.error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["club-contact", clubId] }),
        queryClient.invalidateQueries({ queryKey: ["club-contact-settings", clubId] }),
      ]);
      toast.success("Contacto público del club actualizado.");
    } catch { toast.error("No se pudo guardar el contacto. Revisá tus permisos y probá de nuevo."); }
    finally { setSaving(false); }
  }
  return <Card>
    <CardHeader><CardTitle>Contacto para jugadores</CardTitle><CardDescription>Estos datos serán públicos en el portal y los torneos del club. Usá contactos que tengas autorización para publicar.</CardDescription></CardHeader>
    <CardContent><form onSubmit={save} className="space-y-4">
      {isError && <p role="alert" className="text-sm text-destructive">No pudimos cargar el contacto actual. Recargá la página para reintentar.</p>}
      <div className="space-y-2"><Label htmlFor="club-whatsapp">WhatsApp del club (opcional)</Label><Input id="club-whatsapp" type="tel" placeholder="+54 9 11 1234 5678" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} disabled={isLoading || saving || isError} /><p className="text-xs text-muted-foreground">Incluí código de país y área. En Argentina: +54 9, área y número, sin 0 ni 15.</p></div>
      <div className="space-y-2"><Label htmlFor="club-email">Email del club (opcional)</Label><Input id="club-email" type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading || saving || isError} /></div>
      <p className="text-xs text-muted-foreground">Dejá un campo vacío para ocultar ese canal de contacto.</p>
      <Button disabled={!clubId || !data || isLoading || saving || isError} type="submit">{saving ? "Guardando…" : "Guardar contacto"}</Button>
    </form></CardContent>
  </Card>;
}
