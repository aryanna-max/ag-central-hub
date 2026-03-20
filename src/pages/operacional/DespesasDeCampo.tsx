import { useState, useMemo } from "react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Eye, DollarSign, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useExpenseSheets } from "@/hooks/useExpenseSheets";
import ExpenseSheetDrawer from "@/components/operacional/ExpenseSheetDrawer";
import ExpenseSheetDetail from "@/components/operacional/ExpenseSheetDetail";

const statusCfg: Record<string, { label: string; cls: string }> = {
  rascunho:  { label: "Rascunho",  cls: "bg-gray-500 text-white hover:bg-gray-600" },
  submetido: { label: "Submetido", cls: "bg-blue-600 text-white hover:bg-blue-700" },
  devolvido: { label: "Devolvido", cls: "bg-red-600 text-white hover:bg-red-700" },
  aprovado:  { label: "Aprovado",  cls: "bg-emerald-800 text-white hover:bg-emerald-900" },
  pago:      { label: "Pago",      cls: "bg-emerald-500 text-white hover:bg-emerald-600" },
};

export default function DespesasDeCampo() {
  const { data: sheets = [], isLoading } = useExpenseSheets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const filtered = useMemo(() => {
    if (!filterStart && !filterEnd) return sheets;
    return sheets.filter((s) => {
      const d = parseISO(s.period_start);
      const lo = filterStart ? parseISO(filterStart) : new Date("1970-01-01");
      const hi = filterEnd ? parseISO(filterEnd) : new Date("2099-12-31");
      return isWithinInterval(d, { start: lo, end: hi });
    });
  }, [sheets, filterStart, filterEnd]);

  const totalGeral = filtered.reduce((s, p) => s + (Number(p.total_value) || 0), 0);
  const pendentes = filtered.filter((p) => ["rascunho", "submetido"].includes(p.status)).length;
  const aprovadas = filtered.filter((p) => ["aprovado", "pago"].includes(p.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Despesas de Campo</h1>
          <p className="text-sm text-muted-foreground">Folhas de despesas semanais de campo</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Folha
        </Button>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="w-40" />
        </div>
        {(filterStart || filterEnd) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStart(""); setFilterEnd(""); }}>
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{pendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovadas / Pagas</CardTitle>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{aprovadas}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma folha encontrada</TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => {
                  const cfg = statusCfg[s.status] ?? statusCfg.rascunho;
                  return (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                      <TableCell className="font-medium font-mono">{s.week_label || `${String(s.week_number).padStart(3, '0')}/${s.week_year % 100}`}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(s.period_start), "dd/MM", { locale: ptBR })} – {format(parseISO(s.period_end), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {(Number(s.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>
                        <Badge className={cfg.cls}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(s.id); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ExpenseSheetDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <ExpenseSheetDetail sheetId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
