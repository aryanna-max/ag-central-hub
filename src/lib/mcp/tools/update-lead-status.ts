import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_lead_status",
  title: "Mover lead no funil",
  description:
    "Move um lead para outro status do funil comercial. Use ao confirmar contato, envio de proposta, negociação, perda ou descarte. " +
    "Perda e descarte exigem motivo. " +
    "Para transformar lead em projeto use o fluxo de conversão — o status convertido não se digita.",
  inputSchema: {
    lead_id: z.string().uuid().describe("UUID do lead, obtido em list_leads."),
    novo_status: z
      .enum([
        "novo",
        "em_contato",
        "qualificado",
        "proposta_enviada",
        "em_negociacao",
        "aprovado",
        "perdido",
        "descartado",
      ])
      .describe("Novo status do funil. 'convertido' não entra aqui — é resultado da conversão em projeto."),
    observacao: z.string().trim().optional()
      .describe("Motivo/observação. Obrigatório em 'perdido' e 'descartado'."),
    origem_ref: z.string().trim().optional()
      .describe("Documento que justificou a mudança (Message-ID do e-mail, caminho no Drive)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id, novo_status, observacao, origem_ref }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_update_lead_status", {
      p_lead_id: lead_id,
      p_novo_status: novo_status,
      p_observacao: observacao ?? null,
      p_origem_ref: origem_ref ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
