import { useMemo, useState, useRef } from "react";
import {
  Bell, CheckCircle2, AlertTriangle, Clock,
  Map as MapIcon, Receipt, FolderKanban, Filter,
  ChevronRight, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useAlerts } from "@/hooks/useAlerts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import DeadlineBadge from "@/components/DeadlineBadge";
import { cn } from "@/lib/utils";

// ─── Execution status labels & colors ───
const EXEC_STATUS_LABELS: Record<string, string> = {
  aguardando_campo: "Aguardando campo",
  em_campo: "Em campo",
  campo_concluido: "Campo concluído",
  aguardando_processamento: "Aguardando proc.",
  em_processamento: "Em processamento",
  revisao: "Em revisão",
  aprovado: "Aprovado",
  entregue: "Entregue",
  faturamento: "Faturamento",
  pago: "Pago",
};

const BILLING_LABELS: Record<string, string> = {
  medicao_mensal: "Medição mensal",
  entrega_nf: "NF na entrega",
  entrega_recibo: "Recibo na entrega",
  misto: "Misto",
};

// ─── Kanban groups ───
const GROUPS = [
  {
    key: "campo", label: "🏕️ Campo", color: "#1A9E7C",
    columns: ["aguardando_campo", "em_campo", "campo_concluido"],
  },
  {
    key: "prancheta", label: "📐 Prancheta", color: "#2D6E8E",
    columns: ["aguardando_processamento", "em_processamento", "revisao", "aprovado"],
  },
  {
    key: "financeiro", label: "💰 Financeiro", color: "#f97316",
    columns: ["entregue", "faturamento", "pago"],
  },
];

const ALL_COLUMNS = GROUPS.flatMap((g) => g.columns);

type KpiFilter = "em_campo" | "prazo_critico" | "a_faturar" | "ativos" | null;

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const kanbanRef = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();

  // Alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ["radar-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("alert_status", "ativo")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: allActiveAlerts = [] } = useQuery({
    queryKey: ["radar-alerts-project-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("reference_id")
        .eq("alert_status", "ativo");
      if (error) throw error;
      return data;
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").update({ alert_status: "resolvido" } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["radar-alerts"] });
      qc.invalidateQueries({ queryKey: ["radar-alerts-project-ids"] });
    },
  });

  const alertProjectIds = useMemo(
    () => new Set(allActiveAlerts.map((a: any) => a.reference_id).filter(Boolean)),
    [allActiveAlerts],
  );

  // Client lookup
  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clients]);

  // ─── KPIs ───
  const activeProjects = useMemo(
    () => projects.filter((p) => p.execution_status !== "pago"),
    [projects],
  );

  const emCampoCount = useMemo(
    () => projects.filter((p) => p.execution_status === "em_campo").length,
    [projects],
  );

  const prazoCriticoCount = useMemo(() => {
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    return projects.filter((p) => {
      const es = p.execution_status;
      if (["entregue", "faturamento", "pago"].includes(es)) return false;
      const dd = p.delivery_deadline;
      if (!dd) return false;
      return new Date(dd) <= limit;
    }).length;
  }, [projects]);

  const aFaturarCount = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.execution_status === "entregue" &&
          ["entrega_nf", "entrega_recibo"].includes(p.billing_type || ""),
      ).length,
    [projects],
  );

  // ─── Kanban state ───
  const [groupToggles, setGroupToggles] = useState<Record<string, boolean>>({
    campo: true,
    prancheta: true,
    financeiro: true,
  });
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all");
  const [prazoFilter, setPrazoFilter] = useState<string>("all");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>(null);

  const toggleGroup = (key: string) =>
    setGroupToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleCol = (col: string) =>
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });

  // Filter projects for kanban
  const kanbanProjects = useMemo(() => {
    return projects.filter((p) => {
      const es = p.execution_status;
      if (!es || !ALL_COLUMNS.includes(es)) return false;

      // KPI filter
      if (kpiFilter === "em_campo" && es !== "em_campo") return false;
      if (kpiFilter === "a_faturar") {
        if (es !== "entregue") return false;
        if (!["entrega_nf", "entrega_recibo"].includes(p.billing_type || "")) return false;
      }
      if (kpiFilter === "prazo_critico") {
        if (["entregue", "faturamento", "pago"].includes(es)) return false;
        const dd = p.delivery_deadline;
        if (!dd) return false;
        const limit = new Date();
        limit.setDate(limit.getDate() + 7);
        if (new Date(dd) > limit) return false;
      }
      if (kpiFilter === "ativos" && es === "pago") return false;

      if (clientFilter !== "all" && p.client_id !== clientFilter) return false;
      if (billingFilter !== "all" && p.billing_type !== billingFilter) return false;

      if (prazoFilter === "vencido") {
        const dd = p.delivery_deadline;
        if (!dd || new Date(dd) >= new Date()) return false;
      } else if (prazoFilter === "critico") {
        const dd = p.delivery_deadline;
        if (!dd) return false;
        const limit = new Date();
        limit.setDate(limit.getDate() + 7);
        if (new Date(dd) > limit || new Date(dd) < new Date()) return false;
      } else if (prazoFilter === "sem_prazo") {
        if (p.delivery_deadline) return false;
      }

      return true;
    });
  }, [projects, kpiFilter, clientFilter, billingFilter, prazoFilter]);

  const projectsByStatus = useMemo(() => {
    const map: Record<string, Project[]> = {};
    ALL_COLUMNS.forEach((c) => (map[c] = []));
    kanbanProjects.forEach((p) => {
      const es = p.execution_status;
      if (map[es]) map[es].push(p);
    });
    return map;
  }, [kanbanProjects]);

  // Visible columns
  const visibleColumns = useMemo(() => {
    return GROUPS.flatMap((g) => (groupToggles[g.key] ? g.columns : []));
  }, [groupToggles]);

  // Unique clients for filter
  const clientOptions = useMemo(() => {
    const ids = new Set(projects.map((p) => p.client_id).filter(Boolean));
    return Array.from(ids)
      .map((id) => ({ id: id!, name: clientMap.get(id!) || "—" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, clientMap]);

  const handleKpiClick = (filter: KpiFilter) => {
    setKpiFilter((prev) => (prev === filter ? null : filter));
    kanbanRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getProjectName = (refId: string | null) => {
    if (!refId) return "";
    const p = projects.find((pr) => pr.id === refId);
    return p ? `${p.codigo || ""} ${p.name}` : "";
  };

  // ─── RENDER ───
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-bold">Radar</h1>

      {/* ═══ SEÇÃO 1 — ALERTAS ═══ */}
      <section>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Sem alertas pendentes</span>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a: any) => {
              const borderColor =
                a.priority === "urgente"
                  ? "border-l-red-500"
                  : a.priority === "importante"
                    ? "border-l-orange-500"
                    : "border-l-blue-500";
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border border-l-4 bg-card",
                    borderColor,
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{a.message || a.title}</p>
                    {a.reference_id && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {getProjectName(a.reference_id)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {a.reference_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/projetos/kanban`)}
                      >
                        Ver
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => resolveAlert.mutate(a.id)}
                    >
                      ✓
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              variant="link"
              className="text-xs p-0 h-auto"
              onClick={() => navigate("/projetos/kanban")}
            >
              Ver todos os alertas →
            </Button>
          </div>
        )}
      </section>

      {/* ═══ SEÇÃO 2 — KPIs 2×2 ═══ */}
      <section className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={<MapIcon className="h-5 w-5 text-[hsl(var(--primary))]" />}
          label="Em campo"
          value={emCampoCount}
          subtitle="projetos com equipe no campo"
          active={kpiFilter === "em_campo"}
          onClick={() => handleKpiClick("em_campo")}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Prazo crítico"
          value={prazoCriticoCount}
          subtitle="entregas nos próximos 7 dias"
          danger={prazoCriticoCount > 0}
          active={kpiFilter === "prazo_critico"}
          onClick={() => handleKpiClick("prazo_critico")}
        />
        <KpiCard
          icon={<Receipt className="h-5 w-5" />}
          label="A faturar"
          value={aFaturarCount}
          subtitle="aguardando emissão de documento"
          warning={aFaturarCount > 0}
          active={kpiFilter === "a_faturar"}
          onClick={() => handleKpiClick("a_faturar")}
        />
        <KpiCard
          icon={<FolderKanban className="h-5 w-5 text-[hsl(var(--primary))]" />}
          label="Ativos"
          value={activeProjects.length}
          subtitle="projetos em andamento"
          active={kpiFilter === "ativos"}
          onClick={() => handleKpiClick("ativos")}
        />
      </section>

      {/* ═══ SEÇÃO 3 — KANBAN ═══ */}
      <section ref={kanbanRef} className="space-y-3">
        {/* Group toggles */}
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <Button
              key={g.key}
              size="sm"
              variant={groupToggles[g.key] ? "default" : "outline"}
              className="text-xs"
              onClick={() => toggleGroup(g.key)}
            >
              {g.label} {groupToggles[g.key] ? "✓" : ""}
            </Button>
          ))}
          {kpiFilter && (
            <Button size="sm" variant="destructive" className="text-xs" onClick={() => setKpiFilter(null)}>
              Limpar filtro
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={prazoFilter} onValueChange={setPrazoFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Prazo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos prazos</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="sem_prazo">Sem prazo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={billingFilter} onValueChange={setBillingFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Faturamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {Object.entries(BILLING_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban board */}
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            {GROUPS.map((group) => {
              if (!groupToggles[group.key]) return null;
              return group.columns.map((col) => {
                const items = projectsByStatus[col] || [];
                const isCollapsed = collapsedCols.has(col) && items.length === 0;

                if (isCollapsed) {
                  return (
                    <div
                      key={col}
                      className="w-8 shrink-0 rounded-lg border cursor-pointer flex flex-col items-center justify-center py-4 hover:bg-muted/50 transition-colors"
                      style={{ borderTopColor: group.color, borderTopWidth: 3 }}
                      onClick={() => toggleCol(col)}
                    >
                      <span
                        className="text-[10px] text-muted-foreground font-medium"
                        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                      >
                        {EXEC_STATUS_LABELS[col]} ({items.length})
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={col}
                    className="w-[220px] shrink-0 rounded-lg border bg-muted/30"
                    style={{ borderTopColor: group.color, borderTopWidth: 3 }}
                  >
                    <div
                      className="px-2 py-1.5 flex items-center justify-between cursor-pointer"
                      onClick={() => items.length === 0 && toggleCol(col)}
                    >
                      <span className="text-xs font-semibold truncate">
                        {EXEC_STATUS_LABELS[col]}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {items.length}
                      </Badge>
                    </div>

                    <div className="px-1.5 pb-1.5 space-y-1.5 max-h-[60vh] overflow-y-auto">
                      {items.map((p) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          clientName={clientMap.get(p.client_id || "") || "—"}
                          hasAlert={alertProjectIds.has(p.id)}
                          onClick={() => navigate(`/projetos/kanban`)}
                        />
                      ))}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── KPI Card ───
function KpiCard({
  icon, label, value, subtitle, danger, warning, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle: string;
  danger?: boolean;
  warning?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        active && "ring-2 ring-primary",
        danger && value > 0 && "border-red-300 bg-red-50",
        warning && value > 0 && !danger && "border-orange-300 bg-orange-50",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <p className={cn("text-3xl font-bold", danger && value > 0 && "text-red-600", warning && value > 0 && !danger && "text-orange-600")}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ─── Project Card ───
function ProjectCard({
  project, clientName, hasAlert, onClick,
}: {
  project: Project;
  clientName: string;
  hasAlert: boolean;
  onClick: () => void;
}) {
  const p = project;
  const billingLabel = BILLING_LABELS[p.billing_type] || p.billing_type;

  return (
    <div
      className="p-2 rounded-md bg-card border shadow-sm cursor-pointer hover:shadow-md transition-shadow text-xs space-y-1"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-bold text-[11px] text-primary truncate">{p.codigo || "—"}</span>
        {hasAlert && <span className="text-sm shrink-0">🔔</span>}
      </div>
      <p className="text-[11px] font-medium leading-tight truncate">{p.name}</p>
      <p className="text-[10px] text-muted-foreground truncate">{clientName}</p>

      {p.delivery_deadline && (
        <DeadlineBadge
          deadline={new Date(p.delivery_deadline)}
          started_at={p.field_completed_at ? new Date(p.field_completed_at) : null}
          estimated_days={p.delivery_days_estimated}
          completed_at={p.delivered_at ? new Date(p.delivered_at) : null}
          label="Entrega"
        />
      )}

      <div className="flex flex-wrap gap-1 mt-1">
        {p.billing_type && (
          <Badge variant="outline" className="text-[9px] h-4 px-1">{billingLabel}</Badge>
        )}
        {p.contract_value > 0 && (
          <Badge variant="secondary" className="text-[9px] h-4 px-1">
            {Number(p.contract_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
          </Badge>
        )}
      </div>
    </div>
  );
}
