import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AlertPriority = "urgente" | "importante" | "informacao";
export type AlertRecipient = "operacional" | "comercial" | "financeiro" | "rh" | "sala_tecnica" | "diretoria" | "todos";

export interface Alert {
  id: string;
  alert_type: string;
  priority: AlertPriority;
  recipient: AlertRecipient;
  title: string;
  message: string | null;
  reference_type: string | null;
  reference_id: string | null;
  read: boolean;
  created_at: string;
}

export interface AlertInsert {
  alert_type: string;
  priority?: AlertPriority;
  recipient: AlertRecipient;
  title: string;
  message?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Alert[];
    },
  });
}

export function useUnreadAlertCount() {
  return useQuery({
    queryKey: ["alerts", "unread_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
}

export function useCreateAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alerts: AlertInsert[]) => {
      const { error } = await supabase.from("alerts").insert(alerts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useMarkAllAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("alerts").update({ read: true }).eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
