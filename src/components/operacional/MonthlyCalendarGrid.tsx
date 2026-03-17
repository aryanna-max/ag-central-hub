import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Schedule {
  id: string;
  start_date: string;
  end_date: string;
  teams: { id: string; name: string } | null;
  obras: { id: string; name: string; client: string | null } | null;
}

interface Props {
  month: number;
  year: number;
  schedules: Schedule[];
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const TEAM_COLORS = [
  "bg-primary/15 text-primary border-primary/30",
  "bg-secondary/15 text-secondary border-secondary/30",
  "bg-accent/15 text-accent-foreground border-accent/30",
  "bg-destructive/15 text-destructive border-destructive/30",
  "bg-muted text-muted-foreground border-muted-foreground/30",
];

export default function MonthlyCalendarGrid({ month, year, schedules }: Props) {
  const { days, startPad } = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayWeekday = new Date(year, month - 1, 1).getDay();
    return {
      days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      startPad: firstDayWeekday,
    };
  }, [month, year]);

  const teamColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueTeams = [...new Set(schedules.map((s) => s.teams?.id).filter(Boolean))];
    uniqueTeams.forEach((id, i) => {
      map.set(id!, TEAM_COLORS[i % TEAM_COLORS.length]);
    });
    return map;
  }, [schedules]);

  function getSchedulesForDay(day: number) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return schedules.filter((s) => s.start_date <= dateStr && s.end_date >= dateStr);
  }

  const isWeekend = (day: number) => {
    const d = new Date(year, month - 1, day).getDay();
    return d === 0 || d === 6;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 bg-muted/50">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-center text-xs font-semibold text-muted-foreground py-2 border-b border-border">
              {wd}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Padding cells */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[80px] border-b border-r border-border bg-muted/20" />
          ))}

          {days.map((day) => {
            const daySchedules = getSchedulesForDay(day);
            const weekend = isWeekend(day);
            const today = new Date();
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() + 1 === month &&
              today.getDate() === day;

            return (
              <div
                key={day}
                className={`min-h-[80px] border-b border-r border-border p-1 transition-colors ${
                  weekend ? "bg-muted/30" : "bg-background"
                } ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                <span
                  className={`text-xs font-medium inline-block mb-0.5 ${
                    isToday
                      ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center"
                      : "text-muted-foreground"
                  }`}
                >
                  {day}
                </span>
                <div className="space-y-0.5">
                  {daySchedules.slice(0, 3).map((s) => (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate cursor-default ${
                            teamColorMap.get(s.teams?.id || "") || TEAM_COLORS[0]
                          }`}
                        >
                          {s.teams?.name || "—"}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-semibold">{s.teams?.name}</p>
                        <p className="text-muted-foreground">
                          {s.obras?.name} {s.obras?.client ? `(${s.obras.client})` : ""}
                        </p>
                        <p className="text-muted-foreground">
                          {s.start_date} → {s.end_date}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {daySchedules.length > 3 && (
                    <span className="text-[10px] text-muted-foreground pl-1">
                      +{daySchedules.length - 3} mais
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {schedules.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3">
          {[...new Map(schedules.map((s) => [s.teams?.id, s])).values()].map((s) => (
            <div key={s.teams?.id} className="flex items-center gap-1.5 text-xs">
              <div
                className={`w-3 h-3 rounded border ${teamColorMap.get(s.teams?.id || "") || TEAM_COLORS[0]}`}
              />
              <span className="text-muted-foreground">
                {s.teams?.name} → {s.obras?.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </TooltipProvider>
  );
}
