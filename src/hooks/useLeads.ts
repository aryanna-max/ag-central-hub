import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeadSource = "whatsapp" | "telefone" | "email" | "site" | "indicacao" | "rede_social" | "licitacao" | "outros";
export type LeadStatus = "novo" | "em_contato" | "qualificado" | "convertido" | "descartado";
export type LeadInteractionType = "nota" | "ligacao" | "email" | "whatsapp" | "reuniao" | "visita";

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: LeadSource;
  status: LeadStatus;
  responsible: string | null;
  notes: string | null;
  tags: string[];
  obra_id: string | null;
  cnpj: string | null;
  obra_id: string | null;
  servico: string | null;
  endereco: string | null;
  valor: number | null;
  created_at: string;
  updated_at: string;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  interaction_type: LeadInteractionType;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface LeadInsert {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  responsible?: string | null;
  notes?: string | null;
  tags?: string[];
  cnpj?: string | null;
  obra_id?: string | null;
  servico?: string | null;
  endereco?: string | null;
  valor?: number | null;
}

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });
}

export function useLeadById(id: string | undefined) {
  return useQuery({
    queryKey: ["leads", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Lead;
    },
  });
}

export function useLeadInteractions(leadId: string | undefined) {
  return useQuery({
    queryKey: ["lead_interactions", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_interactions")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadInteraction[];
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data, error } = await supabase.from("leads").insert(lead).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { data, error } = await supabase.from("leads").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads", vars.id] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useAddLeadInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interaction: Omit<LeadInteraction, "id" | "created_at">) => {
      const { data, error } = await supabase.from("lead_interactions").insert(interaction).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lead_interactions", vars.lead_id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
