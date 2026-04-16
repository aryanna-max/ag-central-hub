import type { Measurement, MeasurementItem, MeasurementDailyEntry } from "@/hooks/useMeasurements";

interface MeasurementData {
  measurement: Measurement & { projects?: any; clients?: any; proposals?: any };
  items: MeasurementItem[];
  entries: MeasurementDailyEntry[];
}

function fmt(v: number | null) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function getEmpresaInfo(empresaFaturadora: string) {
  if (empresaFaturadora === "ag_cartografia") {
    return {
      nome: "AG Cartografia LTDA",
      cnpj: "48.282.440/0001-05",
      banco: "Banco do Brasil",
    };
  }
  return {
    nome: "Gonzaga e Berlim Topografia LTDA (AG Topografia)",
    cnpj: "16.841.054/0001-10",
    banco: "Bradesco",
  };
}

export function generateMeasurementPdfHtml(data: MeasurementData): string {
  const { measurement: m, items, entries } = data;

  const empresa = getEmpresaInfo(m.empresa_faturadora);
  const projectName = m.projects?.name || m.project_name || "—";
  const projectLocation = m.projects?.location || "";
  const projectScope = m.projects?.scope_description || "";
  const clientName = m.clients?.name || m.client_name || "—";
  const clientCnpj = m.clients?.cnpj || "";
  const proposalCode = m.proposals?.code || m.proposal_code || "";

  let bodyHtml = "";
  if (m.measurement_type === "grid_diarias") {
    bodyHtml = buildGridDiariasBody(entries, m);
  } else if (m.measurement_type === "boletim_formal") {
    bodyHtml = buildBoletimFormalBody(items, m);
  } else if (m.measurement_type === "resumo_entrega") {
    bodyHtml = buildResumoEntregaBody(items, m, proposalCode);
  } else {
    bodyHtml = buildLegacyBody(m);
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Boletim de Medição - ${m.codigo_bm}</title>
<style>
body{font-family:Arial,sans-serif;margin:30px;font-size:12px;color:#333;}
table{border-collapse:collapse;width:100%;}
th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;}
th{background:#f3f4f6;}
.header{display:flex;align-items:flex-start;gap:20px;margin-bottom:20px;border-bottom:2px solid #1a365d;padding-bottom:15px;}
.logo{width:70px;height:70px;background:#1a365d;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:24px;}
.title{font-size:18px;font-weight:bold;color:#1a365d;margin:0;}
.subtitle{font-size:12px;color:#666;margin:2px 0;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:11px;}
.info-grid dt{font-weight:bold;color:#555;}
.info-grid dd{margin:0;}
.totals{background:#f8fafc;padding:12px;border-radius:6px;margin-top:16px;}
.totals .row{display:flex;justify-content:space-between;padding:2px 0;}
.totals .total{font-weight:bold;font-size:14px;border-top:2px solid #333;padding-top:4px;margin-top:4px;}
.signatures{margin-top:40px;display:flex;justify-content:space-between;gap:40px;}
.sig-block{text-align:center;flex:1;}
.sig-line{border-top:1px solid #333;margin-top:50px;padding-top:4px;}
@media print{body{margin:15px;}@page{margin:15mm;}}
</style></head><body>

<div class="header">
<div class="logo">AG</div>
<div style="flex:1;">
<p class="title">BOLETIM DE MEDIÇÃO</p>
<p class="subtitle">${m.codigo_bm}</p>
<p class="subtitle">${empresa.nome} — CNPJ: ${empresa.cnpj}</p>
</div>
</div>

<div class="info-grid">
<div><dt>Contratante:</dt><dd>${clientName}${clientCnpj ? ` — CNPJ: ${clientCnpj}` : ""}</dd></div>
<div><dt>Projeto/Obra:</dt><dd>${projectName}${projectLocation ? ` — ${projectLocation}` : ""}</dd></div>
<div><dt>Período:</dt><dd>${m.period_start} a ${m.period_end}</dd></div>
<div><dt>Proposta:</dt><dd>${proposalCode || "—"}</dd></div>
${projectScope ? `<div style="grid-column:span 2;"><dt>Escopo:</dt><dd>${projectScope}</dd></div>` : ""}
</div>

<hr style="border:none;border-top:1px solid #ddd;margin:12px 0;"/>

${bodyHtml}

<div class="signatures">
<div class="sig-block">
<div class="sig-line">
<strong>FORNECEDOR</strong><br/>${empresa.nome}
</div>
</div>
<div class="sig-block">
<div class="sig-line">
<strong>RESPONSÁVEL OBRA</strong><br/>${clientName}
</div>
</div>
</div>

<p style="text-align:center;margin-top:20px;font-size:10px;color:#999;">
Documento gerado pelo sistema AG Central Hub em ${new Date().toLocaleDateString("pt-BR")}
</p>

</body></html>`;
}

function buildGridDiariasBody(entries: MeasurementDailyEntry[], m: any): string {
  if (entries.length === 0) return "<p>Nenhum registro diário.</p>";

  const empMap = new Map<string, { name: string; days: Map<string, any> }>();
  const dateSet = new Set<string>();

  for (const e of entries) {
    if (!empMap.has(e.employee_id)) {
      empMap.set(e.employee_id, { name: e.employee_name || "—", days: new Map() });
    }
    empMap.get(e.employee_id)!.days.set(e.date, e);
    dateSet.add(e.date);
  }

  const dates = [...dateSet].sort();
  let totalNormal = 0, totalSab = 0, totalDom = 0;

  for (const e of entries) {
    if (!e.worked) continue;
    if (e.day_type === "sabado") totalSab++;
    else if (e.day_type === "domingo" || e.day_type === "feriado") totalDom++;
    else totalNormal++;
  }

  const headerCells = dates.map((d) => {
    const day = d.split("-")[2];
    const dow = new Date(d + "T12:00:00").getDay();
    const bg = dow === 0 ? "#fee2e2" : dow === 6 ? "#fef9c3" : "#fff";
    return `<th style="text-align:center;padding:2px;font-size:9px;background:${bg};">${day}</th>`;
  }).join("");

  const rows = Array.from(empMap.entries()).map(([, emp]) => {
    let total = 0;
    const cells = dates.map((d) => {
      const e = emp.days.get(d);
      if (e?.worked) total++;
      const dow = new Date(d + "T12:00:00").getDay();
      const bg = dow === 0 ? "#fee2e2" : dow === 6 ? "#fef9c3" : "#fff";
      return `<td style="text-align:center;font-size:9px;background:${bg};">${e?.worked ? "X" : ""}</td>`;
    }).join("");
    return `<tr><td style="white-space:nowrap;font-size:10px;">${emp.name}</td>${cells}<td style="text-align:center;font-weight:bold;">${total}</td></tr>`;
  }).join("");

  return `<h3 style="margin:0 0 8px;">Presença por Dia</h3>
<table><thead><tr><th style="min-width:120px;">Funcionário</th>${headerCells}<th style="text-align:center;">Total</th></tr></thead>
<tbody>${rows}</tbody></table>

<div class="totals" style="margin-top:16px;">
<h4 style="margin:0 0 6px;">Resumo</h4>
<div class="row"><span>Dias normais (seg-sex): ${totalNormal}</span><span>${fmt(m.dias_semana * m.valor_diaria_semana)}</span></div>
<div class="row"><span>Sábados: ${totalSab}</span><span>${fmt(m.dias_fds * m.valor_diaria_fds)}</span></div>
<div class="row"><span>Domingos/Feriados: ${totalDom}</span><span>—</span></div>
<div class="row"><span>Bruto</span><span>${fmt(m.valor_bruto)}</span></div>
<div class="row"><span>Retenção (${m.retencao_pct}%)</span><span style="color:red;">- ${fmt(m.valor_retencao)}</span></div>
<div class="row total"><span>VALOR NF</span><span>${fmt(m.valor_nf)}</span></div>
</div>`;
}

function buildBoletimFormalBody(items: MeasurementItem[], m: any): string {
  if (items.length === 0) return "<p>Nenhum item de medição.</p>";

  const totalContracted = items.reduce((s, i) => s + i.total_contracted, 0);
  const totalMeasured = items.reduce((s, i) => s + i.measured_value, 0);
  const totalAccumulated = items.reduce((s, i) => s + i.accumulated_value, 0);
  const totalRemaining = items.reduce((s, i) => s + i.remaining_value, 0);

  const rows = items.map((i) => `<tr>
<td style="text-align:center;">${i.item_number}</td>
<td>${i.description}</td>
<td style="text-align:center;">${i.unit}</td>
<td style="text-align:right;">${i.contracted_quantity}</td>
<td style="text-align:right;">${fmt(i.unit_value)}</td>
<td style="text-align:right;">${fmt(i.total_contracted)}</td>
<td style="text-align:right;font-weight:bold;">${fmt(i.measured_value)}</td>
<td style="text-align:right;">${fmt(i.accumulated_value)}</td>
<td style="text-align:right;">${fmt(i.remaining_value)}</td>
</tr>`).join("");

  const retencaoVal = totalMeasured * (m.retencao_pct || 0) / 100;

  return `<h3 style="margin:0 0 8px;">Itens da Medição</h3>
<table><thead><tr>
<th>Item</th><th>Descrição</th><th>Unid</th><th style="text-align:right;">Qtd</th>
<th style="text-align:right;">V.U.</th><th style="text-align:right;">Total</th>
<th style="text-align:right;">Medido Período</th><th style="text-align:right;">Acumulado</th>
<th style="text-align:right;">Saldo</th>
</tr></thead><tbody>${rows}
<tr style="font-weight:bold;border-top:2px solid #333;">
<td colspan="5">TOTAIS</td>
<td style="text-align:right;">${fmt(totalContracted)}</td>
<td style="text-align:right;">${fmt(totalMeasured)}</td>
<td style="text-align:right;">${fmt(totalAccumulated)}</td>
<td style="text-align:right;">${fmt(totalRemaining)}</td>
</tr></tbody></table>

<div class="totals">
<div class="row"><span>Avanço no período</span><span>${m.avanco_periodo_pct?.toFixed(1) || 0}%</span></div>
<div class="row"><span>Avanço acumulado</span><span>${m.avanco_acumulado_pct?.toFixed(1) || 0}%</span></div>
<div class="row"><span>Medido no período</span><span>${fmt(totalMeasured)}</span></div>
${m.retencao_pct > 0 ? `<div class="row"><span>Retenção contratual (${m.retencao_pct}%)</span><span style="color:red;">- ${fmt(retencaoVal)}</span></div>` : ""}
<div class="row total"><span>VALOR NF</span><span>${fmt(m.valor_nf || (totalMeasured - retencaoVal))}</span></div>
</div>`;
}

function buildResumoEntregaBody(items: MeasurementItem[], m: any, proposalCode: string): string {
  const itemsHtml = items.length > 0
    ? items.map((i) => `<div style="padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:6px;">
<p style="margin:0;font-weight:bold;">${i.description}</p>
<p style="margin:2px 0;color:#666;">Valor: ${fmt(i.measured_value || i.total_contracted)}</p>
</div>`).join("")
    : "<p>Serviço conforme proposta.</p>";

  return `<h3 style="margin:0 0 8px;">Resumo de Entrega</h3>
${itemsHtml}
<div class="totals">
<div class="row"><span>Referência Proposta</span><span>${proposalCode || "—"}</span></div>
<div class="row total"><span>VALOR DE ENTREGA</span><span>${fmt(m.valor_bruto || m.valor_nf)}</span></div>
</div>`;
}

function buildLegacyBody(m: any): string {
  return `<div class="totals">
<div class="row"><span>Dias 2ª–6ª: ${m.dias_semana} × ${fmt(m.valor_diaria_semana)}</span><span>${fmt(m.dias_semana * m.valor_diaria_semana)}</span></div>
<div class="row"><span>Sáb/Dom/Fer: ${m.dias_fds} × ${fmt(m.valor_diaria_fds)}</span><span>${fmt(m.dias_fds * m.valor_diaria_fds)}</span></div>
<div class="row"><span>Bruto</span><span>${fmt(m.valor_bruto)}</span></div>
<div class="row"><span>Retenção (${m.retencao_pct}%)</span><span style="color:red;">- ${fmt(m.valor_retencao)}</span></div>
<div class="row total"><span>VALOR NF</span><span>${fmt(m.valor_nf)}</span></div>
</div>`;
}
