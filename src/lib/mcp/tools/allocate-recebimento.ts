import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "allocate_recebimento",
  title: "Dizer a que nota o dinheiro se refere",
  description:
    "Vincula dinheiro já recebido a um ou mais títulos. " +
    "Use quando o cliente tinha adiantado e a nota saiu depois, ou quando você descobriu a que se referia um crédito antigo. " +
    "Não altera o recebimento nem o título: cria o vínculo, e o saldo se recalcula sozinho. " +
    "Um recebimento só aloca uma vez para cada título — chamar de novo devolve ja_alocado sem duplicar.",
  inputSchema: {
    recebimento_id: z.string().uuid()
      .describe("UUID do recebimento (de register_recebimento ou da consulta de crédito)."),
    alocacoes: z
      .array(z.object({ titulo_id: z.string().uuid(), valor: z.number().positive() }))
      .min(1)
      .describe("Vínculos {titulo_id, valor}. Pelo menos um item."),
    origem_ref: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ recebimento_id, alocacoes, origem_ref }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_allocate_recebimento", {
      p_recebimento_id: recebimento_id,
      p_alocacoes: alocacoes,
      p_origem_ref: origem_ref ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
