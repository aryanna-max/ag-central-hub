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
import { useVehicles } from "@/hooks/useVehicles";

function exportCsv(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type VehicleScheduleJoin = {
  vehicle_id: string | null;
  project_id: string | null;
  employee_id?: string | null;
  daily_schedules: { schedule_date: string } | null;
  vehicles?: { plate: string | null; model: string | null } | null;
  projects?: { codigo: string | null; name?: string | null } | null;
  employees?: { name: string | null } | null;
};

type VehicleRow = { id: string; plate: string; model: string };

export default function VehicleReportsTab() {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const { data: vehicles = [] } = useVehicles();

  // Report 1: Cost per vehicle from vehicle_payment_history
  const { data: paymentHistory = [] } = useQuery({
    queryKey: ["vehicle-cost-report", startDate, endDate, vehicleFilter],
    queryFn: async () => {
      let q = supabase.from("vehicle_payment_history").select("*")
        .gte("period_start", startDate).lte("period_end", endDate);
      if (vehicleFilter !== "all") q = q.eq("vehicle_id", vehicleFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const costByVehicle = useMemo(() => {
    const map: Record<string, { days: number; fuel: number; toll: number; maint: number; total: number; months: Set<string> }> = {};
    paymentHistory.forEach((r: any) => {
      if (!map[r.vehicle_id]) map[r.vehicle_id] = { days: 0, fuel: 0, toll: 0, maint: 0, total: 0, months: new Set() };
      const m = map[r.vehicle_id];
      m.days += r.days_count || 0;
      m.fuel += Number(r.fuel_value || 0);
      m.toll += Number(r.toll_value || 0);
      m.maint += Number(r.maintenance_value || 0);
      m.total += Number(r.total_value || 0);
      m.months.add(`${r.year}-${r.month}`);
    });
    return map;
  }, [paymentHistory]);

  // Report 2: Cost per project from daily_schedule_entries
  const { data: usageByProject = [] } = useQuery({
    queryKey: ["vehicle-project-report", startDate, endDate, vehicleFilter],
    queryFn: async () => {
      let q = supabase.from("daily_schedule_entries")
        .select("vehicle_id, project_id, daily_schedule_id, daily_schedules!inner(schedule_date)")
        .not("vehicle_id", "is", null)
        .not("project_id", "is", null)
        .gte("daily_schedules.schedule_date", MARCO_ZERO)
        .gte("daily_schedules.schedule_date", startDate)
        .lte("daily_schedules.schedule_date", endDate);
      if (vehicleFilter !== "all") q = q.eq("vehicle_id", vehicleFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as VehicleScheduleJoin[];
    },
  });

  const projectCost = useMemo(() => {
    const map: Record<string, { vehicle_ids: Set<string>; dates: Set<string> }> = {};
    usageByProject.forEach((e) => {
      const pid = e.project_id;
      if (!pid) return;
      if (!map[pid]) map[pid] = { vehicle_ids: new Set(), dates: new Set() };
      if (e.vehicle_id) map[pid].vehicle_ids.add(e.vehicle_id);
      const date = e.daily_schedules?.schedule_date;
      if (date) map[pid].dates.add(date);
    });
    return map;
  }, [usageByProject]);

  // Report 3: Usage history
  const { data: usageHistory = [] } = useQuery({
    queryKey: ["vehicle-usage-history", startDate, endDate, vehicleFilter],
    queryFn: async () => {
      let q = supabase.from("daily_schedule_entries")
        .select("vehicle_id, project_id, employee_id, daily_schedules!inner(schedule_date), vehicles:vehicle_id(plate, model), projects:project_id(codigo, name), employees:employee_id(name)")
        .not("vehicle_id", "is", null)
        .gte("daily_schedules.schedule_date", startDate)
        .lte("daily_schedules.schedule_date", endDate)
        .order("daily_schedules(schedule_date)", { ascending: false });
      if (vehicleFilter !== "all") q = q.eq("vehicle_id", vehicleFilter);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data || []) as unknown as VehicleScheduleJoin[];
    },
  });

  // Project lookup for report 2
  const { data: projectsLookup = [] } = useQuery({
    queryKey: ["projects-lookup-vehicle-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, codigo, name, client_id, clients:client_id(name)");
      return data || [];
    },
  });

  const vehicleMap = useMemo(() => {
    const m: Record<string, string> = {};
    (vehicles as unknown as VehicleRow[]).forEach((v) => (m[v.id] = `${v.plate} - ${v.model}`));
    return m;
  }, [vehicles]);

  const projectMap = useMemo(() => {
    const m: Record<string, { codigo: string; client: string }> = {};
    projectsLookup.forEach((p: any) => (m[p.id] = { codigo: p.codigo || "—", client: p.clients?.name || "—" }));
    return m;
  }, [projectsLookup]);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 mt-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div>
            <label className="text-xs text-muted-foreground">Início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fim</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8" />
          </div>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Veículo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos veículos</SelectItem>
              {(vehicles as unknown as VehicleRow[]).map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.plate} - {v.model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Report 1 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Custo por Veículo</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            const rows = Object.entries(costByVehicle).map(([vid, d]) => [
              vehicleMap[vid] || vid, String(d.months.size), String(d.days), fmt(d.fuel), fmt(d.toll), fmt(d.maint), fmt(d.total),
            ]);
            exportCsv(["Veículo", "Meses", "Diárias", "Combustível", "Pedágio", "Manutenção", "Total"], rows, "custo_veiculo.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Veículo</TableHead>
                <TableHead className="text-center">Meses</TableHead>
                <TableHead className="text-center">Diárias</TableHead>
                <TableHead className="text-right">Combustível</TableHead>
                <TableHead className="text-right">Pedágio</TableHead>
                <TableHead className="text-right">Manutenção</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(costByVehicle).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
              ) : Object.entries(costByVehicle).map(([vid, d]) => (
                <TableRow key={vid}>
                  <TableCell className="text-sm font-medium">{vehicleMap[vid] || vid}</TableCell>
                  <TableCell className="text-center">{d.months.size}</TableCell>
                  <TableCell className="text-center">{d.days}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(d.fuel)}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(d.toll)}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(d.maint)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{fmt(d.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Report 2 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Custo por Projeto</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            const rows = Object.entries(projectCost).map(([pid, d]) => {
              const p = projectMap[pid];
              return [p?.codigo || "—", p?.client || "—", Array.from(d.vehicle_ids).map((v) => vehicleMap[v] || v).join("; "), String(d.dates.size)];
            });
            exportCsv(["Projeto", "Cliente", "Veículos", "Dias"], rows, "custo_projeto.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Veículo(s)</TableHead>
                <TableHead className="text-center">Dias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(projectCost).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
              ) : Object.entries(projectCost).map(([pid, d]) => {
                const p = projectMap[pid];
                return (
                  <TableRow key={pid}>
                    <TableCell className="font-mono text-sm font-medium">{p?.codigo || "—"}</TableCell>
                    <TableCell className="text-sm">{p?.client || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{Array.from(d.vehicle_ids).map((v) => vehicleMap[v] || "").join(", ")}</TableCell>
                    <TableCell className="text-center font-semibold">{d.dates.size}</TableCell>
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
          <CardTitle className="text-sm">Histórico de Uso</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            const rows = usageHistory.map((e) => [
              e.daily_schedules?.schedule_date || "",
              e.vehicles?.plate || "",
              e.projects?.codigo || "—",
              e.employees?.name || "—",
            ]);
            exportCsv(["Data", "Veículo", "Projeto", "Responsável"], rows, "historico_uso.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageHistory.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
              ) : usageHistory.map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{e.daily_schedules?.schedule_date ? format(new Date(e.daily_schedules.schedule_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm">{e.vehicles?.plate} {e.vehicles?.model}</TableCell>
                  <TableCell className="font-mono text-xs">{e.projects?.codigo || "—"}</TableCell>
                  <TableCell className="text-sm">{e.employees?.name || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
