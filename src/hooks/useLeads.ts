import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeadOrigin = "indicacao" | "whatsapp" | "site_instagram" | "licitacao" | "cliente_recorrente" | "contrato_ativo" | "outro";
export type LeadStatus = "novo" | "em_contato" | "qualificado" | "proposta_enviada" | "aprovado" | "convertido" | "perdido";
export type LeadInteractionType = "nota" | "ligacao" | "email" | "whatsapp" | "reuniao" | "visita";

export const ORIGIN_LABELS: Record<LeadOrigin, string> = {
  indicacao: "Indicação",
  whatsapp: "WhatsApp",
  site_instagram: "Site / Instagram",
  licitacao: "Licitação",
  cliente_recorrente: "Cliente recorrente",
  contrato_ativo: "Contrato ativo — novo serviço",
  outro: "Outro",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo",
  em_contato: "Em Contato",
  qualificado: "Qualificado",
  proposta_enviada: "Proposta Enviada",
  aprovado: "Aprovado",
  convertido: "Convertido",
  perdido: "Perdido",
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  novo: "bg-gray-100 text-gray-800",
  em_contato: "bg-cyan-100 text-cyan-800",
  qualificado: "bg-blue-100 text-blue-800",
  proposta_enviada: "bg-yellow-100 text-yellow-800",
  aprovado: "bg-green-100 text-green-800",
  convertido: "bg-green-100 text-green-800",
  perdido: "bg-red-100 text-red-800",
};

export const ORIGIN_COLORS: Record<LeadOrigin, string> = {
  cliente_recorrente: "bg-green-100 text-green-800",
  contrato_ativo: "bg-green-100 text-green-800",
  indicacao: "bg-blue-100 text-blue-800",
  whatsapp: "bg-blue-100 text-blue-800",
  site_instagram: "bg-blue-100 text-blue-800",
  licitacao: "bg-purple-100 text-purple-800",
  outro: "bg-gray-100 text-gray-800",
};

export const LEAD_STATUSES: LeadStatus[] = ["novo", "em_contato", "qualificado", "proposta_enviada", "aprovado", "convertido", "perdido"];

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  origin: LeadOrigin | null;
  status: LeadStatus;
  responsible_id: string | null;
  notes: string | null;
  tags: string[];
  cnpj: string | null;
  servico: string | null;
  endereco: string | null;
  location: string | null;
  valor: number | null;
  client_id: string | null;
  client_type: string | null;
  converted_project_id: string | null;
  codigo: string | null;
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
  origin?: LeadOrigin;
  status?: LeadStatus;
  responsible_id?: string | null;
  notes?: string | null;
  tags?: string[];
  cnpj?: string | null;
  servico?: string | null;
  endereco?: string | null;
  location?: string | null;
  valor?: number | null;
  client_id?: string | null;
  client_type?: string | null;
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
      return data as unknown as Lead[];
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
      return data as unknown as Lead;
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
      return data as unknown as LeadInteraction[];
    },
  });
}

export async function generateLeadCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-L-`;
  const { data } = await supabase
    .from("leads")
    .select("codigo")
    .like("codigo" as any, `${prefix}%`)
    .order("codigo", { ascending: false })
    .limit(1);
  const last = data?.[0]?.codigo;
  let seq = 1;
  if (last) {
    const num = parseInt(last.replace(prefix, ""));
    if (!isNaN(num)) seq = num + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

const ORIGIN_TO_SOURCE: Record<string, string> = {
  indicacao: "indicacao",
  whatsapp: "whatsapp",
  site_instagram: "site",
  licitacao: "licitacao",
  cliente_recorrente: "outros",
  contrato_ativo: "outros",
  outro: "outros",
};

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { origin, ...rest } = lead;
      const codigo = await generateLeadCode();
      const source = ORIGIN_TO_SOURCE[origin || "outro"] || "outros";
      const payload = { ...rest, origin, source: source as any, codigo };
      const { data, error } = await supabase.from("leads").insert(payload as any).select().single();
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
      const { data, error } = await supabase.from("leads").update(updates as any).eq("id", id).select().single();
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
      const { data, error } = await supabase.from("lead_interactions").insert(interaction as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lead_interactions", vars.lead_id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
