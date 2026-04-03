import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScopeItem {
  id: string;
  project_id: string;
  description: string;
  order_index: number;
  is_completed: boolean | null;
  completed_at: string | null;
  completed_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useScopeItems(projectId: string | null) {
  return useQuery({
    queryKey: ["scope_items", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_scope_items")
        .select("*")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as unknown as ScopeItem[];
    },
  });
}

export function useCreateScopeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { project_id: string; description: string; order_index: number }) => {
      const { error } = await supabase.from("project_scope_items").insert(item as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scope_items"] }),
  });
}

export function useUpdateScopeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScopeItem> & { id: string }) => {
      const { error } = await supabase.from("project_scope_items").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scope_items"] }),
  });
}
