import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProposalStatus = "rascunho" | "enviada" | "aprovada" | "rejeitada" | "convertida";

export interface ProposalItem {
  id: string;
  proposal_id: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  created_at: string;
}

export interface Proposal {
  id: string;
  code: string;
  title: string;
  client_id: string | null;
  lead_id: string | null;
  responsible_id: string | null;
  empresa_faturadora: string;
  service: string | null;
  scope: string | null;
  location: string | null;
  estimated_value: number | null;
  discount_pct: number | null;
  final_value: number | null;
  validity_days: number | null;
  estimated_duration: string | null;
  payment_conditions: string | null;
  technical_notes: string | null;
  status: ProposalStatus;
  sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  convertida: "Convertida",
};

export const STATUS_COLORS: Record<ProposalStatus, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-blue-100 text-blue-800",
  aprovada: "bg-green-100 text-green-800",
  rejeitada: "bg-red-100 text-red-800",
  convertida: "bg-purple-100 text-purple-800",
};

export function useProposals() {
  return useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Proposal[];
    },
  });
}

export function useProposalItems(proposalId: string | null) {
  return useQuery({
    queryKey: ["proposal_items", proposalId],
    enabled: !!proposalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", proposalId!)
        .order("sort_order");
      if (error) throw error;
      return data as ProposalItem[];
    },
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: Partial<Proposal> & { code: string; title: string }) => {
      const attemptInsert = async (retryCount: number, isRetry: boolean): Promise<Proposal> => {
        const code = isRetry ? await generateNextCode() : proposal.code;
        const payload = { ...proposal, code };
        const { data, error } = await supabase.from("proposals").insert(payload).select().single();
        if (error) {
          if (retryCount > 0 && (error.message.includes("unique") || error.message.includes("duplicate") || error.code === "23505")) {
            console.warn("Código duplicado detectado, tentando novamente:", code);
            return attemptInsert(retryCount - 1, true);
          }
          throw error;
        }
        return data as Proposal;
      };

      return attemptInsert(1, false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
  });
}

export function useUpdateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Proposal> & { id: string }) => {
      const { data, error } = await supabase.from("proposals").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Proposal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
  });
}

export function useSaveProposalItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proposalId, items }: { proposalId: string; items: Omit<ProposalItem, "id" | "created_at">[] }) => {
      // Delete existing
      await supabase.from("proposal_items").delete().eq("proposal_id", proposalId);
      // Insert new
      if (items.length > 0) {
        const { error } = await supabase.from("proposal_items").insert(items);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["proposal_items", vars.proposalId] }),
  });
}

export async function generateNextCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${year}-P-`;
  const { data } = await supabase
    .from("proposals")
    .select("code")
    .like("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  let seq = 1;
  if (data && data.length > 0) {
    const num = parseInt(data[0].code.replace(prefix, ""));
    if (!isNaN(num)) seq = num + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}
