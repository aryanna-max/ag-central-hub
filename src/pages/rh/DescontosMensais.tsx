import { useState, useMemo } from "react";
import { format, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  RefreshCw,
  Send,
  CheckCircle,
  Undo,
  Download,
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  useMonthlyDiscountReportBatches,
  useMonthlyDiscountReportBatch,
  useBatchReportItems,
  useGenerateMonthlyBatch,
  useUpdateBatchItem,
  useUpdateBatchStatus,
  useDeleteBatch,
  canTransition,
  buildThyalcontCsv,
  STATUS_LABEL,
  STATUS_COLOR,
  type BatchReportItem,
  type MonthlyReportStatus,
} from "@/hooks/useMonthlyDiscountReportBatches";

// =============================================================================
// DescontosMensais — PR B da Onda 3
// =============================================================================
// Gestão completa dos relatórios mensais que Alcione envia dia 26 para
// Thyalcont. Workflow: rascunho → revisão → enviado → aplicado.
//
// Layout:
//   Vista lista: cards dos batches mensais + botão "Gerar mês [atual]"
//   Vista detalhe: tabela de funcionários com edição inline + ações workflow
// =============================================================================

function fmt(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMes(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  return format(d, "MMMM yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase());
}

function StatusBadge({ status }: { status: MonthlyReportStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function DescontosMensais() {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-01")
  );
  const [customTitle, setCustomTitle] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<BatchReportItem | null>(null);

  const { data: batches = [], isLoading: loadingBatches } =
    useMonthlyDiscountReportBatches();
  const { data: selectedBatch } = useMonthlyDiscountReportBatch(selectedBatchId);
  const { data: items = [] } = useBatchReportItems(selectedBatchId);

  const generateMut = useGenerateMonthlyBatch();
  const updateItemMut = useUpdateBatchItem();
  const updateStatusMut = useUpdateBatchStatus();
  const deleteMut = useDeleteBatch();

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleGenerate = async () => {
    try {
      const batchId = await generateMut.mutateAsync({
        referenceMonth: generateMonth,
        title: customTitle.trim() || undefined,
      });
      toast.success(`Relatório gerado para ${formatMes(generateMonth)}`);
      setShowGenerateDialog(false);
      setCustomTitle("");
      setSelectedBatchId(batchId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar relatório";
      toast.error(msg);
    }
  };

  const handleTransition = async (newStatus: MonthlyReportStatus) => {
    if (!selectedBatch) return;
    if (newStatus === "enviado") {
      // Confirma que tudo tá revisado
      if (!confirm(
        "Marcar como ENVIADO confirma que o relatório foi transmitido para Thyalcont.\n\n" +
        "Esta ação grava data/hora e autor. Pode voltar para rascunho depois, mas fica registrado no log.\n\nContinuar?"
      )) return;
    }
    if (newStatus === "aplicado") {
      if (!confirm(
        "Marcar como APLICADO confirma que Thyalcont aplicou os descontos na folha.\n\n" +
        "Este é o último status do ciclo. Continuar?"
      )) return;
    }
    try {
      await updateStatusMut.mutateAsync({ batchId: selectedBatch.id, newStatus });
      toast.success(`Status atualizado para "${STATUS_LABEL[newStatus]}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar status";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await deleteMut.mutateAsync(deleteCandidate);
      toast.success("Relatório excluído");
      if (selectedBatchId === deleteCandidate) setSelectedBatchId(null);
      setDeleteCandidate(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir";
      toast.error(msg);
    }
  };

  const handleExportCsv = () => {
    if (!selectedBatch || items.length === 0) return;
    const csv = buildThyalcontCsv(items, selectedBatch.title);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const monthStr = selectedBatch.reference_month.slice(0, 7); // YYYY-MM
    a.download = `thyalcont-${monthStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV Thyalcont exportado");
  };

  // Totais recalculados em tempo real (também vem do banco via trigger, mas UI mostra imediato)
  const liveTotals = useMemo(() => {
    if (!items.length) return null;
    const a = items.reduce((s, i) => s + (i.alelo_valor_final ?? 0), 0);
    const v = items.reduce((s, i) => s + (i.vt_valor_final ?? 0), 0);
    const d = items.reduce((s, i) => s + (i.total_descontos ?? 0), 0);
    return {
      alelo: a,
      vt: v,
      descontos: d,
      liquido: a + v - d,
      count: items.length,
    };
  }, [items]);

  // ===========================================================================
  // Render — Vista detalhe (batch selecionado)
  // ===========================================================================

  if (selectedBatchId && selectedBatch) {
    const canEdit = selectedBatch.status === "rascunho" || selectedBatch.status === "revisao";

    return (
      <div className="p-6 space-y-4">
        {/* Header detalhe */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedBatchId(null)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {selectedBatch.title}
                <StatusBadge status={selectedBatch.status} />
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatMes(selectedBatch.reference_month)} · {selectedBatch.employee_count} funcionários
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="w-4 h-4 mr-1" /> CSV Thyalcont
            </Button>
            {canTransition(selectedBatch.status, "revisao") && (
              <Button size="sm" onClick={() => handleTransition("revisao")}>
                <RefreshCw className="w-4 h-4 mr-1" /> Marcar em revisão
              </Button>
            )}
            {canTransition(selectedBatch.status, "enviado") && (
              <Button size="sm" onClick={() => handleTransition("enviado")}>
                <Send className="w-4 h-4 mr-1" /> Enviar para Thyalcont
              </Button>
            )}
            {canTransition(selectedBatch.status, "aplicado") && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleTransition("aplicado")}>
                <CheckCircle className="w-4 h-4 mr-1" /> Confirmar aplicação
              </Button>
            )}
            {selectedBatch.status !== "rascunho" && (
              <Button variant="outline" size="sm" onClick={() => handleTransition("rascunho")}>
                <Undo className="w-4 h-4 mr-1" /> Voltar rascunho
              </Button>
            )}
          </div>
        </div>

        {/* Timestamps de workflow */}
        {(selectedBatch.sent_at || selectedBatch.applied_at) && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedBatch.sent_at && (
                  <div>
                    <p className="text-muted-foreground">Enviado</p>
                    <p className="font-medium">
                      {format(new Date(selectedBatch.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
                {selectedBatch.applied_at && (
                  <div>
                    <p className="text-muted-foreground">Aplicado pela Thyalcont</p>
                    <p className="font-medium">
                      {format(new Date(selectedBatch.applied_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Totais agregados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Alelo</p>
            <p className="text-2xl font-bold text-green-600">{fmt(liveTotals?.alelo ?? selectedBatch.total_alelo)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">VT</p>
            <p className="text-2xl font-bold text-blue-600">{fmt(liveTotals?.vt ?? selectedBatch.total_vt)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Descontos</p>
            <p className="text-2xl font-bold text-red-600">{fmt(liveTotals?.descontos ?? selectedBatch.total_descontos)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total líquido</p>
            <p className="text-2xl font-bold">{fmt(liveTotals?.liquido ?? selectedBatch.total_liquido)}</p>
          </CardContent></Card>
        </div>

        {/* Tabela de items (funcionários) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Funcionários</CardTitle>
            {!canEdit && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                Batch está <strong>{STATUS_LABEL[selectedBatch.status].toLowerCase()}</strong> — edição bloqueada. Volte para rascunho se precisar alterar.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum funcionário no relatório.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Alelo</TableHead>
                      <TableHead className="text-right">VT</TableHead>
                      <TableHead className="text-right">Desc. Ausências</TableHead>
                      <TableHead className="text-right">Desc. 6% salário</TableHead>
                      <TableHead className="text-right">Outros</TableHead>
                      <TableHead className="text-right">Total descontos</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.employees?.matricula ?? "—"}</TableCell>
                        <TableCell className="font-medium">{item.employees?.name ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmt(item.alelo_valor_final)}</TableCell>
                        <TableCell className="text-right">{fmt(item.vt_valor_final)}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {fmt((item.alelo_desconto ?? 0) + (item.vt_desconto_ausencias ?? 0))}
                        </TableCell>
                        <TableCell className="text-right text-red-600">{fmt(item.vt_desconto_salario)}</TableCell>
                        <TableCell className="text-right text-red-600">{fmt(item.outros_descontos)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(item.total_descontos)}</TableCell>
                        <TableCell>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingItem(item)}
                              className="h-7 px-2"
                            >
                              Editar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de edição de item */}
        <EditItemDialog
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (patch) => {
            if (!editingItem) return;
            try {
              await updateItemMut.mutateAsync({ id: editingItem.id, patch });
              toast.success("Item atualizado");
              setEditingItem(null);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erro ao atualizar";
              toast.error(msg);
            }
          }}
        />
      </div>
    );
  }

  // ===========================================================================
  // Render — Vista lista (todos os batches)
  // ===========================================================================

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            Descontos Mensais
          </h1>
          <p className="text-muted-foreground mt-1">
            Relatórios mensais enviados à Thyalcont (dia 26). Alelo, VT e outros descontos.
          </p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)}>
          <Plus className="w-4 h-4 mr-1" /> Gerar relatório
        </Button>
      </div>

      {loadingBatches ? (
        <p className="text-muted-foreground text-center py-12">Carregando...</p>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              Nenhum relatório gerado ainda.
            </p>
            <Button onClick={() => setShowGenerateDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> Gerar o primeiro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <Card
              key={batch.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedBatchId(batch.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{formatMes(batch.reference_month)}</p>
                    <CardTitle className="text-base mt-1">{batch.title}</CardTitle>
                  </div>
                  <StatusBadge status={batch.status} />
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Funcionários</span>
                    <span className="font-medium">{batch.employee_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total descontos</span>
                    <span className="font-medium text-red-600">{fmt(batch.total_descontos)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total líquido</span>
                    <span className="font-semibold">{fmt(batch.total_liquido)}</span>
                  </div>
                </div>
                {batch.status === "rascunho" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteCandidate(batch.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Excluir
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: Gerar novo batch */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar relatório mensal</DialogTitle>
            <DialogDescription>
              Calcula Alelo e VT para todos funcionários ativos no mês,
              baseado em system_settings + dados cadastrais. Edição manual depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Mês de referência *</Label>
              <Input
                type="month"
                value={generateMonth.slice(0, 7)}
                onChange={(e) => setGenerateMonth(e.target.value + "-01")}
              />
            </div>
            <div>
              <Label>Título (opcional)</Label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Padrão: 'Alelo + VT + Descontos — Mês Ano'"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800">
              <p className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Se já houver relatório para este mês, será atualizado sem sobrescrever edições manuais.
                </span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerate} disabled={generateMut.isPending}>
              {generateMut.isPending ? "Gerando..." : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={(o) => !o && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o batch e todos os items (um por funcionário).
              Só é permitido excluir relatórios em rascunho. Pode gerar de novo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Dialog de edição de item
// =============================================================================

function EditItemDialog({
  item,
  onClose,
  onSave,
}: {
  item: BatchReportItem | null;
  onClose: () => void;
  onSave: (patch: Partial<BatchReportItem>) => void;
}) {
  const [aleloDiasUteis, setAleloDiasUteis] = useState(0);
  const [aleloDiasAusente, setAleloDiasAusente] = useState(0);
  const [vtDiasUteis, setVtDiasUteis] = useState(0);
  const [vtDiasAusente, setVtDiasAusente] = useState(0);
  const [vtDiasCampoDistante, setVtDiasCampoDistante] = useState(0);
  const [outrosDescontos, setOutrosDescontos] = useState(0);
  const [outrosDescricao, setOutrosDescricao] = useState("");
  const [notes, setNotes] = useState("");

  const isOpen = !!item;

  useMemo(() => {
    if (item) {
      setAleloDiasUteis(item.alelo_dias_uteis ?? 0);
      setAleloDiasAusente(item.alelo_dias_ausente ?? 0);
      setVtDiasUteis(item.vt_dias_uteis ?? 0);
      setVtDiasAusente(item.vt_dias_ausente ?? 0);
      setVtDiasCampoDistante(item.vt_dias_campo_distante ?? 0);
      setOutrosDescontos(item.outros_descontos ?? 0);
      setOutrosDescricao(item.outros_descricao ?? "");
      setNotes(item.notes ?? "");
    }
  }, [item]);

  if (!item) return null;

  const emp = item.employees;
  const aleloValorDia = emp?.alelo_valor_dia ?? 15;

  // Recálculo ao vivo (o trigger do banco vai fazer o definitivo)
  const aleloValorCheio = (aleloDiasUteis - aleloDiasAusente) * aleloValorDia;
  const aleloValorFinal = emp?.recebe_alelo ? aleloValorCheio : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar: {emp?.name ?? "Funcionário"}</DialogTitle>
          <DialogDescription>
            {emp?.matricula ? `Matrícula ${emp.matricula}` : ""}
            {emp?.transporte_tipo ? ` · Transporte: ${emp.transporte_tipo}` : ""}
            {!emp?.recebe_alelo ? " · ⚠ Não recebe Alelo" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {emp?.recebe_alelo && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Alelo</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dias úteis</Label>
                  <Input
                    type="number"
                    value={aleloDiasUteis}
                    onChange={(e) => setAleloDiasUteis(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Dias ausente (descontar)</Label>
                  <Input
                    type="number"
                    value={aleloDiasAusente}
                    onChange={(e) => setAleloDiasAusente(Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Valor: ({aleloDiasUteis} − {aleloDiasAusente}) × R$ {aleloValorDia.toFixed(2)} =
                <strong> R$ {aleloValorFinal.toFixed(2)}</strong>
              </p>
            </div>
          )}

          {emp?.transporte_tipo === "vt_cartao" && !emp?.vt_isento_desconto && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">VT (cartão)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Dias úteis</Label>
                  <Input type="number" value={vtDiasUteis} onChange={(e) => setVtDiasUteis(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Ausente</Label>
                  <Input type="number" value={vtDiasAusente} onChange={(e) => setVtDiasAusente(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Campo distante</Label>
                  <Input
                    type="number"
                    value={vtDiasCampoDistante}
                    onChange={(e) => setVtDiasCampoDistante(Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Campo distante não entra no crédito (não precisou cartão).
                Desconto 6% salário: {fmt((emp?.salario_base ?? 0) * 0.06)}
              </p>
            </div>
          )}

          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Outros descontos</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={outrosDescontos}
                  onChange={(e) => setOutrosDescontos(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={outrosDescricao}
                  onChange={(e) => setOutrosDescricao(e.target.value)}
                  placeholder="Ex: adiantamento..."
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Observações internas</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const aleloDesconto = aleloDiasAusente * aleloValorDia;
              const vtTotal = (vtDiasUteis - vtDiasAusente - vtDiasCampoDistante);
              const totalDescontos =
                (emp?.recebe_alelo ? aleloDesconto : 0) +
                outrosDescontos +
                (emp?.transporte_tipo === "vt_cartao" && !emp?.vt_isento_desconto
                  ? (emp?.salario_base ?? 0) * 0.06
                  : 0);

              onSave({
                alelo_dias_uteis: aleloDiasUteis,
                alelo_dias_ausente: aleloDiasAusente,
                alelo_valor_cheio: aleloValorCheio,
                alelo_desconto: aleloDesconto,
                alelo_valor_final: aleloValorFinal,
                vt_dias_uteis: vtDiasUteis,
                vt_dias_ausente: vtDiasAusente,
                vt_dias_campo_distante: vtDiasCampoDistante,
                outros_descontos: outrosDescontos,
                outros_descricao: outrosDescricao.trim() || null,
                total_descontos: totalDescontos,
                notes: notes.trim() || null,
              });
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
