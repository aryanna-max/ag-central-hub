import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectService {
  id: string;
  project_id: string;
  service_type: string;
  billing_mode: string;
  contract_value: number | null;
  cnpj_tomador: string | null;
  nf_number: string | null;
  nf_date: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useProjectServices(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-services", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_services")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as ProjectService[];
    },
  });
}

export function useCreateProjectService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (service: Omit<ProjectService, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("project_services")
        .insert(service as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectService;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["project-services", data.project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProjectService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjectService> & { id: string }) => {
      const { data, error } = await supabase
        .from("project_services")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectService;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["project-services", data.project_id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProjectService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from("project_services").delete().eq("id", id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["project-services", data.projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Recalculates the parent project's contract_value and has_multiple_services */
export async function syncProjectFromServices(projectId: string) {
  const { data: services } = await supabase
    .from("project_services")
    .select("contract_value")
    .eq("project_id", projectId);

  const total = (services || []).reduce((s, sv: any) => s + (sv.contract_value || 0), 0);
  const hasMultiple = (services || []).length > 1;

  await supabase
    .from("projects")
    .update({ contract_value: total, has_multiple_services: hasMultiple } as any)
    .eq("id", projectId);
}
