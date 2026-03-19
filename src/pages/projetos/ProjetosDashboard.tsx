import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useProjects, type Project, type ProjectStatus } from "@/hooks/useProjects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { FolderKanban, DollarSign, Clock, FileText, Bell } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planejamento: "Planejamento",
  execucao: "Execução",
  entrega: "Entrega",
  faturamento: "Faturamento",
  concluido: "Concluído",
  pausado: "Pausado",
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planejamento: "bg-blue-100 text-blue-800",
  execucao: "bg-amber-100 text-amber-800",
  entrega: "bg-purple-100 text-purple-800",
  faturamento: "bg-emerald-100 text-emerald-800",
  concluido: "bg-muted text-muted-foreground",
  pausado: "bg-rose-100 text-rose-800",
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#6366f1", "#ec4899"];

export default function ProjetosDashboard() {
  const { data: projects = [] } = useProjects();

  const { data: measurements = [] } = useQuery({
    queryKey: ["all-measurements-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("measurements").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["project-alerts-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-for-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, name, client");
      if (error) throw error;
      return data;
    },
  });

  const activeProjects = useMemo(
    () => projects.filter((p) => !["concluido", "pausado"].includes(p.status)),
    [projects]
  );

  const receitaContratada = useMemo(
    () => activeProjects.reduce((s, p) => s + (p.contract_value || 0), 0),
    [activeProjects]
  );

  const measurementsByObra = useMemo(() => {
    const map: Record<string, { totalBruto: number; totalNF: number; totalNFAReceber: number; pendentes: number }> = {};
    measurements.forEach((m) => {
      const key = m.obra_id || "sem_obra";
      if (!map[key]) map[key] = { totalBruto: 0, totalNF: 0, totalNFAReceber: 0, pendentes: 0 };
      map[key].totalBruto += m.valor_bruto || 0;
      map[key].totalNF += m.valor_nf || 0;
      if (["aguardando_nf", "nf_emitida"].includes(m.status)) {
        map[key].totalNFAReceber += m.valor_nf || 0;
      }
      if (["rascunho", "aguardando_nf"].includes(m.status)) map[key].pendentes += 1;
    });
    return map;
  }, [measurements]);

  const getProjectMeasurements = (p: Project) => {
    if (!p.obra_id) return undefined;
    return measurementsByObra[p.obra_id];
  };

  const totalMedido = useMemo(
    () => Object.values(measurementsByObra).reduce((s, v) => s + v.totalNF, 0),
    [measurementsByObra]
  );

  const aReceber = receitaContratada - totalMedido;

  const medicoesPendentes = useMemo(
    () => Object.values(measurementsByObra).reduce((s, v) => s + v.pendentes, 0),
    [measurementsByObra]
  );

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
      return {
        mes: format(date, "MMM/yy", { locale: ptBR }),
        valor: total,
      };
    });
  }, [measurements]);

  // Pie chart: por tipo de serviço
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    activeProjects.forEach((p) => {
      const key = p.service || "Não informado";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [activeProjects]);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpis = [
    { label: "Projetos Ativos", value: activeProjects.length, icon: FolderKanban, color: "text-primary" },
    { label: "Receita Contratada", value: formatCurrency(receitaContratada), icon: DollarSign, color: "text-emerald-600" },
    { label: "A Receber", value: formatCurrency(Math.max(aReceber, 0)), icon: Clock, color: "text-amber-600" },
    { label: "Medições Pendentes", value: medicoesPendentes, icon: FileText, color: "text-blue-600" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`p-3 rounded-lg bg-muted ${kpi.color}`}>
                <kpi.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de Projetos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Projetos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor Contrato</TableHead>
                <TableHead className="text-right">Total Medido</TableHead>
                <TableHead className="text-right">A Receber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const m = getProjectMeasurements(p);
                const medido = m?.totalNF || 0;
                const contrato = p.contract_value || 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.client || "—"}</TableCell>
                    <TableCell>{p.service || "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status]} variant="secondary">
                        {STATUS_LABELS[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{contrato ? formatCurrency(contrato) : "—"}</TableCell>
                    <TableCell className="text-right">{medido ? formatCurrency(medido) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {contrato ? formatCurrency(Math.max(contrato - medido, 0)) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!projects.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum projeto cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Alertas + Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta pendente.</p>
            )}
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    a.priority === "urgente" ? "bg-red-500" : a.priority === "importante" ? "bg-amber-500" : "bg-blue-500"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {a.message && <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* BarChart faturamento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Faturamento (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* PieChart por serviço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Tipo de Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
