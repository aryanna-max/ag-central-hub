import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProjectStatus = "planejamento" | "execucao" | "entrega" | "faturamento" | "concluido" | "pausado";

export interface Project {
  id: string;
  name: string;
  client: string | null;
  client_cnpj: string | null;
  service: string | null;
  contract_value: number | null;
  responsible: string | null;
  responsible_id: string | null;
  lead_id: string | null;
  obra_id: string | null;
  status: ProjectStatus;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  empresa_faturadora: string;
  tipo_documento: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectInsert {
  name: string;
  client?: string | null;
  client_cnpj?: string | null;
  service?: string | null;
  contract_value?: number | null;
  responsible?: string | null;
  responsible_id?: string | null;
  lead_id?: string | null;
  status?: ProjectStatus;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  empresa_faturadora?: string;
  tipo_documento?: string;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: ProjectInsert) => {
      const { data, error } = await supabase.from("projects").insert(project).select().single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase.from("projects").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
