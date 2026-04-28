import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AlertPriority = Database["public"]["Enums"]["alert_priority"];
export type AlertRecipient = Database["public"]["Enums"]["alert_recipient"];
export type AlertActionType = "aprovar" | "visualizar" | "marcar_pago" | "emitir_nf" | "conferir_recibo" | "confirmar_presenca" | "outro";

export type Alert = Database["public"]["Tables"]["alerts"]["Row"];
export type AlertInsert = Database["public"]["Tables"]["alerts"]["Insert"];
export type AlertUpdate = Database["public"]["Tables"]["alerts"]["Update"];

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Alert[];
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
        .eq("resolved", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
}

export function useUnresolvedAlerts() {
  return useQuery({
    queryKey: ["alerts", "unresolved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Alert[];
    },
    refetchInterval: 30000,
  });
}

export function useAlertsByAssignee(employeeId: string | null) {
  return useQuery({
    queryKey: ["alerts", "assignee", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("assigned_to", employeeId!)
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Alert[];
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

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolved_by }: { id: string; resolved_by?: string }) => {
      const updates: any = { resolved: true, resolved_at: new Date().toISOString(), read: true, alert_status: "resolvido" };
      if (resolved_by) updates.resolved_by = resolved_by;
      const { error } = await supabase.from("alerts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
