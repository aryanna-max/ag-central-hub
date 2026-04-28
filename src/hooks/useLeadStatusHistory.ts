import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LeadStatusHistory =
  Database["public"]["Tables"]["lead_status_history"]["Row"];

export function useLeadStatusHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ["lead-status-history", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from("lead_status_history")
        .select("*, profiles:changed_by_id(full_name)")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
