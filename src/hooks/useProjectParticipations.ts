import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ParticipationRole = "campo" | "sala_tecnica" | "apoio" | "coordenacao";

export interface ProjectParticipation {
  id: string;
  project_id: string;
  employee_id: string;
  role: ParticipationRole;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employees?: { id: string; name: string; matricula: string | null } | null;
}

// Note: `as any` no nome da tabela é necessário até o Lovable regenerar
// types.ts após o merge desta migration. Mesmo padrão de useComplianceTasks.

export function useProjectParticipations(projectId: string | undefined) {
  return useQuery<ProjectParticipation[]>({
    queryKey: ["project-participations", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_participations" as any)
        .select("*, employees(id, name, matricula)")
        .eq("project_id", projectId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectParticipation[];
    },
    enabled: !!projectId,
  });
}

export function useUpsertParticipation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      employee_id: string;
      role: ParticipationRole;
      start_date: string;
      end_date?: string | null;
      notes?: string | null;
    }) => {
      const { data: existing } = await supabase
        .from("project_participations" as any)
        .select("id")
        .eq("project_id", input.project_id)
        .eq("employee_id", input.employee_id)
        .eq("role", input.role)
        .eq("start_date", input.start_date)
        .maybeSingle();

      if (existing && (existing as any).id) {
        const { error } = await supabase
          .from("project_participations" as any)
          .update({ end_date: input.end_date ?? null, notes: input.notes ?? null })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_participations" as any)
          .insert(input);
        if (error) throw error;
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-participations", vars.project_id] });
    },
  });
}

export function useEndParticipation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("project_participations" as any)
        .update({ end_date: today })
        .eq("id", id);
      if (error) throw error;
      return { project_id };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-participations", vars.project_id] });
    },
  });
}
