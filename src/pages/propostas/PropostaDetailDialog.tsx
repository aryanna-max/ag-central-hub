import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Send, Check, X, FileDown, Edit } from "lucide-react";
import { Proposal, ProposalItem, useProposalItems, useUpdateProposal, STATUS_LABELS, STATUS_COLORS } from "@/hooks/useProposals";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal | null;
  onEdit: (p: Proposal) => void;
}

export default function PropostaDetailDialog({ open, onOpenChange, proposal, onEdit }: Props) {
  const { data: items } = useProposalItems(proposal?.id || null);
  const update = useUpdateProposal();

  if (!proposal) return null;

  const handleStatusChange = async (status: string) => {
    try {
      const updates: any = { id: proposal.id, status };
      if (status === "enviada") updates.sent_at = new Date().toISOString();
      if (status === "aprovada") updates.approved_at = new Date().toISOString();
      if (status === "rejeitada") updates.rejected_at = new Date().toISOString();

      await update.mutateAsync(updates);
      toast.success(`Proposta ${STATUS_LABELS[status as keyof typeof STATUS_LABELS]}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatCurrency = (v: number | null) =>
    (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-muted-foreground">{proposal.code}</span>
            {proposal.title}
            <Badge className={STATUS_COLORS[proposal.status]}>{STATUS_LABELS[proposal.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div><span className="font-medium text-muted-foreground">Cliente:</span> {proposal.client_name || "—"}</div>
          <div><span className="font-medium text-muted-foreground">Serviço:</span> {proposal.service || "—"}</div>
          <div><span className="font-medium text-muted-foreground">Empresa:</span> {proposal.empresa_faturadora === "ag_topografia" ? "AG Topografia" : "AG Cartografia"}</div>
          <div><span className="font-medium text-muted-foreground">Responsável:</span> {proposal.responsible || "—"}</div>
          <div><span className="font-medium text-muted-foreground">Local:</span> {proposal.location || "—"}</div>
          <div><span className="font-medium text-muted-foreground">Prazo:</span> {proposal.estimated_duration || "—"}</div>
          <div><span className="font-medium text-muted-foreground">Validade:</span> {proposal.validity_days} dias</div>
          <div><span className="font-medium text-muted-foreground">Pagamento:</span> {proposal.payment_conditions || "—"}</div>
        </div>

        {proposal.scope && (
          <div className="mt-3">
            <span className="font-medium text-sm text-muted-foreground">Escopo:</span>
            <p className="mt-1 text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">{proposal.scope}</p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="mt-4">
            <span className="font-medium text-sm">Itens da Proposta</span>
            <div className="mt-2 border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-center p-2">Qtd</th>
                    <th className="text-center p-2">Un</th>
                    <th className="text-right p-2">Valor Un.</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-center">{item.unit}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                      <td className="p-2 text-right font-mono">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Separator className="my-4" />

        <div className="flex justify-between items-end">
          <div className="space-y-1 text-sm">
            <div>Subtotal: <span className="font-mono">{formatCurrency(proposal.estimated_value)}</span></div>
            {(proposal.discount_pct || 0) > 0 && (
              <div className="text-destructive">Desconto: {proposal.discount_pct}%</div>
            )}
            <div className="text-lg font-bold">Total: <span className="font-mono text-primary">{formatCurrency(proposal.final_value)}</span></div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { onEdit(proposal); onOpenChange(false); }}>
              <Edit className="w-4 h-4 mr-1" /> Editar
            </Button>
            {proposal.status === "rascunho" && (
              <Button size="sm" onClick={() => handleStatusChange("enviada")}>
                <Send className="w-4 h-4 mr-1" /> Enviar
              </Button>
            )}
            {proposal.status === "enviada" && (
              <>
                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange("aprovada")}>
                  <Check className="w-4 h-4 mr-1" /> Aprovar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleStatusChange("rejeitada")}>
                  <X className="w-4 h-4 mr-1" /> Rejeitar
                </Button>
              </>
            )}
          </div>
        </div>

        {proposal.technical_notes && (
          <div className="mt-3 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <span className="font-medium">Obs. Técnicas:</span> {proposal.technical_notes}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
