import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderKanban, GripVertical, FileText, Plus, Wrench, Bell, ChevronRight, Filter } from "lucide-react";
import ProjectFormDialog from "./projetos/ProjectFormDialog";
import { useProjects, useUpdateProject, type Project, type ProjectStatus } from "@/hooks/useProjects";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import { useProjectMeasurements } from "@/hooks/useMeasurements";
import { useEmployees } from "@/hooks/useEmployees";
import { useClients } from "@/hooks/useClients";
import { useProjectServices } from "@/hooks/useProjectServices";
import MeasurementFormDialog from "@/components/operacional/MeasurementFormDialog";
import ProjectServicesSection from "@/components/projetos/ProjectServicesSection";
import DeadlineBadge from "@/components/DeadlineBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import {
  EXEC_STATUS_LABELS, EXEC_STATUS_COLORS, EXEC_STATUS_GROUPS as GROUPS,
  ALL_KANBAN_STATUSES as ALL_EXEC_STATUSES, BILLING_LABELS as BILLING_LABELS_PLAIN,
  BILLING_COLORS, isRecurringBilling,
  type KanbanGroup as GroupDef, type KanbanColumn as ColumnDef,
} from "@/lib/statusConstants";

const EXEC_STATUS_BADGE = EXEC_STATUS_COLORS;
const BILLING_LABELS: Record<string, { label: string; className: string }> = Object.fromEntries(
  Object.entries(BILLING_LABELS_PLAIN).map(([k, label]) => [k, { label, className: BILLING_COLORS[k] || "bg-muted" }])
);

// ── Legacy project_status columns (keep for side panel) ──
const STATUS_BADGE_COLORS: Record<ProjectStatus, string> = {
  planejamento: "bg-blue-100 text-blue-800",
  execucao: "bg-amber-100 text-amber-800",
  entrega: "bg-purple-100 text-purple-800",
  faturamento: "bg-emerald-100 text-emerald-800",
  concluido: "bg-muted text-muted-foreground",
  pausado: "bg-rose-100 text-rose-800",
};

const MEASUREMENT_STATUS: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  aguardando_nf: { label: "Aguardando NF", className: "bg-amber-500 text-white" },
  nf_emitida: { label: "NF Emitida", className: "bg-blue-600 text-white" },
  pago: { label: "Pago", className: "bg-green-600 text-white" },
  cancelado: { label: "Cancelado", className: "bg-red-600 text-white" },
};

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function ProjectMeasurementsTab({ projectId, contractValue }: { projectId: string; contractValue: number | null }) {
  const { data: filtered = [], isLoading } = useProjectMeasurements(projectId);
  const [showNewMeasurement, setShowNewMeasurement] = useState(false);

  const totals = useMemo(() => {
    const totalBruto = filtered.reduce((s, m) => s + (m.valor_bruto || 0), 0);
    const totalNF = filtered.reduce((s, m) => s + (m.valor_nf || 0), 0);
    return { totalBruto, totalNF };
  }, [filtered]);

  const pctContrato = contractValue ? ((totals.totalNF / contractValue) * 100).toFixed(1) : null;

  if (isLoading) return <p className="py-6 text-center text-muted-foreground text-sm">Carregando...</p>;

  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{filtered.length} medição(ões)</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewMeasurement(true)}>
          <Plus className="w-3.5 h-3.5" /> Nova Medição
        </Button>
      </div>
      {!filtered.length ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <FileText className="w-8 h-8" />
          <p className="text-sm">Nenhuma medição registrada para este projeto.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código BM</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Valor NF</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => {
              const st = MEASUREMENT_STATUS[m.status] || { label: m.status, className: "" };
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs font-medium">{m.codigo_bm}</TableCell>
                  <TableCell className="text-xs">{m.period_start} a {m.period_end}</TableCell>
                  <TableCell className="text-sm font-semibold text-right">{formatCurrency(m.valor_nf)}</TableCell>
                  <TableCell><Badge className={st.className}>{st.label}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <tfoot>
            <tr className="border-t bg-muted/40">
              <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-foreground">Total Medido</td>
              <td className="px-4 py-2 text-sm font-bold text-right text-foreground">{formatCurrency(totals.totalBruto)}</td>
              <td />
            </tr>
            <tr className="bg-muted/40">
              <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-foreground">Total NF</td>
              <td className="px-4 py-2 text-sm font-bold text-right text-foreground">{formatCurrency(totals.totalNF)}</td>
              <td />
            </tr>
            {contractValue != null && (
              <tr className="bg-muted/40 border-t">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-foreground">
                  Acumulado do Contrato
                  <span className="ml-1 text-muted-foreground font-normal">({formatCurrency(contractValue)})</span>
                </td>
                <td className="px-4 py-2 text-sm font-bold text-right text-primary">{pctContrato}%</td>
                <td />
              </tr>
            )}
          </tfoot>
        </Table>
      )}
      <MeasurementFormDialog open={showNewMeasurement} onOpenChange={setShowNewMeasurement} defaultProjectId={projectId} />
    </div>
  );
}

export default function Projetos() {
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { data: employees = [] } = useEmployees();
  const { data: clients = [] } = useClients();
  const { role } = useAuth();
  const updateProject = useUpdateProject();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<Partial<Project>>({});
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [visibleGroups, setVisibleGroups] = useState<Record<string, boolean>>({
    campo: true, prancheta: true, financeiro: true,
  });
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [filterClient, setFilterClient] = useState("all");
  const [filterBilling, setFilterBilling] = useState("all");
  const [filterDeadline, setFilterDeadline] = useState("all");

  const canSeeValues = ["master", "diretor"].includes(role ?? "");

  // Active alerts per project
  const { data: alertsByProject = {} } = useQuery({
    queryKey: ["project-active-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("reference_id")
        .eq("resolved", false)
        .eq("reference_type", "project");
      const map: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        if (a.reference_id) map[a.reference_id] = (map[a.reference_id] || 0) + 1;
      });
      return map;
    },
  });

  // Group projects by execution_status
  const grouped = useMemo(() => {
    const map: Record<string, Project[]> = {};
    ALL_EXEC_STATUSES.forEach((s) => (map[s] = []));
    projects.forEach((p) => {
      const es = (p as any).execution_status || "aguardando_campo";
      if (map[es]) {
        // Apply filters
        if (filterClient !== "all" && p.client_id !== filterClient) return;
        if (filterBilling !== "all" && (p as any).billing_type !== filterBilling) return;
        if (filterDeadline !== "all") {
          const dl = (p as any).delivery_deadline;
          if (filterDeadline === "sem_prazo" && dl) return;
          if (filterDeadline === "vencido" && (!dl || new Date(dl) >= new Date())) return;
          if (filterDeadline === "critico") {
            if (!dl) return;
            const days = Math.ceil((new Date(dl).getTime() - Date.now()) / 86400000);
            if (days < 0 || days > 7) return;
          }
          if (filterDeadline === "ok") {
            if (!dl) return;
            const days = Math.ceil((new Date(dl).getTime() - Date.now()) / 86400000);
            if (days <= 7) return;
          }
        }
        map[es].push(p);
      }
    });
    return map;
  }, [projects, filterClient, filterBilling, filterDeadline]);

  const getClientDisplay = (project: Project) => {
    if (project.clients) return project.clients.name;
    if (project.client_id) {
      const cl = clients.find((c) => c.id === project.client_id);
      if (cl) return cl.name;
    }
    return null;
  };

  const openSheet = (project: Project) => {
    setSelectedProject(project);
    setEditForm({ ...project });
  };

  const handleSave = async () => {
    if (!selectedProject) return;
    try {
      await updateProject.mutateAsync({
        id: selectedProject.id,
        name: editForm.name,
        client_id: editForm.client_id,
        service: editForm.service,
        contract_value: editForm.contract_value,
        responsible_id: editForm.responsible_id,
        notes: editForm.notes,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        empresa_faturadora: editForm.empresa_faturadora,
        tipo_documento: editForm.tipo_documento,
        conta_bancaria: editForm.conta_bancaria,
        referencia_contrato: editForm.referencia_contrato,
        instrucao_faturamento_variavel: editForm.instrucao_faturamento_variavel,
        contato_engenheiro: editForm.contato_engenheiro,
        contato_financeiro: editForm.contato_financeiro,
        billing_type: (editForm as any).billing_type,
        execution_status: (editForm as any).execution_status,
      });
      toast.success("Projeto atualizado");
      setSelectedProject(null);
    } catch {
      toast.error("Erro ao salvar projeto");
    }
  };

  const toggleGroup = (key: string) => setVisibleGroups((v) => ({ ...v, [key]: !v[key] }));
  const toggleCol = (key: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Auto-collapse empty columns
  const effectiveCollapsed = useMemo(() => {
    const set = new Set(collapsedCols);
    ALL_EXEC_STATUSES.forEach((s) => {
      if ((grouped[s] || []).length === 0 && !collapsedCols.has(s)) set.add(s);
    });
    // If user explicitly expanded, remove
    collapsedCols.forEach((s) => {
      if (!set.has(s)) set.delete(s);
    });
    return set;
  }, [grouped, collapsedCols]);

  const activeClients = useMemo(() => {
    const ids = new Set(projects.map((p) => p.client_id).filter(Boolean));
    return clients.filter((c) => ids.has(c.id));
  }, [projects, clients]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-primary" /> Projetos
          </h1>
          <p className="text-muted-foreground text-sm">Kanban por status de execução</p>
        </div>
        <Button onClick={() => setNewProjectOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Projeto
        </Button>
      </div>

      {/* Group toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        {GROUPS.map((g) => (
          <Button
            key={g.key}
            variant={visibleGroups[g.key] ? "default" : "outline"}
            size="sm"
            onClick={() => toggleGroup(g.key)}
            className="gap-1.5"
          >
            {g.emoji} {g.label} {visibleGroups[g.key] ? "✓" : ""}
          </Button>
        ))}
        <Separator orientation="vertical" className="h-6 mx-2" />
        {/* Filters */}
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos clientes</SelectItem>
            {activeClients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDeadline} onValueChange={setFilterDeadline}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Prazo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos prazos</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
            <SelectItem value="critico">Crítico (≤7d)</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="sem_prazo">Sem prazo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterBilling} onValueChange={setFilterBilling}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Faturamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="entrega_nf">NF na entrega</SelectItem>
            <SelectItem value="entrega_recibo">Recibo</SelectItem>
            <SelectItem value="medicao_mensal">Medição mensal</SelectItem>
            <SelectItem value="misto">Misto</SelectItem>
            <SelectItem value="sem_documento">Sem documento</SelectItem>
          </SelectContent>
        </Select>
        {(filterClient !== "all" || filterBilling !== "all" || filterDeadline !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
            setFilterClient("all"); setFilterBilling("all"); setFilterDeadline("all");
          }}>Limpar</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">Carregando...</p>
      ) : (
        <div className="space-y-6">
          {GROUPS.filter((g) => visibleGroups[g.key]).map((group) => (
            <div key={group.key}>
              <div className={`flex items-center gap-2 mb-2 pb-1 border-b-2 ${group.borderColor}`}>
                <span className="text-lg">{group.emoji}</span>
                <span className="font-semibold text-sm">{group.label}</span>
                <Badge variant="outline" className="text-xs ml-1">
                  {group.columns.reduce((sum, c) => sum + (grouped[c.key]?.length || 0), 0)}
                </Badge>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {group.columns.map((col) => {
                  const items = grouped[col.key] || [];
                  const collapsed = items.length === 0 && !collapsedCols.has(col.key);

                  if (collapsed) {
                    return (
                      <div
                        key={col.key}
                        className="flex-shrink-0 w-10 rounded-lg bg-muted/30 border flex flex-col items-center py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleCol(col.key)}
                      >
                        <span className="text-[10px] font-medium text-muted-foreground [writing-mode:vertical-lr] rotate-180">
                          {col.label}
                        </span>
                        <Badge variant="outline" className="text-[9px] mt-2 px-1">{items.length}</Badge>
                      </div>
                    );
                  }

                  return (
                    <div key={col.key} className="flex-1 min-w-[200px] max-w-[280px]">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-xs font-semibold text-foreground">{col.label}</span>
                        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                      </div>
                      <div className="space-y-2 min-h-[80px] rounded-lg bg-muted/20 p-1.5">
                        {items.map((project) => {
                          const clientName = getClientDisplay(project);
                          const bt = BILLING_LABELS[(project as any).billing_type] || null;
                          const recurring = isRecurringBilling((project as any).billing_type);
                          const hasAlert = alertsByProject[project.id];
                          return (
                            <Card
                              key={project.id}
                              onClick={() => navigate(`/projetos/${project.id}`)}
                              className="cursor-pointer hover:shadow-md transition-shadow border"
                            >
                              <CardContent className="p-2.5 space-y-1.5">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0 flex-1">
                                    {project.codigo && (
                                      <p className="text-[10px] font-mono font-bold text-primary">{project.codigo}</p>
                                    )}
                                    <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                                    {clientName && <p className="text-xs text-muted-foreground truncate">{clientName}</p>}
                                  </div>
                                  {hasAlert && <Bell className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />}
                                </div>
                                <DeadlineBadge
                                  deadline={(project as any).delivery_deadline ? new Date((project as any).delivery_deadline) : null}
                                  started_at={(project as any).field_started_at ? new Date((project as any).field_started_at) : null}
                                  estimated_days={(project as any).delivery_days_estimated}
                                  completed_at={(project as any).delivered_at ? new Date((project as any).delivered_at) : null}
                                  label="Entrega"
                                />
                                <div className="flex items-center gap-1 flex-wrap">
                                  {recurring && (
                                    <Badge className="bg-blue-100 text-blue-700 text-[10px]">Recorrente</Badge>
                                  )}
                                  {bt && !recurring ? (
                                    <Badge className={bt.className + " text-[10px]"}>{bt.label}</Badge>
                                  ) : !bt ? (
                                    <Badge className="bg-red-100 text-red-800 text-[10px]">Definir faturamento</Badge>
                                  ) : null}
                                  {canSeeValues && project.contract_value != null && (
                                    <span className="text-[10px] font-semibold text-foreground">
                                      {formatCurrency(project.contract_value)}
                                    </span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                        {items.length === 0 && (
                          <p className="text-[10px] text-muted-foreground text-center py-3">Vazio</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side panel - keep existing detail logic */}
      <Sheet open={!!selectedProject} onOpenChange={(o) => !o && setSelectedProject(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do Projeto</SheetTitle>
          </SheetHeader>
          {selectedProject && (
            <Tabs defaultValue="dados" className="mt-4">
              {selectedProject.codigo && (
                <div className="mb-3 px-1">
                  <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                    {selectedProject.codigo}
                  </span>
                </div>
              )}
              <TabsList className="w-full">
                <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
                <TabsTrigger value="servicos" className="flex-1">Serviços</TabsTrigger>
                <TabsTrigger value="faturamento" className="flex-1">Faturamento</TabsTrigger>
                <TabsTrigger value="medicoes" className="flex-1">Medições</TabsTrigger>
              </TabsList>

              <TabsContent value="dados">
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Nome do Projeto</Label>
                    <Input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Cliente</Label>
                    <Select
                      value={editForm.client_id || ""}
                      onValueChange={(val) => {
                        const cl = clients.find((c) => c.id === val);
                        setEditForm({ ...editForm, client_id: val });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.filter(c => c.is_active).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}{c.cnpj ? ` — ${c.cnpj}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Serviço</Label>
                    <Select value={editForm.service || "none"} onValueChange={(v) => setEditForm({ ...editForm, service: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione...</SelectItem>
                        {SERVICE_TYPES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor do Contrato (R$)</Label>
                    <Input
                      type="number"
                      value={editForm.contract_value ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, contract_value: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                  <div>
                    <Label>Responsável</Label>
                    <Select
                      value={editForm.responsible_id || ""}
                      onValueChange={(val) => setEditForm({ ...editForm, responsible_id: val })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {employees.filter((e) => e.status !== "desligado").map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Empresa Faturadora</Label>
                    <Select value={editForm.empresa_faturadora || "ag_topografia"} onValueChange={(val) => setEditForm({ ...editForm, empresa_faturadora: val })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ag_topografia">AG Topografia</SelectItem>
                        <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data Início</Label>
                      <Input type="date" value={editForm.start_date || ""} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value || null })} />
                    </div>
                    <div>
                      <Label>Data Fim</Label>
                      <Input type="date" value={editForm.end_date || ""} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value || null })} />
                    </div>
                  </div>
                  <div>
                    <Label>Status Execução</Label>
                    <Select
                      value={(editForm as any).execution_status || ""}
                      onValueChange={async (val) => {
                        const prev = (editForm as any).execution_status;
                        setEditForm({ ...editForm, execution_status: val } as any);
                        // Gravar histórico imediatamente
                        if (prev && prev !== val) {
                          await supabase.from("project_status_history").insert({
                            project_id: selectedProject.id,
                            from_status: prev,
                            to_status: val,
                            modulo: "projetos",
                            changed_by_id: user?.id || null,
                          });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {ALL_EXEC_STATUSES.map((s) => {
                          const group = GROUPS.find(g => g.columns.some(c => c.key === s));
                          const col = group?.columns.find(c => c.key === s);
                          return (
                            <SelectItem key={s} value={s}>
                              {group?.emoji} {col?.label || s}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de Faturamento *</Label>
                    <Select value={(editForm as any).billing_type || ""} onValueChange={(val) => setEditForm({ ...editForm, billing_type: val } as any)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrega_nf">NF na entrega</SelectItem>
                        <SelectItem value="entrega_recibo">Recibo na entrega</SelectItem>
                        <SelectItem value="medicao_mensal">Por medição mensal</SelectItem>
                        <SelectItem value="misto">Misto</SelectItem>
                        <SelectItem value="sem_documento">Sem documento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator className="my-2" />
                  <div>
                    <Label>Observações</Label>
                    <Textarea value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={updateProject.isPending} className="flex-1">
                      {updateProject.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedProject(null)}>Cancelar</Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="servicos">
                <ProjectServicesSection projectId={selectedProject.id} />
              </TabsContent>

              <TabsContent value="faturamento">
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>CNPJ Tomador</Label>
                    <Input value={(editForm as any).cnpj_tomador || ""} onChange={(e) => setEditForm({ ...editForm, cnpj_tomador: e.target.value } as any)} />
                  </div>
                  <div>
                    <Label>Conta Bancária</Label>
                    <Select value={editForm.conta_bancaria || ""} onValueChange={(v) => setEditForm({ ...editForm, conta_bancaria: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bradesco Gonzaga">Bradesco Gonzaga</SelectItem>
                        <SelectItem value="BB Cartografia">BB Cartografia</SelectItem>
                        <SelectItem value="BB Gonzaga">BB Gonzaga</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Referência de Faturamento</Label>
                    <Input value={editForm.referencia_contrato || ""} onChange={(e) => setEditForm({ ...editForm, referencia_contrato: e.target.value })} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={updateProject.isPending} className="flex-1">
                      {updateProject.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedProject(null)}>Cancelar</Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="medicoes">
                <ProjectMeasurementsTab projectId={selectedProject.id} contractValue={selectedProject.contract_value} />
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      <ProjectFormDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  );
}
