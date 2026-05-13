import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ServiceType {
  id: string;
  code: string;
  label: string;
  category: string | null;
  is_active: boolean;
  sort_order: number;
}

export function useServiceTypes() {
  return useQuery({
    queryKey: ["service-types"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FIXME(types-regen): service_types adicionada em 20260513; types.ts regenera após merge em main.
      const { data, error } = await (supabase as any)
        .from("service_types")
        .select("id, code, label, category, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ServiceType[];
    },
    staleTime: 1000 * 60 * 60,
  });
}
