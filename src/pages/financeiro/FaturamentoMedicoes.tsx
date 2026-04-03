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
import { Plus, MoreHorizontal, Pencil, FileText, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusLabels: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
  aguardando_nf: { label: "Aguardando NF", color: "bg-amber-100 text-amber-800" },
  nf_emitida: { label: "NF Emitida", color: "bg-blue-100 text-blue-800" },
  pago: { label: "Pago", color: "bg-emerald-100 text-emerald-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

interface MeasurementForm {
  project_id: string;
  codigo_bm: string;
  empresa_faturadora: string;
  tipo_documento: string;
  period_start: string;
  period_end: string;
  dias_semana: number;
  dias_fds: number;
  valor_diaria_semana: number;
  valor_diaria_fds: number;
  retencao_pct: number;
  instrucao_faturamento: string;
  notes: string;
}

const emptyForm: MeasurementForm = {
  project_id: "",
  codigo_bm: "",
  empresa_faturadora: "ag_topografia",
  tipo_documento: "nota_fiscal",
  period_start: "",
  period_end: "",
  dias_semana: 0,
  dias_fds: 0,
  valor_diaria_semana: 0,
  valor_diaria_fds: 0,
  retencao_pct: 0,
  instrucao_faturamento: "",
  notes: "",
};

export default function FaturamentoMedicoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterClient, setFilterClient] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MeasurementForm>({ ...emptyForm });

  const [nfDialogId, setNfDialogId] = useState<string | null>(null);
  const [nfNumero, setNfNumero] = useState("");
  const [nfData, setNfData] = useState("");

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
          .select("id, codigo, name, client_id")
          .in("id", projectIds);
        (projects || []).forEach((p: any) => { projectsMap[p.id] = p; });

        const clientIds = [...new Set((projects || []).map((p: any) => p.client_id).filter(Boolean))];
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name")
            .in("id", clientIds);
          (clients || []).forEach((c: any) => { clientsMap[c.id] = c; });
        }
      }

      return (data || []).map((m: any) => {
        const proj = m.project_id ? projectsMap[m.project_id] : null;
        const client = proj?.client_id ? clientsMap[proj.client_id] : null;
        return { ...m, project_codigo: proj?.codigo, project_name: proj?.name, client_name: client?.name, client_id_resolved: proj?.client_id };
      });
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["faturamento-medicoes-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, codigo, name, billing_type")
        .eq("billing_type", "medicao_mensal")
        .eq("is_active", true)
        .order("codigo");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["faturamento-medicoes-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const valorBruto = (form.dias_semana * form.valor_diaria_semana) + (form.dias_fds * form.valor_diaria_fds);
  const valorRetencao = Math.round(valorBruto * (form.retencao_pct / 100) * 100) / 100;
  const valorNf = Math.round((valorBruto - valorRetencao) * 100) / 100;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: form.project_id || null,
        codigo_bm: form.codigo_bm,
        empresa_faturadora: form.empresa_faturadora,
        tipo_documento: form.tipo_documento,
        period_start: form.period_start,
        period_end: form.period_end,
        dias_semana: form.dias_semana,
        dias_fds: form.dias_fds,
        valor_diaria_semana: form.valor_diaria_semana,
        valor_diaria_fds: form.valor_diaria_fds,
        retencao_pct: form.retencao_pct,
        valor_bruto: valorBruto,
        valor_retencao: valorRetencao,
        valor_nf: valorNf,
        instrucao_faturamento: form.instrucao_faturamento || null,
        notes: form.notes || null,
        status: "rascunho",
      };

      if (editId) {
        const { error } = await supabase.from("measurements").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("measurements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editId ? "Medição atualizada" : "Medição criada" });
      queryClient.invalidateQueries({ queryKey: ["faturamento-medicoes"] });
      setDialogOpen(false);
      setEditId(null);
      setForm({ ...emptyForm });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("measurements").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamento-medicoes"] });
      toast({ title: "Status atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const registerNfMutation = useMutation({
    mutationFn: async () => {
      if (!nfDialogId || !nfNumero.trim()) throw new Error("Número da NF obrigatório");

      // Find the measurement data to populate the invoice
      const measurement = measurements.find((m: any) => m.id === nfDialogId);
      if (!measurement) throw new Error("Medição não encontrada");

      // Update measurement status
      const { error } = await supabase.from("measurements").update({
        nf_numero: nfNumero,
        nf_data: nfData || null,
        status: "nf_emitida",
      }).eq("id", nfDialogId);
      if (error) throw error;

      // Create linked invoice record
      if (measurement.project_id) {
        const tipoDoc: "nf" | "recibo" = measurement.tipo_documento === "recibo" ? "recibo" : "nf";
        const empresaFat = measurement.empresa_faturadora === "ag_cartografia" ? "ag_cartografia" as const : "ag_topografia" as const;

        const { error: invoiceError } = await supabase.from("invoices").insert({
          project_id: measurement.project_id,
          tipo: tipoDoc,
          nf_numero: nfNumero,
          nf_data: nfData || null,
          valor_bruto: measurement.valor_bruto ?? 0,
          retencao: measurement.valor_retencao ?? 0,
          valor_liquido: measurement.valor_nf ?? 0,
          empresa_faturadora: empresaFat,
          status: "emitida",
          notes: `Gerada a partir da medição ${measurement.codigo_bm}`,
        });
        if (invoiceError) {
          // Log but don't fail the NF registration — measurement is already updated
          console.error("Erro ao criar invoice vinculada:", invoiceError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturamento-medicoes"] });
      toast({ title: "NF registrada e fatura criada" });
      setNfDialogId(null);
      setNfNumero("");
      setNfData("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openEdit = useCallback((m: any) => {
    setForm({
      project_id: m.project_id || "",
      codigo_bm: m.codigo_bm,
      empresa_faturadora: m.empresa_faturadora,
      tipo_documento: m.tipo_documento,
      period_start: m.period_start,
      period_end: m.period_end,
      dias_semana: m.dias_semana,
      dias_fds: m.dias_fds,
      valor_diaria_semana: m.valor_diaria_semana,
      valor_diaria_fds: m.valor_diaria_fds,
      retencao_pct: m.retencao_pct,
      instrucao_faturamento: m.instrucao_faturamento || "",
      notes: m.notes || "",
    });
    setEditId(m.id);
    setDialogOpen(true);
  }, []);

  const filtered = useMemo(() => {
    let list = measurements;
    if (filterStatus !== "todos") list = list.filter((m: any) => m.status === filterStatus);
    if (filterClient !== "todos") list = list.filter((m: any) => m.client_id_resolved === filterClient);
    return list;
  }, [measurements, filterStatus, filterClient]);

  const fmtCurrency = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
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

        <div className="flex-1" />

        <Button onClick={() => { setForm({ ...emptyForm }); setEditId(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova medição
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código BM</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Valor Bruto</TableHead>
                  <TableHead className="text-right">Valor NF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma medição encontrada</TableCell></TableRow>
                ) : (
                  filtered.map((m: any) => {
                    const st = statusLabels[m.status] || { label: m.status, color: "bg-muted text-foreground" };
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono font-semibold">{m.codigo_bm}</TableCell>
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
                          <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {["rascunho", "aguardando_nf"].includes(m.status) && (
                                <DropdownMenuItem onClick={() => openEdit(m)}>
                                  <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                                </DropdownMenuItem>
                              )}
                              {["rascunho", "aguardando_nf"].includes(m.status) && (
                                <DropdownMenuItem onClick={() => { setNfDialogId(m.id); setNfNumero(""); setNfData(""); }}>
                                  <FileText className="w-3.5 h-3.5 mr-2" /> Registrar NF
                                </DropdownMenuItem>
                              )}
                              {m.status === "nf_emitida" && (
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: m.id, status: "pago" })}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-2" /> Marcar paga
                                </DropdownMenuItem>
                              )}
                              {!["pago", "cancelado"].includes(m.status) && (
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: m.id, status: "cancelado" })} className="text-destructive">
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Medição" : "Nova Medição"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Projeto *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Código BM *</Label>
              <Input value={form.codigo_bm} onChange={(e) => setForm({ ...form, codigo_bm: e.target.value })} placeholder="Ex: BM-2026-001" />
            </div>

            <div>
              <Label>Empresa Faturadora *</Label>
              <Select value={form.empresa_faturadora} onValueChange={(v) => setForm({ ...form, empresa_faturadora: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ag_topografia">AG Topografia</SelectItem>
                  <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo Documento *</Label>
              <Select value={form.tipo_documento} onValueChange={(v) => setForm({ ...form, tipo_documento: v, retencao_pct: v === "recibo" ? 0 : form.retencao_pct })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                  <SelectItem value="recibo">Recibo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Retenção %</Label>
              <Input
                type="number"
                value={form.retencao_pct}
                onChange={(e) => setForm({ ...form, retencao_pct: Number(e.target.value) })}
                disabled={form.tipo_documento === "recibo"}
              />
            </div>

            <div>
              <Label>Período início *</Label>
              <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
            </div>

            <div>
              <Label>Período fim *</Label>
              <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
            </div>

            <div>
              <Label>Dias semana</Label>
              <Input type="number" value={form.dias_semana} onChange={(e) => setForm({ ...form, dias_semana: Number(e.target.value) })} />
            </div>

            <div>
              <Label>Dias fim de semana</Label>
              <Input type="number" value={form.dias_fds} onChange={(e) => setForm({ ...form, dias_fds: Number(e.target.value) })} />
            </div>

            <div>
              <Label>Valor diária semana (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_diaria_semana} onChange={(e) => setForm({ ...form, valor_diaria_semana: Number(e.target.value) })} />
            </div>

            <div>
              <Label>Valor diária FDS (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_diaria_fds} onChange={(e) => setForm({ ...form, valor_diaria_fds: Number(e.target.value) })} />
            </div>

            <div className="sm:col-span-2 rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Valor Bruto</span>
                <span className="font-semibold">{fmtCurrency(valorBruto)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Retenção ({form.retencao_pct}%)</span>
                <span className="text-destructive">- {fmtCurrency(valorRetencao)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
                <span>Valor NF</span>
                <span>{fmtCurrency(valorNf)}</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label>Instrução de faturamento</Label>
              <Textarea value={form.instrucao_faturamento} onChange={(e) => setForm({ ...form, instrucao_faturamento: e.target.value })} placeholder="Instruções opcionais..." />
            </div>

            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.codigo_bm.trim() || !form.period_start || !form.period_end || saveMutation.isPending}>
              {editId ? "Salvar" : "Criar medição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register NF Dialog */}
      <Dialog open={!!nfDialogId} onOpenChange={() => { setNfDialogId(null); setNfNumero(""); setNfData(""); }}>
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
              <Input type="date" value={nfData} onChange={(e) => setNfData(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNfDialogId(null)}>Cancelar</Button>
            <Button onClick={() => registerNfMutation.mutate()} disabled={!nfNumero.trim() || registerNfMutation.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
