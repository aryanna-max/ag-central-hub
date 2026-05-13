import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProjectServiceRow = Database["public"]["Tables"]["project_services"]["Row"];
type ProjectServiceInsert = Database["public"]["Tables"]["project_services"]["Insert"];

export type ProjectService = Omit<ProjectServiceRow, "billing_mode" | "status"> & {
  billing_mode: string;
  status: string;
};

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
    mutationFn: async (service: ProjectServiceInsert) => {
      const { data, error } = await supabase
        .from("project_services")
        .insert(service)
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
      // FIXME(types-mismatch): form-state passa billing_mode/status como string genérica; enums em types.ts requerem união literal. Alinhar tipos do form ou criar wrapper tipado.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Recalcula o `contract_value` do projeto somando `contract_value` dos serviços.
 * Resolve T9: consumidores que precisam saber "tem múltiplos serviços?" devem
 * derivar via COUNT em `project_services` em vez de uma coluna inexistente.
 */
export async function syncProjectFromServices(projectId: string) {
  const { data: services } = await supabase
    .from("project_services")
    .select("contract_value")
    .eq("project_id", projectId);

  const total = (services ?? []).reduce(
    (s, sv) => s + (sv.contract_value ?? 0),
    0,
  );

  await supabase
    .from("projects")
    .update({ contract_value: total })
    .eq("id", projectId);
}

/** Lista project_services cross-projeto, com filtros opcionais. */
export interface ProjectServiceCrossRow {
  id: string;
  project_id: string;
  proposal_id: string | null;
  service_type: string;
  service_type_id: string | null;
  billing_mode: string;
  contract_value: number | null;
  status: string;
  start_date: string | null;
  nf_number: string | null;
  nf_date: string | null;
  notes: string | null;
  created_at: string | null;
  projects: { id: string; name: string; codigo: string | null } | null;
}

export interface CrossServicesFilter {
  status?: string[];
  billingMode?: string[];
  projectId?: string;
}

export function useProjectServicesByStatus(filter: CrossServicesFilter = {}) {
  return useQuery({
    queryKey: ["project-services-cross", filter],
    queryFn: async () => {
      let q = supabase
        .from("project_services")
        .select(
          "id, project_id, proposal_id, service_type, service_type_id, billing_mode, contract_value, status, start_date, nf_number, nf_date, notes, created_at, projects:project_id(id, name, codigo)",
        )
        .order("created_at", { ascending: false });

      if (filter.status?.length) {
        q = q.in(
          "status",
          filter.status as Database["public"]["Enums"]["service_status"][],
        );
      }
      if (filter.billingMode?.length) {
        q = q.in(
          "billing_mode",
          filter.billingMode as Database["public"]["Enums"]["billing_mode"][],
        );
      }
      if (filter.projectId) {
        q = q.eq("project_id", filter.projectId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ProjectServiceCrossRow[];
    },
  });
}
