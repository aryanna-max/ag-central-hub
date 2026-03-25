import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  month: number;
  year: number;
  schedules: any[];
}

export default function MonthlyScheduleReport({ month, year, schedules }: Props) {
  const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR }).toUpperCase();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

  const { data: dailyData } = useQuery({
    queryKey: ["monthly-report-daily", month, year],
    queryFn: async () => {
      const { data: dailySchedules, error } = await supabase
        .from("daily_schedules")
        .select("id, schedule_date, is_closed")
        .gte("schedule_date", startDate)
        .lte("schedule_date", endDate);
      if (error) throw error;
      if (!dailySchedules?.length) return { assignments: [], entries: [] };

      const ids = dailySchedules.map(d => d.id);

      const { data: assignments } = await supabase
        .from("daily_team_assignments")
        .select("*, teams(name), projects:project_id(name, client), vehicles(model, plate)")
        .in("daily_schedule_id", ids);

      const { data: entries } = await supabase
        .from("daily_schedule_entries")
        .select("*, employees(name, role), daily_schedules!daily_schedule_entries_daily_schedule_id_fkey(schedule_date)")
        .in("daily_schedule_id", ids);

      return {
        dailySchedules,
        assignments: assignments || [],
        entries: entries || [],
      };
    },
  });

  const getProjectName = (s: any) => s.projects?.name || "—";
  const getProjectClient = (s: any) => s.projects?.client || "";
  const getProjectId = (s: any) => s.project_id || "";

  // --- Resumo por Equipe ---
  const teamMap = new Map<string, { name: string; days: Set<string>; projects: Set<string>; vehicles: Set<string> }>();
  for (const s of schedules) {
    const teamName = s.teams?.name || "—";
    const entry = teamMap.get(s.team_id) || { name: teamName, days: new Set(), projects: new Set(), vehicles: new Set() };
    const start = new Date(s.start_date + "T12:00:00");
    const end = new Date(s.end_date + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (s.schedule_type === "mensal" && (dow === 0 || dow === 6)) continue;
      entry.days.add(d.toISOString().slice(0, 10));
    }
    const pName = getProjectName(s);
    if (pName !== "—") entry.projects.add(pName);
    if (s.vehicles) entry.vehicles.add(`${s.vehicles.model} (${s.vehicles.plate})`);
    teamMap.set(s.team_id, entry);
  }

  // --- Resumo por Projeto ---
  const projectMap = new Map<string, { name: string; client: string; teams: Set<string>; days: number }>();
  for (const s of schedules) {
    const pid = getProjectId(s);
    const proj = projectMap.get(pid) || { name: getProjectName(s), client: getProjectClient(s), teams: new Set(), days: 0 };
    proj.teams.add(s.teams?.name || "—");
    const start = new Date(s.start_date + "T12:00:00");
    const end = new Date(s.end_date + "T12:00:00");
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (s.schedule_type === "mensal" && (dow === 0 || dow === 6)) continue;
      count++;
    }
    proj.days += count;
    projectMap.set(pid, proj);
  }

  // --- Resumo por Funcionário ---
  const employeeMap = new Map<string, { name: string; role: string; daysWorked: number; absences: number; projects: Set<string>; late: number }>();
  if (dailyData?.entries) {
    for (const e of dailyData.entries) {
      const emp = employeeMap.get(e.employee_id) || {
        name: e.employees?.name || "—",
        role: e.employees?.role || "",
        daysWorked: 0,
        absences: 0,
        projects: new Set(),
        late: 0,
      };
      if (e.attendance === "presente" || e.attendance === "atrasado") emp.daysWorked++;
      if (e.attendance === "falta") emp.absences++;
      if (e.attendance === "atrasado") emp.late++;
      if (e.project_id) {
        const projId = e.project_id;
        const assignment = dailyData.assignments?.find((a: any) => a.project_id === projId);
        if (assignment?.projects?.name) emp.projects.add(assignment.projects.name);
      }
      employeeMap.set(e.employee_id, emp);
    }
  }

  // --- Resumo de Veículos ---
  const vehicleMap = new Map<string, { desc: string; daysUsed: Set<string>; teams: Set<string>; projects: Set<string> }>();
  for (const s of schedules) {
    if (!s.vehicle_id || !s.vehicles) continue;
    const v = vehicleMap.get(s.vehicle_id) || {
      desc: `${s.vehicles.model} — ${s.vehicles.plate}`,
      daysUsed: new Set(),
      teams: new Set(),
      projects: new Set(),
    };
    v.teams.add(s.teams?.name || "—");
    const pName = getProjectName(s);
    if (pName !== "—") v.projects.add(pName);
    const start = new Date(s.start_date + "T12:00:00");
    const end = new Date(s.end_date + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (s.schedule_type === "mensal" && (dow === 0 || dow === 6)) continue;
      v.daysUsed.add(d.toISOString().slice(0, 10));
    }
    vehicleMap.set(s.vehicle_id, v);
  }

  return (
    <div className="space-y-6 print:p-4" id="monthly-report">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">RELATÓRIO MENSAL — {monthName}</h1>
      </div>

      {/* Resumo por Equipe */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo por Equipe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipe</TableHead>
                <TableHead>Dias Trabalhados</TableHead>
                <TableHead>Projetos</TableHead>
                <TableHead>Veículos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(teamMap.entries()).map(([id, t]) => (
                <TableRow key={id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.days.size}</TableCell>
                  <TableCell>{Array.from(t.projects).join(", ")}</TableCell>
                  <TableCell className="text-sm">{Array.from(t.vehicles).join(", ") || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo por Projeto */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo por Projeto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Equipes Alocadas</TableHead>
                <TableHead>Total Dias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(projectMap.entries()).map(([id, p]) => (
                <TableRow key={id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.client || "—"}</TableCell>
                  <TableCell>{Array.from(p.teams).join(", ")}</TableCell>
                  <TableCell>{p.days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo por Funcionário */}
      {employeeMap.size > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumo por Funcionário</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Dias Trabalhados</TableHead>
                  <TableHead>Faltas</TableHead>
                  <TableHead>Atrasos</TableHead>
                  <TableHead>Projetos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(employeeMap.entries())
                  .sort((a, b) => a[1].name.localeCompare(b[1].name))
                  .map(([id, e]) => (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-sm">{e.role}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{e.daysWorked}</Badge>
                      </TableCell>
                      <TableCell>
                        {e.absences > 0 ? <Badge variant="destructive">{e.absences}</Badge> : "0"}
                      </TableCell>
                      <TableCell>
                        {e.late > 0 ? <Badge className="bg-amber-500">{e.late}</Badge> : "0"}
                      </TableCell>
                      <TableCell className="text-sm">{Array.from(e.projects).join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Resumo de Veículos */}
      {vehicleMap.size > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumo de Veículos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Dias em Uso</TableHead>
                  <TableHead>Equipes</TableHead>
                  <TableHead>Projetos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(vehicleMap.entries()).map(([id, v]) => (
                  <TableRow key={id}>
                    <TableCell className="font-medium">{v.desc}</TableCell>
                    <TableCell>{v.daysUsed.size}</TableCell>
                    <TableCell className="text-sm">{Array.from(v.teams).join(", ")}</TableCell>
                    <TableCell className="text-sm">{Array.from(v.projects).join(", ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Histórico diário detalhado */}
      {dailyData?.assignments && dailyData.assignments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Histórico Diário Detalhado</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Veículo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyData.assignments
                  .sort((a: any, b: any) => {
                    const dateA = dailyData.dailySchedules?.find((d: any) => d.id === a.daily_schedule_id)?.schedule_date || "";
                    const dateB = dailyData.dailySchedules?.find((d: any) => d.id === b.daily_schedule_id)?.schedule_date || "";
                    return dateA.localeCompare(dateB) || (a.teams?.name || "").localeCompare(b.teams?.name || "");
                  })
                  .map((a: any) => {
                    const date = dailyData.dailySchedules?.find((d: any) => d.id === a.daily_schedule_id)?.schedule_date;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{date ? format(new Date(date + "T12:00:00"), "dd/MM") : "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{a.teams?.name || "—"}</TableCell>
                        <TableCell className="text-sm">{a.projects?.name || "—"}</TableCell>
                        <TableCell className="text-sm">{a.vehicles ? `${a.vehicles.model} (${a.vehicles.plate})` : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
