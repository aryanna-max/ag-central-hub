import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MARCO_ZERO } from "@/lib/constants";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Filter } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";

function exportCsv(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const REMOVAL_LABELS: Record<string, string> = {
  campo_concluido: "Campo concluído",
  pausa_temporaria: "Pausa temporária",
  reagendado: "Reagendado",
  clima: "Clima",
  equipamento: "Equipamento",
  falta_equipe: "Falta de equipe",
};

export default function PlanningReportsTab() {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [empFilter, setEmpFilter] = useState("all");
  const [projFilter, setProjFilter] = useState("all");

  const { data: employees = [] } = useEmployees();
  const { data: projectsList = [] } = useQuery({
    queryKey: ["projects-for-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, codigo, name, client_id, clients:client_id(name)");
      return data || [];
    },
  });

  const minDate = startDate < MARCO_ZERO ? MARCO_ZERO : startDate;

  // All entries for the period
  const { data: entries = [] } = useQuery({
    queryKey: ["planning-report-entries", minDate, endDate, empFilter, projFilter],
    queryFn: async () => {
      let q = supabase.from("daily_schedule_entries")
        .select("employee_id, project_id, vehicle_id, team_id, is_vacation_override, removal_reason, removed_at, notes, daily_schedules!inner(schedule_date, is_legacy)")
        .eq("daily_schedules.is_legacy", false)
        .gte("daily_schedules.schedule_date", minDate)
        .lte("daily_schedules.schedule_date", endDate);
      if (empFilter !== "all") q = q.eq("employee_id", empFilter);
      if (projFilter !== "all") q = q.eq("project_id", projFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const empMap = useMemo(() => {
    const m: Record<string, string> = {};
    employees.forEach((e: any) => (m[e.id] = e.name));
    return m;
  }, [employees]);

  const projMap = useMemo(() => {
    const m: Record<string, { codigo: string; client: string }> = {};
    projectsList.forEach((p: any) => (m[p.id] = { codigo: p.codigo || "—", client: (p.clients as any)?.name || "—" }));
    return m;
  }, [projectsList]);

  // Report 1: Days per employee
  const daysByEmployee = useMemo(() => {
    const map: Record<string, { total: number; avulso: number; normal: number; projects: Set<string> }> = {};
    entries.forEach((e: any) => {
      if (e.removed_at) return;
      const eid = e.employee_id;
      if (!map[eid]) map[eid] = { total: 0, avulso: 0, normal: 0, projects: new Set() };
      map[eid].total++;
      if (e.is_vacation_override) map[eid].avulso++; else map[eid].normal++;
      if (e.project_id) map[eid].projects.add(e.project_id);
    });
    return map;
  }, [entries]);

  // Report 2: Days per project
  const daysByProject = useMemo(() => {
    const map: Record<string, { total: number; dates: Set<string>; teams: Set<string> }> = {};
    entries.forEach((e: any) => {
      if (e.removed_at || !e.project_id) return;
      const pid = e.project_id;
      if (!map[pid]) map[pid] = { total: 0, dates: new Set(), teams: new Set() };
      map[pid].total++;
      map[pid].dates.add((e.daily_schedules as any)?.schedule_date);
      if (e.team_id) map[pid].teams.add(e.team_id);
    });
    return map;
  }, [entries]);

  // Report 3: Absences
  const absences = useMemo(() => {
    return entries.filter((e: any) => e.removed_at).map((e: any) => ({
      employee: empMap[e.employee_id] || "—",
      date: (e.daily_schedules as any)?.schedule_date || "",
      reason: e.removal_reason,
      project: e.project_id ? projMap[e.project_id]?.codigo || "—" : "—",
    }));
  }, [entries, empMap, projMap]);

  // Report 4: Vacation overrides
  const vacationOverrides = useMemo(() => {
    return entries.filter((e: any) => e.is_vacation_override && !e.removed_at).map((e: any) => ({
      employee: empMap[e.employee_id] || "—",
      date: (e.daily_schedules as any)?.schedule_date || "",
      project: e.project_id ? projMap[e.project_id]?.codigo || "—" : "—",
      notes: e.notes || "",
    }));
  }, [entries, empMap, projMap]);

  const fieldEmployees = employees.filter((e: any) => e.status !== "desligado");

  return (
    <div className="space-y-6 mt-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={MARCO_ZERO} className="w-36 h-8" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8" />
          </div>
          <Select value={empFilter} onValueChange={setEmpFilter}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Funcionário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos funcionários</SelectItem>
              {fieldEmployees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={projFilter} onValueChange={setProjFilter}>
            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos projetos</SelectItem>
              {projectsList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.codigo || p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Report 1 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Dias em Campo por Funcionário</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            const rows = Object.entries(daysByEmployee).map(([eid, d]) => [empMap[eid] || eid, String(d.total), String(d.avulso), String(d.normal), String(d.projects.size)]);
            exportCsv(["Funcionário", "Dias Totais", "Avulso", "Normal", "Projetos"], rows, "dias_funcionario.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Avulso</TableHead>
                <TableHead className="text-center">Normal</TableHead>
                <TableHead className="text-center">Projetos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(daysByEmployee).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
              ) : Object.entries(daysByEmployee).sort((a, b) => b[1].total - a[1].total).map(([eid, d]) => (
                <TableRow key={eid}>
                  <TableCell className="text-sm font-medium">{empMap[eid] || "—"}</TableCell>
                  <TableCell className="text-center font-semibold">{d.total}</TableCell>
                  <TableCell className="text-center">{d.avulso || "—"}</TableCell>
                  <TableCell className="text-center">{d.normal}</TableCell>
                  <TableCell className="text-center">{d.projects.size}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Report 2 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Dias em Campo por Projeto</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            const rows = Object.entries(daysByProject).map(([pid, d]) => {
              const p = projMap[pid];
              const dates = Array.from(d.dates).sort();
              return [p?.codigo || "—", p?.client || "—", String(d.total), dates[0] || "", dates[dates.length - 1] || "", String(d.teams.size)];
            });
            exportCsv(["Projeto", "Cliente", "Funcionários-dia", "De", "Até", "Equipes"], rows, "dias_projeto.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Func-dia</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center">Equipes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(daysByProject).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
              ) : Object.entries(daysByProject).sort((a, b) => b[1].total - a[1].total).map(([pid, d]) => {
                const p = projMap[pid];
                const dates = Array.from(d.dates).sort();
                return (
                  <TableRow key={pid}>
                    <TableCell className="font-mono text-sm font-medium">{p?.codigo || "—"}</TableCell>
                    <TableCell className="text-sm">{p?.client || "—"}</TableCell>
                    <TableCell className="text-center font-semibold">{d.total}</TableCell>
                    <TableCell className="text-xs">{dates[0] && format(new Date(dates[0]), "dd/MM")} — {dates.length > 1 && format(new Date(dates[dates.length - 1]), "dd/MM")}</TableCell>
                    <TableCell className="text-center">{d.teams.size}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Report 3 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Ausências e Faltas</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            const rows = absences.map((a) => [a.employee, a.date, REMOVAL_LABELS[a.reason] || a.reason || "—", a.project]);
            exportCsv(["Funcionário", "Data", "Motivo", "Projeto"], rows, "ausencias.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Projeto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {absences.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem ausências registradas</TableCell></TableRow>
              ) : absences.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{a.employee}</TableCell>
                  <TableCell className="text-sm">{a.date ? format(new Date(a.date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{REMOVAL_LABELS[a.reason] || a.reason || "—"}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{a.project}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Report 4 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Escala Avulsa (Férias + Campo)</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            const rows = vacationOverrides.map((v) => [v.employee, v.date, v.project, v.notes]);
            exportCsv(["Funcionário", "Data", "Projeto", "Observação"], rows, "avulso.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vacationOverrides.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem registros avulsos</TableCell></TableRow>
              ) : vacationOverrides.map((v, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{v.employee}</TableCell>
                  <TableCell className="text-sm">{v.date ? format(new Date(v.date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {v.project}
                    <Badge className="ml-2 bg-amber-100 text-amber-800 text-[9px]">Avulso</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
