import type { AlertInsert } from "@/hooks/useAlerts";
import { EXEC_STATUS_LABELS } from "@/lib/statusConstants";

interface ProjectInfo {
  id: string;
  codigo?: string | null;
  name: string;
  client_name?: string | null;
  billing_type?: string | null;
  contract_value?: number | null;
}

/**
 * Retorna alertas que devem ser criados quando execution_status muda.
 * Função pura — chamador é responsável por inserir no banco.
 */
export function getExecutionStatusAlerts(
  fromStatus: string,
  toStatus: string,
  project: ProjectInfo,
): AlertInsert[] {
  const label = project.codigo || project.name;
  const alerts: AlertInsert[] = [];

  // Sala Técnica: campo finalizado ou aguardando processamento
  if (toStatus === "campo_concluido" || toStatus === "aguardando_processamento") {
    alerts.push({
      alert_type: "campo_concluido",
      priority: "importante",
      recipient: "sala_tecnica",
      title: `Projeto ${label} — ${EXEC_STATUS_LABELS[toStatus] || toStatus}`,
      message: `Projeto ${project.name} mudou de ${EXEC_STATUS_LABELS[fromStatus] || fromStatus} para ${EXEC_STATUS_LABELS[toStatus] || toStatus}. Distribuir para processamento.`,
      reference_type: "project",
      reference_id: project.id,
    });
  }

  // Financeiro: projeto entregue
  if (toStatus === "entregue") {
    alerts.push({
      alert_type: "projeto_entregue",
      priority: "importante",
      recipient: "financeiro",
      title: `Projeto ${label} entregue — iniciar faturamento`,
      message: `Projeto ${project.name} do cliente ${project.client_name || "—"} foi entregue. Billing: ${project.billing_type || "não definido"}.`,
      reference_type: "project",
      reference_id: project.id,
    });
  }

  // Financeiro: pagamento confirmado
  if (toStatus === "pago") {
    const valor = project.contract_value
      ? `R$ ${project.contract_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "não informado";
    alerts.push({
      alert_type: "projeto_pago",
      priority: "importante",
      recipient: "financeiro",
      title: `Pagamento confirmado — ${label}`,
      message: `Conferir conta bancária. Valor: ${valor}.`,
      reference_type: "project",
      reference_id: project.id,
    });
  }

  return alerts;
}
