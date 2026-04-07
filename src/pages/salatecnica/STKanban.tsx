import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUpdateProject } from "@/hooks/useProjects";
import { useCreateTechnicalTask } from "@/hooks/useTechnicalTasks";
import { useEmployees } from "@/hooks/useEmployees";
import { TECH_ROLES } from "@/lib/fieldRoles";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import DeadlineBadge from "@/components/DeadlineBadge";
import { ClipboardList, Bell, Plus, Zap, Package, Users, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ───

interface ProjectRow {
  id: string;
  codigo: string | null;
  name: string;
  service: string | null;
  execution_status: string | null;
  delivery_deadline: string | null;
  field_completed_at: string | null;
  delivery_days_estimated: number | null;
  delivered_at: string | null;
  needs_tech_prep: boolean | null;
  client_name: string | null;
  client_id: string | null;
  lead_id: string | null;
  billing_type: string | null;
  pending_scope: number;
  task_done: number;
  task_total: number;
  task_pending: number;
  task_in_progress: number;
  has_active_alert: boolean;
  responsible_tecnico_name: string | null;
  responsible_campo_name: string | null;
  task_assignee_names: string[];
}

interface Technician {
  id: string;
  name: string;
  role: string;
  active_tasks: number;
  on_vacation: boolean;
  in_field_today: boolean;
}

// ─── Helpers ───

const EXEC_STATUS_TAGS: Record<string, { label: string; color: string }> = {
  planejamento: { label: "Planejamento", color: "bg-gray-100 text-gray-700" },
  aguardando_campo: { label: "Aguardando campo", color: "bg-muted text-muted-foreground" },
  em_campo: { label: "Em campo", color: "bg-emerald-100 text-emerald-700" },
  aguardando_processamento: { label: "Campo concluído", color: "bg-blue-100 text-blue-700" },
  em_processamento: { label: "Em processamento", color: "bg-indigo-100 text-indigo-700" },
  revisao: { label: "Em revisão", color: "bg-purple-100 text-purple-700" },
};

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function getAutoTag(p: ProjectRow): { label: string; color: string } | null {
  if (p.task_total === 0) return null;
  if (p.task_done === p.task_total) return { label: "Aguardando revisão", color: "bg-amber-100 text-amber-700" };
  if (p.task_in_progress > 0) return { label: "Em processamento", color: "bg-blue-100 text-blue-700" };
  if (p.task_pending > 0) return { label: "Aguardando início", color: "bg-gray-100 text-gray-600" };
  return null;
}

// ─── Component ───

export default function STKanban() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const updateProject = useUpdateProject();
  const createTask = useCreateTechnicalTask();
  const { data: employees = [] } = useEmployees();

  const [deliverProject, setDeliverProject] = useState<ProjectRow | null>(null);
  const [confirmDeliverPending, setConfirmDeliverPending] = useState<ProjectRow | null>(null);
  const [taskProject, setTaskProject] = useState<ProjectRow | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", assigned_to_id: "", due_date: null as Date | null });

  const activeEmployees = useMemo(() => employees.filter((e: any) => e.status !== "desligado"), [employees]);

  // ─── Main query: ALL active projects visible to ST ───

  const { data: projects = [], refetch } = useQuery({
    queryKey: ["st_kanban_projects"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("projects")
        .select("id, codigo, name, service, execution_status, delivery_deadline, field_completed_at, delivery_days_estimated, delivered_at, client_id, lead_id, billing_type, is_active, needs_tech_prep, responsible_tecnico_id, responsible_campo_id")
        .eq("is_active", true)
        .not("execution_status", "in", '("entregue","faturamento","pago")')
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

      const tasksByProject = new Map<string, { done: number; total: number; pending: number; in_progress: number; assignees: Set<string> }>();
      (tasksRes.data || []).forEach((t: any) => {
        const cur = tasksByProject.get(t.project_id) || { done: 0, total: 0, pending: 0, in_progress: 0, assignees: new Set<string>() };
        if (t.status !== "cancelada") cur.total++;
        if (t.status === "concluida") cur.done++;
        if (t.status === "pendente") cur.pending++;
        if (t.status === "em_andamento") cur.in_progress++;
        if (t.assigned_to_id && t.status !== "concluida" && t.status !== "cancelada") {
          cur.assignees.add(t.assigned_to_id);
        }
        tasksByProject.set(t.project_id, cur);
      });
      const alertSet = new Set((alertsRes.data || []).map((a: any) => a.reference_id));

      return (rows || []).map((r: any): ProjectRow => {
        const tasks = tasksByProject.get(r.id) || { done: 0, total: 0, pending: 0, in_progress: 0, assignees: new Set<string>() };
        const assigneeNames: string[] = [];
        tasks.assignees.forEach(id => {
          const name = employeeMap.get(id) || profileMap.get(id);
          if (name) assigneeNames.push(name as string);
        });

        return {
          id: r.id,
          codigo: r.codigo,
          name: r.name,
          service: r.service,
          execution_status: r.execution_status,
          delivery_deadline: r.delivery_deadline,
          field_completed_at: r.field_completed_at,
          delivery_days_estimated: r.delivery_days_estimated,
          delivered_at: r.delivered_at,
          needs_tech_prep: r.needs_tech_prep,
          client_name: clientMap.get(r.client_id) || null,
          client_id: r.client_id,
          lead_id: r.lead_id,
          billing_type: r.billing_type,
          pending_scope: scopeByProject.get(r.id) || 0,
          task_done: tasks.done,
          task_total: tasks.total,
          task_pending: tasks.pending,
          task_in_progress: tasks.in_progress,
          has_active_alert: alertSet.has(r.id),
          responsible_tecnico_name: r.responsible_tecnico_id ? (profileMap.get(r.responsible_tecnico_id) as string || null) : null,
          responsible_campo_name: r.responsible_campo_id ? (profileMap.get(r.responsible_campo_id) as string || null) : null,
          task_assignee_names: assigneeNames,
        };
      });
    },
  });

  // ─── Technicians panel ───

  const { data: technicians = [] } = useQuery({
    queryKey: ["st_technicians"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const techEmployees = employees.filter((e: any) =>
        e.status !== "desligado" && TECH_ROLES.includes(e.role)
      );

      const ids = techEmployees.map((e: any) => e.id);
      if (!ids.length) return [];

      const [tasksRes, vacRes, scheduleRes] = await Promise.all([
        supabase.from("technical_tasks").select("assigned_to_id").in("assigned_to_id", ids).in("status", ["pendente", "em_andamento"]),
        supabase.from("employee_vacations").select("employee_id").in("employee_id", ids).lte("start_date", today).gte("end_date", today),
        supabase.from("daily_schedule_entries").select("employee_id, daily_schedule_id, daily_schedules!inner(schedule_date)")
          .in("employee_id", ids).eq("daily_schedules.schedule_date" as any, today),
      ]);

      const taskCounts = new Map<string, number>();
      (tasksRes.data || []).forEach((t: any) => {
        taskCounts.set(t.assigned_to_id, (taskCounts.get(t.assigned_to_id) || 0) + 1);
      });
      const vacSet = new Set((vacRes.data || []).map((v: any) => v.employee_id));
      const fieldSet = new Set((scheduleRes.data || []).map((s: any) => s.employee_id));

      return techEmployees.map((e: any): Technician => ({
        id: e.id,
        name: e.name,
        role: e.role,
        active_tasks: taskCounts.get(e.id) || 0,
        on_vacation: vacSet.has(e.id),
        in_field_today: fieldSet.has(e.id),
      })).sort((a, b) => {
        if (a.on_vacation !== b.on_vacation) return a.on_vacation ? 1 : -1;
        if (a.in_field_today !== b.in_field_today) return a.in_field_today ? 1 : -1;
        return a.active_tasks - b.active_tasks;
      });
    },
    enabled: employees.length > 0,
  });

  // ─── Task title suggestions ───

  const { data: taskSuggestions = [] } = useQuery({
    queryKey: ["task_title_suggestions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("technical_tasks")
        .select("title")
        .order("created_at", { ascending: false })
        .limit(200);
      const counts = new Map<string, number>();
      (data || []).forEach((t: any) => counts.set(t.title, (counts.get(t.title) || 0) + 1));
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([title]) => title);
    },
  });

  // ─── Columns ───

  const columns = useMemo(() => {
    const preparation: ProjectRow[] = [];
    const inProgress: ProjectRow[] = [];
    const ready: ProjectRow[] = [];

    projects.forEach(p => {
      if (p.execution_status === "aprovado") {
        ready.push(p);
      } else if (p.task_total > 0) {
        inProgress.push(p);
      } else {
        preparation.push(p);
      }
    });

    // Sort each by deadline
    const sortByDeadline = (arr: ProjectRow[]) =>
      arr.sort((a, b) => {
        if (!a.delivery_deadline && !b.delivery_deadline) return 0;
        if (!a.delivery_deadline) return 1;
        if (!b.delivery_deadline) return -1;
        return a.delivery_deadline.localeCompare(b.delivery_deadline);
      });

    return {
      preparation: sortByDeadline(preparation),
      inProgress: sortByDeadline(inProgress),
      ready: sortByDeadline(ready),
    };
  }, [projects]);

  // ─── Actions ───

  const handleDistribute = (p: ProjectRow) => {
    setTaskProject(p);
    // Pre-fill first task suggestion
    const isFirstTask = p.task_total === 0;
    setTaskForm({
      title: isFirstTask ? `Criar pasta no servidor — ${p.codigo || p.name}` : "",
      assigned_to_id: "",
      due_date: null,
    });
  };

  const handleCreateTask = async () => {
    if (!taskProject || !taskForm.title.trim()) return;
    try {
      await createTask.mutateAsync({
        project_id: taskProject.id,
        title: taskForm.title.trim(),
        assigned_to_id: taskForm.assigned_to_id || undefined,
        due_date: taskForm.due_date ? format(taskForm.due_date, "yyyy-MM-dd") : undefined,
        created_by_id: user?.id,
      });

      // Auto-transition to em_processamento if first task and status allows
      if (taskProject.task_total === 0 && taskProject.execution_status === "aguardando_processamento") {
        await updateProject.mutateAsync({ id: taskProject.id, execution_status: "em_processamento" } as any);
        await supabase.from("project_status_history").insert({
          project_id: taskProject.id,
          from_status: "aguardando_processamento",
          to_status: "em_processamento",
          modulo: "sala_tecnica",
          changed_by_id: user?.id || null,
          notes: "Auto: primeira tarefa distribuída",
        });
      }

      toast.success("Tarefa criada");
      setTaskProject(null);
      setTaskForm({ title: "", assigned_to_id: "", due_date: null });
      refetch();
      qc.invalidateQueries({ queryKey: ["technical_tasks"] });
      qc.invalidateQueries({ queryKey: ["st_technicians"] });
    } catch {
      toast.error("Erro ao criar tarefa");
    }
  };

  const handleApproveReview = async (p: ProjectRow) => {
    try {
      await updateProject.mutateAsync({ id: p.id, execution_status: "aprovado" } as any);
      await supabase.from("project_status_history").insert({
        project_id: p.id,
        from_status: p.execution_status,
        to_status: "aprovado",
        modulo: "sala_tecnica",
        changed_by_id: user?.id || null,
      });
      toast.success(`Projeto ${p.codigo} aprovado`);
      refetch();
    } catch {
      toast.error("Erro ao aprovar");
    }
  };

  const handleDeliverClick = (p: ProjectRow) => {
    if (p.pending_scope > 0) {
      setConfirmDeliverPending(p);
    } else {
      setDeliverProject(p);
    }
  };

  const doDeliver = async (p: ProjectRow) => {
    try {
      await updateProject.mutateAsync({
        id: p.id,
        execution_status: "entregue",
        delivered_at: new Date().toISOString().split("T")[0],
      } as any);
      await supabase.from("project_status_history").insert({
        project_id: p.id,
        from_status: p.execution_status,
        to_status: "entregue",
        modulo: "sala_tecnica",
        changed_by_id: user?.id || null,
      });
      // Financial alert
      await supabase.from("alerts").insert({
        alert_type: "projeto_entregue",
        priority: "importante",
        recipient: "financeiro",
        title: `Projeto ${p.codigo || p.name} entregue — iniciar faturamento`,
        message: `Projeto ${p.name} do cliente ${p.client_name || "—"} foi entregue. Billing: ${p.billing_type || "não definido"}.`,
        reference_type: "project",
        reference_id: p.id,
      } as any);
      toast.success(`Projeto ${p.codigo} entregue — Financeiro notificado`);
      setDeliverProject(null);
      setConfirmDeliverPending(null);
      refetch();
    } catch {
      toast.error("Erro ao marcar entrega");
    }
  };

  const handleTechDrop = (techId: string, project: ProjectRow) => {
    const tech = technicians.find(t => t.id === techId);
    if (!tech) return;
    if (tech.on_vacation) {
      toast.error("Técnico está de férias.");
      return;
    }
    setTaskProject(project);
    setTaskForm({
      title: project.task_total === 0 ? `Criar pasta no servidor — ${project.codigo || project.name}` : "",
      assigned_to_id: techId,
      due_date: null,
    });
  };

  // ─── Render helpers ───

  const renderCard = (p: ProjectRow, column: "preparation" | "inProgress" | "ready") => {
    const autoTag = getAutoTag(p);
    const execTag = EXEC_STATUS_TAGS[p.execution_status || ""];
    const serviceLabel = SERVICE_TYPES.find(s => s.value === p.service)?.label || p.service;
    const allDone = p.task_total > 0 && p.task_done === p.task_total;

    return (
      <Card
        key={p.id}
        className={cn(
          "hover:shadow-md transition-shadow",
          p.delivery_deadline && new Date(p.delivery_deadline) < new Date() && !p.delivered_at && "border-destructive border-2",
        )}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          const techId = e.dataTransfer.getData("techId");
          if (techId) handleTechDrop(techId, p);
        }}
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
              {p.has_active_alert && <Bell className="w-3.5 h-3.5 text-destructive animate-pulse" />}
            </div>
          </div>
          <p className="text-xs font-medium leading-tight">{p.name}</p>
          {p.client_name && <p className="text-[10px] text-muted-foreground">{p.client_name}</p>}

          {/* Tags row */}
          <div className="flex flex-wrap gap-1">
            {execTag && <Badge className={`${execTag.color} text-[9px] h-4 px-1`}>{execTag.label}</Badge>}
            {serviceLabel && <Badge variant="outline" className="text-[9px] h-4 px-1">{serviceLabel}</Badge>}
            {autoTag && <Badge className={`${autoTag.color} text-[9px] h-4 px-1`}>{autoTag.label}</Badge>}
            {p.lead_id && <Badge className="bg-green-50 text-green-700 text-[9px] h-4 px-1">Lead convertido</Badge>}
          </div>

          {/* Deadline */}
          <DeadlineBadge
            deadline={p.delivery_deadline ? new Date(p.delivery_deadline) : null}
            started_at={p.field_completed_at ? new Date(p.field_completed_at) : null}
            estimated_days={p.delivery_days_estimated}
            completed_at={p.delivered_at ? new Date(p.delivered_at) : null}
            label="Entrega"
          />

          {/* Task progress */}
          {p.task_total > 0 && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">{p.task_done}/{p.task_total} tarefas</p>
                <p className="text-[10px] text-muted-foreground">{Math.round((p.task_done / p.task_total) * 100)}%</p>
              </div>
              <Progress value={(p.task_done / p.task_total) * 100} className="h-1.5" />
            </div>
          )}

          {/* Assignee avatars */}
          {p.task_assignee_names.length > 0 && (
            <div className="flex items-center gap-1">
              {p.task_assignee_names.slice(0, 4).map((name, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <Avatar className="w-5 h-5 border"><AvatarFallback className="text-[8px]">{getInitials(name)}</AvatarFallback></Avatar>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{name}</p></TooltipContent>
                </Tooltip>
              ))}
              {p.task_assignee_names.length > 4 && <span className="text-[9px] text-muted-foreground">+{p.task_assignee_names.length - 4}</span>}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1 pt-0.5">
            {column === "preparation" && (
              <Button size="sm" className="h-6 text-[10px] px-2 gap-1 flex-1" onClick={() => handleDistribute(p)}>
                <Zap className="w-3 h-3" /> Distribuir
              </Button>
            )}
            {column === "inProgress" && (
              <>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => handleDistribute(p)}>
                  <Plus className="w-3 h-3 mr-0.5" /> Tarefa
                </Button>
                {allDone && p.execution_status !== "aprovado" && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-1.5 flex-1 text-purple-700 border-purple-300" onClick={() => handleApproveReview(p)}>
                    Aprovar revisão
                  </Button>
                )}
              </>
            )}
            {column === "ready" && (
              <Button size="sm" className="h-6 text-[10px] px-2 gap-1 flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDeliverClick(p)}>
                <Send className="w-3 h-3" /> Entregar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const getAvailabilityBadge = (t: Technician) => {
    if (t.on_vacation) return { label: "Férias", color: "bg-blue-100 text-blue-700" };
    if (t.in_field_today) return { label: "Em campo", color: "bg-purple-100 text-purple-700" };
    if (t.active_tasks >= 3) return { label: "Carga alta", color: "bg-orange-100 text-orange-700" };
    if (t.active_tasks > 0) return { label: "Ocupado", color: "bg-amber-100 text-amber-700" };
    return { label: "Disponível", color: "bg-emerald-100 text-emerald-700" };
  };

  // ─── Render ───

  return (
    <TooltipProvider>
      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* 3 Columns — 75% */}
        <div className="flex-1 flex gap-3 overflow-x-auto pb-4">
          {/* Em preparação */}
          <div className="flex-shrink-0 w-[280px] flex flex-col">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-1 flex items-center gap-1">
              <Package className="w-3.5 h-3.5" /> Em preparação ({columns.preparation.length})
            </h3>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-1">{columns.preparation.map(p => renderCard(p, "preparation"))}</div>
            </ScrollArea>
          </div>

          {/* Em andamento */}
          <div className="flex-shrink-0 w-[280px] flex flex-col">
            <h3 className="text-xs font-semibold text-indigo-700 mb-2 px-1 flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5" /> Em andamento ({columns.inProgress.length})
            </h3>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-1">{columns.inProgress.map(p => renderCard(p, "inProgress"))}</div>
            </ScrollArea>
          </div>

          {/* Pronto */}
          <div className="flex-shrink-0 w-[280px] flex flex-col">
            <h3 className="text-xs font-semibold text-emerald-700 mb-2 px-1 flex items-center gap-1">
              <Send className="w-3.5 h-3.5" /> Pronto ({columns.ready.length})
            </h3>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-1">{columns.ready.map(p => renderCard(p, "ready"))}</div>
            </ScrollArea>
          </div>
        </div>

        {/* Side panel — 25% */}
        <div className="w-[220px] shrink-0 border-l pl-4 flex flex-col">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Técnicos ({technicians.length})
          </h3>
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-1">
              {technicians.map(t => {
                const badge = getAvailabilityBadge(t);
                return (
                  <div
                    key={t.id}
                    draggable={!t.on_vacation}
                    onDragStart={e => { e.dataTransfer.setData("techId", t.id); }}
                    className={cn(
                      "p-2.5 rounded-lg border bg-card text-xs space-y-1 transition-all",
                      t.on_vacation ? "opacity-50 cursor-not-allowed" : "cursor-grab hover:shadow-sm active:scale-[0.98]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{t.name.split(" ")[0]}</span>
                      <Badge className={`${badge.color} text-[9px] h-4 px-1`}>{badge.label}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground capitalize">{t.role}</p>
                    {t.active_tasks > 0 && (
                      <p className="text-[10px] text-muted-foreground">{t.active_tasks} tarefa(s) ativa(s)</p>
                    )}
                  </div>
                );
              })}
              {technicians.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum técnico cadastrado</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Dialog: Create task */}
      <Dialog open={!!taskProject} onOpenChange={() => setTaskProject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {taskProject?.task_total === 0 ? "Distribuir" : "Nova tarefa"} — {taskProject?.codigo || taskProject?.name}
            </DialogTitle>
            {taskProject?.task_total === 0 && (
              <DialogDescription className="text-xs">
                Primeira distribuição. Tarefa "Criar pasta" pré-preenchida.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tarefa *</Label>
              <Input
                value={taskForm.title}
                onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Descrição da tarefa..."
                list="task-suggestions"
              />
              <datalist id="task-suggestions">
                {taskSuggestions.map((s, i) => <option key={i} value={s} />)}
              </datalist>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={taskForm.assigned_to_id} onValueChange={v => setTaskForm(p => ({ ...p, assigned_to_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.filter((e: any) => TECH_ROLES.includes(e.role)).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} — {e.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left text-sm", !taskForm.due_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taskForm.due_date ? format(taskForm.due_date, "dd/MM/yyyy") : "Selecione..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={taskForm.due_date || undefined}
                    onSelect={d => setTaskForm(p => ({ ...p, due_date: d || null }))}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Quick suggestion: Emitir RRT */}
            {taskProject?.task_total === 0 && (
              <div className="pt-1">
                <p className="text-[10px] text-muted-foreground mb-1">Sugestão para próxima tarefa:</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={() => setTaskForm(p => ({ ...p, title: "Emitir RRT" }))}
                >
                  Emitir RRT
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskProject(null)}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={!taskForm.title.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Deliver */}
      <AlertDialog open={!!deliverProject} onOpenChange={(o) => !o && setDeliverProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entregar projeto — {deliverProject?.codigo}</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto será marcado como entregue e o Financeiro será notificado para iniciar faturamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deliverProject && doDeliver(deliverProject)} className="bg-emerald-600 hover:bg-emerald-700">
              Confirmar Entrega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Deliver with pending scope */}
      <AlertDialog open={!!confirmDeliverPending} onOpenChange={(o) => !o && setConfirmDeliverPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Itens de escopo pendentes</AlertDialogTitle>
            <AlertDialogDescription>
              Há {confirmDeliverPending?.pending_scope} itens de escopo pendentes. Entregar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeliverPending && doDeliver(confirmDeliverPending)}>
              Entregar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
