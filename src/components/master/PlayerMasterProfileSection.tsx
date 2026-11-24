import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Sparkles, Trophy, Users } from "lucide-react";
import { MASTER_DIAS, MASTER_RONDA_LABELS } from "@/lib/master2026";
import {
  fetchPlayerMasterParticipation,
  type PlayerMasterCategoryParticipation,
} from "@/lib/masterService";

type Props = {
  clubId?: string | null;
  jugadorId?: string | null;
};

export function PlayerMasterProfileSection({ clubId, jugadorId }: Props) {
  const [items, setItems] = useState<PlayerMasterCategoryParticipation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!clubId || !jugadorId) {
      setItems([]);
      return;
    }
    setLoading(true);
    fetchPlayerMasterParticipation(clubId, jugadorId)
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((err) => {
        console.error("Error cargando participación Master 2026:", err);
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, jugadorId]);

  if (loading || items.length === 0) return null;

  const badgeCategories = items.filter((i) => i.publicar_clasificados && i.clasificado);
  const detailCategories = items.filter((i) => i.publicar_parejas || i.publicar_llaves);

  if (badgeCategories.length === 0 && detailCategories.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5">
      {/* Badges de Clasificado */}
      {badgeCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badgeCategories.map((c) => (
            <Badge
              key={c.categoria_id}
              className="bg-amber-500 text-slate-950 hover:bg-amber-500 font-bold text-xs gap-1"
            >
              <Trophy className="h-3 w-3" />
              Clasificado Master 2026 · {c.categoria_label}
              {c.posicion_final ? ` (#${c.posicion_final})` : ""}
            </Badge>
          ))}
        </div>
      )}

      {/* Bloque Master Diciembre 2026 */}
      {detailCategories.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Master Diciembre 2026
          </div>

          {detailCategories.map((cat) => (
            <div key={cat.categoria_id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-foreground">{cat.categoria_label}</span>
                {cat.publicar_parejas && cat.team && (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    Seed #{cat.team.seed} · {cat.team.puntos_combinados} pts
                  </Badge>
                )}
              </div>

              {cat.publicar_parejas && cat.team && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    Pareja: <strong className="text-foreground">{cat.team.companeroNombre}</strong>
                  </span>
                </div>
              )}

              {cat.publicar_llaves && cat.matches.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {cat.matches.map((m) => {
                    const diaObj = MASTER_DIAS.find((d) => d.key === m.dia);
                    return (
                      <div
                        key={m.id}
                        className="rounded-md border bg-muted/30 px-2.5 py-2 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-primary">
                            {MASTER_RONDA_LABELS[m.ronda]}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {diaObj && (
                              <span className="inline-flex items-center gap-0.5">
                                <Calendar className="h-3 w-3" /> {diaObj.shortLabel}
                              </span>
                            )}
                            {m.hora && (
                              <span className="inline-flex items-center gap-0.5">
                                <Clock className="h-3 w-3" /> {m.hora}
                              </span>
                            )}
                            {m.cancha && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" /> Cancha {m.cancha}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            vs <strong>{m.rivalNombre}</strong>
                          </span>
                          {m.marcador ? (
                            <Badge
                              variant={m.gano === true ? "default" : "secondary"}
                              className={
                                m.gano === true
                                  ? "bg-emerald-600 text-white text-[10px]"
                                  : "text-[10px]"
                              }
                            >
                              {m.gano === true ? "Ganó " : m.gano === false ? "Cayó " : ""}
                              {m.marcador}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Programado
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
