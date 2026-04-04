import { useMemo, useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHome from "@/components/mobile/MobileHome";
import {
  Bell, CheckCircle2, AlertTriangle, Clock, Zap,
  Map as MapIcon, Receipt, FolderKanban,
  ChevronRight, ChevronDown, TrendingUp, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
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
  medicao_mensal: "Por medição",
  entrega_nf: "NF na entrega",
  entrega_recibo: "Recibo na entrega",
  misto: "Misto",
  sem_documento: "Sem documento",
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

const EXEC_STATUS_COLORS: Record<string, string> = {
  aguardando_campo: "hsl(160, 70%, 40%)",
  em_campo: "hsl(160, 60%, 35%)",
  campo_concluido: "hsl(160, 50%, 45%)",
  aguardando_processamento: "hsl(200, 55%, 40%)",
  em_processamento: "hsl(200, 50%, 45%)",
  revisao: "hsl(200, 45%, 50%)",
  aprovado: "hsl(200, 60%, 35%)",
  entregue: "hsl(30, 90%, 50%)",
  faturamento: "hsl(30, 80%, 45%)",
  pago: "hsl(30, 70%, 40%)",
};

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
        .eq("resolved", false)
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
        .eq("resolved", false);
      if (error) throw error;
      return data;
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").update({ alert_status: "resolvido", resolved: true, resolved_at: new Date().toISOString() } as any).eq("id", id);
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

  const aFaturarValue = useMemo(
    () =>
      projects
        .filter(
          (p) =>
            p.execution_status === "entregue" &&
            ["entrega_nf", "entrega_recibo"].includes(p.billing_type || ""),
        )
        .reduce((s, p) => s + (p.contract_value || 0), 0),
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

  const visibleColumns = useMemo(() => {
    return GROUPS.flatMap((g) => (groupToggles[g.key] ? g.columns : []));
  }, [groupToggles]);

  // Distribution chart data
  const distributionData = useMemo(() => {
    const total = kanbanProjects.length;
    if (total === 0) return [];
    return ALL_COLUMNS
      .map((col) => ({
        key: col,
        label: EXEC_STATUS_LABELS[col],
        count: (projectsByStatus[col] || []).length,
        pct: Math.round(((projectsByStatus[col] || []).length / total) * 100),
        color: EXEC_STATUS_COLORS[col],
      }))
      .filter((d) => d.count > 0);
  }, [kanbanProjects, projectsByStatus]);

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

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // ─── RENDER ───
  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Radar</h1>
        <Badge variant="outline" className="text-xs font-normal">
          {activeProjects.length} projetos ativos
        </Badge>
      </div>

      {/* ═══ SEÇÃO 1 — ALERTAS (redesenhados) ═══ */}
      <section>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Tudo em dia</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Sem alertas pendentes no momento</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">{alerts.length} alerta{alerts.length > 1 ? "s" : ""} pendente{alerts.length > 1 ? "s" : ""}</span>
            </div>
            {alerts.map((a: any) => {
              const isUrgent = a.priority === "urgente";
              const isImportant = a.priority === "importante";
              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border transition-all",
                    isUrgent && "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 shadow-sm shadow-red-100 dark:shadow-red-900/20",
                    isImportant && "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 shadow-sm shadow-amber-100 dark:shadow-amber-900/20",
                    !isUrgent && !isImportant && "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-full shrink-0 mt-0.5",
                    isUrgent && "bg-red-100 dark:bg-red-900",
                    isImportant && "bg-amber-100 dark:bg-amber-900",
                    !isUrgent && !isImportant && "bg-blue-100 dark:bg-blue-900",
                  )}>
                    {isUrgent ? (
                      <Zap className="h-4 w-4 text-red-600" />
                    ) : isImportant ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Bell className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] h-4 px-1.5",
                          isUrgent && "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200",
                          isImportant && "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200",
                          !isUrgent && !isImportant && "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200",
                        )}
                      >
                        {a.priority}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-tight mt-1">{a.message || a.title}</p>
                    {a.reference_id && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {getProjectName(a.reference_id)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {a.reference_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/projetos/kanban`)}
                      >
                        Ver <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => resolveAlert.mutate(a.id)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ SEÇÃO 2 — KPIs 2×2 (redesenhados) ═══ */}
      <section className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={<MapIcon className="h-6 w-6" />}
          label="Em campo"
          value={emCampoCount}
          subtitle="equipes alocadas"
          gradient="from-emerald-500 to-teal-600"
          iconBg="bg-emerald-100 dark:bg-emerald-900"
          iconColor="text-emerald-600 dark:text-emerald-400"
          active={kpiFilter === "em_campo"}
          onClick={() => handleKpiClick("em_campo")}
        />
        <KpiCard
          icon={<AlertTriangle className="h-6 w-6" />}
          label="Prazo crítico"
          value={prazoCriticoCount}
          subtitle="vencem em 7 dias"
          gradient="from-red-500 to-rose-600"
          iconBg="bg-red-100 dark:bg-red-900"
          iconColor="text-red-600 dark:text-red-400"
          pulse={prazoCriticoCount > 0}
          active={kpiFilter === "prazo_critico"}
          onClick={() => handleKpiClick("prazo_critico")}
        />
        <KpiCard
          icon={<Receipt className="h-6 w-6" />}
          label="A faturar"
          value={aFaturarCount}
          subtitle={aFaturarValue > 0 ? fmtBRL(aFaturarValue) : "aguardando NF/Recibo"}
          gradient="from-amber-500 to-orange-600"
          iconBg="bg-amber-100 dark:bg-amber-900"
          iconColor="text-amber-600 dark:text-amber-400"
          active={kpiFilter === "a_faturar"}
          onClick={() => handleKpiClick("a_faturar")}
        />
        <KpiCard
          icon={<FolderKanban className="h-6 w-6" />}
          label="Ativos"
          value={activeProjects.length}
          subtitle="projetos em andamento"
          gradient="from-blue-500 to-indigo-600"
          iconBg="bg-blue-100 dark:bg-blue-900"
          iconColor="text-blue-600 dark:text-blue-400"
          active={kpiFilter === "ativos"}
          onClick={() => handleKpiClick("ativos")}
        />
      </section>

      {/* ═══ SEÇÃO 2.5 — DISTRIBUIÇÃO POR STATUS (chart) ═══ */}
      {distributionData.length > 0 && (
        <section>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Distribuição por fase</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{kanbanProjects.length} projetos</Badge>
              </div>
              {/* Stacked bar */}
              <div className="h-6 rounded-full overflow-hidden flex w-full mb-3">
                {distributionData.map((d) => (
                  <div
                    key={d.key}
                    className="h-full transition-all relative group"
                    style={{ width: `${Math.max(d.pct, 2)}%`, backgroundColor: d.color }}
                    title={`${d.label}: ${d.count}`}
                  >
                    {d.pct >= 8 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                        {d.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {distributionData.map((d) => (
                  <div key={d.key} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] text-muted-foreground">{d.label}</span>
                    <span className="text-[11px] font-semibold">{d.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ═══ SEÇÃO 3 — KANBAN ═══ */}
      <section ref={kanbanRef} className="space-y-3">
        {/* Group toggles */}
        <div className="flex flex-wrap gap-2 items-center">
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
                    className="w-[230px] shrink-0 rounded-xl border bg-muted/20 shadow-sm"
                    style={{ borderTopColor: group.color, borderTopWidth: 3 }}
                  >
                    <div
                      className="px-3 py-2 flex items-center justify-between cursor-pointer"
                      onClick={() => items.length === 0 && toggleCol(col)}
                    >
                      <span className="text-xs font-semibold truncate">
                        {EXEC_STATUS_LABELS[col]}
                      </span>
                      <Badge
                        className="text-[10px] h-5 px-1.5 font-bold"
                        style={{ backgroundColor: group.color, color: "white" }}
                      >
                        {items.length}
                      </Badge>
                    </div>

                    <div className="px-1.5 pb-2 space-y-1.5 max-h-[60vh] overflow-y-auto">
                      {items.map((p) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          clientName={clientMap.get(p.client_id || "") || "—"}
                          hasAlert={alertProjectIds.has(p.id)}
                          onClick={() => navigate(`/projetos/${p.id}`)}
                          fmtBRL={fmtBRL}
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

// ─── KPI Card (redesenhado) ───
function KpiCard({
  icon, label, value, subtitle, gradient, iconBg, iconColor, pulse, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
  pulse?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden relative",
        active && "ring-2 ring-primary ring-offset-2",
      )}
      onClick={onClick}
    >
      {/* Gradient accent bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", gradient)} />
      <CardContent className="p-4 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
            <p className={cn(
              "text-4xl font-extrabold tracking-tight leading-none",
              pulse && "text-destructive",
            )}>
              {value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{subtitle}</p>
          </div>
          <div className={cn("p-2.5 rounded-xl", iconBg, iconColor, pulse && "animate-pulse")}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Project Card (redesenhado) ───
function ProjectCard({
  project, clientName, hasAlert, onClick, fmtBRL,
}: {
  project: Project;
  clientName: string;
  hasAlert: boolean;
  onClick: () => void;
  fmtBRL: (v: number) => string;
}) {
  const p = project;
  const billingLabel = BILLING_LABELS[p.billing_type] || p.billing_type;

  return (
    <div
      className={cn(
        "p-2.5 rounded-lg bg-card border shadow-sm cursor-pointer hover:shadow-md transition-all text-xs space-y-1.5",
        hasAlert && "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-[11px] text-primary truncate">{p.codigo || "—"}</span>
          {hasAlert && (
            <span className="flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute h-2 w-2 rounded-full bg-amber-400 opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] font-semibold leading-tight truncate">{p.name}</p>
      <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
        {clientName}
      </p>

      {p.delivery_deadline && (
        <DeadlineBadge
          deadline={new Date(p.delivery_deadline)}
          started_at={p.field_completed_at ? new Date(p.field_completed_at) : null}
          estimated_days={p.delivery_days_estimated}
          completed_at={p.delivered_at ? new Date(p.delivered_at) : null}
          label="Entrega"
        />
      )}

      <div className="flex flex-wrap gap-1 pt-0.5">
        {p.billing_type ? (
          <Badge variant="outline" className="text-[9px] h-4 px-1">{billingLabel}</Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-[9px] h-4 px-1">⚠ Definir faturamento</Badge>
        )}
        {p.contract_value > 0 && (
          <Badge variant="secondary" className="text-[9px] h-4 px-1 font-semibold">
            {fmtBRL(Number(p.contract_value))}
          </Badge>
        )}
      </div>
    </div>
  );
}
