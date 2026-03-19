import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle, Undo2, Ban, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateAlerts, type AlertInsert } from "@/hooks/useAlerts";
import {
  useExpenseSheetWithItems,
  useUpdateExpenseSheetStatus,
  useUpdateExpenseItemStatus,
  type ExpenseItem,
} from "@/hooks/useExpenseSheets";

interface Props {
  sheetId: string | null;
  onClose: () => void;
}

export default function ExpenseSheetDetail({ sheetId, onClose }: Props) {
  const { data, isLoading } = useExpenseSheetWithItems(sheetId);
  const updateStatus = useUpdateExpenseSheetStatus();
  const updateItem = useUpdateExpenseItemStatus();
  const createAlerts = useCreateAlerts();
  const { toast } = useToast();
  const [returnComment, setReturnComment] = useState("");
  const [showReturn, setShowReturn] = useState(false);

  if (!sheetId) return null;

  const sheet = data?.sheet;
  const items = data?.items ?? [];
  const status = sheet?.status ?? "";

  const adiantamentos = items.filter((i) => i.nature === "adiantamento");
  const reembolsos = items.filter((i) => i.nature === "reembolso");
  const sumAd = adiantamentos.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const sumRe = reembolsos.reduce((s, i) => s + (Number(i.value) || 0), 0);

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({ id: sheetId, status: "aprovado" });
      await createAlerts.mutateAsync([{
        alert_type: "despesa_campo",
        recipient: "financeiro",
        priority: "importante",
        title: "Folha de despesas aprovada",
        message: `Ref.: ${sheet?.week_ref} • Total: ${(Number(sheet?.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        reference_type: "expense_sheet",
        reference_id: sheetId,
      } as AlertInsert]);
      toast({ title: "Folha aprovada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleReturn = async () => {
    if (!returnComment.trim()) {
      return toast({ title: "Informe o motivo", variant: "destructive" });
    }
    try {
      await updateStatus.mutateAsync({ id: sheetId, status: "devolvido", return_comment: returnComment });
      await createAlerts.mutateAsync([{
        alert_type: "despesa_campo",
        recipient: "operacional",
        priority: "urgente",
        title: "Folha de despesas devolvida",
        message: returnComment,
        reference_type: "expense_sheet",
        reference_id: sheetId,
      } as AlertInsert]);
      toast({ title: "Folha devolvida" });
      setShowReturn(false);
      setReturnComment("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const markPaid = async (itemId: string) => {
    try {
      await updateItem.mutateAsync({ id: itemId, payment_status: "pago" });
      toast({ title: "Item marcado como pago" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const reverse = async (itemId: string) => {
    try {
      await updateItem.mutateAsync({ id: itemId, payment_status: "estornado" });
      toast({ title: "Adiantamento estornado" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const natureBadge = (nature: string) =>
    nature === "adiantamento" ? (
      <Badge className="bg-blue-600 text-white text-[10px]">ADIANTAMENTO</Badge>
    ) : (
      <Badge className="bg-emerald-600 text-white text-[10px]">REEMBOLSO</Badge>
    );

  const statusBadge = (ps: string) => {
    if (ps === "pago") return <Badge className="bg-emerald-600 text-white text-[10px]">Pago</Badge>;
    if (ps === "estornado") return <Badge variant="destructive" className="text-[10px]">Estornado</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
  };

  const canActFinanceiro = status === "aprovado" || status === "pago";

  return (
    <Dialog open={!!sheetId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Folha de Despesas — {sheet?.week_ref ?? ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-6">
            {/* Return comment banner */}
            {sheet?.return_comment && status === "devolvido" && (
              <div className="p-3 rounded-lg border border-destructive bg-destructive/10 text-sm">
                <span className="font-semibold text-destructive">Motivo da devolução: </span>
                <span className="text-foreground">{sheet.return_comment}</span>
              </div>
            )}

            {/* Items table */}
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Natureza</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="min-w-[180px]">Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Pgto</TableHead>
                    {canActFinanceiro && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{natureBadge(item.nature)}</TableCell>
                      <TableCell className="font-medium text-sm">{item.employees?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{item.expense_type}</TableCell>
                      <TableCell className="text-xs max-w-[220px]">{item.description}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {Number(item.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>{statusBadge(item.payment_status)}</TableCell>
                      {canActFinanceiro && (
                        <TableCell className="text-right">
                          {item.payment_status === "pendente" && (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" onClick={() => markPaid(item.id)}>
                                <DollarSign className="w-3 h-3 mr-1" /> Pagar
                              </Button>
                              {item.nature === "adiantamento" && (
                                <Button size="sm" variant="destructive" onClick={() => reverse(item.id)}>
                                  <Ban className="w-3 h-3 mr-1" /> Estornar
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />

            {/* Subtotals */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Adiantamentos</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-300">
                  {sumAd.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Reembolsos</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                  {sumRe.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="text-xs font-medium text-muted-foreground">Total Geral</p>
                <p className="text-lg font-bold text-foreground">
                  {(sumAd + sumRe).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </div>

            {/* Approval actions */}
            {status === "submetido" && (
              <>
                <Separator />
                {showReturn ? (
                  <div className="space-y-3">
                    <Label>Motivo da Devolução</Label>
                    <Textarea
                      value={returnComment}
                      onChange={(e) => setReturnComment(e.target.value)}
                      placeholder="Descreva o motivo da devolução…"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowReturn(false)}>Cancelar</Button>
                      <Button variant="destructive" onClick={handleReturn} disabled={updateStatus.isPending}>
                        Confirmar Devolução
                      </Button>
                    </div>
                  </div>
                ) : (
                  <DialogFooter className="flex gap-2">
                    <Button variant="destructive" onClick={() => setShowReturn(true)}>
                      <Undo2 className="w-4 h-4 mr-2" /> Devolver
                    </Button>
                    <Button onClick={handleApprove} disabled={updateStatus.isPending} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                      <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
