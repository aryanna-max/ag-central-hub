import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_project",
  title: "Detalhe do projeto",
  description: "Retorna os dados completos de um projeto pelo código (ex: 2026-AGT-001) ou pelo id.",
  inputSchema: {
    codigo: z.string().trim().optional().describe("Código do projeto."),
    id: z.string().uuid().optional().describe("UUID do projeto."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ codigo, id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    if (!codigo && !id) {
      return { content: [{ type: "text", text: "Informe codigo ou id." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("projects").select("*").limit(1);
    query = id ? query.eq("id", id) : query.eq("codigo", codigo!);
    const { data, error } = await query.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Projeto não encontrado." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { project: data },
    };
  },
});
