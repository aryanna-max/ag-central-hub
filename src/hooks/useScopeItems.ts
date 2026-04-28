import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ScopeItem = Database["public"]["Tables"]["project_scope_items"]["Row"];
type ScopeItemInsert = Database["public"]["Tables"]["project_scope_items"]["Insert"];
type ScopeItemUpdate = Database["public"]["Tables"]["project_scope_items"]["Update"];

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
      const payload: ScopeItemInsert = item;
      const { error } = await supabase.from("project_scope_items").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scope_items"] }),
  });
}

export function useUpdateScopeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ScopeItemUpdate & { id: string }) => {
      const { error } = await supabase.from("project_scope_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scope_items"] }),
  });
}
