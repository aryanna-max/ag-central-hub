import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_project",
  title: "Cadastrar projeto",
  description:
    "Cadastra um projeto diretamente — caminho de exceção/backfill para demanda já contratada fora do sistema (o fluxo normal é converter um lead). " +
    "client_id é obrigatório: cliente é o centro, projeto não nasce solto. " +
    "O código é gerado como ANO-SIGLA-SEQ (ex.: 2026-VIM-002), a partir da sigla do cliente; se o cliente não tem sigla, cadastre-a antes. " +
    "Valor entre 0 e 100 é recusado como provável erro de escala; se for real, use permitir_valor_baixo=true.",
  inputSchema: {
    client_id: z.string().uuid().describe("UUID do cliente dono do projeto (de list_clients). Obrigatório."),
    name: z.string().trim().min(1).describe("Nome do projeto."),
    empresa_faturadora: z.enum(["ag_topografia", "ag_cartografia"])
      .describe("PJ emissora. ag_topografia = GONZAGA E BERLIM (16.841.054/0001-10); ag_cartografia = AG CARTOGRAFIA (48.282.440/0001-05)."),
    ano: z.number().int().optional().describe("Ano do código. Default: ano corrente."),
    contract_value: z.number().optional().describe("Valor do contrato. Negativo é recusado."),
    billing_type: z.enum(["entrega_nf", "medicao_mensal", "entrega_recibo"]).optional()
      .describe("Modelo de faturamento."),
    tipo_documento: z.enum(["nota_fiscal", "recibo"]).optional()
      .describe("Tipo de documento. Default nota_fiscal."),
    cnpj_tomador: z.string().trim().optional().describe("CNPJ do tomador. Validado pelos dígitos verificadores."),
    service: z.string().trim().optional().describe("Serviço/escopo resumido."),
    permitir_valor_baixo: z.boolean().optional()
      .describe("Default false. true libera valor entre 0 e 100."),
    recarga: z.boolean().optional().describe("Default false. true marca sessão de recarga (Fase 0)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (
    { client_id, name, empresa_faturadora, ano, contract_value, billing_type, tipo_documento, cnpj_tomador, service, permitir_valor_baixo, recarga },
    ctx,
  ) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_create_project", {
      p_client_id: client_id,
      p_name: name,
      p_empresa_faturadora: empresa_faturadora,
      p_ano: ano ?? null,
      p_contract_value: contract_value ?? null,
      p_billing_type: billing_type ?? null,
      p_tipo_documento: tipo_documento ?? null,
      p_cnpj_tomador: cnpj_tomador ?? null,
      p_service: service ?? null,
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
