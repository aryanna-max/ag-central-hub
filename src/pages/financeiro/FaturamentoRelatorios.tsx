import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Download, FileText, AlertCircle, BarChart3, TrendingUp, DollarSign, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, parseISO, subMonths, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useMeasurements } from "@/hooks/useMeasurements";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (v: number | null | undefined) => v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

const billingLabel: Record<string, string> = {
  medicao_mensal: "Medição Mensal", entrega_nf: "NF na Entrega", entrega_recibo: "Recibo na Entrega",
  misto: "Misto", sem_documento: "Sem documento",
};
const billingColor: Record<string, string> = {
  medicao_mensal: "bg-blue-100 text-blue-800", entrega_nf: "bg-green-100 text-green-800",
  entrega_recibo: "bg-amber-100 text-amber-800", misto: "bg-purple-100 text-purple-800",
  sem_documento: "bg-gray-100 text-gray-800",
};
const statusColor: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-800", aguardando_aprovacao: "bg-yellow-100 text-yellow-800",
  aprovada: "bg-green-100 text-green-800", nf_emitida: "bg-blue-100 text-blue-800",
  paga: "bg-emerald-100 text-emerald-800", cancelada: "bg-red-100 text-red-800",
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

function ExportButtons({ onCsv }: { onCsv: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => toast.info("Exportação PDF em breve")}>
        <Download className="h-3 w-3 mr-1" /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => toast.info("Exportação Excel em breve")}>
        <Download className="h-3 w-3 mr-1" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={onCsv}>
        <Download className="h-3 w-3 mr-1" /> CSV
      </Button>
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
      if (p.execution_status !== "pago") return false;
      const ref = p.delivered_at || p.updated_at;
      if (!ref) return false;
      const d = parseISO(ref);
      return isWithinInterval(d, { start, end });
    });
  }, [show, start, end, projects]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof rows> = {};
    rows.forEach(r => { const bt = r.billing_type || "sem_tipo"; (g[bt] = g[bt] || []).push(r); });
    return g;
  }, [rows]);

  const byEmpresa = useMemo(() => {
    const g: Record<string, number> = {};
    rows.forEach(r => { const e = r.empresa_faturadora || "Não informado"; g[e] = (g[e] || 0) + (r.contract_value || 0); });
    return g;
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Faturamento por período</CardTitle>
        <CardDescription>Projetos pagos no período, agrupados por tipo e empresa</CardDescription>
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
                  <span className="text-sm text-muted-foreground">({items.length})</span>
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
                <div key={e} className="flex justify-between text-sm">
                  <span>{e === "ag_topografia" ? "AG Topografia" : e === "ag_cartografia" ? "AG Cartografia" : e}</span>
                  <span className="font-medium">{fmt(v)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t pt-1">
                <span>Total geral</span><span>{fmt(rows.reduce((s, r) => s + (r.contract_value || 0), 0))}</span>
              </div>
            </div>
            <ExportButtons onCsv={() => exportCsv(rows.map(p => ({ codigo: p.codigo, nome: p.name, cliente: p.client_id ? clientMap.get(p.client_id) : "", tipo: p.billing_type, valor: p.contract_value, empresa: p.empresa_faturadora })), "faturamento_periodo.csv")} />
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
    return projects.filter(p => p.execution_status === "entregue")
      .map(p => ({
        ...p,
        client_name: p.client_id ? clientMap.get(p.client_id) || "—" : "—",
        dias: p.delivered_at ? differenceInDays(new Date(), parseISO(p.delivered_at)) : null,
      }))
      .sort((a, b) => (b.dias || 0) - (a.dias || 0));
  }, [show, projects, clientMap]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-4 w-4" /> NFs pendentes</CardTitle>
        <CardDescription>Projetos entregues aguardando emissão de documento</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="sm" onClick={() => setShow(true)}>Gerar</Button>
        {show && rows.length > 0 && (
          <div className="space-y-3">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Dias sem NF</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.codigo || "—"}</TableCell>
                    <TableCell>{p.client_name}</TableCell>
                    <TableCell className="text-right">{fmt(p.contract_value)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn("text-xs", (p.dias || 0) > 30 ? "border-destructive text-destructive" : "")}>
                        {p.dias != null ? `${p.dias}d` : "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ExportButtons onCsv={() => exportCsv(rows.map(p => ({ codigo: p.codigo, cliente: p.client_name, valor: p.contract_value, dias_sem_nf: p.dias })), "nfs_pendentes.csv")} />
          </div>
        )}
        {show && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma NF pendente.</p>}
      </CardContent>
    </Card>
  );
}

// ─── Report 3: Medições por status ───
function ReportMedicoesPorStatus() {
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
      const d = parseISO(m.period_start);
      return d >= s && d <= e;
    }).map(m => {
      const proj = m.project_id ? projMap.get(m.project_id) : null;
      return { ...m, project_codigo: proj?.codigo || "—", client_name: proj?.client_id ? clientMap.get(proj.client_id) || "—" : "—" };
    });
  }, [show, month, year, measurements, projMap, clientMap]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    rows.forEach(r => { t[r.status] = (t[r.status] || 0) + (r.valor_bruto || 0); });
    return t;
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Medições por status</CardTitle>
        <CardDescription>Todas as medições do período com totais por status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <MonthPick month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <Button size="sm" onClick={() => setShow(true)}>Gerar</Button>
        </div>
        {show && rows.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm border-b pb-2">
              {Object.entries(totals).map(([st, val]) => (
                <span key={st}><Badge className={statusColor[st] || "bg-gray-100"}>{st}</Badge> {fmt(val)}</span>
              ))}
            </div>
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
            <ExportButtons onCsv={() => exportCsv(rows.map(m => ({ codigo_bm: m.codigo_bm, projeto: m.project_codigo, cliente: m.client_name, valor_bruto: m.valor_bruto, valor_nf: m.valor_nf, status: m.status })), "medicoes_status.csv")} />
          </div>
        )}
        {show && rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma medição no período.</p>}
      </CardContent>
    </Card>
  );
}

// ─── Report 4: Aging — A receber ───
function ReportAging() {
  const [show, setShow] = useState(false);
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const clientMap = useMemo(() => new Map((clients || []).map(c => [c.id, c.name])), [clients]);

  const rows = useMemo(() => {
    if (!show || !projects) return [];
    return projects
      .filter(p => p.execution_status === "faturamento")
      .map(p => ({
        ...p,
        client_name: p.client_id ? clientMap.get(p.client_id) || "—" : "—",
        dias: p.delivered_at ? differenceInDays(new Date(), parseISO(p.delivered_at)) : 0,
      }))
      .sort((a, b) => b.dias - a.dias);
  }, [show, projects, clientMap]);

  const faixas = useMemo(() => {
    const f = [
      { label: "0–30 dias", min: 0, max: 30, items: [] as typeof rows, total: 0 },
      { label: "31–60 dias", min: 31, max: 60, items: [] as typeof rows, total: 0 },
      { label: "61–90 dias", min: 61, max: 90, items: [] as typeof rows, total: 0 },
      { label: "90+ dias", min: 91, max: Infinity, items: [] as typeof rows, total: 0 },
    ];
    rows.forEach(r => {
      const fx = f.find(x => r.dias >= x.min && r.dias <= x.max);
      if (fx) { fx.items.push(r); fx.total += r.contract_value || 0; }
    });
    return f;
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Aging — A receber</CardTitle>
        <CardDescription>Projetos em faturamento por faixa de tempo desde entrega</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="sm" onClick={() => setShow(true)}>Gerar</Button>
        {show && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {faixas.map(f => (
                <div key={f.label} className="border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-lg font-bold">{f.items.length}</p>
                  <p className="text-xs font-medium">{fmt(f.total)}</p>
                </div>
              ))}
            </div>
            {rows.length > 0 && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Dias em aberto</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map(p => (
                    <TableRow key={p.id} className={cn(p.dias > 60 ? "bg-red-50 dark:bg-red-950/20" : p.dias > 30 ? "bg-yellow-50 dark:bg-yellow-950/20" : "")}>
                      <TableCell className="font-mono text-xs">{p.codigo || "—"}</TableCell>
                      <TableCell>{p.client_name}</TableCell>
                      <TableCell className="text-right">{fmt(p.contract_value)}</TableCell>
                      <TableCell className="text-right">{p.dias}d</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto em faturamento.</p>}
            {rows.length > 0 && (
              <ExportButtons onCsv={() => exportCsv(rows.map(p => ({ codigo: p.codigo, cliente: p.client_name, valor: p.contract_value, dias: p.dias })), "aging_areceber.csv")} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Report 5: Receita realizada ───
function ReportReceitaRealizada() {
  const [start, setStart] = useState<Date | undefined>(() => subMonths(new Date(), 6));
  const [end, setEnd] = useState<Date | undefined>(new Date());
  const [show, setShow] = useState(false);
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const clientMap = useMemo(() => new Map((clients || []).map(c => [c.id, c.name])), [clients]);

  const rows = useMemo(() => {
    if (!show || !start || !end || !projects) return [];
    return projects.filter(p => {
      if (p.execution_status !== "pago") return false;
      const ref = p.delivered_at || p.updated_at;
      if (!ref) return false;
      const d = parseISO(ref);
      return isWithinInterval(d, { start, end });
    });
  }, [show, start, end, projects]);

  const byClient = useMemo(() => {
    const g: Record<string, { name: string; total: number }> = {};
    const totalGeral = rows.reduce((s, r) => s + (r.contract_value || 0), 0);
    rows.forEach(r => {
      const cid = r.client_id || "sem_cliente";
      const cname = r.client_id ? clientMap.get(r.client_id) || "Sem cliente" : "Sem cliente";
      if (!g[cid]) g[cid] = { name: cname, total: 0 };
      g[cid].total += r.contract_value || 0;
    });
    return Object.values(g).sort((a, b) => b.total - a.total).map(c => ({
      ...c,
      pct: totalGeral > 0 ? Math.round((c.total / totalGeral) * 100) : 0,
    }));
  }, [rows, clientMap]);

  const chartData = useMemo(() => {
    if (!start || !end || !rows.length) return [];
    const months = eachMonthOfInterval({ start, end });
    return months.map(m => {
      const s = startOfMonth(m);
      const e = endOfMonth(m);
      const total = rows.filter(r => {
        const ref = r.delivered_at || r.updated_at;
        if (!ref) return false;
        const d = parseISO(ref);
        return d >= s && d <= e;
      }).reduce((sum, r) => sum + (r.contract_value || 0), 0);
      return { month: format(m, "MMM/yy", { locale: ptBR }), total };
    });
  }, [start, end, rows]);

  const totalGeral = rows.reduce((s, r) => s + (r.contract_value || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Receita realizada</CardTitle>
        <CardDescription>Projetos pagos no período, por cliente + gráfico mensal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <DatePick date={start} onChange={setStart} label="Início" />
          <DatePick date={end} onChange={setEnd} label="Fim" />
          <Button size="sm" disabled={!start || !end} onClick={() => setShow(true)}>Gerar</Button>
        </div>
        {show && byClient.length > 0 && (
          <div className="space-y-4">
            {chartData.length > 1 && (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <Table>
              <TableHeader><TableRow>
                <TableHead>Cliente</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">%</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byClient.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(c.total)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.pct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t pt-2 flex justify-between font-semibold text-sm">
              <span>Total geral</span><span>{fmt(totalGeral)}</span>
            </div>
            <ExportButtons onCsv={() => exportCsv(byClient.map(c => ({ cliente: c.name, valor: c.total, percentual: c.pct })), "receita_realizada.csv")} />
          </div>
        )}
        {show && byClient.length === 0 && <p className="text-sm text-muted-foreground">Nenhum projeto pago no período.</p>}
      </CardContent>
    </Card>
  );
}

// ─── Report 6: Projeção vs Realizado ───
function ReportProjecaoVsRealizado() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [show, setShow] = useState(false);
  const { data: projects } = useProjects();

  const result = useMemo(() => {
    if (!show || !projects) return null;
    const s = startOfMonth(new Date(year, month));
    const e = endOfMonth(new Date(year, month));

    const entregues = projects.filter(p => {
      if (!p.delivered_at) return false;
      const d = parseISO(p.delivered_at);
      return d >= s && d <= e;
    });
    const pagos = projects.filter(p => {
      if (p.execution_status !== "pago") return false;
      const ref = p.updated_at;
      if (!ref) return false;
      const d = parseISO(ref);
      return d >= s && d <= e;
    });

    const somaEntregues = entregues.reduce((a, p) => a + (p.contract_value || 0), 0);
    const somaPagos = pagos.reduce((a, p) => a + (p.contract_value || 0), 0);

    return { entregues: entregues.length, somaEntregues, pagos: pagos.length, somaPagos };
  }, [show, month, year, projects]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Projeção vs Realizado</CardTitle>
        <CardDescription>Entregues vs pagos no mês</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <MonthPick month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <Button size="sm" onClick={() => setShow(true)}>Gerar</Button>
        </div>
        {show && result && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Entregues no mês</p>
              <p className="text-2xl font-bold">{result.entregues}</p>
              <p className="text-sm font-medium">{fmt(result.somaEntregues)}</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Pagos no mês</p>
              <p className="text-2xl font-bold text-emerald-600">{result.pagos}</p>
              <p className="text-sm font-medium">{fmt(result.somaPagos)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FaturamentoRelatorios() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ReportFaturamentoPeriodo />
      <ReportNfsPendentes />
      <ReportMedicoesPorStatus />
      <ReportAging />
      <ReportReceitaRealizada />
      <ReportProjecaoVsRealizado />
    </div>
  );
}
