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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ArrowRightLeft, Target, LayoutGrid, List, FolderKanban, AlertTriangle, TrendingUp, DollarSign, Briefcase, Download } from "lucide-react";
import ColumnToggle, { useColumnVisibility, type ColumnDef } from "@/components/ColumnToggle";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";
import LeadConversionDialog from "./LeadConversionDialog";
import {
  useLeads, useDeleteLead, useUpdateLead,
  LEAD_STATUSES, ACTIVE_STATUSES, KANBAN_STATUSES, HISTORY_STATUSES, ALLOWED_TRANSITIONS,
  STATUS_LABELS, STATUS_COLORS, ORIGIN_LABELS, ORIGIN_COLORS,
  type Lead, type LeadStatus, type LeadOrigin,
} from "@/hooks/useLeads";
import { useClients } from "@/hooks/useClients";
import { useEmployees } from "@/hooks/useEmployees";
import { useProjects, useUpdateProject } from "@/hooks/useProjects";
import { useCreateAlerts, type AlertInsert } from "@/hooks/useAlerts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { exportCsv } from "@/lib/exportCsv";
import LeadFormDialog from "./LeadFormDialog";
import LeadDetailDialog from "./LeadDetailDialog";
import { EXEC_STATUS_LABELS, EXEC_STATUS_COLORS } from "@/lib/statusConstants";

const EXEC_STATUS_BADGE: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(EXEC_STATUS_LABELS).map(([k, label]) => [k, { label, color: EXEC_STATUS_COLORS[k] || "bg-muted" }])
);

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
  const { data: employees = [] } = useEmployees();
  const { data: projects = [] } = useProjects();
  const deleteLead = useDeleteLead();
  const updateLead = useUpdateLead();
  const updateProject = useUpdateProject();
  const createAlerts = useCreateAlerts();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showFinalized, setShowFinalized] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [showHistory, setShowHistory] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lossDialog, setLossDialog] = useState<Lead | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [conversionLead, setConversionLead] = useState<Lead | null>(null);

  const LEAD_COLUMNS: ColumnDef[] = [
    { key: "codigo", label: "Código" },
    { key: "empresa", label: "Empresa/Nome" },
    { key: "origem", label: "Origem" },
    { key: "servico", label: "Serviço" },
    { key: "valor", label: "Valor" },
    { key: "responsavel", label: "Responsável" },
    { key: "status", label: "Status" },
    { key: "data", label: "Data" },
  ];
  const { visibleColumns, toggle: toggleColumn, isVisible } = useColumnVisibility(LEAD_COLUMNS);

  const getEmployeeName = (id: string | null) => {
    if (!id) return "—";
    return employees.find((e) => e.id === id)?.name || "—";
  };

  const responsaveis = useMemo(() => {
    const ids = new Set(leads.map((l) => l.responsible_id).filter(Boolean) as string[]);
    return Array.from(ids)
      .map((id) => ({ id, name: getEmployeeName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, employees]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const displayName = getDisplayName(l, clients);
      const matchSearch =
        displayName.toLowerCase().includes(search.toLowerCase()) ||
        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.company || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.servico || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.codigo || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchOrigin = originFilter === "all" || l.origin === originFilter;
      const matchResp = responsibleFilter === "all" || l.responsible_id === responsibleFilter;
      const matchHistory = showHistory || ACTIVE_STATUSES.includes(l.status);
      return matchSearch && matchStatus && matchOrigin && matchResp && matchHistory;
    });
  }, [leads, clients, search, statusFilter, originFilter, responsibleFilter, showHistory]);

  const { sorted: sortedFiltered, sortKey, sortDir, handleSort } = useSortableTable(filtered);

  // ─── Projects split: active (not yet delivered) vs finalized ───

  const NOT_DELIVERED = ["planejamento", "aguardando_campo", "em_campo", "aguardando_processamento", "em_processamento", "revisao", "aprovado"];
  const FINALIZED = ["entregue", "faturamento", "pago"];

  const activeProjects = useMemo(() => {
    return projects.filter(
      (p) => p.is_active !== false && NOT_DELIVERED.includes(p.execution_status || "")
    );
  }, [projects]);

  const finalizedProjects = useMemo(() => {
    return projects.filter(
      (p) => p.is_active !== false && FINALIZED.includes(p.execution_status || "")
    );
  }, [projects]);

  const allVisibleProjects = useMemo(() => projects.filter(p => p.is_active !== false), [projects]);
  const projectsFromLeads = useMemo(() => allVisibleProjects.filter(p => p.lead_id), [allVisibleProjects]);
  const projectsWithoutLead = useMemo(() => activeProjects.filter(p => !p.lead_id), [activeProjects]);

  // ─── KPIs ───

  const stats = useMemo(() => {
    const activeLeads = leads.filter((l) => KANBAN_STATUSES.includes(l.status));
    const allActiveProjects = activeProjects;

    const totalValue = allActiveProjects.reduce((sum, p) => sum + (p.contract_value || 0), 0);
    const leadValue = activeLeads.reduce((sum, l) => sum + (l.valor || 0), 0);

    return {
      leadsAtivos: activeLeads.length,
      novos: leads.filter((l) => l.status === "novo").length,
      negociando: leads.filter((l) => l.status === "em_negociacao").length,
      propostas: leads.filter((l) => l.status === "proposta_enviada").length,
      projetosAtivos: allActiveProjects.length,
      valorCarteira: totalValue + leadValue,
      emCampo: allActiveProjects.filter(p => p.execution_status === "em_campo").length,
      finalizados: finalizedProjects.length,
    };
  }, [leads, activeProjects]);

  // ─── Handlers ───

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
    if (newStatus === "perdido") { setLossDialog(lead); return; }
    if (newStatus === "convertido") { setConversionLead(lead); return; }
    const allowed = ALLOWED_TRANSITIONS[lead.status];
    if (!allowed?.includes(newStatus)) {
      toast.error(`Transição não permitida: ${STATUS_LABELS[lead.status]} → ${STATUS_LABELS[newStatus]}`);
      return;
    }
    try {
      await updateLead.mutateAsync({ id: lead.id, status: newStatus });

      // Generate alert for status change
      const displayName = getDisplayName(lead, clients);
      const alertRecipient = newStatus === "proposta_enviada" ? "diretoria" : "comercial";
      const alert: AlertInsert = {
        alert_type: "lead_status_change",
        priority: newStatus === "proposta_enviada" ? "importante" : "informacao",
        recipient: alertRecipient,
        title: `Lead ${lead.codigo || displayName} → ${STATUS_LABELS[newStatus]}`,
        message: `${displayName}: ${STATUS_LABELS[lead.status]} → ${STATUS_LABELS[newStatus]}.${lead.servico ? ` Serviço: ${lead.servico}.` : ""}`,
        reference_type: "lead",
        reference_id: lead.id,
      };
      await createAlerts.mutateAsync([alert]);

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
        notes: `${lossDialog.notes || ""}\n\n[PERDIDO] ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}: ${lossReason}`.trim(),
      });

      // Alert for lost lead
      const displayName = getDisplayName(lossDialog, clients);
      await createAlerts.mutateAsync([{
        alert_type: "lead_perdido",
        priority: "informacao",
        recipient: "comercial",
        title: `Lead perdido — ${lossDialog.codigo || displayName}`,
        message: `Motivo: ${lossReason}.${lossDialog.valor ? ` Valor: R$ ${lossDialog.valor.toLocaleString("pt-BR")}.` : ""}`,
        reference_type: "lead",
        reference_id: lossDialog.id,
      }]);

      toast.success("Lead marcado como perdido");
    } catch { toast.error("Erro ao alterar status"); }
    setLossDialog(null);
    setLossReason("");
  };

  const handleProjectStatusChange = async (projectId: string, currentStatus: string, newStatus: string) => {
    try {
      const finalStatus = newStatus === "concluido_final" ? "pago" : newStatus;
      const updates: any = { execution_status: finalStatus };
      if (finalStatus === "pago" || newStatus === "concluido_final") {
        updates.status = "concluido";
        updates.is_active = false;
      }
      await updateProject.mutateAsync({ id: projectId, ...updates });
      await supabase.from("project_status_history").insert({
        project_id: projectId,
        from_status: currentStatus,
        to_status: finalStatus,
        modulo: "comercial",
        changed_by_id: user?.id || null,
      });
      // Alert financeiro when marking pago
      if (finalStatus === "pago") {
        const proj = projects.find(p => p.id === projectId);
        if (proj) {
          await createAlerts.mutateAsync([{
            alert_type: "projeto_pago",
            priority: "importante",
            recipient: "financeiro",
            title: `Pagamento confirmado — ${proj.codigo || proj.name}`,
            message: `Conferir conta bancária. Valor: ${proj.contract_value ? formatValue(proj.contract_value) : "não informado"}.`,
            reference_type: "project",
            reference_id: projectId,
          }]);
        }
      }
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`Status alterado para ${EXEC_STATUS_BADGE[finalStatus]?.label || finalStatus}`);
    } catch {
      toast.error("Erro ao alterar status");
    }
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

  const kanbanStatuses = useMemo(() => {
    if (showHistory) return [...KANBAN_STATUSES, "perdido"] as LeadStatus[];
    return KANBAN_STATUSES;
  }, [showHistory]);

  const renderKanban = () => (
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin -mx-2 px-2">
      {kanbanStatuses.map((status) => {
        const columnLeads = filtered.filter((l) => l.status === status);
        const isHistory = HISTORY_STATUSES.includes(status);
        return (
          <div key={status} className={`min-w-[220px] w-[220px] flex-shrink-0 ${isHistory ? "opacity-70" : ""}`}>
            <div className={`rounded-t-lg px-3 py-2 ${STATUS_COLORS[status]}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{STATUS_LABELS[status]}</span>
                <div className="flex items-center gap-1">
                  {isHistory && <Badge variant="outline" className="text-[9px] h-4 px-1">Histórico</Badge>}
                  <Badge variant="outline" className="text-xs h-5 px-1.5">{columnLeads.length}</Badge>
                </div>
              </div>
            </div>
            <div className="bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[100px] max-h-[60vh] overflow-y-auto scrollbar-thin">
              {columnLeads.map((lead) => {
                const linkedProject = lead.converted_project_id
                  ? projects.find((p) => p.id === lead.converted_project_id)
                  : projects.find((p) => p.lead_id === lead.id);
                const execBadge = linkedProject?.execution_status ? EXEC_STATUS_BADGE[linkedProject.execution_status] : null;
                const isProjectFinalized = linkedProject && ["entregue", "faturamento", "pago", "concluido"].includes(linkedProject.execution_status || "");
                return (
                  <Card
                    key={lead.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${isHistory ? "border-dashed" : ""} ${isProjectFinalized ? "opacity-60" : ""}`}
                    onClick={() => setDetailLead(lead)}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      {lead.codigo && (
                        <p className="text-xs font-mono font-bold text-primary">{lead.codigo}</p>
                      )}
                      <p className="text-sm font-medium leading-tight">{getDisplayName(lead, clients)}</p>
                      {lead.servico && <p className="text-xs text-muted-foreground truncate">{lead.servico}</p>}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{formatValue(lead.valor)}</span>
                        {originBadge(lead.origin)}
                      </div>
                      {lead.responsible_id && (
                        <p className="text-xs text-muted-foreground">{getEmployeeName(lead.responsible_id)}</p>
                      )}
                      {linkedProject && (
                        <div className="pt-1 space-y-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/projetos/${linkedProject.id}`); }}
                            className="text-xs text-primary font-mono font-bold hover:underline flex items-center gap-1"
                          >
                            <FolderKanban className="w-3 h-3" />
                            {linkedProject.codigo || linkedProject.name}
                          </button>
                          <div className="flex gap-1">
                            {execBadge && (
                              <Badge className={`${execBadge.color} text-[9px] h-4`}>{execBadge.label}</Badge>
                            )}
                            {isProjectFinalized && (
                              <Badge className="bg-green-200 text-green-800 text-[9px] h-4">Finalizado</Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── TABLE VIEW ───

  const renderTable = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {isVisible("codigo") && <SortableTableHead sortKey="codigo" currentSort={sortKey} direction={sortDir} onSort={handleSort}>Código</SortableTableHead>}
            {isVisible("empresa") && <SortableTableHead sortKey="company" currentSort={sortKey} direction={sortDir} onSort={handleSort}>Empresa/Nome</SortableTableHead>}
            {isVisible("origem") && <TableHead className="text-xs">Origem</TableHead>}
            {isVisible("servico") && <TableHead className="text-xs">Serviço</TableHead>}
            {isVisible("valor") && <SortableTableHead sortKey="valor" currentSort={sortKey} direction={sortDir} onSort={handleSort}>Valor</SortableTableHead>}
            {isVisible("responsavel") && <TableHead className="text-xs">Responsável</TableHead>}
            {isVisible("status") && <TableHead className="text-xs">Status</TableHead>}
            <TableHead className="text-xs">Projeto</TableHead>
            {isVisible("data") && <SortableTableHead sortKey="created_at" currentSort={sortKey} direction={sortDir} onSort={handleSort}>Data</SortableTableHead>}
            <TableHead className="text-xs w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFiltered.map((lead) => {
            const linkedProject = lead.converted_project_id
              ? projects.find((p) => p.id === lead.converted_project_id)
              : projects.find((p) => p.lead_id === lead.id);
            const execBadge = linkedProject?.execution_status ? EXEC_STATUS_BADGE[linkedProject.execution_status] : null;
            const isHist = HISTORY_STATUSES.includes(lead.status);
            return (
              <TableRow
                key={lead.id}
                className={`cursor-pointer ${isHist ? "opacity-60" : ""}`}
                onClick={() => setDetailLead(lead)}
              >
                {isVisible("codigo") && <TableCell className="text-xs font-mono font-bold text-primary">{lead.codigo || "—"}</TableCell>}
                {isVisible("empresa") && <TableCell className="text-xs font-medium max-w-[200px] truncate">{getDisplayName(lead, clients)}</TableCell>}
                {isVisible("origem") && <TableCell>{originBadge(lead.origin)}</TableCell>}
                {isVisible("servico") && <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">{lead.servico || "—"}</TableCell>}
                {isVisible("valor") && <TableCell className="text-xs font-semibold">{formatValue(lead.valor)}</TableCell>}
                {isVisible("responsavel") && <TableCell className="text-xs text-muted-foreground">{getEmployeeName(lead.responsible_id)}</TableCell>}
                {isVisible("status") && (
                  <TableCell>
                    <Badge className={`text-[10px] ${STATUS_COLORS[lead.status]}`}>{STATUS_LABELS[lead.status]}</Badge>
                  </TableCell>
                )}
                <TableCell>
                  {linkedProject && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/projetos/${linkedProject.id}`); }}
                        className="text-[10px] text-primary font-mono font-bold hover:underline"
                      >
                        {linkedProject.codigo || "—"}
                      </button>
                      {execBadge && <Badge className={`${execBadge.color} text-[8px] h-3.5`}>{execBadge.label}</Badge>}
                    </div>
                  )}
                </TableCell>
                {isVisible("data") && (
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {lead.created_at ? format(new Date(lead.created_at), "dd/MM/yy") : "—"}
                  </TableCell>
                )}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isHist && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingLead(lead); setFormOpen(true); }}>
                            <Pencil className="w-3 h-3 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger><ArrowRightLeft className="w-3 h-3 mr-2" /> Mover para</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
                                <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); handleStatusChange(lead, s); }}>
                                  {STATUS_LABELS[s]}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(lead.id); }}>
                        <Trash2 className="w-3 h-3 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  // ─── PROJECT CARD (for active projects section) ───

  const FINALIZED_EXEC = ["entregue", "faturamento", "pago", "concluido"];

  const renderProjectCard = (p: any) => {
    const execBadge = p.execution_status ? EXEC_STATUS_BADGE[p.execution_status] : null;
    const clientName = p.clients?.name || p.client || "—";
    const isFinalized = FINALIZED_EXEC.includes(p.execution_status || "");
    return (
      <Card key={p.id} className={`hover:shadow-md transition-shadow cursor-pointer ${isFinalized ? "opacity-50" : ""}`} onClick={() => navigate(`/projetos/${p.id}`)}>
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-primary hover:underline">{p.codigo || "—"}</span>
            <div className="flex gap-1">
              {execBadge && <Badge className={`${execBadge.color} text-[9px] h-4`}>{execBadge.label}</Badge>}
              {isFinalized && <Badge className="bg-green-200 text-green-800 text-[9px] h-4">Finalizado</Badge>}
              {!p.lead_id && <Badge variant="outline" className="text-[9px] h-4 text-amber-600 border-amber-300">Sem lead</Badge>}
            </div>
          </div>
          <p className="text-sm font-medium leading-tight">{p.name}</p>
          <p className="text-xs text-muted-foreground">{clientName}</p>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">{p.contract_value ? formatValue(p.contract_value) : "—"}</span>
            {p.service && <span className="text-muted-foreground truncate max-w-[120px]">{p.service}</span>}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> Radar Comercial
          </h1>
          <p className="text-muted-foreground text-sm">Pipeline completo — leads até faturamento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const rows = leads.map((l: any) => [l.codigo || "", getDisplayName(l, clients), l.origin || "", l.servico || "", l.valor ? String(l.valor) : "", getEmployeeName(l.responsible_id), STATUS_LABELS[l.status] || l.status, l.created_at ? format(new Date(l.created_at), "dd/MM/yyyy") : ""]);
            exportCsv(["Código", "Empresa", "Origem", "Serviço", "Valor", "Responsável", "Status", "Data"], rows, "leads.csv");
            toast.success(`${rows.length} leads exportados`);
          }}><Download className="w-4 h-4 mr-1" /> Exportar</Button>
          <Button onClick={() => { setEditingLead(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* KPIs — 2 rows */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Leads Ativos</p>
            </div>
            <p className="text-xl font-bold text-blue-600">{stats.leadsAtivos}</p>
            <p className="text-[10px] text-muted-foreground">{stats.novos} novos · {stats.negociando} negociando · {stats.propostas} propostas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Projetos Ativos</p>
            </div>
            <p className="text-xl font-bold text-emerald-600">{stats.projetosAtivos}</p>
            <p className="text-[10px] text-muted-foreground">{stats.emCampo} em campo · {stats.finalizados} finalizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Valor Carteira</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatValue(stats.valorCarteira)}</p>
            <p className="text-[10px] text-muted-foreground">Leads + projetos ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Conversão</p>
            </div>
            <p className="text-xl font-bold text-green-600">
              {leads.length > 0 ? Math.round((leads.filter(l => l.status === "convertido").length / leads.length) * 100) : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">{leads.filter(l => l.status === "convertido").length} convertidos de {leads.length}</p>
          </CardContent>
        </Card>
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
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showHistory ? "default" : "outline"}
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs gap-1"
        >
          {showHistory ? "Esconder" : "Mostrar"} histórico
        </Button>
        <div className="flex border rounded-md">
          <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("kanban")} className="rounded-r-none">
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="rounded-l-none">
            <List className="w-4 h-4" />
          </Button>
        </div>
        {viewMode === "list" && (
          <ColumnToggle columns={LEAD_COLUMNS} visibleColumns={visibleColumns} onToggle={toggleColumn} />
        )}
      </div>

      {/* Lead Pipeline */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">Carregando...</p>
      ) : viewMode === "kanban" ? renderKanban() : renderTable()}

      {/* Projetos Ativos — rastreabilidade pós-conversão */}
      {projectsFromLeads.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FolderKanban className="w-4 h-4" /> Projetos Convertidos ({projectsFromLeads.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {projectsFromLeads.map(renderProjectCard)}
          </div>
        </div>
      )}

      {/* Projetos sem lead */}
      {projectsWithoutLead.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Projetos sem lead ({projectsWithoutLead.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {projectsWithoutLead.map(renderProjectCard)}
          </div>
        </div>
      )}

      {/* Finalizados — lista com ações de status */}
      {finalizedProjects.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Finalizados ({finalizedProjects.length})
            </h2>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowFinalized(!showFinalized)}>
              {showFinalized ? "Esconder" : "Mostrar"}
            </Button>
          </div>
          {showFinalized && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Projeto</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Valor</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs w-[120px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalizedProjects.map((p) => {
                    const execBadge = p.execution_status ? EXEC_STATUS_BADGE[p.execution_status] : null;
                    const clientName = p.clients?.name || p.client || "—";
                    const statusOptions = ["entregue", "faturamento", "pago"].filter(s => s !== p.execution_status);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <button onClick={() => navigate(`/projetos/${p.id}`)} className="text-xs font-mono font-bold text-primary hover:underline">
                            {p.codigo || "—"}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">{p.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{clientName}</TableCell>
                        <TableCell className="text-xs font-semibold">{p.contract_value ? formatValue(p.contract_value) : "—"}</TableCell>
                        <TableCell>
                          {execBadge && <Badge className={`${execBadge.color} text-[10px]`}>{execBadge.label}</Badge>}
                        </TableCell>
                        <TableCell>
                          <Select
                            value=""
                            onValueChange={(v) => handleProjectStatusChange(p.id, p.execution_status || "", v)}
                          >
                            <SelectTrigger className="h-7 text-[10px] w-[110px]">
                              <SelectValue placeholder="Alterar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {EXEC_STATUS_BADGE[s]?.label || s}
                                </SelectItem>
                              ))}
                              <SelectItem value="concluido_final">Concluir projeto</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

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
