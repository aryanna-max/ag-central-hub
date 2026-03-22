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
  service: string | null;
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
  client_id?: string | null;
  value?: number | null;
  stage?: OpportunityStage;
  service?: string | null;
  responsible?: string | null;
  expected_close_date?: string | null;
  notes?: string | null;
}

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospeccao: "Prospecção",
  qualificacao: "Qualificação",
  proposta_enviada: "Proposta Enviada",
  negociacao: "Negociação",
  fechado_ganho: "Ganho",
  fechado_perdido: "Perdido",
};

export const STAGE_COLORS: Record<OpportunityStage, string> = {
  prospeccao: "bg-blue-100 text-blue-800 border-blue-300",
  qualificacao: "bg-amber-100 text-amber-800 border-amber-300",
  proposta_enviada: "bg-purple-100 text-purple-800 border-purple-300",
  negociacao: "bg-orange-100 text-orange-800 border-orange-300",
  fechado_ganho: "bg-green-100 text-green-800 border-green-300",
  fechado_perdido: "bg-red-100 text-red-800 border-red-300",
};

export const PIPELINE_STAGES: OpportunityStage[] = [
  "prospeccao",
  "qualificacao",
  "proposta_enviada",
  "negociacao",
  "fechado_ganho",
  "fechado_perdido",
];

export const ACTIVE_STAGES: OpportunityStage[] = [
  "prospeccao",
  "qualificacao",
  "proposta_enviada",
  "negociacao",
];

export const SERVICOS = [
  "Levantamento Planimétrico",
  "Levantamento Altimétrico",
  "Levantamento Planialtimétrico",
  "Levantamento Cadastral Urbano",
  "Levantamento Cadastral Rural",
  "Levantamento para Projeto de Engenharia",
  "Levantamento Batimétrico",
  "Levantamento com Drone/VANT",
  "Escaneamento Laser 3D",
  "Georreferenciamento INCRA",
  "Desmembramento de Área",
  "Remembramento de Área",
  "Usucapião",
  "Retificação em Cartório",
  "Locação de Obra",
  "Controle de Terraplenagem",
  "As-built",
  "Acompanhamento de Obras",
  "Topografia Industrial",
  "Supervisão Técnica",
  "Projeto de Loteamento",
];

export function useOpportunities() {
  return useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Opportunity[];
    },
  });
}

export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opp: OpportunityInsert) => {
      const { data, error } = await supabase.from("opportunities" as any).insert(opp as any).select().single();
      if (error) throw error;
      return data as unknown as Opportunity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}

export function useUpdateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Opportunity> & { id: string }) => {
      const { data, error } = await supabase.from("opportunities" as any).update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data as unknown as Opportunity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}

export function useDeleteOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunities" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities"] }),
  });
}
