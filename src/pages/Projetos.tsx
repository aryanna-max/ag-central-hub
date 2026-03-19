import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { FolderKanban, GripVertical, FileText } from "lucide-react";
import { useProjects, useUpdateProject, type Project, type ProjectStatus } from "@/hooks/useProjects";
import { useProjectMeasurements } from "@/hooks/useMeasurements";
import { toast } from "sonner";

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
  measurements,
}: {
  projectName: string;
  clientName: string | null;
  measurements: Measurement[];
}) {
  const filtered = useMemo(() => {
    const nameLC = projectName.toLowerCase();
    const clientLC = clientName?.toLowerCase() || "";
    return measurements.filter((m) => {
      const obraLC = (m.obra_name || "").toLowerCase();
      return (obraLC && (obraLC.includes(nameLC) || nameLC.includes(obraLC) || (clientLC && obraLC.includes(clientLC))));
    });
  }, [projectName, clientName, measurements]);

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <FileText className="w-8 h-8" />
        <p className="text-sm">Nenhuma medição vinculada a este projeto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      <p className="text-xs text-muted-foreground">{filtered.length} medição(ões) encontrada(s)</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Valor NF</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((m) => {
            const st = MEASUREMENT_STATUS[m.status] || { label: m.status, className: "" };
            return (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.codigo_bm}</TableCell>
                <TableCell className="text-xs">{m.period_start} a {m.period_end}</TableCell>
                <TableCell className="text-sm font-semibold">{formatCurrency(m.valor_nf)}</TableCell>
                <TableCell>
                  <Badge className={st.className}>{st.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function Projetos() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: allMeasurements = [] } = useMeasurements();
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
        notes: editForm.notes,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
      });
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
                    <Input
                      value={editForm.responsible || ""}
                      onChange={(e) => setEditForm({ ...editForm, responsible: e.target.value })}
                    />
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
                  measurements={allMeasurements}
                />
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
