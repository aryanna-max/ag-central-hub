import { useState, useMemo } from "react";
import { FileText, Plus, Sparkles, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProposals, STATUS_LABELS, STATUS_COLORS, Proposal, ProposalStatus } from "@/hooks/useProposals";
import PropostaFormDialog from "./propostas/PropostaFormDialog";
import PropostaAIDialog from "./propostas/PropostaAIDialog";
import PropostaDetailDialog from "./propostas/PropostaDetailDialog";

export default function Propostas() {
  const { data: proposals, isLoading } = useProposals();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [prefill, setPrefill] = useState<any>(null);

  const filtered = useMemo(() => {
    if (!proposals) return [];
    return proposals.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        (p.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.service || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [proposals, search, statusFilter]);

  const kpis = useMemo(() => {
    if (!proposals) return { total: 0, rascunho: 0, enviada: 0, aprovada: 0, valor: 0 };
    return {
      total: proposals.length,
      rascunho: proposals.filter((p) => p.status === "rascunho").length,
      enviada: proposals.filter((p) => p.status === "enviada").length,
      aprovada: proposals.filter((p) => p.status === "aprovada").length,
      valor: proposals.reduce((s, p) => s + (p.final_value || p.estimated_value || 0), 0),
    };
  }, [proposals]);

  const handleAIApply = (data: any) => {
    setPrefill({
      title: data.title || "",
      service: data.service || "",
      client_name: data.client_name || "",
      empresa_faturadora: data.empresa_faturadora || "ag_topografia",
      scope: data.scope || "",
      location: data.location || "",
      estimated_value: data.estimated_value || 0,
      final_value: data.estimated_value || 0,
      estimated_duration: data.estimated_duration || "",
      payment_conditions: data.payment_conditions || "",
      technical_notes: data.technical_notes || "",
      items: data.items?.map((i: any, idx: number) => ({
        description: i.description,
        unit: i.unit || "un",
        quantity: i.quantity || 1,
        unit_price: i.unit_price || 0,
        total_price: i.total_price || 0,
        sort_order: idx,
      })) || [],
    });
    setSelected(null);
    setFormOpen(true);
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Propostas</h1>
            <p className="text-sm text-muted-foreground">Geração e emissão de propostas comerciais</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="w-4 h-4 mr-1" /> Criar com IA
          </Button>
          <Button onClick={() => { setSelected(null); setPrefill(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nova Proposta
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{kpis.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{kpis.rascunho}</p>
            <p className="text-xs text-muted-foreground">Rascunhos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{kpis.enviada}</p>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-secondary">{kpis.aprovada}</p>
            <p className="text-xs text-muted-foreground">Aprovadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono">{formatCurrency(kpis.valor)}</p>
            <p className="text-xs text-muted-foreground">Valor Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar proposta..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma proposta encontrada.
                    <br />
                    <Button variant="link" onClick={() => setAiOpen(true)} className="mt-2">
                      <Sparkles className="w-4 h-4 mr-1" /> Criar com IA
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelected(p); setDetailOpen(true); }}
                  >
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>{"—"}</TableCell>
                    <TableCell className="text-xs">{p.service || "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(p.final_value || p.estimated_value || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[p.status]} text-xs`}>
                        {STATUS_LABELS[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.empresa_faturadora === "ag_topografia" ? "AG Topo" : "AG Carto"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PropostaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        proposal={selected}
        prefill={prefill}
      />
      <PropostaAIDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        onApply={handleAIApply}
      />
      <PropostaDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        proposal={selected}
        onEdit={(p) => { setSelected(p); setPrefill(null); setFormOpen(true); }}
      />
    </div>
  );
}
