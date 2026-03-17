import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

      const { data: entries, error: entError } = await supabase
        .from("daily_schedule_entries")
        .select("*, employees(*), teams(*), obras(*), vehicles(*)")
        .eq("daily_schedule_id", schedule.id);
      if (entError) throw entError;

      return { ...schedule, entries: entries || [] };
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

export function useAddDailyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      daily_schedule_id: string;
      employee_id: string;
      team_id?: string;
      obra_id?: string;
      vehicle_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("daily_schedule_entries")
        .insert(entry)
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
