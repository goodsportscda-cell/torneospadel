import { Trophy, Calendar, Clock, MapPin, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MASTER_CANCHAS, MASTER_DIAS, MASTER_RONDA_LABELS } from "@/lib/master2026";
import { formatTeamDisplayName, type MasterMatchDB, type MasterTeamDB } from "@/lib/masterService";

type SchedulePatch = { dia?: string | null; hora?: string | null; cancha?: number | null };

type Props = {
  matches: MasterMatchDB[];
  teams: MasterTeamDB[];
  tvMode?: boolean;
  editable?: boolean;
  onSelectMatch?: (match: MasterMatchDB) => void;
  onScheduleChange?: (match: MasterMatchDB, patch: SchedulePatch) => void;
  conflictMatchIds?: Set<string>;
};

function MatchScorePills({ match, side }: { match: MasterMatchDB; side: "local" | "visitante" }) {
  const sets = [
    side === "local" ? match.set1_local : match.set1_visitante,
    side === "local" ? match.set2_local : match.set2_visitante,
    side === "local" ? match.set3_local : match.set3_visitante,
  ];
  const oppSets = [
    side === "local" ? match.set1_visitante : match.set1_local,
    side === "local" ? match.set2_visitante : match.set2_local,
    side === "local" ? match.set3_visitante : match.set3_local,
  ];

  return (
    <div className="flex items-center gap-1 shrink-0">
      {sets.map((val, idx) => {
        const opp = oppSets[idx];
        if (val === null || val === undefined) return null;
        const wonSet = opp !== null && opp !== undefined && val > opp;
        return (
          <span
            key={idx}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold tabular-nums",
              wonSet
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                : "bg-muted/70 text-muted-foreground"
            )}
          >
            {val}
          </span>
        );
      })}
    </div>
  );
}

function BracketMatchCard({
  match,
  teamMap,
  tvMode,
  editable,
  onSelect,
  onScheduleChange,
  hasConflict,
  title,
}: {
  match: MasterMatchDB | undefined;
  teamMap: Map<string, MasterTeamDB>;
  tvMode?: boolean;
  editable?: boolean;
  onSelect?: (m: MasterMatchDB) => void;
  onScheduleChange?: (m: MasterMatchDB, patch: SchedulePatch) => void;
  hasConflict?: boolean;
  title: string;
}) {
  if (!match) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed p-3 text-xs text-muted-foreground",
          tvMode && "border-white/15 bg-white/[0.02] text-white/40"
        )}
      >
        <div className="font-semibold mb-1">{title}</div>
        <div>Sin generar</div>
      </div>
    );
  }

  const localTeam = match.team_local_id ? teamMap.get(match.team_local_id) : undefined;
  const visitTeam = match.team_visitante_id ? teamMap.get(match.team_visitante_id) : undefined;
  const localWon = Boolean(match.ganador_team_id && match.ganador_team_id === match.team_local_id);
  const visitWon = Boolean(match.ganador_team_id && match.ganador_team_id === match.team_visitante_id);
  const diaObj = MASTER_DIAS.find((d) => d.key === match.dia);

  const canClick = editable && onSelect;

  return (
    <div
      role={canClick ? "button" : undefined}
      tabIndex={canClick ? 0 : undefined}
      onClick={() => canClick && onSelect(match)}
      onKeyDown={(e) => {
        if (canClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(match);
        }
      }}
      className={cn(
        "rounded-xl border p-3 transition-all",
        tvMode
          ? "border-white/15 bg-white/[0.04] text-white"
          : "bg-card text-card-foreground shadow-sm",
        canClick && "cursor-pointer hover:border-primary/60 hover:shadow-md",
        match.ronda === "final" && (tvMode ? "border-amber-400/50 bg-amber-500/[0.06]" : "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20"),
        hasConflict && !tvMode && "border-amber-500/80 bg-amber-50/30 dark:bg-amber-950/20"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[11px] font-bold uppercase tracking-wider", tvMode ? "text-white/60" : "text-muted-foreground")}>
            {title}
          </span>
          {hasConflict && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> Superposición
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {match.cancha && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", tvMode && "border-white/20 text-white/80")}>
              <MapPin className="h-2.5 w-2.5 mr-0.5" /> Cancha {match.cancha}
            </Badge>
          )}
          {diaObj && match.hora && (
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", tvMode && "bg-white/10 text-white/80")}>
              <Clock className="h-2.5 w-2.5 mr-0.5" /> {diaObj.shortLabel} {match.hora}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {/* Local */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm",
            localWon
              ? "bg-emerald-500/15 font-bold ring-1 ring-emerald-500/40"
              : tvMode
                ? "bg-white/[0.04]"
                : "bg-muted/40"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {localTeam ? (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                {localTeam.seed}
              </span>
            ) : (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                -
              </span>
            )}
            <span className={cn("truncate", !localTeam && "italic opacity-60", tvMode && "text-base")}>
              {localTeam ? formatTeamDisplayName(localTeam) : match.ref_local || "Por definir"}
            </span>
            {localWon && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
          </div>
          <MatchScorePills match={match} side="local" />
        </div>

        {/* Visitante */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm",
            visitWon
              ? "bg-emerald-500/15 font-bold ring-1 ring-emerald-500/40"
              : tvMode
                ? "bg-white/[0.04]"
                : "bg-muted/40"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {visitTeam ? (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                {visitTeam.seed}
              </span>
            ) : (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                -
              </span>
            )}
            <span className={cn("truncate", !visitTeam && "italic opacity-60", tvMode && "text-base")}>
              {visitTeam ? formatTeamDisplayName(visitTeam) : match.ref_visitante || "Por definir"}
            </span>
            {visitWon && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
          </div>
          <MatchScorePills match={match} side="visitante" />
        </div>
      </div>

      {editable && onScheduleChange ? (
        <div
          className="mt-2.5 pt-2 border-t grid grid-cols-3 gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Select
            value={match.dia ?? "__none__"}
            onValueChange={(val) =>
              onScheduleChange(match, { dia: val === "__none__" ? null : val })
            }
          >
            <SelectTrigger className="h-7 text-[11px] px-2">
              <SelectValue placeholder="Día" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin día</SelectItem>
              {MASTER_DIAS.map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {d.shortLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="time"
            className="h-7 text-[11px] px-1.5"
            value={match.hora ?? ""}
            onChange={(e) =>
              onScheduleChange(match, { hora: e.target.value || null })
            }
          />

          <Select
            value={match.cancha ? String(match.cancha) : "__none__"}
            onValueChange={(val) =>
              onScheduleChange(match, {
                cancha: val === "__none__" ? null : parseInt(val, 10),
              })
            }
          >
            <SelectTrigger className="h-7 text-[11px] px-2">
              <SelectValue placeholder="Cancha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin asignar</SelectItem>
              {MASTER_CANCHAS.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  Cancha {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        !match.hora &&
        diaObj && (
          <div className={cn("mt-2 flex items-center gap-1 text-[11px]", tvMode ? "text-white/50" : "text-muted-foreground")}>
            <Calendar className="h-3 w-3" /> {diaObj.shortLabel} · Horario a confirmar
          </div>
        )
      )}
    </div>
  );
}

export function MasterBracketView({
  matches,
  teams,
  tvMode = false,
  editable = false,
  onSelectMatch,
  onScheduleChange,
  conflictMatchIds,
}: Props) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const byNum = new Map(matches.map((m) => [m.numero_partido, m]));

  if (matches.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed p-8 text-center text-sm",
          tvMode ? "border-white/15 text-white/60" : "text-muted-foreground"
        )}
      >
        Las llaves eliminatorias de esta categoría todavía no fueron generadas.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
      {/* Cuartos de Final */}
      <div className="space-y-3">
        <div className={cn("text-xs font-black uppercase tracking-wider px-1", tvMode ? "text-primary" : "text-muted-foreground")}>
          {MASTER_RONDA_LABELS.cuartos}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((num) => (
            <BracketMatchCard
              key={num}
              match={byNum.get(num)}
              teamMap={teamMap}
              tvMode={tvMode}
              editable={editable}
              onSelect={onSelectMatch}
              onScheduleChange={onScheduleChange}
              hasConflict={Boolean(byNum.get(num)?.id && conflictMatchIds?.has(byNum.get(num)!.id))}
              title={`Cuartos ${num} (QF${num})`}
            />
          ))}
        </div>
      </div>

      {/* Semifinales */}
      <div className="space-y-3">
        <div className={cn("text-xs font-black uppercase tracking-wider px-1", tvMode ? "text-primary" : "text-muted-foreground")}>
          {MASTER_RONDA_LABELS.semifinal}
        </div>
        <div className="space-y-6 lg:py-8">
          {[5, 6].map((num, idx) => (
            <BracketMatchCard
              key={num}
              match={byNum.get(num)}
              teamMap={teamMap}
              tvMode={tvMode}
              editable={editable}
              onSelect={onSelectMatch}
              onScheduleChange={onScheduleChange}
              hasConflict={Boolean(byNum.get(num)?.id && conflictMatchIds?.has(byNum.get(num)!.id))}
              title={`Semifinal ${idx + 1} (SF${idx + 1})`}
            />
          ))}
        </div>
      </div>

      {/* Final */}
      <div className="space-y-3">
        <div className={cn("text-xs font-black uppercase tracking-wider px-1 flex items-center gap-1.5", tvMode ? "text-amber-400" : "text-amber-600 dark:text-amber-400")}>
          <Trophy className="h-3.5 w-3.5" /> {MASTER_RONDA_LABELS.final}
        </div>
        <BracketMatchCard
          match={byNum.get(7)}
          teamMap={teamMap}
          tvMode={tvMode}
          editable={editable}
          onSelect={onSelectMatch}
          onScheduleChange={onScheduleChange}
          hasConflict={Boolean(byNum.get(7)?.id && conflictMatchIds?.has(byNum.get(7)!.id))}
          title="Final · Domingo 6/12"
        />
      </div>
    </div>
  );
}
