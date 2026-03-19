import { useState, useMemo } from "react";
import { Plus, DollarSign, TrendingUp, Target, XCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useOpportunities,
  useUpdateOpportunity,
  useDeleteOpportunity,
  STAGE_LABELS,
  STAGE_COLORS,
  PIPELINE_STAGES,
  type Opportunity,
  type OpportunityStage,
} from "@/hooks/useOpportunities";
import OpportunityFormDialog from "./OpportunityFormDialog";
import { toast } from "sonner";

export default function Oportunidades() {
  const { data: opportunities = [], isLoading } = useOpportunities();
  const updateOpp = useUpdateOpportunity();
  const deleteOpp = useDeleteOpportunity();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"pipeline" | "lista">("pipeline");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return opportunities.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.client?.toLowerCase().includes(q) ||
        o.responsible?.toLowerCase().includes(q)
    );
  }, [opportunities, search]);

  const stats = useMemo(() => {
    const active = opportunities.filter((o) => !o.stage.startsWith("fechado"));
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
          <p className="text-muted-foreground">Pipeline de vendas com acompanhamento de negociações</p>
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

      {/* Filters */}
      <div className="flex gap-3">
        <Input placeholder="Buscar oportunidades..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pipeline">Pipeline</SelectItem>
            <SelectItem value="lista">Lista</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-10">Carregando...</p>
      ) : viewMode === "pipeline" ? (
        /* Pipeline (Kanban) view */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map((stage) => {
            const items = filtered.filter((o) => o.stage === stage);
            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={`${STAGE_COLORS[stage]} text-xs`}>{STAGE_LABELS[stage]}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {items.map((opp) => (
                    <Card key={opp.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium leading-tight">{opp.name}</p>
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
                              {PIPELINE_STAGES.filter((s) => s !== opp.stage).map((s) => (
                                <DropdownMenuItem key={s} onClick={() => handleStageChange(opp, s)}>
                                  Mover → {STAGE_LABELS[s]}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(opp.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {opp.client && <p className="text-xs text-muted-foreground">{opp.client}</p>}
                        {opp.value != null && <p className="text-xs font-semibold">{fmt(opp.value)}</p>}
                        {opp.responsible && <p className="text-xs text-muted-foreground">{opp.responsible}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3 font-medium">Nome</th>
                  <th className="p-3 font-medium">Cliente</th>
                  <th className="p-3 font-medium">Valor</th>
                  <th className="p-3 font-medium">Etapa</th>
                  <th className="p-3 font-medium">Responsável</th>
                  <th className="p-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma oportunidade encontrada.</td></tr>
                ) : filtered.map((opp) => (
                  <tr key={opp.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{opp.name}</td>
                    <td className="p-3 text-muted-foreground">{opp.client || "—"}</td>
                    <td className="p-3">{opp.value != null ? fmt(opp.value) : "—"}</td>
                    <td className="p-3"><Badge className={`${STAGE_COLORS[opp.stage]} text-xs`}>{STAGE_LABELS[opp.stage]}</Badge></td>
                    <td className="p-3 text-muted-foreground">{opp.responsible || "—"}</td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingOpp(opp); setFormOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(opp.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
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
