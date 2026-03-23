import { useState, useMemo } from "react";
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
import { FolderKanban, GripVertical, FileText, Plus } from "lucide-react";
import { useProjects, useUpdateProject, type Project, type ProjectStatus } from "@/hooks/useProjects";
import { useProjectMeasurements } from "@/hooks/useMeasurements";
import { useEmployees } from "@/hooks/useEmployees";
import MeasurementFormDialog from "@/components/operacional/MeasurementFormDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const COLUMNS: { key: ProjectStatus; label: string; color: string }[] = [
  { key: "planejamento", label: "Planejamento", color: "bg-blue-500" },
  { key: "execucao", label: "Execução", color: "bg-amber-500" },
  { key: "entrega", label: "Entrega", color: "bg-purple-500" },
  { key: "faturamento", label: "Faturamento", color: "bg-emerald-500" },
  { key: "concluido", label: "Concluído", color: "bg-muted-foreground" },
  { key: "pausado", label: "Pausado", color: "bg-rose-500" },
];

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

function ProjectMeasurementsTab({
  projectName,
  clientName,
  contractValue,
}: {
  projectName: string;
  clientName: string | null;
  contractValue: number | null;
}) {
  const { data: matchedProject } = useQuery({
    queryKey: ["project-id-by-name", projectName],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id").eq("name", projectName).maybeSingle();
      return data?.id ?? null;
    },
  });
  const { data: filtered = [], isLoading } = useProjectMeasurements(matchedProject ?? null);
  const [showNewMeasurement, setShowNewMeasurement] = useState(false);

  // Find matching obra_id by project name
  const { data: matchedObraId } = useQuery({
    queryKey: ["project-match", projectName],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id")
        .ilike("name", `%${projectName}%`)
        .eq("is_active", true)
        .limit(1);
      return data?.[0]?.id || null;
    },
    enabled: !!projectName,
  });

  const totals = useMemo(() => {
    const totalBruto = filtered.reduce((s, m) => s + (m.valor_bruto || 0), 0);
    const totalNF = filtered.reduce((s, m) => s + (m.valor_nf || 0), 0);
    return { totalBruto, totalNF };
  }, [filtered]);

  const pctContrato = contractValue ? ((totals.totalNF / contractValue) * 100).toFixed(1) : null;

  if (isLoading) {
    return <p className="py-6 text-center text-muted-foreground text-sm">Carregando...</p>;
  }

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
            <TableHead>Equipe</TableHead>
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
                <TableCell className="text-xs">{m.team_name || "—"}</TableCell>
                <TableCell className="text-sm font-semibold text-right">{formatCurrency(m.valor_nf)}</TableCell>
                <TableCell>
                  <Badge className={st.className}>{st.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <tfoot>
          <tr className="border-t bg-muted/40">
            <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-foreground">Total Medido</td>
            <td className="px-4 py-2 text-sm font-bold text-right text-foreground">{formatCurrency(totals.totalBruto)}</td>
            <td />
          </tr>
          <tr className="bg-muted/40">
            <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-foreground">Total NF</td>
            <td className="px-4 py-2 text-sm font-bold text-right text-foreground">{formatCurrency(totals.totalNF)}</td>
            <td />
          </tr>
          {contractValue != null && (
            <tr className="bg-muted/40 border-t">
              <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-foreground">
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

      <MeasurementFormDialog
        open={showNewMeasurement}
        onOpenChange={setShowNewMeasurement}
        defaultObraId={matchedObraId || undefined}
      />
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function Projetos() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: employees = [] } = useEmployees();
  const updateProject = useUpdateProject();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<Partial<Project>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<ProjectStatus, Project[]> = {
      planejamento: [],
      execucao: [],
      entrega: [],
      faturamento: [],
      concluido: [],
      pausado: [],
    };
    projects.forEach((p) => {
      if (map[p.status]) map[p.status].push(p);
    });
    return map;
  }, [projects]);

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
        client: editForm.client,
        client_cnpj: editForm.client_cnpj,
        service: editForm.service,
        contract_value: editForm.contract_value,
        responsible: editForm.responsible,
        responsible_id: editForm.responsible_id,
        notes: editForm.notes,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        empresa_faturadora: editForm.empresa_faturadora,
        tipo_documento: editForm.tipo_documento,
        cnpj: (editForm as any).cnpj,
        empresa_emissora: (editForm as any).empresa_emissora,
        conta_bancaria: (editForm as any).conta_bancaria,
        modalidade_faturamento: (editForm as any).modalidade_faturamento,
        referencia_contrato: (editForm as any).referencia_contrato,
        instrucao_faturamento_variavel: (editForm as any).instrucao_faturamento_variavel,
        contato_engenheiro: (editForm as any).contato_engenheiro,
        contato_financeiro: (editForm as any).contato_financeiro,
      } as any);
      toast.success("Projeto atualizado");
      setSelectedProject(null);
    } catch {
      toast.error("Erro ao salvar projeto");
    }
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(projectId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: ProjectStatus) => {
    e.preventDefault();
    if (!draggedId) return;
    const project = projects.find((p) => p.id === draggedId);
    if (!project || project.status === targetStatus) {
      setDraggedId(null);
      return;
    }
    try {
      await updateProject.mutateAsync({ id: draggedId, status: targetStatus });
      toast.success(`Movido para ${COLUMNS.find((c) => c.key === targetStatus)?.label}`);
    } catch {
      toast.error("Erro ao mover projeto");
    }
    setDraggedId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FolderKanban className="w-6 h-6 text-primary" /> Projetos
        </h1>
        <p className="text-muted-foreground text-sm">Gestão de projetos criados a partir de leads convertidos</p>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-10">Carregando...</p>
      ) : (
        <div className="grid grid-cols-5 gap-4 min-h-[60vh]">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className="flex flex-col"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <span className="text-sm font-semibold text-foreground">{col.label}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {grouped[col.key].length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 min-h-[100px] rounded-lg bg-muted/30 p-2">
                {grouped[col.key].map((project) => (
                  <Card
                    key={project.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, project.id)}
                    onClick={() => openSheet(project)}
                    className={`cursor-pointer hover:shadow-md transition-shadow border ${
                      draggedId === project.id ? "opacity-40" : ""
                    }`}
                  >
                    <CardContent className="p-3 space-y-2">
                      {project.codigo && (
                        <p className="text-[10px] font-mono font-bold text-primary">{project.codigo}</p>
                      )}
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0 cursor-grab" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{project.client || project.name}</p>
                          {project.service && (
                            <p className="text-xs text-muted-foreground truncate">{project.service}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground">
                          {formatCurrency(project.contract_value)}
                        </span>
                        {project.responsible && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {project.responsible}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side panel */}
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
                <TabsTrigger value="medicoes" className="flex-1">Medições</TabsTrigger>
              </TabsList>

              <TabsContent value="dados">
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={editForm.name || ""}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Cliente</Label>
                    <Input
                      value={editForm.client || ""}
                      onChange={(e) => setEditForm({ ...editForm, client: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <Input
                      value={editForm.client_cnpj || ""}
                      onChange={(e) => setEditForm({ ...editForm, client_cnpj: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Serviço</Label>
                    <Input
                      value={editForm.service || ""}
                      onChange={(e) => setEditForm({ ...editForm, service: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Valor do Contrato (R$)</Label>
                    <Input
                      type="number"
                      value={editForm.contract_value ?? ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, contract_value: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </div>
                  <div>
                    <Label>Responsável</Label>
                    <Select
                      value={editForm.responsible_id || ""}
                      onValueChange={(val) => {
                        const emp = employees.find((e) => e.id === val);
                        setEditForm({
                          ...editForm,
                          responsible_id: val,
                          responsible: emp?.name || null,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um funcionário" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter((e) => e.status !== "desligado")
                          .map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Empresa Faturadora</Label>
                    <Select
                      value={editForm.empresa_faturadora || "ag_topografia"}
                      onValueChange={(val) => setEditForm({ ...editForm, empresa_faturadora: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ag_topografia">AG Topografia e Construções</SelectItem>
                        <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de Documento</Label>
                    <Select
                      value={editForm.tipo_documento || "nota_fiscal"}
                      onValueChange={(val) => setEditForm({ ...editForm, tipo_documento: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                        <SelectItem value="recibo">Recibo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={editForm.start_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={editForm.end_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value || null })}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Badge className={`${STATUS_BADGE_COLORS[selectedProject.status]} mt-1`}>
                      {COLUMNS.find((c) => c.key === selectedProject.status)?.label}
                    </Badge>
                  </div>
                  <Separator className="my-2" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Faturamento</p>
                  <div>
                    <Label>CNPJ Tomador da NF</Label>
                    <Input value={(editForm as any).cnpj || ""} onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value } as any)} />
                  </div>
                  <div>
                    <Label>Empresa Emissora</Label>
                    <Select value={(editForm as any).empresa_emissora || "AG Topografia"} onValueChange={(v) => setEditForm({ ...editForm, empresa_emissora: v } as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AG Topografia">AG Topografia</SelectItem>
                        <SelectItem value="AG Cartografia">AG Cartografia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Conta Bancária</Label>
                    <Select value={(editForm as any).conta_bancaria || ""} onValueChange={(v) => setEditForm({ ...editForm, conta_bancaria: v } as any)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bradesco Gonzaga">Bradesco Gonzaga</SelectItem>
                        <SelectItem value="BB Cartografia">BB Cartografia</SelectItem>
                        <SelectItem value="BB Gonzaga">BB Gonzaga</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modalidade</Label>
                    <Select value={(editForm as any).modalidade_faturamento || ""} onValueChange={(v) => setEditForm({ ...editForm, modalidade_faturamento: v } as any)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar modalidade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equipe_mensal">Equipe mensal</SelectItem>
                        <SelectItem value="por_medicao">Por medição</SelectItem>
                        <SelectItem value="diaria">Diária</SelectItem>
                        <SelectItem value="por_servico">Por serviço</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Referência de Faturamento</Label>
                    <Input value={(editForm as any).referencia_contrato || ""} onChange={(e) => setEditForm({ ...editForm, referencia_contrato: e.target.value } as any)} placeholder="Contrato, BM, pedido..." />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label>Instrução variável de faturamento</Label>
                    <input type="checkbox" checked={(editForm as any).instrucao_faturamento_variavel || false} onChange={(e) => setEditForm({ ...editForm, instrucao_faturamento_variavel: e.target.checked } as any)} />
                  </div>

                  <Separator className="my-2" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contatos</p>
                  <div>
                    <Label>Engenheiro Responsável</Label>
                    <Input value={(editForm as any).contato_engenheiro || ""} onChange={(e) => setEditForm({ ...editForm, contato_engenheiro: e.target.value } as any)} />
                  </div>
                  <div>
                    <Label>Contato Financeiro</Label>
                    <Input value={(editForm as any).contato_financeiro || ""} onChange={(e) => setEditForm({ ...editForm, contato_financeiro: e.target.value } as any)} />
                  </div>

                  <Separator className="my-2" />
                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={editForm.notes || ""}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={updateProject.isPending} className="flex-1">
                      {updateProject.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedProject(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="medicoes">
                <ProjectMeasurementsTab
                  projectName={selectedProject.name}
                  clientName={selectedProject.client}
                  contractValue={selectedProject.contract_value}
                />
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
