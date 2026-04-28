import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { MoreHorizontal, FileText, CheckCircle, XCircle, Eye, CalendarIcon, Info } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import MeasurementViewDialog from "@/components/operacional/medicoes/MeasurementViewDialog";

const STATUSES_ORDERED = ["rascunho", "aguardando_aprovacao", "aprovada", "nf_emitida", "paga"] as const;

const statusLabels: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
  aguardando_aprovacao: { label: "Aguardando aprovação", color: "bg-yellow-100 text-yellow-800" },
  aprovada: { label: "Aprovada", color: "bg-emerald-100 text-emerald-800" },
  nf_emitida: { label: "NF Emitida", color: "bg-blue-100 text-blue-800" },
  paga: { label: "Paga", color: "bg-green-100 text-green-800" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-800" },
};

const measurementTypeLabels: Record<string, { label: string; color: string }> = {
  grid_diarias: { label: "Grid Diárias", color: "bg-purple-100 text-purple-800" },
  boletim_formal: { label: "Boletim Formal", color: "bg-indigo-100 text-indigo-800" },
  resumo_entrega: { label: "Resumo Entrega", color: "bg-sky-100 text-sky-800" },
};

function StatusProgressBar({ current }: { current: string }) {
  const idx = STATUSES_ORDERED.indexOf(current as any);
  if (idx < 0) return null;
  return (
    <div className="flex items-center gap-0.5 w-full max-w-[200px]">
      {STATUSES_ORDERED.map((s, i) => (
        <div
          key={s}
          className={cn(
            "h-1.5 flex-1 rounded-full",
            i <= idx ? "bg-primary" : "bg-muted"
          )}
          title={statusLabels[s]?.label}
        />
      ))}
    </div>
  );
}

function AvancoBar({ pct }: { pct: number | null | undefined }) {
  const v = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div className="flex items-center gap-2 w-[110px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${v}%` }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums w-9 text-right">{v.toFixed(0)}%</span>
    </div>
  );
}

const fmtCurrency = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function FaturamentoMedicoes() {
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterClient, setFilterClient] = useState("todos");
  const [filterType, setFilterType] = useState("todos");
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonthEnabled, setFilterMonthEnabled] = useState(false);

  // NF registration modal
  const [nfDialogId, setNfDialogId] = useState<string | null>(null);
  const [nfNumero, setNfNumero] = useState("");
  const [nfData, setNfData] = useState<Date | undefined>(new Date());
  const [nfValor, setNfValor] = useState("");
  const [nfEmpresa, setNfEmpresa] = useState("ag_topografia");

  // Payment modal
  const [payModalId, setPayModalId] = useState<string | null>(null);
  const [payValue, setPayValue] = useState("");
  const [payDate, setPayDate] = useState<Date | undefined>(new Date());
  const [payMethod, setPayMethod] = useState("pix");
  const [payRef, setPayRef] = useState("");
  const [payObs, setPayObs] = useState("");

  // View detail modal (reutiliza o do operacional)
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ["faturamento-medicoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const projectIds = [...new Set((data || []).map((m: any) => m.project_id).filter(Boolean))];
      let projectsMap: Record<string, any> = {};
      let clientsMap: Record<string, any> = {};

      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, codigo, name, client_id, instrucao_faturamento_variavel")
          .in("id", projectIds);
        (projects || []).forEach((p: any) => { projectsMap[p.id] = p; });

        const clientIds = [...new Set((projects || []).map((p: any) => p.client_id).filter(Boolean))];
        if (clientIds.length > 0) {
          const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
          (clients || []).forEach((c: any) => { clientsMap[c.id] = c; });
        }
      }

      return (data || []).map((m: any) => {
        const proj = m.project_id ? projectsMap[m.project_id] : null;
        const client = proj?.client_id ? clientsMap[proj.client_id] : null;
        return {
          ...m,
          project_codigo: proj?.codigo,
          project_name: proj?.name,
          client_name: client?.name,
          client_id_resolved: proj?.client_id,
        };
      });
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["faturamento-medicoes-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("measurements").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamento-medicoes"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const registerNfMutation = useMutation({
    mutationFn: async () => {
      if (!nfDialogId || !nfNumero.trim()) throw new Error("Número da NF obrigatório");
      const measurement = measurements.find((m: any) => m.id === nfDialogId);
      if (!measurement) throw new Error("Medição não encontrada");

      const { error } = await supabase.from("measurements").update({
        nf_numero: nfNumero,
        nf_data: nfData ? format(nfData, "yyyy-MM-dd") : null,
        valor_nf: nfValor ? parseFloat(nfValor) : measurement.valor_nf,
        empresa_faturadora: nfEmpresa,
        status: "nf_emitida",
      }).eq("id", nfDialogId);
      if (error) throw error;

      if (measurement.project_id) {
        const tipoDoc: "nf" | "recibo" = measurement.tipo_documento === "recibo" ? "recibo" : "nf";
        const empresaFat = nfEmpresa === "ag_cartografia" ? "ag_cartografia" as const : "ag_topografia" as const;
        await supabase.from("invoices").insert({
          project_id: measurement.project_id,
          tipo: tipoDoc,
          nf_numero: nfNumero,
          nf_data: nfData ? format(nfData, "yyyy-MM-dd") : null,
          valor_bruto: measurement.valor_bruto ?? 0,
          retencao: measurement.valor_retencao ?? 0,
          valor_liquido: nfValor ? parseFloat(nfValor) : measurement.valor_nf ?? 0,
          empresa_faturadora: empresaFat,
          status: "emitida",
          notes: `Medição ${measurement.codigo_bm}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamento-medicoes"] });
      toast.success("NF registrada");
      setNfDialogId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!payModalId) return;
      const { error } = await supabase.from("measurements").update({ status: "paga" }).eq("id", payModalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamento-medicoes"] });
      queryClient.invalidateQueries({ queryKey: ["areceber-measurements"] });
      toast.success("Pagamento confirmado");
      setPayModalId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNfDialog = useCallback((m: any) => {
    setNfDialogId(m.id);
    setNfNumero("");
    setNfData(new Date());
    setNfValor(String(m.valor_nf || m.valor_bruto || ""));
    setNfEmpresa(m.empresa_faturadora || "ag_topografia");
  }, []);

  const openPayModal = useCallback((m: any) => {
    setPayModalId(m.id);
    setPayValue(String(m.valor_nf || ""));
    setPayDate(new Date());
    setPayMethod("pix");
    setPayRef("");
    setPayObs("");
  }, []);

  const filtered = useMemo(() => {
    let list = measurements;
    if (filterStatus !== "todos") list = list.filter((m: any) => m.status === filterStatus);
    if (filterClient !== "todos") list = list.filter((m: any) => m.client_id_resolved === filterClient);
    if (filterType !== "todos") list = list.filter((m: any) => m.measurement_type === filterType);
    if (filterMonthEnabled) {
      const s = startOfMonth(new Date(filterYear, filterMonth));
      const e = endOfMonth(new Date(filterYear, filterMonth));
      list = list.filter((m: any) => {
        if (!m.period_start) return false;
        const d = new Date(m.period_start + "T12:00:00");
        return d >= s && d <= e;
      });
    }
    return list;
  }, [measurements, filterStatus, filterClient, filterType, filterMonthEnabled, filterMonth, filterYear]);

  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = [2025, 2026, 2027];

  return (
    <div className="space-y-4">
      {/* Banner informativo — financeiro não cria mais medição */}
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          Medições são criadas e editadas pelo <strong>Operacional</strong> (Marcelo) a partir da escala real.
          Aqui você acompanha o andamento, registra NF e confirma pagamentos.
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(measurementTypeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button
            variant={filterMonthEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMonthEnabled(!filterMonthEnabled)}
          >
            <CalendarIcon className="w-3.5 h-3.5 mr-1" />
            Mês/Ano
          </Button>
          {filterMonthEnabled && (
            <>
              <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(Number(v))}>
                <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m} value={String(m)}>{format(new Date(2026, m), "MMMM", { locale: ptBR })}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}>
                <SelectTrigger className="w-[80px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} medição(ões)</p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código BM</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Valor NF</TableHead>
                  <TableHead>Avanço Acum.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma medição encontrada</TableCell></TableRow>
                ) : (
                  filtered.map((m: any) => {
                    const st = statusLabels[m.status] || { label: m.status, color: "bg-muted text-foreground" };
                    const tp = measurementTypeLabels[m.measurement_type] || null;
                    return (
                      <TableRow
                        key={m.id}
                        className={cn("cursor-pointer", m.status === "cancelada" && "opacity-50")}
                        onClick={() => setViewId(m.id)}
                      >
                        <TableCell className="font-mono font-semibold">{m.codigo_bm || "—"}</TableCell>
                        <TableCell>
                          {tp ? (
                            <Badge variant="outline" className={`text-[10px] ${tp.color}`}>{tp.label}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{m.project_codigo || "—"}</TableCell>
                        <TableCell>{m.client_name || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {m.period_start && m.period_end
                            ? `${format(new Date(m.period_start + "T12:00:00"), "dd/MM/yy")} — ${format(new Date(m.period_end + "T12:00:00"), "dd/MM/yy")}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">{fmtCurrency(m.valor_bruto)}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(m.valor_nf)}</TableCell>
                        <TableCell>
                          <AvancoBar pct={m.avanco_acumulado_pct} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {m.status !== "cancelada" && <StatusProgressBar current={m.status} />}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewId(m.id)}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> Ver detalhes
                              </DropdownMenuItem>

                              {/* aprovada → registrar NF (ação financeira) */}
                              {m.status === "aprovada" && (
                                <DropdownMenuItem onClick={() => openNfDialog(m)}>
                                  <FileText className="w-3.5 h-3.5 mr-2" /> Registrar NF
                                </DropdownMenuItem>
                              )}

                              {/* nf_emitida → confirmar pagamento (ação financeira) */}
                              {m.status === "nf_emitida" && (
                                <DropdownMenuItem onClick={() => openPayModal(m)}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-2" /> Confirmar pagamento
                                </DropdownMenuItem>
                              )}

                              {/* cancel from any non-final */}
                              {!["paga", "cancelada"].includes(m.status) && (
                                <DropdownMenuItem
                                  onClick={() => updateStatus.mutate({ id: m.id, status: "cancelada" })}
                                  className="text-destructive"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-2" /> Cancelar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog (reutiliza do operacional) */}
      {viewId && (
        <MeasurementViewDialog
          measurementId={viewId}
          open={!!viewId}
          onOpenChange={(o) => !o && setViewId(null)}
        />
      )}

      {/* Register NF Dialog */}
      <Dialog open={!!nfDialogId} onOpenChange={() => setNfDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar NF</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Número da NF *</Label>
              <Input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} placeholder="Ex: 2026-NF-001" />
            </div>
            <div>
              <Label>Data da NF</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !nfData && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {nfData ? format(nfData, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={nfData} onSelect={setNfData} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Valor da NF (R$)</Label>
              <Input type="number" step="0.01" value={nfValor} onChange={(e) => setNfValor(e.target.value)} />
            </div>
            <div>
              <Label>Empresa faturadora</Label>
              <Select value={nfEmpresa} onValueChange={setNfEmpresa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ag_topografia">AG Topografia</SelectItem>
                  <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNfDialogId(null)}>Cancelar</Button>
            <Button onClick={() => registerNfMutation.mutate()} disabled={!nfNumero.trim() || registerNfMutation.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment confirmation modal */}
      <Dialog open={!!payModalId} onOpenChange={() => setPayModalId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pagamento recebido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor recebido (R$)</Label>
              <Input type="number" step="0.01" value={payValue} onChange={(e) => setPayValue(e.target.value)} />
            </div>
            <div>
              <Label>Data do recebimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !payDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {payDate ? format(payDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
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
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder='Ex: "PIX 14:32 BB"' />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={payObs} onChange={(e) => setPayObs(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModalId(null)}>Cancelar</Button>
            <Button onClick={() => confirmPaymentMutation.mutate()} disabled={confirmPaymentMutation.isPending}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
