import { useMemo, useState } from "react";
import {
  FolderKanban, FileText, Users, Bell, TrendingUp,
  AlertTriangle, ChevronRight, ExternalLink, Activity,
  CheckCircle2, Clock, XCircle, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const LEAD_STATUS_LABELS: Record<string, string> = {
  novo: "Novo", qualificado: "Qualificado", proposta_enviada: "Proposta Enviada",
  aprovado: "Aprovado", convertido: "Aprovado", perdido: "Perdido",
};
const LEAD_STATUS_COLORS: Record<string, string> = {
  novo: "bg-muted text-muted-foreground", qualificado: "bg-blue-100 text-blue-800",
  proposta_enviada: "bg-amber-100 text-amber-800", aprovado: "bg-emerald-100 text-emerald-800",
  convertido: "bg-emerald-100 text-emerald-800", perdido: "bg-rose-100 text-rose-800",
};
const PROJECT_STATUS_LABELS: Record<string, string> = {
  planejamento: "Planejamento", execucao: "Execução", entrega: "Entrega",
  faturamento: "Faturamento", concluido: "Concluído", pausado: "Pausado",
};
const PROJECT_STATUS_COLORS: Record<string, string> = {
  planejamento: "bg-muted text-muted-foreground", execucao: "bg-blue-100 text-blue-800",
  entrega: "bg-amber-100 text-amber-800", faturamento: "bg-orange-100 text-orange-800",
  concluido: "bg-green-100 text-green-800", pausado: "bg-rose-100 text-rose-800",
};

type PanelType = "projects" | "leads" | "proposals" | "alerts" | null;

export default function Dashboard() {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();

  const { data: leads = [] } = useQuery({
    queryKey: ["dashboard-leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ["dashboard-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: measurements = [] } = useQuery({
    queryKey: ["dashboard-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("measurements").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-alerts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts").select("*").eq("resolved", false)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: expenseSheets = [] } = useQuery({
    queryKey: ["dashboard-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("field_expense_sheets").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Computed
  const activeProjects = useMemo(() => projects.filter((p) => !["concluido", "pausado"].includes(p.status)), [projects]);
  const activeLeads = useMemo(() => leads.filter((l) => !["convertido", "perdido"].includes(l.status)), [leads]);
  const openProposals = useMemo(() => proposals.filter((p) => !["aprovada", "rejeitada"].includes(p.status)), [proposals]);
  const urgentAlerts = useMemo(() => alerts.filter((a: any) => a.priority === "urgente"), [alerts]);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Project diagnostics
  const getProjectDiagnostics = (project: Project) => {
    const projectMeasurements = measurements.filter((m: any) => m.project_id === project.id);
    const projectExpenses = expenseSheets.filter((e: any) => e.project_id === project.id);
    const projectAlerts = alerts.filter((a: any) => a.reference_id === project.id);
    const client = project.client_id ? clients.find((c) => c.id === project.client_id) : null;
    const projectLeads = leads.filter((l: any) => l.converted_project_id === project.id);

    const totalMedido = projectMeasurements.reduce((s: number, m: any) => s + (m.valor_nf || 0), 0);
    const totalDespesas = projectExpenses.reduce((s: number, e: any) => s + (e.total_value || 0), 0);
    const pendingMeasurements = projectMeasurements.filter((m: any) => ["rascunho", "aguardando_nf"].includes(m.status));
    const pendingExpenses = projectExpenses.filter((e: any) => e.status === "submetida");

    const warnings: string[] = [];
    if (pendingMeasurements.length > 0) warnings.push(`${pendingMeasurements.length} medição(ões) pendente(s)`);
    if (pendingExpenses.length > 0) warnings.push(`${pendingExpenses.length} folha(s) de despesa aguardando aprovação`);
    if (project.contract_value && totalMedido > project.contract_value * 0.9)
      warnings.push("Valor medido próximo do valor contratado");
    if (!project.responsible) warnings.push("Sem responsável definido");
    if (projectAlerts.length > 0) warnings.push(`${projectAlerts.length} alerta(s) não resolvido(s)`);

    return {
      client, projectMeasurements, projectExpenses, projectAlerts, projectLeads,
      totalMedido, totalDespesas, pendingMeasurements, pendingExpenses, warnings,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Painel do Diretor</h1>
          <p className="text-muted-foreground text-sm">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {urgentAlerts.length > 0 && (
            <Badge variant="destructive" className="cursor-pointer" onClick={() => setActivePanel("alerts")}>
              <AlertTriangle className="w-3 h-3 mr-1" /> {urgentAlerts.length} urgente(s)
            </Badge>
          )}
        </div>
      </div>

      {/* Main KPI Grid - all clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => setActivePanel("projects")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projetos Ativos</p>
                <p className="text-3xl font-bold mt-1">{activeProjects.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {projects.filter(p => p.status === "concluido").length} concluídos
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <FolderKanban className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-primary">
              <span>Ver diagnóstico</span> <ChevronRight className="w-3 h-3" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => setActivePanel("leads")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads no Funil</p>
                <p className="text-3xl font-bold mt-1">{activeLeads.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {leads.filter(l => ["aprovado", "convertido"].includes(l.status)).length} aprovados
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-secondary">
              <span>Ver detalhes</span> <ChevronRight className="w-3 h-3" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors group"
          onClick={() => setActivePanel("proposals")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Propostas Abertas</p>
                <p className="text-3xl font-bold mt-1">{openProposals.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(openProposals.reduce((s, p: any) => s + (p.final_value || p.estimated_value || 0), 0))}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
              <span>Ver propostas</span> <ChevronRight className="w-3 h-3" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-destructive/50 transition-colors group"
          onClick={() => setActivePanel("alerts")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas Pendentes</p>
                <p className="text-3xl font-bold mt-1">{alerts.length}</p>
                <p className="text-xs text-destructive mt-1">
                  {urgentAlerts.length} urgente(s)
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                <Bell className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
              <span>Ver todos</span> <ChevronRight className="w-3 h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Overview - clickable rows */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Panorama dos Projetos
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/projetos/kanban")}>
            <ExternalLink className="w-4 h-4 mr-1" /> Abrir Kanban
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {activeProjects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum projeto ativo.</p>
            )}
            {activeProjects.map((project) => {
              const diag = getProjectDiagnostics(project);
              return (
                <div
                  key={project.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{project.codigo || "—"}</span>
                      <span className="text-sm truncate">{project.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {diag.client?.name || project.client || "Sem cliente"} • {project.responsible || "Sem responsável"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {diag.warnings.length > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-0.5" /> {diag.warnings.length}
                      </Badge>
                    )}
                    <Badge className={`text-[10px] ${PROJECT_STATUS_COLORS[project.status]}`} variant="secondary">
                      {PROJECT_STATUS_LABELS[project.status] || project.status}
                    </Badge>
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Leads + Alerts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="cursor-pointer" onClick={() => setActivePanel("leads")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-secondary" />
              Leads Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leads.slice(0, 5).map((lead: any) => (
                <div key={lead.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.company || lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.servico || "—"}</p>
                  </div>
                  <Badge className={`text-[10px] ${LEAD_STATUS_COLORS[lead.status]}`} variant="secondary">
                    {LEAD_STATUS_LABELS[lead.status] || lead.status}
                  </Badge>
                </div>
              ))}
              {leads.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer" onClick={() => setActivePanel("alerts")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-destructive" />
              Alertas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    a.priority === "urgente" ? "bg-destructive" : a.priority === "importante" ? "bg-amber-500" : "bg-blue-500"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{a.title}</p>
                    {a.message && <p className="text-[10px] text-muted-foreground line-clamp-1">{a.message}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              ))}
              {alerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ DIAGNOSTIC PANELS ═══ */}

      {/* Projects Panel */}
      <Dialog open={activePanel === "projects"} onOpenChange={(o) => !o && setActivePanel(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5" /> Diagnóstico de Projetos
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-3">
              {projects.map((project) => {
                const diag = getProjectDiagnostics(project);
                return (
                  <div
                    key={project.id}
                    className="p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => { setActivePanel(null); setSelectedProject(project); }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{project.codigo} — {project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {diag.client?.name || project.client || "—"} • {project.responsible || "—"}
                        </p>
                      </div>
                      <Badge className={`${PROJECT_STATUS_COLORS[project.status]}`} variant="secondary">
                        {PROJECT_STATUS_LABELS[project.status]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Contrato:</span> <strong>{formatCurrency(project.contract_value || 0)}</strong></div>
                      <div><span className="text-muted-foreground">Medido:</span> <strong>{formatCurrency(diag.totalMedido)}</strong></div>
                      <div><span className="text-muted-foreground">Despesas:</span> <strong>{formatCurrency(diag.totalDespesas)}</strong></div>
                    </div>
                    {diag.warnings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {diag.warnings.map((w, i) => (
                          <Badge key={i} variant="destructive" className="text-[10px]">{w}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Leads Panel */}
      <Dialog open={activePanel === "leads"} onOpenChange={(o) => !o && setActivePanel(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Diagnóstico do Funil Comercial
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {/* Funil summary */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              {Object.entries(LEAD_STATUS_LABELS).map(([key, label]) => {
                const count = leads.filter((l: any) => l.status === key).length;
                return (
                  <div key={key} className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                );
              })}
            </div>
            <Separator className="mb-4" />
            <div className="space-y-2">
              {leads.map((lead: any) => (
                <div key={lead.id} className="p-3 border rounded-lg flex items-center gap-3 hover:bg-muted/30 cursor-pointer"
                  onClick={() => { setActivePanel(null); navigate("/comercial/leads"); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.company || lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.servico || "—"} • {lead.origin || "—"}</p>
                  </div>
                  <Badge className={`text-[10px] ${LEAD_STATUS_COLORS[lead.status]}`} variant="secondary">
                    {LEAD_STATUS_LABELS[lead.status]}
                  </Badge>
                  {lead.valor && <span className="text-xs font-medium">{formatCurrency(lead.valor)}</span>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Proposals Panel */}
      <Dialog open={activePanel === "proposals"} onOpenChange={(o) => !o && setActivePanel(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> Propostas em Aberto
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-2">
              {proposals.map((p: any) => (
                <div key={p.id} className="p-3 border rounded-lg flex items-center gap-3 hover:bg-muted/30 cursor-pointer"
                  onClick={() => { setActivePanel(null); navigate("/propostas"); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.code} — {p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.client_name || "—"} • {p.service || "—"}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                  <span className="text-xs font-medium">
                    {formatCurrency(p.final_value || p.estimated_value || 0)}
                  </span>
                </div>
              ))}
              {proposals.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma proposta.</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Alerts Panel */}
      <Dialog open={activePanel === "alerts"} onOpenChange={(o) => !o && setActivePanel(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" /> Todos os Alertas Pendentes
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-2">
              {alerts.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${
                    a.priority === "urgente" ? "bg-destructive" : a.priority === "importante" ? "bg-amber-500" : "bg-blue-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.message && <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {a.recipient} • {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{a.alert_type}</Badge>
                </div>
              ))}
              {alerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum alerta pendente.</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ═══ PROJECT DETAIL PANORAMA ═══ */}
      <Dialog open={!!selectedProject} onOpenChange={(o) => !o && setSelectedProject(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {selectedProject && <ProjectPanorama project={selectedProject} clients={clients} measurements={measurements} expenseSheets={expenseSheets} alerts={alerts} leads={leads} proposals={proposals} onNavigate={(path) => { setSelectedProject(null); navigate(path); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══ Project Panorama Component ═══
function ProjectPanorama({ project, clients, measurements, expenseSheets, alerts, leads, proposals, onNavigate }: {
  project: Project;
  clients: any[];
  measurements: any[];
  expenseSheets: any[];
  alerts: any[];
  leads: any[];
  proposals: any[];
  onNavigate: (path: string) => void;
}) {
  const client = project.client_id ? clients.find((c) => c.id === project.client_id) : null;
  const projMeas = measurements.filter((m: any) => m.project_id === project.id);
  const projExp = expenseSheets.filter((e: any) => e.project_id === project.id);
  const projAlerts = alerts.filter((a: any) => a.reference_id === project.id);
  const projLead = leads.find((l: any) => l.converted_project_id === project.id);
  const projProposal = proposals.find((p: any) => p.client_id === project.client_id);

  const totalMedido = projMeas.reduce((s: number, m: any) => s + (m.valor_nf || 0), 0);
  const totalDespesas = projExp.reduce((s: number, e: any) => s + (e.total_value || 0), 0);
  const pendingMeas = projMeas.filter((m: any) => ["rascunho", "aguardando_nf"].includes(m.status));
  const pendingExp = projExp.filter((e: any) => e.status === "submetida");

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Suggestions
  const suggestions: string[] = [];
  if (!project.responsible) suggestions.push("⚠️ Definir um responsável para o projeto.");
  if (pendingMeas.length > 0) suggestions.push(`📋 ${pendingMeas.length} medição(ões) aguardando NF — agilizar emissão.`);
  if (pendingExp.length > 0) suggestions.push(`💰 ${pendingExp.length} folha(s) de despesa aguardando aprovação.`);
  if (project.contract_value && totalMedido < project.contract_value * 0.3 && project.status === "execucao")
    suggestions.push("📊 Medição baixa em relação ao contrato — verificar andamento.");
  if (project.contract_value && totalMedido > project.contract_value * 0.9)
    suggestions.push("🔴 Medição próxima do limite contratual — avaliar aditivo.");
  if (projAlerts.length > 0) suggestions.push(`🔔 ${projAlerts.length} alerta(s) pendente(s) vinculado(s) a este projeto.`);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg">
          <FolderKanban className="w-5 h-5" />
          {project.codigo} — {project.name}
          <Badge className={`ml-2 ${PROJECT_STATUS_COLORS[project.status]}`} variant="secondary">
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </DialogTitle>
      </DialogHeader>
      <ScrollArea className="max-h-[75vh] pr-4">
        <div className="space-y-5">
          {/* Client + General */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Projeto</h3>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Responsável:</span> {project.responsible || "—"}</p>
                <p><span className="text-muted-foreground">Início:</span> {project.start_date ? format(new Date(project.start_date), "dd/MM/yyyy") : "—"}</p>
                <p><span className="text-muted-foreground">Término:</span> {project.end_date ? format(new Date(project.end_date), "dd/MM/yyyy") : "—"}</p>
                <p><span className="text-muted-foreground">Faturadora:</span> {project.empresa_faturadora}</p>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Cliente</h3>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Nome:</span> {client?.name || project.client || "—"}</p>
                <p><span className="text-muted-foreground">CNPJ:</span> {client?.cnpj || project.cnpj || "—"}</p>
                <p><span className="text-muted-foreground">Contato Eng.:</span> {project.contato_engenheiro || "—"}</p>
                <p><span className="text-muted-foreground">Contato Fin.:</span> {project.contato_financeiro || "—"}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Financial Summary */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">Resumo Financeiro</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Valor Contrato</p>
                <p className="text-lg font-bold">{formatCurrency(project.contract_value || 0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Total Medido</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(totalMedido)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Despesas Campo</p>
                <p className="text-lg font-bold text-destructive">{formatCurrency(totalDespesas)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className="text-lg font-bold">{formatCurrency((project.contract_value || 0) - totalMedido)}</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {project.contract_value && project.contract_value > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Execução financeira</span>
                <span className="font-medium">{Math.min(100, Math.round((totalMedido / project.contract_value) * 100))}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    totalMedido / project.contract_value > 0.9 ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, (totalMedido / project.contract_value) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Measurements */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Medições ({projMeas.length})
            </h3>
            {projMeas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma medição registrada.</p>
            ) : (
              <div className="space-y-1">
                {projMeas.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                    <span className="font-medium">{m.codigo_bm}</span>
                    <span>{m.period_start && format(new Date(m.period_start), "dd/MM")} — {m.period_end && format(new Date(m.period_end), "dd/MM")}</span>
                    <span className="font-medium">{formatCurrency(m.valor_nf || 0)}</span>
                    <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                  </div>
                ))}
                {projMeas.length > 5 && <p className="text-[10px] text-muted-foreground">+{projMeas.length - 5} medição(ões)...</p>}
              </div>
            )}
          </div>

          {/* Origin: Lead / Proposal */}
          {(projLead || projProposal) && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Histórico Comercial</h3>
                {projLead && (
                  <div className="text-xs p-2 rounded bg-muted/50 mb-2">
                    <p><span className="text-muted-foreground">Lead de origem:</span> {projLead.company || projLead.name}</p>
                    <p><span className="text-muted-foreground">Criado em:</span> {format(new Date(projLead.created_at), "dd/MM/yyyy")}</p>
                  </div>
                )}
                {projProposal && (
                  <div className="text-xs p-2 rounded bg-muted/50">
                    <p><span className="text-muted-foreground">Proposta:</span> {projProposal.code} — {projProposal.title}</p>
                    <p><span className="text-muted-foreground">Valor:</span> {formatCurrency(projProposal.final_value || projProposal.estimated_value || 0)}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Suggestions & Alerts */}
          {suggestions.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Sugestões e Alertas
                </h3>
                <div className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <p key={i} className="text-xs p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                      {s}
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onNavigate("/projetos/kanban")}>
              <FolderKanban className="w-4 h-4 mr-1" /> Kanban
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate("/operacional/medicoes")}>
              <FileText className="w-4 h-4 mr-1" /> Medições
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate("/operacional/despesas-de-campo")}>
              <Clock className="w-4 h-4 mr-1" /> Despesas
            </Button>
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
