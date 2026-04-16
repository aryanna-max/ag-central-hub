import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Fetch settlements - can filter by semana_inicio, status, or leave open for all
export function useBenefitSettlements(filters?: {
  semana_inicio?: string;
  status?: string;
}) {
  return useQuery({
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
      return data;
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

        const settlement = {
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
          await supabase.from("benefit_settlements").insert(settlement as any);
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

// Close a whole week (status aberto → fechado)
export function useCloseWeekSettlements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (semana_inicio: string) => {
      const { error } = await supabase
        .from("benefit_settlements")
        .update({ status: "fechado" })
        .eq("semana_inicio", semana_inicio)
        .eq("status", "aberto");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["benefit-settlements"] });
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
