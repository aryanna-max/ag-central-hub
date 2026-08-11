import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "resolve_alert",
  title: "Resolver alerta",
  description:
    "Dá baixa em um alerta do Radar depois que a ação foi executada. Exige descrever o que foi feito. " +
    "Só pode ser usada pelo setor destinatário do alerta (ou diretoria). " +
    "Alerta que pede emissão de nota/recibo não pode ser baixado aqui: registre o título com create_titulo, que o alerta fecha sozinho.",
  inputSchema: {
    alerta_id: z.string().uuid().describe("UUID do alerta, obtido em list_alerts."),
    resolucao: z.string().trim().min(5).describe("O que foi feito para resolver. Vai para o registro de auditoria."),
    origem_ref: z.string().trim().optional()
      .describe("Documento que justificou a baixa (Message-ID do e-mail, caminho no Drive)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ alerta_id, resolucao, origem_ref }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_resolve_alert", {
      p_alert_id: alerta_id,
      p_resolucao: resolucao,
      p_origem_ref: origem_ref ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
