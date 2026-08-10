import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import listClientsTool from "./tools/list-clients";
import listLeadsTool from "./tools/list-leads";
import createLeadTool from "./tools/create-lead";
import listAlertsTool from "./tools/list-alerts";

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
  ],
});
