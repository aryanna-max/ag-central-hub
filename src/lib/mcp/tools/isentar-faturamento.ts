import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "isentar_faturamento",
  title: "Isentar projeto de faturamento (doação / cortesia)",
  description:
    "Registra que um projeto foi executado sem contrapartida financeira — doação ou cortesia. " +
    "Marca billing_type = sem_faturamento com motivo e autorização gravados. " +
    "Só master ou diretor: renunciar receita é decisão de diretoria, não operação do Financeiro. " +
    "Recusa se o projeto já tiver título emitido — doação não convive com documento fiscal. " +
    "NÃO baixa o alerta de entrega: depois desta chamada, use resolve_alert descrevendo a resolução.",
  inputSchema: {
    projeto_codigo: z.string().trim().min(1).describe("Código do projeto, ex.: 2026-HCA-001."),
    motivo: z.string().trim().min(10)
      .describe(
        "Por que o projeto não gera faturamento. Mínimo 10 caracteres. " +
        'Ex.: "Doação institucional a Henrique Camara, autorizada pela diretoria em 19/08/2026."',
      ),
    origem_ref: z.string().trim().optional()
      .describe("Documento que justificou a decisão (Message-ID do e-mail, caminho no Drive, número do ADR)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ projeto_codigo, motivo, origem_ref }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_isentar_faturamento_projeto", {
      p_projeto_codigo: projeto_codigo,
      p_motivo: motivo,
      p_origem_ref: origem_ref ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
