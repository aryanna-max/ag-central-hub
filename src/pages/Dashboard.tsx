import { useMemo } from "react";
import {
  BarChart3, Users, FileText, FolderKanban,
  DollarSign, Car, Clock, Bell, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useEmployees } from "@/hooks/useEmployees";
import { useVehicles } from "@/hooks/useVehicles";
import { isFieldRole } from "@/lib/fieldRoles";
import { format, subMonths, startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(var(--secondary))", "#f59e0b",
  "#8b5cf6", "#10b981", "#ef4444",
];

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-muted text-muted-foreground",
  qualificado: "bg-blue-100 text-blue-800",
  proposta_enviada: "bg-amber-100 text-amber-800",
  aprovado: "bg-emerald-100 text-emerald-800",
  convertido: "bg-green-200 text-green-900",
  perdido: "bg-rose-100 text-rose-800",
};

export default function Dashboard() {
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  const { data: vehicles = [] } = useVehicles();

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
      const { data, error } = await supabase.from("proposals").select("*");
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
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts").select("*").eq("read", false)
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
  });

  // KPIs
  const activeLeads = useMemo(() => leads.filter((l) => !["convertido", "perdido"].includes(l.status)), [leads]);
  const openProposals = useMemo(() => proposals.filter((p) => !["aprovada", "rejeitada"].includes(p.status)), [proposals]);
  const activeProjects = useMemo(() => projects.filter((p) => !["concluido", "pausado"].includes(p.status)), [projects]);
  const fieldEmployees = useMemo(() => employees.filter((e) => e.status !== "desligado" && isFieldRole(e.role)), [employees]);
  const availableVehicles = useMemo(() => vehicles.filter((v) => v.status === "disponivel"), [vehicles]);

  const receitaContratada = useMemo(
    () => activeProjects.reduce((s, p) => s + (p.contract_value || 0), 0), [activeProjects]
  );

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const kpis = [
    { label: "Leads Ativos", value: activeLeads.length, icon: Users, color: "text-primary" },
    { label: "Propostas Abertas", value: openProposals.length, icon: FileText, color: "text-secondary" },
    { label: "Projetos em Andamento", value: activeProjects.length, icon: FolderKanban, color: "text-accent" },
    { label: "Receita Contratada", value: formatCurrency(receitaContratada), icon: DollarSign, color: "text-primary" },
  ];

  const secondaryKpis = [
    { label: "Funcionários Campo", value: fieldEmployees.length, icon: Users },
    { label: "Veículos Disponíveis", value: `${availableVehicles.length}/${vehicles.length}`, icon: Car },
    { label: "Clientes Ativos", value: clients.filter((c) => c.is_active).length, icon: TrendingUp },
    { label: "Medições Pendentes", value: measurements.filter((m) => ["rascunho", "aguardando_nf"].includes(m.status)).length, icon: Clock },
  ];

  // Bar chart: faturamento últimos 6 meses
  const barData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(now, 5 - i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const total = measurements
        .filter((m) => {
          if (!m.nf_data) return false;
          const d = new Date(m.nf_data);
          return d >= start && d <= end && m.status !== "cancelado";
        })
        .reduce((s, m) => s + (m.valor_nf || 0), 0);
      return { mes: format(date, "MMM/yy", { locale: ptBR }), valor: total };
    });
  }, [measurements]);

  // Pie chart: projetos ativos por serviço
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    activeProjects.forEach((p) => {
      const key = p.service || "Não informado";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [activeProjects]);

  // Recent leads
  const recentLeads = useMemo(() => leads.slice(0, 5), [leads]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do sistema AG Topografia</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg bg-muted ${kpi.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {secondaryKpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Faturamento (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Faturamento" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta pendente.</p>
            )}
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  a.priority === "urgente" ? "bg-destructive" : a.priority === "importante" ? "bg-amber-500" : "bg-blue-500"
                }`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{a.title}</p>
                  {a.message && <p className="text-[10px] text-muted-foreground line-clamp-1">{a.message}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Pie + Leads recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Projetos por Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {pieData.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground truncate">{s.name}</span>
                      </div>
                      <span className="font-medium">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLeads.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead cadastrado.</p>
              )}
              {recentLeads.map((lead) => {
                const clientName = lead.client_id
                  ? clients.find((c) => c.id === lead.client_id)?.name
                  : null;
                const displayName = clientName || lead.company || lead.name;
                return (
                  <div key={lead.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.servico || "—"}</p>
                    </div>
                    <Badge className={`text-[10px] ${STATUS_COLORS[lead.status] || ""}`} variant="secondary">
                      {lead.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
