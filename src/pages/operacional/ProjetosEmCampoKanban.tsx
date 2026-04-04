import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, GripVertical, Bell, ChevronDown, ChevronRight, CheckCircle, Map } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import DeadlineBadge from "@/components/DeadlineBadge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  codigo: string | null;
  name: string;
  client_id: string | null;
  execution_status: string | null;
  field_deadline: string | null;
  field_started_at: string | null;
  field_days_estimated: number | null;
  field_completed_at: string | null;
  billing_type: string | null;
}

interface ClientMap {
  [id: string]: string;
}

const COLUMNS = [
  { key: "aguardando_campo", label: "Aguardando Campo", color: "bg-muted" },
  { key: "em_campo", label: "Em Campo", color: "bg-emerald-50" },
  { key: "campo_concluido", label: "Campo Concluído", color: "bg-blue-50" },
] as const;

const HISTORY_BADGE: Record<string, { label: string; className: string }> = {
  aguardando_processamento: { label: "Prancheta", className: "bg-blue-100 text-blue-800" },
  em_processamento: { label: "Prancheta", className: "bg-blue-100 text-blue-800" },
  revisao: { label: "Prancheta", className: "bg-blue-100 text-blue-800" },
  aprovado: { label: "Prancheta", className: "bg-blue-100 text-blue-800" },
  entregue: { label: "Concluído", className: "bg-emerald-100 text-emerald-800" },
  faturamento: { label: "Concluído", className: "bg-emerald-100 text-emerald-800" },
  pago: { label: "Concluído", className: "bg-emerald-100 text-emerald-800" },
};

const BILLING_BADGE: Record<string, { label: string; className: string }> = {
  entrega_nf: { label: "NF na entrega", className: "bg-emerald-100 text-emerald-800" },
  entrega_recibo: { label: "Recibo na entrega", className: "bg-emerald-100 text-emerald-800" },
  medicao_mensal: { label: "Por medição", className: "bg-blue-100 text-blue-800" },
  misto: { label: "Misto", className: "bg-amber-100 text-amber-800" },
  sem_documento: { label: "Sem documento", className: "bg-muted text-muted-foreground" },
};

export default function ProjetosEmCampoKanban() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects-field-kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, codigo, name, client_id, execution_status, field_deadline, field_started_at, field_days_estimated, field_completed_at, billing_type, is_active")
        .eq("is_active", true)
        .in("execution_status", ["aguardando_campo", "em_campo", "campo_concluido"])
        .order("name");
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: clientsMap = {} } = useQuery({
    queryKey: ["clients-map"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name");
      const map: ClientMap = {};
      (data || []).forEach((c) => { map[c.id] = c.name; });
      return map;
    },
  });

  // History projects
  const { data: historyProjects = [] } = useQuery({
    queryKey: ["projects-field-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, codigo, name, client_id, execution_status, field_started_at, field_completed_at")
        .not("execution_status", "in", '("aguardando_campo","em_campo","campo_concluido")')
        .not("field_started_at", "is", null)
        .gte("field_started_at", "2026-03-31")
        .order("field_completed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ["operacional-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("recipient", "operacional")
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("alerts")
        .update({ alert_status: "resolvido", resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id } as any)
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operacional-alerts"] });
      toast.success("Alerta resolvido");
    },
  });

  // Today's allocations per project
  const { data: todayEntries = [] } = useQuery({
    queryKey: ["today-entries-kanban", today],
    queryFn: async () => {
      const { data: schedules } = await supabase
        .from("daily_schedules")
        .select("id")
        .eq("schedule_date", today);
      if (!schedules?.length) return [];
      const { data: entries } = await supabase
        .from("daily_schedule_entries")
        .select("project_id, employee_id, employees:employee_id(name)")
        .in("daily_schedule_id", schedules.map((s) => s.id));
      return (entries || []) as any[];
    },
  });

  const entriesByProject = useMemo(() => {
    const map: Record<string, string[]> = {};
    todayEntries.forEach((e: any) => {
      if (!e.project_id) return;
      if (!map[e.project_id]) map[e.project_id] = [];
      const name = e.employees?.name;
      if (name) map[e.project_id].push(name.split(" ")[0]);
    });
    return map;
  }, [todayEntries]);

  const moveToEmCampo = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ execution_status: "em_campo" as any })
        .eq("id", projectId);
      if (error) throw error;
      await supabase.from("project_status_history").insert({
        project_id: projectId,
        from_status: "aguardando_campo",
        to_status: "em_campo",
        modulo: "operacional",
        changed_by_id: user?.id || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-field-kanban"] });
      toast.success("Projeto movido para Em Campo");
    },
    onError: () => toast.error("Erro ao mover projeto"),
  });

  const grouped = useMemo(() => {
    const g: Record<string, Project[]> = {
      aguardando_campo: [],
      em_campo: [],
      campo_concluido: [],
    };
    projects.forEach((p) => {
      const s = p.execution_status || "aguardando_campo";
      if (g[s]) g[s].push(p);
    });
    return g;
  }, [projects]);

  const [dragId, setDragId] = useState<string | null>(null);

  const handleDrop = (colKey: string) => {
    if (!dragId || colKey !== "em_campo") return;
    const proj = projects.find((p) => p.id === dragId);
    if (proj?.execution_status === "aguardando_campo") {
      moveToEmCampo.mutate(dragId);
    }
    setDragId(null);
  };

  if (isLoading) return <p className="text-muted-foreground p-4">Carregando projetos em campo...</p>;

  return (
    <div className="space-y-4">
      {/* Header with alerts bell */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Map className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projetos em Campo</h1>
            <p className="text-sm text-muted-foreground">Kanban de execução em campo</p>
          </div>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {alerts.length}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Alertas do Campo ({alerts.length})</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum alerta ativo.</p>
              ) : (
                alerts.map((alert: any) => (
                  <div key={alert.id} className="p-3 rounded-lg border space-y-2">
                    <p className="text-sm font-medium">{alert.title}</p>
                    {alert.message && <p className="text-xs text-muted-foreground">{alert.message}</p>}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                    <div className="flex gap-2">
                      {alert.action_url && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(alert.action_url)}>
                          Ver projeto
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => resolveAlert.mutate(alert.id)}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Resolver
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={`rounded-lg border p-3 min-h-[300px] ${col.color}`}
            onDragOver={(e) => col.key === "em_campo" ? e.preventDefault() : undefined}
            onDrop={() => handleDrop(col.key)}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <Badge variant="secondary" className="text-xs">{grouped[col.key]?.length || 0}</Badge>
            </div>
            <div className="space-y-2">
              {(grouped[col.key] || []).map((p) => {
                const crew = entriesByProject[p.id] || [];
                const noScale = col.key === "em_campo" && crew.length === 0;
                return (
                  <Card
                    key={p.id}
                    draggable={col.key === "aguardando_campo"}
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-${col.key === "aguardando_campo" ? "grab" : "default"} ${dragId === p.id ? "opacity-50" : ""}`}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono font-bold text-sm text-primary">{p.codigo || "—"}</p>
                          <p className="text-sm font-medium leading-tight">{p.name}</p>
                          {p.client_id && clientsMap[p.client_id] && (
                            <p className="text-xs text-muted-foreground">{clientsMap[p.client_id]}</p>
                          )}
                        </div>
                        {col.key === "aguardando_campo" && (
                          <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                      <DeadlineBadge
                        deadline={p.field_deadline ? new Date(p.field_deadline) : null}
                        started_at={p.field_started_at ? new Date(p.field_started_at) : null}
                        estimated_days={p.field_days_estimated}
                        completed_at={p.field_completed_at ? new Date(p.field_completed_at) : null}
                        label="Campo"
                      />
                      {crew.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{crew.join(", ")}</span>
                        </div>
                      )}
                      {noScale && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="w-3 h-3" /> Sem escala hoje
                        </Badge>
                      )}
                      {(() => {
                        const bt = p.billing_type;
                        const badge = bt ? BILLING_BADGE[bt] : null;
                        if (badge) return <Badge className={badge.className + " text-[10px]"}>{badge.label}</Badge>;
                        return <Badge className="bg-red-100 text-red-800 text-[10px]">⚠ Definir faturamento</Badge>;
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
              {(grouped[col.key] || []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum projeto</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* History */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            {historyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Histórico ({historyProjects.length} projetos)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="p-0">
              {historyProjects.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Nenhum projeto no histórico.</p>
              ) : (
                <div className="divide-y">
                  {historyProjects.map((p: any) => {
                    const badge = HISTORY_BADGE[p.execution_status] || { label: p.execution_status, className: "bg-muted text-muted-foreground" };
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <span className="font-mono font-semibold text-primary">{p.codigo || "—"}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="flex-1 truncate">{p.client_id && clientsMap[p.client_id] ? clientsMap[p.client_id] : p.name}</span>
                        <Badge className={badge.className + " text-xs"}>
                          {badge.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {p.field_started_at && format(new Date(p.field_started_at), "dd/MM")}
                          {p.field_completed_at && ` → ${format(new Date(p.field_completed_at), "dd/MM")}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
