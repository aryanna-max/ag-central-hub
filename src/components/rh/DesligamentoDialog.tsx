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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// =============================================================================
// DesligamentoDialog — enriquecido com enums Fase 3 original (resgate Onda 3)
// =============================================================================
// Campos usados (schema migration 20260422_onda3_pessoas_completo.sql):
//   - data_demissao DATE (preservado da Fase 3B)
//   - motivo_demissao TEXT (preservado, livre)
//   - termination_type ENUM ⭐ (6 valores padronizados)
//   - aviso_previo_type ENUM ⭐ (4 valores)
//   - termination_value NUMERIC ⭐ (valor da rescisão)
//   - termination_notes TEXT ⭐ (observações extras)
//   - terminated_by UUID ⭐ (auth.uid — auditoria)
//   - terminated_at TIMESTAMPTZ ⭐ (now())
//   - status → 'desligado' / 'disponivel' (reativar)
// =============================================================================

type TerminationType =
  | "sem_justa_causa"
  | "com_justa_causa"
  | "pedido_demissao"
  | "fim_contrato"
  | "acordo_mutuo"
  | "outro";

type AvisoPrevioType = "trabalhado" | "indenizado" | "dispensado" | "nao_aplica";

const TERMINATION_TYPE_LABELS: Record<TerminationType, string> = {
  sem_justa_causa: "Sem justa causa",
  com_justa_causa: "Com justa causa",
  pedido_demissao: "Pedido de demissão",
  fim_contrato: "Fim de contrato (temporário/estágio)",
  acordo_mutuo: "Acordo mútuo",
  outro: "Outro motivo",
};

const AVISO_PREVIO_LABELS: Record<AvisoPrevioType, string> = {
  trabalhado: "Trabalhado (funcionário cumpre 30 dias)",
  indenizado: "Indenizado (empresa paga em vez de cumprir)",
  dispensado: "Dispensado (empresa não exige cumprimento)",
  nao_aplica: "Não se aplica",
};

// Default combinations — facilita vida do usuário
const DEFAULT_AVISO_BY_TYPE: Record<TerminationType, AvisoPrevioType> = {
  sem_justa_causa: "indenizado",
  com_justa_causa: "nao_aplica",
  pedido_demissao: "trabalhado",
  fim_contrato: "nao_aplica",
  acordo_mutuo: "indenizado",
  outro: "trabalhado",
};

type Props = {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type EmployeeWithTermination = Employee & {
  data_demissao?: string | null;
  motivo_demissao?: string | null;
  termination_type?: TerminationType | null;
  aviso_previo_type?: AvisoPrevioType | null;
  termination_value?: number | null;
  termination_notes?: string | null;
  terminated_at?: string | null;
};

export default function DesligamentoDialog({ employee, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const emp = employee as EmployeeWithTermination | null;
  const isAlreadyTerminated = !!emp?.data_demissao;

  const [dataDemissao, setDataDemissao] = useState("");
  const [terminationType, setTerminationType] = useState<TerminationType>("sem_justa_causa");
  const [avisoPrevio, setAvisoPrevio] = useState<AvisoPrevioType>("indenizado");
  const [terminationValue, setTerminationValue] = useState("");
  const [motivoLivre, setMotivoLivre] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userTouchedAviso, setUserTouchedAviso] = useState(false);

  useEffect(() => {
    if (open && emp) {
      setDataDemissao(emp.data_demissao || new Date().toISOString().slice(0, 10));
      setTerminationType(emp.termination_type || "sem_justa_causa");
      setAvisoPrevio(emp.aviso_previo_type || DEFAULT_AVISO_BY_TYPE["sem_justa_causa"]);
      setTerminationValue(emp.termination_value ? String(emp.termination_value) : "");
      setMotivoLivre(emp.motivo_demissao || "");
      setNotes(emp.termination_notes || "");
      setSubmitting(false);
      setUserTouchedAviso(false);
    }
  }, [open, emp]);

  // Auto-atualiza aviso prévio quando o tipo muda (até o usuário editar manualmente)
  useEffect(() => {
    if (!userTouchedAviso) {
      setAvisoPrevio(DEFAULT_AVISO_BY_TYPE[terminationType]);
    }
  }, [terminationType, userTouchedAviso]);

  const handleTerminate = async () => {
    if (!emp) return;
    if (!dataDemissao) {
      toast.error("Data de desligamento é obrigatória");
      return;
    }
    if (terminationType === "outro" && !motivoLivre.trim()) {
      toast.error("Para 'Outro motivo', descreva o motivo");
      return;
    }

    setSubmitting(true);
    try {
      const authUser = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase
        .from("employees")
        .update({
          status: "desligado",
          data_demissao: dataDemissao,
          motivo_demissao: motivoLivre.trim() || null,
          termination_type: terminationType,
          aviso_previo_type: avisoPrevio,
          termination_value: terminationValue ? parseFloat(terminationValue) : null,
          termination_notes: notes.trim() || null,
          terminated_by: authUser?.id || null,
          terminated_at: new Date().toISOString(),
        })
        .eq("id", emp.id);

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`${emp.name} desligado(a) em ${format(new Date(dataDemissao + "T12:00"), "dd/MM/yyyy", { locale: ptBR })}`);
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
          termination_type: null,
          aviso_previo_type: null,
          termination_value: null,
          termination_notes: null,
          terminated_by: null,
          terminated_at: null,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
              <p>
                <strong>Desligado em:</strong>{" "}
                {emp.data_demissao && format(new Date(emp.data_demissao + "T12:00"), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              {emp.termination_type && (
                <p>
                  <strong>Tipo:</strong> {TERMINATION_TYPE_LABELS[emp.termination_type]}
                </p>
              )}
              {emp.aviso_previo_type && (
                <p>
                  <strong>Aviso prévio:</strong> {AVISO_PREVIO_LABELS[emp.aviso_previo_type]}
                </p>
              )}
              {emp.termination_value && (
                <p>
                  <strong>Valor rescisão:</strong> R$ {emp.termination_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              )}
              {emp.motivo_demissao && (
                <p>
                  <strong>Motivo:</strong> {emp.motivo_demissao}
                </p>
              )}
              {emp.termination_notes && (
                <p>
                  <strong>Observações:</strong> {emp.termination_notes}
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Reativar limpa os campos de desligamento e retorna o funcionário para status "Disponível".
              A admissão original é preservada.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de desligamento *</Label>
                <Input type="date" value={dataDemissao} onChange={(e) => setDataDemissao(e.target.value)} />
              </div>
              <div>
                <Label>Valor rescisão (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={terminationValue}
                  onChange={(e) => setTerminationValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label>Tipo de rescisão *</Label>
              <Select value={terminationType} onValueChange={(v) => setTerminationType(v as TerminationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TERMINATION_TYPE_LABELS) as TerminationType[]).map((k) => (
                    <SelectItem key={k} value={k}>{TERMINATION_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aviso prévio</Label>
              <Select
                value={avisoPrevio}
                onValueChange={(v) => {
                  setAvisoPrevio(v as AvisoPrevioType);
                  setUserTouchedAviso(true);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(AVISO_PREVIO_LABELS) as AvisoPrevioType[]).map((k) => (
                    <SelectItem key={k} value={k}>{AVISO_PREVIO_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Sugestão padrão baseada no tipo — editável se o caso real diferir.
              </p>
            </div>

            <div>
              <Label>
                {terminationType === "outro" ? "Descreva o motivo *" : "Motivo (livre, opcional)"}
              </Label>
              <Input
                value={motivoLivre}
                onChange={(e) => setMotivoLivre(e.target.value)}
                placeholder={terminationType === "outro" ? "Obrigatório para 'Outro motivo'" : "Ex: redução quadro, mudança de cidade..."}
              />
            </div>

            <div>
              <Label>Observações internas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notas para DP/Thyalcont, detalhes do acordo, pendências..."
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800">
              <p className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Este funcionário sai da escala, dos cálculos de folha e dos relatórios ativos.
                  <strong> Cálculo de verbas rescisórias (FGTS, férias, 13º)</strong> é feito fora do sistema — envie para Thyalcont.
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
