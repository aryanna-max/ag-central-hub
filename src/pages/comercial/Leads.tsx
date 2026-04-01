import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ArrowRightLeft, Target, LayoutGrid, List, FolderKanban } from "lucide-react";
import LeadConversionDialog from "./LeadConversionDialog";
import {
  useLeads, useDeleteLead, useUpdateLead,
  LEAD_STATUSES, STATUS_LABELS, STATUS_COLORS, ORIGIN_LABELS, ORIGIN_COLORS,
  type Lead, type LeadStatus, type LeadOrigin,
} from "@/hooks/useLeads";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import LeadFormDialog from "./LeadFormDialog";
import LeadDetailDialog from "./LeadDetailDialog";

// Allowed transitions
const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  novo: ["qualificado", "perdido"],
  qualificado: ["proposta_enviada", "perdido"],
  proposta_enviada: ["aprovado", "perdido"],
  aprovado: ["convertido", "perdido"],
  convertido: [],
  perdido: [],
};

function getDisplayName(lead: Lead, clients: { id: string; name: string }[]) {
  if (lead.client_id) {
    const c = clients.find((cl) => cl.id === lead.client_id);
    if (c) return c.name;
  }
  return lead.company || lead.name;
}

export default function Leads() {
  const { data: leads = [], isLoading } = useLeads();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const deleteLead = useDeleteLead();
  const updateLead = useUpdateLead();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lossDialog, setLossDialog] = useState<Lead | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [conversionLead, setConversionLead] = useState<Lead | null>(null);

  const responsaveis = useMemo(() => {
    const set = new Set(leads.map((l) => l.responsible_id).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const displayName = getDisplayName(l, clients);
      const matchSearch =
        displayName.toLowerCase().includes(search.toLowerCase()) ||
        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.company || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.servico || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchOrigin = originFilter === "all" || l.origin === originFilter;
      const matchResp = responsibleFilter === "all" || l.responsible_id === responsibleFilter;
      return matchSearch && matchStatus && matchOrigin && matchResp;
    });
  }, [leads, clients, search, statusFilter, originFilter, responsibleFilter]);

  const stats = useMemo(() => ({
    total: leads.length,
    novos: leads.filter((l) => l.status === "novo").length,
    qualificados: leads.filter((l) => l.status === "qualificado").length,
    propostas: leads.filter((l) => l.status === "proposta_enviada").length,
    aprovados: leads.filter((l) => l.status === "aprovado").length,
  }), [leads]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteLead.mutateAsync(deleteId);
      toast.success("Lead removido");
    } catch { toast.error("Erro ao remover lead"); }
    setDeleteId(null);
  };

  const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
    if (newStatus === lead.status) return;
    if (newStatus === "perdido") {
      setLossDialog(lead);
      return;
    }
    if (newStatus === "convertido") {
      setConversionLead(lead);
      return;
    }
    const allowed = ALLOWED_TRANSITIONS[lead.status];
    if (!allowed?.includes(newStatus)) {
      toast.error(`Transição não permitida: ${STATUS_LABELS[lead.status]} → ${STATUS_LABELS[newStatus]}`);
      return;
    }
    try {
      await updateLead.mutateAsync({ id: lead.id, status: newStatus });
      toast.success(`Status alterado para ${STATUS_LABELS[newStatus]}`);
    } catch { toast.error("Erro ao alterar status"); }
  };

  const handleLossConfirm = async () => {
    if (!lossDialog || !lossReason.trim()) {
      toast.error("Motivo da perda é obrigatório");
      return;
    }
    try {
      await updateLead.mutateAsync({
        id: lossDialog.id,
        status: "perdido" as any,
        notes: `${lossDialog.notes || ""}\n\n[PERDIDO] ${lossReason}`.trim(),
      });
      toast.success("Lead marcado como perdido");
    } catch { toast.error("Erro ao alterar status"); }
    setLossDialog(null);
    setLossReason("");
  };

  const originBadge = (origin: string | null) => {
    const o = (origin || "outro") as LeadOrigin;
    return (
      <Badge className={`text-xs ${ORIGIN_COLORS[o] || ORIGIN_COLORS.outro}`}>
        {ORIGIN_LABELS[o] || origin || "Outro"}
      </Badge>
    );
  };

  const formatValue = (v: number | null) =>
    v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—";

  // ─── KANBAN VIEW ───
  const renderKanban = () => (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {LEAD_STATUSES.map((status) => {
        const columnLeads = filtered.filter((l) => l.status === status);
        return (
          <div key={status} className="min-w-[220px] w-[220px] flex-shrink-0">
            <div className={`rounded-t-lg px-3 py-2 ${STATUS_COLORS[status]}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{STATUS_LABELS[status]}</span>
                <Badge variant="outline" className="text-xs h-5 px-1.5">{columnLeads.length}</Badge>
              </div>
            </div>
            <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[100px]">
              {columnLeads.map((lead) => (
                <Card
                  key={lead.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setDetailLead(lead)}
                >
                  <CardContent className="p-3 space-y-1.5">
                    <p className="text-sm font-medium leading-tight">{getDisplayName(lead, clients)}</p>
                    {lead.servico && <p className="text-xs text-muted-foreground truncate">{lead.servico}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{formatValue(lead.valor)}</span>
                      {originBadge(lead.origin)}
                    </div>
                    {lead.responsible_id && (
                      <p className="text-xs text-muted-foreground">{employees.find(e => e.id === lead.responsible_id)?.name || "—"}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── TABLE VIEW ───
  const renderTable = () => (
    <Card>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Nenhum lead encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa/Nome</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer" onClick={() => setDetailLead(lead)}>
                  <TableCell className="font-medium">{getDisplayName(lead, clients)}</TableCell>
                  <TableCell>{originBadge(lead.origin)}</TableCell>
                  <TableCell className="text-sm">{lead.servico || "—"}</TableCell>
                  <TableCell className="text-sm">{formatValue(lead.valor)}</TableCell>
                  <TableCell className="text-sm">{employees.find(e => e.id === lead.responsible_id)?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${STATUS_COLORS[lead.status]}`}>{STATUS_LABELS[lead.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(lead.created_at), "dd/MM/yy", { locale: ptBR })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingLead(lead); setFormOpen(true); }}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <ArrowRightLeft className="w-4 h-4 mr-2" /> Alterar Status
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
                              <DropdownMenuItem key={s} onClick={() => handleStatusChange(lead, s)}>
                                <Badge className={`${STATUS_COLORS[s]} text-xs mr-2`}>{STATUS_LABELS[s]}</Badge>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {projects.find((p) => p.lead_id === lead.id) && (
                          <DropdownMenuItem onClick={() => navigate("/projetos")}>
                            <FolderKanban className="w-4 h-4 mr-2" /> Ver Projeto
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(lead.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> Leads
          </h1>
          <p className="text-muted-foreground text-sm">Funil comercial — captação até conversão</p>
        </div>
        <Button onClick={() => { setEditingLead(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Lead
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Novos", value: stats.novos, color: "text-gray-600" },
          { label: "Qualificados", value: stats.qualificados, color: "text-blue-600" },
          { label: "Propostas", value: stats.propostas, color: "text-yellow-600" },
          { label: "Aprovados", value: stats.aprovados, color: "text-green-600" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar empresa, contato, serviço..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "kanban" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("kanban")}
            className="rounded-r-none"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-l-none"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">Carregando...</p>
      ) : viewMode === "kanban" ? renderKanban() : renderTable()}

      {/* Dialogs */}
      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editingLead} />
      <LeadDetailDialog open={!!detailLead} onOpenChange={(o) => !o && setDetailLead(null)} lead={detailLead} />
      <LeadConversionDialog
        open={!!conversionLead}
        onOpenChange={(o) => { if (!o) setConversionLead(null); }}
        lead={conversionLead}
        onConverted={() => navigate("/projetos")}
      />

      {/* Loss reason dialog */}
      <Dialog open={!!lossDialog} onOpenChange={(o) => { if (!o) { setLossDialog(null); setLossReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Perdido</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da perda *</Label>
            <Textarea
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              placeholder="Descreva o motivo da perda..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLossDialog(null); setLossReason(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleLossConfirm} disabled={updateLead.isPending}>
              {updateLead.isPending ? "Salvando..." : "Confirmar Perda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
