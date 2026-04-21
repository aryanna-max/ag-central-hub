import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PayrollStatus =
  | "aberto"
  | "escala_fechada"
  | "dp_fechado"
  | "enviado_thyalcont"
  | "pago"
  | "encerrado";

export type PayrollPeriod = {
  id: string;
  year: number;
  month: number;
  competencia_inicio: string;
  competencia_fim: string;
  fechamento_escala: string;
  fechamento_dp: string;
  apresentacao_thyalcont: string;
  data_pagamento: string | null;
  status: PayrollStatus;
  fechado_escala_por: string | null;
  fechado_escala_em: string | null;
  fechado_dp_por: string | null;
  fechado_dp_em: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function lastDayOfMonth(year: number, month: number): string {
  // month is 1-based; last day = day 0 of next month
  const d = new Date(year, month, 0);
  return `${year}-${pad2(month)}-${pad2(d.getDate())}`;
}

/** 5 dia util do mes (considera fds, ignora feriados). */
function fifthBusinessDay(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (count < 5) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    if (count < 5) d.setDate(d.getDate() + 1);
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function defaultPeriodDates(year: number, month: number) {
  const competencia_inicio = `${year}-${pad2(month)}-01`;
  const competencia_fim = lastDayOfMonth(year, month);
  const fechamento_escala = `${year}-${pad2(month)}-26`;
  const fechamento_dp = `${year}-${pad2(month)}-26`;
  const apresentacao_thyalcont = `${year}-${pad2(month)}-28`;
  // Pagamento = 5 dia util do mes seguinte
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const data_pagamento = fifthBusinessDay(nextYear, nextMonth);
  return {
    competencia_inicio,
    competencia_fim,
    fechamento_escala,
    fechamento_dp,
    apresentacao_thyalcont,
    data_pagamento,
  };
}

export function usePayrollPeriods(year?: number) {
  return useQuery({
    queryKey: ["payroll-periods", year],
    queryFn: async () => {
      let q = (supabase as any)
        .from("payroll_periods")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: true });
      if (year) q = q.eq("year", year);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PayrollPeriod[];
    },
  });
}

export function useCurrentPayrollPeriod() {
  return useQuery({
    queryKey: ["payroll-period-current"],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await (supabase as any)
        .from("payroll_periods")
        .select("*")
        .eq("year", now.getFullYear())
        .eq("month", now.getMonth() + 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PayrollPeriod | null;
    },
  });
}

export function useCreatePayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { year: number; month: number; notes?: string | null }) => {
      const defaults = defaultPeriodDates(values.year, values.month);
      const { data, error } = await (supabase as any)
        .from("payroll_periods")
        .insert({
          year: values.year,
          month: values.month,
          ...defaults,
          status: "aberto",
          notes: values.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PayrollPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-current"] });
    },
  });
}

export function useUpdatePayrollPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<PayrollPeriod> & { id: string }) => {
      const { id, ...patch } = values;
      const { error } = await (supabase as any)
        .from("payroll_periods")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-current"] });
    },
  });
}

export function useGeneratePayrollYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      // Upsert 12 periodos (idempotente via UNIQUE year,month)
      const rows = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        return {
          year,
          month,
          ...defaultPeriodDates(year, month),
          status: "aberto",
        };
      });
      const { error } = await (supabase as any)
        .from("payroll_periods")
        .upsert(rows, { onConflict: "year,month", ignoreDuplicates: true });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-current"] });
    },
  });
}

export function useCloseEscala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("payroll_periods")
        .update({
          status: "escala_fechada",
          fechado_escala_por: userData.user?.id ?? null,
          fechado_escala_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-current"] });
    },
  });
}

export function useCloseDP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("payroll_periods")
        .update({
          status: "dp_fechado",
          fechado_dp_por: userData.user?.id ?? null,
          fechado_dp_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-current"] });
    },
  });
}

export function useSetPayrollStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { id: string; status: PayrollStatus }) => {
      const { error } = await (supabase as any)
        .from("payroll_periods")
        .update({ status: values.status })
        .eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["payroll-period-current"] });
    },
  });
}
