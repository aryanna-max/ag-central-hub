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
  PAYMENT_METHODS,
  type ExpenseItem,
} from "@/hooks/useExpenseSheets";

const pmIcon = (method: string) =>
  PAYMENT_METHODS.find((m) => m.value === method)?.icon ?? "—";

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

  const funcItems = items.filter((i) => (i.item_type ?? "funcionario") === "funcionario");
  const extraItems = items.filter((i) => i.item_type === "despesa_extra");
  const sumFunc = funcItems.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const sumExtra = extraItems.reduce((s, i) => s + (Number(i.value) || 0), 0);

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({ id: sheetId, status: "aprovado" });
      await createAlerts.mutateAsync([{
        alert_type: "despesa_campo",
        recipient: "financeiro",
        priority: "importante",
        title: "Folha de despesas aprovada",
        message: `Ref.: ${sheet?.week_label} • Total: ${(Number(sheet?.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
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

  const natureBadge = (item: ExpenseItem) => {
    if (item.item_type === "despesa_extra") {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-orange-500 text-white text-[10px]">DESPESA EXTRA</Badge>
          {item.fiscal_alert && (
            <Badge variant="destructive" className="text-[10px]">⚠️ AGUARDA NF/RECIBO</Badge>
          )}
        </div>
      );
    }
    return item.nature === "adiantamento" ? (
      <Badge className="bg-blue-600 text-white text-[10px]">ADIANTAMENTO</Badge>
    ) : (
      <Badge className="bg-emerald-600 text-white text-[10px]">REEMBOLSO</Badge>
    );
  };

  const statusBadge = (ps: string) => {
    if (ps === "pago") return <Badge className="bg-emerald-600 text-white text-[10px]">Pago</Badge>;
    if (ps === "estornado") return <Badge variant="destructive" className="text-[10px]">Estornado</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
  };

  const canActFinanceiro = status === "aprovado" || status === "pago";

  const renderRow = (item: ExpenseItem) => {
    const isExtra = item.item_type === "despesa_extra";
    return (
      <TableRow key={item.id} className={isExtra ? "bg-orange-50 dark:bg-orange-950/20" : ""}>
        <TableCell>{natureBadge(item)}</TableCell>
        <TableCell className="font-medium text-sm">
          {isExtra ? (item.receiver_name ?? "—") : (item.employees?.name ?? "—")}
        </TableCell>
        <TableCell className="text-xs">{item.project_name ?? "—"}</TableCell>
        <TableCell className="text-xs">{item.expense_type}</TableCell>
        <TableCell className="text-xs max-w-[180px]">{item.description}</TableCell>
        <TableCell className="text-right font-semibold text-sm">
          {Number(item.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </TableCell>
        <TableCell className="text-center" title={item.payment_method}>
          {pmIcon(item.payment_method)}
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
    );
  };

  return (
    <Dialog open={!!sheetId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Folha de Despesas — {sheet?.week_label ?? ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-6">
            {sheet?.return_comment && status === "devolvido" && (
              <div className="p-3 rounded-lg border border-destructive bg-destructive/10 text-sm">
                <span className="font-semibold text-destructive">Motivo da devolução: </span>
                <span className="text-foreground">{sheet.return_comment}</span>
              </div>
            )}

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead className="min-w-[150px]">Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Pgto</TableHead>
                    <TableHead>Status</TableHead>
                    {canActFinanceiro && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(renderRow)}
                </TableBody>
              </Table>
            </div>

            <Separator />

            {/* Subtotals */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Total Funcionários</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-300">
                  {sumFunc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Total Despesas Extras</p>
                <p className="text-lg font-bold text-orange-800 dark:text-orange-300">
                  {sumExtra.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="text-xs font-medium text-muted-foreground">Total Geral</p>
                <p className="text-lg font-bold text-foreground">
                  {(sumFunc + sumExtra).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </div>

            {status === "submetido" && (
              <>
                <Separator />
                {showReturn ? (
                  <div className="space-y-3">
                    <Label>Motivo da Devolução</Label>
                    <Textarea value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder="Descreva o motivo da devolução…" />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowReturn(false)}>Cancelar</Button>
                      <Button variant="destructive" onClick={handleReturn} disabled={updateStatus.isPending}>Confirmar Devolução</Button>
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
