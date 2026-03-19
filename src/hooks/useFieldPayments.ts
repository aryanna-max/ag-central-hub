import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type FieldPayment = Tables<"field_payments">;
export type FieldPaymentItem = Tables<"field_payment_items">;

export type FieldPaymentStatus = "rascunho" | "submetido" | "devolvido" | "aprovada" | "paga" | "cancelada";

export const EXPENSE_TYPES = [
  "Café", "Almoço", "Jantar", "Transporte", "Diária",
  "Hospedagem", "Pedágio", "Combustível", "Outros",
] as const;

export const NATURE_OPTIONS = ["adiantamento", "reembolso"] as const;

export function useFieldPayments() {
  return useQuery({
    queryKey: ["field_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_payments")
        .select("*")
        .order("week_start", { ascending: false });
      if (error) throw error;
      return data as FieldPayment[];
    },
  });
}

export function useFieldPaymentWithItems(paymentId: string | null) {
  return useQuery({
    queryKey: ["field_payment_detail", paymentId],
    enabled: !!paymentId,
    queryFn: async () => {
      const { data: payment, error: pErr } = await supabase
        .from("field_payments")
        .select("*")
        .eq("id", paymentId!)
        .single();
      if (pErr) throw pErr;

      const { data: items, error: iErr } = await supabase
        .from("field_payment_items")
        .select("*, employees(name)")
        .eq("field_payment_id", paymentId!)
        .order("created_at");
      if (iErr) throw iErr;

      return { payment: payment as FieldPayment, items };
    },
  });
}

export function useFieldPaymentItems(paymentId: string | null) {
  return useQuery({
    queryKey: ["field_payment_items", paymentId],
    enabled: !!paymentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_payment_items")
        .select("*, employees(name)")
        .eq("field_payment_id", paymentId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateFieldPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"field_payments">) => {
      const { data, error } = await supabase
        .from("field_payments")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["field_payments"] }),
  });
}

export function useCreateFieldPaymentItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"field_payment_items">) => {
      const { data, error } = await supabase
        .from("field_payment_items")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["field_payment_items"] }),
  });
}

export function useUpdateFieldPaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, approved_by }: { id: string; status: string; approved_by?: string }) => {
      const updates: any = { status };
      if (approved_by) updates.approved_by = approved_by;
      if (status === "aprovada") updates.approved_at = new Date().toISOString();
      const { error } = await supabase.from("field_payments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field_payments"] });
      qc.invalidateQueries({ queryKey: ["field_payment_detail"] });
    },
  });
}

export function useUpdateFieldPaymentItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: string }) => {
      const updates: any = { payment_status };
      if (payment_status === "pago") updates.paid_at = new Date().toISOString();
      const { error } = await supabase.from("field_payment_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field_payment_items"] });
      qc.invalidateQueries({ queryKey: ["field_payment_detail"] });
    },
  });
}

export function useBulkCreateFieldPaymentItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: TablesInsert<"field_payment_items">[]) => {
      const { data, error } = await supabase
        .from("field_payment_items")
        .insert(items)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["field_payment_items"] });
      qc.invalidateQueries({ queryKey: ["field_payments"] });
    },
  });
}
