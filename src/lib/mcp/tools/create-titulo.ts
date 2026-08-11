import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_titulo",
  title: "Registrar título (NF ou recibo)",
  description:
    "Registra no Financeiro uma nota fiscal ou recibo de um projeto — o título a receber. " +
    "Empresa emissora e CNPJ do tomador vêm do contrato do projeto e do cadastro do cliente; não se escolhe na mão. " +
    "Sem número de nota, o título nasce pendente (a emitir); com número, nasce emitida e o projeto avança para faturamento. " +
    "Se havia alerta pedindo a emissão, ele é resolvido automaticamente. " +
    "origem_ref é obrigatório: identifica o e-mail ou arquivo que originou o lançamento e impede que a mesma nota vire dois títulos.",
  inputSchema: {
    projeto_codigo: z.string().trim().min(1).describe("Código do projeto, ex.: 2026-VIM-002."),
    valor_bruto: z.number().positive().describe("Valor bruto do título."),
    origem_ref: z.string().trim().min(1)
      .describe("Documento de origem (Message-ID do e-mail, caminho no Drive). Chave de idempotência."),
    tipo: z.enum(["nf", "recibo"]).optional()
      .describe("Tipo do documento. Se omitido, usa o tipo do projeto."),
    nf_numero: z.string().trim().optional()
      .describe("Número da nota. Ausente ⇒ título a emitir (pendente)."),
    nf_data: z.string().trim().optional()
      .describe("Data de emissão (ISO, ex.: 2026-05-31). Obrigatória se houver nf_numero."),
    vencimento: z.string().trim().optional()
      .describe("Data de vencimento (ISO). Deixar vazio se não souber — não estimar."),
    retencao: z.number().min(0).optional().describe("Valor da retenção. Default 0."),
    cnpj_tomador: z.string().trim().optional()
      .describe("Apenas para conferência; divergir do cadastro do cliente é erro."),
    observacoes: z.string().trim().optional(),
    recarga: z.boolean().optional()
      .describe("Default false. true suprime alertas/e-mails automáticos (Fase 0 de recarga)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (
    { projeto_codigo, valor_bruto, origem_ref, tipo, nf_numero, nf_data, vencimento, retencao, cnpj_tomador, observacoes, recarga },
    ctx,
  ) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_create_titulo", {
      p_projeto_codigo: projeto_codigo,
      p_valor_bruto: valor_bruto,
      p_origem_ref: origem_ref,
      p_tipo: tipo ?? null,
      p_nf_numero: nf_numero ?? null,
      p_nf_data: nf_data ?? null,
      p_vencimento: vencimento ?? null,
      p_retencao: retencao ?? null,
      p_cnpj_tomador: cnpj_tomador ?? null,
      p_observacoes: observacoes ?? null,
      p_recarga: recarga ?? false,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
