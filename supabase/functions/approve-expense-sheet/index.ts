// =============================================================================
// Edge Function: approve-expense-sheet
// =============================================================================
// Substitui a chamada direta em src/pages/AprovacaoExterna.tsx que quebrou
// Bug 5 (enqueue_email só roda como service_role — frontend público não tinha
// permissão).
//
// Fluxo:
//   1. Valida token → encontra folha
//   2. Aplica decisão (aprovar / devolver)
//   3. Grava event_log (auditoria — Camada C0.4 do ADR-040)
//   4. Se aprovar: enfileira email para Alcione via enqueue_email
//   5. Se enfileirar falhou: loga em email_send_log, retorna sucesso parcial
//   6. Retorna ao frontend status real da operação
//
// Chamado por: supabase.functions.invoke('approve-expense-sheet', { body })
// Autenticação: NÃO exige login (é fluxo externo via link token)
//   — a segurança vem do token único em approval_token
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  token: string;
  action: "aprovada" | "questionada";
  comment?: string;
  approver_label?: string; // ex: "Diretoria Comercial"
}

interface ResponseBody {
  ok: boolean;
  emailEnqueued?: boolean;
  error?: string;
  detail?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const { token, action, comment, approver_label } = body;

  if (!token || !action) {
    return json({ ok: false, error: "MISSING_FIELDS", detail: "token e action são obrigatórios" }, 400);
  }

  if (action !== "aprovada" && action !== "questionada") {
    return json({ ok: false, error: "INVALID_ACTION" }, 400);
  }

  if (action === "questionada" && !comment?.trim()) {
    return json({ ok: false, error: "COMMENT_REQUIRED", detail: "Questionamento exige comentário" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "SERVER_CONFIG_ERROR" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. Busca folha pelo token
  const { data: sheet, error: selErr } = await supabase
    .from("field_expense_sheets")
    .select("id, codigo, week_label, period_start, period_end, total_value, status, approval_comments")
    .eq("approval_token", token)
    .maybeSingle();

  if (selErr) {
    console.error("[approve-expense-sheet] select error:", selErr);
    return json({ ok: false, error: "DB_ERROR", detail: selErr.message }, 500);
  }

  if (!sheet) {
    return json({ ok: false, error: "NOT_FOUND" }, 404);
  }

  if (sheet.status === "aprovado" || sheet.status === "pago") {
    return json({ ok: false, error: "ALREADY_RESOLVED" }, 409);
  }

  // 2. Monta comentário + atualiza folha
  const approver = approver_label?.trim() || "Diretoria Comercial";
  const newComment = {
    action,
    by: approver,
    at: new Date().toISOString(),
    text: comment?.trim() || null,
  };
  const comments = [...((sheet.approval_comments as unknown[]) || []), newComment];

  const updatePayload =
    action === "aprovada"
      ? {
          status: "aprovado",
          approved_at: new Date().toISOString(),
          approval_comments: comments,
        }
      : {
          status: "devolvido",
          return_comment: comment!.trim(),
          approval_comments: comments,
        };

  const { error: updErr } = await supabase
    .from("field_expense_sheets")
    .update(updatePayload)
    .eq("id", sheet.id);

  if (updErr) {
    console.error("[approve-expense-sheet] update error:", updErr);
    return json({ ok: false, error: "DB_UPDATE_FAILED", detail: updErr.message }, 500);
  }

  // 3. event_log (auditoria — Camada C0.4)
  // Nota: o trigger trg_field_expense_sheets_log_status já vai logar a
  // mudança de status automaticamente. Aqui só adicionamos o evento de
  // alto nível (aprovação/devolução externa) com contexto extra.
  const eventPayload = {
    sheet_codigo: sheet.codigo,
    week_label: sheet.week_label,
    total_value: sheet.total_value,
    approver,
    comment: comment?.trim() || null,
    via: "approve-expense-sheet edge function",
  };

  const eventType =
    action === "aprovada"
      ? "expense_sheet.approved_external"
      : "expense_sheet.questioned_external";

  const { error: eventErr } = await supabase.from("event_log").insert({
    event_type: eventType,
    entity_table: "field_expense_sheets",
    entity_id: sheet.id,
    actor_type: "external",
    actor_id: null,
    payload: eventPayload,
  });

  if (eventErr) {
    // event_log não pode derrubar a aprovação — só loga e segue
    console.error("[approve-expense-sheet] event_log error:", eventErr);
  }

  // 4. Se questionou, termina aqui (Alcione não precisa saber ainda)
  if (action === "questionada") {
    return json({ ok: true, emailEnqueued: false });
  }

  // 5. Aprovada — enfileira email para Alcione
  const periodLabel = `${fmtDate(sheet.period_start)} a ${fmtDate(sheet.period_end)}`;
  const totalFormatted = fmtMoney(sheet.total_value);
  const sheetLabel = sheet.codigo || sheet.week_label || periodLabel;

  const emailSubject = `Folha ${sheetLabel} APROVADA pela ${approver}`;
  const emailHtml = buildEmailHtml({
    sheetLabel,
    periodLabel,
    totalFormatted,
    approver,
    comment: comment?.trim() || null,
  });

  const emailPayload = {
    to: "financeiro@agtopografia.com.br",
    subject: emailSubject,
    html: emailHtml,
    from: "Sistema AG <notify@notify.agtopografia.com.br>",
  };

  const { data: msgId, error: enqErr } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: emailPayload,
  });

  if (enqErr) {
    console.error("[approve-expense-sheet] enqueue error:", enqErr);

    await supabase.from("email_send_log").insert({
      template_name: "expense_sheet_approved",
      recipient_email: "financeiro@agtopografia.com.br",
      status: "failed",
      error_message: enqErr.message,
      metadata: { sheet_id: sheet.id, sheet_codigo: sheet.codigo },
    });

    await supabase.from("event_log").insert({
      event_type: "email.enqueue_failed",
      entity_table: "field_expense_sheets",
      entity_id: sheet.id,
      actor_type: "system",
      actor_id: null,
      payload: { reason: enqErr.message, recipient: "financeiro@agtopografia.com.br" },
    });

    // Aprovação gravada mas email falhou — retorna sucesso parcial
    // para que UI mostre mensagem apropriada.
    return json({ ok: true, emailEnqueued: false, detail: "Aprovação salva mas email falhou ao enfileirar." });
  }

  // Email enfileirado com sucesso — loga em email_send_log
  await supabase.from("email_send_log").insert({
    template_name: "expense_sheet_approved",
    recipient_email: "financeiro@agtopografia.com.br",
    status: "pending",
    message_id: String(msgId),
    metadata: { sheet_id: sheet.id, sheet_codigo: sheet.codigo },
  });

  await supabase.from("event_log").insert({
    event_type: "email.queued",
    entity_table: "field_expense_sheets",
    entity_id: sheet.id,
    actor_type: "system",
    actor_id: null,
    payload: { message_id: String(msgId), recipient: "financeiro@agtopografia.com.br" },
  });

  return json({ ok: true, emailEnqueued: true });
});

// =============================================================================
// Helpers
// =============================================================================

function json(body: ResponseBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function fmtMoney(v: number | null): string {
  if (v === null || v === undefined) return "R$ 0,00";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function buildEmailHtml(ctx: {
  sheetLabel: string;
  periodLabel: string;
  totalFormatted: string;
  approver: string;
  comment: string | null;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f7fafc;">
      <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="color: #1A9E7C; margin: 0 0 8px 0; font-size: 20px;">Folha de Despesas Aprovada</h1>
        <p style="color: #4a5568; margin: 0 0 24px 0; font-size: 14px;">
          A folha ${ctx.sheetLabel} foi aprovada pela ${ctx.approver}.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; color: #718096; font-size: 13px;">Código</td>
            <td style="padding: 8px 0; font-weight: 600; font-size: 13px; text-align: right;">${ctx.sheetLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096; font-size: 13px;">Período</td>
            <td style="padding: 8px 0; font-size: 13px; text-align: right;">${ctx.periodLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #718096; font-size: 13px;">Valor total</td>
            <td style="padding: 8px 0; font-weight: 600; font-size: 15px; text-align: right; color: #1A9E7C;">${ctx.totalFormatted}</td>
          </tr>
        </table>
        ${
          ctx.comment
            ? `<div style="background: #edf2f7; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
                 <p style="margin: 0 0 4px 0; color: #4a5568; font-size: 12px; font-weight: 600;">Observação da aprovação:</p>
                 <p style="margin: 0; color: #2d3748; font-size: 13px;">${escapeHtml(ctx.comment)}</p>
               </div>`
            : ""
        }
        <p style="color: #718096; font-size: 13px; margin: 24px 0 0 0;">
          Esta folha está pronta para pagamento. Abra o Sistema AG para processar.
        </p>
      </div>
      <p style="text-align: center; font-size: 11px; color: #a0aec0; margin-top: 16px;">
        Email automático do Sistema AG Central Hub.
      </p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
