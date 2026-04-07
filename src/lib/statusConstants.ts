/**
 * Fonte única de verdade para labels, cores e agrupamentos de status.
 * Todos os módulos devem importar daqui — NÃO definir localmente.
 */

// ─── Execution Status (10 valores) ───

export const EXECUTION_STATUSES = [
  "aguardando_campo",
  "em_campo",
  "campo_concluido",
  "aguardando_processamento",
  "em_processamento",
  "revisao",
  "aprovado",
  "entregue",
  "faturamento",
  "pago",
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const EXEC_STATUS_LABELS: Record<string, string> = {
  aguardando_campo: "Aguardando campo",
  em_campo: "Em campo",
  campo_concluido: "Campo concluído",
  aguardando_processamento: "Aguardando processamento",
  em_processamento: "Em processamento",
  revisao: "Em revisão",
  aprovado: "Aprovado",
  entregue: "Entregue",
  faturamento: "Faturamento",
  pago: "Pago",
};

export const EXEC_STATUS_COLORS: Record<string, string> = {
  aguardando_campo: "bg-gray-100 text-gray-700",
  em_campo: "bg-emerald-100 text-emerald-700",
  campo_concluido: "bg-teal-100 text-teal-700",
  aguardando_processamento: "bg-sky-100 text-sky-700",
  em_processamento: "bg-blue-100 text-blue-700",
  revisao: "bg-indigo-100 text-indigo-700",
  aprovado: "bg-violet-100 text-violet-700",
  entregue: "bg-orange-100 text-orange-700",
  faturamento: "bg-amber-100 text-amber-700",
  pago: "bg-green-100 text-green-700",
};

// ─── Kanban Groups (para Projetos.tsx) ───
// Nota: "campo_concluido" é transitório — projetos auto-avançam para aguardando_processamento.
// Não aparece como coluna fixa no Kanban.

export interface KanbanColumn {
  key: string;
  label: string;
}

export interface KanbanGroup {
  key: string;
  label: string;
  emoji: string;
  borderColor: string;
  columns: KanbanColumn[];
}

export const EXEC_STATUS_GROUPS: KanbanGroup[] = [
  {
    key: "campo",
    label: "Campo",
    emoji: "🏕️",
    borderColor: "border-[#1A9E7C]",
    columns: [
      { key: "aguardando_campo", label: "Aguardando campo" },
      { key: "em_campo", label: "Em campo" },
    ],
  },
  {
    key: "prancheta",
    label: "Prancheta",
    emoji: "📐",
    borderColor: "border-[#2D6E8E]",
    columns: [
      { key: "aguardando_processamento", label: "Aguardando processamento" },
      { key: "em_processamento", label: "Em processamento" },
      { key: "revisao", label: "Em revisão" },
      { key: "aprovado", label: "Aprovado" },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    emoji: "💰",
    borderColor: "border-[#f97316]",
    columns: [
      { key: "entregue", label: "Entregue" },
      { key: "faturamento", label: "Faturamento" },
      { key: "pago", label: "Pago" },
    ],
  },
];

export const ALL_KANBAN_STATUSES = EXEC_STATUS_GROUPS.flatMap((g) => g.columns.map((c) => c.key));

// ─── Project Status (6 valores) ───

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planejamento: "Planejamento",
  execucao: "Execução",
  entrega: "Entrega",
  faturamento: "Faturamento",
  concluido: "Concluído",
  pausado: "Pausado",
};

// ─── Billing Type ───

export const BILLING_LABELS: Record<string, string> = {
  entrega_nf: "NF na entrega",
  entrega_recibo: "Recibo na entrega",
  medicao_mensal: "Medição mensal",
  misto: "Misto",
  sem_documento: "Sem documento",
};

export const BILLING_COLORS: Record<string, string> = {
  entrega_nf: "bg-emerald-100 text-emerald-700",
  entrega_recibo: "bg-emerald-100 text-emerald-700",
  medicao_mensal: "bg-blue-100 text-blue-700",
  misto: "bg-amber-100 text-amber-700",
  sem_documento: "bg-gray-100 text-gray-500",
};

// ─── Chart colors (HSL strings for Recharts) ───

export const EXEC_STATUS_CHART_COLORS: Record<string, string> = {
  aguardando_campo: "hsl(160, 70%, 40%)",
  em_campo: "hsl(160, 60%, 35%)",
  campo_concluido: "hsl(160, 50%, 45%)",
  aguardando_processamento: "hsl(200, 55%, 40%)",
  em_processamento: "hsl(200, 50%, 45%)",
  revisao: "hsl(200, 45%, 50%)",
  aprovado: "hsl(200, 60%, 35%)",
  entregue: "hsl(30, 90%, 50%)",
  faturamento: "hsl(30, 80%, 45%)",
  pago: "hsl(30, 70%, 40%)",
};

// ─── Dashboard Kanban groups (includes campo_concluido for overview) ───

export const DASHBOARD_GROUPS = [
  {
    key: "campo", label: "🏕️ Campo", color: "#1A9E7C",
    columns: ["aguardando_campo", "em_campo"],
  },
  {
    key: "prancheta", label: "📐 Prancheta", color: "#2D6E8E",
    columns: ["aguardando_processamento", "em_processamento", "revisao", "aprovado"],
  },
  {
    key: "financeiro", label: "💰 Financeiro", color: "#f97316",
    columns: ["entregue", "faturamento", "pago"],
  },
] as const;

export const DASHBOARD_ALL_COLUMNS = DASHBOARD_GROUPS.flatMap((g) => g.columns);

// ─── Recurring Billing (Decisão #27) ───
// Contratos recorrentes: execution_status do PROJETO fica em_campo.
// Ciclo financeiro mensal roda na tabela measurements.

export const RECURRING_BILLING_TYPES = ["medicao_mensal", "fixo_mensal"] as const;

export function isRecurringBilling(billingType: string | null | undefined): boolean {
  return RECURRING_BILLING_TYPES.includes(billingType as any);
}

/**
 * Determina se um projeto está "finalizado" para fins de UI (opacity, badges).
 * - Pontual: entregue/faturamento/pago = finalizado
 * - Recorrente: só finalizado quando is_active = false (contrato encerrou)
 */
export const FINALIZED_STATUSES = ["entregue", "faturamento", "pago"] as const;

export function isProjectFinalized(
  executionStatus: string | null | undefined,
  billingType: string | null | undefined,
  isActive?: boolean,
): boolean {
  if (isRecurringBilling(billingType)) {
    return isActive === false;
  }
  return FINALIZED_STATUSES.includes(executionStatus as any);
}

// ─── Measurement Status ───

export const MEASUREMENT_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  nf_emitida: "NF emitida",
  paga: "Paga",
  cancelada: "Cancelada",
};
