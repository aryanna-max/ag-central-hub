import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "register_recebimento",
  title: "Registrar dinheiro que entrou",
  description:
    "Registra um recebimento: dinheiro que entrou na conta, do cliente X, no dia D. " +
    "O recebimento pertence ao cliente, não a uma nota — por isso funciona mesmo quando o cliente adianta antes de a nota existir, " +
    "ou paga um valor que não corresponde a título nenhum. " +
    "Se você sabe a que título(s) o dinheiro se refere, informe em alocacoes; o que sobrar fica como crédito do cliente e pode ser abatido depois com allocate_recebimento. " +
    "Se não sabe, não invente: registre sem alocação. " +
    "referencia_pagamento é a linha do extrato ou o identificador do comprovante — é ela que impede que o mesmo crédito entre duas vezes. " +
    "Título não se marca como pago: ele fica quitado sozinho quando a soma das alocações cobre o valor.",
  inputSchema: {
    cliente_id: z.string().uuid().describe("UUID do cliente (de list_clients). Dinheiro sem dono não entra."),
    valor: z.number().positive().describe("O que caiu na conta."),
    data_recebimento: z.string().trim().describe("Data real do crédito (ISO). Futuro é recusado."),
    referencia_pagamento: z.string().trim().min(1)
      .describe("Linha do extrato / identificador do comprovante. Única no sistema — trava de dupla baixa."),
    empresa_recebedora: z.enum(["ag_topografia", "ag_cartografia"])
      .describe("Em qual PJ o dinheiro caiu. ag_topografia = GONZAGA E BERLIM (16.841.054/0001-10); ag_cartografia = AG CARTOGRAFIA (48.282.440/0001-05)."),
    alocacoes: z
      .array(z.object({ titulo_id: z.string().uuid(), valor: z.number().positive() }))
      .optional()
      .describe("Vínculos {titulo_id, valor}. Vazio ⇒ crédito puro (adiantamento)."),
    conta: z.string().trim().optional().describe("Bradesco, BB Gonzaga, BB Cartografia."),
    origem_ref: z.string().trim().optional().describe("Extrato/comprovante de origem."),
    observacoes: z.string().trim().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (
    { cliente_id, valor, data_recebimento, referencia_pagamento, empresa_recebedora, alocacoes, conta, origem_ref, observacoes },
    ctx,
  ) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_register_recebimento", {
      p_cliente_id: cliente_id,
      p_valor: valor,
      p_data_recebimento: data_recebimento,
      p_referencia_pagamento: referencia_pagamento,
      p_empresa_recebedora: empresa_recebedora,
      p_alocacoes: alocacoes ?? [],
      p_conta: conta ?? null,
      p_origem_ref: origem_ref ?? null,
      p_observacoes: observacoes ?? null,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
