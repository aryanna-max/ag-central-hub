import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "Listar clientes",
  description: "Lista clientes cadastrados, com busca opcional por nome, código de 3 letras ou CNPJ.",
  inputSchema: {
    search: z.string().trim().optional().describe("Texto para buscar em nome, código ou CNPJ."),
    limit: z.number().int().min(1).max(100).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("clients")
      .select("id, codigo, name, cnpj, tipo, segmento, cidade, estado, is_active")
      .order("name")
      .limit(limit ?? 20);
    if (search) query = query.or(`name.ilike.%${search}%,codigo.ilike.%${search}%,cnpj.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { clients: data ?? [] },
    };
  },
});
