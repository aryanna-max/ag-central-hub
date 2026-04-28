import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MDRStatus = "rascunho" | "revisado" | "enviado" | "aplicado";

export type MonthlyDiscountReport = {
  id: string;
  payroll_period_id: string | null;
  employee_id: string;
  year: number;
  month: number;
  alelo_dias_uteis: number;
  alelo_dias_ausente: number;
  alelo_dias_feriado: number;
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
  status: MDRStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employees?: {
    name: string;
    matricula: string | null;
    transporte_tipo: string | null;
    empresa_contratante: string | null;
    salario_base: number | null;
    cpf: string | null;
  } | null;
};

const ALELO_DIA = 15.0;
const VT_DIA = 9.0; // 2 viagens x R$4,50

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${pad2(month)}-${pad2(d.getDate())}`;
}

function countBusinessDays(year: number, month: number): number {
  const last = new Date(year, month, 0).getDate();
  let n = 0;
  for (let day = 1; day <= last; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

export function useMonthlyDiscountReports(year: number, month: number) {
  return useQuery({
    queryKey: ["monthly-discount-reports", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_discount_reports")
        .select("*, employees(name, matricula, transporte_tipo, empresa_contratante, salario_base, cpf)")
        .eq("year", year)
        .eq("month", month)
        .order("employee_id");
      if (error) throw error;
      return (data ?? []) as MonthlyDiscountReport[];
    },
  });
}

/**
 * Gera (ou regenera) monthly_discount_reports para todos os funcionarios
 * ativos em uma competencia. Calcula Alelo (R$15/dia util - ausencias) e
 * VT baseado em transporte_tipo, com desconto 6% do salario para vt_cartao
 * quando nao isento.
 */
export function useGenerateMonthlyReports() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { year: number; month: number }) => {
      const { year, month } = values;
      const monthStart = firstDayOfMonth(year, month);
      const monthEnd = lastDayOfMonth(year, month);
      const diasUteis = countBusinessDays(year, month);

      // 1. Periodo payroll (opcional, para vincular)
      const { data: periodData } = await supabase
        .from("payroll_periods")
        .select("id")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      const payroll_period_id = periodData?.id ?? null;

      // 2. Funcionarios ativos
      const { data: employees, error: empErr } = await supabase
        .from("employees")
        .select("id, name, status, transporte_tipo, salario_base, vt_isento_desconto, has_vt, data_demissao, admission_date")
        .neq("status", "desligado");
      if (empErr) throw empErr;

      if (!employees?.length) return { count: 0 };

      const employeeIds = employees.map((e) => e.id);

      // 3. Presencas do mes
      const { data: records } = await supabase
        .from("employee_daily_records")
        .select("employee_id, schedule_date, attendance, vt_provided")
        .gte("schedule_date", monthStart)
        .lte("schedule_date", monthEnd)
        .in("employee_id", employeeIds);

      // 4. Ferias do mes
      const { data: vacations } = await supabase
        .from("employee_vacations")
        .select("employee_id, start_date, end_date")
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart)
        .in("employee_id", employeeIds);

      // employee_absences foi DROP em 20260422_ferias_cleanup_dados_teste.sql.
      // Mantido bloco morto pra retomar caso tabela volte (improvável). TODO PR2: deletar.
      const absences: { employee_id: string; start_date: string; end_date: string }[] = [];

      // Indexa presencas e campo-distante por funcionario
      type Stat = { presenteCount: number; vtCount: number; campoDistanteCount: number };
      const stats = new Map<string, Stat>();

      for (const r of records ?? []) {
        const existing = stats.get(r.employee_id) ?? { presenteCount: 0, vtCount: 0, campoDistanteCount: 0 };
        const presente = !r.attendance || r.attendance === "presente" || r.attendance === "atrasado";
        if (presente) existing.presenteCount += 1;
        if (r.vt_provided) existing.vtCount += 1;
        else if (presente) existing.campoDistanteCount += 1; // presente mas sem VT = campo distante
        stats.set(r.employee_id, existing);
      }

      // Calcula dias de ausencia (ferias + outras)
      function daysInPeriodIntersect(periodStart: string, periodEnd: string): number {
        const s = new Date(Math.max(new Date(periodStart).getTime(), new Date(monthStart).getTime()));
        const e = new Date(Math.min(new Date(periodEnd).getTime(), new Date(monthEnd).getTime()));
        if (e < s) return 0;
        let n = 0;
        const cur = new Date(s);
        while (cur <= e) {
          const dow = cur.getDay();
          if (dow !== 0 && dow !== 6) n++;
          cur.setDate(cur.getDate() + 1);
        }
        return n;
      }

      const ausencias = new Map<string, number>();
      for (const v of vacations ?? []) {
        const d = daysInPeriodIntersect(v.start_date, v.end_date);
        ausencias.set(v.employee_id, (ausencias.get(v.employee_id) ?? 0) + d);
      }
      for (const a of absences) {
        const d = daysInPeriodIntersect(a.start_date, a.end_date);
        ausencias.set(a.employee_id, (ausencias.get(a.employee_id) ?? 0) + d);
      }

      // Monta linhas
      const rows = employees.map((e) => {
        const stat = stats.get(e.id) ?? { presenteCount: 0, vtCount: 0, campoDistanteCount: 0 };
        const aus = ausencias.get(e.id) ?? 0;

        // ALELO: todos os dias uteis do mes - ausencias = dias com direito
        const aleloDiasComDireito = Math.max(0, diasUteis - aus);
        const aleloValorCheio = diasUteis * ALELO_DIA;
        const aleloDesconto = aus * ALELO_DIA;
        const aleloValorFinal = aleloDiasComDireito * ALELO_DIA;

        // VT: depende de transporte_tipo
        const transporteTipo = e.transporte_tipo || (e.has_vt ? "vt_cartao" : "nenhum");
        const isVtCartao = transporteTipo === "vt_cartao";
        const isIsento = !!e.vt_isento_desconto;
        const salario = Number(e.salario_base ?? 0);

        const vtDiasComDireito = isVtCartao ? stat.vtCount : 0;
        const vtValorCheio = isVtCartao ? diasUteis * VT_DIA : 0;
        const vtDescontoAusencias = isVtCartao
          ? (diasUteis - stat.vtCount - stat.campoDistanteCount) * VT_DIA
          : 0;
        const vtDescontoSalario = isVtCartao && !isIsento ? +(salario * 0.06).toFixed(2) : 0;
        const vtValorFinal = isVtCartao
          ? Math.max(0, vtDiasComDireito * VT_DIA - vtDescontoSalario)
          : 0;

        const totalDescontos = aleloDesconto + vtDescontoAusencias + vtDescontoSalario;

        return {
          payroll_period_id,
          employee_id: e.id,
          year,
          month,
          alelo_dias_uteis: diasUteis,
          alelo_dias_ausente: aus,
          alelo_dias_feriado: 0,
          alelo_valor_cheio: aleloValorCheio,
          alelo_desconto: aleloDesconto,
          alelo_valor_final: aleloValorFinal,
          vt_dias_uteis: diasUteis,
          vt_dias_ausente: aus,
          vt_dias_campo_distante: stat.campoDistanteCount,
          vt_dias_dinheiro_integral: 0,
          vt_valor_cheio: vtValorCheio,
          vt_desconto_ausencias: vtDescontoAusencias,
          vt_desconto_salario: vtDescontoSalario,
          vt_valor_final: vtValorFinal,
          vt_isento: isIsento,
          outros_descontos: 0,
          outros_descricao: null,
          total_descontos: totalDescontos,
          status: "rascunho" as MDRStatus,
        };
      });

      // Nao regerar para relatorios ja enviados/aplicados
      const { data: existing } = await supabase
        .from("monthly_discount_reports")
        .select("employee_id, status")
        .eq("year", year)
        .eq("month", month);

      const lockedIds = new Set(
        (existing ?? [])
          .filter((r) => r.status === "enviado" || r.status === "aplicado")
          .map((r) => r.employee_id)
      );
      const rowsToUpsert = rows.filter((r) => !lockedIds.has(r.employee_id));

      if (rowsToUpsert.length === 0) return { count: 0 };

      const { error: upErr } = await supabase
        .from("monthly_discount_reports")
        .upsert(rowsToUpsert, { onConflict: "employee_id,year,month" });
      if (upErr) throw upErr;

      return { count: rowsToUpsert.length };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["monthly-discount-reports", vars.year, vars.month] });
    },
  });
}

export function useUpdateMonthlyDiscountReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<MonthlyDiscountReport> & { id: string }) => {
      const { id, employees: _emp, ...patch } = values;
      const { error } = await supabase
        .from("monthly_discount_reports")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-discount-reports"] }),
  });
}

export function useSetMonthlyDiscountReportsStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { year: number; month: number; status: MDRStatus }) => {
      const { error } = await supabase
        .from("monthly_discount_reports")
        .update({ status: values.status })
        .eq("year", values.year)
        .eq("month", values.month)
        .neq("status", "aplicado");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-discount-reports"] }),
  });
}

/**
 * Gera um CSV no formato que Thyalcont espera:
 * Matricula; Nome; CPF; Empresa; Alelo final; VT final; Desconto VT (6%); Total descontos
 */
export function buildThyalcontCsv(reports: MonthlyDiscountReport[]): string {
  const header = [
    "Matricula",
    "Nome",
    "CPF",
    "Empresa",
    "Alelo Final",
    "VT Final",
    "Desconto VT 6%",
    "Outros Descontos",
    "Total Descontos",
  ].join(";");

  const rows = reports.map((r) => {
    const emp = r.employees;
    const fmt = (v: number | null | undefined) =>
      (v ?? 0).toFixed(2).replace(".", ",");
    return [
      emp?.matricula ?? "",
      emp?.name ?? "",
      emp?.cpf ?? "",
      emp?.empresa_contratante ?? "",
      fmt(r.alelo_valor_final),
      fmt(r.vt_valor_final),
      fmt(r.vt_desconto_salario),
      fmt(r.outros_descontos),
      fmt(r.total_descontos),
    ].join(";");
  });

  return [header, ...rows].join("\n");
}
