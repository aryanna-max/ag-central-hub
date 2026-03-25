import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectAuthorization {
  id: string;
  employee_id: string;
  project_id: string;
  integration_date: string | null;
  expiry_date: string | null;
  status: string;
  docs: any;
  registered_by: string | null;
  created_at: string | null;
  employees?: { name: string } | null;
  projects?: { name: string } | null;
}

export function useProjectAuthorizations(employeeId?: string) {
  return useQuery({
    queryKey: ["project-authorizations", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_project_authorizations")
        .select("*, employees(name), projects:project_id(name)")
        .eq("employee_id", employeeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProjectAuthorization[];
    },
  });
}

export function useAllProjectAuthorizations() {
  return useQuery({
    queryKey: ["all-project-authorizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_project_authorizations")
        .select("*, employees(name), projects:project_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProjectAuthorization[];
    },
  });
}

export function useProjectAuthorizationsByProject(projectId?: string) {
  return useQuery({
    queryKey: ["project-authorizations-by-project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_project_authorizations")
        .select("employee_id, status")
        .eq("project_id", projectId!)
        .eq("status", "ativo");
      if (error) throw error;
      return new Set((data || []).map((d: any) => d.employee_id));
    },
  });
}

export function useCreateProjectAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: string;
      project_id: string;
      integration_date?: string;
      expiry_date?: string;
      status?: string;
      registered_by?: string;
    }) => {
      const { data, error } = await supabase
        .from("employee_project_authorizations")
        .insert({ ...payload, status: payload.status || "ativo" } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-authorizations"] });
      qc.invalidateQueries({ queryKey: ["all-project-authorizations"] });
      qc.invalidateQueries({ queryKey: ["project-authorizations-by-project"] });
    },
  });
}

export function useUpdateProjectAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; expiry_date?: string; integration_date?: string }) => {
      const { error } = await supabase
        .from("employee_project_authorizations")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-authorizations"] });
      qc.invalidateQueries({ queryKey: ["all-project-authorizations"] });
      qc.invalidateQueries({ queryKey: ["project-authorizations-by-project"] });
    },
  });
}
