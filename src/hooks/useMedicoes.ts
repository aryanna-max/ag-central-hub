import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Medicao {
  id: string;
  obra_id: string | null;
  project_id: string | null;
  client_name: string | null;
  cnpj_faturamento: string | null;
  valor_nf: number | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  nf_numero: string | null;
  nf_data: string | null;
  pdf_signed_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useMedicoes() {
  return useQuery({
    queryKey: ["medicoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicoes" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Medicao[];
    },
  });
}

export function useCreateMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Medicao>) => {
      const { data, error } = await supabase
        .from("medicoes" as any)
        .insert(values as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicoes"] }),
  });
}

export function useUpdateMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Medicao> & { id: string }) => {
      const { data, error } = await supabase
        .from("medicoes" as any)
        .update(values as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicoes"] }),
  });
}

export function useDeleteMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("medicoes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicoes"] }),
  });
}
