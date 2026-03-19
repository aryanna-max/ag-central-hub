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
  useFieldPaymentWithItems,
  useUpdateFieldPaymentStatus,
  useUpdateFieldPaymentItemStatus,
} from "@/hooks/useFieldPayments";

interface Props {
  paymentId: string | null;
  onClose: () => void;
}

export default function DespesaCampoDetail({ paymentId, onClose }: Props) {
  const { data, isLoading } = useFieldPaymentWithItems(paymentId);
  const updateStatus = useUpdateFieldPaymentStatus();
  const updateItemStatus = useUpdateFieldPaymentItemStatus();
  const createAlerts = useCreateAlerts();
  const { toast } = useToast();
  const [returnComment, setReturnComment] = useState("");
  const [showReturn, setShowReturn] = useState(false);

  if (!paymentId) return null;

  const payment = data?.payment;
  const items = data?.items ?? [];

  const adiantamentos = items.filter((i: any) => i.nature === "adiantamento");
  const reembolsos = items.filter((i: any) => i.nature === "reembolso");
  const sumAd = adiantamentos.reduce((s: number, i: any) => s + (Number(i.total_value) || 0), 0);
  const sumRe = reembolsos.reduce((s: number, i: any) => s + (Number(i.total_value) || 0), 0);

  const status = payment?.status as string;

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({ id: paymentId, status: "aprovada" as any });
      await createAlerts.mutateAsync([
        {
          alert_type: "despesa_campo",
          recipient: "financeiro",
          priority: "importante",
          title: "Folha de despesas aprovada",
          message: `Folha aprovada pela diretoria. Total: ${(Number(payment?.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
          reference_type: "field_payment",
          reference_id: paymentId,
        } as AlertInsert,
      ]);
      toast({ title: "Folha aprovada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleReturn = async () => {
    if (!returnComment.trim()) return toast({ title: "Informe o motivo da devolução", variant: "destructive" });
    try {
      await updateStatus.mutateAsync({ id: paymentId, status: "devolvido" as any });
      await createAlerts.mutateAsync([
        {
          alert_type: "despesa_campo",
          recipient: "operacional",
          priority: "urgente",
          title: "Folha de despesas devolvida",
          message: returnComment,
          reference_type: "field_payment",
          reference_id: paymentId,
        } as AlertInsert,
      ]);
      toast({ title: "Folha devolvida" });
      setShowReturn(false);
      setReturnComment("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleMarkPaid = async (itemId: string) => {
    try {
      await updateItemStatus.mutateAsync({ id: itemId, payment_status: "pago" });
      toast({ title: "Item marcado como pago" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleReverse = async (itemId: string) => {
    try {
      await updateItemStatus.mutateAsync({ id: itemId, payment_status: "estornado" });
      toast({ title: "Adiantamento estornado" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const renderItemRow = (item: any) => {
    const isAdiantamento = item.nature === "adiantamento";
    const isPago = item.payment_status === "pago";
    const isEstornado = item.payment_status === "estornado";

    return (
      <TableRow key={item.id}>
        <TableCell>
          <Badge className={isAdiantamento ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"}>
            {isAdiantamento ? "ADIANTAMENTO" : "REEMBOLSO"}
          </Badge>
        </TableCell>
        <TableCell className="font-medium">{item.employees?.name ?? "—"}</TableCell>
        <TableCell className="text-xs">{item.expense_type ?? "—"}</TableCell>
        <TableCell className="max-w-[200px] text-xs">{item.description ?? item.notes ?? "—"}</TableCell>
        <TableCell className="text-right font-semibold">
          {(Number(item.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </TableCell>
        <TableCell>
          {isPago && <Badge variant="default" className="bg-emerald-600 text-white">Pago</Badge>}
          {isEstornado && <Badge variant="destructive">Estornado</Badge>}
          {!isPago && !isEstornado && <Badge variant="secondary">Pendente</Badge>}
        </TableCell>
        <TableCell className="text-right">
          {(status === "aprovada" || status === "paga") && !isPago && !isEstornado && (
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="outline" onClick={() => handleMarkPaid(item.id)}>
                <DollarSign className="w-3 h-3 mr-1" /> Pagar
              </Button>
              {isAdiantamento && (
                <Button size="sm" variant="destructive" onClick={() => handleReverse(item.id)}>
                  <Ban className="w-3 h-3 mr-1" /> Estornar
                </Button>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Dialog open={!!paymentId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Folha de Despesas</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-6">
            {/* Items table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Natureza</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Pgto</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(renderItemRow)}
              </TableBody>
            </Table>

            <Separator />

            {/* Subtotals */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Adiantamentos</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-300">
                  {sumAd.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Reembolsos</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                  {sumRe.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted border">
                <p className="text-xs text-muted-foreground font-medium">Total Geral</p>
                <p className="text-lg font-bold text-foreground">
                  {(sumAd + sumRe).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </div>

            {/* Approval actions (visible when submetido) */}
            {status === "submetido" && (
              <>
                <Separator />
                {showReturn ? (
                  <div className="space-y-3">
                    <Label>Motivo da Devolução</Label>
                    <Textarea
                      value={returnComment}
                      onChange={(e) => setReturnComment(e.target.value)}
                      placeholder="Descreva o motivo da devolução..."
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
                    <Button onClick={handleApprove} disabled={updateStatus.isPending} className="bg-emerald-700 hover:bg-emerald-800">
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
