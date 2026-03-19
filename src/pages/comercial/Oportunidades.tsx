import { useState, useMemo } from "react";
import { Plus, DollarSign, TrendingUp, Target, XCircle, MoreHorizontal, Pencil, Trash2, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  useOpportunities,
  useUpdateOpportunity,
  useDeleteOpportunity,
  STAGE_LABELS,
  STAGE_COLORS,
  ACTIVE_STAGES,
  PIPELINE_STAGES,
  type Opportunity,
  type OpportunityStage,
} from "@/hooks/useOpportunities";
import { useClients } from "@/hooks/useClients";
import OpportunityFormDialog from "./OpportunityFormDialog";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";

export default function Oportunidades() {
  const { data: opportunities = [], isLoading } = useOpportunities();
  const { data: clients = [] } = useClients();
  const updateOpp = useUpdateOpportunity();
  const deleteOpp = useDeleteOpportunity();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getClientName = (opp: Opportunity) => {
    if (opp.client_id) {
      const c = clients.find((c) => c.id === opp.client_id);
      return c?.name || opp.client || "—";
    }
    return opp.client || "—";
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return opportunities.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        getClientName(o).toLowerCase().includes(q) ||
        o.responsible?.toLowerCase().includes(q)
    );
  }, [opportunities, search, clients]);

  const stats = useMemo(() => {
    const active = opportunities.filter((o) => ACTIVE_STAGES.includes(o.stage));
    const won = opportunities.filter((o) => o.stage === "fechado_ganho");
    const lost = opportunities.filter((o) => o.stage === "fechado_perdido");
    const totalValue = active.reduce((s, o) => s + (o.value || 0), 0);
    const wonValue = won.reduce((s, o) => s + (o.value || 0), 0);
    return { active: active.length, won: won.length, lost: lost.length, totalValue, wonValue };
  }, [opportunities]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteOpp.mutateAsync(deleteId);
      toast.success("Oportunidade excluída");
    } catch {
      toast.error("Erro ao excluir");
    }
    setDeleteId(null);
  };

  const handleStageChange = async (opp: Opportunity, newStage: OpportunityStage) => {
    try {
      await updateOpp.mutateAsync({ id: opp.id, stage: newStage });
      toast.success(`Movida para ${STAGE_LABELS[newStage]}`);
    } catch {
      toast.error("Erro ao alterar etapa");
    }
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const getDaysUntilClose = (opp: Opportunity): string | null => {
    if (!opp.expected_close_date) return null;
    const days = differenceInDays(parseISO(opp.expected_close_date), new Date());
    if (days < 0) return `${Math.abs(days)}d atrás`;
    if (days === 0) return "Hoje";
    return `${days}d`;
  };

  const renderCard = (opp: Opportunity) => (
    <Card key={opp.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium leading-tight flex-1">{opp.name}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditingOpp(opp); setFormOpen(true); }}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRight className="w-3.5 h-3.5 mr-2" /> Mover para
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {PIPELINE_STAGES.filter((s) => s !== opp.stage).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => handleStageChange(opp, s)}>
                      <Badge className={`${STAGE_COLORS[s]} text-[10px] mr-2 border`}>{STAGE_LABELS[s]}</Badge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(opp.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-xs text-muted-foreground">{getClientName(opp)}</p>
        {opp.value != null && <p className="text-xs font-semibold">{fmt(opp.value)}</p>}
        <div className="flex items-center justify-between">
          {opp.responsible && <p className="text-[11px] text-muted-foreground">{opp.responsible}</p>}
          {getDaysUntilClose(opp) && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-3 h-3" />{getDaysUntilClose(opp)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
          <p className="text-muted-foreground">Pipeline de vendas — negociações em andamento</p>
        </div>
        <Button onClick={() => { setEditingOpp(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Oportunidade
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="w-4 h-4" />Ativas</div>
          <p className="text-2xl font-bold">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="w-4 h-4" />Valor em Pipeline</div>
          <p className="text-2xl font-bold">{fmt(stats.totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="w-4 h-4" />Ganhas</div>
          <p className="text-2xl font-bold text-green-600">{stats.won} ({fmt(stats.wonValue)})</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><XCircle className="w-4 h-4" />Perdidas</div>
          <p className="text-2xl font-bold text-red-600">{stats.lost}</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <Input placeholder="Buscar oportunidades..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      {isLoading ? (
        <p className="text-muted-foreground text-center py-10">Carregando...</p>
      ) : (
        /* Pipeline Kanban */
        <div className="grid grid-cols-6 gap-3">
          {/* Active stages */}
          {ACTIVE_STAGES.map((stage) => {
            const items = filtered.filter((o) => o.stage === stage);
            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={`${STAGE_COLORS[stage]} text-xs border`}>{STAGE_LABELS[stage]}</Badge>
                  <span className="text-xs text-muted-foreground font-medium">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {items.map(renderCard)}
                </div>
              </div>
            );
          })}

          {/* Fechado - split into Ganho/Perdido */}
          <div className="col-span-2 space-y-2">
            <div className="text-sm font-semibold text-center">Fechado</div>
            <div className="grid grid-cols-2 gap-2">
              {/* Ganho */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs">Ganho</Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    {filtered.filter((o) => o.stage === "fechado_ganho").length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {filtered.filter((o) => o.stage === "fechado_ganho").map(renderCard)}
                </div>
              </div>
              {/* Perdido */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className="bg-red-100 text-red-800 border border-red-300 text-xs">Perdido</Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    {filtered.filter((o) => o.stage === "fechado_perdido").length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {filtered.filter((o) => o.stage === "fechado_perdido").map(renderCard)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <OpportunityFormDialog open={formOpen} onOpenChange={setFormOpen} opportunity={editingOpp} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oportunidade?</AlertDialogTitle>
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
