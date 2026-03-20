import {
  BarChart3, TrendingUp, Users, FileText, FolderKanban,
  DollarSign, Clock, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const kpis = [
  { label: "Leads Ativos", value: "47", icon: Users, change: "+12%", color: "text-primary" },
  { label: "Propostas Abertas", value: "18", icon: FileText, change: "+5%", color: "text-secondary" },
  { label: "Projetos em Andamento", value: "12", icon: FolderKanban, change: "+3", color: "text-accent" },
  { label: "Faturamento Mensal", value: "R$ 285k", icon: DollarSign, change: "+8%", color: "text-primary" },
];

const monthlyData = [
  { mes: "Out", propostas: 14, projetos: 8 },
  { mes: "Nov", propostas: 19, projetos: 11 },
  { mes: "Dez", propostas: 12, projetos: 7 },
  { mes: "Jan", propostas: 22, projetos: 14 },
  { mes: "Fev", propostas: 17, projetos: 10 },
  { mes: "Mar", propostas: 24, projetos: 15 },
];

const serviceData = [
  { name: "Levantamento Topográfico", value: 35 },
  { name: "Georreferenciamento", value: 25 },
  { name: "Locação de Obras", value: 20 },
  { name: "Cartografia", value: 12 },
  { name: "Outros", value: 8 },
];

const PIE_COLORS = [
  "hsl(199, 65%, 30%)", "hsl(174, 100%, 29%)", "hsl(78, 62%, 44%)",
  "hsl(0, 0%, 48%)", "hsl(199, 65%, 45%)",
];

const recentActivities = [
  { text: "Nova proposta enviada para Construtora Alpha", time: "há 15 min", icon: FileText },
  { text: "Projeto PRJ-0034 concluído", time: "há 1h", icon: CheckCircle2 },
  { text: "Lead qualificado: Prefeitura de Olinda", time: "há 2h", icon: TrendingUp },
  { text: "Equipe A escalada para campo amanhã", time: "há 3h", icon: Clock },
  { text: "Pagamento recebido - NF 1247", time: "há 4h", icon: DollarSign },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do sistema AG Topografia</p>
      </div>

      {/* KPIs */}
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
                    <p className="text-xs text-secondary mt-1 font-medium">{kpi.change} este mês</p>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Propostas vs Projetos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 18%, 87%)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="propostas" fill="hsl(199, 65%, 30%)" radius={[4, 4, 0, 0]} name="Propostas" />
                <Bar dataKey="projetos" fill="hsl(174, 100%, 29%)" radius={[4, 4, 0, 0]} name="Projetos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Serviços por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={serviceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {serviceData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {serviceData.map((s, idx) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-medium">{s.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivities.map((act, idx) => {
              const Icon = act.icon;
              return (
                <div key={idx} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{act.text}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{act.time}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
