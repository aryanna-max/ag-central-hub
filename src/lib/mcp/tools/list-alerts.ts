import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_alerts",
  title: "Listar alertas",
  description: "Lista alertas do sistema (pendentes por padrão), com filtro por prioridade.",
  inputSchema: {
    only_unresolved: z.boolean().default(true).describe("Se true, retorna apenas alertas não resolvidos."),
    priority: z.enum(["urgente", "importante", "informacao"]).optional(),
    limit: z.number().int().min(1).max(100).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_unresolved, priority, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("alerts")
      .select("id, title, message, priority, alert_type, reference_type, reference_id, action_url, resolved, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (only_unresolved !== false) query = query.eq("resolved", false);
    if (priority) query = query.eq("priority", priority);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { alerts: data ?? [] },
    };
  },
});
