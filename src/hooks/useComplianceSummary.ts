import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Severity = "ok" | "alerta" | "critico";

type DocType = Database["public"]["Enums"]["doc_type"];
type DocStatus = Database["public"]["Enums"]["doc_status"];

export const EMPRESA_LABELS: Record<string, string> = {
  gonzaga_berlim: "Gonzaga & Berlim",
  ag_cartografia: "AG Cartografia",
};

export interface CompanyVencimento {
  id: string;
  empresa: string;
  doc_type: DocType;
  expiry_date: string | null;
  doc_status: DocStatus;
  days_until: number | null;
}

export type VencimentoOrigem = "empresa" | "funcionario" | "integracao";

export interface VencimentoUnificado {
  id: string;
  origem: VencimentoOrigem;
  doc_type: DocType | null;
  expiry_date: string;
  days_until: number;
  empresa?: string;
  funcionario_nome?: string;
  funcionario_matricula?: string | null;
  cliente_nome?: string;
}

export interface TarefaAtrasadaItem {
  id: string;
  task_title: string;
  cliente_nome: string | null;
  due_date: string;
  days_overdue: number;
  reference_month: number;
  reference_year: number;
}

export interface ComplianceSummary {
  empresa: {
    total: number;
    vencidos: number;
    vencendo30d: number;
    proximosVencimentos: CompanyVencimento[];
  };
  funcionarios: { total: number; vencidos: number; vencendo30d: number };
  integracoesCliente: { total: number; vencidas: number; vencendo30d: number };
  tarefasMensais: { pendentes: number; proximas7d: number };
  semaforo: {
    empresa: Severity;
    funcionarios: Severity;
    integracoes: Severity;
    tarefas: Severity;
  };
  /** Flat list of all 0-90d expirations across origens, ordered by expiry asc. */
  vencimentos: VencimentoUnificado[];
  /** Overdue task executions (due_date < today and not completed). */
  tarefasAtrasadas: TarefaAtrasadaItem[];
}

type CompanyDocRow = Pick<
  Database["public"]["Tables"]["company_documents"]["Row"],
  "id" | "empresa" | "doc_type" | "doc_status" | "expiry_date"
>;

type EmployeeDocJoined = Pick<
  Database["public"]["Tables"]["employee_documents"]["Row"],
  "id" | "doc_type" | "doc_status" | "expiry_date"
> & {
  employees: { name: string | null; matricula: string | null } | null;
};

type IntegrationJoined = Pick<
  Database["public"]["Tables"]["employee_client_integrations"]["Row"],
  "id" | "status" | "expiry_date"
> & {
  employees: { name: string | null; matricula: string | null } | null;
  clients: { name: string | null } | null;
};

type ExecutionJoined = Pick<
  Database["public"]["Tables"]["compliance_task_executions"]["Row"],
  "id" | "due_date" | "completed_at" | "reference_month" | "reference_year"
> & {
  monthly_compliance_tasks: {
    title: string | null;
    clients: { name: string | null } | null;
  } | null;
};

function classifyDocs(vencidos: number, vencendo30d: number): Severity {
  if (vencidos > 0 || vencendo30d > 5) return "critico";
  if (vencendo30d > 0) return "alerta";
  return "ok";
}

function classifyTarefas(pendentes: number, proximas7d: number): Severity {
  if (pendentes > 0 || proximas7d > 5) return "critico";
  if (proximas7d > 0) return "alerta";
  return "ok";
}

export function useComplianceSummary() {
  return useQuery<ComplianceSummary>({
    queryKey: ["compliance-summary"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString().slice(0, 10);

      const [companyRes, empDocRes, integRes, execRes] = await Promise.all([
        supabase
          .from("company_documents")
          .select("id, empresa, doc_type, doc_status, expiry_date")
          .order("expiry_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("employee_documents")
          .select("id, doc_type, doc_status, expiry_date, employees(name, matricula)")
          .order("expiry_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("employee_client_integrations")
          .select(
            "id, status, expiry_date, employees(name, matricula), clients(name)",
          )
          .order("expiry_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("compliance_task_executions")
          .select(
            "id, due_date, completed_at, reference_month, reference_year, monthly_compliance_tasks(title, clients(name))",
          )
          .is("completed_at", null),
      ]);

      if (companyRes.error) throw companyRes.error;
      if (empDocRes.error) throw empDocRes.error;
      if (integRes.error) throw integRes.error;
      if (execRes.error) throw execRes.error;

      const companyRows = (companyRes.data ?? []) as CompanyDocRow[];
      const empDocRows = (empDocRes.data ?? []) as unknown as EmployeeDocJoined[];
      const integRows = (integRes.data ?? []) as unknown as IntegrationJoined[];
      const execRows = (execRes.data ?? []) as unknown as ExecutionJoined[];

      const dayDiff = (iso: string | null): number | null => {
        if (!iso) return null;
        return differenceInCalendarDays(parseISO(iso), today);
      };
      const isVencido = (n: number | null) => n !== null && n < 0;
      const isVencendo30 = (n: number | null) => n !== null && n >= 0 && n <= 30;

      // ── empresa ─────────────────────────────────────────────────────────
      const companyVencidos = companyRows.filter((r) => isVencido(dayDiff(r.expiry_date))).length;
      const companyVencendo = companyRows.filter((r) => isVencendo30(dayDiff(r.expiry_date))).length;
      const proximosVencimentos: CompanyVencimento[] = companyRows
        .filter((r) => r.expiry_date !== null)
        .slice(0, 10)
        .map((r) => ({
          id: r.id,
          empresa: r.empresa,
          doc_type: r.doc_type,
          expiry_date: r.expiry_date,
          doc_status: r.doc_status,
          days_until: dayDiff(r.expiry_date),
        }));

      // ── funcionarios ────────────────────────────────────────────────────
      const empVencidos = empDocRows.filter((r) => isVencido(dayDiff(r.expiry_date))).length;
      const empVencendo = empDocRows.filter((r) => isVencendo30(dayDiff(r.expiry_date))).length;

      // ── integracoes ─────────────────────────────────────────────────────
      const intVencidas = integRows.filter((r) => isVencido(dayDiff(r.expiry_date))).length;
      const intVencendo = integRows.filter((r) => isVencendo30(dayDiff(r.expiry_date))).length;

      // ── tarefas mensais ─────────────────────────────────────────────────
      const todayDate = today;
      const in7 = new Date(todayDate);
      in7.setDate(in7.getDate() + 7);
      const in7Iso = in7.toISOString().slice(0, 10);

      const tarefasPendentes = execRows.filter((e) => e.due_date < todayIso).length;
      const tarefasProximas7d = execRows.filter(
        (e) => e.due_date >= todayIso && e.due_date <= in7Iso,
      ).length;

      // ── flat vencimentos (0-90d) for Radar / Pendencias ────────────────
      const vencimentos: VencimentoUnificado[] = [];
      for (const r of companyRows) {
        const d = dayDiff(r.expiry_date);
        if (d === null || d > 90 || !r.expiry_date) continue;
        vencimentos.push({
          id: r.id,
          origem: "empresa",
          doc_type: r.doc_type,
          expiry_date: r.expiry_date,
          days_until: d,
          empresa: r.empresa,
        });
      }
      for (const r of empDocRows) {
        const d = dayDiff(r.expiry_date);
        if (d === null || d > 90 || !r.expiry_date) continue;
        vencimentos.push({
          id: r.id,
          origem: "funcionario",
          doc_type: r.doc_type,
          expiry_date: r.expiry_date,
          days_until: d,
          funcionario_nome: r.employees?.name ?? "—",
          funcionario_matricula: r.employees?.matricula ?? null,
        });
      }
      for (const r of integRows) {
        const d = dayDiff(r.expiry_date);
        if (d === null || d > 90 || !r.expiry_date) continue;
        vencimentos.push({
          id: r.id,
          origem: "integracao",
          doc_type: null,
          expiry_date: r.expiry_date,
          days_until: d,
          funcionario_nome: r.employees?.name ?? "—",
          funcionario_matricula: r.employees?.matricula ?? null,
          cliente_nome: r.clients?.name ?? "—",
        });
      }
      vencimentos.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

      // ── tarefas atrasadas ───────────────────────────────────────────────
      const tarefasAtrasadas: TarefaAtrasadaItem[] = execRows
        .filter((e) => e.due_date < todayIso)
        .map((e) => ({
          id: e.id,
          task_title: e.monthly_compliance_tasks?.title ?? "—",
          cliente_nome: e.monthly_compliance_tasks?.clients?.name ?? null,
          due_date: e.due_date,
          days_overdue: -differenceInCalendarDays(parseISO(e.due_date), today),
          reference_month: e.reference_month,
          reference_year: e.reference_year,
        }))
        .sort((a, b) => b.days_overdue - a.days_overdue);

      return {
        empresa: {
          total: companyRows.length,
          vencidos: companyVencidos,
          vencendo30d: companyVencendo,
          proximosVencimentos,
        },
        funcionarios: {
          total: empDocRows.length,
          vencidos: empVencidos,
          vencendo30d: empVencendo,
        },
        integracoesCliente: {
          total: integRows.length,
          vencidas: intVencidas,
          vencendo30d: intVencendo,
        },
        tarefasMensais: {
          pendentes: tarefasPendentes,
          proximas7d: tarefasProximas7d,
        },
        semaforo: {
          empresa: classifyDocs(companyVencidos, companyVencendo),
          funcionarios: classifyDocs(empVencidos, empVencendo),
          integracoes: classifyDocs(intVencidas, intVencendo),
          tarefas: classifyTarefas(tarefasPendentes, tarefasProximas7d),
        },
        vencimentos,
        tarefasAtrasadas,
      };
    },
  });
}
