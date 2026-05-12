import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { DayType } from "@/hooks/useEmployeeDayStatus";

const DAY_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  falta: { label: "Falta", className: "bg-red-600 text-white" },
  folga: { label: "Folga", className: "bg-green-600 text-white" },
  atestado: { label: "Atestado", className: "bg-amber-500 text-white" },
};

type AbsenceRecord = {
  id: string;
  day_type: DayType;
  absence_reason: string | null;
  employee_id: string;
  employees: { name: string; matricula: string | null } | null;
  daily_schedules: { schedule_date: string } | null;
};

export default function RelatorioAusencias() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [typeFilter, setTypeFilter] = useState("todos");
  const [empFilter, setEmpFilter] = useState("");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["absence-report", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_schedule_entries")
        .select(
          "id, day_type, absence_reason, employee_id, employees:employee_id(name, matricula), daily_schedules!inner(schedule_date)",
        )
        .in("day_type", ["falta", "folga", "atestado"])
        .gte("daily_schedules.schedule_date", startDate)
        .lte("daily_schedules.schedule_date", endDate);
      if (error) throw error;
      const rows = (data ?? []) as unknown as AbsenceRecord[];
      return [...rows].sort((a, b) =>
        (b.daily_schedules?.schedule_date ?? "").localeCompare(a.daily_schedules?.schedule_date ?? ""),
      );
    },
  });

  const absenceRecords = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter !== "todos" && r.day_type !== typeFilter) return false;
      if (empFilter) {
        const name = r.employees?.name?.toLowerCase() || "";
        if (!name.includes(empFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [records, typeFilter, empFilter]);

  const totals = useMemo(() => ({
    falta: records.filter((r) => r.day_type === "falta").length,
    folga: records.filter((r) => r.day_type === "folga").length,
    atestado: records.filter((r) => r.day_type === "atestado").length,
  }), [records]);

  const exportCSV = () => {
    const header = "Funcionário,Matrícula,Data,Tipo,Observação\n";
    const rows = absenceRecords.map((r) => {
      const emp = r.employees;
      const date = r.daily_schedules?.schedule_date || "";
      return `"${emp?.name || ""}","${emp?.matricula || ""}","${date}","${DAY_TYPE_LABELS[r.day_type]?.label || r.day_type}","${r.absence_reason || ""}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ausencias_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6" /> Relatório de Ausências
          </h1>
          <p className="text-muted-foreground text-sm">Controle de faltas, folgas e atestados</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Faltas</p><p className="text-2xl font-bold text-red-600">{totals.falta}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Folgas</p><p className="text-2xl font-bold text-green-600">{totals.folga}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Atestados</p><p className="text-2xl font-bold text-amber-600">{totals.atestado}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Data início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Data fim</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="falta">Falta</SelectItem>
                <SelectItem value="folga">Folga</SelectItem>
                <SelectItem value="atestado">Atestado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Funcionário</Label>
            <Input placeholder="Buscar..." value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} className="w-48" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Carregando...</p>
          ) : absenceRecords.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhuma ausência encontrada no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absenceRecords.map((r) => {
                  const st = DAY_TYPE_LABELS[r.day_type] || { label: r.day_type, className: "" };
                  const date = r.daily_schedules?.schedule_date;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.employees?.name || "—"}</TableCell>
                      <TableCell>{date ? format(new Date(date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell><Badge className={st.className}>{st.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.absence_reason || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
