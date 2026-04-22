import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// =============================================================================
// Hook — monthly_discount_report_batches (Onda 3, resgate Fase 3 original)
// =============================================================================
// Container mensal hierárquico para relatórios de desconto Thyalcont.
// 1 batch = 1 mês = N monthly_discount_reports (1 por funcionário ativo).
// Workflow: rascunho → revisao → enviado → aplicado.
// =============================================================================

export type MonthlyReportStatus = "rascunho" | "revisao" | "enviado" | "aplicado";

export type MonthlyDiscountReportBatch = {
  id: string;
  reference_month: string; // YYYY-MM-01
  title: string;
  status: MonthlyReportStatus;
  sent_at: string | null;
  sent_by: string | null;
  applied_at: string | null;
  applied_by: string | null;
  total_alelo: number;
  total_vt: number;
  total_descontos: number;
  total_liquido: number;
  employee_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Report individual dentro de um batch (monthly_discount_reports existente,
// agora com batch_id). Usamos o mesmo shape do hook useMonthlyDiscountReports
// mas acessamos direto para incluir dados do funcionário via join.
export type BatchReportItem = {
  id: string;
  batch_id: string | null;
  employee_id: string;
  year: number;
  month: number;
  alelo_dias_uteis: number;
  alelo_dias_ausente: number;
  alelo_valor_cheio: number;
  alelo_desconto: number;
  alelo_valor_final: number;
  vt_dias_uteis: number;
  vt_dias_ausente: number;
  vt_dias_campo_distante: number;
  vt_dias_dinheiro_integral: number;
  vt_valor_cheio: number;
  vt_desconto_ausencias: number;
  vt_desconto_salario: number;
  vt_valor_final: number;
  vt_isento: boolean;
  outros_descontos: number;
  outros_descricao: string | null;
  total_descontos: number;
  status: MonthlyReportStatus;
  notes: string | null;
  employees?: {
    name: string;
    matricula: string | null;
    cpf: string | null;
    transporte_tipo: string | null;
    empresa_contratante: string | null;
    salario_base: number | null;
    recebe_alelo: boolean | null;
    alelo_valor_dia: number | null;
    vt_isento_desconto: boolean | null;
  } | null;
};

const STATUS_ORDER: Record<MonthlyReportStatus, number> = {
  rascunho: 0,
  revisao: 1,
  enviado: 2,
  aplicado: 3,
};

export const STATUS_LABEL: Record<MonthlyReportStatus, string> = {
  rascunho: "Rascunho",
  revisao: "Em revisão",
  enviado: "Enviado",
  aplicado: "Aplicado",
};

export const STATUS_COLOR: Record<MonthlyReportStatus, string> = {
  rascunho: "bg-gray-100 text-gray-700 border-gray-300",
  revisao: "bg-amber-100 text-amber-800 border-amber-300",
  enviado: "bg-blue-100 text-blue-800 border-blue-300",
  aplicado: "bg-green-100 text-green-800 border-green-300",
};

/**
 * Lista todos os batches (ordenados por mês decrescente).
 */
export function useMonthlyDiscountReportBatches() {
  return useQuery({
    queryKey: ["mdr_batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_discount_report_batches")
        .select("*")
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MonthlyDiscountReportBatch[];
    },
  });
}

/**
 * Detalhe de um batch específico (ou null se não selecionado).
 */
export function useMonthlyDiscountReportBatch(batchId: string | null) {
  return useQuery({
    queryKey: ["mdr_batch", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_discount_report_batches")
        .select("*")
        .eq("id", batchId!)
        .single();
      if (error) throw error;
      return data as MonthlyDiscountReportBatch;
    },
  });
}

/**
 * Lista items (funcionários) de um batch específico, com dados do funcionário joinados.
 */
export function useBatchReportItems(batchId: string | null) {
  return useQuery({
    queryKey: ["mdr_batch_items", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_discount_reports")
        .select(
          "*, employees!monthly_discount_reports_employee_id_fkey(name, matricula, cpf, transporte_tipo, empresa_contratante, salario_base, recebe_alelo, alelo_valor_dia, vt_isento_desconto)"
        )
        .eq("batch_id", batchId!)
        .order("employees(name)", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BatchReportItem[];
    },
  });
}

/**
 * Gera (ou atualiza) batch para um mês via RPC.
 * Idempotente — reexecutar não sobrescreve edições manuais.
 */
export function useGenerateMonthlyBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ referenceMonth, title }: { referenceMonth: string; title?: string }) => {
      const { data, error } = await supabase.rpc("fn_generate_monthly_discount_batch", {
        p_reference_month: referenceMonth,
        p_title: title ?? null,
      });
      if (error) throw error;
      return data as string; // batch_id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mdr_batches"] });
    },
  });
}

/**
 * Atualiza campos de um item individual. Triggers recalculam totais do batch.
 */
export function useUpdateBatchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<BatchReportItem>;
    }) => {
      const { error } = await supabase
        .from("monthly_discount_reports")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["mdr_batches"] });
      qc.invalidateQueries({ queryKey: ["mdr_batch_items"] });
    },
  });
}

/**
 * Avança status do batch com validação de transição.
 * Transições permitidas:
 *   rascunho → revisao
 *   revisao → enviado (preenche sent_at/sent_by)
 *   enviado → aplicado (preenche applied_at/applied_by)
 *   qualquer → rascunho (rollback, só master)
 */
export function useUpdateBatchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      batchId,
      newStatus,
    }: {
      batchId: string;
      newStatus: MonthlyReportStatus;
    }) => {
      const authUser = (await supabase.auth.getUser()).data.user;
      const now = new Date().toISOString();

      const patch: Partial<MonthlyDiscountReportBatch> = {
        status: newStatus,
      };

      if (newStatus === "enviado") {
        patch.sent_at = now;
        patch.sent_by = authUser?.id ?? null;
      } else if (newStatus === "aplicado") {
        patch.applied_at = now;
        patch.applied_by = authUser?.id ?? null;
      } else if (newStatus === "rascunho") {
        // Rollback limpa timestamps
        patch.sent_at = null;
        patch.sent_by = null;
        patch.applied_at = null;
        patch.applied_by = null;
      }

      const { error } = await supabase
        .from("monthly_discount_report_batches")
        .update(patch)
        .eq("id", batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mdr_batches"] });
      qc.invalidateQueries({ queryKey: ["mdr_batch"] });
    },
  });
}

/**
 * Deleta batch (cascade remove os items via FK ON DELETE CASCADE).
 * Só master permite (por RLS).
 */
export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase
        .from("monthly_discount_report_batches")
        .delete()
        .eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mdr_batches"] });
    },
  });
}

/**
 * Transição de status é válida?
 * (Helper para UI habilitar/desabilitar botões.)
 */
export function canTransition(from: MonthlyReportStatus, to: MonthlyReportStatus): boolean {
  if (to === "rascunho") return true; // rollback sempre permitido (RLS limita)
  return STATUS_ORDER[to] === STATUS_ORDER[from] + 1;
}

/**
 * Gera CSV formato Thyalcont.
 * Colunas padrão — ajustar conforme template real que a Thyalcont aceita.
 */
export function buildThyalcontCsv(items: BatchReportItem[], batchTitle: string): string {
  const header = [
    "Matricula",
    "Nome",
    "CPF",
    "Empresa",
    "Salario Base",
    "Alelo Dias",
    "Alelo Valor",
    "Alelo Desconto",
    "VT Dias",
    "VT Valor",
    "VT Desconto Ausencias",
    "VT Desconto Salario",
    "Outros Descontos",
    "Total Descontos",
    "Observacoes",
  ].join(";");

  const rows = items.map((item) => {
    const emp = item.employees;
    const totalLiquido =
      (item.alelo_valor_final ?? 0) +
      (item.vt_valor_final ?? 0) -
      (item.total_descontos ?? 0);

    return [
      emp?.matricula ?? "",
      emp?.name ?? "",
      emp?.cpf ?? "",
      emp?.empresa_contratante ?? "",
      (emp?.salario_base ?? 0).toFixed(2).replace(".", ","),
      item.alelo_dias_uteis,
      (item.alelo_valor_cheio ?? 0).toFixed(2).replace(".", ","),
      (item.alelo_desconto ?? 0).toFixed(2).replace(".", ","),
      item.vt_dias_uteis,
      (item.vt_valor_cheio ?? 0).toFixed(2).replace(".", ","),
      (item.vt_desconto_ausencias ?? 0).toFixed(2).replace(".", ","),
      (item.vt_desconto_salario ?? 0).toFixed(2).replace(".", ","),
      (item.outros_descontos ?? 0).toFixed(2).replace(".", ","),
      (item.total_descontos ?? 0).toFixed(2).replace(".", ","),
      `${batchTitle}${item.outros_descricao ? ` — ${item.outros_descricao}` : ""}`,
    ]
      .map((v) => {
        const s = String(v);
        // Escapa ; e " em valores
        if (s.includes(";") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
        return s;
      })
      .join(";");
  });

  // BOM + CSV (Excel pt-BR lê melhor com BOM)
  return "\uFEFF" + [header, ...rows].join("\n");
}
