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

const PROPOSAL_UNITS = [
  "verba", "mes", "diaria", "hora", "hectare", "metro_linear", "metro_quadrado", "unidade", "lote",
];

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

PAGINAÇÃO E FILTROS (obrigatório para listas grandes: projetos, leads, NFs pendentes):
- A ferramenta devolve total_count, page, page_size, has_more e next_offset. Use page_size 10 por padrão em listas para o usuário.
- Sempre comece informando o total: "X registros no total — mostrando os N primeiros (página 1 de P)".
- Ao final da lista, se has_more for true, escreva: "Peça 'próxima página' para ver os próximos N."
- Quando o usuário pedir "próxima página" / "mais", repita a MESMA consulta alterando apenas offset para o next_offset informado.
- Antes de listar mais de 20 registros, sugira filtros úteis (por cliente, status, período, responsável) e aplique os filtros que o usuário indicar.
- Nunca despeje centenas de linhas em uma única resposta.

CRIAR PROPOSTA:
- Se o usuário pedir para criar/montar uma proposta, use a ferramenta preparar_proposta. Ela NÃO grava nada: apenas monta um rascunho que o usuário confirma na tela.
- Antes disso, encontre o client_id real na tabela clients (busque por nome com ilike). Nunca invente um id.
- Se faltar cliente, título ou pelo menos um item com quantidade e valor unitário, pergunte antes de chamar a ferramenta.
- Depois de chamar preparar_proposta, resuma o rascunho em texto (cliente, itens, total) e diga que ele aparece abaixo para confirmação.

Tabelas disponíveis: ${ALLOWED_TABLES.join(", ")}.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_tabela",
      description: "Executa uma leitura (SELECT) paginada em uma tabela da lista branca do Sistema AG.",
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
          limit: { type: "number", description: "Tamanho da página (padrão 10, teto 100)" },
          offset: { type: "number", description: "Deslocamento para paginação (padrão 0)" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparar_proposta",
      description:
        "Monta um RASCUNHO de proposta para confirmação do usuário. Não grava nada no banco. Use client_id real obtido em clients.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "UUID do cliente (obrigatório)" },
          title: { type: "string", description: "Título da proposta" },
          location: { type: "string", description: "Local / endereço do serviço" },
          scope: { type: "string", description: "Escopo / observações" },
          validity_days: { type: "number", description: "Validade em dias (padrão 30)" },
          empresa_faturadora: { type: "string", enum: ["ag_topografia", "ag_cartografia"] },
          payment_conditions: { type: "string" },
          items: {
            type: "array",
            description: "Itens da proposta",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                unit: { type: "string", enum: PROPOSAL_UNITS },
                quantity: { type: "number" },
                unit_price: { type: "number" },
              },
              required: ["description", "quantity", "unit_price"],
            },
          },
        },
        required: ["client_id", "title", "items"],
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

  const pageSize = Math.min(Math.max(Number(args.limit) || 10, 1), 100);
  const offset = Math.max(Number(args.offset) || 0, 0);

  let query = supabase.from(table).select(select, { count: "exact" });

  const appliedFilters: { column: string; op: string; value: unknown }[] = [];
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
    appliedFilters.push({ column, op, value: value ?? null });
  }

  if (args.order_by && !blocked.includes(String(args.order_by))) {
    query = query.order(String(args.order_by), { ascending: args.order_dir !== "desc" });
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return { error: error.message };
  const rows = sanitize(table, (data ?? []) as Record<string, unknown>[]);
  const total = typeof count === "number" ? count : rows.length;
  const hasMore = offset + rows.length < total;

  return {
    table,
    row_count: rows.length,
    total_count: total,
    page: Math.floor(offset / pageSize) + 1,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
    offset,
    next_offset: hasMore ? offset + pageSize : null,
    has_more: hasMore,
    applied_filters: appliedFilters,
    empty: total === 0,
    rows,
    note: total === 0 ? "Nenhum registro encontrado — módulo pode estar sem dados no sistema." : undefined,
  };
}

async function prepararProposta(
  supabase: ReturnType<typeof createClient>,
  args: Record<string, any>,
) {
  const clientId = String(args.client_id || "").trim();
  if (!clientId) return { error: "client_id é obrigatório. Busque o cliente na tabela clients primeiro." };

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id,name")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) return { error: clientError.message };
  if (!client) return { error: `Cliente ${clientId} não encontrado em clients.` };

  const rawItems = Array.isArray(args.items) ? args.items : [];
  const items = rawItems
    .map((item: any, index: number) => {
      const quantity = Number(item?.quantity) || 0;
      const unitPrice = Number(item?.unit_price) || 0;
      const unit = PROPOSAL_UNITS.includes(String(item?.unit)) ? String(item.unit) : "unidade";
      return {
        description: String(item?.description || "").trim(),
        unit,
        quantity,
        unit_price: unitPrice,
        total_price: Number((quantity * unitPrice).toFixed(2)),
        sort_order: index,
      };
    })
    .filter((item) => item.description);

  if (items.length === 0) return { error: "Informe pelo menos um item com descrição, quantidade e valor unitário." };

  const total = Number(items.reduce((sum, item) => sum + item.total_price, 0).toFixed(2));

  return {
    draft: {
      client_id: client.id,
      client_name: (client as any).name,
      title: String(args.title || `Proposta ${(client as any).name}`).trim(),
      location: args.location ? String(args.location) : null,
      scope: args.scope ? String(args.scope) : null,
      payment_conditions: args.payment_conditions ? String(args.payment_conditions) : null,
      validity_days: Math.min(Math.max(Number(args.validity_days) || 30, 1), 365),
      empresa_faturadora:
        args.empresa_faturadora === "ag_cartografia" ? "ag_cartografia" : "ag_topografia",
      items,
      total,
    },
    note: "Rascunho montado. Nada foi gravado — o usuário precisa confirmar na tela.",
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
  const sources: {
    table: string;
    row_count: number;
    total_count?: number;
    page?: number;
    total_pages?: number;
    has_more?: boolean;
    next_offset?: number | null;
    filters?: { column: string; op: string; value: unknown }[];
  }[] = [];
  let proposalDraft: unknown = null;

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
      return json({ answer: message.content ?? "", sources, proposal_draft: proposalDraft });
    }

    messages.push(message);
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }

      const name = call.function?.name;
      let result: Record<string, any>;
      if (name === "preparar_proposta") {
        result = await prepararProposta(supabase, args);
        if (!("error" in result)) proposalDraft = result.draft;
      } else {
        result = await runTool(supabase, args);
        if (!("error" in result)) {
          sources.push({
            table: result.table,
            row_count: result.row_count,
            total_count: result.total_count,
            page: result.page,
            total_pages: result.total_pages,
            has_more: result.has_more,
            next_offset: result.next_offset,
            filters: result.applied_filters,
          });
        }
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return json({ error: "A consulta ficou complexa demais (muitas etapas). Reformule a pergunta." }, 500);
});
