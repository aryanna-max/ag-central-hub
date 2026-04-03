import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Plus, Lock, Printer, Trash2, Pencil, CheckCircle, AlertTriangle, X, Users, Save } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  useDailySchedule,
  useCreateDailySchedule,
  useAddTeamAssignment,
  useRemoveTeamAssignment,
  useUpdateAttendance,
  useCloseDailySchedule,
  usePreFillFromMonthly,
  useUpdateTeamAssignment,
} from "@/hooks/useDailySchedule";
import { useTeams } from "@/hooks/useTeams";
import { useActiveVehicles } from "@/hooks/useVehicles";
import { useEmployees, useEmployeesWithAbsences } from "@/hooks/useEmployees";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { isFieldRole, isTopografo } from "@/lib/fieldRoles";
import AbsencesSection from "@/components/operacional/AbsencesSection";
import TeamLocationMap from "@/components/operacional/TeamLocationMap";
import MonthlyDayEditDialog from "@/components/operacional/MonthlyDayEditDialog";
import EmployeeAvailabilityKanban from "@/components/operacional/EmployeeAvailabilityKanban";
import DailyReportDialog from "@/components/operacional/DailyReportDialog";
import { useUpdateMonthlySchedule } from "@/hooks/useMonthlySchedules";
import { useScheduleConfirmation, useConfirmSchedule } from "@/hooks/useScheduleConfirmations";
import { useAuth } from "@/contexts/AuthContext";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

function useProjectsList(showAll = false) {
  return useQuery({
    queryKey: ["projects-operational", showAll],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_operational", true);
      if (!showAll) {
        query = query.in("execution_status", ["aguardando_campo", "em_campo"] as any);
      }
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
  });
}

export default function EscalaDiaria() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(tomorrow);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<any>(null);

  // Add modal state
  const [addForm, setAddForm] = useState({
    project_id: "",
    employee_ids: [] as string[],
    vehicle_id: "",
    benefits: { cafe: false, almoco: false, janta: false, vt: false },
  });
  const [empSearch, setEmpSearch] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showSaveGroup, setShowSaveGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  const qc = useQueryClient();
  const { data: schedule, isLoading } = useDailySchedule(selectedDate);
  const { data: teams } = useTeams();
  const { data: vehicles } = useActiveVehicles();
  const { data: employees } = useEmployeesWithAbsences(selectedDate);
  const { data: allEmployees } = useEmployees();

  const { data: attendanceRecords } = useQuery({
    queryKey: ["attendance", selectedDate],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("attendance")
        .select("*")
        .eq("date", selectedDate);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: obrasData } = useProjectsList(showAllProjects);
  const createSchedule = useCreateDailySchedule();
  const addAssignment = useAddTeamAssignment();
  const removeAssignment = useRemoveTeamAssignment();
  const updateAssignment = useUpdateTeamAssignment();
  const updateAttendance = useUpdateAttendance();
  const closeSchedule = useCloseDailySchedule();
  const preFill = usePreFillFromMonthly();
  const updateMonthly = useUpdateMonthlySchedule();
  const { data: confirmation } = useScheduleConfirmation(selectedDate);
  const confirmSchedule = useConfirmSchedule();
  const { user, role } = useAuth();

  const isClosed = schedule?.is_closed;
  const isToday = selectedDate === today;
  const isPast = selectedDate < today;
  const isReadOnly = isClosed;

  // Active employees for the add modal
  const activeEmployees = useMemo(() => {
    return (allEmployees || []).filter(
      (e) => e.status !== "desligado" && isFieldRole(e.role)
    );
  }, [allEmployees]);

  const filteredModalEmployees = useMemo(() => {
    if (!empSearch) return activeEmployees;
    const q = empSearch.toLowerCase();
    return activeEmployees.filter(
      (e) => e.name.toLowerCase().includes(q) || (e.matricula || "").toLowerCase().includes(q)
    );
  }, [activeEmployees, empSearch]);

  const handleConfirmSchedule = async () => {
    if (!user?.id) return;
    try {
      await confirmSchedule.mutateAsync({ date: selectedDate, userId: user.id });
      toast.success("Escala confirmada!");
    } catch {
      toast.error("Erro ao confirmar escala");
    }
  };

  const handleCreateSchedule = async () => {
    try {
      const created = await createSchedule.mutateAsync(selectedDate);
      await preFill.mutateAsync({ scheduleId: created.id, date: selectedDate });
      toast.success(selectedDate === tomorrow
        ? "Escala de amanhã montada! Ajuste e envie ao grupo."
        : "Escala criada e pré-preenchida a partir da escala mensal!");
    } catch {
      toast.error("Erro ao criar escala");
    }
  };

  // Vacation check helper
  const checkVacation = async (empId: string): Promise<{ onVacation: boolean; start?: string; end?: string; name?: string }> => {
    const emp = activeEmployees.find((e) => e.id === empId);
    const { data } = await supabase
      .from("employee_vacations")
      .select("start_date, end_date")
      .eq("employee_id", empId)
      .lte("start_date", selectedDate)
      .gte("end_date", selectedDate);
    if (data && data.length > 0) {
      return { onVacation: true, start: data[0].start_date, end: data[0].end_date, name: emp?.name };
    }
    return { onVacation: false };
  };

  // Duplicate allocation check
  const checkDuplicate = async (empId: string): Promise<{ duplicate: boolean; projectCode?: string }> => {
    const { data: schedules } = await supabase
      .from("daily_schedules")
      .select("id")
      .eq("schedule_date", selectedDate);
    if (!schedules?.length) return { duplicate: false };
    const { data: entries } = await supabase
      .from("daily_schedule_entries")
      .select("project_id, projects:project_id(codigo)")
      .eq("employee_id", empId)
      .in("daily_schedule_id", schedules.map((s) => s.id));
    if (entries && entries.length > 0) {
      return { duplicate: true, projectCode: (entries[0] as any).projects?.codigo || "outro projeto" };
    }
    return { duplicate: false };
  };

  const [vacationDialog, setVacationDialog] = useState<{ show: boolean; empIds: { id: string; name: string; start: string; end: string }[]; pending: string[] }>({ show: false, empIds: [], pending: [] });
  const [duplicateDialog, setDuplicateDialog] = useState<{ show: boolean; empId: string; name: string; projectCode: string } | null>(null);

  const handleAddEmployees = async () => {
    if (!addForm.project_id || addForm.employee_ids.length === 0 || !schedule) {
      toast.error("Selecione projeto e pelo menos um funcionário");
      return;
    }

    // Check vacations and duplicates
    const vacationWarnings: { id: string; name: string; start: string; end: string }[] = [];
    const duplicateWarnings: { id: string; name: string; projectCode: string }[] = [];

    for (const empId of addForm.employee_ids) {
      const vac = await checkVacation(empId);
      if (vac.onVacation) {
        vacationWarnings.push({ id: empId, name: vac.name || empId, start: vac.start!, end: vac.end! });
      }
      const dup = await checkDuplicate(empId);
      if (dup.duplicate) {
        const emp = activeEmployees.find((e) => e.id === empId);
        duplicateWarnings.push({ id: empId, name: emp?.name || empId, projectCode: dup.projectCode! });
      }
    }

    if (vacationWarnings.length > 0) {
      setVacationDialog({ show: true, empIds: vacationWarnings, pending: addForm.employee_ids });
      return;
    }

    if (duplicateWarnings.length > 0) {
      setDuplicateDialog({ show: true, empId: duplicateWarnings[0].id, name: duplicateWarnings[0].name, projectCode: duplicateWarnings[0].projectCode });
      return;
    }

    await doAddEmployees(addForm.employee_ids, []);
  };

  const doAddEmployees = async (empIds: string[], vacationOverrideIds: string[]) => {
    if (!schedule) return;
    if (!addForm.project_id) {
      toast.error("Selecione um projeto antes de salvar");
      return;
    }
    try {
      const { data: assignment, error: assErr } = await supabase
        .from("daily_team_assignments")
        .insert({
          daily_schedule_id: schedule.id,
          team_id: (teams || [])[0]?.id || null,
          project_id: addForm.project_id,
          vehicle_id: addForm.vehicle_id || null,
        })
        .select()
        .single();

      if (assErr) {
        for (let i = 0; i < empIds.length; i++) {
          const empId = empIds[i];
          await supabase.from("daily_schedule_entries").insert({
            daily_schedule_id: schedule.id,
            employee_id: empId,
            project_id: addForm.project_id,
            vehicle_id: i === 0 && addForm.vehicle_id ? addForm.vehicle_id : null,
            is_vacation_override: vacationOverrideIds.includes(empId),
          });
        }
      } else {
        for (let i = 0; i < empIds.length; i++) {
          const empId = empIds[i];
          await supabase.from("daily_schedule_entries").insert({
            daily_schedule_id: schedule.id,
            employee_id: empId,
            project_id: addForm.project_id,
            vehicle_id: i === 0 && addForm.vehicle_id ? addForm.vehicle_id : null,
            team_id: assignment.team_id,
            daily_team_assignment_id: assignment.id,
            is_vacation_override: vacationOverrideIds.includes(empId),
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      setShowAddModal(false);
      setAddForm({ project_id: "", employee_ids: [], vehicle_id: "", benefits: { cafe: false, almoco: false, janta: false, vt: false } });
      setEmpSearch("");
      toast.success(`${empIds.length} funcionário(s) adicionado(s) à escala!`);
    } catch {
      toast.error("Erro ao adicionar funcionários");
    }
  };

  const handleLoadGroup = (teamId: string) => {
    const team = (teams || []).find((t: any) => t.id === teamId);
    if (!team) return;
    const memberIds = ((team as any).team_members || []).map((m: any) => m.employee_id);
    setAddForm((prev) => ({ ...prev, employee_ids: memberIds }));
    // Also pre-fill project and vehicle from team defaults
    if ((team as any).default_project_id) {
      setAddForm((prev) => ({ ...prev, project_id: (team as any).default_project_id }));
    }
    if ((team as any).default_vehicle_id) {
      setAddForm((prev) => ({ ...prev, vehicle_id: (team as any).default_vehicle_id }));
    }
    toast.success(`Grupo "${team.name}" carregado`);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim() || addForm.employee_ids.length === 0) return;
    try {
      const { data: newTeam, error } = await supabase
        .from("teams")
        .insert({ name: groupName.trim() })
        .select()
        .single();
      if (error) throw error;

      for (const empId of addForm.employee_ids) {
        await supabase.from("team_members").insert({
          team_id: newTeam.id,
          employee_id: empId,
          role: isTopografo(activeEmployees.find((e) => e.id === empId)?.role) ? "topografo" : "auxiliar",
        });
      }

      qc.invalidateQueries({ queryKey: ["teams"] });
      setShowSaveGroup(false);
      setGroupName("");
      toast.success(`Grupo "${groupName}" salvo!`);
    } catch {
      toast.error("Erro ao salvar grupo");
    }
  };

  const toggleEmployee = (id: string) => {
    setAddForm((prev) => ({
      ...prev,
      employee_ids: prev.employee_ids.includes(id)
        ? prev.employee_ids.filter((eid) => eid !== id)
        : [...prev.employee_ids, id],
    }));
  };

  const handleAttendance = async (entryId: string, attendance: AttendanceStatus) => {
    try {
      const now = new Date().toISOString();
      await updateAttendance.mutateAsync({
        entryId,
        attendance,
        check_in_time: attendance === "presente" || attendance === "atrasado" ? now : undefined,
      });
      toast.success("Presença atualizada!");
    } catch {
      toast.error("Erro ao atualizar presença");
    }
  };

  const handleClose = async () => {
    if (!schedule || !confirm("Fechar esta escala? Após o fechamento, não poderá mais ser editada.")) return;
    try {
      await closeSchedule.mutateAsync(schedule.id);
      toast.success("Escala fechada!");
    } catch {
      toast.error("Erro ao fechar escala");
    }
  };

  const handleEditAssignment = (assignment: any) => {
    setEditAssignment({
      id: assignment.id,
      team_id: assignment.team_id,
      project_id: assignment.project_id || "",
      vehicle_id: assignment.vehicle_id || null,
      start_date: selectedDate,
      end_date: selectedDate,
      teams: assignment.teams,
      projects: assignment.projects,
      vehicles: assignment.vehicles,
    });
    setEditOpen(true);
  };

  const handleEditSave = async (
    scheduleId: string,
    updates: { team_id?: string; project_id?: string; vehicle_id?: string },
    scope: "period" | "day",
    dayDate?: string,
    memberOverrides?: { additions: string[]; removals: string[] }
  ) => {
    if (updates.vehicle_id === "none") updates.vehicle_id = undefined;
    try {
      const dailyUpdates: { project_id?: string; vehicle_id?: string } = {};
      if (updates.project_id) dailyUpdates.project_id = updates.project_id;
      if (updates.vehicle_id !== undefined) dailyUpdates.vehicle_id = updates.vehicle_id;

      if (Object.keys(dailyUpdates).length > 0) {
        await updateAssignment.mutateAsync({
          id: scheduleId,
          updates: dailyUpdates,
          date: selectedDate,
          teamId: editAssignment?.team_id,
        });
      }

      if (memberOverrides && schedule) {
        const teamId = updates.team_id || editAssignment?.team_id;
        const projectId = updates.project_id || editAssignment?.project_id;
        const vehicleId = updates.vehicle_id || editAssignment?.vehicle_id;

        for (const empId of memberOverrides.removals) {
          await supabase
            .from("daily_schedule_entries")
            .delete()
            .eq("daily_schedule_id", schedule.id)
            .eq("employee_id", empId)
            .eq("team_id", editAssignment?.team_id);
        }
        for (const empId of memberOverrides.additions) {
          await supabase.from("daily_schedule_entries").insert({
            daily_schedule_id: schedule.id,
            employee_id: empId,
            team_id: teamId,
            project_id: projectId,
            vehicle_id: vehicleId,
          });
        }
      }

      if (scope === "period" && editAssignment) {
        const { data: monthlySchedules } = await supabase
          .from("monthly_schedules")
          .select("id")
          .eq("team_id", editAssignment.team_id)
          .lte("start_date", selectedDate)
          .gte("end_date", selectedDate);

        if (monthlySchedules?.length) {
          const monthlyUpdates: Record<string, string> = {};
          if (updates.project_id) monthlyUpdates.project_id = updates.project_id;
          if (updates.vehicle_id) monthlyUpdates.vehicle_id = updates.vehicle_id;
          if (Object.keys(monthlyUpdates).length > 0) {
            await supabase.from("monthly_schedules").update(monthlyUpdates).eq("id", monthlySchedules[0].id);
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
      setEditOpen(false);
      toast.success(scope === "period" ? "Atualizado e sincronizado!" : "Dia atualizado!");
    } catch {
      toast.error("Erro ao atualizar alocação.");
    }
  };

  const handleDeleteAssignment = (id: string) => {
    removeAssignment.mutate(id, {
      onSuccess: () => {
        setEditOpen(false);
        toast.success("Alocação removida!");
      },
    });
  };

  const assignments = schedule?.assignments || [];

  const absentEmployees = (employees || []).filter(
    (e) => e.availability === "ferias" || e.availability === "licenca" || e.availability === "afastado"
  );

  const dateFormatted = format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR });
  const d = new Date(selectedDate + "T12:00:00");

  // Kanban data
  const assignedIds = new Set((schedule?.entries || []).map((e: any) => e.employee_id));
  const attendanceMap: Record<string, string> = {};
  (attendanceRecords || []).forEach((rec: any) => {
    if (["folga", "falta", "atestado", "reserva_ag"].includes(rec.status)) {
      attendanceMap[rec.employee_id] = rec.status;
    }
  });

  const fieldEmployees = (allEmployees || []).filter(
    (e) => e.status !== "desligado" && !assignedIds.has(e.id) && isFieldRole(e.role)
  );

  const absentIds = new Set(absentEmployees.map((e) => e.id));
  const kanbanEmployees = fieldEmployees.filter((e) => !absentIds.has(e.id));

  const rhAbsentFieldEmployees = absentEmployees.filter(
    (e) => isFieldRole(e.role)
  );

  const formatName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[parts.length - 1][0]?.toUpperCase() || ""}.`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Escala Diária</h1>
            <p className="text-sm text-muted-foreground">
              {selectedDate === tomorrow
                ? "Monte a escala de amanhã — será enviada ao grupo"
                : isToday
                  ? "Confirme presenças e ajuste a escala do dia"
                  : "Consulta de escala"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44" />
          {selectedDate === tomorrow && <Badge className="bg-secondary text-secondary-foreground">Amanhã</Badge>}
          {isToday && <Badge className="bg-accent text-accent-foreground">Hoje</Badge>}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !schedule ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Nenhuma escala para {dateFormatted}</p>
            <Button onClick={handleCreateSchedule} className="gap-2">
              <Plus className="w-4 h-4" /> {selectedDate === tomorrow ? "Montar Escala de Amanhã" : "Criar Escala"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedDate === tomorrow ? "Pré-preenche a partir da escala mensal, se houver" : ""}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-sm py-1 px-3">
              {assignments.length} grupos escalados
            </Badge>
            {isClosed && (
              <Badge className="bg-emerald-600 text-white gap-1">
                <Lock className="w-3 h-3" /> Fechada — dado real
              </Badge>
            )}
            {!isClosed && isPast && (
              <Badge variant="destructive" className="gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> Aberta — pendente de fechamento
              </Badge>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" className="gap-2" onClick={() => setShowReport(true)}>
                <Printer className="w-4 h-4" /> Relatório
              </Button>
              {!isReadOnly && (
                <>
                  <Button onClick={() => setShowAddModal(true)} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" /> Adicionar à Escala
                  </Button>
                  {(isToday || isPast) && assignments.length > 0 && (
                    <Button onClick={handleClose} variant="destructive" className="gap-2">
                      <Lock className="w-4 h-4" /> Fechar Escala
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* KANBAN */}
          <EmployeeAvailabilityKanban
            unassignedEmployees={kanbanEmployees}
            attendanceMap={attendanceMap}
            scheduleDate={selectedDate}
            dailyScheduleId={schedule.id}
            rhAbsentEmployees={rhAbsentFieldEmployees}
          />

          {/* Team-centric table */}
          {assignments.length === 0 ? (
            <Card>
             <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum grupo escalado. Use "Adicionar à Escala" para montar as equipes do dia.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between rounded-t-lg">
                  <span className="font-bold text-sm">ACOMPANHAMENTO DIÁRIO DAS EQUIPES</span>
                  <span className="text-sm font-medium">DATA: {format(d, "dd/MM/yyyy")}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>TOPÓGRAFO</TableHead>
                      <TableHead>AUXILIARES</TableHead>
                      <TableHead>PROJETO</TableHead>
                      <TableHead>VEÍCULO</TableHead>
                      {isToday && !isClosed && <TableHead>PRESENÇA</TableHead>}
                      <TableHead className="w-20">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a: any, idx: number) => {
                      const teamMembers = a.teams?.team_members || [];
                      const topografo = teamMembers.find((m: any) => m.role === "topografo");
                      const auxiliares = teamMembers.filter((m: any) => m.role !== "topografo");
                      const teamEntries = (schedule.entries || []).filter((e: any) => e.team_id === a.team_id);

                      return (
                        <TableRow key={a.id} className="border-b">
                          <TableCell className="font-bold text-center">{idx + 1}</TableCell>
                          <TableCell>
                            <span className="font-bold text-sm uppercase">{topografo?.employees?.name || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {auxiliares.length === 0 ? (
                                <span className="text-muted-foreground text-sm">—</span>
                              ) : (
                                auxiliares.map((aux: any) => (
                                  <p key={aux.id} className="text-sm">{aux.employees?.name}</p>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{a.projects?.name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{a.projects?.location || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{a.vehicles?.model || "—"}</p>
                              <p className="text-xs text-muted-foreground">{a.vehicles?.plate || ""}</p>
                            </div>
                          </TableCell>
                          {isToday && !isClosed && (
                            <TableCell>
                              <div className="space-y-1">
                                {teamEntries.map((entry: any) => (
                                  <div key={entry.id} className="flex items-center gap-1">
                                    <span className="text-xs w-20 truncate">{entry.employees?.name?.split(" ")[0]}</span>
                                    <Select
                                      value={entry.attendance || "presente"}
                                      onValueChange={(v) => handleAttendance(entry.id, v as AttendanceStatus)}
                                    >
                                      <SelectTrigger className="h-6 text-xs w-28"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="presente">✅ Presente</SelectItem>
                                        <SelectItem value="falta">❌ Falta</SelectItem>
                                        <SelectItem value="justificado">⚠️ Justificado</SelectItem>
                                        <SelectItem value="atrasado">🕐 Atrasado</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {!isClosed && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Editar" onClick={() => handleEditAssignment(a)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => removeAssignment.mutate(a.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Map */}
          {assignments.length > 0 && <TeamLocationMap assignments={assignments} date={selectedDate} />}

          {/* Absences section (RH) */}
          <AbsencesSection employees={absentEmployees} />
        </>
      )}

      {/* ═══ ADD TO SCHEDULE MODAL ═══ */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar à Escala</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Project (required) */}
            <div>
              <Label className="font-semibold">Projeto *</Label>
              <Select value={addForm.project_id} onValueChange={(v) => setAddForm((prev) => ({ ...prev, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar projeto..." /></SelectTrigger>
                <SelectContent>
                  {(obrasData || []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
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

            {/* Favorite group shortcut */}
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm text-muted-foreground">Grupo Rápido (atalho):</Label>
              <Select onValueChange={handleLoadGroup}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Carregar grupo..." /></SelectTrigger>
                <SelectContent>
                  {(teams || []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      <Users className="w-3 h-3 inline mr-1" />{t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setShowSaveGroup(true)} disabled={addForm.employee_ids.length === 0}>
                <Save className="w-3 h-3 mr-1" /> Salvar seleção como grupo
              </Button>
            </div>

            {showSaveGroup && (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                <Input
                  placeholder="Nome do grupo..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleSaveGroup} disabled={!groupName.trim()}>Salvar</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSaveGroup(false)}><X className="w-4 h-4" /></Button>
              </div>
            )}

            {/* Employee multi-select */}
            <div>
              <Label className="font-semibold">Funcionários *</Label>
              <Input
                placeholder="Buscar por nome ou matrícula..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="mt-1"
              />

              {/* Selected chips */}
              {addForm.employee_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {addForm.employee_ids.map((eid) => {
                    const emp = activeEmployees.find((e) => e.id === eid);
                    if (!emp) return null;
                    const isTop = isTopografo(emp.role);
                    return (
                      <Badge
                        key={eid}
                        className={`gap-1 cursor-pointer ${isTop ? "bg-green-700 text-white hover:bg-green-800" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                        onClick={() => toggleEmployee(eid)}
                      >
                        {formatName(emp.name)}
                        <X className="w-3 h-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Employee list */}
              <div className="border rounded-lg mt-2 max-h-60 overflow-y-auto divide-y">
                {filteredModalEmployees.map((emp) => {
                  const isSelected = addForm.employee_ids.includes(emp.id);
                  const isTop = isTopografo(emp.role);
                  return (
                    <div
                      key={emp.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => toggleEmployee(emp.id)}
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <span className="flex-1 text-sm">{emp.name}</span>
                      <Badge variant="outline" className={`text-xs ${isTop ? "border-green-600 text-green-700" : "border-blue-600 text-blue-700"}`}>
                        {isTop ? "TOP" : "AUX"}
                      </Badge>
                    </div>
                  );
                })}
                {filteredModalEmployees.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground text-center">Nenhum funcionário encontrado</p>
                )}
              </div>
            </div>

            {/* Vehicle */}
            <div>
              <Label>Veículo do dia (opcional)</Label>
              <Select value={addForm.vehicle_id} onValueChange={(v) => setAddForm((prev) => ({ ...prev, vehicle_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
                <SelectContent>
                  {(vehicles || []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.model} — {v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Benefits */}
            <div>
              <Label>Benefícios (aplicados a todos)</Label>
              <div className="flex items-center gap-4 mt-2">
                {(["cafe", "almoco", "janta", "vt"] as const).map((b) => (
                  <label key={b} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={addForm.benefits[b]}
                      onCheckedChange={(checked) =>
                        setAddForm((prev) => ({ ...prev, benefits: { ...prev.benefits, [b]: !!checked } }))
                      }
                    />
                    {b === "cafe" ? "Café" : b === "almoco" ? "Almoço" : b === "janta" ? "Janta" : "VT"}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
            <Button onClick={handleAddEmployees} disabled={!addForm.project_id || addForm.employee_ids.length === 0}>
              Adicionar {addForm.employee_ids.length} funcionário(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <DailyReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        date={selectedDate}
        assignments={assignments}
        entries={schedule?.entries || []}
        absentEmployees={absentEmployees}
        attendanceRecords={attendanceRecords || []}
        kanbanFilled={schedule?.kanban_filled || false}
        allEmployees={allEmployees || []}
      />

      {/* Edit Assignment Dialog */}
      <MonthlyDayEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        schedule={editAssignment}
        day={d.getDate()}
        month={d.getMonth() + 1}
        year={d.getFullYear()}
        onSave={handleEditSave}
        onDelete={handleDeleteAssignment}
        isPending={false}
      />

      {/* Vacation Warning Dialog */}
      <Dialog open={vacationDialog.show} onOpenChange={(o) => !o && setVacationDialog({ show: false, empIds: [], pending: [] })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Funcionário(s) em férias</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {vacationDialog.empIds.map((v) => (
              <p key={v.id} className="text-sm">
                <strong>{v.name}</strong> está de férias de {format(new Date(v.start + "T12:00:00"), "dd/MM")} a {format(new Date(v.end + "T12:00:00"), "dd/MM")}.
              </p>
            ))}
            <p className="text-sm text-muted-foreground mt-2">
              Confirmar como serviço avulso fora do período CLT?<br />
              <strong>Atenção:</strong> sem benefícios calculados para este dia.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVacationDialog({ show: false, empIds: [], pending: [] })}>Cancelar</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
              const vacIds = vacationDialog.empIds.map((v) => v.id);
              doAddEmployees(vacationDialog.pending, vacIds);
              setVacationDialog({ show: false, empIds: [], pending: [] });
            }}>
              Confirmar como avulso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Allocation Dialog */}
      {duplicateDialog && (
        <Dialog open={duplicateDialog.show} onOpenChange={() => setDuplicateDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Dupla alocação</DialogTitle></DialogHeader>
            <p className="text-sm">{duplicateDialog.name} já está em <strong>{duplicateDialog.projectCode}</strong> hoje. Confirmar mesmo assim?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateDialog(null)}>Cancelar</Button>
              <Button onClick={() => {
                setDuplicateDialog(null);
                doAddEmployees(addForm.employee_ids, []);
              }}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
