import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ===== Tipos locais (tabelas novas ainda nao reflectidas em types.ts) =====
export type MonthlyReportStatus = "rascunho" | "revisao" | "enviado" | "aplicado";

export type MonthlyDiscountReport = {
  id: string;
  reference_month: string;
  title: string;
  status: MonthlyReportStatus;
  sent_at: string | null;
  sent_by: string | null;
  applied_at: string | null;
  total_alelo: number;
  total_vt: number;
  total_descontos: number;
  total_liquido: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyDiscountReportItem = {
  id: string;
  report_id: string;
  employee_id: string;
  alelo_dias: number;
  alelo_valor_dia: number;
  alelo_total: number;
  alelo_desconto_faltas: number;
  vt_viagens: number;
  vt_valor_viagem: number;
  vt_total: number;
  vt_desconto_faltas: number;
  descontos_semanais: number;
  valor_liquido: number;
  notes: string | null;
  employees?: { name: string; matricula: string | null; empresa_emissora: string | null } | null;
};

// ============================================================
// LIST reports
// ============================================================
export function useMonthlyDiscountReports() {
  return useQuery({
    queryKey: ["monthly-discount-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("monthly_discount_reports")
        .select("*")
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MonthlyDiscountReport[];
    },
  });
}

// ============================================================
// GET single report with items
// ============================================================
export function useMonthlyDiscountReport(reportId: string | null) {
  return useQuery({
    queryKey: ["monthly-discount-report", reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data: report, error: reportErr } = await (supabase as any)
        .from("monthly_discount_reports")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();
      if (reportErr) throw reportErr;

      const { data: items, error: itemsErr } = await (supabase as any)
        .from("monthly_discount_report_items")
        .select("*, employees(name, matricula, empresa_emissora)")
        .eq("report_id", reportId)
        .order("created_at", { ascending: true });
      if (itemsErr) throw itemsErr;

      return {
        report: report as MonthlyDiscountReport | null,
        items: (items ?? []) as MonthlyDiscountReportItem[],
      };
    },
  });
}

// ============================================================
// GENERATE / REGENERATE via RPC (fn_generate_monthly_discount_report)
// ============================================================
export function useGenerateMonthlyDiscountReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (referenceMonth: string) => {
      // Normaliza para o primeiro dia do mes
      const firstDay = referenceMonth.slice(0, 7) + "-01";
      const { data, error } = await (supabase as any).rpc("fn_generate_monthly_discount_report", {
        p_reference_month: firstDay,
      });
      if (error) throw error;
      return data as string; // report_id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-discount-reports"] });
      qc.invalidateQueries({ queryKey: ["monthly-discount-report"] });
    },
  });
}

// ============================================================
// UPDATE item (edicao manual de dias/descontos)
// ============================================================
export function useUpdateMonthlyDiscountReportItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      id: string;
      alelo_dias?: number;
      alelo_valor_dia?: number;
      alelo_desconto_faltas?: number;
      vt_viagens?: number;
      vt_valor_viagem?: number;
      vt_desconto_faltas?: number;
      descontos_semanais?: number;
      notes?: string | null;
    }) => {
      // Recalcula totais a partir do que o usuario editou
      const alelo_total = (values.alelo_dias ?? 0) * (values.alelo_valor_dia ?? 0) - (values.alelo_desconto_faltas ?? 0);
      const vt_total = (values.vt_viagens ?? 0) * (values.vt_valor_viagem ?? 0) - (values.vt_desconto_faltas ?? 0);
      const valor_liquido = alelo_total + vt_total - (values.descontos_semanais ?? 0);

      const patch: Record<string, any> = {
        alelo_dias: values.alelo_dias,
        alelo_valor_dia: values.alelo_valor_dia,
        alelo_desconto_faltas: values.alelo_desconto_faltas,
        alelo_total,
        vt_viagens: values.vt_viagens,
        vt_valor_viagem: values.vt_valor_viagem,
        vt_desconto_faltas: values.vt_desconto_faltas,
        vt_total,
        descontos_semanais: values.descontos_semanais,
        valor_liquido,
        notes: values.notes ?? null,
      };
      // Remove campos undefined
      Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

      const { error } = await (supabase as any)
        .from("monthly_discount_report_items")
        .update(patch)
        .eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-discount-report"] });
      qc.invalidateQueries({ queryKey: ["monthly-discount-reports"] });
    },
  });
}

// ============================================================
// MUTATE status do relatorio (rascunho -> revisao -> enviado -> aplicado)
// ============================================================
export function useUpdateMonthlyDiscountReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      id: string;
      status: MonthlyReportStatus;
      notes?: string | null;
    }) => {
      const patch: Record<string, any> = {
        status: values.status,
        notes: values.notes ?? null,
      };
      if (values.status === "enviado") patch.sent_at = new Date().toISOString();
      if (values.status === "aplicado") patch.applied_at = new Date().toISOString();

      const { error } = await (supabase as any)
        .from("monthly_discount_reports")
        .update(patch)
        .eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-discount-reports"] });
      qc.invalidateQueries({ queryKey: ["monthly-discount-report"] });
    },
  });
}

// ============================================================
// DELETE report (apenas rascunho)
// ============================================================
export function useDeleteMonthlyDiscountReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("monthly_discount_reports")
        .delete()
        .eq("id", id)
        .eq("status", "rascunho");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-discount-reports"] });
    },
  });
}
