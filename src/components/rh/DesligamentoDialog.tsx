import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { Employee } from "@/hooks/useEmployees";
import { useUpdateEmployee } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// =============================================================================
// DesligamentoDialog — desliga ou reativa funcionário
// =============================================================================
// Usa campos já existentes da Fase 3B em `employees`:
//   - data_demissao DATE
//   - motivo_demissao TEXT
//   - status (muda para 'desligado' / volta para 'disponivel')
// =============================================================================

type MotivoPadronizado =
  | "sem_justa_causa"
  | "com_justa_causa"
  | "pedido_demissao"
  | "fim_contrato"
  | "acordo_mutuo"
  | "outro";

const MOTIVO_LABELS: Record<MotivoPadronizado, string> = {
  sem_justa_causa: "Sem justa causa",
  com_justa_causa: "Com justa causa",
  pedido_demissao: "Pedido de demissão",
  fim_contrato: "Fim de contrato",
  acordo_mutuo: "Acordo mútuo",
  outro: "Outro motivo",
};

type Props = {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type EmployeeWithTermination = Employee & {
  data_demissao?: string | null;
  motivo_demissao?: string | null;
};

export default function DesligamentoDialog({ employee, open, onOpenChange }: Props) {
  const updateEmployee = useUpdateEmployee();
  const qc = useQueryClient();

  const emp = employee as EmployeeWithTermination | null;
  const isAlreadyTerminated = !!emp?.data_demissao;

  const [dataDemissao, setDataDemissao] = useState("");
  const [motivoPadrao, setMotivoPadrao] = useState<MotivoPadronizado>("sem_justa_causa");
  const [motivoLivre, setMotivoLivre] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && emp) {
      setDataDemissao(emp.data_demissao || new Date().toISOString().slice(0, 10));
      setMotivoPadrao("sem_justa_causa");
      setMotivoLivre(emp.motivo_demissao || "");
    }
  }, [open, emp]);

  const handleTerminate = async () => {
    if (!emp) return;
    if (!dataDemissao) {
      toast.error("Data de desligamento é obrigatória");
      return;
    }
    if (motivoPadrao === "outro" && !motivoLivre.trim()) {
      toast.error("Informe o motivo");
      return;
    }

    const motivoFinal = motivoPadrao === "outro"
      ? motivoLivre.trim()
      : `${MOTIVO_LABELS[motivoPadrao]}${motivoLivre.trim() ? ` — ${motivoLivre.trim()}` : ""}`;

    setSubmitting(true);
    try {
      // Usa supabase direto — updateEmployee do hook pode não ter esses campos no tipo
      const { error } = await supabase
        .from("employees")
        .update({
          status: "desligado",
          data_demissao: dataDemissao,
          motivo_demissao: motivoFinal,
        })
        .eq("id", emp.id);

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`${emp.name} desligado(a)`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao desligar";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async () => {
    if (!emp) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          status: "disponivel",
          data_demissao: null,
          motivo_demissao: null,
        })
        .eq("id", emp.id);

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`${emp.name} reativado(a)`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao reativar";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!emp) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAlreadyTerminated ? (
              <><RefreshCw className="w-5 h-5 text-blue-500" />Reativar Funcionário</>
            ) : (
              <><AlertTriangle className="w-5 h-5 text-red-500" />Desligar Funcionário</>
            )}
          </DialogTitle>
          <DialogDescription>
            {emp.name}{emp.matricula ? ` · Matrícula ${emp.matricula}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isAlreadyTerminated ? (
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p><strong>Desligado em:</strong> {emp.data_demissao}</p>
              {emp.motivo_demissao && (
                <p className="mt-1"><strong>Motivo:</strong> {emp.motivo_demissao}</p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Reativar remove a data de demissão e retorna o funcionário para status "Disponível".
              A admissão original é preservada.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Data de desligamento *</Label>
              <Input type="date" value={dataDemissao} onChange={(e) => setDataDemissao(e.target.value)} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Select value={motivoPadrao} onValueChange={(v) => setMotivoPadrao(v as MotivoPadronizado)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MOTIVO_LABELS) as MotivoPadronizado[]).map((k) => (
                    <SelectItem key={k} value={k}>{MOTIVO_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                {motivoPadrao === "outro" ? "Descreva o motivo *" : "Observações (opcional)"}
              </Label>
              <Textarea
                value={motivoLivre}
                onChange={(e) => setMotivoLivre(e.target.value)}
                rows={3}
                placeholder={motivoPadrao === "outro" ? "Obrigatório" : "Detalhes adicionais..."}
              />
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800">
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Este funcionário sai da escala, dos cálculos de folha e dos relatórios ativos.
                  Cálculo de rescisão (verbas, FGTS) é feito fora do sistema — envie para Thyalcont.
                </span>
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          {isAlreadyTerminated ? (
            <Button onClick={handleReactivate} disabled={submitting}>
              {submitting ? "Reativando..." : "Reativar"}
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleTerminate} disabled={submitting}>
              {submitting ? "Desligando..." : "Confirmar desligamento"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
