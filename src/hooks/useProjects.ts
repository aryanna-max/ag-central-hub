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
  cnpj: string | null;
  cnpj_tomador: string | null;
  empresa_emissora: string | null;
  conta_bancaria: string | null;
  contato_engenheiro: string | null;
  contato_financeiro: string | null;
  modalidade_faturamento: string | null;
  billing_type: string;
  referencia_contrato: string | null;
  instrucao_faturamento_variavel: boolean | null;
  has_multiple_services: boolean | null;
  is_active: boolean | null;
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
  responsible?: string | null;
  responsible_id?: string | null;
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

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
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
      const { data, error } = await supabase.from("projects").update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
