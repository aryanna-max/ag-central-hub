import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProjectStatus = "planejamento" | "execucao" | "entrega" | "faturamento" | "concluido" | "pausado";

export interface ProjectClient {
  id: string;
  name: string;
  cnpj: string | null;
}

export interface Project {
  id: string;
  codigo: string | null;
  name: string;
  client: string | null;
  client_id: string | null;
  client_name: string | null;
  client_cnpj: string | null;
  clients: ProjectClient | null;
  service: string | null;
  contract_value: number | null;
  /** @deprecated 2026-04-28 — use responsible_comercial_id / _tecnico_id / _campo_id (FK profiles). */
  responsible: string | null;
  responsible_comercial_id: string | null;
  responsible_campo_id: string | null;
  responsible_tecnico_id: string | null;
  lead_id: string | null;
  obra_id: string | null;
  status: ProjectStatus;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  empresa_faturadora: string;
  tipo_documento: string;
  cnpj: string | null;
  cnpj_tomador: string | null;
  empresa_emissora: string | null;
  conta_bancaria: string | null;
  modalidade_faturamento: string | null;
  referencia_contrato: string | null;
  instrucao_faturamento_variavel: boolean | null;
  has_multiple_services: boolean | null;
  is_active: boolean | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  show_in_operational: boolean;
  execution_status: string | null;
  needs_tech_prep: boolean | null;
  billing_type: string | null;
  cep: string | null;
  rua: string | null;
  bairro: string | null;
  numero: string | null;
  cidade: string | null;
  estado: string | null;
  scope_description: string | null;
  field_started_at: string | null;
  field_deadline: string | null;
  delivery_deadline: string | null;
  field_completed_at: string | null;
  delivered_at: string | null;
  nf_data: string | null;
  field_days_estimated: number | null;
  delivery_days_estimated: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectInsert {
  name: string;
  client?: string | null;
  client_id?: string | null;
  client_cnpj?: string | null;
  cnpj_tomador?: string | null;
  service?: string | null;
  contract_value?: number | null;
  /** @deprecated 2026-04-28 — use responsible_comercial_id / _tecnico_id / _campo_id (FK profiles). */
  responsible?: string | null;
  responsible_comercial_id?: string | null;
  responsible_tecnico_id?: string | null;
  responsible_campo_id?: string | null;
  lead_id?: string | null;
  status?: ProjectStatus;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  empresa_faturadora?: string;
  tipo_documento?: string;
  is_active?: boolean;
  codigo?: string;
}

/**
 * useProjects — projetos ATIVOS (is_active=true).
 * Default pra todas as telas operacionais/financeiras.
 * Para incluir arquivados (telas de histórico), usar useProjectsAll().
 */
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*,clients(id,name,cnpj)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        clients: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
      })) as Project[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

/**
 * useProjectsAll — inclui arquivados. Usar só em telas de histórico
 * (ProjetoHistorico, ClienteHistorico, relatórios retroativos).
 */
export function useProjectsAll() {
  return useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*,clients(id,name,cnpj)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        clients: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
      })) as Project[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: ProjectInsert & { client_codigo?: string }) => {
      let codigo: string | undefined;
      if (project.client_codigo) {
        const year = new Date().getFullYear();
        const prefix = `${year}-${project.client_codigo}-`;
        // Count existing projects for this client+year
        const { data: existing } = await supabase
          .from("projects")
          .select("codigo")
          .like("codigo" as any, `${prefix}%`);
        const seq = (existing?.length || 0) + 1;
        codigo = `${prefix}${String(seq).padStart(3, "0")}`;
      }
      const { client_codigo, ...rest } = project;
      const payload = { ...rest, ...(codigo ? { codigo } : {}) };
      // TODO PR4: ProjectInsert manual carrega client/client_cnpj/responsible que não existem no schema regenerado.
      const { data, error } = await supabase.from("projects").insert(payload as any).select().single();
      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useActiveProjects() {
  return useQuery({
    queryKey: ["projects-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*,clients(id,name,cnpj)")
        .eq("is_active", true)
        .neq("status", "concluido")
        .order("name");
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        clients: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
      })) as Project[];
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      // TODO PR4: Project manual carrega nf_data/has_multiple_services/etc não existentes no schema regenerado.
      const { data, error } = await supabase.from("projects").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
