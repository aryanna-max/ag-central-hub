import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Measurement {
  id: string;
  codigo_bm: string;
  obra_id: string | null;
  project_id: string | null;
  team_id: string | null;
  period_start: string;
  period_end: string;
  dias_semana: number;
  valor_diaria_semana: number;
  dias_fds: number;
  valor_diaria_fds: number;
  retencao_pct: number;
  valor_bruto: number;
  valor_retencao: number;
  valor_nf: number;
  status: string;
  nf_numero: string | null;
  nf_data: string | null;
  pdf_signed_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  project_name?: string;
  team_name?: string;
}

export function useMeasurements() {
  return useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*, projects:project_id(name), teams:team_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        project_name: r.projects?.name ?? null,
        team_name: r.teams?.name ?? null,
      })) as Measurement[];
    },
  });
}

export function useCreateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { data, error } = await supabase
        .from("measurements")
        .insert(values as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}

export function useUpdateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from("measurements")
        .update(values as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("measurements")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}

export function useProjectMeasurements(projectId: string | null) {
  return useQuery({
    queryKey: ["measurements", "project", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("measurements")
        .select("*, projects:project_id(name), teams:team_id(name)")
        .or(`project_id.eq.${projectId},obra_id.eq.${projectId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        project_name: r.projects?.name ?? null,
        team_name: r.teams?.name ?? null,
      })) as Measurement[];
    },
    enabled: !!projectId,
  });
}
