import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MARCO_ZERO } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Users, Bell, ChevronDown, ChevronRight, CheckCircle,
  Map, Flag, AlertCircle, ClipboardList,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const OCCURRENCE_TYPES = [
  { value: "retrabalho", label: "Retrabalho" },
  { value: "clima", label: "Clima" },
  { value: "equipamento", label: "Equipamento" },
  { value: "falta_equipe", label: "Falta de equipe" },
  { value: "acesso_impedido", label: "Acesso impedido" },
  { value: "outro", label: "Outro" },
];

export default function ProjetosEmCampoKanban() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [finalizarProject, setFinalizarProject] = useState<Project | null>(null);
  const [occurrenceProject, setOccurrenceProject] = useState<Project | null>(null);
  const [occurrenceType, setOccurrenceType] = useState("retrabalho");
  const [occurrenceDesc, setOccurrenceDesc] = useState("");
  const [occurrenceDays, setOccurrenceDays] = useState("");

  // ─── QUERIES ───

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
      const map: Record<string, string> = {};
      (data || []).forEach((c) => { map[c.id] = c.name; });
      return map;
    },
  });

  const { data: historyProjects = [] } = useQuery({
    queryKey: ["projects-field-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, codigo, name, client_id, execution_status, field_started_at, field_completed_at")
        .not("execution_status", "in", '("aguardando_campo","em_campo","campo_concluido")')
        .not("field_started_at", "is", null)
        .gte("field_started_at", MARCO_ZERO)
        .order("field_completed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

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

  // Occurrence count per project
  const { data: occurrenceCounts = {} } = useQuery({
    queryKey: ["project-occurrences"],
    queryFn: async () => {
      const ids = projects.filter(p => p.execution_status === "em_campo").map(p => p.id);
      if (!ids.length) return {};
      const { data } = await supabase
        .from("project_status_history")
        .select("project_id")
        .in("project_id", ids)
        .eq("from_status", "em_campo")
        .eq("to_status", "em_campo");
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.project_id] = (map[r.project_id] || 0) + 1; });
      return map;
    },
    enabled: projects.length > 0,
  });

  // Today's allocations
  const { data: todayEntries = [] } = useQuery({
    queryKey: ["today-entries-kanban", today],
    queryFn: async () => {
      const { data: schedules } = await supabase
        .from("daily_schedules")
        .select("id")
        .eq("schedule_date", today)
        .eq("is_legacy", false);
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

  const emCampo = useMemo(() => projects.filter(p => p.execution_status === "em_campo"), [projects]);
  const aguardando = useMemo(() => projects.filter(p => p.execution_status === "aguardando_campo"), [projects]);
  const concluido = useMemo(() => projects.filter(p => p.execution_status === "campo_concluido"), [projects]);

  // ─── MUTATIONS ───

  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("alerts")
        .update({ alert_status: "resolvido", resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id } as any)
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["operacional-alerts"] }); toast.success("Alerta resolvido"); },
  });

  const iniciarCampo = useMutation({
    mutationFn: async (project: Project) => {
      const { error } = await supabase.from("projects").update({
        execution_status: "em_campo" as any,
        field_started_at: new Date().toISOString().split("T")[0],
      }).eq("id", project.id);
      if (error) throw error;
      await supabase.from("project_status_history").insert({
        project_id: project.id, from_status: "aguardando_campo", to_status: "em_campo",
        modulo: "operacional", changed_by_id: user?.id || null,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects-field-kanban"] }); toast.success("Projeto iniciado em campo"); },
    onError: () => toast.error("Erro ao iniciar campo"),
  });

  const finalizarCampo = useMutation({
    mutationFn: async (project: Project) => {
      const now = new Date().toISOString();
      const { error } = await supabase.from("projects").update({
        execution_status: "aguardando_processamento" as any,
        field_completed_at: now.split("T")[0],
      }).eq("id", project.id);
      if (error) throw error;
      // History: em_campo → campo_concluido
      await supabase.from("project_status_history").insert({
        project_id: project.id, from_status: "em_campo", to_status: "campo_concluido",
        modulo: "operacional", changed_by_id: user?.id || null,
      });
      // History: campo_concluido → aguardando_processamento
      await supabase.from("project_status_history").insert({
        project_id: project.id, from_status: "campo_concluido", to_status: "aguardando_processamento",
        modulo: "operacional", changed_by_id: user?.id || null,
      });
      // Alert for Sala Técnica
      await supabase.from("alerts").insert({
        alert_type: "campo_concluido",
        priority: "importante",
        recipient: "sala_tecnica",
        title: `Projeto ${project.codigo || project.name} — campo finalizado`,
        message: `Projeto ${project.name} concluiu etapa de campo. Distribuir para processamento.`,
        reference_type: "project",
        reference_id: project.id,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-field-kanban"] });
      qc.invalidateQueries({ queryKey: ["projects-field-history"] });
      toast.success("Campo finalizado — projeto enviado para Sala Técnica");
      setFinalizarProject(null);
    },
    onError: () => toast.error("Erro ao finalizar campo"),
  });

  const registrarOcorrencia = useMutation({
    mutationFn: async () => {
      if (!occurrenceProject) return;
      const label = OCCURRENCE_TYPES.find(t => t.value === occurrenceType)?.label || occurrenceType;
      const dias = parseInt(occurrenceDays) || 0;
      const notes = `${label}: ${occurrenceDesc}${dias > 0 ? ` (+${dias} dias)` : ""}`;
      await supabase.from("project_status_history").insert({
        project_id: occurrenceProject.id,
        from_status: "em_campo", to_status: "em_campo",
        notes, modulo: "operacional", changed_by_id: user?.id || null,
      });
      if (dias > 0) {
        const current = occurrenceProject.field_days_estimated || 0;
        await supabase.from("projects").update({ field_days_estimated: current + dias }).eq("id", occurrenceProject.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-field-kanban"] });
      qc.invalidateQueries({ queryKey: ["project-occurrences"] });
      toast.success("Ocorrência registrada");
      setOccurrenceProject(null);
      setOccurrenceDesc("");
      setOccurrenceDays("");
      setOccurrenceType("retrabalho");
    },
    onError: () => toast.error("Erro ao registrar ocorrência"),
  });

  // ─── RENDER ───

  const renderCard = (p: Project, section: "em_campo" | "aguardando" | "concluido") => {
    const crew = entriesByProject[p.id] || [];
    const noScale = section === "em_campo" && crew.length === 0;
    const occCount = occurrenceCounts[p.id] || 0;

    return (
      <Card key={p.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono font-bold text-sm text-primary">{p.codigo || "—"}</p>
              <p className="text-sm font-medium leading-tight truncate">{p.name}</p>
              {p.client_id && clientsMap[p.client_id] && (
                <p className="text-xs text-muted-foreground truncate">{clientsMap[p.client_id]}</p>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {occCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 text-[10px]">Ocorrência ({occCount})</Badge>
              )}
            </div>
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
              <span className="truncate">{crew.join(", ")}</span>
            </div>
          )}

          {noScale && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertTriangle className="w-3 h-3" /> Sem escala hoje
            </Badge>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {section === "aguardando" && (
              <Button size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => iniciarCampo.mutate(p)}>
                <Flag className="w-3 h-3" /> Iniciar Campo
              </Button>
            )}
            {section === "em_campo" && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setOccurrenceProject(p)}>
                  <AlertCircle className="w-3 h-3" /> Ocorrência
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1 flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setFinalizarProject(p)}>
                  <CheckCircle className="w-3 h-3" /> Finalizar Campo
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) return <p className="text-muted-foreground p-4">Carregando projetos em campo...</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Map className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projetos em Campo</h1>
            <p className="text-sm text-muted-foreground">
              {emCampo.length} em campo · {aguardando.length} aguardando · {concluido.length} concluído
            </p>
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
              ) : alerts.map((alert: any) => (
                <div key={alert.id} className="p-3 rounded-lg border space-y-2">
                  <p className="text-sm font-medium">{alert.title}</p>
                  {alert.message && <p className="text-xs text-muted-foreground">{alert.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => resolveAlert.mutate(alert.id)}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Resolver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Em Campo — seção principal */}
      {emCampo.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Em Campo ({emCampo.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {emCampo.map(p => renderCard(p, "em_campo"))}
          </div>
        </section>
      )}

      {/* Aguardando Campo */}
      {aguardando.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" /> Aguardando Campo ({aguardando.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {aguardando.map(p => renderCard(p, "aguardando"))}
          </div>
        </section>
      )}

      {/* Campo Concluído (recém-concluídos) */}
      {concluido.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" /> Campo Concluído ({concluido.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {concluido.map(p => renderCard(p, "concluido"))}
          </div>
        </section>
      )}

      {/* Mensagem vazia */}
      {projects.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Nenhum projeto em fase de campo</p>
        </div>
      )}

      {/* Histórico colapsável */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            {historyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Histórico ({historyProjects.length})
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 divide-y border rounded-lg">
            {historyProjects.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="font-mono font-semibold text-primary text-xs">{p.codigo || "—"}</span>
                <span className="flex-1 truncate text-muted-foreground">{p.client_id && clientsMap[p.client_id] ? clientsMap[p.client_id] : p.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {p.field_started_at && format(new Date(p.field_started_at), "dd/MM")}
                  {p.field_completed_at && ` → ${format(new Date(p.field_completed_at), "dd/MM")}`}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Dialog: Confirmar finalização de campo */}
      <AlertDialog open={!!finalizarProject} onOpenChange={(o) => !o && setFinalizarProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar campo — {finalizarProject?.codigo}</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto será enviado para a Sala Técnica para processamento. A equipe técnica será notificada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finalizarProject && finalizarCampo.mutate(finalizarProject)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirmar — Finalizar Campo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Registrar ocorrência */}
      <Dialog open={!!occurrenceProject} onOpenChange={(o) => { if (!o) { setOccurrenceProject(null); setOccurrenceDesc(""); setOccurrenceDays(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Ocorrência — {occurrenceProject?.codigo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={occurrenceType} onValueChange={setOccurrenceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OCCURRENCE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Descrição *</Label>
              <Textarea
                value={occurrenceDesc}
                onChange={e => setOccurrenceDesc(e.target.value)}
                placeholder="Descreva o que aconteceu..."
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Dias adicionais previstos</Label>
              <Input
                type="number"
                min="0"
                value={occurrenceDays}
                onChange={e => setOccurrenceDays(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Será somado ao prazo estimado de campo</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOccurrenceProject(null)}>Cancelar</Button>
            <Button
              onClick={() => registrarOcorrencia.mutate()}
              disabled={!occurrenceDesc.trim() || registrarOcorrencia.isPending}
            >
              {registrarOcorrencia.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
