import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_client",
  title: "Cadastrar cliente",
  description:
    "Cadastra um novo cliente. É o freio anti-duplicidade (caso POLIMIX): recusa se o CNPJ já existe OU se o nome normalizado (sem acento/pontuação/maiúsculas) equivale a outro cliente. " +
    "Se for filial/SPE de um grupo já cadastrado, informe parent_client_id e um nome distinto (ex.: com a razão social da filial) em vez de repetir a matriz. " +
    "A sigla (codigo) tem 3 letras; se não informar, o sistema deriva uma sigla livre do nome. " +
    "O CNPJ é validado pelos dígitos verificadores.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Razão social / nome do cliente."),
    cnpj: z.string().trim().optional().describe("CNPJ. Validado pelos dígitos verificadores. Recusa se já cadastrado."),
    tipo: z.enum(["pj", "pf"]).optional().describe("Pessoa jurídica ou física."),
    segmento: z.string().trim().optional().describe("Segmento do cliente."),
    codigo: z.string().trim().optional().describe("Sigla de 3 letras (A-Z). Se omitida, o sistema deriva uma livre do nome."),
    parent_client_id: z.string().uuid().optional().describe("UUID da matriz, para filial/SPE de um grupo já cadastrado."),
    recarga: z.boolean().optional().describe("Default false. true marca sessão de recarga (Fase 0)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ name, cnpj, tipo, segmento, codigo, parent_client_id, recarga }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_create_client", {
      p_name: name,
      p_cnpj: cnpj ?? null,
      p_tipo: tipo ?? null,
      p_segmento: segmento ?? null,
      p_codigo: codigo ?? null,
      p_parent_client_id: parent_client_id ?? null,
      p_recarga: recarga ?? false,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
