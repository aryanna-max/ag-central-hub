import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClientDocRequirement =
  Database["public"]["Tables"]["client_doc_requirements"]["Row"];

export type ClientDocRequirementInput = {
  client_id: string;
  doc_type: Database["public"]["Enums"]["doc_type"];
  is_mandatory: boolean;
  validity_months: number | null;
  notes: string | null;
};

export function useClientRequirements(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-doc-requirements", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_doc_requirements")
        .select("*")
        .eq("client_id", clientId)
        .order("doc_type");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllClientRequirements() {
  return useQuery({
    queryKey: ["client-doc-requirements", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_doc_requirements")
        .select("*")
        .order("client_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: ClientDocRequirementInput) => {
      const { error } = await supabase
        .from("client_doc_requirements")
        .insert(values);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["client-doc-requirements", vars.client_id],
      });
      qc.invalidateQueries({ queryKey: ["client-doc-requirements", "all"] });
    },
  });
}

export function useDeleteRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from("client_doc_requirements")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["client-doc-requirements", vars.clientId],
      });
      qc.invalidateQueries({ queryKey: ["client-doc-requirements", "all"] });
    },
  });
}
