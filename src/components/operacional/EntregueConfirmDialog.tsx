import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    codigo: string | null;
    name: string;
    billing_type: string | null;
  } | null;
  onConfirm: (projectId: string) => void;
  isPending?: boolean;
}

export default function EntregueConfirmDialog({ open, onOpenChange, project, onConfirm, isPending }: Props) {
  if (!project) return null;

  const bt = project.billing_type;

  // Block if billing_type is null
  if (!bt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Faturamento não definido
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-destructive font-medium">
            Defina o tipo de faturamento antes de marcar como entregue.
          </p>
          <p className="text-sm text-muted-foreground">
            Edite o projeto <strong>{project.codigo || project.name}</strong> e selecione o tipo de faturamento.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  let title = "Confirmar entrega ao cliente";
  let description = "";

  if (bt === "entrega_nf") {
    description = "Ao confirmar, Alcione receberá email para emissão de NF.";
  } else if (bt === "entrega_recibo") {
    description = "Ao confirmar, Alcione receberá email para emissão de Recibo.";
  } else if (bt === "medicao_mensal") {
    title = "Projeto por medição";
    description = "O alerta financeiro será gerado pela medição, não pela entrega.";
  } else {
    description = "Confirmar que o projeto foi entregue ao cliente.";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Projeto: <strong>{project.codigo || "—"}</strong> — {project.name}
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm(project.id)} disabled={isPending}>
            {isPending ? "Processando..." : bt === "medicao_mensal" ? "Confirmar entrega" : "Confirmar — cliente recebeu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
