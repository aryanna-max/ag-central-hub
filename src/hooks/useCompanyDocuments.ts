import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CompanyDocument =
  Database["public"]["Tables"]["company_documents"]["Row"];
export type CompanyDocumentInsert =
  Database["public"]["Tables"]["company_documents"]["Insert"];
export type CompanyDocumentUpdate =
  Database["public"]["Tables"]["company_documents"]["Update"];

export type CompanyDocumentForm = {
  id?: string;
  empresa: "gonzaga_berlim" | "ag_cartografia";
  doc_type: Database["public"]["Enums"]["doc_type"];
  doc_status: Database["public"]["Enums"]["doc_status"];
  issue_date: string;
  expiry_date: string;
  notes: string;
};

export const DEFAULT_COMPANY_DOC_FORM: CompanyDocumentForm = {
  empresa: "gonzaga_berlim",
  doc_type: "pcmso",
  doc_status: "pendente",
  issue_date: "",
  expiry_date: "",
  notes: "",
};

export function useCompanyDocuments() {
  return useQuery({
    queryKey: ["company-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_documents")
        .select("*")
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertCompanyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: CompanyDocumentForm) => {
      const payload = {
        empresa: values.empresa,
        doc_type: values.doc_type,
        doc_status: values.doc_status,
        issue_date: values.issue_date || null,
        expiry_date: values.expiry_date || null,
        notes: values.notes || null,
      };
      if (values.id) {
        const { error } = await supabase
          .from("company_documents")
          .update(payload)
          .eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_documents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-documents"] }),
  });
}

export function useDeleteCompanyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("company_documents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-documents"] }),
  });
}
