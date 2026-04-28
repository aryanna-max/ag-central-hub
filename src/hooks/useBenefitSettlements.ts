import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BenefitSettlementRow = Database["public"]["Tables"]["benefit_settlements"]["Row"];
type BenefitSettlementInsert = Database["public"]["Tables"]["benefit_settlements"]["Insert"];

export type BenefitSettlementWithEmployee = BenefitSettlementRow & {
  employees: { name: string | null; matricula: string | null } | null;
};

// Fetch settlements - can filter by semana_inicio, status, or leave open for all
export function useBenefitSettlements(filters?: {
  semana_inicio?: string;
  status?: string;
}) {
  return useQuery<BenefitSettlementWithEmployee[]>({
    queryKey: ["benefit-settlements", filters],
    queryFn: async () => {
      let query = supabase
        .from("benefit_settlements")
        .select("*, employees(name, matricula)")
        .order("semana_inicio", { ascending: false })
        .order("employee_id");

      if (filters?.semana_inicio) query = query.eq("semana_inicio", filters.semana_inicio);
      if (filters?.status) query = query.eq("status", filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as BenefitSettlementWithEmployee[];
    },
  });
}

// Generate settlements for a week from employee_daily_records
export function useGenerateBenefitSettlements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ semana_inicio, semana_fim }: { semana_inicio: string; semana_fim: string }) => {
      // Fetch all daily records for the week
      const { data: records, error } = await supabase
        .from("employee_daily_records")
        .select("employee_id, cafe_provided, cafe_value, almoco_dif_provided, almoco_dif_value, jantar_provided, jantar_value, attendance")
        .gte("schedule_date", semana_inicio)
        .lte("schedule_date", semana_fim);

      if (error) throw error;
      if (!records?.length) return { count: 0 };

      // Group by employee
      const grouped = new Map<string, {
        cafe_previsto: number; cafe_valor_total: number;
        almoco_previsto: number; almoco_valor_total: number;
        jantar_previsto: number; jantar_valor_total: number;
      }>();

      for (const r of records) {
        const present = !r.attendance || r.attendance === "presente" || r.attendance === "atrasado";
        if (!present) continue;

        const existing = grouped.get(r.employee_id) ?? {
          cafe_previsto: 0, cafe_valor_total: 0,
          almoco_previsto: 0, almoco_valor_total: 0,
          jantar_previsto: 0, jantar_valor_total: 0,
        };

        if (r.cafe_provided) {
          existing.cafe_previsto += 1;
          existing.cafe_valor_total += r.cafe_value || 0;
        }
        if (r.almoco_dif_provided) {
          existing.almoco_previsto += 1;
          existing.almoco_valor_total += r.almoco_dif_value || 0;
        }
        if (r.jantar_provided) {
          existing.jantar_previsto += 1;
          existing.jantar_valor_total += r.jantar_value || 0;
        }

        grouped.set(r.employee_id, existing);
      }

      // Upsert one record per employee
      let count = 0;
      for (const [employee_id, sums] of grouped.entries()) {
        // Check if settlement already exists
        const { data: existingRecord } = await supabase
          .from("benefit_settlements")
          .select("id, status")
          .eq("employee_id", employee_id)
          .eq("semana_inicio", semana_inicio)
          .maybeSingle();

        if (existingRecord && existingRecord.status !== "aberto") continue; // Don't overwrite closed/paid

        const avgCafe = sums.cafe_previsto > 0 ? sums.cafe_valor_total / sums.cafe_previsto : 0;
        const avgAlmoco = sums.almoco_previsto > 0 ? sums.almoco_valor_total / sums.almoco_previsto : 0;
        const avgJantar = sums.jantar_previsto > 0 ? sums.jantar_valor_total / sums.jantar_previsto : 0;

        const settlement: BenefitSettlementInsert = {
          employee_id,
          semana_inicio,
          semana_fim,
          cafe_previsto: sums.cafe_previsto,
          cafe_realizado: sums.cafe_previsto, // starts equal, Gerente Operacional edits down
          almoco_previsto: sums.almoco_previsto,
          almoco_realizado: sums.almoco_previsto,
          jantar_previsto: sums.jantar_previsto,
          jantar_realizado: sums.jantar_previsto,
          saldo_desconto: 0, // recalculated on save
          status: "aberto",
          // Store avg values in notes for saldo calculation
          notes: JSON.stringify({ avgCafe, avgAlmoco, avgJantar }),
        };

        if (existingRecord) {
          await supabase.from("benefit_settlements").update(settlement).eq("id", existingRecord.id);
        } else {
          await supabase.from("benefit_settlements").insert(settlement);
        }
        count++;
      }

      return { count };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["benefit-settlements"] });
    },
  });
}

// Update a single settlement's realizado values and recalculate saldo
export function useUpdateBenefitSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      id: string;
      cafe_realizado?: number;
      almoco_realizado?: number;
      jantar_realizado?: number;
      notes?: string;
      // avg values to compute saldo
      avgCafe?: number;
      avgAlmoco?: number;
      avgJantar?: number;
      cafe_previsto?: number;
      almoco_previsto?: number;
      jantar_previsto?: number;
    }) => {
      const cafeDiff = (values.cafe_previsto ?? 0) - (values.cafe_realizado ?? 0);
      const almocoDiff = (values.almoco_previsto ?? 0) - (values.almoco_realizado ?? 0);
      const jantarDiff = (values.jantar_previsto ?? 0) - (values.jantar_realizado ?? 0);

      const saldo_desconto =
        cafeDiff * (values.avgCafe ?? 0) +
        almocoDiff * (values.avgAlmoco ?? 0) +
        jantarDiff * (values.avgJantar ?? 0);

      const { error } = await supabase
        .from("benefit_settlements")
        .update({
          cafe_realizado: values.cafe_realizado,
          almoco_realizado: values.almoco_realizado,
          jantar_realizado: values.jantar_realizado,
          saldo_desconto: Math.max(0, saldo_desconto),
          notes: values.notes,
        })
        .eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["benefit-settlements"] });
    },
  });
}

// Close a whole week (status aberto → fechado) + gera itens de desconto na folha
export function useCloseWeekSettlements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (semana_inicio: string) => {
      // 1. Fechar todos os settlements abertos da semana
      const { error: closeError } = await supabase
        .from("benefit_settlements")
        .update({ status: "fechado" })
        .eq("semana_inicio", semana_inicio)
        .eq("status", "aberto");
      if (closeError) throw closeError;

      // 2. Buscar settlements fechados com saldo > 0
      const { data: settlements, error: fetchError } = await supabase
        .from("benefit_settlements")
        .select("*, employees(name)")
        .eq("semana_inicio", semana_inicio)
        .eq("status", "fechado")
        .gt("saldo_desconto", 0);
      if (fetchError) throw fetchError;
      if (!settlements?.length) return { count: 0, sheetFound: false };

      // 3. Buscar folha de despesas ativa que abranja semana_inicio
      const { data: sheets } = await supabase
        .from("field_expense_sheets")
        .select("id, period_start, period_end, status")
        .lte("period_start", semana_inicio)
        .gte("period_end", semana_inicio)
        .neq("status", "pago")
        .order("period_start", { ascending: false })
        .limit(1);

      const sheet = sheets?.[0] ?? null;
      let count = 0;

      for (const s of settlements) {
        // 4. Se existe folha compatível, inserir item de desconto negativo
        if (sheet) {
          // Idempotente: não duplicar se já existe
          const { data: existingItem } = await supabase
            .from("field_expense_items")
            .select("id")
            .eq("sheet_id", sheet.id)
            .eq("employee_id", s.employee_id)
            .eq("expense_type", "Desconto Encontro de Contas")
            .maybeSingle();

          if (!existingItem) {
            const descricao = `Desconto encontro de contas — semana ${semana_inicio}: R$${Number(s.saldo_desconto).toFixed(2).replace(".", ",")}`;
            await supabase.from("field_expense_items").insert({
              sheet_id: sheet.id,
              employee_id: s.employee_id,
              project_id: null,
              expense_type: "Desconto Encontro de Contas",
              nature: "desconto",
              item_type: "funcionario",
              value: -Math.abs(s.saldo_desconto),
              description: descricao,
              payment_status: "aprovado",
              fiscal_alert: false,
            });
          }

          // 5. Vincular settlement à folha (rastreabilidade)
          await supabase
            .from("benefit_settlements")
            .update({ sheet_id: sheet.id })
            .eq("id", s.id);
        }
        count++;
      }

      return { count, sheetFound: !!sheet };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["benefit-settlements"] });
      qc.invalidateQueries({ queryKey: ["expense-sheets"] });
      qc.invalidateQueries({ queryKey: ["expense-items"] });
    },
  });
}

// Mark a week as descontado (applied to payroll)
export function useMarkSettlementsDescontado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (semana_inicio: string) => {
      const { error } = await supabase
        .from("benefit_settlements")
        .update({ status: "descontado" })
        .eq("semana_inicio", semana_inicio)
        .eq("status", "fechado");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["benefit-settlements"] });
    },
  });
}
