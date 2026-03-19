import { useState, useMemo } from "react";
import { format, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Eye, DollarSign, Clock, CheckCircle, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFieldPayments } from "@/hooks/useFieldPayments";
import DespesaCampoDrawer from "@/components/operacional/DespesaCampoDrawer";
import DespesaCampoDetail from "@/components/operacional/DespesaCampoDetail";

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-gray-500 text-white hover:bg-gray-600" },
  submetido: { label: "Submetido", className: "bg-blue-600 text-white hover:bg-blue-700" },
  devolvido: { label: "Devolvido", className: "bg-red-600 text-white hover:bg-red-700" },
  aprovada: { label: "Aprovado", className: "bg-emerald-800 text-white hover:bg-emerald-900" },
  paga: { label: "Pago", className: "bg-emerald-500 text-white hover:bg-emerald-600" },
  cancelada: { label: "Cancelada", className: "bg-gray-400 text-white hover:bg-gray-500" },
};

export default function DespesasCampo() {
  const { data: payments = [], isLoading } = useFieldPayments();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const filtered = useMemo(() => {
    if (!filterStart && !filterEnd) return payments;
    return payments.filter((p) => {
      const ws = parseISO(p.week_start);
      const start = filterStart ? parseISO(filterStart) : new Date("1970-01-01");
      const end = filterEnd ? parseISO(filterEnd) : new Date("2099-12-31");
      return isWithinInterval(ws, { start, end });
    });
  }, [payments, filterStart, filterEnd]);

  const totalGeral = filtered.reduce((s, p) => s + (Number(p.total_value) || 0), 0);
  const pendentes = filtered.filter((p) => ["rascunho", "submetido", "em_revisao"].includes(p.status ?? "")).length;
  const aprovadas = filtered.filter((p) => ["aprovada", "paga"].includes(p.status ?? "")).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Despesas de Campo</h1>
          <p className="text-muted-foreground text-sm">Folhas de pagamento semanais de campo</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Folha
        </Button>
      </div>

      {/* Date range filter */}
      <div className="flex items-end gap-4">
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

      {/* KPIs */}
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma folha encontrada</TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const cfg = statusConfig[p.status ?? "rascunho"] ?? statusConfig.rascunho;
                  const ws = parseISO(p.week_start);
                  const we = parseISO(p.week_end);
                  return (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelectedId(p.id)}>
                      <TableCell className="font-medium">
                        Sem. {format(ws, "dd/MM", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(ws, "dd/MM", { locale: ptBR })} – {format(we, "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">—</TableCell>
                      <TableCell className="text-right font-semibold">
                        {(Number(p.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>
                        <Badge className={cfg.className}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}>
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

      <DespesaCampoDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <DespesaCampoDetail paymentId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
