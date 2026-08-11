import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_project",
  title: "Corrigir cadastro de projeto",
  description:
    "Corrige o cadastro de um projeto existente: empresa faturadora, valor de contrato, tipo de documento, tipo de faturamento ou CNPJ do tomador. " +
    "Campo fiscal (empresa_faturadora, cnpj_tomador) só pode ser mexido por master, diretor ou financeiro. " +
    "Trocar a empresa faturadora exige motivo e é bloqueado se o projeto já tem título emitido — ajuste/cancele os títulos antes. " +
    "Valor entre 0 e 100 é recusado como provável erro de escala (o caso VIM 15,75 que era 15.750); se for real mesmo, repita com permitir_valor_baixo=true.",
  inputSchema: {
    project_id: z.string().uuid().describe("UUID do projeto (de list_projects/get_project)."),
    empresa_faturadora: z.enum(["ag_topografia", "ag_cartografia"]).optional()
      .describe("PJ emissora. ag_topografia = GONZAGA E BERLIM (16.841.054/0001-10); ag_cartografia = AG CARTOGRAFIA (48.282.440/0001-05). Campo fiscal."),
    contract_value: z.number().optional().describe("Valor do contrato. Negativo é recusado."),
    tipo_documento: z.enum(["nota_fiscal", "recibo"]).optional()
      .describe("Tipo de documento do projeto."),
    billing_type: z.enum(["entrega_nf", "medicao_mensal", "entrega_recibo"]).optional()
      .describe("Modelo de faturamento."),
    cnpj_tomador: z.string().trim().optional()
      .describe("CNPJ do tomador. Validado pelos dígitos verificadores. Campo fiscal."),
    motivo: z.string().trim().optional()
      .describe("Obrigatório ao trocar empresa_faturadora."),
    permitir_valor_baixo: z.boolean().optional()
      .describe("Default false. true libera valor entre 0 e 100 (confirma que não é erro de escala)."),
    recarga: z.boolean().optional()
      .describe("Default false. true marca sessão de recarga (Fase 0)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (
    { project_id, empresa_faturadora, contract_value, tipo_documento, billing_type, cnpj_tomador, motivo, permitir_valor_baixo, recarga },
    ctx,
  ) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_update_project", {
      p_project_id: project_id,
      p_empresa_faturadora: empresa_faturadora ?? null,
      p_contract_value: contract_value ?? null,
      p_tipo_documento: tipo_documento ?? null,
      p_billing_type: billing_type ?? null,
      p_cnpj_tomador: cnpj_tomador ?? null,
      p_motivo: motivo ?? null,
      p_permitir_valor_baixo: permitir_valor_baixo ?? false,
      p_recarga: recarga ?? false,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
