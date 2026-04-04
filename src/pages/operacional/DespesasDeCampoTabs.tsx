import { useState, useMemo } from "react";
import { DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileExpenses from "@/components/mobile/expenses/MobileExpenses";
import DespesasDeCampo from "./DespesasDeCampo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function exportCsv(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ExpenseReportsTab() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["expense-report-items", startDate, endDate],
    queryFn: async () => {
      let q = supabase.from("field_expense_items")
        .select("employee_id, project_id, value, created_at, employees:employee_id(name), projects:project_id(name)");
      if (startDate) q = q.gte("created_at", startDate);
      if (endDate) q = q.lte("created_at", endDate + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const byEmployee = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    items.forEach((i: any) => {
      const eid = i.employee_id;
      if (!map[eid]) map[eid] = { name: (i.employees as any)?.name || "—", total: 0 };
      map[eid].total += Number(i.value) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [items]);

  const byProject = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    items.forEach((i: any) => {
      const pid = i.project_id || "sem_projeto";
      if (!map[pid]) map[pid] = { name: (i.projects as any)?.name || "Sem projeto", total: 0 };
      map[pid].total += Number(i.value) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [items]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 h-8" />
          </div>
          {(startDate || endDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); }}>Limpar</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Custo por Funcionário</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            exportCsv(["Funcionário", "Total"], byEmployee.map(([, d]) => [d.name, fmt(d.total)]), "custo_funcionario.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byEmployee.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
              ) : byEmployee.map(([id, d]) => (
                <TableRow key={id}>
                  <TableCell className="text-sm font-medium">{d.name}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(d.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Custo por Projeto</CardTitle>
          <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => {
            exportCsv(["Projeto", "Total"], byProject.map(([, d]) => [d.name, fmt(d.total)]), "custo_projeto.csv");
          }}><Download className="w-3 h-3" /> CSV</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projeto</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProject.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
              ) : byProject.map(([id, d]) => (
                <TableRow key={id}>
                  <TableCell className="text-sm font-medium">{d.name}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(d.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DespesasDeCampoTabs() {
  const [tab, setTab] = useState("despesas");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <DollarSign className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Despesas de Campo</h1>
          <p className="text-sm text-muted-foreground">Folhas de despesas e relatórios de custos</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="despesas">
          <DespesasDeCampo />
        </TabsContent>

        <TabsContent value="relatorios">
          <ExpenseReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
