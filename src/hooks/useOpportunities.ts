import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OpportunityStage = "prospeccao" | "qualificacao" | "proposta_enviada" | "negociacao" | "fechado_ganho" | "fechado_perdido";

export interface Opportunity {
  id: string;
  name: string;
  lead_id: string | null;
  client: string | null;
  client_id: string | null;
  value: number | null;
  stage: OpportunityStage;
  responsible: string | null;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpportunityInsert {
  name: string;
  lead_id?: string | null;
  client?: string | null;
  value?: number | null;
  stage?: OpportunityStage;
  responsible?: string | null;
  expected_close_date?: string | null;
  notes?: string | null;
}

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospeccao: "Prospecção",
  qualificacao: "Qualificação",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado_ganho: "Fechado (Ganho)",
  fechado_perdido: "Fechado (Perdido)",
};

export const STAGE_COLORS: Record<OpportunityStage, string> = {
  prospeccao: "bg-blue-100 text-blue-800",
  qualificacao: "bg-amber-100 text-amber-800",
  proposta: "bg-purple-100 text-purple-800",
  negociacao: "bg-orange-100 text-orange-800",
  fechado_ganho: "bg-green-100 text-green-800",
  fechado_perdido: "bg-red-100 text-red-800",
};

export const PIPELINE_STAGES: OpportunityStage[] = [
  "prospeccao",
  "qualificacao",
  "proposta",
  "negociacao",
  "fechado_ganho",
  "fechado_perdido",
];

export function useOpportunities() {
  return useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Opportunity[];
    },
  });
}

export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opp: OpportunityInsert) => {
      const { data, error } = await supabase.from("opportunities").insert(opp).select().single();
      if (error) throw error;
      return data as Opportunity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}

export function useUpdateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Opportunity> & { id: string }) => {
      const { data, error } = await supabase.from("opportunities").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Opportunity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}

export function useDeleteOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}
