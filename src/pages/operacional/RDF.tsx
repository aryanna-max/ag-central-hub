import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useEmployees";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coffee, Utensils, Home, Car, CheckCircle, Clock } from "lucide-react";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const fmtDate = (d: string) => format(parseISO(d), "dd/MM", { locale: ptBR });
const fmtBRL = (v: number) => v > 0 ? `R$ ${v.toFixed(2)}` : "—";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  provisorio: { label: "Provisório", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmado: { label: "Confirmado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pago: { label: "Pago", cls: "bg-blue-50 text-blue-700 border-blue-200" },
};

const ATTENDANCE_BADGE: Record<string, string> = {
  presente: "bg-emerald-100 text-emerald-700",
  ausente: "bg-red-100 text-red-700",
  atrasado: "bg-amber-100 text-amber-700",
  falta: "bg-red-100 text-red-700",
};

type RDFRecord = {
  id: string;
  schedule_date: string;
  attendance: string | null;
  cafe_provided: boolean | null;
  cafe_value: number | null;
  almoco_dif_provided: boolean | null;
  almoco_dif_value: number | null;
  jantar_provided: boolean | null;
  jantar_value: number | null;
  hospedagem_provided: boolean | null;
  hospedagem_value: number | null;
  vt_provided: boolean | null;
  vt_value: number | null;
  status: string | null;
  employees: { name: string; matricula: string | null } | null;
  projects: { name: string; codigo: string | null } | null;
};

export default function RDF() {
  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(weekStart);
  const [endDate, setEndDate] = useState(weekEnd);
  const [employeeFilter, setEmployeeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [groupBy, setGroupBy] = useState<"data" | "funcionario">("data");

  const { data: employees = [] } = useEmployees();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["rdf-records", startDate, endDate, employeeFilter],
    queryFn: async () => {
      let query = supabase
        .from("employee_daily_records")
        .select("*, employees(name, matricula), projects:project_id(name, codigo)")
        .gte("schedule_date", startDate)
        .lte("schedule_date", endDate)
        .order("schedule_date", { ascending: false });

      if (employeeFilter !== "todos") {
        query = query.eq("employee_id", employeeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RDFRecord[];
    },
  });

  const filtered = useMemo(() => {
    if (statusFilter === "todos") return records;
    return records.filter((r) => r.status === statusFilter);
  }, [records, statusFilter]);

  // Totais
  const totals = useMemo(() => ({
    cafe: filtered.reduce((s, r) => s + (r.cafe_provided ? (r.cafe_value || 0) : 0), 0),
    almoco: filtered.reduce((s, r) => s + (r.almoco_dif_provided ? (r.almoco_dif_value || 0) : 0), 0),
    jantar: filtered.reduce((s, r) => s + (r.jantar_provided ? (r.jantar_value || 0) : 0), 0),
    hospedagem: filtered.reduce((s, r) => s + (r.hospedagem_provided ? (r.hospedagem_value || 0) : 0), 0),
    vt: filtered.reduce((s, r) => s + (r.vt_provided ? (r.vt_value || 0) : 0), 0),
    total: filtered.reduce((s, r) =>
      s + (r.cafe_provided ? (r.cafe_value || 0) : 0)
        + (r.almoco_dif_provided ? (r.almoco_dif_value || 0) : 0)
        + (r.jantar_provided ? (r.jantar_value || 0) : 0)
        + (r.hospedagem_provided ? (r.hospedagem_value || 0) : 0)
        + (r.vt_provided ? (r.vt_value || 0) : 0),
      0),
  }), [filtered]);

  // Agrupamento
  const grouped = useMemo(() => {
    if (groupBy === "data") {
      const map = new Map<string, RDFRecord[]>();
      for (const r of filtered) {
        const key = r.schedule_date;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }
      return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    } else {
      const map = new Map<string, RDFRecord[]>();
      for (const r of filtered) {
        const key = r.employees?.name || r.id;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      }
      return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }
  }, [filtered, groupBy]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== "desligado"),
    [employees]
  );

  const setThisWeek = () => {
    setStartDate(weekStart);
    setEndDate(weekEnd);
  };

  const setThisMonth = () => {
    const now = new Date();
    setStartDate(format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"));
    setEndDate(format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">RDF — Registro Diário de Funcionários</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Benefícios gerados automaticamente ao fechar escala</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm w-36" />
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={setThisWeek}>Esta semana</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={setThisMonth}>Este mês</Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Funcionário</Label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="h-8 text-sm w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {activeEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="provisorio">Provisório</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Agrupar por</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "data" | "funcionario")}>
                <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="data">Data</SelectItem>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Café", icon: Coffee, value: totals.cafe, color: "text-amber-600" },
          { label: "Alm. Dif.", icon: Utensils, value: totals.almoco, color: "text-blue-600" },
          { label: "Jantar", icon: Utensils, value: totals.jantar, color: "text-purple-600" },
          { label: "Hospedagem", icon: Home, value: totals.hospedagem, color: "text-orange-600" },
          { label: "VT", icon: Car, value: totals.vt, color: "text-slate-600" },
          { label: "TOTAL", icon: null, value: totals.total, color: "text-primary" },
        ].map(({ label, icon: Icon, value, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-2">
              {Icon && <Icon className={cn("w-4 h-4 shrink-0", color)} />}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("text-sm font-bold", color)}>
                  {value > 0 ? `R$ ${value.toFixed(2)}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado para o período.</p>
            <p className="text-xs text-muted-foreground mt-1">Os registros são gerados automaticamente ao fechar a Escala Diária.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([groupKey, groupRecords]) => {
            const groupTotal = groupRecords.reduce((s, r) =>
              s + (r.cafe_provided ? (r.cafe_value || 0) : 0)
                + (r.almoco_dif_provided ? (r.almoco_dif_value || 0) : 0)
                + (r.jantar_provided ? (r.jantar_value || 0) : 0)
                + (r.hospedagem_provided ? (r.hospedagem_value || 0) : 0)
                + (r.vt_provided ? (r.vt_value || 0) : 0), 0);

            const groupLabel = groupBy === "data"
              ? format(parseISO(groupKey), "EEEE, dd/MM/yyyy", { locale: ptBR })
              : groupKey;

            return (
              <Card key={groupKey}>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                    <span className="text-sm font-semibold capitalize">{groupLabel}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{groupRecords.length} registro{groupRecords.length !== 1 ? "s" : ""}</span>
                      {groupTotal > 0 && (
                        <span className="text-sm font-bold text-primary">R$ {groupTotal.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          {groupBy === "data" && <TableHead>Funcionário</TableHead>}
                          {groupBy === "funcionario" && <TableHead>Data</TableHead>}
                          <TableHead>Projeto</TableHead>
                          <TableHead>Presença</TableHead>
                          <TableHead className="text-center">
                            <Coffee className="w-3.5 h-3.5 inline text-amber-600" /> Café
                          </TableHead>
                          <TableHead className="text-center">
                            <Utensils className="w-3.5 h-3.5 inline text-blue-600" /> Alm.
                          </TableHead>
                          <TableHead className="text-center">
                            <Utensils className="w-3.5 h-3.5 inline text-purple-600" /> Jantar
                          </TableHead>
                          <TableHead className="text-center">
                            <Home className="w-3.5 h-3.5 inline text-orange-600" /> Hosp.
                          </TableHead>
                          <TableHead className="text-center">
                            <Car className="w-3.5 h-3.5 inline text-slate-600" /> VT
                          </TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupRecords.map((r) => {
                          const rowTotal =
                            (r.cafe_provided ? (r.cafe_value || 0) : 0) +
                            (r.almoco_dif_provided ? (r.almoco_dif_value || 0) : 0) +
                            (r.jantar_provided ? (r.jantar_value || 0) : 0) +
                            (r.hospedagem_provided ? (r.hospedagem_value || 0) : 0) +
                            (r.vt_provided ? (r.vt_value || 0) : 0);

                          return (
                            <TableRow key={r.id} className="text-sm">
                              {groupBy === "data" && (
                                <TableCell className="font-medium">
                                  <div>{r.employees?.name || "—"}</div>
                                  {r.employees?.matricula && (
                                    <div className="text-xs text-muted-foreground">{r.employees.matricula}</div>
                                  )}
                                </TableCell>
                              )}
                              {groupBy === "funcionario" && (
                                <TableCell className="text-muted-foreground">{fmtDate(r.schedule_date)}</TableCell>
                              )}
                              <TableCell className="max-w-[160px]">
                                {r.projects ? (
                                  <div>
                                    <div className="truncate">{r.projects.name}</div>
                                    {r.projects.codigo && (
                                      <div className="text-xs text-muted-foreground font-mono">{r.projects.codigo}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", ATTENDANCE_BADGE[r.attendance || "presente"] || "bg-muted text-muted-foreground")}>
                                  {r.attendance || "presente"}
                                </span>
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {r.cafe_provided ? <span className="text-emerald-700 font-medium">{fmtBRL(r.cafe_value || 0)}</span> : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {r.almoco_dif_provided ? <span className="text-blue-700 font-medium">{fmtBRL(r.almoco_dif_value || 0)}</span> : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {r.jantar_provided ? <span className="text-purple-700 font-medium">{fmtBRL(r.jantar_value || 0)}</span> : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {r.hospedagem_provided ? <span className="text-orange-700 font-medium">{fmtBRL(r.hospedagem_value || 0)}</span> : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {r.vt_provided ? <span className="text-slate-700 font-medium">{fmtBRL(r.vt_value || 0)}</span> : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold">
                                {rowTotal > 0 ? `R$ ${rowTotal.toFixed(2)}` : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn("text-xs", STATUS_BADGE[r.status || "provisorio"]?.cls)}>
                                  {STATUS_BADGE[r.status || "provisorio"]?.label || r.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
