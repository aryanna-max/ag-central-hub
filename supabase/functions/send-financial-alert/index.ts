import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // This function is triggered by a webhook on INSERT to alerts
    // where recipient = 'financeiro'
    const body = await req.json();
    const record = body?.record;

    if (!record) {
      return new Response(JSON.stringify({ error: "No record" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only process financial alerts
    if (record.recipient !== "financeiro") {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch project details if reference_type is project
    let projectData: any = null;
    let clientName = "";
    if (record.reference_type === "project" && record.reference_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("codigo, name, cnpj_tomador, empresa_faturadora, delivered_at, client_id")
        .eq("id", record.reference_id)
        .single();
      projectData = project;

      if (project?.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", project.client_id)
          .single();
        clientName = client?.name || "";
      }
    }

    // Determine action label from alert message
    const actionLabel = record.message?.split(":")[0] || "Ação financeira";
    const projectCode = projectData?.codigo || "—";
    const subject = `[SISTEMA AG] ${actionLabel} — ${projectCode}`;

    const deliveredFormatted = projectData?.delivered_at
      ? new Date(projectData.delivered_at).toLocaleDateString("pt-BR")
      : "—";

    const empresaLabel = projectData?.empresa_faturadora === "ag_cartografia"
      ? "AG Cartografia"
      : "AG Topografia";

    const actionUrl = record.action_url || "";
    const systemUrl = `https://ag-central-hub.lovable.app${actionUrl}`;

    const htmlBody = `
      <div style="font-family: 'Asap', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <div style="background: #1A3A4A; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #ffffff; font-size: 18px; margin: 0;">Sistema AG — Alerta Financeiro</h1>
        </div>
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; font-weight: 600; color: #1a202c; margin: 0 0 16px;">
            ${record.message || record.title}
          </p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #4a5568;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; width: 160px;">Projeto:</td>
              <td style="padding: 8px 0;">${projectCode} — ${projectData?.name || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Cliente:</td>
              <td style="padding: 8px 0;">${clientName || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">CNPJ Tomador:</td>
              <td style="padding: 8px 0;">${projectData?.cnpj_tomador || "Não informado"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Empresa Faturadora:</td>
              <td style="padding: 8px 0;">${empresaLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Data entrega:</td>
              <td style="padding: 8px 0;">${deliveredFormatted}</td>
            </tr>
          </table>
          <div style="margin-top: 24px; text-align: center;">
            <a href="${systemUrl}" style="display: inline-block; background: #1A9E7C; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
              Abrir no Sistema
            </a>
          </div>
        </div>
        <p style="text-align: center; font-size: 11px; color: #a0aec0; margin-top: 16px;">
          Este é um email automático do Sistema AG Central Hub.
        </p>
      </div>
    `;

    // Enqueue via pgmq
    const payload = {
      to: "financeiro@agtopografia.com.br",
      subject,
      html: htmlBody,
      from: "Sistema AG <notify@notify.agtopografia.com.br>",
    };

    const { data: msgId, error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload,
    });

    if (enqueueError) {
      console.error("Enqueue error:", enqueueError);
      // Log the failure
      await supabase.from("email_send_log").insert({
        template_name: "financial_alert",
        recipient_email: "financeiro@agtopografia.com.br",
        status: "failed",
        error_message: enqueueError.message,
        metadata: { alert_id: record.id, project_code: projectCode },
      });

      return new Response(JSON.stringify({ error: "Failed to enqueue" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log success
    await supabase.from("email_send_log").insert({
      template_name: "financial_alert",
      recipient_email: "financeiro@agtopografia.com.br",
      status: "pending",
      message_id: String(msgId),
      metadata: { alert_id: record.id, project_code: projectCode },
    });

    return new Response(JSON.stringify({ success: true, message_id: msgId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-financial-alert error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
