import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  falta: { label: "Falta", className: "bg-red-600 text-white" },
  folga: { label: "Folga", className: "bg-green-600 text-white" },
  atestado: { label: "Atestado", className: "bg-amber-500 text-white" },
  reserva_ag: { label: "Reserva AG", className: "bg-blue-600 text-white" },
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
      const { data, error } = await (supabase.from as any)("attendance")
        .select("*, employees:employee_id(name, matricula), profiles:created_by_id(full_name)")
        .gte("date", startDate)
        .lte("date", endDate)
        .in("status", ["falta", "folga", "atestado", "reserva_ag"])
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const absenceRecords = useMemo(() => {
    return records.filter((r: any) => {
      if (typeFilter !== "todos" && r.status !== typeFilter) return false;
      if (empFilter) {
        const name = (r.employees as any)?.name?.toLowerCase() || "";
        if (!name.includes(empFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [records, typeFilter, empFilter]);

  const ausencias = absenceRecords.filter((r: any) => r.status !== "reserva_ag");
  const reservas = absenceRecords.filter((r: any) => r.status === "reserva_ag");

  const totals = useMemo(() => {
    const all = records.filter((r: any) => r.status !== "reserva_ag");
    return {
      falta: all.filter((r: any) => r.status === "falta").length,
      folga: all.filter((r: any) => r.status === "folga").length,
      atestado: all.filter((r: any) => r.status === "atestado").length,
      reserva_ag: records.filter((r: any) => r.status === "reserva_ag").length,
    };
  }, [records]);

  const exportCSV = (data: any[], filename: string) => {
    const header = "Funcionário,Matrícula,Data,Tipo,Observação,Registrado por\n";
    const rows = data.map((r: any) => {
      const emp = r.employees as any;
      const prof = r.profiles as any;
      return `"${emp?.name || ""}","${emp?.matricula || ""}","${r.date}","${STATUS_LABELS[r.status]?.label || r.status}","${r.notes || ""}","${prof?.full_name || ""}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6" /> Relatório de Ausências
          </h1>
          <p className="text-muted-foreground text-sm">Controle de faltas, folgas, atestados e presenças internas</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => exportCSV(absenceRecords, `ausencias_${startDate}_${endDate}.csv`)}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Faltas</p><p className="text-2xl font-bold text-red-600">{totals.falta}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Folgas</p><p className="text-2xl font-bold text-green-600">{totals.folga}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Atestados</p><p className="text-2xl font-bold text-amber-600">{totals.atestado}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Reserva AG</p><p className="text-2xl font-bold text-blue-600">{totals.reserva_ag}</p></CardContent></Card>
      </div>

      {/* Filters */}
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

      <Tabs defaultValue="ausencias">
        <TabsList>
          <TabsTrigger value="ausencias">Ausências ({ausencias.length})</TabsTrigger>
          <TabsTrigger value="reserva">Reserva AG ({reservas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ausencias">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="py-8 text-center text-muted-foreground">Carregando...</p>
              ) : ausencias.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">Nenhuma ausência encontrada no período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead>Registrado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ausencias.map((r: any) => {
                      const st = STATUS_LABELS[r.status] || { label: r.status, className: "" };
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{(r.employees as any)?.name || "—"}</TableCell>
                          <TableCell>{format(new Date(r.date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                          <TableCell><Badge className={st.className}>{st.label}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.notes || "—"}</TableCell>
                          <TableCell className="text-sm">{(r.profiles as any)?.full_name || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reserva">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Dias em Reserva AG — presença interna na sede (não é ausência)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reservas.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">Nenhum registro de Reserva AG no período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead>Registrado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservas.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{(r.employees as any)?.name || "—"}</TableCell>
                        <TableCell>{format(new Date(r.date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.notes || "—"}</TableCell>
                        <TableCell className="text-sm">{(r.profiles as any)?.full_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
