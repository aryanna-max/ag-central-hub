import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_lead",
  title: "Registrar lead",
  description: "Registra uma nova demanda comercial como lead no CRM (regra: toda demanda de entrada vira lead).",
  inputSchema: {
    name: z.string().trim().min(1).describe("Nome do contato ou da demanda."),
    company: z.string().trim().optional().describe("Empresa do contato."),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().optional(),
    servico: z.string().trim().optional().describe("Serviço solicitado."),
    location: z.string().trim().optional().describe("Local do serviço."),
    origin: z.string().trim().optional().describe("Origem da demanda."),
    notes: z.string().trim().optional().describe("Observações livres."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("leads")
      .insert({ ...input, responsible_id: ctx.getUserId() })
      .select("id, codigo, name, company, status")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { lead: data },
    };
  },
});
