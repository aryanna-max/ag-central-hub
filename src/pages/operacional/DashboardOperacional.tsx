import { useMemo } from "react";
import { Users, Car, CalendarDays, AlertTriangle, MapPin, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEmployeesWithAbsences } from "@/hooks/useEmployees";
import { useTeams } from "@/hooks/useTeams";
import { useVehicles } from "@/hooks/useVehicles";
import { useUnallocatedProjects } from "@/hooks/useMonthlySchedules";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const PIE_COLORS = [
  "hsl(174, 100%, 29%)",
  "hsl(199, 65%, 30%)",
  "hsl(78, 62%, 44%)",
  "hsl(0, 84%, 60%)",
  "hsl(0, 0%, 48%)",
];

function useObras() {
  return useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });
}

export default function DashboardOperacional() {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const { data: employees } = useEmployeesWithAbsences(today);
  const { data: teams } = useTeams();
  const { data: vehicles } = useVehicles();
  const { data: obras } = useObras();
  const { data: unallocatedProjects } = useUnallocatedProjects(currentMonth, currentYear);
  const stats = useMemo(() => {
    const emps = employees || [];
    const disponivel = emps.filter((e) => e.availability === "disponivel").length;
    const emObra = emps.filter((e) => e.availability === "em_obra").length;
    const ferias = emps.filter((e) => e.availability === "ferias").length;
    const licenca = emps.filter((e) => e.availability === "licenca").length;
    const afastado = emps.filter((e) => e.availability === "afastado").length;
    const veiculosUso = (vehicles || []).filter((v) => v.status === "em_uso").length;
    const veiculosDisp = (vehicles || []).filter((v) => v.status === "disponivel").length;
    const veiculosManut = (vehicles || []).filter((v) => v.status === "manutencao").length;
    const activeTeams = (teams || []).filter((t: any) => t.is_active).length;
    return { disponivel, emObra, ferias, licenca, afastado, veiculosUso, veiculosDisp, veiculosManut, activeTeams, totalEmps: emps.length };
  }, [employees, vehicles, teams]);

  const empStatusData = [
    { name: "Disponível", value: stats.disponivel },
    { name: "Em Obra", value: stats.emObra },
    { name: "Férias", value: stats.ferias },
    { name: "Licença/Afastado", value: stats.licenca + stats.afastado },
  ].filter((d) => d.value > 0);

  const vehicleData = [
    { name: "Em Uso", value: stats.veiculosUso },
    { name: "Disponível", value: stats.veiculosDisp },
    { name: "Manutenção", value: stats.veiculosManut },
  ].filter((d) => d.value > 0);

  const kpis = [
    { label: "Equipes Ativas", value: stats.activeTeams, icon: Users, color: "text-primary" },
    { label: "Funcionários", value: stats.totalEmps, icon: Briefcase, color: "text-secondary" },
    { label: "Veículos em Uso", value: stats.veiculosUso, icon: Car, color: "text-accent" },
    { label: "Ausências Hoje", value: stats.ferias + stats.licenca + stats.afastado, icon: AlertTriangle, color: "text-destructive" },
  ];

  const absentToday = (employees || []).filter(
    (e) => e.availability === "ferias" || e.availability === "licenca" || e.availability === "afastado"
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <CalendarDays className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Operacional</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
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
                    <p className="text-3xl font-bold mt-1">{kpi.value}</p>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Disponibilidade de Funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={empStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={2}>
                  {empStatusData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {empStatusData.map((s, idx) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
                  <span className="text-muted-foreground">{s.name}: <strong>{s.value}</strong></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status da Frota</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vehicleData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 18%, 87%)" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(199, 65%, 30%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Absences & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Ausências Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {absentToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ausência registrada hoje.</p>
            ) : (
              <div className="space-y-2">
                {absentToday.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-sm font-medium">{emp.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {emp.availability === "ferias" ? "🏖️ Férias" : emp.availability === "licenca" ? "📋 Licença" : "⚠️ Afastado"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-secondary" />
              Projetos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(obras || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum projeto ativo.</p>
            ) : (
              <div className="space-y-2">
                {(obras || []).map((obra) => (
                  <div key={obra.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{obra.name}</p>
                      <p className="text-xs text-muted-foreground">{obra.client} • {obra.location || "—"}</p>
                    </div>
                    <Badge className="bg-secondary text-secondary-foreground text-xs">Ativo</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
