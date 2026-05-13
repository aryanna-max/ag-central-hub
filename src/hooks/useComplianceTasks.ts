import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// FIXME(types-mismatch): reference_month em types.ts é number, mas o código (e o DB real) usa string YYYY-MM.
// O cast abaixo declara conformidade com o tipo gerado; regenerar types.ts ou alinhar coluna no DB para remover.
type ReferenceMonthDb = number;

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
        .eq("reference_month", referenceMonth as unknown as ReferenceMonthDb)
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

      // FIXME(types-mismatch): mesma divergência do reference_month + tipos exigem due_date/reference_year que o DB real preenche via default/trigger.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase
        .from("compliance_task_executions")
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
