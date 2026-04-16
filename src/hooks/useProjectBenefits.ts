import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProjectBenefits(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-benefits", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("project_benefits")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useUpsertProjectBenefits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      project_id: string;
      cafe_enabled?: boolean;
      cafe_value?: number;
      almoco_type?: string;
      almoco_diferenca_value?: number;
      jantar_enabled?: boolean;
      jantar_value?: number;
      hospedagem_enabled?: boolean;
      hospedagem_type?: string;
      hospedagem_value?: number;
    }) => {
      const { data: existing } = await supabase
        .from("project_benefits")
        .select("id")
        .eq("project_id", values.project_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("project_benefits")
          .update(values)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_benefits")
          .insert(values);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-benefits", vars.project_id] });
    },
  });
}
