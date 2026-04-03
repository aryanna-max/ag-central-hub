import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTechnicalTasksByAssignee } from "@/hooks/useTechnicalTasks";
import { useUpdateTechnicalTask } from "@/hooks/useTechnicalTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DeadlineBadge from "@/components/DeadlineBadge";
import { Play, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, isToday, isBefore, isAfter } from "date-fns";

const PRIORITY_BADGE: Record<string, { label: string; cls: string }> = {
  urgente: { label: "Urgente", cls: "bg-red-100 text-red-800 border-red-300" },
  alta: { label: "Alta", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  normal: { label: "Normal", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  baixa: { label: "Baixa", cls: "bg-gray-100 text-gray-600 border-gray-300" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", cls: "bg-blue-50 text-blue-700 border-blue-300" },
  concluida: { label: "Concluída", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  cancelada: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
};

export default function STMinhasTarefas() {
  const { user } = useAuth();
  const { data: tasks = [] } = useTechnicalTasksByAssignee(user?.id || null);
  const updateTask = useUpdateTechnicalTask();
  const [concludeId, setConcludeId] = useState<string | null>(null);
  const [concludeNote, setConcludeNote] = useState("");

  const { data: projectMap = {} } = useQuery({
    queryKey: ["st_projects_map", tasks.map(t => t.project_id)],
    enabled: tasks.length > 0,
    queryFn: async () => {
      const ids = [...new Set(tasks.map(t => t.project_id))];
      const { data } = await supabase.from("projects").select("id, codigo, name").in("id", ids);
      const map: Record<string, { codigo: string | null; name: string }> = {};
      (data || []).forEach((p: any) => (map[p.id] = { codigo: p.codigo, name: p.name }));
      return map;
    },
  });

  const today = new Date();
  const nextWeek = addDays(today, 7);

  const todayTasks = useMemo(() =>
    tasks.filter(t => t.status === "em_andamento" || (t.due_date && isToday(new Date(t.due_date)))),
    [tasks]
  );

  const upcomingTasks = useMemo(() =>
    tasks.filter(t => {
      if (t.status === "concluida" || t.status === "cancelada") return false;
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      return isAfter(d, today) && isBefore(d, nextWeek) && !isToday(d);
    }),
    [tasks]
  );

  const completedTasks = useMemo(() =>
    tasks.filter(t => t.status === "concluida").sort((a, b) =>
      (b.completed_at || "").localeCompare(a.completed_at || "")
    ).slice(0, 30),
    [tasks]
  );

  const handleStart = (id: string) => updateTask.mutate({ id, status: "em_andamento" } as any);
  const handleConclude = () => {
    if (!concludeId) return;
    updateTask.mutate({ id: concludeId, status: "concluida", completed_at: new Date().toISOString() } as any);
    setConcludeId(null);
    setConcludeNote("");
  };

  const TaskRow = ({ t }: { t: any }) => {
    const proj = projectMap[t.project_id];
    const sb = STATUS_BADGE[t.status] || STATUS_BADGE.pendente;
    return (
      <div className="flex items-center justify-between p-2 rounded border gap-2">
        <div className="flex-1 space-y-0.5">
          <p className="text-sm font-medium">{t.title}</p>
          {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
          {proj && <p className="text-[10px] text-muted-foreground">{proj.codigo || proj.name}</p>}
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
          {t.priority && PRIORITY_BADGE[t.priority] && (
            <Badge variant="outline" className={`text-[10px] ${PRIORITY_BADGE[t.priority].cls}`}>{PRIORITY_BADGE[t.priority].label}</Badge>
          )}
          <Badge variant="outline" className={`text-[10px] ${sb.cls}`}>{sb.label}</Badge>
          {t.status === "pendente" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleStart(t.id)}>
              <Play className="w-3 h-3 mr-0.5" /> Iniciar
            </Button>
          )}
          {t.status === "em_andamento" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConcludeId(t.id)}>
              <CheckCircle className="w-3 h-3 mr-0.5" /> Concluir
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Hoje</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {todayTasks.length ? todayTasks.map(t => <TaskRow key={t.id} t={t} />) : (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa para hoje</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Próximos 7 dias</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {upcomingTasks.length ? upcomingTasks.map(t => <TaskRow key={t.id} t={t} />) : (
            <p className="text-xs text-muted-foreground text-center py-4">Sem tarefas próximas</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Concluídas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {completedTasks.length ? completedTasks.map(t => <TaskRow key={t.id} t={t} />) : (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa concluída</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!concludeId} onOpenChange={() => setConcludeId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Concluir tarefa</DialogTitle></DialogHeader>
          <Textarea placeholder="Observação (opcional)" value={concludeNote} onChange={e => setConcludeNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConcludeId(null)}>Cancelar</Button>
            <Button onClick={handleConclude}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
