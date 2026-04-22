import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// =============================================================================
// Hook — employee_dependents (PR C, Onda 3)
// =============================================================================
// Base para cálculo correto de IRRF, plano saúde, salário família.
// Elimina planilha IRRF manual da Alcione (Entrega A do objetivo).
// =============================================================================

export type Parentesco =
  | "filho"
  | "filha"
  | "conjuge"
  | "companheiro"
  | "pai"
  | "mae"
  | "outro";

export const PARENTESCO_LABELS: Record<Parentesco, string> = {
  filho: "Filho(a)",
  filha: "Filha",
  conjuge: "Cônjuge",
  companheiro: "Companheiro(a)",
  pai: "Pai",
  mae: "Mãe",
  outro: "Outro",
};

export type EmployeeDependent = {
  id: string;
  employee_id: string;
  name: string;
  cpf: string | null;
  data_nascimento: string | null;
  parentesco: Parentesco;
  is_dependente_irrf: boolean;
  is_dependente_saude: boolean;
  is_dependente_salario_familia: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeDependentInsert = Omit<
  EmployeeDependent,
  "id" | "created_at" | "updated_at"
>;

export type EmployeeDependentUpdate = Partial<
  Omit<EmployeeDependent, "id" | "employee_id" | "created_at" | "updated_at">
>;

/**
 * Lista dependentes de um funcionário.
 */
export function useEmployeeDependents(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["employee_dependents", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_dependents")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("data_nascimento", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as EmployeeDependent[];
    },
  });
}

/**
 * Cria dependente.
 */
export function useCreateDependent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EmployeeDependentInsert) => {
      const { data, error } = await supabase
        .from("employee_dependents")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as EmployeeDependent;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["employee_dependents", vars.employee_id] });
    },
  });
}

/**
 * Atualiza dependente.
 */
export function useUpdateDependent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      employeeId,
      patch,
    }: {
      id: string;
      employeeId: string;
      patch: EmployeeDependentUpdate;
    }) => {
      const { error } = await supabase
        .from("employee_dependents")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["employee_dependents", vars.employeeId] });
    },
  });
}

/**
 * Remove dependente.
 */
export function useDeleteDependent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { error } = await supabase
        .from("employee_dependents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["employee_dependents", vars.employeeId] });
    },
  });
}

/**
 * Calcula idade em anos a partir da data de nascimento.
 */
export function calculateAge(birthDateISO: string | null): number | null {
  if (!birthDateISO) return null;
  const birth = new Date(birthDateISO + "T12:00:00");
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Conta dependentes elegíveis para IRRF (para cálculo de dedução).
 * Regra (simplificada): filhos até 21 anos, ou até 24 se universitário (não
 * rastreamos aqui), ou cônjuge/companheiro, ou dependentes marcados como IRRF.
 */
export function countDependentsForIrrf(dependents: EmployeeDependent[]): number {
  return dependents.filter((d) => d.is_dependente_irrf).length;
}
