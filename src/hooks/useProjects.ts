import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectRowInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectRowUpdate = Database["public"]["Tables"]["projects"]["Update"];

export type ProjectStatus = Database["public"]["Enums"]["project_status"];

export interface ProjectClient {
  id: string;
  name: string;
  cnpj: string | null;
}

/**
 * Project = linha de `projects` (gerada) + join opcional com `clients`
 * + campos LEGADOS mantidos como opcionais até o cleanup completo (PR4).
 *
 * LEGADO (TODO PR4): client / client_name / client_cnpj / has_multiple_services
 * não existem no schema regenerado, mas ainda aparecem em código antigo
 * (display fallbacks, useLeadConversion, syncProjectFromServices).
 */
export type Project = ProjectRow & {
  clients: ProjectClient | null;
  client?: string | null;
  client_name?: string | null;
  client_cnpj?: string | null;
  has_multiple_services?: boolean | null;
  /** @deprecated 2026-04-28 — use responsible_comercial_id / _tecnico_id / _campo_id (FK profiles). */
  responsible?: string | null;
};

export type ProjectInsert = ProjectRowInsert & {
  client?: string | null;
  client_name?: string | null;
  client_cnpj?: string | null;
  has_multiple_services?: boolean | null;
  responsible?: string | null;
};

export type ProjectUpdate = ProjectRowUpdate;

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
      return (data ?? []).map((p) => ({
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
      return (data ?? []).map((p) => ({
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
      return (data ?? []).map((p) => ({
        ...p,
        clients: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
      })) as Project[];
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ProjectUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
