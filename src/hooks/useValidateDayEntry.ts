import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useValidateDayEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { data, error } = await supabase
        .from("daily_schedule_entries")
        .update({ validated_at: new Date().toISOString() })
        .eq("id", entryId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["employee-day-status"] });
    },
  });
}

export function useUnvalidateDayEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, motivo }: { entryId: string; motivo: string }) => {
      const { error } = await supabase.rpc("fn_unvalidate_day_entry", {
        p_entry_id: entryId,
        p_motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["employee-day-status"] });
    },
  });
}
