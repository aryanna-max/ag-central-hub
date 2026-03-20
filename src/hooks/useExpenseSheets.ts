import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const EXPENSE_TYPES = [
  "Café", "Almoço", "Jantar", "Transporte", "Diária",
  "Hospedagem", "Pedágio", "Combustível", "Outros",
] as const;

export const PAYMENT_METHODS = [
  { value: "cartao", label: "Cartão", icon: "💳" },
  { value: "cartao_despesas", label: "Cartão Despesas (Alelo/Corporativo)", icon: "💳" },
  { value: "pix", label: "PIX", icon: "📱" },
  { value: "dinheiro", label: "Dinheiro", icon: "💵" },
  { value: "transferencia", label: "Transferência", icon: "🏦" },
  { value: "boleto", label: "Boleto", icon: "📄" },
] as const;

export interface ExpenseSheet {
  id: string;
  week_number: number;
  week_year: number;
  week_label: string;
  period_start: string;
  period_end: string;
  total_value: number | null;
  status: string;
  return_comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseItem {
  id: string;
  sheet_id: string;
  employee_id: string;
  project_id: string | null;
  project_name: string | null;
  expense_type: string;
  nature: string;
  description: string;
  value: number;
  total_value: number | null;
  item_type: string;
  payment_method: string;
  receiver_id: string | null;
  receiver_name: string | null;
  receiver_document: string | null;
  receiver_type: string | null;
  intermediary_reason: string | null;
  fiscal_alert: boolean;
  payment_status: string;
  paid_at: string | null;
  created_at: string;
  employees?: { name: string } | null;
}

// ── Queries ──

export function useExpenseSheets() {
  return useQuery({
    queryKey: ["expense_sheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_expense_sheets")
        .select("*")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as unknown as ExpenseSheet[];
    },
  });
}

export function useExpenseSheetWithItems(sheetId: string | null) {
  return useQuery({
    queryKey: ["expense_sheet_detail", sheetId],
    enabled: !!sheetId,
    queryFn: async () => {
      const { data: sheet, error: sErr } = await supabase
        .from("field_expense_sheets")
        .select("*")
        .eq("id", sheetId!)
        .single();
      if (sErr) throw sErr;

      const { data: items, error: iErr } = await supabase
        .from("field_expense_items")
        .select("*, employees!field_expense_items_employee_id_fkey(name)")
        .eq("sheet_id", sheetId!)
        .order("created_at");
      if (iErr) throw iErr;

      return { sheet: sheet as unknown as ExpenseSheet, items: items as unknown as ExpenseItem[] };
    },
  });
}

// ── Mutations ──

export function useCreateExpenseSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      week_number: number;
      week_year: number;
      period_start: string;
      period_end: string;
      total_value: number;
      status: string;
    }) => {
      const { data, error } = await supabase
        .from("field_expense_sheets")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ExpenseSheet;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense_sheets"] }),
  });
}

export function useBulkCreateExpenseItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{
      sheet_id: string;
      employee_id: string;
      project_id?: string | null;
      project_name?: string | null;
      expense_type: string;
      nature: string;
      description: string;
      value: number;
      item_type?: string;
      payment_method?: string;
      receiver_id?: string | null;
      receiver_name?: string | null;
      receiver_document?: string | null;
      receiver_type?: string | null;
      intermediary_reason?: string | null;
      fiscal_alert?: boolean;
    }>) => {
      const { data, error } = await supabase
        .from("field_expense_items")
        .insert(items as any)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_sheets"] });
      qc.invalidateQueries({ queryKey: ["expense_sheet_detail"] });
    },
  });
}

export function useUpdateExpenseSheetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      status: string;
      approved_by?: string;
      return_comment?: string;
    }) => {
      const updates: any = { status: payload.status };
      if (payload.approved_by) updates.approved_by = payload.approved_by;
      if (payload.return_comment !== undefined) updates.return_comment = payload.return_comment;
      if (payload.status === "aprovado") updates.approved_at = new Date().toISOString();
      const { error } = await supabase
        .from("field_expense_sheets")
        .update(updates)
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense_sheets"] });
      qc.invalidateQueries({ queryKey: ["expense_sheet_detail"] });
    },
  });
}

export function useUpdateExpenseItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: string }) => {
      const updates: any = { payment_status };
      if (payment_status === "pago") updates.paid_at = new Date().toISOString();
      const { error } = await supabase
        .from("field_expense_items")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expense_sheet_detail"] }),
  });
}
