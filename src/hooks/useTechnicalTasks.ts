import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TechnicalTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigned_to_id: string | null;
  created_by_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  scope_item_id: string | null;
  created_at: string;
  updated_at: string;
}

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
      const { data, error } = await supabase
        .from("technical_tasks")
        .insert({ ...task, status: "pendente" } as any)
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
    mutationFn: async ({ id, ...updates }: Partial<TechnicalTask> & { id: string }) => {
      const { error } = await supabase
        .from("technical_tasks")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["technical_tasks"] }),
  });
}
