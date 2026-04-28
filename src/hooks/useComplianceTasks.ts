import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useComplianceTemplates() {
  return useQuery({
    queryKey: ["compliance-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_compliance_tasks")
        .select("*, clients(name)")
        .eq("is_active", true)
        .order("due_day");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useComplianceExecutions(referenceMonth: string) {
  return useQuery({
    queryKey: ["compliance-executions", referenceMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_task_executions")
        .select("*, monthly_compliance_tasks(title, due_day, description, clients(name))")
        // schema diz reference_month: number, código usa string YYYY-MM (types.ts/DB divergente)
        .eq("reference_month", referenceMonth as any)
        .order("monthly_compliance_tasks(due_day)");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGenerateMonthExecutions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (referenceMonth: string) => {
      const { data: templates } = await supabase
        .from("monthly_compliance_tasks")
        .select("id")
        .eq("is_active", true);

      if (!templates?.length) return { count: 0 };

      const toInsert = templates.map((t) => ({
        task_id: t.id,
        reference_month: referenceMonth,
      }));

      const { error } = await supabase
        .from("compliance_task_executions")
        // payload usa reference_month string YYYY-MM mas types.ts diz number; DB aceita formato real
        .upsert(toInsert as any, { onConflict: "task_id,reference_month", ignoreDuplicates: true });

      if (error) throw error;
      return { count: toInsert.length };
    },
    onSuccess: (_, month) => {
      qc.invalidateQueries({ queryKey: ["compliance-executions", month] });
    },
  });
}

export function useCompleteExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; referenceMonth: string }) => {
      const { error } = await supabase
        .from("compliance_task_executions")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["compliance-executions", vars.referenceMonth] });
    },
  });
}

export function useReopenExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; referenceMonth: string }) => {
      const { error } = await supabase
        .from("compliance_task_executions")
        .update({ completed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["compliance-executions", vars.referenceMonth] });
    },
  });
}
