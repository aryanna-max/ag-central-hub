import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Users, GripVertical } from "lucide-react";
import { format } from "date-fns";
import DeadlineBadge from "@/components/DeadlineBadge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
}

interface ClientMap {
  [id: string]: string;
}

const COLUMNS = [
  { key: "aguardando_campo", label: "Aguardando campo", color: "bg-muted" },
  { key: "em_campo", label: "Em campo", color: "bg-emerald-50" },
  { key: "campo_concluido", label: "Campo concluído", color: "bg-blue-50" },
] as const;

export default function ProjetosEmCampoKanban() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects-field-kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, codigo, name, client_id, execution_status, field_deadline, field_started_at, field_days_estimated, field_completed_at, is_active")
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
      // Log status change
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
    </div>
  );
}
