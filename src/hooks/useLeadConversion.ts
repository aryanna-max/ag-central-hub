import { useCreateProject } from "./useProjects";
import { useCreateAlerts, type AlertInsert } from "./useAlerts";
import type { Lead } from "./useLeads";

export function useLeadConversion() {
  const createProject = useCreateProject();
  const createAlerts = useCreateAlerts();

  const convertLead = async (lead: Lead) => {
    // Create project from lead
    const project = await createProject.mutateAsync({
      name: lead.company || lead.name,
      client: lead.company || lead.name,
      client_cnpj: lead.cnpj,
      service: lead.servico,
      contract_value: lead.valor,
      responsible_id: lead.responsible_id,
      lead_id: lead.id,
      status: "planejamento",
      execution_status: "aguardando_processamento",
    });

    // Create 3 alerts
    const valorFormatted = lead.valor
      ? `R$ ${lead.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "Não informado";

    const clientName = lead.company || lead.name;

    const alerts: AlertInsert[] = [
      {
        alert_type: "novo_projeto",
        priority: "importante",
        recipient: "financeiro",
        title: `Novo projeto — ${clientName}`,
        message: "Proposta convertida. Cadastrar condições de faturamento e data prevista de NF.",
        reference_type: "project",
        reference_id: project.id,
      },
      {
        alert_type: "novo_projeto",
        priority: "importante",
        recipient: "operacional",
        title: `Nova obra aprovada — ${clientName}`,
        message: "Iniciar planejamento de equipe, logística e escala.",
        reference_type: "project",
        reference_id: project.id,
      },
      {
        alert_type: "novo_projeto",
        priority: "informacao",
        recipient: "diretoria",
        title: `Projeto criado — ${clientName}`,
        message: `Valor: ${valorFormatted}. Status: Planejamento.`,
        reference_type: "project",
        reference_id: project.id,
      },
      {
        alert_type: "novo_projeto",
        priority: "importante",
        recipient: "sala_tecnica",
        title: `Novo projeto — ${clientName}`,
        message: `Projeto criado. Preparar para recebimento.`,
        reference_type: "project",
        reference_id: project.id,
      },
    ];

    await createAlerts.mutateAsync(alerts);
    return project;
  };

  return {
    convertLead,
    isPending: createProject.isPending || createAlerts.isPending,
  };
}
