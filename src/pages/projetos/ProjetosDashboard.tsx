import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects, useUpdateProject, type Project } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeFinancials as checkFinancials } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { FolderKanban, DollarSign, Clock, FileText, Bell, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCsv } from "@/lib/exportCsv";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const EXEC_STATUS_COLORS: Record<string, string> = {
  aguardando_campo: "bg-emerald-100 text-emerald-800",
  em_campo: "bg-emerald-200 text-emerald-900",
  campo_concluido: "bg-teal-100 text-teal-800",
  aguardando_processamento: "bg-blue-100 text-blue-800",
  em_processamento: "bg-blue-200 text-blue-900",
  revisao: "bg-indigo-100 text-indigo-800",
  aprovado: "bg-violet-100 text-violet-800",
  entregue: "bg-amber-100 text-amber-800",
  faturamento: "bg-orange-100 text-orange-800",
  pago: "bg-muted text-muted-foreground",
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#6366f1", "#ec4899"];

const ALL_EXEC_STATUSES = Object.keys(EXEC_STATUS_LABELS);

export default function ProjetosDashboard() {
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { role, user } = useAuth();
  const canSeeFinancials = checkFinancials(role);
  const updateProject = useUpdateProject();
  const navigate = useNavigate();

  const handleStatusChange = async (project: Project, newStatus: string) => {
    try {
      await updateProject.mutateAsync({ id: project.id, execution_status: newStatus } as any);
      await supabase.from("project_status_history").insert({
        project_id: project.id,
        from_status: project.execution_status,
        to_status: newStatus,
        modulo: "projetos",
        changed_by_id: user?.id || null,
      });
      toast.success(`${project.codigo || project.name} → ${EXEC_STATUS_LABELS[newStatus] || newStatus}`);
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

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
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const activeProjects = useMemo(
    () => projects.filter((p) => p.execution_status && p.execution_status !== "pago"),
    [projects]
  );

  const receitaContratada = useMemo(
    () => activeProjects.reduce((s, p) => s + (p.contract_value || 0), 0),
    [activeProjects]
  );

  // Aggregate measurements by project_id
  const measurementsByProject = useMemo(() => {
    const map: Record<string, { totalBruto: number; totalNF: number; totalNFAReceber: number; pendentes: number }> = {};
    measurements.forEach((m) => {
      const key = m.project_id || "sem_projeto";
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
    return measurementsByProject[p.id];
  };

  const totalMedido = useMemo(
    () => activeProjects.reduce((s, p) => {
      const m = getProjectMeasurements(p);
      return s + (m?.totalNF || 0);
    }, 0),
    [activeProjects, measurementsByProject]
  );

  const aReceber = useMemo(
    () => activeProjects.reduce((s, p) => {
      const m = getProjectMeasurements(p);
      return s + (m?.totalNFAReceber || 0);
    }, 0),
    [activeProjects, measurementsByProject]
  );

  const medicoesPendentes = useMemo(
    () => Object.values(measurementsByProject).reduce((s, v) => s + v.pendentes, 0),
    [measurementsByProject]
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
    { label: "Projetos Ativos", value: activeProjects.length, icon: FolderKanban, color: "text-primary", financial: false },
    { label: "Receita Contratada", value: formatCurrency(receitaContratada), icon: DollarSign, color: "text-emerald-600", financial: true },
    { label: "A Receber", value: formatCurrency(aReceber), icon: Clock, color: "text-amber-600", financial: true },
    { label: "Medições Pendentes", value: medicoesPendentes, icon: FileText, color: "text-blue-600", financial: true },
  ].filter((kpi) => !kpi.financial || canSeeFinancials);

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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Projetos</CardTitle>
          <Button variant="outline" size="sm" onClick={() => {
            const rows = projects.map((p: any) => {
              const cl = clients.find((c: any) => c.id === p.client_id);
              return [p.codigo || "", p.name, cl?.name || p.client || "", p.service || "", EXEC_STATUS_LABELS[p.execution_status || ""] || p.execution_status || "", p.contract_value ? String(p.contract_value) : "", p.billing_type || ""];
            });
            exportCsv(["Código", "Nome", "Cliente", "Serviço", "Status Execução", "Valor Contrato", "Tipo Faturamento"], rows, "projetos.csv");
            toast.success(`${rows.length} projetos exportados`);
          }}><Download className="w-4 h-4 mr-1" /> Exportar</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Status</TableHead>
                {canSeeFinancials && <TableHead className="text-right">Valor Contrato</TableHead>}
                {canSeeFinancials && <TableHead className="text-right">Total Medido</TableHead>}
                {canSeeFinancials && <TableHead className="text-right">A Receber</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const m = getProjectMeasurements(p);
                const medido = m?.totalNF || 0;
                const aReceberRow = m?.totalNFAReceber || 0;
                const contrato = p.contract_value || 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <button onClick={() => navigate(`/projetos/${p.id}`)} className="font-mono text-xs font-bold text-primary hover:underline">
                        {p.codigo || "—"}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {(() => {
                        if (p.client_id) {
                          const cl = clients.find((c) => c.id === p.client_id);
                          if (cl) return cl.name;
                        }
                        return p.client || p.client_name || <Badge className="bg-amber-100 text-amber-800 text-[10px]">Não vinculado</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>{p.service || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={p.execution_status || ""}
                        onValueChange={(v) => handleStatusChange(p, v)}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-[10px] border-0 bg-transparent p-0">
                          <Badge className={EXEC_STATUS_COLORS[p.execution_status || ""] || "bg-muted text-muted-foreground"} variant="secondary">
                            {EXEC_STATUS_LABELS[p.execution_status || ""] || p.execution_status || "—"}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_EXEC_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{EXEC_STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {canSeeFinancials && <TableCell className="text-right">{contrato ? formatCurrency(contrato) : "—"}</TableCell>}
                    {canSeeFinancials && <TableCell className="text-right">{medido ? formatCurrency(medido) : "—"}</TableCell>}
                    {canSeeFinancials && <TableCell className="text-right">{aReceberRow ? formatCurrency(aReceberRow) : "—"}</TableCell>}
                  </TableRow>
                );
              })}
              {!projects.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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

        {canSeeFinancials && <Card>
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
        </Card>}

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
