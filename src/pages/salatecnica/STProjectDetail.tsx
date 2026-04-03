import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useScopeItems, useCreateScopeItem, useUpdateScopeItem } from "@/hooks/useScopeItems";
import { useTechnicalTasksByProject, useCreateTechnicalTask, useUpdateTechnicalTask } from "@/hooks/useTechnicalTasks";
import { useEmployees } from "@/hooks/useEmployees";
import DeadlineBadge from "@/components/DeadlineBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Copy, Plus, Play, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

const BILLING_BADGES: Record<string, { label: string; cls: string }> = {
  entrega_nf: { label: "NF na entrega", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  entrega_recibo: { label: "Recibo na entrega", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  medicao_mensal: { label: "Por medição", cls: "bg-blue-50 text-blue-700 border-blue-300" },
  misto: { label: "Misto", cls: "bg-yellow-50 text-yellow-700 border-yellow-300" },
};

const TASK_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", cls: "bg-blue-50 text-blue-700 border-blue-300" },
  concluida: { label: "Concluída", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  cancelada: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
};

export default function STProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [addScopeOpen, setAddScopeOpen] = useState(false);
  const [scopeDesc, setScopeDesc] = useState("");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", assigned_to_id: "", due_date: null as Date | null, description: "" });
  const [concludeTaskId, setConcludeTaskId] = useState<string | null>(null);
  const [concludeNote, setConcludeNote] = useState("");

  const { data: project } = useQuery({
    queryKey: ["st_project_detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(id, name, cnpj)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const p = data as any;
      return { ...p, clients: Array.isArray(p.clients) ? p.clients[0] : p.clients };
    },
  });

  const { data: scopeItems = [] } = useScopeItems(id || null);
  const { data: tasks = [] } = useTechnicalTasksByProject(id || null);
  const { data: employees = [] } = useEmployees();
  const createScope = useCreateScopeItem();
  const updateScope = useUpdateScopeItem();
  const createTask = useCreateTechnicalTask();
  const updateTask = useUpdateTechnicalTask();

  const activeEmployees = useMemo(() => employees.filter((e: any) => e.status !== "desligado"), [employees]);
  const completedScope = scopeItems.filter(s => s.is_completed).length;

  if (!project) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  const address = [project.rua, project.numero, project.bairro, project.cidade, project.estado]
    .filter(Boolean).join(", ");

  const copyToClipboard = () => {
    const text = [
      `Cliente: ${project.clients?.name || "—"}`,
      `CNPJ: ${project.cnpj_tomador || "—"}`,
      `Endereço: ${address || "—"}`,
      `Serviço: ${project.service || "—"}`,
      `Código: ${project.codigo || "—"}`,
      `Responsável: ${project.contato_engenheiro || "—"}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Dados copiados para a área de transferência");
  };

  const handleScopeToggle = (item: any) => {
    updateScope.mutate({
      id: item.id,
      is_completed: !item.is_completed,
      completed_at: !item.is_completed ? new Date().toISOString() : null,
      completed_by_id: !item.is_completed ? (user?.id || null) : null,
    });
  };

  const handleAddScope = () => {
    if (!scopeDesc.trim()) return;
    const maxIdx = scopeItems.length ? Math.max(...scopeItems.map(s => s.order_index)) : -1;
    createScope.mutate({ project_id: id!, description: scopeDesc.trim(), order_index: maxIdx + 1 });
    setScopeDesc("");
    setAddScopeOpen(false);
  };

  const handleAddTask = () => {
    if (!taskForm.title.trim()) return;
    createTask.mutate({
      project_id: id!,
      title: taskForm.title.trim(),
      description: taskForm.description || undefined,
      assigned_to_id: taskForm.assigned_to_id || undefined,
      due_date: taskForm.due_date ? format(taskForm.due_date, "yyyy-MM-dd") : undefined,
      created_by_id: user?.id,
    });
    setTaskForm({ title: "", assigned_to_id: "", due_date: null, description: "" });
    setAddTaskOpen(false);
  };

  const handleStartTask = (taskId: string) => {
    updateTask.mutate({ id: taskId, status: "em_andamento" } as any);
  };

  const handleConcludeTask = () => {
    if (!concludeTaskId) return;
    updateTask.mutate({
      id: concludeTaskId,
      status: "concluida",
      completed_at: new Date().toISOString(),
      description: concludeNote || undefined,
    } as any);
    setConcludeTaskId(null);
    setConcludeNote("");
  };

  const bt = project.billing_type;
  const billingBadge = !bt
    ? <Badge variant="destructive" className="text-[10px]">⚠ Faturamento indefinido</Badge>
    : BILLING_BADGES[bt]
      ? <Badge variant="outline" className={`text-[10px] ${BILLING_BADGES[bt].cls}`}>{BILLING_BADGES[bt].label}</Badge>
      : <Badge variant="outline" className="text-[10px]">{bt}</Badge>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/sala-tecnica")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold">{project.codigo || "—"}</h2>
              <p className="text-sm">{project.name}</p>
              {project.clients?.name && <p className="text-xs text-muted-foreground">{project.clients.name}</p>}
            </div>
            <div className="flex items-center gap-2">
              {billingBadge}
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar dados para RRT/ART
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
            {project.cnpj_tomador && <div><strong>CNPJ Tomador:</strong> {project.cnpj_tomador}</div>}
            {address && <div><strong>Endereço:</strong> {address}</div>}
            {project.service && <div><strong>Serviço:</strong> {project.service}</div>}
            {project.contato_engenheiro && <div><strong>Resp. Técnico:</strong> {project.contato_engenheiro}</div>}
          </div>
          <DeadlineBadge
            deadline={project.delivery_deadline ? new Date(project.delivery_deadline) : null}
            started_at={project.field_completed_at ? new Date(project.field_completed_at) : null}
            estimated_days={project.delivery_days_estimated}
            completed_at={project.delivered_at ? new Date(project.delivered_at) : null}
            label="Entrega"
          />
        </CardContent>
      </Card>

      {/* Scope */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Escopo / Itens para RRT/ART</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddScopeOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar item
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{completedScope} de {scopeItems.length} itens concluídos</p>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {scopeItems.map(item => (
            <div key={item.id} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
              <Checkbox
                checked={!!item.is_completed}
                onCheckedChange={() => handleScopeToggle(item)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <span className={cn("text-sm", item.is_completed && "line-through text-muted-foreground")}>
                  {item.description}
                </span>
                {item.is_completed && item.completed_at && (
                  <Badge variant="outline" className="ml-2 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                    Concluído {format(new Date(item.completed_at), "dd/MM/yyyy")}
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {!scopeItems.length && <p className="text-xs text-muted-foreground py-4 text-center">Nenhum item de escopo cadastrado</p>}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Distribuição de Tarefas</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddTaskOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Distribuir tarefa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.map(t => {
            const sb = TASK_STATUS_BADGE[t.status] || TASK_STATUS_BADGE.pendente;
            const emp = employees.find((e: any) => e.id === t.assigned_to_id);
            return (
              <div key={t.id} className="flex items-center justify-between p-2 rounded border gap-2">
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium">{t.title}</p>
                  {emp && <p className="text-[10px] text-muted-foreground">{(emp as any).name}</p>}
                  {t.due_date && (
                    <DeadlineBadge
                      deadline={new Date(t.due_date)}
                      started_at={null}
                      estimated_days={null}
                      completed_at={t.completed_at ? new Date(t.completed_at) : null}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[10px] ${sb.cls}`}>{sb.label}</Badge>
                  {t.status === "pendente" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleStartTask(t.id)}>
                      <Play className="w-3 h-3 mr-0.5" /> Iniciar
                    </Button>
                  )}
                  {t.status === "em_andamento" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConcludeTaskId(t.id)}>
                      <CheckCircle className="w-3 h-3 mr-0.5" /> Concluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {!tasks.length && <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma tarefa distribuída</p>}
        </CardContent>
      </Card>

      {/* Add Scope Dialog */}
      <Dialog open={addScopeOpen} onOpenChange={setAddScopeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar item de escopo</DialogTitle></DialogHeader>
          <Textarea placeholder="Descrição do item..." value={scopeDesc} onChange={e => setScopeDesc(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddScopeOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddScope} disabled={!scopeDesc.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Distribuir tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={taskForm.assigned_to_id} onValueChange={v => setTaskForm(p => ({ ...p, assigned_to_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} — {e.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !taskForm.due_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taskForm.due_date ? format(taskForm.due_date, "dd/MM/yyyy") : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={taskForm.due_date || undefined} onSelect={d => setTaskForm(p => ({ ...p, due_date: d || null }))} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTaskOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddTask} disabled={!taskForm.title.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conclude Task Dialog */}
      <Dialog open={!!concludeTaskId} onOpenChange={() => setConcludeTaskId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Concluir tarefa</DialogTitle></DialogHeader>
          <Textarea placeholder="Observação (opcional)" value={concludeNote} onChange={e => setConcludeNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcludeTaskId(null)}>Cancelar</Button>
            <Button onClick={handleConcludeTask}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
