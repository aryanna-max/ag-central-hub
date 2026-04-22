import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// =============================================================================
// Hook — Validação docs funcionário × cliente (Gap 5)
// =============================================================================
// Consome RPCs fn_employee_badge_for_project e fn_employees_badges_for_project.
// Badge: verde = OK, amarelo = atenção (vencendo ≤30d), vermelho = bloqueio.
// =============================================================================

export type BadgeColor = "verde" | "amarelo" | "vermelho";

export type ExpiringDoc = {
  type: string;
  expiry_date: string;
  days_left: number;
};

export type EmployeeBadgeData = {
  color: BadgeColor;
  reason: string;
  missing_docs: string[];
  expired_docs: string[];
  expiring_docs: ExpiringDoc[];
  not_integrated: boolean;
  integration_expired: boolean;
  required_docs: string[];
};

// Labels humanizados por tipo de doc — para UI amigável
export const DOC_TYPE_LABELS: Record<string, string> = {
  aso: "ASO",
  nr18: "NR-18",
  nr35: "NR-35",
  nr10: "NR-10",
  nr33: "NR-33",
  ficha_epi: "Ficha EPI",
  integracao_cliente: "Integração cliente",
  ctps: "CTPS",
  rg: "RG",
  cpf: "CPF",
  cnh: "CNH",
  comprovante_residencia: "Comprovante residência",
  certidao_nascimento: "Certidão nascimento",
  titulo_eleitor: "Título eleitor",
  reservista: "Reservista",
  pis: "PIS",
  conta_bancaria: "Conta bancária",
  foto_3x4: "Foto 3x4",
  pcmso: "PCMSO",
  pgr: "PGR",
  seguro_vida: "Seguro vida",
  alvara: "Alvará",
  contrato_social: "Contrato social",
  cnpj_cartao: "Cartão CNPJ",
  crea: "CREA",
};

export function formatDocType(type: string): string {
  return DOC_TYPE_LABELS[type] ?? type.toUpperCase();
}

/**
 * Badge de um funcionário em um projeto específico.
 * Polling 60s — docs podem vencer entre recargas.
 */
export function useEmployeeBadge(
  employeeId: string | null | undefined,
  projectId: string | null | undefined
) {
  return useQuery({
    queryKey: ["employee-badge", employeeId, projectId],
    enabled: !!employeeId && !!projectId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<EmployeeBadgeData> => {
      const { data, error } = await supabase.rpc("fn_employee_badge_for_project", {
        p_employee_id: employeeId!,
        p_project_id: projectId!,
      });
      if (error) throw error;
      return data as EmployeeBadgeData;
    },
  });
}

/**
 * Badges em lote — N funcionários no mesmo projeto.
 * Útil para Kanban/listas: 1 chamada para todos.
 */
export function useEmployeesBadgesForProject(
  employeeIds: string[],
  projectId: string | null | undefined
) {
  return useQuery({
    queryKey: ["employees-badges", projectId, employeeIds.sort().join(",")],
    enabled: !!projectId && employeeIds.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_employees_badges_for_project", {
        p_employee_ids: employeeIds,
        p_project_id: projectId!,
      });
      if (error) throw error;
      // RPC retorna [{ employee_id, badge }]
      const map = new Map<string, EmployeeBadgeData>();
      for (const row of (data ?? []) as Array<{ employee_id: string; badge: EmployeeBadgeData }>) {
        map.set(row.employee_id, row.badge);
      }
      return map;
    },
  });
}

/**
 * Badge resumido — dos N funcionários desta escala, quantos verde/amarelo/vermelho?
 * Útil para dashboard / resumo de escala.
 */
export function summarizeBadges(
  badges: Map<string, EmployeeBadgeData>
): { verde: number; amarelo: number; vermelho: number; total: number } {
  const summary = { verde: 0, amarelo: 0, vermelho: 0, total: 0 };
  for (const b of badges.values()) {
    summary[b.color]++;
    summary.total++;
  }
  return summary;
}
