import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUpdateProject } from "@/hooks/useProjects";
import DeadlineBadge from "@/components/DeadlineBadge";
import { ClipboardList, Bell } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  client_name: string | null;
  pending_scope: number;
  task_done: number;
  task_total: number;
  has_active_alert: boolean;
}

export default function STKanban() {
  const { user } = useAuth();
  const updateProject = useUpdateProject();
  const [confirmDlg, setConfirmDlg] = useState<{ project: ProjectRow; pendingCount: number } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { data: projects = [], refetch } = useQuery({
    queryKey: ["st_kanban_projects"],
    queryFn: async () => {
      const validStatuses = COLUMNS.map(c => c.key);
      const { data: rows, error } = await supabase
        .from("projects")
        .select("id, codigo, name, execution_status, billing_type, delivery_deadline, field_completed_at, delivery_days_estimated, delivered_at, client_id, is_active")
        .in("execution_status", validStatuses)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      const ids = (rows || []).map(r => r.id);
      if (!ids.length) return [];

      const [clientsRes, scopeRes, tasksRes, alertsRes] = await Promise.all([
        supabase.from("clients").select("id, name"),
        supabase.from("project_scope_items").select("project_id, is_completed").in("project_id", ids),
        supabase.from("technical_tasks").select("project_id, status").in("project_id", ids),
        supabase.from("alerts").select("reference_id").in("reference_id", ids).eq("alert_status" as any, "ativo"),
      ]);

      const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]));
      const scopeByProject = new Map<string, number>();
      (scopeRes.data || []).forEach((s: any) => {
        if (!s.is_completed) scopeByProject.set(s.project_id, (scopeByProject.get(s.project_id) || 0) + 1);
      });
      const tasksByProject = new Map<string, { done: number; total: number }>();
      (tasksRes.data || []).forEach((t: any) => {
        const cur = tasksByProject.get(t.project_id) || { done: 0, total: 0 };
        cur.total++;
        if (t.status === "concluida") cur.done++;
        tasksByProject.set(t.project_id, cur);
      });
      const alertSet = new Set((alertsRes.data || []).map((a: any) => a.reference_id));

      return (rows || []).map((r: any): ProjectRow => {
        const tasks = tasksByProject.get(r.id) || { done: 0, total: 0 };
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
          client_name: clientMap.get(r.client_id) || null,
          pending_scope: scopeByProject.get(r.id) || 0,
          task_done: tasks.done,
          task_total: tasks.total,
          has_active_alert: alertSet.has(r.id),
        };
      });
    },
  });

  const byCol = useMemo(() => {
    const map: Record<string, ProjectRow[]> = {};
    COLUMNS.forEach(c => (map[c.key] = []));
    projects.forEach(p => {
      if (p.execution_status && map[p.execution_status]) map[p.execution_status].push(p);
    });
    return map;
  }, [projects]);

  const handleDrop = async (colKey: string) => {
    if (!draggedId) return;
    const col = COLUMNS.find(c => c.key === colKey);
    if (col?.readonly) return;
    const project = projects.find(p => p.id === draggedId);
    if (!project || project.execution_status === colKey) return;

    if (colKey === "entregue") return; // read-only

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

  const billingBadge = (bt: string | null) => {
    if (!bt) return <Badge variant="destructive" className="text-[10px]">⚠ Faturamento indefinido</Badge>;
    const b = BILLING_BADGES[bt];
    if (!b) return <Badge variant="outline" className="text-[10px]">{bt}</Badge>;
    return <Badge variant="outline" className={`text-[10px] ${b.cls}`}>{b.label}</Badge>;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[60vh]">
      {COLUMNS.map(col => (
        <div
          key={col.key}
          className="flex-shrink-0 w-[260px] bg-muted/30 rounded-lg p-2"
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
                className={`cursor-${col.readonly ? "default" : "grab"} hover:shadow-md transition-shadow`}
              >
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">{p.codigo || "—"}</span>
                    <div className="flex gap-1">
                      {p.pending_scope > 0 && <ClipboardList className="w-3.5 h-3.5 text-amber-500" />}
                      {p.has_active_alert && <Bell className="w-3.5 h-3.5 text-destructive" />}
                    </div>
                  </div>
                  <p className="text-xs font-medium leading-tight">{p.name}</p>
                  {p.client_name && <p className="text-[10px] text-muted-foreground">{p.client_name}</p>}
                  <DeadlineBadge
                    deadline={p.delivery_deadline ? new Date(p.delivery_deadline) : null}
                    started_at={p.field_completed_at ? new Date(p.field_completed_at) : null}
                    estimated_days={p.delivery_days_estimated}
                    completed_at={p.delivered_at ? new Date(p.delivered_at) : null}
                    label="Entrega"
                  />
                  {p.task_total > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {p.task_done} de {p.task_total} tarefas concluídas
                    </p>
                  )}
                  {billingBadge(p.billing_type)}
                  {col.key === "aprovado" && (
                    <Button size="sm" variant="outline" className="w-full text-xs mt-1" onClick={() => handleDeliverClick(p)}>
                      Marcar como entregue
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

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
    </div>
  );
}
