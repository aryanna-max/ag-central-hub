import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type FieldPayment = Tables<"field_payments">;
export type FieldPaymentItem = Tables<"field_payment_items">;

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

export function useFieldPaymentItems(paymentId: string | null) {
  return useQuery({
    queryKey: ["field_payment_items", paymentId],
    enabled: !!paymentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_payment_items")
        .select("*, employees(name)")
        .eq("field_payment_id", paymentId!)
        .order("created_at", { ascending: true });
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
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("field_payments")
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["field_payments"] }),
  });
}
