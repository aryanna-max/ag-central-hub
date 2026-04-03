import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Download, FileText, AlertCircle, BarChart3, TrendingUp, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useMeasurements } from "@/hooks/useMeasurements";

const fmt = (v: number | null) => v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

const billingLabel: Record<string, string> = {
  medicao_mensal: "Medição Mensal",
  entrega_nf: "NF na Entrega",
  entrega_recibo: "Recibo na Entrega",
};

const billingColor: Record<string, string> = {
  medicao_mensal: "bg-blue-100 text-blue-800",
  entrega_nf: "bg-green-100 text-green-800",
  entrega_recibo: "bg-amber-100 text-amber-800",
};

const statusColor: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-800",
  aguardando_aprovacao: "bg-yellow-100 text-yellow-800",
  aprovada: "bg-green-100 text-green-800",
  nf_emitida: "bg-blue-100 text-blue-800",
  paga: "bg-emerald-100 text-emerald-800",
  cancelada: "bg-red-100 text-red-800",
};

function exportCsv(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${r[k] ?? ""}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function DatePick({ date, onChange, label }: { date: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-1 h-3 w-3" />
          {date ? format(date, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onChange} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

function MonthPick({ month, year, onChange }: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = [2025, 2026, 2027];
  return (
    <div className="flex gap-2">
      <Select value={String(month)} onValueChange={v => onChange(Number(v), year)}>
        <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {months.map(m => <SelectItem key={m} value={String(m)}>{format(new Date(2026, m), "MMMM", { locale: ptBR })}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={v => onChange(month, Number(v))}>
        <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Report 1: Faturamento por período ───
function ReportFaturamentoPeriodo() {
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [show, setShow] = useState(false);
  const { data: projects } = useProjects();
  const { data: clients } = useClients();

  const clientMap = useMemo(() => new Map((clients || []).map(c => [c.id, c.name])), [clients]);

  const rows = useMemo(() => {
    if (!show || !start || !end || !projects) return [];
    return projects.filter(p => {
      if (!["entregue", "faturamento", "pago"].includes(p.execution_status || "")) return false;
      const ref = p.delivered_at || p.updated_at;
      if (!ref) return false;
      const d = parseISO(ref);
      return isWithinInterval(d, { start, end });
    });
  }, [show, start, end, projects]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof rows> = {};
    rows.forEach(r => {
      const bt = r.billing_type || "sem_tipo";
      (g[bt] = g[bt] || []).push(r);
    });
    return g;
  }, [rows]);

  const byEmpresa = useMemo(() => {
    const g: Record<string, number> = {};
    rows.forEach(r => {
      const e = r.empresa_faturadora || "Não informado";
      g[e] = (g[e] || 0) + (r.contract_value || 0);
    });
    return g;
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Faturamento por período</CardTitle>
        <CardDescription>Projetos entregues/faturados/pagos no período selecionado</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <DatePick date={start} onChange={setStart} label="Início" />
          <DatePick date={end} onChange={setEnd} label="Fim" />
          <Button size="sm" disabled={!start || !end} onClick={() => setShow(true)}>Gerar</Button>
        </div>
        {show && rows.length > 0 && (
          <div className="space-y-4">
            {Object.entries(grouped).map(([bt, items]) => (
              <div key={bt}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={billingColor[bt] || "bg-gray-100 text-gray-800"}>{billingLabel[bt] || bt}</Badge>
                  <span className="text-sm text-muted-foreground">({items.length} projetos)</span>
                  <span className="text-sm font-medium ml-auto">{fmt(items.reduce((s, i) => s + (i.contract_value || 0), 0))}</span>
                </div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Código</TableHead><TableHead>Projeto</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {items.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.codigo || "—"}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.client_id ? clientMap.get(p.client_id) || "—" : "—"}</TableCell>
                        <TableCell className="text-right">{fmt(p.contract_value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
            <div className="border-t pt-3 space-y-1">
              <p className="text-sm font-semibold">Total por empresa faturadora:</p>
              {Object.entries(byEmpresa).map(([e, v]) => (
                <div key={e} className="flex justify-between text-sm"><span>{e === "ag_topografia" ? "AG Topografia" : e === "ag_cartografia" ? "AG Cartografia" : e}</span><span className="font-medium">{fmt(v)}</span></div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows.map(p => ({ codigo: p.codigo, nome: p.name, cliente: p.client_id ? clientMap.get(p.client_id) : "", tipo: p.billing_type, valor: p.contract_value, empresa: p.empresa_faturadora })), "faturamento_periodo.csv")}>
              <Download className="h-3 w-3 mr-1" /> Exportar CSV
            </Button>
          </div>
        )}
        {show && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto encontrado no período.</p>}
      </CardContent>
    </Card>
  );
}

// ─── Report 2: NFs pendentes ───
function ReportNfsPendentes() {
  const [show, setShow] = useState(false);
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const clientMap = useMemo(() => new Map((clients || []).map(c => [c.id, c.name])), [clients]);

  const rows = useMemo(() => {
    if (!show || !projects) return [];
    return projects.filter(p =>
      p.execution_status === "entregue" &&
      ["entrega_nf", "entrega_recibo"].includes(p.billing_type || "")
    ).map(p => ({
      ...p,
      client_name: p.client_id ? clientMap.get(p.client_id) || "—" : "—",
      dias: p.delivered_at ? differenceInDays(new Date(), parseISO(p.delivered_at)) : null,
    }));
  }, [show, projects, clientMap]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4" /> NFs pendentes</CardTitle>
        <CardDescription>Projetos entregues aguardando emissão de NF/Recibo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="sm" onClick={() => setShow(true)}>Gerar</Button>
        {show && rows.length > 0 && (
          <div className="space-y-3">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Dias</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.codigo || "—"}</TableCell>
                    <TableCell>{p.client_name}</TableCell>
                    <TableCell><Badge className={billingColor[p.billing_type || ""] || ""}>{billingLabel[p.billing_type || ""] || p.billing_type}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(p.contract_value)}</TableCell>
                    <TableCell className="text-right">{p.dias != null ? `${p.dias}d` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows.map(p => ({ codigo: p.codigo, cliente: p.client_name, tipo: p.billing_type, valor: p.contract_value, dias: p.dias })), "nfs_pendentes.csv")}>
              <Download className="h-3 w-3 mr-1" /> Exportar CSV
            </Button>
          </div>
        )}
        {show && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma NF pendente.</p>}
      </CardContent>
    </Card>
  );
}

// ─── Report 3: Medições do mês ───
function ReportMedicoesMes() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [show, setShow] = useState(false);
  const { data: measurements } = useMeasurements();
  const { data: projects } = useProjects();
  const { data: clients } = useClients();

  const clientMap = useMemo(() => new Map((clients || []).map(c => [c.id, c.name])), [clients]);
  const projMap = useMemo(() => new Map((projects || []).map(p => [p.id, p])), [projects]);

  const rows = useMemo(() => {
    if (!show || !measurements) return [];
    const s = startOfMonth(new Date(year, month));
    const e = endOfMonth(new Date(year, month));
    return measurements.filter(m => {
      const ps = parseISO(m.period_start);
      const pe = parseISO(m.period_end);
      return ps >= s && pe <= e;
    }).map(m => {
      const proj = m.project_id ? projMap.get(m.project_id) : null;
      return { ...m, project_codigo: proj?.codigo || "—", client_name: proj?.client_id ? clientMap.get(proj.client_id) || "—" : "—" };
    });
  }, [show, month, year, measurements, projMap, clientMap]);

  const somaAprovada = rows.filter(r => r.status === "aprovada").reduce((s, r) => s + (r.valor_bruto || 0), 0);
  const somaPaga = rows.filter(r => r.status === "paga").reduce((s, r) => s + (r.valor_bruto || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Medições do mês</CardTitle>
        <CardDescription>Medições dentro do período selecionado</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <MonthPick month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <Button size="sm" onClick={() => setShow(true)}>Gerar</Button>
        </div>
        {show && rows.length > 0 && (
          <div className="space-y-3">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código BM</TableHead><TableHead>Projeto</TableHead><TableHead>Cliente</TableHead><TableHead>Período</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">NF</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.codigo_bm}</TableCell>
                    <TableCell>{m.project_codigo}</TableCell>
                    <TableCell>{m.client_name}</TableCell>
                    <TableCell className="text-xs">{format(parseISO(m.period_start), "dd/MM")} - {format(parseISO(m.period_end), "dd/MM")}</TableCell>
                    <TableCell className="text-right">{fmt(m.valor_bruto)}</TableCell>
                    <TableCell className="text-right">{fmt(m.valor_nf)}</TableCell>
                    <TableCell><Badge className={statusColor[m.status] || "bg-gray-100 text-gray-800"}>{m.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-6 text-sm border-t pt-2">
              <span>Aprovadas: <strong>{fmt(somaAprovada)}</strong></span>
              <span>Pagas: <strong>{fmt(somaPaga)}</strong></span>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows.map(m => ({ codigo_bm: m.codigo_bm, projeto: m.project_codigo, cliente: m.client_name, periodo: `${m.period_start} a ${m.period_end}`, valor_bruto: m.valor_bruto, valor_nf: m.valor_nf, status: m.status })), "medicoes_mes.csv")}>
              <Download className="h-3 w-3 mr-1" /> Exportar CSV
            </Button>
          </div>
        )}
        {show && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma medição no período.</p>}
      </CardContent>
    </Card>
  );
}

// ─── Report 4: Projeção do mês ───
function ReportProjecao() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [show, setShow] = useState(false);
  const { data: projects } = useProjects();
  const { data: measurements } = useMeasurements();

  const result = useMemo(() => {
    if (!show) return null;
    const s = startOfMonth(new Date(year, month));
    const e = endOfMonth(new Date(year, month));
    const entregas = (projects || []).filter(p => {
      if (!p.delivery_deadline) return false;
      const d = parseISO(p.delivery_deadline);
      return d >= s && d <= e;
    });
    const meds = (measurements || []).filter(m => {
      const ps = parseISO(m.period_start);
      return ps >= s && ps <= e;
    });
    const somaEntregas = entregas.reduce((a, p) => a + (p.contract_value || 0), 0);
    const somaMeds = meds.reduce((a, m) => a + (m.valor_bruto || 0), 0);
    return { entregas: entregas.length, somaEntregas, medicoes: meds.length, somaMeds, total: somaEntregas + somaMeds };
  }, [show, month, year, projects, measurements]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Projeção do mês</CardTitle>
        <CardDescription>Entregas e medições previstas para o mês</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <MonthPick month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <Button size="sm" onClick={() => setShow(true)}>Gerar</Button>
        </div>
        {show && result && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Entregas previstas</p>
              <p className="text-2xl font-bold">{result.entregas}</p>
              <p className="text-sm font-medium">{fmt(result.somaEntregas)}</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Medições previstas</p>
              <p className="text-2xl font-bold">{result.medicoes}</p>
              <p className="text-sm font-medium">{fmt(result.somaMeds)}</p>
            </div>
            <div className="border rounded-lg p-4 text-center bg-primary/5">
              <p className="text-sm text-muted-foreground">Total projetado</p>
              <p className="text-2xl font-bold text-primary">{fmt(result.total)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Report 5: Receita realizada ───
function ReportReceitaRealizada() {
  const [start, setStart] = useState<Date | undefined>();
  const [end, setEnd] = useState<Date | undefined>();
  const [show, setShow] = useState(false);
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const clientMap = useMemo(() => new Map((clients || []).map(c => [c.id, c.name])), [clients]);

  const rows = useMemo(() => {
    if (!show || !start || !end || !projects) return [];
    return projects.filter(p => {
      if (p.execution_status !== "pago") return false;
      const d = parseISO(p.updated_at);
      return isWithinInterval(d, { start, end });
    });
  }, [show, start, end, projects]);

  const byClient = useMemo(() => {
    const g: Record<string, { name: string; byEmpresa: Record<string, number>; total: number }> = {};
    rows.forEach(r => {
      const cid = r.client_id || "sem_cliente";
      const cname = r.client_id ? clientMap.get(r.client_id) || "Sem cliente" : "Sem cliente";
      if (!g[cid]) g[cid] = { name: cname, byEmpresa: {}, total: 0 };
      const emp = r.empresa_faturadora || "Não informado";
      g[cid].byEmpresa[emp] = (g[cid].byEmpresa[emp] || 0) + (r.contract_value || 0);
      g[cid].total += r.contract_value || 0;
    });
    return Object.values(g).sort((a, b) => b.total - a.total);
  }, [rows, clientMap]);

  const totalGeral = rows.reduce((s, r) => s + (r.contract_value || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Receita realizada</CardTitle>
        <CardDescription>Projetos pagos no período, agrupados por cliente</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <DatePick date={start} onChange={setStart} label="Início" />
          <DatePick date={end} onChange={setEnd} label="Fim" />
          <Button size="sm" disabled={!start || !end} onClick={() => setShow(true)}>Gerar</Button>
        </div>
        {show && byClient.length > 0 && (
          <div className="space-y-3">
            {byClient.map((c, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="font-semibold text-sm">{fmt(c.total)}</span>
                </div>
                {Object.entries(c.byEmpresa).map(([emp, val]) => (
                  <div key={emp} className="flex justify-between text-xs text-muted-foreground pl-3">
                    <span>{emp === "ag_topografia" ? "AG Topografia" : emp === "ag_cartografia" ? "AG Cartografia" : emp}</span>
                    <span>{fmt(val)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total geral</span><span>{fmt(totalGeral)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows.map(p => ({ codigo: p.codigo, nome: p.name, cliente: p.client_id ? clientMap.get(p.client_id) : "", empresa: p.empresa_faturadora, valor: p.contract_value })), "receita_realizada.csv")}>
              <Download className="h-3 w-3 mr-1" /> Exportar CSV
            </Button>
          </div>
        )}
        {show && byClient.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto pago no período.</p>}
      </CardContent>
    </Card>
  );
}

export default function FaturamentoRelatorios() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ReportFaturamentoPeriodo />
      <ReportNfsPendentes />
      <ReportMedicoesMes />
      <ReportProjecao />
      <ReportReceitaRealizada />
    </div>
  );
}
