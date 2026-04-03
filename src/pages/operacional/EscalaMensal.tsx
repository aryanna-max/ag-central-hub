import { useState } from "react";
import { CalendarDays, Plus, Trash2, ChevronLeft, ChevronRight, Car, Printer, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTeams } from "@/hooks/useTeams";
import { useActiveVehicles } from "@/hooks/useVehicles";
import {
  useMonthlySchedules,
  useCreateMonthlySchedule,
  useDeleteMonthlySchedule,
  useUpdateMonthlySchedule,
} from "@/hooks/useMonthlySchedules";
import MonthlyCalendarGrid from "@/components/operacional/MonthlyCalendarGrid";
import MonthlyDayEditDialog from "@/components/operacional/MonthlyDayEditDialog";
import MonthlyScheduleReport from "@/components/operacional/MonthlyScheduleReport";
import PlanningReportsTab from "@/components/operacional/PlanningReportsTab";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function EscalaMensal() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [planTab, setPlanTab] = useState<"mensal" | "relatorios">("mensal");
  const [showNew, setShowNew] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [form, setForm] = useState({
    team_id: "",
    project_id: "",
    vehicle_id: "",
    schedule_type: "mensal" as "mensal" | "diaria",
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<any>(null);
  const [editDay, setEditDay] = useState(1);

  const { data: teams } = useTeams();
  const { data: vehicles } = useActiveVehicles();
  const [showAllProjects, setShowAllProjects] = useState(false);
  const { data: obras } = useQuery({
    queryKey: ["projects-operational", showAllProjects],
    queryFn: async () => {
      let query = supabase.from("projects").select("*").eq("is_active", true).eq("show_in_operational", true);
      if (!showAllProjects) { query = query.in("execution_status", ["aguardando_campo", "em_campo"] as any); }
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: schedules, isLoading } = useMonthlySchedules(month, year);
  const createSchedule = useCreateMonthlySchedule();
  const deleteSchedule = useDeleteMonthlySchedule();
  const updateSchedule = useUpdateMonthlySchedule();

  const handleCreate = () => {
    if (!form.team_id || !form.project_id || !form.start_date || !form.end_date) return;
    createSchedule.mutate(
      {
        team_id: form.team_id,
        project_id: form.project_id,
        vehicle_id: form.vehicle_id && form.vehicle_id !== "none" ? form.vehicle_id : undefined,
        schedule_type: form.schedule_type,
        start_date: format(form.start_date, "yyyy-MM-dd"),
        end_date: format(form.end_date, "yyyy-MM-dd"),
        month,
        year,
      },
      {
        onSuccess: () => {
          setShowNew(false);
          setForm({ team_id: "", project_id: "", vehicle_id: "", schedule_type: "mensal", start_date: undefined, end_date: undefined });
          toast.success("Alocação criada!");
        },
        onError: () => toast.error("Erro ao criar alocação."),
      }
    );
  };

  const handleDayClick = (day: number, schedule: any) => {
    setEditDay(day);
    setEditSchedule(schedule);
    setEditOpen(true);
  };

  const handleEditSave = async (
    scheduleId: string,
    updates: { team_id?: string; project_id?: string; vehicle_id?: string },
    scope: "period" | "day",
    dayDate?: string,
    memberOverrides?: { additions: string[]; removals: string[] }
  ) => {
    // Handle "none" vehicle
    if (updates.vehicle_id === "none") updates.vehicle_id = undefined;

    if (scope === "day" && dayDate) {
      try {
        const { data: existing } = await supabase
          .from("daily_schedules")
          .select("id")
          .eq("schedule_date", dayDate)
          .maybeSingle();

        let dailyId = existing?.id;
        if (!dailyId) {
          const { data: created, error } = await supabase
            .from("daily_schedules")
            .insert({ schedule_date: dayDate })
            .select()
            .single();
          if (error) throw error;
          dailyId = created.id;
        }

        const schedule = editSchedule;
        const teamIdToUse = updates.team_id || schedule.team_id;
        const projectIdToUse = updates.project_id || schedule.project_id;
        const vehicleIdToUse = updates.vehicle_id || schedule.vehicle_id;

        const { data: existingAssignment } = await supabase
          .from("daily_team_assignments")
          .select("id")
          .eq("daily_schedule_id", dailyId)
          .eq("team_id", schedule.team_id)
          .maybeSingle();

        if (existingAssignment) {
          await supabase
            .from("daily_team_assignments")
            .update({
              team_id: teamIdToUse,
              project_id: projectIdToUse,
              vehicle_id: vehicleIdToUse,
            })
            .eq("id", existingAssignment.id);
        } else {
          await supabase
            .from("daily_team_assignments")
            .insert({
              daily_schedule_id: dailyId,
              team_id: teamIdToUse,
              project_id: projectIdToUse,
              vehicle_id: vehicleIdToUse,
            });
        }

        if (memberOverrides) {
          for (const empId of memberOverrides.removals) {
            await supabase
              .from("daily_schedule_entries")
              .delete()
              .eq("daily_schedule_id", dailyId)
              .eq("employee_id", empId)
              .eq("team_id", schedule.team_id);
          }
          for (const empId of memberOverrides.additions) {
            await supabase
              .from("daily_schedule_entries")
              .insert({
                daily_schedule_id: dailyId,
                employee_id: empId,
                team_id: teamIdToUse,
                project_id: projectIdToUse,
                vehicle_id: vehicleIdToUse,
              });
          }
        }

        setEditOpen(false);
        toast.success("Dia atualizado com sucesso!");
      } catch {
        toast.error("Erro ao atualizar dia.");
      }
    } else {
      // Period scope - update monthly schedule and sync to daily
      updateSchedule.mutate(
        { id: scheduleId, updates, syncToDaily: true },
        {
          onSuccess: () => {
            setEditOpen(false);
            toast.success("Alocação atualizada e sincronizada!");
          },
          onError: () => toast.error("Erro ao atualizar."),
        }
      );
    }
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const getTopografo = (s: any) =>
    (s.teams?.team_members || []).find((m: any) => m.role === "topografo");
  const getAuxiliares = (s: any) =>
    (s.teams?.team_members || []).filter((m: any) => m.role !== "topografo");

  const scheduleTypeLabel = (t: string) => t === "mensal" ? "Mensal (seg-sex)" : "Diária (todos)";

  return (
    <div className="p-6 space-y-6">
      {/* Tabs */}
      <Tabs value={planTab} onValueChange={(v) => setPlanTab(v as any)}>
        <TabsList>
          <TabsTrigger value="mensal">Planejamento Mensal</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relatorios">
          <PlanningReportsTab />
        </TabsContent>

        <TabsContent value="mensal">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Visão Mensal</h1>
            <p className="text-sm text-muted-foreground">Previsão de alocação — pré-preenche a escala diária automaticamente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">
            {months[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setShowReport(true)} className="gap-2 ml-2">
            <Printer className="w-4 h-4" /> Relatório Mensal
          </Button>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Alocação
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Visão Mensal — {months[month - 1]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Carregando...</p>
          ) : (
            <MonthlyCalendarGrid
              month={month}
              year={year}
              schedules={(schedules || []) as any}
              onDayClick={handleDayClick}
            />
          )}
        </CardContent>
      </Card>

      {/* Allocations Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Alocações do Período</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!schedules?.length ? (
            <p className="p-6 text-center text-muted-foreground">
              Nenhuma alocação para {months[month - 1]} {year}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Topógrafo</TableHead>
                  <TableHead>Auxiliares</TableHead>
                  <TableHead>Obra/Projeto</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s: any) => {
                  const topo = getTopografo(s);
                  const auxs = getAuxiliares(s);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Badge variant="outline">{s.teams?.name}</Badge>
                      </TableCell>
                      <TableCell className="font-bold text-sm">
                        {topo?.employees?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {auxs.length > 0
                          ? auxs.map((a: any) => a.employees?.name).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{s.obras?.name}</TableCell>
                      <TableCell className="text-sm">
                        {s.vehicles ? (
                          <span className="flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {s.vehicles.model} — {s.vehicles.plate}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {scheduleTypeLabel(s.schedule_type || "mensal")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.start_date && s.end_date
                          ? `${format(new Date(s.start_date + "T12:00:00"), "dd/MM")} — ${format(new Date(s.end_date + "T12:00:00"), "dd/MM/yyyy")}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteSchedule.mutate(s.id, { onSuccess: () => toast.success("Removido!") })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Allocation Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Alocação — {months[month - 1]} {year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Equipe</label>
              <Select value={form.team_id} onValueChange={(v) => {
                const team = (teams || []).find((t: any) => t.id === v);
                const defaultVehicle = team?.default_vehicle_id || "";
                setForm({ ...form, team_id: v, vehicle_id: defaultVehicle });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar equipe..." /></SelectTrigger>
                <SelectContent>
                  {(teams || []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Projeto</label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar projeto..." /></SelectTrigger>
                <SelectContent>
                  {(obras || []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name} {o.client ? `(${o.client})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={showAllProjects}
                  onCheckedChange={(checked) => setShowAllProjects(!!checked)}
                  className="h-3.5 w-3.5"
                />
                Mostrar todos os projetos ativos
              </label>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block flex items-center gap-1">
                <Car className="w-4 h-4" /> Veículo
              </label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem veículo</SelectItem>
                  {(vehicles || []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.model} — {v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo de Escala</label>
              <Select value={form.schedule_type} onValueChange={(v) => setForm({ ...form, schedule_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal (exclui sáb/dom)</SelectItem>
                  <SelectItem value="diaria">Diária (todos os dias)</SelectItem>
                </SelectContent>
              </Select>
              {form.schedule_type === "mensal" && (
                <p className="text-xs text-muted-foreground mt-1">Sábados e domingos podem ser editados individualmente depois.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Data Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, "dd/MM/yyyy") : "Selecionar..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.start_date}
                      onSelect={(d) => setForm({ ...form, start_date: d || undefined })}
                      defaultMonth={new Date(year, month - 1)}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Data Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {form.end_date ? format(form.end_date, "dd/MM/yyyy") : "Selecionar..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.end_date}
                      onSelect={(d) => setForm({ ...form, end_date: d || undefined })}
                      defaultMonth={new Date(year, month - 1)}
                      disabled={(d) => form.start_date ? d < form.start_date : false}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.team_id || !form.project_id || !form.start_date || !form.end_date || createSchedule.isPending}
            >
              Alocar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Edit Dialog */}
      <MonthlyDayEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        schedule={editSchedule}
        day={editDay}
        month={month}
        year={year}
        onSave={handleEditSave}
        onDelete={(id) => {
          deleteSchedule.mutate(id, {
            onSuccess: () => {
              setEditOpen(false);
              toast.success("Alocação excluída!");
            },
          });
        }}
        isPending={updateSchedule.isPending}
      />

      {/* Monthly Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Relatório Mensal</DialogTitle></DialogHeader>
          <MonthlyScheduleReport
            month={month}
            year={year}
            schedules={(schedules || []) as any}
          />
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
