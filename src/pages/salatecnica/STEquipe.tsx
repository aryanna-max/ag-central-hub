import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, GripVertical, X } from "lucide-react";
import DeadlineBadge from "@/components/DeadlineBadge";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TECH_ROLES } from "@/lib/fieldRoles";

const EXECUTION_STATUSES = [
  "aguardando_processamento",
  "em_processamento",
  "revisao",
  "aprovado",
] as const;

interface TaskRow {
  id: string;
  title: string;
  status: string;
  project_id: string;
}

interface Technician {
  id: string;
  name: string;
  role: string;
  activeTasks: TaskRow[];
  on_vacation: boolean;
  in_field_today: boolean;
  sortOrder: number;
}

interface ProjectCard {
  id: string;
  codigo: string | null;
  name: string;
  execution_status: string | null;
  delivery_deadline: string | null;
  assignees: { id: string; name: string }[];
}

function getAvailabilityBadge(tech: Technician) {
  if (tech.on_vacation)
    return { label: "De férias", cls: "bg-blue-50 text-blue-700 border-blue-300" };
  if (tech.in_field_today)
    return { label: "Em campo hoje", cls: "bg-purple-50 text-purple-700 border-purple-300" };
  const count = tech.activeTasks.length;
  if (count >= 3)
    return { label: "Carga alta", cls: "bg-orange-100 text-orange-700 border-orange-300" };
  if (count >= 1)
    return { label: "Ocupado", cls: "bg-yellow-50 text-yellow-700 border-yellow-300" };
  return { label: "Disponível", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" };
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const STATUS_LABELS: Record<string, string> = {
  aguardando_processamento: "Aguardando",
  em_processamento: "Em processamento",
  revisao: "Revisão",
  aprovado: "Aprovado",
};

export default function STEquipe() {
  const qc = useQueryClient();
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Drop modal state
  const [dropModal, setDropModal] = useState<{
    techId: string;
    techName: string;
    projectId: string;
    projectName: string;
  } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  // Drag state
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);

  // ─── Technicians query ───
  const { data: technicians = [] } = useQuery({
    queryKey: ["st_equipe_board_techs", today],
    queryFn: async () => {
      const [empRes, tasksRes, vacRes, dailyRes] = await Promise.all([
        supabase.from("employees").select("id, name, role, status").neq("status", "desligado"),
        supabase
          .from("technical_tasks")
          .select("id, title, status, project_id, assigned_to_id")
          .not("assigned_to_id", "is", null),
        supabase
          .from("employee_vacations")
          .select("employee_id")
          .lte("start_date", today)
          .gte("end_date", today),
        supabase.from("daily_schedules").select("id").eq("schedule_date", today).maybeSingle(),
      ]);

      if (empRes.error) throw empRes.error;

      // Field employees today
      const fieldIds = new Set<string>();
      if (dailyRes.data?.id) {
        const { data: entries } = await supabase
          .from("daily_schedule_entries")
          .select("employee_id")
          .eq("daily_schedule_id", dailyRes.data.id);
        (entries || []).forEach((e: any) => fieldIds.add(e.employee_id));
      }

      const vacIds = new Set((vacRes.data || []).map((v: any) => v.employee_id));

      // IDs with tasks assigned
      const assignedIds = new Set<string>();
      const tasksByEmp = new Map<string, TaskRow[]>();
      (tasksRes.data || []).forEach((t: any) => {
        assignedIds.add(t.assigned_to_id);
        if (t.status === "concluida" || t.status === "cancelada") return;
        const list = tasksByEmp.get(t.assigned_to_id) || [];
        list.push({ id: t.id, title: t.title, status: t.status, project_id: t.project_id });
        tasksByEmp.set(t.assigned_to_id, list);
      });

      // Filter: tech roles OR has tasks
      const filtered = (empRes.data || []).filter(
        (e: any) => TECH_ROLES.includes(e.role) || assignedIds.has(e.id)
      );

      return filtered.map((e: any): Technician => {
        const tasks = tasksByEmp.get(e.id) || [];
        const onVac = vacIds.has(e.id);
        const inField = fieldIds.has(e.id);
        let sortOrder: number;
        if (onVac) sortOrder = 5;
        else if (tasks.length >= 3) sortOrder = 4;
        else if (tasks.length >= 1 && !inField) sortOrder = 3;
        else if (inField) sortOrder = 2;
        else sortOrder = 1;

        return {
          id: e.id,
          name: e.name,
          role: e.role,
          activeTasks: tasks,
          on_vacation: onVac,
          in_field_today: inField,
          sortOrder,
        };
      }).sort((a, b) => a.sortOrder - b.sortOrder);
    },
  });

  // ─── Projects query ───
  const { data: projects = [] } = useQuery({
    queryKey: ["st_equipe_board_projects"],
    queryFn: async () => {
      const [projRes, tasksRes, empRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, codigo, name, execution_status, delivery_deadline")
          .in("execution_status", EXECUTION_STATUSES)
          .order("delivery_deadline", { ascending: true, nullsFirst: false }),
        supabase
          .from("technical_tasks")
          .select("project_id, assigned_to_id")
          .not("assigned_to_id", "is", null)
          .neq("status", "concluida")
          .neq("status", "cancelada"),
        supabase.from("employees").select("id, name"),
      ]);

      if (projRes.error) throw projRes.error;

      const empMap = new Map<string, string>();
      (empRes.data || []).forEach((e: any) => empMap.set(e.id, e.name));

      // Group assignees by project (unique)
      const assigneesByProject = new Map<string, Map<string, string>>();
      (tasksRes.data || []).forEach((t: any) => {
        if (!assigneesByProject.has(t.project_id)) {
          assigneesByProject.set(t.project_id, new Map());
        }
        const m = assigneesByProject.get(t.project_id)!;
        if (!m.has(t.assigned_to_id)) {
          m.set(t.assigned_to_id, empMap.get(t.assigned_to_id) || "?");
        }
      });

      return (projRes.data || []).map((p: any): ProjectCard => ({
        id: p.id,
        codigo: p.codigo,
        name: p.name,
        execution_status: p.execution_status,
        delivery_deadline: p.delivery_deadline,
        assignees: Array.from(assigneesByProject.get(p.id)?.entries() || []).map(
          ([id, name]) => ({ id, name })
        ),
      }));
    },
  });

  // Project name map for tech tasks
  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach(p => m.set(p.id, p.codigo || p.name));
    return m;
  }, [projects]);

  // ─── Drag handlers ───
  const onDragStart = useCallback((e: React.DragEvent, techId: string) => {
    e.dataTransfer.setData("techId", techId);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverProjectId(projectId);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOverProjectId(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, project: ProjectCard) => {
    e.preventDefault();
    setDragOverProjectId(null);
    const techId = e.dataTransfer.getData("techId");
    if (!techId) return;

    const tech = technicians.find(t => t.id === techId);
    if (!tech) return;
    if (tech.on_vacation) {
      toast.error("Técnico está de férias e não pode receber tarefas.");
      return;
    }

    setDropModal({
      techId,
      techName: tech.name,
      projectId: project.id,
      projectName: project.codigo || project.name,
    });
    setNewTaskTitle("");
    setNewTaskDueDate(undefined);
  }, [technicians]);

  const handleCreateTask = async () => {
    if (!dropModal || !newTaskTitle.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("technical_tasks").insert({
        project_id: dropModal.projectId,
        assigned_to_id: dropModal.techId,
        title: newTaskTitle.trim(),
        due_date: newTaskDueDate ? format(newTaskDueDate, "yyyy-MM-dd") : null,
        created_by_id: user?.id || null,
        status: "pendente",
      });
      if (error) throw error;
      toast.success("Tarefa criada com sucesso");
      setDropModal(null);
      qc.invalidateQueries({ queryKey: ["st_equipe_board_techs"] });
      qc.invalidateQueries({ queryKey: ["st_equipe_board_projects"] });
      qc.invalidateQueries({ queryKey: ["technical_tasks"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar tarefa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* ─── LEFT PANEL: Technicians ─── */}
        <div className="w-[35%] min-w-[280px] flex flex-col">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Equipe disponível</h2>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-2 pb-4">
              {technicians.map(tech => {
                const badge = getAvailabilityBadge(tech);
                const isDraggable = !tech.on_vacation;
                return (
                  <Card
                    key={tech.id}
                    draggable={isDraggable}
                    onDragStart={isDraggable ? (e) => onDragStart(e, tech.id) : undefined}
                    className={cn(
                      "transition-shadow",
                      isDraggable ? "cursor-grab active:cursor-grabbing hover:shadow-md" : "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tech.name}</p>
                          <p className="text-[10px] text-muted-foreground">{tech.role}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", badge.cls)}>
                          {badge.label}
                        </Badge>
                      </div>
                      {tech.activeTasks.length > 0 && (
                        <div className="pl-5 space-y-0.5">
                          {tech.activeTasks.slice(0, 4).map(t => (
                            <p key={t.id} className="text-[11px] text-muted-foreground truncate">
                              • {t.title}
                              <span className="text-[10px] ml-1 opacity-60">
                                ({projectNameMap.get(t.project_id) || "—"})
                              </span>
                            </p>
                          ))}
                          {tech.activeTasks.length > 4 && (
                            <p className="text-[10px] text-muted-foreground/60">
                              +{tech.activeTasks.length - 4} mais
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {technicians.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum técnico encontrado</p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ─── RIGHT PANEL: Projects ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Projetos ativos</h2>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-2 pb-4">
              {projects.map(proj => {
                const isOver = dragOverProjectId === proj.id;
                return (
                  <Card
                    key={proj.id}
                    onDragOver={(e) => onDragOver(e, proj.id)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop(e, proj)}
                    className={cn(
                      "transition-all border-2",
                      isOver
                        ? "border-primary bg-primary/5 shadow-lg"
                        : "border-transparent"
                    )}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {proj.codigo && (
                              <span className="text-primary mr-1.5">{proj.codigo}</span>
                            )}
                            <span className="text-foreground">{proj.name}</span>
                          </p>
                        </div>
                        {proj.execution_status && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {STATUS_LABELS[proj.execution_status] || proj.execution_status}
                          </Badge>
                        )}
                      </div>

                      {proj.delivery_deadline && (
                        <DeadlineBadge
                          deadline={new Date(proj.delivery_deadline)}
                          started_at={null}
                          estimated_days={null}
                          completed_at={null}
                          label="Entrega"
                        />
                      )}

                      <div className="flex items-center gap-2">
                        {proj.assignees.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {proj.assignees.slice(0, 5).map(a => (
                              <Tooltip key={a.id}>
                                <TooltipTrigger asChild>
                                  <Avatar className="h-6 w-6 border-2 border-background">
                                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                      {getInitials(a.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                  {a.name}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {proj.assignees.length > 5 && (
                              <Avatar className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                                  +{proj.assignees.length - 5}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex-1 border border-dashed rounded-md px-3 py-1.5 text-center text-[11px] transition-colors",
                            isOver
                              ? "border-primary text-primary bg-primary/10"
                              : "border-muted-foreground/30 text-muted-foreground/50"
                          )}
                        >
                          Arraste um técnico aqui
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum projeto nos status de processamento
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ─── DROP MODAL ─── */}
      {dropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md mx-4 shadow-xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">Nova tarefa</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dropModal.techName} → {dropModal.projectName}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => setDropModal(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Título da tarefa *</label>
                  <Input
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="Ex: Processar levantamento"
                    className="text-sm"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter" && newTaskTitle.trim()) handleCreateTask();
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Prazo (opcional)</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left text-sm font-normal",
                          !newTaskDueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newTaskDueDate ? format(newTaskDueDate, "dd/MM/yyyy") : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newTaskDueDate}
                        onSelect={setNewTaskDueDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setDropModal(null)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateTask}
                  disabled={!newTaskTitle.trim() || saving}
                >
                  {saving ? "Salvando..." : "Criar tarefa"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </TooltipProvider>
  );
}
