import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TerminationType =
  | "sem_justa_causa"
  | "com_justa_causa"
  | "pedido_demissao"
  | "fim_contrato"
  | "acordo_mutuo"
  | "outro";

export type AvisoPrevioType = "trabalhado" | "indenizado" | "dispensado" | "nao_aplica";

export function useTerminateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      employee_id: string;
      termination_date: string;
      termination_type: TerminationType;
      aviso_previo_type: AvisoPrevioType;
      termination_reason?: string | null;
      termination_notes?: string | null;
      termination_value?: number | null;
    }) => {
      const { error } = await (supabase as any)
        .from("employees")
        .update({
          termination_date: values.termination_date,
          termination_type: values.termination_type,
          aviso_previo_type: values.aviso_previo_type,
          termination_reason: values.termination_reason ?? null,
          termination_notes: values.termination_notes ?? null,
          termination_value: values.termination_value ?? null,
          // status=desligado + terminated_at sao aplicados pelo trigger fn_on_employee_termination
        })
        .eq("id", values.employee_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-with-absences"] });
    },
  });
}

export function useReactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employee_id: string) => {
      const { error } = await (supabase as any)
        .from("employees")
        .update({
          termination_date: null,
          termination_type: null,
          termination_reason: null,
          termination_notes: null,
          termination_value: null,
          aviso_previo_type: null,
          // trigger limpa terminated_at e volta status
        })
        .eq("id", employee_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}
