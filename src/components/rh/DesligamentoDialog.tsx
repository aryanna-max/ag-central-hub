import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import type { Employee } from "@/hooks/useEmployees";
import {
  useTerminateEmployee,
  useReactivateEmployee,
  type TerminationType,
  type AvisoPrevioType,
} from "@/hooks/useEmployeeTermination";

type Props = {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  sem_justa_causa: "Sem justa causa",
  com_justa_causa: "Com justa causa",
  pedido_demissao: "Pedido de demissão",
  fim_contrato: "Fim de contrato",
  acordo_mutuo: "Acordo mútuo",
  outro: "Outro",
};

const AVISO_PREVIO_LABELS: Record<AvisoPrevioType, string> = {
  trabalhado: "Trabalhado",
  indenizado: "Indenizado",
  dispensado: "Dispensado",
  nao_aplica: "Não se aplica",
};

export default function DesligamentoDialog({ employee, open, onOpenChange }: Props) {
  const terminate = useTerminateEmployee();
  const reactivate = useReactivateEmployee();

  const isAlreadyTerminated = !!(employee as any)?.termination_date;

  const [terminationDate, setTerminationDate] = useState("");
  const [terminationType, setTerminationType] = useState<TerminationType>("sem_justa_causa");
  const [avisoPrevio, setAvisoPrevio] = useState<AvisoPrevioType>("trabalhado");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open && employee) {
      const e = employee as any;
      setTerminationDate(e.termination_date || new Date().toISOString().slice(0, 10));
      setTerminationType(e.termination_type || "sem_justa_causa");
      setAvisoPrevio(e.aviso_previo_type || "trabalhado");
      setReason(e.termination_reason || "");
      setNotes(e.termination_notes || "");
      setValue(e.termination_value ? String(e.termination_value) : "");
    }
  }, [open, employee]);

  const handleConfirm = async () => {
    if (!employee) return;
    if (!terminationDate) {
      toast.error("Data de desligamento é obrigatória");
      return;
    }
    try {
      await terminate.mutateAsync({
        employee_id: employee.id,
        termination_date: terminationDate,
        termination_type: terminationType,
        aviso_previo_type: avisoPrevio,
        termination_reason: reason.trim() || null,
        termination_notes: notes.trim() || null,
        termination_value: value ? Number(value) : null,
      });
      toast.success(`${employee.name} desligado(a) em ${terminationDate}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro ao desligar: ${err.message}`);
    }
  };

  const handleReactivate = async () => {
    if (!employee) return;
    if (!confirm(`Reverter o desligamento de ${employee.name}? O status voltará a "Disponível".`)) return;
    try {
      await reactivate.mutateAsync(employee.id);
      toast.success(`${employee.name} reativado(a)`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isAlreadyTerminated ? "Desligamento registrado" : "Desligar Funcionário"}
          </DialogTitle>
        </DialogHeader>

        {employee && (
          <div className="space-y-4">
            <div className="bg-muted rounded-md p-3 text-sm">
              <p className="font-semibold">{employee.name}</p>
              <p className="text-muted-foreground text-xs">
                {employee.matricula || "sem matrícula"} · {employee.role}
              </p>
            </div>

            {isAlreadyTerminated && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Este funcionário já está desligado. Você pode editar os dados abaixo ou reativá-lo.
                </p>
              </div>
            )}

            <div>
              <Label>Data do desligamento *</Label>
              <Input
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={terminationType} onValueChange={(v) => setTerminationType(v as TerminationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TERMINATION_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aviso prévio</Label>
              <Select value={avisoPrevio} onValueChange={(v) => setAvisoPrevio(v as AvisoPrevioType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AVISO_PREVIO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Motivo</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Redução de quadro, performance..."
              />
            </div>

            <div>
              <Label>Valor da rescisão (R$)</Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                step="0.01"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes, pendências, acertos..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {isAlreadyTerminated && (
            <Button
              variant="outline"
              onClick={handleReactivate}
              disabled={reactivate.isPending}
            >
              Reativar
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={terminate.isPending}
            variant={isAlreadyTerminated ? "default" : "destructive"}
          >
            {terminate.isPending
              ? "Salvando..."
              : isAlreadyTerminated
                ? "Atualizar"
                : "Confirmar Desligamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
