import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AlertPriority = "urgente" | "importante" | "informacao";
export type AlertRecipient = "operacional" | "comercial" | "financeiro" | "rh" | "sala_tecnica" | "diretoria" | "todos";
export type AlertActionType = "aprovar" | "visualizar" | "marcar_pago" | "emitir_nf" | "conferir_recibo" | "confirmar_presenca" | "outro";

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
  assigned_to: string | null;
  action_url: string | null;
  action_label: string | null;
  action_type: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface AlertInsert {
  alert_type: string;
  priority?: AlertPriority;
  recipient: AlertRecipient;
  title: string;
  message?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  assigned_to?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  action_type?: string | null;
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
      const { error } = await supabase.from("alerts").insert(alerts as any);
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
      const { error } = await supabase.from("alerts").update({ read: true } as any).eq("id", id);
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
      const { error } = await supabase.from("alerts").update({ read: true } as any).eq("read", false);
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
      const updates: any = { resolved: true, resolved_at: new Date().toISOString(), read: true };
      if (resolved_by) updates.resolved_by = resolved_by;
      const { error } = await supabase.from("alerts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
