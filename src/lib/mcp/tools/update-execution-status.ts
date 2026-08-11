import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_execution_status",
  title: "Atualizar status de execução do projeto",
  description:
    "Move o status de execução de um projeto — campo, processamento, revisão, aprovação, entrega. " +
    "Informe data_efetiva com a data real do fato, não a de hoje: é isso que mantém o histórico correto ao registrar acontecimentos passados. " +
    "Voltar para um status anterior é correção e exige motivo. " +
    "faturamento e pago não entram aqui — vêm de create_titulo e do recebimento alocado.",
  inputSchema: {
    projeto_codigo: z.string().trim().min(1).describe("Código do projeto."),
    novo_status: z
      .enum([
        "aguardando_campo",
        "em_campo",
        "campo_concluido",
        "aguardando_processamento",
        "em_processamento",
        "revisao",
        "aprovado",
        "entregue",
      ])
      .describe("Novo status de execução. 'faturamento' e 'pago' não entram aqui."),
    data_efetiva: z.string().trim().optional()
      .describe("Data real do fato (ISO). Default hoje; futuro é recusado."),
    motivo: z.string().trim().optional().describe("Obrigatório em retrocesso (voltar a status anterior)."),
    origem_ref: z.string().trim().optional(),
    recarga: z.boolean().optional()
      .describe("Default false. true suprime alertas/e-mails automáticos (Fase 0 de recarga)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ projeto_codigo, novo_status, data_efetiva, motivo, origem_ref, recarga }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_update_execution_status", {
      p_projeto_codigo: projeto_codigo,
      p_novo_status: novo_status,
      p_data_efetiva: data_efetiva ?? null,
      p_motivo: motivo ?? null,
      p_origem_ref: origem_ref ?? null,
      p_recarga: recarga ?? false,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
