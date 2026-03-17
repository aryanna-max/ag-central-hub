import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Plus, CheckCircle, XCircle, Clock, Lock } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  useDailySchedule,
  useCreateDailySchedule,
  useAddDailyEntry,
  useUpdateAttendance,
  useCloseDailySchedule,
  useRemoveDailyEntry,
} from "@/hooks/useDailySchedule";
import { useEmployeesWithAbsences } from "@/hooks/useEmployees";
import { useTeams } from "@/hooks/useTeams";
import { useVehicles } from "@/hooks/useVehicles";
import EmployeeAvailabilityBadge from "@/components/operacional/EmployeeAvailabilityBadge";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

const attendanceConfig: Record<AttendanceStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  presente: { label: "Presente", icon: CheckCircle, color: "text-green-600" },
  falta: { label: "Falta", icon: XCircle, color: "text-red-600" },
  justificado: { label: "Justificado", icon: Clock, color: "text-amber-600" },
  atrasado: { label: "Atrasado", icon: Clock, color: "text-orange-500" },
};

export default function EscalaDiaria() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(tomorrow);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({ employee_id: "", team_id: "", obra_id: "", vehicle_id: "" });

  const { data: schedule, isLoading } = useDailySchedule(selectedDate);
  const { data: employees } = useEmployeesWithAbsences(selectedDate);
  const { data: teams } = useTeams();
  const { data: vehicles } = useVehicles();
  const createSchedule = useCreateDailySchedule();
  const addEntry = useAddDailyEntry();
  const updateAttendance = useUpdateAttendance();
  const closeSchedule = useCloseDailySchedule();
  const removeEntry = useRemoveDailyEntry();

  const { data: obrasData } = useObrasList();

  const isClosed = schedule?.is_closed;
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  const handleCreateSchedule = async () => {
    try {
      await createSchedule.mutateAsync(selectedDate);
      toast.success("Escala criada!");
    } catch {
      toast.error("Erro ao criar escala");
    }
  };

  const handleAddEntry = async () => {
    if (!entryForm.employee_id || !schedule) return;
    try {
      await addEntry.mutateAsync({
        daily_schedule_id: schedule.id,
        employee_id: entryForm.employee_id,
        team_id: entryForm.team_id || undefined,
        obra_id: entryForm.obra_id || undefined,
        vehicle_id: entryForm.vehicle_id || undefined,
      });
      setShowAddEntry(false);
      setEntryForm({ employee_id: "", team_id: "", obra_id: "", vehicle_id: "" });
      toast.success("Funcionário adicionado à escala!");
    } catch {
      toast.error("Erro ao adicionar (funcionário já escalado?)");
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
      toast.success("Escala fechada! Relatórios de faltas e diárias gerados.");
    } catch {
      toast.error("Erro ao fechar escala");
    }
  };

  // Available employees (not already in this schedule)
  const scheduledIds = schedule?.entries?.map((e: any) => e.employee_id) || [];
  const availableEmployees = (employees || []).filter((e) => !scheduledIds.includes(e.id));

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
              Planejamento diário das equipes de campo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
          {selectedDate === tomorrow && (
            <Badge className="bg-secondary text-secondary-foreground">Amanhã</Badge>
          )}
          {isToday && <Badge className="bg-accent text-accent-foreground">Hoje</Badge>}
        </div>
      </div>

      {/* Schedule content */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !schedule ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhuma escala criada para {format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
            </p>
            <Button onClick={handleCreateSchedule} className="gap-2">
              <Plus className="w-4 h-4" /> Criar Escala para este dia
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="outline" className="text-sm py-1 px-3">
              {schedule.entries?.length || 0} funcionários escalados
            </Badge>
            {isClosed && (
              <Badge className="bg-red-600 text-white gap-1">
                <Lock className="w-3 h-3" /> Escala Fechada
              </Badge>
            )}
            {!isClosed && (
              <div className="flex gap-2 ml-auto">
                <Button onClick={() => setShowAddEntry(true)} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" /> Adicionar Funcionário
                </Button>
                {isToday && schedule.entries?.length > 0 && (
                  <Button onClick={handleClose} variant="destructive" className="gap-2">
                    <Lock className="w-4 h-4" /> Fechar Escala do Dia
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Entries */}
          {!schedule.entries?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum funcionário escalado ainda.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {schedule.entries.map((entry: any) => {
                const att = attendanceConfig[entry.attendance as AttendanceStatus] || attendanceConfig.presente;
                const AttIcon = att.icon;
                return (
                  <Card key={entry.id}>
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">{entry.employees?.name}</p>
                            <p className="text-xs text-muted-foreground">{entry.employees?.role}</p>
                          </div>
                          {entry.teams && (
                            <Badge variant="outline">{entry.teams.name}</Badge>
                          )}
                          {entry.obras && (
                            <Badge variant="secondary">{entry.obras.name}</Badge>
                          )}
                          {entry.vehicles && (
                            <Badge variant="outline" className="gap-1">
                              🚗 {entry.vehicles.plate}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Attendance status */}
                          <div className={`flex items-center gap-1 text-sm ${att.color}`}>
                            <AttIcon className="w-4 h-4" />
                            <span>{att.label}</span>
                          </div>

                          {/* Actions (only when not closed and today) */}
                          {!isClosed && isToday && (
                            <Select
                              value={entry.attendance || "presente"}
                              onValueChange={(v) => handleAttendance(entry.id, v as AttendanceStatus)}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="presente">✅ Presente</SelectItem>
                                <SelectItem value="falta">❌ Falta</SelectItem>
                                <SelectItem value="justificado">⚠️ Justificado</SelectItem>
                                <SelectItem value="atrasado">🕐 Atrasado</SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          {!isClosed && isFuture && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => removeEntry.mutate(entry.id)}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                      </div>
                      {entry.check_in_time && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Check-in: {format(new Date(entry.check_in_time), "HH:mm")}
                          {entry.check_out_time && ` | Check-out: ${format(new Date(entry.check_out_time), "HH:mm")}`}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add Entry Dialog */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar à Escala</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Funcionário *</label>
              <div className="max-h-48 overflow-y-auto border rounded-md">
                {availableEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setEntryForm({ ...entryForm, employee_id: emp.id })}
                    className={`flex items-center justify-between w-full p-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-0 ${
                      entryForm.employee_id === emp.id ? "bg-primary/10" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.role}</p>
                    </div>
                    <EmployeeAvailabilityBadge availability={emp.availability} />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Equipe</label>
                <Select value={entryForm.team_id} onValueChange={(v) => setEntryForm({ ...entryForm, team_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {(teams || []).map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Veículo</label>
                <Select value={entryForm.vehicle_id} onValueChange={(v) => setEntryForm({ ...entryForm, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {(vehicles || []).filter((v) => v.status === "disponivel").map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.plate} - {v.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Obra</label>
              <Select value={entryForm.obra_id} onValueChange={(v) => setEntryForm({ ...entryForm, obra_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar obra..." /></SelectTrigger>
                <SelectContent>
                  {(obrasData || []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAddEntry(false)}>Cancelar</Button>
            <Button onClick={handleAddEntry} disabled={!entryForm.employee_id}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small hook for obras
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
