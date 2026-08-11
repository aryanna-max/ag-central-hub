import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_client",
  title: "Corrigir cadastro de cliente",
  description:
    "Corrige o cadastro de um cliente existente: razão social (name), CNPJ, tipo (pj/pf) ou segmento. " +
    "O CNPJ é validado pelos dígitos verificadores. " +
    "Se o CNPJ ou o nome normalizado já pertencer a OUTRO cliente, a correção é recusada e a orientação é usar merge_clients (ADR-046) — não duplicar. " +
    "Para razão social: o name é a identidade fiscal do tomador, não o nome do contato.",
  inputSchema: {
    client_id: z.string().uuid().describe("UUID do cliente (de list_clients)."),
    name: z.string().trim().optional().describe("Razão social / nome do cliente."),
    cnpj: z.string().trim().optional().describe("CNPJ. Validado pelos dígitos verificadores."),
    tipo: z.enum(["pj", "pf"]).optional().describe("Pessoa jurídica ou física."),
    segmento: z.string().trim().optional().describe("Segmento do cliente."),
    recarga: z.boolean().optional().describe("Default false. true marca sessão de recarga (Fase 0)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ client_id, name, cnpj, tipo, segmento, recarga }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("fn_update_client", {
      p_client_id: client_id,
      p_name: name ?? null,
      p_cnpj: cnpj ?? null,
      p_tipo: tipo ?? null,
      p_segmento: segmento ?? null,
      p_recarga: recarga ?? false,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { resultado: data },
    };
  },
});
