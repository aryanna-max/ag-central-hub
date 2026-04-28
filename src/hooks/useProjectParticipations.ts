import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ParticipationRow = Database["public"]["Tables"]["project_participations"]["Row"];
type ParticipationInsert = Database["public"]["Tables"]["project_participations"]["Insert"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

export type ParticipationRole = "campo" | "sala_tecnica" | "apoio" | "coordenacao";

export type ProjectParticipation = Omit<ParticipationRow, "role"> & {
  role: ParticipationRole;
  employees?: Pick<EmployeeRow, "id" | "name" | "matricula"> | null;
};

type ProjectParticipationWithEmployee = ParticipationRow & {
  employees: Pick<EmployeeRow, "id" | "name" | "matricula"> | null;
};

export function useProjectParticipations(projectId: string | undefined) {
  return useQuery<ProjectParticipation[]>({
    queryKey: ["project-participations", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_participations")
        .select("*, employees(id, name, matricula)")
        .eq("project_id", projectId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as ProjectParticipationWithEmployee[];
      return rows.map<ProjectParticipation>((r) => ({
        ...r,
        role: r.role as ParticipationRole,
      }));
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
        .from("project_participations")
        .select("id")
        .eq("project_id", input.project_id)
        .eq("employee_id", input.employee_id)
        .eq("role", input.role)
        .eq("start_date", input.start_date)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("project_participations")
          .update({ end_date: input.end_date ?? null, notes: input.notes ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const payload: ParticipationInsert = input;
        const { error } = await supabase
          .from("project_participations")
          .insert(payload);
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
        .from("project_participations")
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
