import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Plus, Lock, Printer, Trash2, UserPlus, Pencil } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { useVehicles } from "@/hooks/useVehicles";
import { useEmployeesWithAbsences } from "@/hooks/useEmployees";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import DailyScheduleReport from "@/components/operacional/DailyScheduleReport";
import AbsencesSection from "@/components/operacional/AbsencesSection";
import TeamLocationMap from "@/components/operacional/TeamLocationMap";
import MonthlyDayEditDialog from "@/components/operacional/MonthlyDayEditDialog";
import { useUpdateMonthlySchedule } from "@/hooks/useMonthlySchedules";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

function useObrasList() {
  return useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export default function EscalaDiaria() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(tomorrow);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [assignForm, setAssignForm] = useState({ team_id: "", obra_id: "", vehicle_id: "" });

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<any>(null);

  const qc = useQueryClient();
  const { data: schedule, isLoading } = useDailySchedule(selectedDate);
  const { data: teams } = useTeams();
  const { data: vehicles } = useVehicles();
  const { data: employees } = useEmployeesWithAbsences(selectedDate);
  const { data: obrasData } = useObrasList();
  const createSchedule = useCreateDailySchedule();
  const addAssignment = useAddTeamAssignment();
  const removeAssignment = useRemoveTeamAssignment();
  const updateAssignment = useUpdateTeamAssignment();
  const updateAttendance = useUpdateAttendance();
  const closeSchedule = useCloseDailySchedule();
  const preFill = usePreFillFromMonthly();
  const updateMonthly = useUpdateMonthlySchedule();

  const isClosed = schedule?.is_closed;
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  const handleCreateSchedule = async () => {
    try {
      const created = await createSchedule.mutateAsync(selectedDate);
      await preFill.mutateAsync({ scheduleId: created.id, date: selectedDate });
      toast.success("Escala criada e pré-preenchida a partir da escala mensal!");
    } catch {
      toast.error("Erro ao criar escala");
    }
  };

  const handleAddAssignment = async () => {
    if (!assignForm.team_id || !schedule) return;
    try {
      await addAssignment.mutateAsync({
        daily_schedule_id: schedule.id,
        team_id: assignForm.team_id,
        obra_id: assignForm.obra_id || undefined,
        vehicle_id: assignForm.vehicle_id || undefined,
        date: selectedDate,
      });
      setShowAddTeam(false);
      setAssignForm({ team_id: "", obra_id: "", vehicle_id: "" });
      toast.success("Equipe adicionada à escala!");
    } catch {
      toast.error("Erro ao adicionar equipe");
    }
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
      toast.success("Escala fechada! Relatórios gerados.");
    } catch {
      toast.error("Erro ao fechar escala");
    }
  };

  // Open edit dialog for a team assignment
  const handleEditAssignment = (assignment: any) => {
    // Build a schedule-like object compatible with MonthlyDayEditDialog
    const d = new Date(selectedDate + "T12:00:00");
    setEditAssignment({
      id: assignment.id,
      team_id: assignment.team_id,
      obra_id: assignment.obra_id || "",
      vehicle_id: assignment.vehicle_id || null,
      start_date: selectedDate,
      end_date: selectedDate,
      teams: assignment.teams,
      obras: assignment.obras,
      vehicles: assignment.vehicles,
    });
    setEditOpen(true);
  };

  const handleEditSave = async (
    scheduleId: string,
    updates: { team_id?: string; obra_id?: string; vehicle_id?: string },
    scope: "period" | "day",
    dayDate?: string,
    memberOverrides?: { additions: string[]; removals: string[] }
  ) => {
    if (updates.vehicle_id === "none") updates.vehicle_id = undefined;

    try {
      // Update the daily team assignment
      const dailyUpdates: { obra_id?: string; vehicle_id?: string; notes?: string } = {};
      if (updates.obra_id) dailyUpdates.obra_id = updates.obra_id;
      if (updates.vehicle_id !== undefined) dailyUpdates.vehicle_id = updates.vehicle_id;

      if (Object.keys(dailyUpdates).length > 0) {
        await updateAssignment.mutateAsync({
          id: scheduleId,
          updates: dailyUpdates,
          date: selectedDate,
          teamId: editAssignment?.team_id,
        });
      }

      // Handle member overrides for daily entries
      if (memberOverrides && schedule) {
        const teamId = updates.team_id || editAssignment?.team_id;
        const obraId = updates.obra_id || editAssignment?.obra_id;
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
          await supabase
            .from("daily_schedule_entries")
            .insert({
              daily_schedule_id: schedule.id,
              employee_id: empId,
              team_id: teamId,
              obra_id: obraId,
              vehicle_id: vehicleId,
            });
        }
      }

      // If scope is "period", also sync to monthly
      if (scope === "period" && editAssignment) {
        const { data: monthlySchedules } = await supabase
          .from("monthly_schedules")
          .select("id")
          .eq("team_id", editAssignment.team_id)
          .lte("start_date", selectedDate)
          .gte("end_date", selectedDate);

        if (monthlySchedules?.length) {
          const monthlyUpdates: Record<string, string> = {};
          if (updates.obra_id) monthlyUpdates.obra_id = updates.obra_id;
          if (updates.vehicle_id) monthlyUpdates.vehicle_id = updates.vehicle_id;
          if (Object.keys(monthlyUpdates).length > 0) {
            await supabase
              .from("monthly_schedules")
              .update(monthlyUpdates)
              .eq("id", monthlySchedules[0].id);
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
      setEditOpen(false);
      toast.success(scope === "period" ? "Atualizado e sincronizado com escala mensal!" : "Dia atualizado!");
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

  const handlePrint = () => {
    const printContent = document.getElementById("daily-report");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Escala Diária - ${format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
            th { background: #f0f0f0; font-weight: bold; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .text-xs { font-size: 11px; }
            .text-sm { font-size: 13px; }
            .uppercase { text-transform: uppercase; }
            .mt-4 { margin-top: 16px; }
            .mb-4 { margin-bottom: 16px; }
            .bg-primary { background: #006B54; color: white; padding: 6px 12px; border-radius: 4px 4px 0 0; }
            .bg-amber-100 { background: #fef3c7; }
            .bg-yellow-200 { background: #fef08a; }
            .bg-muted { background: #f5f5f5; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const assignments = schedule?.assignments || [];

  const absentEmployees = (employees || []).filter(
    (e) => e.availability === "ferias" || e.availability === "licenca" || e.availability === "afastado"
  );

  const assignedTeamIds = assignments.map((a: any) => a.team_id);
  const availableTeams = (teams || []).filter((t: any) => !assignedTeamIds.includes(t.id));

  const dateFormatted = format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR });
  const d = new Date(selectedDate + "T12:00:00");

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
            <p className="text-sm text-muted-foreground">Acompanhamento diário das equipes de campo</p>
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
              <Plus className="w-4 h-4" /> Criar Escala
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-sm py-1 px-3">
              {assignments.length} equipes escaladas
            </Badge>
            {isClosed && (
              <Badge className="bg-destructive text-destructive-foreground gap-1">
                <Lock className="w-3 h-3" /> Escala Fechada
              </Badge>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" className="gap-2" onClick={() => setShowReport(true)}>
                <Printer className="w-4 h-4" /> Relatório
              </Button>
              {!isClosed && (
                <>
                  <Button onClick={() => setShowAddTeam(true)} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" /> Adicionar Equipe
                  </Button>
                  {isToday && assignments.length > 0 && (
                    <Button onClick={handleClose} variant="destructive" className="gap-2">
                      <Lock className="w-4 h-4" /> Fechar Escala
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Team-centric table */}
          {assignments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma equipe escalada. Adicione equipes ou crie a escala mensal primeiro.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between rounded-t-lg">
                  <span className="font-bold text-sm">ACOMPANHAMENTO DIÁRIO DAS EQUIPES</span>
                  <span className="text-sm font-medium">DATA: {format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy")}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>TOPÓGRAFO</TableHead>
                      <TableHead>AUXILIARES</TableHead>
                      <TableHead>LOCAL</TableHead>
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

                      const teamEntries = (schedule.entries || []).filter(
                        (e: any) => e.team_id === a.team_id
                      );

                      return (
                        <TableRow key={a.id} className="border-b">
                          <TableCell className="font-bold text-center">{idx + 1}</TableCell>
                          <TableCell>
                            <span className="font-bold text-sm uppercase">
                              {topografo?.employees?.name || "—"}
                            </span>
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
                              <p className="text-sm font-medium">{a.obras?.client || "—"}</p>
                              <p className="text-xs text-muted-foreground">{a.obras?.location || a.obras?.name || ""}</p>
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary"
                                  title="Editar alocação"
                                  onClick={() => handleEditAssignment(a)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {!isClosed && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive h-7 w-7"
                                  onClick={() => removeAssignment.mutate(a.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
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
          {assignments.length > 0 && (
            <TeamLocationMap assignments={assignments} date={selectedDate} />
          )}

          {/* Available employees */}
          {(() => {
            const assignedIds = new Set(
              (schedule.entries || []).map((e: any) => e.employee_id)
            );
            const availableEmployees = (employees || []).filter(
              (e) =>
                e.availability === "disponivel" &&
                !assignedIds.has(e.id) &&
                (e.role?.toLowerCase().includes("topógrafo") ||
                 e.role?.toLowerCase().includes("topografo") ||
                 e.role?.toLowerCase().includes("auxiliar") ||
                 e.role?.toLowerCase().includes("ajudante"))
            );
            const availTopografos = availableEmployees.filter((e) =>
              e.role?.toLowerCase().includes("topógrafo") || e.role?.toLowerCase().includes("topografo")
            );
            const availAuxiliares = availableEmployees.filter(
              (e) =>
                e.role?.toLowerCase().includes("auxiliar") || e.role?.toLowerCase().includes("ajudante")
            );

            if (!availableEmployees.length) return null;

            return (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    Funcionários Disponíveis (Sem Alocação)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availTopografos.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">TOPÓGRAFOS</p>
                        <div className="flex flex-wrap gap-1">
                          {availTopografos.map((e) => (
                            <Badge key={e.id} variant="outline" className="text-xs bg-primary/5">
                              {e.name.split(" ").slice(0, 2).join(" ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {availAuxiliares.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">AUXILIARES</p>
                        <div className="flex flex-wrap gap-1">
                          {availAuxiliares.map((e) => (
                            <Badge key={e.id} variant="outline" className="text-xs bg-secondary/30">
                              {e.name.split(" ").slice(0, 2).join(" ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Absences section */}
          <AbsencesSection employees={absentEmployees} />
        </>
      )}

      {/* Add Team Assignment Dialog */}
      <Dialog open={showAddTeam} onOpenChange={setShowAddTeam}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Equipe à Escala</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Equipe</label>
              <Select value={assignForm.team_id} onValueChange={(v) => {
                const team = availableTeams.find((t: any) => t.id === v);
                const defaultVehicle = team?.default_vehicle_id || "";
                setAssignForm({ ...assignForm, team_id: v, vehicle_id: defaultVehicle });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar equipe..." /></SelectTrigger>
                <SelectContent>
                  {availableTeams.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Obra/Projeto</label>
              <Select value={assignForm.obra_id} onValueChange={(v) => setAssignForm({ ...assignForm, obra_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar obra..." /></SelectTrigger>
                <SelectContent>
                  {(obrasData || []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name} {o.client ? `(${o.client})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Veículo</label>
              <Select value={assignForm.vehicle_id} onValueChange={(v) => setAssignForm({ ...assignForm, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
                <SelectContent>
                  {(vehicles || []).filter((v) => v.status === "disponivel").map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.model} — {v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTeam(false)}>Cancelar</Button>
            <Button onClick={handleAddAssignment} disabled={!assignForm.team_id}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Report Dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Relatório de Escala Diária</span>
              <Button onClick={handlePrint} className="gap-2" size="sm">
                <Printer className="w-4 h-4" /> Imprimir
              </Button>
            </DialogTitle>
          </DialogHeader>
          <DailyScheduleReport
            date={selectedDate}
            assignments={assignments}
            absentEmployees={absentEmployees}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog (same as monthly) */}
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
    </div>
  );
}
