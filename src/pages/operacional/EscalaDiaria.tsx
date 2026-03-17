import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Plus, Lock, Printer, Trash2, UserPlus } from "lucide-react";
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
} from "@/hooks/useDailySchedule";
import { useTeams } from "@/hooks/useTeams";
import { useVehicles } from "@/hooks/useVehicles";
import { useEmployeesWithAbsences } from "@/hooks/useEmployees";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import DailyScheduleReport from "@/components/operacional/DailyScheduleReport";
import AbsencesSection from "@/components/operacional/AbsencesSection";
import TeamLocationMap from "@/components/operacional/TeamLocationMap";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export default function EscalaDiaria() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(tomorrow);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [assignForm, setAssignForm] = useState({ team_id: "", obra_id: "", vehicle_id: "" });

  const { data: schedule, isLoading } = useDailySchedule(selectedDate);
  const { data: teams } = useTeams();
  const { data: vehicles } = useVehicles();
  const { data: employees } = useEmployeesWithAbsences(selectedDate);
  const { data: obrasData } = useObrasList();
  const createSchedule = useCreateDailySchedule();
  const addAssignment = useAddTeamAssignment();
  const removeAssignment = useRemoveTeamAssignment();
  const updateAttendance = useUpdateAttendance();
  const closeSchedule = useCloseDailySchedule();
  const preFill = usePreFillFromMonthly();

  const isClosed = schedule?.is_closed;
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  const handleCreateSchedule = async () => {
    try {
      const created = await createSchedule.mutateAsync(selectedDate);
      // Auto pre-fill from monthly
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

  // Build team-centric view from assignments
  const assignments = schedule?.assignments || [];

  // Absences for the footer section
  const absentEmployees = (employees || []).filter(
    (e) => e.availability === "ferias" || e.availability === "licenca" || e.availability === "afastado"
  );

  // Teams not yet assigned
  const assignedTeamIds = assignments.map((a: any) => a.team_id);
  const availableTeams = (teams || []).filter((t: any) => !assignedTeamIds.includes(t.id));

  const dateFormatted = format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR });

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

          {/* Team-centric table (matches reference image) */}
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
                      {!isClosed && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a: any, idx: number) => {
                      const teamMembers = a.teams?.team_members || [];
                      const topografo = teamMembers.find((m: any) => m.role === "topografo");
                      const auxiliares = teamMembers.filter((m: any) => m.role !== "topografo");

                      // Find attendance entries for this team
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
                          {!isClosed && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive h-7 w-7"
                                onClick={() => removeAssignment.mutate(a.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          )}
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
          <DialogHeader><DialogTitle>Relatório de Escala Diária</DialogTitle></DialogHeader>
          <DailyScheduleReport
            date={selectedDate}
            assignments={assignments}
            absentEmployees={absentEmployees}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
