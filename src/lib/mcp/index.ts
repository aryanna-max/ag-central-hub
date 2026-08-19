import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import listClientsTool from "./tools/list-clients";
import listLeadsTool from "./tools/list-leads";
import createLeadTool from "./tools/create-lead";
import listAlertsTool from "./tools/list-alerts";
import resolveAlertTool from "./tools/resolve-alert";
import updateLeadStatusTool from "./tools/update-lead-status";
import createTituloTool from "./tools/create-titulo";
import registerRecebimentoTool from "./tools/register-recebimento";
import allocateRecebimentoTool from "./tools/allocate-recebimento";
import updateExecutionStatusTool from "./tools/update-execution-status";
import updateProjectTool from "./tools/update-project";
import updateClientTool from "./tools/update-client";
import createClientTool from "./tools/create-client";
import createProjectTool from "./tools/create-project";
import isentarFaturamentoTool from "./tools/isentar-faturamento";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ag-central-flow",
  title: "AG Central Flow",
  version: "0.1.0",
  instructions:
    "Ferramentas do Sistema AG (topografia e cartografia). Consulte projetos, clientes, leads e alertas, e registre novas demandas comerciais como leads. Todas as chamadas rodam como o usuário autenticado, respeitando as permissões dele.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProjectsTool,
    getProjectTool,
    listClientsTool,
    listLeadsTool,
    createLeadTool,
    listAlertsTool,
    resolveAlertTool,
    updateLeadStatusTool,
    createTituloTool,
    registerRecebimentoTool,
    allocateRecebimentoTool,
    updateExecutionStatusTool,
    updateProjectTool,
    updateClientTool,
    createClientTool,
    createProjectTool,
    isentarFaturamentoTool,
  ],
});
