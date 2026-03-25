import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { syncDailyToMonthly } from "./useMonthlySchedules";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export function useDailySchedule(date: string) {
  return useQuery({
    queryKey: ["daily-schedule", date],
    queryFn: async () => {
      const { data: schedule, error } = await supabase
        .from("daily_schedules")
        .select("*")
        .eq("schedule_date", date)
        .maybeSingle();
      if (error) throw error;
      if (!schedule) return null;

      const { data: assignments, error: assErr } = await supabase
        .from("daily_team_assignments")
        .select("*, teams(*, team_members(*, employees(*))), projects:project_id(id, name, client, client_name, location), vehicles(*)")
        .eq("daily_schedule_id", schedule.id);
      if (assErr) throw assErr;

      const { data: entries, error: entError } = await supabase
        .from("daily_schedule_entries")
        .select("*, employees(*)")
        .eq("daily_schedule_id", schedule.id);
      if (entError) throw entError;

      return { ...schedule, assignments: assignments || [], entries: entries || [] };
    },
  });
}

export function useCreateDailySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { data, error } = await supabase
        .from("daily_schedules")
        .insert({ schedule_date: date })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, date) => qc.invalidateQueries({ queryKey: ["daily-schedule", date] }),
  });
}

export function useAddTeamAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: {
      daily_schedule_id: string;
      team_id: string;
      project_id?: string;
      vehicle_id?: string;
      notes?: string;
      date?: string;
    }) => {
      const { date, ...rest } = assignment;
      const insertPayload: any = { ...rest };
      
      const { data, error } = await supabase
        .from("daily_team_assignments")
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;

      if (date && assignment.project_id) {
        await syncDailyToMonthly(date, assignment.team_id, {
          project_id: assignment.project_id,
          vehicle_id: assignment.vehicle_id || null,
        });
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
    },
  });
}

export function useUpdateTeamAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
      date,
      teamId,
    }: {
      id: string;
      updates: { project_id?: string; vehicle_id?: string; notes?: string };
      date?: string;
      teamId?: string;
    }) => {
      const dbUpdates: any = { ...updates };

      const { error } = await supabase
        .from("daily_team_assignments")
        .update(dbUpdates)
        .eq("id", id);
      if (error) throw error;

      if (date && teamId) {
        await syncDailyToMonthly(date, teamId, {
          project_id: updates.project_id,
          vehicle_id: updates.vehicle_id || null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
    },
  });
}

export function useRemoveTeamAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_team_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
    },
  });
}

export function useAddDailyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      daily_schedule_id: string;
      employee_id: string;
      team_id?: string;
      project_id?: string;
      vehicle_id?: string;
      daily_team_assignment_id?: string;
    }) => {
      const insertPayload: any = { ...entry };
      if (entry.project_id) insertPayload.obra_id = entry.project_id;

      const { data, error } = await supabase
        .from("daily_schedule_entries")
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}

export function useUpdateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      attendance,
      check_in_time,
      check_out_time,
      absence_reason,
    }: {
      entryId: string;
      attendance: AttendanceStatus;
      check_in_time?: string;
      check_out_time?: string;
      absence_reason?: string;
    }) => {
      const update: Record<string, unknown> = { attendance };
      if (check_in_time) update.check_in_time = check_in_time;
      if (check_out_time) update.check_out_time = check_out_time;
      if (absence_reason) update.absence_reason = absence_reason;

      const { error } = await supabase
        .from("daily_schedule_entries")
        .update(update)
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}

export function useCloseDailySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from("daily_schedules")
        .update({ is_closed: true, closed_at: new Date().toISOString() })
        .eq("id", scheduleId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}

export function useRemoveDailyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("daily_schedule_entries")
        .delete()
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}

/** Pre-fill daily schedule from monthly schedule */
export function usePreFillFromMonthly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ scheduleId, date }: { scheduleId: string; date: string }) => {
      const d = new Date(date + "T12:00:00");
      const dayOfWeek = d.getDay();

      const { data: monthly, error: mErr } = await supabase
        .from("monthly_schedules")
        .select("*, teams(*, team_members(*, employees(*)))")
        .lte("start_date", date)
        .gte("end_date", date);
      if (mErr) throw mErr;

      if (!monthly?.length) return;

      for (const ms of monthly) {
        if ((ms.schedule_type || "mensal") === "mensal" && (dayOfWeek === 0 || dayOfWeek === 6)) {
          continue;
        }

        const projectId = ms.project_id;

        const { error } = await supabase
          .from("daily_team_assignments")
          .insert({
            daily_schedule_id: scheduleId,
            team_id: ms.team_id,
            obra_id: projectId,
            project_id: projectId,
            vehicle_id: ms.vehicle_id,
          });
        if (error && !error.message.includes("duplicate")) throw error;

        const members = (ms as any).teams?.team_members || [];
        for (const member of members) {
          const { error: entErr } = await supabase
            .from("daily_schedule_entries")
            .insert({
              daily_schedule_id: scheduleId,
              employee_id: member.employee_id,
              team_id: ms.team_id,
              obra_id: projectId,
              vehicle_id: ms.vehicle_id,
            });
          if (entErr && !entErr.message.includes("duplicate")) {
            // Ignore duplicates
          }
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}
