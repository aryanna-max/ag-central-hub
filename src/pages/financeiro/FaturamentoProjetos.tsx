import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, DollarSign, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, differenceInDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmtCurrency = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const empresaLabel = (e: string) =>
  e === "ag_topografia" ? "AG Topografia" : e === "ag_cartografia" ? "AG Cartografia" : e || "—";

export default function FaturamentoProjetos() {
  const qc = useQueryClient();
  const [filterClient, setFilterClient] = useState("todos");
  const [filterEmpresa, setFilterEmpresa] = useState("todos");
  const [filterDias, setFilterDias] = useState("todos");

  // Payment modal state
  const [payModal, setPayModal] = useState<{ type: "project" | "measurement"; id: string; defaultValue: number } | null>(null);
  const [payValue, setPayValue] = useState("");
  const [payDate, setPayDate] = useState<Date | undefined>(new Date());
  const [payMethod, setPayMethod] = useState("pix");
  const [payRef, setPayRef] = useState("");
  const [payObs, setPayObs] = useState("");

  // Fetch projects with execution_status = 'faturamento'
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["areceber-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, codigo, name, contract_value, empresa_faturadora, delivered_at, execution_status, updated_at, client_id")
        .in("execution_status", ["faturamento", "pago"] as any)
        .order("delivered_at", { ascending: true });
      if (error) throw error;

      const clientIds = [...new Set((data || []).map((p: any) => p.client_id).filter(Boolean))];
      let clientsMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
        (clients || []).forEach((c: any) => { clientsMap[c.id] = c.name; });
      }
      return (data || []).map((p: any) => ({
        ...p,
        client_name: p.client_id ? clientsMap[p.client_id] || "—" : "—",
        dias_em_aberto: p.delivered_at ? differenceInDays(new Date(), new Date(p.delivered_at + "T12:00:00")) : 0,
      }));
    },
  });

  // Fetch clients for filter
  const { data: clientsList = [] } = useQuery({
    queryKey: ["areceber-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch measurements with status = 'nf_emitida'
  const { data: measurements = [], isLoading: loadingMeasurements } = useQuery({
    queryKey: ["areceber-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("id, project_id, period_start, period_end, nf_numero, nf_data, valor_nf, status")
        .eq("status", "nf_emitida")
        .order("period_end", { ascending: true });
      if (error) throw error;

      const projectIds = [...new Set((data || []).map((m: any) => m.project_id).filter(Boolean))];
      let projectsMap: Record<string, { codigo: string; name: string; client_id: string }> = {};
      let clientsMap: Record<string, string> = {};

      if (projectIds.length > 0) {
        const { data: pData } = await supabase.from("projects").select("id, codigo, name, client_id").in("id", projectIds);
        (pData || []).forEach((p: any) => { projectsMap[p.id] = p; });
        const cIds = [...new Set((pData || []).map((p: any) => p.client_id).filter(Boolean))];
        if (cIds.length > 0) {
          const { data: cData } = await supabase.from("clients").select("id, name").in("id", cIds);
          (cData || []).forEach((c: any) => { clientsMap[c.id] = c.name; });
        }
      }

      return (data || []).map((m: any) => {
        const proj = m.project_id ? projectsMap[m.project_id] : null;
        return {
          ...m,
          project_codigo: proj?.codigo || "—",
          project_name: proj?.name || "—",
          client_name: proj?.client_id ? clientsMap[proj.client_id] || "—" : "—",
        };
      });
    },
  });

  // Summary cards
  const summary = useMemo(() => {
    const faturamento = projects.filter((p: any) => p.execution_status === "faturamento");
    const now = new Date();
    const monthStart = startOfMonth(now);

    const emCobranca = faturamento;
    const vencido30 = faturamento.filter((p: any) => p.dias_em_aberto > 30);
    const vencido60 = faturamento.filter((p: any) => p.dias_em_aberto > 60);
    const pagoMes = projects.filter((p: any) =>
      p.execution_status === "pago" && p.updated_at && new Date(p.updated_at) >= monthStart
    );

    const sum = (arr: any[]) => arr.reduce((s, p) => s + (p.contract_value || 0), 0);

    return {
      emCobranca: { count: emCobranca.length, total: sum(emCobranca) },
      vencido30: { count: vencido30.length, total: sum(vencido30) },
      vencido60: { count: vencido60.length, total: sum(vencido60) },
      pagoMes: { count: pagoMes.length, total: sum(pagoMes) },
    };
  }, [projects]);

  // Filtered list (only faturamento for main table)
  const filteredProjects = useMemo(() => {
    let list = projects.filter((p: any) => p.execution_status === "faturamento");

    if (filterClient !== "todos") list = list.filter((p: any) => p.client_id === filterClient);
    if (filterEmpresa !== "todos") list = list.filter((p: any) => p.empresa_faturadora === filterEmpresa);
    if (filterDias === ">30") list = list.filter((p: any) => p.dias_em_aberto > 30);
    else if (filterDias === ">60") list = list.filter((p: any) => p.dias_em_aberto > 60);

    return list;
  }, [projects, filterClient, filterEmpresa, filterDias]);

  // Confirm payment mutations
  const confirmProjectPayment = useMutation({
    mutationFn: async () => {
      if (!payModal || payModal.type !== "project") return;
      await supabase
        .from("projects")
        .update({ execution_status: "pago", updated_at: new Date().toISOString() } as any)
        .eq("id", payModal.id);

      const proj = projects.find((p: any) => p.id === payModal.id);
      await supabase.from("alerts").insert({
        alert_type: "pagamento_confirmado",
        recipient: "diretoria",
        priority: "informacao",
        title: `Pagamento confirmado — ${proj?.codigo || ""}`,
        message: `${fmtCurrency(parseFloat(payValue))} recebido em ${payDate ? format(payDate, "dd/MM/yyyy") : "—"} via ${payMethod}. Ref: ${payRef || "—"}${payObs ? `. Obs: ${payObs}` : ""}`,
        reference_type: "project",
        reference_id: payModal.id,
        resolved: false,
        read: false,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["areceber-projects"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Pagamento confirmado com sucesso");
      setPayModal(null);
    },
    onError: () => toast.error("Erro ao confirmar pagamento"),
  });

  const confirmMeasurementPayment = useMutation({
    mutationFn: async () => {
      if (!payModal || payModal.type !== "measurement") return;
      await supabase
        .from("measurements")
        .update({ status: "paga" } as any)
        .eq("id", payModal.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["areceber-measurements"] });
      toast.success("Pagamento da medição confirmado");
      setPayModal(null);
    },
    onError: () => toast.error("Erro ao confirmar pagamento"),
  });

  const openPayModal = (type: "project" | "measurement", id: string, defaultValue: number) => {
    setPayModal({ type, id, defaultValue });
    setPayValue(String(defaultValue || ""));
    setPayDate(new Date());
    setPayMethod("pix");
    setPayRef("");
    setPayObs("");
  };

  const handleConfirm = () => {
    if (!payDate) { toast.error("Informe a data do recebimento"); return; }
    if (payModal?.type === "project") confirmProjectPayment.mutate();
    else confirmMeasurementPayment.mutate();
  };

  const rowBg = (dias: number) => {
    if (dias > 60) return "bg-red-50 dark:bg-red-950/20";
    if (dias > 30) return "bg-yellow-50 dark:bg-yellow-950/20";
    return "";
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Em cobrança
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{summary.emCobranca.count}</p>
            <p className="text-xs text-muted-foreground">{fmtCurrency(summary.emCobranca.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Vencido &gt; 30d
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-yellow-600">{summary.vencido30.count}</p>
            <p className="text-xs text-muted-foreground">{fmtCurrency(summary.vencido30.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Vencido &gt; 60d
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-destructive">{summary.vencido60.count}</p>
            <p className="text-xs text-muted-foreground">{fmtCurrency(summary.vencido60.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Pago este mês
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-emerald-600">{summary.pagoMes.count}</p>
            <p className="text-xs text-muted-foreground">{fmtCurrency(summary.pagoMes.total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clientsList.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas empresas</SelectItem>
            <SelectItem value="ag_topografia">AG Topografia</SelectItem>
            <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDias} onValueChange={setFilterDias}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Dias em aberto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value=">30">&gt; 30 dias</SelectItem>
            <SelectItem value=">60">&gt; 60 dias</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground ml-auto">{filteredProjects.length} projeto(s)</p>
      </div>

      {/* Projects table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Empresa faturadora</TableHead>
                  <TableHead>Entregue em</TableHead>
                  <TableHead className="text-right">Dias em aberto</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProjects ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filteredProjects.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum projeto aguardando pagamento</TableCell></TableRow>
                ) : filteredProjects.map((p: any) => (
                  <TableRow key={p.id} className={rowBg(p.dias_em_aberto)}>
                    <TableCell className="font-mono font-semibold">{p.codigo || "—"}</TableCell>
                    <TableCell>{p.client_name}</TableCell>
                    <TableCell className="text-right font-medium">{fmtCurrency(p.contract_value)}</TableCell>
                    <TableCell>{empresaLabel(p.empresa_faturadora)}</TableCell>
                    <TableCell>{p.delivered_at ? format(new Date(p.delivered_at + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        p.dias_em_aberto > 60 ? "border-destructive text-destructive" :
                        p.dias_em_aberto > 30 ? "border-yellow-500 text-yellow-700" : ""
                      )}>
                        {p.dias_em_aberto}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline" onClick={() => openPayModal("project", p.id, p.contract_value)}>
                        Confirmar pagamento
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Measurements table */}
      {(measurements.length > 0 || loadingMeasurements) && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Medições mensais — aguardando pagamento</h3>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>NF nº</TableHead>
                      <TableHead className="text-right">Valor NF</TableHead>
                      <TableHead>Emitida em</TableHead>
                      <TableHead className="text-center">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingMeasurements ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : measurements.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma medição aguardando pagamento</TableCell></TableRow>
                    ) : measurements.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.client_name}</TableCell>
                        <TableCell className="font-mono">{m.project_codigo}</TableCell>
                        <TableCell>
                          {format(new Date(m.period_start + "T12:00:00"), "dd/MM")} — {format(new Date(m.period_end + "T12:00:00"), "dd/MM/yy")}
                        </TableCell>
                        <TableCell>{m.nf_numero || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{fmtCurrency(m.valor_nf)}</TableCell>
                        <TableCell>{m.nf_data ? format(new Date(m.nf_data + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="outline" onClick={() => openPayModal("measurement", m.id, m.valor_nf || 0)}>
                            Confirmar pagamento
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment confirmation modal */}
      <Dialog open={!!payModal} onOpenChange={(open) => !open && setPayModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pagamento recebido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor recebido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={payValue}
                onChange={(e) => setPayValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Data do recebimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !payDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {payDate ? format(payDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={payDate} onSelect={setPayDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Forma de recebimento</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="deposito">Depósito</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referência bancária</Label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder='Ex: "PIX 14:32 BB Gonzaga"' />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={payObs} onChange={(e) => setPayObs(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModal(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmProjectPayment.isPending || confirmMeasurementPayment.isPending}
            >
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
