import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useEmployees } from "@/hooks/useEmployees";
import { useEmployeeDailyRecords, type EmployeeDailyRecordWithJoins } from "@/hooks/useEmployeeDailyRecords";

function fmt(v: number | null | undefined): string {
  if (!v) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RDFDigital() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [empSearch, setEmpSearch] = useState("");

  const { data: employees = [] } = useEmployees();

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== "desligado").sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    if (!empSearch) return activeEmployees;
    const q = empSearch.toLowerCase();
    return activeEmployees.filter((e) => e.name.toLowerCase().includes(q));
  }, [activeEmployees, empSearch]);

  const monthStart = startOfMonth(new Date(selectedMonth + "-02")).toISOString().slice(0, 10);
  const monthEnd = endOfMonth(new Date(selectedMonth + "-02")).toISOString().slice(0, 10);

  const { data: records = [], isLoading } = useEmployeeDailyRecords({
    employeeId: selectedEmployee || undefined,
    startDate: selectedEmployee ? monthStart : undefined,
    endDate: selectedEmployee ? monthEnd : undefined,
  });

  // Build a map: schedule_date → record
  const recordMap = useMemo(() => {
    const map = new Map<string, EmployeeDailyRecordWithJoins>();
    for (const r of records) {
      map.set(r.schedule_date, r);
    }
    return map;
  }, [records]);

  // All calendar days for the month
  const days = useMemo(() => {
    if (!selectedEmployee) return [];
    const start = new Date(selectedMonth + "-02");
    return eachDayOfInterval({
      start: startOfMonth(start),
      end: endOfMonth(start),
    });
  }, [selectedMonth, selectedEmployee]);

  // Totals
  const totals = useMemo(() => {
    let cafe = 0, almoco = 0, jantar = 0, hosp = 0, vt = 0, total = 0;
    for (const r of records) {
      cafe += r.cafe_provided ? (r.cafe_value || 0) : 0;
      almoco += r.almoco_dif_provided ? (r.almoco_dif_value || 0) : 0;
      jantar += r.jantar_provided ? (r.jantar_value || 0) : 0;
      hosp += r.hospedagem_provided ? (r.hospedagem_value || 0) : 0;
      vt += r.vt_provided ? (r.vt_value || 0) : 0;
    }
    total = cafe + almoco + jantar + hosp + vt;
    return { cafe, almoco, jantar, hosp, vt, total };
  }, [records]);

  const handleExportCSV = () => {
    if (!selectedEmployee || days.length === 0) return;
    const emp = activeEmployees.find((e) => e.id === selectedEmployee);
    const header = ["Dia", "Projeto", "Café", "Alm.Dif", "Jantar", "Hosp", "VT", "Total"];
    const rows = days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const r = recordMap.get(dateStr);
      if (!r) return [format(day, "dd/MM"), "—", "0", "0", "0", "0", "0", "0"];
      const rowTotal = (r.cafe_provided ? r.cafe_value || 0 : 0) +
        (r.almoco_dif_provided ? r.almoco_dif_value || 0 : 0) +
        (r.jantar_provided ? r.jantar_value || 0 : 0) +
        (r.hospedagem_provided ? r.hospedagem_value || 0 : 0) +
        (r.vt_provided ? r.vt_value || 0 : 0);
      return [
        format(day, "dd/MM"),
        r.projects?.name || "—",
        r.cafe_provided ? String(r.cafe_value || 0) : "0",
        r.almoco_dif_provided ? String(r.almoco_dif_value || 0) : "0",
        r.jantar_provided ? String(r.jantar_value || 0) : "0",
        r.hospedagem_provided ? String(r.hospedagem_value || 0) : "0",
        r.vt_provided ? String(r.vt_value || 0) : "0",
        String(rowTotal.toFixed(2)),
      ];
    });
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RDF_${emp?.name?.replace(/ /g, "_")}_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedEmpName = activeEmployees.find((e) => e.id === selectedEmployee)?.name;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">RDF Digital</h1>
          <Badge variant="secondary" className="text-xs">Registro Diário de Funcionário</Badge>
        </div>
        {selectedEmployee && (
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Mês/Ano</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Buscar funcionário</Label>
            <Input
              placeholder="Nome..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Funcionário</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {filteredEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* No employee selected */}
      {!selectedEmployee && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um funcionário para ver o RDF do mês.
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {selectedEmployee && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedEmpName} —{" "}
              {format(new Date(selectedMonth + "-02"), "MMMM/yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-center py-8 text-muted-foreground">Carregando...</p>
            ) : days.length === 0 ? (
              <p className="text-sm text-center py-8 text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Dia</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead className="text-right w-20">Café</TableHead>
                      <TableHead className="text-right w-20">Alm.Dif</TableHead>
                      <TableHead className="text-right w-20">Jantar</TableHead>
                      <TableHead className="text-right w-20">Hosp.</TableHead>
                      <TableHead className="text-right w-20">VT</TableHead>
                      <TableHead className="text-right w-24 font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const r = recordMap.get(dateStr);
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                      if (!r) {
                        return (
                          <TableRow key={dateStr} className={isWeekend ? "bg-muted/20 opacity-50" : "opacity-40"}>
                            <TableCell className="text-xs font-medium">
                              {format(day, "dd EEE", { locale: ptBR })}
                            </TableCell>
                            <TableCell colSpan={7} className="text-xs text-muted-foreground">
                              {isWeekend ? "Final de semana" : "Sem registro"}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      const rowCafe = r.cafe_provided ? (r.cafe_value || 0) : 0;
                      const rowAlmoco = r.almoco_dif_provided ? (r.almoco_dif_value || 0) : 0;
                      const rowJantar = r.jantar_provided ? (r.jantar_value || 0) : 0;
                      const rowHosp = r.hospedagem_provided ? (r.hospedagem_value || 0) : 0;
                      const rowVt = r.vt_provided ? (r.vt_value || 0) : 0;
                      const rowTotal = rowCafe + rowAlmoco + rowJantar + rowHosp + rowVt;

                      const isFalta = r.attendance === "falta" || r.attendance === "justificado";

                      return (
                        <TableRow key={dateStr} className={isFalta ? "bg-red-50" : ""}>
                          <TableCell className="text-xs font-medium">
                            {format(day, "dd EEE", { locale: ptBR })}
                            {isFalta && (
                              <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0">F</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium">{r.projects?.name || "—"}</span>
                          </TableCell>
                          <TableCell className="text-right text-xs">{rowCafe > 0 ? fmt(rowCafe) : "—"}</TableCell>
                          <TableCell className="text-right text-xs">{rowAlmoco > 0 ? fmt(rowAlmoco) : "—"}</TableCell>
                          <TableCell className="text-right text-xs">{rowJantar > 0 ? fmt(rowJantar) : "—"}</TableCell>
                          <TableCell className="text-right text-xs">{rowHosp > 0 ? fmt(rowHosp) : "—"}</TableCell>
                          <TableCell className="text-right text-xs">{rowVt > 0 ? fmt(rowVt) : "—"}</TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            {rowTotal > 0 ? fmt(rowTotal) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Totals row */}
                    <TableRow className="bg-primary/10 font-bold border-t-2">
                      <TableCell className="text-xs font-bold" colSpan={2}>TOTAL DO MÊS</TableCell>
                      <TableCell className="text-right text-xs">{totals.cafe > 0 ? fmt(totals.cafe) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{totals.almoco > 0 ? fmt(totals.almoco) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{totals.jantar > 0 ? fmt(totals.jantar) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{totals.hosp > 0 ? fmt(totals.hosp) : "—"}</TableCell>
                      <TableCell className="text-right text-xs">{totals.vt > 0 ? fmt(totals.vt) : "—"}</TableCell>
                      <TableCell className="text-right text-sm font-bold text-primary">{fmt(totals.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {selectedEmployee && !isLoading && records.length === 0 && days.length > 0 && (
              <p className="text-sm text-center py-6 text-muted-foreground px-4">
                Nenhum registro encontrado para este mês.
                Os dados são gerados automaticamente ao fechar a escala diária.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
