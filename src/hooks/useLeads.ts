import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LeadOrigin = "indicacao" | "whatsapp" | "site_instagram" | "licitacao" | "cliente_recorrente" | "contrato_ativo" | "outro";
export type LeadStatus = "novo" | "em_negociacao" | "proposta_enviada" | "convertido" | "perdido";
export type LeadInteractionType = "nota" | "ligacao" | "email" | "whatsapp" | "reuniao" | "visita";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadInteractionRow = Database["public"]["Tables"]["lead_interactions"]["Row"];

/** Normaliza status legados do banco para os 5 status simplificados */
export function normalizeLeadStatus(raw: string): LeadStatus {
  if (raw === "em_contato" || raw === "qualificado") return "em_negociacao";
  if (raw === "descartado") return "perdido";
  if (raw === "aprovado") return "convertido";
  return raw as LeadStatus;
}

/** Status ativos (visíveis por padrão) vs históricos (ocultos por padrão) */
export const ACTIVE_STATUSES: LeadStatus[] = ["novo", "em_negociacao", "proposta_enviada", "convertido"];
export const KANBAN_STATUSES: LeadStatus[] = ["novo", "em_negociacao", "proposta_enviada", "convertido"];
export const HISTORY_STATUSES: LeadStatus[] = ["perdido"];

/**
 * Versão livre (Decisão #19, redesenho 28/04/2026):
 *  - Estados terminais (convertido, perdido) NÃO voltam.
 *  - Qualquer estado ativo pode ir pra qualquer outro estado ativo.
 *  - Saltos permitidos pra cliente recorrente sem proposta formal.
 */
export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return false;
  if (from === "convertido" || from === "perdido") return false;
  return true;
}

/** Salto de funil — usado para mostrar toast informativo (não bloqueia). */
export function isSkippingFunnel(from: LeadStatus, to: LeadStatus): boolean {
  return from !== "proposta_enviada" && to === "convertido";
}

/** @deprecated 2026-04-28 (Decisão #19). Use canTransitionLead() instead. */
export const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  novo: ["em_negociacao", "perdido"],
  em_negociacao: ["proposta_enviada", "perdido"],
  proposta_enviada: ["convertido", "perdido"],
  convertido: [],
  perdido: [],
};

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
  em_negociacao: "Em negociação",
  proposta_enviada: "Proposta enviada",
  convertido: "Convertido",
  perdido: "Perdido",
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  novo: "bg-blue-100 text-blue-800",
  em_negociacao: "bg-emerald-100 text-emerald-800",
  proposta_enviada: "bg-amber-100 text-amber-800",
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

export const LEAD_STATUSES: LeadStatus[] = ["novo", "em_negociacao", "proposta_enviada", "convertido", "perdido"];

export type Lead = Omit<LeadRow, "status" | "origin" | "tags"> & {
  status: LeadStatus;
  origin: LeadOrigin | null;
  tags: string[];
};

export type LeadInteraction = Omit<LeadInteractionRow, "interaction_type"> & {
  interaction_type: LeadInteractionType;
};

export type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
export type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        status: normalizeLeadStatus(l.status),
      })) as Lead[];
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
    .like("codigo", `${prefix}%`)
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
      const source = ORIGIN_TO_SOURCE[origin || "outro"] || "outros";

      const attemptInsert = async (retryCount: number): Promise<any> => {
        const codigo = await generateLeadCode();
        const payload: LeadInsert = { ...rest, origin, source: source as LeadInsert["source"], codigo };
        const { data, error } = await supabase.from("leads").insert(payload).select().single();
        if (error) {
          if (retryCount > 0 && (error.message.includes("unique") || error.message.includes("duplicate") || error.code === "23505")) {
            console.warn("Código duplicado detectado, tentando novamente:", codigo);
            return attemptInsert(retryCount - 1);
          }
          throw error;
        }
        return data;
      };

      return attemptInsert(1);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate & { id: string }) => {
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
