import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PreencherConflict {
  entry_id: string;
  employee_id: string;
  old_project_id: string | null;
  new_project_id: string | null;
}

export interface PreencherResult {
  daily_schedule_id: string;
  created_count: number;
  updated_count: number;
  skipped_validated_count: number;
  conflicts: PreencherConflict[];
}

export function usePreencherEscala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleDate: string): Promise<PreencherResult> => {
      const { data, error } = await supabase.rpc("fn_preencher_escala_dia", {
        p_schedule_date: scheduleDate,
      });
      if (error) throw error;
      const row = data?.[0];
      if (!row) throw new Error("Sem retorno de fn_preencher_escala_dia");
      const conflicts = Array.isArray(row.conflicts)
        ? (row.conflicts as unknown as PreencherConflict[])
        : [];
      return {
        daily_schedule_id: row.daily_schedule_id,
        created_count: row.created_count,
        updated_count: row.updated_count,
        skipped_validated_count: row.skipped_validated_count,
        conflicts,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["preencher-disponivel"] });
    },
  });
}

export function useResolverConflitoPreencher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      entryId: string;
      acao: "manter" | "trocar";
      newProjectId?: string | null;
    }) => {
      const { error } = await supabase.rpc("fn_resolver_conflito_preencher", {
        p_entry_id: params.entryId,
        p_acao: params.acao,
        p_new_project_id: params.newProjectId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
    },
  });
}

/**
 * Retorna true quando há plano (daily_team_assignments) para o dia e:
 * (a) não há entries ainda, ou
 * (b) o plano foi modificado depois do último sync (last_synced_at).
 */
export function usePreencherDisponivel(scheduleDate: string | null) {
  return useQuery({
    queryKey: ["preencher-disponivel", scheduleDate],
    enabled: !!scheduleDate,
    queryFn: async (): Promise<boolean> => {
      const { data: ds } = await supabase
        .from("daily_schedules")
        .select("id, last_synced_at")
        .eq("schedule_date", scheduleDate!)
        .maybeSingle();

      if (!ds) {
        const { count } = await supabase
          .from("daily_team_assignments")
          .select("id", { count: "exact", head: true });
        return (count ?? 0) > 0;
      }

      const { data: assignments } = await supabase
        .from("daily_team_assignments")
        .select("id, created_at")
        .eq("daily_schedule_id", ds.id);

      if (!assignments || assignments.length === 0) return false;

      const { count: entriesCount } = await supabase
        .from("daily_schedule_entries")
        .select("id", { count: "exact", head: true })
        .eq("daily_schedule_id", ds.id);

      if ((entriesCount ?? 0) === 0) return true;
      if (!ds.last_synced_at) return true;

      const lastSync = new Date(ds.last_synced_at).getTime();
      const planoMudou = assignments.some(
        (a) => new Date(a.created_at).getTime() > lastSync,
      );
      return planoMudou;
    },
  });
}
