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
import type { Database } from "@/integrations/supabase/types";

type DayType = Database["public"]["Enums"]["day_type"];

const DAY_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  falta: { label: "Falta", className: "bg-red-600 text-white" },
  folga: { label: "Folga", className: "bg-green-600 text-white" },
  atestado: { label: "Atestado", className: "bg-amber-500 text-white" },
};

const ABSENCE_TYPES: DayType[] = ["folga", "atestado", "falta"];

interface AbsenceRow {
  id: string;
  day_type: DayType | null;
  absence_reason: string | null;
  notes: string | null;
  validated_at: string | null;
  schedule_date: string;
  employee: { id: string; name: string; matricula: string | null } | null;
}

export default function RelatorioAusencias() {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [typeFilter, setTypeFilter] = useState<"todos" | DayType>("todos");
  const [empFilter, setEmpFilter] = useState("");

  const { data: records = [], isLoading } = useQuery<AbsenceRow[]>({
    queryKey: ["absence-report", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_schedule_entries")
        .select(
          "id, day_type, absence_reason, notes, validated_at, employees:employee_id(id, name, matricula), daily_schedules:daily_schedule_id(schedule_date)",
        )
        .in("day_type", ABSENCE_TYPES)
        .not("validated_at", "is", null);
      if (error) throw error;
      return (data || [])
        .map((r) => ({
          id: r.id,
          day_type: r.day_type,
          absence_reason: r.absence_reason,
          notes: r.notes,
          validated_at: r.validated_at,
          schedule_date: r.daily_schedules?.schedule_date ?? "",
          employee: r.employees
            ? { id: r.employees.id, name: r.employees.name, matricula: r.employees.matricula }
            : null,
        }))
        .filter((r) => r.schedule_date >= startDate && r.schedule_date <= endDate)
        .sort((a, b) => b.schedule_date.localeCompare(a.schedule_date));
    },
  });

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter !== "todos" && r.day_type !== typeFilter) return false;
      if (empFilter) {
        const name = r.employee?.name?.toLowerCase() || "";
        if (!name.includes(empFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [records, typeFilter, empFilter]);

  const totals = useMemo(
    () => ({
      falta: records.filter((r) => r.day_type === "falta").length,
      folga: records.filter((r) => r.day_type === "folga").length,
      atestado: records.filter((r) => r.day_type === "atestado").length,
    }),
    [records],
  );

  const exportCSV = () => {
    const header = "Funcionário,Matrícula,Data,Tipo,Motivo,Observação\n";
    const rows = filtered
      .map((r) => {
        const tipo = DAY_TYPE_LABELS[r.day_type ?? ""]?.label || r.day_type || "";
        return `"${r.employee?.name || ""}","${r.employee?.matricula || ""}","${r.schedule_date}","${tipo}","${r.absence_reason || ""}","${r.notes || ""}"`;
      })
      .join("\n");
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
          <p className="text-muted-foreground text-sm">
            Faltas, folgas e atestados validados (fato). Reserva AG é presença interna, não aparece aqui.
          </p>
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
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
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
            <Input
              placeholder="Buscar..."
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value)}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhuma ausência validada no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const st = DAY_TYPE_LABELS[r.day_type ?? ""] || { label: r.day_type || "", className: "" };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.employee?.name || "—"}</TableCell>
                      <TableCell>{format(new Date(r.schedule_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                      <TableCell><Badge className={st.className}>{st.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.absence_reason || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.notes || "—"}</TableCell>
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
