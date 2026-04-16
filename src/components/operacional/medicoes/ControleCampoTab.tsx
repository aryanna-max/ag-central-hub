import { useState, useMemo } from "react";
import { Calendar, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFieldControlGrid } from "@/hooks/useMeasurementDailyEntries";

interface Props {
  onCreateMeasurement: () => void;
}

function useFieldProjects() {
  return useQuery({
    queryKey: ["projects-field-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, codigo, client_id, clients:client_id(name)")
        .eq("is_active", true)
        .in("execution_status", ["aguardando_campo", "em_campo", "campo_concluido"])
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });
}

function useProjectServicesForGrid(projectId: string | null) {
  return useQuery({
    queryKey: ["project-services-grid", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_services")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!projectId,
  });
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatCurrency(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

export default function ControleCampoTab({ onCreateMeasurement }: Props) {
  const now = new Date();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: projects } = useFieldProjects();
  const { data: gridData, isLoading } = useFieldControlGrid(
    selectedProject || null,
    month,
    year
  );
  const { data: services } = useProjectServicesForGrid(selectedProject || null);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const grid = useMemo(() => {
    if (!gridData) return { rows: [], totals: { normal: 0, sabado: 0, domingo: 0 } };

    const employeeMap = new Map<string, { name: string; days: Map<number, { worked: boolean; dayType: string }> }>();

    for (const emp of gridData.employees) {
      employeeMap.set(emp.id, { name: emp.name, days: new Map() });
    }

    for (const entry of gridData.entries) {
      const empData = employeeMap.get(entry.employee_id);
      if (!empData) continue;
      const day = parseInt(entry.date.split("-")[2], 10);
      empData.days.set(day, { worked: entry.worked, dayType: entry.day_type });
    }

    let totalNormal = 0;
    let totalSabado = 0;
    let totalDomingo = 0;

    const rows = Array.from(employeeMap.entries()).map(([id, emp]) => {
      let empNormal = 0;
      let empSabado = 0;
      let empDomingo = 0;

      for (const [, info] of emp.days) {
        if (!info.worked) continue;
        if (info.dayType === "sabado") empSabado++;
        else if (info.dayType === "domingo" || info.dayType === "feriado") empDomingo++;
        else empNormal++;
      }

      totalNormal += empNormal;
      totalSabado += empSabado;
      totalDomingo += empDomingo;

      return {
        id,
        name: emp.name,
        days: emp.days,
        totalDays: empNormal + empSabado + empDomingo,
        normal: empNormal,
        sabado: empSabado,
        domingo: empDomingo,
      };
    });

    return { rows, totals: { normal: totalNormal, sabado: totalSabado, domingo: totalDomingo } };
  }, [gridData]);

  const valorSummary = useMemo(() => {
    if (!services || services.length === 0) {
      return { valorSemana: 0, valorFds: 0, totalNormal: 0, totalSab: 0, totalDom: 0, total: 0 };
    }
    const svc = services[0];
    const valorSemana = svc.daily_rate || 0;
    const valorFds = svc.daily_rate || 0;

    const totalNormal = grid.totals.normal * valorSemana;
    const totalSab = grid.totals.sabado * valorFds;
    const totalDom = grid.totals.domingo * valorFds;

    return {
      valorSemana,
      valorFds,
      totalNormal,
      totalSab,
      totalDom,
      total: totalNormal + totalSab + totalDom,
    };
  }, [services, grid.totals]);

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const project = (projects || []).find((p: any) => p.id === selectedProject);
    const html = buildPrintHtml(project, grid, days, month, year, valorSummary, daysInMonth);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecionar projeto..." />
              </SelectTrigger>
              <SelectContent>
                {(projects || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} — ` : ""}{p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProject && grid.rows.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}>
                  <Download className="w-4 h-4" /> Gerar PDF
                </Button>
                <Button size="sm" className="gap-2" onClick={onCreateMeasurement}>
                  <FileText className="w-4 h-4" /> Criar Medição Formal
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedProject && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Selecione um projeto e período para visualizar o controle de campo.
          </CardContent>
        </Card>
      )}

      {selectedProject && isLoading && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Carregando dados da escala...
          </CardContent>
        </Card>
      )}

      {selectedProject && !isLoading && grid.rows.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhum registro encontrado para este projeto no período selecionado.
          </CardContent>
        </Card>
      )}

      {selectedProject && !isLoading && grid.rows.length > 0 && (
        <>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">
                      Funcionário
                    </TableHead>
                    {days.map((d) => {
                      const dow = getDayOfWeek(year, month, d);
                      const isSat = dow === 6;
                      const isSun = dow === 0;
                      return (
                        <TableHead
                          key={d}
                          className={`text-center w-8 px-1 text-xs ${
                            isSun ? "bg-red-50 dark:bg-red-950/30" :
                            isSat ? "bg-yellow-50 dark:bg-yellow-950/30" : ""
                          }`}
                        >
                          {d}
                        </TableHead>
                      );
                    })}
                    <TableHead className="text-center font-bold min-w-[60px]">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                        {row.name}
                      </TableCell>
                      {days.map((d) => {
                        const info = row.days.get(d);
                        const dow = getDayOfWeek(year, month, d);
                        const isSat = dow === 6;
                        const isSun = dow === 0;
                        return (
                          <TableCell
                            key={d}
                            className={`text-center px-1 text-xs ${
                              isSun ? "bg-red-50 dark:bg-red-950/30" :
                              isSat ? "bg-yellow-50 dark:bg-yellow-950/30" : ""
                            }`}
                          >
                            {info?.worked ? (
                              <span className="font-bold text-primary">X</span>
                            ) : null}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold">{row.totalDays}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell className="sticky left-0 bg-background z-10">TOTAL</TableCell>
                    {days.map((d) => {
                      const count = grid.rows.reduce((s, r) => {
                        const info = r.days.get(d);
                        return s + (info?.worked ? 1 : 0);
                      }, 0);
                      const dow = getDayOfWeek(year, month, d);
                      const isSat = dow === 6;
                      const isSun = dow === 0;
                      return (
                        <TableCell
                          key={d}
                          className={`text-center px-1 text-xs ${
                            isSun ? "bg-red-50 dark:bg-red-950/30" :
                            isSat ? "bg-yellow-50 dark:bg-yellow-950/30" : ""
                          }`}
                        >
                          {count > 0 ? count : ""}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      {grid.totals.normal + grid.totals.sabado + grid.totals.domingo}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo de Valores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Dias normais (seg-sex)</p>
                  <p className="text-lg font-bold">{grid.totals.normal} dias</p>
                  <p className="text-sm text-muted-foreground">
                    {grid.totals.normal} × {formatCurrency(valorSummary.valorSemana)} = {formatCurrency(valorSummary.totalNormal)}
                  </p>
                </div>
                <div className="rounded-lg border p-3 bg-yellow-50/50 dark:bg-yellow-950/20">
                  <p className="text-sm text-muted-foreground">Sábados</p>
                  <p className="text-lg font-bold">{grid.totals.sabado} dias</p>
                  <p className="text-sm text-muted-foreground">
                    {grid.totals.sabado} × {formatCurrency(valorSummary.valorFds)} = {formatCurrency(valorSummary.totalSab)}
                  </p>
                </div>
                <div className="rounded-lg border p-3 bg-red-50/50 dark:bg-red-950/20">
                  <p className="text-sm text-muted-foreground">Domingos / Feriados</p>
                  <p className="text-lg font-bold">{grid.totals.domingo} dias</p>
                  <p className="text-sm text-muted-foreground">
                    {grid.totals.domingo} × {formatCurrency(valorSummary.valorFds)} = {formatCurrency(valorSummary.totalDom)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
                <span className="text-lg font-semibold">TOTAL</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(valorSummary.total)}</span>
              </div>
              {(!services || services.length === 0) && (
                <p className="text-sm text-amber-600 mt-2">
                  Nenhum serviço cadastrado para este projeto. Valores de diária não disponíveis.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="outline" className="bg-background">Normal</Badge>
            <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300">Sábado</Badge>
            <Badge variant="outline" className="bg-red-50 dark:bg-red-950/30 border-red-300">Domingo/Feriado</Badge>
          </div>
        </>
      )}
    </div>
  );
}

function buildPrintHtml(
  project: any,
  grid: any,
  days: number[],
  month: number,
  year: number,
  valorSummary: any,
  daysInMonth: number,
) {
  const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const projectName = project?.name || "—";
  const clientName = project?.clients?.name || "—";

  const headerCells = days.map((d) => {
    const dow = new Date(year, month - 1, d).getDay();
    const bg = dow === 0 ? "#fee2e2" : dow === 6 ? "#fef9c3" : "#fff";
    return `<th style="text-align:center;padding:2px 4px;font-size:10px;background:${bg};border:1px solid #ccc;">${d}</th>`;
  }).join("");

  const bodyRows = grid.rows.map((row: any) => {
    const cells = days.map((d: number) => {
      const info = row.days.get(d);
      const dow = new Date(year, month - 1, d).getDay();
      const bg = dow === 0 ? "#fee2e2" : dow === 6 ? "#fef9c3" : "#fff";
      return `<td style="text-align:center;padding:2px;font-size:10px;background:${bg};border:1px solid #ccc;">${info?.worked ? "X" : ""}</td>`;
    }).join("");
    return `<tr><td style="padding:4px 8px;font-size:11px;border:1px solid #ccc;white-space:nowrap;">${row.name}</td>${cells}<td style="text-align:center;font-weight:bold;border:1px solid #ccc;">${row.totalDays}</td></tr>`;
  }).join("");

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return `<!DOCTYPE html><html><head><title>Controle de Campo - ${projectName}</title>
<style>body{font-family:Arial,sans-serif;margin:20px;}table{border-collapse:collapse;width:100%;}
@media print{body{margin:10px;}}</style></head><body>
<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
<div style="width:60px;height:60px;background:#1a365d;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:18px;">AG</div>
<div><h2 style="margin:0;">CONTROLE DE CAMPO</h2>
<p style="margin:2px 0;color:#666;">AG Topografia e Construções</p></div></div>
<table style="margin-bottom:16px;"><tr>
<td style="padding:4px;"><b>Projeto:</b> ${projectName}</td>
<td style="padding:4px;"><b>Cliente:</b> ${clientName}</td>
<td style="padding:4px;"><b>Período:</b> ${MONTHS[month - 1]}/${year}</td>
</tr></table>
<table><thead><tr><th style="text-align:left;padding:4px 8px;border:1px solid #ccc;background:#f3f4f6;">Funcionário</th>
${headerCells}<th style="text-align:center;padding:4px;border:1px solid #ccc;background:#f3f4f6;font-weight:bold;">TOTAL</th></tr></thead>
<tbody>${bodyRows}</tbody></table>
<div style="margin-top:20px;padding:12px;border:1px solid #ccc;border-radius:8px;">
<h3 style="margin:0 0 8px;">Resumo</h3>
<p>Dias normais: ${grid.totals.normal} × ${fmt(valorSummary.valorSemana)} = <b>${fmt(valorSummary.totalNormal)}</b></p>
<p>Sábados: ${grid.totals.sabado} × ${fmt(valorSummary.valorFds)} = <b>${fmt(valorSummary.totalSab)}</b></p>
<p>Dom/Feriados: ${grid.totals.domingo} × ${fmt(valorSummary.valorFds)} = <b>${fmt(valorSummary.totalDom)}</b></p>
<hr/><p style="font-size:16px;"><b>TOTAL: ${fmt(valorSummary.total)}</b></p></div>
</body></html>`;
}
