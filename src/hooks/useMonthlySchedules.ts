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
        .select("*, teams(*, team_members(*, employees(*))), obras(*), vehicles(*)")
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
      vehicle_id?: string;
      schedule_type?: string;
    }) => {
      const { error } = await supabase.from("monthly_schedules").insert(payload);
      if (error) throw error;

      // Sync to daily: create/update daily schedules for each day in range
      await syncMonthlyToDaily(payload.team_id, payload.obra_id, payload.vehicle_id || null, payload.start_date, payload.end_date, payload.schedule_type || "mensal");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
    },
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
      updates: { team_id?: string; obra_id?: string; vehicle_id?: string };
      syncToDaily?: boolean;
    }) => {
      // Get current schedule before update
      const { data: oldSchedule } = await supabase
        .from("monthly_schedules")
        .select("*")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("monthly_schedules")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Sync to open daily schedules if requested
      if (syncToDaily && oldSchedule) {
        const { data: dailySchedules } = await supabase
          .from("daily_schedules")
          .select("id, schedule_date, is_closed")
          .gte("schedule_date", oldSchedule.start_date)
          .lte("schedule_date", oldSchedule.end_date)
          .eq("is_closed", false);

        if (dailySchedules?.length) {
          for (const ds of dailySchedules) {
            const updatePayload: Record<string, string> = {};
            if (updates.team_id) updatePayload.team_id = updates.team_id;
            if (updates.obra_id) updatePayload.obra_id = updates.obra_id;
            if (updates.vehicle_id) updatePayload.vehicle_id = updates.vehicle_id;

            if (Object.keys(updatePayload).length > 0) {
              await supabase
                .from("daily_team_assignments")
                .update(updatePayload)
                .eq("daily_schedule_id", ds.id)
                .eq("team_id", oldSchedule.team_id);

              // Also update daily_schedule_entries
              await supabase
                .from("daily_schedule_entries")
                .update(updatePayload)
                .eq("daily_schedule_id", ds.id)
                .eq("team_id", oldSchedule.team_id);
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

/** Sync daily schedule changes back to monthly_schedules */
export async function syncDailyToMonthly(
  date: string,
  teamId: string,
  updates: { obra_id?: string; vehicle_id?: string | null }
) {
  const d = new Date(date + "T12:00:00");
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  // Find monthly schedule covering this date for this team
  const { data: monthlySchedules } = await supabase
    .from("monthly_schedules")
    .select("id, start_date, end_date")
    .eq("team_id", teamId)
    .lte("start_date", date)
    .gte("end_date", date);

  if (monthlySchedules?.length) {
    // Update the first matching monthly schedule
    const updatePayload: Record<string, unknown> = {};
    if (updates.obra_id) updatePayload.obra_id = updates.obra_id;
    if (updates.vehicle_id !== undefined) updatePayload.vehicle_id = updates.vehicle_id;

    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from("monthly_schedules")
        .update(updatePayload)
        .eq("id", monthlySchedules[0].id);
    }
  } else if (updates.obra_id) {
    // No monthly schedule exists - create one for this single day
    await supabase.from("monthly_schedules").insert({
      team_id: teamId,
      obra_id: updates.obra_id,
      vehicle_id: updates.vehicle_id || null,
      month,
      year,
      start_date: date,
      end_date: date,
      schedule_type: "mensal",
    });
  }
}

/** Helper to sync a monthly allocation to daily schedules */
async function syncMonthlyToDaily(
  teamId: string,
  obraId: string,
  vehicleId: string | null,
  startDate: string,
  endDate: string,
  scheduleType: string
) {
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    // Skip weekends for "mensal" type
    if (scheduleType === "mensal" && (dow === 0 || dow === 6)) continue;

    const dateStr = d.toISOString().slice(0, 10);

    // Get or create daily schedule
    let { data: ds } = await supabase
      .from("daily_schedules")
      .select("id, is_closed")
      .eq("schedule_date", dateStr)
      .maybeSingle();

    if (ds?.is_closed) continue; // Don't touch closed schedules

    if (!ds) {
      const { data: created } = await supabase
        .from("daily_schedules")
        .insert({ schedule_date: dateStr })
        .select()
        .single();
      ds = created;
    }

    if (!ds) continue;

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from("daily_team_assignments")
      .select("id")
      .eq("daily_schedule_id", ds.id)
      .eq("team_id", teamId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("daily_team_assignments").insert({
        daily_schedule_id: ds.id,
        team_id: teamId,
        obra_id: obraId,
        vehicle_id: vehicleId,
      });
    }
  }
}
