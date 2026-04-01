import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduleConfirmation {
  id: string;
  schedule_date: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes: string | null;
  profiles?: { full_name: string | null } | null;
}

export function useScheduleConfirmation(date: string) {
  return useQuery({
    queryKey: ["schedule-confirmation", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_confirmations")
        .select("*")
        .eq("schedule_date", date)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ScheduleConfirmation | null;
    },
  });
}

export function useConfirmSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, userId, notes }: { date: string; userId: string; notes?: string }) => {
      const { data, error } = await supabase
        .from("schedule_confirmations")
        .insert({
          schedule_date: date,
          confirmed_by: userId,
          confirmed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["schedule-confirmation", vars.date] });
      qc.invalidateQueries({ queryKey: ["daily-schedule", vars.date] });
    },
  });
}
