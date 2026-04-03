import { useState, useMemo } from "react";
import { Plus, Eye, Copy, Send, FileText } from "lucide-react";
import { format, parseISO, addDays, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PropostaDetailDialog from "@/pages/propostas/PropostaDetailDialog";

const statusCfg: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-gray-500 text-white" },
  enviada:  { label: "Enviada",  cls: "bg-blue-600 text-white" },
  aprovada: { label: "Aprovada", cls: "bg-emerald-600 text-white" },
  rejeitada:{ label: "Rejeitada",cls: "bg-red-600 text-white" },
  expirada: { label: "Expirada", cls: "bg-amber-500 text-white" },
};

function useProposals() {
  return useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*, clients:client_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useClients() {
  return useQuery({
    queryKey: ["clients-active"],
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
}

async function generateCode(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("proposals")
    .select("id", { count: "exact", head: true })
    .like("code", `${year}-P-%`);
  const seq = ((count || 0) + 1).toString().padStart(3, "0");
  return `${year}-P-${seq}`;
}

export default function Propostas() {
  const qc = useQueryClient();
  const { data: proposals = [], isLoading } = useProposals();
  const { data: clients = [] } = useClients();
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [form, setForm] = useState({
    client_id: "",
    title: "",
    scope: "",
    estimated_value: "",
    validity_days: "30",
  });

  const STATUS_ORDER: Record<string, number> = {
    enviada: 0,
    rascunho: 1,
    aprovada: 2,
    rejeitada: 3,
    convertida: 4,
    expirada: 5,
  };

  const filtered = useMemo(() => {
    return proposals
      .filter((p: any) => {
        if (filterStatus !== "all") {
          if (filterStatus === "expirada") {
            if (!isExpired(p)) return false;
          } else if (p.status !== filterStatus) {
            return false;
          }
        }
        if (filterClient !== "all" && p.client_id !== filterClient) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const orderA = STATUS_ORDER[a.status] ?? 99;
        const orderB = STATUS_ORDER[b.status] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        // Within same status, newest first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [proposals, filterStatus, filterClient]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const code = await generateCode();
      const { error } = await supabase.from("proposals").insert({
        code,
        client_id: form.client_id || null,
        title: form.title,
        scope: form.scope || null,
        estimated_value: Number(form.estimated_value) || 0,
        final_value: Number(form.estimated_value) || 0,
        validity_days: Number(form.validity_days) || 30,
        status: "rascunho",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setShowNew(false);
      setForm({ client_id: "", title: "", scope: "", estimated_value: "", validity_days: "30" });
      toast.success("Proposta criada!");
    },
    onError: () => toast.error("Erro ao criar proposta"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (proposal: any) => {
      const code = await generateCode();
      const { error } = await supabase.from("proposals").insert({
        code,
        client_id: proposal.client_id,
        lead_id: proposal.lead_id,
        title: proposal.title + " (cópia)",
        scope: proposal.scope,
        estimated_value: proposal.estimated_value,
        final_value: proposal.final_value,
        validity_days: proposal.validity_days,
        status: "rascunho",
        service: proposal.service,
        location: proposal.location,
        empresa_faturadora: proposal.empresa_faturadora,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Proposta duplicada!");
    },
    onError: () => toast.error("Erro ao duplicar"),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposals")
        .update({ status: "enviada", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Proposta enviada!");
    },
    onError: () => toast.error("Erro ao enviar"),
  });

  const isExpired = (p: any): boolean => {
    if (p.status !== "enviada") return false;
    if (!p.sent_at || !p.validity_days) return false;
    const expirationDate = addDays(parseISO(p.sent_at), p.validity_days);
    return isBefore(expirationDate, new Date());
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Propostas</h1>
            <p className="text-sm text-muted-foreground">Propostas comerciais</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Proposta
        </Button>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="aprovada">Aprovada</SelectItem>
              <SelectItem value="rejeitada">Rejeitada</SelectItem>
              <SelectItem value="expirada">Expirada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(filterStatus !== "all" || filterClient !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterClient("all"); }}>
            Limpar
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="text-right">Estimado</TableHead>
                <TableHead className="text-right">Final</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma proposta encontrada</TableCell></TableRow>
              ) : filtered.map((p: any) => {
                const expired = isExpired(p);
                const cfg = expired ? statusCfg.expirada : (statusCfg[p.status] || statusCfg.rascunho);
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelectedId(p.id)}>
                    <TableCell className="font-mono font-medium">{p.code}</TableCell>
                    <TableCell>
                      {(p.clients as any)?.name || "—"}
                      {!p.lead_id && <Badge variant="outline" className="ml-2 text-[9px] text-amber-600 border-amber-400">Sem lead</Badge>}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{p.title}</TableCell>
                    <TableCell className="text-right">{fmt(Number(p.estimated_value) || 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(Number(p.final_value) || 0)}</TableCell>
                    <TableCell><Badge className={cfg.cls}>{cfg.label}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(p.created_at), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }} title="Ver">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(p); }} title="Duplicar">
                          <Copy className="w-4 h-4" />
                        </Button>
                        {p.status === "rascunho" && (
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); sendMutation.mutate(p.id); }} title="Enviar">
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Proposal Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Proposta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Levantamento topográfico Lote 5" />
            </div>
            <div>
              <Label>Escopo</Label>
              <Textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="Descrição do escopo..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Estimado (R$)</Label>
                <Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
              </div>
              <div>
                <Label>Validade (dias)</Label>
                <Input type="number" value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title.trim() || createMutation.isPending}>
              Criar Proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedId && (
        <PropostaDetailDialog
          proposal={filtered.find((p: any) => p.id === selectedId) as any || null}
          open={!!selectedId}
          onOpenChange={(open) => { if (!open) setSelectedId(null); }}
          onEdit={() => {}}
        />
      )}
    </div>
  );
}
