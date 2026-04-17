import { useState, useMemo } from "react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  RefreshCw,
  Send,
  Check,
  Trash2,
  ChevronRight,
  Download,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { exportCsv } from "@/lib/exportCsv";
import {
  useMonthlyDiscountReports,
  useMonthlyDiscountReport,
  useGenerateMonthlyDiscountReport,
  useUpdateMonthlyDiscountReportItem,
  useUpdateMonthlyDiscountReportStatus,
  useDeleteMonthlyDiscountReport,
  type MonthlyReportStatus,
} from "@/hooks/useMonthlyDiscountReports";

const STATUS_LABEL: Record<MonthlyReportStatus, string> = {
  rascunho: "Rascunho",
  revisao: "Em revisão",
  enviado: "Enviado",
  aplicado: "Aplicado",
};

const STATUS_CLASS: Record<MonthlyReportStatus, string> = {
  rascunho: "bg-gray-100 text-gray-700 border-gray-300",
  revisao: "bg-yellow-100 text-yellow-800 border-yellow-300",
  enviado: "bg-blue-100 text-blue-800 border-blue-300",
  aplicado: "bg-green-100 text-green-800 border-green-300",
};

function fmt(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: MonthlyReportStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function DescontosMensais() {
  const { data: reports = [], isLoading } = useMonthlyDiscountReports();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail } = useMonthlyDiscountReport(selectedId);

  const generateMut = useGenerateMonthlyDiscountReport();
  const updateItemMut = useUpdateMonthlyDiscountReportItem();
  const updateStatusMut = useUpdateMonthlyDiscountReportStatus();
  const deleteMut = useDeleteMonthlyDiscountReport();

  // Default reference month: current
  const [refMonth, setRefMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  const selectedReport = detail?.report ?? null;
  const items = detail?.items ?? [];
  const isLocked = selectedReport?.status === "enviado" || selectedReport?.status === "aplicado";

  // Quick-pick months (current + last 3)
  const quickMonths = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 4 }).map((_, i) => {
      const d = subMonths(base, i);
      return {
        value: format(d, "yyyy-MM"),
        label: format(d, "MMM yyyy", { locale: ptBR }),
      };
    });
  }, []);

  const handleGenerate = async () => {
    try {
      const reportId = await generateMut.mutateAsync(refMonth + "-01");
      setSelectedId(reportId);
      toast.success("Relatório gerado");
    } catch (err: any) {
      toast.error(`Erro ao gerar: ${err.message}`);
    }
  };

  const handleStatusChange = async (status: MonthlyReportStatus) => {
    if (!selectedReport) return;
    try {
      await updateStatusMut.mutateAsync({ id: selectedReport.id, status });
      toast.success(
        status === "enviado"
          ? "Marcado como enviado ao Thyalcont"
          : status === "aplicado"
            ? "Marcado como aplicado na folha"
            : `Status: ${STATUS_LABEL[status]}`
      );
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleExportCsv = () => {
    if (!selectedReport || !items.length) return;
    const rows = items.map((item: any) => [
      item.employees?.matricula ?? "",
      item.employees?.name ?? "",
      item.employees?.empresa_emissora ?? "",
      String(item.alelo_dias ?? 0),
      Number(item.alelo_valor_dia ?? 0).toFixed(2),
      Number(item.alelo_total ?? 0).toFixed(2),
      String(item.vt_viagens ?? 0),
      Number(item.vt_valor_viagem ?? 0).toFixed(2),
      Number(item.vt_total ?? 0).toFixed(2),
      Number(item.descontos_semanais ?? 0).toFixed(2),
      Number(item.valor_liquido ?? 0).toFixed(2),
    ]);
    exportCsv(
      [
        "Matrícula",
        "Nome",
        "Empresa",
        "Alelo dias",
        "Alelo R$/dia",
        "Alelo total",
        "VT viagens",
        "VT R$/viagem",
        "VT total",
        "Descontos semanais",
        "Valor líquido",
      ],
      rows,
      `descontos_${selectedReport.reference_month}.csv`
    );
    toast.success("CSV exportado");
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await deleteMut.mutateAsync(deleteCandidate);
      if (deleteCandidate === selectedId) setSelectedId(null);
      toast.success("Relatório excluído");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setDeleteCandidate(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6" /> Descontos Mensais
          </h1>
          <p className="text-muted-foreground text-sm">
            Relatório consolidado Alelo + VT + Descontos semanais → Thyalcont (dia 26)
          </p>
        </div>
      </div>

      {/* Generator card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gerar / regenerar relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Mês referência</Label>
              <Input
                type="month"
                value={refMonth}
                onChange={(e) => setRefMonth(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {quickMonths.map((q) => (
                <Button
                  key={q.value}
                  size="sm"
                  variant={refMonth === q.value ? "default" : "outline"}
                  onClick={() => setRefMonth(q.value)}
                >
                  {q.label}
                </Button>
              ))}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateMut.isPending}
              className="ml-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${generateMut.isPending ? "animate-spin" : ""}`} />
              Gerar / Atualizar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            Consolida <strong className="mx-0.5">dias presentes × Alelo</strong>, <strong className="mx-0.5">viagens × VT</strong> e <strong className="mx-0.5">descontos semanais</strong> (Encontro de Contas). Relatórios enviados/aplicados não são regenerados.
          </p>
        </CardContent>
      </Card>

      {/* Reports list */}
      <div className="grid md:grid-cols-[340px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Relatórios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-4">Carregando...</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Nenhum relatório gerado.</p>
            ) : (
              <div className="divide-y">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                      r.id === selectedId ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">
                        {format(new Date(r.reference_month + "T12:00:00"), "MMM yyyy", { locale: ptBR })}
                      </p>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <StatusBadge status={r.status} />
                      <span className="text-xs font-mono">{fmt(r.total_liquido)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <Card>
          {!selectedReport ? (
            <CardContent className="py-16 text-center text-muted-foreground">
              Selecione um relatório à esquerda ou gere um novo.
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{selectedReport.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={selectedReport.status} />
                      <span className="text-xs text-muted-foreground">
                        {items.length} funcionário{items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={!items.length}>
                      <Download className="w-4 h-4 mr-1" /> CSV
                    </Button>
                    {selectedReport.status === "rascunho" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange("revisao")}
                          disabled={updateStatusMut.isPending}
                        >
                          Revisar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteCandidate(selectedReport.id)}
                          className="text-destructive"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {selectedReport.status === "revisao" && (
                      <Button size="sm" onClick={() => handleStatusChange("enviado")} disabled={updateStatusMut.isPending}>
                        <Send className="w-4 h-4 mr-1" /> Enviar à Thyalcont
                      </Button>
                    )}
                    {selectedReport.status === "enviado" && (
                      <Button size="sm" onClick={() => handleStatusChange("aplicado")} disabled={updateStatusMut.isPending}>
                        <Check className="w-4 h-4 mr-1" /> Marcar Aplicado
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Totals */}
                <div className="grid grid-cols-4 gap-2 p-4 border-b">
                  <div>
                    <p className="text-xs text-muted-foreground">Alelo</p>
                    <p className="font-bold text-green-700">{fmt(selectedReport.total_alelo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">VT</p>
                    <p className="font-bold text-blue-700">{fmt(selectedReport.total_vt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Descontos</p>
                    <p className="font-bold text-red-700">- {fmt(selectedReport.total_descontos)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Líquido</p>
                    <p className="font-bold">{fmt(selectedReport.total_liquido)}</p>
                  </div>
                </div>

                {/* Items table */}
                <div className="overflow-x-auto max-h-[520px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead className="text-right">Alelo dias</TableHead>
                        <TableHead className="text-right">Alelo total</TableHead>
                        <TableHead className="text-right">VT viagens</TableHead>
                        <TableHead className="text-right">VT total</TableHead>
                        <TableHead className="text-right">Descontos</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhum item. Clique em &quot;Gerar / Atualizar&quot;.
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium text-sm">{item.employees?.name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {item.employees?.matricula ?? ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={item.alelo_dias}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateItemMut.mutate({
                                    id: item.id,
                                    alelo_dias: Number(e.target.value),
                                    alelo_valor_dia: item.alelo_valor_dia,
                                    alelo_desconto_faltas: item.alelo_desconto_faltas,
                                    vt_viagens: item.vt_viagens,
                                    vt_valor_viagem: item.vt_valor_viagem,
                                    vt_desconto_faltas: item.vt_desconto_faltas,
                                    descontos_semanais: item.descontos_semanais,
                                  })
                                }
                                className="w-16 h-8 text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{fmt(item.alelo_total)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={item.vt_viagens}
                                disabled={isLocked}
                                onChange={(e) =>
                                  updateItemMut.mutate({
                                    id: item.id,
                                    alelo_dias: item.alelo_dias,
                                    alelo_valor_dia: item.alelo_valor_dia,
                                    alelo_desconto_faltas: item.alelo_desconto_faltas,
                                    vt_viagens: Number(e.target.value),
                                    vt_valor_viagem: item.vt_valor_viagem,
                                    vt_desconto_faltas: item.vt_desconto_faltas,
                                    descontos_semanais: item.descontos_semanais,
                                  })
                                }
                                className="w-16 h-8 text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{fmt(item.vt_total)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-red-600">
                              - {fmt(item.descontos_semanais)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">{fmt(item.valor_liquido)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <AlertDialog open={!!deleteCandidate} onOpenChange={(v) => !v && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Apenas relatórios em rascunho podem ser excluídos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
