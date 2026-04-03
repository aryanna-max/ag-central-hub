import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUpdateProject } from "@/hooks/useProjects";
import { useCreateTechnicalTask } from "@/hooks/useTechnicalTasks";
import { useEmployees } from "@/hooks/useEmployees";
import DeadlineBadge from "@/components/DeadlineBadge";
import { ClipboardList, Bell, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Col = { key: string; label: string; readonly?: boolean };
const COLUMNS: Col[] = [
  { key: "aguardando_processamento", label: "Aguardando processamento" },
  { key: "em_processamento", label: "Em processamento" },
  { key: "revisao", label: "Em revisão" },
  { key: "aprovado", label: "Aprovado" },
  { key: "entregue", label: "Entregue", readonly: true },
];

const BILLING_BADGES: Record<string, { label: string; cls: string }> = {
  entrega_nf: { label: "NF na entrega", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  entrega_recibo: { label: "Recibo na entrega", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  medicao_mensal: { label: "Por medição", cls: "bg-blue-50 text-blue-700 border-blue-300" },
  misto: { label: "Misto", cls: "bg-yellow-50 text-yellow-700 border-yellow-300" },
};

interface ProjectRow {
  id: string;
  codigo: string | null;
  name: string;
  execution_status: string | null;
  billing_type: string | null;
  delivery_deadline: string | null;
  field_completed_at: string | null;
  delivery_days_estimated: number | null;
  delivered_at: string | null;
  needs_tech_prep: boolean | null;
  client_name: string | null;
  pending_scope: number;
  task_done: number;
  task_total: number;
  has_active_alert: boolean;
  responsible_tecnico_name: string | null;
  responsible_campo_name: string | null;
  task_assignee_names: string[];
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export default function STKanban() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const updateProject = useUpdateProject();
  const createTask = useCreateTechnicalTask();
  const { data: employees = [] } = useEmployees();
  const [confirmDlg, setConfirmDlg] = useState<{ project: ProjectRow; pendingCount: number } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [quickTaskProject, setQuickTaskProject] = useState<ProjectRow | null>(null);
  const [quickTaskForm, setQuickTaskForm] = useState({ title: "", assigned_to_id: "", due_date: null as Date | null });

  const activeEmployees = useMemo(() => employees.filter((e: any) => e.status !== "desligado"), [employees]);

  const { data: projects = [], refetch } = useQuery({
    queryKey: ["st_kanban_projects"],
    queryFn: async () => {
      const validStatuses = COLUMNS.map(c => c.key) as string[];
      const { data: rows, error } = await supabase
        .from("projects")
        .select("id, codigo, name, execution_status, billing_type, delivery_deadline, field_completed_at, delivery_days_estimated, delivered_at, client_id, is_active, needs_tech_prep, responsible_tecnico_id, responsible_campo_id")
        .in("execution_status", validStatuses as any)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      const ids = (rows || []).map(r => r.id);
      if (!ids.length) return [];

      const [clientsRes, scopeRes, tasksRes, alertsRes, profilesRes] = await Promise.all([
        supabase.from("clients").select("id, name"),
        supabase.from("project_scope_items").select("project_id, is_completed").in("project_id", ids as any),
        supabase.from("technical_tasks").select("project_id, status, assigned_to_id").in("project_id", ids as any),
        (supabase.from("alerts").select("reference_id").in("reference_id", ids as any) as any).eq("resolved", false),
        supabase.from("profiles").select("id, full_name"),
      ]);

      const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]));
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name]));
      const employeeMap = new Map(employees.map((e: any) => [e.id, e.name]));

      const scopeByProject = new Map<string, number>();
      (scopeRes.data || []).forEach((s: any) => {
        if (!s.is_completed) scopeByProject.set(s.project_id, (scopeByProject.get(s.project_id) || 0) + 1);
      });

      const tasksByProject = new Map<string, { done: number; total: number; assignees: Set<string> }>();
      (tasksRes.data || []).forEach((t: any) => {
        const cur = tasksByProject.get(t.project_id) || { done: 0, total: 0, assignees: new Set<string>() };
        cur.total++;
        if (t.status === "concluida") cur.done++;
        if (t.assigned_to_id && t.status !== "concluida" && t.status !== "cancelada") {
          cur.assignees.add(t.assigned_to_id);
        }
        tasksByProject.set(t.project_id, cur);
      });
      const alertSet = new Set((alertsRes.data || []).map((a: any) => a.reference_id));

      return (rows || []).map((r: any): ProjectRow => {
        const tasks = tasksByProject.get(r.id) || { done: 0, total: 0, assignees: new Set<string>() };
        const assigneeNames: string[] = [];
        tasks.assignees.forEach(id => {
          const name = employeeMap.get(id) || profileMap.get(id);
          if (name) assigneeNames.push(name as string);
        });

        return {
          id: r.id,
          codigo: r.codigo,
          name: r.name,
          execution_status: r.execution_status,
          billing_type: r.billing_type,
          delivery_deadline: r.delivery_deadline,
          field_completed_at: r.field_completed_at,
          delivery_days_estimated: r.delivery_days_estimated,
          delivered_at: r.delivered_at,
          needs_tech_prep: r.needs_tech_prep,
          client_name: clientMap.get(r.client_id) || null,
          pending_scope: scopeByProject.get(r.id) || 0,
          task_done: tasks.done,
          task_total: tasks.total,
          has_active_alert: alertSet.has(r.id),
          responsible_tecnico_name: r.responsible_tecnico_id ? (profileMap.get(r.responsible_tecnico_id) as string || null) : null,
          responsible_campo_name: r.responsible_campo_id ? (profileMap.get(r.responsible_campo_id) as string || null) : null,
          task_assignee_names: assigneeNames,
        };
      });
    },
  });

  // Sort by delivery_deadline ASC, null last
  const byCol = useMemo(() => {
    const map: Record<string, ProjectRow[]> = {};
    COLUMNS.forEach(c => (map[c.key] = []));
    projects.forEach(p => {
      if (p.execution_status && map[p.execution_status]) map[p.execution_status].push(p);
    });
    // Sort each column
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => {
        const aDate = a.delivery_deadline;
        const bDate = b.delivery_deadline;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate);
      });
    });
    return map;
  }, [projects]);

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const isNewNeedDistribute = (p: ProjectRow) => {
    return p.execution_status === "aguardando_processamento" &&
      p.needs_tech_prep === true &&
      p.task_total === 0;
  };

  const handleDrop = async (colKey: string) => {
    if (!draggedId) return;
    const col = COLUMNS.find(c => c.key === colKey);
    if (col?.readonly) return;
    const project = projects.find(p => p.id === draggedId);
    if (!project || project.execution_status === colKey) return;

    if (colKey === "entregue") return;

    await updateProject.mutateAsync({ id: project.id, execution_status: colKey } as any);
    await supabase.from("project_status_history").insert({
      project_id: project.id,
      from_status: project.execution_status,
      to_status: colKey,
      modulo: "sala_tecnica",
      changed_by_id: user?.id || null,
    } as any);
    refetch();
    setDraggedId(null);
  };

  const handleDeliverClick = async (p: ProjectRow) => {
    if (p.pending_scope > 0) {
      setConfirmDlg({ project: p, pendingCount: p.pending_scope });
    } else {
      await doDeliver(p);
    }
  };

  const doDeliver = async (p: ProjectRow) => {
    await updateProject.mutateAsync({ id: p.id, execution_status: "entregue" } as any);
    await supabase.from("project_status_history").insert({
      project_id: p.id,
      from_status: p.execution_status,
      to_status: "entregue",
      modulo: "sala_tecnica",
      changed_by_id: user?.id || null,
    } as any);
    toast.success(`Projeto ${p.codigo || p.name} marcado como entregue`);
    setConfirmDlg(null);
    refetch();
  };

  const handleQuickTask = async () => {
    if (!quickTaskProject || !quickTaskForm.title.trim()) return;
    await createTask.mutateAsync({
      project_id: quickTaskProject.id,
      title: quickTaskForm.title.trim(),
      assigned_to_id: quickTaskForm.assigned_to_id || undefined,
      due_date: quickTaskForm.due_date ? format(quickTaskForm.due_date, "yyyy-MM-dd") : undefined,
      created_by_id: user?.id,
    });
    toast.success("Tarefa criada");
    setQuickTaskProject(null);
    setQuickTaskForm({ title: "", assigned_to_id: "", due_date: null });
    refetch();
    qc.invalidateQueries({ queryKey: ["technical_tasks"] });
  };

  const billingBadge = (bt: string | null) => {
    if (!bt) return <Badge variant="destructive" className="text-[10px]">⚠ Faturamento indefinido</Badge>;
    const b = BILLING_BADGES[bt];
    if (!b) return <Badge variant="outline" className="text-[10px]">{bt}</Badge>;
    return <Badge variant="outline" className={`text-[10px] ${b.cls}`}>{b.label}</Badge>;
  };

  return (
    <TooltipProvider>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[60vh]">
        {COLUMNS.map(col => (
          <div
            key={col.key}
            className="flex-shrink-0 w-[280px] bg-muted/30 rounded-lg p-2"
            onDragOver={col.readonly ? undefined : e => e.preventDefault()}
            onDrop={col.readonly ? undefined : () => handleDrop(col.key)}
          >
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-1">
              {col.label} ({byCol[col.key]?.length || 0})
            </h3>
            <div className="space-y-2">
              {(byCol[col.key] || []).map(p => (
                <Card
                  key={p.id}
                  draggable={!col.readonly}
                  onDragStart={() => setDraggedId(p.id)}
                  className={cn(
                    `cursor-${col.readonly ? "default" : "grab"} hover:shadow-md transition-shadow`,
                    isOverdue(p.delivery_deadline) && !p.delivered_at && "border-destructive border-2"
                  )}
                >
                  <CardContent className="p-3 space-y-1.5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-bold text-primary cursor-pointer hover:underline"
                        onClick={() => navigate(`/sala-tecnica/projetos/${p.id}`)}
                      >
                        {p.codigo || "—"}
                      </span>
                      <div className="flex gap-1">
                        {p.pending_scope > 0 && <ClipboardList className="w-3.5 h-3.5 text-amber-500" />}
                        {p.has_active_alert && <Bell className="w-3.5 h-3.5 text-destructive" />}
                      </div>
                    </div>
                    <p className="text-xs font-medium leading-tight">{p.name}</p>
                    {p.client_name && <p className="text-[10px] text-muted-foreground">{p.client_name}</p>}

                    {/* "Novo — distribuir" badge */}
                    {isNewNeedDistribute(p) && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-[10px]">
                        <Zap className="w-3 h-3 mr-0.5" /> Novo — distribuir
                      </Badge>
                    )}

                    <DeadlineBadge
                      deadline={p.delivery_deadline ? new Date(p.delivery_deadline) : null}
                      started_at={p.field_completed_at ? new Date(p.field_completed_at) : null}
                      estimated_days={p.delivery_days_estimated}
                      completed_at={p.delivered_at ? new Date(p.delivered_at) : null}
                      label="Entrega"
                    />

                    {/* Task progress bar */}
                    {p.task_total > 0 && (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">
                            {p.task_done}/{p.task_total} tarefas
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round((p.task_done / p.task_total) * 100)}%
                          </p>
                        </div>
                        <Progress value={(p.task_done / p.task_total) * 100} className="h-1.5" />
                      </div>
                    )}

                    {/* Assignee avatars + responsible avatars */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.responsible_tecnico_name && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="w-5 h-5 border border-blue-300">
                              <AvatarFallback className="text-[8px] bg-blue-50 text-blue-700">
                                {getInitials(p.responsible_tecnico_name)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">Técnico: {p.responsible_tecnico_name}</p></TooltipContent>
                        </Tooltip>
                      )}
                      {p.responsible_campo_name && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="w-5 h-5 border border-emerald-300">
                              <AvatarFallback className="text-[8px] bg-emerald-50 text-emerald-700">
                                {getInitials(p.responsible_campo_name)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">Campo: {p.responsible_campo_name}</p></TooltipContent>
                        </Tooltip>
                      )}
                      {p.task_assignee_names.slice(0, 3).map((name, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <Avatar className="w-5 h-5 border">
                              <AvatarFallback className="text-[8px]">
                                {getInitials(name)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">{name}</p></TooltipContent>
                        </Tooltip>
                      ))}
                      {p.task_assignee_names.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{p.task_assignee_names.length - 3}</span>
                      )}
                    </div>

                    {billingBadge(p.billing_type)}

                    {/* Quick actions */}
                    <div className="flex gap-1 pt-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-1.5"
                        onClick={e => { e.stopPropagation(); setQuickTaskProject(p); }}
                      >
                        <Plus className="w-3 h-3 mr-0.5" /> Tarefa
                      </Button>
                      {col.key === "aprovado" && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5 flex-1" onClick={() => handleDeliverClick(p)}>
                          Marcar entregue
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {/* Confirm deliver dialog */}
        <Dialog open={!!confirmDlg} onOpenChange={() => setConfirmDlg(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Itens de escopo pendentes</DialogTitle>
              <DialogDescription>
                Há {confirmDlg?.pendingCount} itens de escopo pendentes neste projeto. Confirmar entrega mesmo assim?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDlg(null)}>Cancelar</Button>
              <Button onClick={() => confirmDlg && doDeliver(confirmDlg.project)}>Confirmar entrega</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick add task dialog */}
        <Dialog open={!!quickTaskProject} onOpenChange={() => setQuickTaskProject(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Nova tarefa — {quickTaskProject?.codigo || quickTaskProject?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Título *</Label>
                <Input
                  value={quickTaskForm.title}
                  onChange={e => setQuickTaskForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Descrição da tarefa..."
                />
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Select value={quickTaskForm.assigned_to_id} onValueChange={v => setQuickTaskForm(p => ({ ...p, assigned_to_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} — {e.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Prazo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left text-sm", !quickTaskForm.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {quickTaskForm.due_date ? format(quickTaskForm.due_date, "dd/MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={quickTaskForm.due_date || undefined}
                      onSelect={d => setQuickTaskForm(p => ({ ...p, due_date: d || null }))}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuickTaskProject(null)}>Cancelar</Button>
              <Button onClick={handleQuickTask} disabled={!quickTaskForm.title.trim()}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
