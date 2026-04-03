import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useEmployees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import DeadlineBadge from "@/components/DeadlineBadge";
import { toast } from "sonner";
import { subDays, format } from "date-fns";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  project_id: string;
  assigned_to_id: string | null;
  due_date: string | null;
  completed_at: string | null;
}

interface TechnicianRow {
  id: string;
  name: string;
  role: string;
  pending: number;
  in_progress: number;
  completed_30d: number;
  tasks: TaskRow[];
  on_vacation: boolean;
  in_field_today: boolean;
}

type SituationBadge = { label: string; cls: string };

function getSituation(tech: TechnicianRow): SituationBadge {
  if (tech.on_vacation)
    return { label: "De férias", cls: "bg-blue-50 text-blue-700 border-blue-300" };
  if (tech.in_field_today)
    return { label: "Em campo hoje", cls: "bg-purple-50 text-purple-700 border-purple-300" };
  if (tech.in_progress >= 3)
    return { label: "Carga alta", cls: "bg-orange-100 text-orange-700 border-orange-300" };
  if (tech.in_progress >= 1)
    return { label: "Ocupado", cls: "bg-yellow-50 text-yellow-700 border-yellow-300" };
  return { label: "Disponível", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" };
}

export default function STEquipe() {
  const qc = useQueryClient();
  const { data: employees = [] } = useEmployees();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  const activeEmployees = useMemo(() =>
    employees.filter((e: any) => e.status !== "desligado"),
    [employees]
  );

  const thirtyDaysAgo = useMemo(() => subDays(new Date(), 30).toISOString(), []);
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const { data: allTechnicians = [] } = useQuery({
    queryKey: ["st_equipe_workload", today],
    queryFn: async () => {
      // Fetch tasks, vacations, and today's field entries in parallel
      const [tasksRes, vacationsRes, dailyRes] = await Promise.all([
        supabase
          .from("technical_tasks")
          .select("id, title, status, project_id, assigned_to_id, due_date, completed_at")
          .not("assigned_to_id", "is", null),
        supabase
          .from("employee_vacations")
          .select("employee_id")
          .lte("start_date", today)
          .gte("end_date", today),
        supabase
          .from("daily_schedules")
          .select("id")
          .eq("schedule_date", today)
          .maybeSingle(),
      ]);

      if (tasksRes.error) throw tasksRes.error;

      // Get field employees for today
      let fieldEmployeeIds = new Set<string>();
      if (dailyRes.data?.id) {
        const { data: entries } = await supabase
          .from("daily_schedule_entries")
          .select("employee_id")
          .eq("daily_schedule_id", dailyRes.data.id);
        (entries || []).forEach((e: any) => fieldEmployeeIds.add(e.employee_id));
      }

      const vacationIds = new Set((vacationsRes.data || []).map((v: any) => v.employee_id));

      const tasksByEmp = new Map<string, TaskRow[]>();
      (tasksRes.data || []).forEach((t: any) => {
        const list = tasksByEmp.get(t.assigned_to_id) || [];
        list.push(t);
        tasksByEmp.set(t.assigned_to_id, list);
      });

      return activeEmployees.map((e: any): TechnicianRow => {
        const empTasks = tasksByEmp.get(e.id) || [];
        return {
          id: e.id,
          name: e.name,
          role: e.role,
          pending: empTasks.filter(t => t.status === "pendente").length,
          in_progress: empTasks.filter(t => t.status === "em_andamento").length,
          completed_30d: empTasks.filter(t =>
            t.status === "concluida" && t.completed_at && t.completed_at >= thirtyDaysAgo
          ).length,
          tasks: empTasks.filter(t => t.status !== "concluida" && t.status !== "cancelada"),
          on_vacation: vacationIds.has(e.id),
          in_field_today: fieldEmployeeIds.has(e.id),
        };
      }).sort((a, b) => (b.pending + b.in_progress) - (a.pending + a.in_progress));
    },
  });

  const { data: projectMap = {} } = useQuery({
    queryKey: ["st_equipe_projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, codigo, name");
      const map: Record<string, { codigo: string | null; name: string }> = {};
      (data || []).forEach((p: any) => (map[p.id] = { codigo: p.codigo, name: p.name }));
      return map;
    },
  });

  const handleReassign = async () => {
    if (!reassignTaskId || !reassignTo) return;
    await supabase.from("technical_tasks").update({ assigned_to_id: reassignTo } as any).eq("id", reassignTaskId);
    toast.success("Tarefa reatribuída");
    setReassignTaskId(null);
    setReassignTo("");
    qc.invalidateQueries({ queryKey: ["st_equipe_workload"] });
    qc.invalidateQueries({ queryKey: ["technical_tasks"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Carga por técnico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Técnico</TableHead>
                  <TableHead className="text-xs text-center">Pendentes</TableHead>
                  <TableHead className="text-xs text-center">Em andamento</TableHead>
                  <TableHead className="text-xs text-center">Concluídas (30d)</TableHead>
                  <TableHead className="text-xs text-center">Situação</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTechnicians.map(tech => {
                  const isExpanded = expandedId === tech.id;
                  const situation = getSituation(tech);
                  const isHighLoad = tech.in_progress >= 5;
                  return (
                    <TableRow key={tech.id} className={isHighLoad ? "bg-orange-50/50" : ""}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{tech.name}</p>
                          <p className="text-[10px] text-muted-foreground">{tech.role}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{tech.pending}</TableCell>
                      <TableCell className="text-center text-sm">{tech.in_progress}</TableCell>
                      <TableCell className="text-center text-sm">{tech.completed_30d}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${situation.cls}`}>
                          {situation.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tech.tasks.length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setExpandedId(isExpanded ? null : tech.id)}
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            Ver tarefas
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Expanded tasks */}
          {expandedId && (() => {
            const tech = allTechnicians.find(t => t.id === expandedId);
            if (!tech || tech.tasks.length === 0) return null;
            return (
              <div className="border-t px-4 py-3 bg-muted/20 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Tarefas de {tech.name}</p>
                {tech.tasks.map(task => {
                  const proj = projectMap[task.project_id];
                  return (
                    <div key={task.id} className="flex items-center justify-between p-2 rounded border bg-background gap-2">
                      <div className="flex-1 space-y-0.5">
                        <p className="text-sm font-medium">{task.title}</p>
                        {proj && <p className="text-[10px] text-muted-foreground">{proj.codigo || proj.name}</p>}
                        {task.due_date && (
                          <DeadlineBadge
                            deadline={new Date(task.due_date)}
                            started_at={null}
                            estimated_days={null}
                            completed_at={null}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{task.status}</Badge>
                        {reassignTaskId === task.id ? (
                          <div className="flex gap-1 items-center">
                            <Select value={reassignTo} onValueChange={setReassignTo}>
                              <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue placeholder="Técnico..." /></SelectTrigger>
                              <SelectContent>
                                {activeEmployees.filter((e: any) => e.id !== tech.id).map((e: any) => (
                                  <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-7 text-xs" onClick={handleReassign} disabled={!reassignTo}>OK</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setReassignTaskId(null); setReassignTo(""); }}>✕</Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setReassignTaskId(task.id)}
                          >
                            <RefreshCw className="w-3 h-3 mr-0.5" /> Reatribuir
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
