import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMonthlySchedules(month: number, year: number) {
  return useQuery({
    queryKey: ["monthly-schedules", month, year],
    queryFn: async () => {
      const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const endOfMonth = new Date(year, month, 0).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("monthly_schedules")
        .select("*, teams(*, team_members(*, employees(*))), obras(*)")
        .lte("start_date", endOfMonth)
        .gte("end_date", startOfMonth);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMonthlySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      team_id: string;
      obra_id: string;
      start_date: string;
      end_date: string;
      month: number;
      year: number;
    }) => {
      const { error } = await supabase.from("monthly_schedules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-schedules"] }),
  });
}

export function useUpdateMonthlySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
      syncToDaily,
    }: {
      id: string;
      updates: { team_id?: string; obra_id?: string };
      syncToDaily?: boolean;
    }) => {
      const { error } = await supabase
        .from("monthly_schedules")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Sync to open daily schedules if requested
      if (syncToDaily) {
        const { data: schedule } = await supabase
          .from("monthly_schedules")
          .select("*")
          .eq("id", id)
          .single();
        if (!schedule) return;

        // Find daily assignments matching old team for this date range that are not closed
        const { data: dailySchedules } = await supabase
          .from("daily_schedules")
          .select("id, schedule_date, is_closed")
          .gte("schedule_date", schedule.start_date)
          .lte("schedule_date", schedule.end_date)
          .eq("is_closed", false);

        if (dailySchedules?.length) {
          for (const ds of dailySchedules) {
            if (updates.team_id) {
              await supabase
                .from("daily_team_assignments")
                .update({ team_id: updates.team_id })
                .eq("daily_schedule_id", ds.id)
                .eq("team_id", schedule.team_id);
            }
            if (updates.obra_id) {
              await supabase
                .from("daily_team_assignments")
                .update({ obra_id: updates.obra_id })
                .eq("daily_schedule_id", ds.id)
                .eq("team_id", schedule.team_id);
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
    },
  });
}

export function useDeleteMonthlySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-schedules"] }),
  });
}

export function useUnallocatedProjects(month: number, year: number) {
  return useQuery({
    queryKey: ["unallocated-projects", month, year],
    queryFn: async () => {
      const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const endOfMonth = new Date(year, month, 0).toISOString().slice(0, 10);

      const { data: obras, error: oErr } = await supabase
        .from("obras")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (oErr) throw oErr;

      const { data: schedules, error: sErr } = await supabase
        .from("monthly_schedules")
        .select("obra_id")
        .lte("start_date", endOfMonth)
        .gte("end_date", startOfMonth);
      if (sErr) throw sErr;

      const allocatedIds = new Set((schedules || []).map((s) => s.obra_id));
      return (obras || []).filter((o) => !allocatedIds.has(o.id));
    },
  });
}
