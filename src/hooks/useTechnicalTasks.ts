import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TechnicalTask = Database["public"]["Tables"]["technical_tasks"]["Row"];
type TechnicalTaskInsert = Database["public"]["Tables"]["technical_tasks"]["Insert"];
type TechnicalTaskUpdate = Database["public"]["Tables"]["technical_tasks"]["Update"];

export function useTechnicalTasksByProject(projectId: string | null) {
  return useQuery({
    queryKey: ["technical_tasks", "project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technical_tasks")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as TechnicalTask[];
    },
  });
}

export function useTechnicalTasksByAssignee(userId: string | null) {
  return useQuery({
    queryKey: ["technical_tasks", "assignee", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technical_tasks")
        .select("*")
        .eq("assigned_to_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as TechnicalTask[];
    },
  });
}

export function useCreateTechnicalTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      project_id: string;
      title: string;
      description?: string;
      assigned_to_id?: string;
      due_date?: string;
      created_by_id?: string;
    }) => {
      const payload: TechnicalTaskInsert = { ...task, status: "pendente" };
      const { data, error } = await supabase
        .from("technical_tasks")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["technical_tasks"] }),
  });
}

export function useUpdateTechnicalTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TechnicalTaskUpdate & { id: string }) => {
      const { error } = await supabase
        .from("technical_tasks")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["technical_tasks"] }),
  });
}
