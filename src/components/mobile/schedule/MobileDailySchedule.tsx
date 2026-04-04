import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Lock, Plus } from "lucide-react";
import AddToScheduleSheet from "./AddToScheduleSheet";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useDailySchedule, useCloseDailySchedule, useCreateDailySchedule, usePreFillFromMonthly, useUpdateAttendance } from "@/hooks/useDailySchedule";
import DaySelector from "./DaySelector";
import ScheduleStats from "./ScheduleStats";
import TeamCard from "./TeamCard";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export default function MobileDailySchedule() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: schedule, isLoading } = useDailySchedule(dateStr);
  const closeSchedule = useCloseDailySchedule();
  const createSchedule = useCreateDailySchedule();
  const preFill = usePreFillFromMonthly();
  const updateAttendance = useUpdateAttendance();

  const isClosed = schedule?.is_closed ?? false;

  // Group entries by assignment/team
  const teamGroups = useMemo(() => {
    if (!schedule) return [];
    const assignments = schedule.assignments || [];
    const entries = schedule.entries || [];

    return assignments.map((a: any) => {
      const teamMembers = entries
        .filter((e: any) => e.daily_team_assignment_id === a.id || e.team_id === a.team_id)
        .map((e: any) => ({
          id: e.id,
          name: e.employees?.name || "—",
          role: e.employees?.role || "auxiliar",
          attendance: e.attendance,
        }));

      // Deduplicate
      const seen = new Set<string>();
      const uniqueMembers = teamMembers.filter((m: any) => {
        if (seen.has(m.name)) return false;
        seen.add(m.name);
        return true;
      });

      return {
        id: a.id,
        teamName: a.teams?.name || "Equipe",
        projectName: a.projects?.name || null,
        vehicleName: a.vehicles?.model ? `${a.vehicles.model} (${a.vehicles.plate || ""})` : null,
        members: uniqueMembers,
      };
    });
  }, [schedule]);

  // Stats
  const stats = useMemo(() => {
    const allMembers = teamGroups.flatMap((t) => t.members);
    const uniqueVehicles = new Set(
      (schedule?.assignments || []).map((a: any) => a.vehicle_id).filter(Boolean)
    );
    const uniqueProjects = new Set(
      (schedule?.assignments || []).map((a: any) => a.project_id).filter(Boolean)
    );
    return {
      teams: teamGroups.length,
      employees: allMembers.length,
      vehicles: uniqueVehicles.size,
      projects: uniqueProjects.size,
    };
  }, [teamGroups, schedule]);

  const handleCreateSchedule = async () => {
    try {
      const created = await createSchedule.mutateAsync(dateStr);
      await preFill.mutateAsync({ scheduleId: created.id, date: dateStr });
      toast.success("Escala criada e pré-preenchida!");
    } catch {
      toast.error("Erro ao criar escala");
    }
  };

  const handleClose = async () => {
    if (!schedule) return;
    try {
      await closeSchedule.mutateAsync(schedule.id);
      toast.success("Escala fechada!");
    } catch {
      toast.error("Erro ao fechar escala");
    }
  };

  const handleAttendance = async (entryId: string, status: string) => {
    try {
      await updateAttendance.mutateAsync({
        entryId,
        attendance: status as AttendanceStatus,
        check_in_time: status === "presente" ? new Date().toISOString() : undefined,
      });
    } catch {
      toast.error("Erro ao atualizar presença");
    }
  };

  return (
    <div className="pb-40">
      {/* Add to Schedule Sheet */}
      {schedule && !isClosed && (
        <AddToScheduleSheet
          open={addSheetOpen}
          onOpenChange={setAddSheetOpen}
          scheduleId={schedule.id}
          dateStr={dateStr}
        />
      )}
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-primary">Escala de Campo</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">
            {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Badge variant={isClosed ? "secondary" : "default"} className={isClosed ? "bg-muted" : "bg-accent text-accent-foreground"}>
          {isClosed ? "Fechada" : "Aberta"}
        </Badge>
      </div>

      {/* Day selector */}
      <DaySelector selectedDate={selectedDate} onSelect={setSelectedDate} />

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      )}

      {/* No schedule */}
      {!isLoading && !schedule && (
        <div className="text-center py-12 px-4">
          <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Nenhuma escala para este dia</p>
          <Button onClick={handleCreateSchedule} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Escala
          </Button>
        </div>
      )}

      {/* Schedule content */}
      {!isLoading && schedule && (
        <>
          {/* Stats */}
          <div className="py-3">
            <ScheduleStats {...stats} />
          </div>

          {/* Team cards */}
          <div className="mt-1">
            {teamGroups.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhuma equipe alocada neste dia
              </p>
            ) : (
              teamGroups.map((team) => (
                <TeamCard
                  key={team.id}
                  teamName={team.teamName}
                  projectName={team.projectName}
                  vehicleName={team.vehicleName}
                  members={team.members}
                  isClosed={isClosed}
                  onAttendanceChange={handleAttendance}
                />
              ))
            )}
          </div>

          {/* Action bar */}
          {!isClosed && (
            <div
              className="fixed bottom-[64px] left-0 right-0 px-4 py-3 z-40 border-t border-border/40"
              style={{
                background: "hsl(var(--background) / 0.95)",
                backdropFilter: "blur(12px)",
              }}
            >
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full gap-2">
                    <Lock className="w-4 h-4" />
                    Fechar Escala
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Fechar escala?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Após o fechamento, a escala não poderá mais ser editada e as diárias de veículos serão geradas automaticamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClose}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </>
      )}
    </div>
  );
}
