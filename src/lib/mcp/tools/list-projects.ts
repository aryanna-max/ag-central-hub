import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "Listar projetos",
  description: "Lista projetos do sistema AG, com filtro opcional por texto (nome/código) e por status de execução.",
  inputSchema: {
    search: z.string().trim().optional().describe("Texto para buscar em nome ou código do projeto."),
    execution_status: z.string().trim().optional().describe("Filtra por execution_status exato (ex: em_campo, entregue, faturamento)."),
    limit: z.number().int().min(1).max(100).default(20).describe("Máximo de projetos retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, execution_status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("projects")
      .select("id, codigo, name, service, status, execution_status, contract_value, client_id, delivery_deadline")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search) query = query.or(`name.ilike.%${search}%,codigo.ilike.%${search}%`);
    if (execution_status) query = query.eq("execution_status", execution_status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});
