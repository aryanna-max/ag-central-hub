import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ALLOWED_TABLES = [
  "clients",
  "projects",
  "project_status_history",
  "project_services",
  "proposals",
  "leads",
  "invoices",
  "invoice_items",
  "measurements",
  "measurement_items",
  "employees",
  "employee_client_integrations",
  "employee_vacations",
  "alerts",
] as const;

// Colunas sensíveis nunca retornadas para a IA nem para a tela
const BLOCKED_COLUMNS: Record<string, string[]> = {
  employees: [
    "cpf", "rg", "pis", "ctps_numero", "ctps_serie", "cnh", "cnh_categoria", "cnh_validade",
    "salario_base", "banco", "agencia", "conta", "tipo_conta", "pix_chave",
    "data_nascimento", "contato_emergencia_nome", "contato_emergencia_telefone",
    "contato_emergencia_parentesco",
  ],
};

const ALLOWED_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is_null", "not_null"];

const SYSTEM_PROMPT = `Você é a Central de Consulta do Sistema AG (topografia e cartografia).
Responda SEMPRE em português do Brasil, de forma objetiva.

REGRAS:
- Você só pode ler dados através da ferramenta consultar_tabela (somente leitura). Nunca afirme ter alterado nada.
- Nunca use a palavra "OBRA": sempre "PROJETO". Nunca use a palavra "Avulsa".
- Sempre cite os registros-fonte: código do projeto (projects.codigo), nome do cliente, datas e códigos de proposta/medição usados na resposta.
- Se a consulta retornar zero registros porque a tabela ainda não tem dados, diga explicitamente: "módulo ainda sem dados no sistema". Nunca invente dados.
- Se não encontrar o que foi pedido, diga o que consultou e o que não achou.
- Dados sensíveis de funcionários (CPF, RG, salário, dados bancários) não estão disponíveis e não devem ser mencionados.
- Para descobrir as colunas de uma tabela, faça uma consulta com limit pequeno e select "*".

Tabelas disponíveis: ${ALLOWED_TABLES.join(", ")}.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_tabela",
      description: "Executa uma leitura (SELECT) em uma tabela da lista branca do Sistema AG.",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", enum: ALLOWED_TABLES, description: "Tabela a consultar" },
          select: { type: "string", description: 'Colunas separadas por vírgula, ou "*"' },
          filters: {
            type: "array",
            description: "Filtros aplicados à consulta",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                op: { type: "string", enum: ALLOWED_OPS },
                value: { type: "string" },
              },
              required: ["column", "op"],
            },
          },
          order_by: { type: "string", description: "Coluna de ordenação" },
          order_dir: { type: "string", enum: ["asc", "desc"] },
          limit: { type: "number", description: "Máximo de linhas (padrão 50, teto 200)" },
        },
        required: ["table"],
      },
    },
  },
];

function sanitize(table: string, rows: Record<string, unknown>[]) {
  const blocked = BLOCKED_COLUMNS[table];
  if (!blocked?.length) return rows;
  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) if (!blocked.includes(k)) clean[k] = v;
    return clean;
  });
}

async function runTool(
  supabase: ReturnType<typeof createClient>,
  args: Record<string, any>,
) {
  const table = String(args.table || "");
  if (!(ALLOWED_TABLES as readonly string[]).includes(table)) {
    return { error: `Tabela "${table}" não está liberada para consulta.` };
  }

  let select = typeof args.select === "string" && args.select.trim() ? args.select.trim() : "*";
  if (/[();]/.test(select)) select = "*";
  const blocked = BLOCKED_COLUMNS[table] ?? [];
  if (select !== "*") {
    const cols = select.split(",").map((c) => c.trim()).filter((c) => c && !blocked.includes(c));
    select = cols.length ? cols.join(",") : "*";
  }

  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
  let query = supabase.from(table).select(select).limit(limit);

  for (const f of (Array.isArray(args.filters) ? args.filters : [])) {
    const column = String(f?.column || "");
    const op = String(f?.op || "");
    const value = f?.value;
    if (!column || !ALLOWED_OPS.includes(op) || blocked.includes(column)) continue;
    if (op === "is_null") query = query.is(column, null);
    else if (op === "not_null") query = query.not(column, "is", null);
    else if (op === "in") query = query.in(column, String(value ?? "").split(",").map((v) => v.trim()));
    else if (op === "ilike") query = query.ilike(column, `%${String(value ?? "")}%`);
    else query = (query as any)[op](column, value);
  }

  if (args.order_by && !blocked.includes(String(args.order_by))) {
    query = query.order(String(args.order_by), { ascending: args.order_dir !== "desc" });
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  const rows = sanitize(table, (data ?? []) as Record<string, unknown>[]);
  return {
    table,
    row_count: rows.length,
    empty: rows.length === 0,
    rows,
    note: rows.length === 0 ? "Nenhum registro encontrado — módulo pode estar sem dados no sistema." : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Sessão inválida. Faça login novamente." }, 401);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "LOVABLE_API_KEY não configurada." }, 500);

  let payload: { messages?: { role: string; content: string }[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }

  const history = (payload.messages ?? [])
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .slice(-12);
  if (history.length === 0) return json({ error: "Envie uma pergunta." }, 400);

  const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
  const sources: { table: string; row_count: number }[] = [];

  for (let step = 0; step < 14; step++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "google/gemini-3.6-flash", messages, tools: TOOLS }),
    });

    if (res.status === 429) return json({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }, 429);
    if (res.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
    if (!res.ok) return json({ error: `Erro da IA (${res.status}): ${await res.text()}` }, 502);

    const data = await res.json();
    const message = data?.choices?.[0]?.message;
    if (!message) return json({ error: "Resposta vazia da IA." }, 502);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return json({ answer: message.content ?? "", sources });
    }

    messages.push(message);
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }
      const result = await runTool(supabase, args);
      if (!("error" in result)) sources.push({ table: result.table, row_count: result.row_count });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return json({ error: "A consulta ficou complexa demais (muitas etapas). Reformule a pergunta." }, 500);
});
