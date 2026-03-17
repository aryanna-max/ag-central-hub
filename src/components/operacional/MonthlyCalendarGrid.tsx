import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Filter, Car, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeamMember {
  id: string;
  role: string;
  employees: { id: string; name: string } | null;
}

interface Schedule {
  id: string;
  start_date: string;
  end_date: string;
  team_id: string;
  obra_id: string;
  teams: { id: string; name: string; team_members?: TeamMember[] } | null;
  obras: { id: string; name: string; client: string | null } | null;
  vehicles?: { id: string; model: string; plate: string } | null;
}

interface Props {
  month: number;
  year: number;
  schedules: Schedule[];
  onDayClick?: (day: number, schedule: Schedule) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const TEAM_COLORS = [
  "bg-primary/15 text-primary border-primary/30",
  "bg-secondary/15 text-secondary-foreground border-secondary/30",
  "bg-accent/15 text-accent-foreground border-accent/30",
  "bg-destructive/15 text-destructive border-destructive/30",
  "bg-muted text-muted-foreground border-muted-foreground/30",
  "bg-primary/10 text-primary border-primary/20",
  "bg-secondary/10 text-secondary-foreground border-secondary/20",
];

type FilterType = "all" | "equipe" | "topografo" | "auxiliar" | "obra" | "veiculo";

export default function MonthlyCalendarGrid({ month, year, schedules, onDayClick }: Props) {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterValue, setFilterValue] = useState("");
  const [searchText, setSearchText] = useState("");
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

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

  // Build filter options
  const filterOptions = useMemo(() => {
    const teams = new Map<string, string>();
    const topografos = new Map<string, string>();
    const auxiliares = new Map<string, string>();
    const obras = new Map<string, string>();

    schedules.forEach((s) => {
      if (s.teams) {
        teams.set(s.teams.id, s.teams.name);
        (s.teams.team_members || []).forEach((m) => {
          if (m.role === "topografo" && m.employees) {
            topografos.set(m.employees.id, m.employees.name);
          } else if (m.employees) {
            auxiliares.set(m.employees.id, m.employees.name);
          }
        });
      }
      if (s.obras) obras.set(s.obras.id, s.obras.name);
    });

    return { teams, topografos, auxiliares, obras };
  }, [schedules]);

  // Filter schedules
  const filteredSchedules = useMemo(() => {
    let result = schedules;
    const q = searchText.toLowerCase();

    if (q) {
      result = result.filter((s) => {
        const teamName = s.teams?.name?.toLowerCase() || "";
        const obraName = s.obras?.name?.toLowerCase() || "";
        const client = s.obras?.client?.toLowerCase() || "";
        const members = (s.teams?.team_members || []).map((m) => m.employees?.name?.toLowerCase() || "").join(" ");
        return teamName.includes(q) || obraName.includes(q) || client.includes(q) || members.includes(q);
      });
    }

    if (filterType !== "all" && filterValue) {
      result = result.filter((s) => {
        switch (filterType) {
          case "equipe":
            return s.teams?.id === filterValue;
          case "topografo":
            return (s.teams?.team_members || []).some(
              (m) => m.role === "topografo" && m.employees?.id === filterValue
            );
          case "auxiliar":
            return (s.teams?.team_members || []).some(
              (m) => m.role !== "topografo" && m.employees?.id === filterValue
            );
          case "obra":
            return s.obras?.id === filterValue;
          default:
            return true;
        }
      });
    }

    return result;
  }, [schedules, filterType, filterValue, searchText]);

  function getSchedulesForDay(day: number) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filteredSchedules.filter((s) => s.start_date <= dateStr && s.end_date >= dateStr);
  }

  const isWeekend = (day: number) => {
    const d = new Date(year, month - 1, day).getDay();
    return d === 0 || d === 6;
  };

  const getTopografo = (s: Schedule) =>
    (s.teams?.team_members || []).find((m) => m.role === "topografo");

  const getAuxiliares = (s: Schedule) =>
    (s.teams?.team_members || []).filter((m) => m.role !== "topografo");

  const getOptionsForFilter = () => {
    switch (filterType) {
      case "equipe":
        return [...filterOptions.teams.entries()].map(([id, name]) => ({ id, name }));
      case "topografo":
        return [...filterOptions.topografos.entries()].map(([id, name]) => ({ id, name }));
      case "auxiliar":
        return [...filterOptions.auxiliares.entries()].map(([id, name]) => ({ id, name }));
      case "obra":
        return [...filterOptions.obras.entries()].map(([id, name]) => ({ id, name }));
      default:
        return [];
    }
  };

  const expandedSchedules = expandedDay ? getSchedulesForDay(expandedDay) : [];

  return (
    <TooltipProvider delayDuration={200}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select
            value={filterType}
            onValueChange={(v) => {
              setFilterType(v as FilterType);
              setFilterValue("");
            }}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="equipe">Equipe</SelectItem>
              <SelectItem value="topografo">Topógrafo</SelectItem>
              <SelectItem value="auxiliar">Auxiliar</SelectItem>
              <SelectItem value="obra">Obra/Projeto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filterType !== "all" && (
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {getOptionsForFilter().map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-8 text-xs pl-7 w-48"
          />
        </div>
      </div>

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
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[100px] border-b border-r border-border bg-muted/20" />
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
                className={`min-h-[100px] border-b border-r border-border p-1 transition-colors ${
                  weekend ? "bg-muted/30" : "bg-background"
                } ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-xs font-medium inline-block ${
                      isToday
                        ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </span>
                  {daySchedules.length > 0 && (
                    <button
                      onClick={() => setExpandedDay(day)}
                      className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                      title="Expandir dia"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {daySchedules.slice(0, 3).map((s) => {
                    const topo = getTopografo(s);
                    const auxs = getAuxiliares(s);
                    return (
                      <Tooltip key={s.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`text-[10px] leading-tight px-1 py-0.5 rounded border cursor-pointer hover:opacity-80 transition-opacity ${
                              teamColorMap.get(s.teams?.id || "") || TEAM_COLORS[0]
                            }`}
                            onClick={() => onDayClick?.(day, s)}
                          >
                            <p className="font-bold uppercase truncate">
                              {s.obras?.name || "—"}
                            </p>
                            <p className="truncate">
                              <span className="font-semibold">{topo?.employees?.name?.split(" ")[0] || "—"}</span>
                              {auxs.length > 0 && (
                                <span className="text-muted-foreground">
                                  {" "}+ {auxs.length} aux
                                </span>
                              )}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[220px]">
                          <p className="font-bold uppercase">{s.obras?.name}</p>
                          {s.obras?.client && (
                            <p className="text-muted-foreground">Cliente: {s.obras.client}</p>
                          )}
                          <p className="mt-1">
                            <span className="font-semibold">Topógrafo:</span>{" "}
                            {topo?.employees?.name || "—"}
                          </p>
                          {auxs.length > 0 && (
                            <div>
                              <span className="font-semibold">Auxiliares:</span>{" "}
                              {auxs.map((a) => a.employees?.name).join(", ")}
                            </div>
                          )}
                          {(s as any).vehicles && (
                            <p className="mt-1 flex items-center gap-1">
                              <Car className="w-3 h-3" />
                              {(s as any).vehicles.model} — {(s as any).vehicles.plate}
                            </p>
                          )}
                          <p className="text-primary mt-1 font-medium">Clique para editar</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {daySchedules.length > 3 && (
                    <button
                      onClick={() => setExpandedDay(day)}
                      className="text-[10px] text-primary font-medium pl-1 hover:underline"
                    >
                      +{daySchedules.length - 3} mais →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Day Dialog */}
      <Dialog open={expandedDay !== null} onOpenChange={(open) => !open && setExpandedDay(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              Dia {expandedDay && String(expandedDay).padStart(2, "0")}/{String(month).padStart(2, "0")}/{year} — {expandedSchedules.length} alocações
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {expandedSchedules.map((s, idx) => {
              const topo = getTopografo(s);
              const auxs = getAuxiliares(s);
              return (
                <div
                  key={s.id}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                    teamColorMap.get(s.teams?.id || "") || TEAM_COLORS[0]
                  }`}
                  onClick={() => {
                    setExpandedDay(null);
                    if (expandedDay) onDayClick?.(expandedDay, s);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs font-mono">
                          #{idx + 1}
                        </Badge>
                        <span className="font-bold uppercase text-sm truncate">
                          {s.obras?.name || "—"}
                        </span>
                      </div>
                      {s.obras?.client && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Cliente: {s.obras.client}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">TOPÓGRAFO</p>
                          <p className="font-bold">{topo?.employees?.name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">EQUIPE</p>
                          <p>{s.teams?.name || "—"}</p>
                        </div>
                      </div>
                      {auxs.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-muted-foreground">AUXILIARES</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {auxs.map((a) => (
                              <Badge key={a.id} variant="secondary" className="text-xs">
                                {a.employees?.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {(s as any).vehicles && (
                        <div className="flex items-center gap-1 text-xs">
                          <Car className="w-3 h-3" />
                          <div>
                            <p className="font-medium">{(s as any).vehicles.model}</p>
                            <p className="text-muted-foreground">{(s as any).vehicles.plate}</p>
                          </div>
                        </div>
                      )}
                      <Button variant="ghost" size="sm" className="mt-2 gap-1 text-xs text-primary">
                        Editar <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {expandedSchedules.length === 0 && (
              <p className="text-center text-muted-foreground py-6">
                Nenhuma alocação para este dia.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      {filteredSchedules.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3">
          {[...new Map(filteredSchedules.map((s) => [s.teams?.id, s])).values()].map((s) => {
            const topo = getTopografo(s);
            const auxs = getAuxiliares(s);
            return (
              <div key={s.teams?.id} className="flex items-center gap-1.5 text-xs">
                <div
                  className={`w-3 h-3 rounded border ${teamColorMap.get(s.teams?.id || "") || TEAM_COLORS[0]}`}
                />
                <span>
                  <span className="font-bold">{topo?.employees?.name || "—"}</span>
                  {auxs.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}({auxs.map((a) => a.employees?.name?.split(" ")[0]).join(", ")})
                    </span>
                  )}
                  <span className="text-muted-foreground"> → {s.obras?.name}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </TooltipProvider>
  );
}
